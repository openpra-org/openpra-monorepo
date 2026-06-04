use crate::mc::plan::RunParams;
#[cfg(feature = "gpu")]
use crate::mc::scheduler::ExecutionBackend;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ConvergenceSettings {
    pub enabled: bool,
    pub delta: f64,
    pub confidence: f64,
    pub burn_in: u64,
}

impl ConvergenceSettings {
    pub fn disabled() -> Self {
        Self {
            enabled: false,
            delta: 0.0,
            confidence: 0.95,
            burn_in: 0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct MonteCarloResult {
    pub probability_estimate: f64,
    pub num_trials: usize,
    pub std_dev: f64,
    pub confidence_interval_lower: f64,
    pub confidence_interval_upper: f64,
    pub successes: usize,
    pub peak_rss_mib: Option<f64>,
    pub peak_vram_mib: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct MonteCarloRunConfig {
    pub engine: String,
    pub target: String,
    pub backend_requested: String,
    pub backend_used: String,
    pub seed: u64,
    pub num_trials_requested: usize,
    pub run_params: Option<RunParams>,
    pub early_stop: Option<bool>,
    pub delta: Option<f64>,
    pub burn_in: Option<u64>,
    pub confidence: Option<f64>,
    pub policy: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VrtMode {
    None,
    ImportanceSampling,
    StratifiedSampling,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct VrtSettings {
    pub mode: VrtMode,
    pub is_bias_factor: f64,
    pub is_max_events: usize,
    pub is_q_min: f64,
    pub stratify_events: usize,
}

impl VrtSettings {
    pub fn none() -> Self {
        Self {
            mode: VrtMode::None,
            is_bias_factor: 1.0,
            is_max_events: 0,
            is_q_min: 1.0e-12,
            stratify_events: 0,
        }
    }
}

pub fn format_bits_per_sec(bits_done: u64, elapsed: Duration) -> String {
    let secs = elapsed.as_secs_f64();
    if secs <= 0.0 {
        return "0.00 Mbit/s".to_string();
    }

    let bps = (bits_done as f64) / secs;
    if bps >= 1.0e9 {
        format!("{:.2} Gbit/s", bps / 1.0e9)
    } else {
        format!("{:.2} Mbit/s", bps / 1.0e6)
    }
}

#[cfg(feature = "gpu")]
pub trait RuntimeBackend {
    const BACKEND: ExecutionBackend;
}

#[cfg(all(feature = "gpu", feature = "cuda"))]
impl RuntimeBackend for cubecl_cuda::CudaRuntime {
    const BACKEND: ExecutionBackend = ExecutionBackend::Cuda;
}

#[cfg(all(feature = "gpu", feature = "wgpu"))]
impl RuntimeBackend for cubecl_wgpu::WgpuRuntime {
    const BACKEND: ExecutionBackend = ExecutionBackend::Wgpu;
}
