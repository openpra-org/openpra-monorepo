use crate::cli::args::{Algorithm, Analysis, Approximation, Args, Backend, Vrt as CliVrt};
use crate::cli::optimize::{
    estimate_fault_tree_nodes, optimize_run_params_for_cpu, optimize_run_params_for_cuda,
};
use praxis::algorithms::bdd::Bdd;
use praxis::algorithms::mocus::{CutSet, Mocus};
use praxis::algorithms::zbdd::Zbdd;
use praxis::analysis::importance::ImportanceAnalysis;
use praxis::mc::plan::{choose_run_params_for_num_trials, RunParams};
use praxis::mc::core::{ConvergenceSettings, VrtMode, VrtSettings};
use praxis::mc::DpMonteCarloAnalysis;

#[cfg(feature = "cuda")]
use cubecl_cuda::CudaRuntime;

#[cfg(feature = "wgpu")]
use cubecl_wgpu::WgpuRuntime;

pub struct FaultTreePreState {
    pub fault_tree: praxis::core::fault_tree::FaultTree,
    pub result: praxis::analysis::fault_tree::AnalysisResult,
    pub computed_cut_sets: Option<Vec<CutSet>>,
}

pub struct FaultTreeOutputs {
    pub fault_tree: praxis::core::fault_tree::FaultTree,
    pub result: praxis::analysis::fault_tree::AnalysisResult,
    pub computed_cut_sets: Option<Vec<CutSet>>,
    pub computed_monte_carlo: Option<praxis::mc::core::MonteCarloResult>,
    pub computed_monte_carlo_config: Option<praxis::mc::core::MonteCarloRunConfig>,
}

type ImportanceRow = (String, Option<f64>, Option<f64>, Option<f64>, Option<f64>);

pub enum FaultTreePreOutcome {
    ExitOk,
    Continue(Box<FaultTreePreState>),
}

fn run_pre_event_tree_impl(
    cli: &Args,
    mut fault_tree: praxis::core::fault_tree::FaultTree,
    verbose: bool,
    verbosity_level: u32,
) -> Result<FaultTreePreOutcome, Box<dyn std::error::Error>> {
    if verbose {
        eprintln!("Parsed fault tree: {}", fault_tree.element().id());
        eprintln!("Top event: {}", fault_tree.top_event());
        eprintln!("Gates: {}", fault_tree.gates().len());
        eprintln!("Basic events: {}", fault_tree.basic_events().len());
        if !fault_tree.ccf_groups().is_empty() {
            eprintln!("CCF groups: {}", fault_tree.ccf_groups().len());
        }
    }

    if cli.analysis == Analysis::Ccf && !fault_tree.ccf_groups().is_empty() {
        if verbose {
            eprintln!("Expanding CCF groups...");
        }

        let mut base_probabilities = std::collections::HashMap::new();

        for (id, ccf_group) in fault_tree.ccf_groups() {
            if let Some(ref dist_str) = ccf_group.distribution {
                if let Ok(base_prob) = dist_str.parse::<f64>() {
                    base_probabilities.insert(id.clone(), base_prob);
                } else if verbose {
                    eprintln!(
                        "Warning: Could not parse distribution value '{}' for CCF group '{}'",
                        dist_str, id
                    );
                }
            } else if verbose {
                eprintln!("Warning: CCF group '{}' has no distribution value", id);
            }
        }

        fault_tree
            .expand_ccf_groups(&base_probabilities)
            .map_err(|e| format!("Failed to expand CCF groups: {}", e))?;

        if verbose {
            eprintln!("CCF groups expanded successfully");
            eprintln!(
                "Basic events after expansion: {}",
                fault_tree.basic_events().len()
            );
        }
    }

    if cli.validate {
        if verbose {
            eprintln!("Validation successful - input file is valid OpenPSA MEF format");
        }
        return Ok(FaultTreePreOutcome::ExitOk);
    }

    if verbose {
        eprintln!("Using algorithm: {:?}", cli.algorithm);
    }

    if verbose {
        if let Some(approx) = cli.approximation {
            let approx_name = match approx {
                Approximation::RareEvent => "rare-event",
                Approximation::Mcub => "mcub",
            };
            eprintln!("Using approximation: {}", approx_name);
        }
    }

    let mut result: praxis::analysis::fault_tree::AnalysisResult =
        praxis::analysis::fault_tree::AnalysisResult {
            top_event_probability: f64::NAN,
            gates_analyzed: fault_tree.gates().len(),
            basic_events_count: fault_tree.basic_events().len(),
        };

    match cli.algorithm {
        Algorithm::Bdd => {
            if verbose {
                eprintln!("Computing top event probability using BDD...");
            }
            let mut bdd = Bdd::new();
            let root = bdd.from_fault_tree(&fault_tree)?;
            let p = bdd.probability(root);
            result.top_event_probability = p;
            if verbose {
                eprintln!("BDD analysis complete!");
                eprintln!("Top event probability: {}", result.top_event_probability);
            }
        }
        Algorithm::MonteCarlo | Algorithm::Mocus | Algorithm::Zbdd => {
        }
    }

    let mut computed_cut_sets: Option<Vec<CutSet>> = None;

    let needs_cut_sets = cli.approximation.is_some()
        || matches!(
            cli.analysis,
            Analysis::CutsetsOnly | Analysis::CutsetsAndProbability
        )
        || matches!(cli.algorithm, Algorithm::Mocus | Algorithm::Zbdd);

    if needs_cut_sets && cli.algorithm == Algorithm::Mocus {
        if verbose {
            eprintln!("\nPerforming MOCUS qualitative analysis...");
        }

        let mut mocus = Mocus::new(&fault_tree);

        if let Some(max_order) = cli.limit_order {
            mocus = mocus.with_max_order(max_order as usize);
        }

        let cut_sets_result = mocus
            .analyze()
            .map_err(|e| format!("MOCUS analysis failed: {}", e))?;
        let mut cut_sets = cut_sets_result.to_vec();

        if let Some(cutoff) = cli.cut_off {
            if verbose {
                eprintln!("Applying probability cut-off: {}", cutoff);
            }

            let mut event_probs: std::collections::HashMap<String, f64> =
                std::collections::HashMap::new();
            for (event_id, event) in fault_tree.basic_events() {
                event_probs.insert(event_id.clone(), event.probability());
            }

            let original_count = cut_sets.len();
            cut_sets =
                praxis::analysis::fault_tree::filter_by_probability(cut_sets, &event_probs, cutoff);

            if verbose {
                eprintln!(
                    "Filtered {} cut sets below {:.6e} (kept {})",
                    original_count - cut_sets.len(),
                    cutoff,
                    cut_sets.len()
                );
            }
        }

        if verbose {
            eprintln!("MOCUS analysis complete!");
            eprintln!("Minimal cut sets found: {}", cut_sets.len());
        }

        computed_cut_sets = Some(cut_sets.to_vec());

        if cli.print || verbose {
            println!("\n=== MOCUS Minimal Cut Sets ===");
            println!("Fault Tree: {}", fault_tree.element().id());
            println!("Total cut sets: {}", cut_sets.len());
            println!();

            let mut order_counts: std::collections::HashMap<usize, usize> =
                std::collections::HashMap::new();
            for cs in &cut_sets {
                *order_counts.entry(cs.order()).or_insert(0) += 1;
            }

            let mut orders: Vec<_> = order_counts.keys().cloned().collect();
            orders.sort();

            println!("{:<10} {:<15}", "Order", "Count");
            println!("{}", "-".repeat(25));
            for order in orders {
                println!("{:<10} {:<15}", order, order_counts[&order]);
            }

            if verbosity_level >= 2 {
                println!("\nCut Sets:");
                for (i, cs) in cut_sets.iter().enumerate() {
                    let events: Vec<_> = cs.events.iter().cloned().collect();
                    println!("  {}: {{ {} }}", i + 1, events.join(", "));
                }
            }
            println!("==============================\n");
        }
    }

    if needs_cut_sets && cli.algorithm == Algorithm::Zbdd {
        if verbose {
            eprintln!("\nGenerating minimal cut sets using ZBDD...");
        }

        let (zbdd, root) = Zbdd::from_fault_tree(&fault_tree)
            .map_err(|e| format!("ZBDD conversion failed: {}", e))?;

        let mut cut_sets = zbdd.get_cut_sets(root, cli.limit_order.map(|o| o as usize));

        if let Some(cutoff) = cli.cut_off {
            if verbose {
                eprintln!("Applying probability cut-off: {}", cutoff);
            }

            let mut event_probs: std::collections::HashMap<String, f64> =
                std::collections::HashMap::new();
            for (event_id, event) in fault_tree.basic_events() {
                event_probs.insert(event_id.clone(), event.probability());
            }

            let original_count = cut_sets.len();
            cut_sets =
                praxis::analysis::fault_tree::filter_by_probability(cut_sets, &event_probs, cutoff);

            if verbose {
                eprintln!(
                    "Filtered {} cut sets below {:.6e} (kept {})",
                    original_count - cut_sets.len(),
                    cutoff,
                    cut_sets.len()
                );
            }
        }

        if verbose {
            eprintln!("ZBDD cut set generation complete!");
            eprintln!("Minimal cut sets found: {}", cut_sets.len());
        }

        computed_cut_sets = Some(cut_sets.to_vec());

        if cli.print || verbose {
            println!("\n=== ZBDD Minimal Cut Sets ===");
            println!("Fault Tree: {}", fault_tree.element().id());
            println!("Total cut sets: {}", cut_sets.len());
            println!();

            let mut order_counts: std::collections::HashMap<usize, usize> =
                std::collections::HashMap::new();
            for cs in &cut_sets {
                *order_counts.entry(cs.order()).or_insert(0) += 1;
            }

            let mut orders: Vec<_> = order_counts.keys().cloned().collect();
            orders.sort();

            println!("{:<10} {:<15}", "Order", "Count");
            println!("{}", "-".repeat(25));
            for order in orders {
                println!("{:<10} {:<15}", order, order_counts[&order]);
            }

            if verbosity_level >= 2 {
                println!("\nCut Sets:");
                for (i, cs) in cut_sets.iter().enumerate() {
                    let events: Vec<_> = cs.events.iter().cloned().collect();
                    println!("  {}: {{ {} }}", i + 1, events.join(", "));
                }
            }
            println!("==============================\n");
        }
    }

    if let Some(ref cut_sets) = computed_cut_sets {
        let mut event_probs: std::collections::HashMap<i32, f64> = std::collections::HashMap::new();
        for (idx, (_event_id, event)) in fault_tree.basic_events().iter().enumerate() {
            event_probs.insert(idx as i32 + 1, event.probability());
        }

        if matches!(cli.approximation, Some(Approximation::RareEvent)) {
            if verbose {
                eprintln!("\nComputing Rare Event Approximation...");
            }

            let cut_sets_i32: Vec<Vec<i32>> = cut_sets
                .iter()
                .map(|cs| {
                    cs.events
                        .iter()
                        .filter_map(|event_id| {
                            fault_tree
                                .basic_events()
                                .keys()
                                .position(|k| k == event_id)
                                .map(|pos| (pos + 1) as i32)
                        })
                        .collect()
                })
                .collect();

            let rea_prob = praxis::analysis::approximations::rare_event_approximation(
                &cut_sets_i32,
                &event_probs,
            );

            result.top_event_probability = rea_prob;

            if cli.print || verbose {
                println!("\n=== Rare Event Approximation ===");
                println!("REA Approximation:       {:.6e}", rea_prob);
                println!();
                println!("Note: REA sums cut set probabilities (assumes disjoint sets)");
                println!("      Works well when cut set probabilities are << 1");
                println!("================================\n");
            }

            if verbose {
                eprintln!("Rare Event Approximation complete");
            }
        }

        if matches!(cli.approximation, Some(Approximation::Mcub)) {
            if verbose {
                eprintln!("\nComputing MCUB (Minimal Cut Upper Bound) Approximation...");
            }

            let cut_sets_i32: Vec<Vec<i32>> = cut_sets
                .iter()
                .map(|cs| {
                    cs.events
                        .iter()
                        .filter_map(|event_id| {
                            fault_tree
                                .basic_events()
                                .keys()
                                .position(|k| k == event_id)
                                .map(|pos| (pos + 1) as i32)
                        })
                        .collect()
                })
                .collect();

            let mcub_prob =
                praxis::analysis::approximations::mcub_approximation(&cut_sets_i32, &event_probs);

            result.top_event_probability = mcub_prob;

            if cli.print || verbose {
                println!("\n=== MCUB Approximation ===");
                println!("MCUB Approximation:      {:.6e}", mcub_prob);
                println!();
                println!("Note: MCUB uses 1 - ∏(1 - P_cs) formula");
                println!("      Provides upper bound on probability");
                println!("==========================\n");
            }

            if verbose {
                eprintln!("MCUB Approximation complete");
            }
        }
    } else if cli.approximation.is_some() && verbose {
        eprintln!("Warning: --approximation requires cut sets (use --algorithm mocus or --algorithm zbdd)");
    }

    Ok(FaultTreePreOutcome::Continue(Box::new(FaultTreePreState {
        fault_tree,
        result,
        computed_cut_sets,
    })))
}

pub fn run_pre_event_tree_parsed(
    cli: &Args,
    fault_tree: praxis::core::fault_tree::FaultTree,
    verbose: bool,
    verbosity_level: u32,
) -> Result<FaultTreePreOutcome, Box<dyn std::error::Error>> {
    run_pre_event_tree_impl(cli, fault_tree, verbose, verbosity_level)
}

pub fn run_post_event_tree(
    cli: &Args,
    pre: FaultTreePreState,
    verbose: bool,
    verbosity_level: u32,
) -> Result<FaultTreeOutputs, Box<dyn std::error::Error>> {
    let FaultTreePreState {
        fault_tree,
        mut result,
        computed_cut_sets,
    } = pre;

    let mut computed_monte_carlo: Option<praxis::mc::core::MonteCarloResult> = None;
    let mut computed_monte_carlo_config: Option<praxis::mc::core::MonteCarloRunConfig> = None;

    if cli.algorithm == Algorithm::MonteCarlo {
        if verbose {
            eprintln!("\nRunning Monte Carlo simulation...");
            eprintln!("Trials: {}", cli.num_trials);
            eprintln!("Seed: {}", cli.seed);
        }

        let backend = cli.backend.unwrap_or(Backend::Cpu);
        let auto_cuda_num_trials = !cli.optimize
            && matches!((cli.iterations, cli.batches, cli.bitpacks_per_batch), (None, None, None))
            && matches!(backend, Backend::Cuda);

        let explicit_params: Option<RunParams> = if cli.optimize || auto_cuda_num_trials {
            let node_count = estimate_fault_tree_nodes(&fault_tree);
            Some(match backend {
                Backend::Cpu => {
                    optimize_run_params_for_cpu(node_count, cli.seed)?
                }
                Backend::Cuda => {
                    optimize_run_params_for_cuda(cli.num_trials as usize, node_count, cli.seed)?
                }
                Backend::Wgpu => {
                    return Err(anyhow::anyhow!(
                        "--optimize is currently supported for '--backend cpu' and '--backend cuda' only"
                    )
                    .into());
                }
            })
        } else {
            match (cli.iterations, cli.batches, cli.bitpacks_per_batch) {
                (None, None, None) => None,
                (Some(t), Some(b), Some(p)) => {
                    let t = t as usize;
                    let b = b as usize;
                    let p = p as usize;
                    if t == 0 || b == 0 || p == 0 {
                        return Err(anyhow::anyhow!(
                            "iterations, batches, and bitpacks-per-batch must all be > 0"
                        )
                        .into());
                    }
                    Some(RunParams::new(t, b, p, RunParams::DEFAULT_OMEGA, cli.seed))
                }
                _ => {
                    return Err(anyhow::anyhow!(
                        "If setting any of iterations/batches/bitpacks-per-batch, you must set all three"
                    )
                    .into());
                }
            }
        };

        let effective_trials: usize = if let Some(params) = explicit_params {
            params.total_trials_covered()
        } else {
            cli.num_trials as usize
        };

        if verbose {
            if let Some(params) = explicit_params {
                eprintln!(
                    "Using explicit DPMC params: T={}, B={}, P={}, omega={} (total trials={})",
                    params.t, params.b, params.p, params.omega, effective_trials
                );
                if cli.optimize {
                    let backend_name = match backend {
                        Backend::Cpu => "CPU",
                        Backend::Cuda => "CUDA",
                        Backend::Wgpu => "WGPU",
                    };
                    eprintln!(
                        "{} optimize enabled: auto-sized (T,B,P) from memory budgets",
                        backend_name
                    );
                } else if auto_cuda_num_trials {
                    eprintln!(
                        "CUDA num-trials auto-optimized: auto-sized (T,B,P) from memory budgets"
                    );
                }
            }
        }

        let mc_analysis = if let Some(params) = explicit_params {
            DpMonteCarloAnalysis::with_run_params(&fault_tree, params)?
        } else {
            DpMonteCarloAnalysis::new(&fault_tree, Some(cli.seed), cli.num_trials as usize)?
        };

        let backend_requested = match backend {
            Backend::Cpu => "cpu",
            Backend::Cuda => "cuda",
            Backend::Wgpu => "wgpu",
        }
        .to_string();

        let convergence = ConvergenceSettings {
            enabled: cli.early_stop,
            delta: cli.delta,
            confidence: cli.confidence,
            burn_in: cli.burn_in,
        };

        let vrt = match cli.vrt {
            CliVrt::None => VrtSettings::none(),
            CliVrt::Importance => VrtSettings {
                mode: VrtMode::ImportanceSampling,
                is_bias_factor: cli.is_bias_factor,
                is_max_events: cli.is_max_events as usize,
                is_q_min: cli.is_q_min,
                stratify_events: cli.stratify_events as usize,
            },
            CliVrt::Stratified => VrtSettings {
                mode: VrtMode::StratifiedSampling,
                is_bias_factor: cli.is_bias_factor,
                is_max_events: cli.is_max_events as usize,
                is_q_min: cli.is_q_min,
                stratify_events: cli.stratify_events as usize,
            },
        };

        let (backend_used, mc_result) = match backend {
            Backend::Cpu => {
                if verbose {
                    eprintln!("Running Monte Carlo simulation on CPU...");
                }
                let start = std::time::Instant::now();
                let result = if vrt.mode == VrtMode::None {
                    mc_analysis.run_cpu_with_watch_and_convergence(cli.watch, convergence)?
                } else {
                    mc_analysis.run_cpu_with_watch_convergence_and_vrt(cli.watch, convergence, vrt)?
                };
                if verbose {
                    eprintln!("CPU execution time: {:.3}s", start.elapsed().as_secs_f64());
                }
                ("cpu".to_string(), result)
            }
            Backend::Cuda => {
                #[cfg(feature = "cuda")]
                {
                    if verbose {
                        eprintln!("Running Monte Carlo simulation on GPU (CUDA)...");
                    }
                    let start = std::time::Instant::now();
                    let device = Default::default();

                    let result = if let Some(params) = explicit_params {
                        if vrt.mode != VrtMode::None {
                            return Err(anyhow::anyhow!(
                                "VRT requires --num-trials (explicit RunParams are not supported)"
                            )
                            .into());
                        }
                        mc_analysis.run_gpu_with_run_params_with_watch_and_convergence::<CudaRuntime>(
                            &device,
                            params,
                            cli.watch,
                            convergence,
                        )?
                    } else {
                        if vrt.mode == VrtMode::None {
                            mc_analysis.run_gpu_with_watch_and_convergence::<CudaRuntime>(
                                &device,
                                cli.watch,
                                convergence,
                            )?
                        } else {
                            mc_analysis.run_gpu_with_watch_convergence_and_vrt::<CudaRuntime>(
                                &device,
                                cli.watch,
                                convergence,
                                vrt,
                            )?
                        }
                    };

                    if verbose {
                        eprintln!("GPU execution time: {:.3}s", start.elapsed().as_secs_f64());
                    }
                    ("cuda".to_string(), result)
                }

                #[cfg(not(feature = "cuda"))]
                {
                    return Err(anyhow::anyhow!(
                        "CUDA backend requested but this build was not compiled with CUDA support"
                    )
                    .into());
                }
            }

            Backend::Wgpu => {
                #[cfg(feature = "wgpu")]
                {
                    if verbose {
                        eprintln!("Running Monte Carlo simulation on GPU (WGPU)...");
                    }
                    let start = std::time::Instant::now();
                    let device = Default::default();

                    let result = if let Some(params) = explicit_params {
                        if vrt.mode != VrtMode::None {
                            return Err(anyhow::anyhow!(
                                "VRT requires --num-trials (explicit RunParams are not supported)"
                            )
                            .into());
                        }
                        mc_analysis.run_gpu_with_run_params_with_watch_and_convergence::<WgpuRuntime>(
                            &device,
                            params,
                            cli.watch,
                            convergence,
                        )?
                    } else {
                        if vrt.mode == VrtMode::None {
                            mc_analysis.run_gpu_with_watch_and_convergence::<WgpuRuntime>(
                                &device,
                                cli.watch,
                                convergence,
                            )?
                        } else {
                            mc_analysis.run_gpu_with_watch_convergence_and_vrt::<WgpuRuntime>(
                                &device,
                                cli.watch,
                                convergence,
                                vrt,
                            )?
                        }
                    };

                    if verbose {
                        eprintln!("GPU execution time: {:.3}s", start.elapsed().as_secs_f64());
                    }
                    ("wgpu".to_string(), result)
                }

                #[cfg(not(feature = "wgpu"))]
                {
                    return Err(anyhow::anyhow!(
                        "WGPU backend requested but this build was not compiled with WGPU support"
                    )
                    .into());
                }
            }
        };

        computed_monte_carlo = Some(mc_result.clone());

        let run_params_for_report = if let Some(params) = explicit_params {
            Some(params)
        } else {
            choose_run_params_for_num_trials(cli.num_trials as usize, cli.seed)
                .ok()
                .map(|layout| layout.params)
        };

        computed_monte_carlo_config = Some(praxis::mc::core::MonteCarloRunConfig {
            engine: "dpmc".to_string(),
            target: "fault-tree".to_string(),
            backend_requested,
            backend_used,
            seed: cli.seed,
            num_trials_requested: effective_trials,
            run_params: run_params_for_report,
            early_stop: cli.early_stop.then_some(true),
            delta: cli.early_stop.then_some(cli.delta),
            burn_in: cli.early_stop.then_some(cli.burn_in),
            confidence: cli.early_stop.then_some(cli.confidence),
            policy: cli
                .early_stop
                .then_some("wald-linear+log10".to_string()),
        });

        if verbose {
            eprintln!("Monte Carlo simulation complete!");
            eprintln!("Estimated probability: {}", mc_result.probability_estimate);
            eprintln!("Standard deviation: {}", mc_result.std_dev);
            eprintln!(
                "95% CI: [{}, {}]",
                mc_result.confidence_interval_lower, mc_result.confidence_interval_upper
            );
            eprintln!(
                "Successes: {} / {}",
                mc_result.successes, mc_result.num_trials
            );
        }

        result.top_event_probability = mc_result.probability_estimate;

        if cli.print {
            println!("\n=== Monte Carlo Simulation Results ===");
            println!("MC Engine: DPMC");
            println!(
                "Estimated Probability: {:.6}",
                mc_result.probability_estimate
            );
            println!("Standard Deviation: {:.6}", mc_result.std_dev);
            println!(
                "95% Confidence Interval: [{:.6}, {:.6}]",
                mc_result.confidence_interval_lower, mc_result.confidence_interval_upper
            );
            println!("Number of Trials: {}", mc_result.num_trials);
            println!("Successes: {}", mc_result.successes);
            println!("======================================\n");
        }
    }

    if cli.analysis == Analysis::Importance {
        if verbose {
            eprintln!("Performing importance analysis...");
        }

        match ImportanceAnalysis::new(&fault_tree, result.top_event_probability) {
            Ok(importance) => {
                let fv_values = importance.compute_fussell_vesely_from_bdd().ok();
                let raw_values = importance.compute_raw().ok();
                let rrw_values = importance.compute_rrw().ok();
                let bi_values = importance.compute_birnbaum().ok();

                if cli.print || verbose {
                    println!("\n=== Importance Measures ===");
                    println!(
                        "Top event probability: {:.6e}",
                        result.top_event_probability
                    );
                    println!();

                    let mut importance_data: Vec<ImportanceRow> = Vec::new();

                    for event_id in fault_tree.basic_events().keys() {
                        let fv = fv_values.as_ref().and_then(
                            |m: &std::collections::HashMap<String, f64>| m.get(event_id).copied(),
                        );
                        let raw = raw_values.as_ref().and_then(
                            |m: &std::collections::HashMap<String, f64>| m.get(event_id).copied(),
                        );
                        let rrw = rrw_values.as_ref().and_then(
                            |m: &std::collections::HashMap<String, f64>| m.get(event_id).copied(),
                        );
                        let bi = bi_values.as_ref().and_then(
                            |m: &std::collections::HashMap<String, f64>| m.get(event_id).copied(),
                        );

                        importance_data.push((event_id.clone(), fv, raw, rrw, bi));
                    }

                    importance_data.sort_by(|a, b| {
                        let fv_a = a.1.unwrap_or(0.0);
                        let fv_b = b.1.unwrap_or(0.0);
                        fv_b.partial_cmp(&fv_a).unwrap_or(std::cmp::Ordering::Equal)
                    });

                    println!(
                        "{:<20} {:>12} {:>12} {:>12} {:>12}",
                        "Event", "FV", "RAW", "RRW", "Birnbaum"
                    );
                    println!("{}", "-".repeat(72));

                    for (event_id, fv, raw, rrw, bi) in &importance_data {
                        let fv_str = fv.map_or("N/A".to_string(), |v| format!("{:.6}", v));
                        let raw_str = raw.map_or("N/A".to_string(), |v| {
                            if v.is_infinite() {
                                "∞".to_string()
                            } else {
                                format!("{:.6}", v)
                            }
                        });
                        let rrw_str = rrw.map_or("N/A".to_string(), |v| {
                            if v.is_infinite() {
                                "∞".to_string()
                            } else {
                                format!("{:.6}", v)
                            }
                        });
                        let bi_str = bi.map_or("N/A".to_string(), |v| format!("{:.6}", v));

                        println!(
                            "{:<20} {:>12} {:>12} {:>12} {:>12}",
                            event_id, fv_str, raw_str, rrw_str, bi_str
                        );
                    }

                    println!();
                    println!("Importance Measures Guide:");
                    println!("  FV (Fussell-Vesely): Contribution to system failure [0,1]");
                    println!("  RAW (Risk Achievement Worth): Risk increase if event certain [≥1]");
                    println!(
                        "  RRW (Risk Reduction Worth): Risk reduction if event impossible [≥1]"
                    );
                    println!("  Birnbaum: Sensitivity to component reliability [0,1]");
                    println!("===============================\n");
                }

                if verbose {
                    eprintln!("Importance analysis completed successfully");
                }
            }
            Err(e) => {
                eprintln!("Error creating importance analysis: {}", e);
                if verbose {
                    eprintln!("Importance analysis failed");
                }
            }
        }
    }

    if cli.analysis == Analysis::Uncertainty {
        if verbose {
            eprintln!("Performing uncertainty quantification analysis...");
        }

        let has_distributions = fault_tree
            .basic_events()
            .values()
            .any(|event| event.distribution().is_some());

        if !has_distributions {
            eprintln!("\nWarning: No probability distributions defined for basic events.");
            eprintln!("Uncertainty analysis requires events to have distributions (Normal, LogNormal, or Uniform).");
            eprintln!("Example: <basic-event name=\"E1\" distribution=\"normal\" mu=\"0.01\" sigma=\"0.002\" />\n");
        }

        match praxis::analysis::uncertainty::propagate_uncertainty(
            &fault_tree,
            cli.num_trials as usize,
            Some(cli.seed),
        ) {
            Ok(uncertainty_result) => {
                if cli.print || verbose {
                    println!("\n=== Uncertainty Quantification Results ===");
                    println!("Monte Carlo trials: {}", cli.num_trials);
                    println!("Random seed: {}", cli.seed);
                    println!();
                    println!("Top Event Probability Distribution:");
                    println!("  Mean:              {:.6e}", uncertainty_result.mean());
                    println!("  Standard Deviation: {:.6e}", uncertainty_result.sigma());
                    println!(
                        "  Error Factor:       {:.4}",
                        uncertainty_result.error_factor()
                    );
                    println!();

                    let (ci_lower, ci_upper) = uncertainty_result.confidence_interval();
                    println!("95% Confidence Interval:");
                    println!("  [{:.6e}, {:.6e}]", ci_lower, ci_upper);
                    println!();

                    let quantiles = uncertainty_result.quantiles();
                    let quantile_labels = [5.0, 25.0, 50.0, 75.0, 95.0];
                    println!("Quantile Distribution:");
                    for (i, &value) in quantiles.iter().enumerate() {
                        println!("  {:.1}%: {:.6e}", quantile_labels[i], value);
                    }

                    println!();
                    println!("Uncertainty Analysis Guide:");
                    println!("  Mean: Expected value of top event probability");
                    println!("  Std Dev: Spread of uncertainty around the mean");
                    println!("  Error Factor: Ratio of 95th to 5th percentile (EF=Q95/Q5)");
                    println!(
                        "  Confidence Intervals: Ranges containing true value with given confidence"
                    );
                    println!("  Quantiles: Percentile values of the distribution");
                    println!("=========================================\n");
                }

                if verbose {
                    eprintln!("Uncertainty quantification completed successfully");
                }
            }
            Err(e) => {
                eprintln!("Error performing uncertainty analysis: {}", e);
                if verbose {
                    eprintln!("Uncertainty quantification failed");
                }
            }
        }
    }

    if cli.analysis == Analysis::Sil {
        if verbose {
            eprintln!("Computing SIL metrics...");
        }

        let sil = praxis::analysis::sil::Sil::from_probability(result.top_event_probability);

        if cli.print || verbose {
            println!("\n=== Safety Integrity Level (SIL) Metrics ===");
            println!(
                "Top event probability: {:.6e}",
                result.top_event_probability
            );
            println!();
            println!(
                "Average Probability of Failure on Demand (PFD): {:.6e}",
                sil.pfd_avg
            );
            println!(
                "Average Probability of Failure per Hour (PFH): {:.6e}",
                sil.pfh_avg
            );
            println!();
            println!("SIL Classification (IEC 61508):");
            println!("  SIL 4: PFD < 10⁻⁵ (1e-5)   | PFH < 10⁻⁹ (1e-9)");
            println!("  SIL 3: PFD < 10⁻⁴ (1e-4)   | PFH < 10⁻⁸ (1e-8)");
            println!("  SIL 2: PFD < 10⁻³ (1e-3)   | PFH < 10⁻⁷ (1e-7)");
            println!("  SIL 1: PFD < 10⁻² (1e-2)   | PFH < 10⁻⁶ (1e-6)");
            println!("  None:  PFD ≥ 10⁻² (0.01)   | PFH ≥ 10⁻⁶ (1e-6)");
            println!();

            let sil_level = if sil.pfd_avg < 1e-5 {
                "SIL 4"
            } else if sil.pfd_avg < 1e-4 {
                "SIL 3"
            } else if sil.pfd_avg < 1e-3 {
                "SIL 2"
            } else if sil.pfd_avg < 1e-2 {
                "SIL 1"
            } else {
                "None (below SIL 1)"
            };

            println!("Assessed SIL Level: {}", sil_level);
            println!("==========================================\n");
        }

        if verbose {
            eprintln!("SIL metrics computed successfully");
        }
    }

    if matches!(
        cli.analysis,
        Analysis::PrimeImplicantsOnly | Analysis::PrimeImplicantsAndProbability
    ) {
        if verbose {
            eprintln!("Computing prime implicants using BDD...");
        }

        let mut bdd = Bdd::new();
        match bdd.from_fault_tree(&fault_tree) {
            Ok(root) => {
                let prime_implicants = bdd.extract_prime_implicants(root);

                if cli.print || verbose {
                    println!("\n=== Prime Implicants ===");
                    println!("Total prime implicants: {}", prime_implicants.len());
                    println!();

                    let max_order = prime_implicants
                        .iter()
                        .map(|pi| pi.order())
                        .max()
                        .unwrap_or(0);
                    for order in 1..=max_order {
                        let pis_of_order: Vec<_> = prime_implicants
                            .iter()
                            .filter(|pi| pi.order() == order)
                            .collect();

                        if !pis_of_order.is_empty() {
                            println!("Order {}: {} prime implicants", order, pis_of_order.len());
                            if verbosity_level >= 2 {
                                for pi in pis_of_order.iter().take(10) {
                                    let events_str: Vec<&str> =
                                        pi.events.iter().map(|s| s.as_str()).collect();
                                    println!("  {{{}}}", events_str.join(", "));
                                }
                                if pis_of_order.len() > 10 {
                                    println!("  ... and {} more", pis_of_order.len() - 10);
                                }
                            }
                        }
                    }
                    println!("===============================\n");
                }

                if verbose {
                    eprintln!("Prime implicants computation completed successfully");
                }
            }
            Err(e) => {
                eprintln!("Error converting fault tree to BDD: {}", e);
                if verbose {
                    eprintln!("Prime implicants computation failed");
                }
            }
        }
    }

    if cli.analysis == Analysis::Ccf
        && !fault_tree.ccf_groups().is_empty()
        && (cli.print || verbose)
    {
        println!("\n=== Common Cause Failure (CCF) Groups ===");
        println!("Total CCF groups: {}", fault_tree.ccf_groups().len());
        println!();

        for (id, ccf_group) in fault_tree.ccf_groups() {
            println!("CCF Group: {}", id);
            println!("  Model: {:?}", ccf_group.model);
            println!("  Members: {}", ccf_group.members.join(", "));
            if let Some(ref dist) = ccf_group.distribution {
                println!("  Distribution: {}", dist);
            }

            if verbosity_level >= 2 {
                let ccf_prefix = format!("{}-", id);
                let expanded_events: Vec<_> = fault_tree
                    .basic_events()
                    .iter()
                    .filter(|(event_id, _)| event_id.starts_with(&ccf_prefix))
                    .collect();

                if !expanded_events.is_empty() {
                    println!("  Expanded events: {}", expanded_events.len());
                    if verbosity_level >= 3 {
                        for (event_id, event) in expanded_events.iter().take(10) {
                            println!("    {} (p={:.6e})", event_id, event.probability());
                        }
                        if expanded_events.len() > 10 {
                            println!("    ... and {} more", expanded_events.len() - 10);
                        }
                    }
                }
            }
            println!();
        }
        println!("=========================================\n");
    }

    if cli.print {
        println!("\n=== Fault Tree Analysis Results ===");
        println!("Fault Tree: {}", fault_tree.element().id());
        println!("Top Event: {}", fault_tree.top_event());
        println!("Top Event Probability: {:.6}", result.top_event_probability);
        println!("Gates Analyzed: {}", result.gates_analyzed);
        println!("Basic Events: {}", result.basic_events_count);
        println!("===================================\n");
    }

    Ok(FaultTreeOutputs {
        fault_tree,
        result,
        computed_cut_sets,
        computed_monte_carlo,
        computed_monte_carlo_config,
    })
}
