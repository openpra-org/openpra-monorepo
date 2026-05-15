use praxis::algorithms::bdd_engine::Bdd as BddEngine;
use praxis::algorithms::bdd_pdag::BddPdag;
use praxis::algorithms::mocus::Mocus;
use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::analysis::importance::ImportanceAnalysis;
use praxis::core::event::{BasicEvent, Distribution};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::mc::DpMonteCarloAnalysis;

#[test]
fn test_full_pra_workflow_comprehensive() {
    println!("\n=== Full PRA Workflow Test ===\n");

    println!("STEP 1: Building fault tree model...");

    let mut ft = FaultTree::new("AFWSystem".to_string(), "SYSTEM_FAILS".to_string()).unwrap();

    let mut top_gate = Gate::new("SYSTEM_FAILS".to_string(), Formula::And).unwrap();
    top_gate.add_operand("PUMP_A_FAILS".to_string());
    top_gate.add_operand("PUMP_B_FAILS".to_string());
    top_gate.add_operand("PUMP_C_FAILS".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut pump_a_gate = Gate::new("PUMP_A_FAILS".to_string(), Formula::Or).unwrap();
    pump_a_gate.add_operand("PUMP_A_MOTOR".to_string());
    pump_a_gate.add_operand("PUMP_A_VALVE".to_string());
    ft.add_gate(pump_a_gate).unwrap();

    let mut pump_b_gate = Gate::new("PUMP_B_FAILS".to_string(), Formula::Or).unwrap();
    pump_b_gate.add_operand("PUMP_B_MOTOR".to_string());
    pump_b_gate.add_operand("PUMP_B_VALVE".to_string());
    ft.add_gate(pump_b_gate).unwrap();

    let mut pump_c_gate = Gate::new("PUMP_C_FAILS".to_string(), Formula::Or).unwrap();
    pump_c_gate.add_operand("PUMP_C_TURBINE".to_string());
    pump_c_gate.add_operand("PUMP_C_VALVE".to_string());
    ft.add_gate(pump_c_gate).unwrap();

    ft.add_basic_event(
        BasicEvent::with_distribution(
            "PUMP_A_MOTOR".to_string(),
            0.01,
            Distribution::LogNormal(0.01, 0.003),
        )
        .unwrap(),
    )
    .unwrap();
    ft.add_basic_event(BasicEvent::new("PUMP_A_VALVE".to_string(), 0.005).unwrap())
        .unwrap();
    ft.add_basic_event(
        BasicEvent::with_distribution(
            "PUMP_B_MOTOR".to_string(),
            0.01,
            Distribution::LogNormal(0.01, 0.003),
        )
        .unwrap(),
    )
    .unwrap();
    ft.add_basic_event(BasicEvent::new("PUMP_B_VALVE".to_string(), 0.005).unwrap())
        .unwrap();
    ft.add_basic_event(
        BasicEvent::with_distribution(
            "PUMP_C_TURBINE".to_string(),
            0.02,
            Distribution::Normal(0.02, 0.005),
        )
        .unwrap(),
    )
    .unwrap();
    ft.add_basic_event(BasicEvent::new("PUMP_C_VALVE".to_string(), 0.005).unwrap())
        .unwrap();

    println!("  Created fault tree with 6 basic events and 4 gates");

    println!("\nSTEP 2: Running fault tree analysis with multiple algorithms...");

    let fta = FaultTreeAnalysis::new(&ft).unwrap();
    let fta_result = fta.analyze().unwrap();
    println!(
        "  Standard FTA: P(system failure) = {:.6e}",
        fta_result.top_event_probability
    );
    assert!(fta_result.top_event_probability > 0.0);
    assert!(fta_result.top_event_probability < 0.001);

    let mut pdag = BddPdag::from_fault_tree(&ft).unwrap();
    pdag.compute_ordering_and_modules().unwrap();
    let (bdd_engine, root) = BddEngine::build_from_pdag(&pdag).unwrap();
    let bdd_result = bdd_engine.probability(root);
    println!("  BDD Algorithm: P(system failure) = {:.6e}", bdd_result);
    assert!((bdd_result - fta_result.top_event_probability).abs() < 1e-6);

    let mut mocus = Mocus::new(&ft);
    let cut_sets = mocus.analyze().unwrap();
    println!("  MOCUS: Generated {} minimal cut sets", cut_sets.len());
    assert!(!cut_sets.is_empty());

    println!("\nSTEP 3: Computing importance measures...");

    let importance = ImportanceAnalysis::new(&ft, bdd_result).unwrap();

    let fv_measures = importance.compute_fussell_vesely_from_cutsets(&cut_sets).unwrap();
    println!("  Top 3 by Fussell-Vesely:");
    let mut fv_sorted: Vec<_> = fv_measures.iter().collect();
    fv_sorted.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap());
    for (name, value) in fv_sorted.iter().take(3) {
        println!("    {}: {:.4}", name, value);
    }

    let raw_measures = importance.compute_raw().unwrap();
    println!("\n  Top 3 by RAW:");
    let mut raw_sorted: Vec<_> = raw_measures.iter().collect();
    raw_sorted.sort_by(|a, b| b.1.partial_cmp(a.1).unwrap());
    for (name, value) in raw_sorted.iter().take(3) {
        println!("    {}: {:.2}", name, value);
    }

    assert!(!fv_measures.is_empty());
    assert!(!raw_measures.is_empty());

    println!("\nSTEP 4: Running Monte Carlo simulation...");

    let num_trials = 100_000;
    let seed = 42;
    let mc = DpMonteCarloAnalysis::new(&ft, Some(seed), num_trials).unwrap();
    let mc_result = mc.run_cpu().unwrap();

    println!(
        "  Monte Carlo ({} trials): P = {:.6e}",
        num_trials, mc_result.probability_estimate
    );
    println!(
        "    95% CI: [{:.6e}, {:.6e}]",
        mc_result.confidence_interval_lower, mc_result.confidence_interval_upper
    );

    let mc_error = if mc_result.probability_estimate > 0.0 {
        ((mc_result.probability_estimate - bdd_result) / bdd_result).abs()
    } else {
        1.0
    };
    println!("    Relative error: {:.1}%", mc_error * 100.0);

    assert!(mc_result.probability_estimate >= 0.0);

    println!("\nSTEP 5: Performing uncertainty quantification...");

    let uncertainty =
        praxis::analysis::uncertainty::propagate_uncertainty(&ft, num_trials, Some(seed)).unwrap();

    let unc_mean = uncertainty.mean();
    let unc_std_dev = uncertainty.sigma();
    let unc_ef = uncertainty.error_factor();

    println!("  Mean: {:.6e}, Std Dev: {:.6e}", unc_mean, unc_std_dev);
    println!("  Error Factor: {:.2}", unc_ef);

    assert!(unc_mean > 0.0 && unc_mean < 1.0);
    assert!(unc_std_dev >= 0.0);

    println!("\n=== Workflow Summary ===");
    println!("BDD + MOCUS + Importance + MC + Uncertainty all passed");
}
