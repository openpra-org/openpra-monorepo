use std::collections::HashMap;

use rand::seq::SliceRandom;
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;

use tensorbayes::{CompileHeuristic, CompiledJunctionTree, StateIndex};

use crate::algorithms::build::{build_bdd_with_order, BuildOptions};
use crate::analysis::sequence_dependency_cut_sets::{
    DependencyCutSetScore, DependencyCutSetSettings,
};
use crate::core::event::BasicEvent;
use crate::core::fault_tree::FaultTree;
use crate::core::gate::{Formula, Gate};
use crate::hcl::{
    analyze_hcl, quantify_hcl_batch, CanonicalBayesianNetwork, CanonicalBayesianVariable,
    HclAnalysisSettings, HclBindingSpec, HclCorrelation, HclEventBinding, HclEventBindings,
    HclEvidenceSpec, HclModel, HclQuantifier, HclSampler, HclUncertaintySettings, HclZeroContexts,
};

struct Node {
    cardinality: usize,
    parents: Vec<usize>,
    table: Vec<f64>,
}

struct Link {
    event: usize,
    node: usize,
    true_states: Vec<usize>,
}

struct Case {
    nodes: Vec<Node>,
    event_probabilities: Vec<f64>,
    gates: Vec<(Formula, Vec<usize>)>,
    links: Vec<Link>,
    evidence: Vec<(usize, usize)>,
}

fn random_row(rng: &mut ChaCha8Rng, cardinality: usize, zeros: bool) -> Vec<f64> {
    loop {
        let mut row: Vec<f64> = (0..cardinality)
            .map(|_| {
                if zeros && rng.gen_bool(0.15) {
                    0.0
                } else {
                    rng.gen_range(0.05..1.0)
                }
            })
            .collect();
        let total: f64 = row.iter().sum();
        if total > 0.0 {
            row.iter_mut().for_each(|value| *value /= total);
            return row;
        }
    }
}

fn random_case(rng: &mut ChaCha8Rng, zeros: bool) -> Case {
    let node_count = rng.gen_range(2..=7);
    let mut nodes: Vec<Node> = Vec::with_capacity(node_count);
    for index in 0..node_count {
        let cardinality = rng.gen_range(2..=3);
        let mut parents: Vec<usize> = (0..index).filter(|_| rng.gen_bool(0.45)).collect();
        parents.shuffle(rng);
        parents.truncate(3);
        let rows: usize = parents
            .iter()
            .map(|&parent| nodes[parent].cardinality)
            .product();
        let table = (0..rows)
            .flat_map(|_| random_row(rng, cardinality, zeros))
            .collect();
        nodes.push(Node {
            cardinality,
            parents,
            table,
        });
    }
    let event_count = rng.gen_range(3..=9);
    let event_probabilities = (0..event_count)
        .map(|_| rng.gen_range(0.02..0.98))
        .collect();
    let gate_count = rng.gen_range(1..=5);
    let mut gates: Vec<(Formula, Vec<usize>)> = Vec::with_capacity(gate_count + 1);
    let mut unused: Vec<usize> = (0..event_count).collect();
    for gate in 0..gate_count {
        let pool = event_count + gate;
        let arity = rng.gen_range(2..=4).min(pool);
        let mut operands: Vec<usize> = (0..pool).collect();
        operands.shuffle(rng);
        operands.truncate(arity);
        unused.retain(|item| !operands.contains(item));
        unused.push(event_count + gate);
        let formula = match rng.gen_range(0..6) {
            0 | 1 => Formula::And,
            2 | 3 => Formula::Or,
            4 if arity >= 3 => Formula::AtLeast { min: 2 },
            4 => Formula::Nand,
            _ => Formula::Nor,
        };
        gates.push((formula, operands));
    }
    let top_formula = if rng.gen_bool(0.5) {
        Formula::Or
    } else {
        Formula::And
    };
    if unused.len() == 1 {
        unused.push(0);
        unused.dedup();
    }
    gates.push((top_formula, unused));
    let mut events: Vec<usize> = (0..event_count).collect();
    events.shuffle(rng);
    let link_count = rng.gen_range(1..=event_count.min(6));
    let links = events[..link_count]
        .iter()
        .map(|&event| {
            let node = rng.gen_range(0..node_count);
            let mut states: Vec<usize> = (0..nodes[node].cardinality).collect();
            states.shuffle(rng);
            states.truncate(rng.gen_range(1..nodes[node].cardinality));
            Link {
                event,
                node,
                true_states: states,
            }
        })
        .collect();
    let mut evidence = Vec::new();
    for node in 0..node_count {
        if rng.gen_bool(0.2) {
            evidence.push((node, rng.gen_range(0..nodes[node].cardinality)));
        }
    }
    Case {
        nodes,
        event_probabilities,
        gates,
        links,
        evidence,
    }
}

fn holds(case: &Case, item: usize, events: &[bool], memo: &mut Vec<Option<bool>>) -> bool {
    let event_count = case.event_probabilities.len();
    if item < event_count {
        return events[item];
    }
    if let Some(value) = memo[item - event_count] {
        return value;
    }
    let (formula, operands) = &case.gates[item - event_count];
    let count = operands
        .iter()
        .filter(|&&operand| holds(case, operand, events, memo))
        .count();
    let value = match formula {
        Formula::And => count == operands.len(),
        Formula::Or => count > 0,
        Formula::Nand => count != operands.len(),
        Formula::Nor => count == 0,
        Formula::AtLeast { min } => count >= *min,
        _ => unreachable!(),
    };
    memo[item - event_count] = Some(value);
    value
}

fn enumerate(case: &Case) -> Option<f64> {
    enumerate_where(case, &[], true)
}

fn enumerate_where(case: &Case, occurred: &[usize], with_top: bool) -> Option<f64> {
    let event_count = case.event_probabilities.len();
    let linked: HashMap<usize, &Link> = case.links.iter().map(|link| (link.event, link)).collect();
    let free: Vec<usize> = (0..event_count)
        .filter(|event| !linked.contains_key(event))
        .collect();
    let mut states = vec![0usize; case.nodes.len()];
    let mut numerator = 0.0;
    let mut denominator = 0.0;
    loop {
        let mut weight = 1.0;
        for (index, node) in case.nodes.iter().enumerate() {
            let row = node.parents.iter().fold(0, |row, &parent| {
                row * case.nodes[parent].cardinality + states[parent]
            });
            weight *= node.table[row * node.cardinality + states[index]];
        }
        if case
            .evidence
            .iter()
            .all(|&(node, state)| states[node] == state)
            && weight > 0.0
        {
            denominator += weight;
            let mut conditional = 0.0;
            for assignment in 0..(1usize << free.len()) {
                let mut events = vec![false; event_count];
                let mut probability = 1.0;
                for (bit, &event) in free.iter().enumerate() {
                    events[event] = assignment >> bit & 1 == 1;
                    probability *= if events[event] {
                        case.event_probabilities[event]
                    } else {
                        1.0 - case.event_probabilities[event]
                    };
                }
                for link in &case.links {
                    events[link.event] = link.true_states.contains(&states[link.node]);
                }
                let top = event_count + case.gates.len() - 1;
                if occurred.iter().all(|&event| events[event])
                    && (!with_top || holds(case, top, &events, &mut vec![None; case.gates.len()]))
                {
                    conditional += probability;
                }
            }
            numerator += weight * conditional;
        }
        let mut position = 0;
        loop {
            if position == states.len() {
                return (denominator > 0.0).then_some(numerator / denominator);
            }
            states[position] += 1;
            if states[position] < case.nodes[position].cardinality {
                break;
            }
            states[position] = 0;
            position += 1;
        }
    }
}

fn model(case: &Case) -> HclModel {
    let event_count = case.event_probabilities.len();
    let name = |item: usize| {
        if item < event_count {
            format!("E{item}")
        } else {
            format!("G{}", item - event_count)
        }
    };
    let top = event_count + case.gates.len() - 1;
    let mut tree = FaultTree::new("CASE", name(top)).unwrap();
    for (event, &probability) in case.event_probabilities.iter().enumerate() {
        tree.add_basic_event(BasicEvent::new(name(event), probability).unwrap())
            .unwrap();
    }
    for (index, (formula, operands)) in case.gates.iter().enumerate() {
        let mut gate = Gate::new(name(event_count + index), formula.clone()).unwrap();
        for &operand in operands {
            gate.add_operand(name(operand));
        }
        tree.add_gate(gate).unwrap();
    }
    let state = |node: usize, state: usize| format!("N{node}S{state}");
    let network = CanonicalBayesianNetwork {
        id: None,
        variables: case
            .nodes
            .iter()
            .enumerate()
            .map(|(index, node)| CanonicalBayesianVariable {
                name: format!("N{index}"),
                states: (0..node.cardinality)
                    .map(|value| state(index, value))
                    .collect(),
                parents: node
                    .parents
                    .iter()
                    .map(|parent| format!("N{parent}"))
                    .collect(),
                probabilities: node.table.clone(),
            })
            .collect(),
    }
    .into_graph()
    .unwrap();
    HclModel::new(tree, network)
        .unwrap()
        .with_bindings(
            case.links
                .iter()
                .map(|link| HclBindingSpec {
                    event: name(link.event),
                    node: format!("N{}", link.node),
                    true_states: link
                        .true_states
                        .iter()
                        .map(|&value| state(link.node, value))
                        .collect(),
                })
                .collect(),
        )
        .with_base_evidence(
            case.evidence
                .iter()
                .map(|&(node, value)| HclEvidenceSpec {
                    node: format!("N{node}"),
                    state: state(node, value),
                })
                .collect(),
        )
}

fn sampled(seed: u64) -> HclUncertaintySettings {
    HclUncertaintySettings {
        sample_count: 3,
        seed,
        sampler: HclSampler::MonteCarlo,
        cpt_sampler: None,
        correlation: HclCorrelation::Shared,
        clip_probabilities: false,
        cpt_clip_epsilon: 0.0,
        zero_probability_contexts: HclZeroContexts::Zero,
        basic_events: Vec::new(),
        cpt_rows: Vec::new(),
        cpt_generators: Vec::new(),
        uncertainty_parameters: Vec::new(),
        uncertainty_vectors: Vec::new(),
    }
}

#[test]
fn random_models_match_full_enumeration_in_every_order() {
    let mut rng = ChaCha8Rng::seed_from_u64(20261112);
    let mut checked = 0;
    let mut worst: f64 = 0.0;
    while checked < 600 {
        let case = random_case(&mut rng, true);
        let Some(exact) = enumerate(&case) else {
            continue;
        };
        let model = model(&case);
        let mut events: Vec<String> = (0..case.event_probabilities.len())
            .map(|event| format!("E{event}"))
            .collect();
        for attempt in 0..3 {
            let variable_order = if attempt == 0 {
                None
            } else {
                events.shuffle(&mut rng);
                Some(events.clone())
            };
            let settings = HclAnalysisSettings {
                variable_order,
                uncertainty: Some(sampled(checked as u64)),
                ..HclAnalysisSettings::default()
            };
            let result = analyze_hcl(&model, &settings).unwrap();
            let mut values = vec![result.probability];
            values.extend(result.uncertainty_samples.unwrap());
            for value in values {
                let difference = (value - exact).abs();
                worst = worst.max(difference);
                assert!(
                    difference <= 1e-12,
                    "case {checked} attempt {attempt}: {value} differs from the enumerated {exact}"
                );
            }
        }
        checked += 1;
    }
    assert!(worst <= 1e-12);
}

#[test]
fn one_quantifier_matches_full_enumeration_for_each_evidence_row() {
    let mut rng = ChaCha8Rng::seed_from_u64(7);
    let mut checked = 0;
    while checked < 200 {
        let mut case = random_case(&mut rng, false);
        let mut rows = Vec::new();
        let mut exact = Vec::new();
        for _ in 0..6 {
            let mut evidence = Vec::new();
            for node in 0..case.nodes.len() {
                if rng.gen_bool(0.3) {
                    evidence.push((node, rng.gen_range(0..case.nodes[node].cardinality)));
                }
            }
            case.evidence = evidence;
            if let Some(value) = enumerate(&case) {
                exact.push(value);
                rows.push(
                    case.evidence
                        .iter()
                        .map(|&(node, state)| HclEvidenceSpec {
                            node: format!("N{node}"),
                            state: format!("N{node}S{state}"),
                        })
                        .collect::<Vec<_>>(),
                );
            }
        }
        if rows.len() < 2 {
            continue;
        }
        case.evidence.clear();
        let settings = HclAnalysisSettings {
            uncertainty: Some(sampled(checked as u64)),
            ..HclAnalysisSettings::default()
        };
        let batch = quantify_hcl_batch(&model(&case), &rows, &settings).unwrap();
        assert_eq!(batch.results.len(), rows.len());
        for (result, exact) in batch.results.iter().zip(&exact) {
            let mut values = vec![result.probability];
            values.extend(result.uncertainty_samples.clone().unwrap());
            for value in values {
                assert!(
                    (value - exact).abs() <= 1e-12,
                    "case {checked}: {value} differs from the enumerated {exact}"
                );
            }
        }
        checked += 1;
    }
}

fn joint_occurrence_matches_enumeration(seed: u64, zeros: bool, with_top: bool, wanted: usize) {
    let mut rng = ChaCha8Rng::seed_from_u64(seed);
    let mut checked = 0;
    while checked < wanted {
        let case = random_case(&mut rng, zeros);
        if enumerate(&case).is_none() {
            continue;
        }
        let model = model(&case);
        let event_count = case.event_probabilities.len();
        let mut order: Vec<String> = (0..event_count).map(|event| format!("E{event}")).collect();
        if rng.gen_bool(0.5) {
            order.shuffle(&mut rng);
        } else {
            order = crate::hcl::source_fault_tree_order(&model).unwrap();
        }
        let options = BuildOptions {
            fold_constants: false,
            splice_null_gates: false,
            reorder: None,
            reorder_budget: std::time::Duration::from_secs(10),
        };
        let built = build_bdd_with_order(model.fault_tree(), options, &order).unwrap();
        let mut bindings = HclEventBindings::new();
        for link in &case.links {
            let node = model.network().node_id(&format!("N{}", link.node)).unwrap();
            let states = link
                .true_states
                .iter()
                .map(|&state| StateIndex::new(state))
                .collect();
            bindings
                .insert(
                    HclEventBinding::for_event(&built, &format!("E{}", link.event), node, states)
                        .unwrap(),
                )
                .unwrap();
        }
        let variable = |event: usize| {
            let index = built.pdag.get_index(&format!("E{event}")).unwrap();
            built.var_of[&index]
        };
        let tree =
            CompiledJunctionTree::compile(model.network().clone(), CompileHeuristic::MinFill)
                .unwrap();
        let base =
            crate::hcl::hazard::resolve_evidence(model.network(), model.base_evidence()).unwrap();
        let mut quantifier = HclQuantifier::new(&built.bdd, tree, bindings, base).unwrap();
        let top = quantifier.quantify(built.root).unwrap();
        for _ in 0..8 {
            let mut events: Vec<usize> = (0..event_count).collect();
            events.shuffle(&mut rng);
            events.truncate(rng.gen_range(1..=event_count.min(4)));
            let variables: Vec<usize> = events.iter().map(|&event| variable(event)).collect();
            let exact = enumerate_where(&case, &events, with_top).unwrap();
            let value = if with_top {
                quantifier
                    .joint_occurrence_with(built.root, &variables)
                    .unwrap()
            } else {
                quantifier.joint_occurrence(&variables).unwrap()
            };
            assert!(
                (value - exact).abs() <= 1e-12,
                "case {checked} events {events:?}: {value} differs from the enumerated {exact}"
            );
        }
        let again = quantifier.quantify(built.root).unwrap();
        assert_eq!(top.to_bits(), again.to_bits());
        checked += 1;
    }
}

#[test]
fn joint_occurrence_of_events_matches_full_enumeration() {
    joint_occurrence_matches_enumeration(11, true, false, 300);
    joint_occurrence_matches_enumeration(12, false, false, 150);
}

#[test]
fn joint_occurrence_with_the_top_event_matches_full_enumeration() {
    joint_occurrence_matches_enumeration(13, false, true, 300);
}

#[test]
fn shared_node_keeps_the_context_of_a_dependent_parent() {
    let case = Case {
        nodes: vec![
            Node {
                cardinality: 2,
                parents: vec![],
                table: vec![0.7, 0.3],
            },
            Node {
                cardinality: 2,
                parents: vec![0],
                table: vec![0.9, 0.1, 0.25, 0.75],
            },
        ],
        event_probabilities: vec![0.5, 0.4, 0.5],
        gates: vec![
            (Formula::Nor, vec![1]),
            (Formula::And, vec![0, 3]),
            (Formula::Nor, vec![0]),
            (Formula::And, vec![5, 1]),
            (Formula::Or, vec![4, 6]),
            (Formula::And, vec![7, 2]),
        ],
        links: vec![
            Link {
                event: 0,
                node: 0,
                true_states: vec![1],
            },
            Link {
                event: 2,
                node: 1,
                true_states: vec![1],
            },
        ],
        evidence: vec![],
    };
    let expected = 0.3 * 0.6 * 0.75 + 0.7 * 0.4 * 0.1;
    assert!((enumerate(&case).unwrap() - expected).abs() < 1e-15);
    let settings = HclAnalysisSettings {
        variable_order: Some(vec!["E0".into(), "E1".into(), "E2".into()]),
        ..HclAnalysisSettings::default()
    };
    let result = analyze_hcl(&model(&case), &settings).unwrap();
    assert!((result.probability - expected).abs() < 1e-15);
}

#[test]
fn occurrence_bound_is_never_below_the_enumerated_joint_probability() {
    let mut rng = ChaCha8Rng::seed_from_u64(31);
    let mut checked = 0;
    let mut tight = 0;
    while checked < 400 {
        let case = random_case(&mut rng, checked % 2 == 0);
        if enumerate(&case).is_none() {
            continue;
        }
        let model = model(&case);
        let tree =
            CompiledJunctionTree::compile(model.network().clone(), CompileHeuristic::MinFill)
                .unwrap();
        let bounds = crate::hcl::occurrence_bounds(
            model.network(),
            &tree,
            model.bindings(),
            &[model.base_evidence()],
        )
        .unwrap();
        let event_count = case.event_probabilities.len();
        for _ in 0..12 {
            let mut events: Vec<usize> = (0..event_count).collect();
            events.shuffle(&mut rng);
            events.truncate(rng.gen_range(1..=event_count.min(4)));
            let exact = enumerate_where(&case, &events, false).unwrap();
            let mut limit = bounds.evidence_factor;
            for &event in &events {
                limit *= bounds
                    .events
                    .get(&format!("E{event}"))
                    .copied()
                    .unwrap_or(case.event_probabilities[event]);
            }
            assert!(
                exact <= limit * (1.0 + 1e-12),
                "case {checked} events {events:?}: {exact} exceeds the bound {limit}"
            );
            if exact > 0.0 && limit <= exact * 2.0 {
                tight += 1;
            }
        }
        checked += 1;
    }
    assert!(tight > 0);
}

fn coherent(case: &Case) -> bool {
    case.gates
        .iter()
        .all(|(formula, _)| !matches!(formula, Formula::Nand | Formula::Nor))
}

fn enumerated_cut_sets(case: &Case) -> Vec<(Vec<String>, f64)> {
    let event_count = case.event_probabilities.len();
    let top = event_count + case.gates.len() - 1;
    let fails = |mask: usize| {
        let events: Vec<bool> = (0..event_count)
            .map(|event| mask >> event & 1 == 1)
            .collect();
        holds(case, top, &events, &mut vec![None; case.gates.len()])
    };
    let mut found = Vec::new();
    for mask in 0..(1usize << event_count) {
        if !fails(mask) {
            continue;
        }
        let members: Vec<usize> = (0..event_count)
            .filter(|event| mask >> event & 1 == 1)
            .collect();
        if members.iter().any(|&event| fails(mask & !(1 << event))) {
            continue;
        }
        let mut names: Vec<String> = members.iter().map(|event| format!("E{event}")).collect();
        names.sort();
        found.push((names, enumerate_where(case, &members, false).unwrap()));
    }
    found.sort_by(|left, right| left.0.cmp(&right.0));
    found
}

#[test]
fn fault_tree_cut_sets_and_their_scores_match_full_enumeration() {
    let mut rng = ChaCha8Rng::seed_from_u64(47);
    let settings = HclAnalysisSettings {
        fold_constants: false,
        splice_null_gates: false,
        ..HclAnalysisSettings::default()
    };
    let mut checked = 0;
    let mut truncated = 0;
    while checked < 300 {
        let case = random_case(&mut rng, checked % 3 == 0);
        if !coherent(&case) || enumerate(&case).is_none() {
            continue;
        }
        let model = model(&case);
        let expected = enumerated_cut_sets(&case);
        let rank = |cut_off: Option<f64>| {
            crate::hcl::rank_hcl_cut_sets(
                &model,
                &settings,
                &DependencyCutSetSettings {
                    score: DependencyCutSetScore::FailedEvents,
                    limit_order: None,
                    cut_off,
                    keep: 1000,
                },
            )
            .unwrap()
            .scenarios
            .remove(0)
        };
        let full = rank(None);
        assert_eq!(full.total, expected.len(), "case {checked}");
        let mut listed = full.cut_sets.clone();
        listed.sort_by(|left, right| left.events.cmp(&right.events));
        for (cut_set, (events, exact)) in listed.iter().zip(&expected) {
            assert_eq!(&cut_set.events, events, "case {checked}");
            assert!(
                (cut_set.probability - exact).abs() <= 1e-12,
                "case {checked} {events:?}: {} differs from {exact}",
                cut_set.probability
            );
        }
        for pair in full.cut_sets.windows(2) {
            assert!(pair[0].probability >= pair[1].probability);
        }
        let cut_off = 10f64.powf(-rng.gen_range(0.0..4.0));
        if expected
            .iter()
            .all(|(_, exact)| (exact - cut_off).abs() > 1e-9)
        {
            let limited = rank(Some(cut_off));
            let wanted: Vec<_> = full
                .cut_sets
                .iter()
                .filter(|cut_set| cut_set.probability >= cut_off)
                .collect();
            assert_eq!(
                limited.total,
                wanted.len(),
                "case {checked} cut-off {cut_off}"
            );
            for (left, right) in wanted.iter().zip(&limited.cut_sets) {
                assert_eq!(left.events, right.events);
                assert_eq!(left.probability.to_bits(), right.probability.to_bits());
            }
            if wanted.len() < full.total {
                truncated += 1;
            }
        }
        checked += 1;
    }
    assert!(truncated > 50);
}
