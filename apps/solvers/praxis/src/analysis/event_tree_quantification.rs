use std::collections::{HashMap, HashSet};

use tensorbayes::{BayesianGraph, CompileHeuristic, CompiledJunctionTree, StateIndex};

use crate::algorithms::build::build_sequence_bdd_with_successes;
use crate::algorithms::pdag::PdagNode;
use crate::analysis::sequence_formula::SequenceFormulaBuilder;
use crate::core::event_tree::EventTree;
use crate::core::model::Model;
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
    let formulas = SequenceFormulaBuilder::new(model).build(event_tree, 1.0)?;
    let compiled_hcl = match hcl {
        Some(context) => Some(CompiledHclContext::new(context)?),
        None => None,
    };

    let mut sequence_ids: Vec<String> = event_tree.sequences.keys().cloned().collect();
    sequence_ids.sort();
    let mut results = Vec::with_capacity(sequence_ids.len());
    let mut pdag = formulas.pdag;

    for sequence_id in sequence_ids {
        let conditional_probability = if formulas.unconditional.contains(&sequence_id) {
            1.0
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
            match &compiled_hcl {
                Some(context) => context.quantify(&pdag, &order, &bdd, bdd_root)?,
                None => bdd.probability(bdd_root),
            }
        };
        results.push(EventTreeSequenceProbability {
            sequence_id,
            conditional_probability,
        });
    }

    Ok(results)
}

struct CompiledHclContext {
    network: BayesianGraph,
    tree: CompiledJunctionTree,
    bindings: Vec<HclBindingSpec>,
    base_evidence: HclBaseEvidence,
}

impl CompiledHclContext {
    fn new(context: &EventTreeHclContext) -> Result<Self> {
        let mut base_evidence = HclBaseEvidence::unobserved(context.network.num_variables());
        let mut observed_nodes = HashSet::new();
        for spec in &context.base_evidence {
            let node = context.network.node_id(&spec.node)?;
            if !observed_nodes.insert(node) {
                return Err(PraxisError::Hcl(format!(
                    "base evidence observes BN node '{}' more than once",
                    spec.node
                )));
            }
            let variable = context.network.variable(node)?;
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

        let tree =
            CompiledJunctionTree::compile(context.network.clone(), CompileHeuristic::MinFill)?;
        Ok(Self {
            network: context.network.clone(),
            tree,
            bindings: context.bindings.clone(),
            base_evidence,
        })
    }

    fn quantify(
        &self,
        pdag: &crate::algorithms::pdag::Pdag,
        order: &[crate::algorithms::pdag::NodeIndex],
        bdd: &crate::algorithms::bdd_engine::Bdd,
        root: crate::algorithms::bdd_engine::BddRef,
    ) -> Result<f64> {
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

        let mut quantifier =
            HclQuantifier::new(bdd, self.tree.clone(), bindings, self.base_evidence.clone())?;
        quantifier.quantify(root)
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
    use super::{quantify_event_tree_sequences, EventTreeHclContext};
    use crate::core::event::BasicEvent;
    use crate::core::event_tree::{
        Branch, BranchTarget, EventTree, Fork, FunctionalEvent, Path, Sequence,
    };
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::core::model::Model;
    use crate::hcl::{CanonicalBayesianNetwork, CanonicalBayesianVariable, HclBindingSpec};

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
    }
}
