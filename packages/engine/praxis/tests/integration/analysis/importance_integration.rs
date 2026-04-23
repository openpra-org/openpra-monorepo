use praxis::algorithms::mocus::Mocus;
use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::analysis::importance::ImportanceAnalysis;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};

#[test]
fn test_importance_or_gate_comprehensive() {
    let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
    let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();
    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
        .unwrap();

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();

    let mut mocus_runner = Mocus::new(&ft);
    let cut_sets = mocus_runner.analyze().unwrap();
    let importance = ImportanceAnalysis::new(&ft, result.top_event_probability).unwrap();

    let fv_values = importance.compute_fussell_vesely_from_cutsets(&cut_sets).unwrap();
    let raw_values = importance.compute_raw().unwrap();
    let rrw_values = importance.compute_rrw().unwrap();
    let bi_values = importance.compute_birnbaum().unwrap();

    let fv_e1 = fv_values.get("E1").unwrap();
    let fv_e2 = fv_values.get("E2").unwrap();
    assert!((*fv_e1 - 0.357).abs() < 0.01, "FV(E1) = {}", fv_e1);
    assert!((*fv_e2 - 0.714).abs() < 0.01, "FV(E2) = {}", fv_e2);
    assert!(*fv_e2 > *fv_e1, "E2 should have higher FV");

    let raw_e1 = raw_values.get("E1").unwrap();
    let raw_e2 = raw_values.get("E2").unwrap();
    assert!((*raw_e1 - 3.57).abs() < 0.1, "RAW(E1) = {}", raw_e1);
    assert!((*raw_e2 - 3.57).abs() < 0.1, "RAW(E2) = {}", raw_e2);
    assert!(*raw_e1 >= 1.0 && *raw_e2 >= 1.0, "RAW must be >= 1");

    let rrw_e1 = rrw_values.get("E1").unwrap();
    let rrw_e2 = rrw_values.get("E2").unwrap();
    assert!((*rrw_e1 - 1.4).abs() < 0.1, "RRW(E1) = {}", rrw_e1);
    assert!((*rrw_e2 - 2.8).abs() < 0.1, "RRW(E2) = {}", rrw_e2);
    assert!(*rrw_e2 > *rrw_e1, "E2 should have higher RRW");

    let bi_e1 = bi_values.get("E1").unwrap();
    let bi_e2 = bi_values.get("E2").unwrap();
    assert!((*bi_e1 - 0.8).abs() < 0.01, "BI(E1) = {}", bi_e1);
    assert!((*bi_e2 - 0.9).abs() < 0.01, "BI(E2) = {}", bi_e2);
    assert!(*bi_e2 > *bi_e1, "E2 should have higher Birnbaum");
}

#[test]
fn test_importance_and_gate_critical_components() {
    let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
    let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();
    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.05).unwrap())
        .unwrap();

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();
    let top_prob = result.top_event_probability;

    let importance = ImportanceAnalysis::new(&ft, top_prob).unwrap();

    let raw_values = importance.compute_raw().unwrap();
    let raw_e1 = raw_values.get("E1").unwrap();
    let raw_e2 = raw_values.get("E2").unwrap();

    assert!(*raw_e1 > *raw_e2, "E1 should have higher RAW");
    assert!(*raw_e1 > 50.0, "E1 RAW should be very high");
    assert!(*raw_e2 > 10.0, "E2 RAW should be high");

    let rrw_values = importance.compute_rrw().unwrap();
    let rrw_e1 = rrw_values.get("E1").unwrap();
    let rrw_e2 = rrw_values.get("E2").unwrap();

    assert!(rrw_e1.is_infinite(), "RRW(E1) should be infinite");
    assert!(rrw_e2.is_infinite(), "RRW(E2) should be infinite");
}

#[test]
fn test_importance_complex_tree_ranking() {
    let mut ft = FaultTree::new("TestFT".to_string(), "TopGate".to_string()).unwrap();

    let mut top_gate = Gate::new("TopGate".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.3).unwrap())
        .unwrap();

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();

    let mut mocus_runner = Mocus::new(&ft);
    let cut_sets = mocus_runner.analyze().unwrap();
    let importance = ImportanceAnalysis::new(&ft, result.top_event_probability).unwrap();

    let fv_values = importance.compute_fussell_vesely_from_cutsets(&cut_sets).unwrap();
    let bi_values = importance.compute_birnbaum().unwrap();

    let fv_e1 = fv_values.get("E1").unwrap();
    let fv_e2 = fv_values.get("E2").unwrap();
    let fv_e3 = fv_values.get("E3").unwrap();

    assert!(*fv_e3 > *fv_e1, "E3 should be more important than E1");
    assert!(*fv_e3 > *fv_e2, "E3 should be more important than E2");

    for (event_id, bi) in &bi_values {
        assert!(
            *bi >= 0.0 && *bi <= 1.0,
            "{}: Birnbaum = {} out of bounds",
            event_id,
            bi
        );
    }
}

#[test]
fn test_importance_redundant_events() {
    let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
    let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    gate.add_operand("E3".to_string());
    ft.add_gate(gate).unwrap();

    let prob = 0.1;
    ft.add_basic_event(BasicEvent::new("E1".to_string(), prob).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), prob).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E3".to_string(), prob).unwrap())
        .unwrap();

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();

    let importance = ImportanceAnalysis::new(&ft, result.top_event_probability).unwrap();

    let rrw_values = importance.compute_rrw().unwrap();
    let rrw_e1 = rrw_values.get("E1").unwrap();
    let rrw_e2 = rrw_values.get("E2").unwrap();
    let rrw_e3 = rrw_values.get("E3").unwrap();

    assert!((*rrw_e1 - *rrw_e2).abs() < 0.01, "RRW should be similar");
    assert!((*rrw_e1 - *rrw_e3).abs() < 0.01, "RRW should be similar");

    assert!(*rrw_e1 > 1.0 && *rrw_e2 > 1.0 && *rrw_e3 > 1.0);
}

#[test]
fn test_importance_consistency_across_measures() {
    let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
    let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();
    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.3).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.4).unwrap())
        .unwrap();

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();

    let mut mocus_runner = Mocus::new(&ft);
    let cut_sets = mocus_runner.analyze().unwrap();
    let importance = ImportanceAnalysis::new(&ft, result.top_event_probability).unwrap();

    let fv_values = importance.compute_fussell_vesely_from_cutsets(&cut_sets).unwrap();
    let raw_values = importance.compute_raw().unwrap();
    let rrw_values = importance.compute_rrw().unwrap();
    let bi_values = importance.compute_birnbaum().unwrap();

    let fv_e1 = fv_values.get("E1").unwrap();
    let fv_e2 = fv_values.get("E2").unwrap();
    let bi_e1 = bi_values.get("E1").unwrap();
    let bi_e2 = bi_values.get("E2").unwrap();

    if *fv_e2 > *fv_e1 {
        assert!(
            *bi_e2 > *bi_e1,
            "Birnbaum should agree with FV on importance ranking"
        );
    }

    for (event_id, raw) in &raw_values {
        assert!(*raw >= 1.0, "{}: RAW = {} < 1", event_id, raw);
    }
    for (event_id, rrw) in &rrw_values {
        assert!(*rrw >= 1.0, "{}: RRW = {} < 1", event_id, rrw);
    }
}

#[test]
fn test_importance_all_measures_present() {
    let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
    let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();
    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.2).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.3).unwrap())
        .unwrap();

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();

    let mut mocus_runner = Mocus::new(&ft);
    let cut_sets = mocus_runner.analyze().unwrap();
    let importance = ImportanceAnalysis::new(&ft, result.top_event_probability).unwrap();

    let fv_result = importance.compute_fussell_vesely_from_cutsets(&cut_sets);
    let raw_result = importance.compute_raw();
    let rrw_result = importance.compute_rrw();
    let bi_result = importance.compute_birnbaum();

    assert!(fv_result.is_ok(), "FV computation failed");
    assert!(raw_result.is_ok(), "RAW computation failed");
    assert!(rrw_result.is_ok(), "RRW computation failed");
    assert!(bi_result.is_ok(), "Birnbaum computation failed");

    assert_eq!(fv_result.unwrap().len(), 2);
    assert_eq!(raw_result.unwrap().len(), 2);
    assert_eq!(rrw_result.unwrap().len(), 2);
    assert_eq!(bi_result.unwrap().len(), 2);
}
