use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::analysis::uncertainty::propagate_uncertainty;
use praxis::core::distribution::Law;
use praxis::core::distribution_sampling::{SamplingMethod, SamplingPlan};
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::expression::Expr;

fn plan(trials: usize, seed: u64) -> SamplingPlan {
    SamplingPlan {
        method: SamplingMethod::MonteCarlo,
        trials,
        seed,
    }
}

fn hypercube(trials: usize, seed: u64) -> SamplingPlan {
    SamplingPlan {
        method: SamplingMethod::LatinHypercube,
        trials,
        seed,
    }
}

fn truncated_normal(mean: f64, standard_deviation: f64) -> Expr {
    Expr::draw(Law::Truncated {
        law: Box::new(Law::Normal {
            mean,
            standard_deviation,
        }),
        lower: Some(0.0),
        upper: Some(1.0),
    })
}

fn truncated_lognormal(mean: f64, error_factor: f64) -> Expr {
    Expr::draw(Law::Truncated {
        law: Box::new(Law::Lognormal {
            mean,
            error_factor,
            level: 0.95,
        }),
        lower: None,
        upper: Some(1.0),
    })
}

fn two_event_tree(name: &str, formula: Formula, first: BasicEvent, second: BasicEvent) -> FaultTree {
    let mut ft = FaultTree::new(name, "TopEvent").unwrap();
    ft.add_basic_event(first).unwrap();
    ft.add_basic_event(second).unwrap();
    let mut top_gate = Gate::new("TopEvent".to_string(), formula).unwrap();
    top_gate.add_operand("E1".to_string());
    top_gate.add_operand("E2".to_string());
    ft.add_gate(top_gate).unwrap();
    ft
}

#[test]
fn independent_uniform_events_reach_the_exact_mean() {
    let ft = two_event_tree(
        "UniformTest",
        Formula::Or,
        BasicEvent::with_value("E1".to_string(), 0.01, Expr::uniform(0.005, 0.015)).unwrap(),
        BasicEvent::with_value("E2".to_string(), 0.02, Expr::uniform(0.01, 0.03)).unwrap(),
    );
    let exact = 0.01 + 0.02 - 0.01 * 0.02;
    for sampling in [plan(4000, 999), hypercube(4000, 999)] {
        let result = propagate_uncertainty(&ft, &sampling).unwrap();
        assert!((result.mean() - exact).abs() < 5.0 * result.standard_error());
        let quantiles = result.quantiles();
        assert_eq!(quantiles.len(), 5);
        assert!(quantiles.windows(2).all(|pair| pair[1].value >= pair[0].value));
    }
}

#[test]
fn truncated_laws_give_a_spread_inside_probability() {
    let ft = two_event_tree(
        "TruncatedTest",
        Formula::And,
        BasicEvent::with_value("E1".to_string(), 0.1, truncated_lognormal(0.1, 3.0)).unwrap(),
        BasicEvent::with_value("E2".to_string(), 0.2, truncated_normal(0.2, 0.03)).unwrap(),
    );
    let result = propagate_uncertainty(&ft, &plan(1000, 123)).unwrap();
    assert!(result.mean() > 0.0 && result.mean() < 0.5);
    assert!(result.standard_deviation() > 0.0);
    assert!(result.samples().iter().all(|value| (0.0..=1.0).contains(value)));
}

fn lognormal(mean: f64, error_factor: f64) -> Expr {
    Expr::draw(Law::Lognormal {
        mean,
        error_factor,
        level: 0.95,
    })
}

#[test]
fn untruncated_laws_quantify_while_every_trial_stays_inside_probability() {
    let ft = two_event_tree(
        "TailTest",
        Formula::Or,
        BasicEvent::with_value("E1".to_string(), 1e-3, lognormal(1e-3, 3.0)).unwrap(),
        BasicEvent::with_value("E2".to_string(), 0.01, Expr::normal(0.01, 0.002)).unwrap(),
    );
    for sampling in [plan(4000, 17), hypercube(4000, 17)] {
        let result = propagate_uncertainty(&ft, &sampling).unwrap();
        assert!(result.samples().iter().all(|value| (0.0..=1.0).contains(value)));
        let exact = 1e-3 + 0.01 - 1e-3 * 0.01;
        assert!((result.mean() - exact).abs() < 5.0 * result.standard_error());
    }
}

#[test]
fn a_trial_outside_probability_stops_the_run_and_names_the_event() {
    let ft = two_event_tree(
        "WideTest",
        Formula::Or,
        BasicEvent::with_value("E1".to_string(), 0.2, lognormal(0.2, 8.0)).unwrap(),
        BasicEvent::with_value("E2".to_string(), 0.01, Expr::uniform(0.005, 0.015)).unwrap(),
    );
    let error = propagate_uncertainty(&ft, &plan(4000, 5)).unwrap_err().to_string();
    assert!(error.contains("basic event 'E1'") && error.contains("outside 0 to 1"), "{error}");
}

#[test]
fn point_values_match_the_analytical_result() {
    let ft = two_event_tree(
        "NoDistTest",
        Formula::Or,
        BasicEvent::new("E1".to_string(), 0.1).unwrap(),
        BasicEvent::new("E2".to_string(), 0.2).unwrap(),
    );
    let result = propagate_uncertainty(&ft, &plan(100, 42)).unwrap();
    let analytical = FaultTreeAnalysis::new(&ft)
        .unwrap()
        .analyze()
        .unwrap()
        .top_event_probability;
    assert!((result.mean() - analytical).abs() < 1e-10);
    assert!(result.standard_deviation() <= 100.0 * f64::EPSILON * result.mean());
}

#[test]
fn more_trials_tighten_the_estimate() {
    let ft = two_event_tree(
        "ConvergenceTest",
        Formula::Or,
        BasicEvent::with_value("E1".to_string(), 0.1, truncated_normal(0.1, 0.01)).unwrap(),
        BasicEvent::with_value("E2".to_string(), 0.2, truncated_normal(0.2, 0.02)).unwrap(),
    );
    let small = propagate_uncertainty(&ft, &plan(100, 42)).unwrap();
    let large = propagate_uncertainty(&ft, &plan(2000, 42)).unwrap();
    assert!(large.standard_error() < small.standard_error());
    assert!((small.mean() - large.mean()).abs() < 5.0 * small.standard_error());
    assert_eq!(small.num_samples(), 100);
    assert_eq!(large.num_samples(), 2000);
}

#[test]
fn parsed_xml_parameters_share_one_draw_per_trial() {
    let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="ft">
    <define-gate name="top">
      <and>
        <basic-event name="A"/>
        <basic-event name="B"/>
      </and>
    </define-gate>
    <define-basic-event name="A">
      <exponential><parameter name="lambda"/><system-mission-time/></exponential>
    </define-basic-event>
    <define-basic-event name="B">
      <exponential><parameter name="lambda"/><system-mission-time/></exponential>
    </define-basic-event>
    <define-parameter name="lambda">
      <lognormal-deviate><float value="0.001"/><float value="3.0"/><float value="0.95"/></lognormal-deviate>
    </define-parameter>
  </define-fault-tree>
</opsa-mef>"#;
    let ft = praxis::io::parser::parse_fault_tree(xml).unwrap();
    let event = ft.get_basic_event("A").unwrap();
    assert!((event.probability() - (1.0 - (-0.001f64).exp())).abs() < 1e-12);
    let result = propagate_uncertainty(&ft, &plan(4000, 2024)).unwrap();
    let independent_square = (1.0 - (-0.001f64).exp()).powi(2);
    assert!(result.mean() > independent_square);
}

#[test]
fn the_same_seed_reproduces_every_sample() {
    let mut ft = FaultTree::new("ReproTest", "TopEvent").unwrap();
    ft.add_basic_event(
        BasicEvent::with_value("E1".to_string(), 0.1, Expr::uniform(0.05, 0.15)).unwrap(),
    )
    .unwrap();
    let mut top_gate = Gate::new("TopEvent".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("E1".to_string());
    ft.add_gate(top_gate).unwrap();
    let first = propagate_uncertainty(&ft, &plan(500, 12345)).unwrap();
    let second = propagate_uncertainty(&ft, &plan(500, 12345)).unwrap();
    assert_eq!(first.samples(), second.samples());
    assert_eq!(first.quantiles(), second.quantiles());
}
