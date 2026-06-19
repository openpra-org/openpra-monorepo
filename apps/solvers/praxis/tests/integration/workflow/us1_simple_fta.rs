use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};

#[test]
fn test_us1_simple_and_gate_analysis() {

    let mut ft = FaultTree::new("depth1", "and").unwrap();

    let mut and_gate = Gate::new("and".to_string(), Formula::And).unwrap();
    and_gate.add_operand("A".to_string());
    and_gate.add_operand("B".to_string());
    ft.add_gate(and_gate).unwrap();

    ft.add_basic_event(BasicEvent::new("A".to_string(), 0.5).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("B".to_string(), 0.25).unwrap())
        .unwrap();

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

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

    assert!(
        (result.top_event_probability - 0.28).abs() < 1e-10,
        "Expected probability 0.28, got {}",
        result.top_event_probability
    );
}

#[test]
fn test_us1_nested_gates_analysis() {

    let mut ft = FaultTree::new("nested", "TopGate").unwrap();

    let mut top_gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("C".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
    g1.add_operand("A".to_string());
    g1.add_operand("B".to_string());
    ft.add_gate(g1).unwrap();

    ft.add_basic_event(BasicEvent::new("A".to_string(), 0.1).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("B".to_string(), 0.2).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("C".to_string(), 0.5).unwrap())
        .unwrap();

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

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

    let mut ft = FaultTree::new("complex", "Root").unwrap();

    let mut root = Gate::new("Root".to_string(), Formula::Not).unwrap();
    root.add_operand("G1".to_string());
    ft.add_gate(root).unwrap();

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

    assert!(
        (result.top_event_probability - 0.54).abs() < 1e-10,
        "Expected probability 0.54, got {}",
        result.top_event_probability
    );
}

#[test]
fn test_us1_zero_probability_events() {

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

    assert_eq!(result.top_event_probability, 0.0);
}

#[test]
fn test_us1_certain_failure_events() {

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

    assert_eq!(result.top_event_probability, 1.0);
}
