use std::collections::HashMap;

use praxis::analysis::event_tree::EventTreeAnalysis;
use praxis::io::parser::parse_event_tree_model;
use praxis::openpra_mef::addon_json::{parse_openpra_json, to_engine_inputs};
use praxis::openpra_mef::addon_openpsa_xml::parse_openpsa_xml_with_mode;
use praxis::openpra_mef::contracts::{ResolveMode, Severity};
use praxis::openpra_mef::serialize::json_contract_in::render_openpra_contract_value;

fn summarize_by_sequence_name(results: &[praxis::analysis::event_tree::SequenceResult]) -> HashMap<String, f64> {
    let mut out: HashMap<String, f64> = HashMap::new();
    for result in results {
        let key = result
            .sequence
            .name
            .clone()
            .unwrap_or_else(|| result.sequence.id.clone());
        *out.entry(key).or_insert(0.0) += result.probability;
    }
    out
}

#[test]
fn openpsa_xml_collect_expression_survives_json_roundtrip() {
    let xml = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/bcd.xml"
    ));

    // Baseline: direct XML parse + event-tree analysis.
    let (xml_model, xml_initiating_events, xml_event_trees) = parse_event_tree_model(xml).unwrap();
    assert_eq!(xml_initiating_events.len(), 1);
    assert_eq!(xml_event_trees.len(), 1);

    let mut xml_analysis = EventTreeAnalysis::new(
        xml_initiating_events[0].clone(),
        xml_event_trees[0].clone(),
        &xml_model,
    );
    xml_analysis.analyze().unwrap();
    let xml_summary = summarize_by_sequence_name(xml_analysis.sequences());

    // Roundtrip: XML -> converted OpenPRA model -> contract JSON -> JSON loader -> runtime objects.
    let converted = parse_openpsa_xml_with_mode(xml, ResolveMode::Compatible).unwrap();
    let converted_model = converted.model.as_ref().expect("converted model expected");

    let contract_value = render_openpra_contract_value(converted_model);
    let contract_json = serde_json::to_string(&contract_value).unwrap();

    let loaded = parse_openpra_json(&contract_json).unwrap();
    assert!(
        !loaded
            .diagnostics
            .iter()
            .any(|d| d.severity == Severity::Error),
        "unexpected JSON loader errors: {:#?}",
        loaded.diagnostics
    );

    let engine_inputs = to_engine_inputs(&loaded).unwrap();
    let json_model = engine_inputs
        .praxis_model
        .as_ref()
        .expect("praxis model expected");

    assert!(!engine_inputs.praxis_initiating_events.is_empty());
    assert!(!engine_inputs.praxis_event_trees.is_empty());

    let mut json_analysis = EventTreeAnalysis::new(
        engine_inputs.praxis_initiating_events[0].clone(),
        engine_inputs.praxis_event_trees[0].clone(),
        json_model,
    )
    .with_event_tree_library(&engine_inputs.praxis_event_tree_library);

    json_analysis.analyze().unwrap();
    let json_summary = summarize_by_sequence_name(json_analysis.sequences());

    let xml_p_success = *xml_summary.get("Success").unwrap_or(&0.0);
    let xml_p_failure = *xml_summary.get("Failure").unwrap_or(&0.0);

    let json_p_success = *json_summary.get("Success").unwrap_or(&0.0);
    let json_p_failure = *json_summary.get("Failure").unwrap_or(&0.0);

    assert!((xml_p_success - json_p_success).abs() < 1e-12, "xml={xml_p_success} json={json_p_success}");
    assert!((xml_p_failure - json_p_failure).abs() < 1e-12, "xml={xml_p_failure} json={json_p_failure}");

    assert!(((json_p_success + json_p_failure) - 1.0).abs() < 1e-12);
}
