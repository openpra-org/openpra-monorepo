use std::collections::{HashMap, HashSet};

use tensorbayes::{BayesianGraph, CompileHeuristic, CompiledJunctionTree, StateIndex};

use crate::algorithms::build::build_sequence_bdd_with_successes;
use crate::algorithms::pdag::PdagNode;
use crate::analysis::sequence_formula::SequenceFormulaBuilder;
use crate::core::event_tree::EventTree;
use crate::core::model::Model;
use crate::hcl::conditional_evidence_probabilities_for_network;
use crate::hcl::{
    HclBaseEvidence, HclBindingSpec, HclEventBinding, HclEventBindings, HclEvidenceSpec,
    HclQuantifier,
};
use crate::{PraxisError, Result};

#[derive(Clone, Debug)]
pub struct EventTreeHclContext {
    network: BayesianGraph,
    bindings: Vec<HclBindingSpec>,
    base_evidence: Vec<HclEvidenceSpec>,
}

impl EventTreeHclContext {
    pub fn new(network: BayesianGraph) -> Result<Self> {
        network.validate()?;
        Ok(Self {
            network,
            bindings: Vec::new(),
            base_evidence: Vec::new(),
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
}

#[derive(Clone, Debug, PartialEq)]
pub struct EventTreeSequenceProbability {
    pub sequence_id: String,
    pub conditional_probability: f64,
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
    let (quantification, raw_weights) = quantify_event_tree_sequences_batch_internal(
        model,
        event_tree,
        Some(hcl),
        evidence_rows,
        Some(hazard_assignment_rows),
    )?;
    Ok(EventTreeHazardGridQuantification {
        quantification,
        raw_weights: raw_weights.expect("hazard rows must produce weights"),
    })
}

fn quantify_event_tree_sequences_batch_internal(
    model: &Model,
    event_tree: &EventTree,
    hcl: Option<&EventTreeHclContext>,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: Option<&[Vec<HclEvidenceSpec>]>,
) -> Result<(EventTreeBatchQuantification, Option<Vec<f64>>)> {
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

    let mut sequence_ids: Vec<String> = event_tree.sequences.keys().cloned().collect();
    sequence_ids.sort();
    let mut results = vec![Vec::with_capacity(sequence_ids.len()); evidence_rows.len()];
    let mut pdag = formulas.pdag;
    let mut sequence_bdd_compilations = 0;

    for sequence_id in sequence_ids {
        let probabilities = if formulas.unconditional.contains(&sequence_id) {
            vec![1.0; evidence_rows.len()]
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
                    context.quantify_batch(&pdag, &order, &bdd, bdd_root, evidence_rows)?
                }
                None => vec![bdd.probability(bdd_root); evidence_rows.len()],
            }
        };
        for (scenario, conditional_probability) in results.iter_mut().zip(probabilities) {
            scenario.push(EventTreeSequenceProbability {
                sequence_id: sequence_id.clone(),
                conditional_probability,
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
    ))
}

struct CompiledHclContext {
    network: BayesianGraph,
    tree: CompiledJunctionTree,
    bindings: Vec<HclBindingSpec>,
}

impl CompiledHclContext {
    fn new(context: &EventTreeHclContext) -> Result<Self> {
        let tree =
            CompiledJunctionTree::compile(context.network.clone(), CompileHeuristic::MinFill)?;
        Ok(Self {
            network: context.network.clone(),
            tree,
            bindings: context.bindings.clone(),
        })
    }

    fn quantify_batch(
        &self,
        pdag: &crate::algorithms::pdag::Pdag,
        order: &[crate::algorithms::pdag::NodeIndex],
        bdd: &crate::algorithms::bdd_engine::Bdd,
        root: crate::algorithms::bdd_engine::BddRef,
        evidence_rows: &[Vec<HclEvidenceSpec>],
    ) -> Result<Vec<f64>> {
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
        let mut quantifier = HclQuantifier::new(bdd, self.tree.clone(), bindings, first_evidence)?;
        let mut probabilities = Vec::with_capacity(evidence_rows.len());
        for (index, evidence) in evidence_rows.iter().enumerate() {
            if index > 0 {
                quantifier.set_base_evidence(self.build_base_evidence(evidence)?)?;
            }
            probabilities.push(quantifier.quantify(root)?);
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
    use super::{
        quantify_event_tree_hazard_grid_batch, quantify_event_tree_sequences,
        quantify_event_tree_sequences_batch, EventTreeHclContext,
    };
    use crate::core::event::BasicEvent;
    use crate::core::event_tree::{
        Branch, BranchTarget, EventTree, Fork, FunctionalEvent, Path, Sequence,
    };
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::core::model::Model;
    use crate::hcl::{
        CanonicalBayesianNetwork, CanonicalBayesianVariable, HclBindingSpec, HclEvidenceSpec,
    };

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
        let hcl = EventTreeHclContext::new(graph).unwrap().with_bindings(vec![
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
        ]);

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
    }
}
