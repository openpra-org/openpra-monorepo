/// Integration tests for Preprocessor with real fault trees
use praxis::algorithms::pdag::Pdag;
use praxis::algorithms::preprocessor::Preprocessor;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};

#[test]
fn test_preprocessor_simple_tree() {
    let mut ft = FaultTree::new("FT1", "G1").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.01).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    let pdag = Pdag::from_fault_tree(&ft).unwrap();
    let mut preprocessor = Preprocessor::new(pdag);

    preprocessor.run().unwrap();

    let stats = preprocessor.stats();
    assert_eq!(stats.original_nodes, 3); // 2 events + 1 gate
}

#[test]
fn test_preprocessor_with_atleast_gate() {
    let mut ft = FaultTree::new("FT1", "G1").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.01).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.01).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    // AtLeast(2, E1, E2, E3) - 2-out-of-3 voting
    let mut g1 = Gate::new("G1".to_string(), Formula::AtLeast { min: 2 }).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    g1.add_operand("E3".to_string());
    ft.add_gate(g1).unwrap();

    let pdag = Pdag::from_fault_tree(&ft).unwrap();
    let original_count = pdag.node_count();

    let mut preprocessor = Preprocessor::new(pdag);
    preprocessor.run().unwrap();

    let stats = preprocessor.stats();
    assert_eq!(stats.original_nodes, original_count);
    assert!(stats.gates_normalized > 0);
}

#[test]
fn test_preprocessor_with_not_gate() {
    let mut ft = FaultTree::new("FT1", "G2").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    ft.add_basic_event(e1).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::Not).unwrap();
    g1.add_operand("E1".to_string());
    ft.add_gate(g1).unwrap();

    let mut g2 = Gate::new("G2".to_string(), Formula::Or).unwrap();
    g2.add_operand("G1".to_string());
    ft.add_gate(g2).unwrap();

    let pdag = Pdag::from_fault_tree(&ft).unwrap();
    let mut preprocessor = Preprocessor::new(pdag);

    preprocessor.run().unwrap();

    let stats = preprocessor.stats();
    assert!(stats.gates_normalized > 0);
}

#[test]
fn test_preprocessor_nested_gates() {
    let mut ft = FaultTree::new("FT1", "G3").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.01).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.01).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());

    let mut g2 = Gate::new("G2".to_string(), Formula::Or).unwrap();
    g2.add_operand("E2".to_string());
    g2.add_operand("E3".to_string());

    let mut g3 = Gate::new("G3".to_string(), Formula::Or).unwrap();
    g3.add_operand("G1".to_string());
    g3.add_operand("G2".to_string());

    ft.add_gate(g1).unwrap();
    ft.add_gate(g2).unwrap();
    ft.add_gate(g3).unwrap();

    let pdag = Pdag::from_fault_tree(&ft).unwrap();
    let mut preprocessor = Preprocessor::new(pdag);

    preprocessor.run().unwrap();

    let stats = preprocessor.stats();
    assert_eq!(stats.original_nodes, 6); // 3 events + 3 gates
}

#[test]
fn test_preprocessor_stats() {
    let mut ft = FaultTree::new("FT1", "G1").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.01).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    let pdag = Pdag::from_fault_tree(&ft).unwrap();
    let mut preprocessor = Preprocessor::new(pdag);

    preprocessor.run().unwrap();

    let stats = preprocessor.stats();
    assert_eq!(stats.original_nodes, 3);
    assert_eq!(stats.final_nodes, 3);
    assert_eq!(stats.reduction_percentage(), 0.0);
}

#[test]
fn test_preprocessor_module_detection() {
    let mut ft = FaultTree::new("FT1", "G3").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.01).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.01).unwrap();
    let e4 = BasicEvent::new("E4".to_string(), 0.01).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();
    ft.add_basic_event(e4).unwrap();

    // G1 and G2 are independent modules
    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());

    let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
    g2.add_operand("E3".to_string());
    g2.add_operand("E4".to_string());

    let mut g3 = Gate::new("G3".to_string(), Formula::Or).unwrap();
    g3.add_operand("G1".to_string());
    g3.add_operand("G2".to_string());

    ft.add_gate(g1).unwrap();
    ft.add_gate(g2).unwrap();
    ft.add_gate(g3).unwrap();

    let pdag = Pdag::from_fault_tree(&ft).unwrap();
    let mut preprocessor = Preprocessor::new(pdag);

    preprocessor.run().unwrap();

    let stats = preprocessor.stats();
    assert!(stats.modules_detected > 0);
}

#[test]
fn test_preprocessor_coherence_check() {
    let mut ft = FaultTree::new("FT1", "G1").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.01).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    let pdag = Pdag::from_fault_tree(&ft).unwrap();
    assert!(pdag.is_coherent());

    let mut preprocessor = Preprocessor::new(pdag);
    preprocessor.run().unwrap();

    assert!(preprocessor.pdag().is_coherent());
}
