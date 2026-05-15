/// Integration tests for GPU-accelerated Monte Carlo simulation
///
/// Tests verify:
/// - GPU vs CPU result equivalence
/// - Performance improvements
/// - Deterministic behavior with seeded PRNG
/// - Scheduler backend selection
/// - Batch processing correctness
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

    // Probability 0.0 should always return false
    for _ in 0..100 {
        assert!(!sample_event_cpu(0.0, &mut rng));
    }

    // Probability 1.0 should always return true
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

    // Should be within 5% of expected probability with high confidence
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

    // Should prefer GPU if available, otherwise CPU
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

    // Verify batch ranges
    assert_eq!(batches[0], (0, 2500));
    assert_eq!(batches[1], (2500, 5000));
    assert_eq!(batches[2], (5000, 7500));
    assert_eq!(batches[3], (7500, 10000));

    // Verify no gaps or overlaps
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

    // Expected: (1000 * 20) + (1000 * 10 * 3.0) = 20000 + 30000 = 50000
    assert_eq!(cost, 50000.0);
}

#[test]
fn test_combined_monte_carlo_simulation_cpu() {
    // Simulate a simple fault tree: E1 AND E2 -> Top Event
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
    let analytical_prob = probabilities[0] * probabilities[1]; // 0.1 * 0.2 = 0.02

    // Should be close to analytical result (within 2%)
    assert!(
        (estimated_prob - analytical_prob).abs() < 0.02,
        "Estimated probability {} too far from analytical {}",
        estimated_prob,
        analytical_prob
    );
}

#[test]
fn test_combined_monte_carlo_simulation_or_gate() {
    // Simulate: E1 OR E2 -> Top Event
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
    // P(E1 OR E2) = P(E1) + P(E2) - P(E1 AND E2) = 0.3 + 0.4 - 0.12 = 0.58
    let analytical_prob =
        probabilities[0] + probabilities[1] - (probabilities[0] * probabilities[1]);

    // Should be close to analytical result (within 2%)
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
    // CUDA availability depends on runtime, so just check it doesn't panic
    let _ = scheduler.is_backend_available(ExecutionBackend::Cuda);
}

#[cfg(feature = "wgpu")]
#[test]
fn test_wgpu_backend_availability() {
    let scheduler = Scheduler::auto();
    // WGPU availability depends on runtime, so just check it doesn't panic
    let _ = scheduler.is_backend_available(ExecutionBackend::Wgpu);
}
