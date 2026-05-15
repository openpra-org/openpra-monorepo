//! Integration tests for uncertainty quantification
//! Tests propagate_uncertainty() with various distributions and tree structures

use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::analysis::uncertainty::propagate_uncertainty;
use praxis::core::event::{BasicEvent, Distribution};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};

/// Test uncertainty quantification with Normal distributions
#[test]
fn test_uncertainty_normal_distributions() {
    // Create fault tree: TopEvent = E1 OR E2
    let mut ft = FaultTree::new("NormalTest", "TopEvent").unwrap();

    // E1 with Normal(0.01, 0.002)
    let e1 =
        BasicEvent::with_distribution("E1".to_string(), 0.01, Distribution::Normal(0.01, 0.002))
            .unwrap();
    // E2 with Normal(0.02, 0.004)
    let e2 =
        BasicEvent::with_distribution("E2".to_string(), 0.02, Distribution::Normal(0.02, 0.004))
            .unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Run uncertainty propagation with 500 trials
    let result = propagate_uncertainty(&ft, 500, Some(42)).unwrap();

    // Check that results are reasonable
    assert!(result.mean() > 0.025);
    assert!(result.mean() < 0.035);
    assert!(result.sigma() > 0.0);

    // Error factor should be > 1 (ratio of 95th to 5th percentile)
    assert!(result.error_factor() > 1.0);

    // Check 95% confidence interval
    let (ci_lower, ci_upper) = result.confidence_interval();
    assert!(ci_lower < result.mean());
    assert!(ci_upper > result.mean());

    // Check quantiles are monotonically increasing
    let quantiles = result.quantiles();
    assert_eq!(quantiles.len(), 5); // [5%, 25%, 50%, 75%, 95%]
    for i in 1..quantiles.len() {
        assert!(quantiles[i] >= quantiles[i - 1]);
    }
}

/// Test uncertainty quantification with LogNormal distributions
#[test]
fn test_uncertainty_lognormal_distributions() {
    // Create fault tree: TopEvent = E1 AND E2
    let mut ft = FaultTree::new("LogNormalTest", "TopEvent").unwrap();

    // E1 with LogNormal(ln(0.1), 0.5)
    let e1 = BasicEvent::with_distribution(
        "E1".to_string(),
        0.1,
        Distribution::LogNormal(0.1_f64.ln(), 0.5),
    )
    .unwrap();
    // E2 with LogNormal(ln(0.2), 0.3)
    let e2 = BasicEvent::with_distribution(
        "E2".to_string(),
        0.2,
        Distribution::LogNormal(0.2_f64.ln(), 0.3),
    )
    .unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Run uncertainty propagation
    let result = propagate_uncertainty(&ft, 1000, Some(123)).unwrap();

    // LogNormal distributions can have significant variability
    assert!(result.mean() > 0.0);
    assert!(result.mean() < 0.5);
    assert!(result.sigma() > 0.0);

    // Error factor should reflect uncertainty
    assert!(result.error_factor() > 1.0);

    // Median should be close to center of distribution
    assert!(result.median() > 0.0);
}

/// Test uncertainty quantification with Uniform distributions
#[test]
fn test_uncertainty_uniform_distributions() {
    // Create fault tree: TopEvent = E1 OR E2
    let mut ft = FaultTree::new("UniformTest", "TopEvent").unwrap();

    // E1 with Uniform(0.005, 0.015)
    let e1 =
        BasicEvent::with_distribution("E1".to_string(), 0.01, Distribution::Uniform(0.005, 0.015))
            .unwrap();
    // E2 with Uniform(0.01, 0.03)
    let e2 =
        BasicEvent::with_distribution("E2".to_string(), 0.02, Distribution::Uniform(0.01, 0.03))
            .unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Run uncertainty propagation
    let result = propagate_uncertainty(&ft, 800, Some(999)).unwrap();

    // Mean should be around (0.01 + 0.02 - 0.01*0.02) = ~0.0298
    assert!(result.mean() > 0.025);
    assert!(result.mean() < 0.035);

    // Check that quantiles span a reasonable range
    let quantiles = result.quantiles();
    assert!(quantiles[4] > quantiles[0]); // 95th > 5th percentile
}

/// Test uncertainty quantification with mixed distribution types
#[test]
fn test_uncertainty_mixed_distributions() {
    // Create fault tree: TopEvent = (E1 AND E2) OR E3
    let mut ft = FaultTree::new("MixedTest", "TopEvent").unwrap();

    // E1 with Normal distribution
    let e1 = BasicEvent::with_distribution("E1".to_string(), 0.1, Distribution::Normal(0.1, 0.02))
        .unwrap();
    // E2 with Uniform distribution
    let e2 =
        BasicEvent::with_distribution("E2".to_string(), 0.2, Distribution::Uniform(0.15, 0.25))
            .unwrap();
    // E3 with LogNormal distribution
    let e3 = BasicEvent::with_distribution(
        "E3".to_string(),
        0.05,
        Distribution::LogNormal(0.05_f64.ln(), 0.4),
    )
    .unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    // G1 = E1 AND E2
    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    // TopEvent = G1 OR E3
    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    // Run uncertainty propagation
    let result = propagate_uncertainty(&ft, 1000, Some(777)).unwrap();

    // Verify statistics are computed
    assert!(result.mean() > 0.0);
    assert!(result.sigma() > 0.0);
    assert!(result.error_factor() > 1.0);

    // Check coefficient of variation
    let cv = result.coefficient_of_variation();
    assert!(cv > 0.0);
    assert!(cv.is_finite());
}

/// Test that uncertainty quantification without distributions uses nominal probabilities
#[test]
fn test_uncertainty_without_distributions() {
    // Create fault tree with no distributions
    let mut ft = FaultTree::new("NoDistTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Run uncertainty propagation (will use nominal values)
    let result = propagate_uncertainty(&ft, 100, Some(42)).unwrap();

    // Calculate analytical probability: P(E1 OR E2) = 0.1 + 0.2 - 0.1*0.2 = 0.28
    let analytical = FaultTreeAnalysis::new(&ft)
        .unwrap()
        .analyze()
        .unwrap()
        .top_event_probability;

    // Without distributions, all trials should give same result
    // So variance should be effectively zero
    assert!((result.mean() - analytical).abs() < 1e-10);
    assert!(result.sigma() < 1e-10);
    assert!(result.error_factor() < 1.01); // Very close to 1
}

/// Test uncertainty quantification convergence with increasing trials
#[test]
fn test_uncertainty_convergence() {
    // Create fault tree with moderate uncertainty
    let mut ft = FaultTree::new("ConvergenceTest", "TopEvent").unwrap();

    let e1 = BasicEvent::with_distribution("E1".to_string(), 0.1, Distribution::Normal(0.1, 0.01))
        .unwrap();
    let e2 = BasicEvent::with_distribution("E2".to_string(), 0.2, Distribution::Normal(0.2, 0.02))
        .unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    // Run with few trials
    let result_100 = propagate_uncertainty(&ft, 100, Some(42)).unwrap();
    // Run with many trials
    let result_2000 = propagate_uncertainty(&ft, 2000, Some(42)).unwrap();

    // Both should converge to similar mean
    let mean_diff = (result_100.mean() - result_2000.mean()).abs();
    assert!(mean_diff < 0.01); // Means should be close

    // More trials should give more precise estimates
    assert!(result_100.num_samples() == 100);
    assert!(result_2000.num_samples() == 2000);
}

/// Test reproducibility with same seed
#[test]
fn test_uncertainty_reproducibility() {
    // Create fault tree
    let mut ft = FaultTree::new("ReproTest", "TopEvent").unwrap();

    let e1 =
        BasicEvent::with_distribution("E1".to_string(), 0.1, Distribution::Uniform(0.05, 0.15))
            .unwrap();

    ft.add_basic_event(e1).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    ft.add_gate(top_gate).unwrap();

    // Run twice with same seed
    let result1 = propagate_uncertainty(&ft, 500, Some(12345)).unwrap();
    let result2 = propagate_uncertainty(&ft, 500, Some(12345)).unwrap();

    // Results should be identical
    assert_eq!(result1.mean(), result2.mean());
    assert_eq!(result1.sigma(), result2.sigma());
    assert_eq!(result1.error_factor(), result2.error_factor());
    assert_eq!(result1.quantiles(), result2.quantiles());
}
