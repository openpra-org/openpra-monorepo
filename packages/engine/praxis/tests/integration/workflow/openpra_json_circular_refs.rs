use praxis::openpra_mef::addon_json::{parse_openpra_json, resolve_openpra_refs, to_engine_inputs};
use praxis::openpra_mef::contracts::{ResolveMode, Severity};

fn six_element_circular_payload() -> &'static str {
    r#"{
  "id": "MODEL-CIRC-1",
  "technicalElements": {
    "data-analysis": {
      "id": "DA-CIRC-1",
      "dataParameters": [
        {"id": "DP-1", "probability": 0.01},
        {"id": "DP-2", "probability": 0.02}
      ]
    },
    "systems-analysis": {
      "id": "SA-CIRC-1",
      "systemDefinitions": [
        {"id": "SYS-1", "faultTreeId": "FT-1"}
      ],
      "systemLogicModels": [
        {
          "id": "FT-1",
          "modelType": "or",
          "rootRef": "G-1",
          "basicEventRefs": ["DP-1", "DP-2"]
        }
      ]
    },
    "initiating-event-analysis": {
      "id": "IEA-CIRC-1",
      "initiators": [
        {
          "id": "IE-1",
          "probability": 1.0,
          "systemRefs": ["SYS-1"],
          "dataParameterRefs": ["DP-1"],
          "sourceEventTreeId": "ET-A"
        }
      ]
    },
    "event-sequence-analysis": {
      "id": "ESA-CIRC-1",
      "eventSequences": [
        {
          "id": "SEQ-A1",
          "name": "A to B",
          "initiatingEventId": "IE-1",
          "sourceEventTreeId": "ET-A",
          "linkedSequenceIds": ["ET-B"],
          "functionalEventBindings": [
            {"id": "FEB-A1", "functionalEventId": "FE-A", "faultTreeId": "FT-1"}
          ],
          "pathSignature": [
            {"functionalEventId": "FE-A", "state": "success", "collectFormulaNegated": false}
          ]
        },
        {
          "id": "SEQ-B1",
          "name": "B to A",
          "initiatingEventId": "IE-1",
          "sourceEventTreeId": "ET-B",
          "linkedSequenceIds": ["ET-A"],
          "functionalEventBindings": [
            {"id": "FEB-B1", "functionalEventId": "FE-B", "faultTreeId": "FT-1"}
          ],
          "pathSignature": [
            {"functionalEventId": "FE-B", "state": "failure", "collectFormulaNegated": false}
          ]
        }
      ]
    },
    "event-sequence-quantification": {
      "id": "ESQ-CIRC-1",
      "quantificationResults": [
        {"id": "QR-A", "eventSequenceId": "SEQ-A1", "initiatingEventId": "IE-1", "frequency": 1.0e-6},
        {"id": "QR-B", "eventSequenceId": "SEQ-B1", "initiatingEventId": "IE-1", "frequency": 2.0e-6}
      ]
    },
    "risk-integration": {
      "id": "RI-CIRC-1",
      "eventSequenceToReleaseCategoryMappings": [
        {"id": "RMAP-A", "sequenceId": "SEQ-A1", "releaseCategoryId": "RC-1"},
        {"id": "RMAP-B", "sequenceId": "SEQ-B1", "releaseCategoryId": "RC-2"}
      ]
    }
  }
}"#
}

#[test]
fn openpra_json_six_elements_with_circular_linked_event_trees_resolves_and_builds() {
    let mut bundle = parse_openpra_json(six_element_circular_payload()).unwrap();

    let diagnostics = resolve_openpra_refs(&mut bundle, ResolveMode::Compatible).unwrap();
    assert!(
        diagnostics
            .iter()
            .all(|d| !(d.severity == Severity::Error && d.code == "REF_MISSING_REQUIRED")),
        "unexpected REF_MISSING_REQUIRED diagnostics: {:?}",
        diagnostics
            .iter()
            .filter(|d| d.code == "REF_MISSING_REQUIRED")
            .map(|d| (&d.code, &d.message, &d.json_path))
            .collect::<Vec<_>>()
    );

    let inputs = to_engine_inputs(&bundle).unwrap();
    assert!(inputs.model.is_some());
    assert_eq!(inputs.praxis_initiating_events.len(), 1);
    assert!(inputs.praxis_event_tree_library.contains_key("ET-A"));
    assert!(inputs.praxis_event_tree_library.contains_key("ET-B"));

    let et_a = inputs.praxis_event_tree_library.get("ET-A").unwrap();
    let et_b = inputs.praxis_event_tree_library.get("ET-B").unwrap();

    let seq_a = et_a.sequences.get("SEQ-A1").unwrap();
    let seq_b = et_b.sequences.get("SEQ-B1").unwrap();
    assert_eq!(seq_a.linked_event_tree_id.as_deref(), Some("ET-B"));
    assert_eq!(seq_b.linked_event_tree_id.as_deref(), Some("ET-A"));

    let mut next = seq_a.linked_event_tree_id.clone().unwrap();
    for _ in 0..4 {
      let et = inputs.praxis_event_tree_library.get(&next).unwrap();
      let seq = et.sequences.values().next().unwrap();
      next = seq.linked_event_tree_id.clone().unwrap();
    }
    assert!(next == "ET-A" || next == "ET-B");
}
