//! Integration tests for REA and MCUB approximations
//! Tests rare_event_approximation() and mcub_approximation() CLI integration

use praxis::algorithms::mocus::Mocus;
use praxis::analysis::approximations::{mcub_approximation, rare_event_approximation};
use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use std::collections::HashMap;

/// Test REA approximation with OR gate
#[test]
fn test_rea_or_gate() {
    // Create fault tree: TopEvent = E1 OR E2
    let mut ft = FaultTree::new("REATest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.02).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Get exact probability
    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();
    let exact = result.top_event_probability;

    // Get cut sets with MOCUS
    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    assert!(cut_sets.len() >= 2); // Should have {E1}, {E2}

    // Prepare probability map
    let mut probs = HashMap::new();
    probs.insert(1, 0.01); // E1
    probs.insert(2, 0.02); // E2

    // Convert cut sets to i32 format
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

    // Compute REA
    let rea = rare_event_approximation(&cut_sets_i32, &probs);

    // For OR gate with small probabilities: REA ≈ P(E1) + P(E2) = 0.03
    // Exact = 1 - (1-0.01)(1-0.02) = 0.0298
    assert!((rea - 0.03).abs() < 0.001, "REA = {}", rea);
    assert!((exact - 0.0298).abs() < 0.0001, "Exact = {}", exact);

    // REA should be slightly higher than exact for OR gates
    assert!(rea >= exact, "REA should overestimate for OR gates");
}

/// Test MCUB approximation with OR gate
#[test]
fn test_mcub_or_gate() {
    // Create fault tree: TopEvent = E1 OR E2
    let mut ft = FaultTree::new("MCUBTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Get exact probability
    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();
    let exact = result.top_event_probability;

    // Get cut sets with MOCUS
    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    // Prepare probability map
    let mut probs = HashMap::new();
    probs.insert(1, 0.1); // E1
    probs.insert(2, 0.2); // E2

    // Convert cut sets to i32 format
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

    // Compute MCUB
    let mcub = mcub_approximation(&cut_sets_i32, &probs);

    // Exact = 1 - (1-0.1)(1-0.2) = 0.28
    assert!((exact - 0.28).abs() < 0.0001, "Exact = {}", exact);

    // MCUB should be close to exact for OR gates
    assert!(
        (mcub - exact).abs() < 0.01,
        "MCUB = {}, Exact = {}",
        mcub,
        exact
    );
}

/// Test REA and MCUB with AND gate
#[test]
fn test_approximations_and_gate() {
    // Create fault tree: TopEvent = E1 AND E2
    let mut ft = FaultTree::new("ANDTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Get exact probability
    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();
    let exact = result.top_event_probability;

    // Get cut sets with MOCUS
    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    assert_eq!(cut_sets.len(), 1); // Should have {E1, E2}

    // Prepare probability map
    let mut probs = HashMap::new();
    probs.insert(1, 0.1); // E1
    probs.insert(2, 0.2); // E2

    // Convert cut sets to i32 format
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

    // Compute both approximations
    let rea = rare_event_approximation(&cut_sets_i32, &probs);
    let mcub = mcub_approximation(&cut_sets_i32, &probs);

    // For AND gate: Exact = P(E1) * P(E2) = 0.02
    assert!((exact - 0.02).abs() < 0.0001, "Exact = {}", exact);

    // REA and MCUB should be equal for single cut set
    assert!((rea - exact).abs() < 0.0001, "REA = {}", rea);
    assert!((mcub - exact).abs() < 0.0001, "MCUB = {}", mcub);
}

/// Test REA vs MCUB comparison
#[test]
fn test_rea_vs_mcub() {
    // Create fault tree: TopEvent = E1 OR E2 OR E3
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

    // Get exact probability
    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let result = fta.analyze().unwrap();
    let exact = result.top_event_probability;

    // Get cut sets with MOCUS
    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    // Prepare probability map
    let mut probs = HashMap::new();
    probs.insert(1, 0.05); // E1
    probs.insert(2, 0.10); // E2
    probs.insert(3, 0.15); // E3

    // Convert cut sets to i32 format
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

    // Compute both approximations
    let rea = rare_event_approximation(&cut_sets_i32, &probs);
    let mcub = mcub_approximation(&cut_sets_i32, &probs);

    // Exact = 1 - (1-0.05)(1-0.10)(1-0.15) ≈ 0.27325
    assert!((exact - 0.27325).abs() < 0.0001, "Exact = {}", exact);

    // REA ≈ 0.05 + 0.10 + 0.15 = 0.30 (overestimates)
    assert!((rea - 0.30).abs() < 0.001, "REA = {}", rea);

    // MCUB should be closer to exact than REA
    assert!(
        (mcub - exact).abs() < (rea - exact).abs(),
        "MCUB should be more accurate"
    );

    // Both should be upper bounds
    assert!(rea >= exact, "REA should be upper bound");
    assert!(mcub >= exact, "MCUB should be upper bound");
}

/// Test --limit-order filtering (order ≤ max_order)
#[test]
fn test_limit_order_filtering() {
    // Create fault tree: TopEvent = (E1 AND E2) OR E3
    let mut ft = FaultTree::new("OrderTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.05).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    // G1 = E1 AND E2
    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    // TopEvent = G1 OR E3
    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    // Get cut sets with max_order = 1
    let mut mocus = Mocus::new(&ft).with_max_order(1);
    let cut_sets_1 = mocus.analyze().unwrap();

    // Should only have {E3} (order 1)
    assert_eq!(cut_sets_1.len(), 1);
    assert_eq!(cut_sets_1[0].order(), 1);

    // Get cut sets with max_order = 2
    let mut mocus = Mocus::new(&ft).with_max_order(2);
    let cut_sets_2 = mocus.analyze().unwrap();

    // Should have {E3} and {E1, E2} (orders 1 and 2)
    assert_eq!(cut_sets_2.len(), 2);

    // Get all cut sets (no limit)
    let mut mocus = Mocus::new(&ft);
    let cut_sets_all = mocus.analyze().unwrap();

    // Should have same as max_order=2 for this tree
    assert_eq!(cut_sets_all.len(), 2);
}

/// Test --cut-off probability filtering
#[test]
fn test_cut_off_filtering() {
    // Create fault tree: TopEvent = E1 OR E2 OR E3 OR E4
    let mut ft = FaultTree::new("CutoffTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap(); // p = 0.1
    let e2 = BasicEvent::new("E2".to_string(), 0.01).unwrap(); // p = 0.01
    let e3 = BasicEvent::new("E3".to_string(), 0.001).unwrap(); // p = 0.001
    let e4 = BasicEvent::new("E4".to_string(), 0.0001).unwrap(); // p = 0.0001

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

    // Get all cut sets
    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap();

    assert_eq!(all_cut_sets.len(), 4); // {E1}, {E2}, {E3}, {E4}

    // Filter with cut-off = 0.005 (should keep E1, E2)
    let mut event_probs = HashMap::new();
    for (event_id, event) in ft.basic_events() {
        event_probs.insert(event_id.clone(), event.probability());
    }

    let filtered_005 = praxis::analysis::fault_tree::filter_by_probability(
        all_cut_sets.to_vec(),
        &event_probs,
        0.005,
    );
    assert_eq!(filtered_005.len(), 2); // E1, E2

    // Filter with cut-off = 0.05 (should keep only E1)
    let filtered_05 = praxis::analysis::fault_tree::filter_by_probability(
        all_cut_sets.to_vec(),
        &event_probs,
        0.05,
    );
    assert_eq!(filtered_05.len(), 1); // E1 only

    // Filter with cut-off = 0.0005 (should keep E1, E2, E3)
    let filtered_0005 = praxis::analysis::fault_tree::filter_by_probability(
        all_cut_sets.to_vec(),
        &event_probs,
        0.0005,
    );
    assert_eq!(filtered_0005.len(), 3); // E1, E2, E3
}
