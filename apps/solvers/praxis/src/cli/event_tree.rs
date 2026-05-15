use crate::cli::args::{Algorithm, Approximation, Args, Backend};
use crate::cli::metadata::{
    display_zbdd_metadata, prompt_for_limits, ZbddSequenceMetadata,
};
use praxis::algorithms::mocus::CutSet;
use praxis::algorithms::zbdd_engine::ZbddEngine;
use crate::cli::optimize::{
    estimate_model_nodes, optimize_run_params_for_cpu, optimize_run_params_for_cuda,
};
use crate::cli::output::{writer_stdout, writer_vec};
use praxis::algorithms::bdd_engine::Bdd as BddEngine;
use praxis::algorithms::bdd_pdag::BddPdag;
use praxis::algorithms::zbdd_engine::ZbddRef;
use praxis::analysis::sequence_formula::SequenceFormulaBuilder;
use praxis::core::event_tree::InitiatingEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::io::event_tree_parser::EventTreeModel;
use praxis::io::reporter::{
    write_comprehensive_report, AnalysisReport, EventTreeAnalyticReport,
    EventTreeAnalyticSequence, EventTreeMonteCarloReport,
};
use praxis::mc::core::ConvergenceSettings;
use praxis::mc::plan::{choose_run_params_for_num_trials, RunParams};
use praxis::mc::DpEventTreeMonteCarloAnalysis;
use std::collections::{HashMap, HashSet};
use std::fs;

type ParsedModelWithLibs = (
    praxis::core::model::Model,
    Vec<InitiatingEvent>,
    Vec<praxis::core::event_tree::EventTree>,
    HashMap<String, praxis::core::event_tree::EventTree>,
);

#[cfg(feature = "cuda")]
use cubecl_cuda::CudaRuntime;

#[cfg(feature = "wgpu")]
use cubecl_wgpu::WgpuRuntime;

fn parse_model_with_libs_from_parsed(
    parsed: &EventTreeModel,
) -> Result<ParsedModelWithLibs, Box<dyn std::error::Error>> {
    let model = parsed.model.clone();
    let initiating_events = parsed.initiating_events.clone();
    let event_trees = parsed.event_trees.clone();

    let mut event_tree_library: HashMap<String, praxis::core::event_tree::EventTree> =
        HashMap::new();
    for et in &event_trees {
        event_tree_library
            .entry(et.id.clone())
            .or_insert_with(|| et.clone());
    }

    Ok((model, initiating_events, event_trees, event_tree_library))
}

// ---------------------------------------------------------------------------
// Shared helpers for analytic ZBDD
// ---------------------------------------------------------------------------

fn event_names_from_pdag(pdag: &BddPdag) -> Vec<Option<String>> {
    pdag.variable_order()
        .iter()
        .map(|&idx| pdag.node(idx).and_then(|n| n.id().map(|s| s.to_string())))
        .collect()
}

fn enumerate_cut_sets_et(
    zbdd: &ZbddEngine,
    root: ZbddRef,
    event_names: &[Option<String>],
) -> Vec<CutSet> {
    zbdd.enumerate(root)
        .iter()
        .map(|set| {
            let events: Vec<String> = set
                .iter()
                .filter_map(|&pos| event_names.get(pos).and_then(|n| n.clone()))
                .collect();
            CutSet::new(events)
        })
        .collect()
}

fn apply_zbdd_filters_et(
    zbdd: &mut ZbddEngine,
    root: ZbddRef,
    limit_order: Option<usize>,
    cut_off: Option<f64>,
) -> ZbddRef {
    let mut r = root;
    if let Some(n) = limit_order {
        r = zbdd.limit_order(r, n);
    }
    if let Some(p) = cut_off {
        r = zbdd.prune_below_probability(r, p);
    }
    r
}

fn compute_approx_et(zbdd: &ZbddEngine, root: ZbddRef, approximation: Option<Approximation>) -> f64 {
    match approximation {
        Some(Approximation::RareEvent) => zbdd.rare_event_probability(root),
        Some(Approximation::Mcub) => zbdd.min_cut_upper_bound_graph(root),
        None => f64::NAN,
    }
}

// ---------------------------------------------------------------------------
// Intermediate state for a single sequence (used in WF1 & WF2 only)
// ---------------------------------------------------------------------------

struct SequenceIntermediate {
    seq_id: String,
    event_names: Vec<Option<String>>,
    zbdd: ZbddEngine,
    zbdd_root: ZbddRef,
    probability: f64,
    ie_frequency: f64,
    is_unconditional: bool,
}

// ---------------------------------------------------------------------------
// Analytic ZBDD — 4 independent workflows
// ---------------------------------------------------------------------------

fn analytic_zbdd_wf1_no_approx_no_limits(
    _cli: &Args,
    model: &praxis::core::model::Model,
    event_tree: &praxis::core::event_tree::EventTree,
    event_tree_library: &HashMap<String, praxis::core::event_tree::EventTree>,
    _ie: &InitiatingEvent,
    ie_frequency: f64,
    _verbose: bool,
) -> Result<Vec<EventTreeAnalyticSequence>, Box<dyn std::error::Error>> {
    let praxis::analysis::sequence_formula::SequenceFormulas {
        mut pdag,
        sequence_roots,
        unconditional,
        ie_frequency: _,
    } = SequenceFormulaBuilder::new(model)
        .with_event_tree_library(event_tree_library)
        .build(event_tree, ie_frequency)
        .map_err(|e| format!("Sequence formula construction failed for '{}': {}", event_tree.id, e))?;

    let mut all_seq_ids: Vec<String> = sequence_roots.keys().cloned().collect();
    for id in &unconditional {
        if !sequence_roots.contains_key(id.as_str()) {
            all_seq_ids.push(id.clone());
        }
    }
    all_seq_ids.sort();

    // First pass: build all ZBDDs and collect metadata
    let mut intermediates: Vec<SequenceIntermediate> = Vec::new();

    for seq_id in &all_seq_ids {
        if unconditional.contains(seq_id) {
            intermediates.push(SequenceIntermediate {
                seq_id: seq_id.clone(),
                event_names: Vec::new(),
                zbdd: ZbddEngine::new(),
                zbdd_root: praxis::algorithms::zbdd_engine::ZBDD_BASE,
                probability: 1.0,
                ie_frequency,
                is_unconditional: true,
            });
            continue;
        }
        let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) else {
            intermediates.push(SequenceIntermediate {
                seq_id: seq_id.clone(),
                event_names: Vec::new(),
                zbdd: ZbddEngine::new(),
                zbdd_root: praxis::algorithms::zbdd_engine::ZBDD_EMPTY,
                probability: 0.0,
                ie_frequency,
                is_unconditional: false,
            });
            continue;
        };

        pdag.set_root(root_idx)
            .map_err(|e| format!("BDD root error for '{}': {}", seq_id, e))?;
        pdag.compute_ordering_and_modules()
            .map_err(|e| format!("BDD ordering failed for '{}': {}", seq_id, e))?;
        let (mut bdd, bdd_root) = BddEngine::build_from_pdag(&pdag)
            .map_err(|e| format!("BDD build failed for '{}': {}", seq_id, e))?;

        let exact_prob = bdd.probability(bdd_root);
        bdd.freeze();

        let event_names = event_names_from_pdag(&pdag);
        let (zbdd, zbdd_root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, false);

        intermediates.push(SequenceIntermediate {
            seq_id: seq_id.clone(),
            event_names,
            zbdd,
            zbdd_root,
            probability: exact_prob,
            ie_frequency,
            is_unconditional: false,
        });
    }

    // Show combined metadata
    let mut meta_entries: Vec<ZbddSequenceMetadata> = Vec::new();
    for im in &intermediates {
        if im.is_unconditional {
            meta_entries.push(ZbddSequenceMetadata::from_stats(
                im.seq_id.clone(),
                im.probability * im.ie_frequency,
                HashMap::new(),
                im.ie_frequency,
            ));
        } else {
            let raw_stats = im.zbdd.stats_by_order(im.zbdd_root);
            meta_entries.push(ZbddSequenceMetadata::from_stats(
                im.seq_id.clone(),
                im.probability * im.ie_frequency,
                raw_stats,
                im.ie_frequency,
            ));
        }
    }
    display_zbdd_metadata(&meta_entries);

    // Prompt once for limits
    let (limit_order, cut_off) = prompt_for_limits();

    // Second pass: apply filters and materialize (last step)
    let mut sequences: Vec<EventTreeAnalyticSequence> = Vec::new();
    for mut im in intermediates {
        let (filtered_root, cut_sets) = if im.is_unconditional {
            (im.zbdd_root, Vec::new())
        } else {
            let fr = apply_zbdd_filters_et(&mut im.zbdd, im.zbdd_root, limit_order, cut_off);
            let cs = enumerate_cut_sets_et(&im.zbdd, fr, &im.event_names);
            (fr, cs)
        };

        let order_dist = if im.is_unconditional {
            let mut m = HashMap::new();
            m.insert(0usize, 1u64);
            m
        } else {
            im.zbdd.count_by_order(filtered_root)
        };

        sequences.push(EventTreeAnalyticSequence {
            sequence_id: im.seq_id,
            path: vec![],
            probability: im.probability,
            frequency: im.probability * im.ie_frequency,
            cut_sets,
            order_dist,
        });
    }

    Ok(sequences)
}

fn analytic_zbdd_wf2_approx_no_limits(
    cli: &Args,
    model: &praxis::core::model::Model,
    event_tree: &praxis::core::event_tree::EventTree,
    event_tree_library: &HashMap<String, praxis::core::event_tree::EventTree>,
    _ie: &InitiatingEvent,
    ie_frequency: f64,
    _verbose: bool,
) -> Result<Vec<EventTreeAnalyticSequence>, Box<dyn std::error::Error>> {
    let praxis::analysis::sequence_formula::SequenceFormulas {
        mut pdag,
        sequence_roots,
        unconditional,
        ie_frequency: _,
    } = SequenceFormulaBuilder::new(model)
        .with_event_tree_library(event_tree_library)
        .build(event_tree, ie_frequency)
        .map_err(|e| format!("Sequence formula construction failed for '{}': {}", event_tree.id, e))?;

    let mut all_seq_ids: Vec<String> = sequence_roots.keys().cloned().collect();
    for id in &unconditional {
        if !sequence_roots.contains_key(id.as_str()) {
            all_seq_ids.push(id.clone());
        }
    }
    all_seq_ids.sort();

    let mut intermediates: Vec<SequenceIntermediate> = Vec::new();

    for seq_id in &all_seq_ids {
        if unconditional.contains(seq_id) {
            intermediates.push(SequenceIntermediate {
                seq_id: seq_id.clone(),
                event_names: Vec::new(),
                zbdd: ZbddEngine::new(),
                zbdd_root: praxis::algorithms::zbdd_engine::ZBDD_BASE,
                probability: 1.0,
                ie_frequency,
                is_unconditional: true,
            });
            continue;
        }
        let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) else {
            intermediates.push(SequenceIntermediate {
                seq_id: seq_id.clone(),
                event_names: Vec::new(),
                zbdd: ZbddEngine::new(),
                zbdd_root: praxis::algorithms::zbdd_engine::ZBDD_EMPTY,
                probability: 0.0,
                ie_frequency,
                is_unconditional: false,
            });
            continue;
        };

        pdag.set_root(root_idx)
            .map_err(|e| format!("BDD root error for '{}': {}", seq_id, e))?;
        pdag.compute_ordering_and_modules()
            .map_err(|e| format!("BDD ordering failed for '{}': {}", seq_id, e))?;
        let (mut bdd, bdd_root) = BddEngine::build_from_pdag(&pdag)
            .map_err(|e| format!("BDD build failed for '{}': {}", seq_id, e))?;
        bdd.freeze();

        let event_names = event_names_from_pdag(&pdag);
        let (zbdd, zbdd_root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, false);
        let approx_prob = compute_approx_et(&zbdd, zbdd_root, cli.approximation);

        intermediates.push(SequenceIntermediate {
            seq_id: seq_id.clone(),
            event_names,
            zbdd,
            zbdd_root,
            probability: approx_prob,
            ie_frequency,
            is_unconditional: false,
        });
    }

    // Show combined metadata
    let mut meta_entries: Vec<ZbddSequenceMetadata> = Vec::new();
    for im in &intermediates {
        if im.is_unconditional {
            meta_entries.push(ZbddSequenceMetadata::from_stats(
                im.seq_id.clone(),
                im.probability * im.ie_frequency,
                HashMap::new(),
                im.ie_frequency,
            ));
        } else {
            let raw_stats = im.zbdd.stats_by_order(im.zbdd_root);
            meta_entries.push(ZbddSequenceMetadata::from_stats(
                im.seq_id.clone(),
                im.probability * im.ie_frequency,
                raw_stats,
                im.ie_frequency,
            ));
        }
    }
    display_zbdd_metadata(&meta_entries);

    let (limit_order, cut_off) = prompt_for_limits();

    let mut sequences: Vec<EventTreeAnalyticSequence> = Vec::new();
    for mut im in intermediates {
        let (final_prob, filtered_root, cut_sets) = if im.is_unconditional {
            (1.0, im.zbdd_root, Vec::new())
        } else {
            let fr = apply_zbdd_filters_et(&mut im.zbdd, im.zbdd_root, limit_order, cut_off);
            let final_p = if limit_order.is_some() || cut_off.is_some() {
                compute_approx_et(&im.zbdd, fr, cli.approximation)
            } else {
                im.probability
            };
            let cs = enumerate_cut_sets_et(&im.zbdd, fr, &im.event_names);
            (final_p, fr, cs)
        };

        let order_dist = if im.is_unconditional {
            let mut m = HashMap::new();
            m.insert(0usize, 1u64);
            m
        } else {
            im.zbdd.count_by_order(filtered_root)
        };

        sequences.push(EventTreeAnalyticSequence {
            sequence_id: im.seq_id,
            path: vec![],
            probability: final_prob,
            frequency: final_prob * im.ie_frequency,
            cut_sets,
            order_dist,
        });
    }

    Ok(sequences)
}

fn analytic_zbdd_wf3_no_approx_limits(
    cli: &Args,
    model: &praxis::core::model::Model,
    event_tree: &praxis::core::event_tree::EventTree,
    event_tree_library: &HashMap<String, praxis::core::event_tree::EventTree>,
    _ie: &InitiatingEvent,
    ie_frequency: f64,
    _verbose: bool,
) -> Result<Vec<EventTreeAnalyticSequence>, Box<dyn std::error::Error>> {
    let limit_order = cli.limit_order.map(|n| n as usize);
    let cut_off = cli.cut_off;

    let praxis::analysis::sequence_formula::SequenceFormulas {
        mut pdag,
        sequence_roots,
        unconditional,
        ie_frequency: _,
    } = SequenceFormulaBuilder::new(model)
        .with_event_tree_library(event_tree_library)
        .build(event_tree, ie_frequency)
        .map_err(|e| format!("Sequence formula construction failed for '{}': {}", event_tree.id, e))?;

    let mut all_seq_ids: Vec<String> = sequence_roots.keys().cloned().collect();
    for id in &unconditional {
        if !sequence_roots.contains_key(id.as_str()) {
            all_seq_ids.push(id.clone());
        }
    }
    all_seq_ids.sort();

    let mut sequences: Vec<EventTreeAnalyticSequence> = Vec::new();

    for seq_id in &all_seq_ids {
        if unconditional.contains(seq_id) {
            let mut m = HashMap::new();
            m.insert(0usize, 1u64);
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 1.0,
                frequency: ie_frequency,
                cut_sets: Vec::new(),
                order_dist: m,
            });
            continue;
        }
        let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) else {
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 0.0,
                frequency: 0.0,
                cut_sets: Vec::new(),
                order_dist: HashMap::new(),
            });
            continue;
        };

        pdag.set_root(root_idx)
            .map_err(|e| format!("BDD root error for '{}': {}", seq_id, e))?;
        pdag.compute_ordering_and_modules()
            .map_err(|e| format!("BDD ordering failed for '{}': {}", seq_id, e))?;
        let (mut bdd, bdd_root) = BddEngine::build_from_pdag(&pdag)
            .map_err(|e| format!("BDD build failed for '{}': {}", seq_id, e))?;

        let exact_prob = bdd.probability(bdd_root);
        bdd.freeze();

        let event_names = event_names_from_pdag(&pdag);
        let (zbdd, zbdd_root) =
            ZbddEngine::build_from_bdd_with_limits(&bdd, bdd_root, false, limit_order, cut_off);

        let order_dist = zbdd.count_by_order(zbdd_root);
        let cut_sets = enumerate_cut_sets_et(&zbdd, zbdd_root, &event_names);

        sequences.push(EventTreeAnalyticSequence {
            sequence_id: seq_id.clone(),
            path: vec![],
            probability: exact_prob,
            frequency: exact_prob * ie_frequency,
            cut_sets,
            order_dist,
        });
    }

    Ok(sequences)
}

fn analytic_zbdd_wf4_approx_limits(
    cli: &Args,
    model: &praxis::core::model::Model,
    event_tree: &praxis::core::event_tree::EventTree,
    event_tree_library: &HashMap<String, praxis::core::event_tree::EventTree>,
    _ie: &InitiatingEvent,
    ie_frequency: f64,
    _verbose: bool,
) -> Result<Vec<EventTreeAnalyticSequence>, Box<dyn std::error::Error>> {
    let limit_order = cli.limit_order.map(|n| n as usize);
    let cut_off = cli.cut_off;

    let praxis::analysis::sequence_formula::SequenceFormulas {
        mut pdag,
        sequence_roots,
        unconditional,
        ie_frequency: _,
    } = SequenceFormulaBuilder::new(model)
        .with_event_tree_library(event_tree_library)
        .build(event_tree, ie_frequency)
        .map_err(|e| format!("Sequence formula construction failed for '{}': {}", event_tree.id, e))?;

    let mut all_seq_ids: Vec<String> = sequence_roots.keys().cloned().collect();
    for id in &unconditional {
        if !sequence_roots.contains_key(id.as_str()) {
            all_seq_ids.push(id.clone());
        }
    }
    all_seq_ids.sort();

    let mut sequences: Vec<EventTreeAnalyticSequence> = Vec::new();

    for seq_id in &all_seq_ids {
        if unconditional.contains(seq_id) {
            let mut m = HashMap::new();
            m.insert(0usize, 1u64);
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 1.0,
                frequency: ie_frequency,
                cut_sets: Vec::new(),
                order_dist: m,
            });
            continue;
        }
        let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) else {
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 0.0,
                frequency: 0.0,
                cut_sets: Vec::new(),
                order_dist: HashMap::new(),
            });
            continue;
        };

        pdag.set_root(root_idx)
            .map_err(|e| format!("BDD root error for '{}': {}", seq_id, e))?;
        pdag.compute_ordering_and_modules()
            .map_err(|e| format!("BDD ordering failed for '{}': {}", seq_id, e))?;
        let (mut bdd, bdd_root) = BddEngine::build_from_pdag(&pdag)
            .map_err(|e| format!("BDD build failed for '{}': {}", seq_id, e))?;
        bdd.freeze();

        let (zbdd, zbdd_root) =
            ZbddEngine::build_from_bdd_with_limits(&bdd, bdd_root, false, limit_order, cut_off);

        let event_names = event_names_from_pdag(&pdag);
        let approx_prob = compute_approx_et(&zbdd, zbdd_root, cli.approximation);
        let order_dist = zbdd.count_by_order(zbdd_root);
        let cut_sets = enumerate_cut_sets_et(&zbdd, zbdd_root, &event_names);

        sequences.push(EventTreeAnalyticSequence {
            sequence_id: seq_id.clone(),
            path: vec![],
            probability: approx_prob,
            frequency: approx_prob * ie_frequency,
            cut_sets,
            order_dist,
        });
    }

    Ok(sequences)
}

// ---------------------------------------------------------------------------
// Monte Carlo event tree
// ---------------------------------------------------------------------------

fn run_monte_carlo_impl(
    cli: &Args,
    model: praxis::core::model::Model,
    initiating_events: Vec<InitiatingEvent>,
    event_trees: Vec<praxis::core::event_tree::EventTree>,
    event_tree_library: HashMap<String, praxis::core::event_tree::EventTree>,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if cli.validate {
        if verbose {
            eprintln!("Validation successful - input file is valid OpenPSA MEF format");
        }
        return Ok(());
    }

    if verbose {
        eprintln!(
            "Parsed model with {} fault trees",
            model.fault_trees().len()
        );
        eprintln!("Initiating events: {}", initiating_events.len());
        eprintln!("Event trees: {}", event_trees.len());
    }

    let mut computed_event_tree_monte_carlo: Vec<EventTreeMonteCarloReport> = Vec::new();
    let auto_cuda_num_trials = !cli.optimize
        && matches!((cli.iterations, cli.batches, cli.bitpacks_per_batch), (None, None, None))
        && matches!(cli.backend.unwrap_or(Backend::Cpu), Backend::Cuda);

    let auto_cuda_node_count = if auto_cuda_num_trials {
        Some(estimate_model_nodes(&model))
    } else {
        None
    };

    let pairs = select_event_trees_to_run(&initiating_events, &event_trees)?;

    if cli.visualize {
        let graphviz_ok = praxis::analysis::visualize::graphviz_available();
        if !graphviz_ok {
            eprintln!("Warning: Graphviz 'dot' not found in PATH. SVG output skipped.");
        }
        for (ie, event_tree) in &pairs {
            let et_dot = praxis::analysis::visualize::generate_event_tree_dot(event_tree, &ie.id);
            if cli.visualize_stdout {
                println!("{}", et_dot);
            }
            if graphviz_ok {
                let tree_path = cli.visualize_out_dir.join(format!("{}_tree.svg", event_tree.id));
                if let Err(e) = praxis::analysis::visualize::save_svg(&et_dot, &tree_path) {
                    eprintln!("Warning: Failed to save event tree diagram: {}", e);
                } else if verbose {
                    eprintln!("Saved event tree diagram to {}", tree_path.display());
                }
            }
        }
    }

    for (ie, event_tree) in pairs {
        let backend = cli.backend.unwrap_or(Backend::Cpu);
        let explicit_params: Option<RunParams> = if cli.optimize || auto_cuda_num_trials {
            let node_count = auto_cuda_node_count.unwrap_or_else(|| estimate_model_nodes(&model));
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
                    Some(RunParams::new(
                        t,
                        b,
                        p,
                        RunParams::DEFAULT_OMEGA,
                        cli.seed,
                    ))
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
            eprintln!("\nRunning event-tree Monte Carlo simulation...");
            eprintln!("Trials: {}", effective_trials);
            eprintln!("Seed: {}", cli.seed);
            if cli.optimize {
                if let Some(params) = explicit_params {
                    let backend_name = match backend {
                        Backend::Cpu => "CPU",
                        Backend::Cuda => "CUDA",
                        Backend::Wgpu => "WGPU",
                    };
                    eprintln!(
                        "{} optimize enabled: T={}, B={}, P={}, omega={} (auto-sized)",
                        backend_name, params.t, params.b, params.p, params.omega
                    );
                }
            } else if auto_cuda_num_trials {
                if let Some(params) = explicit_params {
                    eprintln!(
                        "CUDA num-trials auto-optimized: T={}, B={}, P={}, omega={} (auto-sized)",
                        params.t, params.b, params.p, params.omega
                    );
                }
            }
        }

        let mc_analysis = if let Some(params) = explicit_params {
            DpEventTreeMonteCarloAnalysis::with_run_params(
                ie.clone(),
                event_tree.clone(),
                &model,
                params,
            )?
        } else {
            DpEventTreeMonteCarloAnalysis::new(
                ie.clone(),
                event_tree.clone(),
                &model,
                Some(cli.seed),
                cli.num_trials as usize,
            )?
        }
        .with_event_tree_library(&event_tree_library);

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

        let (backend_used, mc_result) = match backend {
            Backend::Cpu => {
                if verbose {
                    eprintln!("Running event-tree Monte Carlo on CPU...");
                }
                let start = std::time::Instant::now();
                let result = mc_analysis
                    .run_cpu_with_watch_and_convergence(cli.watch, convergence)
                    .map_err(|e| format!("Event tree Monte Carlo failed: {}", e))?;
                if verbose {
                    eprintln!("CPU execution time: {:.3}s", start.elapsed().as_secs_f64());
                }
                ("cpu".to_string(), result)
            }
            Backend::Cuda => {
                #[cfg(feature = "cuda")]
                {
                    if verbose {
                        eprintln!("Running event-tree Monte Carlo on GPU (CUDA)...");
                    }
                    let start = std::time::Instant::now();
                    let device = Default::default();
                    let result = mc_analysis
                        .run_gpu_with_watch_and_convergence::<CudaRuntime>(
                            &device,
                            cli.watch,
                            convergence,
                        )
                        .map_err(|e| format!("Event tree Monte Carlo failed: {}", e))?;
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
                        eprintln!("Running event-tree Monte Carlo on GPU (WGPU)...");
                    }
                    let start = std::time::Instant::now();
                    let device = Default::default();
                    let result = mc_analysis
                        .run_gpu_with_watch_and_convergence::<WgpuRuntime>(
                            &device,
                            cli.watch,
                            convergence,
                        )
                        .map_err(|e| format!("Event tree Monte Carlo failed: {}", e))?;
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

        if cli.print || verbose {
            println!("\n=== Event Tree Monte Carlo Results ===");
            println!("Event Tree: {}", event_tree.id);
            println!("Initiating Event: {}", ie.id);
            println!("Number of Trials: {}", mc_result.num_trials);
            if let Some(prob) = ie.probability {
                println!("IE Probability: {:.6e}", prob);
            }
            if let Some(freq) = ie.frequency {
                println!("IE Frequency: {:.6e} /year", freq);
            }
            println!("\nSequences:");
            println!(
                "{:<20} {:<15} {:<15} {:<12}",
                "Sequence ID", "Probability", "Frequency", "Successes"
            );
            println!("{}", "-".repeat(70));

            for seq in &mc_result.sequences {
                println!(
                    "{:<20} {:<15.6e} {:<15.6e} {}/{}",
                    seq.sequence.id,
                    seq.probability_estimate,
                    seq.frequency_estimate,
                    seq.successes,
                    seq.num_trials
                );
            }
            println!("====================================\n");
        }

        let run_params_for_report = if let Some(params) = explicit_params {
            Some(params)
        } else {
            choose_run_params_for_num_trials(cli.num_trials as usize, cli.seed)
                .ok()
                .map(|layout| layout.params)
        };

        let cfg = praxis::mc::core::MonteCarloRunConfig {
            engine: "dpmc".to_string(),
            target: "event-tree".to_string(),
            backend_requested,
            backend_used: backend_used.clone(),
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
        };

        computed_event_tree_monte_carlo.push(EventTreeMonteCarloReport {
            event_tree_id: event_tree.id.clone(),
            initiating_event_id: ie.id.clone(),
            initiating_event_probability: ie.probability,
            initiating_event_frequency: ie.frequency,
            monte_carlo: mc_result.clone(),
            monte_carlo_config: Some(cfg),
        });
    }

    let dummy_ft_id = event_trees
        .first()
        .map(|et| et.id.as_str())
        .unwrap_or("event-tree");
    let dummy_fault_tree = FaultTree::new(dummy_ft_id, dummy_ft_id)?;
    let dummy_result = praxis::analysis::fault_tree::AnalysisResult {
        top_event_probability: 0.0,
        gates_analyzed: 0,
        basic_events_count: 0,
    };

    let total_gates: usize = model.fault_trees().values().map(|ft| ft.gates().len()).sum();
    let total_basic_events: usize = model.basic_events().len();

    let report = AnalysisReport::new(dummy_result)
        .without_fault_tree_analysis()
        .with_model_features(total_gates, total_basic_events)
        .with_event_tree_monte_carlo(computed_event_tree_monte_carlo);

    if let Some(ref output_path) = cli.output_file {
        if verbose {
            eprintln!("Writing results to: {}", output_path.display());
        }
        let mut writer = writer_vec();
        write_comprehensive_report(&mut writer, &dummy_fault_tree, &report)?;
        let xml_output = String::from_utf8(writer.into_inner())
            .map_err(|e| format!("Failed to convert XML to string: {}", e))?;
        fs::write(output_path, xml_output)
            .map_err(|e| format!("Failed to write output file: {}", e))?;
        if verbose {
            eprintln!("Results written successfully");
        }
    }

    if !cli.print && cli.output_file.is_none() {
        let mut writer = writer_stdout();
        write_comprehensive_report(&mut writer, &dummy_fault_tree, &report)?;
    }

    Ok(())
}

pub fn run_monte_carlo_from_parsed(
    cli: &Args,
    parsed: &EventTreeModel,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let (model, initiating_events, event_trees, event_tree_library) =
        parse_model_with_libs_from_parsed(parsed)?;
    run_monte_carlo_impl(
        cli,
        model,
        initiating_events,
        event_trees,
        event_tree_library,
        verbose,
    )
}

// ---------------------------------------------------------------------------
// Analytic dispatcher (BDD and ZBDD)
// ---------------------------------------------------------------------------

fn run_analytic_impl(
    cli: &Args,
    model: praxis::core::model::Model,
    initiating_events: Vec<InitiatingEvent>,
    event_trees: Vec<praxis::core::event_tree::EventTree>,
    event_tree_library: HashMap<String, praxis::core::event_tree::EventTree>,
    algorithm: Algorithm,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if cli.validate {
        if verbose {
            eprintln!("Validation successful - input file is valid OpenPSA MEF format");
        }
        return Ok(());
    }

    if verbose {
        eprintln!(
            "Parsed model with {} fault trees",
            model.fault_trees().len()
        );
        eprintln!("Initiating events: {}", initiating_events.len());
        eprintln!("Event trees: {}", event_trees.len());
    }

    let algorithm_name = match algorithm {
        Algorithm::Bdd => "bdd",
        Algorithm::Zbdd => "zbdd",
        _ => "bdd",
    };

    let pairs = select_event_trees_to_run(&initiating_events, &event_trees)?;
    let mut analytic_reports: Vec<EventTreeAnalyticReport> = Vec::new();

    let mut all_event_probs: HashMap<String, f64> = HashMap::new();
    for ft in model.fault_trees().values() {
        for (id, ev) in ft.basic_events() {
            all_event_probs.insert(id.clone(), ev.probability());
        }
    }

    for (ie, event_tree) in pairs {
        if verbose {
            eprintln!(
                "\nRunning analytic event-tree analysis ({}) for '{}'...",
                algorithm_name, event_tree.id
            );
        }

        let ie_frequency = ie.frequency.unwrap_or(1.0);

        if cli.visualize {
            let et_dot = praxis::analysis::visualize::generate_event_tree_dot(&event_tree, &ie.id);
            if cli.visualize_stdout {
                println!("{}", et_dot);
            }
            if praxis::analysis::visualize::graphviz_available() {
                let tree_path = cli.visualize_out_dir.join(format!("{}_tree.svg", event_tree.id));
                if let Err(e) = praxis::analysis::visualize::save_svg(&et_dot, &tree_path) {
                    eprintln!("Warning: Failed to save event tree diagram: {}", e);
                } else if verbose {
                    eprintln!("Saved event tree diagram to {}", tree_path.display());
                }
            } else {
                eprintln!("Warning: Graphviz 'dot' not found in PATH. SVG output skipped.");
            }
        }

        let sequences: Vec<EventTreeAnalyticSequence> = if algorithm == Algorithm::Zbdd {
            let has_limits = cli.limit_order.is_some() || cli.cut_off.is_some();
            let has_approx = cli.approximation.is_some();

            match (has_approx, has_limits) {
                (false, false) => analytic_zbdd_wf1_no_approx_no_limits(
                    cli,
                    &model,
                    &event_tree,
                    &event_tree_library,
                    &ie,
                    ie_frequency,
                    verbose,
                )?,
                (true, false) => analytic_zbdd_wf2_approx_no_limits(
                    cli,
                    &model,
                    &event_tree,
                    &event_tree_library,
                    &ie,
                    ie_frequency,
                    verbose,
                )?,
                (false, true) => analytic_zbdd_wf3_no_approx_limits(
                    cli,
                    &model,
                    &event_tree,
                    &event_tree_library,
                    &ie,
                    ie_frequency,
                    verbose,
                )?,
                (true, true) => analytic_zbdd_wf4_approx_limits(
                    cli,
                    &model,
                    &event_tree,
                    &event_tree_library,
                    &ie,
                    ie_frequency,
                    verbose,
                )?,
            }
        } else {
            // BDD exact path
            let praxis::analysis::sequence_formula::SequenceFormulas {
                mut pdag,
                sequence_roots,
                unconditional,
                ie_frequency: _,
            } = SequenceFormulaBuilder::new(&model)
                .with_event_tree_library(&event_tree_library)
                .build(&event_tree, ie_frequency)
                .map_err(|e| format!("Sequence formula construction failed for '{}': {}", event_tree.id, e))?;

            let mut all_seq_ids: Vec<String> = sequence_roots.keys().cloned().collect();
            for id in &unconditional {
                if !sequence_roots.contains_key(id.as_str()) {
                    all_seq_ids.push(id.clone());
                }
            }
            all_seq_ids.sort();

            let mut seqs: Vec<EventTreeAnalyticSequence> = Vec::new();
            for seq_id in &all_seq_ids {
                let probability = if unconditional.contains(seq_id) {
                    1.0
                } else if let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) {
                    pdag.set_root(root_idx)
                        .map_err(|e| format!("BDD root error for '{}': {}", seq_id, e))?;
                    pdag.compute_ordering_and_modules()
                        .map_err(|e| format!("BDD ordering failed for '{}': {}", seq_id, e))?;
                    let (bdd, bdd_root) = BddEngine::build_from_pdag(&pdag)
                        .map_err(|e| format!("BDD build failed for '{}': {}", seq_id, e))?;
                    bdd.probability(bdd_root)
                } else {
                    0.0
                };
                seqs.push(EventTreeAnalyticSequence {
                    sequence_id: seq_id.clone(),
                    path: vec![],
                    probability,
                    frequency: probability * ie_frequency,
                    cut_sets: Vec::new(),
                    order_dist: HashMap::new(),
                });
            }
            seqs
        };

        if cli.print || verbose {
            println!("\n=== Event Tree Analytic Results ===");
            println!("Event Tree: {}", event_tree.id);
            println!("Initiating Event: {}", ie.id);
            println!("Algorithm: {}", algorithm_name);
            if let Some(prob) = ie.probability {
                println!("IE Probability: {:.6e}", prob);
            }
            if let Some(freq) = ie.frequency {
                println!("IE Frequency: {:.6e} /year", freq);
            }
            println!("\nSequences:");
            println!(
                "{:<20} {:<15} {:<15}",
                "Sequence ID", "Probability", "Frequency"
            );
            println!("{}", "-".repeat(55));
            for seq in &sequences {
                println!(
                    "{:<20} {:<15.6e} {:<15.6e}",
                    seq.sequence_id, seq.probability, seq.frequency
                );
            }
            println!("===================================");

            let has_stats = sequences.iter().any(|s| !s.order_dist.is_empty());
            if has_stats {
                println!("\n=== Minimal Cut Sets per Sequence ===");
                for seq in &sequences {
                    if seq.order_dist.is_empty() {
                        continue;
                    }
                    let total: u64 = seq.order_dist.values().sum();
                    let mut orders: Vec<_> = seq.order_dist.keys().cloned().collect();
                    orders.sort();
                    let dist: Vec<String> = orders
                        .iter()
                        .map(|o| format!("order-{}: {}", o, seq.order_dist[o]))
                        .collect();
                    println!(
                        "  {:<18} total={:<5} [{}]",
                        seq.sequence_id,
                        total,
                        dist.join(", ")
                    );
                }
                println!("=====================================\n");
            } else {
                println!();
            }
        }

        analytic_reports.push(EventTreeAnalyticReport {
            event_tree_id: event_tree.id.clone(),
            initiating_event_id: ie.id.clone(),
            initiating_event_probability: ie.probability,
            initiating_event_frequency: ie.frequency,
            algorithm: algorithm_name.to_string(),
            sequences,
        });
    }

    let dummy_ft_id = event_trees
        .first()
        .map(|et| et.id.as_str())
        .unwrap_or("event-tree");
    let dummy_fault_tree = FaultTree::new(dummy_ft_id, dummy_ft_id)?;
    let dummy_result = praxis::analysis::fault_tree::AnalysisResult {
        top_event_probability: 0.0,
        gates_analyzed: 0,
        basic_events_count: 0,
    };

    let total_gates: usize = model.fault_trees().values().map(|ft| ft.gates().len()).sum();
    let total_basic_events: usize = model.basic_events().len();

    let report = AnalysisReport::new(dummy_result)
        .without_fault_tree_analysis()
        .with_model_features(total_gates, total_basic_events)
        .with_event_tree_analytic(analytic_reports);

    if let Some(ref output_path) = cli.output_file {
        if verbose {
            eprintln!("Writing results to: {}", output_path.display());
        }
        let mut writer = writer_vec();
        write_comprehensive_report(&mut writer, &dummy_fault_tree, &report)?;
        let xml_output = String::from_utf8(writer.into_inner())
            .map_err(|e| format!("Failed to convert XML to string: {}", e))?;
        fs::write(output_path, xml_output)
            .map_err(|e| format!("Failed to write output file: {}", e))?;
        if verbose {
            eprintln!("Results written successfully");
        }
    }

    if !cli.print && cli.output_file.is_none() {
        let mut writer = writer_stdout();
        write_comprehensive_report(&mut writer, &dummy_fault_tree, &report)?;
    }

    Ok(())
}

pub fn run_analytic_from_parsed(
    cli: &Args,
    parsed: &EventTreeModel,
    algorithm: Algorithm,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let (model, initiating_events, event_trees, event_tree_library) =
        parse_model_with_libs_from_parsed(parsed)?;
    run_analytic_impl(
        cli,
        model,
        initiating_events,
        event_trees,
        event_tree_library,
        algorithm,
        verbose,
    )
}

fn select_event_trees_to_run(
    initiating_events: &[InitiatingEvent],
    event_trees: &[praxis::core::event_tree::EventTree],
) -> Result<Vec<(InitiatingEvent, praxis::core::event_tree::EventTree)>, Box<dyn std::error::Error>>
{
    let mut seen_et_ids: HashSet<String> = HashSet::new();
    let mut referenced: Vec<(InitiatingEvent, praxis::core::event_tree::EventTree)> = Vec::new();
    for ie in initiating_events {
        let Some(et_id) = &ie.event_tree_id else {
            continue;
        };
        if !seen_et_ids.insert(et_id.clone()) {
            continue;
        }
        let et = event_trees
            .iter()
            .find(|et| &et.id == et_id)
            .ok_or_else(|| anyhow::anyhow!("Initiating event '{}' references missing event tree '{}'", ie.id, et_id))?;
        referenced.push((ie.clone(), et.clone()));
    }
    if !referenced.is_empty() {
        return Ok(referenced);
    }

    let pairs = event_trees
        .iter()
        .enumerate()
        .map(|(et_idx, event_tree)| {
            let ie = if !initiating_events.is_empty() {
                initiating_events[et_idx.min(initiating_events.len() - 1)].clone()
            } else {
                InitiatingEvent::new("default-ie".to_string())
            };
            (ie, event_tree.clone())
        })
        .collect();
    Ok(pairs)
}
