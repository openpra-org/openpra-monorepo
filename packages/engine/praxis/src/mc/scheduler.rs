/// GPU workload scheduler with intelligent CPU fallback
///
/// This module manages the distribution of Monte Carlo workloads between
/// GPU and CPU, optimizing for:
/// - Small problems: CPU is faster due to kernel launch overhead
/// - Large problems: GPU parallelism dominates
/// - Batch size optimization for GPU memory efficiency
///
/// # Example
///
/// ```
/// use praxis::mc::scheduler::{ExecutionBackend, Scheduler, WorkloadMetrics};
///
/// let scheduler = Scheduler::auto();
/// let metrics = WorkloadMetrics {
///     num_trials: 100_000,
///     num_events: 50,
///     num_gates: 0,
///     avg_gate_fanin: 0.0,
/// };
/// let backend = scheduler.select_backend(&metrics);
/// ```
use std::time::Instant;

/// Execution backend for Monte Carlo simulation
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecutionBackend {
    /// CPU execution (always available)
    Cpu,
    /// GPU execution via CUDA
    #[cfg(feature = "cuda")]
    Cuda,
    /// GPU execution via WGPU (Vulkan/Metal/WebGPU)
    #[cfg(feature = "wgpu")]
    Wgpu,
}

/// Performance hints for workload scheduling
#[derive(Debug, Clone)]
pub struct WorkloadMetrics {
    /// Number of Monte Carlo trials
    pub num_trials: usize,
    /// Number of basic events
    pub num_events: usize,
    /// Number of gates in fault tree
    pub num_gates: usize,
    /// Average gate fan-in (inputs per gate)
    pub avg_gate_fanin: f64,
}

impl WorkloadMetrics {
    /// Estimate total computational cost (arbitrary units)
    pub fn total_cost(&self) -> f64 {
        let sampling_cost = self.num_trials as f64 * self.num_events as f64;
        let evaluation_cost = self.num_trials as f64 * self.num_gates as f64 * self.avg_gate_fanin;
        sampling_cost + evaluation_cost
    }
}

/// Scheduler for GPU/CPU workload distribution
pub struct Scheduler {
    /// GPU kernel launch overhead threshold (in cost units)
    gpu_overhead_threshold: f64,
    /// Preferred backend (if available)
    preferred_backend: Option<ExecutionBackend>,
    /// Maximum batch size for GPU memory
    max_batch_size: usize,
}

impl Scheduler {
    /// Create scheduler with automatic backend selection
    pub fn auto() -> Self {
        Scheduler {
            // Kernel submission, device transfers, and synchronization overhead dominate at small
            // problem sizes. This threshold is intentionally conservative so tiny workloads
            // prefer CPU even when a GPU backend is available.
            gpu_overhead_threshold: 100_000.0, // Empirical threshold
            preferred_backend: None,
            max_batch_size: 1_000_000, // 1M trials per batch
        }
    }

    /// Create scheduler with specific backend preference
    pub fn with_backend(backend: ExecutionBackend) -> Self {
        Scheduler {
            gpu_overhead_threshold: 0.0, // Always use preferred backend if available
            preferred_backend: Some(backend),
            max_batch_size: 1_000_000,
        }
    }

    /// Create CPU-only scheduler
    pub fn cpu_only() -> Self {
        Scheduler {
            gpu_overhead_threshold: f64::INFINITY, // Never use GPU
            preferred_backend: Some(ExecutionBackend::Cpu),
            max_batch_size: usize::MAX,
        }
    }

    /// Select optimal backend for given workload
    pub fn select_backend(&self, metrics: &WorkloadMetrics) -> ExecutionBackend {
        // Check if user has backend preference
        if let Some(backend) = self.preferred_backend {
            if self.is_backend_available(backend) {
                return backend;
            }
        }

        // Check if workload is large enough to benefit from GPU
        let cost = metrics.total_cost();
        if cost < self.gpu_overhead_threshold {
            return ExecutionBackend::Cpu;
        }

        // Try GPU backends in order of preference
        #[cfg(feature = "cuda")]
        if self.is_backend_available(ExecutionBackend::Cuda) {
            return ExecutionBackend::Cuda;
        }

        #[cfg(feature = "wgpu")]
        if self.is_backend_available(ExecutionBackend::Wgpu) {
            return ExecutionBackend::Wgpu;
        }

        // Fallback to CPU
        ExecutionBackend::Cpu
    }

    /// Check if backend is available on this system
    pub fn is_backend_available(&self, backend: ExecutionBackend) -> bool {
        match backend {
            ExecutionBackend::Cpu => true,
            #[cfg(feature = "cuda")]
            ExecutionBackend::Cuda => {
                // Check if CUDA runtime is available
                // In production, this would query CUDA API
                cfg!(feature = "cuda")
            }
            #[cfg(feature = "wgpu")]
            ExecutionBackend::Wgpu => {
                // Check if WGPU adapter exists
                cfg!(feature = "wgpu")
            }
            #[allow(unreachable_patterns)]
            _ => false,
        }
    }

    /// Calculate optimal batch size for GPU execution
    pub fn optimal_batch_size(&self, metrics: &WorkloadMetrics) -> usize {
        let trials_per_batch = self.max_batch_size / metrics.num_events.max(1);
        trials_per_batch.min(metrics.num_trials).max(1000)
    }

    /// Split workload into batches for GPU execution
    pub fn create_batches(&self, total_trials: usize, batch_size: usize) -> Vec<(usize, usize)> {
        let mut batches = Vec::new();
        let mut start = 0;

        while start < total_trials {
            let end = (start + batch_size).min(total_trials);
            batches.push((start, end));
            start = end;
        }

        batches
    }
}

impl Default for Scheduler {
    fn default() -> Self {
        Self::auto()
    }
}

/// Performance benchmark result
#[derive(Debug, Clone)]
pub struct BenchmarkResult {
    pub backend: ExecutionBackend,
    pub num_trials: usize,
    pub duration_ms: f64,
    pub throughput_trials_per_sec: f64,
}

/// Run simple benchmark to compare CPU vs GPU performance
pub fn benchmark_backends(num_trials: usize, num_events: usize) -> Vec<BenchmarkResult> {
    let mut results = Vec::new();

    // Benchmark CPU
    let start = Instant::now();
    // Simulate CPU work
    let _cpu_work: usize = (0..num_trials).map(|i| i % num_events).sum();
    let cpu_duration = start.elapsed().as_secs_f64() * 1000.0;

    results.push(BenchmarkResult {
        backend: ExecutionBackend::Cpu,
        num_trials,
        duration_ms: cpu_duration,
        throughput_trials_per_sec: num_trials as f64 / (cpu_duration / 1000.0),
    });

    // GPU benchmarks would go here (require actual GPU)

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scheduler_auto() {
        let scheduler = Scheduler::auto();
        assert!(scheduler.is_backend_available(ExecutionBackend::Cpu));
    }

    #[test]
    fn test_scheduler_cpu_only() {
        let scheduler = Scheduler::cpu_only();
        let metrics = WorkloadMetrics {
            num_trials: 1_000_000,
            num_events: 100,
            num_gates: 50,
            avg_gate_fanin: 2.5,
        };

        assert_eq!(scheduler.select_backend(&metrics), ExecutionBackend::Cpu);
    }

    #[test]
    fn test_workload_metrics_cost() {
        let metrics = WorkloadMetrics {
            num_trials: 1000,
            num_events: 10,
            num_gates: 5,
            avg_gate_fanin: 2.0,
        };

        let cost = metrics.total_cost();
        assert!(cost > 0.0);
        // Sampling cost: 1000 * 10 = 10000
        // Evaluation cost: 1000 * 5 * 2.0 = 10000
        // Total: 20000
        assert_eq!(cost, 20000.0);
    }

    #[test]
    fn test_scheduler_small_workload_prefers_cpu() {
        let scheduler = Scheduler::auto();
        let metrics = WorkloadMetrics {
            num_trials: 10,
            num_events: 5,
            num_gates: 3,
            avg_gate_fanin: 2.0,
        };

        let backend = scheduler.select_backend(&metrics);
        assert_eq!(backend, ExecutionBackend::Cpu);
    }

    #[test]
    fn test_optimal_batch_size() {
        let scheduler = Scheduler::auto();
        let metrics = WorkloadMetrics {
            num_trials: 5_000_000,
            num_events: 50,
            num_gates: 20,
            avg_gate_fanin: 2.0,
        };

        let batch_size = scheduler.optimal_batch_size(&metrics);
        assert!(batch_size > 0);
        assert!(batch_size <= scheduler.max_batch_size);
    }

    #[test]
    fn test_create_batches() {
        let scheduler = Scheduler::auto();
        let batches = scheduler.create_batches(10000, 3000);

        assert_eq!(batches.len(), 4);
        assert_eq!(batches[0], (0, 3000));
        assert_eq!(batches[1], (3000, 6000));
        assert_eq!(batches[2], (6000, 9000));
        assert_eq!(batches[3], (9000, 10000));
    }

    #[test]
    fn test_create_batches_exact_multiple() {
        let scheduler = Scheduler::auto();
        let batches = scheduler.create_batches(9000, 3000);

        assert_eq!(batches.len(), 3);
        assert_eq!(batches[2], (6000, 9000));
    }

    #[test]
    fn test_benchmark_backends() {
        let results = benchmark_backends(1000, 10);
        assert!(!results.is_empty());
        assert_eq!(results[0].backend, ExecutionBackend::Cpu);
        assert!(results[0].duration_ms >= 0.0);
        assert!(results[0].throughput_trials_per_sec > 0.0);
    }
}
