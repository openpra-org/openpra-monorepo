use std::collections::{HashMap, HashSet};
use std::time::Duration;

use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, EvidenceBatch, ExecutionEngine,
    StateIndex,
};

use crate::algorithms::build::{build_bdd, build_bdd_with_order, BuildOptions};
use crate::algorithms::noncoherent_mocus::NonCoherentMocus;
use crate::algorithms::pdag::PdagNode;
use crate::hcl::{
    evaluate_cut_sets, evaluate_importance, prepare_cut_sets, HclBaseEvidence,
    HclBatchCompilationStats, HclBatchResult, HclBridgeStats, HclEventBinding, HclEventBindings,
    HclEvidenceSpec, HclHazardGridBatchResult, HclJunctionTreeStats, HclModel, HclQuantifier,
    HclResult, HclSettings, HclUncertaintySummary, PreparedHclUncertainty,
};
use crate::quantitative::{prepare_hazard_weights, AnnualizationConvention, FrequencyUnit};
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
    let (quantification, raw_weights, uncertainty_raw_weights) =
        quantify_hcl_batch_internal(model, evidence_rows, Some(hazard_assignment_rows), settings)?;
    Ok(HclHazardGridBatchResult {
        quantification,
        raw_weights: raw_weights.expect("hazard rows must produce weights"),
        uncertainty_raw_weights,
    })
}

/// Propagates the correlated PRAXIS uncertainty population through hazard-grid
/// weighting and annualization. The Node boundary only serializes this result.
pub fn summarize_hcl_hazard_uncertainty(
    batch: &HclHazardGridBatchResult,
    frequency_scale_value: f64,
    frequency_scale_unit: FrequencyUnit,
    annualization: AnnualizationConvention,
    normalize_weights: bool,
) -> Result<Option<HclUncertaintySummary>> {
    let Some(raw_weights) = &batch.uncertainty_raw_weights else {
        return Ok(None);
    };
    let Some(first_result) = batch.quantification.results.first() else {
        return Ok(None);
    };
    let Some(first_samples) = &first_result.uncertainty_samples else {
        return Ok(None);
    };
    let seed = first_result
        .uncertainty
        .as_ref()
        .map(|summary| summary.seed)
        .ok_or_else(|| {
            PraxisError::Hcl("hazard uncertainty samples have no summary seed".to_string())
        })?;
    if raw_weights.len() != batch.quantification.results.len() {
        return Err(PraxisError::Hcl(
            "hazard uncertainty weight rows do not match scenario results".to_string(),
        ));
    }
    let mut integrated = Vec::with_capacity(first_samples.len());
    for sample_index in 0..first_samples.len() {
        let sample_raw_weights = raw_weights
            .iter()
            .map(|row| {
                row.get(sample_index).copied().ok_or_else(|| {
                    PraxisError::Hcl(
                        "hazard uncertainty weight population is incomplete".to_string(),
                    )
                })
            })
            .collect::<Result<Vec<_>>>()?;
        let weights = prepare_hazard_weights(
            &sample_raw_weights,
            frequency_scale_value,
            frequency_scale_unit,
            annualization,
            normalize_weights,
        )?;
        let mut total = 0.0;
        for (result, weight) in batch.quantification.results.iter().zip(weights.weights) {
            let samples = result.uncertainty_samples.as_ref().ok_or_else(|| {
                PraxisError::Hcl("hazard scenario omitted uncertainty samples".to_string())
            })?;
            let probability = samples.get(sample_index).copied().ok_or_else(|| {
                PraxisError::Hcl("hazard scenario uncertainty population is incomplete".to_string())
            })?;
            total += weight.annual_frequency * probability;
        }
        integrated.push(total);
    }
    Ok(Some(HclUncertaintySummary::from_samples(
        &integrated,
        seed,
    )?))
}

fn quantify_hcl_batch_internal(
    model: &HclModel,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: Option<&[Vec<HclEvidenceSpec>]>,
    settings: &HclSettings,
) -> Result<(HclBatchResult, Option<Vec<f64>>, Option<Vec<Vec<f64>>>)> {
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

    let mut mocus = NonCoherentMocus::new(&built.pdag, model.fault_tree())?;
    let structural_cut_sets = mocus.analyze_primes();
    let cut_set_templates = prepare_cut_sets(
        &built.pdag,
        &built.var_of,
        &structural_cut_sets,
        model.network(),
        model.bindings(),
    )?;

    let tree = CompiledJunctionTree::compile(model.network().clone(), CompileHeuristic::MinFill)?;
    let tree_stats = tree.stats();
    let raw_weights = hazard_assignment_rows
        .map(|rows| conditional_evidence_probabilities(model, &tree, rows))
        .transpose()?;
    let first_evidence = build_base_evidence(model, &evidence_rows[0])?;
    let mut quantifier = HclQuantifier::new(&built.bdd, tree, bindings.clone(), first_evidence)?;
    let variable_order: Vec<String> = built
        .order
        .iter()
        .filter_map(|index| match built.pdag.get_node(*index) {
            Some(PdagNode::BasicEvent { id, .. }) => Some(id.clone()),
            _ => None,
        })
        .collect();
    let event_by_variable: Vec<Option<String>> = (0..built.bdd.variable_count())
        .map(|variable| {
            built
                .order
                .get(variable)
                .and_then(|index| match built.pdag.get_node(*index) {
                    Some(PdagNode::BasicEvent { id, .. }) => Some(id.clone()),
                    _ => None,
                })
        })
        .collect();
    let binding_node_by_event: HashMap<String, String> = model
        .bindings()
        .iter()
        .map(|binding| (binding.event.clone(), binding.node.clone()))
        .collect();
    let uncertainty = settings
        .uncertainty
        .as_ref()
        .map(|uncertainty| PreparedHclUncertainty::new(model.network(), uncertainty))
        .transpose()?;
    let mut results = Vec::with_capacity(evidence_rows.len());
    for (index, evidence) in evidence_rows.iter().enumerate() {
        let resolved_evidence = build_base_evidence(model, evidence)?;
        if index > 0 {
            quantifier.set_base_evidence(resolved_evidence.clone())?;
        }
        let before = quantifier.stats();
        let probability = quantifier.quantify(built.root)?;
        let cut_sets = evaluate_cut_sets(&cut_set_templates, &mut quantifier, probability)?;
        let (uncertainty, uncertainty_samples) = uncertainty
            .as_ref()
            .map(|prepared| {
                let samples = prepared.quantify(
                    &built.bdd,
                    built.root,
                    bindings.clone(),
                    resolved_evidence,
                    &event_by_variable,
                )?;
                let summary = HclUncertaintySummary::from_samples(&samples, prepared.seed())?;
                Ok::<_, PraxisError>((Some(summary), Some(samples)))
            })
            .transpose()?
            .unwrap_or((None, None));
        let bridge = bridge_delta(quantifier.stats(), before);
        let importance = evaluate_importance(
            built.root,
            &event_by_variable,
            &binding_node_by_event,
            &mut quantifier,
            probability,
        )?;
        results.push(HclResult {
            probability,
            uncertainty,
            uncertainty_samples,
            cut_sets,
            importance,
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

    let uncertainty_raw_weights = match (&uncertainty, hazard_assignment_rows) {
        (Some(prepared), Some(rows)) => {
            Some(prepared.conditional_evidence_probabilities(model.base_evidence(), rows)?)
        }
        _ => None,
    };
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
        uncertainty_raw_weights,
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
    use super::{
        quantify_hcl, quantify_hcl_batch, quantify_hcl_hazard_grid_batch,
        summarize_hcl_hazard_uncertainty,
    };
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::hcl::{
        CanonicalBayesianNetwork, CanonicalBayesianVariable, HclBindingSpec,
        HclCptRowUncertaintySpec, HclEvidenceSpec, HclModel, HclSettings, HclUncertaintySettings,
    };
    use crate::quantitative::{AnnualizationConvention, FrequencyUnit};

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

    fn correlated_model() -> HclModel {
        let mut tree = FaultTree::new("CORRELATED-FT", "TOP").unwrap();
        let mut top = Gate::new("TOP".to_string(), Formula::And).unwrap();
        top.add_operand("A".to_string());
        top.add_operand("B".to_string());
        tree.add_gate(top).unwrap();
        tree.add_basic_event(BasicEvent::new("A".to_string(), 0.2).unwrap())
            .unwrap();
        tree.add_basic_event(BasicEvent::new("B".to_string(), 0.24).unwrap())
            .unwrap();

        let network = CanonicalBayesianNetwork {
            id: Some("CORRELATED-BN".to_string()),
            variables: vec![
                CanonicalBayesianVariable {
                    name: "NODE-A".to_string(),
                    states: vec!["A-FALSE".to_string(), "A-TRUE".to_string()],
                    parents: vec![],
                    probabilities: vec![0.8, 0.2],
                },
                CanonicalBayesianVariable {
                    name: "NODE-B".to_string(),
                    states: vec!["B-FALSE".to_string(), "B-TRUE".to_string()],
                    parents: vec!["NODE-A".to_string()],
                    probabilities: vec![0.9, 0.1, 0.2, 0.8],
                },
            ],
        }
        .into_graph()
        .unwrap();

        HclModel::new(tree, network).unwrap().with_bindings(vec![
            HclBindingSpec {
                event: "A".to_string(),
                node: "NODE-A".to_string(),
                true_states: vec!["A-TRUE".to_string()],
            },
            HclBindingSpec {
                event: "B".to_string(),
                node: "NODE-B".to_string(),
                true_states: vec!["B-TRUE".to_string()],
            },
        ])
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
    fn cut_sets_use_exact_hcl_joint_probability_and_causal_trace() {
        let result = quantify_hcl(&correlated_model(), &HclSettings::default()).unwrap();

        assert!((result.probability - 0.16).abs() < 1e-12);
        assert_eq!(result.cut_sets.total_count, 1);
        let cut_set = &result.cut_sets.cut_sets[0];
        assert_eq!(cut_set.rank, 1);
        assert_eq!(cut_set.order, 2);
        assert!((cut_set.probability - 0.16).abs() < 1e-12);
        assert_eq!(cut_set.coverage, Some(1.0));
        assert_eq!(
            cut_set
                .literals
                .iter()
                .map(|literal| literal.basic_event_id.as_str())
                .collect::<Vec<_>>(),
            vec!["A", "B"]
        );
        assert_eq!(cut_set.bn_ancestor_node_ids, vec!["NODE-A"]);
        assert_eq!(cut_set.bn_root_cause_node_ids, vec!["NODE-A"]);
        let b_trace = cut_set
            .literals
            .iter()
            .find(|literal| literal.basic_event_id == "B")
            .and_then(|literal| literal.binding.as_ref())
            .unwrap();
        assert_eq!(b_trace.bayesian_network_node_id, "NODE-B");
        assert_eq!(b_trace.state_ids, vec!["B-TRUE"]);
        assert_eq!(b_trace.parent_node_ids, vec!["NODE-A"]);

        assert_eq!(result.importance.total_count, 2);
        let a = result
            .importance
            .measures
            .iter()
            .find(|measure| measure.basic_event_id == "A")
            .unwrap();
        assert_eq!(a.bayesian_network_node_id.as_deref(), Some("NODE-A"));
        assert!((a.event_probability - 0.2).abs() < 1e-12);
        assert!((a.probability_if_true - 0.24).abs() < 1e-12);
        assert_eq!(a.probability_if_false, 0.0);
        assert!((a.birnbaum - 0.24).abs() < 1e-12);
        assert!((a.criticality.unwrap() - 0.3).abs() < 1e-12);
        assert_eq!(a.fussell_vesely, Some(1.0));
        assert!((a.risk_achievement_worth.unwrap() - 1.5).abs() < 1e-12);
        assert_eq!(a.risk_reduction_worth, None);
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

    #[test]
    fn hazard_uncertainty_is_aggregated_inside_praxis() {
        let rows = vec![observed("TRUE"), observed("FALSE")];
        let settings = HclSettings {
            uncertainty: Some(HclUncertaintySettings {
                sample_count: 200,
                seed: 2026,
                basic_event_distributions: vec![],
                cpt_row_distributions: vec![HclCptRowUncertaintySpec {
                    node: "NODE-A".to_string(),
                    row_index: 0,
                    equivalent_sample_size: 20.0,
                }],
            }),
            ..HclSettings::default()
        };
        let weighted =
            quantify_hcl_hazard_grid_batch(&model(Vec::new()), &rows, &rows, &settings).unwrap();
        let uncertainty = summarize_hcl_hazard_uncertainty(
            &weighted,
            1.0,
            FrequencyUnit::PerYear,
            AnnualizationConvention::default(),
            false,
        )
        .unwrap()
        .unwrap();

        assert_eq!(uncertainty.sample_count, 200);
        assert_eq!(uncertainty.seed, 2026);
        assert!(uncertainty.percentile_05 < uncertainty.percentile_95);
        assert!((uncertainty.mean - 0.2).abs() < 0.05);
    }
}
