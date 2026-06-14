use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn praxis_binary() -> PathBuf {
    let candidates = [
        PathBuf::from("target/debug/praxis-cli"),
        PathBuf::from("target/debug/praxis"),
        PathBuf::from("target/release/praxis-cli"),
        PathBuf::from("target/release/praxis"),
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

fn top_probability(stdout: &str) -> f64 {
    for line in stdout.lines() {
        if let Some(rest) = line.trim().strip_prefix("Top Event Probability:") {
            return rest.trim().parse::<f64>().expect("probability should parse");
        }
    }
    panic!("no top event probability line in: {stdout}");
}

#[test]
fn test_cli_importance_prints_ranked_table() {
    let input_file = PathBuf::from("tests/fixtures/core/and.xml");
    if !input_file.exists() {
        eprintln!("Skipping test: input fixture not found");
        return;
    }

    let output = Command::new(praxis_binary())
        .arg(&input_file)
        .arg("--analysis")
        .arg("importance")
        .arg("--algorithm")
        .arg("bdd")
        .arg("--print")
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "command should succeed");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("Importance Measures"),
        "missing header in: {stdout}"
    );
    assert!(stdout.contains("Birnbaum"), "missing Birnbaum column");
    assert!(
        stdout.contains("Fussell-Ves"),
        "missing Fussell-Vesely column"
    );
    assert!(stdout.contains("RAW"), "missing RAW column");
}

#[test]
fn test_cli_mission_time_drives_exponential() {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let input_path = std::env::temp_dir().join(format!("praxis_mt_{unique}.xml"));
    let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="mt">
    <define-gate name="top"><or><basic-event name="A"/></or></define-gate>
    <define-basic-event name="A">
      <exponential><float value="0.001"/><system-mission-time/></exponential>
    </define-basic-event>
  </define-fault-tree>
</opsa-mef>"#;
    fs::write(&input_path, xml).expect("write temp xml");

    let run = |extra: &[&str]| {
        let mut cmd = Command::new(praxis_binary());
        cmd.arg(&input_path)
            .arg("--algorithm")
            .arg("bdd")
            .arg("--print");
        for arg in extra {
            cmd.arg(arg);
        }
        let output = cmd.output().expect("Failed to execute praxis");
        assert!(output.status.success(), "command should succeed");
        top_probability(&String::from_utf8_lossy(&output.stdout))
    };

    let default_p = run(&[]);
    let mission_time_p = run(&["--mission-time", "100"]);

    let _ = fs::remove_file(&input_path);

    let expected = 1.0 - (-0.001f64 * 100.0).exp();
    assert!(
        (mission_time_p - expected).abs() < 1e-4,
        "mission-time probability {mission_time_p} != expected {expected}"
    );
    assert!(
        mission_time_p > default_p * 10.0,
        "mission time should raise the probability (default {default_p}, mt {mission_time_p})"
    );
}
