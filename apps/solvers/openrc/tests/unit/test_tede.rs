use openrc::rcad::{Engine, GaussianOptions, Receptor};

use crate::support::{
    check_error, flag, items, number, numbers, options, pairs, segments, text, texts, vector, Tally,
};

#[test]
fn centerline_dose_matches_reference() {
    let data = vector("tede.json");
    let decay_data = &data["decay_data"];
    let cases = items(&data["cases"]);
    assert!(cases.len() > 320);
    let mut tally = Tally::new("centerline dose");
    let mut succeeded = 0;
    let mut failed = 0;
    let mut with_dose = 0;
    let mut with_epz = 0;
    for (index, case) in cases.iter().enumerate() {
        let source = pairs(&case["source"]);
        let receptor = Receptor {
            x_m: number(&case["receptor"][0]),
            y_m: number(&case["receptor"][1]),
            z_m: number(&case["receptor"][2]),
        };
        let opts: Option<GaussianOptions> = if case["opts"].is_null() {
            None
        } else {
            Some(options(&case["opts"]))
        };
        let plume_segments = segments(&case["segments"]);
        let velocities = if case["velocities"].is_null() {
            None
        } else {
            Some(numbers(&case["velocities"]))
        };
        let decay = if flag(&case["synthetic_decay"]) {
            Some(decay_data.clone())
        } else {
            None
        };
        let mut engine = Engine::with_data(None, decay);
        let result = engine.run_gaussian_tede(
            &source,
            &receptor,
            number(&case["integration_time_s"]),
            opts.as_ref(),
            text(&case["organ"]),
            &plume_segments,
            velocities.as_deref(),
        );
        if let Some(expected) = case.get("error") {
            let error = match result {
                Ok(_) => panic!("case {index}: must fail with {expected}"),
                Err(error) => error,
            };
            check_error(&error, expected, &format!("case {index}"));
            failed += 1;
            continue;
        }
        let actual = result.unwrap_or_else(|error| panic!("case {index}: {error}"));
        let expected = &case["result"];
        let context = |field: &str| format!("case {index} {field}");
        tally.check(
            actual.chi_over_q_s_m3,
            number(&expected["chi_over_q_s_m3"]),
            &|| context("chi_over_q_s_m3"),
        );
        tally.check(
            actual.chi_bq_s_m3,
            number(&expected["chi_bq_s_m3"]),
            &|| context("chi_bq_s_m3"),
        );
        tally.check(actual.tede_sv, number(&expected["tede_sv"]), &|| {
            context("tede_sv")
        });
        tally.check(
            actual.dry_dep_fraction_remaining,
            number(&expected["dry_dep_fraction_remaining"]),
            &|| context("dry_dep_fraction_remaining"),
        );
        tally.check(
            actual.ground_deposition_bq_m2,
            number(&expected["ground_deposition_bq_m2"]),
            &|| context("ground_deposition_bq_m2"),
        );
        tally.check(
            actual.lmp_chi_over_q_s_m3,
            number(&expected["lmp_chi_over_q_s_m3"]),
            &|| context("lmp_chi_over_q_s_m3"),
        );
        tally.check(
            actual.lmp_tede_sv,
            number(&expected["lmp_tede_sv"]),
            &|| context("lmp_tede_sv"),
        );
        tally.check(
            actual.epz_distance_m,
            number(&expected["epz_distance_m"]),
            &|| context("epz_distance_m"),
        );
        assert_eq!(
            actual.missing_dcfs,
            texts(&expected["missing_dcfs"]),
            "case {index}: missing dose coefficients"
        );
        let expected_breakdown = items(&expected["breakdown"]);
        assert_eq!(
            actual.breakdown_sv_by_nuclide.len(),
            expected_breakdown.len(),
            "case {index}: breakdown size"
        );
        for ((name, dose), expected_pair) in actual
            .breakdown_sv_by_nuclide
            .iter()
            .zip(expected_breakdown)
        {
            assert_eq!(
                name,
                text(&expected_pair[0]),
                "case {index}: breakdown order"
            );
            tally.check(*dose, number(&expected_pair[1]), &|| {
                format!("case {index} breakdown {name}")
            });
        }
        succeeded += 1;
        if actual.tede_sv > 0.0 {
            with_dose += 1;
        }
        if actual.epz_distance_m > 0.0 {
            with_epz += 1;
        }
    }
    assert_eq!(failed, 3);
    assert!(succeeded >= 320, "succeeded {succeeded}");
    assert!(with_dose > 200, "with dose {with_dose}");
    assert!(with_epz > 50, "with emergency zone {with_epz}");
    tally.finish();
}
