use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::error::OpenRcError;
use crate::ini::IniDocument;
use crate::number::{parse_float, parse_int};
use crate::text::{path_text, read_file_text, repr_str, repr_str_list, split_lines, strip};

const STABILITY_CLASSES: [&str; 6] = ["A", "B", "C", "D", "E", "F"];

#[derive(Debug, Clone, PartialEq)]
pub struct PlumeSegment {
    pub delay_s: f64,
    pub duration_s: f64,
    pub height_m: f64,
    pub release_fractions_by_group: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct OpenRcConfig {
    pub case_name: String,
    pub modules: Vec<String>,
    pub mode: String,
    pub source_term_bq: Vec<(String, f64)>,
    pub receptor_x_m: f64,
    pub receptor_y_m: f64,
    pub receptor_z_m: f64,
    pub mixing_height_m: Option<f64>,
    pub integration_time_s: f64,
    pub plume_segments: Vec<PlumeSegment>,
    pub dcf_organ: String,
    pub dcf_path: PathBuf,
    pub decay_path: PathBuf,
    pub include_ingrowth: bool,
    pub simple_decay_at_receptor: bool,
    pub collapse_half_life_sec: f64,
    pub dry_deposition_velocity_m_s: f64,
    pub deposition_velocities_by_group: Vec<f64>,
    pub write_csv: bool,
    pub output_dir: PathBuf,
    pub stability_class: Option<String>,
    pub wind_speed_m_s: Option<f64>,
    pub met_path: Option<PathBuf>,
    pub geometry: String,
    pub polar_sector_count: i64,
    pub polar_ring_distances_m: Vec<f64>,
    pub wind_shift: bool,
    pub met_period_s: f64,
    pub sigma_model: String,
    pub measurement_height_m: f64,
    pub displacement_height_m: f64,
    pub decay_data: Value,
    pub dcf_data: Value,
}

fn float_value(text: &str) -> Result<f64, OpenRcError> {
    parse_float(text).ok_or_else(|| {
        OpenRcError::InvalidValue(format!(
            "could not convert string to float: {}",
            repr_str(text)
        ))
    })
}

fn int_value(text: &str) -> Result<i64, OpenRcError> {
    parse_int(text).ok_or_else(|| {
        OpenRcError::InvalidValue(format!(
            "invalid literal for int() with base 10: {}",
            repr_str(text)
        ))
    })
}

fn required(document: &IniDocument, section: &str, key: &str) -> Result<String, OpenRcError> {
    document.get(section, key)?.ok_or_else(|| {
        OpenRcError::MissingKey(format!(
            "[{section}] is missing the option {}",
            repr_str(key)
        ))
    })
}

fn optional(
    document: &IniDocument,
    section: &str,
    key: &str,
    fallback: &str,
) -> Result<String, OpenRcError> {
    Ok(document
        .get(section, key)?
        .unwrap_or_else(|| fallback.to_string()))
}

fn section_float(document: &IniDocument, section: &str, key: &str) -> Result<f64, OpenRcError> {
    let invalid =
        || OpenRcError::InvalidValue(format!("[{section}] invalid or missing value for '{key}'"));
    let text = document.get(section, key)?.ok_or_else(invalid)?;
    parse_float(&text).ok_or_else(invalid)
}

fn float_list(text: &str) -> Result<Vec<f64>, OpenRcError> {
    text.split(',')
        .map(|item| float_value(strip(item)))
        .collect()
}

fn is_true(text: &str) -> bool {
    strip(text).to_lowercase() == "true"
}

fn require_sections(document: &IniDocument, sections: &[&str]) -> Result<(), OpenRcError> {
    let missing: Vec<&str> = sections
        .iter()
        .copied()
        .filter(|section| !document.has_section(section))
        .collect();
    if !missing.is_empty() {
        return Err(OpenRcError::InvalidValue(format!(
            "Config is missing required section(s): {}",
            repr_str_list(&missing)
        )));
    }
    Ok(())
}

fn load_json(path: &Path, unwrap_key: Option<&str>) -> Result<Value, OpenRcError> {
    if !path.exists() {
        return Err(OpenRcError::FileNotFound(format!(
            "Data file not found: {}",
            path_text(path)
        )));
    }
    let text = read_file_text(path)?;
    let data: Value = serde_json::from_str(&text)
        .map_err(|error| OpenRcError::Json(format!("{}: {error}", path_text(path))))?;
    let Some(key) = unwrap_key else {
        return Ok(data);
    };
    match data {
        Value::Object(mut entries) => match entries.shift_remove(key) {
            Some(inner) => Ok(inner),
            None => Ok(Value::Object(entries)),
        },
        _ => Err(OpenRcError::InvalidType(format!(
            "{}: the top level of the data file must be an object",
            path_text(path)
        ))),
    }
}

pub fn load_config(path: impl AsRef<Path>) -> Result<OpenRcConfig, OpenRcError> {
    let path = path.as_ref();
    if !path.exists() {
        return Err(OpenRcError::FileNotFound(format!(
            "Config file not found: {}",
            path_text(path)
        )));
    }
    let content = fs::read(path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .unwrap_or_default();
    let mut config = parse_config(&content, &path_text(path))?;
    config.decay_data = load_json(&config.decay_path, Some("nuclides"))?;
    config.dcf_data = load_json(&config.dcf_path, None)?;
    Ok(config)
}

pub fn parse_config(content: &str, source: &str) -> Result<OpenRcConfig, OpenRcError> {
    let document = IniDocument::parse(&split_lines(content), source)?;
    let has_run = document.has_section("run");

    let geometry = if has_run {
        strip(&optional(&document, "run", "geometry", "centerline")?).to_lowercase()
    } else {
        "centerline".to_string()
    };
    if geometry != "centerline" && geometry != "polar" {
        return Err(OpenRcError::InvalidValue(format!(
            "[run] geometry must be 'centerline' or 'polar', got {}",
            repr_str(&geometry)
        )));
    }
    let wind_shift = has_run && is_true(&optional(&document, "run", "wind_shift", "false")?);
    let met_period_s = if has_run {
        float_value(strip(&optional(&document, "run", "met_period_s", "3600")?))?
    } else {
        3600.0
    };
    let sigma_model = if has_run {
        strip(&optional(&document, "run", "sigma_model", "ek")?).to_lowercase()
    } else {
        "ek".to_string()
    };
    if sigma_model != "ek" && sigma_model != "most" {
        return Err(OpenRcError::InvalidValue(format!(
            "[run] sigma_model must be 'ek' or 'most', got {}",
            repr_str(&sigma_model)
        )));
    }
    let measurement_height_m = if has_run {
        float_value(strip(&optional(
            &document,
            "run",
            "measurement_height_m",
            "3.8",
        )?))?
    } else {
        3.8
    };
    let displacement_height_m = if has_run {
        float_value(strip(&optional(
            &document,
            "run",
            "displacement_height_m",
            "0.37",
        )?))?
    } else {
        0.37
    };

    let mut required_sections = vec![
        "run",
        "source_term",
        "meteorology",
        "release",
        "dcf",
        "decay",
        "deposition",
        "outputs",
    ];
    if geometry == "centerline" {
        required_sections.push("receptor");
    }
    require_sections(&document, &required_sections)?;

    let case_name = strip(&required(&document, "run", "case_name")?).to_string();
    let modules: Vec<String> = required(&document, "run", "modules")?
        .split(',')
        .map(strip)
        .filter(|module| !module.is_empty())
        .map(str::to_string)
        .collect();
    let mode = strip(&optional(&document, "run", "mode", "lmp")?).to_lowercase();
    if mode != "lmp" && mode != "epz" {
        return Err(OpenRcError::InvalidValue(format!(
            "[run] mode must be 'lmp' or 'epz', got {}",
            repr_str(&mode)
        )));
    }

    let mut source_term_bq: Vec<(String, f64)> = Vec::new();
    for nuclide in document.options("source_term") {
        let value = required(&document, "source_term", &nuclide)?;
        let activity = parse_float(&value).ok_or_else(|| {
            OpenRcError::InvalidValue(format!(
                "[source_term] invalid value for '{nuclide}': {}",
                repr_str(&value)
            ))
        })?;
        source_term_bq.push((nuclide, activity));
    }

    let (receptor_x_m, receptor_y_m, receptor_z_m) = if geometry == "centerline" {
        (
            section_float(&document, "receptor", "x_m")?,
            section_float(&document, "receptor", "y_m")?,
            section_float(&document, "receptor", "z_m")?,
        )
    } else {
        (0.0, 0.0, 0.0)
    };

    let mut polar_sector_count = 16;
    let mut polar_ring_distances_m: Vec<f64> = Vec::new();
    if geometry == "polar" {
        if !document.has_section("polar_grid") {
            return Err(OpenRcError::InvalidValue(
                "[polar_grid] section is required when geometry = polar".to_string(),
            ));
        }
        polar_sector_count = int_value(&required(&document, "polar_grid", "sector_count")?)?;
        if polar_sector_count == 0 {
            return Err(OpenRcError::ZeroDivision(
                "integer modulo by zero".to_string(),
            ));
        }
        if 360_i64.rem_euclid(polar_sector_count) != 0 {
            return Err(OpenRcError::InvalidValue(format!(
                "[polar_grid] sector_count must evenly divide 360, got {polar_sector_count}"
            )));
        }
        for item in required(&document, "polar_grid", "ring_distances_m")?.split(',') {
            let item = strip(item);
            if !item.is_empty() {
                polar_ring_distances_m.push(float_value(item)?);
            }
        }
        if polar_ring_distances_m.is_empty() {
            return Err(OpenRcError::InvalidValue(
                "[polar_grid] ring_distances_m must list at least one distance".to_string(),
            ));
        }
    }

    let raw_met = strip(&optional(&document, "meteorology", "met_file", "")?).to_string();
    let met_path = if raw_met.is_empty() {
        None
    } else {
        Some(PathBuf::from(&raw_met))
    };
    let raw_class =
        strip(&optional(&document, "meteorology", "stability_class", "")?).to_uppercase();
    let raw_speed = strip(&optional(&document, "meteorology", "wind_speed_m_s", "")?).to_string();
    let class_is_valid = STABILITY_CLASSES.contains(&raw_class.as_str());
    let (stability_class, wind_speed_m_s) = if met_path.is_none() {
        if !class_is_valid {
            return Err(OpenRcError::InvalidValue(format!(
                "[meteorology] stability_class must be A\u{2013}F, got {}",
                repr_str(&raw_class)
            )));
        }
        let speed = float_value(&raw_speed)?;
        if speed <= 0.0 {
            return Err(OpenRcError::InvalidValue(
                "[meteorology] wind_speed_m_s must be > 0".to_string(),
            ));
        }
        (Some(raw_class), Some(speed))
    } else {
        let class = if class_is_valid {
            Some(raw_class)
        } else {
            None
        };
        let speed = if raw_speed.is_empty() {
            None
        } else {
            Some(float_value(&raw_speed)?)
        };
        (class, speed)
    };
    let raw_mixing = strip(&required(&document, "meteorology", "mixing_height_m")?).to_lowercase();
    let mixing_height_m = if raw_mixing == "none" || raw_mixing.is_empty() {
        None
    } else {
        Some(float_value(&raw_mixing)?)
    };

    let integration_time_s = section_float(&document, "release", "integration_time_s")?;
    if integration_time_s <= 0.0 {
        return Err(OpenRcError::InvalidValue(
            "[release] integration_time_s must be > 0".to_string(),
        ));
    }
    let segment_count = int_value(&required(&document, "release", "plume_segments")?)?;
    let mut plume_segments: Vec<PlumeSegment> = Vec::new();
    for index in 1..=segment_count {
        let section = format!("release.segment_{index}");
        if !document.has_section(&section) {
            return Err(OpenRcError::InvalidValue(format!(
                "Config declares {segment_count} segment(s) but [{section}] is missing"
            )));
        }
        plume_segments.push(PlumeSegment {
            delay_s: float_value(&required(&document, &section, "delay_s")?)?,
            duration_s: float_value(&required(&document, &section, "duration_s")?)?,
            height_m: float_value(&required(&document, &section, "height_m")?)?,
            release_fractions_by_group: float_list(&required(
                &document,
                &section,
                "release_fractions_by_group",
            )?)?,
        });
    }

    let dcf_organ = strip(&required(&document, "dcf", "organ")?).to_string();
    let dcf_path = PathBuf::from(required(&document, "dcf", "path")?);

    let decay_path = PathBuf::from(required(&document, "decay", "path")?);
    let include_ingrowth = is_true(&required(&document, "decay", "include_ingrowth")?);
    let simple_decay_at_receptor =
        is_true(&required(&document, "decay", "simple_decay_at_receptor")?);
    let collapse_half_life_sec = section_float(&document, "decay", "collapse_half_life_sec")?;

    let dry_deposition_velocity_m_s =
        section_float(&document, "deposition", "dry_deposition_velocity_m_s")?;
    let deposition_velocities_by_group = float_list(&required(
        &document,
        "deposition",
        "deposition_velocities_by_group",
    )?)?;
    if deposition_velocities_by_group.len() != 10 {
        return Err(OpenRcError::InvalidValue(format!(
            "[deposition] deposition_velocities_by_group must have exactly 10 values \
             (one per chemical group), got {}",
            deposition_velocities_by_group.len()
        )));
    }

    let write_csv = is_true(&required(&document, "outputs", "write_csv")?);
    let output_dir = PathBuf::from(required(&document, "outputs", "output_dir")?);

    Ok(OpenRcConfig {
        case_name,
        modules,
        mode,
        source_term_bq,
        receptor_x_m,
        receptor_y_m,
        receptor_z_m,
        mixing_height_m,
        integration_time_s,
        plume_segments,
        dcf_organ,
        dcf_path,
        decay_path,
        include_ingrowth,
        simple_decay_at_receptor,
        collapse_half_life_sec,
        dry_deposition_velocity_m_s,
        deposition_velocities_by_group,
        write_csv,
        output_dir,
        stability_class,
        wind_speed_m_s,
        met_path,
        geometry,
        polar_sector_count,
        polar_ring_distances_m,
        wind_shift,
        met_period_s,
        sigma_model,
        measurement_height_m,
        displacement_height_m,
        decay_data: Value::Null,
        dcf_data: Value::Null,
    })
}
