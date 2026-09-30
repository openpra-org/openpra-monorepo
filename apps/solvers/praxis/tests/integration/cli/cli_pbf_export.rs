use praxis::io::parser::parse_fault_tree;
use praxis::io::pbf::encode_fault_tree;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn praxis_binary() -> PathBuf {
    [
        PathBuf::from("target/debug/praxis-cli"),
        PathBuf::from("target/debug/praxis-cli.exe"),
    ]
    .into_iter()
    .find(|candidate| candidate.exists())
    .expect("praxis-cli binary not found; run 'cargo build --bin praxis-cli' first")
}

#[test]
fn cli_exports_the_parsed_fault_tree_as_pbf() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    let output_path = std::env::temp_dir().join(format!("praxis-export-{nonce}.pbf"));

    let output = Command::new(praxis_binary())
        .arg("tests/fixtures/core/and.xml")
        .arg("--export-model-pbf")
        .arg(&output_path)
        .output()
        .expect("run PRAXIS PBF export");
    assert!(
        output.status.success(),
        "PBF export failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let actual = fs::read(&output_path).expect("read exported PBF");
    let xml = fs::read_to_string("tests/fixtures/core/and.xml").expect("read XML fixture");
    let expected = encode_fault_tree(&parse_fault_tree(&xml).expect("parse XML fixture"))
        .expect("encode expected PBF");
    assert_eq!(actual, expected);
    assert!(actual.starts_with(b"PBM1"));

    let _ = fs::remove_file(output_path);
}
