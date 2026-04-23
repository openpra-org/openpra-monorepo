#![cfg(feature = "cuda")]

use cubecl::prelude::Runtime;
use cubecl_cuda::CudaRuntime;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::mc::plan::choose_run_params_for_num_trials;
use praxis::mc::stats::ci_wald_z;
use praxis::mc::DpMonteCarloAnalysis;

#[test]
fn cuda_identity_fault_tree_or_of_n_identical_events_matches_analytic_within_ci() {
    // Identity check: OR of N identical independent events.
    // Analytic: P = 1 - (1 - p)^N
    //
    // We run the (bitpacked) DPMC GPU path and ensure the analytic value lies within
    // a conservative Wald CI around the estimate. Using a larger z reduces flakiness
    // while still validating the estimate is in-family.

    let n_events: usize = 32;
    let p: f64 = 0.02;
    let num_trials: usize = 200_000;
    let seed: u64 = 12345;

    let mut ft = FaultTree::new("FT_IDENTITY", "TOP").unwrap();
    let mut top = Gate::new("TOP".to_string(), Formula::Or).unwrap();

    for i in 0..n_events {
        let id = format!("E{i}");
        top.add_operand(id.clone());
        ft.add_basic_event(BasicEvent::new(id, p).unwrap()).unwrap();
    }
    ft.add_gate(top).unwrap();

    let device = <CudaRuntime as Runtime>::Device::default();
    let chosen = choose_run_params_for_num_trials(num_trials, seed).unwrap();
    let mc = DpMonteCarloAnalysis::with_run_params(&ft, chosen.params).unwrap();
    let result = mc
        .run_gpu_with_run_params::<CudaRuntime>(&device, chosen.params)
        .unwrap();

    let analytic = 1.0 - (1.0 - p).powi(n_events as i32);

    // Conservative CI: ~6-sigma band.
    let (lo, hi) = ci_wald_z(result.probability_estimate, result.num_trials as u64, 6.0);

    assert!(
        analytic >= lo && analytic <= hi,
        "analytic P={analytic:.6e} not in CI [{lo:.6e}, {hi:.6e}] (p_hat={:.6e}, n={})",
        result.probability_estimate,
        result.num_trials
    );

    // Extra sanity: estimate should not be wildly off.
    assert!(
        (result.probability_estimate - analytic).abs() < 0.05,
        "estimate deviates too much: p_hat={:.6e}, analytic={analytic:.6e}",
        result.probability_estimate
    );
}
