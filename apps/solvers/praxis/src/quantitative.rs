use serde::{Deserialize, Serialize};

use crate::{PraxisError, Result};

pub const DEFAULT_HOURS_PER_YEAR: f64 = 8_766.0;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TimeUnit {
    Second,
    Minute,
    Hour,
    Day,
    Year,
}

impl TimeUnit {
    fn hours(self) -> f64 {
        match self {
            Self::Second => 1.0 / 3_600.0,
            Self::Minute => 1.0 / 60.0,
            Self::Hour => 1.0,
            Self::Day => 24.0,
            Self::Year => DEFAULT_HOURS_PER_YEAR,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Duration {
    pub value: f64,
    pub unit: TimeUnit,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Rate {
    pub value: f64,
    pub unit: TimeUnit,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FailureRateConversion {
    Exponential,
    Linear,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "SCREAMING_SNAKE_CASE", deny_unknown_fields)]
pub enum BasicEventQuantificationBasis {
    Probability,
    FailureRate {
        #[serde(rename = "failureRate")]
        failure_rate: Rate,
        #[serde(rename = "missionTime")]
        mission_time: Duration,
        conversion: FailureRateConversion,
    },
}

pub fn failure_rate_to_probability(
    failure_rate: Rate,
    mission_time: Duration,
    conversion: FailureRateConversion,
) -> Result<f64> {
    if !failure_rate.value.is_finite() || failure_rate.value < 0.0 {
        return Err(PraxisError::Logic(
            "failure rate must be finite and non-negative".to_string(),
        ));
    }
    if !mission_time.value.is_finite() || mission_time.value <= 0.0 {
        return Err(PraxisError::Logic(
            "mission time must be finite and greater than zero".to_string(),
        ));
    }
    let exposure = failure_rate.value * mission_time.value * mission_time.unit.hours()
        / failure_rate.unit.hours();
    if !exposure.is_finite() {
        return Err(PraxisError::Logic(
            "failure-rate exposure is not finite".to_string(),
        ));
    }
    Ok(match conversion {
        FailureRateConversion::Exponential => -(-exposure).exp_m1(),
        FailureRateConversion::Linear => exposure.min(1.0),
    })
}

pub fn resolve_basic_event_probability(
    stored_probability: f64,
    basis: Option<&BasicEventQuantificationBasis>,
) -> Result<f64> {
    match basis {
        Some(BasicEventQuantificationBasis::FailureRate {
            failure_rate,
            mission_time,
            conversion,
        }) => failure_rate_to_probability(*failure_rate, *mission_time, *conversion),
        None | Some(BasicEventQuantificationBasis::Probability) => {
            if !stored_probability.is_finite() || !(0.0..=1.0).contains(&stored_probability) {
                return Err(PraxisError::Logic(
                    "basic-event probability must be finite and between zero and one".to_string(),
                ));
            }
            Ok(stored_probability)
        }
    }
}

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
    let raw_weight_sum: f64 = raw_weights.iter().sum();
    if !raw_weight_sum.is_finite() || raw_weight_sum <= 0.0 {
        return Err(PraxisError::Logic(
            "hazard-grid weight sum must be greater than zero".to_string(),
        ));
    }
    let annualized_frequency_scale =
        annualize_frequency(frequency_scale_value, frequency_scale_unit, annualization)?;
    let weights: Vec<HazardWeight> = raw_weights
        .iter()
        .map(|raw_weight| {
            let normalized_weight = raw_weight / raw_weight_sum;
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
    let convolution_weight_sum = weights.iter().map(|weight| weight.convolution_weight).sum();
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
    fn converts_an_hourly_failure_rate_over_a_mission() {
        let probability = failure_rate_to_probability(
            Rate {
                value: 2.0e-5,
                unit: TimeUnit::Hour,
            },
            Duration {
                value: 24.0,
                unit: TimeUnit::Hour,
            },
            FailureRateConversion::Exponential,
        )
        .unwrap();
        assert!((probability - 4.798848184297884e-4).abs() < 1e-15);
    }

    #[test]
    fn converts_mixed_time_units_before_applying_the_linear_model() {
        let probability = failure_rate_to_probability(
            Rate {
                value: 0.01,
                unit: TimeUnit::Hour,
            },
            Duration {
                value: 30.0,
                unit: TimeUnit::Minute,
            },
            FailureRateConversion::Linear,
        )
        .unwrap();
        assert!((probability - 0.005).abs() < 1e-15);
    }

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
    fn rejects_invalid_time_and_frequency_inputs() {
        assert!(failure_rate_to_probability(
            Rate {
                value: 1.0,
                unit: TimeUnit::Hour,
            },
            Duration {
                value: 0.0,
                unit: TimeUnit::Hour,
            },
            FailureRateConversion::Exponential,
        )
        .is_err());
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
