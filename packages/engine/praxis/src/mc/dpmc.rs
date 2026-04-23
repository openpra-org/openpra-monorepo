use crate::algorithms::pdag::{Pdag, PdagNode};
use crate::core::fault_tree::FaultTree;
use crate::mc::bernoulli::threshold_from_probability;
use crate::mc::core::{ConvergenceSettings, MonteCarloResult, VrtMode, VrtSettings};
use crate::mc::counter::blueprint_counter_with_increment;
use crate::mc::gpu_soa::GpuSoaPlan;
use crate::mc::importance_sampling::bernoulli_log_likelihood_ratio;
use crate::mc::memory::HostMemoryTracker;
use crate::mc::packed_gate::eval_gate_word;
use crate::mc::philox::{philox4x32_10, Philox4x32Key};
use crate::mc::plan::{choose_run_params_for_num_trials, DpMcPlan, RunParams};
use crate::mc::tally::{effective_bits_per_iteration, popcount_tallies_from_node_words_u64, NodeTallies};
use crate::Result;

use indicatif::{ProgressBar, ProgressStyle};

use std::time::Instant;

#[cfg(feature = "gpu")]
use crate::mc::core::RuntimeBackend;

#[cfg(feature = "gpu")]
use crate::mc::memory::CudaVramTracker;

#[cfg(feature = "gpu")]
use crate::mc::gpu_exec::{
    execute_layers_bitpacked_gpu_tallies, execute_layers_bitpacked_gpu_tallies_many_iters,
    FtGpuContext,
    execute_layers_bitpacked_gpu_selected_nodes_process_many_iters,
};

#[cfg(feature = "gpu")]
use crate::mc::scheduler::{ExecutionBackend, Scheduler, WorkloadMetrics};

#[cfg(feature = "gpu")]
use cubecl::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DpRunConfig {
    NumTrials(usize),
    Params(RunParams),
}

pub struct DpMonteCarloAnalysis<'a> {
    fault_tree: &'a FaultTree,
    seed: u64,
    run: DpRunConfig,
}

struct BuiltDpmc {
    pdag: Pdag,
    plan: DpMcPlan,
    soa: GpuSoaPlan,
    thresholds: Vec<u32>,
    full_ranges: Vec<u32>,
    event_probabilities: Vec<f64>,
    key: Philox4x32Key,
}

impl<'a> DpMonteCarloAnalysis<'a> {
    pub fn new(fault_tree: &'a FaultTree, seed: Option<u64>, num_trials: usize) -> Result<Self> {
        if num_trials == 0 {
            return Err(crate::error::PraxisError::Settings(
                "Number of trials must be greater than 0".to_string(),
            ));
        }

        let actual_seed = seed.unwrap_or(372);

        Ok(Self {
            fault_tree,
            seed: actual_seed,
            run: DpRunConfig::NumTrials(num_trials),
        })
    }

    pub fn with_run_params(fault_tree: &'a FaultTree, params: RunParams) -> Result<Self> {
        if params.t == 0 || params.b == 0 || params.p == 0 || params.omega == 0 {
            return Err(crate::error::PraxisError::Settings(
                "RunParams must have positive (t,b,p,omega)".to_string(),
            ));
        }
        if params.omega != RunParams::DEFAULT_OMEGA {
            return Err(crate::error::PraxisError::Settings(format!(
                "Only omega={} is supported (got omega={})",
                RunParams::DEFAULT_OMEGA,
                params.omega
            )));
        }

        Ok(Self {
            fault_tree,
            seed: params.seed,
            run: DpRunConfig::Params(params),
        })
    }

    pub fn run_cpu(&self) -> Result<MonteCarloResult> {
        self.run_cpu_with_watch_and_convergence(false, ConvergenceSettings::disabled())
    }

    pub fn run_cpu_with_watch(&self, watch: bool) -> Result<MonteCarloResult> {
        self.run_cpu_with_watch_and_convergence(watch, ConvergenceSettings::disabled())
    }

    pub fn run_cpu_with_watch_and_convergence(
        &self,
        watch: bool,
        convergence: ConvergenceSettings,
    ) -> Result<MonteCarloResult> {
        let (params, valid_lanes_last_word, total_trials) = match self.run {
            DpRunConfig::NumTrials(num_trials) => {
                let chosen = choose_run_params_for_num_trials(num_trials, self.seed)?;
                (chosen.params, chosen.valid_lanes_last_word, num_trials)
            }
            DpRunConfig::Params(params) => (params, 0u32, params.total_trials_covered()),
        };

        if total_trials == 0 {
            return Err(crate::error::PraxisError::Settings(
                "Total trials must be greater than 0".to_string(),
            ));
        }

        let built = self.build_dpmc(params)?;
        let (tallies, peak_rss_mib) = self.run_cpu_tallies(
            &built,
            valid_lanes_last_word,
            total_trials,
            watch,
            convergence,
        )?;

        let root_node = built.plan.root;
        let root = root_node.unsigned_abs() as usize;
        let mut successes_u64 = *tallies.ones_by_node().get(root).ok_or_else(|| {
            crate::error::PraxisError::Logic("Root tally index out of bounds".to_string())
        })?;

        let actual_trials_u64 = tallies.bits_total();

        if root_node < 0 {
            successes_u64 = actual_trials_u64.saturating_sub(successes_u64);
        }

        let actual_trials = usize::try_from(actual_trials_u64).unwrap_or(usize::MAX);
        let n = actual_trials as f64;
        let m = (successes_u64 as f64) / n;

        let std_deviation = if actual_trials <= 1 {
            0.0
        } else {
            ((n * m * (1.0 - m)) / (n - 1.0)).sqrt()
        };

        let (ci_lower, ci_upper) = crate::mc::stats::ci_wald(m, actual_trials_u64);

        Ok(MonteCarloResult {
            probability_estimate: m,
            num_trials: actual_trials,
            std_dev: std_deviation,
            confidence_interval_lower: ci_lower,
            confidence_interval_upper: ci_upper,
            successes: usize::try_from(successes_u64).unwrap_or(usize::MAX),
            peak_rss_mib,
            peak_vram_mib: None,
        })
    }

    pub fn run_cpu_with_watch_convergence_and_vrt(
        &self,
        watch: bool,
        convergence: ConvergenceSettings,
        vrt: VrtSettings,
    ) -> Result<MonteCarloResult> {
        match vrt.mode {
            VrtMode::None => self.run_cpu_with_watch_and_convergence(watch, convergence),
            VrtMode::ImportanceSampling => {
                let (params, _valid_lanes_last_word, total_trials) = match self.run {
                    DpRunConfig::NumTrials(num_trials) => {
                        let chosen = choose_run_params_for_num_trials(num_trials, self.seed)?;
                        (chosen.params, chosen.valid_lanes_last_word, num_trials)
                    }
                    DpRunConfig::Params(params) => (params, 0u32, params.total_trials_covered()),
                };
                self.run_cpu_importance_sampling(params, total_trials, watch, vrt)
            }
            VrtMode::StratifiedSampling => {
                let DpRunConfig::NumTrials(num_trials) = self.run else {
                    return Err(crate::error::PraxisError::Settings(
                        "Stratified sampling requires a NumTrials run (use --num-trials)".to_string(),
                    ));
                };
                let chosen = choose_run_params_for_num_trials(num_trials, self.seed)?;
                self.run_cpu_stratified_sampling(chosen.params, num_trials, watch, vrt)
            }
        }
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu<R: Runtime>(&self, device: &R::Device) -> Result<MonteCarloResult> {
        self.run_gpu_with_watch_and_convergence::<R>(
            device,
            false,
            ConvergenceSettings::disabled(),
        )
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu_with_watch<R: Runtime>(
        &self,
        device: &R::Device,
        watch: bool,
    ) -> Result<MonteCarloResult> {
        self.run_gpu_with_watch_and_convergence::<R>(device, watch, ConvergenceSettings::disabled())
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu_with_watch_and_convergence<R: Runtime>(
        &self,
        device: &R::Device,
        watch: bool,
        convergence: ConvergenceSettings,
    ) -> Result<MonteCarloResult> {
        let DpRunConfig::NumTrials(num_trials) = self.run else {
            return Err(crate::error::PraxisError::Settings(
                "run_gpu is only supported for NumTrials runs; use run_gpu_with_run_params for explicit RunParams"
                    .to_string(),
            ));
        };

        let chosen = choose_run_params_for_num_trials(num_trials, self.seed)?;
        let params = chosen.params;
        let valid_lanes_last_word = chosen.valid_lanes_last_word;

        let total_trials = num_trials;
        if total_trials == 0 {
            return Err(crate::error::PraxisError::Settings(
                "Total trials must be greater than 0".to_string(),
            ));
        }

        let built = self.build_dpmc(params)?;
        let client = R::client(device);
        let mut vram_tracker = CudaVramTracker::new_current_process();
        let _ = vram_tracker.sample();


        let progress = if watch {
            let total_iters = built.plan.params.t as u64;
            let pb = ProgressBar::new(total_iters.max(1));
            pb.set_style(
                ProgressStyle::with_template(
                    "mc [{bar:40.cyan/blue}] {pos}/{len} it {msg}",
                )
                .unwrap()
                .progress_chars("##-"),
            );
            pb.enable_steady_tick(std::time::Duration::from_millis(120));
            Some(pb)
        } else {
            None
        };

        let t0 = watch.then(Instant::now);

        let tallies = execute_layers_bitpacked_gpu_tallies::<R>(
            &client,
            &built.pdag,
            &built.plan,
            &built.soa,
            &built.thresholds,
            &built.full_ranges,
            1u32,
            built.key,
            None,
            valid_lanes_last_word,
        );

        let root_node = built.plan.root;
        let root = root_node.unsigned_abs() as usize;
        let mut successes_u64 = *tallies.get(root).ok_or_else(|| {
            crate::error::PraxisError::Logic("Root tally index out of bounds".to_string())
        })?;

        if root_node < 0 {
            successes_u64 = (total_trials as u64).saturating_sub(successes_u64);
        }

        let n = total_trials as f64;
        let m = (successes_u64 as f64) / n;

        let std_deviation = if total_trials <= 1 {
            0.0
        } else {
            ((n * m * (1.0 - m)) / (n - 1.0)).sqrt()
        };

        let (ci_lower, ci_upper) = crate::mc::stats::ci_wald(m, total_trials as u64);

        if let Some(pb) = progress {
            let bits_done = total_trials as u64;
            let thr = t0
                .as_ref()
                .map(|t| crate::mc::core::format_bits_per_sec(bits_done, t.elapsed()))
                .unwrap_or_else(|| "0.00 Mbit/s".to_string());
            let vram = vram_tracker.sample();
            let vram_msg = vram
                .map(|v| format!("  vram={:.0}MiB/{:.1}%", v.used_mib(), v.percent_used()))
                .unwrap_or_default();

            let z = crate::mc::stats::normal_quantile_two_sided(convergence.confidence)
                .unwrap_or(1.96);
            let p = m.clamp(0.0, 1.0);
            let target_lin = convergence.delta * p.max(1.0e-12);
            let eps_lin = crate::mc::stats::half_width_wald(p, bits_done, z)
                .unwrap_or(f64::NAN);
            let eps_log = crate::mc::stats::half_width_log10_wald(p, bits_done, z, 1.0e-12)
                .unwrap_or(f64::NAN);

            pb.set_message(format!(
                "trials {}/{}  p̂={:.6e}  eps_lin={:.3e}/{:.3e}  eps_log={:.3e}/{:.3e}  CI95=[{:.3e},{:.3e}]  thr={}{}",
                bits_done,
                total_trials,
                m,
                eps_lin,
                target_lin,
                eps_log,
                convergence.delta,
                ci_lower,
                ci_upper,
                thr,
                vram_msg
            ));
            pb.set_position(pb.length().unwrap_or(1));
            pb.finish_and_clear();
        }

        Ok(MonteCarloResult {
            probability_estimate: m,
            num_trials: total_trials,
            std_dev: std_deviation,
            confidence_interval_lower: ci_lower,
            confidence_interval_upper: ci_upper,
            successes: usize::try_from(successes_u64).unwrap_or(usize::MAX),
            peak_rss_mib: None,
            peak_vram_mib: vram_tracker.peak_used_mib(),
        })
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu_with_watch_convergence_and_vrt<R: Runtime>(
        &self,
        device: &R::Device,
        watch: bool,
        convergence: ConvergenceSettings,
        vrt: VrtSettings,
    ) -> Result<MonteCarloResult> {
        let DpRunConfig::NumTrials(num_trials) = self.run else {
            return Err(crate::error::PraxisError::Settings(
                "run_gpu_with_vrt is only supported for NumTrials runs".to_string(),
            ));
        };

        match vrt.mode {
            VrtMode::None => self.run_gpu_with_watch_and_convergence::<R>(device, watch, convergence),
            VrtMode::ImportanceSampling => {
                if convergence.enabled {
                    return Err(crate::error::PraxisError::Settings(
                        "VRT cannot currently be combined with early-stop convergence on GPU".to_string(),
                    ));
                }
                self.run_gpu_importance_sampling::<R>(device, num_trials, watch, vrt)
            }
            VrtMode::StratifiedSampling => {
                if convergence.enabled {
                    return Err(crate::error::PraxisError::Settings(
                        "VRT cannot currently be combined with early-stop convergence on GPU".to_string(),
                    ));
                }
                self.run_gpu_stratified_sampling::<R>(device, num_trials, watch, vrt)
            }
        }
    }

    #[cfg(feature = "gpu")]
    fn run_gpu_stratified_sampling<R: Runtime>(
        &self,
        device: &R::Device,
        total_trials_requested: usize,
        watch: bool,
        vrt: VrtSettings,
    ) -> Result<MonteCarloResult> {
        if total_trials_requested == 0 {
            return Err(crate::error::PraxisError::Settings(
                "Total trials must be greater than 0".to_string(),
            ));
        }

        let k = vrt
            .stratify_events
            .min(20)
            .min(self.fault_tree.basic_events().len());
        if k == 0 {
            return Err(crate::error::PraxisError::Settings(
                "stratify-events must be >= 1".to_string(),
            ));
        }

        let chosen0 = choose_run_params_for_num_trials(total_trials_requested, self.seed)?;
        let built0 = self.build_dpmc(chosen0.params)?;
        let strat_ords = Self::pick_event_ords_by_rarity(&built0.event_probabilities, k);
        let num_strata = 1usize << strat_ords.len();

        let base = total_trials_requested / num_strata;
        let rem = total_trials_requested % num_strata;

        let progress = if watch {
            let pb = ProgressBar::new(num_strata as u64);
            pb.set_style(
                ProgressStyle::with_template(
                    "mc [VRT=strat] [{bar:40.cyan/blue}] {pos}/{len} strata {msg}",
                )
                .unwrap()
                .progress_chars("##-"),
            );
            pb.enable_steady_tick(std::time::Duration::from_millis(120));
            Some(pb)
        } else {
            None
        };

        let client = R::client(device);
        let mut vram_tracker = CudaVramTracker::new_current_process();
        let _ = vram_tracker.sample();

        let mut total_successes: u64 = 0;
        let mut total_trials_done: usize = 0;
        let mut p_hat: f64 = 0.0;
        let mut var_total: f64 = 0.0;

        for s in 0..num_strata {
            let n_s = base + if s < rem { 1 } else { 0 };
            if n_s == 0 {
                continue;
            }

            let mut pi_s = 1.0f64;
            for (j, &ord) in strat_ords.iter().enumerate() {
                let p = built0.event_probabilities[ord].clamp(0.0, 1.0);
                let x = ((s >> j) & 1usize) == 1usize;
                pi_s *= if x { p } else { 1.0 - p };
            }

            let seed_s = self
                .seed
                .wrapping_add(0x9e37_79b9_7f4a_7c15u64.wrapping_mul((s as u64).wrapping_add(1)));
            let chosen = choose_run_params_for_num_trials(n_s, seed_s)?;
            let built = self.build_dpmc(chosen.params)?;

            let mut thresholds = built.thresholds.clone();
            let mut full_ranges = built.full_ranges.clone();
            for (j, &ord) in strat_ords.iter().enumerate() {
                let x = ((s >> j) & 1usize) == 1usize;
                if x {
                    thresholds[ord] = 0u32;
                    full_ranges[ord] = 1u32;
                } else {
                    thresholds[ord] = 0u32;
                    full_ranges[ord] = 0u32;
                }
            }

            let seed_key = [seed_s as u32, (seed_s >> 32) as u32];
            let tallies = execute_layers_bitpacked_gpu_tallies_many_iters::<R>(
                &client,
                &built.pdag,
                &built.plan,
                &built.soa,
                &thresholds,
                &full_ranges,
                built.plan.params.t as u32,
                1u32,
                seed_key,
                None,
                chosen.valid_lanes_last_word,
            );

            let root_node = built.plan.root;
            let root = root_node.unsigned_abs() as usize;
            let mut successes_u64 = *tallies.get(root).ok_or_else(|| {
                crate::error::PraxisError::Logic("Root tally index out of bounds".to_string())
            })?;

            if root_node < 0 {
                successes_u64 = (n_s as u64).saturating_sub(successes_u64);
            }

            total_successes = total_successes.saturating_add(successes_u64);
            total_trials_done = total_trials_done.saturating_add(n_s);

            let p_s = (successes_u64 as f64) / (n_s as f64);
            p_hat += pi_s * p_s;
            var_total += (pi_s * pi_s) * (p_s * (1.0 - p_s)) / (n_s as f64);

            if let Some(pb) = progress.as_ref() {
                let se = var_total.max(0.0).sqrt();
                let z = crate::mc::stats::normal_quantile_two_sided(0.95).unwrap_or(1.96);
                let ci_low = (p_hat - z * se).clamp(0.0, 1.0);
                let ci_high = (p_hat + z * se).clamp(0.0, 1.0);

                let vram = vram_tracker.sample();
                let vram_msg = vram
                    .map(|v| format!("  vram={:.0}MiB/{:.1}%", v.used_mib(), v.percent_used()))
                    .unwrap_or_default();

                pb.set_message(format!(
                    "trials {}/{}  p̂={:.6e}  CI95=[{:.3e},{:.3e}]{}",
                    total_trials_done,
                    total_trials_requested,
                    p_hat,
                    ci_low,
                    ci_high,
                    vram_msg
                ));
                pb.inc(1);
            }
        }

        if let Some(pb) = progress {
            pb.finish_and_clear();
        }

        if total_trials_done == 0 {
            return Err(crate::error::PraxisError::Logic(
                "Stratified sampling produced zero total trials".to_string(),
            ));
        }

        let z = crate::mc::stats::normal_quantile_two_sided(0.95).unwrap_or(1.96);
        let se = var_total.max(0.0).sqrt();
        let ci_lower = (p_hat - z * se).clamp(0.0, 1.0);
        let ci_upper = (p_hat + z * se).clamp(0.0, 1.0);

        Ok(MonteCarloResult {
            probability_estimate: p_hat.clamp(0.0, 1.0),
            num_trials: total_trials_done,
            std_dev: (p_hat * (1.0 - p_hat)).max(0.0).sqrt(),
            confidence_interval_lower: ci_lower,
            confidence_interval_upper: ci_upper,
            successes: usize::try_from(total_successes).unwrap_or(usize::MAX),
            peak_rss_mib: None,
            peak_vram_mib: vram_tracker.peak_used_mib(),
        })
    }

    #[cfg(feature = "gpu")]
    fn run_gpu_importance_sampling<R: Runtime>(
        &self,
        device: &R::Device,
        total_trials_requested: usize,
        watch: bool,
        vrt: VrtSettings,
    ) -> Result<MonteCarloResult> {
        if total_trials_requested == 0 {
            return Err(crate::error::PraxisError::Settings(
                "Total trials must be greater than 0".to_string(),
            ));
        }
        if vrt.is_bias_factor <= 0.0 || !vrt.is_bias_factor.is_finite() {
            return Err(crate::error::PraxisError::Settings(
                "is-bias-factor must be finite and > 0".to_string(),
            ));
        }
        if !vrt.is_q_min.is_finite() || !(0.0..0.5).contains(&vrt.is_q_min) {
            return Err(crate::error::PraxisError::Settings(
                "is-q-min must be finite and in [0, 0.5)".to_string(),
            ));
        }

        let chosen = choose_run_params_for_num_trials(total_trials_requested, self.seed)?;
        let built = self.build_dpmc(chosen.params)?;

        let max_events = vrt.is_max_events.min(built.soa.event_nodes.len()).max(0);
        let selected_ords = Self::pick_event_ords_by_rarity(&built.event_probabilities, max_events);

        let mut proposal_thresholds = built.thresholds.clone();
        let mut proposal_full_ranges = built.full_ranges.clone();

        let mut selected_event_nodes: Vec<u32> = Vec::with_capacity(selected_ords.len());
        let mut selected_p: Vec<f64> = Vec::with_capacity(selected_ords.len());
        let mut selected_q: Vec<f64> = Vec::with_capacity(selected_ords.len());

        for &ord in &selected_ords {
            let p = built.event_probabilities[ord];
            let q = (p * vrt.is_bias_factor).clamp(vrt.is_q_min, 1.0 - vrt.is_q_min);
            let th = threshold_from_probability(q);
            proposal_thresholds[ord] = th.t;
            proposal_full_ranges[ord] = if th.full_range { 1u32 } else { 0u32 };

            selected_event_nodes.push(built.soa.event_nodes[ord].unsigned_abs());
            selected_p.push(p);
            selected_q.push(q);
        }

        let root_node = built.plan.root;
        let root_abs = root_node.unsigned_abs() as u32;

        let mut selected_nodes: Vec<u32> = Vec::with_capacity(1 + selected_event_nodes.len());
        selected_nodes.push(root_abs);
        selected_nodes.extend_from_slice(&selected_event_nodes);

        struct IsAccum {
            n: usize,
            raw_successes: usize,
            logw_max: f64,
            sum_w_scaled: f64,
            sum_wy_scaled: f64,
            sum_w2_scaled: f64,
        }

        impl IsAccum {
            fn new() -> Self {
                Self {
                    n: 0,
                    raw_successes: 0,
                    logw_max: f64::NEG_INFINITY,
                    sum_w_scaled: 0.0,
                    sum_wy_scaled: 0.0,
                    sum_w2_scaled: 0.0,
                }
            }

            fn add(&mut self, logw: f64, y: bool) {
                if self.n == 0 {
                    self.n = 1;
                    self.raw_successes = if y { 1 } else { 0 };
                    self.logw_max = logw;
                    self.sum_w_scaled = 1.0;
                    self.sum_wy_scaled = if y { 1.0 } else { 0.0 };
                    self.sum_w2_scaled = 1.0;
                    return;
                }

                if logw > self.logw_max {
                    let scale = (self.logw_max - logw).exp();
                    self.sum_w_scaled *= scale;
                    self.sum_wy_scaled *= scale;
                    self.sum_w2_scaled *= (2.0 * (self.logw_max - logw)).exp();
                    self.logw_max = logw;
                }

                let w_scaled = (logw - self.logw_max).exp();
                self.sum_w_scaled += w_scaled;
                if y {
                    self.sum_wy_scaled += w_scaled;
                }
                self.sum_w2_scaled += w_scaled * w_scaled;

                self.n += 1;
                if y {
                    self.raw_successes += 1;
                }
            }

            fn estimate(&self) -> Option<f64> {
                if self.sum_w_scaled > 0.0 {
                    Some(self.sum_wy_scaled / self.sum_w_scaled)
                } else {
                    None
                }
            }

            fn ess(&self) -> Option<f64> {
                if self.sum_w_scaled > 0.0 && self.sum_w2_scaled > 0.0 {
                    Some((self.sum_w_scaled * self.sum_w_scaled) / self.sum_w2_scaled)
                } else {
                    None
                }
            }
        }

        let client = R::client(device);
        let mut vram_tracker = CudaVramTracker::new_current_process();
        let _ = vram_tracker.sample();

        let progress = if watch {
            let total_iters = built.plan.params.t as u64;
            let pb = ProgressBar::new(total_iters.max(1));
            pb.set_style(
                ProgressStyle::with_template(
                    "mc [VRT=IS] [{bar:40.cyan/blue}] {pos}/{len} it {msg}",
                )
                .unwrap()
                .progress_chars("##-"),
            );
            pb.enable_steady_tick(std::time::Duration::from_millis(120));
            Some(pb)
        } else {
            None
        };

        let t0 = watch.then(Instant::now);
        let mut samples_done: usize = 0;
        let mut accum = IsAccum::new();

        let is_err: std::cell::RefCell<Option<crate::error::PraxisError>> =
            std::cell::RefCell::new(None);

        let num_selected = selected_nodes.len();
        let bp_count = (built.plan.params.b as usize) * (built.plan.params.p as usize);

        execute_layers_bitpacked_gpu_selected_nodes_process_many_iters::<R, _>(
            &client,
            &built.pdag,
            &built.plan,
            &built.soa,
            &proposal_thresholds,
            &proposal_full_ranges,
            built.plan.params.t as u32,
            1u32,
            built.key,
            &selected_nodes,
            |words, t_counter| {
                // words layout: (bp, selected_ix)
                for bp in 0..bp_count {
                    let base = bp * num_selected;
                    let root_word = words[base];

                    for lane in 0..64u32 {
                        if samples_done >= total_trials_requested {
                            return false;
                        }
                        let bit = 1u64 << lane;
                        let mut y = (root_word & bit) != 0;
                        if root_node < 0 {
                            y = !y;
                        }

                        let mut logw = 0.0;
                        for j in 0..selected_p.len() {
                            let wj = words[base + 1 + j];
                            let x = (wj & bit) != 0;
                            match bernoulli_log_likelihood_ratio(x, selected_p[j], selected_q[j]) {
                                Ok(v) => {
                                    logw += v;
                                }
                                Err(e) => {
                                    *is_err.borrow_mut() = Some(e);
                                    return false;
                                }
                            }
                        }

                        accum.add(logw, y);
                        samples_done += 1;
                    }
                }

                if let Some(pb) = progress.as_ref() {
                    let p_hat = accum.estimate().unwrap_or(0.0);
                    let ess = accum.ess().unwrap_or(0.0);
                    let z = crate::mc::stats::normal_quantile_two_sided(0.95).unwrap_or(1.96);
                    let se = if ess > 0.0 {
                        (p_hat * (1.0 - p_hat) / ess).max(0.0).sqrt()
                    } else {
                        f64::NAN
                    };
                    let ci_low = (p_hat - z * se).clamp(0.0, 1.0);
                    let ci_high = (p_hat + z * se).clamp(0.0, 1.0);

                    let thr = t0
                        .as_ref()
                        .map(|t| crate::mc::core::format_bits_per_sec(samples_done as u64, t.elapsed()))
                        .unwrap_or_else(|| "0.00 Mbit/s".to_string());
                    let vram = vram_tracker.sample();
                    let vram_msg = vram
                        .map(|v| format!("  vram={:.0}MiB/{:.1}%", v.used_mib(), v.percent_used()))
                        .unwrap_or_default();

                    pb.set_message(format!(
                        "trials {}/{}  p̂={:.6e}  ESS≈{:.1}  CI95=[{:.3e},{:.3e}]  thr={}{}",
                        samples_done,
                        total_trials_requested,
                        p_hat,
                        ess,
                        ci_low,
                        ci_high,
                        thr,
                        vram_msg
                    ));
                    pb.set_position(u64::from(t_counter));
                }

                true
            },
        );

        if let Some(e) = is_err.into_inner() {
            return Err(e);
        }

        if let Some(pb) = progress {
            pb.finish_and_clear();
        }

        if accum.n == 0 {
            return Err(crate::error::PraxisError::Logic(
                "Importance sampling produced zero samples".to_string(),
            ));
        }

        let p_hat = accum.estimate().unwrap_or(0.0).clamp(0.0, 1.0);
        let ess = accum.ess().unwrap_or(0.0);
        let z = crate::mc::stats::normal_quantile_two_sided(0.95).unwrap_or(1.96);
        let se = if ess > 0.0 {
            (p_hat * (1.0 - p_hat) / ess).max(0.0).sqrt()
        } else {
            f64::NAN
        };
        let ci_lower = (p_hat - z * se).clamp(0.0, 1.0);
        let ci_upper = (p_hat + z * se).clamp(0.0, 1.0);

        Ok(MonteCarloResult {
            probability_estimate: p_hat,
            num_trials: samples_done,
            std_dev: (p_hat * (1.0 - p_hat)).max(0.0).sqrt(),
            confidence_interval_lower: ci_lower,
            confidence_interval_upper: ci_upper,
            successes: accum.raw_successes,
            peak_rss_mib: None,
            peak_vram_mib: vram_tracker.peak_used_mib(),
        })
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu_with_run_params<R: Runtime>(
        &self,
        device: &R::Device,
        params: RunParams,
    ) -> Result<MonteCarloResult> {
        self.run_gpu_with_run_params_with_watch_and_convergence::<R>(
            device,
            params,
            false,
            ConvergenceSettings::disabled(),
        )
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu_with_run_params_with_watch<R: Runtime>(
        &self,
        device: &R::Device,
        params: RunParams,
        watch: bool,
    ) -> Result<MonteCarloResult> {
        self.run_gpu_with_run_params_with_watch_and_convergence::<R>(
            device,
            params,
            watch,
            ConvergenceSettings::disabled(),
        )
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu_with_run_params_with_watch_and_convergence<R: Runtime>(
        &self,
        device: &R::Device,
        params: RunParams,
        watch: bool,
        convergence: ConvergenceSettings,
    ) -> Result<MonteCarloResult> {
        if params.t == 0 || params.b == 0 || params.p == 0 || params.omega == 0 {
            return Err(crate::error::PraxisError::Settings(
                "RunParams must have positive (t,b,p,omega)".to_string(),
            ));
        }
        if params.omega != RunParams::DEFAULT_OMEGA {
            return Err(crate::error::PraxisError::Settings(format!(
                "Only omega={} is supported (got omega={})",
                RunParams::DEFAULT_OMEGA,
                params.omega
            )));
        }

        let total_trials = params.total_trials_covered();
        if total_trials == 0 {
            return Err(crate::error::PraxisError::Settings(
                "Total trials covered must be greater than 0".to_string(),
            ));
        }

        let built = self.build_dpmc(params)?;
        let client = R::client(device);

        let iters_total_u32 = params.t as u32;
        let iters_per_chunk = (iters_total_u32 / 100).max(1);
        let bits_per_iter = effective_bits_per_iteration(params.b, params.p, params.omega, 0u32)?;

        let pb = if watch {
            let pb = ProgressBar::new((params.t as u64).max(1));
            pb.set_style(
                ProgressStyle::with_template(
                    "mc [{bar:40.cyan/blue}] {pos}/{len} it {msg}",
                )
                .unwrap()
                .progress_chars("##-"),
            );
            pb.enable_steady_tick(std::time::Duration::from_millis(120));
            Some(pb)
        } else {
            None
        };

        let t0 = (watch || convergence.enabled).then(Instant::now);
        let mut vram_tracker = CudaVramTracker::new_current_process();
        let _ = vram_tracker.sample();

        let (tallies, iters_done) = if watch || convergence.enabled {
            let mut tallies_acc: Option<Vec<u64>> = None;
            let mut iters_done: u32 = 0;
            let mut gpu_context = FtGpuContext::<R>::new(
                &client,
                &built.pdag,
                &built.plan,
                &built.soa,
                &built.thresholds,
                &built.full_ranges,
                None,
                0u32,
            );

            while iters_done < iters_total_u32 {
                let chunk = (iters_total_u32 - iters_done).min(iters_per_chunk);
                let t_start = 1u32 + iters_done;

                gpu_context.execute_chunk(chunk, t_start, built.key);
                tallies_acc = Some(gpu_context.read_tallies());
                iters_done = iters_done.saturating_add(chunk);

                let bits_done = (bits_per_iter as u128)
                    .saturating_mul(iters_done as u128)
                    .min(u64::MAX as u128) as u64;
                let vram = vram_tracker.sample();

                let root_node = built.plan.root;
                let root = root_node.unsigned_abs() as usize;
                let ones = tallies_acc
                    .as_ref()
                    .and_then(|v| v.get(root))
                    .copied()
                    .unwrap_or(0u64);
                let successes = if root_node < 0 {
                    bits_done.saturating_sub(ones)
                } else {
                    ones
                };
                let p_hat = if bits_done == 0 {
                    0.0
                } else {
                    (successes as f64) / (bits_done as f64)
                };

                if let Some(pb) = pb.as_ref() {
                    let (ci_low, ci_high) = crate::mc::stats::ci_wald(p_hat, bits_done);
                    let thr = t0
                        .as_ref()
                        .map(|t| crate::mc::core::format_bits_per_sec(bits_done, t.elapsed()))
                        .unwrap_or_else(|| "0.00 Mbit/s".to_string());
                    let vram_msg = vram
                        .map(|v| format!("  vram={:.0}MiB/{:.1}%", v.used_mib(), v.percent_used()))
                        .unwrap_or_default();

                    let z = crate::mc::stats::normal_quantile_two_sided(convergence.confidence)
                        .unwrap_or(1.96);
                    let p = p_hat.clamp(0.0, 1.0);
                    let target_lin = convergence.delta * p.max(1.0e-12);
                    let eps_lin = crate::mc::stats::half_width_wald(p, bits_done, z)
                        .unwrap_or(f64::NAN);
                    let eps_log = crate::mc::stats::half_width_log10_wald(p, bits_done, z, 1.0e-12)
                        .unwrap_or(f64::NAN);

                    pb.set_message(format!(
                        "trials {}/{}  p̂={:.6e}  eps_lin={:.3e}/{:.3e}  eps_log={:.3e}/{:.3e}  CI95=[{:.3e},{:.3e}]  thr={}{}",
                        bits_done,
                        total_trials,
                        p_hat,
                        eps_lin,
                        target_lin,
                        eps_log,
                        convergence.delta,
                        ci_low,
                        ci_high,
                        thr,
                        vram_msg
                    ));
                    pb.set_position(iters_done as u64);
                }

                if convergence.enabled
                    && crate::mc::stats::should_stop_convergence_wald_linear_and_log10(
                        p_hat,
                        bits_done,
                        convergence.delta,
                        convergence.confidence,
                        convergence.burn_in,
                    )
                {
                    break;
                }
            }

            let tallies = tallies_acc.unwrap_or_else(|| vec![0u64; built.soa.layout.num_nodes as usize]);
            (tallies, iters_done)
        } else {
            let mut gpu_context = FtGpuContext::<R>::new(
                &client,
                &built.pdag,
                &built.plan,
                &built.soa,
                &built.thresholds,
                &built.full_ranges,
                None,
                0u32,
            );
            gpu_context.execute_chunk(params.t as u32, 1u32, built.key);
            let tallies = gpu_context.read_tallies();
            let _ = vram_tracker.sample();
            (tallies, iters_total_u32)
        };

        if let Some(pb) = pb {
            pb.finish_and_clear();
        }
        let root_node = built.plan.root;
        let root = root_node.unsigned_abs() as usize;
        let mut successes_u64 = *tallies.get(root).ok_or_else(|| {
            crate::error::PraxisError::Logic("Root tally index out of bounds".to_string())
        })?;

        let actual_trials_u64 = (bits_per_iter as u128)
            .saturating_mul(iters_done as u128)
            .min(u64::MAX as u128) as u64;
        let actual_trials = usize::try_from(actual_trials_u64).unwrap_or(usize::MAX);

        if root_node < 0 {
            successes_u64 = actual_trials_u64.saturating_sub(successes_u64);
        }

        let n = actual_trials as f64;
        let m = (successes_u64 as f64) / n;

        let std_deviation = if actual_trials <= 1 {
            0.0
        } else {
            ((n * m * (1.0 - m)) / (n - 1.0)).sqrt()
        };

        let (ci_lower, ci_upper) = crate::mc::stats::ci_wald(m, actual_trials_u64);

        Ok(MonteCarloResult {
            probability_estimate: m,
            num_trials: actual_trials,
            std_dev: std_deviation,
            confidence_interval_lower: ci_lower,
            confidence_interval_upper: ci_upper,
            successes: usize::try_from(successes_u64).unwrap_or(usize::MAX),
            peak_rss_mib: None,
            peak_vram_mib: vram_tracker.peak_used_mib(),
        })
    }

    #[cfg(feature = "gpu")]
    pub fn run_scheduled<R: Runtime + RuntimeBackend>(
        &self,
        device: &R::Device,
        scheduler: &Scheduler,
    ) -> Result<(ExecutionBackend, MonteCarloResult)> {
        let DpRunConfig::NumTrials(num_trials) = self.run else {
            return Err(crate::error::PraxisError::Settings(
                "run_scheduled is only supported for NumTrials runs".to_string(),
            ));
        };

        let metrics = self.workload_metrics(num_trials);
        let backend = scheduler.select_backend(&metrics);

        if backend == ExecutionBackend::Cpu {
            let r = self.run_cpu()?;
            return Ok((ExecutionBackend::Cpu, r));
        }

        if backend != R::BACKEND {
            return Err(crate::error::PraxisError::Settings(format!(
                "Scheduler selected backend {:?} but runtime backend is {:?}",
                backend,
                R::BACKEND
            )));
        }

        let batch_size = scheduler.optimal_batch_size(&metrics);
        let batches = scheduler.create_batches(num_trials, batch_size);

        let client = R::client(device);
        let mut total_successes: u64 = 0;
        let mut total_trials: usize = 0;

        for (i, (start, end)) in batches.iter().copied().enumerate() {
            let batch_trials = end.saturating_sub(start);
            if batch_trials == 0 {
                continue;
            }
            let t = (i as u32) + 1u32;
            let (s, n) = self.run_gpu_for_num_trials::<R>(&client, batch_trials, t)?;
            total_successes = total_successes.saturating_add(s);
            total_trials = total_trials.saturating_add(n);
        }

        if total_trials == 0 {
            return Err(crate::error::PraxisError::Logic(
                "Scheduled GPU execution produced zero total trials".to_string(),
            ));
        }

        let n = total_trials as f64;
        let m = (total_successes as f64) / n;
        let std_deviation = if total_trials <= 1 {
            0.0
        } else {
            ((n * m * (1.0 - m)) / (n - 1.0)).sqrt()
        };
        let (ci_lower, ci_upper) = crate::mc::stats::ci_wald(m, total_trials as u64);

        Ok((
            backend,
            MonteCarloResult {
                probability_estimate: m,
                num_trials: total_trials,
                std_dev: std_deviation,
                confidence_interval_lower: ci_lower,
                confidence_interval_upper: ci_upper,
                successes: usize::try_from(total_successes).unwrap_or(usize::MAX),
                peak_rss_mib: None,
                peak_vram_mib: None,
            },
        ))
    }

    fn build_dpmc(&self, params: RunParams) -> Result<BuiltDpmc> {
        let mut pdag = Pdag::from_fault_tree(self.fault_tree)?;
        crate::mc::preprocess::preprocess_for_mc(&mut pdag)?;

        let plan = DpMcPlan::from_pdag(&pdag, params)?;
        let soa = GpuSoaPlan::from_plan(&plan)?;

        let mut thresholds: Vec<u32> = Vec::with_capacity(soa.event_nodes.len());
        let mut full_ranges: Vec<u32> = Vec::with_capacity(soa.event_nodes.len());
        let mut event_probabilities: Vec<f64> = Vec::with_capacity(soa.event_nodes.len());

        for &node in &soa.event_nodes {
            let node = node.abs();
            let id = match pdag.get_node(node) {
                Some(PdagNode::BasicEvent { id, .. }) => id,
                other => {
                    return Err(crate::error::PraxisError::Logic(format!(
                        "Expected basic event node {node} in DPMC plan, got {other:?}"
                    )))
                }
            };

            let event = self.fault_tree.basic_events().get(id).ok_or_else(|| {
                crate::error::PraxisError::Logic(format!(
                    "Basic event '{}' not found in fault tree",
                    id
                ))
            })?;

            let p = event.probability();
            event_probabilities.push(p);

            let th = threshold_from_probability(p);
            thresholds.push(th.t);
            full_ranges.push(if th.full_range { 1u32 } else { 0u32 });
        }

        let key = [params.seed as u32, (params.seed >> 32) as u32];

        Ok(BuiltDpmc {
            pdag,
            plan,
            soa,
            thresholds,
            full_ranges,
            event_probabilities,
            key,
        })
    }

    fn pick_event_ords_by_rarity(event_probabilities: &[f64], max_events: usize) -> Vec<usize> {
        let mut ords: Vec<usize> = (0..event_probabilities.len()).collect();
        ords.sort_by(|&a, &b| {
            let pa = event_probabilities[a];
            let pb = event_probabilities[b];
            pa.partial_cmp(&pb).unwrap_or(std::cmp::Ordering::Equal)
        });
        ords.truncate(max_events.min(ords.len()));
        ords
    }

    fn run_cpu_importance_sampling(
        &self,
        params: RunParams,
        total_trials_requested: usize,
        watch: bool,
        vrt: VrtSettings,
    ) -> Result<MonteCarloResult> {
        if total_trials_requested == 0 {
            return Err(crate::error::PraxisError::Settings(
                "Total trials must be greater than 0".to_string(),
            ));
        }

        if vrt.is_bias_factor <= 0.0 || !vrt.is_bias_factor.is_finite() {
            return Err(crate::error::PraxisError::Settings(
                "is-bias-factor must be finite and > 0".to_string(),
            ));
        }
        if !vrt.is_q_min.is_finite() || !(0.0..0.5).contains(&vrt.is_q_min) {
            return Err(crate::error::PraxisError::Settings(
                "is-q-min must be finite and in [0, 0.5)".to_string(),
            ));
        }

        let built = self.build_dpmc(params)?;

        let max_events = vrt.is_max_events.min(built.soa.event_nodes.len()).max(0);
        let selected = Self::pick_event_ords_by_rarity(&built.event_probabilities, max_events);

        let mut proposal_thresholds = built.thresholds.clone();
        let mut proposal_full_ranges = built.full_ranges.clone();

        struct SelectedEvent {
            node: usize,
            p: f64,
            q: f64,
        }

        let mut selected_events: Vec<SelectedEvent> = Vec::with_capacity(selected.len());
        for &ord in &selected {
            let p = built.event_probabilities[ord];
            let q = (p * vrt.is_bias_factor).clamp(vrt.is_q_min, 1.0 - vrt.is_q_min);
            let th = threshold_from_probability(q);
            proposal_thresholds[ord] = th.t;
            proposal_full_ranges[ord] = if th.full_range { 1u32 } else { 0u32 };

            let node = built.soa.event_nodes[ord].unsigned_abs() as usize;
            selected_events.push(SelectedEvent { node, p, q });
        }

        struct IsAccum {
            n: usize,
            raw_successes: usize,
            logw_max: f64,
            sum_w_scaled: f64,
            sum_wy_scaled: f64,
            sum_w2_scaled: f64,
        }

        impl IsAccum {
            fn new() -> Self {
                Self {
                    n: 0,
                    raw_successes: 0,
                    logw_max: f64::NEG_INFINITY,
                    sum_w_scaled: 0.0,
                    sum_wy_scaled: 0.0,
                    sum_w2_scaled: 0.0,
                }
            }

            fn add(&mut self, logw: f64, y: bool) {
                if self.n == 0 {
                    self.n = 1;
                    self.raw_successes = if y { 1 } else { 0 };
                    self.logw_max = logw;
                    self.sum_w_scaled = 1.0;
                    self.sum_wy_scaled = if y { 1.0 } else { 0.0 };
                    self.sum_w2_scaled = 1.0;
                    return;
                }

                if logw > self.logw_max {
                    let scale = (self.logw_max - logw).exp();
                    self.sum_w_scaled *= scale;
                    self.sum_wy_scaled *= scale;
                    self.sum_w2_scaled *= (2.0 * (self.logw_max - logw)).exp();
                    self.logw_max = logw;
                }

                let w_scaled = (logw - self.logw_max).exp();
                self.sum_w_scaled += w_scaled;
                if y {
                    self.sum_wy_scaled += w_scaled;
                }
                self.sum_w2_scaled += w_scaled * w_scaled;

                self.n += 1;
                if y {
                    self.raw_successes += 1;
                }
            }

            fn estimate(&self) -> Option<f64> {
                if self.sum_w_scaled > 0.0 {
                    Some(self.sum_wy_scaled / self.sum_w_scaled)
                } else {
                    None
                }
            }

            fn ess(&self) -> Option<f64> {
                if self.sum_w_scaled > 0.0 && self.sum_w2_scaled > 0.0 {
                    Some((self.sum_w_scaled * self.sum_w_scaled) / self.sum_w2_scaled)
                } else {
                    None
                }
            }
        }

        let num_nodes = built.soa.layout.num_nodes as usize;
        let b_count = built.plan.params.b as u32;
        let p_count = built.plan.params.p as u32;

        let progress = if watch {
            let total_iters = built.plan.params.t as u64;
            let pb = ProgressBar::new(total_iters.max(1));
            pb.set_style(
                ProgressStyle::with_template("mc [VRT=IS] [{bar:40.cyan/blue}] {pos}/{len} it {msg}")
                    .unwrap()
                    .progress_chars("##-"),
            );
            pb.enable_steady_tick(std::time::Duration::from_millis(120));
            Some(pb)
        } else {
            None
        };

        let t0 = watch.then(Instant::now);
        let mut host_mem = HostMemoryTracker::new_current_process();

        let mut accum = IsAccum::new();
        let mut samples_done: usize = 0;

        'outer: for iter in 0..built.plan.params.t {
            let t_counter = (iter as u32) + 1u32;

            let total_words = (b_count as usize) * (p_count as usize) * num_nodes;
            let mut node_words: Vec<u64> = vec![0u64; total_words];

            for b in 0..b_count {
                for p in 0..p_count {
                    let base = ((b * p_count + p) as usize) * num_nodes;
                    let view = &mut node_words[base..base + num_nodes];

                    for (event_ord, &node) in built.soa.event_nodes.iter().enumerate() {
                        let node = node.unsigned_abs() as usize;
                        let thr = proposal_thresholds[event_ord];
                        let full = proposal_full_ranges[event_ord] != 0u32;
                        view[node] = sample_event_word(
                            event_ord as u32,
                            p,
                            b,
                            t_counter,
                            built.key,
                            thr,
                            full,
                        );
                    }
                }
            }

            for layer in &built.soa.layers {
                for &node in &layer.constants {
                    let node = node.abs();
                    let value = match built.pdag.get_node(node) {
                        Some(PdagNode::Constant { value, .. }) => *value,
                        other => {
                            return Err(crate::error::PraxisError::Logic(format!(
                                "Expected constant node {node}, got {other:?}"
                            )))
                        }
                    };

                    for b in 0..b_count {
                        for p in 0..p_count {
                            let idx = built.soa.layout.index(b, p, node as u32);
                            node_words[idx] = if value { !0u64 } else { 0u64 };
                        }
                    }
                }
            }

            for layer in &built.soa.layers {
                for gates in layer.gate_groups.values() {
                    for &out_node in &gates.out_nodes {
                        let desc = built.plan.gates.get(&(out_node as i32)).ok_or_else(|| {
                            crate::error::PraxisError::Logic(format!(
                                "missing gate descriptor for node {out_node}"
                            ))
                        })?;

                        for b in 0..b_count {
                            for p in 0..p_count {
                                let base = ((b * p_count + p) as usize) * num_nodes;
                                let view = &node_words[base..base + num_nodes];
                                let w = eval_gate_word(desc, view);
                                node_words[base + out_node as usize] = w;
                            }
                        }
                    }
                }
            }

            let root_node = built.plan.root;
            let root = root_node.unsigned_abs() as usize;

            for b in 0..b_count {
                for p in 0..p_count {
                    let base = ((b * p_count + p) as usize) * num_nodes;
                    let root_word = node_words[base + root];

                    for lane in 0..64u32 {
                        if samples_done >= total_trials_requested {
                            break 'outer;
                        }

                        let bit = 1u64 << lane;
                        let mut y = (root_word & bit) != 0;
                        if root_node < 0 {
                            y = !y;
                        }

                        let mut logw = 0.0;
                        for ev in &selected_events {
                            let x = (node_words[base + ev.node] & bit) != 0;
                            logw += bernoulli_log_likelihood_ratio(x, ev.p, ev.q)?;
                        }

                        accum.add(logw, y);
                        samples_done += 1;
                    }
                }
            }

            if let Some(pb) = progress.as_ref() {
                let mem_sample = if watch || iter % 32 == 0 || iter + 1 == built.plan.params.t {
                    host_mem.sample()
                } else {
                    None
                };

                let p_hat = accum.estimate().unwrap_or(0.0);
                let ess = accum.ess().unwrap_or(0.0);
                let z = crate::mc::stats::normal_quantile_two_sided(0.95).unwrap_or(1.96);
                let se = if ess > 0.0 {
                    (p_hat * (1.0 - p_hat) / ess).max(0.0).sqrt()
                } else {
                    f64::NAN
                };

                let thr = t0
                    .as_ref()
                    .map(|t| crate::mc::core::format_bits_per_sec(samples_done as u64, t.elapsed()))
                    .unwrap_or_else(|| "0.00 Mbit/s".to_string());
                let mem_msg = mem_sample
                    .map(|m| format!("  rss={:.0}MiB/{:.1}%", m.rss_mib(), m.percent_used()))
                    .unwrap_or_default();

                let ci_low = (p_hat - z * se).clamp(0.0, 1.0);
                let ci_high = (p_hat + z * se).clamp(0.0, 1.0);

                pb.set_message(format!(
                    "trials {}/{}  p̂={:.6e}  ESS≈{:.1}  CI95=[{:.3e},{:.3e}]  thr={}{}",
                    samples_done,
                    total_trials_requested,
                    p_hat,
                    ess,
                    ci_low,
                    ci_high,
                    thr,
                    mem_msg
                ));
                pb.inc(1);
            }
        }

        if let Some(pb) = progress {
            pb.finish_and_clear();
        }

        if accum.n == 0 {
            return Err(crate::error::PraxisError::Logic(
                "Importance sampling produced zero samples".to_string(),
            ));
        }

        let p_hat = accum.estimate().unwrap_or(0.0).clamp(0.0, 1.0);
        let ess = accum.ess().unwrap_or(0.0);

        let z = crate::mc::stats::normal_quantile_two_sided(0.95).unwrap_or(1.96);
        let se = if ess > 0.0 {
            (p_hat * (1.0 - p_hat) / ess).max(0.0).sqrt()
        } else {
            f64::NAN
        };
        let ci_lower = (p_hat - z * se).clamp(0.0, 1.0);
        let ci_upper = (p_hat + z * se).clamp(0.0, 1.0);

        Ok(MonteCarloResult {
            probability_estimate: p_hat,
            num_trials: samples_done,
            std_dev: (p_hat * (1.0 - p_hat)).max(0.0).sqrt(),
            confidence_interval_lower: ci_lower,
            confidence_interval_upper: ci_upper,
            successes: accum.raw_successes,
            peak_rss_mib: host_mem.peak_rss_mib(),
            peak_vram_mib: None,
        })
    }

    fn run_cpu_root_successes_with_thresholds(
        &self,
        built: &BuiltDpmc,
        key: Philox4x32Key,
        thresholds: &[u32],
        full_ranges: &[u32],
        total_trials_requested: usize,
    ) -> Result<u64> {
        if thresholds.len() != built.soa.event_nodes.len() || full_ranges.len() != built.soa.event_nodes.len() {
            return Err(crate::error::PraxisError::Logic(
                "thresholds/full_ranges length mismatch".to_string(),
            ));
        }

        let num_nodes = built.soa.layout.num_nodes as usize;
        let b_count = built.plan.params.b as u32;
        let p_count = built.plan.params.p as u32;
        let root_node = built.plan.root;
        let root = root_node.unsigned_abs() as usize;

        let mut samples_done: usize = 0;
        let mut successes: u64 = 0;

        'outer: for iter in 0..built.plan.params.t {
            let t_counter = (iter as u32) + 1u32;

            let total_words = (b_count as usize) * (p_count as usize) * num_nodes;
            let mut node_words: Vec<u64> = vec![0u64; total_words];

            for b in 0..b_count {
                for p in 0..p_count {
                    let base = ((b * p_count + p) as usize) * num_nodes;
                    let view = &mut node_words[base..base + num_nodes];

                    for (event_ord, &node) in built.soa.event_nodes.iter().enumerate() {
                        let node = node.unsigned_abs() as usize;
                        let thr = thresholds[event_ord];
                        let full = full_ranges[event_ord] != 0u32;
                        view[node] = sample_event_word(
                            event_ord as u32,
                            p,
                            b,
                            t_counter,
                            key,
                            thr,
                            full,
                        );
                    }
                }
            }

            for layer in &built.soa.layers {
                for &node in &layer.constants {
                    let node = node.abs();
                    let value = match built.pdag.get_node(node) {
                        Some(PdagNode::Constant { value, .. }) => *value,
                        other => {
                            return Err(crate::error::PraxisError::Logic(format!(
                                "Expected constant node {node}, got {other:?}"
                            )))
                        }
                    };

                    for b in 0..b_count {
                        for p in 0..p_count {
                            let idx = built.soa.layout.index(b, p, node as u32);
                            node_words[idx] = if value { !0u64 } else { 0u64 };
                        }
                    }
                }
            }

            for layer in &built.soa.layers {
                for gates in layer.gate_groups.values() {
                    for &out_node in &gates.out_nodes {
                        let desc = built.plan.gates.get(&(out_node as i32)).ok_or_else(|| {
                            crate::error::PraxisError::Logic(format!(
                                "missing gate descriptor for node {out_node}"
                            ))
                        })?;

                        for b in 0..b_count {
                            for p in 0..p_count {
                                let base = ((b * p_count + p) as usize) * num_nodes;
                                let view = &node_words[base..base + num_nodes];
                                let w = eval_gate_word(desc, view);
                                node_words[base + out_node as usize] = w;
                            }
                        }
                    }
                }
            }

            for b in 0..b_count {
                for p in 0..p_count {
                    let base = ((b * p_count + p) as usize) * num_nodes;
                    let root_word = node_words[base + root];
                    for lane in 0..64u32 {
                        if samples_done >= total_trials_requested {
                            break 'outer;
                        }
                        let bit = 1u64 << lane;
                        let mut y = (root_word & bit) != 0;
                        if root_node < 0 {
                            y = !y;
                        }
                        if y {
                            successes = successes.saturating_add(1);
                        }
                        samples_done += 1;
                    }
                }
            }
        }

        Ok(successes)
    }

    fn run_cpu_stratified_sampling(
        &self,
        params: RunParams,
        total_trials_requested: usize,
        watch: bool,
        vrt: VrtSettings,
    ) -> Result<MonteCarloResult> {
        if total_trials_requested == 0 {
            return Err(crate::error::PraxisError::Settings(
                "Total trials must be greater than 0".to_string(),
            ));
        }

        let k = vrt
            .stratify_events
            .min(20)
            .min(self.fault_tree.basic_events().len());
        if k == 0 {
            return Err(crate::error::PraxisError::Settings(
                "stratify-events must be >= 1".to_string(),
            ));
        }

        let built = self.build_dpmc(params)?;
        let strat_ords = Self::pick_event_ords_by_rarity(&built.event_probabilities, k);
        let num_strata = 1usize << strat_ords.len();

        let base = total_trials_requested / num_strata;
        let rem = total_trials_requested % num_strata;

        let mut host_mem = HostMemoryTracker::new_current_process();

        let progress = if watch {
            let pb = ProgressBar::new(num_strata as u64);
            pb.set_style(
                ProgressStyle::with_template("mc [VRT=strat] [{bar:40.cyan/blue}] {pos}/{len} strata {msg}")
                    .unwrap()
                    .progress_chars("##-"),
            );
            pb.enable_steady_tick(std::time::Duration::from_millis(120));
            Some(pb)
        } else {
            None
        };

        let mut total_successes: u64 = 0;
        let mut total_trials_done: usize = 0;
        let mut p_hat: f64 = 0.0;
        let mut var_total: f64 = 0.0;

        for s in 0..num_strata {
            let n_s = base + if s < rem { 1 } else { 0 };
            if n_s == 0 {
                continue;
            }

            // Compute stratum probability under the target distribution for stratified events.
            let mut pi_s = 1.0f64;
            for (j, &ord) in strat_ords.iter().enumerate() {
                let p = built.event_probabilities[ord].clamp(0.0, 1.0);
                let x = ((s >> j) & 1usize) == 1usize;
                pi_s *= if x { p } else { 1.0 - p };
            }

            let mut thresholds = built.thresholds.clone();
            let mut full_ranges = built.full_ranges.clone();
            for (j, &ord) in strat_ords.iter().enumerate() {
                let x = ((s >> j) & 1usize) == 1usize;
                if x {
                    thresholds[ord] = 0u32;
                    full_ranges[ord] = 1u32;
                } else {
                    thresholds[ord] = 0u32;
                    full_ranges[ord] = 0u32;
                }
            }

            // Use a per-stratum key so strata runs are not perfectly correlated.
            let seed_s = params
                .seed
                .wrapping_add(0x9e37_79b9_7f4a_7c15u64.wrapping_mul((s as u64).wrapping_add(1)));
            let key_s = [seed_s as u32, (seed_s >> 32) as u32];

            let successes_s = self.run_cpu_root_successes_with_thresholds(
                &built,
                key_s,
                &thresholds,
                &full_ranges,
                n_s,
            )?;

            total_successes = total_successes.saturating_add(successes_s);
            total_trials_done = total_trials_done.saturating_add(n_s);

            let p_s = (successes_s as f64) / (n_s as f64);
            p_hat += pi_s * p_s;
            var_total += (pi_s * pi_s) * (p_s * (1.0 - p_s)) / (n_s as f64);

            if let Some(pb) = progress.as_ref() {
                let mem_sample = host_mem.sample();
                let se = var_total.max(0.0).sqrt();
                let z = crate::mc::stats::normal_quantile_two_sided(0.95).unwrap_or(1.96);
                let ci_low = (p_hat - z * se).clamp(0.0, 1.0);
                let ci_high = (p_hat + z * se).clamp(0.0, 1.0);
                let mem_msg = mem_sample
                    .map(|m| format!("  rss={:.0}MiB/{:.1}%", m.rss_mib(), m.percent_used()))
                    .unwrap_or_default();
                pb.set_message(format!(
                    "trials {}/{}  p̂={:.6e}  CI95=[{:.3e},{:.3e}]{}",
                    total_trials_done,
                    total_trials_requested,
                    p_hat,
                    ci_low,
                    ci_high,
                    mem_msg
                ));
                pb.inc(1);
            }
        }

        if let Some(pb) = progress {
            pb.finish_and_clear();
        }

        if total_trials_done == 0 {
            return Err(crate::error::PraxisError::Logic(
                "Stratified sampling produced zero total trials".to_string(),
            ));
        }

        let z = crate::mc::stats::normal_quantile_two_sided(0.95).unwrap_or(1.96);
        let se = var_total.max(0.0).sqrt();
        let ci_lower = (p_hat - z * se).clamp(0.0, 1.0);
        let ci_upper = (p_hat + z * se).clamp(0.0, 1.0);

        Ok(MonteCarloResult {
            probability_estimate: p_hat.clamp(0.0, 1.0),
            num_trials: total_trials_done,
            std_dev: (p_hat * (1.0 - p_hat)).max(0.0).sqrt(),
            confidence_interval_lower: ci_lower,
            confidence_interval_upper: ci_upper,
            successes: usize::try_from(total_successes).unwrap_or(usize::MAX),
            peak_rss_mib: host_mem.peak_rss_mib(),
            peak_vram_mib: None,
        })
    }

    fn run_cpu_tallies(
        &self,
        built: &BuiltDpmc,
        valid_lanes_last_word: u32,
        total_trials_requested: usize,
        watch: bool,
        convergence: ConvergenceSettings,
    ) -> Result<(NodeTallies, Option<f64>)> {
        let num_nodes = built.soa.layout.num_nodes as usize;
        let b_count = built.plan.params.b as u32;
        let p_count = built.plan.params.p as u32;

        let mut tallies = NodeTallies::new(num_nodes);

        let progress = if watch {
            let total_iters = built.plan.params.t as u64;
            let pb = ProgressBar::new(total_iters);
            pb.set_style(
                ProgressStyle::with_template(
                    "mc [{bar:40.cyan/blue}] {pos}/{len} it {msg}",
                )
                .unwrap()
                .progress_chars("##-"),
            );
            pb.enable_steady_tick(std::time::Duration::from_millis(120));
            Some(pb)
        } else {
            None
        };

        let t0 = watch.then(Instant::now);
        let mut host_mem = HostMemoryTracker::new_current_process();
        let mut latest_mem = host_mem.sample();

        for iter in 0..built.plan.params.t {
            let t_counter = (iter as u32) + 1u32;

            let total_words = (b_count as usize) * (p_count as usize) * num_nodes;
            let mut node_words: Vec<u64> = vec![0u64; total_words];

            for b in 0..b_count {
                for p in 0..p_count {
                    let base = ((b * p_count + p) as usize) * num_nodes;
                    let view = &mut node_words[base..base + num_nodes];

                    for (event_ord, &node) in built.soa.event_nodes.iter().enumerate() {
                        let node = node.unsigned_abs() as usize;
                        let thr = built.thresholds[event_ord];
                        let full = built.full_ranges[event_ord] != 0u32;
                        view[node] = sample_event_word(
                            event_ord as u32,
                            p,
                            b,
                            t_counter,
                            built.key,
                            thr,
                            full,
                        );
                    }
                }
            }

            for layer in &built.soa.layers {
                for &node in &layer.constants {
                    let node = node.abs();
                    let value = match built.pdag.get_node(node) {
                        Some(PdagNode::Constant { value, .. }) => *value,
                        other => {
                            return Err(crate::error::PraxisError::Logic(format!(
                                "Expected constant node {node}, got {other:?}"
                            )))
                        }
                    };

                    for b in 0..b_count {
                        for p in 0..p_count {
                            let idx = built.soa.layout.index(b, p, node as u32);
                            node_words[idx] = if value { !0u64 } else { 0u64 };
                        }
                    }
                }
            }

            for layer in &built.soa.layers {
                for gates in layer.gate_groups.values() {
                    for &out_node in &gates.out_nodes {
                        let desc = built.plan.gates.get(&(out_node as i32)).ok_or_else(|| {
                            crate::error::PraxisError::Logic(format!(
                                "missing gate descriptor for node {out_node}"
                            ))
                        })?;

                        for b in 0..b_count {
                            for p in 0..p_count {
                                let base = ((b * p_count + p) as usize) * num_nodes;
                                let view = &node_words[base..base + num_nodes];
                                let w = eval_gate_word(desc, view);
                                node_words[base + out_node as usize] = w;
                            }
                        }
                    }
                }
            }

            let ones_by_node = popcount_tallies_from_node_words_u64(
                built.soa.layout.num_nodes,
                b_count,
                p_count,
                &node_words,
                valid_lanes_last_word,
            )?;

            let bits_in_iteration = effective_bits_per_iteration(
                built.plan.params.b,
                built.plan.params.p,
                built.plan.params.omega,
                valid_lanes_last_word,
            )?;

            tallies.add_iteration(&ones_by_node, bits_in_iteration)?;

            if convergence.enabled {
                let bits_done = tallies.bits_total();
                let root_node = built.plan.root;
                let root = root_node.unsigned_abs() as usize;
                let ones = tallies.ones_by_node().get(root).copied().unwrap_or(0u64);
                let successes = if root_node < 0 {
                    bits_done.saturating_sub(ones)
                } else {
                    ones
                };
                let p_hat = if bits_done == 0 {
                    0.0
                } else {
                    (successes as f64) / (bits_done as f64)
                };

                if crate::mc::stats::should_stop_convergence_wald_linear_and_log10(
                    p_hat,
                    bits_done,
                    convergence.delta,
                    convergence.confidence,
                    convergence.burn_in,
                ) {
                    if let Some(pb) = progress.as_ref() {
                        pb.inc(1);
                    }
                    break;
                }
            }

            if let Some(pb) = progress.as_ref() {
                if watch || iter % 32 == 0 || iter + 1 == built.plan.params.t {
                    latest_mem = host_mem.sample();
                }
                let bits_done = tallies.bits_total();
                let root_node = built.plan.root;
                let root = root_node.unsigned_abs() as usize;
                let mut successes = tallies
                    .ones_by_node()
                    .get(root)
                    .copied()
                    .unwrap_or(0u64);
                if root_node < 0 {
                    successes = bits_done.saturating_sub(successes);
                }
                let p_hat = if bits_done == 0 {
                    0.0
                } else {
                    (successes as f64) / (bits_done as f64)
                };
                let (ci_low, ci_high) = crate::mc::stats::ci_wald(p_hat, bits_done);

                let z = crate::mc::stats::normal_quantile_two_sided(convergence.confidence)
                    .unwrap_or(1.96);
                let p = p_hat.clamp(0.0, 1.0);
                let target_lin = convergence.delta * p.max(1.0e-12);
                let eps_lin = crate::mc::stats::half_width_wald(p, bits_done, z)
                    .unwrap_or(f64::NAN);
                let eps_log = crate::mc::stats::half_width_log10_wald(p, bits_done, z, 1.0e-12)
                    .unwrap_or(f64::NAN);

                let thr = t0
                    .as_ref()
                    .map(|t| crate::mc::core::format_bits_per_sec(bits_done, t.elapsed()))
                    .unwrap_or_else(|| "0.00 Mbit/s".to_string());
                let mem_msg = latest_mem
                    .map(|m| format!("  rss={:.0}MiB/{:.1}%", m.rss_mib(), m.percent_used()))
                    .unwrap_or_default();
                pb.set_message(format!(
                    "trials {}/{}  p̂={:.6e}  eps_lin={:.3e}/{:.3e}  eps_log={:.3e}/{:.3e}  CI95=[{:.3e},{:.3e}]  thr={}{}",
                    bits_done,
                    total_trials_requested,
                    p_hat,
                    eps_lin,
                    target_lin,
                    eps_log,
                    convergence.delta,
                    ci_low,
                    ci_high,
                    thr,
                    mem_msg
                ));
                pb.inc(1);
            }
        }

        if let Some(pb) = progress {
            pb.finish_and_clear();
        }

        Ok((tallies, host_mem.peak_rss_mib()))
    }

    #[cfg(feature = "gpu")]
    fn workload_metrics(&self, num_trials: usize) -> WorkloadMetrics {
        let num_events = self.fault_tree.basic_events().len();
        let num_gates = self.fault_tree.gates().len();
        let avg_gate_fanin = if num_gates == 0 {
            0.0
        } else {
            let sum: usize = self
                .fault_tree
                .gates()
                .values()
                .map(|g| g.operands().len())
                .sum();
            (sum as f64) / (num_gates as f64)
        };

        WorkloadMetrics {
            num_trials,
            num_events,
            num_gates,
            avg_gate_fanin,
        }
    }

    #[cfg(feature = "gpu")]
    fn run_gpu_for_num_trials<R: Runtime>(
        &self,
        client: &ComputeClient<R>,
        num_trials: usize,
        t: u32,
    ) -> Result<(u64, usize)> {
        if num_trials == 0 {
            return Err(crate::error::PraxisError::Settings(
                "Number of trials must be greater than 0".to_string(),
            ));
        }

        let chosen = choose_run_params_for_num_trials(num_trials, self.seed)?;
        let built = self.build_dpmc(chosen.params)?;

        let tallies = execute_layers_bitpacked_gpu_tallies::<R>(
            client,
            &built.pdag,
            &built.plan,
            &built.soa,
            &built.thresholds,
            &built.full_ranges,
            t,
            built.key,
            None,
            chosen.valid_lanes_last_word,
        );

        let root_node = built.plan.root;
        let root = root_node.unsigned_abs() as usize;
        let mut successes_u64 = *tallies.get(root).ok_or_else(|| {
            crate::error::PraxisError::Logic("Root tally index out of bounds".to_string())
        })?;

        if root_node < 0 {
            successes_u64 = (num_trials as u64).saturating_sub(successes_u64);
        }

        Ok((successes_u64, num_trials))
    }
}

#[inline]
fn sample_event_word(
    event_ord: u32,
    p: u32,
    b: u32,
    t: u32,
    key: Philox4x32Key,
    thr: u32,
    full: bool,
) -> u64 {
    if full {
        return !0u64;
    }
    if thr == 0u32 {
        return 0u64;
    }

    let mut out = 0u64;

    for block in 0u32..16u32 {
        let ctr = blueprint_counter_with_increment(event_ord, p, b, t, block);
        let r = philox4x32_10(ctr, key);

        for j in 0..4u32 {
            let lane = block * 4u32 + j;
            if r[j as usize] < thr {
                out |= 1u64 << lane;
            }
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::core::event::BasicEvent;
    use crate::core::gate::{Formula, Gate};

    fn tiny_or_fault_tree(p1: f64, p2: f64) -> FaultTree {
        let mut ft = FaultTree::new("FT1", "TOP").unwrap();

        let mut gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), p1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), p2).unwrap())
            .unwrap();

        ft
    }

    #[test]
    fn dpmc_cpu_is_deterministic_for_fixed_seed() {
        let ft = tiny_or_fault_tree(0.25, 0.5);
        let a = DpMonteCarloAnalysis::new(&ft, Some(123), 1000)
            .unwrap()
            .run_cpu()
            .unwrap();
        let b = DpMonteCarloAnalysis::new(&ft, Some(123), 1000)
            .unwrap()
            .run_cpu()
            .unwrap();
        assert_eq!(a.num_trials, 1000);
        assert_eq!(a.successes, b.successes);
        assert_eq!(a.probability_estimate, b.probability_estimate);
    }

    #[test]
    fn dpmc_cpu_respects_explicit_run_params() {
        let ft = tiny_or_fault_tree(0.1, 0.2);
        let params = RunParams::new(2, 1, 2, 64, 999);
        let r = DpMonteCarloAnalysis::with_run_params(&ft, params)
            .unwrap()
            .run_cpu()
            .unwrap();

        assert_eq!(r.num_trials, params.total_trials_covered());
        assert!(r.probability_estimate >= 0.0 && r.probability_estimate <= 1.0);
        assert!(r.confidence_interval_lower <= r.confidence_interval_upper);
    }

    #[cfg(all(feature = "gpu", feature = "cuda"))]
    #[test]
    fn cuda_cpu_and_gpu_tallies_match_for_tiny_tree() {
        use crate::mc::gpu_exec::execute_layers_bitpacked_gpu_tallies;
        use cubecl::prelude::*;
        use cubecl_cuda::CudaRuntime;

        let ft = tiny_or_fault_tree(0.25, 0.5);
        let params = RunParams::new(1, 1, 2, 64, 0xC0FFEEu64);
        let analysis = DpMonteCarloAnalysis::with_run_params(&ft, params).unwrap();
        let built = analysis.build_dpmc(params).unwrap();

        let (cpu_tallies, _peak_rss) = analysis
            .run_cpu_tallies(
                &built,
                0u32,
                params.total_trials_covered(),
                false,
                ConvergenceSettings::disabled(),
            )
            .unwrap();

        let device = <CudaRuntime as Runtime>::Device::default();
        let client = CudaRuntime::client(&device);

        let gpu_tallies = execute_layers_bitpacked_gpu_tallies::<CudaRuntime>(
            &client,
            &built.pdag,
            &built.plan,
            &built.soa,
            &built.thresholds,
            &built.full_ranges,
            1u32,
            built.key,
            None,
            0u32,
        );

        assert_eq!(gpu_tallies, cpu_tallies.ones_by_node());
    }
}
