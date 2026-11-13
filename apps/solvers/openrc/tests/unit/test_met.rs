use openrc::met::{load_met, MetRecord};
use openrc::text::path_text;

use crate::support::{
    items, kind_for, records, remove_scratch, same_bits, scratch_dir, text, vector,
};

fn same_optional(actual: Option<f64>, expected: Option<f64>) -> bool {
    match (actual, expected) {
        (None, None) => true,
        (Some(actual), Some(expected)) => same_bits(actual, expected),
        _ => false,
    }
}

pub(crate) fn same_record(actual: &MetRecord, expected: &MetRecord) -> bool {
    actual.stability_class == expected.stability_class
        && same_bits(actual.wind_speed_m_s, expected.wind_speed_m_s)
        && same_optional(actual.wind_dir_deg, expected.wind_dir_deg)
        && same_optional(actual.u_star_m_s, expected.u_star_m_s)
        && same_optional(actual.mixing_height_m, expected.mixing_height_m)
        && same_optional(actual.sigma_v_m_s, expected.sigma_v_m_s)
        && same_optional(actual.sigma_w_m_s, expected.sigma_w_m_s)
        && same_optional(
            actual.sensible_heat_flux_w_m2,
            expected.sensible_heat_flux_w_m2,
        )
        && same_optional(actual.temperature_c, expected.temperature_c)
        && same_optional(actual.pressure_pa, expected.pressure_pa)
}

#[test]
fn met_files_match_reference() {
    let data = vector("met.json");
    let directory = scratch_dir("met");
    let cases = items(&data["cases"]);
    assert!(cases.len() > 25);
    for (index, case) in cases.iter().enumerate() {
        let name = text(&case["name"]);
        let path = if case["text"].is_null() {
            directory.join("absent.met")
        } else {
            let path = directory.join(format!("met_{index}.met"));
            std::fs::write(&path, text(&case["text"])).expect("write met file");
            path
        };
        let result = load_met(&path);
        match case.get("error") {
            None => {
                let actual = result.unwrap_or_else(|error| panic!("{name}: must load: {error}"));
                let expected = records(&case["records"]);
                assert_eq!(actual.len(), expected.len(), "{name}: record count");
                for (row, (actual, expected)) in actual.iter().zip(&expected).enumerate() {
                    assert!(
                        same_record(actual, expected),
                        "{name}: record {row}: got {actual:?}, expected {expected:?}"
                    );
                }
            }
            Some(expected) => {
                let error = match result {
                    Ok(_) => panic!("{name}: must fail with {}", expected["type"]),
                    Err(error) => error,
                };
                assert_eq!(
                    error.kind(),
                    kind_for(text(&expected["type"])),
                    "{name}: {}",
                    error.message()
                );
                let actual = error
                    .message()
                    .replace(&path_text(&path), "@PATH@")
                    .replace(&path_text(&directory), "@DATA@")
                    .replace('\\', "/");
                let expected_message =
                    text(&expected["message"]).replace("@DATA@/absent.met", "@PATH@");
                assert_eq!(actual, expected_message, "{name}");
            }
        }
    }
    remove_scratch(&directory);
}

#[test]
fn single_trial_record_has_only_class_and_speed() {
    let record = MetRecord::new("D", 3.0);
    assert_eq!(record.stability_class, "D");
    assert_eq!(record.wind_speed_m_s, 3.0);
    assert_eq!(record.wind_dir_deg, None);
    assert_eq!(record.u_star_m_s, None);
    assert_eq!(record.mixing_height_m, None);
    assert_eq!(record.sigma_v_m_s, None);
    assert_eq!(record.sigma_w_m_s, None);
    assert_eq!(record.sensible_heat_flux_w_m2, None);
    assert_eq!(record.temperature_c, None);
    assert_eq!(record.pressure_pa, None);
}
