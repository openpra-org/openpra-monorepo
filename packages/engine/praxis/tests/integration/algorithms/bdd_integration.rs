use praxis::algorithms::bdd_engine::Bdd as BddEngine;
use praxis::algorithms::bdd_pdag::BddPdag;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};

fn bdd_probability(ft: &FaultTree) -> f64 {
    let mut pdag = BddPdag::from_fault_tree(ft).unwrap();
    pdag.compute_ordering_and_modules().unwrap();
    let (bdd_engine, root) = BddEngine::build_from_pdag(&pdag).unwrap();
    bdd_engine.probability(root)
}

#[test]
fn test_bdd_simple_and_gate() {
    let mut ft = FaultTree::new("SimpleAnd".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let prob = bdd_probability(&ft);

    assert!(
        (prob - 0.02).abs() < 1e-10,
        "BDD probability should match analytical result"
    );
}

#[test]
fn test_bdd_simple_or_gate() {
    let mut ft = FaultTree::new("SimpleOr".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let prob = bdd_probability(&ft);

    assert!(
        (prob - 0.28).abs() < 1e-10,
        "BDD probability should match analytical result"
    );
}

#[test]
fn test_bdd_nested_gates() {
    let mut ft = FaultTree::new("NestedGates".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    let prob = bdd_probability(&ft);

    let expected = 0.02 + 0.3 - 0.02 * 0.3;
    assert!(
        (prob - expected).abs() < 1e-10,
        "BDD probability should match analytical result"
    );
}

#[test]
fn test_bdd_not_gate() {
    let mut ft = FaultTree::new("NotGate".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.3).unwrap();
    ft.add_basic_event(e1).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Not).unwrap();
    top_gate.add_operand("E1".to_string());
    ft.add_gate(top_gate).unwrap();

    let prob = bdd_probability(&ft);

    assert!(
        (prob - 0.7).abs() < 1e-10,
        "BDD probability should match analytical result"
    );
}

#[test]
fn test_bdd_atleast_gate() {
    let mut ft = FaultTree::new("AtLeastGate".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.5).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.5).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.5).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::AtLeast { min: 2 }).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    let prob = bdd_probability(&ft);

    assert!(
        (prob - 0.5).abs() < 1e-10,
        "BDD probability should match analytical result"
    );
}

#[test]
fn test_bdd_complex_shared_events() {
    let mut ft = FaultTree::new("SharedEvents".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
    g2.add_operand("E2".to_string());
    g2.add_operand("E3".to_string());
    ft.add_gate(g2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("G2".to_string());
    ft.add_gate(top_gate).unwrap();

    let prob = bdd_probability(&ft);

    let expected = 0.1 * 0.2 + 0.2 * 0.3 - 0.1 * 0.2 * 0.3;
    assert!(
        (prob - expected).abs() < 1e-10,
        "BDD should correctly handle shared events, got {}, expected {}",
        prob,
        expected
    );
}

#[test]
fn test_bdd_node_count() {
    let mut ft = FaultTree::new("StatsTest".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut pdag = BddPdag::from_fault_tree(&ft).unwrap();
    pdag.compute_ordering_and_modules().unwrap();
    let (bdd_engine, _root) = BddEngine::build_from_pdag(&pdag).unwrap();

    assert_eq!(bdd_engine.var_probs().len(), 2);
    assert!(bdd_engine.node_count() >= 2);
}

#[test]
fn test_bdd_prob_cache_clearing() {
    let mut ft = FaultTree::new("CacheTest".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut pdag = BddPdag::from_fault_tree(&ft).unwrap();
    pdag.compute_ordering_and_modules().unwrap();
    let (mut bdd_engine, root) = BddEngine::build_from_pdag(&pdag).unwrap();

    let prob1 = bdd_engine.probability(root);

    bdd_engine.clear_prob_cache();

    let prob2 = bdd_engine.probability(root);
    assert!((prob1 - prob2).abs() < 1e-10);
    assert!((prob2 - 0.02).abs() < 1e-10);
}
