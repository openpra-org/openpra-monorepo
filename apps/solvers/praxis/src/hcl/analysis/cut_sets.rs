use std::time::Duration;

use tensorbayes::{CompileHeuristic, CompiledJunctionTree};

use crate::algorithms::build::{build_bdd_with_order, BuildOptions};
use crate::algorithms::pdag::PdagNode;
use crate::algorithms::zbdd_engine::ZbddEngine;
use crate::analysis::sequence_dependency_cut_sets::{
    ranked_list, reaches, trace_causes, DependencyCutSetScore, DependencyCutSetSettings,
    RankedCutSet,
};
use crate::hcl::{
    conditional_evidence_probabilities_for_network, occurrence_bounds, prepare_hazard_evidence,
    resolve_evidence, source_fault_tree_order, CauseTracer, HclAnalysisSettings, HclEventBinding,
    HclEventBindings, HclEvidenceSpec, HclModel, HclQuantifier,
};
use crate::{PraxisError, Result};

use super::resolve_states;

#[derive(Clone, Debug, PartialEq)]
pub struct FaultTreeRankedCutSets {
    pub total: usize,
    pub cut_sets: Vec<RankedCutSet>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct HclCutSetRanking {
    pub scenarios: Vec<FaultTreeRankedCutSets>,
    pub scenario_indices: Vec<usize>,
    pub raw_weights: Option<Vec<f64>>,
    pub weighted: Option<FaultTreeRankedCutSets>,
}

pub fn rank_hcl_cut_sets(
    model: &HclModel,
    settings: &HclAnalysisSettings,
    cut_sets: &DependencyCutSetSettings,
) -> Result<HclCutSetRanking> {
    let rows = [model.base_evidence().to_vec()];
    rank_hcl_cut_sets_batch(model, &rows, None, settings, cut_sets)
}

pub fn rank_hcl_cut_sets_batch(
    model: &HclModel,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: Option<&[Vec<HclEvidenceSpec>]>,
    settings: &HclAnalysisSettings,
    cut_sets: &DependencyCutSetSettings,
) -> Result<HclCutSetRanking> {
    cut_sets.validate()?;
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
    let network = model.network();
    network.validate()?;
    let tree = CompiledJunctionTree::compile(network.clone(), CompileHeuristic::MinFill)?;
    let hazard_evidence = hazard_assignment_rows
        .map(|rows| prepare_hazard_evidence(network, model.base_evidence(), evidence_rows, rows))
        .transpose()?;
    let evidence_rows = hazard_evidence.as_deref().unwrap_or(evidence_rows);
    let raw_weights = hazard_assignment_rows
        .map(|_| {
            conditional_evidence_probabilities_for_network(
                network,
                model.base_evidence(),
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
    let empty = || FaultTreeRankedCutSets {
        total: 0,
        cut_sets: Vec::new(),
    };
    if scenario_indices.is_empty() {
        return Ok(HclCutSetRanking {
            scenarios: Vec::new(),
            scenario_indices,
            weighted: raw_weights.as_ref().map(|_| empty()),
            raw_weights,
        });
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
    let mut built = build_bdd_with_order(model.fault_tree(), build_options, &variable_order)?;
    let event_of = |variable: usize| {
        built
            .order
            .get(variable)
            .and_then(|index| match built.pdag.get_node(*index) {
                Some(PdagNode::BasicEvent { id, .. }) => Some(id.clone()),
                _ => None,
            })
    };
    let events: Vec<Option<String>> = (0..built.bdd.variable_count()).map(event_of).collect();

    let probabilities = built.bdd.var_probs().to_vec();
    let mut structure_cut_off = None;
    if let Some(cut_off) = cut_sets.cut_off {
        let active: Vec<&[HclEvidenceSpec]> = scenario_indices
            .iter()
            .map(|&index| evidence_rows[index].as_slice())
            .collect();
        let bounds = occurrence_bounds(network, &tree, model.bindings(), &active)?;
        let mut weights = probabilities.clone();
        for (weight, event) in weights.iter_mut().zip(&events) {
            if let Some(&bound) = event.as_ref().and_then(|event| bounds.events.get(event)) {
                *weight = bound;
            }
        }
        built.bdd.set_var_probs(weights);
        structure_cut_off = bounds.structure_cut_off(cut_off);
    }
    let (zbdd, zbdd_root) = ZbddEngine::build_from_bdd_with_limits(
        &built.bdd,
        built.root,
        false,
        cut_sets.limit_order,
        structure_cut_off,
        1.0,
    );
    built.bdd.set_var_probs(probabilities);
    let variables = zbdd.enumerate(zbdd_root);
    let mut structure = Vec::with_capacity(variables.len());
    for cut_set in &variables {
        let mut names = Vec::with_capacity(cut_set.len());
        for &variable in cut_set {
            names.push(events.get(variable).cloned().flatten().ok_or_else(|| {
                PraxisError::Logic(
                    "the fault tree produced a cut set variable with no event".to_string(),
                )
            })?);
        }
        names.sort();
        structure.push(names);
    }

    let mut bindings = HclEventBindings::new();
    for spec in model.bindings() {
        let node = network.node_id(&spec.node)?;
        let states = resolve_states(
            network.variable(node)?.states(),
            &spec.true_states,
            &spec.node,
        )?;
        bindings.insert(HclEventBinding::for_event(
            &built,
            &spec.event,
            node,
            states,
        )?)?;
    }
    let first = resolve_evidence(network, &evidence_rows[scenario_indices[0]])?;
    let mut quantifier = HclQuantifier::new(&built.bdd, tree.clone(), bindings, first)?;
    let total = structure.len();
    let mut sums = vec![0.0; total];
    let mut in_any = vec![cut_sets.cut_off.is_none(); total];
    let mut scenarios = Vec::with_capacity(scenario_indices.len());
    for (position, &scenario) in scenario_indices.iter().enumerate() {
        if position > 0 {
            quantifier.set_base_evidence(resolve_evidence(network, &evidence_rows[scenario])?)?;
        }
        let mut scores = Vec::with_capacity(total);
        for cut_set in &variables {
            scores.push(match cut_sets.score {
                DependencyCutSetScore::FailedEvents => quantifier.joint_occurrence(cut_set)?,
                DependencyCutSetScore::FailedEventsAndSequence => {
                    quantifier.joint_occurrence_with(built.root, cut_set)?
                }
            });
        }
        let kept = reaches(cut_sets.cut_off, &scores);
        for (any, &kept) in in_any.iter_mut().zip(&kept) {
            *any = *any || kept;
        }
        if let Some(weights) = &raw_weights {
            for (sum, score) in sums.iter_mut().zip(&scores) {
                *sum += weights[scenario] * score;
            }
        }
        let (total, cut_sets) = ranked_list(&structure, &scores, &kept, cut_sets.keep);
        scenarios.push(FaultTreeRankedCutSets { total, cut_sets });
    }
    let weighted = raw_weights.as_ref().map(|_| {
        let (total, cut_sets) = ranked_list(&structure, &sums, &in_any, cut_sets.keep);
        FaultTreeRankedCutSets { total, cut_sets }
    });
    if cut_sets.causes > 0 {
        let first = resolve_evidence(network, &evidence_rows[scenario_indices[0]])?;
        let mut tracer = CauseTracer::new(network, tree, model.bindings(), first)?;
        for (position, &scenario) in scenario_indices.iter().enumerate() {
            if position > 0 {
                tracer.set_evidence(resolve_evidence(network, &evidence_rows[scenario])?)?;
            }
            trace_causes(
                &mut tracer,
                &mut scenarios[position].cut_sets,
                cut_sets.causes,
            )?;
        }
    }
    Ok(HclCutSetRanking {
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
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::hcl::{CanonicalBayesianNetwork, CanonicalBayesianVariable, HclBindingSpec};

    fn model() -> HclModel {
        let mut tree = FaultTree::new("FT", "TOP").unwrap();
        for (event, probability) in [("A1", 0.3), ("B1", 0.3), ("X", 0.1), ("Y", 0.2)] {
            tree.add_basic_event(BasicEvent::new(event.to_string(), probability).unwrap())
                .unwrap();
        }
        let mut both = Gate::new("BOTH".to_string(), Formula::And).unwrap();
        both.add_operand("A1".to_string());
        both.add_operand("B1".to_string());
        let mut pair = Gate::new("PAIR".to_string(), Formula::And).unwrap();
        pair.add_operand("A1".to_string());
        pair.add_operand("Y".to_string());
        let mut top = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top.add_operand("BOTH".to_string());
        top.add_operand("PAIR".to_string());
        top.add_operand("X".to_string());
        tree.add_gate(both).unwrap();
        tree.add_gate(pair).unwrap();
        tree.add_gate(top).unwrap();
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
        HclModel::new(tree, network)
            .unwrap()
            .with_bindings(vec![binding("A1", "NA"), binding("B1", "NB")])
    }

    fn hazard(state: &str) -> Vec<HclEvidenceSpec> {
        vec![HclEvidenceSpec {
            node: "H".to_string(),
            state: state.to_string(),
        }]
    }

    fn cut(
        cut_off: Option<f64>,
        limit_order: Option<usize>,
        keep: usize,
    ) -> DependencyCutSetSettings {
        DependencyCutSetSettings {
            score: DependencyCutSetScore::FailedEvents,
            limit_order,
            cut_off,
            keep,
            causes: 0,
        }
    }

    fn check(ranked: &FaultTreeRankedCutSets, expected: &[(&[&str], f64)]) {
        assert_eq!(ranked.total, expected.len());
        assert_eq!(ranked.cut_sets.len(), expected.len());
        for (cut_set, (events, probability)) in ranked.cut_sets.iter().zip(expected) {
            assert_eq!(cut_set.events, *events);
            assert!(
                (cut_set.probability - probability).abs() < 1e-15,
                "{:?}: {} is not {probability}",
                cut_set.events,
                cut_set.probability
            );
        }
    }

    #[test]
    fn fault_tree_cut_sets_are_ranked_by_their_probability_under_the_network() {
        let model = model();
        let settings = HclAnalysisSettings::default();
        let base = rank_hcl_cut_sets(&model, &settings, &cut(None, None, 10)).unwrap();
        let both = 0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6;
        let pair = (0.9 * 0.01 + 0.1 * 0.5) * 0.2;
        check(
            &base.scenarios[0],
            &[(&["X"], 0.1), (&["A1", "B1"], both), (&["A1", "Y"], pair)],
        );
        let rows = vec![hazard("LOW"), hazard("HIGH")];
        let grid =
            rank_hcl_cut_sets_batch(&model, &rows, Some(&rows), &settings, &cut(None, None, 10))
                .unwrap();
        check(
            &grid.scenarios[0],
            &[
                (&["X"], 0.1),
                (&["A1", "Y"], 0.01 * 0.2),
                (&["A1", "B1"], 0.01 * 0.02),
            ],
        );
        check(
            &grid.scenarios[1],
            &[
                (&["A1", "B1"], 0.5 * 0.6),
                (&["X"], 0.1),
                (&["A1", "Y"], 0.5 * 0.2),
            ],
        );
        assert_eq!(grid.raw_weights.as_deref(), Some(&[0.9, 0.1][..]));
        check(
            grid.weighted.as_ref().unwrap(),
            &[(&["X"], 0.1), (&["A1", "B1"], both), (&["A1", "Y"], pair)],
        );
    }

    #[test]
    fn cut_off_order_limit_and_kept_count_shape_the_fault_tree_list() {
        let model = model();
        let settings = HclAnalysisSettings::default();
        let rows = vec![hazard("LOW"), hazard("HIGH")];
        let grid = rank_hcl_cut_sets_batch(
            &model,
            &rows,
            Some(&rows),
            &settings,
            &cut(Some(0.05), None, 10),
        )
        .unwrap();
        check(&grid.scenarios[0], &[(&["X"], 0.1)]);
        check(
            &grid.scenarios[1],
            &[
                (&["A1", "B1"], 0.5 * 0.6),
                (&["X"], 0.1),
                (&["A1", "Y"], 0.5 * 0.2),
            ],
        );
        assert_eq!(grid.weighted.as_ref().unwrap().total, 3);
        let single = rank_hcl_cut_sets(&model, &settings, &cut(None, Some(1), 10)).unwrap();
        check(&single.scenarios[0], &[(&["X"], 0.1)]);
        let kept = rank_hcl_cut_sets(&model, &settings, &cut(None, None, 2)).unwrap();
        assert_eq!(kept.scenarios[0].total, 3);
        assert_eq!(kept.scenarios[0].cut_sets.len(), 2);
        assert!(rank_hcl_cut_sets(&model, &settings, &cut(Some(0.0), None, 2)).is_err());
    }

    #[test]
    fn cause_trace_lists_the_network_nodes_a_cut_set_shifts() {
        let model = model();
        let settings = HclAnalysisSettings::default();
        let traced = DependencyCutSetSettings {
            causes: 3,
            ..cut(None, None, 10)
        };
        let base = rank_hcl_cut_sets(&model, &settings, &traced).unwrap();
        let list = &base.scenarios[0].cut_sets;
        assert_eq!(list[0].events, ["X"]);
        assert!(list[0].causes.is_empty());
        let both = &list[1].causes;
        assert_eq!(both.len(), 1);
        assert_eq!(
            (both[0].node.as_str(), both[0].state.as_str()),
            ("H", "LOW")
        );
        let high = 0.1 * 0.5 * 0.6 / (0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6);
        assert!((both[0].baseline - 0.9).abs() < 1e-15);
        assert!((both[0].with_cut_set - (1.0 - high)).abs() < 1e-12);
        assert!((both[0].distance - (high - 0.1)).abs() < 1e-12);
        let pair = &list[2].causes;
        assert!((pair[0].with_cut_set - (1.0 - 0.05 / 0.059)).abs() < 1e-12);
        let rows = vec![hazard("LOW"), hazard("HIGH")];
        let grid = rank_hcl_cut_sets_batch(&model, &rows, Some(&rows), &settings, &traced).unwrap();
        for scenario in &grid.scenarios {
            assert!(scenario
                .cut_sets
                .iter()
                .all(|cut_set| cut_set.causes.is_empty()));
        }
        let plain = rank_hcl_cut_sets(&model, &settings, &cut(None, None, 10)).unwrap();
        for (left, right) in plain.scenarios[0].cut_sets.iter().zip(list) {
            assert_eq!(left.events, right.events);
            assert_eq!(left.probability.to_bits(), right.probability.to_bits());
            assert!(left.causes.is_empty());
        }
    }
}
