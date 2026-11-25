use std::sync::OnceLock;

use serde_json::Value;

use openrc::rcad::{decay_fraction_at_time, safe_dcf, simulate_decay_chain_activity_fractions};

use crate::support::{items, number, numbers, same_bits, text, vector, Tally};

fn data() -> &'static Value {
    static DATA: OnceLock<Value> = OnceLock::new();
    DATA.get_or_init(|| vector("decay.json"))
}

#[test]
fn decay_fraction_matches_reference() {
    let rows = items(&data()["fractions"]);
    assert!(rows.len() > 1500);
    let mut tally = Tally::new("decay fraction");
    for row in rows {
        let (half_life, time) = (number(&row[0]), number(&row[1]));
        tally.check(
            decay_fraction_at_time(half_life, time),
            number(&row[2]),
            &|| format!("half-life {half_life:e}, time {time:e}"),
        );
    }
    tally.finish();
}

#[test]
fn chain_fractions_match_reference() {
    let decay_data = &data()["decay_data"];
    let cases = items(&data()["chains"]);
    assert!(cases.len() > 80);
    let mut tally = Tally::new("decay chains");
    let mut with_daughters = 0;
    for case in cases {
        let parent = text(&case["parent"]);
        let collapse = number(&case["collapse"]);
        let times = numbers(&case["times"]);
        let actual = simulate_decay_chain_activity_fractions(parent, decay_data, &times, collapse)
            .unwrap_or_else(|error| panic!("{parent}: {error}"));
        let expected = items(&case["result"]);
        assert_eq!(actual.len(), expected.len(), "{parent}: time count");
        for ((actual_time, actual_fractions), expected_entry) in actual.iter().zip(expected) {
            assert!(
                same_bits(*actual_time, number(&expected_entry[0])),
                "{parent}: time order"
            );
            let expected_fractions = items(&expected_entry[1]);
            assert_eq!(
                actual_fractions.len(),
                expected_fractions.len(),
                "{parent} with collapse {collapse}: nuclide count"
            );
            if expected_fractions.len() > 1 {
                with_daughters += 1;
            }
            for ((name, fraction), expected_pair) in actual_fractions.iter().zip(expected_fractions)
            {
                assert_eq!(name, text(&expected_pair[0]), "{parent}: nuclide order");
                tally.check(*fraction, number(&expected_pair[1]), &|| {
                    format!("{parent} to {name} at {actual_time:e} with collapse {collapse}")
                });
            }
        }
    }
    assert!(with_daughters > 60, "with daughters {with_daughters}");
    tally.finish();
}

#[test]
fn safe_coefficients_match_reference() {
    let table = &data()["safe_table"];
    let rows = items(&data()["safe"]);
    assert_eq!(rows.len(), 10);
    for row in rows {
        let key = text(&row[0]);
        let actual = safe_dcf(Some(table), key).expect("coefficient");
        assert!(
            same_bits(actual, number(&row[1])),
            "{key}: got {actual:e}, expected {}",
            row[1]
        );
    }
    assert!(same_bits(
        safe_dcf(None, "a").expect("coefficient"),
        number(&data()["safe_none"])
    ));
}

#[test]
fn coefficients_that_are_not_numbers_are_rejected() {
    let table = serde_json::json!({"text": "1.5", "list": [1.0]});
    assert_eq!(
        safe_dcf(Some(&table), "text").expect_err("text").kind(),
        "InvalidType"
    );
    assert_eq!(
        safe_dcf(Some(&table), "list").expect_err("list").kind(),
        "InvalidType"
    );
}
