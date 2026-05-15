use praxis::analysis::event_tree::EventTreeAnalysis;
use praxis::io::parser::parse_event_tree_model;
use praxis::mc::DpEventTreeMonteCarloAnalysis;
use std::collections::HashMap;

#[test]
fn parses_mef_example_with_named_branch() {
    let xml = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/mef_example.xml"
    ));

    let (model, initiating_events, event_trees) = parse_event_tree_model(xml).unwrap();

    assert!(model.fault_trees().is_empty());
    assert!(model.basic_events().is_empty());
    assert!(initiating_events.is_empty());

    assert_eq!(event_trees.len(), 1);
    let et = &event_trees[0];

    assert!(et.named_branches.contains_key("sub-tree7"));

    for fe in ["F", "G", "H"] {
        assert!(et.functional_events.contains_key(fe));
    }
    for seq in ["S1", "S2", "S5", "S6"] {
        assert!(et.sequences.contains_key(seq));
    }

    et.validate().unwrap();
}

#[test]
fn parses_event_tree_with_collect_expression_instructions() {
    let xml = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/attack.xml"
    ));

    let (_model, initiating_events, event_trees) = parse_event_tree_model(xml).unwrap();

    assert_eq!(initiating_events.len(), 1);
    assert_eq!(event_trees.len(), 1);

    let et = &event_trees[0];
    for fe in ["L1", "L2", "L3"] {
        assert!(et.functional_events.contains_key(fe));
    }
    for seq in ["AttackSucceeds", "AttackFails"] {
        assert!(et.sequences.contains_key(seq));
    }

    // collect-expression blocks are instruction-only right now; structure should still validate.
    et.validate().unwrap();
}

#[test]
fn bcd_collect_expression_drives_sequence_probabilities() {
    let xml = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/bcd.xml"
    ));

    let (model, initiating_events, event_trees) = parse_event_tree_model(xml).unwrap();
    assert_eq!(initiating_events.len(), 1);
    assert_eq!(event_trees.len(), 1);

    let ie = initiating_events[0].clone();
    let et = event_trees[0].clone();

    let mut analysis = EventTreeAnalysis::new(ie, et, &model);
    analysis.analyze().unwrap();

    let mut p_success = 0.0;
    let mut p_failure = 0.0;
    for s in analysis.sequences() {
        match s.sequence.id.as_str() {
            "Success" => p_success += s.probability,
            "Failure" => p_failure += s.probability,
            _ => {}
        }
    }

    // Hand-computed from the fixture's collect-expression probabilities.
    assert!((p_success - 0.594).abs() < 1e-12, "p_success={p_success}");
    assert!((p_failure - 0.406).abs() < 1e-12, "p_failure={p_failure}");
    assert!(((p_success + p_failure) - 1.0).abs() < 1e-12);
}

#[test]
fn gas_leak_reactive_quantifies_and_sums_to_one() {
    let xml = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/gas_leak/gas_leak_reactive.xml"
    ));

    let (model, initiating_events, event_trees) = parse_event_tree_model(xml).unwrap();
    assert_eq!(initiating_events.len(), 1);
    assert_eq!(event_trees.len(), 1);

    let ie = initiating_events[0].clone();
    let et = event_trees[0].clone();

    let mut analysis = EventTreeAnalysis::new(ie, et, &model);
    analysis.analyze().unwrap();

    assert_eq!(analysis.sequences().len(), 8);

    let mut ids: Vec<String> = analysis
        .sequences()
        .iter()
        .map(|s| s.sequence.id.clone())
        .collect();
    ids.sort();
    assert_eq!(ids, vec!["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);

    let p_total: f64 = analysis.sequences().iter().map(|s| s.probability).sum();
    assert!((p_total - 1.0).abs() < 1e-12, "p_total={p_total}");
}

#[test]
fn gas_leak_top_level_quantifies_and_sums_to_one() {
    let xml = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/gas_leak/gas_leak.xml"
    ));

    let (model, initiating_events, event_trees) = parse_event_tree_model(xml).unwrap();
    assert_eq!(initiating_events.len(), 1);
    assert_eq!(event_trees.len(), 1);

    let ie = initiating_events[0].clone();
    let et = event_trees[0].clone();

    let mut analysis = EventTreeAnalysis::new(ie, et, &model);
    analysis.analyze().unwrap();

    assert_eq!(analysis.sequences().len(), 2);
    let mut ids: Vec<String> = analysis
        .sequences()
        .iter()
        .map(|s| s.sequence.id.clone())
        .collect();
    ids.sort();
    assert_eq!(ids, vec!["Link-to-reactive", "S9"]);

    let p_total: f64 = analysis.sequences().iter().map(|s| s.probability).sum();
    assert!((p_total - 1.0).abs() < 1e-12, "p_total={p_total}");
}

#[test]
fn gas_leak_expands_linked_event_tree() {
    let xml_top = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/gas_leak/gas_leak.xml"
    ));
    let xml_reactive = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/gas_leak/gas_leak_reactive.xml"
    ));

    let (mut model_top, initiating_events_top, event_trees_top) =
        parse_event_tree_model(xml_top).unwrap();
    let (model_reactive, _initiating_events_reactive, event_trees_reactive) =
        parse_event_tree_model(xml_reactive).unwrap();

    for (_id, ft) in model_reactive.fault_trees().iter() {
        model_top.add_fault_tree(ft.clone()).unwrap();
    }
    for (_id, be) in model_reactive.basic_events().iter() {
        model_top.add_basic_event(be.clone()).unwrap();
    }

    let mut library: HashMap<String, praxis::core::event_tree::EventTree> = HashMap::new();
    for et in event_trees_top.iter().chain(event_trees_reactive.iter()) {
        library.insert(et.id.clone(), et.clone());
    }

    assert_eq!(initiating_events_top.len(), 1);
    assert_eq!(event_trees_top.len(), 1);

    let ie = initiating_events_top[0].clone();
    let et_top = event_trees_top[0].clone();

    let mut analysis =
        EventTreeAnalysis::new(ie, et_top, &model_top).with_event_tree_library(&library);
    analysis.analyze().unwrap();

    // Expect S9 from the top-level tree + S1..S8 from the linked reactive tree.
    let mut ids: Vec<String> = analysis
        .sequences()
        .iter()
        .map(|s| s.sequence.id.clone())
        .collect();
    ids.sort();
    assert_eq!(
        ids,
        vec!["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"]
    );

    let p_total: f64 = analysis.sequences().iter().map(|s| s.probability).sum();
    assert!((p_total - 1.0).abs() < 1e-12, "p_total={p_total}");
}

#[test]
fn gas_leak_mc_expands_linked_event_tree_and_sums_to_one() {
    let xml_top = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/gas_leak/gas_leak.xml"
    ));
    let xml_reactive = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/gas_leak/gas_leak_reactive.xml"
    ));

    let (mut model_top, initiating_events_top, event_trees_top) =
        parse_event_tree_model(xml_top).unwrap();
    let (model_reactive, _initiating_events_reactive, event_trees_reactive) =
        parse_event_tree_model(xml_reactive).unwrap();

    // Merge reactive model content into the top-level model.
    for (_id, ft) in model_reactive.fault_trees().iter() {
        model_top.add_fault_tree(ft.clone()).unwrap();
    }
    for (_id, be) in model_reactive.basic_events().iter() {
        model_top.add_basic_event(be.clone()).unwrap();
    }

    // Build an event-tree library across both parses.
    let mut library: HashMap<String, praxis::core::event_tree::EventTree> = HashMap::new();
    for et in event_trees_top.iter().chain(event_trees_reactive.iter()) {
        library.insert(et.id.clone(), et.clone());
    }

    let ie = initiating_events_top[0].clone();
    let et_top = event_trees_top[0].clone();

    let analysis = DpEventTreeMonteCarloAnalysis::new(ie, et_top, &model_top, Some(123), 100_000)
        .unwrap()
        .with_event_tree_library(&library);

    let result = analysis.run_cpu().unwrap();

    let mut ids: Vec<String> = result
        .sequences
        .iter()
        .map(|s| s.sequence.id.clone())
        .collect();
    ids.sort();
    assert_eq!(
        ids,
        vec!["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"]
    );

    let p_total: f64 = result
        .sequences
        .iter()
        .map(|s| s.probability_estimate)
        .sum();
    assert!((p_total - 1.0).abs() < 0.02, "p_total={p_total}");
}
