use std::sync::OnceLock;

use serde_json::Value;

use openrc::rcre::{
    chemical_group_for_nuclide, compute_segment_releases, deposition_velocity_for_nuclide,
};

use crate::support::{items, number, numbers, pairs, same_bits, segments, text, vector};

fn data() -> &'static Value {
    static DATA: OnceLock<Value> = OnceLock::new();
    DATA.get_or_init(|| vector("rcre.json"))
}

fn same_pairs(actual: &[(String, f64)], expected: &[(String, f64)]) -> bool {
    actual.len() == expected.len()
        && actual
            .iter()
            .zip(expected)
            .all(|(actual, expected)| actual.0 == expected.0 && same_bits(actual.1, expected.1))
}

#[test]
fn groups_and_velocities_match_reference() {
    let custom = numbers(&data()["custom"]);
    let short = numbers(&data()["short"]);
    let rows = items(&data()["groups"]);
    assert!(rows.len() > 1300);
    let mut mapped = 0;
    for row in rows {
        let nuclide = text(&row[0]);
        let expected_group = row[1].as_u64().map(|group| group as usize);
        assert_eq!(
            chemical_group_for_nuclide(nuclide),
            expected_group,
            "group of {nuclide:?}"
        );
        if expected_group.is_some() {
            mapped += 1;
        }
        let checks: [(Option<&[f64]>, &Value); 4] = [
            (None, &row[2]),
            (Some(&custom), &row[3]),
            (Some(&short), &row[4]),
            (Some(&[]), &row[5]),
        ];
        for (velocities, expected) in checks {
            let actual = deposition_velocity_for_nuclide(nuclide, velocities);
            assert!(
                same_bits(actual, number(expected)),
                "velocity of {nuclide:?} with {velocities:?}: got {actual:e}, expected {expected}"
            );
        }
    }
    assert!(mapped > 300, "mapped {mapped}");
}

#[test]
fn segment_releases_match_reference() {
    let cases = items(&data()["releases"]);
    assert_eq!(cases.len(), 12);
    for case in cases {
        let source = pairs(&case["source"]);
        let plume_segments = segments(&case["segments"]);
        let velocities = if case["velocities"].is_null() {
            None
        } else {
            Some(numbers(&case["velocities"]))
        };
        let actual = compute_segment_releases(&source, &plume_segments, velocities.as_deref());
        let expected = items(&case["result"]);
        assert_eq!(actual.len(), expected.len());
        for (actual, expected) in actual.iter().zip(expected) {
            assert!(same_bits(actual.delay_s, number(&expected["delay_s"])));
            assert!(same_bits(
                actual.duration_s,
                number(&expected["duration_s"])
            ));
            assert!(same_bits(actual.height_m, number(&expected["height_m"])));
            assert!(
                same_pairs(&actual.released_bq, &pairs(&expected["released_bq"])),
                "released: got {:?}, expected {}",
                actual.released_bq,
                expected["released_bq"]
            );
            assert!(
                same_pairs(
                    &actual.deposition_velocity_by_nuclide,
                    &pairs(&expected["deposition_velocity_by_nuclide"])
                ),
                "velocities: got {:?}, expected {}",
                actual.deposition_velocity_by_nuclide,
                expected["deposition_velocity_by_nuclide"]
            );
        }
    }
}
