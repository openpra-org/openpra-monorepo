use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::mc::DpMonteCarloAnalysis;
use std::path::PathBuf;
use std::process::Command;

fn praxis_binary() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("target/debug/praxis-cli.exe"),
        PathBuf::from("target/debug/praxis.exe"),
        PathBuf::from("target/release/praxis-cli.exe"),
        PathBuf::from("target/release/praxis.exe"),
    ];

    candidates.into_iter().find(|candidate| candidate.exists())
}

#[test]
fn test_us3_monte_carlo_and_gate() {
    let mut ft = FaultTree::new("TestFT", "G1").unwrap();
    let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();
    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.5).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.25).unwrap())
        .unwrap();

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let analytical_result = analysis.analyze().unwrap();
    let analytical_prob = analytical_result.top_event_probability;

    let mc = DpMonteCarloAnalysis::new(&ft, Some(42), 100000).unwrap();
    let mc_result = mc.run_cpu().unwrap();

    let error = (mc_result.probability_estimate - analytical_prob).abs();
    assert!(
        error < 0.01,
        "MC estimate {} differs from analytical {} by {} (> 0.01)",
        mc_result.probability_estimate,
        analytical_prob,
        error
    );

    assert!(
        mc_result.confidence_interval_lower <= analytical_prob
            && analytical_prob <= mc_result.confidence_interval_upper,
        "Analytical result {} not in 95% CI [{}, {}]",
        analytical_prob,
        mc_result.confidence_interval_lower,
        mc_result.confidence_interval_upper
    );
}

#[test]
fn test_us3_monte_carlo_or_gate() {
    let mut ft = FaultTree::new("TestFT", "G1").unwrap();
    let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();
    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.4).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.3).unwrap())
        .unwrap();

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let analytical_prob = analysis.analyze().unwrap().top_event_probability;

    let mc = DpMonteCarloAnalysis::new(&ft, Some(123), 100000).unwrap();
    let mc_result = mc.run_cpu().unwrap();

    let error = (mc_result.probability_estimate - analytical_prob).abs();
    assert!(
        error < 0.01,
        "MC estimate {} differs from analytical {} by {}",
        mc_result.probability_estimate,
        analytical_prob,
        error
    );
}

#[test]
fn test_us3_monte_carlo_nested_gates() {
    let mut ft = FaultTree::new("TestFT", "Root").unwrap();

    let mut root = Gate::new("Root".to_string(), Formula::Or).unwrap();
    root.add_operand("G1".to_string());
    root.add_operand("E3".to_string());
    ft.add_gate(root).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.5).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.4).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.3).unwrap())
        .unwrap();

    let analysis = FaultTreeAnalysis::new(&ft).unwrap();
    let analytical_prob = analysis.analyze().unwrap().top_event_probability;

    let mc = DpMonteCarloAnalysis::new(&ft, Some(789), 100000).unwrap();
    let mc_result = mc.run_cpu().unwrap();

    let error = (mc_result.probability_estimate - analytical_prob).abs();
    assert!(
        error < 0.01,
        "MC estimate {} differs from analytical {} by {}",
        mc_result.probability_estimate,
        analytical_prob,
        error
    );
}

#[test]
fn test_us3_monte_carlo_reproducibility() {
    let mut ft = FaultTree::new("TestFT", "G1").unwrap();
    let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();
    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.5).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.25).unwrap())
        .unwrap();

    let mc1 = DpMonteCarloAnalysis::new(&ft, Some(42), 10000).unwrap();
    let result1 = mc1.run_cpu().unwrap();

    let mc2 = DpMonteCarloAnalysis::new(&ft, Some(42), 10000).unwrap();
    let result2 = mc2.run_cpu().unwrap();

    assert_eq!(result1.probability_estimate, result2.probability_estimate);
    assert_eq!(result1.successes, result2.successes);
}

#[test]
fn test_us3_cli_monte_carlo_integration() {
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
        .arg("monte-carlo")
        .arg("--num-trials")
        .arg("100000")
        .arg("--seed")
        .arg("42")
        .arg("--print")
        .output()
        .expect("Failed to execute praxis");

    assert!(output.status.success(), "Command should succeed");

    let stdout = String::from_utf8_lossy(&output.stdout);

    assert!(stdout.contains("Monte Carlo Simulation Results"));
    assert!(stdout.contains("Estimated Probability"));
    assert!(stdout.contains("Standard Deviation"));
    assert!(stdout.contains("95% Confidence Interval"));
}

#[test]
fn test_us3_monte_carlo_confidence_intervals() {
    let mut ft = FaultTree::new("TestFT", "G1").unwrap();
    let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();
    ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.5).unwrap())
        .unwrap();
    ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.25).unwrap())
        .unwrap();

    let mc = DpMonteCarloAnalysis::new(&ft, Some(42), 10000).unwrap();
    let result = mc.run_cpu().unwrap();

    assert!(result.confidence_interval_lower < result.probability_estimate);
    assert!(result.probability_estimate < result.confidence_interval_upper);

    let ci_width = result.confidence_interval_upper - result.confidence_interval_lower;
    assert!(ci_width > 0.0 && ci_width < 0.1);
}

#[test]
fn test_us3_monte_carlo_all_gate_types() {
    let mut ft_xor = FaultTree::new("TestFT", "G1").unwrap();
    let mut gate_xor = Gate::new("G1".to_string(), Formula::Xor).unwrap();
    gate_xor.add_operand("E1".to_string());
    gate_xor.add_operand("E2".to_string());
    ft_xor.add_gate(gate_xor).unwrap();
    ft_xor
        .add_basic_event(BasicEvent::new("E1".to_string(), 0.5).unwrap())
        .unwrap();
    ft_xor
        .add_basic_event(BasicEvent::new("E2".to_string(), 0.5).unwrap())
        .unwrap();

    let mc_xor = DpMonteCarloAnalysis::new(&ft_xor, Some(42), 50000).unwrap();
    let result_xor = mc_xor.run_cpu().unwrap();

    assert!((result_xor.probability_estimate - 0.5).abs() < 0.02);

    let mut ft_not = FaultTree::new("TestFT", "G1").unwrap();
    let mut gate_not = Gate::new("G1".to_string(), Formula::Not).unwrap();
    gate_not.add_operand("E1".to_string());
    ft_not.add_gate(gate_not).unwrap();
    ft_not
        .add_basic_event(BasicEvent::new("E1".to_string(), 0.3).unwrap())
        .unwrap();

    let mc_not = DpMonteCarloAnalysis::new(&ft_not, Some(123), 50000).unwrap();
    let result_not = mc_not.run_cpu().unwrap();

    assert!((result_not.probability_estimate - 0.7).abs() < 0.02);
}
