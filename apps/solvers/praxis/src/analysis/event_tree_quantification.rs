use std::collections::{HashMap, HashSet};

use tensorbayes::{BayesianGraph, CompileHeuristic, CompiledJunctionTree, StateIndex};

use crate::algorithms::build::build_sequence_bdd_with_successes;
use crate::algorithms::noncoherent_mocus::NonCoherentMocus;
use crate::algorithms::pdag::{NodeIndex, PdagNode};
use crate::analysis::sequence_formula::SequenceFormulaBuilder;
use crate::core::event_tree::EventTree;
use crate::core::model::Model;
use crate::hcl::conditional_evidence_probabilities_for_network;
use crate::hcl::{
    evaluate_cut_sets, evaluate_importance, prepare_cut_sets, HclBaseEvidence, HclBindingSpec,
    HclCutSetAnalysis, HclCutSetTemplate, HclEventBinding, HclEventBindings, HclEvidenceSpec,
    HclImportanceAnalysis, HclQuantifier, HclUncertaintySettings, HclUncertaintySummary,
    PreparedHclUncertainty,
};
use crate::quantitative::{prepare_hazard_weights, AnnualizationConvention, FrequencyUnit};
use crate::{PraxisError, Result};

#[derive(Clone, Debug)]
pub struct EventTreeHclContext {
    network: BayesianGraph,
    bindings: Vec<HclBindingSpec>,
    base_evidence: Vec<HclEvidenceSpec>,
    uncertainty: Option<HclUncertaintySettings>,
}

impl EventTreeHclContext {
    pub fn new(network: BayesianGraph) -> Result<Self> {
        network.validate()?;
        Ok(Self {
            network,
            bindings: Vec::new(),
            base_evidence: Vec::new(),
            uncertainty: None,
        })
    }

    pub fn with_bindings(mut self, bindings: Vec<HclBindingSpec>) -> Self {
        self.bindings = bindings;
        self
    }

    pub fn with_base_evidence(mut self, base_evidence: Vec<HclEvidenceSpec>) -> Self {
        self.base_evidence = base_evidence;
        self
    }

    pub fn with_uncertainty(mut self, uncertainty: Option<HclUncertaintySettings>) -> Self {
        self.uncertainty = uncertainty;
        self
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct EventTreeSequenceProbability {
    pub sequence_id: String,
    pub conditional_probability: f64,
    pub cut_sets: Option<HclCutSetAnalysis>,
    pub importance: Option<HclImportanceAnalysis>,
    pub uncertainty: Option<HclUncertaintySummary>,
    pub uncertainty_samples: Option<Vec<f64>>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct EventTreeBatchCompilationStats {
    pub sequence_bdd_compilations: usize,
    pub junction_tree_compilations: usize,
    pub scenario_evaluations: usize,
}

#[derive(Clone, Debug, PartialEq)]
pub struct EventTreeBatchQuantification {
    pub scenarios: Vec<Vec<EventTreeSequenceProbability>>,
    pub compilation: EventTreeBatchCompilationStats,
}

#[derive(Clone, Debug, PartialEq)]
pub struct EventTreeHazardGridQuantification {
    pub quantification: EventTreeBatchQuantification,
    pub raw_weights: Vec<f64>,
    pub uncertainty_raw_weights: Option<Vec<Vec<f64>>>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct EventTreeHazardUncertaintySummary {
    pub sequences: HashMap<String, HclUncertaintySummary>,
    pub end_states: HashMap<String, HclUncertaintySummary>,
}

/// Quantifies the complete Boolean formula for every event-tree sequence.
///
/// Each failure branch contributes its linked fault-tree formula and each
/// success branch contributes the Boolean complement. All linked trees share
/// one PRAXIS PDAG, so repeated basic-event identifiers remain the same random
/// variable rather than separately multiplied branch marginals.
pub fn quantify_event_tree_sequences(
    model: &Model,
    event_tree: &EventTree,
    hcl: Option<&EventTreeHclContext>,
) -> Result<Vec<EventTreeSequenceProbability>> {
    let evidence_rows = match hcl {
        Some(context) => vec![context.base_evidence.clone()],
        None => vec![Vec::new()],
    };
    quantify_event_tree_sequences_batch(model, event_tree, hcl, &evidence_rows)?
        .scenarios
        .pop()
        .ok_or_else(|| {
            PraxisError::Logic("single event-tree quantification returned no result".to_string())
        })
}

/// Quantifies every sequence for multiple complete evidence rows while each
/// sequence BDD and the Bayesian junction tree are compiled only once.
pub fn quantify_event_tree_sequences_batch(
    model: &Model,
    event_tree: &EventTree,
    hcl: Option<&EventTreeHclContext>,
    evidence_rows: &[Vec<HclEvidenceSpec>],
) -> Result<EventTreeBatchQuantification> {
    Ok(
        quantify_event_tree_sequences_batch_internal(model, event_tree, hcl, evidence_rows, None)?
            .0,
    )
}

pub fn quantify_event_tree_hazard_grid_batch(
    model: &Model,
    event_tree: &EventTree,
    hcl: &EventTreeHclContext,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: &[Vec<HclEvidenceSpec>],
) -> Result<EventTreeHazardGridQuantification> {
    if evidence_rows.len() != hazard_assignment_rows.len() {
        return Err(PraxisError::Hcl(
            "event-tree hazard grid requires one hazard assignment for every evidence row"
                .to_string(),
        ));
    }
    let (quantification, raw_weights, uncertainty_raw_weights) =
        quantify_event_tree_sequences_batch_internal(
            model,
            event_tree,
            Some(hcl),
            evidence_rows,
            Some(hazard_assignment_rows),
        )?;
    Ok(EventTreeHazardGridQuantification {
        quantification,
        raw_weights: raw_weights.expect("hazard rows must produce weights"),
        uncertainty_raw_weights,
    })
}

/// Propagates the correlated PRAXIS uncertainty population through event-tree
/// hazard weighting, annualization, and end-state aggregation.
pub fn summarize_event_tree_hazard_uncertainty(
    batch: &EventTreeHazardGridQuantification,
    end_state_by_sequence: &HashMap<String, String>,
    frequency_scale_value: f64,
    frequency_scale_unit: FrequencyUnit,
    annualization: AnnualizationConvention,
    normalize_weights: bool,
) -> Result<EventTreeHazardUncertaintySummary> {
    let empty = || EventTreeHazardUncertaintySummary {
        sequences: HashMap::new(),
        end_states: HashMap::new(),
    };
    let Some(raw_weights) = &batch.uncertainty_raw_weights else {
        return Ok(empty());
    };
    let Some(first_quantified) = batch
        .quantification
        .scenarios
        .iter()
        .flat_map(|scenario| scenario.iter())
        .find(|sequence| sequence.uncertainty_samples.is_some())
    else {
        return Ok(empty());
    };
    let first_samples = first_quantified
        .uncertainty_samples
        .as_ref()
        .ok_or_else(|| {
            PraxisError::Hcl("event-tree hazard uncertainty samples are missing".to_string())
        })?;
    let seed = first_quantified
        .uncertainty
        .as_ref()
        .map(|summary| summary.seed)
        .ok_or_else(|| PraxisError::Hcl("event-tree hazard uncertainty has no seed".to_string()))?;
    if raw_weights.len() != batch.quantification.scenarios.len() {
        return Err(PraxisError::Hcl(
            "event-tree hazard uncertainty weights do not match scenario rows".to_string(),
        ));
    }
    let mut sequence_samples: HashMap<String, Vec<f64>> = HashMap::new();
    let mut end_state_samples: HashMap<String, Vec<f64>> = HashMap::new();
    for sample_index in 0..first_samples.len() {
        let sample_raw_weights = raw_weights
            .iter()
            .map(|row| {
                row.get(sample_index).copied().ok_or_else(|| {
                    PraxisError::Hcl(
                        "event-tree hazard weight population is incomplete".to_string(),
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
        for (scenario, weight) in batch.quantification.scenarios.iter().zip(weights.weights) {
            for sequence in scenario {
                let samples = sequence.uncertainty_samples.as_ref().ok_or_else(|| {
                    PraxisError::Hcl("event-tree sequence omitted uncertainty samples".to_string())
                })?;
                let probability = samples.get(sample_index).copied().ok_or_else(|| {
                    PraxisError::Hcl(
                        "event-tree sequence uncertainty population is incomplete".to_string(),
                    )
                })?;
                let contribution = weight.annual_frequency * probability;
                sequence_samples
                    .entry(sequence.sequence_id.clone())
                    .or_insert_with(|| vec![0.0; first_samples.len()])[sample_index] +=
                    contribution;
                let end_state = end_state_by_sequence.get(&sequence.sequence_id).ok_or_else(|| {
                    PraxisError::Hcl(format!(
                        "event-tree sequence '{}' has no resolved end state for uncertainty aggregation",
                        sequence.sequence_id
                    ))
                })?;
                end_state_samples
                    .entry(end_state.clone())
                    .or_insert_with(|| vec![0.0; first_samples.len()])[sample_index] +=
                    contribution;
            }
        }
    }
    let sequences = sequence_samples
        .into_iter()
        .map(|(id, samples)| Ok((id, HclUncertaintySummary::from_samples(&samples, seed)?)))
        .collect::<Result<HashMap<_, _>>>()?;
    let end_states = end_state_samples
        .into_iter()
        .map(|(id, samples)| Ok((id, HclUncertaintySummary::from_samples(&samples, seed)?)))
        .collect::<Result<HashMap<_, _>>>()?;
    Ok(EventTreeHazardUncertaintySummary {
        sequences,
        end_states,
    })
}

fn quantify_event_tree_sequences_batch_internal(
    model: &Model,
    event_tree: &EventTree,
    hcl: Option<&EventTreeHclContext>,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: Option<&[Vec<HclEvidenceSpec>]>,
) -> Result<(
    EventTreeBatchQuantification,
    Option<Vec<f64>>,
    Option<Vec<Vec<f64>>>,
)> {
    if evidence_rows.is_empty() {
        return Err(PraxisError::Hcl(
            "event-tree HCL batch requires at least one evidence row".to_string(),
        ));
    }
    let formulas = SequenceFormulaBuilder::new(model).build(event_tree, 1.0)?;
    let compiled_hcl = match hcl {
        Some(context) => Some(CompiledHclContext::new(context)?),
        None => None,
    };
    let raw_weights = match (hcl, compiled_hcl.as_ref(), hazard_assignment_rows) {
        (Some(context), Some(compiled), Some(rows)) => {
            Some(conditional_evidence_probabilities_for_network(
                &context.network,
                &context.base_evidence,
                &compiled.tree,
                rows,
            )?)
        }
        (None, _, Some(_)) => {
            return Err(PraxisError::Hcl(
                "event-tree hazard convolution requires an HCL Bayesian context".to_string(),
            ));
        }
        _ => None,
    };
    let uncertainty_raw_weights = match (hcl, compiled_hcl.as_ref(), hazard_assignment_rows) {
        (Some(context), Some(compiled), Some(rows)) => compiled
            .uncertainty
            .as_ref()
            .map(|uncertainty| {
                uncertainty.conditional_evidence_probabilities(&context.base_evidence, rows)
            })
            .transpose()?,
        _ => None,
    };

    let mut sequence_ids: Vec<String> = event_tree.sequences.keys().cloned().collect();
    sequence_ids.sort();
    let mut results = vec![Vec::with_capacity(sequence_ids.len()); evidence_rows.len()];
    let mut pdag = formulas.pdag;
    let mut sequence_bdd_compilations = 0;

    for sequence_id in sequence_ids {
        let evaluations = if formulas.unconditional.contains(&sequence_id) {
            match &compiled_hcl {
                Some(context) if context.uncertainty.is_some() => {
                    let samples = vec![1.0; context.uncertainty.as_ref().unwrap().sample_count()];
                    let summary = HclUncertaintySummary::from_samples(
                        &samples,
                        context.uncertainty.as_ref().unwrap().seed(),
                    )?;
                    vec![(1.0, None, None, Some(summary), Some(samples)); evidence_rows.len()]
                }
                _ => vec![(1.0, None, None, None, None); evidence_rows.len()],
            }
        } else {
            let root = formulas
                .sequence_roots
                .get(&sequence_id)
                .copied()
                .ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "event-tree sequence '{sequence_id}' has no Boolean formula"
                    ))
                })?;
            let (order, bdd, bdd_root, _) = build_sequence_bdd_with_successes(
                &mut pdag,
                &formulas.event_probs,
                root,
                &[],
                &sequence_id,
            )?;
            sequence_bdd_compilations += 1;
            match &compiled_hcl {
                Some(context) => {
                    let variable_by_node: HashMap<NodeIndex, usize> = order
                        .iter()
                        .enumerate()
                        .map(|(variable, node)| (node.abs(), variable))
                        .collect();
                    let mut mocus =
                        NonCoherentMocus::with_probabilities(&pdag, &formulas.event_probs)?;
                    let structural_cut_sets = mocus.analyze_primes();
                    let templates = prepare_cut_sets(
                        &pdag,
                        &variable_by_node,
                        &structural_cut_sets,
                        &context.network,
                        &context.bindings,
                    )?;
                    context.quantify_batch(
                        &pdag,
                        &order,
                        &bdd,
                        bdd_root,
                        &templates,
                        evidence_rows,
                    )?
                }
                None => {
                    vec![(bdd.probability(bdd_root), None, None, None, None); evidence_rows.len()]
                }
            }
        };
        for (
            scenario,
            (conditional_probability, cut_sets, importance, uncertainty, uncertainty_samples),
        ) in results.iter_mut().zip(evaluations)
        {
            scenario.push(EventTreeSequenceProbability {
                sequence_id: sequence_id.clone(),
                conditional_probability,
                cut_sets,
                importance,
                uncertainty,
                uncertainty_samples,
            });
        }
    }

    Ok((
        EventTreeBatchQuantification {
            scenarios: results,
            compilation: EventTreeBatchCompilationStats {
                sequence_bdd_compilations,
                junction_tree_compilations: usize::from(compiled_hcl.is_some()),
                scenario_evaluations: evidence_rows.len(),
            },
        },
        raw_weights,
        uncertainty_raw_weights,
    ))
}

struct CompiledHclContext {
    network: BayesianGraph,
    tree: CompiledJunctionTree,
    bindings: Vec<HclBindingSpec>,
    uncertainty: Option<PreparedHclUncertainty>,
}

impl CompiledHclContext {
    fn new(context: &EventTreeHclContext) -> Result<Self> {
        let tree =
            CompiledJunctionTree::compile(context.network.clone(), CompileHeuristic::MinFill)?;
        Ok(Self {
            network: context.network.clone(),
            tree,
            bindings: context.bindings.clone(),
            uncertainty: context
                .uncertainty
                .as_ref()
                .map(|settings| PreparedHclUncertainty::new(&context.network, settings))
                .transpose()?,
        })
    }

    fn quantify_batch(
        &self,
        pdag: &crate::algorithms::pdag::Pdag,
        order: &[crate::algorithms::pdag::NodeIndex],
        bdd: &crate::algorithms::bdd_engine::Bdd,
        root: crate::algorithms::bdd_engine::BddRef,
        cut_set_templates: &[HclCutSetTemplate],
        evidence_rows: &[Vec<HclEvidenceSpec>],
    ) -> Result<
        Vec<(
            f64,
            Option<HclCutSetAnalysis>,
            Option<HclImportanceAnalysis>,
            Option<HclUncertaintySummary>,
            Option<Vec<f64>>,
        )>,
    > {
        let variable_by_event: HashMap<&str, usize> = order
            .iter()
            .enumerate()
            .filter_map(|(variable, index)| match pdag.get_node(*index) {
                Some(PdagNode::BasicEvent { id, .. }) => Some((id.as_str(), variable)),
                _ => None,
            })
            .collect();
        let mut bindings = HclEventBindings::new();
        for spec in &self.bindings {
            let Some(&bdd_variable) = variable_by_event.get(spec.event.as_str()) else {
                continue;
            };
            let node = self.network.node_id(&spec.node)?;
            let variable = self.network.variable(node)?;
            let true_states = resolve_states(variable.states(), &spec.true_states, &spec.node)?;
            bindings.insert(HclEventBinding::new(bdd_variable, node, true_states)?)?;
        }

        let first_evidence = self.build_base_evidence(&evidence_rows[0])?;
        let mut quantifier =
            HclQuantifier::new(bdd, self.tree.clone(), bindings.clone(), first_evidence)?;
        let event_by_variable = (0..bdd.variable_count())
            .map(|variable| {
                order
                    .get(variable)
                    .and_then(|index| match pdag.get_node(*index) {
                        Some(PdagNode::BasicEvent { id, .. }) => Some(id.clone()),
                        _ => None,
                    })
            })
            .collect::<Vec<_>>();
        let binding_node_by_event: HashMap<String, String> = self
            .bindings
            .iter()
            .map(|binding| (binding.event.clone(), binding.node.clone()))
            .collect();
        let mut probabilities = Vec::with_capacity(evidence_rows.len());
        for (index, evidence) in evidence_rows.iter().enumerate() {
            let resolved_evidence = self.build_base_evidence(evidence)?;
            if index > 0 {
                quantifier.set_base_evidence(resolved_evidence.clone())?;
            }
            let probability = quantifier.quantify(root)?;
            let cut_sets = evaluate_cut_sets(cut_set_templates, &mut quantifier, probability)?;
            let importance = evaluate_importance(
                root,
                &event_by_variable,
                &binding_node_by_event,
                &mut quantifier,
                probability,
            )?;
            let (uncertainty, uncertainty_samples) = match &self.uncertainty {
                Some(prepared) => {
                    let samples = prepared.quantify(
                        bdd,
                        root,
                        bindings.clone(),
                        resolved_evidence,
                        &event_by_variable,
                    )?;
                    let summary = HclUncertaintySummary::from_samples(&samples, prepared.seed())?;
                    (Some(summary), Some(samples))
                }
                None => (None, None),
            };
            probabilities.push((
                probability,
                Some(cut_sets),
                Some(importance),
                uncertainty,
                uncertainty_samples,
            ));
        }
        Ok(probabilities)
    }

    fn build_base_evidence(&self, evidence: &[HclEvidenceSpec]) -> Result<HclBaseEvidence> {
        let mut base_evidence = HclBaseEvidence::unobserved(self.network.num_variables());
        let mut observed_nodes = HashSet::new();
        for spec in evidence {
            let node = self.network.node_id(&spec.node)?;
            if !observed_nodes.insert(node) {
                return Err(PraxisError::Hcl(format!(
                    "base evidence observes BN node '{}' more than once",
                    spec.node
                )));
            }
            let variable = self.network.variable(node)?;
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
    use std::collections::HashMap;

    use super::{
        quantify_event_tree_hazard_grid_batch, quantify_event_tree_sequences,
        quantify_event_tree_sequences_batch, summarize_event_tree_hazard_uncertainty,
        EventTreeHclContext,
    };
    use crate::core::event::BasicEvent;
    use crate::core::event_tree::{
        Branch, BranchTarget, EventTree, Fork, FunctionalEvent, Path, Sequence,
    };
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::core::model::Model;
    use crate::hcl::{
        CanonicalBayesianNetwork, CanonicalBayesianVariable, HclBindingSpec,
        HclCptRowUncertaintySpec, HclEvidenceSpec, HclUncertaintySettings,
    };
    use crate::quantitative::{AnnualizationConvention, FrequencyUnit};

    fn single_event_tree(id: &str, event: &str, probability: f64) -> FaultTree {
        let top_id = format!("{id}-TOP");
        let mut tree = FaultTree::new(id, &top_id).unwrap();
        let mut top = Gate::new(top_id, Formula::Or).unwrap();
        top.add_operand(event.to_string());
        tree.add_gate(top).unwrap();
        tree.add_basic_event(BasicEvent::new(event.to_string(), probability).unwrap())
            .unwrap();
        tree
    }

    fn first_branch(first_outcome: &str, success_id: &str, failure_id: &str) -> Path {
        let second_paths = [("success", success_id), ("failure", failure_id)]
            .into_iter()
            .map(|(outcome, sequence_id)| {
                Path::new(
                    outcome.to_string(),
                    Branch::new(BranchTarget::Sequence(sequence_id.to_string())),
                )
                .unwrap()
                .with_collect_formula_negated(outcome == "success")
            })
            .collect();
        let second_fork = Fork::new("FE-B".to_string(), second_paths).unwrap();
        Path::new(
            first_outcome.to_string(),
            Branch::new(BranchTarget::Fork(second_fork)),
        )
        .unwrap()
        .with_collect_formula_negated(first_outcome == "success")
    }

    #[test]
    fn preserves_shared_basic_event_identity_across_linked_fault_trees() {
        let mut model = Model::new("M").unwrap();
        model
            .add_fault_tree(single_event_tree("FT-A", "SHARED", 0.2))
            .unwrap();
        model
            .add_fault_tree(single_event_tree("FT-B", "SHARED", 0.2))
            .unwrap();

        let paths = vec![
            first_branch("success", "SS", "SF"),
            first_branch("failure", "FS", "FF"),
        ];
        let mut event_tree = EventTree::new(
            "ET".to_string(),
            Branch::new(BranchTarget::Fork(
                Fork::new("FE-A".to_string(), paths).unwrap(),
            )),
        );
        event_tree
            .add_functional_event(
                FunctionalEvent::new("FE-A".to_string()).with_fault_tree("FT-A".to_string()),
            )
            .unwrap();
        event_tree
            .add_functional_event(
                FunctionalEvent::new("FE-B".to_string()).with_fault_tree("FT-B".to_string()),
            )
            .unwrap();
        for id in ["SS", "SF", "FS", "FF"] {
            event_tree
                .add_sequence(Sequence::new(id.to_string()))
                .unwrap();
        }

        let results = quantify_event_tree_sequences(&model, &event_tree, None).unwrap();
        let probability = |id: &str| {
            results
                .iter()
                .find(|result| result.sequence_id == id)
                .unwrap()
                .conditional_probability
        };
        assert!((probability("SS") - 0.8).abs() < 1e-12);
        assert!(probability("SF").abs() < 1e-12);
        assert!(probability("FS").abs() < 1e-12);
        assert!((probability("FF") - 0.2).abs() < 1e-12);
    }

    #[test]
    fn preserves_bayesian_path_context_across_hcl_event_tree_sequences() {
        let mut model = Model::new("M").unwrap();
        model
            .add_fault_tree(single_event_tree("FT-A", "A", 0.2))
            .unwrap();
        model
            .add_fault_tree(single_event_tree("FT-B", "B", 0.24))
            .unwrap();
        let paths = vec![
            first_branch("success", "SS", "SF"),
            first_branch("failure", "FS", "FF"),
        ];
        let mut event_tree = EventTree::new(
            "ET".to_string(),
            Branch::new(BranchTarget::Fork(
                Fork::new("FE-A".to_string(), paths).unwrap(),
            )),
        );
        event_tree
            .add_functional_event(
                FunctionalEvent::new("FE-A".to_string()).with_fault_tree("FT-A".to_string()),
            )
            .unwrap();
        event_tree
            .add_functional_event(
                FunctionalEvent::new("FE-B".to_string()).with_fault_tree("FT-B".to_string()),
            )
            .unwrap();
        for id in ["SS", "SF", "FS", "FF"] {
            event_tree
                .add_sequence(Sequence::new(id.to_string()))
                .unwrap();
        }

        let graph = CanonicalBayesianNetwork {
            id: Some("BN".to_string()),
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
        let hcl = EventTreeHclContext::new(graph)
            .unwrap()
            .with_bindings(vec![
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
            .with_uncertainty(Some(HclUncertaintySettings {
                sample_count: 200,
                seed: 2026,
                basic_event_distributions: vec![],
                cpt_row_distributions: vec![HclCptRowUncertaintySpec {
                    node: "NODE-B".to_string(),
                    row_index: 1,
                    equivalent_sample_size: 25.0,
                }],
            }));

        let results = quantify_event_tree_sequences(&model, &event_tree, Some(&hcl)).unwrap();
        let probability = |id: &str| {
            results
                .iter()
                .find(|result| result.sequence_id == id)
                .unwrap()
                .conditional_probability
        };
        assert!((probability("SS") - 0.72).abs() < 1e-12);
        assert!((probability("SF") - 0.08).abs() < 1e-12);
        assert!((probability("FS") - 0.04).abs() < 1e-12);
        assert!((probability("FF") - 0.16).abs() < 1e-12);
        let ff_uncertainty = results
            .iter()
            .find(|result| result.sequence_id == "FF")
            .and_then(|result| result.uncertainty.as_ref())
            .unwrap();
        assert_eq!(ff_uncertainty.sample_count, 200);
        assert!(ff_uncertainty.percentile_05 < ff_uncertainty.percentile_95);

        let cut_sets = |id: &str| {
            results
                .iter()
                .find(|result| result.sequence_id == id)
                .and_then(|result| result.cut_sets.as_ref())
                .unwrap()
        };
        let ff = cut_sets("FF");
        assert_eq!(ff.total_count, 1);
        assert!((ff.cut_sets[0].probability - 0.16).abs() < 1e-12);
        assert!(ff.cut_sets[0]
            .literals
            .iter()
            .all(|literal| !literal.complemented));
        assert_eq!(ff.cut_sets[0].bn_root_cause_node_ids, vec!["NODE-A"]);
        let ff_importance = results
            .iter()
            .find(|result| result.sequence_id == "FF")
            .and_then(|result| result.importance.as_ref())
            .unwrap();
        assert_eq!(ff_importance.total_count, 2);
        let a_importance = ff_importance
            .measures
            .iter()
            .find(|measure| measure.basic_event_id == "A")
            .unwrap();
        assert!((a_importance.probability_if_true - 0.24).abs() < 1e-12);
        assert_eq!(a_importance.probability_if_false, 0.0);

        let ss = cut_sets("SS");
        assert_eq!(ss.total_count, 1);
        assert!((ss.cut_sets[0].probability - 0.72).abs() < 1e-12);
        assert!(ss.cut_sets[0]
            .literals
            .iter()
            .all(|literal| literal.complemented));
        let b_trace = ss.cut_sets[0]
            .literals
            .iter()
            .find(|literal| literal.basic_event_id == "B")
            .and_then(|literal| literal.binding.as_ref())
            .unwrap();
        assert_eq!(b_trace.state_ids, vec!["B-FALSE"]);

        let rows = vec![
            vec![HclEvidenceSpec {
                node: "NODE-A".to_string(),
                state: "A-TRUE".to_string(),
            }],
            vec![HclEvidenceSpec {
                node: "NODE-A".to_string(),
                state: "A-FALSE".to_string(),
            }],
        ];
        let batch =
            quantify_event_tree_sequences_batch(&model, &event_tree, Some(&hcl), &rows).unwrap();
        let scenario_probability = |scenario: usize, id: &str| {
            batch.scenarios[scenario]
                .iter()
                .find(|result| result.sequence_id == id)
                .unwrap()
                .conditional_probability
        };
        assert_eq!(batch.compilation.junction_tree_compilations, 1);
        assert_eq!(batch.compilation.sequence_bdd_compilations, 4);
        assert_eq!(batch.compilation.scenario_evaluations, 2);
        assert!((scenario_probability(0, "SS") - 0.0).abs() < 1e-12);
        assert!((scenario_probability(0, "SF") - 0.0).abs() < 1e-12);
        assert!((scenario_probability(0, "FS") - 0.2).abs() < 1e-12);
        assert!((scenario_probability(0, "FF") - 0.8).abs() < 1e-12);
        assert!((scenario_probability(1, "SS") - 0.9).abs() < 1e-12);
        assert!((scenario_probability(1, "SF") - 0.1).abs() < 1e-12);
        assert!((scenario_probability(1, "FS") - 0.0).abs() < 1e-12);
        assert!((scenario_probability(1, "FF") - 0.0).abs() < 1e-12);

        let weighted =
            quantify_event_tree_hazard_grid_batch(&model, &event_tree, &hcl, &rows, &rows).unwrap();
        assert_eq!(
            weighted
                .quantification
                .compilation
                .junction_tree_compilations,
            1
        );
        assert!((weighted.raw_weights[0] - 0.2).abs() < 1e-12);
        assert!((weighted.raw_weights[1] - 0.8).abs() < 1e-12);
        assert_eq!(weighted.uncertainty_raw_weights.as_ref().unwrap().len(), 2);
        let end_states = HashMap::from([
            ("SS".to_string(), "SAFE".to_string()),
            ("FS".to_string(), "SAFE".to_string()),
            ("SF".to_string(), "FAILED".to_string()),
            ("FF".to_string(), "FAILED".to_string()),
        ]);
        let uncertainty = summarize_event_tree_hazard_uncertainty(
            &weighted,
            &end_states,
            1.0,
            FrequencyUnit::PerYear,
            AnnualizationConvention::default(),
            false,
        )
        .unwrap();
        assert_eq!(uncertainty.sequences["FF"].sample_count, 200);
        assert_eq!(uncertainty.end_states["FAILED"].seed, 2026);
        assert!(
            uncertainty.end_states["FAILED"].percentile_05
                < uncertainty.end_states["FAILED"].percentile_95
        );
    }
}
