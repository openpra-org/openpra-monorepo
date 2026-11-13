use std::collections::HashMap;

use tensorbayes::{CompileHeuristic, CompiledJunctionTree, StateIndex};

use crate::algorithms::pdag::PdagNode;
use crate::analysis::event_tree_quantification::{EventTreeHclContext, EventTreeUnion};
use crate::analysis::sequence_formula::SequenceFormulaBuilder;
use crate::core::event_tree::EventTree;
use crate::core::fault_tree::FaultTree;
use crate::core::model::Model;
use crate::hcl::importance::target_conditionals;
use crate::hcl::{
    conditional_evidence_probabilities_for_network, prepare_hazard_evidence, resolve_evidence,
    HclEventBinding, HclEventBindings, HclEvidenceSpec, HclQuantifier, PreparedHclUncertainty,
    SampledConditional, SampledTarget, TargetConditionals,
};
use crate::{PraxisError, Result};

#[derive(Clone, Debug, PartialEq)]
pub struct SequenceConditionals {
    pub sequence_id: String,
    pub conditionals: TargetConditionals,
}

#[derive(Clone, Debug, PartialEq)]
pub struct DependencyImportance {
    pub scenarios: Vec<Vec<SequenceConditionals>>,
    pub scenario_indices: Vec<usize>,
    pub raw_weights: Option<Vec<f64>>,
}

impl DependencyImportance {
    pub fn weighted(&self, sequence_ids: &[&str]) -> Option<TargetConditionals> {
        let weights = self.raw_weights.as_ref()?;
        let sums: Vec<TargetConditionals> = self
            .scenarios
            .iter()
            .map(|rows| sum_of(rows, sequence_ids))
            .collect();
        let parts: Vec<(f64, &TargetConditionals)> = self
            .scenario_indices
            .iter()
            .zip(&sums)
            .map(|(&scenario, part)| (weights[scenario], part))
            .collect();
        TargetConditionals::mix(&parts)
    }
}

pub fn sum_of(rows: &[SequenceConditionals], sequence_ids: &[&str]) -> TargetConditionals {
    let parts: Vec<&TargetConditionals> = rows
        .iter()
        .filter(|row| sequence_ids.contains(&row.sequence_id.as_str()))
        .map(|row| &row.conditionals)
        .collect();
    TargetConditionals::sum(&parts)
}

fn true_states(
    available: &[String],
    requested: &[String],
    node_name: &str,
) -> Result<Vec<StateIndex>> {
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

pub fn base_event_tree_dependency_importance(
    model: &Model,
    event_tree: &EventTree,
    hcl: &EventTreeHclContext,
) -> Result<DependencyImportance> {
    let rows = [hcl.base_evidence().to_vec()];
    event_tree_dependency_importance(model, event_tree, hcl, &rows, None)
}

pub fn event_tree_dependency_importance(
    model: &Model,
    event_tree: &EventTree,
    hcl: &EventTreeHclContext,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: Option<&[Vec<HclEvidenceSpec>]>,
) -> Result<DependencyImportance> {
    if evidence_rows.is_empty() {
        return Err(PraxisError::Hcl(
            "a dependency importance run requires at least one evidence row".to_string(),
        ));
    }
    if hazard_assignment_rows.is_some_and(|rows| rows.len() != evidence_rows.len()) {
        return Err(PraxisError::Hcl(
            "a hazard grid requires one hazard assignment for every evidence row".to_string(),
        ));
    }
    let network = hcl.network();
    let tree = CompiledJunctionTree::compile(network.clone(), CompileHeuristic::MinFill)?;
    let hazard_evidence = hazard_assignment_rows
        .map(|rows| prepare_hazard_evidence(network, hcl.base_evidence(), evidence_rows, rows))
        .transpose()?;
    let evidence_rows = hazard_evidence.as_deref().unwrap_or(evidence_rows);
    let raw_weights = hazard_assignment_rows
        .map(|_| {
            conditional_evidence_probabilities_for_network(
                network,
                hcl.base_evidence(),
                &tree,
                evidence_rows,
            )
        })
        .transpose()?;
    let scenario_indices: Vec<usize> = (0..evidence_rows.len())
        .filter(|&index| {
            raw_weights
                .as_ref()
                .is_none_or(|weights| weights[index] > 0.0)
        })
        .collect();
    let formulas = SequenceFormulaBuilder::new(model).build(event_tree, 1.0)?;
    let mut pdag = formulas.pdag;
    let mut sequence_ids: Vec<String> = event_tree.sequences.keys().cloned().collect();
    sequence_ids.sort();
    let mut scenarios = vec![Vec::with_capacity(sequence_ids.len()); scenario_indices.len()];
    for sequence_id in sequence_ids {
        if formulas.unconditional.contains(&sequence_id) || scenario_indices.is_empty() {
            for rows in &mut scenarios {
                rows.push(SequenceConditionals {
                    sequence_id: sequence_id.clone(),
                    conditionals: TargetConditionals::certain(),
                });
            }
            continue;
        }
        let root = formulas
            .sequence_roots
            .get(&sequence_id)
            .copied()
            .ok_or_else(|| {
                PraxisError::Logic(format!(
                    "event-tree sequence '{sequence_id}' has no Boolean formula"
                ))
            })?;
        let (order, bdd, bdd_root) = crate::hcl::ordering::build_sequence_bdd(
            &mut pdag,
            &formulas.event_probs,
            root,
            network,
            hcl.bindings(),
            hcl.variable_order(),
        )?;
        let mut inside: Vec<(String, usize)> = Vec::with_capacity(order.len());
        for (variable, index) in order.iter().enumerate() {
            if let Some(PdagNode::BasicEvent { id, .. }) = pdag.get_node(*index) {
                inside.push((id.clone(), variable));
            }
        }
        let variable_of: HashMap<&str, usize> = inside
            .iter()
            .map(|(name, variable)| (name.as_str(), *variable))
            .collect();
        let mut bindings = HclEventBindings::new();
        let mut outside = Vec::new();
        for spec in hcl.bindings() {
            let node = network.node_id(&spec.node)?;
            let states = true_states(
                network.variable(node)?.states(),
                &spec.true_states,
                &spec.node,
            )?;
            match variable_of.get(spec.event.as_str()) {
                Some(&variable) => {
                    bindings.insert(HclEventBinding::new(variable, node, states)?)?;
                }
                None => {
                    let variable = bdd.variable_count() + outside.len();
                    outside.push((
                        spec.event.clone(),
                        HclEventBinding::new(variable, node, states)?,
                    ));
                }
            }
        }
        let first = resolve_evidence(network, &evidence_rows[scenario_indices[0]])?;
        let mut quantifier = HclQuantifier::new(&bdd, tree.clone(), bindings, first)?;
        for (position, &scenario) in scenario_indices.iter().enumerate() {
            if position > 0 {
                quantifier
                    .set_base_evidence(resolve_evidence(network, &evidence_rows[scenario])?)?;
            }
            scenarios[position].push(SequenceConditionals {
                sequence_id: sequence_id.clone(),
                conditionals: target_conditionals(&mut quantifier, bdd_root, &inside, &outside)?,
            });
        }
    }
    Ok(DependencyImportance {
        scenarios,
        scenario_indices,
        raw_weights,
    })
}

#[derive(Clone, Debug, PartialEq)]
pub struct SampledTargetImportance {
    pub id: String,
    pub point: TargetConditionals,
    pub leading: Vec<String>,
    pub sampled: SampledTarget,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SampledScenarioImportance {
    pub sequences: Vec<SampledTargetImportance>,
    pub groups: Vec<SampledTargetImportance>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SampledDependencyImportance {
    pub scenarios: Vec<SampledScenarioImportance>,
    pub scenario_indices: Vec<usize>,
}

pub fn event_tree_sampled_importance(
    model: &Model,
    event_tree: &EventTree,
    hcl: &EventTreeHclContext,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    groups: &[EventTreeUnion],
    keep: usize,
) -> Result<SampledDependencyImportance> {
    let uncertainty = hcl.uncertainty().ok_or_else(|| {
        PraxisError::Hcl("sampled importance needs uncertainty settings".to_string())
    })?;
    if keep == 0 {
        return Err(PraxisError::Settings(
            "the number of events sampled for importance must be at least 1".to_string(),
        ));
    }
    let point = event_tree_dependency_importance(model, event_tree, hcl, evidence_rows, None)?;
    let network = hcl.network();
    let mut sources: Vec<(&String, &FaultTree)> = model.fault_trees().iter().collect();
    sources.sort_by(|left, right| left.0.cmp(right.0));
    let sources: Vec<&FaultTree> = sources.into_iter().map(|(_, tree)| tree).collect();
    let prepared = PreparedHclUncertainty::new(network, uncertainty, &sources)?;
    let mut scenarios: Vec<SampledScenarioImportance> = point
        .scenarios
        .iter()
        .map(|rows| SampledScenarioImportance {
            sequences: rows
                .iter()
                .map(|row| SampledTargetImportance {
                    id: row.sequence_id.clone(),
                    point: row.conditionals.clone(),
                    leading: row.conditionals.leading(keep),
                    sampled: SampledTarget::certain(prepared.sample_count()),
                })
                .collect(),
            groups: groups
                .iter()
                .map(|group| {
                    let ids: Vec<&str> = group.sequence_ids.iter().map(String::as_str).collect();
                    let total = sum_of(rows, &ids);
                    SampledTargetImportance {
                        id: group.id.clone(),
                        leading: total.leading(keep),
                        point: total,
                        sampled: SampledTarget::certain(prepared.sample_count()),
                    }
                })
                .collect(),
        })
        .collect();
    let formulas = SequenceFormulaBuilder::new(model).build(event_tree, 1.0)?;
    let mut pdag = formulas.pdag;
    let sequence_count = scenarios
        .first()
        .map_or(0, |scenario| scenario.sequences.len());
    for position in 0..sequence_count {
        let sequence_id = scenarios[0].sequences[position].id.clone();
        if formulas.unconditional.contains(&sequence_id) {
            continue;
        }
        let root = formulas
            .sequence_roots
            .get(&sequence_id)
            .copied()
            .ok_or_else(|| {
                PraxisError::Logic(format!(
                    "event-tree sequence '{sequence_id}' has no Boolean formula"
                ))
            })?;
        let (order, bdd, bdd_root) = crate::hcl::ordering::build_sequence_bdd(
            &mut pdag,
            &formulas.event_probs,
            root,
            network,
            hcl.bindings(),
            hcl.variable_order(),
        )?;
        let event_by_variable: Vec<Option<String>> = order
            .iter()
            .map(|index| match pdag.get_node(*index) {
                Some(PdagNode::BasicEvent { id, .. }) => Some(id.clone()),
                _ => None,
            })
            .collect();
        let variable_of: HashMap<&str, usize> = event_by_variable
            .iter()
            .enumerate()
            .filter_map(|(variable, event)| event.as_deref().map(|name| (name, variable)))
            .collect();
        let mut bindings = HclEventBindings::new();
        let mut elsewhere: HashMap<&str, HclEventBinding> = HashMap::new();
        for spec in hcl.bindings() {
            let node = network.node_id(&spec.node)?;
            let states = true_states(
                network.variable(node)?.states(),
                &spec.true_states,
                &spec.node,
            )?;
            match variable_of.get(spec.event.as_str()) {
                Some(&variable) => {
                    bindings.insert(HclEventBinding::new(variable, node, states)?)?;
                }
                None => {
                    let variable = bdd.variable_count() + elsewhere.len();
                    elsewhere.insert(
                        spec.event.as_str(),
                        HclEventBinding::new(variable, node, states)?,
                    );
                }
            }
        }
        for (scenario, &row) in scenarios.iter_mut().zip(&point.scenario_indices) {
            let mut wanted: Vec<String> = scenario.sequences[position].leading.clone();
            for (group, entry) in groups.iter().zip(&scenario.groups) {
                if group.sequence_ids.contains(&sequence_id) {
                    for name in &entry.leading {
                        if !wanted.contains(name) {
                            wanted.push(name.clone());
                        }
                    }
                }
            }
            let mut inside = Vec::new();
            let mut outside = Vec::new();
            let mut names = (Vec::new(), Vec::new());
            for name in &wanted {
                if let Some(&variable) = variable_of.get(name.as_str()) {
                    inside.push(variable);
                    names.0.push(name.clone());
                } else if let Some(binding) = elsewhere.get(name.as_str()) {
                    outside.push(binding.clone());
                    names.1.push(name.clone());
                }
            }
            let samples = prepared.conditionals(
                &bdd,
                bdd_root,
                bindings.clone(),
                resolve_evidence(network, &evidence_rows[row])?,
                &event_by_variable,
                &inside,
                &outside,
            )?;
            let mut events = Vec::with_capacity(inside.len() + outside.len());
            for ((name, &variable), values) in names.0.iter().zip(&inside).zip(samples.inside) {
                events.push(SampledConditional {
                    event: name.clone(),
                    bound: bindings.get(variable).is_some(),
                    in_target: true,
                    probability: values.probability,
                    occurred: values.occurred,
                    not_occurred: values.not_occurred,
                });
            }
            for (name, values) in names.1.iter().zip(samples.outside) {
                events.push(SampledConditional {
                    event: name.clone(),
                    bound: true,
                    in_target: false,
                    probability: values.probability,
                    occurred: values.occurred,
                    not_occurred: values.not_occurred,
                });
            }
            scenario.sequences[position].sampled = SampledTarget {
                total: samples.total,
                events,
            };
        }
    }
    for scenario in &mut scenarios {
        for (group, entry) in groups.iter().zip(scenario.groups.iter_mut()) {
            let parts: Vec<&SampledTarget> = scenario
                .sequences
                .iter()
                .filter(|sequence| group.sequence_ids.contains(&sequence.id))
                .map(|sequence| &sequence.sampled)
                .collect();
            entry.sampled = SampledTarget::sum(&parts);
        }
    }
    Ok(SampledDependencyImportance {
        scenarios,
        scenario_indices: point.scenario_indices,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::event::BasicEvent;
    use crate::core::event_tree::{Branch, BranchTarget, Fork, FunctionalEvent, Path, Sequence};
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::hcl::{CanonicalBayesianNetwork, CanonicalBayesianVariable, HclBindingSpec};

    fn either(id: &str, events: [(&str, f64); 2]) -> FaultTree {
        let top_id = format!("{id}-TOP");
        let mut tree = FaultTree::new(id, &top_id).unwrap();
        let mut top = Gate::new(top_id, Formula::Or).unwrap();
        for (event, probability) in events {
            top.add_operand(event.to_string());
            tree.add_basic_event(BasicEvent::new(event.to_string(), probability).unwrap())
                .unwrap();
        }
        tree.add_gate(top).unwrap();
        tree
    }

    fn path(outcome: &str, target: BranchTarget) -> Path {
        Path::new(outcome.to_string(), Branch::new(target))
            .unwrap()
            .with_collect_formula_negated(outcome == "success")
    }

    fn case() -> (Model, EventTree, EventTreeHclContext) {
        let mut model = Model::new("M").unwrap();
        model
            .add_fault_tree(either("FT-A", [("A1", 0.3), ("X", 0.1)]))
            .unwrap();
        model
            .add_fault_tree(either("FT-B", [("B1", 0.3), ("Y", 0.2)]))
            .unwrap();
        let second = Fork::new(
            "FE-B".to_string(),
            vec![
                path("success", BranchTarget::Sequence("SS".to_string())),
                path("failure", BranchTarget::Sequence("SF".to_string())),
            ],
        )
        .unwrap();
        let first = Fork::new(
            "FE-A".to_string(),
            vec![
                path("success", BranchTarget::Fork(second)),
                path("failure", BranchTarget::Sequence("F".to_string())),
            ],
        )
        .unwrap();
        let mut event_tree =
            EventTree::new("ET".to_string(), Branch::new(BranchTarget::Fork(first)));
        for (id, tree) in [("FE-A", "FT-A"), ("FE-B", "FT-B")] {
            event_tree
                .add_functional_event(
                    FunctionalEvent::new(id.to_string()).with_fault_tree(tree.to_string()),
                )
                .unwrap();
        }
        for id in ["SS", "SF", "F"] {
            event_tree
                .add_sequence(Sequence::new(id.to_string()))
                .unwrap();
        }
        let component = |name: &str, low: f64, high: f64| CanonicalBayesianVariable {
            name: name.to_string(),
            states: vec!["F".to_string(), "T".to_string()],
            parents: vec!["H".to_string()],
            probabilities: vec![1.0 - low, low, 1.0 - high, high],
        };
        let network = CanonicalBayesianNetwork {
            id: None,
            variables: vec![
                CanonicalBayesianVariable {
                    name: "H".to_string(),
                    states: vec!["LOW".to_string(), "HIGH".to_string()],
                    parents: vec![],
                    probabilities: vec![0.9, 0.1],
                },
                component("NA", 0.01, 0.5),
                component("NB", 0.02, 0.6),
            ],
        }
        .into_graph()
        .unwrap();
        let binding = |event: &str, node: &str| HclBindingSpec {
            event: event.to_string(),
            node: node.to_string(),
            true_states: vec!["T".to_string()],
        };
        let context = EventTreeHclContext::new(network)
            .unwrap()
            .with_bindings(vec![binding("A1", "NA"), binding("B1", "NB")]);
        (model, event_tree, context)
    }

    fn hazard(state: &str) -> Vec<HclEvidenceSpec> {
        vec![HclEvidenceSpec {
            node: "H".to_string(),
            state: state.to_string(),
        }]
    }

    fn close(left: f64, right: f64) -> bool {
        (left - right).abs() < 1e-13
    }

    fn sequence<'a>(rows: &'a [SequenceConditionals], id: &str) -> &'a TargetConditionals {
        &rows
            .iter()
            .find(|row| row.sequence_id == id)
            .unwrap()
            .conditionals
    }

    fn event<'a>(target: &'a TargetConditionals, name: &str) -> &'a crate::hcl::EventConditional {
        target
            .events
            .iter()
            .find(|event| event.event == name)
            .unwrap()
    }

    #[test]
    fn a_bound_event_outside_a_sequence_still_moves_it_through_the_network() {
        let (model, event_tree, context) = case();
        let run = base_event_tree_dependency_importance(&model, &event_tree, &context).unwrap();
        let rows = &run.scenarios[0];
        let failed = sequence(rows, "F");
        let a_given_b = (0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6) / (0.9 * 0.02 + 0.1 * 0.6);
        let a_given_not_b = (0.9 * 0.01 * 0.98 + 0.1 * 0.5 * 0.4) / (0.9 * 0.98 + 0.1 * 0.4);
        let outside = event(failed, "B1");
        assert!(outside.bound && !outside.in_target);
        assert!(close(outside.probability, 0.9 * 0.02 + 0.1 * 0.6));
        assert!(close(
            outside.occurred.unwrap(),
            1.0 - (1.0 - a_given_b) * 0.9
        ));
        assert!(close(
            outside.not_occurred.unwrap(),
            1.0 - (1.0 - a_given_not_b) * 0.9
        ));
        assert!(failed.events.iter().all(|event| event.event != "Y"));
        let listed: Vec<String> = failed.measures().into_iter().map(|row| row.event).collect();
        assert_eq!(listed, ["A1", "X"]);
        let own = event(failed, "X");
        assert!(close(own.occurred.unwrap(), 1.0));
        assert!(close(own.not_occurred.unwrap(), 0.9 * 0.01 + 0.1 * 0.5));
    }

    #[test]
    fn the_sequences_of_a_tree_sum_to_one_under_every_condition() {
        let (model, event_tree, context) = case();
        let rows = vec![Vec::new(), hazard("LOW"), hazard("HIGH")];
        let run =
            event_tree_dependency_importance(&model, &event_tree, &context, &rows, None).unwrap();
        for scenario in &run.scenarios {
            let all = sum_of(scenario, &["SS", "SF", "F"]);
            assert!(close(all.total, 1.0));
            assert_eq!(all.events.len(), 4);
            for event in &all.events {
                assert!(event.in_target);
                assert!(close(event.occurred.unwrap(), 1.0), "{}", event.event);
                assert!(close(event.not_occurred.unwrap(), 1.0), "{}", event.event);
            }
            let damage = sum_of(scenario, &["SF", "F"]);
            let safe = sequence(scenario, "SS");
            assert!(close(damage.total, 1.0 - safe.total));
            for event in &damage.events {
                let other = super::tests::event(safe, &event.event);
                assert!(close(
                    event.occurred.unwrap(),
                    1.0 - other.occurred.unwrap()
                ));
                assert!(close(
                    event.not_occurred.unwrap(),
                    1.0 - other.not_occurred.unwrap()
                ));
            }
        }
    }

    #[test]
    fn the_hazard_mixture_equals_the_run_without_hazard_evidence() {
        let (model, event_tree, context) = case();
        let rows = vec![hazard("LOW"), hazard("HIGH")];
        let grid =
            event_tree_dependency_importance(&model, &event_tree, &context, &rows, Some(&rows))
                .unwrap();
        let plain = base_event_tree_dependency_importance(&model, &event_tree, &context).unwrap();
        for ids in [vec!["F"], vec!["SF"], vec!["SF", "F"]] {
            let mixed = grid.weighted(&ids).unwrap();
            let direct = sum_of(&plain.scenarios[0], &ids);
            assert!(close(mixed.total, direct.total));
            for (left, right) in mixed.events.iter().zip(&direct.events) {
                assert_eq!(left.event, right.event);
                assert!(close(left.probability, right.probability));
                assert!(
                    close(left.occurred.unwrap(), right.occurred.unwrap()),
                    "{}",
                    left.event
                );
                assert!(close(
                    left.not_occurred.unwrap(),
                    right.not_occurred.unwrap()
                ));
            }
        }
        assert!(plain.weighted(&["F"]).is_none());
    }

    fn uncertain() -> crate::hcl::HclUncertaintySettings {
        use crate::core::distribution::{
            Law, UncertainExpression, UncertainUnit, UncertainValue, UncertainVector, VectorLaw,
        };
        let row = |node: &str, row_index: usize, concentrations: [f64; 2]| {
            crate::hcl::HclCptRowUncertainty {
                node: node.to_string(),
                row_index,
                row: UncertainVector::Value {
                    law: VectorLaw::Dirichlet {
                        concentrations: concentrations.to_vec(),
                    },
                },
            }
        };
        let event = |name: &str, lower: f64, upper: f64| crate::hcl::HclBasicEventUncertainty {
            event: name.to_string(),
            expression: UncertainExpression::Value {
                value: UncertainValue {
                    unit: UncertainUnit::Probability,
                    law: Law::Uniform { lower, upper },
                },
            },
        };
        crate::hcl::HclUncertaintySettings {
            sample_count: 9,
            seed: 5,
            sampler: crate::hcl::HclSampler::MonteCarlo,
            cpt_sampler: None,
            correlation: Default::default(),
            clip_probabilities: false,
            cpt_clip_epsilon: 0.0,
            zero_probability_contexts: Default::default(),
            basic_events: vec![event("X", 0.05, 0.15), event("Y", 0.1, 0.3)],
            cpt_rows: vec![
                row("H", 0, [18.0, 2.0]),
                row("NA", 0, [99.0, 1.0]),
                row("NA", 1, [5.0, 5.0]),
                row("NB", 0, [49.0, 1.0]),
                row("NB", 1, [4.0, 6.0]),
            ],
            cpt_generators: Vec::new(),
            uncertainty_parameters: Vec::new(),
            uncertainty_vectors: Vec::new(),
        }
    }

    #[test]
    fn sampled_importance_keeps_the_sequence_identities_in_every_sample() {
        let (model, event_tree, context) = case();
        let context = context.with_uncertainty(Some(uncertain()));
        let groups = vec![
            EventTreeUnion {
                id: "ALL".to_string(),
                sequence_ids: vec!["SS".to_string(), "SF".to_string(), "F".to_string()],
            },
            EventTreeUnion {
                id: "DAMAGE".to_string(),
                sequence_ids: vec!["SF".to_string(), "F".to_string()],
            },
        ];
        let rows = vec![Vec::new(), hazard("HIGH")];
        let run = event_tree_sampled_importance(&model, &event_tree, &context, &rows, &groups, 4)
            .unwrap();
        let plain =
            crate::analysis::event_tree_quantification::quantify_event_tree_sequences_batch(
                &model,
                &event_tree,
                Some(&context),
                &rows,
            )
            .unwrap();
        assert_eq!(run.scenario_indices, [0, 1]);
        for (scenario, reference) in run.scenarios.iter().zip(&plain.scenarios) {
            let find = |id: &str| scenario.sequences.iter().find(|row| row.id == id).unwrap();
            for row in &scenario.sequences {
                let samples = reference
                    .iter()
                    .find(|entry| entry.sequence_id == row.id)
                    .and_then(|entry| entry.uncertainty_samples.as_ref())
                    .unwrap();
                assert!(samples.windows(2).any(|pair| pair[0] != pair[1]));
                for (left, right) in row.sampled.total.iter().zip(samples) {
                    assert!((left - right).abs() < 1e-14);
                }
                for event in row.sampled.events.iter().filter(|event| event.in_target) {
                    for sample in 0..samples.len() {
                        let (chance, with, without) = (
                            event.probability[sample],
                            event.occurred[sample],
                            event.not_occurred[sample],
                        );
                        if with.is_finite() && without.is_finite() {
                            assert!(close(
                                chance * with + (1.0 - chance) * without,
                                samples[sample]
                            ));
                        }
                    }
                }
            }
            let all = &scenario.groups[0];
            assert_eq!(all.leading.len(), 4);
            for event in &all.sampled.events {
                for sample in 0..9 {
                    assert!(close(all.sampled.total[sample], 1.0));
                    for value in [event.occurred[sample], event.not_occurred[sample]] {
                        assert!(
                            value.is_nan() || close(value, 1.0),
                            "{} {value}",
                            event.event
                        );
                    }
                }
            }
            let damage = &scenario.groups[1];
            let safe = &find("SS").sampled;
            for event in &damage.sampled.events {
                let other = safe
                    .events
                    .iter()
                    .find(|entry| entry.event == event.event)
                    .unwrap();
                for sample in 0..9 {
                    assert!(close(
                        damage.sampled.total[sample],
                        1.0 - safe.total[sample]
                    ));
                    if event.occurred[sample].is_finite() {
                        assert!(close(event.occurred[sample], 1.0 - other.occurred[sample]));
                    }
                }
            }
            let rows = damage.sampled.measures(&damage.leading);
            assert_eq!(rows.len(), 4);
            for row in &rows {
                if let Some(summary) = row.fussell_vesely {
                    assert!(summary.percentile_05 <= summary.median);
                    assert!(summary.median <= summary.percentile_95);
                    assert!(summary.sample_count <= 9);
                }
            }
        }
        let outside = run.scenarios[0]
            .sequences
            .iter()
            .find(|row| row.id == "F")
            .unwrap()
            .sampled
            .events
            .iter()
            .find(|event| event.event == "B1")
            .unwrap();
        assert!(outside.bound && !outside.in_target);
        assert!(outside
            .occurred
            .iter()
            .zip(&outside.not_occurred)
            .all(|(with, without)| with > without));
        assert!(
            event_tree_sampled_importance(&model, &event_tree, &context, &rows, &groups, 0)
                .is_err()
        );
    }
}
