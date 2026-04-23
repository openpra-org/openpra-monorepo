/// Integration tests for cut set XML output (T254)
///
/// These tests verify that cut sets are properly included in XML reports
/// when MOCUS analysis is performed.
use praxis::algorithms::mocus::Mocus;
use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::io::reporter::{write_comprehensive_report, AnalysisReport};
use quick_xml::Writer;

#[test]
fn test_xml_output_includes_cut_sets_and_gate() {
    // Create a simple AND gate fault tree
    let mut ft = FaultTree::new("TestTree", "TopGate").unwrap();

    let mut gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    // Perform analysis
    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // Compute cut sets with MOCUS
    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    // Create comprehensive report with cut sets
    let report = AnalysisReport::new(result).with_cut_sets(cut_sets.to_vec());

    // Write to XML
    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();

    let xml_output = String::from_utf8(writer.into_inner()).unwrap();

    // Verify XML contains cut sets section
    assert!(xml_output.contains("<minimal-cut-sets"));
    assert!(xml_output.contains("count=\"1\""));
    assert!(xml_output.contains("<cut-set"));
    assert!(xml_output.contains("order=\"2\""));
    assert!(xml_output.contains("<basic-event>E1</basic-event>"));
    assert!(xml_output.contains("<basic-event>E2</basic-event>"));
}

#[test]
fn test_xml_output_includes_cut_sets_or_gate() {
    // Create a simple OR gate fault tree
    let mut ft = FaultTree::new("TestTree", "TopGate").unwrap();

    let mut gate = Gate::new("TopGate".to_string(), Formula::Or).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    gate.add_operand("E3".to_string());
    ft.add_gate(gate).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    // Perform analysis
    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // Compute cut sets with MOCUS
    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    // Create comprehensive report with cut sets
    let report = AnalysisReport::new(result).with_cut_sets(cut_sets.to_vec());

    // Write to XML
    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();

    let xml_output = String::from_utf8(writer.into_inner()).unwrap();

    // Verify XML contains cut sets section with 3 single-event cut sets
    assert!(xml_output.contains("<minimal-cut-sets"));
    assert!(xml_output.contains("count=\"3\""));
    assert!(xml_output.contains("order=\"1\""));
    assert!(xml_output.contains("<basic-event>E1</basic-event>"));
    assert!(xml_output.contains("<basic-event>E2</basic-event>"));
    assert!(xml_output.contains("<basic-event>E3</basic-event>"));
}

#[test]
fn test_xml_output_without_cut_sets() {
    // Create a simple fault tree
    let mut ft = FaultTree::new("TestTree", "TopGate").unwrap();

    let mut gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    // Perform analysis
    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // Create report WITHOUT cut sets
    let report = AnalysisReport::new(result);

    // Write to XML
    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();

    let xml_output = String::from_utf8(writer.into_inner()).unwrap();

    // Verify XML does NOT contain cut sets section
    assert!(!xml_output.contains("<minimal-cut-sets"));
}

#[test]
fn test_xml_cut_sets_structure() {
    // Create a nested fault tree to get interesting cut sets
    let mut ft = FaultTree::new("TestTree", "TopGate").unwrap();

    let mut top_gate = Gate::new("TopGate".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("SubGate".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut sub_gate = Gate::new("SubGate".to_string(), Formula::And).unwrap();
    sub_gate.add_operand("E1".to_string());
    sub_gate.add_operand("E2".to_string());
    ft.add_gate(sub_gate).unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    // Perform analysis
    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // Compute cut sets with MOCUS
    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    // Create comprehensive report with cut sets
    let report = AnalysisReport::new(result).with_cut_sets(cut_sets.to_vec());

    // Write to XML
    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();

    let xml_output = String::from_utf8(writer.into_inner()).unwrap();

    // Verify structure: should have 2 cut sets (E3 alone, and E1+E2)
    assert!(xml_output.contains("<minimal-cut-sets count=\"2\""));

    // Check for both cut sets with proper IDs
    assert!(xml_output.contains("<cut-set id=\"1\""));
    assert!(xml_output.contains("<cut-set id=\"2\""));

    // Should have one order-1 and one order-2 cut set
    assert!(xml_output.contains("order=\"1\""));
    assert!(xml_output.contains("order=\"2\""));
}

#[test]
fn test_cut_set_xml_format_compliance() {
    // Test that the XML output follows the expected format
    let mut ft = FaultTree::new("TestTree", "TopGate").unwrap();

    let mut gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
    gate.add_operand("EventA".to_string());
    gate.add_operand("EventB".to_string());
    ft.add_gate(gate).unwrap();

    let e1 = BasicEvent::new("EventA".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("EventB".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    // Perform analysis
    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();

    // Compute cut sets
    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    // Create report
    let report = AnalysisReport::new(result).with_cut_sets(cut_sets.to_vec());

    // Write to XML
    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();

    let xml_output = String::from_utf8(writer.into_inner()).unwrap();

    // Verify XML declaration
    assert!(xml_output.starts_with("<?xml version=\"1.0\" encoding=\"utf-8\"?>"));

    // Verify proper nesting: report > results > minimal-cut-sets
    assert!(xml_output.contains("<report>"));
    assert!(xml_output.contains("<results>"));
    assert!(xml_output.contains("<minimal-cut-sets"));
    assert!(xml_output.contains("</minimal-cut-sets>"));
    assert!(xml_output.contains("</results>"));
    assert!(xml_output.contains("</report>"));

    // Verify cut set structure
    assert!(xml_output.contains("<cut-set id=\"1\" order=\"2\">"));
    assert!(xml_output.contains("</cut-set>"));
}
