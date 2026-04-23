use praxis::io::event_tree_parser::parse_event_tree_model_full;
use praxis::openpra_mef::addon_json::{parse_openpra_json, to_engine_inputs};
use praxis::openpra_mef::addon_openpsa_xml::parse_openpsa_xml_with_mode;
use praxis::openpra_mef::contracts::ResolveMode;
use praxis::openpra_mef::serialize::json_contract_in::render_openpra_contract_value;

#[test]
fn openpsa_xml_event_tree_graph_survives_json_roundtrip_exactly() {
    let fixtures = [
        "tests/fixtures/eta/EventTrees/bcd.xml",
        "tests/fixtures/eta/EventTrees/mef_example.xml",
        "tests/fixtures/eta/EventTrees/linked_fault_trees_shared_be.xml",
        "tests/fixtures/eta/EventTrees/gas_leak/gas_leak_reactive.xml",
        "tests/fixtures/eta/EventTrees/attack.xml",
    ];

    for fixture in fixtures {
        let xml = std::fs::read_to_string(fixture)
            .unwrap_or_else(|err| panic!("fixture '{fixture}' must be readable: {err}"));

        let parsed =
            parse_event_tree_model_full(&xml).expect("XML should parse as event-tree model");
        assert!(
            !parsed.event_trees.is_empty(),
            "fixture '{fixture}' should contain at least one event tree"
        );

        let converted = parse_openpsa_xml_with_mode(&xml, ResolveMode::Compatible)
            .unwrap_or_else(|err| panic!("conversion failed for fixture '{fixture}': {err}"));
        let internal = converted
            .model
            .as_ref()
            .expect("converted bundle should contain internal OpenPRA model");
        let contract_value = render_openpra_contract_value(internal);
        let contract_text = serde_json::to_string_pretty(&contract_value)
            .expect("contract value must serialize");

        let parsed_contract = parse_openpra_json(&contract_text)
            .unwrap_or_else(|err| panic!("contract parse failed for '{fixture}': {err}"));
        let inputs = to_engine_inputs(&parsed_contract)
            .unwrap_or_else(|err| panic!("engine input build failed for '{fixture}': {err}"));

        for event_tree in &parsed.event_trees {
            let roundtripped = inputs
                .praxis_event_tree_library
                .get(&event_tree.id)
                .unwrap_or_else(|| {
                    panic!(
                        "roundtripped library missing event tree '{}' for fixture '{fixture}'",
                        event_tree.id
                    )
                });
            assert_eq!(
                roundtripped, event_tree,
                "event tree '{}' differs after JSON roundtrip for fixture '{fixture}'",
                event_tree.id
            );
        }
    }
}
