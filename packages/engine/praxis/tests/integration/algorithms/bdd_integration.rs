//! Integration tests for BDD algorithm with fault trees
//!
//! Tests the BDD implementation against actual fault tree structures
//! and verifies probability calculations match analytical results.

use praxis::algorithms::bdd::Bdd;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};

#[test]
fn test_bdd_simple_and_gate() {
    // Create fault tree: TOP = E1 AND E2
    let mut ft = FaultTree::new("SimpleAnd".to_string(), "TOP".to_string()).unwrap();

    // Basic events
    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to BDD
    let mut bdd = Bdd::new();
    let top_node = bdd
        .from_fault_tree(&ft)
        .expect("BDD conversion should succeed");

    // Calculate probability
    let prob = bdd.probability(top_node);

    // Analytical: P(E1 AND E2) = 0.1 * 0.2 = 0.02
    assert!(
        (prob - 0.02).abs() < 1e-10,
        "BDD probability should match analytical result"
    );
}

#[test]
fn test_bdd_simple_or_gate() {
    // Create fault tree: TOP = E1 OR E2
    let mut ft = FaultTree::new("SimpleOr".to_string(), "TOP".to_string()).unwrap();

    // Basic events
    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to BDD
    let mut bdd = Bdd::new();
    let top_node = bdd
        .from_fault_tree(&ft)
        .expect("BDD conversion should succeed");

    // Calculate probability
    let prob = bdd.probability(top_node);

    // Analytical: P(E1 OR E2) = 0.1 + 0.2 - 0.1*0.2 = 0.28
    assert!(
        (prob - 0.28).abs() < 1e-10,
        "BDD probability should match analytical result"
    );
}

#[test]
fn test_bdd_nested_gates() {
    // Create fault tree: TOP = (E1 AND E2) OR E3
    let mut ft = FaultTree::new("NestedGates".to_string(), "TOP".to_string()).unwrap();

    // Basic events
    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    // Intermediate gate: G1 = E1 AND E2
    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    // Top gate: TOP = G1 OR E3
    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to BDD
    let mut bdd = Bdd::new();
    let top_node = bdd
        .from_fault_tree(&ft)
        .expect("BDD conversion should succeed");

    // Calculate probability
    let prob = bdd.probability(top_node);

    // Analytical: P(G1 OR E3) where P(G1) = 0.1*0.2 = 0.02
    // P(G1 OR E3) = 0.02 + 0.3 - 0.02*0.3 = 0.314
    let expected = 0.02 + 0.3 - 0.02 * 0.3;
    assert!(
        (prob - expected).abs() < 1e-10,
        "BDD probability should match analytical result"
    );
}

#[test]
fn test_bdd_not_gate() {
    // Create fault tree: TOP = NOT E1
    let mut ft = FaultTree::new("NotGate".to_string(), "TOP".to_string()).unwrap();

    // Basic event
    let e1 = BasicEvent::new("E1".to_string(), 0.3).unwrap();
    ft.add_basic_event(e1).unwrap();

    // Top gate: NOT
    let mut top_gate = Gate::new("TOP".to_string(), Formula::Not).unwrap();
    top_gate.add_operand("E1".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to BDD
    let mut bdd = Bdd::new();
    let top_node = bdd
        .from_fault_tree(&ft)
        .expect("BDD conversion should succeed");

    // Calculate probability
    let prob = bdd.probability(top_node);

    // Analytical: P(NOT E1) = 1 - 0.3 = 0.7
    assert!(
        (prob - 0.7).abs() < 1e-10,
        "BDD probability should match analytical result"
    );
}

#[test]
fn test_bdd_atleast_gate() {
    // Create fault tree: TOP = AtLeast(2, [E1, E2, E3])
    let mut ft = FaultTree::new("AtLeastGate".to_string(), "TOP".to_string()).unwrap();

    // Basic events with equal probability for easier calculation
    let e1 = BasicEvent::new("E1".to_string(), 0.5).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.5).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.5).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    // Top gate: AtLeast 2 of 3
    let mut top_gate = Gate::new("TOP".to_string(), Formula::AtLeast { min: 2 }).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to BDD
    let mut bdd = Bdd::new();
    let top_node = bdd
        .from_fault_tree(&ft)
        .expect("BDD conversion should succeed");

    // Calculate probability
    let prob = bdd.probability(top_node);

    // Analytical: P(at least 2 of 3 with p=0.5)
    // = P(exactly 2) + P(all 3)
    // = C(3,2) * 0.5^2 * 0.5^1 + C(3,3) * 0.5^3
    // = 3 * 0.125 + 1 * 0.125 = 0.5
    assert!(
        (prob - 0.5).abs() < 1e-10,
        "BDD probability should match analytical result"
    );
}

#[test]
fn test_bdd_complex_shared_events() {
    // Create fault tree with shared events: TOP = (E1 AND E2) OR (E2 AND E3)
    // This tests that BDD correctly handles shared events
    let mut ft = FaultTree::new("SharedEvents".to_string(), "TOP".to_string()).unwrap();

    // Basic events
    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    // Intermediate gates
    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
    g2.add_operand("E2".to_string());
    g2.add_operand("E3".to_string());
    ft.add_gate(g2).unwrap();

    // Top gate: OR
    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("G2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to BDD
    let mut bdd = Bdd::new();
    let top_node = bdd
        .from_fault_tree(&ft)
        .expect("BDD conversion should succeed");

    // Calculate probability
    let prob = bdd.probability(top_node);

    // Analytical: P((E1∧E2) ∨ (E2∧E3))
    // = P(E1∧E2) + P(E2∧E3) - P(E1∧E2∧E3)
    // = 0.1*0.2 + 0.2*0.3 - 0.1*0.2*0.3
    // = 0.02 + 0.06 - 0.006 = 0.074
    let expected = 0.1 * 0.2 + 0.2 * 0.3 - 0.1 * 0.2 * 0.3;
    assert!(
        (prob - expected).abs() < 1e-10,
        "BDD should correctly handle shared events, got {}, expected {}",
        prob,
        expected
    );
}

#[test]
fn test_bdd_stats() {
    // Test that BDD stats are reasonable
    let mut ft = FaultTree::new("StatsTest".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut bdd = Bdd::new();
    let _top_node = bdd
        .from_fault_tree(&ft)
        .expect("BDD conversion should succeed");

    let stats = bdd.stats();

    // Should have 2 variables (E1, E2)
    assert_eq!(stats.num_variables, 2);

    // Should have at least some nodes (terminals + decision nodes)
    assert!(stats.num_nodes >= 2);
}

#[test]
fn test_bdd_cache_clearing() {
    // Test that cache clearing works
    let mut bdd = Bdd::new();

    let x1 = bdd.variable(0, 0.1);
    let x2 = bdd.variable(1, 0.2);
    let and_result = bdd.and(x1, x2);

    let _prob1 = bdd.probability(and_result);

    // Clear caches
    bdd.clear_caches();

    // Should still work after clearing
    let prob2 = bdd.probability(and_result);
    assert!((prob2 - 0.02).abs() < 1e-10);
}
