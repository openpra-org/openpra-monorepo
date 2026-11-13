use std::path::Path;

use serde_json::Value;

use openrc::config::parse_config;
use openrc::error::OpenRcError;
use openrc::json::{to_indented_text, JsonValue};
use openrc::met::parse_met;
use openrc::run::{check_text, run_text};
use openrc::text::repr_str;

use crate::support::{
    exact_required, items, kind_for, quoted_non_finite, records, reference_dir, text, vector, Tally,
};
use crate::test_config::config_json;
use crate::test_met::same_record;

const TEXT_SOURCE: &str = "<string>";
const DATA_FILE_CASES: [&str; 1] = ["BadDataFile"];
const FAILS_WHILE_COMPUTING: [&str; 4] = [
    "PolarNegativeSectors",
    "PolarZeroRing",
    "PolarNanRing",
    "PolarInfiniteRing",
];
const FAILS_ONLY_WHEN_RESULTS_ARE_BUILT: [&str; 1] = ["PolarNanRingNoResults"];

fn unix_lines(content: &str) -> String {
    content.replace("\r\n", "\n")
}

fn portable(content: &str) -> String {
    content.replace('\\', "/")
}

fn case_names() -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(reference_dir().join("input"))
        .expect("input directory")
        .filter_map(|entry| {
            let path = entry.expect("input entry").path();
            if path.extension().is_some_and(|extension| extension == "txt") {
                path.file_stem()
                    .map(|stem| stem.to_string_lossy().into_owned())
            } else {
                None
            }
        })
        .collect();
    names.sort();
    names
}

fn config_text(name: &str) -> String {
    let path = reference_dir().join("input").join(format!("{name}.txt"));
    let bytes = std::fs::read(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()));
    String::from_utf8_lossy(&bytes).into_owned()
}

fn met_text_for(config: &str) -> Option<String> {
    let parsed = parse_config(config, TEXT_SOURCE).ok()?;
    let met_path = parsed.met_path?;
    std::fs::read_to_string(reference_dir().join(met_path)).ok()
}

fn expected_file(name: &str, suffix: &str) -> Option<String> {
    let path = reference_dir()
        .join("expected")
        .join(format!("{name}{suffix}"));
    std::fs::read(&path)
        .ok()
        .map(|bytes| unix_lines(&String::from_utf8_lossy(&bytes)))
}

fn console_without_files(console: &str) -> String {
    let body = console.split_once('\n').map_or("", |(_, rest)| rest);
    match body.rfind("\nResults written to: ") {
        Some(position) => body[..position].to_string(),
        None => body.to_string(),
    }
}

fn check_json(actual: &Value, expected: &Value, floor: f64, location: &str, tally: &mut Tally) {
    match (actual, expected) {
        (Value::Number(actual_number), Value::Number(expected_number)) => {
            assert_eq!(
                actual_number.is_f64(),
                expected_number.is_f64(),
                "{location}: number kind"
            );
            tally.check_with_floor(
                actual_number.as_f64().expect("number"),
                expected_number.as_f64().expect("number"),
                floor,
                &|| location.to_string(),
            );
        }
        (Value::Array(actual_items), Value::Array(expected_items)) => {
            assert_eq!(
                actual_items.len(),
                expected_items.len(),
                "{location}: length"
            );
            let is_grid = !expected_items.is_empty()
                && expected_items.iter().all(|row| {
                    row.as_array()
                        .is_some_and(|cells| cells.iter().all(Value::is_number))
                });
            let grid_floor = if is_grid {
                let peak = expected_items
                    .iter()
                    .filter_map(Value::as_array)
                    .flatten()
                    .filter_map(Value::as_f64)
                    .fold(0.0_f64, |peak, value| peak.max(value.abs()));
                1e-12 * peak
            } else {
                floor
            };
            for (index, (actual_item, expected_item)) in
                actual_items.iter().zip(expected_items).enumerate()
            {
                check_json(
                    actual_item,
                    expected_item,
                    grid_floor,
                    &format!("{location}[{index}]"),
                    tally,
                );
            }
        }
        (Value::Object(actual_entries), Value::Object(expected_entries)) => {
            let actual_keys: Vec<&String> = actual_entries.keys().collect();
            let expected_keys: Vec<&String> = expected_entries.keys().collect();
            assert_eq!(actual_keys, expected_keys, "{location}: keys");
            for (key, expected_entry) in expected_entries {
                check_json(
                    &actual_entries[key],
                    expected_entry,
                    floor,
                    &format!("{location}.{key}"),
                    tally,
                );
            }
        }
        _ => assert_eq!(actual, expected, "{location}"),
    }
}

fn check_expected_error(name: &str, error: &OpenRcError, expected: &Value) {
    let python_type = text(&expected["type"]);
    assert_eq!(
        error.kind(),
        kind_for(python_type),
        "{name}: {}",
        error.message()
    );
    if python_type != "KeyError" {
        assert_eq!(
            portable(error.message()),
            portable(text(&expected["message"])),
            "{name}"
        );
    }
}

fn console_number(console: &str, label: &str) -> usize {
    let line = console
        .lines()
        .find(|line| line.starts_with(label))
        .unwrap_or_else(|| panic!("no console line starts with {label:?}"));
    line[label.len()..]
        .trim()
        .parse()
        .unwrap_or_else(|error| panic!("{line}: {error}"))
}

fn console_value<'a>(console: &'a str, label: &str) -> &'a str {
    let line = console
        .lines()
        .find(|line| line.starts_with(label))
        .unwrap_or_else(|| panic!("no console line starts with {label:?}"));
    &line[label.len()..]
}

fn console_met_records(console: &str) -> usize {
    match console
        .lines()
        .find(|line| line.starts_with("  met file  : "))
    {
        Some(line) => {
            let open = line.rfind('(').expect("realization count");
            let close = line.rfind(" realizations)").expect("realization count");
            line[open + 1..close].parse().expect("realization count")
        }
        None => 1,
    }
}

#[test]
fn text_configs_match_reference() {
    let data = vector("config.json");
    let cases = items(&data["cases"]);
    let data_dir = Path::new("@DATA@");
    let mut accepted = 0;
    let mut rejected = 0;
    let mut data_file_errors = 0;
    for case in cases {
        let name = text(&case["name"]);
        if case.get("folder").is_some() || case["text"].is_null() {
            continue;
        }
        let result = parse_config(text(&case["text"]), TEXT_SOURCE);
        match case.get("error") {
            None => {
                let config = result.unwrap_or_else(|error| {
                    panic!("{name}: must parse, got {}: {error}", error.kind())
                });
                assert!(config.decay_data.is_null(), "{name}: decay data");
                assert!(config.dcf_data.is_null(), "{name}: dose coefficients");
                let actual = config_json(&config, data_dir);
                let expected = case["config"].as_object().expect("config fields");
                for (key, expected_value) in expected {
                    if key != "decay_data" && key != "dcf_data" {
                        assert_eq!(&actual[key], expected_value, "{name}: field {key}");
                    }
                }
                assert_eq!(
                    actual.as_object().map(|fields| fields.len()),
                    Some(expected.len()),
                    "{name}: field count"
                );
                accepted += 1;
            }
            Some(expected) => {
                let python_type = text(&expected["type"]);
                if matches!(
                    python_type,
                    "FileNotFoundError" | "JSONDecodeError" | "AttributeError"
                ) {
                    let config = result.unwrap_or_else(|error| {
                        panic!("{name}: text mode reads no data file, got {error}")
                    });
                    assert!(config.decay_data.is_null(), "{name}: decay data");
                    assert!(config.dcf_data.is_null(), "{name}: dose coefficients");
                    data_file_errors += 1;
                    continue;
                }
                let error = match result {
                    Ok(_) => panic!("{name}: must fail with {python_type}"),
                    Err(error) => error,
                };
                assert_eq!(
                    error.kind(),
                    kind_for(python_type),
                    "{name}: {}",
                    error.message()
                );
                if python_type != "KeyError" && name != "byte order mark" {
                    assert_eq!(
                        error
                            .message()
                            .replace(&repr_str(TEXT_SOURCE), "@PATH@")
                            .replace('\\', "/"),
                        text(&expected["message"]).replace('\\', "/"),
                        "{name}"
                    );
                }
                rejected += 1;
            }
        }
    }
    assert!(accepted > 50, "accepted {accepted}");
    assert!(rejected > 85, "rejected {rejected}");
    assert_eq!(data_file_errors, 6);
}

#[test]
fn text_met_files_match_reference() {
    let data = vector("met.json");
    let cases = items(&data["cases"]);
    let mut accepted = 0;
    let mut rejected = 0;
    for case in cases {
        let name = text(&case["name"]);
        if case["text"].is_null() {
            continue;
        }
        let result = parse_met(text(&case["text"]), "@PATH@");
        match case.get("error") {
            None => {
                let actual = result.unwrap_or_else(|error| panic!("{name}: must parse: {error}"));
                let expected = records(&case["records"]);
                assert_eq!(actual.len(), expected.len(), "{name}: record count");
                for (row, (actual, expected)) in actual.iter().zip(&expected).enumerate() {
                    assert!(
                        same_record(actual, expected),
                        "{name}: record {row}: got {actual:?}, expected {expected:?}"
                    );
                }
                accepted += 1;
            }
            Some(expected) => {
                let error = match result {
                    Ok(_) => panic!("{name}: must fail with {}", expected["type"]),
                    Err(error) => error,
                };
                assert_eq!(
                    error.kind(),
                    kind_for(text(&expected["type"])),
                    "{name}: {}",
                    error.message()
                );
                assert_eq!(error.message(), text(&expected["message"]), "{name}");
                rejected += 1;
            }
        }
    }
    assert!(accepted > 15, "accepted {accepted}");
    assert!(rejected >= 10, "rejected {rejected}");
}

#[test]
fn text_runs_match_reference_cases() {
    let names = case_names();
    assert!(names.len() >= 51, "found {} cases", names.len());
    let mut tally = Tally::new("text runs");
    let mut identical_results = 0;
    let mut compared_results = 0;
    let mut failed_runs = 0;
    let mut results_not_built = 0;
    for name in &names {
        let config = config_text(name);
        let met = met_text_for(&config);
        let mut console: Vec<u8> = Vec::new();
        let outcome = run_text(&config, met.as_deref(), &mut console);
        let console = portable(&String::from_utf8(console).expect("console text"));
        let expected_console = portable(&console_without_files(
            &expected_file(name, ".console.txt").expect("expected console"),
        ));

        if DATA_FILE_CASES.contains(&name.as_str()) {
            let results = outcome
                .unwrap_or_else(|error| panic!("{name}: text mode reads no data file: {error}"));
            assert!(matches!(results, JsonValue::Object(_)), "{name}");
            continue;
        }
        assert_eq!(console, expected_console, "{name}: console");

        if FAILS_ONLY_WHEN_RESULTS_ARE_BUILT.contains(&name.as_str()) {
            assert!(expected_file(name, ".error.json").is_none(), "{name}");
            assert!(expected_file(name, ".json").is_none(), "{name}");
            let error = match outcome {
                Ok(_) => panic!("{name}: the results cannot be built"),
                Err(error) => error,
            };
            assert_eq!(error.kind(), "InvalidValue", "{name}");
            assert_eq!(
                error.message(),
                "cannot convert float NaN to integer",
                "{name}"
            );
            results_not_built += 1;
            continue;
        }

        if let Some(expected_error) = expected_file(name, ".error.json") {
            let expected: Value = serde_json::from_str(&expected_error).expect("expected error");
            let error = match outcome {
                Ok(_) => panic!("{name}: must fail with {}", expected["type"]),
                Err(error) => error,
            };
            check_expected_error(name, &error, &expected);
            failed_runs += 1;
            continue;
        }

        let results = outcome.unwrap_or_else(|error| panic!("{name}: {error}"));
        let actual_text = to_indented_text(&results);
        let Some(expected_text) = expected_file(name, ".json") else {
            assert!(actual_text.starts_with("{\n  \"case_name\": "), "{name}");
            continue;
        };
        compared_results += 1;
        if actual_text == expected_text {
            identical_results += 1;
        } else {
            assert!(!exact_required(), "{name}: results text differs");
        }
        let actual: Value =
            serde_json::from_str(&quoted_non_finite(&actual_text)).expect("results json");
        let expected: Value =
            serde_json::from_str(&quoted_non_finite(&expected_text)).expect("expected json");
        check_json(&actual, &expected, 0.0, name, &mut tally);
    }
    eprintln!(
        "text runs: {} cases, {failed_runs} expected failures, \
         {identical_results} of {compared_results} results identical as text",
        names.len()
    );
    assert!(compared_results >= 37, "compared {compared_results}");
    assert!(failed_runs >= 11, "failed {failed_runs}");
    assert_eq!(results_not_built, 1);
    tally.finish();
}

#[test]
fn text_checks_match_reference_cases() {
    let names = case_names();
    let mut accepted = 0;
    let mut rejected = 0;
    for name in &names {
        let config = config_text(name);
        let met = met_text_for(&config);
        let outcome = check_text(&config, met.as_deref());
        let expected_error = expected_file(name, ".error.json");
        let fails_later = FAILS_WHILE_COMPUTING.contains(&name.as_str())
            || DATA_FILE_CASES.contains(&name.as_str());
        match expected_error {
            Some(expected_error) if !fails_later => {
                let expected: Value =
                    serde_json::from_str(&expected_error).expect("expected error");
                let error = match outcome {
                    Ok(_) => panic!("{name}: the check must fail with {}", expected["type"]),
                    Err(error) => error,
                };
                check_expected_error(name, &error, &expected);
                rejected += 1;
            }
            _ => {
                let overview = outcome.unwrap_or_else(|error| panic!("{name}: {error}"));
                if DATA_FILE_CASES.contains(&name.as_str()) {
                    accepted += 1;
                    continue;
                }
                let console = expected_file(name, ".console.txt").expect("expected console");
                assert_eq!(
                    overview.case_name,
                    console_value(&console, "  case_name : "),
                    "{name}"
                );
                assert_eq!(
                    overview.mode,
                    console_value(&console, "  mode      : "),
                    "{name}"
                );
                assert_eq!(
                    overview.geometry,
                    console_value(&console, "  geometry  : "),
                    "{name}"
                );
                assert_eq!(
                    overview.nuclide_count,
                    console_number(&console, "  nuclides  : "),
                    "{name}"
                );
                assert_eq!(
                    overview.segment_count,
                    console_number(&console, "  segments  : "),
                    "{name}"
                );
                assert_eq!(
                    overview.met_record_count,
                    console_met_records(&console),
                    "{name}"
                );
                accepted += 1;
            }
        }
    }
    assert!(accepted >= 43, "accepted {accepted}");
    assert_eq!(rejected, 7);
}

#[test]
fn met_text_must_agree_with_the_config() {
    let single_trial = config_text("Example");
    let unused = "met file text was given but [meteorology] met_file is not set";
    let error = run_text(&single_trial, Some("D,3.0\n"), &mut Vec::new()).unwrap_err();
    assert_eq!(error.kind(), "InvalidValue");
    assert_eq!(error.message(), unused);
    let error = check_text(&single_trial, Some("")).unwrap_err();
    assert_eq!(error.kind(), "InvalidValue");
    assert_eq!(error.message(), unused);

    let with_met_file = config_text("StressTest_met");
    let mut console: Vec<u8> = Vec::new();
    let error = run_text(&with_met_file, None, &mut console).unwrap_err();
    assert_eq!(error.kind(), "FileNotFound");
    assert_eq!(
        portable(error.message()),
        "Met file not found: data/example.met"
    );
    assert_eq!(
        String::from_utf8(console).expect("console").lines().count(),
        5
    );
    let error = check_text(&with_met_file, None).unwrap_err();
    assert_eq!(error.kind(), "FileNotFound");

    let error = run_text(&with_met_file, Some("# nothing\n"), &mut Vec::new()).unwrap_err();
    assert_eq!(error.kind(), "InvalidValue");
    assert_eq!(
        portable(error.message()),
        "Met file contains no data rows: data/example.met"
    );
}

#[test]
fn a_bad_config_text_names_the_text_source() {
    let error = run_text("case_name = x\n", None, &mut Vec::new()).unwrap_err();
    assert_eq!(error.kind(), "ConfigSyntax");
    assert_eq!(
        error.message(),
        "File contains no section headers.\nfile: '<string>', line: 1\n'case_name = x\\n'"
    );
    let error = check_text("", None).unwrap_err();
    assert_eq!(error.kind(), "InvalidValue");
    assert!(error
        .message()
        .starts_with("Config is missing required section(s): ['run', "));
}

#[test]
fn a_text_run_reads_and_writes_no_files() {
    let folder = format!("never_written_{}", std::process::id());
    let config = config_text("Example")
        .replace("output_dir = outputs", &format!("output_dir = {folder}"))
        .replace("path = data/DCF.json", "path = absent/dcf.json")
        .replace("path = data/Chains.json", "path = absent/chains.json");
    assert!(config.contains(&folder));
    assert!(config.contains("absent/dcf.json"));
    assert!(config.contains("absent/chains.json"));
    let mut console: Vec<u8> = Vec::new();
    let results = run_text(&config, None, &mut console).expect("the run");
    assert!(!Path::new(&folder).exists());
    let console = String::from_utf8(console).expect("console");
    assert!(!console.contains("Loading config"));
    assert!(!console.contains("Results written to"));
    assert!(console.starts_with("  case_name : test_case_001\n"));

    let expected = expected_file("Example", ".json").expect("expected results");
    let actual = to_indented_text(&results);
    if exact_required() {
        assert_eq!(actual, expected);
    }
    let mut tally = Tally::new("text run without files");
    check_json(
        &serde_json::from_str(&actual).expect("results json"),
        &serde_json::from_str(&expected).expect("expected json"),
        0.0,
        "Example",
        &mut tally,
    );
    tally.finish();
}

#[test]
fn a_text_run_returns_results_when_the_config_writes_none() {
    let config = config_text("NoResultsFile");
    assert!(expected_file("NoResultsFile", ".json").is_none());
    let results = run_text(&config, None, &mut Vec::new()).expect("the run");
    let JsonValue::Object(entries) = results else {
        panic!("results must be an object");
    };
    let keys: Vec<&str> = entries.iter().map(|(key, _)| key.as_str()).collect();
    assert_eq!(
        keys,
        [
            "case_name",
            "geometry",
            "mode",
            "receptor_x_m",
            "stability_class",
            "wind_speed_m_s",
            "tede_sv",
            "tede_msv",
            "chi_over_q_s_m3",
            "ground_deposition_bq_m2",
            "lmp_tede_sv",
            "epz_distance_m",
            "missing_dcfs",
            "breakdown_msv"
        ]
    );
}

#[test]
fn repeated_text_runs_are_identical() {
    let config = config_text("PolarWindShift");
    let met = met_text_for(&config);
    let mut first_console: Vec<u8> = Vec::new();
    let first = run_text(&config, met.as_deref(), &mut first_console).expect("first run");
    let mut second_console: Vec<u8> = Vec::new();
    let second = run_text(&config, met.as_deref(), &mut second_console).expect("second run");
    assert_eq!(to_indented_text(&first), to_indented_text(&second));
    assert_eq!(first_console, second_console);
}
