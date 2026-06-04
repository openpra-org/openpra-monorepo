use crate::cli::args::{Algorithm, Args, Backend, InputFormat, OutputFormat, Vrt};
use crate::cli::event_tree;
use crate::cli::fault_tree;
use crate::cli::output::{write_text_output, writer_stdout, writer_vec};
use praxis::openpra_mef::contracts::ResolveMode;
use praxis::openpra_mef::serialize::json_contract_in::render_openpra_contract_value;
use praxis::openpra_mef::napi::{
    quantify_openpra_json_contract, validate_openpra_json_contract,
};
use praxis::openpra_mef::addon_openpsa_xml::parse_openpsa_xml_with_mode;
use praxis::io::reporter::{write_comprehensive_report, AnalysisReport, EventTreeMonteCarloReport};
use praxis::io::parser::{parse_any_mef, ParsedInput};
use praxis::io::serializer::{write_results, write_results_with_monte_carlo};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ResolvedFormat {
    Xml,
    Json,
}

fn resolve_input_format(path: &Path, content: &str, configured: InputFormat) -> ResolvedFormat {
    match configured {
        InputFormat::Xml => ResolvedFormat::Xml,
        InputFormat::Json => ResolvedFormat::Json,
        InputFormat::Auto => {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                match ext.to_ascii_lowercase().as_str() {
                    "json" => return ResolvedFormat::Json,
                    "xml" => return ResolvedFormat::Xml,
                    _ => {}
                }
            }

            if let Some(first) = content.chars().find(|c| !c.is_whitespace()) {
                if matches!(first, '{' | '[') {
                    return ResolvedFormat::Json;
                }
            }

            ResolvedFormat::Xml
        }
    }
}

fn resolve_output_format(configured: OutputFormat, input: ResolvedFormat) -> ResolvedFormat {
    match configured {
        OutputFormat::Auto => input,
        OutputFormat::Xml => ResolvedFormat::Xml,
        OutputFormat::Json => ResolvedFormat::Json,
    }
}

fn run_openpra_json(cli: &Args, json_content: &str) -> Result<(), Box<dyn std::error::Error>> {
    if cli.algorithm != Algorithm::MonteCarlo && !cli.validate {
        eprintln!(
            "error: OpenPRA JSON inputs currently require '--algorithm monte-carlo' (or use '--validate' only)"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    let output_json = if cli.validate {
        validate_openpra_json_contract(json_content)?
    } else {
        quantify_openpra_json_contract(json_content, ResolveMode::Compatible)?
    };

    write_text_output(cli.output_file.as_ref(), &output_json)?;
    Ok(())
}

fn run_openpsa_xml_convert_to_openpra_json(
    cli: &Args,
    xml_content: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let bundle = parse_openpsa_xml_with_mode(xml_content, ResolveMode::Compatible)
        .map_err(|err| format!("OpenPSA XML conversion failed: {err}"))?;

    let Some(model) = bundle.model.as_ref() else {
        return Err("OpenPSA XML conversion did not yield an OpenPRA model".into());
    };

    if bundle
        .diagnostics
        .iter()
        .any(|d| d.severity == praxis::openpra_mef::Severity::Error)
    {
        return Err("OpenPSA XML conversion produced error diagnostics".into());
    }

    let contract_value = render_openpra_contract_value(model);
    let rendered = serde_json::to_string_pretty(&contract_value)
        .map_err(|err| format!("Failed to serialize OpenPRA JSON: {err}"))?;
    write_text_output(cli.output_file.as_ref(), &rendered)?;
    Ok(())
}

pub fn run(cli: Args) -> Result<(), Box<dyn std::error::Error>> {
    let verbose = cli.verbosity > 0;
    let verbosity_level = cli.verbosity;

    if cli.approximation.is_some() && !matches!(cli.algorithm, Algorithm::Mocus | Algorithm::Zbdd) {
        eprintln!(
            "error: the argument '--approximation <APPROXIMATION>' can only be used with '--algorithm mocus' or '--algorithm zbdd'"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.backend.is_some() && cli.algorithm != Algorithm::MonteCarlo {
        eprintln!(
            "error: the argument '--backend <BACKEND>' can only be used with '--algorithm monte-carlo'"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.watch && cli.algorithm != Algorithm::MonteCarlo {
        eprintln!(
            "error: the argument '--watch' can only be used with '--algorithm monte-carlo'"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.optimize && cli.algorithm != Algorithm::MonteCarlo {
        eprintln!(
            "error: the argument '--optimize' can only be used with '--algorithm monte-carlo'"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.optimize && matches!(cli.backend, Some(Backend::Wgpu)) {
        eprintln!(
            "error: the argument '--optimize' is currently supported for '--backend cpu' and '--backend cuda' only"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.optimize
        && (cli.iterations.is_some() || cli.batches.is_some() || cli.bitpacks_per_batch.is_some())
    {
        eprintln!(
            "error: '--optimize' cannot be combined with '--iterations/--batches/--bitpacks-per-batch'"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.early_stop && cli.algorithm != Algorithm::MonteCarlo {
        eprintln!(
            "error: the argument '--early-stop' can only be used with '--algorithm monte-carlo'"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.early_stop {
        if !(cli.delta.is_finite() && cli.delta > 0.0) {
            eprintln!("error: '--delta' must be a finite value > 0");
            eprintln!();
            eprintln!("For more information, try '--help'.");
            std::process::exit(2);
        }
        if !(cli.confidence.is_finite() && cli.confidence > 0.0 && cli.confidence < 1.0) {
            eprintln!("error: '--confidence' must be in the open interval (0, 1)");
            eprintln!();
            eprintln!("For more information, try '--help'.");
            std::process::exit(2);
        }
    }

    if cli.vrt != Vrt::None && cli.algorithm != Algorithm::MonteCarlo {
        eprintln!(
            "error: the argument '--vrt <VRT>' can only be used with '--algorithm monte-carlo'"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.vrt != Vrt::None && cli.early_stop {
        eprintln!("error: '--vrt' cannot be combined with '--early-stop' (not supported yet)");
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.vrt == Vrt::Stratified
        && (cli.iterations.is_some() || cli.batches.is_some() || cli.bitpacks_per_batch.is_some())
    {
        eprintln!(
            "error: '--vrt stratified' cannot be combined with explicit '--iterations/--batches/--bitpacks-per-batch' (use '--num-trials')"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    let analysis_requires_cut_sets = matches!(
        cli.analysis,
        crate::cli::args::Analysis::CutsetsOnly | crate::cli::args::Analysis::CutsetsAndProbability
    );
    if analysis_requires_cut_sets && !matches!(cli.algorithm, Algorithm::Mocus | Algorithm::Zbdd) {
        eprintln!(
            "error: the argument '--analysis <ANALYSIS>' with cut set modes can only be used with '--algorithm mocus' or '--algorithm zbdd'"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.input_file.is_none() {
        eprintln!("Error: No input file specified");
        eprintln!("Usage: praxis <FILE> [OPTIONS]");
        eprintln!("Try 'praxis --help' for more information.");
        std::process::exit(1);
    }

    let input_path = cli
        .input_file
        .as_ref()
        .expect("input_file is required")
        .clone();

    let input_content = fs::read_to_string(&input_path)
        .map_err(|e| format!("Failed to read file '{}': {}", input_path.display(), e))?;

    let input_format = resolve_input_format(&input_path, &input_content, cli.input_format);
    let output_format = resolve_output_format(cli.output_format, input_format);

    if input_format == ResolvedFormat::Json && output_format != ResolvedFormat::Json {
        eprintln!(
            "error: format mismatch: JSON input requires '--output-format json' (or '--output-format auto')"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if input_format == ResolvedFormat::Xml && output_format != ResolvedFormat::Xml {
        if output_format != ResolvedFormat::Json {
            eprintln!(
                "error: format mismatch: XML input supports '--output-format xml' or '--output-format json' (or '--output-format auto')"
            );
            eprintln!();
            eprintln!("For more information, try '--help'.");
            std::process::exit(2);
        }
    }

    if input_format == ResolvedFormat::Json {
        return run_openpra_json(&cli, &input_content);
    }

    if output_format == ResolvedFormat::Json {
        return run_openpsa_xml_convert_to_openpra_json(&cli, &input_content);
    }

    if verbose {
        eprintln!("Loading input file: {}", input_path.display());
        if verbosity_level >= 2 {
            eprintln!("Verbosity level: {}", verbosity_level);
        }
    }

    let parsed_input = parse_any_mef(&input_content)
        .map_err(|e| format!("Failed to parse input file '{}': {}", input_path.display(), e))?;

    let fault_tree_model = match parsed_input {
        ParsedInput::EventTreeModel(event_tree_model) => {
            match cli.algorithm {
                Algorithm::MonteCarlo => {
                    event_tree::run_monte_carlo_from_parsed(&cli, &event_tree_model, verbose)?;
                }
                Algorithm::Bdd | Algorithm::Zbdd => {
                    event_tree::run_analytic_from_parsed(
                        &cli,
                        &event_tree_model,
                        cli.algorithm,
                        verbose,
                    )?;
                }
                Algorithm::Mocus => {
                    if !cli.validate {
                        eprintln!(
                            "error: '--algorithm mocus' is not supported for event-tree inputs"
                        );
                        eprintln!();
                        eprintln!("For more information, try '--help'.");
                        std::process::exit(2);
                    }
                    event_tree::run_analytic_from_parsed(
                        &cli,
                        &event_tree_model,
                        Algorithm::Bdd,
                        verbose,
                    )?;
                }
            }
            return Ok(());
        }
        ParsedInput::FaultTree(fault_tree_model) => fault_tree_model,
    };

    let pre_outcome = fault_tree::run_pre_event_tree_parsed(
        &cli,
        fault_tree_model,
        verbose,
        verbosity_level,
    )?;
    let pre_state = match pre_outcome {
        fault_tree::FaultTreePreOutcome::ExitOk => return Ok(()),
        fault_tree::FaultTreePreOutcome::Continue(state) => *state,
    };

    let outputs = fault_tree::run_post_event_tree(&cli, pre_state, verbose, verbosity_level)?;

    let fault_tree = outputs.fault_tree;
    let result = outputs.result;
    let computed_cut_sets = outputs.computed_cut_sets;
    let computed_monte_carlo = outputs.computed_monte_carlo;
    let computed_monte_carlo_config = outputs.computed_monte_carlo_config;

    let computed_event_tree_monte_carlo: Vec<EventTreeMonteCarloReport> = Vec::new();

    // Write XML output
    if let Some(ref output_path) = cli.output_file {
        if verbose {
            eprintln!("Writing results to: {}", output_path.display());
        }

        let mut writer = writer_vec();

            // Preserve existing OpenPSA-ish output (`write_results`) when possible.
            // If cut sets are available we continue to emit the comprehensive report.
            // If Monte Carlo ran (and cut sets were not computed), embed MC stats into
            // the simple report without requiring any additional flags.
            if computed_cut_sets.is_some() || !computed_event_tree_monte_carlo.is_empty() {
                let mut report = AnalysisReport::new(result.clone());
                if let Some(ref cut_sets) = computed_cut_sets {
                    report = report.with_cut_sets(cut_sets.clone());
                }
                if let Some(ref mc) = computed_monte_carlo {
                    report = report.with_monte_carlo(mc.clone());
                }
                if let Some(ref cfg) = computed_monte_carlo_config {
                    report = report.with_monte_carlo_config(cfg.clone());
                }
                if !computed_event_tree_monte_carlo.is_empty() {
                    report =
                        report.with_event_tree_monte_carlo(computed_event_tree_monte_carlo.clone());
                }
                write_comprehensive_report(&mut writer, &fault_tree, &report)?;
            } else if let Some(ref mc) = computed_monte_carlo {
                write_results_with_monte_carlo(
                    &mut writer,
                    &fault_tree,
                    &result,
                    mc,
                    computed_monte_carlo_config.as_ref(),
                )?;
            } else {
                write_results(&mut writer, &fault_tree, &result)?;
            }

            let xml_output = String::from_utf8(writer.into_inner())
                .map_err(|e| format!("Failed to convert XML to string: {}", e))?;

        fs::write(output_path, xml_output)
            .map_err(|e| format!("Failed to write output file: {}", e))?;

        if verbose {
            eprintln!("Results written successfully");
        }
    }

    // Default: print XML to stdout if no --print and no --output
    if !cli.print && cli.output_file.is_none() {
        let mut writer = writer_stdout();

            if computed_cut_sets.is_some() || !computed_event_tree_monte_carlo.is_empty() {
                let mut report = AnalysisReport::new(result.clone());
                if let Some(ref cut_sets) = computed_cut_sets {
                    report = report.with_cut_sets(cut_sets.clone());
                }
                if let Some(ref mc) = computed_monte_carlo {
                    report = report.with_monte_carlo(mc.clone());
                }
                if let Some(ref cfg) = computed_monte_carlo_config {
                    report = report.with_monte_carlo_config(cfg.clone());
                }
                if !computed_event_tree_monte_carlo.is_empty() {
                    report =
                        report.with_event_tree_monte_carlo(computed_event_tree_monte_carlo.clone());
                }
                write_comprehensive_report(&mut writer, &fault_tree, &report)?;
            } else if let Some(ref mc) = computed_monte_carlo {
                write_results_with_monte_carlo(
                    &mut writer,
                    &fault_tree,
                    &result,
                    mc,
                    computed_monte_carlo_config.as_ref(),
                )?;
            } else {
                write_results(&mut writer, &fault_tree, &result)?;
            }
    }

    Ok(())
}
