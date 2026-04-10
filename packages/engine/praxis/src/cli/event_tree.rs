use crate::cli::args::{Args, Backend};
use crate::cli::optimize::{
    estimate_model_nodes, optimize_run_params_for_cpu, optimize_run_params_for_cuda,
};
use crate::cli::output::{writer_stdout, writer_vec};
use praxis::core::event_tree::InitiatingEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::io::event_tree_parser::EventTreeModel;
use praxis::io::reporter::{write_comprehensive_report, AnalysisReport, EventTreeMonteCarloReport};
use praxis::mc::core::ConvergenceSettings;
use praxis::mc::plan::{choose_run_params_for_num_trials, RunParams};
use praxis::mc::DpEventTreeMonteCarloAnalysis;
use std::collections::HashMap;
use std::collections::HashSet;
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
