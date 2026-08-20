use crate::cli::args::{Algorithm, Args, Backend, CutOffBasis, OutputFormat, Vrt};
use crate::cli::event_tree;
use crate::cli::fault_tree;
use crate::cli::output::{writer_stdout, writer_vec};
use praxis::io::parser::{parse_any_mef, ParsedInput};
use praxis::io::pbf::decode_fault_tree;
use praxis::io::ftc::serialize_saphire_v2;
use praxis::io::reporter::{write_comprehensive_report, AnalysisReport, EventTreeMonteCarloReport};
use praxis::io::serializer::{write_results, write_results_with_monte_carlo};
use std::fs;

pub fn run(cli: Args) -> Result<(), Box<dyn std::error::Error>> {
    let verbose = cli.verbosity > 0;
    let verbosity_level = cli.verbosity;

    if cli.approximation.is_some()
        && !matches!(
            cli.algorithm,
            Algorithm::Mocus | Algorithm::MocusPi | Algorithm::Zbdd | Algorithm::ZbddDelterm
        )
    {
        eprintln!(
            "error: the argument '--approximation <APPROXIMATION>' can only be used with '--algorithm mocus', '--algorithm mocus-pi', '--algorithm zbdd' or '--algorithm zbdd-delterm'"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.cut_off_basis == CutOffBasis::Frequency && cli.cut_off.is_none() {
        eprintln!("error: '--cut-off-basis frequency' requires '--cut-off <CUT_OFF>'");
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.delete_term && cli.complement_unity {
        eprintln!(
            "error: '--delete-term' and '--complement-unity' are two different treatments of a succeeded system; choose one"
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
    if analysis_requires_cut_sets
        && !matches!(
            cli.algorithm,
            Algorithm::Mocus | Algorithm::Zbdd | Algorithm::ZbddDelterm
        )
    {
        eprintln!(
            "error: the argument '--analysis <ANALYSIS>' with cut set modes can only be used with '--algorithm mocus', '--algorithm zbdd' or '--algorithm zbdd-delterm'"
        );
        eprintln!();
        eprintln!("For more information, try '--help'.");
        std::process::exit(2);
    }

    if cli.output_format == OutputFormat::Ftc {
        if !analysis_requires_cut_sets {
            eprintln!("error: '--output-format ftc' requires a cut-set analysis mode");
            eprintln!("Use '--analysis cutsets-only' or '--analysis cutsets-and-probability'.");
            std::process::exit(2);
        }
        if cli.saphire_project.as_deref().is_none_or(str::is_empty) {
            eprintln!("error: '--output-format ftc' requires '--saphire-project <PROJECT>'");
            std::process::exit(2);
        }
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

    let input_bytes = fs::read(&input_path)
        .map_err(|e| format!("Failed to read file '{}': {}", input_path.display(), e))?;

    if verbose {
        eprintln!("Loading input file: {}", input_path.display());
        if verbosity_level >= 2 {
            eprintln!("Verbosity level: {}", verbosity_level);
        }
    }

    let is_pbf = input_bytes.starts_with(b"PBM1")
        || input_path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("pbf"));

    let parsed_input = if is_pbf {
        decode_fault_tree(&input_bytes)
            .map(ParsedInput::FaultTree)
            .map_err(|e| {
                format!(
                    "Failed to parse PBF input file '{}': {}",
                    input_path.display(),
                    e
                )
            })?
    } else {
        let input_content = std::str::from_utf8(&input_bytes).map_err(|e| {
            format!(
                "Failed to decode XML input file '{}' as UTF-8: {}",
                input_path.display(),
                e
            )
        })?;
        parse_any_mef(input_content).map_err(|e| {
            format!(
                "Failed to parse input file '{}': {}",
                input_path.display(),
                e
            )
        })?
    };

    if let Some(request_path) = cli.hcl_request.as_deref() {
        let fault_tree = match parsed_input {
            ParsedInput::FaultTree(fault_tree) => fault_tree,
            ParsedInput::EventTreeModel(_) => {
                return Err("HCL requests currently require a fault-tree input".into());
            }
        };
        return crate::cli::hcl::run_hcl_request(
            &cli,
            fault_tree,
            request_path,
            verbose,
        );
    }

    if cli.widths_only {
        let fault_tree_model = match parsed_input {
            ParsedInput::EventTreeModel(_) => {
                eprintln!("error: --widths-only is supported for fault-tree inputs only");
                eprintln!();
                eprintln!("For more information, try '--help'.");
                std::process::exit(2);
            }
            ParsedInput::FaultTree(fault_tree_model) => fault_tree_model,
        };
        return crate::cli::widths::run_widths_only(&cli, &fault_tree_model, verbose);
    }

    let fault_tree_model = match parsed_input {
        ParsedInput::EventTreeModel(event_tree_model) => {
            if cli.output_format == OutputFormat::Ftc {
                eprintln!("error: '--output-format ftc' is supported for fault-tree inputs only");
                std::process::exit(2);
            }
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
                Algorithm::Mocus | Algorithm::MocusPi | Algorithm::ZbddDelterm => {
                    if !cli.validate {
                        eprintln!(
                            "error: cut-set algorithms (mocus, mocus-pi, zbdd-delterm) are not supported for event-tree inputs"
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
        ParsedInput::FaultTree(fault_tree_model) => {
            if cli.cut_off_basis == CutOffBasis::Frequency {
                eprintln!(
                    "error: '--cut-off-basis frequency' is supported for event-tree inputs only (a fault tree has no initiating-event frequency)"
                );
                eprintln!();
                eprintln!("For more information, try '--help'.");
                std::process::exit(2);
            }
            if cli.delete_term {
                eprintln!(
                    "error: '--delete-term' is supported for event-tree inputs only (a fault tree has no succeeded systems)"
                );
                eprintln!();
                eprintln!("For more information, try '--help'.");
                std::process::exit(2);
            }
            fault_tree_model
        }
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

    if let Some(ref output_path) = cli.output_file {
        if verbose {
            eprintln!("Writing results to: {}", output_path.display());
        }

        if cli.output_format == OutputFormat::Ftc {
            let cut_sets = computed_cut_sets.as_deref().ok_or(
                "FTC output was requested, but the selected analysis did not produce cut sets",
            )?;
            let ftc_output = serialize_saphire_v2(
                cli.saphire_project.as_deref().expect("validated above"),
                fault_tree.element().id(),
                &cli.saphire_analysis,
                cut_sets,
            )?;
            fs::write(output_path, ftc_output)
                .map_err(|e| format!("Failed to write FTC output file: {}", e))?;
        } else {
            let mut writer = writer_vec();

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
        }

        if verbose {
            eprintln!("Results written successfully");
        }
    }

    if !cli.print && cli.output_file.is_none() {
        if cli.output_format == OutputFormat::Ftc {
            let cut_sets = computed_cut_sets.as_deref().ok_or(
                "FTC output was requested, but the selected analysis did not produce cut sets",
            )?;
            let ftc_output = serialize_saphire_v2(
                cli.saphire_project.as_deref().expect("validated above"),
                fault_tree.element().id(),
                &cli.saphire_analysis,
                cut_sets,
            )?;
            print!("{ftc_output}");
        } else {
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
    }

    Ok(())
}
