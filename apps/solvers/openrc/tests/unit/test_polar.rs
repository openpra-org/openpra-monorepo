use openrc::met::MetRecord;
use openrc::rcad::Engine;

use crate::support::{
    check_error, flag, grid, items, number, numbers, options, pairs, records, segments, text,
    texts, vector, Tally,
};

#[test]
fn polar_grid_matches_reference() {
    let data = vector("polar.json");
    let decay_data = &data["decay_data"];
    let cases = items(&data["cases"]);
    assert!(cases.len() > 70);
    let mut tally = Tally::new("polar grid");
    let mut succeeded = 0;
    let mut failed = 0;
    let mut with_dose = 0;
    for (index, case) in cases.iter().enumerate() {
        let source = pairs(&case["source"]);
        let opts = options(&case["opts"]);
        let plume_segments = segments(&case["segments"]);
        let rings = numbers(&case["rings"]);
        let velocities = if case["velocities"].is_null() {
            None
        } else {
            Some(numbers(&case["velocities"]))
        };
        let segment_records: Option<Vec<MetRecord>> = if case["records"].is_null() {
            None
        } else {
            Some(records(&case["records"]))
        };
        let decay = if flag(&case["synthetic_decay"]) {
            Some(decay_data.clone())
        } else {
            None
        };
        let mut engine = Engine::with_data(None, decay);
        let result = engine.run_gaussian_polar(
            &source,
            case["sector_count"].as_i64().expect("sector count"),
            &rings,
            number(&case["wind_dir_deg"]),
            number(&case["integration_time_s"]),
            Some(&opts),
            text(&case["organ"]),
            &plume_segments,
            velocities.as_deref(),
            segment_records.as_deref(),
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
        let expected_azimuths = numbers(&expected["sector_azimuths_deg"]);
        assert_eq!(
            actual.sector_azimuths_deg.len(),
            expected_azimuths.len(),
            "case {index}: sector count"
        );
        for (actual_azimuth, expected_azimuth) in
            actual.sector_azimuths_deg.iter().zip(&expected_azimuths)
        {
            tally.check(*actual_azimuth, *expected_azimuth, &|| {
                format!("case {index} sector azimuth")
            });
        }
        assert_eq!(
            actual.ring_distances_m,
            numbers(&expected["ring_distances_m"]),
            "case {index}: rings"
        );
        tally.check(
            actual.wind_dir_deg,
            number(&expected["wind_dir_deg"]),
            &|| format!("case {index} wind direction"),
        );
        let fields: [(&str, &Vec<Vec<f64>>); 7] = [
            ("chi_q_s_m3", &actual.chi_q_s_m3),
            ("air_conc_bq_m3", &actual.air_conc_bq_m3),
            ("ground_dep_bq_m2", &actual.ground_dep_bq_m2),
            ("cloudshine_sv", &actual.cloudshine_sv),
            ("groundshine_sv", &actual.groundshine_sv),
            ("inhalation_sv", &actual.inhalation_sv),
            ("tede_sv", &actual.tede_sv),
        ];
        for (field, values) in fields {
            tally.check_grid(values, &grid(&expected[field]), &|| {
                format!("case {index} {field}")
            });
        }
        assert_eq!(
            actual.missing_dcfs,
            texts(&expected["missing_dcfs"]),
            "case {index}: missing dose coefficients"
        );
        succeeded += 1;
        if actual.tede_sv.iter().flatten().any(|dose| *dose > 0.0) {
            with_dose += 1;
        }
    }
    assert_eq!(failed, 6);
    assert!(succeeded >= 70, "succeeded {succeeded}");
    assert!(with_dose > 30, "with dose {with_dose}");
    tally.finish();
}
