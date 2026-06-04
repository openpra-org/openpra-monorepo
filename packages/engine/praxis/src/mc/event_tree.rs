use crate::algorithms::pdag::{Connective, Pdag, PdagNode};
use crate::core::event_tree::{Branch, BranchTarget, EventTree, InitiatingEvent, Sequence};
use crate::core::gate::Formula;
use crate::core::model::Model;
use crate::error::{PraxisError, Result};
use crate::mc::bernoulli::threshold_from_probability;
use crate::mc::counter::blueprint_counter_with_increment;
use crate::mc::core::ConvergenceSettings;
#[cfg(feature = "gpu")]
use crate::mc::gpu_exec::{
    EtGpuContext,
};
use crate::mc::gpu_soa::GpuSoaPlan;
use crate::mc::packed_gate::eval_gate_word;
use crate::mc::philox::{philox4x32_10, Philox4x32Key};
use crate::mc::plan::{choose_run_params_for_num_trials, DpMcPlan, RunParams};
use crate::mc::preprocess::preprocess_for_mc;
use crate::mc::tally::effective_bits_per_iteration;

use indicatif::{ProgressBar, ProgressStyle};
use serde::{Deserialize, Serialize};

use std::collections::{HashMap, HashSet};
use std::time::Instant;

const PSEUDO_FE_PREFIX: &str = "__et_mc_fe__::";
const PSEUDO_IE_PREFIX: &str = "__et_mc_ie__::";
const ROOT_GATE_ID: &str = "__et_mc_root__";

#[derive(Debug, Clone)]
pub struct SequenceMonteCarloResult {
    pub sequence: Sequence,
    pub probability_estimate: f64,
    pub successes: usize,
    pub num_trials: usize,
    pub frequency_estimate: f64,
}

#[derive(Debug, Clone)]
pub struct EventTreeMonteCarloResult {
    pub num_trials: usize,
    pub sequences: Vec<SequenceMonteCarloResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledEventTreePdagV1 {
    pub version: String,
    pub initiating_event_id: String,
    pub event_tree_id: Option<String>,
    pub pdag: Pdag,
    pub ft_root_nodes: HashMap<String, usize>,
    pub pseudo_probabilities: HashMap<String, f64>,
}

pub struct DpEventTreeMonteCarloAnalysis<'a> {
    initiating_event: InitiatingEvent,
    event_tree: EventTree,
    model: &'a Model,

    event_tree_library: Option<&'a HashMap<String, EventTree>>,

    seed: u64,
    run: RunParams,
    valid_lanes_last_word: u32,
    requested_trials: usize,
}

impl<'a> DpEventTreeMonteCarloAnalysis<'a> {
    pub fn new(
        initiating_event: InitiatingEvent,
        event_tree: EventTree,
        model: &'a Model,
        seed: Option<u64>,
        num_trials: usize,
    ) -> Result<Self> {
        if num_trials == 0 {
            return Err(PraxisError::Settings(
                "Number of trials must be greater than 0".to_string(),
            ));
        }

        let actual_seed = seed.unwrap_or(372);
        let chosen = choose_run_params_for_num_trials(num_trials, actual_seed)?;

        Ok(Self {
            initiating_event,
            event_tree,
            model,
            event_tree_library: None,
            seed: actual_seed,
            run: chosen.params,
            valid_lanes_last_word: chosen.valid_lanes_last_word,
            requested_trials: num_trials,
        })
    }

    pub fn with_run_params(
        initiating_event: InitiatingEvent,
        event_tree: EventTree,
        model: &'a Model,
        params: RunParams,
    ) -> Result<Self> {
        if params.omega != RunParams::DEFAULT_OMEGA {
            return Err(PraxisError::Settings(format!(
                "Event-tree Monte Carlo currently requires omega={} (got {})",
                RunParams::DEFAULT_OMEGA,
                params.omega
            )));
        }

        let total_trials = params.total_trials_covered();
        if total_trials == 0 {
            return Err(PraxisError::Settings(
                "Total trials covered must be greater than 0".to_string(),
            ));
        }

        Ok(Self {
            initiating_event,
            event_tree,
            model,
            event_tree_library: None,
            seed: params.seed,
            run: params,
            valid_lanes_last_word: 0,
            requested_trials: total_trials,
        })
    }

    pub fn with_event_tree_library(mut self, lib: &'a HashMap<String, EventTree>) -> Self {
        self.event_tree_library = Some(lib);
        self
    }

    pub fn compile_event_tree_pdag(&self) -> Result<CompiledEventTreePdagV1> {
        let mut referenced_ets: HashMap<String, EventTree> = HashMap::new();
        self.collect_reachable_event_trees(&mut referenced_ets)?;

        let referenced_fault_trees = self.collect_referenced_fault_trees(&referenced_ets)?;
        let (mut pdag, ft_root_nodes) = build_combined_pdag(self.model, &referenced_fault_trees)?;

        let mut pseudo_probabilities: HashMap<String, f64> = HashMap::new();
        let mut fe_node_by_id: HashMap<String, usize> = HashMap::new();

        let ie_node = if let Some(ft_id) = &self.initiating_event.fault_tree_id {
            let idx = ft_root_nodes.get(ft_id).ok_or_else(|| {
                PraxisError::Logic(format!(
                    "Fault tree '{}' not included for initiating event '{}'",
                    ft_id, self.initiating_event.id
                ))
            })?;
            *idx
        } else {
            let p = self.initiating_event.probability.unwrap_or(1.0);
            let pseudo_id = format!("{PSEUDO_IE_PREFIX}{}", self.initiating_event.id);
            pdag.add_basic_event(pseudo_id.clone());
            pseudo_probabilities.insert(pseudo_id.clone(), p);
            pdag.get_index(&pseudo_id).ok_or_else(|| {
                PraxisError::Logic("Pseudo initiating event missing from PDAG".to_string())
            })? as usize
        };

        for et in referenced_ets.values() {
            for (fe_id, fe) in &et.functional_events {
                if fe_node_by_id.contains_key(fe_id) {
                    continue;
                }

                if let Some(ft_id) = &fe.fault_tree_id {
                    let idx = ft_root_nodes.get(ft_id).ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "Fault tree '{}' not included for functional event '{}'",
                            ft_id, fe_id
                        ))
                    })?;
                    fe_node_by_id.insert(fe_id.clone(), *idx);
                } else {
                    let p = fe.success_probability.unwrap_or(0.5);
                    let pseudo_id = format!("{PSEUDO_FE_PREFIX}{fe_id}");
                    pdag.add_basic_event(pseudo_id.clone());
                    pseudo_probabilities.insert(pseudo_id.clone(), p);
                    let idx = pdag.get_index(&pseudo_id).ok_or_else(|| {
                        PraxisError::Logic("Pseudo functional event missing from PDAG".to_string())
                    })?;
                    fe_node_by_id.insert(fe_id.clone(), idx as usize);
                }
            }
        }

        make_root_reach_everything(&mut pdag, &ft_root_nodes, ie_node, &fe_node_by_id)?;
        preprocess_for_mc(&mut pdag)?;

        Ok(CompiledEventTreePdagV1 {
            version: "et-mc-pdag-v1".to_string(),
            initiating_event_id: self.initiating_event.id.clone(),
            event_tree_id: self.initiating_event.event_tree_id.clone(),
            pdag,
            ft_root_nodes,
            pseudo_probabilities,
        })
    }

    pub fn run_cpu_with_watch_and_convergence_compiled(
        &self,
        compiled: &CompiledEventTreePdagV1,
        watch: bool,
        convergence: ConvergenceSettings,
    ) -> Result<EventTreeMonteCarloResult> {
        if compiled.version != "et-mc-pdag-v1" {
            return Err(PraxisError::Settings(format!(
                "Unsupported compiled PDAG version '{}'",
                compiled.version
            )));
        }
        if compiled.initiating_event_id != self.initiating_event.id {
            return Err(PraxisError::Settings(format!(
                "Compiled PDAG initiatingEventId '{}' does not match analysis initiatingEventId '{}'",
                compiled.initiating_event_id, self.initiating_event.id
            )));
        }

        let mut referenced_ets: HashMap<String, EventTree> = HashMap::new();
        self.collect_reachable_event_trees(&mut referenced_ets)?;

        let pdag = compiled.pdag.clone();
        let ft_root_nodes = &compiled.ft_root_nodes;
        let pseudo_probabilities = &compiled.pseudo_probabilities;

        let mut fe_node_by_id: HashMap<String, usize> = HashMap::new();
        let mut sequences_by_id: HashMap<String, Sequence> = HashMap::new();

        let ie_node = if let Some(ft_id) = &self.initiating_event.fault_tree_id {
            let idx = ft_root_nodes.get(ft_id).ok_or_else(|| {
                PraxisError::Logic(format!(
                    "Fault tree '{}' not included for initiating event '{}'",
                    ft_id, self.initiating_event.id
                ))
            })?;
            *idx
        } else {
            let pseudo_id = format!("{PSEUDO_IE_PREFIX}{}", self.initiating_event.id);
            pdag.get_index(&pseudo_id).ok_or_else(|| {
                PraxisError::Logic("Pseudo initiating event missing from compiled PDAG".to_string())
            })? as usize
        };

        for et in referenced_ets.values() {
            for (seq_id, seq) in &et.sequences {
                sequences_by_id
                    .entry(seq_id.clone())
                    .or_insert_with(|| seq.clone());
            }

            for (fe_id, fe) in &et.functional_events {
                if fe_node_by_id.contains_key(fe_id) {
                    continue;
                }

                if let Some(ft_id) = &fe.fault_tree_id {
                    let idx = ft_root_nodes.get(ft_id).ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "Fault tree '{}' not included for functional event '{}'",
                            ft_id, fe_id
                        ))
                    })?;
                    fe_node_by_id.insert(fe_id.clone(), *idx);
                } else {
                    let pseudo_id = format!("{PSEUDO_FE_PREFIX}{fe_id}");
                    let idx = pdag.get_index(&pseudo_id).ok_or_else(|| {
                        PraxisError::Logic("Pseudo functional event missing from compiled PDAG".to_string())
                    })?;
                    fe_node_by_id.insert(fe_id.clone(), idx as usize);
                }
            }
        }

        // NOTE: the compiled PDAG is expected to already include the synthetic root + preprocessing.
        // We intentionally do not rebuild or re-preprocess here.

        let plan = DpMcPlan::from_pdag(&pdag, self.run)?;
        let soa = GpuSoaPlan::from_plan(&plan)?;

        let (thresholds, full_ranges) =
            build_thresholds(&pdag, &soa, self.model, pseudo_probabilities)?;
        let key: Philox4x32Key = [self.seed as u32, (self.seed >> 32) as u32];

        let mut successes_by_seq: HashMap<String, u64> = HashMap::new();

        let report_seq_ids: Vec<String> = sequences_by_id
            .iter()
            .filter_map(|(seq_id, seq)| {
                if let Some(linked_et_id) = &seq.linked_event_tree_id {
                    if referenced_ets.contains_key(linked_et_id) {
                        return None;
                    }
                }
                Some(seq_id.clone())
            })
            .collect();

        let num_nodes = soa.layout.num_nodes as usize;
        let b_count = plan.params.b as u32;
        let p_count = plan.params.p as u32;

        let progress = if watch {
            let total_iters = plan.params.t as u64;
            let pb = ProgressBar::new(total_iters);
            pb.set_style(
                ProgressStyle::with_template("mc [{bar:40.cyan/blue}] {pos}/{len} it {msg}")
                    .unwrap()
                    .progress_chars("##-"),
            );
            pb.enable_steady_tick(std::time::Duration::from_millis(120));
            Some(pb)
        } else {
            None
        };

        let t0 = watch.then(Instant::now);

        let bits_per_iter = effective_bits_per_iteration(
            plan.params.b,
            plan.params.p,
            plan.params.omega,
            self.valid_lanes_last_word,
        )
        .unwrap_or(0);

        let z = crate::mc::stats::normal_quantile_two_sided(convergence.confidence)
            .unwrap_or(1.96);

        let mut iters_done: u64 = 0;

        for iter in 0..plan.params.t {
            let t_counter = (iter as u32) + 1u32;

            let total_words = (b_count as usize) * (p_count as usize) * num_nodes;
            let mut node_words: Vec<u64> = vec![0u64; total_words];

            for b in 0..b_count {
                for p in 0..p_count {
                    let base = ((b * p_count + p) as usize) * num_nodes;
                    let view = &mut node_words[base..base + num_nodes];

                    for (event_ord, &node) in soa.event_nodes.iter().enumerate() {
                        let node = node.unsigned_abs() as usize;
                        let thr = thresholds[event_ord];
                        let full = full_ranges[event_ord] != 0u32;
                        view[node] =
                            sample_event_word(event_ord as u32, p, b, t_counter, key, thr, full);
                    }
                }
            }

            for layer in &soa.layers {
                for &node in &layer.constants {
                    let node = node.abs();
                    let value = match pdag.get_node(node) {
                        Some(PdagNode::Constant { value, .. }) => *value,
                        other => {
                            return Err(PraxisError::Logic(format!(
                                "Expected constant node {node}, got {other:?}"
                            )))
                        }
                    };

                    for b in 0..b_count {
                        for p in 0..p_count {
                            let idx = soa.layout.index(b, p, node as u32);
                            node_words[idx] = if value { !0u64 } else { 0u64 };
                        }
                    }
                }
            }

            for layer in &soa.layers {
                for gates in layer.gate_groups.values() {
                    for &out_node in &gates.out_nodes {
                        let desc = plan.gates.get(&(out_node as i32)).ok_or_else(|| {
                            PraxisError::Logic(format!(
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
                    let view = &node_words[base..base + num_nodes];

                    let mut mask = view[ie_node];

                    if (b + 1 == b_count) && (p + 1 == p_count) {
                        mask &= valid_lane_mask(self.valid_lanes_last_word);
                    }

                    if mask == 0 {
                        continue;
                    }

                    let mut house_events: HashMap<String, bool> = HashMap::new();
                    traverse_branch_word(
                        &self.event_tree,
                        &self.event_tree.initial_state,
                        mask,
                        view,
                        &fe_node_by_id,
                        &sequences_by_id,
                        self.event_tree_library,
                        &mut house_events,
                        &mut successes_by_seq,
                    )?;
                }
            }

            iters_done = (iter as u64).saturating_add(1);
            let trials_done = iters_done.saturating_mul(bits_per_iter);

            let mut worst_eps_lin: Option<(f64, f64, f64)> = None;
            let mut worst_eps_log: Option<(f64, f64)> = None;
            let mut all_converged = convergence.enabled;
            let mut sum_successes: u64 = 0;

            if progress.is_some() || convergence.enabled {
                for seq_id in &report_seq_ids {
                    let successes = successes_by_seq.get(seq_id).copied().unwrap_or(0u64);
                    sum_successes = sum_successes.saturating_add(successes);
                    let p_hat = if trials_done == 0 {
                        0.0
                    } else {
                        (successes as f64) / (trials_done as f64)
                    };

                    let p = p_hat.clamp(0.0, 1.0);
                    let target_lin = convergence.delta * p.max(1.0e-12);
                    let eps_lin = crate::mc::stats::half_width_wald(p, trials_done, z)
                        .unwrap_or(f64::NAN);
                    let ratio_lin = if target_lin.is_finite() && target_lin > 0.0 {
                        eps_lin / target_lin
                    } else {
                        f64::NAN
                    };
                    if ratio_lin.is_finite()
                        && worst_eps_lin
                            .as_ref()
                            .map(|(r, _, _)| ratio_lin > *r)
                            .unwrap_or(true)
                    {
                        worst_eps_lin = Some((ratio_lin, eps_lin, target_lin));
                    }

                    let eps_log =
                        crate::mc::stats::half_width_log10_wald(p, trials_done, z, 1.0e-12)
                            .unwrap_or(f64::NAN);
                    let ratio_log = if convergence.delta.is_finite() && convergence.delta > 0.0 {
                        eps_log / convergence.delta
                    } else {
                        f64::NAN
                    };
                    if ratio_log.is_finite()
                        && worst_eps_log
                            .as_ref()
                            .map(|(r, _)| ratio_log > *r)
                            .unwrap_or(true)
                    {
                        worst_eps_log = Some((ratio_log, eps_log));
                    }

                    if convergence.enabled
                        && all_converged
                        && !crate::mc::stats::should_stop_convergence_wald_linear_and_log10(
                            p_hat,
                            trials_done,
                            convergence.delta,
                            convergence.confidence,
                            convergence.burn_in,
                        )
                    {
                        all_converged = false;
                    }
                }

                if convergence.enabled
                    && all_converged
                    && trials_done > 0
                    && trials_done >= convergence.burn_in
                {
                    let p_sum = (sum_successes as f64) / (trials_done as f64);
                    let mass_err = (1.0 - p_sum).abs();
                    if mass_err > convergence.delta {
                        all_converged = false;
                    }
                }
            }

            if let Some(pb) = progress.as_ref() {
                let thr = t0
                    .as_ref()
                    .map(|t| crate::mc::core::format_bits_per_sec(trials_done, t.elapsed()))
                    .unwrap_or_else(|| "0.00 Mbit/s".to_string());
                let ie_frequency = self.initiating_event.frequency.unwrap_or(1.0);

                let sum_freq = if trials_done > 0 {
                    ie_frequency * ((sum_successes as f64) / (trials_done as f64))
                } else {
                    f64::NAN
                };
                let sum_freq_s = if sum_freq.is_finite() {
                    format!("{:.6e}", sum_freq)
                } else {
                    "NA".to_string()
                };

                pb.set_message(format!(
                    "trials {}/{}  sum_freq={}  thr={}",
                    trials_done,
                    self.requested_trials,
                    sum_freq_s,
                    thr
                ));
                pb.inc(1);
            }

            if convergence.enabled && all_converged {
                break;
            }
        }

        if let Some(pb) = progress {
            pb.finish_and_clear();
        }

        let ie_frequency = self.initiating_event.frequency.unwrap_or(1.0);

        let actual_trials_u64 = iters_done.saturating_mul(bits_per_iter);
        let actual_trials = usize::try_from(actual_trials_u64).unwrap_or(usize::MAX);

        let mut results: Vec<SequenceMonteCarloResult> = Vec::new();
        for (seq_id, seq) in sequences_by_id {
            if let Some(linked_et_id) = &seq.linked_event_tree_id {
                if referenced_ets.contains_key(linked_et_id) {
                    continue;
                }
            }

            let successes = successes_by_seq.get(&seq_id).copied().unwrap_or(0u64);
            let p_hat = if actual_trials_u64 == 0 {
                0.0
            } else {
                (successes as f64) / (actual_trials_u64 as f64)
            };
            results.push(SequenceMonteCarloResult {
                sequence: seq,
                probability_estimate: p_hat,
                successes: usize::try_from(successes).unwrap_or(usize::MAX),
                num_trials: actual_trials,
                frequency_estimate: p_hat * ie_frequency,
            });
        }

        results.sort_by(|a, b| a.sequence.id.cmp(&b.sequence.id));

        Ok(EventTreeMonteCarloResult {
            num_trials: actual_trials,
            sequences: results,
        })
    }

    pub fn run_cpu(&self) -> Result<EventTreeMonteCarloResult> {
        self.run_cpu_with_watch_and_convergence(false, ConvergenceSettings::disabled())
    }

    pub fn run_cpu_with_watch(&self, watch: bool) -> Result<EventTreeMonteCarloResult> {
        self.run_cpu_with_watch_and_convergence(watch, ConvergenceSettings::disabled())
    }

    pub fn run_cpu_with_watch_and_convergence(
        &self,
        watch: bool,
        convergence: ConvergenceSettings,
    ) -> Result<EventTreeMonteCarloResult> {
        let mut referenced_ets: HashMap<String, EventTree> = HashMap::new();
        self.collect_reachable_event_trees(&mut referenced_ets)?;

        let referenced_fault_trees = self.collect_referenced_fault_trees(&referenced_ets)?;

        let (mut pdag, ft_root_nodes) = build_combined_pdag(self.model, &referenced_fault_trees)?;

        let mut pseudo_probabilities: HashMap<String, f64> = HashMap::new();
        let mut fe_node_by_id: HashMap<String, usize> = HashMap::new();
        let mut sequences_by_id: HashMap<String, Sequence> = HashMap::new();

        let ie_node = if let Some(ft_id) = &self.initiating_event.fault_tree_id {
            let idx = ft_root_nodes.get(ft_id).ok_or_else(|| {
                PraxisError::Logic(format!(
                    "Fault tree '{}' not included for initiating event '{}'",
                    ft_id, self.initiating_event.id
                ))
            })?;
            *idx
        } else {
            let p = self.initiating_event.probability.unwrap_or(1.0);
            let pseudo_id = format!("{PSEUDO_IE_PREFIX}{}", self.initiating_event.id);
            pdag.add_basic_event(pseudo_id.clone());
            pseudo_probabilities.insert(pseudo_id.clone(), p);
            pdag.get_index(&pseudo_id).ok_or_else(|| {
                PraxisError::Logic("Pseudo initiating event missing from PDAG".to_string())
            })? as usize
        };

        for et in referenced_ets.values() {
            for (seq_id, seq) in &et.sequences {
                sequences_by_id
                    .entry(seq_id.clone())
                    .or_insert_with(|| seq.clone());
            }

            for (fe_id, fe) in &et.functional_events {
                if fe_node_by_id.contains_key(fe_id) {
                    continue;
                }

                if let Some(ft_id) = &fe.fault_tree_id {
                    let idx = ft_root_nodes.get(ft_id).ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "Fault tree '{}' not included for functional event '{}'",
                            ft_id, fe_id
                        ))
                    })?;
                    fe_node_by_id.insert(fe_id.clone(), *idx);
                } else {
                    let p = fe.success_probability.unwrap_or(0.5);
                    let pseudo_id = format!("{PSEUDO_FE_PREFIX}{fe_id}");
                    pdag.add_basic_event(pseudo_id.clone());
                    pseudo_probabilities.insert(pseudo_id.clone(), p);
                    let idx = pdag.get_index(&pseudo_id).ok_or_else(|| {
                        PraxisError::Logic("Pseudo functional event missing from PDAG".to_string())
                    })?;
                    fe_node_by_id.insert(fe_id.clone(), idx as usize);
                }
            }
        }

        make_root_reach_everything(&mut pdag, &ft_root_nodes, ie_node, &fe_node_by_id)?;

        preprocess_for_mc(&mut pdag)?;

        let plan = DpMcPlan::from_pdag(&pdag, self.run)?;
        let soa = GpuSoaPlan::from_plan(&plan)?;

        let (thresholds, full_ranges) =
            build_thresholds(&pdag, &soa, self.model, &pseudo_probabilities)?;
        let key: Philox4x32Key = [self.seed as u32, (self.seed >> 32) as u32];

        let mut successes_by_seq: HashMap<String, u64> = HashMap::new();

        let report_seq_ids: Vec<String> = sequences_by_id
            .iter()
            .filter_map(|(seq_id, seq)| {
                if let Some(linked_et_id) = &seq.linked_event_tree_id {
                    if referenced_ets.contains_key(linked_et_id) {
                        return None;
                    }
                }
                Some(seq_id.clone())
            })
            .collect();

        let num_nodes = soa.layout.num_nodes as usize;
        let b_count = plan.params.b as u32;
        let p_count = plan.params.p as u32;

        let progress = if watch {
            let total_iters = plan.params.t as u64;
            let pb = ProgressBar::new(total_iters);
            pb.set_style(
                ProgressStyle::with_template("mc [{bar:40.cyan/blue}] {pos}/{len} it {msg}")
                    .unwrap()
                    .progress_chars("##-"),
            );
            pb.enable_steady_tick(std::time::Duration::from_millis(120));
            Some(pb)
        } else {
            None
        };

        let t0 = watch.then(Instant::now);

        let bits_per_iter = effective_bits_per_iteration(
            plan.params.b,
            plan.params.p,
            plan.params.omega,
            self.valid_lanes_last_word,
        )
        .unwrap_or(0);

        let z = crate::mc::stats::normal_quantile_two_sided(convergence.confidence)
            .unwrap_or(1.96);

        let mut iters_done: u64 = 0;

        for iter in 0..plan.params.t {
            let t_counter = (iter as u32) + 1u32;

            let total_words = (b_count as usize) * (p_count as usize) * num_nodes;
            let mut node_words: Vec<u64> = vec![0u64; total_words];

            for b in 0..b_count {
                for p in 0..p_count {
                    let base = ((b * p_count + p) as usize) * num_nodes;
                    let view = &mut node_words[base..base + num_nodes];

                    for (event_ord, &node) in soa.event_nodes.iter().enumerate() {
                        let node = node.unsigned_abs() as usize;
                        let thr = thresholds[event_ord];
                        let full = full_ranges[event_ord] != 0u32;
                        view[node] =
                            sample_event_word(event_ord as u32, p, b, t_counter, key, thr, full);
                    }
                }
            }

            for layer in &soa.layers {
                for &node in &layer.constants {
                    let node = node.abs();
                    let value = match pdag.get_node(node) {
                        Some(PdagNode::Constant { value, .. }) => *value,
                        other => {
                            return Err(PraxisError::Logic(format!(
                                "Expected constant node {node}, got {other:?}"
                            )))
                        }
                    };

                    for b in 0..b_count {
                        for p in 0..p_count {
                            let idx = soa.layout.index(b, p, node as u32);
                            node_words[idx] = if value { !0u64 } else { 0u64 };
                        }
                    }
                }
            }

            for layer in &soa.layers {
                for gates in layer.gate_groups.values() {
                    for &out_node in &gates.out_nodes {
                        let desc = plan.gates.get(&(out_node as i32)).ok_or_else(|| {
                            PraxisError::Logic(format!(
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
                    let view = &node_words[base..base + num_nodes];

                    let mut mask = view[ie_node];

                    if (b + 1 == b_count) && (p + 1 == p_count) {
                        mask &= valid_lane_mask(self.valid_lanes_last_word);
                    }

                    if mask == 0 {
                        continue;
                    }

                    let mut house_events: HashMap<String, bool> = HashMap::new();
                    traverse_branch_word(
                        &self.event_tree,
                        &self.event_tree.initial_state,
                        mask,
                        view,
                        &fe_node_by_id,
                        &sequences_by_id,
                        self.event_tree_library,
                        &mut house_events,
                        &mut successes_by_seq,
                    )?;
                }
            }

            iters_done = (iter as u64).saturating_add(1);
            let trials_done = iters_done.saturating_mul(bits_per_iter);

            let mut worst_eps_lin: Option<(f64, f64, f64)> = None;
            let mut worst_eps_log: Option<(f64, f64)> = None;
            let mut all_converged = convergence.enabled;
            let mut sum_successes: u64 = 0;

            if progress.is_some() || convergence.enabled {
                for seq_id in &report_seq_ids {
                    let successes = successes_by_seq.get(seq_id).copied().unwrap_or(0u64);
                    sum_successes = sum_successes.saturating_add(successes);
                    let p_hat = if trials_done == 0 {
                        0.0
                    } else {
                        (successes as f64) / (trials_done as f64)
                    };

                    let p = p_hat.clamp(0.0, 1.0);
                    let target_lin = convergence.delta * p.max(1.0e-12);
                    let eps_lin = crate::mc::stats::half_width_wald(p, trials_done, z)
                        .unwrap_or(f64::NAN);
                    let ratio_lin = if target_lin.is_finite() && target_lin > 0.0 {
                        eps_lin / target_lin
                    } else {
                        f64::NAN
                    };
                    if ratio_lin.is_finite()
                        && worst_eps_lin
                            .as_ref()
                            .map(|(r, _, _)| ratio_lin > *r)
                            .unwrap_or(true)
                    {
                        worst_eps_lin = Some((ratio_lin, eps_lin, target_lin));
                    }

                    let eps_log = crate::mc::stats::half_width_log10_wald(p, trials_done, z, 1.0e-12)
                        .unwrap_or(f64::NAN);
                    let ratio_log = if convergence.delta.is_finite() && convergence.delta > 0.0 {
                        eps_log / convergence.delta
                    } else {
                        f64::NAN
                    };
                    if ratio_log.is_finite()
                        && worst_eps_log
                            .as_ref()
                            .map(|(r, _)| ratio_log > *r)
                            .unwrap_or(true)
                    {
                        worst_eps_log = Some((ratio_log, eps_log));
                    }

                    if convergence.enabled
                        && all_converged
                        && !crate::mc::stats::should_stop_convergence_wald_linear_and_log10(
                            p_hat,
                            trials_done,
                            convergence.delta,
                            convergence.confidence,
                            convergence.burn_in,
                        )
                    {
                        all_converged = false;
                    }
                }

                if convergence.enabled
                    && all_converged
                    && trials_done > 0
                    && trials_done >= convergence.burn_in
                {
                    let p_sum = (sum_successes as f64) / (trials_done as f64);
                    let mass_err = (1.0 - p_sum).abs();
                    if mass_err > convergence.delta {
                        all_converged = false;
                    }
                }
            }

            if let Some(pb) = progress.as_ref() {
                let thr = t0
                    .as_ref()
                    .map(|t| crate::mc::core::format_bits_per_sec(trials_done, t.elapsed()))
                    .unwrap_or_else(|| "0.00 Mbit/s".to_string());
                let ie_frequency = self.initiating_event.frequency.unwrap_or(1.0);

                let sum_freq = if trials_done > 0 {
                    ie_frequency * ((sum_successes as f64) / (trials_done as f64))
                } else {
                    f64::NAN
                };
                let sum_freq_s = if sum_freq.is_finite() {
                    format!("{:.6e}", sum_freq)
                } else {
                    "NA".to_string()
                };

                pb.set_message(format!(
                    "trials {}/{}  sum_freq={}  thr={}",
                    trials_done,
                    self.requested_trials,
                    sum_freq_s,
                    thr
                ));
                pb.inc(1);
            }

            if convergence.enabled && all_converged {
                break;
            }
        }

        if let Some(pb) = progress {
            pb.finish_and_clear();
        }

        let ie_frequency = self.initiating_event.frequency.unwrap_or(1.0);

        let actual_trials_u64 = iters_done.saturating_mul(bits_per_iter);
        let actual_trials = usize::try_from(actual_trials_u64).unwrap_or(usize::MAX);

        let mut results: Vec<SequenceMonteCarloResult> = Vec::new();
        for (seq_id, seq) in sequences_by_id {
            if let Some(linked_et_id) = &seq.linked_event_tree_id {
                if referenced_ets.contains_key(linked_et_id) {
                    continue;
                }
            }

            let successes = successes_by_seq.get(&seq_id).copied().unwrap_or(0u64);
            let p_hat = if actual_trials_u64 == 0 {
                0.0
            } else {
                (successes as f64) / (actual_trials_u64 as f64)
            };
            results.push(SequenceMonteCarloResult {
                sequence: seq,
                probability_estimate: p_hat,
                successes: usize::try_from(successes).unwrap_or(usize::MAX),
                num_trials: actual_trials,
                frequency_estimate: p_hat * ie_frequency,
            });
        }

        results.sort_by(|a, b| a.sequence.id.cmp(&b.sequence.id));

        Ok(EventTreeMonteCarloResult {
            num_trials: actual_trials,
            sequences: results,
        })
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu<R: cubecl::Runtime>(
        &self,
        device: &R::Device,
    ) -> Result<EventTreeMonteCarloResult> {
        self.run_gpu_with_watch_and_convergence::<R>(
            device,
            false,
            ConvergenceSettings::disabled(),
        )
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu_with_watch<R: cubecl::Runtime>(
        &self,
        device: &R::Device,
        watch: bool,
    ) -> Result<EventTreeMonteCarloResult> {
        self.run_gpu_with_watch_and_convergence::<R>(
            device,
            watch,
            ConvergenceSettings::disabled(),
        )
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu_with_watch_and_convergence_compiled<R: cubecl::Runtime>(
        &self,
        device: &R::Device,
        compiled: &CompiledEventTreePdagV1,
        watch: bool,
        convergence: ConvergenceSettings,
    ) -> Result<EventTreeMonteCarloResult> {
        if compiled.version != "et-mc-pdag-v1" {
            return Err(PraxisError::Settings(format!(
                "Unsupported compiled PDAG version '{}'",
                compiled.version
            )));
        }
        if compiled.initiating_event_id != self.initiating_event.id {
            return Err(PraxisError::Settings(format!(
                "Compiled PDAG initiatingEventId '{}' does not match analysis initiatingEventId '{}'",
                compiled.initiating_event_id, self.initiating_event.id
            )));
        }

        let mut referenced_ets: HashMap<String, EventTree> = HashMap::new();
        self.collect_reachable_event_trees(&mut referenced_ets)?;

        let pdag = compiled.pdag.clone();
        let ft_root_nodes = &compiled.ft_root_nodes;
        let pseudo_probabilities = &compiled.pseudo_probabilities;

        let mut fe_node_by_id: HashMap<String, usize> = HashMap::new();
        let mut sequences_by_id: HashMap<String, Sequence> = HashMap::new();

        let ie_node = if let Some(ft_id) = &self.initiating_event.fault_tree_id {
            let idx = ft_root_nodes.get(ft_id).ok_or_else(|| {
                PraxisError::Logic(format!(
                    "Fault tree '{}' not included for initiating event '{}'",
                    ft_id, self.initiating_event.id
                ))
            })?;
            *idx
        } else {
            let pseudo_id = format!("{PSEUDO_IE_PREFIX}{}", self.initiating_event.id);
            pdag.get_index(&pseudo_id).ok_or_else(|| {
                PraxisError::Logic("Pseudo initiating event missing from compiled PDAG".to_string())
            })? as usize
        };

        for et in referenced_ets.values() {
            for (seq_id, seq) in &et.sequences {
                sequences_by_id
                    .entry(seq_id.clone())
                    .or_insert_with(|| seq.clone());
            }

            for (fe_id, fe) in &et.functional_events {
                if fe_node_by_id.contains_key(fe_id) {
                    continue;
                }

                if let Some(ft_id) = &fe.fault_tree_id {
                    let idx = ft_root_nodes.get(ft_id).ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "Fault tree '{}' not included for functional event '{}'",
                            ft_id, fe_id
                        ))
                    })?;
                    fe_node_by_id.insert(fe_id.clone(), *idx);
                } else {
                    let pseudo_id = format!("{PSEUDO_FE_PREFIX}{fe_id}");
                    let idx = pdag.get_index(&pseudo_id).ok_or_else(|| {
                        PraxisError::Logic(
                            "Pseudo functional event missing from compiled PDAG".to_string(),
                        )
                    })?;
                    fe_node_by_id.insert(fe_id.clone(), idx as usize);
                }
            }
        }

        let plan = DpMcPlan::from_pdag(&pdag, self.run)?;
        let soa = GpuSoaPlan::from_plan(&plan)?;

        let (thresholds, full_ranges) =
            build_thresholds(&pdag, &soa, self.model, pseudo_probabilities)?;
        let key: Philox4x32Key = [self.seed as u32, (self.seed >> 32) as u32];

        let mut terminal_seq_ids: Vec<String> = sequences_by_id
            .iter()
            .filter_map(|(seq_id, seq)| {
                if let Some(linked_et_id) = &seq.linked_event_tree_id {
                    if referenced_ets.contains_key(linked_et_id) {
                        return None;
                    }
                }
                Some(seq_id.clone())
            })
            .collect();
        terminal_seq_ids.sort();

        let mut seq_ix_by_id: HashMap<String, u32> = HashMap::new();
        for (ix, id) in terminal_seq_ids.iter().enumerate() {
            seq_ix_by_id.insert(id.clone(), ix as u32);
        }

        let et_plan = compile_event_tree_gpu_plan(
            &self.event_tree,
            &self.event_tree.initial_state,
            &referenced_ets,
            self.event_tree_library,
            &fe_node_by_id,
            &sequences_by_id,
            &seq_ix_by_id,
        )?;

        let client = R::client(device);

        let progress = if watch {
            let total_iters = plan.params.t as u64;
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

        let bits_per_iter = crate::mc::tally::effective_bits_per_iteration(
            plan.params.b,
            plan.params.p,
            plan.params.omega,
            self.valid_lanes_last_word,
        )?;

        let z = crate::mc::stats::normal_quantile_two_sided(convergence.confidence)
            .unwrap_or(1.96);

        let iters_total_u32 = plan.params.t as u32;
        let iters_per_chunk = (iters_total_u32 / 100).max(1);
        let mut seq_tallies: Option<Vec<u64>> = None;
        let mut iters_done: u64 = 0;
        let mut gpu_context = EtGpuContext::<R>::new(
            &client,
            &pdag,
            &plan,
            &soa,
            &thresholds,
            &full_ranges,
            ie_node as u32,
            terminal_seq_ids.len() as u32,
            &et_plan.seq_path_start,
            &et_plan.seq_path_len,
            &et_plan.path_cond_start,
            &et_plan.path_cond_len,
            &et_plan.cond_fe_node,
            &et_plan.cond_route,
            None,
            self.valid_lanes_last_word,
        );

        while (iters_done as u32) < iters_total_u32 {
            let done_u32 = iters_done as u32;
            let chunk = if progress.is_some() || convergence.enabled {
                (iters_total_u32 - done_u32).min(iters_per_chunk)
            } else {
                iters_total_u32 - done_u32
            };
            let t_counter = 1u32 + done_u32;

            gpu_context.execute_chunk(chunk, t_counter, key);
            let next = gpu_context.read_tallies();
            seq_tallies = Some(next);

            iters_done = iters_done.saturating_add(chunk as u64);
            let trials_done = bits_per_iter.saturating_mul(iters_done);

            let tallies = seq_tallies.as_deref().unwrap_or(&[]);
            let mut worst_eps_lin: Option<(f64, f64, f64)> = None;
            let mut worst_eps_log: Option<(f64, f64)> = None;
            let mut all_converged = convergence.enabled;
            let mut sum_successes: u64 = 0;

            if progress.is_some() || convergence.enabled {
                for ix in 0..terminal_seq_ids.len() {
                    let successes = tallies.get(ix).copied().unwrap_or(0u64);
                    sum_successes = sum_successes.saturating_add(successes);
                    let p_hat = if trials_done == 0 {
                        0.0
                    } else {
                        (successes as f64) / (trials_done as f64)
                    };

                    let p = p_hat.clamp(0.0, 1.0);
                    let target_lin = convergence.delta * p.max(1.0e-12);
                    let eps_lin = crate::mc::stats::half_width_wald(p, trials_done, z)
                        .unwrap_or(f64::NAN);
                    let ratio_lin = if target_lin.is_finite() && target_lin > 0.0 {
                        eps_lin / target_lin
                    } else {
                        f64::NAN
                    };
                    if ratio_lin.is_finite() {
                        if worst_eps_lin
                            .as_ref()
                            .map(|(r, _, _)| ratio_lin > *r)
                            .unwrap_or(true)
                        {
                            worst_eps_lin = Some((ratio_lin, eps_lin, target_lin));
                        }
                    }

                    let eps_log = crate::mc::stats::half_width_log10_wald(
                        p,
                        trials_done,
                        z,
                        1.0e-12,
                    )
                    .unwrap_or(f64::NAN);
                    let ratio_log = if convergence.delta.is_finite() && convergence.delta > 0.0 {
                        eps_log / convergence.delta
                    } else {
                        f64::NAN
                    };
                    if ratio_log.is_finite() {
                        if worst_eps_log
                            .as_ref()
                            .map(|(r, _)| ratio_log > *r)
                            .unwrap_or(true)
                        {
                            worst_eps_log = Some((ratio_log, eps_log));
                        }
                    }

                    if convergence.enabled
                        && all_converged
                        && !crate::mc::stats::should_stop_convergence_wald_linear_and_log10(
                            p_hat,
                            trials_done,
                            convergence.delta,
                            convergence.confidence,
                            convergence.burn_in,
                        )
                    {
                        all_converged = false;
                    }
                }

                if convergence.enabled
                    && all_converged
                    && trials_done > 0
                    && trials_done >= convergence.burn_in
                {
                    let p_sum = (sum_successes as f64) / (trials_done as f64);
                    let mass_err = (1.0 - p_sum).abs();
                    if mass_err > convergence.delta {
                        all_converged = false;
                    }
                }
            }

            if let Some(pb) = progress.as_ref() {
                let bits_done = trials_done;
                let thr = t0
                    .as_ref()
                    .map(|t| crate::mc::core::format_bits_per_sec(bits_done, t.elapsed()))
                    .unwrap_or_else(|| "0.00 Mbit/s".to_string());
                let ie_frequency = self.initiating_event.frequency.unwrap_or(1.0);

                let sum_freq = if trials_done > 0 {
                    ie_frequency * ((sum_successes as f64) / (trials_done as f64))
                } else {
                    f64::NAN
                };
                let sum_freq_s = if sum_freq.is_finite() {
                    format!("{:.6e}", sum_freq)
                } else {
                    "NA".to_string()
                };

                pb.set_message(format!(
                    "trials {}/{}  sum_freq={}  thr={}",
                    bits_done,
                    self.requested_trials,
                    sum_freq_s,
                    thr
                ));
                pb.set_position(iters_done);
            }

            if convergence.enabled && all_converged {
                break;
            }
        }

        if let Some(pb) = progress {
            pb.finish_and_clear();
        }

        let seq_tallies = seq_tallies.unwrap_or_else(|| vec![0u64; terminal_seq_ids.len()]);

        let actual_trials_u64 = bits_per_iter.saturating_mul(iters_done);
        let actual_trials = usize::try_from(actual_trials_u64).unwrap_or(usize::MAX);

        let ie_frequency = self.initiating_event.frequency.unwrap_or(1.0);
        let mut results: Vec<SequenceMonteCarloResult> =
            Vec::with_capacity(terminal_seq_ids.len());
        for (ix, seq_id) in terminal_seq_ids.iter().enumerate() {
            let seq = sequences_by_id.get(seq_id).ok_or_else(|| {
                PraxisError::Logic(format!("Sequence '{}' missing from collected set", seq_id))
            })?;
            let successes = seq_tallies[ix];
            let p_hat = if actual_trials_u64 == 0 {
                0.0
            } else {
                (successes as f64) / (actual_trials_u64 as f64)
            };
            results.push(SequenceMonteCarloResult {
                sequence: seq.clone(),
                probability_estimate: p_hat,
                successes: usize::try_from(successes).unwrap_or(usize::MAX),
                num_trials: actual_trials,
                frequency_estimate: p_hat * ie_frequency,
            });
        }

        Ok(EventTreeMonteCarloResult {
            num_trials: actual_trials,
            sequences: results,
        })
    }

    #[cfg(feature = "gpu")]
    pub fn run_gpu_with_watch_and_convergence<R: cubecl::Runtime>(
        &self,
        device: &R::Device,
        watch: bool,
        convergence: ConvergenceSettings,
    ) -> Result<EventTreeMonteCarloResult> {
        let mut referenced_ets: HashMap<String, EventTree> = HashMap::new();
        self.collect_reachable_event_trees(&mut referenced_ets)?;

        let referenced_fault_trees = self.collect_referenced_fault_trees(&referenced_ets)?;
        let (mut pdag, ft_root_nodes) = build_combined_pdag(self.model, &referenced_fault_trees)?;

        let mut pseudo_probabilities: HashMap<String, f64> = HashMap::new();
        let mut fe_node_by_id: HashMap<String, usize> = HashMap::new();
        let mut sequences_by_id: HashMap<String, Sequence> = HashMap::new();

        let ie_node = if let Some(ft_id) = &self.initiating_event.fault_tree_id {
            let idx = ft_root_nodes.get(ft_id).ok_or_else(|| {
                PraxisError::Logic(format!(
                    "Fault tree '{}' not included for initiating event '{}'",
                    ft_id, self.initiating_event.id
                ))
            })?;
            *idx
        } else {
            let p = self.initiating_event.probability.unwrap_or(1.0);
            let pseudo_id = format!("{PSEUDO_IE_PREFIX}{}", self.initiating_event.id);
            pdag.add_basic_event(pseudo_id.clone());
            pseudo_probabilities.insert(pseudo_id.clone(), p);
            pdag.get_index(&pseudo_id).ok_or_else(|| {
                PraxisError::Logic("Pseudo initiating event missing from PDAG".to_string())
            })? as usize
        };

        for et in referenced_ets.values() {
            for (seq_id, seq) in &et.sequences {
                sequences_by_id
                    .entry(seq_id.clone())
                    .or_insert_with(|| seq.clone());
            }

            for (fe_id, fe) in &et.functional_events {
                if fe_node_by_id.contains_key(fe_id) {
                    continue;
                }

                if let Some(ft_id) = &fe.fault_tree_id {
                    let idx = ft_root_nodes.get(ft_id).ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "Fault tree '{}' not included for functional event '{}'",
                            ft_id, fe_id
                        ))
                    })?;
                    fe_node_by_id.insert(fe_id.clone(), *idx);
                } else {
                    let p = fe.success_probability.unwrap_or(0.5);
                    let pseudo_id = format!("{PSEUDO_FE_PREFIX}{fe_id}");
                    pdag.add_basic_event(pseudo_id.clone());
                    pseudo_probabilities.insert(pseudo_id.clone(), p);
                    let idx = pdag.get_index(&pseudo_id).ok_or_else(|| {
                        PraxisError::Logic("Pseudo functional event missing from PDAG".to_string())
                    })?;
                    fe_node_by_id.insert(fe_id.clone(), idx as usize);
                }
            }
        }

        make_root_reach_everything(&mut pdag, &ft_root_nodes, ie_node, &fe_node_by_id)?;
        preprocess_for_mc(&mut pdag)?;

        let plan = DpMcPlan::from_pdag(&pdag, self.run)?;
        let soa = GpuSoaPlan::from_plan(&plan)?;

        let (thresholds, full_ranges) =
            build_thresholds(&pdag, &soa, self.model, &pseudo_probabilities)?;
        let key: Philox4x32Key = [self.seed as u32, (self.seed >> 32) as u32];

        let mut terminal_seq_ids: Vec<String> = sequences_by_id
            .iter()
            .filter_map(|(seq_id, seq)| {
                if let Some(linked_et_id) = &seq.linked_event_tree_id {
                    if referenced_ets.contains_key(linked_et_id) {
                        return None;
                    }
                }
                Some(seq_id.clone())
            })
            .collect();
        terminal_seq_ids.sort();

        let mut seq_ix_by_id: HashMap<String, u32> = HashMap::new();
        for (ix, id) in terminal_seq_ids.iter().enumerate() {
            seq_ix_by_id.insert(id.clone(), ix as u32);
        }

        let et_plan = compile_event_tree_gpu_plan(
            &self.event_tree,
            &self.event_tree.initial_state,
            &referenced_ets,
            self.event_tree_library,
            &fe_node_by_id,
            &sequences_by_id,
            &seq_ix_by_id,
        )?;

        let client = R::client(device);

        let progress = if watch {
            let total_iters = plan.params.t as u64;
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

        let bits_per_iter = crate::mc::tally::effective_bits_per_iteration(
            plan.params.b,
            plan.params.p,
            plan.params.omega,
            self.valid_lanes_last_word,
        )?;

        let z = crate::mc::stats::normal_quantile_two_sided(convergence.confidence)
            .unwrap_or(1.96);

        let iters_total_u32 = plan.params.t as u32;
        let iters_per_chunk = (iters_total_u32 / 100).max(1);
        let mut seq_tallies: Option<Vec<u64>> = None;
        let mut iters_done: u64 = 0;
        let mut gpu_context = EtGpuContext::<R>::new(
            &client,
            &pdag,
            &plan,
            &soa,
            &thresholds,
            &full_ranges,
            ie_node as u32,
            terminal_seq_ids.len() as u32,
            &et_plan.seq_path_start,
            &et_plan.seq_path_len,
            &et_plan.path_cond_start,
            &et_plan.path_cond_len,
            &et_plan.cond_fe_node,
            &et_plan.cond_route,
            None,
            self.valid_lanes_last_word,
        );

        while (iters_done as u32) < iters_total_u32 {
            let done_u32 = iters_done as u32;
            let chunk = if progress.is_some() || convergence.enabled {
                (iters_total_u32 - done_u32).min(iters_per_chunk)
            } else {
                iters_total_u32 - done_u32
            };
            let t_counter = 1u32 + done_u32;

            gpu_context.execute_chunk(chunk, t_counter, key);
            let next = gpu_context.read_tallies();
            seq_tallies = Some(next);

            iters_done = iters_done.saturating_add(chunk as u64);
            let trials_done = bits_per_iter.saturating_mul(iters_done);

            let tallies = seq_tallies.as_deref().unwrap_or(&[]);
            let mut worst_eps_lin: Option<(f64, f64, f64)> = None;
            let mut worst_eps_log: Option<(f64, f64)> = None;
            let mut all_converged = convergence.enabled;
            let mut sum_successes: u64 = 0;

            if progress.is_some() || convergence.enabled {
                for ix in 0..terminal_seq_ids.len() {
                    let successes = tallies.get(ix).copied().unwrap_or(0u64);
                    sum_successes = sum_successes.saturating_add(successes);
                    let p_hat = if trials_done == 0 {
                        0.0
                    } else {
                        (successes as f64) / (trials_done as f64)
                    };

                    let p = p_hat.clamp(0.0, 1.0);
                    let target_lin = convergence.delta * p.max(1.0e-12);
                    let eps_lin = crate::mc::stats::half_width_wald(p, trials_done, z)
                        .unwrap_or(f64::NAN);
                    let ratio_lin = if target_lin.is_finite() && target_lin > 0.0 {
                        eps_lin / target_lin
                    } else {
                        f64::NAN
                    };
                    if ratio_lin.is_finite() {
                        if worst_eps_lin
                            .as_ref()
                            .map(|(r, _, _)| ratio_lin > *r)
                            .unwrap_or(true)
                        {
                            worst_eps_lin = Some((ratio_lin, eps_lin, target_lin));
                        }
                    }

                    let eps_log = crate::mc::stats::half_width_log10_wald(p, trials_done, z, 1.0e-12)
                        .unwrap_or(f64::NAN);
                    let ratio_log = if convergence.delta.is_finite() && convergence.delta > 0.0 {
                        eps_log / convergence.delta
                    } else {
                        f64::NAN
                    };
                    if ratio_log.is_finite() {
                        if worst_eps_log
                            .as_ref()
                            .map(|(r, _)| ratio_log > *r)
                            .unwrap_or(true)
                        {
                            worst_eps_log = Some((ratio_log, eps_log));
                        }
                    }

                    if convergence.enabled
                        && all_converged
                        && !crate::mc::stats::should_stop_convergence_wald_linear_and_log10(
                            p_hat,
                            trials_done,
                            convergence.delta,
                            convergence.confidence,
                            convergence.burn_in,
                        )
                    {
                        all_converged = false;
                    }
                }

                if convergence.enabled
                    && all_converged
                    && trials_done > 0
                    && trials_done >= convergence.burn_in
                {
                    let p_sum = (sum_successes as f64) / (trials_done as f64);
                    let mass_err = (1.0 - p_sum).abs();
                    if mass_err > convergence.delta {
                        all_converged = false;
                    }
                }
            }

            if let Some(pb) = progress.as_ref() {
                let bits_done = trials_done;
                let thr = t0
                    .as_ref()
                    .map(|t| crate::mc::core::format_bits_per_sec(bits_done, t.elapsed()))
                    .unwrap_or_else(|| "0.00 Mbit/s".to_string());
                let ie_frequency = self.initiating_event.frequency.unwrap_or(1.0);

                let sum_freq = if trials_done > 0 {
                    ie_frequency * ((sum_successes as f64) / (trials_done as f64))
                } else {
                    f64::NAN
                };
                let sum_freq_s = if sum_freq.is_finite() {
                    format!("{:.6e}", sum_freq)
                } else {
                    "NA".to_string()
                };

                pb.set_message(format!(
                    "trials {}/{}  sum_freq={}  thr={}",
                    bits_done,
                    self.requested_trials,
                    sum_freq_s,
                    thr
                ));
                pb.set_position(iters_done);
            }

            if convergence.enabled && all_converged {
                break;
            }
        }

        if let Some(pb) = progress {
            pb.finish_and_clear();
        }

        let seq_tallies = seq_tallies.unwrap_or_else(|| vec![0u64; terminal_seq_ids.len()]);

        let actual_trials_u64 = bits_per_iter.saturating_mul(iters_done);
        let actual_trials = usize::try_from(actual_trials_u64).unwrap_or(usize::MAX);

        let ie_frequency = self.initiating_event.frequency.unwrap_or(1.0);
        let mut results: Vec<SequenceMonteCarloResult> = Vec::with_capacity(terminal_seq_ids.len());
        for (ix, seq_id) in terminal_seq_ids.iter().enumerate() {
            let seq = sequences_by_id.get(seq_id).ok_or_else(|| {
                PraxisError::Logic(format!("Sequence '{}' missing from collected set", seq_id))
            })?;
            let successes = seq_tallies[ix];
            let p_hat = if actual_trials_u64 == 0 {
                0.0
            } else {
                (successes as f64) / (actual_trials_u64 as f64)
            };
            results.push(SequenceMonteCarloResult {
                sequence: seq.clone(),
                probability_estimate: p_hat,
                successes: usize::try_from(successes).unwrap_or(usize::MAX),
                num_trials: actual_trials,
                frequency_estimate: p_hat * ie_frequency,
            });
        }

        Ok(EventTreeMonteCarloResult {
            num_trials: actual_trials,
            sequences: results,
        })
    }

    fn collect_reachable_event_trees(&self, out: &mut HashMap<String, EventTree>) -> Result<()> {
        let mut stack: Vec<EventTree> = vec![self.event_tree.clone()];
        let mut visited: HashSet<String> = HashSet::new();

        while let Some(et) = stack.pop() {
            if !visited.insert(et.id.clone()) {
                continue;
            }

            let et_id = et.id.clone();
            out.insert(et_id.clone(), et.clone());

            for seq in et.sequences.values() {
                if let Some(linked) = &seq.linked_event_tree_id {
                    if linked == &et.id {
                        continue;
                    }
                    if visited.contains(linked) {
                        continue;
                    }
                    if let Some(lib) = self.event_tree_library {
                        if let Some(next) = lib.get(linked) {
                            stack.push(next.clone());
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn collect_referenced_fault_trees(
        &self,
        referenced_ets: &HashMap<String, EventTree>,
    ) -> Result<HashSet<String>> {
        let mut out: HashSet<String> = HashSet::new();

        if let Some(ft_id) = &self.initiating_event.fault_tree_id {
            out.insert(ft_id.clone());
        }

        for et in referenced_ets.values() {
            for fe in et.functional_events.values() {
                if let Some(ft_id) = &fe.fault_tree_id {
                    out.insert(ft_id.clone());
                }
            }
        }

        Ok(out)
    }
}

#[cfg(feature = "gpu")]
#[derive(Debug, Clone)]
struct EtGpuPlan {
    seq_path_start: Vec<u32>,
    seq_path_len: Vec<u32>,

    path_cond_start: Vec<u32>,
    path_cond_len: Vec<u32>,

    cond_fe_node: Vec<u32>,
    cond_route: Vec<u32>,
}

#[cfg(feature = "gpu")]
fn compile_event_tree_gpu_plan(
    event_tree: &EventTree,
    root: &Branch,
    referenced_ets: &HashMap<String, EventTree>,
    event_tree_library: Option<&HashMap<String, EventTree>>,
    fe_node_by_id: &HashMap<String, usize>,
    sequences_by_id: &HashMap<String, Sequence>,
    terminal_seq_ix_by_id: &HashMap<String, u32>,
) -> Result<EtGpuPlan> {
    const ROUTE_FE_TRUE: u32 = 0;
    const ROUTE_FE_FALSE: u32 = 1;

    #[derive(Debug, Clone, Copy)]
    struct Cond {
        fe_node: u32,
        route: u32,
    }

    #[allow(clippy::too_many_arguments)]
    fn walk_branch(
        et: &EventTree,
        branch: &Branch,
        referenced_ets: &HashMap<String, EventTree>,
        lib: Option<&HashMap<String, EventTree>>,
        fe_node_by_id: &HashMap<String, usize>,
        sequences_by_id: &HashMap<String, Sequence>,
        terminal_seq_ix_by_id: &HashMap<String, u32>,
        house_events: &HashMap<String, bool>,
        conds: &mut Vec<Cond>,
        seq_paths: &mut [Vec<Vec<Cond>>],
    ) -> Result<()> {
        let mut scoped_house = house_events.clone();
        for (id, state) in &branch.house_event_assignments {
            scoped_house.insert(id.clone(), *state);
        }

        match &branch.target {
            BranchTarget::Sequence(seq_id) => {
                let seq = sequences_by_id.get(seq_id).ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "Sequence '{}' not found in event tree '{}'",
                        seq_id, et.id
                    ))
                })?;

                if let Some(linked_et_id) = &seq.linked_event_tree_id {
                    if linked_et_id == &et.id {
                        return walk_branch(
                            et,
                            &et.initial_state,
                            referenced_ets,
                            lib,
                            fe_node_by_id,
                            sequences_by_id,
                            terminal_seq_ix_by_id,
                            &scoped_house,
                            conds,
                            seq_paths,
                        );
                    }

                    if referenced_ets.contains_key(linked_et_id) {
                        if let Some(lib_map) = lib {
                            if let Some(linked_et) = lib_map.get(linked_et_id) {
                                return walk_branch(
                                    linked_et,
                                    &linked_et.initial_state,
                                    referenced_ets,
                                    Some(lib_map),
                                    fe_node_by_id,
                                    sequences_by_id,
                                    terminal_seq_ix_by_id,
                                    &scoped_house,
                                    conds,
                                    seq_paths,
                                );
                            }
                        }
                    }
                }

                let seq_ix = *terminal_seq_ix_by_id.get(seq_id).ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "Terminal sequence '{}' not found in terminal set",
                        seq_id
                    ))
                })?;

                let slot = seq_ix as usize;
                if slot >= seq_paths.len() {
                    return Err(PraxisError::Logic(
                        "Terminal sequence index out of bounds".to_string(),
                    ));
                }
                seq_paths[slot].push(conds.clone());
                Ok(())
            }
            BranchTarget::Fork(fork) => {
                if let Some(fixed) = scoped_house.get(&fork.functional_event_id).copied() {
                    let fixed_state = if fixed { "true" } else { "false" };
                    for fork_path in &fork.paths {
                        if fork_path.state == fixed_state {
                            return walk_branch(
                                et,
                                &fork_path.branch,
                                referenced_ets,
                                lib,
                                fe_node_by_id,
                                sequences_by_id,
                                terminal_seq_ix_by_id,
                                &scoped_house,
                                conds,
                                seq_paths,
                            );
                        }
                    }

                    return Err(PraxisError::Logic(format!(
                        "No path for fixed house-event state '{}' in fork for functional event '{}'",
                        fixed_state, fork.functional_event_id
                    )));
                }

                if fork.paths.iter().any(|p| p.probability.is_some()) {
                    return Err(PraxisError::Settings(
                        "Event-tree Monte Carlo does not support explicit path probabilities yet"
                            .to_string(),
                    ));
                }

                let fe_node = *fe_node_by_id
                    .get(&fork.functional_event_id)
                    .ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "Functional event '{}' has no MC node mapping",
                            fork.functional_event_id
                        ))
                    })? as u32;

                let has_collect_formula = fork
                    .paths
                    .iter()
                    .any(|p| p.collect_formula_negated.is_some());

                for fork_path in &fork.paths {
                    let route = if let Some(negated) = fork_path.collect_formula_negated {
                        Some(if negated {
                            ROUTE_FE_FALSE
                        } else {
                            ROUTE_FE_TRUE
                        })
                    } else if has_collect_formula && is_bypass_state(&fork_path.state) {
                        None
                    } else if is_success_state(&fork_path.state) {
                        Some(ROUTE_FE_TRUE)
                    } else {
                        Some(ROUTE_FE_FALSE)
                    };

                    if let Some(route) = route {
                        conds.push(Cond { fe_node, route });
                        walk_branch(
                            et,
                            &fork_path.branch,
                            referenced_ets,
                            lib,
                            fe_node_by_id,
                            sequences_by_id,
                            terminal_seq_ix_by_id,
                            &scoped_house,
                            conds,
                            seq_paths,
                        )?;
                        conds.pop();
                    } else {
                        walk_branch(
                            et,
                            &fork_path.branch,
                            referenced_ets,
                            lib,
                            fe_node_by_id,
                            sequences_by_id,
                            terminal_seq_ix_by_id,
                            &scoped_house,
                            conds,
                            seq_paths,
                        )?;
                    }
                }
                Ok(())
            }
            BranchTarget::NamedBranch(branch_id) => {
                if let Some(named_branch) = et.named_branches.get(branch_id) {
                    walk_branch(
                        et,
                        &named_branch.branch,
                        referenced_ets,
                        lib,
                        fe_node_by_id,
                        sequences_by_id,
                        terminal_seq_ix_by_id,
                        &scoped_house,
                        conds,
                        seq_paths,
                    )
                } else {
                    Ok(())
                }
            }
        }
    }

    let seq_count = terminal_seq_ix_by_id.len();
    let mut seq_paths: Vec<Vec<Vec<Cond>>> = vec![Vec::new(); seq_count];
    let mut conds: Vec<Cond> = Vec::new();

    walk_branch(
        event_tree,
        root,
        referenced_ets,
        event_tree_library,
        fe_node_by_id,
        sequences_by_id,
        terminal_seq_ix_by_id,
        &HashMap::new(),
        &mut conds,
        &mut seq_paths,
    )?;

    let mut seq_path_start: Vec<u32> = vec![0u32; seq_count];
    let mut seq_path_len: Vec<u32> = vec![0u32; seq_count];
    let mut path_cond_start: Vec<u32> = Vec::new();
    let mut path_cond_len: Vec<u32> = Vec::new();
    let mut cond_fe_node: Vec<u32> = Vec::new();
    let mut cond_route: Vec<u32> = Vec::new();

    let mut path_count: u32 = 0u32;
    for (s, paths) in seq_paths.iter().enumerate() {
        seq_path_start[s] = path_count;
        for path in paths {
            path_cond_start.push(cond_fe_node.len() as u32);
            path_cond_len.push(path.len() as u32);
            for c in path {
                cond_fe_node.push(c.fe_node);
                cond_route.push(c.route);
            }
            path_count += 1u32;
        }
        seq_path_len[s] = path_count - seq_path_start[s];
    }

    Ok(EtGpuPlan {
        seq_path_start,
        seq_path_len,
        path_cond_start,
        path_cond_len,
        cond_fe_node,
        cond_route,
    })
}

fn is_success_state(state: &str) -> bool {
    matches!(
        state.to_ascii_lowercase().as_str(),
        "success" | "yes" | "true"
    )
}

fn is_bypass_state(state: &str) -> bool {
    matches!(state.to_ascii_lowercase().as_str(), "bypass")
}

#[allow(clippy::too_many_arguments)]
fn traverse_branch_word(
    event_tree: &EventTree,
    branch: &Branch,
    mask: u64,
    view: &[u64],
    fe_node_by_id: &HashMap<String, usize>,
    sequences_by_id: &HashMap<String, Sequence>,
    event_tree_library: Option<&HashMap<String, EventTree>>,
    house_events: &mut HashMap<String, bool>,
    successes_by_seq: &mut HashMap<String, u64>,
) -> Result<()> {
    if mask == 0 {
        return Ok(());
    }

    for (id, state) in &branch.house_event_assignments {
        house_events.insert(id.clone(), *state);
    }

    match &branch.target {
        BranchTarget::Sequence(seq_id) => {
            let seq = sequences_by_id.get(seq_id).ok_or_else(|| {
                PraxisError::Logic(format!(
                    "Sequence '{}' not found in event tree '{}'",
                    seq_id, event_tree.id
                ))
            })?;

            if let Some(linked_et_id) = &seq.linked_event_tree_id {
                if linked_et_id == &event_tree.id {
                    return traverse_branch_word(
                        event_tree,
                        &event_tree.initial_state,
                        mask,
                        view,
                        fe_node_by_id,
                        sequences_by_id,
                        event_tree_library,
                        house_events,
                        successes_by_seq,
                    );
                }

                if let Some(lib) = event_tree_library {
                    if let Some(linked_et) = lib.get(linked_et_id) {
                        return traverse_branch_word(
                            linked_et,
                            &linked_et.initial_state,
                            mask,
                            view,
                            fe_node_by_id,
                            sequences_by_id,
                            event_tree_library,
                            house_events,
                            successes_by_seq,
                        );
                    }
                }
            }

            *successes_by_seq.entry(seq_id.clone()).or_insert(0) += mask.count_ones() as u64;
            Ok(())
        }
        BranchTarget::Fork(fork) => {
            if let Some(fixed) = house_events.get(&fork.functional_event_id).copied() {
                let fixed_state = if fixed { "true" } else { "false" };
                for fork_path in &fork.paths {
                    if fork_path.state == fixed_state {
                        return traverse_branch_word(
                            event_tree,
                            &fork_path.branch,
                            mask,
                            view,
                            fe_node_by_id,
                            sequences_by_id,
                            event_tree_library,
                            house_events,
                            successes_by_seq,
                        );
                    }
                }

                return Err(PraxisError::Logic(format!(
                    "No path for fixed house-event state '{}' in fork for functional event '{}'",
                    fixed_state, fork.functional_event_id
                )));
            }

            if fork.paths.iter().any(|p| p.probability.is_some()) {
                return Err(PraxisError::Settings(
                    "Event-tree Monte Carlo does not support explicit path probabilities yet"
                        .to_string(),
                ));
            }

            let fe_node = *fe_node_by_id
                .get(&fork.functional_event_id)
                .ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "Functional event '{}' has no MC node mapping",
                        fork.functional_event_id
                    ))
                })?;
            let fe_word = view[fe_node];

            let has_collect_formula = fork
                .paths
                .iter()
                .any(|p| p.collect_formula_negated.is_some());

            for fork_path in &fork.paths {
                let child_mask = if let Some(negated) = fork_path.collect_formula_negated {
                    if negated {
                        mask & !fe_word
                    } else {
                        mask & fe_word
                    }
                } else if has_collect_formula && is_bypass_state(&fork_path.state) {
                    mask
                } else if is_success_state(&fork_path.state) {
                    mask & fe_word
                } else {
                    mask & !fe_word
                };

                traverse_branch_word(
                    event_tree,
                    &fork_path.branch,
                    child_mask,
                    view,
                    fe_node_by_id,
                    sequences_by_id,
                    event_tree_library,
                    house_events,
                    successes_by_seq,
                )?;
            }

            Ok(())
        }
        BranchTarget::NamedBranch(branch_id) => {
            if let Some(named_branch) = event_tree.named_branches.get(branch_id) {
                traverse_branch_word(
                    event_tree,
                    &named_branch.branch,
                    mask,
                    view,
                    fe_node_by_id,
                    sequences_by_id,
                    event_tree_library,
                    house_events,
                    successes_by_seq,
                )?;
            }
            Ok(())
        }
    }
}

fn build_thresholds(
    pdag: &Pdag,
    soa: &GpuSoaPlan,
    model: &Model,
    pseudo_probabilities: &HashMap<String, f64>,
) -> Result<(Vec<u32>, Vec<u32>)> {
    let mut thresholds: Vec<u32> = Vec::with_capacity(soa.event_nodes.len());
    let mut full_ranges: Vec<u32> = Vec::with_capacity(soa.event_nodes.len());

    for &node in &soa.event_nodes {
        let node = node.abs();
        let id = match pdag.get_node(node) {
            Some(PdagNode::BasicEvent { id, .. }) => id,
            other => {
                return Err(PraxisError::Logic(format!(
                    "Expected basic event node {node} in DPMC plan, got {other:?}"
                )))
            }
        };

        let p = if let Some(p) = pseudo_probabilities.get(id).copied() {
            p
        } else if let Some(be) = model.get_basic_event(id) {
            be.probability()
        } else {
            model
                .fault_trees()
                .values()
                .find_map(|ft| ft.get_basic_event(id))
                .map(|be| be.probability())
                .ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "Basic event '{}' not found in model (needed for ET Monte Carlo)",
                        id
                    ))
                })?
        };

        let th = threshold_from_probability(p);
        thresholds.push(th.t);
        full_ranges.push(if th.full_range { 1u32 } else { 0u32 });
    }

    Ok((thresholds, full_ranges))
}

fn make_root_reach_everything(
    pdag: &mut Pdag,
    ft_root_nodes: &HashMap<String, usize>,
    ie_node: usize,
    fe_node_by_id: &HashMap<String, usize>,
) -> Result<()> {
    let mut operands: Vec<i32> = Vec::new();

    for &idx in ft_root_nodes.values() {
        operands.push(idx as i32);
    }

    operands.push(ie_node as i32);

    for &idx in fe_node_by_id.values() {
        operands.push(idx as i32);
    }

    operands.sort();
    operands.dedup();

    let root_id = format!("{ROOT_GATE_ID}::{}", operands.len());

    for &op in &operands {
        if pdag.get_node(op).is_none() {
            return Err(PraxisError::Logic(format!(
                "MC root operand {op} not found in PDAG"
            )));
        }
    }

    let root_idx = pdag.add_gate(root_id, Connective::Or, operands, None)?;
    pdag.set_root(root_idx)?;
    Ok(())
}

fn build_combined_pdag(
    model: &Model,
    fault_tree_ids: &HashSet<String>,
) -> Result<(Pdag, HashMap<String, usize>)> {
    let mut pdag = Pdag::new();

    let const_true = pdag.add_constant(true);
    let const_false = pdag.add_constant(false);

    let mut ft_root_nodes: HashMap<String, usize> = HashMap::new();

    for id in model.basic_events().keys() {
        pdag.add_basic_event(id.clone());
    }

    let mut gate_caches: HashMap<String, HashMap<String, i32>> = HashMap::new();

    for ft_id in fault_tree_ids {
        let ft = model.get_fault_tree(ft_id).ok_or_else(|| {
            PraxisError::Logic(format!("Fault tree '{}' not found in model", ft_id))
        })?;

        let top = ft.top_event();
        if top.is_empty() {
            return Err(PraxisError::Logic(format!(
                "Fault tree '{}' has no top event",
                ft_id
            )));
        }

        let root = build_element_from_model(
            &mut pdag,
            model,
            ft_id,
            top,
            &mut gate_caches,
            const_true,
            const_false,
        )?;

        ft_root_nodes.insert(ft_id.clone(), root as usize);
    }

    if !ft_root_nodes.is_empty() {
        let operands: Vec<i32> = ft_root_nodes.values().map(|&i| i as i32).collect();
        let root_idx = pdag.add_gate(
            format!("{ROOT_GATE_ID}::ft"),
            Connective::Or,
            operands,
            None,
        )?;
        pdag.set_root(root_idx)?;
    }

    Ok((pdag, ft_root_nodes))
}

fn build_element_from_model(
    pdag: &mut Pdag,
    model: &Model,
    ft_id: &str,
    element_id: &str,
    gate_caches: &mut HashMap<String, HashMap<String, i32>>,
    const_true: i32,
    const_false: i32,
) -> Result<i32> {
    if let Some(&idx) = gate_caches
        .get(ft_id)
        .and_then(|cache| cache.get(element_id))
    {
        return Ok(idx);
    }

    let ft = model
        .get_fault_tree(ft_id)
        .ok_or_else(|| PraxisError::Logic(format!("Fault tree '{}' not found in model", ft_id)))?;

    if ft.get_basic_event(element_id).is_some() {
        let idx = pdag.add_basic_event(element_id.to_string());
        return Ok(idx);
    }

    if let Some(he) = ft.get_house_event(element_id) {
        return Ok(if he.state() { const_true } else { const_false });
    }

    let gate = if let Some(g) = ft.get_gate(element_id) {
        g
    } else if let Some((other_ft_id, other_gate_id)) = element_id.split_once('.') {
        return build_element_from_model(
            pdag,
            model,
            other_ft_id,
            other_gate_id,
            gate_caches,
            const_true,
            const_false,
        );
    } else {
        return Err(PraxisError::Logic(format!(
            "Element '{}' not found in fault tree '{}'",
            element_id, ft_id
        )));
    };

    let formula = gate.formula();
    let connective = Connective::from_formula(formula);

    let mut operand_indices: Vec<i32> = Vec::new();
    for op_id in gate.operands() {
        let op_idx = build_element_from_model(
            pdag,
            model,
            ft_id,
            op_id,
            gate_caches,
            const_true,
            const_false,
        )?;
        operand_indices.push(op_idx);
    }

    let min_number = match formula {
        Formula::AtLeast { min } => Some(*min),
        _ => None,
    };

    let namespaced_id = format!("{ft_id}::{element_id}");

    let gate_index = pdag.add_gate(namespaced_id, connective, operand_indices, min_number)?;
    gate_caches
        .entry(ft_id.to_string())
        .or_default()
        .insert(element_id.to_string(), gate_index);
    Ok(gate_index)
}

#[inline]
fn valid_lane_mask(valid_lanes_last_word: u32) -> u64 {
    if valid_lanes_last_word == 0 || valid_lanes_last_word >= 64 {
        !0u64
    } else {
        (1u64 << valid_lanes_last_word) - 1u64
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
