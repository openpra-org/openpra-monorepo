use praxis::mc::kernel::{evaluate_gate_cpu, sample_event_cpu, GateOp};
use praxis::mc::scheduler::{ExecutionBackend, Scheduler, WorkloadMetrics};

#[test]
fn test_cpu_gate_evaluation_and_gate() {
    let result = evaluate_gate_cpu(GateOp::And, &[true, true, true], None);
    assert!(result);

    let result = evaluate_gate_cpu(GateOp::And, &[true, false, true], None);
    assert!(!result);
}

#[test]
fn test_cpu_gate_evaluation_or_gate() {
    let result = evaluate_gate_cpu(GateOp::Or, &[false, false, true], None);
    assert!(result);

    let result = evaluate_gate_cpu(GateOp::Or, &[false, false, false], None);
    assert!(!result);
}

#[test]
fn test_cpu_gate_evaluation_not_gate() {
    let result = evaluate_gate_cpu(GateOp::Not, &[true], None);
    assert!(!result);

    let result = evaluate_gate_cpu(GateOp::Not, &[false], None);
    assert!(result);
}

#[test]
fn test_cpu_gate_evaluation_xor_gate() {
    let result = evaluate_gate_cpu(GateOp::Xor, &[true, false, false], None);
    assert!(result);

    let result = evaluate_gate_cpu(GateOp::Xor, &[true, true, false], None);
    assert!(!result);
}

#[test]
fn test_cpu_event_sampling_deterministic() {
    let mut rng1 = 42u64;
    let mut rng2 = 42u64;

    let samples1: Vec<bool> = (0..100).map(|_| sample_event_cpu(0.5, &mut rng1)).collect();
    let samples2: Vec<bool> = (0..100).map(|_| sample_event_cpu(0.5, &mut rng2)).collect();

    assert_eq!(samples1, samples2, "Same seed should produce same samples");
}

#[test]
fn test_cpu_event_sampling_probability_extremes() {
    let mut rng = 12345u64;

    for _ in 0..100 {
        assert!(!sample_event_cpu(0.0, &mut rng));
    }

    for _ in 0..100 {
        assert!(sample_event_cpu(1.0, &mut rng));
    }
}

#[test]
fn test_cpu_event_sampling_distribution() {
    let mut rng = 99u64;
    let probability = 0.3;
    let num_samples = 10000;

    let successes = (0..num_samples)
        .filter(|_| sample_event_cpu(probability, &mut rng))
        .count();

    let observed_prob = successes as f64 / num_samples as f64;

    assert!(
        (observed_prob - probability).abs() < 0.05,
        "Observed probability {} too far from expected {}",
        observed_prob,
        probability
    );
}

#[test]
fn test_scheduler_backend_selection_small_workload() {
    let scheduler = Scheduler::auto();

    let metrics = WorkloadMetrics {
        num_trials: 100,
        num_events: 10,
        num_gates: 5,
        avg_gate_fanin: 2.0,
    };

    let backend = scheduler.select_backend(&metrics);
    assert_eq!(
        backend,
        ExecutionBackend::Cpu,
        "Small workloads should use CPU"
    );
}

#[test]
fn test_scheduler_backend_selection_large_workload() {
    let scheduler = Scheduler::auto();

    let metrics = WorkloadMetrics {
        num_trials: 1_000_000,
        num_events: 100,
        num_gates: 50,
        avg_gate_fanin: 3.0,
    };

    let backend = scheduler.select_backend(&metrics);

    #[cfg(any(feature = "cuda", feature = "wgpu"))]
    assert_ne!(
        backend,
        ExecutionBackend::Cpu,
        "Large workloads should use GPU when available"
    );

    #[cfg(not(any(feature = "cuda", feature = "wgpu")))]
    assert_eq!(
        backend,
        ExecutionBackend::Cpu,
        "Should fallback to CPU when GPU not available"
    );
}

#[test]
fn test_scheduler_cpu_only_override() {
    let scheduler = Scheduler::cpu_only();

    let metrics = WorkloadMetrics {
        num_trials: 10_000_000,
        num_events: 200,
        num_gates: 100,
        avg_gate_fanin: 4.0,
    };

    let backend = scheduler.select_backend(&metrics);
    assert_eq!(
        backend,
        ExecutionBackend::Cpu,
        "CPU-only scheduler should always use CPU"
    );
}

#[test]
fn test_scheduler_batch_creation() {
    let scheduler = Scheduler::auto();

    let batches = scheduler.create_batches(10000, 2500);
    assert_eq!(batches.len(), 4);

    assert_eq!(batches[0], (0, 2500));
    assert_eq!(batches[1], (2500, 5000));
    assert_eq!(batches[2], (5000, 7500));
    assert_eq!(batches[3], (7500, 10000));

    for i in 0..batches.len() - 1 {
        assert_eq!(
            batches[i].1,
            batches[i + 1].0,
            "Batches should be contiguous"
        );
    }
}

#[test]
fn test_scheduler_optimal_batch_size() {
    let scheduler = Scheduler::auto();

    let metrics = WorkloadMetrics {
        num_trials: 5_000_000,
        num_events: 50,
        num_gates: 25,
        avg_gate_fanin: 2.5,
    };

    let batch_size = scheduler.optimal_batch_size(&metrics);

    assert!(batch_size >= 1000, "Batch size should be at least 1000");
    assert!(
        batch_size <= metrics.num_trials,
        "Batch size should not exceed total trials"
    );
}

#[test]
fn test_workload_metrics_cost_calculation() {
    let metrics = WorkloadMetrics {
        num_trials: 1000,
        num_events: 20,
        num_gates: 10,
        avg_gate_fanin: 3.0,
    };

    let cost = metrics.total_cost();

    assert_eq!(cost, 50000.0);
}

#[test]
fn test_combined_monte_carlo_simulation_cpu() {
    let probabilities = [0.1, 0.2];
    let num_trials = 1000;
    let seed = 42;

    let mut rng = seed;
    let mut successes = 0;

    for _ in 0..num_trials {
        let e1 = sample_event_cpu(probabilities[0], &mut rng);
        let e2 = sample_event_cpu(probabilities[1], &mut rng);
        let top_event = evaluate_gate_cpu(GateOp::And, &[e1, e2], None);

        if top_event {
            successes += 1;
        }
    }

    let estimated_prob = successes as f64 / num_trials as f64;
    let analytical_prob = probabilities[0] * probabilities[1];

    assert!(
        (estimated_prob - analytical_prob).abs() < 0.02,
        "Estimated probability {} too far from analytical {}",
        estimated_prob,
        analytical_prob
    );
}

#[test]
fn test_combined_monte_carlo_simulation_or_gate() {
    let probabilities = [0.3, 0.4];
    let num_trials = 10000;
    let seed = 99;

    let mut rng = seed;
    let mut successes = 0;

    for _ in 0..num_trials {
        let e1 = sample_event_cpu(probabilities[0], &mut rng);
        let e2 = sample_event_cpu(probabilities[1], &mut rng);
        let top_event = evaluate_gate_cpu(GateOp::Or, &[e1, e2], None);

        if top_event {
            successes += 1;
        }
    }

    let estimated_prob = successes as f64 / num_trials as f64;

    let analytical_prob =
        probabilities[0] + probabilities[1] - (probabilities[0] * probabilities[1]);

    assert!(
        (estimated_prob - analytical_prob).abs() < 0.02,
        "Estimated probability {} too far from analytical {}",
        estimated_prob,
        analytical_prob
    );
}

#[test]
fn test_scheduler_is_cpu_always_available() {
    let scheduler = Scheduler::auto();
    assert!(scheduler.is_backend_available(ExecutionBackend::Cpu));
}

#[cfg(feature = "cuda")]
#[test]
fn test_cuda_backend_availability() {
    let scheduler = Scheduler::auto();

    let _ = scheduler.is_backend_available(ExecutionBackend::Cuda);
}

#[cfg(feature = "wgpu")]
#[test]
fn test_wgpu_backend_availability() {
    let scheduler = Scheduler::auto();

    let _ = scheduler.is_backend_available(ExecutionBackend::Wgpu);
}

#[cfg(feature = "wgpu")]
mod wgpu_large_runs {
    use cubecl_wgpu::WgpuRuntime;
    use praxis::core::event::BasicEvent;
    use praxis::core::event_tree::{
        Branch, BranchTarget, EventTree, Fork, FunctionalEvent, InitiatingEvent, Path, Sequence,
    };
    use praxis::core::fault_tree::FaultTree;
    use praxis::core::gate::{Formula, Gate};
    use praxis::core::model::Model;
    use praxis::mc::core::{ConvergenceSettings, VrtMode, VrtSettings};
    use praxis::mc::plan::RunParams;
    use praxis::mc::{DpEventTreeMonteCarloAnalysis, DpMonteCarloAnalysis};

    const PAST_THE_WORKGROUP_LIMIT: usize = 65_535 * 8 * 64 + 1_000;

    fn or_tree() -> FaultTree {
        let mut tree = FaultTree::new("FT", "TOP").unwrap();
        let mut gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        tree.add_gate(gate).unwrap();
        tree.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        tree.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        tree
    }

    #[test]
    fn fault_tree_runs_past_the_workgroup_limit_match_the_cpu() {
        let tree = or_tree();
        let device = Default::default();
        let importance = VrtSettings {
            mode: VrtMode::ImportanceSampling,
            is_bias_factor: 10.0,
            is_max_events: usize::MAX,
            is_q_min: 1.0e-12,
            stratify_events: 0,
        };
        let stratified = VrtSettings {
            mode: VrtMode::StratifiedSampling,
            stratify_events: 1,
            ..importance
        };
        for vrt in [VrtSettings::none(), importance, stratified] {
            let analysis =
                DpMonteCarloAnalysis::new(&tree, Some(1009), PAST_THE_WORKGROUP_LIMIT).unwrap();
            let cpu = analysis
                .run_cpu_with_watch_convergence_and_vrt(false, ConvergenceSettings::disabled(), vrt)
                .unwrap();
            let gpu = analysis
                .run_gpu_with_watch_convergence_and_vrt::<WgpuRuntime>(
                    &device,
                    false,
                    ConvergenceSettings::disabled(),
                    vrt,
                )
                .unwrap();
            assert_eq!(gpu.num_trials, PAST_THE_WORKGROUP_LIMIT, "{vrt:?}");
            assert_eq!(cpu.successes, gpu.successes, "{vrt:?}");
            assert_eq!(
                cpu.probability_estimate, gpu.probability_estimate,
                "{vrt:?}"
            );
        }
    }

    #[test]
    fn event_tree_runs_across_dispatches_match_the_cpu() {
        let model = Model::new("").unwrap();

        let seq_ok = Sequence::new("SEQ_OK".to_string());
        let seq_fail = Sequence::new("SEQ_FAIL".to_string());
        let ok_branch = Branch::new(BranchTarget::Sequence(seq_ok.id.clone()));
        let fail_branch = Branch::new(BranchTarget::Sequence(seq_fail.id.clone()));
        let ok_path = Path::new("success".to_string(), ok_branch)
            .unwrap()
            .with_collect_formula_negated(false);
        let fail_path = Path::new("failure".to_string(), fail_branch)
            .unwrap()
            .with_collect_formula_negated(true);
        let fork = Fork::new("FE1".to_string(), vec![ok_path, fail_path]).unwrap();

        let mut et = EventTree::new("ET1".to_string(), Branch::new(BranchTarget::Fork(fork)));
        et.add_sequence(seq_ok).unwrap();
        et.add_sequence(seq_fail).unwrap();
        et.add_functional_event(
            FunctionalEvent::new("FE1".to_string()).with_success_probability(0.30),
        )
        .unwrap();

        let ie = InitiatingEvent::new("IE".to_string())
            .with_probability(1.0)
            .with_frequency(2.0);

        let params = RunParams::new(2, 2, 5_000, 64, 123_456_789);
        let mc = DpEventTreeMonteCarloAnalysis::with_run_params(ie, et, &model, params).unwrap();

        let cpu = mc.run_cpu().unwrap();
        let gpu = mc.run_gpu::<WgpuRuntime>(&Default::default()).unwrap();

        assert_eq!(cpu.num_trials, gpu.num_trials);
        for (c, g) in cpu.sequences.iter().zip(gpu.sequences.iter()) {
            assert_eq!(c.successes, g.successes);
            assert_eq!(c.probability_estimate, g.probability_estimate);
        }
    }
}
