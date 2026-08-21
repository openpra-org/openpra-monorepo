use std::collections::{HashMap, HashSet};

use praxis::analysis::event_tree_quantification::{
    quantify_event_tree_sequences, EventTreeHclContext,
};
use praxis::core::event_tree::{
    Branch, BranchTarget, EventTree, Fork, FunctionalEvent, Path, Sequence,
};
use praxis::core::model::Model;
use praxis::{PraxisError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::fault_tree::build_fault_tree_for_model;
use crate::hybrid_causal_logic::build_event_tree_context;
use crate::transport::SolverRequest;

const EVENT_TREE_METHOD: &str = "EVENT_TREE";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EventTreeExecuteRequest {
    schema_version: String,
    method_type: String,
    model_id: String,
    revision: u64,
    mode: EventTreeExecutionMode,
    requested_by: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum EventTreeExecutionMode {
    Independent,
    HybridCausalLogic,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventTreeSnapshot {
    id: String,
    method_type: String,
    revision: u64,
    initiating_event: InitiatingEventReference,
    initiating_event_frequency: InitiatingEventFrequency,
    functional_events: Vec<FunctionalEventSnapshot>,
    functional_event_fault_tree_links: Vec<FunctionalEventFaultTreeLink>,
    end_states: Vec<EndStateSnapshot>,
    sequences: Vec<EventTreeSequenceSnapshot>,
    hcl_configuration: Option<EventTreeHclConfigurationReference>,
}

#[derive(Clone, Debug, Deserialize)]
struct InitiatingEventReference {
    target: EntityReference,
}

#[derive(Clone, Debug, Deserialize)]
struct InitiatingEventFrequency {
    value: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct EntityReference {
    #[serde(rename = "modelId")]
    model_id: String,
    #[serde(rename = "entityId")]
    entity_id: String,
}

#[derive(Clone, Debug, Deserialize)]
struct FunctionalEventSnapshot {
    id: String,
    name: String,
    order: usize,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FunctionalEventFaultTreeLink {
    functional_event_id: String,
    fault_tree_top_gate: EntityReference,
}

#[derive(Clone, Debug, Deserialize)]
struct EndStateSnapshot {
    id: String,
}

#[derive(Clone, Debug, Deserialize)]
struct EventTreeHclConfigurationReference {
    configuration: ModelReference,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelReference {
    model_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct EventTreeSequenceSnapshot {
    id: String,
    path: Vec<EventTreePathStep>,
    result: EventTreeBranchResult,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct EventTreePathStep {
    functional_event_id: String,
    outcome: EventTreeBranchOutcome,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum EventTreeBranchOutcome {
    Success,
    Failure,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "SCREAMING_SNAKE_CASE")]
enum EventTreeBranchResult {
    EndState {
        #[serde(rename = "endStateId")]
        end_state_id: String,
    },
    Transfer {
        target: EntityReference,
    },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SequenceResult<'a> {
    sequence_id: &'a str,
    path: &'a [EventTreePathStep],
    result: &'a EventTreeBranchResult,
    conditional_probability: f64,
    annual_frequency: f64,
}

struct EventTreeAdapter {
    model_id: String,
    model_revision: u64,
    mode: EventTreeExecutionMode,
    initiating_event_frequency: f64,
    event_tree: EventTree,
    model: Model,
    snapshot: EventTreeSnapshot,
    event_tree_snapshots: HashMap<String, EventTreeSnapshot>,
    hcl_context: Option<EventTreeHclContext>,
}

fn serialization_error(context: &str, error: impl std::fmt::Display) -> PraxisError {
    PraxisError::Serialization(format!("{context}: {error}"))
}

fn parse_request(request: &SolverRequest) -> Result<EventTreeExecuteRequest> {
    let parsed: EventTreeExecuteRequest = serde_json::from_value(request.request.clone())
        .map_err(|error| serialization_error("invalid event-tree execute request", error))?;
    if parsed.schema_version != request.schema_version {
        return Err(PraxisError::Version(format!(
            "event-tree request schema version '{}' does not match solver protocol version '{}'",
            parsed.schema_version, request.schema_version
        )));
    }
    if parsed.method_type != EVENT_TREE_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "event-tree adapter cannot execute method '{}'",
            parsed.method_type
        )));
    }
    if parsed.requested_by.trim().is_empty() {
        return Err(PraxisError::Serialization(
            "event-tree execute request requires requestedBy".to_string(),
        ));
    }
    Ok(parsed)
}

fn parse_event_tree_snapshots(
    request: &SolverRequest,
) -> Result<HashMap<String, EventTreeSnapshot>> {
    let mut snapshots = HashMap::new();
    for value in request.model_snapshots.iter().filter(|snapshot| {
        snapshot.get("methodType").and_then(Value::as_str) == Some(EVENT_TREE_METHOD)
    }) {
        let snapshot: EventTreeSnapshot = serde_json::from_value(value.clone())
            .map_err(|error| serialization_error("invalid event-tree model snapshot", error))?;
        if snapshots.insert(snapshot.id.clone(), snapshot).is_some() {
            return Err(PraxisError::Logic(
                "solver request contains a duplicate event-tree model snapshot".to_string(),
            ));
        }
    }
    Ok(snapshots)
}

fn build_adapter(request: &SolverRequest) -> Result<EventTreeAdapter> {
    let execute = parse_request(request)?;
    let mut event_tree_snapshots = parse_event_tree_snapshots(request)?;
    let snapshot = event_tree_snapshots
        .remove(&execute.model_id)
        .ok_or_else(|| {
            PraxisError::Logic(format!(
                "event-tree model snapshot '{}' is missing",
                execute.model_id
            ))
        })?;
    if snapshot.method_type != EVENT_TREE_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "event-tree snapshot uses method '{}'",
            snapshot.method_type
        )));
    }
    if snapshot.revision != execute.revision {
        return Err(PraxisError::Version(format!(
            "event-tree snapshot revision {} does not match requested revision {}",
            snapshot.revision, execute.revision
        )));
    }
    if !snapshot.initiating_event_frequency.value.is_finite()
        || snapshot.initiating_event_frequency.value < 0.0
    {
        return Err(PraxisError::Logic(
            "event-tree initiating-event frequency must be finite and non-negative".to_string(),
        ));
    }
    if snapshot.initiating_event.target.model_id.trim().is_empty()
        || snapshot.initiating_event.target.entity_id.trim().is_empty()
    {
        return Err(PraxisError::Logic(
            "event-tree initiating-event reference is empty".to_string(),
        ));
    }

    let mut functional_events = snapshot.functional_events.clone();
    functional_events.sort_by_key(|event| event.order);
    if functional_events
        .iter()
        .enumerate()
        .any(|(order, event)| event.order != order)
    {
        return Err(PraxisError::Logic(
            "event-tree functional-event order must be contiguous from zero".to_string(),
        ));
    }
    let links: HashMap<&str, &FunctionalEventFaultTreeLink> = snapshot
        .functional_event_fault_tree_links
        .iter()
        .map(|link| (link.functional_event_id.as_str(), link))
        .collect();
    if links.len() != snapshot.functional_event_fault_tree_links.len() {
        return Err(PraxisError::Logic(
            "event-tree contains duplicate functional-event fault-tree links".to_string(),
        ));
    }

    let mut model = Model::new(format!("event-tree-{}", snapshot.id))?;
    let mut added_fault_trees = HashSet::new();
    let mut core_functional_events = Vec::with_capacity(functional_events.len());
    for functional_event in &functional_events {
        let link = links.get(functional_event.id.as_str()).ok_or_else(|| {
            PraxisError::Logic(format!(
                "functional event '{}' has no fault-tree top-gate link",
                functional_event.id
            ))
        })?;
        if added_fault_trees.insert(link.fault_tree_top_gate.model_id.clone()) {
            let adapter = build_fault_tree_for_model(request, &link.fault_tree_top_gate.model_id)?;
            if adapter.top_gate_id != link.fault_tree_top_gate.entity_id {
                return Err(PraxisError::Logic(format!(
                    "functional event '{}' references top gate '{}' but fault tree '{}' uses '{}'",
                    functional_event.id,
                    link.fault_tree_top_gate.entity_id,
                    link.fault_tree_top_gate.model_id,
                    adapter.top_gate_id
                )));
            }
            model.add_fault_tree(adapter.fault_tree)?;
        }
        let order = i32::try_from(functional_event.order).map_err(|_| {
            PraxisError::Logic("functional-event order exceeds PRAXIS range".to_string())
        })?;
        core_functional_events.push(
            FunctionalEvent::new(functional_event.id.clone())
                .with_name(functional_event.name.clone())
                .with_order(order)
                .with_fault_tree(link.fault_tree_top_gate.model_id.clone()),
        );
    }

    let hcl_context = match execute.mode {
        EventTreeExecutionMode::Independent => None,
        EventTreeExecutionMode::HybridCausalLogic => {
            let configuration_id = snapshot
                .hcl_configuration
                .as_ref()
                .map(|reference| reference.configuration.model_id.as_str())
                .ok_or_else(|| {
                    PraxisError::Hcl(
                        "HCL event-tree execution requires an HCL configuration".to_string(),
                    )
                })?;
            Some(build_event_tree_context(
                request,
                configuration_id,
                &added_fault_trees,
            )?)
        }
    };

    let ordered_ids: Vec<&str> = functional_events
        .iter()
        .map(|event| event.id.as_str())
        .collect();
    let sequence_refs: Vec<&EventTreeSequenceSnapshot> = snapshot.sequences.iter().collect();
    let initial_state = build_branch(&ordered_ids, &sequence_refs, 0)?;
    let mut event_tree = EventTree::new(snapshot.id.clone(), initial_state);
    for functional_event in core_functional_events {
        event_tree.add_functional_event(functional_event)?;
    }
    for sequence in &snapshot.sequences {
        event_tree.add_sequence(Sequence::new(sequence.id.clone()))?;
    }
    event_tree.validate()?;

    event_tree_snapshots.insert(snapshot.id.clone(), snapshot.clone());
    Ok(EventTreeAdapter {
        model_id: snapshot.id.clone(),
        model_revision: snapshot.revision,
        mode: execute.mode,
        initiating_event_frequency: snapshot.initiating_event_frequency.value,
        event_tree,
        model,
        snapshot,
        event_tree_snapshots,
        hcl_context,
    })
}

fn build_branch(
    ordered_functional_event_ids: &[&str],
    candidates: &[&EventTreeSequenceSnapshot],
    depth: usize,
) -> Result<Branch> {
    if depth == ordered_functional_event_ids.len() {
        if candidates.len() != 1 {
            return Err(PraxisError::Logic(format!(
                "event-tree path resolves to {} sequences instead of exactly one",
                candidates.len()
            )));
        }
        return Ok(Branch::new(BranchTarget::Sequence(
            candidates[0].id.clone(),
        )));
    }

    let functional_event_id = ordered_functional_event_ids[depth];
    let mut paths = Vec::with_capacity(2);
    for outcome in [
        EventTreeBranchOutcome::Success,
        EventTreeBranchOutcome::Failure,
    ] {
        let matching: Vec<&EventTreeSequenceSnapshot> = candidates
            .iter()
            .copied()
            .filter(|sequence| {
                sequence.path.get(depth).is_some_and(|step| {
                    step.functional_event_id == functional_event_id && step.outcome == outcome
                })
            })
            .collect();
        if matching.is_empty() {
            return Err(PraxisError::Logic(format!(
                "event-tree branch coverage is missing {:?} for functional event '{}'",
                outcome, functional_event_id
            )));
        }
        let state = match outcome {
            EventTreeBranchOutcome::Success => "success",
            EventTreeBranchOutcome::Failure => "failure",
        };
        paths.push(
            Path::new(
                state.to_string(),
                build_branch(ordered_functional_event_ids, &matching, depth + 1)?,
            )?
            .with_collect_formula_negated(outcome == EventTreeBranchOutcome::Success),
        );
    }
    Ok(Branch::new(BranchTarget::Fork(Fork::new(
        functional_event_id.to_string(),
        paths,
    )?)))
}

pub(crate) fn validate(request: &SolverRequest) -> Result<Value> {
    let adapter = build_adapter(request)?;
    let probabilities = quantify_event_tree_sequences(
        &adapter.model,
        &adapter.event_tree,
        adapter.hcl_context.as_ref(),
    )?;
    Ok(json!({
        "scope": EVENT_TREE_METHOD,
        "valid": true,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "sequenceCount": probabilities.len()
    }))
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let adapter = build_adapter(request)?;
    let probabilities = quantify_event_tree_sequences(
        &adapter.model,
        &adapter.event_tree,
        adapter.hcl_context.as_ref(),
    )?;
    let probability_by_sequence: HashMap<&str, f64> = probabilities
        .iter()
        .map(|result| (result.sequence_id.as_str(), result.conditional_probability))
        .collect();
    let mut aggregate_by_end_state: HashMap<String, f64> = HashMap::new();
    let mut sequences = Vec::with_capacity(adapter.snapshot.sequences.len());
    for sequence in &adapter.snapshot.sequences {
        let conditional_probability = probability_by_sequence
            .get(sequence.id.as_str())
            .copied()
            .ok_or_else(|| {
                PraxisError::Logic(format!(
                    "PRAXIS did not return event-tree sequence '{}'",
                    sequence.id
                ))
            })?;
        let annual_frequency = conditional_probability * adapter.initiating_event_frequency;
        let end_state_id = resolve_end_state(
            &adapter.model_id,
            &sequence.id,
            &adapter.event_tree_snapshots,
            &mut HashSet::new(),
        )?;
        *aggregate_by_end_state.entry(end_state_id).or_default() += annual_frequency;
        sequences.push(SequenceResult {
            sequence_id: &sequence.id,
            path: &sequence.path,
            result: &sequence.result,
            conditional_probability,
            annual_frequency,
        });
    }

    let declared_end_states: HashSet<&str> = adapter
        .event_tree_snapshots
        .values()
        .flat_map(|snapshot| snapshot.end_states.iter().map(|state| state.id.as_str()))
        .collect();
    if let Some(undeclared) = aggregate_by_end_state
        .keys()
        .find(|end_state_id| !declared_end_states.contains(end_state_id.as_str()))
    {
        return Err(PraxisError::Logic(format!(
            "event-tree result resolves undeclared end state '{undeclared}'"
        )));
    }
    let mut end_state_aggregates: Vec<Value> = aggregate_by_end_state
        .into_iter()
        .map(|(end_state_id, annual_frequency)| {
            json!({ "endStateId": end_state_id, "annualFrequency": annual_frequency })
        })
        .collect();
    end_state_aggregates.sort_by(|left, right| {
        left["endStateId"]
            .as_str()
            .cmp(&right["endStateId"].as_str())
    });

    Ok(json!({
        "methodType": EVENT_TREE_METHOD,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "mode": adapter.mode,
        "sequences": sequences,
        "endStateAggregates": end_state_aggregates,
        "validationIssues": []
    }))
}

fn resolve_end_state(
    model_id: &str,
    sequence_id: &str,
    snapshots: &HashMap<String, EventTreeSnapshot>,
    visited: &mut HashSet<(String, String)>,
) -> Result<String> {
    if !visited.insert((model_id.to_string(), sequence_id.to_string())) {
        return Err(PraxisError::Logic(format!(
            "event-tree transfer loop reaches '{model_id}:{sequence_id}'"
        )));
    }
    let snapshot = snapshots.get(model_id).ok_or_else(|| {
        PraxisError::Logic(format!("event-tree transfer model '{model_id}' is missing"))
    })?;
    let sequence = snapshot
        .sequences
        .iter()
        .find(|sequence| sequence.id == sequence_id)
        .ok_or_else(|| {
            PraxisError::Logic(format!(
                "event-tree transfer sequence '{model_id}:{sequence_id}' is missing"
            ))
        })?;
    match &sequence.result {
        EventTreeBranchResult::EndState { end_state_id } => Ok(end_state_id.clone()),
        EventTreeBranchResult::Transfer { target } => {
            resolve_end_state(&target.model_id, &target.entity_id, snapshots, visited)
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::{HashMap, HashSet};

    use serde_json::json;
    use serde_json::Value;

    use super::{execute, resolve_end_state, EventTreeSnapshot};
    use crate::transport::SolverRequest;

    #[test]
    fn quantifies_complete_sequences_without_multiplying_shared_branch_marginals() {
        let request = SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": {
                    "schemaVersion": "1.0.0",
                    "methodType": "EVENT_TREE",
                    "modelId": "ET",
                    "revision": 2,
                    "mode": "INDEPENDENT",
                    "requestedBy": "analyst"
                },
                "modelSnapshots": [
                    fault_tree("FT-A", "TOP-A", "REF-A"),
                    fault_tree("FT-B", "TOP-B", "REF-B"),
                    {
                        "id": "ET",
                        "methodType": "EVENT_TREE",
                        "revision": 2,
                        "initiatingEvent": { "target": { "modelId": "IE", "entityId": "IE-1" } },
                        "initiatingEventFrequency": { "value": 0.01 },
                        "functionalEvents": [
                            { "id": "FE-A", "name": "A", "order": 0 },
                            { "id": "FE-B", "name": "B", "order": 1 }
                        ],
                        "functionalEventFaultTreeLinks": [
                            { "functionalEventId": "FE-A", "faultTreeTopGate": { "modelId": "FT-A", "entityId": "TOP-A" } },
                            { "functionalEventId": "FE-B", "faultTreeTopGate": { "modelId": "FT-B", "entityId": "TOP-B" } }
                        ],
                        "endStates": [{ "id": "SAFE" }, { "id": "RELEASE" }],
                        "sequences": [
                            sequence("SS", "SUCCESS", "SUCCESS", "SAFE"),
                            sequence("SF", "SUCCESS", "FAILURE", "SAFE"),
                            sequence("FS", "FAILURE", "SUCCESS", "SAFE"),
                            sequence("FF", "FAILURE", "FAILURE", "RELEASE")
                        ]
                    }
                ],
                "resources": {
                    "faultTreeBasicEventCatalogue": {
                        "projectId": "P",
                        "basicEvents": [{ "id": "SHARED", "probability": { "value": 0.2 } }]
                    }
                }
            })
            .to_string(),
        )
        .unwrap();

        let result = execute(&request).unwrap();
        let probabilities: HashMap<&str, f64> = result["sequences"]
            .as_array()
            .unwrap()
            .iter()
            .map(|sequence| {
                (
                    sequence["sequenceId"].as_str().unwrap(),
                    sequence["conditionalProbability"].as_f64().unwrap(),
                )
            })
            .collect();
        assert!((probabilities["SS"] - 0.8).abs() < 1e-12);
        assert!(probabilities["SF"].abs() < 1e-12);
        assert!(probabilities["FS"].abs() < 1e-12);
        assert!((probabilities["FF"] - 0.2).abs() < 1e-12);
        assert!(
            (result["endStateAggregates"][0]["annualFrequency"]
                .as_f64()
                .unwrap()
                - 0.002)
                .abs()
                < 1e-12
        );
        assert!(
            (result["endStateAggregates"][1]["annualFrequency"]
                .as_f64()
                .unwrap()
                - 0.008)
                .abs()
                < 1e-12
        );
    }

    #[test]
    fn resolves_transfer_chains_and_rejects_transfer_loops() {
        let source: EventTreeSnapshot = serde_json::from_value(json!({
            "id": "ET-SOURCE",
            "methodType": "EVENT_TREE",
            "revision": 1,
            "initiatingEvent": { "target": { "modelId": "IE", "entityId": "IE-1" } },
            "initiatingEventFrequency": { "value": 1.0 },
            "functionalEvents": [],
            "functionalEventFaultTreeLinks": [],
            "endStates": [],
            "sequences": [{
                "id": "TRANSFER",
                "path": [],
                "result": {
                    "kind": "TRANSFER",
                    "target": { "modelId": "ET-TARGET", "entityId": "TARGET" }
                }
            }]
        }))
        .unwrap();
        let target: EventTreeSnapshot = serde_json::from_value(json!({
            "id": "ET-TARGET",
            "methodType": "EVENT_TREE",
            "revision": 1,
            "initiatingEvent": { "target": { "modelId": "IE", "entityId": "IE-1" } },
            "initiatingEventFrequency": { "value": 1.0 },
            "functionalEvents": [],
            "functionalEventFaultTreeLinks": [],
            "endStates": [{ "id": "SAFE" }],
            "sequences": [{
                "id": "TARGET",
                "path": [],
                "result": { "kind": "END_STATE", "endStateId": "SAFE" }
            }]
        }))
        .unwrap();
        let mut snapshots =
            HashMap::from([(source.id.clone(), source), (target.id.clone(), target)]);

        let end_state =
            resolve_end_state("ET-SOURCE", "TRANSFER", &snapshots, &mut HashSet::new()).unwrap();
        assert_eq!(end_state, "SAFE");

        snapshots.get_mut("ET-TARGET").unwrap().sequences[0].result =
            serde_json::from_value(json!({
                "kind": "TRANSFER",
                "target": { "modelId": "ET-SOURCE", "entityId": "TRANSFER" }
            }))
            .unwrap();
        let error = resolve_end_state("ET-SOURCE", "TRANSFER", &snapshots, &mut HashSet::new())
            .unwrap_err();
        assert!(error.to_string().contains("transfer loop"));
    }

    fn fault_tree(id: &str, top: &str, reference: &str) -> Value {
        json!({
            "id": id,
            "projectId": "P",
            "methodType": "FAULT_TREE",
            "revision": 2,
            "topGate": { "gateId": top },
            "gates": [{ "id": top, "gateType": "OR" }],
            "leafNodes": [{ "id": reference, "kind": "BASIC_EVENT_REFERENCE", "basicEventId": "SHARED" }],
            "gateInputs": [{ "id": format!("INPUT-{id}"), "gateId": top, "childId": reference, "order": 0 }]
        })
    }

    fn sequence(id: &str, first: &str, second: &str, end_state: &str) -> Value {
        json!({
            "id": id,
            "path": [
                { "functionalEventId": "FE-A", "outcome": first },
                { "functionalEventId": "FE-B", "outcome": second }
            ],
            "result": { "kind": "END_STATE", "endStateId": end_state }
        })
    }
}
