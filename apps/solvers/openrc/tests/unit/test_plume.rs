use std::sync::OnceLock;

use serde_json::Value;

use openrc::rcad::{ndtr, Engine};

use crate::support::{flag, items, number, optional_number, vector, Tally};

fn data() -> &'static Value {
    static DATA: OnceLock<Value> = OnceLock::new();
    DATA.get_or_init(|| vector("plume.json"))
}

#[test]
fn vertical_term_matches_reference() {
    let rows = items(&data()["vertical_psi"]);
    assert!(rows.len() > 1500);
    let mut tally = Tally::new("plume vertical term");
    for row in rows {
        let mut engine = Engine::new();
        let actual = engine.vertical_psi(
            number(&row[0]),
            number(&row[1]),
            number(&row[2]),
            optional_number(&row[3]),
            flag(&row[4]),
            row[5].as_i64().expect("terms"),
            flag(&row[6]),
        );
        tally.check(actual, number(&row[7]), &|| format!("{row}"));
    }
    tally.finish();
}

#[test]
fn gaussian_plume_matches_reference() {
    let rows = items(&data()["gaussian_plume"]);
    assert!(rows.len() > 800);
    let mut tally = Tally::new("plume concentration");
    for row in rows {
        let mut engine = Engine::new();
        let actual = engine.gaussian_plume(
            number(&row[0]),
            number(&row[1]),
            number(&row[2]),
            number(&row[3]),
            number(&row[4]),
            number(&row[5]),
            number(&row[6]),
            number(&row[7]),
            optional_number(&row[8]),
            flag(&row[9]),
            row[10].as_i64().expect("terms"),
            flag(&row[11]),
        );
        tally.check(actual, number(&row[12]), &|| format!("{row}"));
    }
    tally.finish();
}

#[test]
fn normal_distribution_matches_reference() {
    let rows = items(&data()["ndtr"]);
    assert!(rows.len() > 3000);
    let mut tally = Tally::new("plume normal distribution");
    for row in rows {
        let x = number(&row[0]);
        tally.check(ndtr(x), number(&row[1]), &|| format!("ndtr({x:e})"));
    }
    tally.finish();
}
