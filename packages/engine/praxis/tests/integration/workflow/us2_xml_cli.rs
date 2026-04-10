use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::io::parser::parse_fault_tree;
use praxis::io::serializer::write_results;
use quick_xml::Writer;
use std::fs;
use std::path::PathBuf;

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

fn extract_tag_value(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    Some(xml[start..end].trim().to_string())
}

#[test]
fn test_us2_complete_workflow() {
    let xml_content =
        fs::read_to_string("tests/fixtures/core/and.xml").expect("Failed to read and.xml");

    let fault_tree = parse_fault_tree(&xml_content).expect("Failed to parse fault tree");

    assert_eq!(fault_tree.element().id(), "depth1");
    assert_eq!(fault_tree.top_event(), "and");
    assert_eq!(fault_tree.gates().len(), 1);
    assert_eq!(fault_tree.basic_events().len(), 5);

    let analysis = FaultTreeAnalysis::new(&fault_tree).expect("Failed to create analysis");

    let result = analysis.analyze().expect("Failed to analyze fault tree");

    assert!(
        (result.top_event_probability - 0.125).abs() < 1e-9,
        "Expected probability 0.125, got {}",
        result.top_event_probability
    );
    assert_eq!(result.gates_analyzed, 1);
    assert_eq!(result.basic_events_count, 5);

    let mut writer = Writer::new(Vec::new());
    write_results(&mut writer, &fault_tree, &result).expect("Failed to write results");

    let xml_output =
        String::from_utf8(writer.into_inner()).expect("Failed to convert XML to string");

    assert!(xml_output.contains("<?xml version=\"1.0\" encoding=\"utf-8\"?>"));
    assert!(xml_output.contains("<opsa-mef>"));
    assert!(xml_output.contains("<analysis-results>"));
    assert!(xml_output.contains("<fault-tree-analysis name=\"depth1\">"));
    assert!(xml_output.contains("<top-event-probability>0.125</top-event-probability>"));
    assert!(xml_output.contains("<gates-analyzed>1</gates-analyzed>"));
    assert!(xml_output.contains("<basic-events-count>5</basic-events-count>"));
    assert!(xml_output.contains("</opsa-mef>"));
}

#[test]
fn test_us2_or_gate_workflow() {
    let xml_content =
        fs::read_to_string("tests/fixtures/core/or.xml").expect("Failed to read or.xml");

    let fault_tree = parse_fault_tree(&xml_content).expect("Failed to parse fault tree");

    let analysis = FaultTreeAnalysis::new(&fault_tree).expect("Failed to create analysis");

    let result = analysis.analyze().expect("Failed to analyze fault tree");

    let expected = 1.0 - (1.0 - 0.1) * (1.0 - 0.2) * (1.0 - 0.3) * (1.0 - 0.4) * (1.0 - 0.5);
    assert!(
        (result.top_event_probability - expected).abs() < 1e-9,
        "Expected probability {}, got {}",
        expected,
        result.top_event_probability
    );

    let mut writer = Writer::new(Vec::new());
    write_results(&mut writer, &fault_tree, &result).expect("Failed to write results");

    let xml_output =
        String::from_utf8(writer.into_inner()).expect("Failed to convert XML to string");

    let p_text = extract_tag_value(&xml_output, "top-event-probability")
        .expect("Missing <top-event-probability> in XML output");
    let p_xml: f64 = p_text
        .parse()
        .unwrap_or_else(|_| panic!("Invalid top-event-probability '{p_text}'"));
    assert!(
        (p_xml - expected).abs() < 1e-9,
        "Expected serialized probability {}, got {}",
        expected,
        p_xml
    );
}

#[test]
fn test_us2_roundtrip() {
    let original_xml =
        fs::read_to_string("tests/fixtures/core/and.xml").expect("Failed to read and.xml");

    let fault_tree = parse_fault_tree(&original_xml).expect("Failed to parse fault tree");

    let analysis = FaultTreeAnalysis::new(&fault_tree).expect("Failed to create analysis");

    let result = analysis.analyze().expect("Failed to analyze fault tree");

    let mut writer = Writer::new(Vec::new());
    write_results(&mut writer, &fault_tree, &result).expect("Failed to write results");

    let xml_output =
        String::from_utf8(writer.into_inner()).expect("Failed to convert XML to string");

    assert!(xml_output.contains("<analysis-results>"));
    assert!(xml_output.contains("<top-event-probability>"));

    assert!(xml_output.contains("0.125"));
}

#[test]
fn test_us2_cli_end_to_end() {
    use std::process::Command;

    let Some(praxis_binary) = praxis_binary() else {
        eprintln!("Skipping CLI test: binary not found");
        return;
    };

    let input_file = "tests/fixtures/core/and.xml";
    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output = Command::new(&praxis_binary)
        .arg(input_file)
        .arg("--algorithm")
        .arg("bdd")
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "Command should succeed");

    let stdout = String::from_utf8_lossy(&output.stdout);

    let stdout = normalize_xml(&stdout);

    assert!(stdout.contains("<?xml version"));
    assert!(stdout.contains("<opsa-mef>"));
    assert!(stdout.contains("<analysis-results>"));
    assert!(stdout.contains("<fault-tree-analysis name=\"depth1\">"));
    assert!(stdout.contains("<top-event-probability>0.125</top-event-probability>"));
    assert!(stdout.contains("</opsa-mef>"));
}

#[test]
fn test_us2_cli_print_output() {
    use std::process::Command;

    let Some(praxis_binary) = praxis_binary() else {
        eprintln!("Skipping CLI test: binary not found");
        return;
    };

    let input_file = "tests/fixtures/core/and.xml";
    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output = Command::new(&praxis_binary)
        .arg(input_file)
        .arg("--algorithm")
        .arg("bdd")
        .arg("--print")
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "Command should succeed");

    let stdout = String::from_utf8_lossy(&output.stdout);

    assert!(stdout.contains("Fault Tree Analysis Results"));
    assert!(stdout.contains("Fault Tree: depth1"));
    assert!(stdout.contains("Top Event: and"));
    assert!(stdout.contains("Top Event Probability: 0.125000"));
    assert!(stdout.contains("Gates Analyzed: 1"));
    assert!(stdout.contains("Basic Events: 5"));
}

#[test]
fn test_us2_cli_output_file() {
    use std::process::Command;

    let Some(praxis_binary) = praxis_binary() else {
        eprintln!("Skipping CLI test: binary not found");
        return;
    };

    let input_file = "tests/fixtures/core/and.xml";
    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output_file = "test_us2_output.xml";

    let _ = fs::remove_file(output_file);

    let output = Command::new(&praxis_binary)
        .arg(input_file)
        .arg("--algorithm")
        .arg("bdd")
        .arg("--output")
        .arg(output_file)
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "Command should succeed");

    assert!(
        PathBuf::from(output_file).exists(),
        "Output file should exist"
    );

    let xml_content = fs::read_to_string(output_file).expect("Failed to read output file");

    let xml_content = normalize_xml(&xml_content);

    assert!(xml_content.contains("<?xml version"));
    assert!(xml_content.contains("<opsa-mef>"));
    assert!(xml_content.contains("<top-event-probability>0.125</top-event-probability>"));

    let _ = fs::remove_file(output_file);
}
