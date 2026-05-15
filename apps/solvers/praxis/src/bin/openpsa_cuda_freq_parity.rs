#[cfg(feature = "cuda")]
use praxis::io::parser::parse_event_tree_model;

#[cfg(feature = "cuda")]
use praxis::mc::plan::RunParams;

#[cfg(feature = "cuda")]
use praxis::mc::DpEventTreeMonteCarloAnalysis;

#[cfg(feature = "cuda")]
use praxis::openpra_mef::addon_json::{parse_openpra_json, to_engine_inputs};
#[cfg(feature = "cuda")]
use std::collections::{BTreeMap, HashMap};
#[cfg(feature = "cuda")]
use std::path::{Path, PathBuf};

#[cfg(feature = "cuda")]
use cubecl_cuda::CudaRuntime;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[cfg(feature = "cuda")]
struct SequenceKey {
    initiating_event_id: String,
    event_tree_id: String,
    source_sequence_id: String,
}

#[derive(Debug, Clone)]
#[cfg(feature = "cuda")]
struct SequenceRow {
    key: SequenceKey,
    runtime_sequence_id: String,
    successes: u64,
    num_trials: u64,
    ie_frequency: f64,
    frequency: f64,
}

#[cfg(feature = "cuda")]
fn default_fixture_paths() -> Vec<String> {
    [
        "tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML/ATRS.xml",
        "tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML/CRW.xml",
        "tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML/LOHTL.xml",
        "tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML/LOOP.xml",
        "tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML/PCL.xml",
        "tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML/SGTL-M.xml",
        "tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML/SGTL-S.xml",
    ]
    .iter()
    .map(ToString::to_string)
    .collect()
}

#[cfg(feature = "cuda")]
fn parse_args() -> (Vec<String>, u64, RunParams, bool, PathBuf) {
    let mut paths: Vec<String> = Vec::new();
    let mut seed: u64 = 847;
    let mut iterations: usize = 10;
    let mut batches: usize = 5;
    let mut bitpacks_per_batch: usize = 3_125;
    let mut watch = true;
    let mut json_dir: Option<PathBuf> = None;

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--seed" => {
                let value = args.next().expect("--seed requires a value");
                seed = value.parse::<u64>().expect("invalid --seed value");
            }
            "--iterations" => {
                let value = args.next().expect("--iterations requires a value");
                iterations = value.parse::<usize>().expect("invalid --iterations value");
            }
            "--batches" => {
                let value = args.next().expect("--batches requires a value");
                batches = value.parse::<usize>().expect("invalid --batches value");
            }
            "--bitpacks-per-batch" => {
                let value = args
                    .next()
                    .expect("--bitpacks-per-batch requires a value");
                bitpacks_per_batch = value
                    .parse::<usize>()
                    .expect("invalid --bitpacks-per-batch value");
            }
            "--abs-tol" => {
                panic!("--abs-tol is no longer supported (parity is exact / no tolerance)");
            }
            "--json-dir" => {
                let value = args.next().expect("--json-dir requires a value");
                json_dir = Some(PathBuf::from(value));
            }
            "--no-watch" => {
                watch = false;
            }
            _ => {
                paths.push(arg);
            }
        }
    }

    if paths.is_empty() {
        paths = default_fixture_paths();
    }

    let run_params = RunParams::new(
        iterations,
        batches,
        bitpacks_per_batch,
        RunParams::DEFAULT_OMEGA,
        seed,
    );

    let json_dir = json_dir.unwrap_or_else(|| PathBuf::from("tmp/mhtgr_openpra_json"));

    (paths, seed, run_params, watch, json_dir)
}

#[cfg(feature = "cuda")]
fn select_event_trees_to_run(
    initiating_events: &[praxis::core::event_tree::InitiatingEvent],
    event_trees: &[praxis::core::event_tree::EventTree],
) -> Result<Vec<(praxis::core::event_tree::InitiatingEvent, praxis::core::event_tree::EventTree)>, String>
{
    if initiating_events.is_empty() {
        return Err("no initiating events found".to_string());
    }
    if event_trees.is_empty() {
        return Err("no event trees found".to_string());
    }

    let mut event_tree_map = HashMap::new();
    for event_tree in event_trees {
        event_tree_map.insert(event_tree.id.clone(), event_tree.clone());
    }

    let mut pairs = Vec::new();
    for ie in initiating_events {
        if let Some(event_tree_id) = &ie.event_tree_id {
            if let Some(event_tree) = event_tree_map.get(event_tree_id) {
                pairs.push((ie.clone(), event_tree.clone()));
            }
        }
    }

    if pairs.is_empty() {
        return Err("no initiating event -> event tree pairs resolved".to_string());
    }

    Ok(pairs)
}

#[cfg(feature = "cuda")]
fn run_rows(
    model: &praxis::core::model::Model,
    initiating_events: &[praxis::core::event_tree::InitiatingEvent],
    event_trees: &[praxis::core::event_tree::EventTree],
    event_tree_library: &HashMap<String, praxis::core::event_tree::EventTree>,
    run_params: RunParams,
    watch: bool,
    sequence_id_mapper: &dyn Fn(
        &praxis::core::event_tree::InitiatingEvent,
        &praxis::core::event_tree::EventTree,
        &str,
    ) -> SequenceKey,
) -> Result<Vec<SequenceRow>, Box<dyn std::error::Error>> {
    let pairs = select_event_trees_to_run(initiating_events, event_trees)
        .map_err(|e| format!("pair selection failed: {e}"))?;

    let device = Default::default();
    let mut rows = Vec::new();

    for (ie, event_tree) in pairs {
        let analysis = DpEventTreeMonteCarloAnalysis::with_run_params(
            ie.clone(),
            event_tree.clone(),
            model,
            run_params,
        )?
        .with_event_tree_library(event_tree_library);

        let result = analysis.run_gpu_with_watch::<CudaRuntime>(&device, watch)?;

        for sequence_result in result.sequences {
            let key = sequence_id_mapper(&ie, &event_tree, &sequence_result.sequence.id);
            let ie_frequency = ie.frequency.unwrap_or(1.0);
            rows.push(SequenceRow {
                key,
                runtime_sequence_id: sequence_result.sequence.id,
                successes: u64::try_from(sequence_result.successes).unwrap_or(u64::MAX),
                num_trials: u64::try_from(sequence_result.num_trials).unwrap_or(u64::MAX),
                ie_frequency,
                frequency: sequence_result.frequency_estimate,
            });
        }
    }

    Ok(rows)
}

#[cfg(feature = "cuda")]
fn compare_rows(
    xml_rows: Vec<SequenceRow>,
    json_rows: Vec<SequenceRow>,
    _json_dir: &Path,
) -> (bool, Vec<String>) {
    let mut xml_map: BTreeMap<SequenceKey, (u64, u64, u64, f64)> = BTreeMap::new();
    let mut json_map: BTreeMap<SequenceKey, (u64, u64, u64, f64)> = BTreeMap::new();
    let mut xml_rows_by_key: BTreeMap<SequenceKey, Vec<SequenceRow>> = BTreeMap::new();
    let mut json_rows_by_key: BTreeMap<SequenceKey, Vec<SequenceRow>> = BTreeMap::new();

    for row in xml_rows {
        let entry = xml_map
            .entry(row.key.clone())
            .or_insert((0, row.num_trials, row.ie_frequency.to_bits(), row.ie_frequency));
        entry.0 = entry.0.saturating_add(row.successes);
        entry.1 = row.num_trials;
        entry.2 = row.ie_frequency.to_bits();
        entry.3 = row.ie_frequency;
        xml_rows_by_key.entry(row.key.clone()).or_default().push(row);
    }
    for row in json_rows {
        let entry = json_map
            .entry(row.key.clone())
            .or_insert((0, row.num_trials, row.ie_frequency.to_bits(), row.ie_frequency));
        entry.0 = entry.0.saturating_add(row.successes);
        entry.1 = row.num_trials;
        entry.2 = row.ie_frequency.to_bits();
        entry.3 = row.ie_frequency;
        json_rows_by_key.entry(row.key.clone()).or_default().push(row);
    }

    let mut failures = Vec::new();

    for key in xml_map.keys() {
        if !json_map.contains_key(key) {
            failures.push(format!(
                "MISSING_JSON key=({}|{}|{})",
                key.initiating_event_id, key.event_tree_id, key.source_sequence_id
            ));
        }
    }

    for key in json_map.keys() {
        if !xml_map.contains_key(key) {
            failures.push(format!(
                "EXTRA_JSON key=({}|{}|{})",
                key.initiating_event_id, key.event_tree_id, key.source_sequence_id
            ));
        }
    }

    for (key, (xml_successes, xml_trials, xml_ie_bits, xml_ie)) in &xml_map {
        let Some((json_successes, json_trials, json_ie_bits, json_ie)) = json_map.get(key) else {
            continue;
        };

        if xml_trials != json_trials {
            failures.push(format!(
                "TRIALS_MISMATCH key=({}|{}|{}) xml_trials={} json_trials={}",
                key.initiating_event_id, key.event_tree_id, key.source_sequence_id, xml_trials, json_trials
            ));
        }

        if xml_ie_bits != json_ie_bits {
            failures.push(format!(
                "IE_FREQ_MISMATCH key=({}|{}|{}) xml_ie={:.9e} json_ie={:.9e}",
                key.initiating_event_id, key.event_tree_id, key.source_sequence_id, xml_ie, json_ie
            ));
        }

        if xml_successes != json_successes {
            failures.push(format!(
                "SUCCESS_MISMATCH key=({}|{}|{}) xml_successes={} json_successes={}",
                key.initiating_event_id,
                key.event_tree_id,
                key.source_sequence_id,
                xml_successes,
                json_successes,
            ));

            if let Some(rows) = xml_rows_by_key.get(key) {
                for row in rows {
                    failures.push(format!(
                        "  XML_ROW key=({}|{}|{}) runtime_seq={} successes={} trials={} freq={:.9e}",
                        key.initiating_event_id,
                        key.event_tree_id,
                        key.source_sequence_id,
                        row.runtime_sequence_id,
                        row.successes,
                        row.num_trials,
                        row.frequency
                    ));
                }
            }
            if let Some(rows) = json_rows_by_key.get(key) {
                for row in rows {
                    failures.push(format!(
                        "  JSON_ROW key=({}|{}|{}) runtime_seq={} successes={} trials={} freq={:.9e}",
                        key.initiating_event_id,
                        key.event_tree_id,
                        key.source_sequence_id,
                        row.runtime_sequence_id,
                        row.successes,
                        row.num_trials,
                        row.frequency
                    ));
                }
            }
        }
    }

    (failures.is_empty(), failures)
}

#[cfg(feature = "cuda")]
fn run_single_file(
    path: &str,
    run_params: RunParams,
    watch: bool,
    json_dir: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let xml = std::fs::read_to_string(path)?;

    let (xml_model, xml_ies, xml_ets) = parse_event_tree_model(&xml)?;
    let xml_library: HashMap<String, praxis::core::event_tree::EventTree> = xml_ets
        .iter()
        .map(|event_tree| (event_tree.id.clone(), event_tree.clone()))
        .collect();

    let xml_rows = run_rows(
        &xml_model,
        &xml_ies,
        &xml_ets,
        &xml_library,
        run_params,
        watch,
        &|ie, event_tree, sequence_id| SequenceKey {
            initiating_event_id: ie.id.clone(),
            event_tree_id: event_tree.id.clone(),
            source_sequence_id: sequence_id.to_string(),
        },
    )?;

    let base = Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("invalid fixture path")?;
    let json_path = json_dir.join(format!("{base}.openpra.json"));
    let json_text = std::fs::read_to_string(&json_path)
        .map_err(|err| format!("Failed to read {}: {err}", json_path.display()))?;
    let json_bundle = parse_openpra_json(&json_text)
        .map_err(|err| format!("Failed to parse {}: {err}", json_path.display()))?;
    let inputs = to_engine_inputs(&json_bundle)?;

    let json_model = inputs
        .praxis_model
        .as_ref()
        .ok_or("missing Praxis model from JSON inputs")?;

    let mut seq_meta_by_id: HashMap<String, (Option<String>, Option<String>, Option<String>)> =
        HashMap::new();
    let mut seq_signature_by_id: HashMap<String, String> = HashMap::new();
    if let Some(openpra_model) = &json_bundle.model {
        if let Some(esa) = &openpra_model.technical_elements.event_sequence_analysis {
            for sequence in &esa.event_sequences {
                let source_event_tree_id = sequence
                    .additional_fields
                    .get("sourceEventTreeId")
                    .and_then(|value| value.as_str())
                    .map(ToOwned::to_owned);
                let source_sequence_id = sequence
                    .additional_fields
                    .get("sourceSequenceId")
                    .and_then(|value| value.as_str())
                    .map(ToOwned::to_owned);
                seq_meta_by_id.insert(
                    sequence.id.clone(),
                    (
                        sequence.initiating_event_id.clone(),
                        source_event_tree_id,
                        source_sequence_id,
                    ),
                );

                let signature_preview = sequence
                    .additional_fields
                    .get("pathSignature")
                    .and_then(|value| value.as_array())
                    .map(|steps| {
                        let mut rendered_steps = Vec::new();
                        for step in steps {
                            if let Some(obj) = step.as_object() {
                                let tree = obj
                                    .get("functionalEventTreeId")
                                    .and_then(|value| value.as_str())
                                    .unwrap_or("?");
                                let fe = obj
                                    .get("functionalEventId")
                                    .and_then(|value| value.as_str())
                                    .unwrap_or("?");
                                let state = obj
                                    .get("state")
                                    .and_then(|value| value.as_str())
                                    .unwrap_or("?");
                                let collect = obj
                                    .get("collectFormulaNegated")
                                    .and_then(|value| value.as_bool())
                                    .map(|value| if value { "neg" } else { "pos" })
                                    .unwrap_or("none");
                                rendered_steps
                                    .push(format!("{tree}:{fe}={state}[cf={collect}]"));
                            }
                        }
                        rendered_steps.join(" > ")
                    })
                    .unwrap_or_else(|| "<no-path-signature>".to_string());
                let source_tree = sequence
                    .additional_fields
                    .get("sourceEventTreeId")
                    .and_then(|value| value.as_str())
                    .unwrap_or("?");
                let terminal_tree = sequence
                    .additional_fields
                    .get("terminalEventTreeId")
                    .and_then(|value| value.as_str())
                    .unwrap_or("?");
                let source_seq = sequence
                    .additional_fields
                    .get("sourceSequenceId")
                    .and_then(|value| value.as_str())
                    .unwrap_or("?");

                let mut binding_rows: Vec<String> = sequence
                    .functional_event_bindings
                    .iter()
                    .map(|binding| {
                        format!(
                            "{}:fe={} ft={} dp={} p={}",
                            binding.id,
                            binding
                                .functional_event_id
                                .as_deref()
                                .unwrap_or("?"),
                            binding.fault_tree_id.as_deref().unwrap_or("-"),
                            binding.data_parameter_id.as_deref().unwrap_or("-"),
                            binding
                                .success_probability
                                .map(|value| format!("{value:.6e}"))
                                .unwrap_or_else(|| "-".to_string())
                        )
                    })
                    .collect();
                binding_rows.sort();
                let binding_summary = binding_rows.join(" | ");

                seq_signature_by_id.insert(
                    sequence.id.clone(),
                    format!(
                        "src_tree={} terminal_tree={} source_seq={} path={} bindings=[{}]",
                        source_tree,
                        terminal_tree,
                        source_seq,
                        signature_preview,
                        binding_summary,
                    ),
                );
            }
        }
    }

    let json_rows = run_rows(
        json_model,
        &inputs.praxis_initiating_events,
        &inputs.praxis_event_trees,
        &inputs.praxis_event_tree_library,
        run_params,
        watch,
        &|ie, event_tree, sequence_id| {
            let (source_ie, source_event_tree, source_sequence) = seq_meta_by_id
                .get(sequence_id)
                .cloned()
                .unwrap_or((None, None, None));

            SequenceKey {
                initiating_event_id: source_ie.unwrap_or_else(|| ie.id.clone()),
                event_tree_id: source_event_tree.unwrap_or_else(|| event_tree.id.clone()),
                source_sequence_id: source_sequence.unwrap_or_else(|| sequence_id.to_string()),
            }
        },
    )?;

    let (ok, failures) = compare_rows(xml_rows, json_rows, json_dir);
    if ok {
        println!(
            "PARITY_OK file={} trials={}",
            path,
            run_params.total_trials_covered(),
        );
        return Ok(());
    }

    println!(
        "PARITY_FAIL file={} trials={} mismatches={}",
        path,
        run_params.total_trials_covered(),
        failures.len()
    );
    for line in failures.iter().take(80) {
        println!("{}", line);
    }

    let mut xml_agg: BTreeMap<SequenceKey, u64> = BTreeMap::new();
    let mut json_agg: BTreeMap<SequenceKey, u64> = BTreeMap::new();
    let mut json_rows_by_key: BTreeMap<SequenceKey, Vec<SequenceRow>> = BTreeMap::new();
    for row in run_rows(
        &xml_model,
        &xml_ies,
        &xml_ets,
        &xml_library,
        run_params,
        false,
        &|ie, event_tree, sequence_id| SequenceKey {
            initiating_event_id: ie.id.clone(),
            event_tree_id: event_tree.id.clone(),
            source_sequence_id: sequence_id.to_string(),
        },
    )? {
        *xml_agg.entry(row.key).or_insert(0) += row.successes;
    }
    for row in run_rows(
        json_model,
        &inputs.praxis_initiating_events,
        &inputs.praxis_event_trees,
        &inputs.praxis_event_tree_library,
        run_params,
        false,
        &|ie, event_tree, sequence_id| {
            let (source_ie, source_event_tree, source_sequence) = seq_meta_by_id
                .get(sequence_id)
                .cloned()
                .unwrap_or((None, None, None));

            SequenceKey {
                initiating_event_id: source_ie.unwrap_or_else(|| ie.id.clone()),
                event_tree_id: source_event_tree.unwrap_or_else(|| event_tree.id.clone()),
                source_sequence_id: source_sequence.unwrap_or_else(|| sequence_id.to_string()),
            }
        },
    )? {
        let key = row.key.clone();
        *json_agg.entry(key.clone()).or_insert(0) += row.successes;
        json_rows_by_key.entry(key).or_default().push(row);
    }

    for (key, xml_successes) in &xml_agg {
        if let Some(json_successes) = json_agg.get(key) {
            if xml_successes != json_successes {
                if let Some(rows) = json_rows_by_key.get(key) {
                    for row in rows {
                        if let Some(signature) = seq_signature_by_id.get(&row.runtime_sequence_id) {
                            println!(
                                "  JSON_SIG runtime_seq={} signature={}",
                                row.runtime_sequence_id,
                                signature
                            );
                        }
                    }
                }
            }
        }
    }

    let mut json_ranked: Vec<(SequenceKey, f64)> = json_agg
        .iter()
        .map(|(key, successes)| (key.clone(), *successes as f64))
        .collect();
    let mut xml_ranked: Vec<(SequenceKey, f64)> = xml_agg
        .iter()
        .map(|(key, successes)| (key.clone(), *successes as f64))
        .collect();
    xml_ranked.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    for (index, (key, frequency)) in xml_ranked.into_iter().take(15).enumerate() {
        println!(
            "  XML_TOP[{index}] key=({}|{}|{}) successes={:.0}",
            key.initiating_event_id,
            key.event_tree_id,
            key.source_sequence_id,
            frequency
        );
    }
    json_ranked.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    for (index, (key, frequency)) in json_ranked.into_iter().take(15).enumerate() {
        println!(
            "  JSON_TOP[{index}] key=({}|{}|{}) successes={:.0}",
            key.initiating_event_id,
            key.event_tree_id,
            key.source_sequence_id,
            frequency
        );
    }

    Err(format!("parity failed for {path}").into())
}

#[cfg(feature = "cuda")]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let (paths, seed, run_params, watch, json_dir) = parse_args();
    println!(
        "Running XML-vs-JSON CUDA parity: files={} seed={} run(t={}, b={}, p={}, omega={}) trials={} watch={} json_dir={}",
        paths.len(),
        seed,
        run_params.t,
        run_params.b,
        run_params.p,
        run_params.omega,
        run_params.total_trials_covered(),
        watch,
        json_dir.display(),
    );

    if run_params.t != 10 || run_params.b != 5 || run_params.p != 3_125 {
        return Err("RunParams must match: --iterations 10 --batches 5 --bitpacks-per-batch 3125".into());
    }

    for path in paths {
        run_single_file(&path, run_params, watch, &json_dir)?;
    }

    Ok(())
}

#[cfg(not(feature = "cuda"))]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    Err("This parity runner requires building with --features cuda".into())
}
