use std::path::Path;

use crate::error::OpenRcError;
use crate::number::parse_float;
use crate::text::{path_text, read_file_text, repr_str, split_lines, strip};

#[derive(Debug, Clone, PartialEq)]
pub struct MetRecord {
    pub stability_class: String,
    pub wind_speed_m_s: f64,
    pub wind_dir_deg: Option<f64>,
    pub u_star_m_s: Option<f64>,
    pub mixing_height_m: Option<f64>,
    pub sigma_v_m_s: Option<f64>,
    pub sigma_w_m_s: Option<f64>,
    pub sensible_heat_flux_w_m2: Option<f64>,
    pub temperature_c: Option<f64>,
    pub pressure_pa: Option<f64>,
}

impl MetRecord {
    pub fn new(stability_class: &str, wind_speed_m_s: f64) -> Self {
        Self {
            stability_class: stability_class.to_string(),
            wind_speed_m_s,
            wind_dir_deg: None,
            u_star_m_s: None,
            mixing_height_m: None,
            sigma_v_m_s: None,
            sigma_w_m_s: None,
            sensible_heat_flux_w_m2: None,
            temperature_c: None,
            pressure_pa: None,
        }
    }
}

fn float_value(text: &str) -> Result<f64, OpenRcError> {
    parse_float(text).ok_or_else(|| {
        OpenRcError::InvalidValue(format!(
            "could not convert string to float: {}",
            repr_str(text)
        ))
    })
}

fn optional_float(parts: &[&str], index: usize) -> Result<Option<f64>, OpenRcError> {
    match parts.get(index) {
        Some(part) if !part.is_empty() => float_value(part).map(Some),
        _ => Ok(None),
    }
}

pub fn load_met(path: impl AsRef<Path>) -> Result<Vec<MetRecord>, OpenRcError> {
    let path = path.as_ref();
    if !path.exists() {
        return Err(OpenRcError::FileNotFound(format!(
            "Met file not found: {}",
            path_text(path)
        )));
    }
    let content = read_file_text(path)?;
    parse_met(&content, &path_text(path))
}

pub fn parse_met(content: &str, source: &str) -> Result<Vec<MetRecord>, OpenRcError> {
    let mut records: Vec<MetRecord> = Vec::new();
    for raw in split_lines(content) {
        let line = strip(raw);
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let parts: Vec<&str> = line.split(',').map(strip).collect();
        if parts[0].to_lowercase() == "stability_class" {
            continue;
        }
        let stability_class = parts[0].to_uppercase();
        let Some(speed_text) = parts.get(1) else {
            return Err(OpenRcError::OutOfRange(
                "list index out of range".to_string(),
            ));
        };
        records.push(MetRecord {
            stability_class,
            wind_speed_m_s: float_value(speed_text)?,
            wind_dir_deg: optional_float(&parts, 2)?,
            u_star_m_s: optional_float(&parts, 3)?,
            mixing_height_m: optional_float(&parts, 4)?,
            sigma_v_m_s: optional_float(&parts, 5)?,
            sigma_w_m_s: optional_float(&parts, 6)?,
            sensible_heat_flux_w_m2: None,
            temperature_c: None,
            pressure_pa: None,
        });
    }

    if records.is_empty() {
        return Err(OpenRcError::InvalidValue(format!(
            "Met file contains no data rows: {source}"
        )));
    }
    Ok(records)
}
