use std::sync::OnceLock;

use serde_json::Value;

use openrc::rcad::{Engine, Receptor, DEFAULT_N_INTERVALS, DEFAULT_N_TERMS};

use crate::support::{items, number, optional_number, options, text, vector, Tally};

fn data() -> &'static Value {
    static DATA: OnceLock<Value> = OnceLock::new();
    DATA.get_or_init(|| vector("depletion.json"))
}

#[test]
fn depletion_fraction_matches_reference() {
    let cases = items(&data()["cases"]);
    assert!(cases.len() >= 800);
    let mut tally = Tally::new("depletion fraction");
    for case in cases {
        let opts = options(&case["opts"]);
        let mut engine = Engine::new();
        let actual = engine.dry_dep_fraction_remaining(
            number(&case["x_m"]),
            &opts,
            optional_number(&case["v_d"]),
            case["n_intervals"].as_i64().expect("intervals"),
        );
        tally.check(actual, number(&case["result"]), &|| format!("{case}"));
    }
    tally.finish();
}

#[test]
fn chi_over_q_matches_reference() {
    let cases = items(&data()["chi_over_q"]);
    assert!(cases.len() >= 400);
    let mut tally = Tally::new("depletion chi over q");
    for case in cases {
        let opts = options(&case["opts"]);
        let receptor = Receptor {
            x_m: number(&case["receptor"][0]),
            y_m: number(&case["receptor"][1]),
            z_m: number(&case["receptor"][2]),
        };
        let mut engine = Engine::new();
        let actual = engine.chi_over_q_gaussian(&receptor, &opts);
        tally.check(actual, number(&case["result"]), &|| format!("{case}"));
    }
    tally.finish();
}

#[test]
fn cached_values_follow_the_reference_across_calls() {
    let sessions = items(&data()["sessions"]);
    assert_eq!(sessions.len(), 4);
    let mut tally = Tally::new("depletion call sequences");
    for session in sessions {
        let name = text(&session["name"]);
        let base = &session["base_opts"];
        let mut engine = Engine::new();
        for (index, step) in items(&session["steps"]).iter().enumerate() {
            if text(&step[0]) == "dry_dep" {
                let mut merged = base.clone();
                for (key, value) in step[2].as_object().expect("changes") {
                    merged[key.as_str()] = value.clone();
                }
                let opts = options(&merged);
                let actual = engine.dry_dep_fraction_remaining(
                    number(&step[1]),
                    &opts,
                    optional_number(&step[3]),
                    DEFAULT_N_INTERVALS,
                );
                tally.check(actual, number(&step[4]), &|| format!("{name} step {index}"));
            } else {
                let actual = engine.vertical_psi(
                    number(&step[1]),
                    number(&step[2]),
                    number(&step[3]),
                    optional_number(&step[4]),
                    true,
                    DEFAULT_N_TERMS,
                    false,
                );
                tally.check(actual, number(&step[5]), &|| format!("{name} step {index}"));
            }
        }
    }
    tally.finish();
}

#[test]
fn a_fresh_engine_does_not_see_values_cached_by_another() {
    let sessions = items(&data()["sessions"]);
    let session = &sessions[0];
    let steps = items(&session["steps"]);
    let mut merged = session["base_opts"].clone();
    for (key, value) in steps[1][2].as_object().expect("changes") {
        merged[key.as_str()] = value.clone();
    }
    let tall = options(&merged);
    let ground = options(&session["base_opts"]);
    let mut shared = Engine::new();
    let first = shared.dry_dep_fraction_remaining(2500.0, &ground, Some(0.003), 80);
    let reused = shared.dry_dep_fraction_remaining(2500.0, &tall, Some(0.003), 80);
    let mut fresh = Engine::new();
    let recomputed = fresh.dry_dep_fraction_remaining(2500.0, &tall, Some(0.003), 80);
    assert_eq!(first.to_bits(), reused.to_bits());
    assert_ne!(reused.to_bits(), recomputed.to_bits());
}
