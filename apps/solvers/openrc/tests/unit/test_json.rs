use serde_json::Value;

use openrc::json::{object_insert, to_indented_text, JsonValue};

use crate::support::{items, text, vector};

fn convert(value: &Value) -> JsonValue {
    match value {
        Value::Null => JsonValue::Null,
        Value::Bool(flag) => JsonValue::Bool(*flag),
        Value::Number(number) => match number.as_i64() {
            Some(integer) => JsonValue::Int(integer),
            None => JsonValue::Float(number.as_f64().expect("float")),
        },
        Value::String(marker) if marker == "@nan" => JsonValue::Float(f64::NAN),
        Value::String(marker) if marker == "@inf" => JsonValue::Float(f64::INFINITY),
        Value::String(marker) if marker == "@-inf" => JsonValue::Float(f64::NEG_INFINITY),
        Value::String(content) => JsonValue::text(content),
        Value::Array(entries) => JsonValue::List(entries.iter().map(convert).collect()),
        Value::Object(entries) => JsonValue::Object(
            entries
                .iter()
                .map(|(key, entry)| (key.clone(), convert(entry)))
                .collect(),
        ),
    }
}

#[test]
fn indented_text_matches_reference() {
    let data = vector("number.json");
    let rows = items(&data["json"]);
    assert!(rows.len() > 10);
    for row in rows {
        assert_eq!(
            to_indented_text(&convert(&row[0])),
            text(&row[1]),
            "{}",
            row[0]
        );
    }
}

#[test]
fn inserting_an_existing_key_keeps_its_place() {
    let mut entries: Vec<(String, JsonValue)> = Vec::new();
    object_insert(&mut entries, "100", JsonValue::Int(1));
    object_insert(&mut entries, "200", JsonValue::Int(2));
    object_insert(&mut entries, "100", JsonValue::Int(3));
    assert_eq!(
        entries,
        vec![
            ("100".to_string(), JsonValue::Int(3)),
            ("200".to_string(), JsonValue::Int(2)),
        ]
    );
}

#[test]
fn helper_constructors_build_the_expected_shapes() {
    assert_eq!(JsonValue::optional_float(None), JsonValue::Null);
    assert_eq!(JsonValue::optional_float(Some(2.5)), JsonValue::Float(2.5));
    assert_eq!(
        to_indented_text(&JsonValue::grid(&[vec![1.0, 2.5], vec![]])),
        "[\n  [\n    1.0,\n    2.5\n  ],\n  []\n]"
    );
    assert_eq!(
        to_indented_text(&JsonValue::texts(&["a".to_string()])),
        "[\n  \"a\"\n]"
    );
}
