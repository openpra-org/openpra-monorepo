use std::path::PathBuf;
use std::process::Command;

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

#[test]
fn test_cli_event_tree_monte_carlo_with_library() {
    let root = "tests/fixtures/eta/EventTrees/gas_leak/gas_leak_combined.xml";

    if !PathBuf::from(root).exists() {
        eprintln!("Skipping test: event-tree fixtures not found");
        return;
    }

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
        .arg("--print")
        .output()
        .expect("Failed to execute praxis");

    if !output.status.success() {
        eprintln!("stdout: {}", String::from_utf8_lossy(&output.stdout));
        eprintln!("stderr: {}", String::from_utf8_lossy(&output.stderr));
    }

    assert!(output.status.success());

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Event Tree Monte Carlo Results"));

    assert!(stdout.contains("Number of Trials: 128"));

    assert!(stdout.contains("S1"));
    assert!(stdout.contains("S9"));
}

#[cfg(feature = "cuda")]
#[test]
fn test_cli_event_tree_monte_carlo_accepts_cuda_backend_flag() {
    let root = "tests/fixtures/eta/EventTrees/gas_leak/gas_leak_combined.xml";

    if !PathBuf::from(root).exists() {
        eprintln!("Skipping test: event-tree fixtures not found");
        return;
    }

    let output = Command::new(praxis_binary())
        .arg(root)
        .arg("--algorithm")
        .arg("monte-carlo")
        .arg("--backend")
        .arg("cuda")
        .arg("--validate")
        .output()
        .expect("Failed to execute praxis");

    if !output.status.success() {
        eprintln!("stdout: {}", String::from_utf8_lossy(&output.stdout));
        eprintln!("stderr: {}", String::from_utf8_lossy(&output.stderr));
    }

    assert!(output.status.success());
}
