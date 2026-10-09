use serde::{Deserialize, Serialize};

use crate::{PraxisError, Result};

pub const DEFAULT_HOURS_PER_YEAR: f64 = 8_760.0;

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FrequencyUnit {
    PerSecond,
    PerMinute,
    PerHour,
    PerDay,
    #[default]
    PerYear,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AnnualizationBasis {
    CalendarYear,
    PlantYear,
    ReactorYear,
    CriticalYear,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AnnualizationConvention {
    pub basis: AnnualizationBasis,
    pub hours_per_year: f64,
}

impl Default for AnnualizationConvention {
    fn default() -> Self {
        Self {
            basis: AnnualizationBasis::PlantYear,
            hours_per_year: DEFAULT_HOURS_PER_YEAR,
        }
    }
}

pub fn annualize_frequency(
    value: f64,
    unit: FrequencyUnit,
    annualization: AnnualizationConvention,
) -> Result<f64> {
    if !value.is_finite() || value < 0.0 {
        return Err(PraxisError::Logic(
            "frequency must be finite and non-negative".to_string(),
        ));
    }
    if !annualization.hours_per_year.is_finite() || annualization.hours_per_year <= 0.0 {
        return Err(PraxisError::Logic(
            "annualization hours must be finite and greater than zero".to_string(),
        ));
    }
    let factor = match unit {
        FrequencyUnit::PerSecond => annualization.hours_per_year * 3_600.0,
        FrequencyUnit::PerMinute => annualization.hours_per_year * 60.0,
        FrequencyUnit::PerHour => annualization.hours_per_year,
        FrequencyUnit::PerDay => annualization.hours_per_year / 24.0,
        FrequencyUnit::PerYear => 1.0,
    };
    let annual = value * factor;
    if !annual.is_finite() {
        return Err(PraxisError::Logic(
            "annualized frequency is not finite".to_string(),
        ));
    }
    Ok(annual)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct HazardWeight {
    pub raw_weight: f64,
    pub normalized_weight: f64,
    pub convolution_weight: f64,
    pub annual_frequency: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct HazardWeightSummary {
    pub weights: Vec<HazardWeight>,
    pub annualized_frequency_scale: f64,
    pub raw_weight_sum: f64,
    pub convolution_weight_sum: f64,
}

// CPython 3.12.10 builtin_sum float path, used by HCL_MH's weight builder.
// Source: Python/bltinmodule.c, lines 2464–2496. PSF license is retained in
// hcl/uncertainty/LICENSES.txt. Aggregation's explicit += remains sequential.
fn python_float_sum(values: impl IntoIterator<Item = f64>) -> f64 {
    let mut values = values.into_iter();
    let mut total = 0.0 + values.next().unwrap_or(0.0);
    let mut correction = 0.0;
    for value in values {
        let next = total + value;
        correction += if total.abs() >= value.abs() {
            (total - next) + value
        } else {
            (value - next) + total
        };
        total = next;
    }
    if correction != 0.0 && correction.is_finite() {
        total += correction;
    }
    total
}

/// Converts exact BN scenario probabilities into auditable hazard-convolution weights.
pub fn prepare_hazard_weights(
    raw_weights: &[f64],
    frequency_scale_value: f64,
    frequency_scale_unit: FrequencyUnit,
    annualization: AnnualizationConvention,
    normalize_weights: bool,
) -> Result<HazardWeightSummary> {
    if raw_weights.is_empty() {
        return Err(PraxisError::Logic(
            "hazard grid requires at least one weight".to_string(),
        ));
    }
    if raw_weights
        .iter()
        .any(|weight| !weight.is_finite() || *weight < 0.0)
    {
        return Err(PraxisError::Logic(
            "hazard-grid weights must be finite and non-negative".to_string(),
        ));
    }
    let raw_weight_sum = python_float_sum(raw_weights.iter().copied());
    if !raw_weight_sum.is_finite() {
        return Err(PraxisError::Logic(
            "hazard-grid weight sum must be finite".to_string(),
        ));
    }
    let annualized_frequency_scale =
        annualize_frequency(frequency_scale_value, frequency_scale_unit, annualization)?;
    let weights: Vec<HazardWeight> = raw_weights
        .iter()
        .map(|raw_weight| {
            let normalized_weight = if raw_weight_sum > 0.0 {
                raw_weight / raw_weight_sum
            } else {
                0.0
            };
            let convolution_weight = if normalize_weights {
                normalized_weight
            } else {
                *raw_weight
            };
            HazardWeight {
                raw_weight: *raw_weight,
                normalized_weight,
                convolution_weight,
                annual_frequency: convolution_weight * annualized_frequency_scale,
            }
        })
        .collect();
    let convolution_weight_sum =
        python_float_sum(weights.iter().map(|weight| weight.convolution_weight));
    Ok(HazardWeightSummary {
        weights,
        annualized_frequency_scale,
        raw_weight_sum,
        convolution_weight_sum,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn annualizes_using_the_declared_year_exposure() {
        let annual = annualize_frequency(
            2.0e-5,
            FrequencyUnit::PerHour,
            AnnualizationConvention {
                basis: AnnualizationBasis::CriticalYear,
                hours_per_year: 7_000.0,
            },
        )
        .unwrap();
        assert!((annual - 0.14).abs() < 1e-15);
    }

    #[test]
    fn default_year_is_365_days_for_frequency_and_mission_time() {
        let annual = AnnualizationConvention::default();
        assert_eq!(
            annualize_frequency(1.0, FrequencyUnit::PerHour, annual).unwrap(),
            8_760.0
        );
        assert_eq!(
            annualize_frequency(1.0, FrequencyUnit::PerDay, annual).unwrap(),
            365.0
        );
        assert_eq!(
            annualize_frequency(1.0, FrequencyUnit::PerYear, annual).unwrap(),
            1.0
        );
    }

    #[test]
    fn rejects_invalid_time_and_frequency_inputs() {
        assert!(annualize_frequency(
            -1.0,
            FrequencyUnit::PerYear,
            AnnualizationConvention::default(),
        )
        .is_err());
    }

    #[test]
    fn prepares_raw_and_normalized_hazard_weights_without_losing_omitted_mass() {
        let raw = prepare_hazard_weights(
            &[0.3, 0.2],
            1.0e-4,
            FrequencyUnit::PerYear,
            AnnualizationConvention::default(),
            false,
        )
        .unwrap();
        assert!((raw.raw_weight_sum - 0.5).abs() < 1e-15);
        assert!((raw.convolution_weight_sum - 0.5).abs() < 1e-15);
        assert!((raw.weights[0].annual_frequency - 3.0e-5).abs() < 1e-15);

        let normalized = prepare_hazard_weights(
            &[0.3, 0.2],
            1.0e-4,
            FrequencyUnit::PerYear,
            AnnualizationConvention::default(),
            true,
        )
        .unwrap();
        assert!((normalized.convolution_weight_sum - 1.0).abs() < 1e-15);
        assert!((normalized.weights[0].annual_frequency - 6.0e-5).abs() < 1e-15);
    }
}
