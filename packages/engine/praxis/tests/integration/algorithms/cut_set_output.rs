/// Integration tests for cut set output across all algorithms (T255)
///
/// These tests verify cut set extraction, filtering, and XML output for:
/// - BDD cut set extraction
/// - ZBDD cut set output
/// - MOCUS cut set generation
/// - Order filtering
/// - Probability truncation
/// - XML report validation
use praxis::algorithms::bdd::Bdd;
use praxis::algorithms::mocus::Mocus;
use praxis::algorithms::zbdd::Zbdd;
use praxis::analysis::fault_tree::{filter_by_order, filter_by_probability, FaultTreeAnalysis};
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::io::reporter::{write_comprehensive_report, AnalysisReport};
use quick_xml::Writer;
use std::collections::HashMap;

// ============================================================================
// BDD Cut Set Extraction Tests
// ============================================================================

#[test]
fn test_bdd_cut_set_extraction_and_gate() {
    // Create fault tree: TOP = E1 AND E2
    let mut ft = FaultTree::new("BddAndTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to BDD and extract cut sets
    let mut bdd = Bdd::new();
    let top_node = bdd.from_fault_tree(&ft).unwrap();
    let cut_sets = bdd.extract_cut_sets(top_node);

    // Should have exactly 1 cut set: {E1, E2}
    assert_eq!(cut_sets.len(), 1);
    assert_eq!(cut_sets[0].order(), 2);
    assert!(cut_sets[0].events.contains("E1"));
    assert!(cut_sets[0].events.contains("E2"));
}

#[test]
fn test_bdd_cut_set_extraction_or_gate() {
    // Create fault tree: TOP = E1 OR E2 OR E3
    let mut ft = FaultTree::new("BddOrTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to BDD and extract cut sets
    let mut bdd = Bdd::new();
    let top_node = bdd.from_fault_tree(&ft).unwrap();
    let cut_sets = bdd.extract_cut_sets(top_node);

    // Should have 3 cut sets: {E1}, {E2}, {E3}
    assert_eq!(cut_sets.len(), 3);

    for cs in &cut_sets {
        assert_eq!(cs.order(), 1);
    }

    // Collect all event IDs
    let mut events = vec![];
    for cs in &cut_sets {
        events.extend(cs.events.iter().cloned());
    }

    assert!(events.contains(&"E1".to_string()));
    assert!(events.contains(&"E2".to_string()));
    assert!(events.contains(&"E3".to_string()));
}

#[test]
fn test_bdd_cut_set_extraction_nested() {
    // Create fault tree: TOP = (E1 AND E2) OR E3
    let mut ft = FaultTree::new("BddNestedTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut and_gate = Gate::new("AND1".to_string(), Formula::And).unwrap();
    and_gate.add_operand("E1".to_string());
    and_gate.add_operand("E2".to_string());
    ft.add_gate(and_gate).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("AND1".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to BDD and extract cut sets
    let mut bdd = Bdd::new();
    let top_node = bdd.from_fault_tree(&ft).unwrap();
    let cut_sets = bdd.extract_cut_sets(top_node);

    // Should have 2 cut sets: {E3}, {E1, E2}
    assert_eq!(cut_sets.len(), 2);

    // Find the order-1 and order-2 cut sets
    let order_1 = cut_sets.iter().find(|cs| cs.order() == 1).unwrap();
    let order_2 = cut_sets.iter().find(|cs| cs.order() == 2).unwrap();

    assert!(order_1.events.contains("E3"));
    assert!(order_2.events.contains("E1"));
    assert!(order_2.events.contains("E2"));
}

// ============================================================================
// ZBDD Cut Set Output Tests
// ============================================================================

#[test]
fn test_zbdd_cut_set_output_and_gate() {
    // Create fault tree: TOP = E1 AND E2
    let mut ft = FaultTree::new("ZbddAndTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to ZBDD and get cut sets
    let (zbdd, top_node) = Zbdd::from_fault_tree(&ft).unwrap();
    let cut_sets = zbdd.get_cut_sets(top_node, None);

    // Should have exactly 1 cut set: {E1, E2}
    assert_eq!(cut_sets.len(), 1);
    assert_eq!(cut_sets[0].order(), 2);
    assert!(cut_sets[0].events.contains("E1"));
    assert!(cut_sets[0].events.contains("E2"));
}

#[test]
fn test_zbdd_cut_set_output_or_gate() {
    // Create fault tree: TOP = E1 OR E2
    let mut ft = FaultTree::new("ZbddOrTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to ZBDD and get cut sets
    let (zbdd, top_node) = Zbdd::from_fault_tree(&ft).unwrap();
    let cut_sets = zbdd.get_cut_sets(top_node, None);

    // Should have 2 cut sets: {E1}, {E2}
    assert_eq!(cut_sets.len(), 2);

    for cs in &cut_sets {
        assert_eq!(cs.order(), 1);
    }
}

#[test]
fn test_zbdd_cut_set_with_order_limit() {
    // Create fault tree: TOP = (E1 AND E2 AND E3) OR E4
    let mut ft = FaultTree::new("ZbddOrderTest", "TOP").unwrap();

    for i in 1..=4 {
        let event = BasicEvent::new(format!("E{}", i), 0.1).unwrap();
        ft.add_basic_event(event).unwrap();
    }

    let mut and_gate = Gate::new("AND1".to_string(), Formula::And).unwrap();
    and_gate.add_operand("E1".to_string());
    and_gate.add_operand("E2".to_string());
    and_gate.add_operand("E3".to_string());
    ft.add_gate(and_gate).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("AND1".to_string());
    top_gate.add_operand("E4".to_string());
    ft.add_gate(top_gate).unwrap();

    // Convert to ZBDD with order limit
    let (zbdd, top_node) = Zbdd::from_fault_tree(&ft).unwrap();

    // Without limit: should get both cut sets
    let all_cut_sets = zbdd.get_cut_sets(top_node, None);
    assert_eq!(all_cut_sets.len(), 2);

    // With limit of 2: should only get {E4}
    let limited_cut_sets = zbdd.get_cut_sets(top_node, Some(2));
    assert_eq!(limited_cut_sets.len(), 1);
    assert_eq!(limited_cut_sets[0].order(), 1);
    assert!(limited_cut_sets[0].events.contains("E4"));
}

// ============================================================================
// MOCUS Cut Set Generation Tests
// ============================================================================

#[test]
fn test_mocus_cut_set_generation_and_gate() {
    // Create fault tree: TOP = E1 AND E2
    let mut ft = FaultTree::new("MocusAndTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Run MOCUS
    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    // Should have exactly 1 cut set: {E1, E2}
    assert_eq!(cut_sets.len(), 1);
    assert_eq!(cut_sets[0].order(), 2);
    assert!(cut_sets[0].events.contains("E1"));
    assert!(cut_sets[0].events.contains("E2"));
}

#[test]
fn test_mocus_cut_set_generation_or_gate() {
    // Create fault tree: TOP = E1 OR E2 OR E3
    let mut ft = FaultTree::new("MocusOrTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    // Run MOCUS
    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    // Should have 3 cut sets: {E1}, {E2}, {E3}
    assert_eq!(cut_sets.len(), 3);

    for cs in cut_sets {
        assert_eq!(cs.order(), 1);
    }
}

#[test]
fn test_mocus_with_max_order() {
    // Create fault tree: TOP = (E1 AND E2 AND E3) OR (E4 AND E5) OR E6
    let mut ft = FaultTree::new("MocusOrderTest", "TOP").unwrap();

    for i in 1..=6 {
        let event = BasicEvent::new(format!("E{}", i), 0.1).unwrap();
        ft.add_basic_event(event).unwrap();
    }

    let mut and1 = Gate::new("AND1".to_string(), Formula::And).unwrap();
    and1.add_operand("E1".to_string());
    and1.add_operand("E2".to_string());
    and1.add_operand("E3".to_string());
    ft.add_gate(and1).unwrap();

    let mut and2 = Gate::new("AND2".to_string(), Formula::And).unwrap();
    and2.add_operand("E4".to_string());
    and2.add_operand("E5".to_string());
    ft.add_gate(and2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("AND1".to_string());
    top_gate.add_operand("AND2".to_string());
    top_gate.add_operand("E6".to_string());
    ft.add_gate(top_gate).unwrap();

    // Run MOCUS with order limit
    let mut mocus = Mocus::new(&ft).with_max_order(2);
    let cut_sets = mocus.analyze().unwrap();

    // Should only get cut sets with order <= 2: {E6}, {E4, E5}
    assert_eq!(cut_sets.len(), 2);

    for cs in cut_sets {
        assert!(cs.order() <= 2);
    }
}

// ============================================================================
// Order Filtering Tests
// ============================================================================

#[test]
fn test_order_filtering_basic() {
    // Create multiple cut sets with different orders
    let mut ft = FaultTree::new("OrderFilterTest", "TOP").unwrap();

    for i in 1..=5 {
        let event = BasicEvent::new(format!("E{}", i), 0.1).unwrap();
        ft.add_basic_event(event).unwrap();
    }

    // Create gates to generate cut sets of different orders
    let mut and1 = Gate::new("AND1".to_string(), Formula::And).unwrap();
    and1.add_operand("E1".to_string());
    and1.add_operand("E2".to_string());
    ft.add_gate(and1).unwrap();

    let mut and2 = Gate::new("AND2".to_string(), Formula::And).unwrap();
    and2.add_operand("E3".to_string());
    and2.add_operand("E4".to_string());
    and2.add_operand("E5".to_string());
    ft.add_gate(and2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("AND1".to_string());
    top_gate.add_operand("AND2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Generate cut sets
    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    // Filter by order 2
    let filtered = filter_by_order(all_cut_sets.clone(), 2);

    // Should only contain cut sets with order <= 2
    for cs in &filtered {
        assert!(cs.order() <= 2);
    }

    // Should be fewer than all cut sets
    assert!(filtered.len() < all_cut_sets.len());
}

#[test]
fn test_order_filtering_extremes() {
    let mut ft = FaultTree::new("OrderExtremeTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    // Filter with order 0 - should get nothing
    let filtered_zero = filter_by_order(all_cut_sets.clone(), 0);
    assert_eq!(filtered_zero.len(), 0);

    // Filter with large order - should get everything
    let filtered_large = filter_by_order(all_cut_sets.clone(), 100);
    assert_eq!(filtered_large.len(), all_cut_sets.len());
}

// ============================================================================
// Probability Truncation Tests
// ============================================================================

#[test]
fn test_probability_truncation_basic() {
    let mut ft = FaultTree::new("ProbTruncTest", "TOP").unwrap();

    // Events with different probabilities
    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.01).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.001).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    // Generate cut sets
    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    // Create probability map
    let mut probs = HashMap::new();
    probs.insert("E1".to_string(), 0.1);
    probs.insert("E2".to_string(), 0.01);
    probs.insert("E3".to_string(), 0.001);

    // Filter with cutoff 0.05 - should only get E1
    let filtered = filter_by_probability(all_cut_sets.clone(), &probs, 0.05);
    assert_eq!(filtered.len(), 1);
    assert!(filtered[0].events.contains("E1"));

    // Filter with cutoff 0.005 - should get E1 and E2
    let filtered2 = filter_by_probability(all_cut_sets.clone(), &probs, 0.005);
    assert_eq!(filtered2.len(), 2);
}

#[test]
fn test_probability_truncation_compound_cut_sets() {
    let mut ft = FaultTree::new("ProbCompoundTest", "TOP").unwrap();

    // Create events
    let e1 = BasicEvent::new("E1".to_string(), 0.5).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.5).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.01).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    // TOP = (E1 AND E2) OR E3
    let mut and_gate = Gate::new("AND1".to_string(), Formula::And).unwrap();
    and_gate.add_operand("E1".to_string());
    and_gate.add_operand("E2".to_string());
    ft.add_gate(and_gate).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("AND1".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    // Generate cut sets
    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    // Create probability map
    let mut probs = HashMap::new();
    probs.insert("E1".to_string(), 0.5);
    probs.insert("E2".to_string(), 0.5);
    probs.insert("E3".to_string(), 0.01);

    // Cut set {E1, E2} has probability 0.5 * 0.5 = 0.25
    // Cut set {E3} has probability 0.01

    // Filter with cutoff 0.1 - should only get {E1, E2}
    let filtered = filter_by_probability(all_cut_sets, &probs, 0.1);
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].order(), 2);
}

// ============================================================================
// XML Report Validation Tests
// ============================================================================

#[test]
fn test_xml_report_contains_bdd_cut_sets() {
    let mut ft = FaultTree::new("XmlBddTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Generate cut sets with BDD
    let mut bdd = Bdd::new();
    let top_node = bdd.from_fault_tree(&ft).unwrap();
    let cut_sets = bdd.extract_cut_sets(top_node);

    // Create report
    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();
    let report = AnalysisReport::new(result).with_cut_sets(cut_sets);

    // Generate XML
    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();
    let xml = String::from_utf8(writer.into_inner()).unwrap();

    // Validate
    assert!(xml.contains("<minimal-cut-sets"));
    assert!(xml.contains("<cut-set"));
    assert!(xml.contains("<basic-event>E1</basic-event>"));
    assert!(xml.contains("<basic-event>E2</basic-event>"));
}

#[test]
fn test_xml_report_contains_zbdd_cut_sets() {
    let mut ft = FaultTree::new("XmlZbddTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Generate cut sets with ZBDD
    let (zbdd, top_node) = Zbdd::from_fault_tree(&ft).unwrap();
    let cut_sets = zbdd.get_cut_sets(top_node, None);

    // Create report
    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();
    let report = AnalysisReport::new(result).with_cut_sets(cut_sets);

    // Generate XML
    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();
    let xml = String::from_utf8(writer.into_inner()).unwrap();

    // Validate
    assert!(xml.contains("<minimal-cut-sets"));
    assert!(xml.contains("count=\"2\""));
    assert!(xml.contains("<basic-event>E1</basic-event>"));
    assert!(xml.contains("<basic-event>E2</basic-event>"));
}

#[test]
fn test_xml_report_with_filtered_cut_sets() {
    let mut ft = FaultTree::new("XmlFilterTest", "TOP").unwrap();

    for i in 1..=4 {
        let event = BasicEvent::new(format!("E{}", i), 0.1).unwrap();
        ft.add_basic_event(event).unwrap();
    }

    let mut and_gate = Gate::new("AND1".to_string(), Formula::And).unwrap();
    and_gate.add_operand("E1".to_string());
    and_gate.add_operand("E2".to_string());
    and_gate.add_operand("E3".to_string());
    ft.add_gate(and_gate).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("AND1".to_string());
    top_gate.add_operand("E4".to_string());
    ft.add_gate(top_gate).unwrap();

    // Generate cut sets
    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    // Filter to order 1 only
    let filtered_cut_sets = filter_by_order(all_cut_sets, 1);

    // Create report with filtered cut sets
    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();
    let report = AnalysisReport::new(result).with_cut_sets(filtered_cut_sets);

    // Generate XML
    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();
    let xml = String::from_utf8(writer.into_inner()).unwrap();

    // Should only contain the order-1 cut set
    assert!(xml.contains("<minimal-cut-sets count=\"1\""));
    assert!(xml.contains("order=\"1\""));
}

#[test]
fn test_complete_cut_set_pipeline() {
    // End-to-end test: generate cut sets with MOCUS, filter, and output to XML
    let mut ft = FaultTree::new("PipelineTest", "TOP").unwrap();

    // Create events with varying probabilities
    let e1 = BasicEvent::new("E1".to_string(), 0.5).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.5).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.01).unwrap();
    let e4 = BasicEvent::new("E4".to_string(), 0.5).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();
    ft.add_basic_event(e4).unwrap();

    // Create structure: TOP = (E1 AND E2) OR E3 OR (E4 AND E1)
    let mut and1 = Gate::new("AND1".to_string(), Formula::And).unwrap();
    and1.add_operand("E1".to_string());
    and1.add_operand("E2".to_string());
    ft.add_gate(and1).unwrap();

    let mut and2 = Gate::new("AND2".to_string(), Formula::And).unwrap();
    and2.add_operand("E4".to_string());
    and2.add_operand("E1".to_string());
    ft.add_gate(and2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("AND1".to_string());
    top_gate.add_operand("E3".to_string());
    top_gate.add_operand("AND2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Step 1: Generate cut sets
    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    // Step 2: Apply order filtering (max order 2)
    let order_filtered = filter_by_order(all_cut_sets, 2);

    // Step 3: Apply probability filtering
    let mut probs = HashMap::new();
    probs.insert("E1".to_string(), 0.5);
    probs.insert("E2".to_string(), 0.5);
    probs.insert("E3".to_string(), 0.01);
    probs.insert("E4".to_string(), 0.5);

    let prob_filtered = filter_by_probability(order_filtered, &probs, 0.1);

    // Step 4: Generate XML report
    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();
    let report = AnalysisReport::new(result).with_cut_sets(prob_filtered.clone());

    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();
    let xml = String::from_utf8(writer.into_inner()).unwrap();

    // Validate: should only contain high-probability, low-order cut sets
    assert!(xml.contains("<minimal-cut-sets"));
    assert!(xml.contains("count="));

    // All remaining cut sets should have probability >= 0.1
    for cs in prob_filtered {
        let prob: f64 = cs
            .events
            .iter()
            .map(|e| probs.get(e).copied().unwrap_or(1.0))
            .product();
        assert!(prob >= 0.1, "Cut set probability {} should be >= 0.1", prob);
    }
}
