/// CLI integration test for event-tree Monte Carlo XML output.
///
/// Validates that:
/// - `-o` includes per-sequence event-tree MC stats in XML
/// - run-config metadata appears exactly once (not repeated per sequence)
use std::fs;
use std::path::PathBuf;
use std::process::Command;

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
fn test_cli_event_tree_monte_carlo_writes_xml() {
    let root = "tests/fixtures/eta/EventTrees/gas_leak/gas_leak_combined.xml";

    if !PathBuf::from(root).exists() {
        eprintln!("Skipping test: event-tree fixtures not found");
        return;
    }

    let out_path = std::env::temp_dir().join(format!(
        "praxis_event_tree_mc_{}_{}.xml",
        std::process::id(),
        "output"
    ));

    let _ = fs::remove_file(&out_path);

    let output = Command::new(praxis_binary())
        .arg(root)
        .arg("--algorithm")
        .arg("monte-carlo")
        .arg("--backend")
        .arg("cpu")
        .arg("--bitpacks-per-batch")
        .arg("2")
        .arg("--batches")
        .arg("1")
        .arg("--iterations")
        .arg("1")
        .arg("--seed")
        .arg("42")
            .arg("--output")
        .arg(&out_path)
        .output()
        .expect("Failed to execute praxis");

    if !output.status.success() {
        eprintln!("stdout: {}", String::from_utf8_lossy(&output.stdout));
        eprintln!("stderr: {}", String::from_utf8_lossy(&output.stderr));
    }

    assert!(output.status.success());

    let xml = fs::read_to_string(&out_path).expect("Failed to read output XML");

    // Event-tree MC uses the comprehensive report format.
    assert!(xml.contains("<report>"));
    assert!(!xml.contains("<opsa-mef>"));

    // Report should include the event-tree MC section.
    assert!(xml.contains("<event-tree-monte-carlo>"));

    // Metadata should not repeat for each terminal sequence.
    assert_eq!(xml.matches("<run-config>").count(), 1);

    // Terminal sequences should be present (root + linked ET yields these).
    assert!(xml.contains("sequence id=\"S1\""));
    assert!(xml.contains("sequence id=\"S9\""));

    let _ = fs::remove_file(&out_path);
}
