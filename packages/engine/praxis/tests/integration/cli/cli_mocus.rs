// Integration tests for MOCUS CLI integration
// Tests T252: Integrate MOCUS into main CLI

use std::path::PathBuf;
use std::process::Command;

/// Get the path to the compiled praxis binary
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
fn test_mocus_and_gate() {
    // Build the binary first
    let _ = Command::new("cargo")
        .args(["build"])
        .output()
        .expect("Failed to build praxis");

    let output = Command::new(praxis_binary())
        .args([
            "tests/fixtures/core/and.xml",
            "--algorithm",
            "mocus",
            "--analysis",
            "cutsets-only",
            "--print",
        ])
        .output()
        .expect("Failed to execute praxis");

    let stdout = String::from_utf8_lossy(&output.stdout);

    assert!(
        output.status.success(),
        "Command failed with stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(stdout.contains("=== MOCUS Minimal Cut Sets ==="));
    assert!(stdout.contains("Total cut sets: 1"));
    assert!(stdout.contains("Order"));
}

#[test]
fn test_mocus_or_gate() {
    let _ = Command::new("cargo")
        .args(["build"])
        .output()
        .expect("Failed to build praxis");

    let output = Command::new(praxis_binary())
        .args([
            "tests/fixtures/core/or.xml",
            "--algorithm",
            "mocus",
            "--analysis",
            "cutsets-only",
            "--print",
        ])
        .output()
        .expect("Failed to execute praxis");

    let stdout = String::from_utf8_lossy(&output.stdout);

    assert!(
        output.status.success(),
        "Command failed with stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(stdout.contains("=== MOCUS Minimal Cut Sets ==="));
    assert!(stdout.contains("Total cut sets: 5"));
    assert!(stdout.contains("Order"));
}

#[test]
fn test_mocus_with_verbosity() {
    let _ = Command::new("cargo")
        .args(["build"])
        .output()
        .expect("Failed to build praxis");

    let output = Command::new(praxis_binary())
        .args([
            "tests/fixtures/core/and.xml",
            "--algorithm",
            "mocus",
            "--analysis",
            "cutsets-only",
            "--print",
            "--verbosity",
            "2",
        ])
        .output()
        .expect("Failed to execute praxis");

    let stdout = String::from_utf8_lossy(&output.stdout);

    assert!(
        output.status.success(),
        "Command failed with stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(stdout.contains("Cut Sets:"));
    // Check for either ordering of the cut set elements
    assert!(stdout.contains("{ B, A }") || stdout.contains("{ A, B }"));
}

#[test]
fn test_mocus_without_flag() {
    let _ = Command::new("cargo")
        .args(["build"])
        .output()
        .expect("Failed to build praxis");

    let output = Command::new(praxis_binary())
        .args(["tests/fixtures/core/and.xml", "--print"])
        .output()
        .expect("Failed to execute praxis");

    let stdout = String::from_utf8_lossy(&output.stdout);

    assert!(output.status.success());
    assert!(!stdout.contains("=== MOCUS Minimal Cut Sets ==="));
}
