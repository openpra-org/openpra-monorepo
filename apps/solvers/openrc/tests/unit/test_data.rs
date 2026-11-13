use serde_json::Value;

use openrc::dcf::{get_dcf_values, load_dcf_data};
use openrc::rcad::{dcf_for_organ, safe_dcf};
use openrc::st::{get_nuclide_data, load_decay_data};
use openrc::text::repr_float;

use crate::support::{items, number, same_bits, text, vector};

const PATHWAYS: [&str; 3] = ["inhalation_chronic", "cloudshine", "groundshine_rate"];

fn checksum(content: &str) -> String {
    let mut value: u64 = 0xCBF2_9CE4_8422_2325;
    for byte in content.bytes() {
        value ^= u64::from(byte);
        value = value.wrapping_mul(0x0000_0100_0000_01B3);
    }
    format!("{value:016x}")
}

#[test]
fn bundled_dose_coefficients_match_reference_for_every_organ() {
    let data = vector("rcre.json");
    let raw = load_dcf_data(None).expect("bundled dose coefficients");
    let rows = items(&data["dcf_tables"]);
    assert!(rows.len() > 28);
    for row in rows {
        let organ = text(&row[0]);
        let table = dcf_for_organ(raw, organ);
        assert_eq!(
            table.len() as u64,
            row[1].as_u64().expect("count"),
            "{organ}"
        );
        let mut nuclides: Vec<&str> = table.keys().copied().collect();
        nuclides.sort_unstable();
        let lines: Vec<String> = nuclides
            .iter()
            .map(|nuclide| {
                let values: Vec<String> = PATHWAYS
                    .iter()
                    .map(|pathway| {
                        repr_float(safe_dcf(Some(table[nuclide]), pathway).expect("coefficient"))
                    })
                    .collect();
                format!("{nuclide}|{}", values.join("|"))
            })
            .collect();
        assert_eq!(checksum(&lines.join("\n")), text(&row[2]), "{organ}");
    }
}

#[test]
fn bundled_effective_dose_coefficients_match_reference_value_by_value() {
    let data = vector("rcre.json");
    let raw = load_dcf_data(None).expect("bundled dose coefficients");
    let table = dcf_for_organ(raw, "ICRP60ED");
    let rows = items(&data["dcf_icrp60ed"]);
    assert_eq!(rows.len(), 1275);
    assert_eq!(table.len(), rows.len());
    for row in rows {
        let nuclide = text(&row[0]);
        let values = table
            .get(nuclide)
            .unwrap_or_else(|| panic!("{nuclide} is missing"));
        for (index, pathway) in PATHWAYS.iter().enumerate() {
            let actual = safe_dcf(Some(values), pathway).expect("coefficient");
            let expected = number(&row[index + 1]);
            assert!(
                same_bits(actual, expected),
                "{nuclide} {pathway}: got {actual:e}, expected {expected:e}"
            );
        }
    }
}

#[test]
fn dose_coefficient_lookups_match_reference() {
    let data = vector("rcre.json");
    let raw = load_dcf_data(None).expect("bundled dose coefficients");
    let rows = items(&data["dcf_lookups"]);
    assert_eq!(rows.len(), 6);
    for row in rows {
        let (nuclide, organ) = (text(&row[0]), text(&row[1]));
        let actual = get_dcf_values(raw, nuclide, organ);
        if row[2].is_null() {
            assert!(actual.is_none(), "{nuclide} {organ}");
        } else {
            assert_eq!(actual, Some(&row[2]), "{nuclide} {organ}");
        }
    }
}

#[test]
fn bundled_decay_data_matches_reference() {
    let data = vector("rcre.json");
    let decay = load_decay_data(None).expect("bundled decay data");
    let entries = decay.as_object().expect("decay entries");
    assert_eq!(
        entries.len() as u64,
        data["decay_count"].as_u64().expect("count")
    );
    let lines: Vec<String> = entries
        .iter()
        .map(|(name, entry)| {
            let half_life = match entry.get("half_life_sec") {
                Some(Value::Number(value)) => repr_float(value.as_f64().expect("half-life")),
                _ => "null".to_string(),
            };
            format!("{name}|{half_life}")
        })
        .collect();
    assert_eq!(checksum(&lines.join("\n")), text(&data["decay_checksum"]));
    for row in items(&data["decay_lookups"]) {
        let name = text(&row[0]);
        let actual = get_nuclide_data(name, None).expect("lookup");
        if row[1].is_null() {
            assert!(actual.is_none(), "{name}");
        } else {
            assert_eq!(actual, Some(&row[1]), "{name}");
        }
        assert_eq!(
            get_nuclide_data(name, Some(decay)).expect("lookup"),
            actual,
            "{name}"
        );
    }
}

#[test]
fn data_loaders_keep_the_first_loaded_data() {
    let first = load_dcf_data(None).expect("bundled dose coefficients");
    let again = load_dcf_data(Some(std::path::Path::new("no/such/file.json")))
        .expect("the cached data is returned");
    assert!(std::ptr::eq(first, again));
    let decay = load_decay_data(None).expect("bundled decay data");
    let decay_again = load_decay_data(Some(std::path::Path::new("no/such/file.json")))
        .expect("the cached data is returned");
    assert!(std::ptr::eq(decay, decay_again));
}
