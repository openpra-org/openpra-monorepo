use std::path::PathBuf;
use std::process::Command;

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
fn every_variable_order_is_accepted_by_bdd_analysis() {
    for method in [
        "dfs",
        "force",
        "sloan",
        "dfs-scram",
        "dfs-plain",
        "reverse",
        "sift",
        "gsift",
        "ils",
    ] {
        let mut command = Command::new(praxis_binary());
        command.arg("tests/fixtures/core/and.xml").args([
            "--algorithm",
            "bdd",
            "--variable-order",
            method,
        ]);
        if matches!(method, "sift" | "gsift" | "ils") {
            command.args(["--reorder-budget-seconds", "1"]);
        }
        let output = command.output().expect("run PRAXIS variable ordering");
        assert!(
            output.status.success(),
            "{method} failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

#[test]
fn variable_order_reaches_direct_zbdd_analysis() {
    let output = Command::new(praxis_binary())
        .arg("tests/fixtures/core/and.xml")
        .args([
            "--algorithm",
            "zbdd-direct",
            "--analysis",
            "cutsets-only",
            "--variable-order",
            "sloan",
        ])
        .output()
        .expect("run PRAXIS direct ZBDD variable ordering");
    assert!(
        output.status.success(),
        "direct ZBDD failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn reorder_budget_requires_a_reordering_method() {
    let output = Command::new(praxis_binary())
        .arg("tests/fixtures/core/and.xml")
        .args([
            "--algorithm",
            "bdd",
            "--variable-order",
            "dfs",
            "--reorder-budget-seconds",
            "1",
        ])
        .output()
        .expect("run invalid PRAXIS reorder budget");
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr)
        .contains("requires --variable-order sift, gsift, or ils"));
}
