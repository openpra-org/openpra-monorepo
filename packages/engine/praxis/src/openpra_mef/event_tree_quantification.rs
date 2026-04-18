use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::error::{PraxisError, Result};
use crate::openpra_mef::fault_tree_quantification::{
    ApproximationKind, CutSetResult, MefFaultTreeGraph, MefFaultTreeNode,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EtQuantificationRequest {
    pub graph: MefEventTreeGraph,
    pub algorithm: EtAlgorithmKind,
    #[serde(default)]
    pub approximation: Option<ApproximationKind>,
    #[serde(default)]
    pub max_order: Option<usize>,
    #[serde(default)]
    pub num_samples: Option<usize>,
    #[serde(default)]
    pub fault_trees: HashMap<String, MefFaultTreeGraph>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MefEventTreeGraph {
    pub event_tree_id: String,
    #[serde(default)]
    pub nodes: Vec<MefEtNode>,
    #[serde(default)]
    pub edges: Vec<MefEtEdge>,
    #[serde(default)]
    pub functional_events: Option<HashMap<String, MefFunctionalEvent>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MefEtNode {
    pub id: String,
    #[serde(rename = "type", default)]
    pub node_type: Option<String>,
    #[serde(default)]
    pub data: MefEtNodeData,
    #[serde(default)]
    pub position: MefEtPosition,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MefEtNodeData {
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub depth: Option<i64>,
    #[serde(default)]
    pub fault_tree_id: Option<String>,
    #[serde(default)]
    pub is_sequence_id: Option<bool>,
    #[serde(default)]
    pub output: Option<bool>,
    #[serde(default)]
    pub allow_add: Option<bool>,
    #[serde(default)]
    pub success_probability: Option<f64>,
    #[serde(default)]
    pub frequency: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MefEtPosition {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MefEtEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(default)]
    pub data: MefEtEdgeData,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MefEtEdgeData {
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub order: Option<i64>,
    #[serde(default)]
    pub branch_state: Option<String>,
    #[serde(default)]
    pub fe_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MefFunctionalEvent {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub fault_tree_id: Option<String>,
    #[serde(default)]
    pub success_probability: Option<f64>,
    #[serde(default)]
    pub order: Option<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EtAlgorithmKind {
    Bdd,
    Zbdd,
    Mocus,
    MonteCarlo,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EtQuantificationResult {
    pub algorithm: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approximation: Option<String>,
    pub total_cdf: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_samples: Option<usize>,
    pub sequences: Vec<EtSequenceResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EtSequenceResult {
    pub sequence_id: String,
    pub frequency: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub probability: Option<f64>,
    pub path: Vec<EtPathStep>,
    pub cut_sets: Vec<CutSetResult>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EtPathStep {
    pub functional_event_id: String,
    pub state: String,
}

struct SequenceInfo {
    sequence_id: String,
    path: Vec<(String, String, Option<String>)>,
}


pub fn quantify_event_tree_contract(request_json: &str) -> Result<String> {
    let request: EtQuantificationRequest =
        serde_json::from_str(request_json).map_err(|e| {
            PraxisError::Logic(format!("Failed to parse event tree quantification request: {e}"))
        })?;

    let result = quantify_event_tree(&request)?;

    serde_json::to_string(&result)
        .map_err(|e| PraxisError::Logic(format!("Failed to serialize event tree result: {e}")))
}

fn quantify_event_tree(request: &EtQuantificationRequest) -> Result<EtQuantificationResult> {
    let fe_map = build_functional_event_map(request);
    let sequences = enumerate_sequences(&request.graph)?;

    let ie_frequency = get_ie_frequency(request);

    let algorithm_label = match request.algorithm {
        EtAlgorithmKind::Bdd => "bdd",
        EtAlgorithmKind::Zbdd => "zbdd",
        EtAlgorithmKind::Mocus => "mocus",
        EtAlgorithmKind::MonteCarlo => "monte_carlo",
    };

    let approx = request.approximation.unwrap_or(ApproximationKind::RareEvent);
    let approx_label = match request.algorithm {
        EtAlgorithmKind::Bdd | EtAlgorithmKind::MonteCarlo => None,
        _ => Some(match approx {
            ApproximationKind::RareEvent => "rare_event",
            ApproximationKind::Mcub => "mcub",
        }),
    };

    let num_samples = if request.algorithm == EtAlgorithmKind::MonteCarlo {
        Some(request.num_samples.unwrap_or(10_000))
    } else {
        None
    };

    let mut seq_results: Vec<EtSequenceResult> = Vec::new();

    for seq in &sequences {
        let (seq_prob, cut_sets) = compute_sequence(
            seq,
            &fe_map,
            &request.fault_trees,
            request.algorithm,
            approx,
            request.max_order,
            num_samples,
        )?;

        let path: Vec<EtPathStep> = seq
            .path
            .iter()
            .map(|(fe_id, state, display)| EtPathStep {
                functional_event_id: display.as_deref().unwrap_or(fe_id).to_string(),
                state: state.clone(),
            })
            .collect();

        seq_results.push(EtSequenceResult {
            sequence_id: seq.sequence_id.clone(),
            frequency: ie_frequency * seq_prob,
            probability: Some(seq_prob),
            path,
            cut_sets,
        });
    }

    seq_results.sort_by(|a, b| b.frequency.partial_cmp(&a.frequency).unwrap_or(std::cmp::Ordering::Equal));

    let total_cdf: f64 = seq_results.iter().map(|s| s.frequency).sum();

    Ok(EtQuantificationResult {
        algorithm: algorithm_label.to_string(),
        approximation: approx_label.map(str::to_string),
        total_cdf,
        num_samples,
        sequences: seq_results,
    })
}

fn get_ie_frequency(request: &EtQuantificationRequest) -> f64 {
    let ie_node = request
        .graph
        .nodes
        .iter()
        .find(|n| n.data.depth == Some(1) && n.node_type.as_deref() == Some("columnNode"));

    if let Some(node) = ie_node {
        if let Some(freq) = node.data.frequency {
            if freq > 0.0 {
                return freq;
            }
        }
        if let Some(ft_id) = &node.data.fault_tree_id {
            if let Some(ft_graph) = request.fault_trees.get(ft_id) {
                if let Ok(prob) = quantify_ft_top_event_bdd(ft_graph) {
                    return prob;
                }
            }
        }
    }
    1.0
}

struct FeInfo {
    fault_tree_id: Option<String>,
    success_probability: Option<f64>,
}

fn build_functional_event_map(request: &EtQuantificationRequest) -> HashMap<String, FeInfo> {
    let mut map: HashMap<String, FeInfo> = HashMap::new();

    if let Some(fe_map) = &request.graph.functional_events {
        for (id, fe) in fe_map {
            map.insert(
                id.clone(),
                FeInfo {
                    fault_tree_id: fe.fault_tree_id.clone(),
                    success_probability: fe.success_probability,
                },
            );
        }
    }

    for node in &request.graph.nodes {
        if node.node_type.as_deref() == Some("columnNode")
            && node.data.depth.map(|d| d > 1).unwrap_or(false)
        {
            map.entry(node.id.clone()).or_insert_with(|| FeInfo {
                fault_tree_id: node.data.fault_tree_id.clone(),
                success_probability: node.data.success_probability,
            });
        }
    }

    map
}


fn enumerate_sequences(graph: &MefEventTreeGraph) -> Result<Vec<SequenceInfo>> {
    let branch_node_ids: std::collections::HashSet<String> = graph
        .nodes
        .iter()
        .filter(|n| {
            matches!(
                n.node_type.as_deref(),
                Some("visibleNode") | Some("outputNode")
            )
        })
        .map(|n| n.id.clone())
        .collect();

    let output_ids: std::collections::HashSet<String> = graph
        .nodes
        .iter()
        .filter(|n| n.node_type.as_deref() == Some("outputNode"))
        .map(|n| n.id.clone())
        .collect();

    let mut children: HashMap<String, Vec<(String, String, Option<String>)>> = HashMap::new();
    for edge in &graph.edges {
        if branch_node_ids.contains(&edge.source) && branch_node_ids.contains(&edge.target) {
            let state = edge_state(edge);
            let fe_id = edge.data.fe_id.clone();
            children
                .entry(edge.source.clone())
                .or_default()
                .push((edge.target.clone(), state, fe_id));
        }
    }

    let root_id = graph
        .nodes
        .iter()
        .filter(|n| n.node_type.as_deref() == Some("visibleNode") && n.data.depth == Some(1))
        .min_by(|a, b| a.position.x.partial_cmp(&b.position.x).unwrap_or(std::cmp::Ordering::Equal))
        .map(|n| n.id.clone())
        .or_else(|| {
            graph
                .nodes
                .iter()
                .filter(|n| n.node_type.as_deref() == Some("visibleNode"))
                .min_by(|a, b| a.position.x.partial_cmp(&b.position.x).unwrap_or(std::cmp::Ordering::Equal))
                .map(|n| n.id.clone())
        })
        .ok_or_else(|| PraxisError::Logic("Event tree has no visibleNode root".to_string()))?;

    let depth_to_col_id: HashMap<i64, String> = graph
        .nodes
        .iter()
        .filter(|n| {
            n.node_type.as_deref() == Some("columnNode")
                && n.data.depth.map(|d| d > 1).unwrap_or(false)
                && n.data.allow_add == Some(true)
        })
        .filter_map(|n| n.data.depth.map(|d| (d, n.id.clone())))
        .collect();

    let node_depth: HashMap<String, i64> = graph
        .nodes
        .iter()
        .filter_map(|n| n.data.depth.map(|d| (n.id.clone(), d)))
        .collect();

    let ie_initials = {
        let ie_label = graph
            .nodes
            .iter()
            .find(|n| {
                n.node_type.as_deref() == Some("columnNode")
                    && n.data.depth == Some(1)
                    && n.data.output != Some(true)
            })
            .map(|n| n.data.label.as_str())
            .unwrap_or("IE");
        ie_label
            .split_whitespace()
            .filter_map(|w| w.chars().next())
            .map(|c| c.to_uppercase().to_string())
            .collect::<String>()
    };

    let seq_id_map: HashMap<String, String> = {
        let mut nodes: Vec<_> = graph
            .nodes
            .iter()
            .filter(|n| {
                n.node_type.as_deref() == Some("outputNode") && n.data.is_sequence_id == Some(true)
            })
            .collect();
        nodes.sort_by(|a, b| a.position.y.partial_cmp(&b.position.y).unwrap_or(std::cmp::Ordering::Equal));
        nodes
            .iter()
            .enumerate()
            .map(|(idx, n)| (n.id.clone(), format!("{}-{}", ie_initials, idx + 1)))
            .collect()
    };

    let mut sequences: Vec<SequenceInfo> = Vec::new();

    let mut path_stack: Vec<(String, Vec<(String, String, Option<String>)>)> = Vec::new();
    path_stack.push((root_id.clone(), vec![]));

    while let Some((current_id, current_path)) = path_stack.pop() {
        if output_ids.contains(&current_id) {
            let stored_label = graph
                .nodes
                .iter()
                .find(|n| n.id == current_id)
                .map(|n| n.data.label.clone())
                .unwrap_or_default();

            let seq_label = if !stored_label.is_empty() && stored_label != current_id {
                stored_label
            } else if let Some(computed) = seq_id_map.get(&current_id) {
                computed.clone()
            } else if current_path.is_empty() {
                "SEQ".to_string()
            } else {
                current_path
                    .iter()
                    .filter(|(_, state, _)| state != "bypass")
                    .map(|(_, state, _)| if state == "success" { "S" } else { "F" })
                    .collect::<Vec<_>>()
                    .join("-")
            };

            sequences.push(SequenceInfo {
                sequence_id: seq_label,
                path: current_path,
            });
            continue;
        }

        let nexts = children.get(&current_id).cloned().unwrap_or_default();
        if nexts.is_empty() {
            if current_id != root_id {
                let seq_label = current_id.clone();
                sequences.push(SequenceInfo {
                    sequence_id: seq_label,
                    path: current_path,
                });
            }
        } else {
            let current_depth = node_depth.get(&current_id).copied().unwrap_or(1);
            for (next_id, state, edge_fe_id) in nexts {
                let mut new_path = current_path.clone();
                let next_depth = node_depth.get(&next_id).copied().unwrap_or(current_depth + 1);
                if next_depth > 1 && !output_ids.contains(&next_id) {
                    let fe_id = edge_fe_id.unwrap_or_else(|| {
                        depth_to_col_id
                            .get(&next_depth)
                            .cloned()
                            .unwrap_or_else(|| next_id.clone())
                    });
                    let fe_label = graph
                        .nodes
                        .iter()
                        .find(|n| n.id == fe_id && n.node_type.as_deref() == Some("columnNode"))
                        .map(|n| n.data.label.clone())
                        .filter(|l| !l.is_empty());
                    new_path.push((fe_id, state, fe_label));
                }
                let _ = current_depth;
                path_stack.push((next_id, new_path));
            }
        }
    }

    if sequences.is_empty() {
        sequences.push(SequenceInfo {
            sequence_id: graph.event_tree_id.clone(),
            path: vec![],
        });
    }

    Ok(sequences)
}

fn edge_state(edge: &MefEtEdge) -> String {
    if let Some(state) = &edge.data.branch_state {
        return state.clone();
    }
    if let Some(label) = &edge.data.label {
        let lower = label.to_lowercase();
        if lower == "yes" || lower == "success" || lower == "s" {
            return "success".to_string();
        }
        if lower == "no" || lower == "failure" || lower == "f" {
            return "failure".to_string();
        }
        return lower;
    }
    if let Some(order) = edge.data.order {
        if order == 1 {
            return "success".to_string();
        }
        if order == 2 {
            return "failure".to_string();
        }
    }
    "success".to_string()
}

fn compute_sequence(
    seq: &SequenceInfo,
    fe_map: &HashMap<String, FeInfo>,
    fault_trees: &HashMap<String, MefFaultTreeGraph>,
    algorithm: EtAlgorithmKind,
    approx: ApproximationKind,
    max_order: Option<usize>,
    num_samples: Option<usize>,
) -> Result<(f64, Vec<CutSetResult>)> {
    if seq.path.is_empty() {
        return Ok((1.0, vec![]));
    }

    match algorithm {
        EtAlgorithmKind::MonteCarlo => {
            let n = num_samples.unwrap_or(10_000);
            let prob = monte_carlo_sequence_probability(seq, fe_map, fault_trees, n);
            Ok((prob, vec![]))
        }
        _ => {
            deterministic_sequence(seq, fe_map, fault_trees, algorithm, approx, max_order)
        }
    }
}

fn deterministic_sequence(
    seq: &SequenceInfo,
    fe_map: &HashMap<String, FeInfo>,
    fault_trees: &HashMap<String, MefFaultTreeGraph>,
    algorithm: EtAlgorithmKind,
    approx: ApproximationKind,
    max_order: Option<usize>,
) -> Result<(f64, Vec<CutSetResult>)> {
    if seq.path.is_empty() {
        return Ok((1.0, vec![]));
    }

    let mut ft_states: Vec<(&MefFaultTreeGraph, bool)> = Vec::new();
    let mut direct_prob = 1.0_f64;

    for (fe_id, state, _) in &seq.path {
        if state == "bypass" {
            continue;
        }
        let is_failure = state != "success";
        let fe_info = fe_map.get(fe_id);

        let ft = fe_info
            .and_then(|f| f.fault_tree_id.as_ref())
            .and_then(|id| fault_trees.get(id));

        if let Some(ft) = ft {
            ft_states.push((ft, is_failure));
        } else {
            let p = fe_info
                .and_then(|f| f.success_probability)
                .map(|p| 1.0 - p)
                .unwrap_or(0.5);
            direct_prob *= if is_failure { p } else { 1.0 - p };
        }
    }

    if ft_states.is_empty() {
        return Ok((direct_prob, vec![]));
    }

    let compound = build_pdag_compound_ft(&ft_states)?;
    let pdag_prob = quantify_ft_top_event_bdd(&compound).unwrap_or(0.0);

    let failure_only: Vec<(&MefFaultTreeGraph, bool)> = ft_states
        .iter()
        .filter(|(_, is_failure)| *is_failure)
        .cloned()
        .collect();

    let cut_sets = if failure_only.is_empty() {
        vec![]
    } else if failure_only.len() == ft_states.len() {
        quantify_ft_cut_sets(&compound, algorithm, approx, max_order).unwrap_or_default()
    } else {
        let failure_compound = build_pdag_compound_ft(&failure_only)?;
        quantify_ft_cut_sets(&failure_compound, algorithm, approx, max_order).unwrap_or_default()
    };

    Ok((pdag_prob * direct_prob, cut_sets))
}

fn monte_carlo_sequence_probability(
    seq: &SequenceInfo,
    fe_map: &HashMap<String, FeInfo>,
    fault_trees: &HashMap<String, MefFaultTreeGraph>,
    num_samples: usize,
) -> f64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let seed_base: u64 = {
        let mut h = DefaultHasher::new();
        seq.sequence_id.hash(&mut h);
        h.finish()
    };

    let mut success_count = 0u64;
    for i in 0..num_samples {
        let mut sample_prob = 1.0_f64;
        let mut success = true;

        for (j, (fe_id, state, _)) in seq.path.iter().enumerate() {
            let fe_info = fe_map.get(fe_id);
            let ft_id = fe_info.and_then(|f| f.fault_tree_id.as_ref());

            let fe_failure_prob = if let Some(id) = ft_id {
                if let Some(ft) = fault_trees.get(id) {
                    quantify_ft_top_event_bdd(ft).unwrap_or(0.0)
                } else {
                    fe_info.and_then(|f| f.success_probability).map(|p| 1.0 - p).unwrap_or(0.5)
                }
            } else {
                fe_info.and_then(|f| f.success_probability).map(|p| 1.0 - p).unwrap_or(0.5)
            };

            let mut h = DefaultHasher::new();
            (seed_base ^ (i as u64).wrapping_mul(6364136223846793005).wrapping_add(j as u64)).hash(&mut h);
            let rand_val = (h.finish() as f64) / (u64::MAX as f64);

            let branch_prob = if state == "bypass" {
                1.0
            } else if state == "success" {
                1.0 - fe_failure_prob
            } else {
                fe_failure_prob
            };
            sample_prob *= branch_prob;
            let _ = (rand_val, sample_prob);

            if (state == "failure") == (rand_val >= fe_failure_prob) {
                success = false;
                break;
            }
        }
        if success {
            success_count += 1;
        }
    }

    success_count as f64 / num_samples as f64
}

fn quantify_ft_top_event_bdd(ft: &MefFaultTreeGraph) -> Result<f64> {
    let request_json = serde_json::to_string(&serde_json::json!({
        "graph": {
            "faultTreeId": ft.fault_tree_id,
            "topEventId": ft.top_event_id,
            "nodes": ft.nodes,
        },
        "algorithm": "bdd",
    }))
    .map_err(|e| PraxisError::Logic(format!("Failed to serialize FT request: {e}")))?;

    let result_json = crate::openpra_mef::fault_tree_quantification::quantify_fault_tree_contract(&request_json)?;
    let v: serde_json::Value = serde_json::from_str(&result_json)
        .map_err(|e| PraxisError::Logic(format!("Failed to parse FT result: {e}")))?;
    v["topEventProbability"]
        .as_f64()
        .ok_or_else(|| PraxisError::Logic("Missing topEventProbability in FT result".to_string()))
}

fn quantify_ft_cut_sets(
    ft: &MefFaultTreeGraph,
    algorithm: EtAlgorithmKind,
    approx: ApproximationKind,
    max_order: Option<usize>,
) -> Result<Vec<CutSetResult>> {
    let alg_str = match algorithm {
        EtAlgorithmKind::Bdd => "bdd",
        EtAlgorithmKind::Zbdd => "zbdd",
        EtAlgorithmKind::Mocus => "mocus",
        EtAlgorithmKind::MonteCarlo => "bdd",
    };
    let approx_str = match approx {
        ApproximationKind::RareEvent => "rare_event",
        ApproximationKind::Mcub => "mcub",
    };

    let mut req_value = serde_json::json!({
        "graph": {
            "faultTreeId": ft.fault_tree_id,
            "topEventId": ft.top_event_id,
            "nodes": ft.nodes,
        },
        "algorithm": alg_str,
        "approximation": approx_str,
    });

    if let Some(k) = max_order {
        req_value["maxOrder"] = serde_json::json!(k);
    }

    let request_json = serde_json::to_string(&req_value)
        .map_err(|e| PraxisError::Logic(format!("Failed to serialize FT cut-set request: {e}")))?;

    let result_json = crate::openpra_mef::fault_tree_quantification::quantify_fault_tree_contract(&request_json)?;
    let v: serde_json::Value = serde_json::from_str(&result_json)
        .map_err(|e| PraxisError::Logic(format!("Failed to parse FT cut-set result: {e}")))?;

    let cut_sets: Vec<CutSetResult> = v["cutSets"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|cs| {
            let events: Vec<String> = cs["events"]
                .as_array()?
                .iter()
                .filter_map(|e| e.as_str().map(str::to_string))
                .collect();
            let probability = cs["probability"].as_f64()?;
            let contribution = cs["contribution"].as_f64()?;
            Some(CutSetResult { events, probability, contribution })
        })
        .collect();

    Ok(cut_sets)
}

fn build_pdag_compound_ft(ft_states: &[(&MefFaultTreeGraph, bool)]) -> Result<MefFaultTreeGraph> {
    let compound_id = "ET_COMPOUND".to_string();
    let top_gate_id = "ET_TOP_AND".to_string();

    let mut nodes: HashMap<String, MefFaultTreeNode> = HashMap::new();
    let mut top_inputs: Vec<String> = Vec::new();

    for (ft, is_failure) in ft_states {
        for (uuid, node) in &ft.nodes {
            nodes.entry(uuid.clone()).or_insert_with(|| node.clone());
        }

        if *is_failure {
            let proxy_id = format!("proxy_{}", ft.fault_tree_id);
            nodes.insert(
                proxy_id.clone(),
                MefFaultTreeNode {
                    uuid: proxy_id.clone(),
                    node_type: "OR_GATE".to_string(),
                    name: proxy_id.clone(),
                    inputs: vec![ft.top_event_id.clone()],
                    probability: None,
                    probability_type: None,
                    probability_distribution: None,
                    k_value: None,
                    house_event_value: None,
                    transfer_tree_id: None,
                },
            );
            top_inputs.push(proxy_id);
        } else {
            let not_id = format!("not_{}", ft.fault_tree_id);
            nodes.insert(
                not_id.clone(),
                MefFaultTreeNode {
                    uuid: not_id.clone(),
                    node_type: "NOT_GATE".to_string(),
                    name: not_id.clone(),
                    inputs: vec![ft.top_event_id.clone()],
                    probability: None,
                    probability_type: None,
                    probability_distribution: None,
                    k_value: None,
                    house_event_value: None,
                    transfer_tree_id: None,
                },
            );
            top_inputs.push(not_id);
        }
    }

    if top_inputs.len() == 1 {
        return Ok(MefFaultTreeGraph {
            fault_tree_id: compound_id,
            top_event_id: top_inputs.remove(0),
            nodes,
        });
    }

    nodes.insert(
        top_gate_id.clone(),
        MefFaultTreeNode {
            uuid: top_gate_id.clone(),
            node_type: "AND_GATE".to_string(),
            name: "ET_TOP".to_string(),
            inputs: top_inputs,
            probability: None,
            probability_type: None,
            probability_distribution: None,
            k_value: None,
            house_event_value: None,
            transfer_tree_id: None,
        },
    );

    Ok(MefFaultTreeGraph {
        fault_tree_id: compound_id,
        top_event_id: top_gate_id,
        nodes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn simple_ft_json(ft_id: &str, top_id: &str, prob: f64) -> serde_json::Value {
        serde_json::json!({
            "faultTreeId": ft_id,
            "topEventId": top_id,
            "nodes": {
                top_id: {
                    "uuid": top_id,
                    "nodeType": "BASIC_EVENT",
                    "name": top_id,
                    "probability": prob,
                    "probabilityType": "constant"
                }
            }
        })
    }

    fn two_branch_request(algorithm: &str) -> String {
        serde_json::json!({
            "graph": {
                "eventTreeId": "ET1",
                "nodes": [
                    {"id": "ie_col", "type": "columnNode", "data": {"label": "IE", "depth": 1, "allowAdd": false}, "position": {"x": 0, "y": 0}},
                    {"id": "fe1_col", "type": "columnNode", "data": {"label": "FE1", "depth": 2, "allowAdd": true, "faultTreeId": "FT1"}, "position": {"x": 100, "y": 0}},
                    {"id": "ie_vis", "type": "visibleNode", "data": {"label": "IE", "depth": 1}, "position": {"x": 0, "y": 0}},
                    {"id": "branch_ok", "type": "visibleNode", "data": {"label": "Success", "depth": 2}, "position": {"x": 100, "y": -50}},
                    {"id": "branch_fail", "type": "visibleNode", "data": {"label": "Failure", "depth": 2}, "position": {"x": 100, "y": 50}},
                    {"id": "seq_ok", "type": "outputNode", "data": {"label": "OK", "isSequenceId": true}, "position": {"x": 200, "y": -50}},
                    {"id": "seq_fail", "type": "outputNode", "data": {"label": "CD", "isSequenceId": true}, "position": {"x": 200, "y": 50}}
                ],
                "edges": [
                    {"id": "e_col1", "source": "ie_col", "target": "fe1_col", "data": {"hidden": true}},
                    {"id": "e1", "source": "ie_vis", "target": "branch_ok", "data": {"order": 1}},
                    {"id": "e2", "source": "ie_vis", "target": "branch_fail", "data": {"order": 2}},
                    {"id": "e3", "source": "branch_ok", "target": "seq_ok", "data": {"order": 1}},
                    {"id": "e4", "source": "branch_fail", "target": "seq_fail", "data": {"order": 1}}
                ]
            },
            "algorithm": algorithm,
            "approximation": "rare_event",
            "faultTrees": {
                "FT1": simple_ft_json("FT1", "be1", 0.1)
            }
        })
        .to_string()
    }

    #[test]
    fn test_simple_two_branch_bdd() {
        let req = two_branch_request("bdd");
        let result = quantify_event_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let seqs = v["sequences"].as_array().unwrap();
        assert_eq!(seqs.len(), 2, "expected 2 sequences, got {}", seqs.len());
        let total: f64 = seqs.iter().map(|s| s["frequency"].as_f64().unwrap()).sum();
        assert!((total - 1.0).abs() < 0.01, "frequencies should sum to ~1.0, got {total}");
    }

    #[test]
    fn test_simple_two_branch_zbdd() {
        let req = two_branch_request("zbdd");
        let result = quantify_event_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let seqs = v["sequences"].as_array().unwrap();
        let failure_seq = seqs.iter().find(|s| s["sequenceId"] == "CD");
        assert!(failure_seq.is_some(), "should have failure sequence CD");
        let cut_sets = failure_seq.unwrap()["cutSets"].as_array().unwrap();
        assert!(!cut_sets.is_empty(), "failure sequence should have cut sets");
    }

    #[test]
    fn test_simple_two_branch_mocus() {
        let req = two_branch_request("mocus");
        let result = quantify_event_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let seqs = v["sequences"].as_array().unwrap();
        assert_eq!(seqs.len(), 2);
        let failure_seq = seqs.iter().find(|s| s["sequenceId"] == "CD").unwrap();
        let cut_sets = failure_seq["cutSets"].as_array().unwrap();
        assert!(!cut_sets.is_empty(), "mocus failure sequence should have cut sets");
    }

    #[test]
    fn test_simple_two_branch_monte_carlo() {
        let req = serde_json::json!({
            "graph": {
                "eventTreeId": "ET_MC",
                "nodes": [
                    {"id": "ie_col", "type": "columnNode", "data": {"label": "IE", "depth": 1, "allowAdd": false}, "position": {"x": 0, "y": 0}},
                    {"id": "fe1_col", "type": "columnNode", "data": {"label": "FE1", "depth": 2, "allowAdd": true, "faultTreeId": "FT1"}, "position": {"x": 100, "y": 0}},
                    {"id": "ie_vis", "type": "visibleNode", "data": {"label": "IE", "depth": 1}, "position": {"x": 0, "y": 0}},
                    {"id": "branch_ok", "type": "visibleNode", "data": {"label": "Success", "depth": 2}, "position": {"x": 100, "y": -50}},
                    {"id": "branch_fail", "type": "visibleNode", "data": {"label": "Failure", "depth": 2}, "position": {"x": 100, "y": 50}},
                    {"id": "seq_ok", "type": "outputNode", "data": {"label": "OK", "isSequenceId": true}, "position": {"x": 200, "y": -50}},
                    {"id": "seq_fail", "type": "outputNode", "data": {"label": "CD", "isSequenceId": true}, "position": {"x": 200, "y": 50}}
                ],
                "edges": [
                    {"id": "e1", "source": "ie_vis", "target": "branch_ok", "data": {"order": 1}},
                    {"id": "e2", "source": "ie_vis", "target": "branch_fail", "data": {"order": 2}},
                    {"id": "e3", "source": "branch_ok", "target": "seq_ok", "data": {"order": 1}},
                    {"id": "e4", "source": "branch_fail", "target": "seq_fail", "data": {"order": 1}}
                ]
            },
            "algorithm": "monte_carlo",
            "numSamples": 10000,
            "faultTrees": {
                "FT1": simple_ft_json("FT1", "be1", 0.1)
            }
        })
        .to_string();
        let result = quantify_event_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["algorithm"], "monte_carlo");
        assert_eq!(v["numSamples"], 10000);
        let seqs = v["sequences"].as_array().unwrap();
        assert_eq!(seqs.len(), 2);
    }

    #[test]
    fn test_no_fault_tree_uses_direct_probability() {
        let req = serde_json::json!({
            "graph": {
                "eventTreeId": "ET2",
                "nodes": [
                    {"id": "ie_col", "type": "columnNode", "data": {"label": "IE", "depth": 1, "allowAdd": false}, "position": {"x": 0, "y": 0}},
                    {"id": "fe1_col", "type": "columnNode", "data": {"label": "FE1", "depth": 2, "allowAdd": true, "successProbability": 0.9}, "position": {"x": 100, "y": 0}},
                    {"id": "ie_vis", "type": "visibleNode", "data": {"label": "IE", "depth": 1}, "position": {"x": 0, "y": 0}},
                    {"id": "branch_ok", "type": "visibleNode", "data": {"label": "Success", "depth": 2}, "position": {"x": 100, "y": -50}},
                    {"id": "branch_fail", "type": "visibleNode", "data": {"label": "Failure", "depth": 2}, "position": {"x": 100, "y": 50}},
                    {"id": "seq_ok", "type": "outputNode", "data": {"label": "OK", "isSequenceId": true}, "position": {"x": 200, "y": -50}},
                    {"id": "seq_fail", "type": "outputNode", "data": {"label": "CD", "isSequenceId": true}, "position": {"x": 200, "y": 50}}
                ],
                "edges": [
                    {"id": "e1", "source": "ie_vis", "target": "branch_ok", "data": {"order": 1}},
                    {"id": "e2", "source": "ie_vis", "target": "branch_fail", "data": {"order": 2}},
                    {"id": "e3", "source": "branch_ok", "target": "seq_ok", "data": {"order": 1}},
                    {"id": "e4", "source": "branch_fail", "target": "seq_fail", "data": {"order": 1}}
                ]
            },
            "algorithm": "bdd",
            "faultTrees": {}
        })
        .to_string();
        let result = quantify_event_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let seqs = v["sequences"].as_array().unwrap();
        let ok_seq = seqs.iter().find(|s| s["sequenceId"] == "OK").unwrap();
        let fail_seq = seqs.iter().find(|s| s["sequenceId"] == "CD").unwrap();
        let ok_prob = ok_seq["probability"].as_f64().unwrap();
        let fail_prob = fail_seq["probability"].as_f64().unwrap();
        assert!((ok_prob - 0.9).abs() < 1e-6, "ok prob should be 0.9, got {ok_prob}");
        assert!((fail_prob - 0.1).abs() < 1e-6, "fail prob should be 0.1, got {fail_prob}");
    }

    #[test]
    fn test_multiple_failure_fes_cut_sets() {
        let req = serde_json::json!({
            "graph": {
                "eventTreeId": "ET3",
                "nodes": [
                    {"id": "ie_col", "type": "columnNode", "data": {"label": "IE", "depth": 1, "allowAdd": false}, "position": {"x": 0, "y": 0}},
                    {"id": "fe1_col", "type": "columnNode", "data": {"label": "FE1", "depth": 2, "allowAdd": true, "faultTreeId": "FT1"}, "position": {"x": 100, "y": 0}},
                    {"id": "fe2_col", "type": "columnNode", "data": {"label": "FE2", "depth": 3, "allowAdd": true, "faultTreeId": "FT2"}, "position": {"x": 200, "y": 0}},
                    {"id": "ie_vis", "type": "visibleNode", "data": {"label": "IE", "depth": 1}, "position": {"x": 0, "y": 0}},
                    {"id": "fe1_ok", "type": "visibleNode", "data": {"label": "Success", "depth": 2}, "position": {"x": 100, "y": -50}},
                    {"id": "fe1_fail", "type": "visibleNode", "data": {"label": "Failure", "depth": 2}, "position": {"x": 100, "y": 50}},
                    {"id": "fe2_ok", "type": "visibleNode", "data": {"label": "Success", "depth": 3}, "position": {"x": 200, "y": -75}},
                    {"id": "fe2_fail", "type": "visibleNode", "data": {"label": "Failure", "depth": 3}, "position": {"x": 200, "y": -25}},
                    {"id": "seq_ok", "type": "outputNode", "data": {"label": "OK", "isSequenceId": true}, "position": {"x": 300, "y": -75}},
                    {"id": "seq_fe2_fail", "type": "outputNode", "data": {"label": "SEQ2", "isSequenceId": true}, "position": {"x": 300, "y": -25}},
                    {"id": "seq_fe1_fail", "type": "outputNode", "data": {"label": "CORE_DMG", "isSequenceId": true}, "position": {"x": 300, "y": 50}}
                ],
                "edges": [
                    {"id": "e1", "source": "ie_vis", "target": "fe1_ok", "data": {"order": 1}},
                    {"id": "e2", "source": "ie_vis", "target": "fe1_fail", "data": {"order": 2}},
                    {"id": "e3", "source": "fe1_ok", "target": "fe2_ok", "data": {"order": 1}},
                    {"id": "e4", "source": "fe1_ok", "target": "fe2_fail", "data": {"order": 2}},
                    {"id": "e5", "source": "fe2_ok", "target": "seq_ok", "data": {"order": 1}},
                    {"id": "e6", "source": "fe2_fail", "target": "seq_fe2_fail", "data": {"order": 1}},
                    {"id": "e7", "source": "fe1_fail", "target": "seq_fe1_fail", "data": {"order": 1}}
                ]
            },
            "algorithm": "zbdd",
            "approximation": "rare_event",
            "faultTrees": {
                "FT1": simple_ft_json("FT1", "be1", 0.1),
                "FT2": simple_ft_json("FT2", "be2", 0.2)
            }
        })
        .to_string();
        let result = quantify_event_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let seqs = v["sequences"].as_array().unwrap();
        assert!(!seqs.is_empty());
        let total_cdf = v["totalCdf"].as_f64().unwrap();
        assert!(total_cdf > 0.0, "total CDF should be positive");
    }

    #[test]
    fn test_pdag_shared_basic_event_probability() {
        let shared_be = serde_json::json!({
            "uuid": "be_shared",
            "nodeType": "BASIC_EVENT",
            "name": "be_shared",
            "probability": 0.2,
            "probabilityType": "constant"
        });
        let req = serde_json::json!({
            "graph": {
                "eventTreeId": "ET_PDAG",
                "nodes": [
                    {"id": "ie_col", "type": "columnNode", "data": {"label": "IE", "depth": 1, "allowAdd": false}, "position": {"x": 0, "y": 0}},
                    {"id": "fe1_col", "type": "columnNode", "data": {"label": "FE1", "depth": 2, "allowAdd": true, "faultTreeId": "FT_A"}, "position": {"x": 100, "y": 0}},
                    {"id": "fe2_col", "type": "columnNode", "data": {"label": "FE2", "depth": 3, "allowAdd": true, "faultTreeId": "FT_B"}, "position": {"x": 200, "y": 0}},
                    {"id": "ie_vis", "type": "visibleNode", "data": {"label": "IE", "depth": 1}, "position": {"x": 0, "y": 0}},
                    {"id": "fe1_ok", "type": "visibleNode", "data": {"label": "S1", "depth": 2}, "position": {"x": 100, "y": -50}},
                    {"id": "fe1_fail", "type": "visibleNode", "data": {"label": "F1", "depth": 2}, "position": {"x": 100, "y": 50}},
                    {"id": "fe2_ok", "type": "visibleNode", "data": {"label": "S2", "depth": 3}, "position": {"x": 200, "y": -75}},
                    {"id": "fe2_fail", "type": "visibleNode", "data": {"label": "F2", "depth": 3}, "position": {"x": 200, "y": -25}},
                    {"id": "seq_ss", "type": "outputNode", "data": {"label": "SS", "isSequenceId": true}, "position": {"x": 300, "y": -75}},
                    {"id": "seq_sf", "type": "outputNode", "data": {"label": "SF", "isSequenceId": true}, "position": {"x": 300, "y": -25}},
                    {"id": "seq_f",  "type": "outputNode", "data": {"label": "F",  "isSequenceId": true}, "position": {"x": 300, "y": 50}}
                ],
                "edges": [
                    {"id": "e1", "source": "ie_vis",  "target": "fe1_ok",   "data": {"branchState": "success", "feId": "fe1_col"}},
                    {"id": "e2", "source": "ie_vis",  "target": "fe1_fail", "data": {"branchState": "failure", "feId": "fe1_col"}},
                    {"id": "e3", "source": "fe1_ok",  "target": "fe2_ok",   "data": {"branchState": "success", "feId": "fe2_col"}},
                    {"id": "e4", "source": "fe1_ok",  "target": "fe2_fail", "data": {"branchState": "failure", "feId": "fe2_col"}},
                    {"id": "e5", "source": "fe2_ok",  "target": "seq_ss",   "data": {}},
                    {"id": "e6", "source": "fe2_fail","target": "seq_sf",   "data": {}},
                    {"id": "e7", "source": "fe1_fail","target": "seq_f",    "data": {}}
                ]
            },
            "algorithm": "bdd",
            "faultTrees": {
                "FT_A": {
                    "faultTreeId": "FT_A",
                    "topEventId": "be_shared",
                    "nodes": {"be_shared": shared_be}
                },
                "FT_B": {
                    "faultTreeId": "FT_B",
                    "topEventId": "be_shared",
                    "nodes": {"be_shared": shared_be}
                }
            }
        })
        .to_string();

        let result = quantify_event_tree_contract(&req).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let seqs = v["sequences"].as_array().unwrap();

        let ss = seqs.iter().find(|s| s["sequenceId"] == "SS").unwrap();
        let sf = seqs.iter().find(|s| s["sequenceId"] == "SF").unwrap();
        let f  = seqs.iter().find(|s| s["sequenceId"] == "F").unwrap();

        let p_ss = ss["probability"].as_f64().unwrap();
        let p_sf = sf["probability"].as_f64().unwrap();
        let p_f  = f["probability"].as_f64().unwrap();

        // FT_A and FT_B share be_shared (p=0.2)
        // SS: NOT(FT_A) AND NOT(FT_B) = NOT(be_shared) AND NOT(be_shared) = NOT(be_shared) = 0.8
        assert!((p_ss - 0.8).abs() < 1e-6, "SS: expected 0.8, got {p_ss}");
        // SF: NOT(FT_A) AND FT_B = NOT(be_shared) AND be_shared = 0 (same variable)
        assert!((p_sf - 0.0).abs() < 1e-6, "SF: expected 0.0 (shared var), got {p_sf}");
        // F: FT_A = be_shared = 0.2
        assert!((p_f - 0.2).abs() < 1e-6, "F: expected 0.2, got {p_f}");

        let total: f64 = p_ss + p_sf + p_f;
        assert!((total - 1.0).abs() < 1e-6, "probabilities should sum to 1.0, got {total}");
    }
}
