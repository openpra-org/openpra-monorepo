use praxis::algorithms::bdd_engine::Bdd as BddEngine;
use praxis::algorithms::bdd_pdag::BddPdag;
use praxis::algorithms::mocus::{CutSet, Mocus};
use praxis::algorithms::zbdd_engine::ZbddEngine;
use praxis::analysis::fault_tree::{filter_by_order, filter_by_probability, FaultTreeAnalysis};
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::io::reporter::{write_comprehensive_report, AnalysisReport};
use quick_xml::Writer;
use std::collections::HashMap;

fn cut_sets_via_zbdd(ft: &FaultTree) -> Vec<CutSet> {
    let mut pdag = BddPdag::from_fault_tree(ft).unwrap();
    pdag.compute_ordering_and_modules().unwrap();
    let (mut bdd_engine, bdd_root) = BddEngine::build_from_pdag(&pdag).unwrap();
    bdd_engine.freeze();
    let (zbdd, zbdd_root) = ZbddEngine::build_from_bdd(&bdd_engine, bdd_root, false);
    let var_order = pdag.variable_order().to_vec();
    zbdd.enumerate(zbdd_root)
        .into_iter()
        .map(|set| {
            let events: Vec<String> = set
                .iter()
                .filter_map(|&pos| {
                    var_order
                        .get(pos)
                        .and_then(|&idx| pdag.node(idx))
                        .and_then(|n| n.id())
                        .map(|s| s.to_string())
                })
                .collect();
            CutSet::new(events)
        })
        .collect()
}

#[test]
fn test_bdd_cut_set_extraction_and_gate() {
    let mut ft = FaultTree::new("BddAndTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let cut_sets = cut_sets_via_zbdd(&ft);

    assert_eq!(cut_sets.len(), 1);
    assert_eq!(cut_sets[0].order(), 2);
    assert!(cut_sets[0].events.contains("E1"));
    assert!(cut_sets[0].events.contains("E2"));
}

#[test]
fn test_bdd_cut_set_extraction_or_gate() {
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

    let cut_sets = cut_sets_via_zbdd(&ft);

    assert_eq!(cut_sets.len(), 3);

    for cs in &cut_sets {
        assert_eq!(cs.order(), 1);
    }

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

    let cut_sets = cut_sets_via_zbdd(&ft);

    assert_eq!(cut_sets.len(), 2);

    let order_1 = cut_sets.iter().find(|cs| cs.order() == 1).unwrap();
    let order_2 = cut_sets.iter().find(|cs| cs.order() == 2).unwrap();

    assert!(order_1.events.contains("E3"));
    assert!(order_2.events.contains("E1"));
    assert!(order_2.events.contains("E2"));
}

#[test]
fn test_zbdd_cut_set_output_and_gate() {
    let mut ft = FaultTree::new("ZbddAndTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let cut_sets = cut_sets_via_zbdd(&ft);

    assert_eq!(cut_sets.len(), 1);
    assert_eq!(cut_sets[0].order(), 2);
    assert!(cut_sets[0].events.contains("E1"));
    assert!(cut_sets[0].events.contains("E2"));
}

#[test]
fn test_zbdd_cut_set_output_or_gate() {
    let mut ft = FaultTree::new("ZbddOrTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let cut_sets = cut_sets_via_zbdd(&ft);

    assert_eq!(cut_sets.len(), 2);

    for cs in &cut_sets {
        assert_eq!(cs.order(), 1);
    }
}

#[test]
fn test_zbdd_cut_set_with_order_limit() {
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

    let all_cut_sets = cut_sets_via_zbdd(&ft);
    assert_eq!(all_cut_sets.len(), 2);

    let limited_cut_sets: Vec<_> = all_cut_sets.into_iter().filter(|cs| cs.order() <= 2).collect();
    assert_eq!(limited_cut_sets.len(), 1);
    assert_eq!(limited_cut_sets[0].order(), 1);
    assert!(limited_cut_sets[0].events.contains("E4"));
}

#[test]
fn test_mocus_cut_set_generation_and_gate() {
    let mut ft = FaultTree::new("MocusAndTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    assert_eq!(cut_sets.len(), 1);
    assert_eq!(cut_sets[0].order(), 2);
    assert!(cut_sets[0].events.contains("E1"));
    assert!(cut_sets[0].events.contains("E2"));
}

#[test]
fn test_mocus_cut_set_generation_or_gate() {
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

    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();

    assert_eq!(cut_sets.len(), 3);

    for cs in cut_sets {
        assert_eq!(cs.order(), 1);
    }
}

#[test]
fn test_mocus_with_max_order() {
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

    let mut mocus = Mocus::new(&ft).with_max_order(2);
    let cut_sets = mocus.analyze().unwrap();

    assert_eq!(cut_sets.len(), 2);

    for cs in cut_sets {
        assert!(cs.order() <= 2);
    }
}

#[test]
fn test_order_filtering_basic() {
    let mut ft = FaultTree::new("OrderFilterTest", "TOP").unwrap();

    for i in 1..=5 {
        let event = BasicEvent::new(format!("E{}", i), 0.1).unwrap();
        ft.add_basic_event(event).unwrap();
    }

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

    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    let filtered = filter_by_order(all_cut_sets.clone(), 2);

    for cs in &filtered {
        assert!(cs.order() <= 2);
    }

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

    let filtered_zero = filter_by_order(all_cut_sets.clone(), 0);
    assert_eq!(filtered_zero.len(), 0);

    let filtered_large = filter_by_order(all_cut_sets.clone(), 100);
    assert_eq!(filtered_large.len(), all_cut_sets.len());
}

#[test]
fn test_probability_truncation_basic() {
    let mut ft = FaultTree::new("ProbTruncTest", "TOP").unwrap();

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

    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    let mut probs = HashMap::new();
    probs.insert("E1".to_string(), 0.1);
    probs.insert("E2".to_string(), 0.01);
    probs.insert("E3".to_string(), 0.001);

    let filtered = filter_by_probability(all_cut_sets.clone(), &probs, 0.05);
    assert_eq!(filtered.len(), 1);
    assert!(filtered[0].events.contains("E1"));

    let filtered2 = filter_by_probability(all_cut_sets.clone(), &probs, 0.005);
    assert_eq!(filtered2.len(), 2);
}

#[test]
fn test_probability_truncation_compound_cut_sets() {
    let mut ft = FaultTree::new("ProbCompoundTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.5).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.5).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.01).unwrap();
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

    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    let mut probs = HashMap::new();
    probs.insert("E1".to_string(), 0.5);
    probs.insert("E2".to_string(), 0.5);
    probs.insert("E3".to_string(), 0.01);

    let filtered = filter_by_probability(all_cut_sets, &probs, 0.1);
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].order(), 2);
}

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

    let cut_sets = cut_sets_via_zbdd(&ft);

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();
    let report = AnalysisReport::new(result).with_cut_sets(cut_sets);

    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();
    let xml = String::from_utf8(writer.into_inner()).unwrap();

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

    let cut_sets = cut_sets_via_zbdd(&ft);

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();
    let report = AnalysisReport::new(result).with_cut_sets(cut_sets);

    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();
    let xml = String::from_utf8(writer.into_inner()).unwrap();

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

    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    let filtered_cut_sets = filter_by_order(all_cut_sets, 1);

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();
    let report = AnalysisReport::new(result).with_cut_sets(filtered_cut_sets);

    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();
    let xml = String::from_utf8(writer.into_inner()).unwrap();

    assert!(xml.contains("<minimal-cut-sets count=\"1\""));
    assert!(xml.contains("order=\"1\""));
}

#[test]
fn test_complete_cut_set_pipeline() {
    let mut ft = FaultTree::new("PipelineTest", "TOP").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.5).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.5).unwrap();
    let e3 = BasicEvent::new("E3".to_string(), 0.01).unwrap();
    let e4 = BasicEvent::new("E4".to_string(), 0.5).unwrap();
    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();
    ft.add_basic_event(e4).unwrap();

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

    let mut mocus = Mocus::new(&ft);
    let all_cut_sets = mocus.analyze().unwrap().to_vec();

    let order_filtered = filter_by_order(all_cut_sets, 2);

    let mut probs = HashMap::new();
    probs.insert("E1".to_string(), 0.5);
    probs.insert("E2".to_string(), 0.5);
    probs.insert("E3".to_string(), 0.01);
    probs.insert("E4".to_string(), 0.5);

    let prob_filtered = filter_by_probability(order_filtered, &probs, 0.1);

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let result = analysis.analyze().unwrap();
    let report = AnalysisReport::new(result).with_cut_sets(prob_filtered.clone());

    let mut writer = Writer::new(Vec::new());
    write_comprehensive_report(&mut writer, &ft, &report).unwrap();
    let xml = String::from_utf8(writer.into_inner()).unwrap();

    assert!(xml.contains("<minimal-cut-sets"));
    assert!(xml.contains("count="));

    for cs in prob_filtered {
        let prob: f64 = cs
            .events
            .iter()
            .map(|e| probs.get(e).copied().unwrap_or(1.0))
            .product();
        assert!(prob >= 0.1, "Cut set probability {} should be >= 0.1", prob);
    }
}
