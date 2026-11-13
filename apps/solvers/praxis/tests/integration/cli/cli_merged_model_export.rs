use praxis::analysis::merged_model::merge_same_role_events;
use praxis::io::parser::parse_fault_tree;
use praxis::io::pbf::{decode_fault_tree, encode_fault_tree};
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

fn unique_path(label: &str, extension: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    std::env::temp_dir().join(format!("praxis-{label}-{nonce}.{extension}"))
}

#[test]
fn cli_exports_the_merged_model_and_lists_the_merged_events() {
    let output_path = unique_path("merged", "pbf");

    let output = Command::new(praxis_binary())
        .arg("tests/fixtures/core/and.xml")
        .arg("--export-merged-model-pbf")
        .arg(&output_path)
        .output()
        .expect("run PRAXIS merged model export");
    assert!(
        output.status.success(),
        "merged model export failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let xml = fs::read_to_string("tests/fixtures/core/and.xml").expect("read XML fixture");
    let expected = merge_same_role_events(&parse_fault_tree(&xml).expect("parse XML fixture"))
        .expect("merge the fixture");
    assert_eq!(expected.merged_events.len(), 1);
    assert_eq!(expected.merged_events[0].members, ["A", "B"]);

    let actual = fs::read(&output_path).expect("read exported PBF");
    assert_eq!(
        actual,
        encode_fault_tree(&expected.fault_tree).expect("encode expected PBF")
    );
    let decoded = decode_fault_tree(&actual).expect("decode exported PBF");
    assert_eq!(decoded.basic_events().len(), 1);
    assert!(decoded.get_basic_event("merged-events-0").is_some());

    let listing = String::from_utf8(output.stdout).expect("listing is UTF-8");
    assert!(listing.contains(r#"<merged-events model="depth1" count="1">"#));
    assert!(listing.contains(r#"<merged-event name="merged-events-0" role="all" probability="#));
    assert!(listing.contains(r#"<basic-event name="A"/>"#));
    assert!(listing.contains(r#"<basic-event name="B"/>"#));

    let _ = fs::remove_file(output_path);
}

#[test]
fn cli_writes_the_merged_event_list_to_the_output_file() {
    let output_path = unique_path("merged", "pbf");
    let list_path = unique_path("merged-list", "xml");

    let output = Command::new(praxis_binary())
        .arg("tests/fixtures/core/and.xml")
        .arg("--export-merged-model-pbf")
        .arg(&output_path)
        .arg("--output")
        .arg(&list_path)
        .output()
        .expect("run PRAXIS merged model export");
    assert!(
        output.status.success(),
        "merged model export failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stdout.is_empty());

    let listing = fs::read_to_string(&list_path).expect("read merged event list");
    assert!(listing.contains(r#"<merged-events model="depth1" count="1">"#));
    assert!(listing.contains(r#"<basic-event name="A"/>"#));

    let _ = fs::remove_file(output_path);
    let _ = fs::remove_file(list_path);
}
