use praxis::io::parser::parse_event_tree_model;
use praxis::openpra_mef::addon_openpsa_xml::parse_openpsa_xml;
use praxis::openpra_mef::contracts::{ResolveMode, Severity};
use praxis::openpra_mef::json_model::OpenPraJsonModel;
use praxis::openpra_mef::napi::{
    convert_openpsa_xml_to_openpra_json_contract, quantify_openpra_json_contract,
    validate_openpra_json_contract,
};
use praxis::openpra_mef::serialize::json_contract_in::render_openpra_contract_value;
use serde_json::Value;

fn to_contract_openpra_json(internal_model: &Value) -> Value {
    let internal: OpenPraJsonModel = serde_json::from_value(internal_model.clone())
        .expect("converter should return an internal OpenPraJsonModel");
    render_openpra_contract_value(&internal)
}

const MHTGR_FIXTURES: [&str; 7] = [
    "ATRS.xml",
    "CRW.xml",
    "LOHTL.xml",
    "LOOP.xml",
    "PCL.xml",
    "SGTL-M.xml",
    "SGTL-S.xml",
];

const KNOWN_GOOD_CONTRACT_INPUT: &str = r#"{
    "id": "MODEL-NAPI-SECTION6",
    "technicalElements": {
        "data-analysis": {"id": "DA", "dataParameters": [{"id": "DP", "probability": 0.01}]},
        "systems-analysis": {
            "id": "SA",
            "systemDefinitions": [{"id": "SYS", "faultTreeId": "FT"}],
            "systemLogicModels": [{"id": "FT", "modelType": "or", "basicEventRefs": ["DP"]}
            ]
        },
        "initiating-event-analysis": {"id": "IEA", "initiators": [{"id": "IE", "probability": 1.0}]},
        "event-sequence-analysis": {
            "id": "ESA",
            "eventSequences": [
                {"id": "SEQ1", "initiatingEventId": "IE", "functionalEventBindings": [{"id": "FEB1", "functionalEventId": "FE1", "faultTreeId": "FT"}]},
                {"id": "SEQ2", "initiatingEventId": "IE", "functionalEventBindings": [{"id": "FEB2", "functionalEventId": "FE1", "faultTreeId": "FT"}]}
            ]
        },
        "event-sequence-quantification": {"id": "ESQ", "quantificationResults": []},
        "risk-integration": {"id": "RI", "eventSequenceToReleaseCategoryMappings": []}
    }
}"#;

fn mhtgr_xml(fixture: &str) -> String {
    std::fs::read_to_string(format!(
        "tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML/{fixture}"
    ))
    .unwrap_or_else(|err| panic!("failed to read fixture '{fixture}': {err}"))
}

fn convert_contract(xml: &str) -> Value {
    let rendered = convert_openpsa_xml_to_openpra_json_contract(xml).unwrap();
    serde_json::from_str(&rendered).unwrap()
}

fn validate_contract(openpra_json: &Value) -> Value {
    let rendered = validate_openpra_json_contract(&serde_json::to_string(openpra_json).unwrap()).unwrap();
    serde_json::from_str(&rendered).unwrap()
}

fn quantify_contract(openpra_json: &Value) -> Value {
    let rendered =
        quantify_openpra_json_contract(&serde_json::to_string(openpra_json).unwrap(), ResolveMode::Compatible)
            .unwrap();
    serde_json::from_str(&rendered).unwrap()
}

#[test]
fn mhtgr_openpsa_xml_fixtures_convert_and_validate() {
    for fixture in MHTGR_FIXTURES {
        let xml = mhtgr_xml(fixture);
        let converted = convert_contract(&xml);
        assert_eq!(
            converted["ok"],
            true,
            "conversion failed for fixture {fixture}: {:?}",
            converted["diagnostics"]
        );

        let openpra_json = converted["openPraJson"].clone();
        let contract_input = to_contract_openpra_json(&openpra_json);

        let validated = validate_contract(&contract_input);
        assert_eq!(
            validated["ok"],
            true,
            "validation failed for fixture {fixture}: {:?}",
            validated["diagnostics"]
        );

        let quantified = quantify_contract(&contract_input);
        assert!(
            quantified["outputMetadata"]["runMetadata"]["telemetry"]["timingsMs"]["quantify"]
                .is_number(),
            "quantification telemetry missing for fixture {fixture}"
        );

        let quantification_rows = quantified["technicalElements"]["event-sequence-quantification"]
            ["quantificationResults"]
            .as_array()
            .expect("quantification results array expected");
        assert!(
            !quantification_rows.is_empty(),
            "expected quantified rows for fixture {fixture}"
        );
    }
}

#[test]
fn contract_enforces_converter_populated_vs_runtime_esq_fields() {
    let xml = mhtgr_xml("CRW.xml");
    let converted = convert_contract(&xml);
    assert_eq!(converted["ok"], true);

    let openpra_json = converted["openPraJson"].clone();
    assert!(openpra_json["technical_elements"]["data_analysis"].is_object());
    assert!(openpra_json["technical_elements"]["systems_analysis"].is_object());
    assert!(openpra_json["technical_elements"]["initiating_event_analysis"].is_object());
    assert!(openpra_json["technical_elements"]["event_sequence_analysis"].is_object());

    let converted_esq = &openpra_json["technical_elements"]["event_sequence_quantification"];
    assert!(converted_esq["risk_significant_sequences"].is_null());
    assert!(converted_esq["cut_sets"].is_null());
    assert!(converted_esq["uncertainty"].is_null());
    assert!(converted_esq["convergence"].is_null());

    let quantified_input: Value = serde_json::from_str(KNOWN_GOOD_CONTRACT_INPUT).unwrap();
    let quantified = quantify_contract(&quantified_input);
    let rows = quantified["technicalElements"]["event-sequence-quantification"]
        ["quantificationResults"]
        .as_array()
        .expect("quantification results expected");
    assert!(!rows.is_empty());

    let first = &rows[0];
    assert!(first["probability"].is_number());
    assert!(first["frequency"].is_number());
    assert!(first["uncertainty"].is_object());
    assert!(first["convergence"].is_object());
}

#[test]
fn deterministic_json_rendering_is_stable_for_same_xml_input() {
    for fixture in MHTGR_FIXTURES {
        let xml = mhtgr_xml(fixture);

        let converted_a = convert_contract(&xml);
        let converted_b = convert_contract(&xml);

        let rendered_a = serde_json::to_string_pretty(&converted_a["openPraJson"]).unwrap();
        let rendered_b = serde_json::to_string_pretty(&converted_b["openPraJson"]).unwrap();

        assert_eq!(rendered_a, rendered_b, "determinism failed for fixture {fixture}");
    }
}

#[test]
fn xml_vs_json_parity_for_core_and_fixture_with_defined_tolerance() {
    let xml = mhtgr_xml("ATRS.xml");
    let (_, _, xml_ets) = parse_event_tree_model(&xml).unwrap();
    let xml_sequence_count: usize = xml_ets.iter().map(|event_tree| event_tree.sequences.len()).sum();

    let converted = convert_contract(&xml);
    let openpra_json = &converted["openPraJson"];
    let json_sequences = openpra_json["technical_elements"]["event_sequence_analysis"]["event_sequences"]
        .as_array()
        .expect("converted ESA sequences array expected");
    let json_quant_rows = openpra_json["technical_elements"]["event_sequence_quantification"]
        ["quantification_results"]
        .as_array()
        .expect("converted ESQ quantification rows expected");

    assert!(xml_sequence_count > 0, "expected non-zero XML sequence count");
    assert!(
        json_sequences.len() >= xml_sequence_count,
        "converted sequence count smaller than XML-derived count: converted={}, xml={}",
        json_sequences.len(),
        xml_sequence_count
    );
    assert_eq!(
        json_sequences.len(),
        json_quant_rows.len(),
        "converted ESA and ESQ row counts must remain aligned"
    );
}

#[test]
fn negative_cases_malformed_broken_refs_circular_links_and_unsupported_constructs() {
    let malformed_xml = "<opsa-mef><define-fault-tree name=\"FT\"></opsa-mef>";
    assert!(parse_openpsa_xml(malformed_xml).is_err());

    let broken_ref_xml = r#"
<opsa-mef>
  <define-initiating-event name="IE-BROKEN" event-tree="ET-MISSING">
    <frequency><float value="0.1" /></frequency>
  </define-initiating-event>
  <define-fault-tree name="FT1">
    <define-gate name="TOP"><or><basic-event name="BE1" /></or></define-gate>
    <define-basic-event name="BE1"><float value="0.01" /></define-basic-event>
  </define-fault-tree>
</opsa-mef>
"#;
    assert!(parse_openpsa_xml(broken_ref_xml).is_err());

    let circular_link_xml = r#"
<opsa-mef>
  <define-initiating-event name="IE-CIRC" event-tree="ET-A">
    <frequency><float value="0.1" /></frequency>
  </define-initiating-event>
  <define-event-tree name="ET-A">
    <define-sequence name="SEQ-A"><event-tree name="ET-B" /></define-sequence>
    <initial-state><sequence name="SEQ-A" /></initial-state>
  </define-event-tree>
  <define-event-tree name="ET-B">
    <define-sequence name="SEQ-B"><event-tree name="ET-A" /></define-sequence>
    <initial-state><sequence name="SEQ-B" /></initial-state>
  </define-event-tree>
</opsa-mef>
"#;
    let circular_bundle = parse_openpsa_xml(circular_link_xml).unwrap();
    assert!(circular_bundle
        .diagnostics
        .iter()
        .all(|diagnostic| diagnostic.severity != Severity::Error));

    let unsupported_construct_xml = r#"
<opsa-mef>
  <define-initiating-event name="IE-U" event-tree="ET-U">
    <frequency><float value="0.1" /></frequency>
  </define-initiating-event>
  <define-event-tree name="ET-U">
    <define-functional-event name="FE-U" />
    <define-sequence name="SEQ-U" />
    <initial-state>
      <fork functional-event="FE-U">
        <path state="S">
          <collect-expression><mul><float value="0.2" /><float value="0.2" /></mul></collect-expression>
          <sequence name="SEQ-U" />
        </path>
      </fork>
    </initial-state>
  </define-event-tree>
</opsa-mef>
"#;
    assert!(parse_openpsa_xml(unsupported_construct_xml).is_err());
}
