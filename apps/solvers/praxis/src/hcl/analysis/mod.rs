//! Probability batches, hazard integration and explicitly configured uncertainty.
//! Probability traversal uses the unchanged main HCLQuantifier.

mod model;

pub use model::{
    HclAnalysisResult, HclAnalysisSettings, HclBasicEventUncertaintySpec, HclBatchCompilationStats,
    HclBatchResult, HclCptGenerator, HclCptGeneratorSpec, HclCptPrior, HclCptRowUncertaintySpec,
    HclHazardGridBatchResult, HclPgaBin, HclPgaCenter, HclPgaFrequencyConversion,
    HclProbabilityDistribution, HclSampler, HclUncertaintySettings, HclUncertaintySummary,
};

use std::time::Duration;

use tensorbayes::{CompileHeuristic, CompiledJunctionTree, StateIndex};

use crate::algorithms::build::{build_bdd_with_order, BuildOptions};
use crate::algorithms::pdag::PdagNode;
use crate::hcl::{
    conditional_evidence_probabilities_for_network, ensure_hazard_convolution_supported,
    prepare_hazard_evidence, source_fault_tree_order, HclBaseEvidence, HclBridgeStats,
    HclEventBinding, HclEventBindings, HclEvidenceSpec, HclJunctionTreeStats, HclModel,
    HclQuantifier, PreparedHclUncertainty,
};
use crate::{PraxisError, Result};

/// Quantifies probability and explicitly configured uncertainty, without cut sets or importance.
/// Use `crate::hcl::quantify_hcl` for the original probability-only operation.
pub fn analyze_hcl(model: &HclModel, settings: &HclAnalysisSettings) -> Result<HclAnalysisResult> {
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
    settings: &HclAnalysisSettings,
) -> Result<HclBatchResult> {
    Ok(quantify_hcl_batch_internal(model, evidence_rows, None, settings)?.0)
}

/// Quantifies a hazard evidence grid and computes exact conditional grid weights
/// from the same compiled Bayesian junction tree.
pub fn quantify_hcl_hazard_grid_batch(
    model: &HclModel,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: &[Vec<HclEvidenceSpec>],
    settings: &HclAnalysisSettings,
) -> Result<HclHazardGridBatchResult> {
    ensure_hazard_convolution_supported(settings.uncertainty.as_ref())?;
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
    settings: &HclAnalysisSettings,
) -> Result<(HclBatchResult, Option<Vec<f64>>)> {
    if evidence_rows.is_empty() {
        return Err(PraxisError::Hcl(
            "HCL batch quantification requires at least one evidence row".to_string(),
        ));
    }
    model.network().validate()?;
    let tree = CompiledJunctionTree::compile(model.network().clone(), CompileHeuristic::MinFill)?;
    let tree_stats = tree.stats();
    let hazard_evidence = hazard_assignment_rows
        .map(|rows| {
            prepare_hazard_evidence(model.network(), model.base_evidence(), evidence_rows, rows)
        })
        .transpose()?;
    let evidence_rows = hazard_evidence.as_deref().unwrap_or(evidence_rows);
    let raw_weights = hazard_assignment_rows
        .map(|_| {
            conditional_evidence_probabilities_for_network(
                model.network(),
                model.base_evidence(),
                &tree,
                evidence_rows,
            )
        })
        .transpose()?;
    let scenario_indices: Vec<_> = (0..evidence_rows.len())
        .filter(|&index| {
            raw_weights
                .as_ref()
                .is_none_or(|weights| weights[index] > 0.0)
        })
        .collect();
    if scenario_indices.is_empty() {
        return Ok((
            HclBatchResult {
                results: vec![],
                scenario_indices,
                compilation: HclBatchCompilationStats {
                    bdd_compilations: 0,
                    junction_tree_compilations: 1,
                    scenario_evaluations: 0,
                },
            },
            raw_weights,
        ));
    }
    let build_options = BuildOptions {
        fold_constants: settings.fold_constants,
        splice_null_gates: settings.splice_null_gates,
        reorder: None,
        reorder_budget: Duration::from_secs(10),
    };
    let variable_order = match &settings.variable_order {
        Some(order) => order.clone(),
        None => source_fault_tree_order(model)?,
    };
    let built = build_bdd_with_order(model.fault_tree(), build_options, &variable_order)?;

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

    let mut quantifier = HclQuantifier::new(
        &built.bdd,
        tree,
        bindings.clone(),
        build_base_evidence(model, &evidence_rows[scenario_indices[0]])?,
    )?;
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
    let uncertainty = settings
        .uncertainty
        .as_ref()
        .map(|uncertainty| PreparedHclUncertainty::new(model.network(), uncertainty))
        .transpose()?;
    let mut results = Vec::with_capacity(scenario_indices.len());
    for &index in &scenario_indices {
        let resolved_evidence = build_base_evidence(model, &evidence_rows[index])?;
        if !results.is_empty() {
            quantifier.set_base_evidence(resolved_evidence.clone())?;
        }
        let before = quantifier.stats();
        let probability = quantifier.quantify(built.root)?;
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
        results.push(HclAnalysisResult {
            probability,
            uncertainty,
            uncertainty_samples,
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
            scenario_indices: scenario_indices.clone(),
            compilation: HclBatchCompilationStats {
                bdd_compilations: 1,
                junction_tree_compilations: 1,
                scenario_evaluations: scenario_indices.len(),
            },
        },
        raw_weights,
    ))
}

fn build_base_evidence(model: &HclModel, evidence: &[HclEvidenceSpec]) -> Result<HclBaseEvidence> {
    crate::hcl::hazard::resolve_evidence(model.network(), evidence)
}

pub(crate) fn bridge_delta(after: HclBridgeStats, before: HclBridgeStats) -> HclBridgeStats {
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
    use super::{analyze_hcl, quantify_hcl_batch, quantify_hcl_hazard_grid_batch};
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::hcl::{
        CanonicalBayesianNetwork, CanonicalBayesianVariable, HclAnalysisSettings, HclBindingSpec,
        HclCptRowUncertaintySpec, HclEvidenceSpec, HclModel, HclUncertaintySettings,
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
            .with_base_evidence(vec![HclEvidenceSpec {
                node: "CONTEXT".to_string(),
                state: "CONDITIONED".to_string(),
            }])
    }

    #[test]
    fn batch_reuses_compilation_and_matches_independent_quantifications() {
        let rows = vec![observed("TRUE"), observed("FALSE")];
        let batch =
            quantify_hcl_batch(&model(Vec::new()), &rows, &HclAnalysisSettings::default()).unwrap();
        let independent: Vec<f64> = rows
            .iter()
            .map(|evidence| {
                analyze_hcl(&model(evidence.clone()), &HclAnalysisSettings::default())
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
    fn dependent_probability_has_no_deferred_results() {
        let result = analyze_hcl(&correlated_model(), &HclAnalysisSettings::default()).unwrap();
        assert!((result.probability - 0.16).abs() < 1e-12);
        assert_eq!(result.bridge.quantifications, 1);
        let json = serde_json::to_value(result).unwrap();
        assert!(json.get("cut_sets").is_none());
        assert!(json.get("importance").is_none());
    }

    #[test]
    fn impossible_cut_event_does_not_become_bn_evidence() {
        let original = correlated_model();
        let network = CanonicalBayesianNetwork {
            id: None,
            variables: vec![
                CanonicalBayesianVariable {
                    name: "NODE-A".into(),
                    states: vec!["A-FALSE".into(), "A-TRUE".into()],
                    parents: vec![],
                    probabilities: vec![1.0, 0.0],
                },
                CanonicalBayesianVariable {
                    name: "NODE-B".into(),
                    states: vec!["B-FALSE".into(), "B-TRUE".into()],
                    parents: vec![],
                    probabilities: vec![0.5, 0.5],
                },
            ],
        }
        .into_graph()
        .unwrap();
        let model = HclModel::new(original.fault_tree().clone(), network)
            .unwrap()
            .with_bindings(original.bindings().to_vec());
        let result = analyze_hcl(&model, &HclAnalysisSettings::default()).unwrap();
        assert_eq!(result.probability, 0.0);
        assert_eq!(result.bridge.quantifications, 1);
    }

    #[test]
    fn probability_does_not_expand_billions_of_structural_products() {
        // AND of 32 disjoint two-event OR gates has 2^32 minimal products.
        let mut tree = FaultTree::new("COMPACT", "TOP").unwrap();
        let mut top = Gate::new("TOP".into(), Formula::And).unwrap();
        for i in 0..32 {
            let gate_id = format!("g{i:02}");
            let mut gate = Gate::new(gate_id.clone(), Formula::Or).unwrap();
            for suffix in ["a", "b"] {
                let event = format!("e{i:02}{suffix}");
                gate.add_operand(event.clone());
                tree.add_basic_event(BasicEvent::new(event, 0.1).unwrap())
                    .unwrap();
            }
            tree.add_gate(gate).unwrap();
            top.add_operand(gate_id);
        }
        tree.add_gate(top).unwrap();
        let model = HclModel::new(tree, model(vec![]).network().clone()).unwrap();
        let result = analyze_hcl(&model, &HclAnalysisSettings::default()).unwrap();
        assert!((result.probability / 0.19_f64.powi(32) - 1.0).abs() < 1e-12);
        assert_eq!(result.bridge.quantifications, 1);
        assert_eq!(result.bridge.bn_query_cache_misses, 0);
    }

    #[test]
    fn hazard_grid_preserves_fixed_hazard_evidence_and_skips_conflicts() {
        let rows = vec![observed("TRUE"), observed("FALSE")];
        let weighted = quantify_hcl_hazard_grid_batch(
            &model(observed("FALSE")),
            &rows,
            &rows,
            &HclAnalysisSettings::default(),
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
        assert_eq!(weighted.raw_weights, vec![0.0, 1.0]);
        assert_eq!(weighted.quantification.scenario_indices, vec![1]);
        assert_eq!(weighted.quantification.compilation.scenario_evaluations, 1);
        assert_eq!(weighted.quantification.results.len(), 1);
        assert_eq!(weighted.quantification.results[0].probability, 0.0);
    }

    #[test]
    fn hazard_grid_conditions_weights_on_non_grid_evidence() {
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
            &HclAnalysisSettings::default(),
        )
        .unwrap();

        assert!((weighted.raw_weights[0] - 0.75).abs() < 1e-12);
        assert!((weighted.raw_weights[1] - 0.25).abs() < 1e-12);
        assert!((weighted.raw_weights.iter().sum::<f64>() - 1.0).abs() < 1e-12);
        assert_eq!(weighted.quantification.results[0].probability, 1.0);
        assert_eq!(weighted.quantification.results[1].probability, 0.0);
    }

    #[test]
    fn hazard_uncertainty_is_rejected_before_execution() {
        let rows = vec![observed("TRUE"), observed("FALSE")];
        let settings = HclAnalysisSettings {
            uncertainty: Some(HclUncertaintySettings {
                cpt_generators: vec![],
                sampler: Default::default(),
                cpt_probability_clip_epsilon: 0.0,
                sample_count: 200,
                seed: 2026,
                basic_event_distributions: vec![],
                cpt_row_distributions: vec![HclCptRowUncertaintySpec {
                    node: "NODE-A".to_string(),
                    row_index: 0,
                    prior: crate::hcl::HclCptPrior::Dirichlet {
                        alpha: vec![16.0, 4.0],
                    },
                }],
            }),
            ..HclAnalysisSettings::default()
        };
        let error = quantify_hcl_hazard_grid_batch(&model(Vec::new()), &rows, &rows, &settings)
            .unwrap_err();
        assert!(error.to_string().contains("point runs only"));
    }
}
