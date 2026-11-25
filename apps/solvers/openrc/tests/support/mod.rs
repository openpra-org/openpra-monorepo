#![allow(dead_code)]

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

use serde_json::Value;

use openrc::config::PlumeSegment;
use openrc::error::OpenRcError;
use openrc::met::MetRecord;
use openrc::rcad::GaussianOptions;

pub const TOLERANCE: f64 = 1e-10;

static SCRATCH_COUNTER: AtomicUsize = AtomicUsize::new(0);

pub fn reference_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("data")
        .join("python_reference")
}

pub fn vector(name: &str) -> Value {
    let path = reference_dir().join("vectors").join(name);
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("{}: {error}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

pub fn scratch_dir(label: &str) -> PathBuf {
    let index = SCRATCH_COUNTER.fetch_add(1, Ordering::SeqCst);
    let path = Path::new(env!("CARGO_TARGET_TMPDIR"))
        .join(format!("{label}-{}-{index}", std::process::id()));
    if path.exists() {
        std::fs::remove_dir_all(&path).expect("clear scratch directory");
    }
    std::fs::create_dir_all(&path).expect("create scratch directory");
    path
}

pub fn remove_scratch(path: &Path) {
    let _ = std::fs::remove_dir_all(path);
}

pub fn exact_required() -> bool {
    std::env::var("OPENRC_EXACT").is_ok_and(|value| value == "1")
}

pub fn number(value: &Value) -> f64 {
    match value {
        Value::Number(number) => number.as_f64().expect("finite number"),
        Value::String(text) => text.parse::<f64>().expect("float text"),
        other => panic!("not a number: {other}"),
    }
}

pub fn optional_number(value: &Value) -> Option<f64> {
    if value.is_null() {
        None
    } else {
        Some(number(value))
    }
}

pub fn numbers(value: &Value) -> Vec<f64> {
    items(value).iter().map(number).collect()
}

pub fn grid(value: &Value) -> Vec<Vec<f64>> {
    items(value).iter().map(numbers).collect()
}

pub fn items(value: &Value) -> &Vec<Value> {
    value
        .as_array()
        .unwrap_or_else(|| panic!("not a list: {value}"))
}

pub fn text(value: &Value) -> &str {
    value
        .as_str()
        .unwrap_or_else(|| panic!("not text: {value}"))
}

pub fn flag(value: &Value) -> bool {
    value
        .as_bool()
        .unwrap_or_else(|| panic!("not a flag: {value}"))
}

pub fn texts(value: &Value) -> Vec<String> {
    items(value)
        .iter()
        .map(|item| text(item).to_string())
        .collect()
}

pub fn quoted_non_finite(json: &str) -> String {
    let mut output = String::with_capacity(json.len());
    let mut rest = json;
    let mut in_string = false;
    while let Some(character) = rest.chars().next() {
        if in_string {
            output.push(character);
            rest = &rest[character.len_utf8()..];
            if character == '\\' {
                if let Some(escaped) = rest.chars().next() {
                    output.push(escaped);
                    rest = &rest[escaped.len_utf8()..];
                }
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }
        let token = ["-Infinity", "Infinity", "NaN"]
            .into_iter()
            .find(|token| rest.starts_with(token));
        match token {
            Some(token) => {
                output.push('"');
                output.push_str(token);
                output.push('"');
                rest = &rest[token.len()..];
            }
            None => {
                in_string = character == '"';
                output.push(character);
                rest = &rest[character.len_utf8()..];
            }
        }
    }
    output
}

pub fn same_bits(actual: f64, expected: f64) -> bool {
    actual.to_bits() == expected.to_bits() || (actual.is_nan() && expected.is_nan())
}

pub fn options(value: &Value) -> GaussianOptions {
    GaussianOptions {
        wind_speed_m_s: number(&value["wind_speed_m_s"]),
        stability_class: text(&value["stability_class"]).to_string(),
        mixing_height_m: optional_number(&value["mixing_height_m"]),
        plume_centerline_height_m: number(&value["plume_centerline_height_m"]),
        dry_deposition_velocity_m_s: number(&value["dry_deposition_velocity_m_s"]),
        reflect_ground: flag(&value["reflect_ground"]),
        well_mixed: flag(&value["well_mixed"]),
        y_scale: number(&value["y_scale"]),
        z_scale: number(&value["z_scale"]),
        include_ingrowth: flag(&value["include_ingrowth"]),
        simple_decay_at_receptor: flag(&value["simple_decay_at_receptor"]),
        collapse_half_life_sec: number(&value["collapse_half_life_sec"]),
        compute_lmp: flag(&value["compute_lmp"]),
        compute_epz: flag(&value["compute_epz"]),
        sigma_model: text(&value["sigma_model"]).to_string(),
        measurement_height_m: number(&value["measurement_height_m"]),
        displacement_height_m: number(&value["displacement_height_m"]),
        sigma_v_m_s: optional_number(&value["sigma_v_m_s"]),
        sigma_w_m_s: optional_number(&value["sigma_w_m_s"]),
    }
}

pub fn segments(value: &Value) -> Vec<PlumeSegment> {
    items(value)
        .iter()
        .map(|segment| PlumeSegment {
            delay_s: number(&segment["delay_s"]),
            duration_s: number(&segment["duration_s"]),
            height_m: number(&segment["height_m"]),
            release_fractions_by_group: numbers(&segment["release_fractions_by_group"]),
        })
        .collect()
}

pub fn pairs(value: &Value) -> Vec<(String, f64)> {
    items(value)
        .iter()
        .map(|pair| (text(&pair[0]).to_string(), number(&pair[1])))
        .collect()
}

pub fn records(value: &Value) -> Vec<MetRecord> {
    items(value)
        .iter()
        .map(|record| MetRecord {
            stability_class: text(&record["stability_class"]).to_string(),
            wind_speed_m_s: number(&record["wind_speed_m_s"]),
            wind_dir_deg: optional_number(&record["wind_dir_deg"]),
            u_star_m_s: optional_number(&record["u_star_m_s"]),
            mixing_height_m: optional_number(&record["mixing_height_m"]),
            sigma_v_m_s: optional_number(&record["sigma_v_m_s"]),
            sigma_w_m_s: optional_number(&record["sigma_w_m_s"]),
            sensible_heat_flux_w_m2: optional_number(&record["sensible_heat_flux_w_m2"]),
            temperature_c: optional_number(&record["temperature_c"]),
            pressure_pa: optional_number(&record["pressure_pa"]),
        })
        .collect()
}

pub fn kind_for(python_type: &str) -> &'static str {
    match python_type {
        "ValueError" | "OverflowError" => "InvalidValue",
        "FileNotFoundError" => "FileNotFound",
        "KeyError" => "MissingKey",
        "ZeroDivisionError" => "ZeroDivision",
        "IndexError" => "OutOfRange",
        "AttributeError" | "TypeError" => "InvalidType",
        "JSONDecodeError" => "Json",
        "MissingSectionHeaderError"
        | "ParsingError"
        | "DuplicateSectionError"
        | "DuplicateOptionError"
        | "InterpolationSyntaxError"
        | "InterpolationMissingOptionError"
        | "InterpolationDepthError" => "ConfigSyntax",
        other => panic!("no error kind for {other}"),
    }
}

pub fn check_error(error: &OpenRcError, expected: &Value, context: &str) {
    let python_type = text(&expected["type"]);
    assert_eq!(
        error.kind(),
        kind_for(python_type),
        "{context}: {}",
        error.message()
    );
    if matches!(
        python_type,
        "ValueError" | "ZeroDivisionError" | "IndexError"
    ) {
        assert_eq!(error.message(), text(&expected["message"]), "{context}");
    }
}

pub struct Tally {
    name: String,
    compared: u64,
    exact: u64,
    worst: f64,
    worst_context: String,
}

impl Tally {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            compared: 0,
            exact: 0,
            worst: 0.0,
            worst_context: String::new(),
        }
    }

    pub fn check(&mut self, actual: f64, expected: f64, context: &dyn Fn() -> String) {
        self.check_with_floor(actual, expected, 0.0, context);
    }

    pub fn check_with_floor(
        &mut self,
        actual: f64,
        expected: f64,
        floor: f64,
        context: &dyn Fn() -> String,
    ) {
        self.compared += 1;
        if same_bits(actual, expected) {
            self.exact += 1;
            return;
        }
        let difference = (actual - expected).abs();
        let scale = actual.abs().max(expected.abs());
        let relative = if scale > 0.0 { difference / scale } else { 0.0 };
        if relative >= self.worst {
            self.worst = relative;
            self.worst_context = context();
        }
        assert!(
            difference <= TOLERANCE * scale + floor,
            "{}: {}: got {actual:e}, expected {expected:e}",
            self.name,
            context()
        );
    }

    pub fn check_grid(
        &mut self,
        actual: &[Vec<f64>],
        expected: &[Vec<f64>],
        context: &dyn Fn() -> String,
    ) {
        assert_eq!(actual.len(), expected.len(), "{}: sectors", context());
        let peak = expected
            .iter()
            .flatten()
            .fold(0.0_f64, |peak, value| peak.max(value.abs()));
        for (sector, (actual_row, expected_row)) in actual.iter().zip(expected).enumerate() {
            assert_eq!(actual_row.len(), expected_row.len(), "{}: rings", context());
            for (ring, (actual_value, expected_value)) in
                actual_row.iter().zip(expected_row).enumerate()
            {
                self.check_with_floor(*actual_value, *expected_value, 1e-12 * peak, &|| {
                    format!("{} [{sector}][{ring}]", context())
                });
            }
        }
    }

    pub fn finish(self) {
        eprintln!(
            "{}: {} values, {} bit-identical, largest relative difference {:e} {}",
            self.name, self.compared, self.exact, self.worst, self.worst_context
        );
        assert!(self.compared > 0, "{}: nothing was compared", self.name);
        if exact_required() {
            assert_eq!(
                self.exact,
                self.compared,
                "{}: {} of {} values differ from the reference in their last bits",
                self.name,
                self.compared - self.exact,
                self.compared
            );
        }
    }
}
