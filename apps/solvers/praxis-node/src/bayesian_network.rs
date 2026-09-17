use std::collections::{HashMap, HashSet};

use praxis::hcl::{
    query_bayesian_network_batch, BayesianMarginal, CanonicalBayesianNetwork,
    CanonicalBayesianVariable, HclEvidenceSpec,
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
#[serde(untagged)]
enum BayesianQuery {
    Single(BayesianSingleQuery),
    Batch(BayesianBatchQuery),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BayesianSingleQuery {
    evidence: BayesianEvidence,
    query_node_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BayesianBatchQuery {
    scenarios: Vec<BayesianScenario>,
    query_node_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct BayesianScenario {
    id: String,
    code: String,
    name: String,
    evidence: BayesianEvidence,
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
    // Canonical source inputs have only CPT parents. Workbook snapshots also
    // carry visual edges; when present, they must describe the same graph.
    #[serde(default, deserialize_with = "deserialize_edges")]
    edges: Option<Vec<BayesianEdge>>,
    conditional_probability_tables: Vec<BayesianCpt>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BayesianEdge {
    parent_node_id: String,
    child_node_id: String,
}

fn deserialize_edges<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<Vec<BayesianEdge>>, D::Error> {
    Vec::deserialize(deserializer).map(Some)
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
    query: BayesianQuery,
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

pub(crate) type CptRowIndexMap = HashMap<(String, String), usize>;

fn build_network(
    snapshot: BayesianSnapshot,
) -> Result<(String, u64, CanonicalBayesianNetwork, CptRowIndexMap)> {
    let mut node_states = HashMap::with_capacity(snapshot.nodes.len());
    for node in &snapshot.nodes {
        let states: Vec<String> = node.states.iter().map(|state| state.id.clone()).collect();
        if states.is_empty() || states.iter().collect::<HashSet<_>>().len() != states.len() {
            return Err(PraxisError::Bayesian(format!(
                "Bayesian node '{}' must define at least one unique state",
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

    if let Some(edges) = &snapshot.edges {
        let mut edge_pairs = HashSet::with_capacity(edges.len());
        for edge in edges {
            if !node_states.contains_key(&edge.parent_node_id)
                || !node_states.contains_key(&edge.child_node_id)
            {
                return Err(PraxisError::Bayesian(format!(
                    "Bayesian edge '{}' -> '{}' references an unknown node",
                    edge.parent_node_id, edge.child_node_id
                )));
            }
            if !edge_pairs.insert((&edge.parent_node_id, &edge.child_node_id)) {
                return Err(PraxisError::Bayesian(format!(
                    "Bayesian snapshot contains duplicate edge '{}' -> '{}'",
                    edge.parent_node_id, edge.child_node_id
                )));
            }
        }
        let parent_pairs: HashSet<_> = snapshot
            .conditional_probability_tables
            .iter()
            .flat_map(|table| {
                table
                    .parents
                    .iter()
                    .map(|parent| (&parent.node_id, &table.node_id))
            })
            .collect();
        if edge_pairs != parent_pairs {
            return Err(PraxisError::Bayesian(
                "Bayesian edges must match CPT parents exactly".to_string(),
            ));
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
    let mut cpt_row_indices = HashMap::new();
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
            let row_id = row.id.clone();
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
            if cpt_row_indices
                .insert((node.id.clone(), row_id), row_index)
                .is_some()
            {
                return Err(PraxisError::Bayesian(format!(
                    "CPT for node '{}' contains a duplicate row id",
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
        cpt_row_indices,
    ))
}

pub(crate) fn build_network_for_model_with_cpt_rows(
    request: &SolverRequest,
    model_id: &str,
) -> Result<(CanonicalBayesianNetwork, u64, CptRowIndexMap)> {
    let snapshot = find_snapshot(request, model_id, None)?;
    let (_model_id, revision, network, cpt_row_indices) = build_network(snapshot)?;
    Ok((network, revision, cpt_row_indices))
}

fn build_adapter(request: &SolverRequest) -> Result<BayesianAdapter> {
    let execute = parse_request(request)?;
    let snapshot = find_snapshot(request, &execute.model_id, Some(execute.revision))?;
    let (model_id, model_revision, network, _cpt_row_indices) = build_network(snapshot)?;
    if let BayesianQuery::Batch(batch) = &execute.query {
        let mut ids = HashSet::new();
        if batch.scenarios.is_empty() {
            return Err(PraxisError::Serialization(
                "a Bayesian batch requires scenarios".to_string(),
            ));
        }
        for scenario in &batch.scenarios {
            if scenario.id.trim().is_empty()
                || scenario.code.trim().is_empty()
                || scenario.name.trim().is_empty()
                || !ids.insert(&scenario.id)
            {
                return Err(PraxisError::Serialization(
                    "Bayesian scenarios require unique ids and nonempty labels".to_string(),
                ));
            }
        }
    }
    Ok(BayesianAdapter {
        model_id,
        model_revision,
        network,
        query: execute.query,
    })
}

fn observations(evidence: &BayesianEvidence) -> Vec<HclEvidenceSpec> {
    evidence
        .observations
        .iter()
        .map(|observation| HclEvidenceSpec {
            node: observation.node_id.clone(),
            state: observation.state_id.clone(),
        })
        .collect()
}

fn query_result(evidence: &[HclEvidenceSpec], marginals: Vec<BayesianMarginal>) -> Value {
    json!({
        "evidence": { "observations": evidence.iter().map(|observation|
            json!({ "nodeId": observation.node, "stateId": observation.state })
        ).collect::<Vec<_>>() },
        "marginals": marginals.into_iter().map(|marginal| json!({
            "nodeId": marginal.node,
            "values": marginal.values.into_iter().map(|value| json!({
                "stateId": value.state, "probability": value.probability
            })).collect::<Vec<_>>()
        })).collect::<Vec<_>>(),
        "validationIssues": []
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

pub(crate) fn preflight(request: &SolverRequest, executing: bool) -> Result<Value> {
    if !executing {
        return Ok(crate::resource_preflight::no_clique());
    }
    let adapter = build_adapter(request)?;
    let batch_size = match &adapter.query {
        BayesianQuery::Single(_) => 1,
        BayesianQuery::Batch(query) => query.scenarios.len(),
    };
    crate::resource_preflight::network(adapter.network.into_graph()?, batch_size)
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let adapter = build_adapter(request)?;
    let (scenarios, query_nodes) = match &adapter.query {
        BayesianQuery::Single(query) => {
            (vec![observations(&query.evidence)], &query.query_node_ids)
        }
        BayesianQuery::Batch(query) => (
            query
                .scenarios
                .iter()
                .map(|scenario| observations(&scenario.evidence))
                .collect(),
            &query.query_node_ids,
        ),
    };
    let scenario_count = scenarios.len();
    let batch = query_bayesian_network_batch(adapter.network, &scenarios, query_nodes)?;
    let mut result = match adapter.query {
        BayesianQuery::Single(_) => {
            query_result(&scenarios[0], batch.scenarios.into_iter().next().unwrap()?)
        }
        BayesianQuery::Batch(query) => json!({
            "queryNodeIds": query.query_node_ids,
            "scenarios": query.scenarios.into_iter().zip(scenarios).zip(batch.scenarios)
                .map(|((scenario, evidence), outcome)| {
                    let (status, failure, result) = match outcome {
                        Ok(marginals) => ("SUCCEEDED", None, query_result(&evidence, marginals)),
                        Err(error) => ("FAILED", Some(error.to_string()), Value::Null),
                    };
                    json!({
                        "scenarioId": scenario.id, "scenarioCode": scenario.code, "scenarioName": scenario.name,
                        "status": status, "failure": failure, "result": result
                    })
                }).collect::<Vec<_>>(),
            "diagnostics": {
                "junctionTreeCompilations": batch.junction_tree_compilations,
                "scenarioEvaluations": scenario_count
            }
        }),
    };
    result["methodType"] = json!(BAYESIAN_NETWORK_METHOD);
    result["modelId"] = json!(adapter.model_id);
    result["modelRevision"] = json!(adapter.model_revision);
    Ok(result)
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
    fn batches_scenarios_once_with_metadata_and_per_row_errors() {
        let mut batch = request(json!([]));
        let evidence = json!([{ "nodeId": "00000000-0000-4000-8000-000000000103", "stateId": "00000000-0000-4000-8000-000000000107" }]);
        let expected = execute(&request(evidence.clone())).unwrap();
        batch.request["query"] = json!({
            "queryNodeIds": batch.request["query"]["queryNodeIds"],
            "scenarios": [
                { "id": "observed", "code": "OBS", "name": "Observed", "evidence": { "observations": evidence } },
                { "id": "invalid", "code": "BAD", "name": "Invalid", "evidence": { "observations": [{ "nodeId": "unknown", "stateId": "unknown" }] } },
                { "id": "prior", "code": "PRIOR", "name": "Prior", "evidence": { "observations": [] } }
            ]
        });
        let result = execute(&batch).unwrap();
        assert_eq!(result["diagnostics"]["junctionTreeCompilations"], 1);
        assert_eq!(result["diagnostics"]["scenarioEvaluations"], 3);
        assert_eq!(result["scenarios"][0]["scenarioId"], "observed");
        assert_eq!(
            result["scenarios"][0]["result"]["marginals"],
            expected["marginals"]
        );
        assert_eq!(
            result["scenarios"][0]["result"]["evidence"],
            expected["evidence"]
        );
        assert_eq!(result["scenarios"][1]["status"], "FAILED");
        assert!(result["scenarios"][1]["result"].is_null());
        assert_eq!(
            result["scenarios"][2]["result"]["marginals"],
            execute(&request(json!([]))).unwrap()["marginals"]
        );
        batch.request["query"]["scenarios"][1]["id"] = json!("observed");
        assert!(execute(&batch).is_err());
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
