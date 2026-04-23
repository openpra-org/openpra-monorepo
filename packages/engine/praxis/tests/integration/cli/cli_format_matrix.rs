use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn praxis_binary() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("target/debug/praxis-cli.exe"),
        PathBuf::from("target/debug/praxis.exe"),
        PathBuf::from("target/release/praxis-cli.exe"),
        PathBuf::from("target/release/praxis.exe"),
    ];

    candidates.into_iter().find(|candidate| candidate.exists())
}

fn unique_path(prefix: &str, ext: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}_{unique}.{ext}"))
}

fn valid_openpra_json_payload() -> String {
    r#"{
  "id": "MODEL-CLI-JSON-1",
  "technicalElements": {
    "data-analysis": {
      "id": "DA-1",
      "dataParameters": [{"id": "DP-1", "probability": 0.01}]
    },
    "systems-analysis": {
      "id": "SA-1",
      "systemDefinitions": [{"id": "SYS-1", "faultTreeId": "FT-1"}],
      "systemLogicModels": [{"id": "FT-1", "modelType": "or", "basicEventRefs": ["DP-1"]}]
    },
    "initiating-event-analysis": {
      "id": "IEA-1",
      "initiators": [{"id": "IE-1", "probability": 1.0}]
    },
    "event-sequence-analysis": {
      "id": "ESA-1",
      "eventSequences": [
        {
          "id": "SEQ-1",
          "initiatingEventId": "IE-1",
          "functionalEventBindings": [{"id": "FEB-1", "functionalEventId": "FE-1", "faultTreeId": "FT-1"}]
        }
      ]
    },
    "event-sequence-quantification": {
      "id": "ESQ-1",
      "quantificationResults": []
    },
    "risk-integration": {
      "id": "RI-1",
      "eventSequenceToReleaseCategoryMappings": []
    }
  }
}"#
        .to_string()
}

#[test]
fn cli_format_matrix_xml_to_xml_explicit_succeeds() {
    let Some(bin) = praxis_binary() else {
        eprintln!("Skipping CLI test: binary not found");
        return;
    };

    let input_xml = PathBuf::from("tests/fixtures/core/and.xml");
    if !input_xml.exists() {
        eprintln!("Skipping CLI test: input fixture not found");
        return;
    }

    let output_xml = unique_path("praxis_format_xml_to_xml", "xml");
    let output = Command::new(&bin)
        .arg(&input_xml)
        .arg("--algorithm")
        .arg("bdd")
        .arg("--input-format")
        .arg("xml")
        .arg("--output-format")
        .arg("xml")
        .arg("--output")
        .arg(&output_xml)
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "stderr: {}", String::from_utf8_lossy(&output.stderr));

    let rendered = fs::read_to_string(&output_xml).expect("Expected XML output file");
    assert!(rendered.contains("<opsa-mef>") || rendered.contains("<report>"));

    let _ = fs::remove_file(output_xml);
}

#[test]
fn cli_format_matrix_json_to_json_explicit_succeeds() {
    let Some(bin) = praxis_binary() else {
        eprintln!("Skipping CLI test: binary not found");
        return;
    };

    let input_json = unique_path("praxis_format_json_input", "json");
    let output_json = unique_path("praxis_format_json_output", "json");
    fs::write(&input_json, valid_openpra_json_payload()).expect("Failed to write JSON fixture");

    let output = Command::new(&bin)
        .arg(&input_json)
        .arg("--algorithm")
        .arg("monte-carlo")
        .arg("--input-format")
        .arg("json")
        .arg("--output-format")
        .arg("json")
        .arg("--output")
        .arg(&output_json)
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "stderr: {}", String::from_utf8_lossy(&output.stderr));

    let rendered = fs::read_to_string(&output_json).expect("Expected JSON output file");
    assert!(rendered.contains("\"technicalElements\""));
    assert!(rendered.contains("\"outputMetadata\""));

    let _ = fs::remove_file(input_json);
    let _ = fs::remove_file(output_json);
}

#[test]
fn cli_format_matrix_xml_input_json_output_converts() {
    let Some(bin) = praxis_binary() else {
        eprintln!("Skipping CLI test: binary not found");
        return;
    };

    let input_xml = PathBuf::from("tests/fixtures/core/and.xml");
    if !input_xml.exists() {
        eprintln!("Skipping CLI test: input fixture not found");
        return;
    }

    let output_json = unique_path("praxis_format_xml_to_json", "json");

    let output = Command::new(&bin)
        .arg(&input_xml)
        .arg("--algorithm")
        .arg("bdd")
        .arg("--input-format")
        .arg("xml")
        .arg("--output-format")
        .arg("json")
      .arg("--output")
      .arg(&output_json)
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "stderr: {}", String::from_utf8_lossy(&output.stderr));

    let rendered = fs::read_to_string(&output_json).expect("Expected JSON output file");
    assert!(rendered.contains("\"technicalElements\""));
    assert!(rendered.contains("\"systems-analysis\""));

    let _ = fs::remove_file(output_json);
}

#[test]
fn cli_format_matrix_json_input_xml_output_is_error() {
    let Some(bin) = praxis_binary() else {
        eprintln!("Skipping CLI test: binary not found");
        return;
    };

    let input_json = unique_path("praxis_format_mismatch_json_input", "json");
    fs::write(&input_json, valid_openpra_json_payload()).expect("Failed to write JSON fixture");

    let output = Command::new(&bin)
        .arg(&input_json)
        .arg("--algorithm")
        .arg("monte-carlo")
        .arg("--input-format")
        .arg("json")
        .arg("--output-format")
        .arg("xml")
        .output()
        .expect("Failed to execute praxis");

    assert!(!output.status.success());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("format mismatch"));

    let _ = fs::remove_file(input_json);
}
