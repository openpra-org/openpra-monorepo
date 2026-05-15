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

fn normalize_xml(xml: &str) -> String {
    let mut out = String::with_capacity(xml.len());
    let mut in_tag = false;
    for ch in xml.chars() {
        match ch {
            '<' => {
                in_tag = true;
                out.push(ch);
            }
            '>' => {
                in_tag = false;
                out.push(ch);
            }
            c if !in_tag && c.is_whitespace() => {}
            c => out.push(c),
        }
    }
    out
}

#[test]
fn test_cli_monte_carlo_xml_output_includes_stats() {
    let Some(praxis_binary) = praxis_binary() else {
        eprintln!("Skipping CLI test: binary not found");
        return;
    };

    let input_file = PathBuf::from("tests/fixtures/core/and.xml");
    if !input_file.exists() {
        eprintln!("Skipping test: input fixture not found");
        return;
    }

    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let output_path = std::env::temp_dir().join(format!("praxis_mc_xml_{unique}.xml"));

    let output = Command::new(&praxis_binary)
        .arg(&input_file)
        .arg("--algorithm")
        .arg("monte-carlo")
        .arg("--num-trials")
        .arg("1000")
        .arg("--seed")
        .arg("42")
            .arg("--output")
        .arg(&output_path)
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "Command should succeed");

    let xml = fs::read_to_string(&output_path)
        .unwrap_or_else(|e| panic!("Failed to read XML output {output_path:?}: {e}"));

    let xml = normalize_xml(&xml);

    // Fault-tree MC without cut sets uses the simple OpenPSA-ish output shape.
    assert!(xml.contains(r#"<opsa-mef>"#));
    assert!(!xml.contains(r#"<report>"#));
    assert!(xml.contains(r#"<analysis-results>"#));
    assert!(xml.contains(r#"<monte-carlo-analysis>"#));
    assert_eq!(xml.matches("<run-config>").count(), 1);
    assert!(xml.contains(r#"<engine>dpmc</engine>"#));
    assert!(xml.contains(r#"<target>fault-tree</target>"#));
    assert!(xml.contains(r#"<backend-requested>"#));
    assert!(xml.contains(r#"<backend-used>"#));
    assert!(xml.contains(r#"<seed>42</seed>"#));
    assert!(xml.contains(r#"<probability-estimate>"#));
    assert!(xml.contains(r#"<std-dev>"#));
    assert!(xml.contains(r#"<confidence-interval>"#));
    assert!(xml.contains(r#"<num-trials>1000</num-trials>"#));
    assert!(xml.contains(r#"<successes>"#));

    let _ = fs::remove_file(&output_path);
}

#[test]
fn test_cli_non_monte_carlo_xml_output_has_no_mc_section() {
    let Some(praxis_binary) = praxis_binary() else {
        eprintln!("Skipping CLI test: binary not found");
        return;
    };

    let input_file = PathBuf::from("tests/fixtures/core/and.xml");
    if !input_file.exists() {
        eprintln!("Skipping test: input fixture not found");
        return;
    }

    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let output_path = std::env::temp_dir().join(format!("praxis_no_mc_xml_{unique}.xml"));

    let output = Command::new(&praxis_binary)
        .arg(&input_file)
        .arg("--algorithm")
        .arg("zbdd")
        .arg("--analysis")
        .arg("cutsets-only")
            .arg("--output")
        .arg(&output_path)
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "Command should succeed");

    let xml = fs::read_to_string(&output_path)
        .unwrap_or_else(|e| panic!("Failed to read XML output {output_path:?}: {e}"));

    let xml = normalize_xml(&xml);

    // Cut-set algorithms use the comprehensive report output.
    assert!(xml.contains(r#"<report>"#));
    assert!(xml.contains(r#"<results>"#));
    assert!(!xml.contains(r#"<monte-carlo-analysis>"#));
    assert!(!xml.contains(r#"<run-config>"#));

    let _ = fs::remove_file(&output_path);
}
