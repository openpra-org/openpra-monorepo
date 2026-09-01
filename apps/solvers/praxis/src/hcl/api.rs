use std::collections::HashSet;
use std::time::Duration;

use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, EvidenceBatch, ExecutionEngine,
    StateIndex,
};

use crate::algorithms::build::{build_bdd, build_bdd_with_order, BuildOptions};
use crate::algorithms::pdag::PdagNode;
use crate::hcl::{
    HclBaseEvidence, HclBatchCompilationStats, HclBatchResult, HclBridgeStats, HclEventBinding,
    HclEventBindings, HclEvidenceSpec, HclHazardGridBatchResult, HclJunctionTreeStats, HclModel,
    HclQuantifier, HclResult, HclSettings,
};
use crate::{PraxisError, Result};

/// Quantifies one fault-tree top event using its HCL/BN bindings.
pub fn quantify_hcl(model: &HclModel, settings: &HclSettings) -> Result<HclResult> {
    let evidence_rows = [model.base_evidence().to_vec()];
    quantify_hcl_batch(model, &evidence_rows, settings)?
        .results
        .pop()
        .ok_or_else(|| PraxisError::Hcl("single HCL quantification returned no result".to_string()))
}

/// Quantifies multiple complete evidence rows while compiling the fault-tree
/// BDD and Bayesian junction tree exactly once.
pub fn quantify_hcl_batch(
    model: &HclModel,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    settings: &HclSettings,
) -> Result<HclBatchResult> {
    Ok(quantify_hcl_batch_internal(model, evidence_rows, None, settings)?.0)
}

/// Quantifies a hazard evidence grid and computes exact conditional grid weights
/// from the same compiled Bayesian junction tree.
pub fn quantify_hcl_hazard_grid_batch(
    model: &HclModel,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: &[Vec<HclEvidenceSpec>],
    settings: &HclSettings,
) -> Result<HclHazardGridBatchResult> {
    if evidence_rows.len() != hazard_assignment_rows.len() {
        return Err(PraxisError::Hcl(
            "HCL hazard grid requires one hazard assignment for every evidence row".to_string(),
        ));
    }
    let (quantification, raw_weights) =
        quantify_hcl_batch_internal(model, evidence_rows, Some(hazard_assignment_rows), settings)?;
    Ok(HclHazardGridBatchResult {
        quantification,
        raw_weights: raw_weights.expect("hazard rows must produce weights"),
    })
}

fn quantify_hcl_batch_internal(
    model: &HclModel,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: Option<&[Vec<HclEvidenceSpec>]>,
    settings: &HclSettings,
) -> Result<(HclBatchResult, Option<Vec<f64>>)> {
    if evidence_rows.is_empty() {
        return Err(PraxisError::Hcl(
            "HCL batch quantification requires at least one evidence row".to_string(),
        ));
    }
    model.network().validate()?;
    let build_options = BuildOptions {
        fold_constants: settings.fold_constants,
        splice_null_gates: settings.splice_null_gates,
        reorder: None,
        reorder_budget: Duration::from_secs(10),
    };
    let built = if let Some(order) = &settings.variable_order {
        build_bdd_with_order(model.fault_tree(), build_options, order)?
    } else {
        build_bdd(model.fault_tree(), build_options)?
    };

    let mut bindings = HclEventBindings::new();
    for spec in model.bindings() {
        let node = model.network().node_id(&spec.node)?;
        let variable = model.network().variable(node)?;
        let true_states = resolve_states(variable.states(), &spec.true_states, &spec.node)?;
        bindings.insert(HclEventBinding::for_event(
            &built,
            &spec.event,
            node,
            true_states,
        )?)?;
    }

    let tree = CompiledJunctionTree::compile(model.network().clone(), CompileHeuristic::MinFill)?;
    let tree_stats = tree.stats();
    let raw_weights = hazard_assignment_rows
        .map(|rows| conditional_evidence_probabilities(model, &tree, rows))
        .transpose()?;
    let first_evidence = build_base_evidence(model, &evidence_rows[0])?;
    let mut quantifier = HclQuantifier::new(&built.bdd, tree, bindings, first_evidence)?;
    let variable_order: Vec<String> = built
        .order
        .iter()
        .filter_map(|index| match built.pdag.get_node(*index) {
            Some(PdagNode::BasicEvent { id, .. }) => Some(id.clone()),
            _ => None,
        })
        .collect();
    let mut results = Vec::with_capacity(evidence_rows.len());
    for (index, evidence) in evidence_rows.iter().enumerate() {
        if index > 0 {
            quantifier.set_base_evidence(build_base_evidence(model, evidence)?)?;
        }
        let before = quantifier.stats();
        let probability = quantifier.quantify(built.root)?;
        let bridge = bridge_delta(quantifier.stats(), before);
        results.push(HclResult {
            probability,
            bdd_nodes: built.bdd.node_count(),
            bdd_variables: built.bdd.variable_count(),
            variable_order: variable_order.clone(),
            bridge,
            junction_tree: HclJunctionTreeStats {
                num_cliques: tree_stats.num_cliques,
                max_clique_size: tree_stats.max_clique_size,
                treewidth: tree_stats.treewidth,
                total_table_entries: tree_stats.total_table_entries,
            },
        });
    }

    Ok((
        HclBatchResult {
            results,
            compilation: HclBatchCompilationStats {
                bdd_compilations: 1,
                junction_tree_compilations: 1,
                scenario_evaluations: evidence_rows.len(),
            },
        },
        raw_weights,
    ))
}

pub(crate) fn conditional_evidence_probabilities(
    model: &HclModel,
    tree: &CompiledJunctionTree,
    assignment_rows: &[Vec<HclEvidenceSpec>],
) -> Result<Vec<f64>> {
    conditional_evidence_probabilities_for_network(
        model.network(),
        model.base_evidence(),
        tree,
        assignment_rows,
    )
}

pub(crate) fn conditional_evidence_probabilities_for_network(
    network: &BayesianGraph,
    base_evidence: &[HclEvidenceSpec],
    tree: &CompiledJunctionTree,
    assignment_rows: &[Vec<HclEvidenceSpec>],
) -> Result<Vec<f64>> {
    if assignment_rows.is_empty() {
        return Err(PraxisError::Hcl(
            "hazard grid requires at least one assignment row".to_string(),
        ));
    }
    let mut hazard_nodes: Option<HashSet<_>> = None;
    let mut resolved_rows = Vec::with_capacity(assignment_rows.len());
    for (row_index, assignments) in assignment_rows.iter().enumerate() {
        if assignments.is_empty() {
            return Err(PraxisError::Hcl(format!(
                "hazard assignment row {row_index} has no dimensions"
            )));
        }
        let mut row_nodes = HashSet::with_capacity(assignments.len());
        let mut resolved = Vec::with_capacity(assignments.len());
        for spec in assignments {
            let node = network.node_id(&spec.node)?;
            if !row_nodes.insert(node) {
                return Err(PraxisError::Hcl(format!(
                    "hazard assignment observes BN node '{}' more than once",
                    spec.node
                )));
            }
            let variable = network.variable(node)?;
            let state = variable
                .states()
                .iter()
                .position(|candidate| candidate == &spec.state)
                .ok_or_else(|| {
                    PraxisError::Hcl(format!(
                        "hazard assignment state '{}' does not exist on BN node '{}'",
                        spec.state, spec.node
                    ))
                })?;
            let state = i32::try_from(state).map_err(|_| {
                PraxisError::Hcl("hazard assignment state index exceeds i32".to_string())
            })?;
            resolved.push((node, state));
        }
        match &hazard_nodes {
            Some(expected) if expected != &row_nodes => {
                return Err(PraxisError::Hcl(format!(
                    "hazard assignment row {row_index} does not define the same dimensions as the first row"
                )));
            }
            None => hazard_nodes = Some(row_nodes),
            _ => {}
        }
        resolved_rows.push(resolved);
    }

    // Grid dimensions are variables being integrated, not conditioning
    // evidence. Remove every discovered dimension from the common evidence,
    // while retaining all non-grid observations as the conditioning context.
    let mut conditioning_evidence = build_evidence_for_network(network, base_evidence)?;
    let hazard_nodes = hazard_nodes.ok_or_else(|| {
        PraxisError::Hcl("hazard grid did not resolve any integration dimensions".to_string())
    })?;
    for node in hazard_nodes {
        conditioning_evidence.clear(node)?;
    }
    let mut engine = ExecutionEngine::new(tree.clone());
    let base_batch = EvidenceBatch::new(
        1,
        conditioning_evidence.states().len(),
        conditioning_evidence.states().to_vec(),
    )?;
    let base_probability = engine.evidence_probabilities(&base_batch)?[0];
    if base_probability <= 0.0 {
        return Err(PraxisError::Hcl(
            "common HCL evidence has zero probability".to_string(),
        ));
    }

    let mut combined_rows = Vec::with_capacity(resolved_rows.len());
    for assignments in resolved_rows {
        let mut states = conditioning_evidence.states().to_vec();
        for (node, state) in assignments {
            states[node.index()] = state;
        }
        combined_rows.push(states);
    }
    let combined = EvidenceBatch::from_rows(&combined_rows)?;
    let probabilities = engine.evidence_probabilities(&combined)?;
    Ok(probabilities
        .into_iter()
        .map(|probability| (probability / base_probability).clamp(0.0, 1.0))
        .collect())
}

fn build_evidence_for_network(
    network: &BayesianGraph,
    evidence: &[HclEvidenceSpec],
) -> Result<HclBaseEvidence> {
    let mut base_evidence = HclBaseEvidence::unobserved(network.num_variables());
    let mut observed_nodes = HashSet::new();
    for spec in evidence {
        let node = network.node_id(&spec.node)?;
        if !observed_nodes.insert(node) {
            return Err(PraxisError::Hcl(format!(
                "base evidence observes BN node '{}' more than once",
                spec.node
            )));
        }
        let variable = network.variable(node)?;
        let state = variable
            .states()
            .iter()
            .position(|candidate| candidate == &spec.state)
            .ok_or_else(|| {
                PraxisError::Hcl(format!(
                    "base evidence state '{}' does not exist on BN node '{}'",
                    spec.state, spec.node
                ))
            })?;
        base_evidence.observe(node, StateIndex::new(state))?;
    }
    Ok(base_evidence)
}

fn build_base_evidence(model: &HclModel, evidence: &[HclEvidenceSpec]) -> Result<HclBaseEvidence> {
    build_evidence_for_network(model.network(), evidence)
}

fn bridge_delta(after: HclBridgeStats, before: HclBridgeStats) -> HclBridgeStats {
    HclBridgeStats {
        quantifications: after.quantifications - before.quantifications,
        bdd_context_cache_hits: after.bdd_context_cache_hits - before.bdd_context_cache_hits,
        bdd_context_cache_misses: after.bdd_context_cache_misses - before.bdd_context_cache_misses,
        bn_query_cache_hits: after.bn_query_cache_hits - before.bn_query_cache_hits,
        bn_query_cache_misses: after.bn_query_cache_misses - before.bn_query_cache_misses,
    }
}

fn resolve_states(
    available: &[String],
    requested: &[String],
    node_name: &str,
) -> Result<Vec<StateIndex>> {
    if requested.is_empty() {
        return Err(PraxisError::Hcl(format!(
            "binding for BN node '{node_name}' has no true states"
        )));
    }
    requested
        .iter()
        .map(|state| {
            available
                .iter()
                .position(|candidate| candidate == state)
                .map(StateIndex::new)
                .ok_or_else(|| {
                    PraxisError::Hcl(format!(
                        "binding state '{state}' does not exist on BN node '{node_name}'"
                    ))
                })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{quantify_hcl, quantify_hcl_batch, quantify_hcl_hazard_grid_batch};
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::hcl::{
        CanonicalBayesianNetwork, CanonicalBayesianVariable, HclBindingSpec, HclEvidenceSpec,
        HclModel, HclSettings,
    };

    fn model(evidence: Vec<HclEvidenceSpec>) -> HclModel {
        let mut tree = FaultTree::new("FT", "TOP").unwrap();
        let mut top = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top.add_operand("A".to_string());
        tree.add_gate(top).unwrap();
        tree.add_basic_event(BasicEvent::new("A".to_string(), 0.2).unwrap())
            .unwrap();
        let network = CanonicalBayesianNetwork {
            id: Some("BN".to_string()),
            variables: vec![CanonicalBayesianVariable {
                name: "NODE-A".to_string(),
                states: vec!["FALSE".to_string(), "TRUE".to_string()],
                parents: vec![],
                probabilities: vec![0.8, 0.2],
            }],
        }
        .into_graph()
        .unwrap();
        HclModel::new(tree, network)
            .unwrap()
            .with_bindings(vec![HclBindingSpec {
                event: "A".to_string(),
                node: "NODE-A".to_string(),
                true_states: vec!["TRUE".to_string()],
            }])
            .with_base_evidence(evidence)
    }

    fn observed(state: &str) -> Vec<HclEvidenceSpec> {
        vec![HclEvidenceSpec {
            node: "NODE-A".to_string(),
            state: state.to_string(),
        }]
    }

    fn conditioned_hazard_model() -> HclModel {
        let mut tree = FaultTree::new("FT", "TOP").unwrap();
        let mut top = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top.add_operand("A".to_string());
        tree.add_gate(top).unwrap();
        tree.add_basic_event(BasicEvent::new("A".to_string(), 0.2).unwrap())
            .unwrap();
        let network = CanonicalBayesianNetwork {
            id: Some("CONDITIONED-BN".to_string()),
            variables: vec![
                CanonicalBayesianVariable {
                    name: "CONTEXT".to_string(),
                    states: vec!["BASE".to_string(), "CONDITIONED".to_string()],
                    parents: vec![],
                    probabilities: vec![0.5, 0.5],
                },
                CanonicalBayesianVariable {
                    name: "HAZARD".to_string(),
                    states: vec!["FALSE".to_string(), "TRUE".to_string()],
                    parents: vec!["CONTEXT".to_string()],
                    probabilities: vec![0.9, 0.1, 0.25, 0.75],
                },
            ],
        }
        .into_graph()
        .unwrap();
        HclModel::new(tree, network)
            .unwrap()
            .with_bindings(vec![HclBindingSpec {
                event: "A".to_string(),
                node: "HAZARD".to_string(),
                true_states: vec!["TRUE".to_string()],
            }])
            .with_base_evidence(vec![
                HclEvidenceSpec {
                    node: "CONTEXT".to_string(),
                    state: "CONDITIONED".to_string(),
                },
                HclEvidenceSpec {
                    node: "HAZARD".to_string(),
                    state: "FALSE".to_string(),
                },
            ])
    }

    #[test]
    fn batch_reuses_compilation_and_matches_independent_quantifications() {
        let rows = vec![observed("TRUE"), observed("FALSE")];
        let batch = quantify_hcl_batch(&model(Vec::new()), &rows, &HclSettings::default()).unwrap();
        let independent: Vec<f64> = rows
            .iter()
            .map(|evidence| {
                quantify_hcl(&model(evidence.clone()), &HclSettings::default())
                    .unwrap()
                    .probability
            })
            .collect();

        assert_eq!(batch.compilation.bdd_compilations, 1);
        assert_eq!(batch.compilation.junction_tree_compilations, 1);
        assert_eq!(batch.compilation.scenario_evaluations, 2);
        assert_eq!(
            batch
                .results
                .iter()
                .map(|result| result.probability)
                .collect::<Vec<_>>(),
            independent
        );
        assert_eq!(independent, vec![1.0, 0.0]);
        assert!(batch
            .results
            .iter()
            .all(|result| result.bridge.quantifications == 1));
    }

    #[test]
    fn hazard_grid_returns_exact_cell_weights_and_conditional_results() {
        let rows = vec![observed("TRUE"), observed("FALSE")];
        let weighted = quantify_hcl_hazard_grid_batch(
            &model(observed("FALSE")),
            &rows,
            &rows,
            &HclSettings::default(),
        )
        .unwrap();

        assert_eq!(weighted.quantification.compilation.bdd_compilations, 1);
        assert_eq!(
            weighted
                .quantification
                .compilation
                .junction_tree_compilations,
            1
        );
        assert_eq!(weighted.raw_weights.len(), 2);
        assert!((weighted.raw_weights[0] - 0.2).abs() < 1e-12);
        assert!((weighted.raw_weights[1] - 0.8).abs() < 1e-12);
        assert_eq!(weighted.quantification.results[0].probability, 1.0);
        assert_eq!(weighted.quantification.results[1].probability, 0.0);
    }

    #[test]
    fn hazard_grid_integrates_grid_dimensions_while_retaining_other_evidence() {
        let scenario_rows = vec![
            vec![
                HclEvidenceSpec {
                    node: "CONTEXT".to_string(),
                    state: "CONDITIONED".to_string(),
                },
                HclEvidenceSpec {
                    node: "HAZARD".to_string(),
                    state: "TRUE".to_string(),
                },
            ],
            vec![
                HclEvidenceSpec {
                    node: "CONTEXT".to_string(),
                    state: "CONDITIONED".to_string(),
                },
                HclEvidenceSpec {
                    node: "HAZARD".to_string(),
                    state: "FALSE".to_string(),
                },
            ],
        ];
        let hazard_rows = vec![
            vec![HclEvidenceSpec {
                node: "HAZARD".to_string(),
                state: "TRUE".to_string(),
            }],
            vec![HclEvidenceSpec {
                node: "HAZARD".to_string(),
                state: "FALSE".to_string(),
            }],
        ];
        let weighted = quantify_hcl_hazard_grid_batch(
            &conditioned_hazard_model(),
            &scenario_rows,
            &hazard_rows,
            &HclSettings::default(),
        )
        .unwrap();

        assert!((weighted.raw_weights[0] - 0.75).abs() < 1e-12);
        assert!((weighted.raw_weights[1] - 0.25).abs() < 1e-12);
        assert!((weighted.raw_weights.iter().sum::<f64>() - 1.0).abs() < 1e-12);
        assert_eq!(weighted.quantification.results[0].probability, 1.0);
        assert_eq!(weighted.quantification.results[1].probability, 0.0);
    }
}
