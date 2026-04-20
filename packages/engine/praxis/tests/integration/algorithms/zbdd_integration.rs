use praxis::algorithms::zbdd::{Zbdd, BASE, EMPTY};
use praxis::core::event::{BasicEvent, HouseEvent};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};

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

    let (zbdd, root) = Zbdd::from_fault_tree(&ft).expect("ZBDD conversion should succeed");

    // Should have 1 minimal cut set: {E1, E2}
    let products = zbdd.get_cut_sets(root, None);
    assert_eq!(products.len(), 1, "Should have exactly 1 minimal cut set");
    assert_eq!(products[0].events.len(), 2, "Cut set should have 2 elements");
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

    let (zbdd, root) = Zbdd::from_fault_tree(&ft).expect("ZBDD conversion should succeed");

    // Should have 2 minimal cut sets: {E1}, {E2}
    let products = zbdd.get_cut_sets(root, None);
    assert_eq!(products.len(), 2, "Should have exactly 2 minimal cut sets");

    for product in products {
        assert_eq!(product.events.len(), 1, "Each cut set should have 1 element");
    }
}

#[test]
fn test_zbdd_shared_event() {
    // Create fault tree: TOP = G1 AND G2
    // G1 = E1 OR E2
    // G2 = E1 OR E3
    // Minimal cut sets: {E1}, {E2, E3}
    let mut ft = FaultTree::new("SharedEvent".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    let mut g2 = Gate::new("G2".to_string(), Formula::Or).unwrap();
    g2.add_operand("E1".to_string());
    g2.add_operand("E3".to_string());
    ft.add_gate(g2).unwrap();

    let mut top = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top.add_operand("G1".to_string());
    top.add_operand("G2".to_string());
    ft.add_gate(top).unwrap();

    let (zbdd, root) = Zbdd::from_fault_tree(&ft).expect("ZBDD conversion should succeed");

    let products = zbdd.get_cut_sets(root, None);
    assert_eq!(products.len(), 2, "Should have 2 minimal cut sets");

    let size_2 = products.iter().find(|p| p.events.len() == 2);
    let size_1 = products.iter().find(|p| p.events.len() == 1);

    assert!(size_2.is_some(), "Should have a cut set of size 2");
    assert!(size_1.is_some(), "Should have a cut set of size 1");
}

#[test]
fn test_zbdd_k_out_of_n() {
    // Create fault tree: TOP = 2-out-of-3 (E1, E2, E3)
    // Minimal cut sets: {E1, E2}, {E1, E3}, {E2, E3}
    let mut ft = FaultTree::new("KOutOfN".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut top = Gate::new("TOP".to_string(), Formula::AtLeast { min: 2 }).unwrap();
    top.add_operand("E1".to_string());
    top.add_operand("E2".to_string());
    top.add_operand("E3".to_string());
    ft.add_gate(top).unwrap();

    let (zbdd, root) = Zbdd::from_fault_tree(&ft).expect("ZBDD conversion should succeed");

    let products = zbdd.get_cut_sets(root, None);
    assert_eq!(products.len(), 3, "Should have exactly 3 minimal cut sets");

    for product in products {
        assert_eq!(product.events.len(), 2, "Each cut set should have 2 elements");
    }
}

#[test]
fn test_zbdd_complex_structure() {
    // Create fault tree from Fig 4.1 in some textbook
    let mut ft = FaultTree::new("Complex".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();
    let e4 = BasicEvent::new("E4".to_string(), 0.4).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();
    ft.add_basic_event(e4).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    let mut g2 = Gate::new("G2".to_string(), Formula::Or).unwrap();
    g2.add_operand("E3".to_string());
    g2.add_operand("E4".to_string());
    ft.add_gate(g2).unwrap();

    let mut top = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top.add_operand("G1".to_string());
    top.add_operand("G2".to_string());
    ft.add_gate(top).unwrap();

    let (zbdd, root) = Zbdd::from_fault_tree(&ft).expect("ZBDD conversion should succeed");

    let products = zbdd.get_cut_sets(root, None);
    assert_eq!(products.len(), 4, "Should have 4 minimal cut sets");

    for product in products {
        assert_eq!(product.events.len(), 2, "Each cut set should have 2 elements");
    }
}

#[test]
fn test_zbdd_house_events() {
    let mut ft = FaultTree::new("HouseEvents".to_string(), "TOP".to_string()).unwrap();

    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap()).unwrap();
    ft.add_house_event(HouseEvent::new("H1".to_string(), true).unwrap()).unwrap();

    let mut top = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top.add_operand("E1".to_string());
    top.add_operand("H1".to_string());
    ft.add_gate(top).unwrap();

    let (zbdd, root) = Zbdd::from_fault_tree(&ft).unwrap();
    let cut_sets = zbdd.get_cut_sets(root, None);

    assert_eq!(cut_sets.len(), 1);
    assert_eq!(cut_sets[0].events.len(), 1);
    assert!(cut_sets[0].events.contains("E1"));
}

#[test]
fn test_zbdd_manual_construction() {
    let mut zbdd = Zbdd::new();
    
    // Create simple products manually: {0}, {1}
    let x1 = zbdd.make_node(0, BASE, EMPTY);
    let x2 = zbdd.make_node(1, BASE, EMPTY);
    
    let union = zbdd.union(x1, x2);
    
    assert_eq!(zbdd.count_products(union), 2);
    
    zbdd.clear_op_caches();
}
