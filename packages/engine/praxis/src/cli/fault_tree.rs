use crate::cli::args::{Algorithm, Analysis, Approximation, Args, Backend, Vrt as CliVrt};
use crate::cli::metadata::{
    display_zbdd_metadata, prompt_for_limits, ZbddSequenceMetadata,
};
use crate::cli::optimize::{
    estimate_fault_tree_nodes, optimize_run_params_for_cpu, optimize_run_params_for_cuda,
};
use praxis::algorithms::bdd_engine::Bdd as BddEngine;
use praxis::algorithms::bdd_pdag::BddPdag;
use praxis::algorithms::mocus::{CutSet, Mocus};
use praxis::algorithms::zbdd_engine::ZbddEngine;
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

pub enum FaultTreePreOutcome {
    ExitOk,
    Continue(Box<FaultTreePreState>),
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

fn build_pdag_and_bdd(
    fault_tree: &praxis::core::fault_tree::FaultTree,
) -> Result<(BddPdag, BddEngine, praxis::algorithms::bdd_engine::BddRef), Box<dyn std::error::Error>>
{
    let mut pdag = BddPdag::from_fault_tree(fault_tree)?;
    pdag.compute_ordering_and_modules()?;
    let (bdd, bdd_root) = BddEngine::build_from_pdag(&pdag)?;
    Ok((pdag, bdd, bdd_root))
}

fn enumerate_cut_sets(
    zbdd: &ZbddEngine,
    root: praxis::algorithms::zbdd_engine::ZbddRef,
    pdag: &BddPdag,
) -> Vec<CutSet> {
    let var_order = pdag.variable_order().to_vec();
    zbdd.enumerate(root)
        .iter()
        .map(|set| {
            let events: Vec<String> = set
                .iter()
                .filter_map(|&pos| {
                    var_order
                        .get(pos)
                        .and_then(|&idx| pdag.node(idx))
                        .and_then(|n| n.id().map(|s| s.to_string()))
                })
                .collect();
            CutSet::new(events)
        })
        .collect()
}

fn print_cut_sets_summary(
    label: &str,
    ft_id: &str,
    cut_sets: &[CutSet],
    verbosity_level: u32,
) {
    println!("\n=== {} Minimal Cut Sets ===", label);
    println!("Fault Tree: {}", ft_id);
    println!("Total cut sets: {}", cut_sets.len());
    println!();

    let mut order_counts: std::collections::HashMap<usize, usize> =
        std::collections::HashMap::new();
    for cs in cut_sets {
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

// ---------------------------------------------------------------------------
// ZBDD Workflow 1 — no approximation, no limits upfront
//
// Sweep BDD → cache exact probability.
// Build full ZBDD → show metadata → prompt user for limits.
// Filter existing ZBDD in-graph → materialize last.
// ---------------------------------------------------------------------------

fn zbdd_wf1_no_approx_no_limits(
    cli: &Args,
    fault_tree: &praxis::core::fault_tree::FaultTree,
    pdag: &BddPdag,
    bdd: &mut BddEngine,
    bdd_root: praxis::algorithms::bdd_engine::BddRef,
    verbosity_level: u32,
) -> Result<(Vec<CutSet>, f64), Box<dyn std::error::Error>> {
    let exact_prob = bdd.probability(bdd_root);
    bdd.freeze();

    let (mut zbdd, zbdd_root) = ZbddEngine::build_from_bdd(bdd, bdd_root, false);

    let raw_stats = zbdd.stats_by_order(zbdd_root);
    let meta = vec![ZbddSequenceMetadata::from_stats(
        fault_tree.element().id().to_string(),
        exact_prob,
        raw_stats,
        1.0,
    )];
    display_zbdd_metadata(&meta);

    let (limit_order, cut_off) = prompt_for_limits();

    let filtered_root = apply_zbdd_filters(&mut zbdd, zbdd_root, limit_order, cut_off);

    let cut_sets = enumerate_cut_sets(&zbdd, filtered_root, pdag);

    if cli.print || verbosity_level > 0 {
        print_cut_sets_summary("ZBDD", fault_tree.element().id(), &cut_sets, verbosity_level);
    }

    Ok((cut_sets, exact_prob))
}

// ---------------------------------------------------------------------------
// ZBDD Workflow 2 — approximation, no limits upfront
//
// Build full ZBDD → compute approximate probability → show metadata
// → prompt for limits → filter in-graph → recompute approximate probability
// → materialize last.
// ---------------------------------------------------------------------------

fn zbdd_wf2_approx_no_limits(
    cli: &Args,
    fault_tree: &praxis::core::fault_tree::FaultTree,
    pdag: &BddPdag,
    bdd: &mut BddEngine,
    bdd_root: praxis::algorithms::bdd_engine::BddRef,
    verbosity_level: u32,
) -> Result<(Vec<CutSet>, f64), Box<dyn std::error::Error>> {
    bdd.freeze();
    let (mut zbdd, zbdd_root) = ZbddEngine::build_from_bdd(bdd, bdd_root, false);

    let approx_prob = compute_approx(&zbdd, zbdd_root, cli.approximation);

    let raw_stats = zbdd.stats_by_order(zbdd_root);
    let meta = vec![ZbddSequenceMetadata::from_stats(
        fault_tree.element().id().to_string(),
        approx_prob,
        raw_stats,
        1.0,
    )];
    display_zbdd_metadata(&meta);

    let (limit_order, cut_off) = prompt_for_limits();

    let filtered_root = apply_zbdd_filters(&mut zbdd, zbdd_root, limit_order, cut_off);

    let final_prob = if limit_order.is_some() || cut_off.is_some() {
        compute_approx(&zbdd, filtered_root, cli.approximation)
    } else {
        approx_prob
    };

    let cut_sets = enumerate_cut_sets(&zbdd, filtered_root, pdag);

    if cli.print || verbosity_level > 0 {
        print_cut_sets_summary("ZBDD", fault_tree.element().id(), &cut_sets, verbosity_level);
    }

    Ok((cut_sets, final_prob))
}

// ---------------------------------------------------------------------------
// ZBDD Workflow 3 — no approximation, limits upfront
//
// Sweep BDD → cache exact probability.
// Build ZBDD with on-the-fly discard (limits baked into conversion).
// Materialize last. No metadata shown.
// ---------------------------------------------------------------------------

fn zbdd_wf3_no_approx_limits(
    cli: &Args,
    fault_tree: &praxis::core::fault_tree::FaultTree,
    pdag: &BddPdag,
    bdd: &mut BddEngine,
    bdd_root: praxis::algorithms::bdd_engine::BddRef,
    verbosity_level: u32,
) -> Result<(Vec<CutSet>, f64), Box<dyn std::error::Error>> {
    let exact_prob = bdd.probability(bdd_root);
    bdd.freeze();

    let limit_order = cli.limit_order.map(|n| n as usize);
    let cut_off = cli.cut_off;

    let (zbdd, zbdd_root) =
        ZbddEngine::build_from_bdd_with_limits(bdd, bdd_root, false, limit_order, cut_off);

    let cut_sets = enumerate_cut_sets(&zbdd, zbdd_root, pdag);

    if cli.print || verbosity_level > 0 {
        print_cut_sets_summary("ZBDD", fault_tree.element().id(), &cut_sets, verbosity_level);
    }

    Ok((cut_sets, exact_prob))
}

// ---------------------------------------------------------------------------
// ZBDD Workflow 4 — approximation, limits upfront
//
// Build ZBDD with on-the-fly discard (limits baked into conversion).
// Compute approximate probability from the already-pruned ZBDD.
// Materialize last. No metadata shown.
// ---------------------------------------------------------------------------

fn zbdd_wf4_approx_limits(
    cli: &Args,
    fault_tree: &praxis::core::fault_tree::FaultTree,
    pdag: &BddPdag,
    bdd: &mut BddEngine,
    bdd_root: praxis::algorithms::bdd_engine::BddRef,
    verbosity_level: u32,
) -> Result<(Vec<CutSet>, f64), Box<dyn std::error::Error>> {
    bdd.freeze();

    let limit_order = cli.limit_order.map(|n| n as usize);
    let cut_off = cli.cut_off;

    let (zbdd, zbdd_root) =
        ZbddEngine::build_from_bdd_with_limits(bdd, bdd_root, false, limit_order, cut_off);

    let approx_prob = compute_approx(&zbdd, zbdd_root, cli.approximation);

    let cut_sets = enumerate_cut_sets(&zbdd, zbdd_root, pdag);

    if cli.print || verbosity_level > 0 {
        print_cut_sets_summary("ZBDD", fault_tree.element().id(), &cut_sets, verbosity_level);
    }

    Ok((cut_sets, approx_prob))
}

// ---------------------------------------------------------------------------
// Shared ZBDD utilities
// ---------------------------------------------------------------------------

fn apply_zbdd_filters(
    zbdd: &mut ZbddEngine,
    root: praxis::algorithms::zbdd_engine::ZbddRef,
    limit_order: Option<usize>,
    cut_off: Option<f64>,
) -> praxis::algorithms::zbdd_engine::ZbddRef {
    let mut r = root;
    if let Some(n) = limit_order {
        r = zbdd.limit_order(r, n);
    }
    if let Some(p) = cut_off {
        r = zbdd.prune_below_probability(r, p);
    }
    r
}

fn compute_approx(
    zbdd: &ZbddEngine,
    root: praxis::algorithms::zbdd_engine::ZbddRef,
    approximation: Option<Approximation>,
) -> f64 {
    match approximation {
        Some(Approximation::RareEvent) => zbdd.rare_event_probability(root),
        Some(Approximation::Mcub) => zbdd.min_cut_upper_bound_graph(root),
        None => f64::NAN,
    }
}

// ---------------------------------------------------------------------------
// Main pre-event-tree implementation
// ---------------------------------------------------------------------------

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

    // BDD exact probability
    if cli.algorithm == Algorithm::Bdd {
        if verbose {
            eprintln!("Computing top event probability using BDD...");
        }
        let mut pdag = BddPdag::from_fault_tree(&fault_tree)?;
        pdag.compute_ordering_and_modules()?;
        let (mut bdd_engine, root) = BddEngine::build_from_pdag(&pdag)?;
        let p = if cli.limit_order.is_some() || cli.cut_off.is_some() {
            bdd_engine.probability_with_limits(
                root,
                cli.limit_order.map(|n| n as usize),
                cli.cut_off,
            )
        } else {
            bdd_engine.probability(root)
        };
        bdd_engine.freeze();
        result.top_event_probability = p;
        if verbose {
            eprintln!("BDD analysis complete!");
            eprintln!("Top event probability: {}", result.top_event_probability);
        }
    }

    if cli.visualize {
        if verbose {
            eprintln!("Generating fault tree visualization...");
        }
        let dot_content = praxis::analysis::visualize::generate_dot_from_fault_tree(&fault_tree);
        if cli.visualize_stdout {
            println!("{}", dot_content);
        }
        if praxis::analysis::visualize::graphviz_available() {
            let out_path = cli.visualize_out_dir.join(format!("{}.svg", fault_tree.element().id()));
            if let Err(e) = praxis::analysis::visualize::save_svg(&dot_content, &out_path) {
                eprintln!("Warning: Failed to save SVG visualization: {}", e);
            } else if verbose {
                eprintln!("Saved fault tree visualization to {}", out_path.display());
            }
        } else {
            eprintln!("Warning: Graphviz 'dot' not found in PATH. SVG output skipped.");
        }
    }

    let mut computed_cut_sets: Option<Vec<CutSet>> = None;

    // MOCUS cut sets
    let needs_mocus_cut_sets = cli.approximation.is_some()
        || matches!(
            cli.analysis,
            Analysis::CutsetsOnly | Analysis::CutsetsAndProbability
        )
        || cli.algorithm == Algorithm::Mocus;

    if needs_mocus_cut_sets && cli.algorithm == Algorithm::Mocus {
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

    // ZBDD — 4 independent workflows dispatched here
    if cli.algorithm == Algorithm::Zbdd {
        if verbose {
            eprintln!("\nRunning ZBDD analysis...");
        }

        let (pdag, mut bdd, bdd_root) = build_pdag_and_bdd(&fault_tree)?;

        let has_limits = cli.limit_order.is_some() || cli.cut_off.is_some();
        let has_approx = cli.approximation.is_some();

        let (cut_sets, probability) = match (has_approx, has_limits) {
            (false, false) => zbdd_wf1_no_approx_no_limits(
                cli,
                &fault_tree,
                &pdag,
                &mut bdd,
                bdd_root,
                verbosity_level,
            )?,
            (true, false) => zbdd_wf2_approx_no_limits(
                cli,
                &fault_tree,
                &pdag,
                &mut bdd,
                bdd_root,
                verbosity_level,
            )?,
            (false, true) => zbdd_wf3_no_approx_limits(
                cli,
                &fault_tree,
                &pdag,
                &mut bdd,
                bdd_root,
                verbosity_level,
            )?,
            (true, true) => zbdd_wf4_approx_limits(
                cli,
                &fault_tree,
                &pdag,
                &mut bdd,
                bdd_root,
                verbosity_level,
            )?,
        };

        computed_cut_sets = Some(cut_sets);
        result.top_event_probability = probability;

        if verbose {
            eprintln!("ZBDD analysis complete!");
            if let Some(ref cs) = computed_cut_sets {
                eprintln!("Minimal cut sets found: {}", cs.len());
            }
            eprintln!("Top event probability: {}", result.top_event_probability);
        }
        let _ = pdag;
    }

    // Approximation from MOCUS cut sets (ZBDD handles its own approximation above)
    if cli.algorithm == Algorithm::Mocus {
        if let Some(ref cut_sets) = computed_cut_sets {
            let mut event_probs: std::collections::HashMap<i32, f64> =
                std::collections::HashMap::new();
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

                let mcub_prob = praxis::analysis::approximations::mcub_approximation(
                    &cut_sets_i32,
                    &event_probs,
                );

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
