use praxis::algorithms::pdag::{Connective, Pdag};
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};

#[test]
fn test_pdag_from_simple_and_tree() {
    // Create fault tree: TOP = E1 AND E2
    let mut ft = FaultTree::new("SimpleAnd".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let pdag = Pdag::from_fault_tree(&ft).expect("PDAG conversion should succeed");

    // Should have 3 nodes: 2 basic events + 1 gate
    assert_eq!(pdag.num_nodes(), 3);

    let stats = pdag.stats();
    assert_eq!(stats.num_basic_events, 2);
    assert_eq!(stats.num_gates, 1);
    assert_eq!(stats.max_depth, 1);

    // Check topological order
    let sorted = pdag.topological_sort().unwrap();
    assert_eq!(sorted.len(), 3);
}

#[test]
fn test_pdag_from_or_tree() {
    let mut ft = FaultTree::new("SimpleOr".to_string(), "TOP".to_string()).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let pdag = Pdag::from_fault_tree(&ft).expect("PDAG conversion should succeed");

    assert_eq!(pdag.num_nodes(), 3);
    assert!(pdag.is_coherent());
}

#[test]
fn test_pdag_nested_gates() {
    // Create fault tree: TOP = (E1 AND E2) OR E3
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

    let pdag = Pdag::from_fault_tree(&ft).expect("PDAG conversion should succeed");

    let stats = pdag.stats();
    assert_eq!(stats.num_nodes, 5); // 3 basic events + 2 gates
    assert_eq!(stats.num_basic_events, 3);
    assert_eq!(stats.num_gates, 2);
    assert_eq!(stats.max_depth, 2);

    // Verify topological order
    let sorted = pdag.topological_sort().unwrap();
    let root_idx = pdag.root().unwrap();
    let root_pos = sorted.iter().position(|&x| x == root_idx).unwrap();

    // Root should be last in topological order
    assert_eq!(root_pos, sorted.len() - 1);
}

#[test]
fn test_pdag_atleast_gate() {
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

    let pdag = Pdag::from_fault_tree(&ft).expect("PDAG conversion should succeed");

    assert_eq!(pdag.num_nodes(), 4); // 3 basic events + 1 gate

    // Check that the gate has the correct connective
    let root_idx = pdag.root().unwrap();
    let root_node = pdag.get_node(root_idx).unwrap();

    if let praxis::algorithms::pdag::PdagNode::Gate { connective, .. } = root_node {
        assert_eq!(*connective, Connective::AtLeast);
    } else {
        panic!("Root should be a gate");
    }
}

#[test]
fn test_pdag_shared_events() {
    // Create fault tree: TOP = (E1 AND E2) OR (E2 AND E3)
    // E2 is shared between both gates
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

    let pdag = Pdag::from_fault_tree(&ft).expect("PDAG conversion should succeed");

    let stats = pdag.stats();
    assert_eq!(stats.num_basic_events, 3);
    assert_eq!(stats.num_gates, 3);

    // E2 should have 2 parents (G1 and G2)
    let e2_idx = pdag.get_index("E2").unwrap();
    let e2_parents = pdag.parents().get(&e2_idx);
    assert!(e2_parents.is_some());
    assert_eq!(e2_parents.unwrap().len(), 2);
}

#[test]
fn test_pdag_index_lookup() {
    let mut pdag = Pdag::new();

    let e1_idx = pdag.add_basic_event("E1".to_string());

    // Should be able to look up by ID
    let lookup_idx = pdag.get_index("E1").unwrap();
    assert_eq!(e1_idx, lookup_idx);

    // Should be able to get node by index
    let node = pdag.get_node(e1_idx).unwrap();
    assert_eq!(node.id(), Some("E1"));
}

#[test]
fn test_pdag_coherence_check() {
    let mut pdag = Pdag::new();

    let e1 = pdag.add_basic_event("E1".to_string());
    let e2 = pdag.add_basic_event("E2".to_string());

    // Add coherent gates
    pdag.add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
        .unwrap();

    assert!(pdag.is_coherent());

    // Add non-coherent gate (NOT)
    pdag.add_gate("G2".to_string(), Connective::Not, vec![e1], None)
        .unwrap();

    assert!(!pdag.is_coherent());
}
