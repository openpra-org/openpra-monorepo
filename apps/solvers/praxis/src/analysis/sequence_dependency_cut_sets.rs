use std::collections::HashMap;

use tensorbayes::{CompileHeuristic, CompiledJunctionTree, StateIndex};

use crate::algorithms::build::build_sequence_bdd_with_successes;
use crate::algorithms::pdag::PdagNode;
use crate::algorithms::zbdd_engine::ZbddEngine;
use crate::analysis::event_tree_quantification::EventTreeHclContext;
use crate::analysis::sequence_formula::SequenceFormulaBuilder;
use crate::core::event_tree::EventTree;
use crate::core::model::Model;
use crate::hcl::{
    conditional_evidence_probabilities_for_network, occurrence_bounds, prepare_hazard_evidence,
    resolve_evidence, CauseShift, CauseTracer, HclEventBinding, HclEventBindings, HclEvidenceSpec,
    HclQuantifier, OccurrenceBounds,
};
use crate::{PraxisError, Result};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DependencyCutSetScore {
    FailedEvents,
    FailedEventsAndSequence,
}

#[derive(Clone, Debug, PartialEq)]
pub struct DependencyCutSetSettings {
    pub score: DependencyCutSetScore,
    pub limit_order: Option<usize>,
    pub cut_off: Option<f64>,
    pub keep: usize,
    pub causes: usize,
}

#[derive(Clone, Debug, PartialEq)]
pub struct RankedCutSet {
    pub events: Vec<String>,
    pub probability: f64,
    pub causes: Vec<CauseShift>,
}

pub(crate) fn trace_causes(
    tracer: &mut CauseTracer,
    cut_sets: &mut [RankedCutSet],
    keep: usize,
) -> Result<()> {
    for cut_set in cut_sets {
        if cut_set.probability > 0.0 {
            cut_set.causes = tracer.shifts(&cut_set.events, keep)?;
        }
    }
    Ok(())
}

#[derive(Clone, Debug, PartialEq)]
pub struct SequenceRankedCutSets {
    pub sequence_id: String,
    pub total: usize,
    pub cut_sets: Vec<RankedCutSet>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct DependencyCutSetRanking {
    pub scenarios: Vec<Vec<SequenceRankedCutSets>>,
    pub scenario_indices: Vec<usize>,
    pub raw_weights: Option<Vec<f64>>,
    pub weighted: Option<Vec<SequenceRankedCutSets>>,
}

impl DependencyCutSetSettings {
    pub fn validate(&self) -> Result<()> {
        if self.limit_order == Some(0) {
            return Err(PraxisError::Settings(
                "the cut set order limit must be at least 1".to_string(),
            ));
        }
        if self
            .cut_off
            .is_some_and(|value| !(value > 0.0 && value <= 1.0))
        {
            return Err(PraxisError::Settings(
                "the cut set probability cut-off must be above 0 and at most 1".to_string(),
            ));
        }
        if self.keep == 0 {
            return Err(PraxisError::Settings(
                "the number of cut sets kept must be at least 1".to_string(),
            ));
        }
        Ok(())
    }
}

pub(crate) fn reaches(cut_off: Option<f64>, values: &[f64]) -> Vec<bool> {
    values
        .iter()
        .map(|&value| cut_off.is_none_or(|limit| value >= limit))
        .collect()
}

pub(crate) fn ranked_list(
    structure: &[Vec<String>],
    values: &[f64],
    kept: &[bool],
    keep: usize,
) -> (usize, Vec<RankedCutSet>) {
    let chosen: Vec<RankedCutSet> = structure
        .iter()
        .zip(values)
        .zip(kept)
        .filter(|(_, &kept)| kept)
        .map(|((events, &probability), _)| RankedCutSet {
            events: events.clone(),
            probability,
            causes: Vec::new(),
        })
        .collect();
    (chosen.len(), rank(chosen, keep))
}

fn rank(mut cut_sets: Vec<RankedCutSet>, keep: usize) -> Vec<RankedCutSet> {
    cut_sets.sort_by(|left, right| {
        right
            .probability
            .total_cmp(&left.probability)
            .then_with(|| left.events.len().cmp(&right.events.len()))
            .then_with(|| left.events.cmp(&right.events))
    });
    cut_sets.truncate(keep);
    cut_sets
}

fn sequence_structures(
    model: &Model,
    event_tree: &EventTree,
    limit_order: Option<usize>,
    truncation: Option<(&OccurrenceBounds, f64)>,
) -> Result<HashMap<String, Vec<Vec<String>>>> {
    let formulas = SequenceFormulaBuilder::new(model)
        .with_delete_term(true)
        .build(event_tree, 1.0)?;
    let mut pdag = formulas.pdag;
    let mut weights = formulas.event_probs;
    let mut structure_cut_off = None;
    if let Some((bounds, cut_off)) = truncation {
        for (event, &bound) in &bounds.events {
            if let Some(weight) = weights.get_mut(event) {
                *weight = bound;
            }
        }
        structure_cut_off = bounds.structure_cut_off(cut_off);
    }
    let mut structures = HashMap::with_capacity(event_tree.sequences.len());
    for sequence_id in event_tree.sequences.keys() {
        if formulas.unconditional.contains(sequence_id) {
            structures.insert(sequence_id.clone(), vec![Vec::new()]);
            continue;
        }
        let root = formulas
            .sequence_roots
            .get(sequence_id)
            .copied()
            .ok_or_else(|| {
                PraxisError::Logic(format!(
                    "event-tree sequence '{sequence_id}' has no Boolean formula"
                ))
            })?;
        let successes = formulas
            .sequence_success_roots
            .get(sequence_id)
            .cloned()
            .unwrap_or_default();
        let (order, mut bdd, bdd_root, delete_roots) =
            build_sequence_bdd_with_successes(&mut pdag, &weights, root, &successes, sequence_id)?;
        bdd.freeze();
        let (zbdd, zbdd_root) = ZbddEngine::build_from_bdd_with_delete_terms(
            &bdd,
            bdd_root,
            &delete_roots,
            false,
            limit_order,
            structure_cut_off,
            1.0,
        );
        let mut cut_sets = Vec::new();
        for positions in zbdd.enumerate(zbdd_root) {
            let mut events = Vec::with_capacity(positions.len());
            for position in positions {
                let name = order
                    .get(position)
                    .and_then(|&index| pdag.get_node(index))
                    .and_then(|node| node.id())
                    .ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "sequence '{sequence_id}' produced a cut set variable with no event"
                        ))
                    })?;
                events.push(name.to_string());
            }
            events.sort();
            cut_sets.push(events);
        }
        structures.insert(sequence_id.clone(), cut_sets);
    }
    Ok(structures)
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

pub fn rank_base_event_tree_dependency_cut_sets(
    model: &Model,
    event_tree: &EventTree,
    hcl: &EventTreeHclContext,
    settings: &DependencyCutSetSettings,
) -> Result<DependencyCutSetRanking> {
    let rows = [hcl.base_evidence().to_vec()];
    rank_event_tree_dependency_cut_sets(model, event_tree, hcl, &rows, None, settings)
}

pub fn rank_event_tree_dependency_cut_sets(
    model: &Model,
    event_tree: &EventTree,
    hcl: &EventTreeHclContext,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: Option<&[Vec<HclEvidenceSpec>]>,
    settings: &DependencyCutSetSettings,
) -> Result<DependencyCutSetRanking> {
    settings.validate()?;
    if evidence_rows.is_empty() {
        return Err(PraxisError::Hcl(
            "a dependency cut set run requires at least one evidence row".to_string(),
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
    let bounds = settings
        .cut_off
        .map(|_| {
            let active: Vec<&[HclEvidenceSpec]> = scenario_indices
                .iter()
                .map(|&index| evidence_rows[index].as_slice())
                .collect();
            occurrence_bounds(network, &tree, hcl.bindings(), &active)
        })
        .transpose()?;
    let structures = sequence_structures(
        model,
        event_tree,
        settings.limit_order,
        bounds.as_ref().zip(settings.cut_off),
    )?;
    let formulas = SequenceFormulaBuilder::new(model).build(event_tree, 1.0)?;
    let mut pdag = formulas.pdag;
    let mut sequence_ids: Vec<String> = event_tree.sequences.keys().cloned().collect();
    sequence_ids.sort();
    let mut scenarios = vec![Vec::with_capacity(sequence_ids.len()); scenario_indices.len()];
    let mut weighted = raw_weights
        .as_ref()
        .map(|_| Vec::with_capacity(sequence_ids.len()));
    for sequence_id in sequence_ids {
        let structure = &structures[&sequence_id];
        let total = structure.len();
        let mut scores = vec![vec![1.0; total]; scenario_indices.len()];
        if !formulas.unconditional.contains(&sequence_id) && !scenario_indices.is_empty() {
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
            let variable_of: HashMap<&str, usize> = order
                .iter()
                .enumerate()
                .filter_map(|(variable, index)| match pdag.get_node(*index) {
                    Some(PdagNode::BasicEvent { id, .. }) => Some((id.as_str(), variable)),
                    _ => None,
                })
                .collect();
            let mut bindings = HclEventBindings::new();
            for spec in hcl.bindings() {
                let Some(&variable) = variable_of.get(spec.event.as_str()) else {
                    continue;
                };
                let node = network.node_id(&spec.node)?;
                let states = true_states(
                    network.variable(node)?.states(),
                    &spec.true_states,
                    &spec.node,
                )?;
                bindings.insert(HclEventBinding::new(variable, node, states)?)?;
            }
            let mut variables = Vec::with_capacity(total);
            for events in structure {
                let mut cut_set = Vec::with_capacity(events.len());
                for event in events {
                    cut_set.push(variable_of.get(event.as_str()).copied().ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "cut set event '{event}' is not in sequence '{sequence_id}'"
                        ))
                    })?);
                }
                variables.push(cut_set);
            }
            let first = resolve_evidence(network, &evidence_rows[scenario_indices[0]])?;
            let mut quantifier = HclQuantifier::new(&bdd, tree.clone(), bindings, first)?;
            for (position, &scenario) in scenario_indices.iter().enumerate() {
                if position > 0 {
                    quantifier
                        .set_base_evidence(resolve_evidence(network, &evidence_rows[scenario])?)?;
                }
                for (score, cut_set) in scores[position].iter_mut().zip(&variables) {
                    *score = match settings.score {
                        DependencyCutSetScore::FailedEvents => {
                            quantifier.joint_occurrence(cut_set)?
                        }
                        DependencyCutSetScore::FailedEventsAndSequence => {
                            quantifier.joint_occurrence_with(bdd_root, cut_set)?
                        }
                    };
                }
            }
        }
        let ranked = |values: &[f64], kept: &[bool]| {
            let (total, cut_sets) = ranked_list(structure, values, kept, settings.keep);
            SequenceRankedCutSets {
                sequence_id: sequence_id.clone(),
                total,
                cut_sets,
            }
        };
        let mut in_any = vec![settings.cut_off.is_none(); total];
        for (position, values) in scores.iter().enumerate() {
            let kept = reaches(settings.cut_off, values);
            for (any, &kept) in in_any.iter_mut().zip(&kept) {
                *any = *any || kept;
            }
            scenarios[position].push(ranked(values, &kept));
        }
        if let (Some(weights), Some(rows)) = (raw_weights.as_ref(), weighted.as_mut()) {
            let mut sums = vec![0.0; total];
            for (position, &scenario) in scenario_indices.iter().enumerate() {
                for (sum, score) in sums.iter_mut().zip(&scores[position]) {
                    *sum += weights[scenario] * score;
                }
            }
            rows.push(ranked(&sums, &in_any));
        }
    }
    if settings.causes > 0 && !scenario_indices.is_empty() {
        let first = resolve_evidence(network, &evidence_rows[scenario_indices[0]])?;
        let mut tracer = CauseTracer::new(network, tree, hcl.bindings(), first)?;
        for (position, &scenario) in scenario_indices.iter().enumerate() {
            if position > 0 {
                tracer.set_evidence(resolve_evidence(network, &evidence_rows[scenario])?)?;
            }
            for sequence in &mut scenarios[position] {
                trace_causes(&mut tracer, &mut sequence.cut_sets, settings.causes)?;
            }
        }
    }
    Ok(DependencyCutSetRanking {
        scenarios,
        scenario_indices,
        raw_weights,
        weighted,
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

    fn either_event_tree(id: &str, events: [(&str, f64); 2]) -> FaultTree {
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

    fn case() -> (Model, EventTree, EventTreeHclContext) {
        let mut model = Model::new("M").unwrap();
        model
            .add_fault_tree(either_event_tree("FT-A", [("A1", 0.3), ("X", 0.1)]))
            .unwrap();
        model
            .add_fault_tree(either_event_tree("FT-B", [("B1", 0.3), ("Y", 0.2)]))
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
        for (event, tree) in [("FE-A", "FT-A"), ("FE-B", "FT-B")] {
            event_tree
                .add_functional_event(
                    FunctionalEvent::new(event.to_string()).with_fault_tree(tree.to_string()),
                )
                .unwrap();
        }
        for id in ["SS", "SF", "FS", "FF"] {
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

    fn settings(score: DependencyCutSetScore) -> DependencyCutSetSettings {
        DependencyCutSetSettings {
            score,
            limit_order: None,
            cut_off: None,
            keep: 10,
            causes: 0,
        }
    }

    fn check(sequence: &SequenceRankedCutSets, expected: &[(&[&str], f64)]) {
        assert_eq!(sequence.total, expected.len(), "{}", sequence.sequence_id);
        assert_eq!(sequence.cut_sets.len(), expected.len());
        for (cut_set, (events, probability)) in sequence.cut_sets.iter().zip(expected) {
            assert_eq!(cut_set.events, *events, "{}", sequence.sequence_id);
            assert!(
                (cut_set.probability - probability).abs() < 1e-15,
                "{} {:?}: {} is not {probability}",
                sequence.sequence_id,
                cut_set.events,
                cut_set.probability
            );
        }
    }

    fn sequence<'a>(rows: &'a [SequenceRankedCutSets], id: &str) -> &'a SequenceRankedCutSets {
        rows.iter().find(|row| row.sequence_id == id).unwrap()
    }

    #[test]
    fn dependence_and_evidence_change_the_ranking() {
        let (model, event_tree, context) = case();
        let rows = vec![Vec::new(), hazard("LOW"), hazard("HIGH")];
        let ranking = rank_event_tree_dependency_cut_sets(
            &model,
            &event_tree,
            &context,
            &rows,
            None,
            &settings(DependencyCutSetScore::FailedEvents),
        )
        .unwrap();
        assert_eq!(ranking.scenario_indices, [0, 1, 2]);
        assert!(ranking.raw_weights.is_none() && ranking.weighted.is_none());
        check(
            sequence(&ranking.scenarios[0], "FF"),
            &[
                (&["A1", "B1"], 0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6),
                (&["X", "Y"], 0.1 * 0.2),
                (&["A1", "Y"], (0.9 * 0.01 + 0.1 * 0.5) * 0.2),
                (&["B1", "X"], (0.9 * 0.02 + 0.1 * 0.6) * 0.1),
            ],
        );
        check(
            sequence(&ranking.scenarios[1], "FF"),
            &[
                (&["X", "Y"], 0.1 * 0.2),
                (&["A1", "Y"], 0.01 * 0.2),
                (&["B1", "X"], 0.02 * 0.1),
                (&["A1", "B1"], 0.01 * 0.02),
            ],
        );
        check(
            sequence(&ranking.scenarios[2], "FF"),
            &[
                (&["A1", "B1"], 0.5 * 0.6),
                (&["A1", "Y"], 0.5 * 0.2),
                (&["B1", "X"], 0.6 * 0.1),
                (&["X", "Y"], 0.1 * 0.2),
            ],
        );
        check(
            sequence(&ranking.scenarios[0], "SF"),
            &[(&["Y"], 0.2), (&["B1"], 0.9 * 0.02 + 0.1 * 0.6)],
        );
    }

    #[test]
    fn the_sequence_score_includes_the_success_branches() {
        let (model, event_tree, context) = case();
        let ranking = rank_event_tree_dependency_cut_sets(
            &model,
            &event_tree,
            &context,
            &[Vec::new()],
            None,
            &settings(DependencyCutSetScore::FailedEventsAndSequence),
        )
        .unwrap();
        let no_a1 = 0.9 * 0.99 + 0.1 * 0.5;
        check(
            sequence(&ranking.scenarios[0], "SF"),
            &[
                (&["Y"], 0.2 * no_a1 * 0.9),
                (&["B1"], (0.9 * 0.02 * 0.99 + 0.1 * 0.6 * 0.5) * 0.9),
            ],
        );
        check(
            sequence(&ranking.scenarios[0], "FF"),
            &[
                (&["A1", "B1"], 0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6),
                (&["X", "Y"], 0.1 * 0.2),
                (&["A1", "Y"], (0.9 * 0.01 + 0.1 * 0.5) * 0.2),
                (&["B1", "X"], (0.9 * 0.02 + 0.1 * 0.6) * 0.1),
            ],
        );
    }

    #[test]
    fn hazard_weighted_ranking_equals_the_unconditioned_ranking() {
        let (model, event_tree, context) = case();
        let rows = vec![hazard("LOW"), hazard("HIGH")];
        let weighted = rank_event_tree_dependency_cut_sets(
            &model,
            &event_tree,
            &context,
            &rows,
            Some(&rows),
            &settings(DependencyCutSetScore::FailedEvents),
        )
        .unwrap();
        let weights = weighted.raw_weights.as_ref().unwrap();
        assert!((weights[0] - 0.9).abs() < 1e-15 && (weights[1] - 0.1).abs() < 1e-15);
        let plain = rank_event_tree_dependency_cut_sets(
            &model,
            &event_tree,
            &context,
            &[Vec::new()],
            None,
            &settings(DependencyCutSetScore::FailedEvents),
        )
        .unwrap();
        for id in ["FF", "SF", "FS"] {
            let left = sequence(weighted.weighted.as_ref().unwrap(), id);
            let right = sequence(&plain.scenarios[0], id);
            assert_eq!(left.total, right.total);
            for (a, b) in left.cut_sets.iter().zip(&right.cut_sets) {
                assert_eq!(a.events, b.events);
                assert!((a.probability - b.probability).abs() < 1e-15);
            }
        }
    }

    #[test]
    fn order_limit_and_kept_count_are_applied() {
        let (model, event_tree, context) = case();
        let limited = rank_event_tree_dependency_cut_sets(
            &model,
            &event_tree,
            &context,
            &[Vec::new()],
            None,
            &DependencyCutSetSettings {
                score: DependencyCutSetScore::FailedEvents,
                limit_order: Some(1),
                cut_off: None,
                keep: 1,
                causes: 0,
            },
        )
        .unwrap();
        assert_eq!(sequence(&limited.scenarios[0], "FF").total, 0);
        let single = sequence(&limited.scenarios[0], "SF");
        assert_eq!(single.total, 2);
        assert_eq!(single.cut_sets.len(), 1);
        assert_eq!(single.cut_sets[0].events, ["Y"]);
        for bad in [
            (Some(0), None, 1),
            (None, None, 0),
            (None, Some(0.0), 1),
            (None, Some(1.5), 1),
            (None, Some(f64::NAN), 1),
        ] {
            assert!(rank_event_tree_dependency_cut_sets(
                &model,
                &event_tree,
                &context,
                &[Vec::new()],
                None,
                &DependencyCutSetSettings {
                    score: DependencyCutSetScore::FailedEvents,
                    limit_order: bad.0,
                    cut_off: bad.1,
                    keep: bad.2,
                    causes: 0,
                },
            )
            .is_err());
        }
    }

    fn cut(score: DependencyCutSetScore, cut_off: f64) -> DependencyCutSetSettings {
        DependencyCutSetSettings {
            score,
            limit_order: None,
            cut_off: Some(cut_off),
            keep: 10,
            causes: 0,
        }
    }

    #[test]
    fn cut_off_keeps_the_cut_sets_that_reach_it_under_the_network() {
        let (model, event_tree, context) = case();
        let base = rank_event_tree_dependency_cut_sets(
            &model,
            &event_tree,
            &context,
            &[Vec::new()],
            None,
            &cut(DependencyCutSetScore::FailedEvents, 0.015),
        )
        .unwrap();
        check(
            sequence(&base.scenarios[0], "FF"),
            &[
                (&["A1", "B1"], 0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6),
                (&["X", "Y"], 0.1 * 0.2),
            ],
        );
        let rows = vec![hazard("LOW"), hazard("HIGH")];
        let grid = rank_event_tree_dependency_cut_sets(
            &model,
            &event_tree,
            &context,
            &rows,
            Some(&rows),
            &cut(DependencyCutSetScore::FailedEvents, 0.05),
        )
        .unwrap();
        check(sequence(&grid.scenarios[0], "FF"), &[]);
        check(
            sequence(&grid.scenarios[1], "FF"),
            &[
                (&["A1", "B1"], 0.5 * 0.6),
                (&["A1", "Y"], 0.5 * 0.2),
                (&["B1", "X"], 0.6 * 0.1),
            ],
        );
        check(
            sequence(grid.weighted.as_ref().unwrap(), "FF"),
            &[
                (&["A1", "B1"], 0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6),
                (&["A1", "Y"], (0.9 * 0.01 + 0.1 * 0.5) * 0.2),
                (&["B1", "X"], (0.9 * 0.02 + 0.1 * 0.6) * 0.1),
            ],
        );
    }

    #[test]
    fn cut_off_gives_the_same_list_as_filtering_the_full_ranking() {
        let (model, event_tree, context) = case();
        let rows = vec![Vec::new(), hazard("LOW"), hazard("HIGH")];
        for score in [
            DependencyCutSetScore::FailedEvents,
            DependencyCutSetScore::FailedEventsAndSequence,
        ] {
            let full = rank_event_tree_dependency_cut_sets(
                &model,
                &event_tree,
                &context,
                &rows,
                None,
                &settings(score),
            )
            .unwrap();
            for step in 1..=60 {
                let cut_off = 10f64.powf(-f64::from(step) / 12.0);
                let limited = rank_event_tree_dependency_cut_sets(
                    &model,
                    &event_tree,
                    &context,
                    &rows,
                    None,
                    &cut(score, cut_off),
                )
                .unwrap();
                for (all, some) in full.scenarios.iter().zip(&limited.scenarios) {
                    for (left, right) in all.iter().zip(some) {
                        let wanted: Vec<&RankedCutSet> = left
                            .cut_sets
                            .iter()
                            .filter(|cut_set| cut_set.probability >= cut_off)
                            .collect();
                        assert_eq!(right.total, wanted.len(), "{} {cut_off}", left.sequence_id);
                        for (a, b) in wanted.iter().zip(&right.cut_sets) {
                            assert_eq!(a.events, b.events);
                            assert_eq!(a.probability.to_bits(), b.probability.to_bits());
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn cause_trace_is_attached_to_the_cut_sets_of_each_sequence() {
        let (model, event_tree, context) = case();
        let traced = DependencyCutSetSettings {
            causes: 2,
            ..settings(DependencyCutSetScore::FailedEvents)
        };
        let rows = vec![Vec::new(), hazard("HIGH")];
        let ranking = rank_event_tree_dependency_cut_sets(
            &model,
            &event_tree,
            &context,
            &rows,
            None,
            &traced,
        )
        .unwrap();
        let both = &sequence(&ranking.scenarios[0], "FF").cut_sets[0];
        assert_eq!(both.events, ["A1", "B1"]);
        let high = 0.1 * 0.5 * 0.6 / (0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6);
        assert_eq!(both.causes.len(), 1);
        assert_eq!(both.causes[0].node, "H");
        assert!((both.causes[0].distance - (high - 0.1)).abs() < 1e-12);
        let free = &sequence(&ranking.scenarios[0], "FF").cut_sets[1];
        assert_eq!(free.events, ["X", "Y"]);
        assert!(free.causes.is_empty());
        for row in &ranking.scenarios[1] {
            assert!(row.cut_sets.iter().all(|cut_set| cut_set.causes.is_empty()));
        }
    }
}
