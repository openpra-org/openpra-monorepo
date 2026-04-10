use praxis::algorithms::zbdd::Zbdd;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use std::collections::HashMap;

#[test]
fn test_zbdd_simple_and_gate() {
    // Create fault tree: TOP = E1 AND E2
    // Minimal cut set: {E1, E2}
    let mut ft = FaultTree::new("SimpleAnd".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut zbdd = Zbdd::new();
    let root = zbdd
        .from_fault_tree(&ft)
        .expect("ZBDD conversion should succeed");

    // Should have 1 minimal cut set: {E1, E2}
    let products = zbdd.enumerate_products(root);
    assert_eq!(products.len(), 1, "Should have exactly 1 minimal cut set");
    assert_eq!(products[0].len(), 2, "Cut set should have 2 elements");
}

#[test]
fn test_zbdd_simple_or_gate() {
    // Create fault tree: TOP = E1 OR E2
    // Minimal cut sets: {E1}, {E2}
    let mut ft = FaultTree::new("SimpleOr".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut zbdd = Zbdd::new();
    let root = zbdd
        .from_fault_tree(&ft)
        .expect("ZBDD conversion should succeed");

    // Should have 2 minimal cut sets: {E1}, {E2}
    let products = zbdd.enumerate_products(root);
    assert_eq!(products.len(), 2, "Should have exactly 2 minimal cut sets");

    // Each cut set should have 1 element
    for product in &products {
        assert_eq!(product.len(), 1, "Each cut set should have 1 element");
    }
}

#[test]
fn test_zbdd_nested_gates() {
    // Create fault tree: TOP = (E1 AND E2) OR E3
    // Minimal cut sets: {E1, E2}, {E3}
    let mut ft = FaultTree::new("NestedGates".to_string(), "TOP".to_string()).unwrap();

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

    let mut zbdd = Zbdd::new();
    let root = zbdd
        .from_fault_tree(&ft)
        .expect("ZBDD conversion should succeed");

    // Should have 2 minimal cut sets: {E1, E2}, {E3}
    let products = zbdd.enumerate_products(root);
    assert_eq!(products.len(), 2, "Should have exactly 2 minimal cut sets");

    // Find the cut set with size 2 and size 1
    let size_2 = products.iter().find(|p| p.len() == 2);
    let size_1 = products.iter().find(|p| p.len() == 1);

    assert!(size_2.is_some(), "Should have one cut set of size 2");
    assert!(size_1.is_some(), "Should have one cut set of size 1");
}

#[test]
fn test_zbdd_atleast_gate() {
    // Create fault tree: TOP = AtLeast(2, [E1, E2, E3])
    // Minimal cut sets: {E1, E2}, {E1, E3}, {E2, E3}
    let mut ft = FaultTree::new("AtLeastGate".to_string(), "TOP".to_string()).unwrap();

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

    let mut zbdd = Zbdd::new();
    let root = zbdd
        .from_fault_tree(&ft)
        .expect("ZBDD conversion should succeed");

    // Should have 3 minimal cut sets: {E1, E2}, {E1, E3}, {E2, E3}
    let products = zbdd.enumerate_products(root);
    assert_eq!(
        products.len(),
        3,
        "Should have exactly 3 minimal cut sets for 2-of-3"
    );

    // All cut sets should have exactly 2 elements
    for product in &products {
        assert_eq!(product.len(), 2, "Each cut set should have 2 elements");
    }
}

#[test]
fn test_zbdd_complex_shared_events() {
    // Create fault tree: TOP = (E1 AND E2) OR (E2 AND E3)
    // Minimal cut sets: {E1, E2}, {E2, E3}
    // Note: E2 is shared between both paths
    let mut ft = FaultTree::new("SharedEvents".to_string(), "TOP".to_string()).unwrap();

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

    let mut zbdd = Zbdd::new();
    let root = zbdd
        .from_fault_tree(&ft)
        .expect("ZBDD conversion should succeed");

    // Should have 2 minimal cut sets: {E1, E2}, {E2, E3}
    let products = zbdd.enumerate_products(root);
    assert_eq!(products.len(), 2, "Should have exactly 2 minimal cut sets");

    // Both cut sets should have 2 elements
    for product in &products {
        assert_eq!(product.len(), 2, "Each cut set should have 2 elements");
    }
}

#[test]
fn test_zbdd_stats() {
    let mut ft = FaultTree::new("StatsTest".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut zbdd = Zbdd::new();
    let root = zbdd
        .from_fault_tree(&ft)
        .expect("ZBDD conversion should succeed");

    let stats = zbdd.stats(root);

    assert_eq!(stats.num_products, 2, "Should have 2 products");
    assert_eq!(stats.num_variables, 2, "Should have 2 variables");
    assert!(stats.num_nodes >= 2, "Should have at least 2 nodes");
    assert_eq!(stats.max_product_size, 1, "Max product size should be 1");
}

#[test]
fn test_zbdd_get_cut_sets_pruned_tau_and_cap() {
    // TOP = E1 OR E2 OR E3
    // With tau=0.15 and event probs {E1:0.10,E2:0.20,E3:0.05}, only {E2} survives.
    let mut ft = FaultTree::new("PrunedOr".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.10).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.20).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.05).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut prob_by_event_id: HashMap<String, f64> = HashMap::new();
    prob_by_event_id.insert("E1".to_string(), 0.10);
    prob_by_event_id.insert("E2".to_string(), 0.20);
    prob_by_event_id.insert("E3".to_string(), 0.05);

    let mut zbdd = Zbdd::new();
    let root = zbdd.from_fault_tree(&ft).unwrap();

    let cut_sets = zbdd.get_cut_sets_pruned(root, Some(1), 0.15, &prob_by_event_id, 1);
    assert_eq!(cut_sets.len(), 1);
    assert!(cut_sets[0].events.contains("E2"));
    assert_eq!(cut_sets[0].events.len(), 1);
}

#[test]
fn test_zbdd_cache_clearing() {
    let mut zbdd = Zbdd::new();

    let x1 = zbdd.variable(0);
    let x2 = zbdd.variable(1);
    let union_result = zbdd.union(x1, x2);

    let count_before = zbdd.count_products(union_result);

    // Clear caches
    zbdd.clear_caches();

    // Should still work after clearing
    let count_after = zbdd.count_products(union_result);
    assert_eq!(
        count_before, count_after,
        "Count should be the same after cache clear"
    );
    assert_eq!(count_after, 2, "Should still have 2 products");
}
