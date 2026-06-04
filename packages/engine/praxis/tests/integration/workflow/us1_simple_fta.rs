/// Integration test for User Story 1: Core PRA Engine
///
/// Tests the complete fault tree analysis workflow:
/// 1. Build a fault tree programmatically (mimicking and.xml test case)
/// 2. Run fault tree analysis
/// 3. Verify computed probability matches expected analytical result
///
/// Test case from mcSCRAM/input/core/and.xml:
/// - AND gate with two basic events A and B
/// - P(A) = 0.5, P(B) = 0.25
/// - Expected: P(AND) = 0.5 * 0.25 = 0.125
use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};

#[test]
fn test_us1_simple_and_gate_analysis() {
    // Build fault tree matching mcSCRAM/input/core/and.xml
    let mut ft = FaultTree::new("depth1", "and").unwrap();

    // Create AND gate
    let mut and_gate = Gate::new("and".to_string(), Formula::And).unwrap();
    and_gate.add_operand("A".to_string());
    and_gate.add_operand("B".to_string());
    ft.add_gate(and_gate).unwrap();

    // Add basic events with probabilities from XML
    ft.add_basic_event(BasicEvent::new("A".to_string(), 0.5).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("B".to_string(), 0.25).unwrap())
        .unwrap();

    // Run analysis
    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // Verify result: P(A AND B) = 0.5 * 0.25 = 0.125
    assert!(
        (result.top_event_probability - 0.125).abs() < 1e-10,
        "Expected probability 0.125, got {}",
        result.top_event_probability
    );
    assert_eq!(result.gates_analyzed, 1);
    assert_eq!(result.basic_events_count, 2);
}

#[test]
fn test_us1_simple_or_gate_analysis() {
    // Test OR gate from mcSCRAM/input/core/or.xml pattern
    let mut ft = FaultTree::new("or_tree", "or").unwrap();

    let mut or_gate = Gate::new("or".to_string(), Formula::Or).unwrap();
    or_gate.add_operand("A".to_string());
    or_gate.add_operand("B".to_string());
    ft.add_gate(or_gate).unwrap();

    ft.add_basic_event(BasicEvent::new("A".to_string(), 0.1).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("B".to_string(), 0.2).unwrap())
        .unwrap();

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // P(A OR B) = 1 - (1-0.1)*(1-0.2) = 1 - 0.9*0.8 = 0.28
    assert!(
        (result.top_event_probability - 0.28).abs() < 1e-10,
        "Expected probability 0.28, got {}",
        result.top_event_probability
    );
}

#[test]
fn test_us1_nested_gates_analysis() {
    // Test nested gate structure: TopGate = (A OR B) AND C
    let mut ft = FaultTree::new("nested", "TopGate").unwrap();

    // TopGate = G1 AND C
    let mut top_gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("C".to_string());
    ft.add_gate(top_gate).unwrap();

    // G1 = A OR B
    let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
    g1.add_operand("A".to_string());
    g1.add_operand("B".to_string());
    ft.add_gate(g1).unwrap();

    // Add basic events
    ft.add_basic_event(BasicEvent::new("A".to_string(), 0.1).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("B".to_string(), 0.2).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("C".to_string(), 0.5).unwrap())
        .unwrap();

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // P(G1) = P(A OR B) = 1 - (1-0.1)*(1-0.2) = 0.28
    // P(TopGate) = P(G1 AND C) = 0.28 * 0.5 = 0.14
    assert!(
        (result.top_event_probability - 0.14).abs() < 1e-10,
        "Expected probability 0.14, got {}",
        result.top_event_probability
    );
    assert_eq!(result.gates_analyzed, 2);
    assert_eq!(result.basic_events_count, 3);
}

#[test]
#[ignore = "XOR gate not supported by the BDD backend"]
fn test_us1_complex_gate_types() {
    // Test various gate types in one tree
    let mut ft = FaultTree::new("complex", "Root").unwrap();

    // Root = NOT(G1)
    let mut root = Gate::new("Root".to_string(), Formula::Not).unwrap();
    root.add_operand("G1".to_string());
    ft.add_gate(root).unwrap();

    // G1 = A XOR B
    let mut g1 = Gate::new("G1".to_string(), Formula::Xor).unwrap();
    g1.add_operand("A".to_string());
    g1.add_operand("B".to_string());
    ft.add_gate(g1).unwrap();

    ft.add_basic_event(BasicEvent::new("A".to_string(), 0.3).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("B".to_string(), 0.4).unwrap())
        .unwrap();

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // P(A XOR B) = P(A) + P(B) - 2*P(A)*P(B) = 0.3 + 0.4 - 2*0.3*0.4 = 0.46
    // P(NOT G1) = 1 - 0.46 = 0.54
    assert!(
        (result.top_event_probability - 0.54).abs() < 1e-10,
        "Expected probability 0.54, got {}",
        result.top_event_probability
    );
}

#[test]
fn test_us1_zero_probability_events() {
    // Edge case: event with zero probability
    let mut ft = FaultTree::new("zero", "and").unwrap();

    let mut gate = Gate::new("and".to_string(), Formula::And).unwrap();
    gate.add_operand("A".to_string());
    gate.add_operand("B".to_string());
    ft.add_gate(gate).unwrap();

    ft.add_basic_event(BasicEvent::new("A".to_string(), 0.0).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("B".to_string(), 0.5).unwrap())
        .unwrap();

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // P(0 AND 0.5) = 0
    assert_eq!(result.top_event_probability, 0.0);
}

#[test]
fn test_us1_certain_failure_events() {
    // Edge case: event with probability 1.0 (certain failure)
    let mut ft = FaultTree::new("certain", "or").unwrap();

    let mut gate = Gate::new("or".to_string(), Formula::Or).unwrap();
    gate.add_operand("A".to_string());
    gate.add_operand("B".to_string());
    ft.add_gate(gate).unwrap();

    ft.add_basic_event(BasicEvent::new("A".to_string(), 1.0).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("B".to_string(), 0.5).unwrap())
        .unwrap();

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // P(1.0 OR 0.5) = 1.0
    assert_eq!(result.top_event_probability, 1.0);
}
