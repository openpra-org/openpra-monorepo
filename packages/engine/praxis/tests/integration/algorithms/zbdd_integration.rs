use praxis::algorithms::bdd_engine::Bdd as BddEngine;
use praxis::algorithms::bdd_pdag::BddPdag;
use praxis::algorithms::zbdd_engine::ZbddEngine;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use std::collections::HashMap;

fn zbdd_enumerate(ft: &FaultTree) -> Vec<Vec<String>> {
    let mut pdag = BddPdag::from_fault_tree(ft).unwrap();
    pdag.compute_ordering_and_modules().unwrap();
    let (mut bdd_engine, bdd_root) = BddEngine::build_from_pdag(&pdag).unwrap();
    bdd_engine.freeze();
    let (zbdd, zbdd_root) = ZbddEngine::build_from_bdd(&bdd_engine, bdd_root, false);
    let var_order = pdag.variable_order().to_vec();
    zbdd.enumerate(zbdd_root)
        .into_iter()
        .map(|set| {
            set.iter()
                .filter_map(|&pos| {
                    var_order
                        .get(pos)
                        .and_then(|&idx| pdag.node(idx))
                        .and_then(|n| n.id())
                        .map(|s| s.to_string())
                })
                .collect()
        })
        .collect()
}

#[test]
fn test_zbdd_simple_and_gate() {
    let mut ft = FaultTree::new("SimpleAnd".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let products = zbdd_enumerate(&ft);
    assert_eq!(products.len(), 1, "Should have exactly 1 minimal cut set");
    assert_eq!(products[0].len(), 2, "Cut set should have 2 elements");
}

#[test]
fn test_zbdd_simple_or_gate() {
    let mut ft = FaultTree::new("SimpleOr".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let products = zbdd_enumerate(&ft);
    assert_eq!(products.len(), 2, "Should have exactly 2 minimal cut sets");

    for product in &products {
        assert_eq!(product.len(), 1, "Each cut set should have 1 element");
    }
}

#[test]
fn test_zbdd_nested_gates() {
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

    let products = zbdd_enumerate(&ft);
    assert_eq!(products.len(), 2, "Should have exactly 2 minimal cut sets");

    let size_2 = products.iter().find(|p| p.len() == 2);
    let size_1 = products.iter().find(|p| p.len() == 1);

    assert!(size_2.is_some(), "Should have one cut set of size 2");
    assert!(size_1.is_some(), "Should have one cut set of size 1");
}

#[test]
fn test_zbdd_atleast_gate() {
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

    let products = zbdd_enumerate(&ft);
    assert_eq!(
        products.len(),
        3,
        "Should have exactly 3 minimal cut sets for 2-of-3"
    );

    for product in &products {
        assert_eq!(product.len(), 2, "Each cut set should have 2 elements");
    }
}

#[test]
fn test_zbdd_complex_shared_events() {
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

    let products = zbdd_enumerate(&ft);
    assert_eq!(products.len(), 2, "Should have exactly 2 minimal cut sets");

    for product in &products {
        assert_eq!(product.len(), 2, "Each cut set should have 2 elements");
    }
}

#[test]
fn test_zbdd_node_count() {
    let mut ft = FaultTree::new("StatsTest".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut pdag = BddPdag::from_fault_tree(&ft).unwrap();
    pdag.compute_ordering_and_modules().unwrap();
    let (mut bdd_engine, bdd_root) = BddEngine::build_from_pdag(&pdag).unwrap();
    bdd_engine.freeze();
    let (zbdd, zbdd_root) = ZbddEngine::build_from_bdd(&bdd_engine, bdd_root, false);

    let products = zbdd.enumerate(zbdd_root);
    assert_eq!(products.len(), 2, "Should have 2 products");
    assert!(zbdd.node_count() >= 2, "Should have at least 2 nodes");

    let max_size = products.iter().map(|p| p.len()).max().unwrap_or(0);
    assert_eq!(max_size, 1, "Max product size should be 1");
}

#[test]
fn test_zbdd_probability_filtered_cut_sets() {
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

    let all_products = zbdd_enumerate(&ft);
    let tau = 0.15;
    let filtered: Vec<_> = all_products
        .iter()
        .filter(|set| {
            let p: f64 = set
                .iter()
                .map(|e| prob_by_event_id.get(e).copied().unwrap_or(0.0))
                .product();
            p >= tau
        })
        .collect();

    assert_eq!(filtered.len(), 1);
    assert!(filtered[0].contains(&"E2".to_string()));
    assert_eq!(filtered[0].len(), 1);
}

#[test]
fn test_zbdd_cache_clearing_roundtrip() {
    let mut ft = FaultTree::new("CacheTest".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut pdag = BddPdag::from_fault_tree(&ft).unwrap();
    pdag.compute_ordering_and_modules().unwrap();
    let (mut bdd_engine, bdd_root) = BddEngine::build_from_pdag(&pdag).unwrap();
    bdd_engine.freeze();
    let (mut zbdd, zbdd_root) = ZbddEngine::build_from_bdd(&bdd_engine, bdd_root, true);

    let count_before = zbdd.enumerate(zbdd_root).len();

    zbdd.clear_caches();

    let count_after = zbdd.enumerate(zbdd_root).len();
    assert_eq!(
        count_before, count_after,
        "Count should be the same after cache clear"
    );
    assert_eq!(count_after, 2, "Should still have 2 products");
}
