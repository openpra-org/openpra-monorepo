use praxis::algorithms::mocus::Mocus;
use praxis::analysis::approximations::{mcub_approximation, rare_event_approximation};
use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use std::collections::HashMap;

#[test]
fn test_rea_or_gate() {

    let mut ft = FaultTree::new("REATest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.02).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();
    let exact = result.top_event_probability;

    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    assert!(cut_sets.len() >= 2);

    let mut probs = HashMap::new();
    probs.insert(1, 0.01);
    probs.insert(2, 0.02);

    let cut_sets_i32: Vec<Vec<i32>> = cut_sets
        .iter()
        .map(|cs| {
            cs.events
                .iter()
                .filter_map(|event_id| {
                    ft.basic_events()
                        .keys()
                        .position(|k| k == event_id)
                        .map(|pos| (pos + 1) as i32)
                })
                .collect()
        })
        .collect();

    let rea = rare_event_approximation(&cut_sets_i32, &probs);

    assert!((rea - 0.03).abs() < 0.001, "REA = {}", rea);
    assert!((exact - 0.0298).abs() < 0.0001, "Exact = {}", exact);

    assert!(rea >= exact, "REA should overestimate for OR gates");
}

#[test]
fn test_mcub_or_gate() {

    let mut ft = FaultTree::new("MCUBTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();
    let exact = result.top_event_probability;

    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    let mut probs = HashMap::new();
    probs.insert(1, 0.1);
    probs.insert(2, 0.2);

    let cut_sets_i32: Vec<Vec<i32>> = cut_sets
        .iter()
        .map(|cs| {
            cs.events
                .iter()
                .filter_map(|event_id| {
                    ft.basic_events()
                        .keys()
                        .position(|k| k == event_id)
                        .map(|pos| (pos + 1) as i32)
                })
                .collect()
        })
        .collect();

    let mcub = mcub_approximation(&cut_sets_i32, &probs);

    assert!((exact - 0.28).abs() < 0.0001, "Exact = {}", exact);

    assert!(
        (mcub - exact).abs() < 0.01,
        "MCUB = {}, Exact = {}",
        mcub,
        exact
    );
}

#[test]
fn test_approximations_and_gate() {

    let mut ft = FaultTree::new("ANDTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();
    let exact = result.top_event_probability;

    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    assert_eq!(cut_sets.len(), 1);

    let mut probs = HashMap::new();
    probs.insert(1, 0.1);
    probs.insert(2, 0.2);

    let cut_sets_i32: Vec<Vec<i32>> = cut_sets
        .iter()
        .map(|cs| {
            cs.events
                .iter()
                .filter_map(|event_id| {
                    ft.basic_events()
                        .keys()
                        .position(|k| k == event_id)
                        .map(|pos| (pos + 1) as i32)
                })
                .collect()
        })
        .collect();

    let rea = rare_event_approximation(&cut_sets_i32, &probs);
    let mcub = mcub_approximation(&cut_sets_i32, &probs);

    assert!((exact - 0.02).abs() < 0.0001, "Exact = {}", exact);

    assert!((rea - exact).abs() < 0.0001, "REA = {}", rea);
    assert!((mcub - exact).abs() < 0.0001, "MCUB = {}", mcub);
}

#[test]
fn test_rea_vs_mcub() {

    let mut ft = FaultTree::new("CompareTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.05).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.10).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.15).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();
    let exact = result.top_event_probability;

    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    let mut probs = HashMap::new();
    probs.insert(1, 0.05);
    probs.insert(2, 0.10);
    probs.insert(3, 0.15);

    let cut_sets_i32: Vec<Vec<i32>> = cut_sets
        .iter()
        .map(|cs| {
            cs.events
                .iter()
                .filter_map(|event_id| {
                    ft.basic_events()
                        .keys()
                        .position(|k| k == event_id)
                        .map(|pos| (pos + 1) as i32)
                })
                .collect()
        })
        .collect();

    let rea = rare_event_approximation(&cut_sets_i32, &probs);
    let mcub = mcub_approximation(&cut_sets_i32, &probs);

    assert!((exact - 0.27325).abs() < 0.0001, "Exact = {}", exact);

    assert!((rea - 0.30).abs() < 0.001, "REA = {}", rea);

    assert!(
        (mcub - exact).abs() < (rea - exact).abs(),
        "MCUB should be more accurate"
    );

    assert!(rea >= exact, "REA should be upper bound");
    assert!(mcub >= exact, "MCUB should be upper bound");
}

#[test]
fn test_limit_order_filtering() {

    let mut ft = FaultTree::new("OrderTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.05).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut mocus = Mocus::new(&ft).with_max_order(1);
    let cut_sets_1 = mocus.analyze().unwrap();

    assert_eq!(cut_sets_1.len(), 1);
    assert_eq!(cut_sets_1[0].order(), 1);

    let mut mocus = Mocus::new(&ft).with_max_order(2);
    let cut_sets_2 = mocus.analyze().unwrap();

    assert_eq!(cut_sets_2.len(), 2);

    let mut mocus = Mocus::new(&ft);
    let cut_sets_all = mocus.analyze().unwrap();

    assert_eq!(cut_sets_all.len(), 2);
}

#[test]
fn test_cut_off_filtering() {

    let mut ft = FaultTree::new("CutoffTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.01).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.001).unwrap();
    let e4 = BasicEvent::new("E4".to_string(), 0.0001).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();
    ft.add_basic_event(e4).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    top_gate.add_operand("E3".to_string());
    top_gate.add_operand("E4".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap();

    assert_eq!(all_cut_sets.len(), 4);

    let mut event_probs = HashMap::new();
    for (event_id, event) in ft.basic_events() {
        event_probs.insert(event_id.clone(), event.probability());
    }

    let filtered_005 = praxis::analysis::fault_tree::filter_by_probability(
        all_cut_sets.to_vec(),
        &event_probs,
        0.005,
    );
    assert_eq!(filtered_005.len(), 2);

    let filtered_05 = praxis::analysis::fault_tree::filter_by_probability(
        all_cut_sets.to_vec(),
        &event_probs,
        0.05,
    );
    assert_eq!(filtered_05.len(), 1);

    let filtered_0005 = praxis::analysis::fault_tree::filter_by_probability(
        all_cut_sets.to_vec(),
        &event_probs,
        0.0005,
    );
    assert_eq!(filtered_0005.len(), 3);
}
