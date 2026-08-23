use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

use praxis::algorithms::noncoherent_mocus::NonCoherentMocus;
use praxis::algorithms::pdag::Pdag;
use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::core::event::{BasicEvent, HouseEvent};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::{PraxisError, Result};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::transport::SolverRequest;

const FAULT_TREE_METHOD: &str = "FAULT_TREE";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FaultTreeExecuteRequest {
    schema_version: String,
    method_type: String,
    model_id: String,
    revision: u64,
    requested_by: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FaultTreeSnapshot {
    id: String,
    project_id: String,
    method_type: String,
    revision: u64,
    top_gate: Option<FaultTreeTopGate>,
    gates: Vec<FaultTreeGate>,
    leaf_nodes: Vec<FaultTreeLeaf>,
    gate_inputs: Vec<FaultTreeGateInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FaultTreeTopGate {
    gate_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "gateType")]
enum FaultTreeGate {
    #[serde(rename = "AND")]
    And { id: String },
    #[serde(rename = "OR")]
    Or { id: String },
    #[serde(rename = "NOT")]
    Not { id: String },
    #[serde(rename = "K_OF_N")]
    KOfN { id: String, k: usize },
}

impl FaultTreeGate {
    fn id(&self) -> &str {
        match self {
            Self::And { id } | Self::Or { id } | Self::Not { id } | Self::KOfN { id, .. } => id,
        }
    }

    fn formula(&self) -> Formula {
        match self {
            Self::And { .. } => Formula::And,
            Self::Or { .. } => Formula::Or,
            Self::Not { .. } => Formula::Not,
            Self::KOfN { k, .. } => Formula::AtLeast { min: *k },
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind")]
enum FaultTreeLeaf {
    #[serde(rename = "BASIC_EVENT_REFERENCE")]
    BasicEventReference {
        id: String,
        #[serde(rename = "basicEventId")]
        basic_event_id: String,
    },
    #[serde(rename = "HOUSE_EVENT")]
    HouseEvent { id: String, state: bool },
    #[serde(rename = "UNDEVELOPED_EVENT")]
    UndevelopedEvent { id: String },
    #[serde(rename = "TRANSFER_REFERENCE")]
    TransferReference { id: String },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FaultTreeGateInput {
    id: String,
    gate_id: String,
    child_id: String,
    order: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BasicEventCatalogue {
    project_id: String,
    basic_events: Vec<CatalogueBasicEvent>,
}

#[derive(Debug, Deserialize)]
struct CatalogueBasicEvent {
    id: String,
    probability: CatalogueProbability,
}

#[derive(Debug, Deserialize)]
struct CatalogueProbability {
    value: f64,
}

pub(crate) struct FaultTreeAdapter {
    pub(crate) fault_tree: FaultTree,
    pub(crate) model_id: String,
    pub(crate) model_revision: u64,
    pub(crate) top_gate_id: String,
}

fn serialization_error(context: &str, error: impl std::fmt::Display) -> PraxisError {
    PraxisError::Serialization(format!("{context}: {error}"))
}

fn parse_request(request: &SolverRequest) -> Result<FaultTreeExecuteRequest> {
    let parsed: FaultTreeExecuteRequest = serde_json::from_value(request.request.clone())
        .map_err(|error| serialization_error("invalid fault-tree execute request", error))?;
    if parsed.schema_version != request.schema_version {
        return Err(PraxisError::Version(format!(
            "fault-tree request schema version '{}' does not match solver protocol version '{}'",
            parsed.schema_version, request.schema_version
        )));
    }
    if parsed.method_type != FAULT_TREE_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "fault-tree adapter cannot execute method '{}'",
            parsed.method_type
        )));
    }
    if parsed.requested_by.trim().is_empty() {
        return Err(PraxisError::Serialization(
            "fault-tree execute request requires requestedBy".to_string(),
        ));
    }
    Ok(parsed)
}

fn find_snapshot(
    request: &SolverRequest,
    model_id: &str,
    expected_revision: Option<u64>,
) -> Result<FaultTreeSnapshot> {
    let snapshot = request
        .model_snapshots
        .iter()
        .find(|snapshot| {
            snapshot.get("methodType").and_then(Value::as_str) == Some(FAULT_TREE_METHOD)
                && snapshot.get("id").and_then(Value::as_str) == Some(model_id)
        })
        .ok_or_else(|| {
            PraxisError::Logic(format!(
                "fault-tree model snapshot '{}' is missing",
                model_id
            ))
        })?;

    let snapshot: FaultTreeSnapshot = serde_json::from_value(snapshot.clone())
        .map_err(|error| serialization_error("invalid fault-tree model snapshot", error))?;
    if snapshot.method_type != FAULT_TREE_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "fault-tree snapshot uses method '{}'",
            snapshot.method_type
        )));
    }
    if let Some(expected_revision) = expected_revision {
        if snapshot.revision != expected_revision {
            return Err(PraxisError::Version(format!(
                "fault-tree snapshot revision {} does not match requested revision {}",
                snapshot.revision, expected_revision
            )));
        }
    }
    Ok(snapshot)
}

fn parse_catalogue(request: &SolverRequest, project_id: &str) -> Result<BasicEventCatalogue> {
    let value = request
        .resources
        .fault_tree_basic_event_catalogue
        .as_ref()
        .ok_or_else(|| {
            PraxisError::Logic(
                "fault-tree execution requires a project basic-event catalogue".to_string(),
            )
        })?;
    let catalogue: BasicEventCatalogue = serde_json::from_value(value.clone())
        .map_err(|error| serialization_error("invalid fault-tree basic-event catalogue", error))?;
    if catalogue.project_id != project_id {
        return Err(PraxisError::Logic(format!(
            "basic-event catalogue project '{}' does not match fault-tree project '{}'",
            catalogue.project_id, project_id
        )));
    }
    Ok(catalogue)
}

fn build_fault_tree_snapshot(
    request: &SolverRequest,
    snapshot: FaultTreeSnapshot,
) -> Result<FaultTreeAdapter> {
    let top_gate_id = snapshot
        .top_gate
        .as_ref()
        .map(|top_gate| top_gate.gate_id.clone())
        .ok_or_else(|| PraxisError::Logic("fault-tree snapshot has no top gate".to_string()))?;
    let catalogue = parse_catalogue(request, &snapshot.project_id)?;

    let mut catalogue_probabilities = HashMap::with_capacity(catalogue.basic_events.len());
    for event in catalogue.basic_events {
        if catalogue_probabilities
            .insert(event.id.clone(), event.probability.value)
            .is_some()
        {
            return Err(PraxisError::Logic(format!(
                "basic-event catalogue contains duplicate id '{}'",
                event.id
            )));
        }
    }

    let mut aliases = HashMap::with_capacity(snapshot.leaf_nodes.len());
    let mut basic_event_probabilities = HashMap::new();
    let mut house_events = Vec::new();
    for leaf in snapshot.leaf_nodes {
        match leaf {
            FaultTreeLeaf::BasicEventReference { id, basic_event_id } => {
                let probability = catalogue_probabilities
                    .get(&basic_event_id)
                    .copied()
                    .ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "basic-event reference '{}' cannot resolve catalogue event '{}'",
                            id, basic_event_id
                        ))
                    })?;
                aliases.insert(id, basic_event_id.clone());
                basic_event_probabilities.insert(basic_event_id, probability);
            }
            FaultTreeLeaf::HouseEvent { id, state } => {
                aliases.insert(id.clone(), id.clone());
                house_events.push((id, state));
            }
            FaultTreeLeaf::UndevelopedEvent { id } => {
                return Err(PraxisError::IllegalOperation(format!(
                    "undeveloped event '{id}' has no quantifiable probability"
                )));
            }
            FaultTreeLeaf::TransferReference { id } => {
                return Err(PraxisError::IllegalOperation(format!(
                    "fault-tree transfer reference '{id}' is not supported by the initial adapter"
                )));
            }
        }
    }

    let gate_ids: HashSet<&str> = snapshot.gates.iter().map(FaultTreeGate::id).collect();
    if !gate_ids.contains(top_gate_id.as_str()) {
        return Err(PraxisError::Logic(format!(
            "fault-tree top gate '{}' does not exist",
            top_gate_id
        )));
    }

    let mut inputs_by_gate: HashMap<String, Vec<FaultTreeGateInput>> = HashMap::new();
    for input in snapshot.gate_inputs {
        if !gate_ids.contains(input.gate_id.as_str()) {
            return Err(PraxisError::Logic(format!(
                "gate input '{}' references missing gate '{}'",
                input.id, input.gate_id
            )));
        }
        inputs_by_gate
            .entry(input.gate_id.clone())
            .or_default()
            .push(input);
    }
    for inputs in inputs_by_gate.values_mut() {
        inputs.sort_by_key(|input| input.order);
    }

    let mut fault_tree = FaultTree::new(snapshot.id.clone(), top_gate_id.clone())?;
    for (id, probability) in basic_event_probabilities {
        fault_tree.add_basic_event(BasicEvent::new(id, probability)?)?;
    }
    for (id, state) in house_events {
        fault_tree.add_house_event(HouseEvent::new(id, state)?)?;
    }
    for gate_snapshot in snapshot.gates {
        let gate_id = gate_snapshot.id().to_string();
        let mut gate = Gate::new(gate_id.clone(), gate_snapshot.formula())?;
        for input in inputs_by_gate.remove(&gate_id).unwrap_or_default() {
            let operand = aliases
                .get(&input.child_id)
                .cloned()
                .unwrap_or(input.child_id);
            gate.add_operand(operand);
        }
        fault_tree.add_gate(gate)?;
    }

    Ok(FaultTreeAdapter {
        fault_tree,
        model_id: snapshot.id,
        model_revision: snapshot.revision,
        top_gate_id,
    })
}

pub(crate) fn build_fault_tree_for_model(
    request: &SolverRequest,
    model_id: &str,
) -> Result<FaultTreeAdapter> {
    let snapshot = find_snapshot(request, model_id, None)?;
    build_fault_tree_snapshot(request, snapshot)
}

fn build_fault_tree(request: &SolverRequest) -> Result<FaultTreeAdapter> {
    let execute = parse_request(request)?;
    let snapshot = find_snapshot(request, &execute.model_id, Some(execute.revision))?;
    build_fault_tree_snapshot(request, snapshot)
}

pub(crate) fn validate(request: &SolverRequest) -> Result<Value> {
    let adapter = build_fault_tree(request)?;
    FaultTreeAnalysis::new(&adapter.fault_tree)?.analyze()?;
    Ok(json!({
        "scope": FAULT_TREE_METHOD,
        "valid": true,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "basicEventCount": adapter.fault_tree.basic_events().len()
    }))
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let adapter = build_fault_tree(request)?;
    let analysis = FaultTreeAnalysis::new(&adapter.fault_tree)?.analyze()?;
    let pdag = Pdag::from_fault_tree(&adapter.fault_tree)?;
    let mut mocus = NonCoherentMocus::new(&pdag, &adapter.fault_tree)?;
    let cut_sets = mocus.analyze_primes();

    let mut leading_cut_sets: Vec<Value> = cut_sets
        .iter()
        .map(|cut_set| {
            let mut events: Vec<Value> = cut_set
                .literals
                .iter()
                .map(|literal| {
                    let name = mocus.literal_name(*literal);
                    json!({
                        "basicEventId": name.strip_prefix('~').unwrap_or(&name),
                        "complemented": *literal < 0
                    })
                })
                .collect();
            events.sort_by(|left, right| {
                left["basicEventId"]
                    .as_str()
                    .cmp(&right["basicEventId"].as_str())
            });
            json!({
                "order": cut_set.order(),
                "probability": mocus.cut_set_probability(cut_set),
                "events": events
            })
        })
        .collect();
    leading_cut_sets.sort_by(|left, right| {
        right["probability"]
            .as_f64()
            .partial_cmp(&left["probability"].as_f64())
            .unwrap_or(Ordering::Equal)
            .then_with(|| left["events"].to_string().cmp(&right["events"].to_string()))
    });
    for (index, cut_set) in leading_cut_sets.iter_mut().enumerate() {
        cut_set["rank"] = json!(index + 1);
    }

    Ok(json!({
        "methodType": FAULT_TREE_METHOD,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "topGateId": adapter.top_gate_id,
        "topEventProbability": analysis.top_event_probability,
        "minimalCutSetCount": leading_cut_sets.len(),
        "leadingCutSets": leading_cut_sets,
        "validationIssues": []
    }))
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::execute;
    use crate::transport::SolverRequest;

    fn request(
        gate_type: &str,
        k: Option<usize>,
        probabilities: &[(&str, f64)],
        operands: &[(&str, &str)],
    ) -> SolverRequest {
        let gate_id = "00000000-0000-4000-8000-000000000001";
        let model_id = "00000000-0000-4000-8000-000000000002";
        let project_id = "project-1";
        let mut gate = json!({
            "id": gate_id,
            "kind": "GATE",
            "gateType": gate_type,
            "code": "TOP",
            "name": "Top",
            "description": ""
        });
        if let Some(k) = k {
            gate["k"] = json!(k);
        }
        let leaf_nodes: Vec<Value> = operands
            .iter()
            .enumerate()
            .map(|(index, (reference_id, basic_event_id))| {
                json!({
                    "id": reference_id,
                    "kind": "BASIC_EVENT_REFERENCE",
                    "basicEventId": basic_event_id,
                    "index": index
                })
            })
            .collect();
        let gate_inputs: Vec<Value> = operands
            .iter()
            .enumerate()
            .map(|(index, (reference_id, _))| {
                json!({
                    "id": format!("input-{index}"),
                    "gateId": gate_id,
                    "childId": reference_id,
                    "order": index
                })
            })
            .collect();
        let basic_events: Vec<Value> = probabilities
            .iter()
            .map(|(id, probability)| json!({ "id": id, "probability": { "value": probability } }))
            .collect();

        SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": {
                    "schemaVersion": "1.0.0",
                    "methodType": "FAULT_TREE",
                    "modelId": model_id,
                    "revision": 3,
                    "requestedBy": "analyst"
                },
                "modelSnapshots": [{
                    "id": model_id,
                    "projectId": project_id,
                    "methodType": "FAULT_TREE",
                    "revision": 3,
                    "topGate": { "gateId": gate_id },
                    "gates": [gate],
                    "leafNodes": leaf_nodes,
                    "gateInputs": gate_inputs
                }],
                "resources": {
                    "faultTreeBasicEventCatalogue": {
                        "projectId": project_id,
                        "basicEvents": basic_events
                    }
                }
            })
            .to_string(),
        )
        .unwrap()
    }

    #[test]
    fn quantifies_and_and_or_gates_exactly() {
        let and = execute(&request(
            "AND",
            None,
            &[("A", 0.1), ("B", 0.2)],
            &[("ref-a", "A"), ("ref-b", "B")],
        ))
        .unwrap();
        assert!((and["topEventProbability"].as_f64().unwrap() - 0.02).abs() < 1e-12);
        assert_eq!(and["minimalCutSetCount"], 1);
        assert_eq!(and["leadingCutSets"][0]["order"], 2);

        let or = execute(&request(
            "OR",
            None,
            &[("A", 0.1), ("B", 0.2)],
            &[("ref-a", "A"), ("ref-b", "B")],
        ))
        .unwrap();
        assert!((or["topEventProbability"].as_f64().unwrap() - 0.28).abs() < 1e-12);
        assert_eq!(or["minimalCutSetCount"], 2);
        assert_eq!(or["leadingCutSets"][0]["probability"], 0.2);
    }

    #[test]
    fn matches_boolean_gate_truth_tables_exhaustively() {
        for a in [0.0, 1.0] {
            for b in [0.0, 1.0] {
                let inputs = &[("A", a), ("B", b)];
                let references = &[("ref-a", "A"), ("ref-b", "B")];
                let and = execute(&request("AND", None, inputs, references)).unwrap();
                let or = execute(&request("OR", None, inputs, references)).unwrap();
                assert_eq!(and["topEventProbability"].as_f64().unwrap(), a * b);
                assert_eq!(
                    or["topEventProbability"].as_f64().unwrap(),
                    if a == 1.0 || b == 1.0 { 1.0 } else { 0.0 }
                );
            }
        }

        for a in [0.0, 1.0] {
            for b in [0.0, 1.0] {
                for c in [0.0, 1.0] {
                    let inputs = &[("A", a), ("B", b), ("C", c)];
                    let references = &[("ref-a", "A"), ("ref-b", "B"), ("ref-c", "C")];
                    let voting = execute(&request("K_OF_N", Some(2), inputs, references)).unwrap();
                    let true_count = [a, b, c].iter().filter(|value| **value == 1.0).count();
                    assert_eq!(
                        voting["topEventProbability"].as_f64().unwrap(),
                        if true_count >= 2 { 1.0 } else { 0.0 }
                    );
                }
            }
        }

        for a in [0.0, 1.0] {
            let not = execute(&request("NOT", None, &[("A", a)], &[("ref-a", "A")])).unwrap();
            assert_eq!(not["topEventProbability"].as_f64().unwrap(), 1.0 - a);
        }
    }

    #[test]
    fn preserves_shared_basic_event_identity() {
        let result = execute(&request(
            "OR",
            None,
            &[("SHARED", 0.25)],
            &[("ref-a", "SHARED"), ("ref-b", "SHARED")],
        ))
        .unwrap();
        assert!((result["topEventProbability"].as_f64().unwrap() - 0.25).abs() < 1e-12);
        assert_eq!(result["minimalCutSetCount"], 1);
        assert_eq!(
            result["leadingCutSets"][0]["events"][0]["basicEventId"],
            "SHARED"
        );
    }

    #[test]
    fn quantifies_k_of_n_exactly() {
        let result = execute(&request(
            "K_OF_N",
            Some(2),
            &[("A", 0.5), ("B", 0.5), ("C", 0.5)],
            &[("ref-a", "A"), ("ref-b", "B"), ("ref-c", "C")],
        ))
        .unwrap();
        assert!((result["topEventProbability"].as_f64().unwrap() - 0.5).abs() < 1e-12);
        assert_eq!(result["minimalCutSetCount"], 3);
        assert!(result["leadingCutSets"]
            .as_array()
            .unwrap()
            .iter()
            .all(|cut_set| cut_set["order"] == 2));
    }

    #[test]
    fn returns_complemented_literals_for_not_gates() {
        let result = execute(&request("NOT", None, &[("A", 0.2)], &[("ref-a", "A")])).unwrap();
        assert!((result["topEventProbability"].as_f64().unwrap() - 0.8).abs() < 1e-12);
        assert_eq!(result["minimalCutSetCount"], 1);
        assert_eq!(result["leadingCutSets"][0]["probability"], 0.8);
        assert_eq!(
            result["leadingCutSets"][0]["events"][0]["complemented"],
            true
        );
    }
}
