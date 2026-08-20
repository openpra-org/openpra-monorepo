use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn cli_quantifies_a_versioned_hcl_request_as_json() {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let request_path = std::env::temp_dir().join(format!(
        "praxis-hcl-request-{}-{unique}.json",
        std::process::id()
    ));
    let request = serde_json::json!({
        "schema_version": 1,
        "network": {
            "format": "canonical",
            "variables": [
                {
                    "name": "A",
                    "states": ["false", "true"],
                    "probabilities": [0.8, 0.2]
                },
                {
                    "name": "B",
                    "states": ["false", "true"],
                    "parents": ["A"],
                    "probabilities": [0.9, 0.1, 0.2, 0.8]
                }
            ]
        },
        "bindings": [
            { "event": "A", "node": "A", "true_states": ["true"] },
            { "event": "B", "node": "B", "true_states": ["true"] }
        ]
    });
    fs::write(&request_path, serde_json::to_vec_pretty(&request).unwrap()).unwrap();

    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/core/and.xml");
    let output = Command::new(env!("CARGO_BIN_EXE_praxis-cli"))
        .arg(fixture)
        .arg("--hcl-request")
        .arg(&request_path)
        .output()
        .unwrap();
    let _ = fs::remove_file(&request_path);

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let result: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    let probability = result["probability"].as_f64().unwrap();
    assert!((probability - 0.16).abs() < 1e-12);
    assert_eq!(result["junction_tree"]["num_cliques"], 1);
}
