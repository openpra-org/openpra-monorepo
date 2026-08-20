use praxis::io::parser::parse_fault_tree;
use praxis::io::pbf::encode_fault_tree;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn praxis_binary() -> PathBuf {
    let candidates = [
        PathBuf::from("target/debug/praxis-cli"),
        PathBuf::from("target/debug/praxis-cli.exe"),
        PathBuf::from("target/release/praxis-cli"),
        PathBuf::from("target/release/praxis-cli.exe"),
    ];

    candidates
        .into_iter()
        .find(|candidate| candidate.exists())
        .expect("praxis-cli binary not found; run 'cargo build --bin praxis-cli' first")
}

#[test]
fn cli_accepts_pbf_fault_tree_input() {
    let build = Command::new("cargo")
        .args(["build", "--bin", "praxis-cli"])
        .output()
        .expect("failed to build praxis-cli");
    assert!(
        build.status.success(),
        "build failed: {}",
        String::from_utf8_lossy(&build.stderr)
    );

    let xml = fs::read_to_string("tests/fixtures/core/and.xml").expect("read XML fixture");
    let fault_tree = parse_fault_tree(&xml).expect("parse XML fixture");
    let pbf = encode_fault_tree(&fault_tree).expect("encode PBF fixture");

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before Unix epoch")
        .as_nanos();
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("praxis-cli-{nonce}.pbf"));
    let output_path = temp_dir.join(format!("praxis-cli-{nonce}-result.xml"));
    fs::write(&input_path, pbf).expect("write PBF fixture");

    let output = Command::new(praxis_binary())
        .arg(&input_path)
        .args(["--algorithm", "mocus", "--analysis", "cutsets-only"])
        .arg("--output")
        .arg(&output_path)
        .output()
        .expect("run praxis-cli with PBF input");

    let result_xml = fs::read_to_string(&output_path).unwrap_or_default();
    let _ = fs::remove_file(&input_path);
    let _ = fs::remove_file(&output_path);

    assert!(
        output.status.success(),
        "command failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(result_xml.contains("<fault-tree-analysis name=\"depth1\">"));
    assert!(result_xml.contains("<minimal-cut-sets count=\"1\">"));
}

#[test]
fn cli_writes_saphire_ftc_from_pbf_input() {
    let build = Command::new("cargo")
        .args(["build", "--bin", "praxis-cli"])
        .output()
        .expect("failed to build praxis-cli");
    assert!(build.status.success());

    let xml = fs::read_to_string("tests/fixtures/core/and.xml").expect("read XML fixture");
    let fault_tree = parse_fault_tree(&xml).expect("parse XML fixture");
    let pbf = encode_fault_tree(&fault_tree).expect("encode PBF fixture");

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before Unix epoch")
        .as_nanos();
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("praxis-cli-ftc-{nonce}.pbf"));
    let output_path = temp_dir.join(format!("praxis-cli-ftc-{nonce}.FTC"));
    fs::write(&input_path, pbf).expect("write PBF fixture");

    let output = Command::new(praxis_binary())
        .arg(&input_path)
        .args([
            "--algorithm",
            "mocus",
            "--analysis",
            "cutsets-only",
            "--output-format",
            "ftc",
            "--saphire-project",
            "TEST-PROJECT",
        ])
        .arg("--output")
        .arg(&output_path)
        .output()
        .expect("run praxis-cli with FTC output");

    let result_ftc = fs::read_to_string(&output_path).unwrap_or_default();
    let _ = fs::remove_file(&input_path);
    let _ = fs::remove_file(&output_path);

    assert!(
        output.status.success(),
        "command failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(
        result_ftc,
        "* Version = 2\r\nTEST-PROJECT, depth1,RANDOM/CD\r\n=\r\nA * B .\r\n"
    );
}

#[test]
fn cli_reports_zbdd_stats_without_materializing_cut_sets() {
    let build = Command::new("cargo")
        .args(["build", "--bin", "praxis-cli"])
        .output()
        .expect("failed to build praxis-cli");
    assert!(build.status.success());

    let xml = fs::read_to_string("tests/fixtures/core/or.xml").expect("read XML fixture");
    let fault_tree = parse_fault_tree(&xml).expect("parse XML fixture");
    let pbf = encode_fault_tree(&fault_tree).expect("encode PBF fixture");
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before Unix epoch")
        .as_nanos();
    let input_path = std::env::temp_dir().join(format!("praxis-cli-stats-{nonce}.pbf"));
    fs::write(&input_path, pbf).expect("write PBF fixture");

    let output = Command::new(praxis_binary())
        .arg(&input_path)
        .args([
            "--algorithm",
            "zbdd",
            "--analysis",
            "cutsets-only",
            "--cut-set-stats-only",
        ])
        .output()
        .expect("run praxis-cli in diagram-statistics mode");
    let _ = fs::remove_file(&input_path);

    assert!(
        output.status.success(),
        "command failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("=== ZBDD Metadata ==="));
    assert!(stdout.contains("No cut sets were materialized."));
}
