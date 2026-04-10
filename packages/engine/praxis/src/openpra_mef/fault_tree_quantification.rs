/// Fault-tree quantification via the praxis engine.
///
/// Accepts a JSON request containing an OpenPRA MEF `FaultTreeGraph` and
/// returns a JSON result with:
///   - top-event probability
///   - cut sets (for ZBDD and MOCUS) sorted by increasing probability
///   - per-cut-set probability and fractional contribution
///
/// Three algorithms:
///   - `"bdd"`   — exact top-event probability only (no cut-set enumeration)
///   - `"zbdd"`  — SCRAM ZBDD algorithm: cut sets + approximation-based probability
///   - `"mocus"` — MOCUS algorithm: cut sets + approximation-based probability
///
/// Two approximations (ZBDD and MOCUS only):
///   - `"rare_event"` — P(top) ≈ Σ P(MCS_i)
///   - `"mcub"`       — P(top) ≈ 1 − ∏(1 − P(MCS_i))
use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::algorithms::bdd::Bdd;
use crate::algorithms::mocus::{CutSet, Mocus};
use crate::algorithms::zbdd::Zbdd;
use crate::core::event::{BasicEvent, HouseEvent};
use crate::core::fault_tree::FaultTree;
use crate::core::gate::{Formula, Gate};
use crate::error::{PraxisError, Result};

// ─── Request ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuantificationRequest {
    pub graph: MefFaultTreeGraph,
    pub algorithm: AlgorithmKind,
    #[serde(default)]
    pub approximation: Option<ApproximationKind>,
    #[serde(default)]
    pub max_order: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MefFaultTreeGraph {
    pub fault_tree_id: String,
    pub top_event_id: String,
    pub nodes: HashMap<String, MefFaultTreeNode>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MefFaultTreeNode {
    #[serde(default)]
    pub uuid: String,
    pub node_type: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub inputs: Vec<String>,
    /// Constant probability (when `probabilityType == "constant"`).
    #[serde(default)]
    pub probability: Option<f64>,
    #[serde(default)]
    pub probability_type: Option<String>,
    #[serde(default)]
    pub probability_distribution: Option<MefDistribution>,
    /// K value for ATLEAST_GATE.
    #[serde(default)]
    pub k_value: Option<usize>,
    /// State for HOUSE_EVENT.
    #[serde(default)]
    pub house_event_value: Option<bool>,
}

/// Discriminated union of distributions, tagged on the `type` field.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MefDistribution {
    /// Lognormal (on-demand): parameterised by median and error factor.
    #[serde(rename = "lognormal")]
    Lognormal { median: f64, #[serde(rename = "errorFactor")] error_factor: f64 },

    /// Lognormal (time-based): parameterised by log-mean and log-std-dev.
    #[serde(rename = "lognormal_time")]
    LognormalTime { mean: f64, #[serde(rename = "stdDev")] std_dev: f64 },

    /// Beta distribution: parameterised by α and β.
    #[serde(rename = "beta")]
    Beta { alpha: f64, #[serde(rename = "betaParam")] beta_param: f64 },

    /// Normal distribution.
    #[serde(rename = "normal")]
    Normal { mean: f64, #[serde(rename = "stdDev")] std_dev: f64 },

    /// Uniform distribution.
    #[serde(rename = "uniform")]
    Uniform { lower: f64, upper: f64 },

    /// Exponential (during-operation): parameterised by failure rate λ.
    #[serde(rename = "exponential")]
    Exponential { #[serde(rename = "failureRate")] failure_rate: f64 },

    /// Weibull distribution.
    #[serde(rename = "weibull")]
    Weibull { scale: f64, shape: f64, location: f64 },

    /// Gamma distribution.
    #[serde(rename = "gamma")]
    Gamma { shape: f64, rate: f64 },
}

impl MefDistribution {
    /// Returns the point-estimate (mean) probability for the distribution.
    /// Uses 1 time unit for rate-based (during-operation) models.
    pub fn point_estimate(&self) -> f64 {
        match self {
            // On-demand distributions — return the median / mean directly.
            MefDistribution::Lognormal { median, .. } => *median,
            MefDistribution::LognormalTime { mean, std_dev } => {
                // E[X] = exp(mu + sigma^2/2) where mu=mean, sigma=std_dev (log-space).
                (mean + std_dev * std_dev / 2.0).exp().min(1.0)
            }
            MefDistribution::Beta { alpha, beta_param } => {
                let sum = alpha + beta_param;
                if sum > 0.0 { alpha / sum } else { 0.0 }
            }
            MefDistribution::Normal { mean, .. } => mean.clamp(0.0, 1.0),
            MefDistribution::Uniform { lower, upper } => (lower + upper) / 2.0,

            // Rate-based distributions — P ≈ 1 − exp(−λ·T), T=1.
            MefDistribution::Exponential { failure_rate } => {
                (1.0 - (-failure_rate).exp()).clamp(0.0, 1.0)
            }
            MefDistribution::Weibull { scale, shape, .. } => {
                // Mean of Weibull = scale · Γ(1 + 1/shape).
                // For a probability, treat as P ≈ 1 − exp(−(1/scale)^shape).
                (1.0 - (-(1.0_f64 / scale).powf(*shape)).exp()).clamp(0.0, 1.0)
            }
            MefDistribution::Gamma { shape, rate } => {
                // Mean = shape/rate; treat as probability.
                (shape / rate).clamp(0.0, 1.0)
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AlgorithmKind {
    Bdd,
    Zbdd,
    Mocus,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ApproximationKind {
    RareEvent,
    Mcub,
}

// ─── Result ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuantificationResult {
    pub algorithm: String,
    pub approximation: Option<String>,
    pub top_event_probability: f64,
    pub cut_sets: Vec<CutSetResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CutSetResult {
    /// Human-readable event names in this cut set.
    pub events: Vec<String>,
    pub probability: f64,
    /// Fractional contribution: probability / top_event_probability.
    /// 0.0 when top-event probability is 0.
    pub contribution: f64,
}

// ─── Public contract function ─────────────────────────────────────────────────

/// Parse `request_json`, quantify, and return the result as a JSON string.
pub fn quantify_fault_tree_contract(request_json: &str) -> Result<String> {
    let request: QuantificationRequest =
        serde_json::from_str(request_json).map_err(|e| {
            PraxisError::Logic(format!("Failed to parse quantification request: {e}"))
        })?;

    let result = quantify(&request)?;

    serde_json::to_string(&result)
        .map_err(|e| PraxisError::Logic(format!("Failed to serialize quantification result: {e}")))
}

// ─── Core quantification ──────────────────────────────────────────────────────

fn quantify(request: &QuantificationRequest) -> Result<QuantificationResult> {
    // Build uuid→name map (for cut set display) and event probability map.
    let mut uuid_to_name: HashMap<String, String> = HashMap::new();
    let mut prob_by_uuid: HashMap<String, f64> = HashMap::new();

    for (uuid, node) in &request.graph.nodes {
        let display_name = if node.name.is_empty() { uuid.clone() } else { node.name.clone() };
        uuid_to_name.insert(uuid.clone(), display_name);

        if is_basic_event_type(&node.node_type) {
            let p = extract_probability(node);
            prob_by_uuid.insert(uuid.clone(), p);
        }
    }

    // Convert to praxis FaultTree.
    let fault_tree = mef_graph_to_fault_tree(&request.graph)?;

    match request.algorithm {
        AlgorithmKind::Bdd => quantify_bdd(&fault_tree),
        AlgorithmKind::Zbdd => {
            let approx = request.approximation.unwrap_or(ApproximationKind::RareEvent);
            quantify_zbdd(&fault_tree, approx, request.max_order, &uuid_to_name, &prob_by_uuid)
        }
        AlgorithmKind::Mocus => {
            let approx = request.approximation.unwrap_or(ApproximationKind::RareEvent);
            quantify_mocus(&fault_tree, approx, request.max_order, &uuid_to_name, &prob_by_uuid)
        }
    }
}

// ─── Algorithm implementations ────────────────────────────────────────────────

/// BDD: exact top-event probability only.  No cut-set enumeration.
fn quantify_bdd(fault_tree: &FaultTree) -> Result<QuantificationResult> {
    let mut bdd = Bdd::new();
    let root = bdd.from_fault_tree(fault_tree)?;
    let top_prob = bdd.probability(root);

    Ok(QuantificationResult {
        algorithm: "bdd".into(),
        approximation: None,
        top_event_probability: top_prob,
        cut_sets: vec![],
    })
}

/// ZBDD: cut-set enumeration via SCRAM ZBDD algorithm + approximation.
fn quantify_zbdd(
    fault_tree: &FaultTree,
    approx: ApproximationKind,
    max_order: Option<usize>,
    uuid_to_name: &HashMap<String, String>,
    prob_by_uuid: &HashMap<String, f64>,
) -> Result<QuantificationResult> {
    let (zbdd, root) = Zbdd::from_fault_tree(fault_tree)?;
    let raw_cut_sets = zbdd.get_cut_sets(root, max_order);

    finish_with_cut_sets(raw_cut_sets, approx, "zbdd", uuid_to_name, prob_by_uuid)
}

/// MOCUS: cut-set enumeration via MOCUS algorithm + approximation.
fn quantify_mocus(
    fault_tree: &FaultTree,
    approx: ApproximationKind,
    max_order: Option<usize>,
    uuid_to_name: &HashMap<String, String>,
    prob_by_uuid: &HashMap<String, f64>,
) -> Result<QuantificationResult> {
    let mut analyzer = Mocus::new(fault_tree);
    if let Some(k) = max_order {
        analyzer = analyzer.with_max_order(k);
    }
    let cut_sets = analyzer.analyze()?.to_vec();

    finish_with_cut_sets(cut_sets, approx, "mocus", uuid_to_name, prob_by_uuid)
}

/// Shared post-processing: compute probabilities, apply approximation, sort.
fn finish_with_cut_sets(
    raw_cut_sets: Vec<CutSet>,
    approx: ApproximationKind,
    algorithm_label: &str,
    uuid_to_name: &HashMap<String, String>,
    prob_by_uuid: &HashMap<String, f64>,
) -> Result<QuantificationResult> {
    // Compute per-cut-set probabilities.
    let mut cut_set_probs: Vec<(CutSet, f64)> = raw_cut_sets
        .into_iter()
        .map(|cs| {
            let p = cut_set_probability(&cs, prob_by_uuid);
            (cs, p)
        })
        .collect();

    // Sort by increasing probability (lowest-probability cut sets first).
    cut_set_probs.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    // Approximate top-event probability.
    let top_prob = match approx {
        ApproximationKind::RareEvent => {
            cut_set_probs.iter().map(|(_, p)| p).sum::<f64>().min(1.0)
        }
        ApproximationKind::Mcub => {
            1.0 - cut_set_probs.iter().fold(1.0, |acc, (_, p)| acc * (1.0 - p))
        }
    };

    // Build result cut sets.
    let cut_sets = cut_set_probs
        .into_iter()
        .map(|(cs, p)| {
            let events: Vec<String> = cs
                .events
                .iter()
                .map(|uuid| uuid_to_name.get(uuid).cloned().unwrap_or_else(|| uuid.clone()))
                .collect();
            let contribution = if top_prob > 0.0 { p / top_prob } else { 0.0 };
            CutSetResult { events, probability: p, contribution }
        })
        .collect();

    Ok(QuantificationResult {
        algorithm: algorithm_label.into(),
        approximation: Some(approx_label(approx).into()),
        top_event_probability: top_prob,
        cut_sets,
    })
}

fn approx_label(approx: ApproximationKind) -> &'static str {
    match approx {
        ApproximationKind::RareEvent => "rare_event",
        ApproximationKind::Mcub => "mcub",
    }
}

/// Product of all event probabilities in a cut set.
fn cut_set_probability(cs: &CutSet, prob_by_uuid: &HashMap<String, f64>) -> f64 {
    cs.events.iter().fold(1.0, |acc, uuid| {
        acc * prob_by_uuid.get(uuid).copied().unwrap_or(0.0)
    })
}

// ─── MEF graph → praxis FaultTree ────────────────────────────────────────────

fn mef_graph_to_fault_tree(graph: &MefFaultTreeGraph) -> Result<FaultTree> {
    let top_node = graph.nodes.get(&graph.top_event_id).ok_or_else(|| {
        PraxisError::Logic(format!(
            "Top event node '{}' not found in graph",
            graph.top_event_id
        ))
    })?;

    // Resolve the actual top gate: if the top node is not a gate, look for its
    // first child that is a gate.  In practice the MEF serializer always makes
    // the top node a gate, but be defensive.
    let top_gate_id = resolve_top_gate(graph, &graph.top_event_id, top_node)?;

    let mut ft = FaultTree::new(graph.fault_tree_id.clone(), top_gate_id)?;

    for (uuid, node) in &graph.nodes {
        add_node_to_fault_tree(&mut ft, uuid, node)?;
    }

    Ok(ft)
}

/// Determine the ID to use as `top_event` in the praxis `FaultTree`.
/// Returns the uuid directly if it is a gate node; otherwise looks for the
/// first gate-type child.
fn resolve_top_gate(
    graph: &MefFaultTreeGraph,
    uuid: &str,
    node: &MefFaultTreeNode,
) -> Result<String> {
    if is_gate_type(&node.node_type) {
        return Ok(uuid.to_string());
    }
    // Not a gate — check inputs for a gate child.
    for child_uuid in &node.inputs {
        if let Some(child) = graph.nodes.get(child_uuid) {
            if is_gate_type(&child.node_type) {
                return Ok(child_uuid.clone());
            }
        }
    }
    // Last resort: treat the node itself as the top even if it's not a gate.
    Ok(uuid.to_string())
}

fn add_node_to_fault_tree(ft: &mut FaultTree, uuid: &str, node: &MefFaultTreeNode) -> Result<()> {
    match node.node_type.as_str() {
        "AND_GATE" | "INHIBIT_GATE" => {
            let mut gate = Gate::new(uuid.to_string(), Formula::And)?;
            for child in &node.inputs {
                gate.add_operand(child.clone());
            }
            ft.add_gate(gate)?;
        }
        "OR_GATE" => {
            let mut gate = Gate::new(uuid.to_string(), Formula::Or)?;
            for child in &node.inputs {
                gate.add_operand(child.clone());
            }
            ft.add_gate(gate)?;
        }
        "ATLEAST_GATE" => {
            let k = node.k_value.unwrap_or(2);
            let mut gate = Gate::new(uuid.to_string(), Formula::AtLeast { min: k })?;
            for child in &node.inputs {
                gate.add_operand(child.clone());
            }
            ft.add_gate(gate)?;
        }
        "BASIC_EVENT" | "INTERMEDIATE_EVENT" | "UNDEVELOPED_EVENT" => {
            // Nodes that have children are treated as gates; leaf nodes are basic events.
            if !node.inputs.is_empty() {
                // Treat as an OR gate connecting its inputs (common for intermediate events).
                let mut gate = Gate::new(uuid.to_string(), Formula::Or)?;
                for child in &node.inputs {
                    gate.add_operand(child.clone());
                }
                ft.add_gate(gate)?;
            } else {
                let p = extract_probability(node).clamp(0.0, 1.0);
                let event = BasicEvent::new(uuid.to_string(), p)?;
                ft.add_basic_event(event)?;
            }
        }
        "HOUSE_EVENT" | "TRUE_EVENT" | "FALSE_EVENT" => {
            let state = match node.node_type.as_str() {
                "TRUE_EVENT" => true,
                "FALSE_EVENT" => false,
                _ => node.house_event_value.unwrap_or(false),
            };
            let event = HouseEvent::new(uuid.to_string(), state)?;
            ft.add_house_event(event)?;
        }
        // PASS_EVENT, INIT_EVENT, TRANSFER_IN/OUT — treat as always-false house events.
        _ => {
            let event = HouseEvent::new(uuid.to_string(), false)?;
            ft.add_house_event(event)?;
        }
    }
    Ok(())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn is_gate_type(node_type: &str) -> bool {
    matches!(
        node_type,
        "AND_GATE" | "OR_GATE" | "ATLEAST_GATE" | "INHIBIT_GATE"
    )
}

fn is_basic_event_type(node_type: &str) -> bool {
    matches!(
        node_type,
        "BASIC_EVENT" | "INTERMEDIATE_EVENT" | "UNDEVELOPED_EVENT"
    )
}

/// Extract a point-estimate probability from a MEF node.
fn extract_probability(node: &MefFaultTreeNode) -> f64 {
    match node.probability_type.as_deref() {
        Some("constant") | None => node.probability.unwrap_or(0.0),
        Some("distribution") => node
            .probability_distribution
            .as_ref()
            .map(|d| d.point_estimate())
            .unwrap_or(0.0),
        // bayesian_network_link or unknown — fall back to 0.
        _ => 0.0,
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_request(
        algorithm: &str,
        approximation: Option<&str>,
        top_uuid: &str,
        nodes_json: &str,
    ) -> String {
        let approx_field = match approximation {
            Some(a) => format!(r#","approximation":"{a}""#),
            None => String::new(),
        };
        format!(
            r#"{{"graph":{{"faultTreeId":"FT1","topEventId":"{top_uuid}","nodes":{nodes_json}}},
               "algorithm":"{algorithm}"{approx_field}}}"#
        )
    }

    // Helper: two-event OR gate → two first-order cut sets.
    fn or_gate_request(alg: &str, approx: Option<&str>) -> String {
        make_request(
            alg,
            approx,
            "g1",
            r#"{
              "g1":{"uuid":"g1","nodeType":"OR_GATE","name":"G1","inputs":["e1","e2"]},
              "e1":{"uuid":"e1","nodeType":"BASIC_EVENT","name":"E1","probability":0.01,"probabilityType":"constant"},
              "e2":{"uuid":"e2","nodeType":"BASIC_EVENT","name":"E2","probability":0.02,"probabilityType":"constant"}
            }"#,
        )
    }

    fn and_gate_request(alg: &str, approx: Option<&str>) -> String {
        make_request(
            alg,
            approx,
            "g1",
            r#"{
              "g1":{"uuid":"g1","nodeType":"AND_GATE","name":"G1","inputs":["e1","e2"]},
              "e1":{"uuid":"e1","nodeType":"BASIC_EVENT","name":"E1","probability":0.1,"probabilityType":"constant"},
              "e2":{"uuid":"e2","nodeType":"BASIC_EVENT","name":"E2","probability":0.2,"probabilityType":"constant"}
            }"#,
        )
    }

    #[test]
    fn test_bdd_or_gate() {
        let req = or_gate_request("bdd", None);
        let result = quantify_fault_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let p = v["topEventProbability"].as_f64().unwrap();
        // P(E1 ∪ E2) = 1 - (1-0.01)*(1-0.02) = 0.0298
        assert!((p - 0.0298).abs() < 1e-10, "bdd or-gate: got {p}");
        assert_eq!(v["cutSets"].as_array().unwrap().len(), 0);
        assert_eq!(v["algorithm"], "bdd");
    }

    #[test]
    fn test_bdd_and_gate() {
        let req = and_gate_request("bdd", None);
        let result = quantify_fault_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let p = v["topEventProbability"].as_f64().unwrap();
        assert!((p - 0.02).abs() < 1e-10, "bdd and-gate: got {p}");
    }

    #[test]
    fn test_zbdd_or_gate_rare_event() {
        let req = or_gate_request("zbdd", Some("rare_event"));
        let result = quantify_fault_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let cs = v["cutSets"].as_array().unwrap();
        assert_eq!(cs.len(), 2);
        let p = v["topEventProbability"].as_f64().unwrap();
        // Rare-event: 0.01 + 0.02 = 0.03
        assert!((p - 0.03).abs() < 1e-10, "zbdd or-gate rare_event: got {p}");
    }

    #[test]
    fn test_zbdd_and_gate_rare_event() {
        let req = and_gate_request("zbdd", Some("rare_event"));
        let result = quantify_fault_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let cs = v["cutSets"].as_array().unwrap();
        assert_eq!(cs.len(), 1);
        assert_eq!(cs[0]["events"].as_array().unwrap().len(), 2);
        let p = v["topEventProbability"].as_f64().unwrap();
        assert!((p - 0.02).abs() < 1e-10, "zbdd and-gate: got {p}");
    }

    #[test]
    fn test_mocus_or_gate_mcub() {
        let req = or_gate_request("mocus", Some("mcub"));
        let result = quantify_fault_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let cs = v["cutSets"].as_array().unwrap();
        assert_eq!(cs.len(), 2);
        let p = v["topEventProbability"].as_f64().unwrap();
        // MCUB: 1 - (1-0.01)*(1-0.02) = 0.0298
        assert!((p - 0.0298).abs() < 1e-10, "mocus mcub: got {p}");
    }

    #[test]
    fn test_contribution_sums_to_one() {
        let req = or_gate_request("mocus", Some("rare_event"));
        let result = quantify_fault_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let total_contrib: f64 = v["cutSets"]
            .as_array()
            .unwrap()
            .iter()
            .map(|cs| cs["contribution"].as_f64().unwrap())
            .sum();
        assert!((total_contrib - 1.0).abs() < 1e-10, "contributions sum: {total_contrib}");
    }

    #[test]
    fn test_cut_sets_sorted_by_increasing_probability() {
        let req = or_gate_request("mocus", Some("rare_event"));
        let result = quantify_fault_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let cs = v["cutSets"].as_array().unwrap();
        // E1 (0.01) should come before E2 (0.02).
        let p0 = cs[0]["probability"].as_f64().unwrap();
        let p1 = cs[1]["probability"].as_f64().unwrap();
        assert!(p0 <= p1, "cut sets must be in increasing probability order");
    }

    #[test]
    fn test_event_names_in_result() {
        let req = or_gate_request("zbdd", Some("rare_event"));
        let result = quantify_fault_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let all_events: Vec<String> = v["cutSets"]
            .as_array()
            .unwrap()
            .iter()
            .flat_map(|cs| cs["events"].as_array().unwrap().iter())
            .map(|e| e.as_str().unwrap().to_string())
            .collect();
        // Human-readable names (E1, E2) should appear, not uuids (e1, e2).
        assert!(all_events.contains(&"E1".to_string()) || all_events.contains(&"E2".to_string()));
    }

    #[test]
    fn test_distribution_lognormal_point_estimate() {
        let dist = MefDistribution::Lognormal { median: 0.05, error_factor: 3.0 };
        assert!((dist.point_estimate() - 0.05).abs() < 1e-10);
    }

    #[test]
    fn test_distribution_beta_point_estimate() {
        let dist = MefDistribution::Beta { alpha: 1.0, beta_param: 9.0 };
        assert!((dist.point_estimate() - 0.1).abs() < 1e-10);
    }

    #[test]
    fn test_distribution_uniform_point_estimate() {
        let dist = MefDistribution::Uniform { lower: 0.0, upper: 0.1 };
        assert!((dist.point_estimate() - 0.05).abs() < 1e-10);
    }
}
