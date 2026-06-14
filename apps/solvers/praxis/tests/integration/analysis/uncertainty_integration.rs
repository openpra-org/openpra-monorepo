use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::analysis::uncertainty::propagate_uncertainty;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::expression::Expr;

#[test]
fn test_uncertainty_normal_distributions() {
    let mut ft = FaultTree::new("NormalTest", "TopEvent").unwrap();

    let e1 = BasicEvent::with_value("E1".to_string(), 0.01, Expr::normal(0.01, 0.002)).unwrap();
    let e2 = BasicEvent::with_value("E2".to_string(), 0.02, Expr::normal(0.02, 0.004)).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let result = propagate_uncertainty(&ft, 500, Some(42)).unwrap();

    assert!(result.mean() > 0.025);
    assert!(result.mean() < 0.035);
    assert!(result.sigma() > 0.0);
    assert!(result.error_factor() > 1.0);

    let (ci_lower, ci_upper) = result.confidence_interval();
    assert!(ci_lower < result.mean());
    assert!(ci_upper > result.mean());

    let quantiles = result.quantiles();
    assert_eq!(quantiles.len(), 5);
    for i in 1..quantiles.len() {
        assert!(quantiles[i] >= quantiles[i - 1]);
    }
}

#[test]
fn test_uncertainty_lognormal_distributions() {
    let mut ft = FaultTree::new("LogNormalTest", "TopEvent").unwrap();

    let e1 = BasicEvent::with_value("E1".to_string(), 0.1, Expr::lognormal(0.1_f64.ln(), 0.5))
        .unwrap();
    let e2 = BasicEvent::with_value("E2".to_string(), 0.2, Expr::lognormal(0.2_f64.ln(), 0.3))
        .unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::And).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let result = propagate_uncertainty(&ft, 1000, Some(123)).unwrap();

    assert!(result.mean() > 0.0);
    assert!(result.mean() < 0.5);
    assert!(result.sigma() > 0.0);
    assert!(result.error_factor() > 1.0);
    assert!(result.median() > 0.0);
}

#[test]
fn test_uncertainty_uniform_distributions() {
    let mut ft = FaultTree::new("UniformTest", "TopEvent").unwrap();

    let e1 = BasicEvent::with_value("E1".to_string(), 0.01, Expr::uniform(0.005, 0.015)).unwrap();
    let e2 = BasicEvent::with_value("E2".to_string(), 0.02, Expr::uniform(0.01, 0.03)).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let result = propagate_uncertainty(&ft, 800, Some(999)).unwrap();

    assert!(result.mean() > 0.025);
    assert!(result.mean() < 0.035);

    let quantiles = result.quantiles();
    assert!(quantiles[4] > quantiles[0]);
}

#[test]
fn test_uncertainty_mixed_distributions() {
    let mut ft = FaultTree::new("MixedTest", "TopEvent").unwrap();

    let e1 = BasicEvent::with_value("E1".to_string(), 0.1, Expr::normal(0.1, 0.02)).unwrap();
    let e2 = BasicEvent::with_value("E2".to_string(), 0.2, Expr::uniform(0.15, 0.25)).unwrap();
    let e3 = BasicEvent::with_value("E3".to_string(), 0.05, Expr::lognormal(0.05_f64.ln(), 0.4))
        .unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();
    ft.add_basic_event(e3).unwrap();

    let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
    g1.add_operand("E1".to_string());
    g1.add_operand("E2".to_string());
    ft.add_gate(g1).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("G1".to_string());
    top_gate.add_operand("E3".to_string());
    ft.add_gate(top_gate).unwrap();

    let result = propagate_uncertainty(&ft, 1000, Some(777)).unwrap();

    assert!(result.mean() > 0.0);
    assert!(result.sigma() > 0.0);
    assert!(result.error_factor() > 1.0);

    let cv = result.coefficient_of_variation();
    assert!(cv > 0.0);
    assert!(cv.is_finite());
}

#[test]
fn test_uncertainty_without_distributions() {
    let mut ft = FaultTree::new("NoDistTest", "TopEvent").unwrap();

    let e1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    let e2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let result = propagate_uncertainty(&ft, 100, Some(42)).unwrap();

    let analytical = FaultTreeAnalysis::new(&ft)
        .unwrap()
        .analyze()
        .unwrap()
        .top_event_probability;

    assert!((result.mean() - analytical).abs() < 1e-10);
    assert!(result.sigma() < 1e-10);
    assert!(result.error_factor() < 1.01);
}

#[test]
fn test_uncertainty_convergence() {
    let mut ft = FaultTree::new("ConvergenceTest", "TopEvent").unwrap();

    let e1 = BasicEvent::with_value("E1".to_string(), 0.1, Expr::normal(0.1, 0.01)).unwrap();
    let e2 = BasicEvent::with_value("E2".to_string(), 0.2, Expr::normal(0.2, 0.02)).unwrap();

    ft.add_basic_event(e1).unwrap();
    ft.add_basic_event(e2).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();

    let result_100 = propagate_uncertainty(&ft, 100, Some(42)).unwrap();
    let result_2000 = propagate_uncertainty(&ft, 2000, Some(42)).unwrap();

    let mean_diff = (result_100.mean() - result_2000.mean()).abs();
    assert!(mean_diff < 0.01);

    assert!(result_100.num_samples() == 100);
    assert!(result_2000.num_samples() == 2000);
}

#[test]
fn test_uncertainty_reproducibility() {
    let mut ft = FaultTree::new("ReproTest", "TopEvent").unwrap();

    let e1 = BasicEvent::with_value("E1".to_string(), 0.1, Expr::uniform(0.05, 0.15)).unwrap();

    ft.add_basic_event(e1).unwrap();

    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    ft.add_gate(top_gate).unwrap();

    let result1 = propagate_uncertainty(&ft, 500, Some(12345)).unwrap();
    let result2 = propagate_uncertainty(&ft, 500, Some(12345)).unwrap();

    assert_eq!(result1.mean(), result2.mean());
    assert_eq!(result1.sigma(), result2.sigma());
    assert_eq!(result1.error_factor(), result2.error_factor());
    assert_eq!(result1.quantiles(), result2.quantiles());
}
