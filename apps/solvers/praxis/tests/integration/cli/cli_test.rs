/// Integration tests for CLI interface (T131-T139)
///
/// Tests command-line argument parsing, file loading, and output generation.
use std::fs;
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

/// Test that --help output is displayed correctly
#[test]
fn test_cli_help_output() {
    let output = Command::new(praxis_binary())
        .arg("--help")
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success());

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check for key help text elements
    assert!(stdout.contains("--algorithm"));
    assert!(stdout.contains("monte-carlo"));
    assert!(stdout.contains("--analysis"));
    assert!(stdout.contains("probability-only"));
    assert!(stdout.contains("cutsets-only"));
    assert!(stdout.contains("cutsets-and-probability"));
    assert!(stdout.contains("ccf"));
    assert!(stdout.contains("sil"));
    assert!(stdout.contains("uncertainty"));
    assert!(stdout.contains("--approximation"));
    assert!(stdout.contains("rare-event"));
    assert!(stdout.contains("mcub"));
    assert!(stdout.contains("--num-trials"));
    assert!(stdout.contains("--seed"));
    assert!(stdout.contains("--backend"));
    assert!(stdout.contains("cpu"));
    assert!(stdout.contains("cuda"));
    assert!(stdout.contains("--bitpacks-per-batch"));
    assert!(stdout.contains("--batches"));
    assert!(stdout.contains("--iterations"));
    assert!(stdout.contains("--print"));
    assert!(stdout.contains("--output"));
}

/// Test CLI with no arguments (should display error)
#[test]
fn test_cli_no_arguments() {
    let output = Command::new(praxis_binary())
        .output()
        .expect("Failed to execute praxis");

    // Should exit with error code
    assert!(!output.status.success());

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("No input file specified") || stderr.contains("Usage"));
}

/// Test file loading with valid XML file
#[test]
fn test_cli_file_loading() {
    let input_file = "tests/fixtures/core/and.xml";

    // Skip test if file doesn't exist
    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output = Command::new(praxis_binary())
        .arg(input_file)
        .arg("--print")
        .output()
        .expect("Failed to execute praxis");

    if !output.status.success() {
        eprintln!("stdout: {}", String::from_utf8_lossy(&output.stdout));
        eprintln!("stderr: {}", String::from_utf8_lossy(&output.stderr));
    }

    assert!(output.status.success(), "Command should succeed");

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check for analysis results
    assert!(stdout.contains("Fault Tree Analysis Results"));
    assert!(stdout.contains("Top Event Probability"));
    assert!(stdout.contains("Gates Analyzed"));
    assert!(stdout.contains("Basic Events"));
}

/// Test verbose output
#[test]
fn test_cli_verbose_mode() {
    let input_file = "tests/fixtures/core/and.xml";

    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output = Command::new(praxis_binary())
        .arg(input_file)
        .arg("--algorithm")
        .arg("bdd")
        .arg("--verbosity")
        .arg("1")
        .arg("--print")
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success());

    let stderr = String::from_utf8_lossy(&output.stderr);

    // Check for verbose messages
    assert!(stderr.contains("Loading input file"));
    assert!(stderr.contains("Parsed fault tree"));
    assert!(stderr.contains("Computing top event probability using BDD"));
    assert!(stderr.contains("BDD analysis complete"));
}

/// Test XML output to file
#[test]
fn test_cli_output_file() {
    let input_file = "tests/fixtures/core/and.xml";
    let output_file = "test_output.xml";

    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    // Clean up any existing output file
    let _ = fs::remove_file(output_file);

    let output = Command::new(praxis_binary())
        .arg(input_file)
        .arg("--output")
        .arg(output_file)
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success());

    // Check that output file was created
    assert!(
        PathBuf::from(output_file).exists(),
        "Output file should be created"
    );

    // Check that output is valid XML
    let xml_content = fs::read_to_string(output_file).expect("Failed to read output file");

    assert!(xml_content.contains("<?xml version"));
    assert!(xml_content.contains("<opsa-mef>"));
    assert!(xml_content.contains("<analysis-results>"));
    assert!(xml_content.contains("<top-event-probability>"));

    // Clean up
    let _ = fs::remove_file(output_file);
}

/// Test Monte Carlo options (not yet implemented, should accept args)
#[test]
fn test_cli_monte_carlo_options() {
    let input_file = "tests/fixtures/core/and.xml";

    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output = Command::new(praxis_binary())
        .arg(input_file)
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
        .arg("--num-trials")
        .arg("5000")
        .arg("--seed")
        .arg("42")
        .arg("--print")
        .output()
        .expect("Failed to execute praxis");

    // Should succeed and use explicit DPMC params to set the effective number of trials.
    assert!(output.status.success());

    let stdout = String::from_utf8_lossy(&output.stdout);
    // mc-t=1, mc-b=1, mc-p=2, omega=64 => 128 trials
    assert!(stdout.contains("MC Engine: DPMC"));
    assert!(stdout.contains("Number of Trials: 128"));
}

#[test]
fn test_cli_algorithm_rejects_multiple_values() {
    let input_file = "tests/fixtures/core/and.xml";

    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output = Command::new(praxis_binary())
        .arg(input_file)
        .arg("--algorithm")
        .arg("bdd")
        .arg("--algorithm")
        .arg("mocus")
        .output()
        .expect("Failed to execute praxis");

    assert!(!output.status.success(), "Command should fail");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("provided more than once")
            || stderr.contains("cannot be used multiple times")
            || stderr.contains("more than one")
            || stderr.contains("unexpected argument"),
        "stderr did not mention duplicate --algorithm. stderr: {stderr}"
    );
}

#[test]
fn test_cli_approximation_rejects_non_mocus_zbdd() {
    let input_file = "tests/fixtures/core/and.xml";

    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    // Default algorithm is monte-carlo; approximation should be rejected unless algorithm is mocus/zbdd.
    let output = Command::new(praxis_binary())
        .arg(input_file)
        .arg("--approximation")
        .arg("rare-event")
        .arg("--print")
        .output()
        .expect("Failed to execute praxis");

    assert!(!output.status.success(), "Command should fail");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("--approximation") && (stderr.contains("mocus") || stderr.contains("zbdd")),
        "stderr did not mention approximation/algorithm restriction. stderr: {stderr}"
    );
}

#[test]
fn test_cli_approximation_works_with_mocus() {
    let input_file = "tests/fixtures/core/and.xml";

    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output = Command::new(praxis_binary())
        .arg(input_file)
        .arg("--algorithm")
        .arg("mocus")
        .arg("--approximation")
        .arg("rare-event")
        .arg("--print")
        .output()
        .expect("Failed to execute praxis");

    if !output.status.success() {
        eprintln!("stdout: {}", String::from_utf8_lossy(&output.stdout));
        eprintln!("stderr: {}", String::from_utf8_lossy(&output.stderr));
    }

    assert!(output.status.success(), "Command should succeed");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("=== Rare Event Approximation ==="));
}

#[test]
fn test_cli_approximation_works_with_zbdd() {
    let input_file = "tests/fixtures/core/and.xml";

    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output = Command::new(praxis_binary())
        .arg(input_file)
        .arg("--algorithm")
        .arg("zbdd")
        .arg("--approximation")
        .arg("mcub")
        .arg("--print")
        .output()
        .expect("Failed to execute praxis");

    if !output.status.success() {
        eprintln!("stdout: {}", String::from_utf8_lossy(&output.stdout));
        eprintln!("stderr: {}", String::from_utf8_lossy(&output.stderr));
    }

    assert!(output.status.success(), "Command should succeed");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("=== MCUB Approximation ==="));
}

#[test]
fn test_cli_approximation_rejects_multiple_values() {
    let input_file = "tests/fixtures/core/and.xml";

    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output = Command::new(praxis_binary())
        .arg(input_file)
        .arg("--algorithm")
        .arg("mocus")
        .arg("--approximation")
        .arg("rare-event")
        .arg("--approximation")
        .arg("mcub")
        .output()
        .expect("Failed to execute praxis");

    assert!(!output.status.success(), "Command should fail");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("cannot be used multiple times")
            || stderr.contains("provided more than once")
            || stderr.contains("more than one"),
        "stderr did not mention duplicate --approximation. stderr: {stderr}"
    );
}

/// Test with non-existent input file
#[test]
fn test_cli_invalid_file() {
    let output = Command::new(praxis_binary())
        .arg("nonexistent.xml")
        .output()
        .expect("Failed to execute praxis");

    // Should fail with error
    assert!(!output.status.success());

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("Failed to read file") || stderr.contains("Error"));
}

/// Test default XML output to stdout
#[test]
fn test_cli_default_xml_output() {
    let input_file = "tests/fixtures/core/and.xml";

    if !PathBuf::from(input_file).exists() {
        eprintln!("Skipping test: {} not found", input_file);
        return;
    }

    let output = Command::new(praxis_binary())
        .arg(input_file)
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success());

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Should output XML to stdout
    assert!(stdout.contains("<?xml version"));
    assert!(stdout.contains("<opsa-mef>"));
    assert!(stdout.contains("<analysis-results>"));
}
