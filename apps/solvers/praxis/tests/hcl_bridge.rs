use std::collections::HashMap;

use approx::assert_abs_diff_eq;
use praxis::algorithms::bdd_engine::{Bdd, BddRef};
use praxis::algorithms::build::{build_bdd_with_order, BuildOptions};
use praxis::algorithms::pdag::{Connective, NodeIndex, Pdag};
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::hcl::{HclBaseEvidence, HclEventBinding, HclEventBindings, HclQuantifier};
use tensorbayes::{BayesianGraph, CompileHeuristic, CompiledJunctionTree, NodeId, StateIndex};

fn compile(graph: BayesianGraph) -> CompiledJunctionTree {
    CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill).unwrap()
}

fn bdd_from_pdag(
    pdag: &Pdag,
    ordered_events: &[NodeIndex],
    probabilities: Vec<f64>,
) -> (Bdd, BddRef) {
    let var_of: HashMap<_, _> = ordered_events
        .iter()
        .enumerate()
        .map(|(variable, &event)| (event, variable))
        .collect();
    Bdd::from_pdag_with_order_and_probs(pdag, &var_of, probabilities).unwrap()
}

fn correlated_binary_bn() -> (CompiledJunctionTree, NodeId, NodeId) {
    let mut graph = BayesianGraph::new();
    let a = graph.add_variable("A", &["false", "true"]).unwrap();
    let b = graph.add_variable("B", &["false", "true"]).unwrap();
    graph.add_edge(a, b).unwrap();
    graph.set_cpt(a, vec![0.8, 0.2]).unwrap();
    // Axes: [A, B]. P(B=true | A=false)=0.1; P(B=true | A=true)=0.8.
    graph.set_cpt(b, vec![0.9, 0.1, 0.2, 0.8]).unwrap();
    (compile(graph), a, b)
}

fn bind_binary(bindings: &mut HclEventBindings, bdd_variable: usize, node: NodeId) {
    bindings
        .insert(HclEventBinding::new(bdd_variable, node, vec![StateIndex::new(1)]).unwrap())
        .unwrap();
}

#[test]
fn caller_controlled_bdd_order_is_honored_and_validated() {
    let mut fault_tree = FaultTree::new("ordered", "TOP").unwrap();
    fault_tree
        .add_basic_event(BasicEvent::new("A".to_string(), 0.2).unwrap())
        .unwrap();
    fault_tree
        .add_basic_event(BasicEvent::new("B".to_string(), 0.3).unwrap())
        .unwrap();
    let mut top = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top.add_operand("A".to_string());
    top.add_operand("B".to_string());
    fault_tree.add_gate(top).unwrap();

    let order = vec!["B".to_string(), "A".to_string()];
    let built = build_bdd_with_order(&fault_tree, BuildOptions::default(), &order).unwrap();
    let a = built.pdag.get_index("A").unwrap();
    let b = built.pdag.get_index("B").unwrap();
    assert_eq!(built.order, vec![b, a]);
    assert_eq!(built.var_of[&b], 0);
    assert_eq!(built.var_of[&a], 1);

    let duplicate = vec!["A".to_string(), "A".to_string()];
    assert!(build_bdd_with_order(&fault_tree, BuildOptions::default(), &duplicate).is_err());
}

#[test]
fn shannon_traversal_preserves_bn_correlation() {
    let mut pdag = Pdag::new();
    let a_event = pdag.add_basic_event("A".to_string());
    let b_event = pdag.add_basic_event("B".to_string());
    let top = pdag
        .add_gate(
            "TOP".to_string(),
            Connective::And,
            vec![a_event, b_event],
            None,
        )
        .unwrap();
    pdag.set_root(top).unwrap();
    let (bdd, root) = bdd_from_pdag(&pdag, &[a_event, b_event], vec![0.2, 0.24]);

    let (tree, a, b) = correlated_binary_bn();
    let mut bindings = HclEventBindings::new();
    bind_binary(&mut bindings, 0, a);
    bind_binary(&mut bindings, 1, b);
    let evidence = HclBaseEvidence::unobserved(2);
    let mut quantifier = HclQuantifier::new(&bdd, tree, bindings, evidence).unwrap();

    // P(A=true, B=true) = 0.2 * 0.8. An independent calculation would be 0.048.
    assert_abs_diff_eq!(quantifier.quantify(root).unwrap(), 0.16, epsilon = 1e-12);

    let misses = quantifier.stats().bn_query_cache_misses;
    assert!(misses >= 2);
    assert_abs_diff_eq!(quantifier.quantify(root).unwrap(), 0.16, epsilon = 1e-12);
    assert!(quantifier.stats().bdd_context_cache_hits > 0);
    assert_eq!(quantifier.stats().bn_query_cache_misses, misses);
}

#[test]
fn base_evidence_can_be_changed_without_rebuilding_the_bridge() {
    let mut pdag = Pdag::new();
    let b_event = pdag.add_basic_event("B".to_string());
    pdag.set_root(b_event).unwrap();
    let (bdd, root) = bdd_from_pdag(&pdag, &[b_event], vec![0.24]);

    let (tree, a, b) = correlated_binary_bn();
    let mut bindings = HclEventBindings::new();
    bind_binary(&mut bindings, 0, b);
    let mut evidence = HclBaseEvidence::unobserved(2);
    evidence.observe(a, StateIndex::new(1)).unwrap();
    let mut quantifier = HclQuantifier::new(&bdd, tree, bindings, evidence).unwrap();
    assert_abs_diff_eq!(quantifier.quantify(root).unwrap(), 0.8, epsilon = 1e-12);

    let mut changed = HclBaseEvidence::unobserved(2);
    changed.observe(a, StateIndex::new(0)).unwrap();
    quantifier.set_base_evidence(changed).unwrap();
    assert_abs_diff_eq!(quantifier.quantify(root).unwrap(), 0.1, epsilon = 1e-12);
}

#[test]
fn unbound_events_keep_their_independent_bdd_probabilities() {
    let mut pdag = Pdag::new();
    let a_event = pdag.add_basic_event("A".to_string());
    let independent = pdag.add_basic_event("X".to_string());
    let top = pdag
        .add_gate(
            "TOP".to_string(),
            Connective::And,
            vec![a_event, independent],
            None,
        )
        .unwrap();
    pdag.set_root(top).unwrap();
    let (bdd, root) = bdd_from_pdag(&pdag, &[a_event, independent], vec![0.2, 0.1]);

    let (tree, a, _) = correlated_binary_bn();
    let mut bindings = HclEventBindings::new();
    bind_binary(&mut bindings, 0, a);
    let mut quantifier =
        HclQuantifier::new(&bdd, tree, bindings, HclBaseEvidence::unobserved(2)).unwrap();
    assert_abs_diff_eq!(quantifier.quantify(root).unwrap(), 0.02, epsilon = 1e-12);
}

#[test]
fn multiple_boolean_events_can_partition_one_multistate_bn_node() {
    let mut pdag = Pdag::new();
    let wet = pdag.add_basic_event("Wet".to_string());
    let snow = pdag.add_basic_event("Snow".to_string());
    let top = pdag
        .add_gate("TOP".to_string(), Connective::And, vec![wet, -snow], None)
        .unwrap();
    pdag.set_root(top).unwrap();
    let (bdd, root) = bdd_from_pdag(&pdag, &[wet, snow], vec![0.5, 0.2]);

    let mut graph = BayesianGraph::new();
    let weather = graph
        .add_variable("Weather", &["sun", "rain", "snow"])
        .unwrap();
    graph.set_cpt(weather, vec![0.5, 0.3, 0.2]).unwrap();
    let mut bindings = HclEventBindings::new();
    bindings
        .insert(
            HclEventBinding::new(0, weather, vec![StateIndex::new(1), StateIndex::new(2)]).unwrap(),
        )
        .unwrap();
    bindings
        .insert(HclEventBinding::new(1, weather, vec![StateIndex::new(2)]).unwrap())
        .unwrap();
    let mut quantifier = HclQuantifier::new(
        &bdd,
        compile(graph),
        bindings,
        HclBaseEvidence::unobserved(1),
    )
    .unwrap();

    // (rain or snow) AND NOT snow is exactly the rain state.
    assert_abs_diff_eq!(quantifier.quantify(root).unwrap(), 0.3, epsilon = 1e-12);
}

#[test]
fn invalid_bindings_are_rejected_before_traversal() {
    let mut pdag = Pdag::new();
    let event = pdag.add_basic_event("A".to_string());
    pdag.set_root(event).unwrap();
    let (bdd, _) = bdd_from_pdag(&pdag, &[event], vec![0.2]);
    let (tree, a, _) = correlated_binary_bn();

    let mut bindings = HclEventBindings::new();
    bindings
        .insert(HclEventBinding::new(0, a, vec![StateIndex::new(0), StateIndex::new(1)]).unwrap())
        .unwrap();
    assert!(HclQuantifier::new(&bdd, tree, bindings, HclBaseEvidence::unobserved(2)).is_err());
}
