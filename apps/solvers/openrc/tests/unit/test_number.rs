use std::sync::OnceLock;

use serde_json::Value;

use openrc::number::{
    max_of, min_of, modulo, parse_float, parse_int, power, round_to_digits, square, sum_floats,
};

use crate::support::{items, number, numbers, same_bits, text, vector, Tally};

fn data() -> &'static Value {
    static DATA: OnceLock<Value> = OnceLock::new();
    DATA.get_or_init(|| vector("number.json"))
}

#[test]
fn rounding_matches_reference() {
    let rows = items(&data()["round"]);
    assert!(rows.len() > 2000);
    for row in rows {
        let value = number(&row[0]);
        let digits = row[1].as_u64().expect("digits") as usize;
        let expected = number(&row[2]);
        let actual = round_to_digits(value, digits);
        assert!(
            same_bits(actual, expected),
            "round({value:e}, {digits}): got {actual:e}, expected {expected:e}"
        );
    }
}

#[test]
fn rounding_keeps_values_that_are_not_finite() {
    assert!(round_to_digits(f64::NAN, 9).is_nan());
    assert_eq!(round_to_digits(f64::INFINITY, 3), f64::INFINITY);
    assert_eq!(round_to_digits(f64::NEG_INFINITY, 3), f64::NEG_INFINITY);
}

#[test]
fn float_parsing_matches_reference() {
    let rows = items(&data()["parse_float"]);
    assert!(rows.len() > 70);
    for row in rows {
        let input = text(&row[0]);
        let actual = parse_float(input);
        if row[1].is_null() {
            assert_eq!(actual, None, "float({input:?}) must be rejected");
        } else {
            let expected = number(&row[1]);
            let actual = actual.unwrap_or_else(|| panic!("float({input:?}) must parse"));
            assert!(
                same_bits(actual, expected),
                "float({input:?}): got {actual:e}, expected {expected:e}"
            );
        }
    }
}

#[test]
fn integer_parsing_matches_reference() {
    let rows = items(&data()["parse_int"]);
    assert!(rows.len() > 20);
    for row in rows {
        let input = text(&row[0]);
        assert_eq!(parse_int(input), row[1].as_i64(), "int({input:?})");
    }
}

#[test]
fn sums_match_reference() {
    let rows = items(&data()["sum"]);
    assert!(rows.len() > 600);
    for row in rows {
        let values = numbers(&row[0]);
        let expected = number(&row[1]);
        let actual = sum_floats(values.iter().copied());
        assert!(
            same_bits(actual, expected),
            "sum({values:?}): got {actual:e}, expected {expected:e}"
        );
    }
}

#[test]
fn modulo_matches_reference() {
    let rows = items(&data()["modulo"]);
    assert!(rows.len() > 1500);
    for row in rows {
        let (value, divisor, expected) = (number(&row[0]), number(&row[1]), number(&row[2]));
        let actual = modulo(value, divisor);
        assert!(
            same_bits(actual, expected),
            "{value:e} % {divisor:e}: got {actual:e}, expected {expected:e}"
        );
    }
}

#[test]
fn powers_match_reference() {
    let rows = items(&data()["power"]);
    assert!(rows.len() > 4000);
    let mut tally = Tally::new("number power");
    for row in rows {
        let (base, exponent, expected) = (number(&row[0]), number(&row[1]), number(&row[2]));
        let actual = if exponent == 2.0 {
            square(base)
        } else {
            power(base, exponent)
        };
        tally.check(actual, expected, &|| format!("{base:e} ** {exponent}"));
    }
    tally.finish();
}

#[test]
fn larger_and_smaller_follow_the_reference_rule_for_unordered_values() {
    assert_eq!(max_of(1.0, 2.0), 2.0);
    assert_eq!(max_of(2.0, 1.0), 2.0);
    assert!(max_of(f64::NAN, 1.0).is_nan());
    assert_eq!(max_of(1.0, f64::NAN), 1.0);
    assert_eq!(min_of(1.0, 2.0), 1.0);
    assert_eq!(min_of(2.0, 1.0), 1.0);
    assert!(min_of(f64::NAN, 1.0).is_nan());
    assert_eq!(min_of(1.0, f64::NAN), 1.0);
    assert!(max_of(0.0, -0.0).is_sign_positive());
    assert!(max_of(-0.0, 0.0).is_sign_negative());
}
