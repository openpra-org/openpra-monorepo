use std::collections::HashSet;

use praxis::analysis::event_tree_quantification::EventTreeHclContext;
use praxis::hcl::{quantify_hcl, HclBindingSpec, HclEvidenceSpec, HclModel, HclSettings};
use praxis::{PraxisError, Result};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::bayesian_network::build_network_for_model;
use crate::fault_tree::build_fault_tree_for_model;
use crate::transport::SolverRequest;

const HCL_METHOD: &str = "HYBRID_CAUSAL_LOGIC";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclExecuteRequest {
    schema_version: String,
    method_type: String,
    model_id: String,
    revision: u64,
    requested_by: String,
    fault_tree_top_gate: EntityReference,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EntityReference {
    model_id: String,
    entity_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HclSnapshot {
    id: String,
    method_type: String,
    revision: u64,
    bayesian_network: ModelReference,
    fault_trees: Vec<FaultTreeReferenceContainer>,
    bindings: Vec<HclBinding>,
    base_evidence: HclEvidence,
    solver_settings: HclSolverSettings,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ModelReference {
    model_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FaultTreeReferenceContainer {
    fault_tree: ModelReference,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclBinding {
    id: String,
    fault_tree_basic_event: EntityReference,
    bayesian_network_node: EntityReference,
    true_state_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct HclEvidence {
    observations: Vec<HclObservation>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclObservation {
    node_id: String,
    state_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclSolverSettings {
    variable_order: Option<Vec<String>>,
    fold_constants: bool,
    splice_null_gates: bool,
}

struct HclAdapter {
    model_id: String,
    model_revision: u64,
    fault_tree_top_gate: EntityReference,
    model: HclModel,
    settings: HclSettings,
}

fn serialization_error(context: &str, error: impl std::fmt::Display) -> PraxisError {
    PraxisError::Serialization(format!("{context}: {error}"))
}

fn parse_request(request: &SolverRequest) -> Result<HclExecuteRequest> {
    let parsed: HclExecuteRequest = serde_json::from_value(request.request.clone())
        .map_err(|error| serialization_error("invalid HCL execute request", error))?;
    if parsed.schema_version != request.schema_version {
        return Err(PraxisError::Version(format!(
            "HCL request schema version '{}' does not match solver protocol version '{}'",
            parsed.schema_version, request.schema_version
        )));
    }
    if parsed.method_type != HCL_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "HCL adapter cannot execute method '{}'",
            parsed.method_type
        )));
    }
    if parsed.requested_by.trim().is_empty() {
        return Err(PraxisError::Serialization(
            "HCL execute request requires requestedBy".to_string(),
        ));
    }
    Ok(parsed)
}

fn find_snapshot(request: &SolverRequest, execute: &HclExecuteRequest) -> Result<HclSnapshot> {
    find_snapshot_for_model(request, &execute.model_id, Some(execute.revision))
}

fn find_snapshot_for_model(
    request: &SolverRequest,
    model_id: &str,
    expected_revision: Option<u64>,
) -> Result<HclSnapshot> {
    let snapshot = request
        .model_snapshots
        .iter()
        .find(|snapshot| {
            snapshot.get("methodType").and_then(Value::as_str) == Some(HCL_METHOD)
                && snapshot.get("id").and_then(Value::as_str) == Some(model_id)
        })
        .ok_or_else(|| {
            PraxisError::Logic(format!(
                "HCL configuration snapshot '{}' is missing",
                model_id
            ))
        })?;
    let snapshot: HclSnapshot = serde_json::from_value(snapshot.clone())
        .map_err(|error| serialization_error("invalid HCL configuration snapshot", error))?;
    if snapshot.method_type != HCL_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "HCL snapshot uses method '{}'",
            snapshot.method_type
        )));
    }
    if let Some(expected_revision) = expected_revision {
        if snapshot.revision != expected_revision {
            return Err(PraxisError::Version(format!(
                "HCL snapshot revision {} does not match requested revision {}",
                snapshot.revision, expected_revision
            )));
        }
    }
    Ok(snapshot)
}

pub(crate) fn build_event_tree_context(
    request: &SolverRequest,
    configuration_id: &str,
    linked_fault_tree_ids: &HashSet<String>,
) -> Result<EventTreeHclContext> {
    let snapshot = find_snapshot_for_model(request, configuration_id, None)?;
    let declared_fault_tree_ids: HashSet<&str> = snapshot
        .fault_trees
        .iter()
        .map(|reference| reference.fault_tree.model_id.as_str())
        .collect();
    if let Some(undeclared) = linked_fault_tree_ids
        .iter()
        .find(|model_id| !declared_fault_tree_ids.contains(model_id.as_str()))
    {
        return Err(PraxisError::Hcl(format!(
            "event tree links fault tree '{undeclared}' that is not declared by HCL configuration '{}'",
            snapshot.id
        )));
    }

    let (network, _network_revision) =
        build_network_for_model(request, &snapshot.bayesian_network.model_id)?;
    let graph = network.into_graph()?;
    let mut bindings = Vec::new();
    for binding in snapshot.bindings {
        if !linked_fault_tree_ids.contains(&binding.fault_tree_basic_event.model_id) {
            continue;
        }
        if binding.bayesian_network_node.model_id != snapshot.bayesian_network.model_id {
            return Err(PraxisError::Hcl(format!(
                "binding '{}' references Bayesian model '{}' instead of '{}'",
                binding.id,
                binding.bayesian_network_node.model_id,
                snapshot.bayesian_network.model_id
            )));
        }
        bindings.push(HclBindingSpec {
            event: binding.fault_tree_basic_event.entity_id,
            node: binding.bayesian_network_node.entity_id,
            true_states: binding.true_state_ids,
        });
    }
    let base_evidence = snapshot
        .base_evidence
        .observations
        .into_iter()
        .map(|observation| HclEvidenceSpec {
            node: observation.node_id,
            state: observation.state_id,
        })
        .collect();
    Ok(EventTreeHclContext::new(graph)?
        .with_bindings(bindings)
        .with_base_evidence(base_evidence))
}

fn build_adapter(request: &SolverRequest) -> Result<HclAdapter> {
    let execute = parse_request(request)?;
    let snapshot = find_snapshot(request, &execute)?;
    if !snapshot
        .fault_trees
        .iter()
        .any(|reference| reference.fault_tree.model_id == execute.fault_tree_top_gate.model_id)
    {
        return Err(PraxisError::Hcl(format!(
            "fault tree '{}' is not declared by HCL configuration '{}'",
            execute.fault_tree_top_gate.model_id, snapshot.id
        )));
    }

    let fault_tree = build_fault_tree_for_model(request, &execute.fault_tree_top_gate.model_id)?;
    if fault_tree.top_gate_id != execute.fault_tree_top_gate.entity_id {
        return Err(PraxisError::Hcl(format!(
            "fault-tree top gate '{}' does not match requested gate '{}'",
            fault_tree.top_gate_id, execute.fault_tree_top_gate.entity_id
        )));
    }
    let (network, _network_revision) =
        build_network_for_model(request, &snapshot.bayesian_network.model_id)?;
    let graph = network.into_graph()?;

    let mut bindings = Vec::new();
    for binding in snapshot.bindings {
        if binding.fault_tree_basic_event.model_id != execute.fault_tree_top_gate.model_id {
            continue;
        }
        if binding.bayesian_network_node.model_id != snapshot.bayesian_network.model_id {
            return Err(PraxisError::Hcl(format!(
                "binding '{}' references Bayesian model '{}' instead of '{}'",
                binding.id,
                binding.bayesian_network_node.model_id,
                snapshot.bayesian_network.model_id
            )));
        }
        bindings.push(HclBindingSpec {
            event: binding.fault_tree_basic_event.entity_id,
            node: binding.bayesian_network_node.entity_id,
            true_states: binding.true_state_ids,
        });
    }
    let base_evidence = snapshot
        .base_evidence
        .observations
        .into_iter()
        .map(|observation| HclEvidenceSpec {
            node: observation.node_id,
            state: observation.state_id,
        })
        .collect();
    let model = HclModel::new(fault_tree.fault_tree, graph)?
        .with_bindings(bindings)
        .with_base_evidence(base_evidence);
    let settings = HclSettings {
        variable_order: snapshot.solver_settings.variable_order,
        fold_constants: snapshot.solver_settings.fold_constants,
        splice_null_gates: snapshot.solver_settings.splice_null_gates,
    };

    Ok(HclAdapter {
        model_id: snapshot.id,
        model_revision: snapshot.revision,
        fault_tree_top_gate: execute.fault_tree_top_gate,
        model,
        settings,
    })
}

pub(crate) fn validate(request: &SolverRequest) -> Result<Value> {
    let adapter = build_adapter(request)?;
    let result = quantify_hcl(&adapter.model, &adapter.settings)?;
    Ok(json!({
        "scope": HCL_METHOD,
        "valid": true,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "bddVariables": result.bdd_variables
    }))
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let adapter = build_adapter(request)?;
    let result = quantify_hcl(&adapter.model, &adapter.settings)?;
    Ok(json!({
        "methodType": HCL_METHOD,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "faultTreeTopGate": {
            "modelId": adapter.fault_tree_top_gate.model_id,
            "entityId": adapter.fault_tree_top_gate.entity_id
        },
        "probability": result.probability,
        "bddNodes": result.bdd_nodes,
        "bddVariables": result.bdd_variables,
        "variableOrder": result.variable_order,
        "bridge": {
            "quantifications": result.bridge.quantifications,
            "bddContextCacheHits": result.bridge.bdd_context_cache_hits,
            "bddContextCacheMisses": result.bridge.bdd_context_cache_misses,
            "bnQueryCacheHits": result.bridge.bn_query_cache_hits,
            "bnQueryCacheMisses": result.bridge.bn_query_cache_misses
        },
        "junctionTree": {
            "numCliques": result.junction_tree.num_cliques,
            "maxCliqueSize": result.junction_tree.max_clique_size,
            "treewidth": result.junction_tree.treewidth,
            "totalTableEntries": result.junction_tree.total_table_entries
        },
        "validationIssues": []
    }))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::execute;
    use crate::transport::SolverRequest;

    #[test]
    fn preserves_bn_correlation_for_a_linked_fault_tree() {
        let hcl_id = "00000000-0000-4000-8000-000000000201";
        let ft_id = "00000000-0000-4000-8000-000000000202";
        let bn_id = "00000000-0000-4000-8000-000000000203";
        let top = "00000000-0000-4000-8000-000000000204";
        let node_a = "00000000-0000-4000-8000-000000000205";
        let node_b = "00000000-0000-4000-8000-000000000206";
        let a_false = "00000000-0000-4000-8000-000000000207";
        let a_true = "00000000-0000-4000-8000-000000000208";
        let b_false = "00000000-0000-4000-8000-000000000209";
        let b_true = "00000000-0000-4000-8000-000000000210";
        let request = SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": {
                    "schemaVersion": "1.0.0",
                    "methodType": "HYBRID_CAUSAL_LOGIC",
                    "modelId": hcl_id,
                    "revision": 4,
                    "requestedBy": "analyst",
                    "faultTreeTopGate": { "modelId": ft_id, "entityId": top }
                },
                "modelSnapshots": [
                    {
                        "id": ft_id,
                        "projectId": "project-1",
                        "methodType": "FAULT_TREE",
                        "revision": 2,
                        "topGate": { "gateId": top },
                        "gates": [{ "id": top, "gateType": "AND" }],
                        "leafNodes": [
                            { "id": "ref-a", "kind": "BASIC_EVENT_REFERENCE", "basicEventId": "A" },
                            { "id": "ref-b", "kind": "BASIC_EVENT_REFERENCE", "basicEventId": "B" }
                        ],
                        "gateInputs": [
                            { "id": "input-a", "gateId": top, "childId": "ref-a", "order": 0 },
                            { "id": "input-b", "gateId": top, "childId": "ref-b", "order": 1 }
                        ]
                    },
                    {
                        "id": bn_id,
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
                                        { "stateId": a_false, "probability": 0.8 },
                                        { "stateId": a_true, "probability": 0.2 }
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
                                            { "stateId": b_false, "probability": 0.9 },
                                            { "stateId": b_true, "probability": 0.1 }
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
                    },
                    {
                        "id": hcl_id,
                        "methodType": "HYBRID_CAUSAL_LOGIC",
                        "revision": 4,
                        "bayesianNetwork": { "modelId": bn_id },
                        "faultTrees": [{ "faultTree": { "modelId": ft_id } }],
                        "bindings": [
                            {
                                "id": "binding-a",
                                "faultTreeBasicEvent": { "modelId": ft_id, "entityId": "A" },
                                "bayesianNetworkNode": { "modelId": bn_id, "entityId": node_a },
                                "trueStateIds": [a_true]
                            },
                            {
                                "id": "binding-b",
                                "faultTreeBasicEvent": { "modelId": ft_id, "entityId": "B" },
                                "bayesianNetworkNode": { "modelId": bn_id, "entityId": node_b },
                                "trueStateIds": [b_true]
                            }
                        ],
                        "baseEvidence": { "observations": [] },
                        "solverSettings": {
                            "variableOrder": ["A", "B"],
                            "foldConstants": false,
                            "spliceNullGates": false
                        }
                    }
                ],
                "resources": {
                    "faultTreeBasicEventCatalogue": {
                        "projectId": "project-1",
                        "basicEvents": [
                            { "id": "A", "probability": { "value": 0.2 } },
                            { "id": "B", "probability": { "value": 0.24 } }
                        ]
                    }
                }
            })
            .to_string(),
        )
        .unwrap();

        let result = execute(&request).unwrap();
        assert!((result["probability"].as_f64().unwrap() - 0.16).abs() < 1e-12);
        assert_eq!(result["variableOrder"], json!(["A", "B"]));
        assert_eq!(result["faultTreeTopGate"]["entityId"], top);
    }
}
