use std::path::Path;
use std::sync::OnceLock;

use serde_json::Value;

use openrc::text::{
    format_exp, format_fixed, pad_left, pad_right, path_text, repr_float, repr_str, repr_str_list,
    split_lines, strip, strip_end,
};

use crate::support::{items, number, text, texts, vector};

fn data() -> &'static Value {
    static DATA: OnceLock<Value> = OnceLock::new();
    DATA.get_or_init(|| vector("number.json"))
}

#[test]
fn float_text_matches_reference() {
    let rows = items(&data()["repr"]);
    assert!(rows.len() > 2700);
    for row in rows {
        let value = number(&row[0]);
        assert_eq!(repr_float(value), text(&row[1]), "repr of {value:e}");
    }
}

#[test]
fn exponent_format_matches_reference() {
    let rows = items(&data()["format_exp"]);
    assert!(rows.len() > 2700);
    for row in rows {
        let value = number(&row[0]);
        let precision = row[1].as_u64().expect("precision") as usize;
        assert_eq!(
            format_exp(value, precision),
            text(&row[2]),
            "exponent format of {value:e} with {precision} digits"
        );
    }
}

#[test]
fn fixed_format_matches_reference() {
    let rows = items(&data()["format_fixed"]);
    assert!(rows.len() > 2700);
    for row in rows {
        let value = number(&row[0]);
        let precision = row[1].as_u64().expect("precision") as usize;
        assert_eq!(
            format_fixed(value, precision),
            text(&row[2]),
            "fixed format of {value:e} with {precision} digits"
        );
    }
}

#[test]
fn stripping_matches_reference() {
    let rows = items(&data()["strip"]);
    assert!(rows.len() > 10);
    for row in rows {
        let input = text(&row[0]);
        assert_eq!(strip(input), text(&row[1]), "strip of {input:?}");
        assert_eq!(strip_end(input), text(&row[2]), "right strip of {input:?}");
    }
}

#[test]
fn quoted_text_matches_reference() {
    let rows = items(&data()["repr_str"]);
    assert!(rows.len() > 20);
    for row in rows {
        let input = text(&row[0]);
        assert_eq!(repr_str(input), text(&row[1]), "repr of {input:?}");
    }
    for row in items(&data()["repr_list"]) {
        let owned = texts(&row[0]);
        let borrowed: Vec<&str> = owned.iter().map(String::as_str).collect();
        assert_eq!(repr_str_list(&borrowed), text(&row[1]));
    }
}

#[test]
fn path_text_matches_reference() {
    let rows = items(&data()["path"]);
    assert!(rows.len() > 15);
    let column = if cfg!(windows) { 1 } else { 2 };
    for row in rows {
        let input = text(&row[0]);
        assert_eq!(
            path_text(Path::new(input)),
            text(&row[column]),
            "path text of {input:?}"
        );
    }
}

#[test]
fn line_splitting_matches_reference() {
    let rows = items(&data()["lines"]);
    assert!(rows.len() > 10);
    for row in rows {
        let input = text(&row[0]);
        let expected = texts(&row[1]);
        assert_eq!(split_lines(input), expected, "lines of {input:?}");
    }
}

#[test]
fn padding_counts_characters() {
    assert_eq!(pad_right("Cs-137", 12), "Cs-137      ");
    assert_eq!(pad_left("12.3456", 13), "      12.3456");
    assert_eq!(
        pad_left("\u{3c7}/Q(s/m\u{b3})", 12),
        "   \u{3c7}/Q(s/m\u{b3})"
    );
    assert_eq!(pad_left("longer than width", 4), "longer than width");
}
