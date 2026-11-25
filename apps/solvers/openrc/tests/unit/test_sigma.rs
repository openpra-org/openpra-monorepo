use std::sync::OnceLock;

use serde_json::Value;

use openrc::rcad::{hanna_sigma_yz, opts_sigma_yz, sigma_y, sigma_yz, sigma_z};

use crate::support::{items, number, options, text, vector, Tally};

fn data() -> &'static Value {
    static DATA: OnceLock<Value> = OnceLock::new();
    DATA.get_or_init(|| vector("sigma.json"))
}

#[test]
fn table_sigmas_match_reference() {
    let rows = items(&data()["ek"]);
    assert!(rows.len() > 2500);
    let mut tally = Tally::new("sigma tables");
    for row in rows {
        let stability = text(&row[0]);
        let distance = number(&row[1]);
        tally.check(sigma_y(distance, stability), number(&row[2]), &|| {
            format!("sigma_y({distance:e}, {stability:?})")
        });
        tally.check(sigma_z(distance, stability), number(&row[3]), &|| {
            format!("sigma_z({distance:e}, {stability:?})")
        });
    }
    for row in items(&data()["pairs"]) {
        let stability = text(&row[0]);
        let distance = number(&row[1]);
        let (sy, sz) = sigma_yz(distance, stability);
        tally.check(sy, number(&row[2]), &|| {
            format!("sigma_yz({distance:e}, {stability:?}) y")
        });
        tally.check(sz, number(&row[3]), &|| {
            format!("sigma_yz({distance:e}, {stability:?}) z")
        });
    }
    tally.finish();
}

#[test]
fn measured_turbulence_sigmas_match_reference() {
    let rows = items(&data()["hanna"]);
    assert!(rows.len() > 500);
    let mut tally = Tally::new("sigma measured turbulence");
    for row in rows {
        let inputs: Vec<f64> = row.as_array().expect("row").iter().map(number).collect();
        let (sy, sz) = hanna_sigma_yz(
            inputs[0], inputs[1], inputs[2], inputs[3], inputs[4], inputs[5],
        );
        tally.check(sy, inputs[6], &|| format!("sigma_y for {inputs:?}"));
        tally.check(sz, inputs[7], &|| format!("sigma_z for {inputs:?}"));
    }
    tally.finish();
}

#[test]
fn option_driven_sigmas_match_reference() {
    let rows = items(&data()["opts"]);
    assert!(rows.len() >= 500);
    let mut tally = Tally::new("sigma by options");
    for row in rows {
        let opts = options(&row["opts"]);
        let distance = number(&row["distance"]);
        let (sy, sz) = opts_sigma_yz(distance, &opts);
        tally.check(sy, number(&row["sy"]), &|| {
            format!("sigma_y at {distance:e} for {opts:?}")
        });
        tally.check(sz, number(&row["sz"]), &|| {
            format!("sigma_z at {distance:e} for {opts:?}")
        });
    }
    tally.finish();
}
