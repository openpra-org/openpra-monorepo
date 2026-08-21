use std::collections::{HashMap, HashSet};

use praxis::hcl::{
    query_bayesian_network, CanonicalBayesianNetwork, CanonicalBayesianVariable, HclEvidenceSpec,
};
use praxis::{PraxisError, Result};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::transport::SolverRequest;

const BAYESIAN_NETWORK_METHOD: &str = "BAYESIAN_NETWORK";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BayesianExecuteRequest {
    schema_version: String,
    method_type: String,
    model_id: String,
    revision: u64,
    requested_by: String,
    query: BayesianQuery,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BayesianQuery {
    evidence: BayesianEvidence,
    query_node_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct BayesianEvidence {
    observations: Vec<BayesianObservation>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BayesianObservation {
    node_id: String,
    state_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BayesianSnapshot {
    id: String,
    method_type: String,
    revision: u64,
    nodes: Vec<BayesianNode>,
    conditional_probability_tables: Vec<BayesianCpt>,
}

#[derive(Debug, Deserialize)]
struct BayesianNode {
    id: String,
    states: Vec<BayesianState>,
}

#[derive(Debug, Deserialize)]
struct BayesianState {
    id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BayesianCpt {
    node_id: String,
    parents: Vec<BayesianParent>,
    rows: Vec<BayesianCptRow>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BayesianParent {
    node_id: String,
    order: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BayesianCptRow {
    id: String,
    parent_states: Vec<BayesianParentState>,
    values: Vec<BayesianCptValue>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BayesianParentState {
    parent_node_id: String,
    state_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BayesianCptValue {
    state_id: String,
    probability: f64,
}

struct BayesianAdapter {
    model_id: String,
    model_revision: u64,
    network: CanonicalBayesianNetwork,
    evidence: Vec<HclEvidenceSpec>,
    query_node_ids: Vec<String>,
}

fn serialization_error(context: &str, error: impl std::fmt::Display) -> PraxisError {
    PraxisError::Serialization(format!("{context}: {error}"))
}

fn parse_request(request: &SolverRequest) -> Result<BayesianExecuteRequest> {
    let parsed: BayesianExecuteRequest = serde_json::from_value(request.request.clone())
        .map_err(|error| serialization_error("invalid Bayesian-network execute request", error))?;
    if parsed.schema_version != request.schema_version {
        return Err(PraxisError::Version(format!(
            "Bayesian-network request schema version '{}' does not match solver protocol version '{}'",
            parsed.schema_version, request.schema_version
        )));
    }
    if parsed.method_type != BAYESIAN_NETWORK_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "Bayesian-network adapter cannot execute method '{}'",
            parsed.method_type
        )));
    }
    if parsed.requested_by.trim().is_empty() {
        return Err(PraxisError::Serialization(
            "Bayesian-network execute request requires requestedBy".to_string(),
        ));
    }
    Ok(parsed)
}

fn find_snapshot(
    request: &SolverRequest,
    model_id: &str,
    expected_revision: Option<u64>,
) -> Result<BayesianSnapshot> {
    let snapshot = request
        .model_snapshots
        .iter()
        .find(|snapshot| {
            snapshot.get("methodType").and_then(Value::as_str) == Some(BAYESIAN_NETWORK_METHOD)
                && snapshot.get("id").and_then(Value::as_str) == Some(model_id)
        })
        .ok_or_else(|| {
            PraxisError::Logic(format!(
                "Bayesian-network model snapshot '{}' is missing",
                model_id
            ))
        })?;
    let snapshot: BayesianSnapshot = serde_json::from_value(snapshot.clone())
        .map_err(|error| serialization_error("invalid Bayesian-network model snapshot", error))?;
    if snapshot.method_type != BAYESIAN_NETWORK_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "Bayesian-network snapshot uses method '{}'",
            snapshot.method_type
        )));
    }
    if let Some(expected_revision) = expected_revision {
        if snapshot.revision != expected_revision {
            return Err(PraxisError::Version(format!(
                "Bayesian-network snapshot revision {} does not match requested revision {}",
                snapshot.revision, expected_revision
            )));
        }
    }
    Ok(snapshot)
}

fn build_network(snapshot: BayesianSnapshot) -> Result<(String, u64, CanonicalBayesianNetwork)> {
    let mut node_states = HashMap::with_capacity(snapshot.nodes.len());
    for node in &snapshot.nodes {
        let states: Vec<String> = node.states.iter().map(|state| state.id.clone()).collect();
        if states.len() < 2 || states.iter().collect::<HashSet<_>>().len() != states.len() {
            return Err(PraxisError::Bayesian(format!(
                "Bayesian node '{}' must define at least two unique states",
                node.id
            )));
        }
        if node_states.insert(node.id.clone(), states).is_some() {
            return Err(PraxisError::Bayesian(format!(
                "Bayesian snapshot contains duplicate node '{}'",
                node.id
            )));
        }
    }

    let mut tables = HashMap::with_capacity(snapshot.conditional_probability_tables.len());
    for table in snapshot.conditional_probability_tables {
        let table_node_id = table.node_id.clone();
        if tables.insert(table_node_id.clone(), table).is_some() {
            return Err(PraxisError::Bayesian(format!(
                "Bayesian snapshot contains duplicate CPT for node '{table_node_id}'"
            )));
        }
    }

    let mut variables = Vec::with_capacity(snapshot.nodes.len());
    for node in &snapshot.nodes {
        let mut table = tables.remove(&node.id).ok_or_else(|| {
            PraxisError::Bayesian(format!("Bayesian node '{}' has no CPT", node.id))
        })?;
        table.parents.sort_by_key(|parent| parent.order);
        if table
            .parents
            .iter()
            .enumerate()
            .any(|(index, parent)| parent.order != index)
        {
            return Err(PraxisError::Bayesian(format!(
                "Bayesian node '{}' has non-contiguous CPT parent order",
                node.id
            )));
        }

        let parent_ids: Vec<String> = table
            .parents
            .iter()
            .map(|parent| parent.node_id.clone())
            .collect();
        let mut rows_by_index: Vec<Option<BayesianCptRow>> =
            (0..table.rows.len()).map(|_| None).collect();
        for row in table.rows {
            let selections: HashMap<&str, &str> = row
                .parent_states
                .iter()
                .map(|selection| {
                    (
                        selection.parent_node_id.as_str(),
                        selection.state_id.as_str(),
                    )
                })
                .collect();
            if selections.len() != parent_ids.len() {
                return Err(PraxisError::Bayesian(format!(
                    "CPT row '{}' does not select every parent of node '{}'",
                    row.id, node.id
                )));
            }
            let mut row_index = 0usize;
            for parent_id in &parent_ids {
                let states = node_states.get(parent_id).ok_or_else(|| {
                    PraxisError::Bayesian(format!(
                        "CPT for node '{}' references missing parent '{parent_id}'",
                        node.id
                    ))
                })?;
                let selected = selections.get(parent_id.as_str()).ok_or_else(|| {
                    PraxisError::Bayesian(format!(
                        "CPT row '{}' omits parent '{parent_id}'",
                        row.id
                    ))
                })?;
                let state_index = states
                    .iter()
                    .position(|state| state == selected)
                    .ok_or_else(|| {
                        PraxisError::Bayesian(format!(
                            "CPT row '{}' selects unknown state '{}' for parent '{parent_id}'",
                            row.id, selected
                        ))
                    })?;
                row_index = row_index
                    .checked_mul(states.len())
                    .and_then(|value| value.checked_add(state_index))
                    .ok_or_else(|| PraxisError::Bayesian("CPT row index overflow".to_string()))?;
            }
            let slot = rows_by_index.get_mut(row_index).ok_or_else(|| {
                PraxisError::Bayesian(format!(
                    "CPT row '{}' has an out-of-range parent combination",
                    row.id
                ))
            })?;
            if slot.replace(row).is_some() {
                return Err(PraxisError::Bayesian(format!(
                    "CPT for node '{}' repeats a parent-state combination",
                    node.id
                )));
            }
        }

        let states = node_states
            .get(&node.id)
            .expect("node state map was built from the same node list");
        let mut probabilities = Vec::with_capacity(rows_by_index.len() * states.len());
        for row in rows_by_index {
            let row = row.ok_or_else(|| {
                PraxisError::Bayesian(format!(
                    "CPT for node '{}' omits a parent-state combination",
                    node.id
                ))
            })?;
            let values: HashMap<&str, f64> = row
                .values
                .iter()
                .map(|value| (value.state_id.as_str(), value.probability))
                .collect();
            if values.len() != states.len() {
                return Err(PraxisError::Bayesian(format!(
                    "CPT row '{}' does not assign every state of node '{}'",
                    row.id, node.id
                )));
            }
            for state in states {
                probabilities.push(*values.get(state.as_str()).ok_or_else(|| {
                    PraxisError::Bayesian(format!(
                        "CPT row '{}' omits state '{state}' of node '{}'",
                        row.id, node.id
                    ))
                })?);
            }
        }

        variables.push(CanonicalBayesianVariable {
            name: node.id.clone(),
            states: states.clone(),
            parents: parent_ids,
            probabilities,
        });
    }
    if !tables.is_empty() {
        return Err(PraxisError::Bayesian(
            "Bayesian snapshot contains a CPT for an unknown node".to_string(),
        ));
    }

    Ok((
        snapshot.id.clone(),
        snapshot.revision,
        CanonicalBayesianNetwork {
            id: Some(snapshot.id),
            variables,
        },
    ))
}

pub(crate) fn build_network_for_model(
    request: &SolverRequest,
    model_id: &str,
) -> Result<(CanonicalBayesianNetwork, u64)> {
    let snapshot = find_snapshot(request, model_id, None)?;
    let (_model_id, revision, network) = build_network(snapshot)?;
    Ok((network, revision))
}

fn build_adapter(request: &SolverRequest) -> Result<BayesianAdapter> {
    let execute = parse_request(request)?;
    let snapshot = find_snapshot(request, &execute.model_id, Some(execute.revision))?;
    let (model_id, model_revision, network) = build_network(snapshot)?;
    let evidence = execute
        .query
        .evidence
        .observations
        .into_iter()
        .map(|observation| HclEvidenceSpec {
            node: observation.node_id,
            state: observation.state_id,
        })
        .collect();
    Ok(BayesianAdapter {
        model_id,
        model_revision,
        network,
        evidence,
        query_node_ids: execute.query.query_node_ids,
    })
}

pub(crate) fn validate(request: &SolverRequest) -> Result<Value> {
    let adapter = build_adapter(request)?;
    adapter.network.clone().into_graph()?;
    Ok(json!({
        "scope": BAYESIAN_NETWORK_METHOD,
        "valid": true,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "nodeCount": adapter.network.variables.len()
    }))
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let adapter = build_adapter(request)?;
    let marginals =
        query_bayesian_network(adapter.network, &adapter.evidence, &adapter.query_node_ids)?;
    let marginals: Vec<Value> = marginals
        .into_iter()
        .map(|marginal| {
            json!({
                "nodeId": marginal.node,
                "values": marginal.values.into_iter().map(|value| json!({
                    "stateId": value.state,
                    "probability": value.probability
                })).collect::<Vec<_>>()
            })
        })
        .collect();
    let evidence: Vec<Value> = adapter
        .evidence
        .into_iter()
        .map(|observation| json!({ "nodeId": observation.node, "stateId": observation.state }))
        .collect();

    Ok(json!({
        "methodType": BAYESIAN_NETWORK_METHOD,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "evidence": { "observations": evidence },
        "marginals": marginals,
        "validationIssues": []
    }))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::execute;
    use crate::transport::SolverRequest;

    fn request(evidence: serde_json::Value) -> SolverRequest {
        let model_id = "00000000-0000-4000-8000-000000000101";
        let node_a = "00000000-0000-4000-8000-000000000102";
        let node_b = "00000000-0000-4000-8000-000000000103";
        let a_false = "00000000-0000-4000-8000-000000000104";
        let a_true = "00000000-0000-4000-8000-000000000105";
        let b_false = "00000000-0000-4000-8000-000000000106";
        let b_true = "00000000-0000-4000-8000-000000000107";
        SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": {
                    "schemaVersion": "1.0.0",
                    "methodType": "BAYESIAN_NETWORK",
                    "modelId": model_id,
                    "revision": 3,
                    "requestedBy": "analyst",
                    "query": {
                        "evidence": { "observations": evidence },
                        "queryNodeIds": [node_a, node_b]
                    }
                },
                "modelSnapshots": [{
                    "id": model_id,
                    "methodType": "BAYESIAN_NETWORK",
                    "revision": 3,
                    "nodes": [
                        { "id": node_a, "states": [{ "id": a_false }, { "id": a_true }] },
                        { "id": node_b, "states": [{ "id": b_false }, { "id": b_true }] }
                    ],
                    "conditionalProbabilityTables": [
                        {
                            "nodeId": node_a,
                            "parents": [],
                            "rows": [{
                                "id": "row-a",
                                "parentStates": [],
                                "values": [
                                    { "stateId": a_false, "probability": 0.6 },
                                    { "stateId": a_true, "probability": 0.4 }
                                ]
                            }]
                        },
                        {
                            "nodeId": node_b,
                            "parents": [{ "nodeId": node_a, "order": 0 }],
                            "rows": [
                                {
                                    "id": "row-b-false",
                                    "parentStates": [{ "parentNodeId": node_a, "stateId": a_false }],
                                    "values": [
                                        { "stateId": b_false, "probability": 0.7 },
                                        { "stateId": b_true, "probability": 0.3 }
                                    ]
                                },
                                {
                                    "id": "row-b-true",
                                    "parentStates": [{ "parentNodeId": node_a, "stateId": a_true }],
                                    "values": [
                                        { "stateId": b_false, "probability": 0.2 },
                                        { "stateId": b_true, "probability": 0.8 }
                                    ]
                                }
                            ]
                        }
                    ]
                }]
            })
            .to_string(),
        )
        .unwrap()
    }

    #[test]
    fn returns_exact_prior_marginals() {
        let result = execute(&request(json!([]))).unwrap();
        assert!(
            (result["marginals"][0]["values"][0]["probability"]
                .as_f64()
                .unwrap()
                - 0.6)
                .abs()
                < 1e-12
        );
        assert!(
            (result["marginals"][1]["values"][1]["probability"]
                .as_f64()
                .unwrap()
                - 0.5)
                .abs()
                < 1e-12
        );
    }

    #[test]
    fn returns_exact_posteriors_under_evidence() {
        let node_b = "00000000-0000-4000-8000-000000000103";
        let b_true = "00000000-0000-4000-8000-000000000107";
        let result = execute(&request(json!([{ "nodeId": node_b, "stateId": b_true }]))).unwrap();
        assert!(
            (result["marginals"][0]["values"][0]["probability"]
                .as_f64()
                .unwrap()
                - 0.36)
                .abs()
                < 1e-12
        );
        assert!(
            (result["marginals"][0]["values"][1]["probability"]
                .as_f64()
                .unwrap()
                - 0.64)
                .abs()
                < 1e-12
        );
    }
}
