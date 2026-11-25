use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

use serde_json::Value;

use crate::support::{
    exact_required, quoted_non_finite, reference_dir, remove_scratch, same_bits, scratch_dir,
    TOLERANCE,
};

const PROGRAM: &str = env!("CARGO_BIN_EXE_openrc-cli");

struct Outcome {
    exit_code: Option<i32>,
    stdout: Vec<u8>,
    stderr: String,
    results: Vec<PathBuf>,
}

#[derive(Default)]
struct Summary {
    cases: usize,
    results_files: usize,
    identical_results_files: usize,
    identical_consoles: usize,
    numbers: u64,
    identical_numbers: u64,
    failed_runs: usize,
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

fn link_or_copy(source: &Path, target: &Path) {
    if std::fs::hard_link(source, target).is_err() {
        std::fs::copy(source, target).unwrap_or_else(|error| {
            panic!("copy {} to {}: {error}", source.display(), target.display())
        });
    }
}

fn stage(label: &str) -> PathBuf {
    let work = scratch_dir(label);
    let reference = reference_dir();
    for folder in ["input", "data"] {
        std::fs::create_dir_all(work.join(folder)).expect("create folder");
        for entry in std::fs::read_dir(reference.join(folder)).expect("reference folder") {
            let path = entry.expect("reference entry").path();
            if path.is_file() {
                let name = path.file_name().expect("file name");
                std::fs::copy(&path, work.join(folder).join(name)).expect("copy reference file");
            }
        }
    }
    let bundled = Path::new(env!("CARGO_MANIFEST_DIR")).join("data");
    for name in ["DCF.json", "Chains.json"] {
        link_or_copy(&bundled.join(name), &work.join("data").join(name));
    }
    work
}

fn results_files(directory: &Path, found: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            results_files(&path, found);
        } else if path
            .file_name()
            .is_some_and(|name| name.to_string_lossy().ends_with("_results.json"))
        {
            found.push(path);
        }
    }
}

fn run_program(work: &Path, arguments: &[&str]) -> Outcome {
    let output = Command::new(PROGRAM)
        .args(arguments)
        .current_dir(work)
        .output()
        .expect("run the program");
    let mut results = Vec::new();
    results_files(work, &mut results);
    results.sort();
    Outcome {
        exit_code: output.status.code(),
        stdout: output.stdout,
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        results,
    }
}

fn unix_lines(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).replace("\r\n", "\n")
}

fn portable(text: &str) -> String {
    text.replace('\\', "/")
}

fn compare_values(
    actual: &Value,
    expected: &Value,
    floor: f64,
    location: &str,
    summary: &mut Summary,
    problems: &mut Vec<String>,
) {
    match (actual, expected) {
        (Value::Number(actual_number), Value::Number(expected_number)) => {
            if actual_number.is_f64() != expected_number.is_f64() {
                problems.push(format!("{location}: number kind differs"));
                return;
            }
            let actual_value = actual_number.as_f64().unwrap_or(f64::NAN);
            let expected_value = expected_number.as_f64().unwrap_or(f64::NAN);
            summary.numbers += 1;
            if same_bits(actual_value, expected_value) {
                summary.identical_numbers += 1;
                return;
            }
            let difference = (actual_value - expected_value).abs();
            let scale = actual_value.abs().max(expected_value.abs());
            let within_tolerance = difference <= TOLERANCE * scale + floor;
            if !within_tolerance {
                problems.push(format!(
                    "{location}: got {actual_value:e}, expected {expected_value:e}"
                ));
            }
        }
        (Value::Array(actual_items), Value::Array(expected_items)) => {
            if actual_items.len() != expected_items.len() {
                problems.push(format!("{location}: list length differs"));
                return;
            }
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
                compare_values(
                    actual_item,
                    expected_item,
                    grid_floor,
                    &format!("{location}[{index}]"),
                    summary,
                    problems,
                );
            }
        }
        (Value::Object(actual_entries), Value::Object(expected_entries)) => {
            let actual_keys: Vec<&String> = actual_entries.keys().collect();
            let expected_keys: Vec<&String> = expected_entries.keys().collect();
            if actual_keys != expected_keys {
                problems.push(format!(
                    "{location}: keys differ: got {actual_keys:?}, expected {expected_keys:?}"
                ));
                return;
            }
            for (key, expected_entry) in expected_entries {
                compare_values(
                    &actual_entries[key],
                    expected_entry,
                    floor,
                    &format!("{location}.{key}"),
                    summary,
                    problems,
                );
            }
        }
        _ => {
            if actual != expected {
                problems.push(format!("{location}: got {actual}, expected {expected}"));
            }
        }
    }
}

fn check_case(name: &str, summary: &mut Summary) -> Vec<String> {
    let work = stage(name);
    let problems = check_staged_case(name, &work, summary);
    if problems.is_empty() {
        remove_scratch(&work);
    }
    problems
}

fn check_staged_case(name: &str, work: &Path, summary: &mut Summary) -> Vec<String> {
    let mut problems: Vec<String> = Vec::new();
    let expected_dir = reference_dir().join("expected");
    let outcome = run_program(work, &[&format!("input/{name}.txt")]);
    summary.cases += 1;

    let expected_console =
        std::fs::read(expected_dir.join(format!("{name}.console.txt"))).expect("expected console");
    if outcome.stdout == expected_console {
        summary.identical_consoles += 1;
    } else if cfg!(windows) && exact_required() {
        problems.push("console bytes differ from the reference".to_string());
    }
    let actual_console = portable(&unix_lines(&outcome.stdout));
    let wanted_console = portable(&unix_lines(&expected_console));
    if actual_console != wanted_console {
        problems.push(format!(
            "console differs\n--- got ---\n{actual_console}\n--- expected ---\n{wanted_console}"
        ));
    }

    let error_path = expected_dir.join(format!("{name}.error.json"));
    if error_path.exists() {
        summary.failed_runs += 1;
        let expected: Value =
            serde_json::from_str(&std::fs::read_to_string(&error_path).expect("expected error"))
                .expect("expected error json");
        if outcome.exit_code != Some(1) {
            problems.push(format!("exit code {:?}, expected 1", outcome.exit_code));
        }
        let wanted = format!(
            "error: {}",
            portable(expected["message"].as_str().expect("message"))
        );
        let actual = portable(outcome.stderr.trim_end());
        let kind = expected["type"].as_str().expect("type");
        if kind == "KeyError" {
            if !actual.starts_with("error: ") {
                problems.push(format!("error text: got {actual:?}"));
            }
        } else if actual != wanted {
            problems.push(format!("error text: got {actual:?}, expected {wanted:?}"));
        }
        if !outcome.results.is_empty() {
            problems.push("a failed run must not write results".to_string());
        }
        return problems;
    }

    if outcome.exit_code != Some(0) {
        problems.push(format!(
            "exit code {:?}, expected 0: {}",
            outcome.exit_code, outcome.stderr
        ));
        return problems;
    }
    if !outcome.stderr.is_empty() {
        problems.push(format!("unexpected error output: {}", outcome.stderr));
    }

    let expected_results = expected_dir.join(format!("{name}.json"));
    if !expected_results.exists() {
        if !outcome.results.is_empty() {
            problems.push("results were written but the reference has none".to_string());
        }
        return problems;
    }
    if outcome.results.len() != 1 {
        problems.push(format!(
            "expected one results file, found {}",
            outcome.results.len()
        ));
        return problems;
    }
    summary.results_files += 1;
    let actual_bytes = std::fs::read(&outcome.results[0]).expect("results file");
    let expected_bytes = std::fs::read(&expected_results).expect("expected results");
    if actual_bytes == expected_bytes {
        summary.identical_results_files += 1;
    } else if cfg!(windows) && exact_required() {
        problems.push("results bytes differ from the reference".to_string());
    }
    let actual_text = unix_lines(&actual_bytes);
    let expected_text = unix_lines(&expected_bytes);
    if actual_text != expected_text && exact_required() {
        problems.push("results text differs from the reference".to_string());
    }
    let actual: Value = match serde_json::from_str(&quoted_non_finite(&actual_text)) {
        Ok(value) => value,
        Err(error) => {
            problems.push(format!("results are not valid json: {error}"));
            return problems;
        }
    };
    let expected: Value =
        serde_json::from_str(&quoted_non_finite(&expected_text)).expect("expected results json");
    compare_values(&actual, &expected, 0.0, "results", summary, &mut problems);
    problems
}

#[test]
fn reference_cases_match() {
    let names = case_names();
    assert!(names.len() >= 51, "found {} cases", names.len());
    let next = AtomicUsize::new(0);
    let failures: Mutex<Vec<String>> = Mutex::new(Vec::new());
    let totals: Mutex<Summary> = Mutex::new(Summary::default());
    let workers = std::thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(2)
        .min(6);
    std::thread::scope(|scope| {
        for _ in 0..workers {
            scope.spawn(|| loop {
                let index = next.fetch_add(1, Ordering::SeqCst);
                let Some(name) = names.get(index) else {
                    break;
                };
                let mut summary = Summary::default();
                let problems = check_case(name, &mut summary);
                let mut totals = totals.lock().expect("totals");
                totals.cases += summary.cases;
                totals.results_files += summary.results_files;
                totals.identical_results_files += summary.identical_results_files;
                totals.identical_consoles += summary.identical_consoles;
                totals.numbers += summary.numbers;
                totals.identical_numbers += summary.identical_numbers;
                totals.failed_runs += summary.failed_runs;
                if !problems.is_empty() {
                    failures
                        .lock()
                        .expect("failures")
                        .push(format!("{name}:\n  {}", problems.join("\n  ")));
                }
            });
        }
    });
    let totals = totals.into_inner().expect("totals");
    eprintln!(
        "reference cases: {} cases, {} expected failures, {} of {} results files byte-identical, \
         {} of {} consoles byte-identical, {} of {} result numbers bit-identical",
        totals.cases,
        totals.failed_runs,
        totals.identical_results_files,
        totals.results_files,
        totals.identical_consoles,
        totals.cases,
        totals.identical_numbers,
        totals.numbers
    );
    let failures = failures.into_inner().expect("failures");
    assert!(failures.is_empty(), "{}", failures.join("\n"));
    assert_eq!(totals.cases, names.len());
    assert!(totals.results_files >= 37);
    assert!(totals.failed_runs >= 12);
}

#[test]
fn a_missing_argument_prints_the_usage() {
    let work = scratch_dir("usage");
    let outcome = run_program(&work, &[]);
    assert_eq!(outcome.exit_code, Some(1));
    assert_eq!(
        unix_lines(&outcome.stdout),
        "Usage: openrc-cli <config.txt>\n"
    );
    assert!(outcome.stderr.is_empty());
    remove_scratch(&work);
}

#[test]
fn a_missing_config_file_is_reported() {
    let work = scratch_dir("missing-config");
    let outcome = run_program(&work, &["input/absent.txt"]);
    assert_eq!(outcome.exit_code, Some(1));
    assert_eq!(
        unix_lines(&outcome.stdout),
        "Loading config: input/absent.txt\n"
    );
    assert_eq!(
        portable(outcome.stderr.trim_end()),
        "error: Config file not found: input/absent.txt"
    );
    assert!(outcome.results.is_empty());
    remove_scratch(&work);
}

#[test]
fn repeated_runs_give_identical_results() {
    let work = stage("repeat");
    let first = run_program(&work, &["input/StressTest_MOST.txt"]);
    assert_eq!(first.exit_code, Some(0), "{}", first.stderr);
    assert_eq!(first.results.len(), 1);
    let first_bytes = std::fs::read(&first.results[0]).expect("first results");
    let second = run_program(&work, &["input/StressTest_MOST.txt"]);
    assert_eq!(second.exit_code, Some(0), "{}", second.stderr);
    let second_bytes = std::fs::read(&second.results[0]).expect("second results");
    assert_eq!(first.stdout, second.stdout);
    assert_eq!(first_bytes, second_bytes);
    remove_scratch(&work);
}
