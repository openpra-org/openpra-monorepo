/// CLI integration tests for XML output shape stability.
///
/// These are meant to prevent accidental breaking changes in the XML structure
/// (e.g. switching the root element unexpectedly).
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn praxis_binary() -> PathBuf {
    let candidates = [
        PathBuf::from("target/debug/praxis-cli.exe"),
        PathBuf::from("target/debug/praxis.exe"),
        PathBuf::from("target/release/praxis-cli.exe"),
        PathBuf::from("target/release/praxis.exe"),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return candidate;
        }
    }

    panic!("praxis binary not found. Run 'cargo build' first.");
}

#[test]
fn test_cli_mocus_xml_output_uses_report_format() {
    let praxis_binary = praxis_binary();

    let input_file = PathBuf::from("tests/fixtures/core/and.xml");
    if !input_file.exists() {
        eprintln!("Skipping test: input fixture not found");
        return;
    }

    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let output_path = std::env::temp_dir().join(format!("praxis_mocus_xml_{unique}.xml"));

    let output = Command::new(&praxis_binary)
        .arg(&input_file)
        .arg("--algorithm")
        .arg("mocus")
        .arg("--analysis")
        .arg("cutsets-only")
            .arg("--output")
        .arg(&output_path)
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "Command should succeed");

    let xml = fs::read_to_string(&output_path)
        .unwrap_or_else(|e| panic!("Failed to read XML output {output_path:?}: {e}"));

    assert!(xml.contains("<report>"));
    assert!(xml.contains("<results>"));
    assert!(xml.contains("<fault-tree-analysis"));
    assert!(xml.contains("<minimal-cut-sets"));

    let _ = fs::remove_file(&output_path);
}
