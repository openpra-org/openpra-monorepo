use std::fs;
use std::path::PathBuf;

use praxis::core::distribution::{parse_parameter_table, validate_parameter_table};

fn fixtures(folder: &str) -> Vec<(String, String)> {
    let directory = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../interfaces/mef-types/core/fixtures/uncertainty")
        .join(folder);
    let mut entries: Vec<(String, String)> = fs::read_dir(&directory)
        .unwrap_or_else(|error| panic!("{}: {}", directory.display(), error))
        .map(|entry| {
            let path = entry.unwrap().path();
            let name = path.file_name().unwrap().to_string_lossy().to_string();
            (name, fs::read_to_string(&path).unwrap())
        })
        .collect();
    entries.sort();
    assert!(!entries.is_empty(), "no fixtures in {}", folder);
    entries
}

#[test]
fn valid_fixtures_parse_and_validate() {
    for (name, text) in fixtures("valid") {
        let table = parse_parameter_table(&text).unwrap_or_else(|error| panic!("{}: {}", name, error));
        validate_parameter_table(&table).unwrap_or_else(|error| panic!("{}: {}", name, error));
    }
}

fn numbers_as_floats(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Number(number) => serde_json::json!(number.as_f64().unwrap()),
        serde_json::Value::Array(items) => {
            serde_json::Value::Array(items.into_iter().map(numbers_as_floats).collect())
        }
        serde_json::Value::Object(fields) => serde_json::Value::Object(
            fields
                .into_iter()
                .map(|(key, field)| (key, numbers_as_floats(field)))
                .collect(),
        ),
        other => other,
    }
}

#[test]
fn valid_fixtures_round_trip_to_the_same_json() {
    for (name, text) in fixtures("valid") {
        let table = parse_parameter_table(&text).unwrap();
        let written = numbers_as_floats(serde_json::to_value(&table).unwrap());
        let original = numbers_as_floats(serde_json::from_str(&text).unwrap());
        assert_eq!(written, original, "{}", name);
    }
}

#[test]
fn invalid_shape_fixtures_fail_to_parse() {
    for (name, text) in fixtures("invalid-shape") {
        assert!(parse_parameter_table(&text).is_err(), "{} parsed", name);
    }
}

#[test]
fn invalid_meaning_fixtures_parse_then_fail_validation() {
    for (name, text) in fixtures("invalid-meaning") {
        let table = parse_parameter_table(&text).unwrap_or_else(|error| panic!("{}: {}", name, error));
        assert!(validate_parameter_table(&table).is_err(), "{} validated", name);
    }
}
