use serde_json::Value;

use openrc::sort::{order_by_key, sort_by_less, sort_floats};

use crate::support::{items, numbers, same_bits, text, vector};

fn indices(value: &Value) -> Vec<usize> {
    items(value)
        .iter()
        .map(|index| index.as_u64().expect("index") as usize)
        .collect()
}

fn next(state: &mut u64) -> u64 {
    *state ^= *state << 13;
    *state ^= *state >> 7;
    *state ^= *state << 17;
    *state
}

#[test]
fn orders_match_reference() {
    let data = vector("sort.json");
    let cases = items(&data["cases"]);
    assert!(cases.len() > 1000, "found {} lists", cases.len());
    let mut values_checked = 0;
    let mut lists_with_nan = 0;
    let mut reversed_lists = 0;
    for case in cases {
        let name = text(&case["name"]);
        let values = numbers(&case["values"]);
        let expected = indices(&case["order"]);
        assert_eq!(values.len(), expected.len(), "{name}");
        assert_eq!(order_by_key(&values, false), expected, "{name}: order");

        let mut sorted = values.clone();
        sort_floats(&mut sorted);
        for (position, index) in expected.iter().enumerate() {
            assert!(
                same_bits(sorted[position], values[*index]),
                "{name}: position {position}: got {:e}, expected {:e}",
                sorted[position],
                values[*index]
            );
        }

        if let Some(reverse) = case.get("reverse_order") {
            assert_eq!(
                order_by_key(&values, true),
                indices(reverse),
                "{name}: reverse order"
            );
            reversed_lists += 1;
        }
        values_checked += values.len();
        lists_with_nan += usize::from(values.iter().any(|value| value.is_nan()));
    }
    assert!(values_checked > 100_000, "checked {values_checked} values");
    assert!(lists_with_nan > 500, "{lists_with_nan} lists with nan");
    assert!(reversed_lists > 900, "{reversed_lists} reversed lists");
}

#[test]
fn ordered_numbers_sort_like_a_stable_sort() {
    let mut state = 0x2545_f491_4f6c_dd1d_u64;
    for round in 0..400 {
        let count = (next(&mut state) % 700) as usize;
        let spread = 1 + next(&mut state) % 50;
        let keyed: Vec<(f64, usize)> = (0..count)
            .map(|index| ((next(&mut state) % spread) as f64 - 10.0, index))
            .collect();

        let mut expected = keyed.clone();
        expected.sort_by(|first, second| first.0.total_cmp(&second.0));
        let mut actual = keyed.clone();
        sort_by_less(&mut actual, |first, second| first.0 < second.0);
        assert_eq!(actual, expected, "round {round}: {count} values");

        let keys: Vec<f64> = keyed.iter().map(|(key, _)| *key).collect();
        let order = order_by_key(&keys, false);
        let expected_order: Vec<usize> = expected.iter().map(|(_, index)| *index).collect();
        assert_eq!(order, expected_order, "round {round}: order");

        let mut descending = keyed.clone();
        descending.sort_by(|first, second| second.0.total_cmp(&first.0));
        let expected_reverse: Vec<usize> = descending.iter().map(|(_, index)| *index).collect();
        assert_eq!(
            order_by_key(&keys, true),
            expected_reverse,
            "round {round}: reverse order"
        );
    }
}

#[test]
fn any_mix_of_numbers_sorts_without_losing_a_value() {
    let mut state = 0x9e37_79b9_7f4a_7c15_u64;
    for round in 0..300 {
        let count = (next(&mut state) % 1500) as usize;
        let values: Vec<f64> = (0..count)
            .map(|_| match next(&mut state) % 9 {
                0 => f64::NAN,
                1 => f64::INFINITY,
                2 => f64::NEG_INFINITY,
                3 => -0.0,
                4 => 0.0,
                _ => (next(&mut state) % 2000) as f64 / 8.0 - 100.0,
            })
            .collect();
        let mut sorted = values.clone();
        sort_floats(&mut sorted);

        let mut before: Vec<u64> = values.iter().map(|value| value.to_bits()).collect();
        let mut after: Vec<u64> = sorted.iter().map(|value| value.to_bits()).collect();
        before.sort_unstable();
        after.sort_unstable();
        assert_eq!(before, after, "round {round}: {count} values");

        let order = order_by_key(&values, round % 2 == 0);
        let mut seen = order.clone();
        seen.sort_unstable();
        assert_eq!(seen, (0..count).collect::<Vec<usize>>(), "round {round}");
    }
}

#[test]
fn short_lists_are_left_as_they_are() {
    let mut empty: [f64; 0] = [];
    sort_floats(&mut empty);
    let mut single = [f64::NAN];
    sort_floats(&mut single);
    assert!(single[0].is_nan());
    assert_eq!(order_by_key(&[], true), Vec::<usize>::new());
    assert_eq!(order_by_key(&[3.0], true), [0]);
    assert_eq!(order_by_key(&[1.0, 1.0, 1.0], false), [0, 1, 2]);
    assert_eq!(order_by_key(&[1.0, 1.0, 1.0], true), [0, 1, 2]);
    assert_eq!(order_by_key(&[2.0, 3.0, 1.0], true), [1, 0, 2]);
}
