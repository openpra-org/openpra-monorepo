use openrc::run::{downwind_sector_index, percentile};

use crate::support::{items, number, numbers, same_bits, vector};

#[test]
fn percentiles_match_reference() {
    let data = vector("run.json");
    let rows = items(&data["percentile"]);
    assert!(rows.len() > 200);
    for row in rows {
        let values = numbers(&row[0]);
        for pair in items(&row[1]) {
            let p = number(&pair[0]);
            let expected = number(&pair[1]);
            let actual = percentile(&values, p);
            assert!(
                same_bits(actual, expected),
                "percentile {p} of {values:?}: got {actual:e}, expected {expected:e}"
            );
        }
    }
}

#[test]
fn downwind_sector_matches_reference() {
    let data = vector("run.json");
    let rows = items(&data["downwind"]);
    assert!(rows.len() > 350);
    for row in rows {
        let azimuths = numbers(&row[0]);
        let wind = number(&row[1]);
        assert_eq!(
            downwind_sector_index(&azimuths, wind) as u64,
            row[2].as_u64().expect("sector"),
            "{} sectors, wind from {wind}",
            azimuths.len()
        );
    }
}
