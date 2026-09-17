//! Direct probability distributions from HCL_MH/uq/basic_event_models.py.
//! MC follows NumPy Generator; LHS follows sample_dist's stratification,
//! permutation and scipy.stats PPF calls. runner.py clips the resulting vectors.

use super::{numpy_rng::NumpyRng, quantiles};
use crate::hcl::{HclProbabilityDistribution, HclSampler};
use crate::{PraxisError, Result};

const NORMAL_95TH_PERCENTILE: f64 = 1.645;

pub(super) fn sample_probabilities(
    distribution: &HclProbabilityDistribution,
    sampler: HclSampler,
    size: usize,
    rng: &mut NumpyRng,
) -> Result<Vec<f64>> {
    validate_probability_distribution(distribution, sampler)?;
    let distribution = source_parameters(distribution);
    let values = match sampler {
        HclSampler::MonteCarlo => (0..size)
            .map(|_| sample_mc(&distribution, rng))
            .collect::<Vec<_>>(),
        HclSampler::LatinHypercube => rng
            .lhs_quantiles(size)
            .into_iter()
            .map(|q| inverse_cdf(&distribution, q))
            .collect::<Result<Vec<_>>>()?,
    };
    values
        .into_iter()
        .map(|value| {
            if value.is_nan() {
                Err(PraxisError::Hcl(
                    "the probability distribution returned an undefined sample".into(),
                ))
            } else {
                Ok(value.clamp(0.0, 1.0))
            }
        })
        .collect()
}

fn source_parameters(distribution: &HclProbabilityDistribution) -> HclProbabilityDistribution {
    // HCL_MH sample_dist uses `_get_param(...) or 0.0` for these fields.
    // Preserve that signed-zero default without changing the saved input.
    let mut distribution = distribution.clone();
    let zero_default = |value: &mut f64| {
        if *value == 0.0 {
            *value = 0.0;
        }
    };
    use HclProbabilityDistribution::*;
    match &mut distribution {
        Uniform { lower, upper } => {
            zero_default(lower);
            zero_default(upper);
        }
        Normal {
            mean,
            standard_deviation,
        } => {
            zero_default(mean);
            zero_default(standard_deviation);
        }
        Logitnormal { mu, sigma } => {
            zero_default(mu);
            zero_default(sigma);
        }
        Triangular { lower, mode, upper } => {
            zero_default(lower);
            zero_default(mode);
            zero_default(upper);
        }
        _ => {}
    }
    distribution
}

fn logistic(value: f64) -> f64 {
    1.0 / (1.0 + (-value).exp())
}

fn sample_mc(distribution: &HclProbabilityDistribution, rng: &mut NumpyRng) -> f64 {
    use HclProbabilityDistribution::*;
    match *distribution {
        Beta { alpha, beta } => rng.beta(alpha, beta),
        Uniform { lower, upper } => rng.uniform(lower, upper),
        Normal {
            mean,
            standard_deviation,
        } => rng.normal(mean, standard_deviation),
        Lognormal {
            median,
            error_factor,
        } => rng.lognormal(median.ln(), error_factor.ln() / NORMAL_95TH_PERCENTILE),
        Logitnormal { mu, sigma } => logistic(rng.normal(mu, sigma)),
        Gamma { shape, scale } => rng.gamma(shape, scale),
        Exponential { rate } => rng.exponential(1.0 / rate),
        Triangular { lower, mode, upper } => rng.triangular(lower, mode, upper),
    }
}

fn inverse_cdf(distribution: &HclProbabilityDistribution, q: f64) -> Result<f64> {
    use HclProbabilityDistribution::*;
    Ok(match *distribution {
        Beta { alpha, beta } => quantiles::beta(q, alpha, beta)?,
        Uniform { lower, upper } => lower + (upper - lower) * q,
        Normal {
            mean,
            standard_deviation,
        } => mean + standard_deviation * quantiles::normal(q)?,
        Lognormal {
            median,
            error_factor,
        } => {
            // scipy.stats.lognorm.ppf uses exp(sigma * ndtri(q)), then scale.
            let mu = median.ln();
            let sigma = error_factor.ln() / NORMAL_95TH_PERCENTILE;
            (sigma * quantiles::normal(q)?).exp() * mu.exp()
        }
        Logitnormal { mu, sigma } => logistic(mu + sigma * quantiles::normal(q)?),
        Gamma { shape, scale } => quantiles::gamma(q, shape)? * scale,
        Exponential { rate } => quantiles::exponential(q)? * (1.0 / rate),
        Triangular { lower, mode, upper } => {
            let scale = upper - lower;
            let c = (mode - lower) / scale;
            let standard = if q < c {
                (c * q).sqrt()
            } else {
                1.0 - ((1.0 - c) * (1.0 - q)).sqrt()
            };
            standard * scale + lower
        }
    })
}

pub(super) fn validate_probability_distribution(
    distribution: &HclProbabilityDistribution,
    sampler: HclSampler,
) -> Result<()> {
    use HclProbabilityDistribution::*;
    let positive = |value: f64| value.is_finite() && value > 0.0;
    let mc = sampler == HclSampler::MonteCarlo;
    let spread = |value: f64| value.is_finite() && if mc { value >= 0.0 } else { value > 0.0 };
    let (valid, message) = match *distribution {
        Beta { alpha, beta } => (
            positive(alpha) && positive(beta),
            "Beta alpha and beta must be positive",
        ),
        Lognormal {
            median,
            error_factor,
        } => (
            positive(median) && error_factor.is_finite()
                && if mc { error_factor >= 1.0 } else { error_factor > 1.0 },
            "Lognormal median must be positive; error factor must be at least one for MC and exceed one for LHS (the source returns undefined samples at one)",
        ),
        Uniform { lower, upper } => (
            lower.is_finite() && upper.is_finite() && (!mc || (lower <= upper && (upper - lower).is_finite())),
            "Uniform bounds must be finite; MC requires lower <= upper and a finite width",
        ),
        Normal {
            mean,
            standard_deviation,
        } => (
            mean.is_finite() && spread(standard_deviation),
            "Normal mean must be finite; standard deviation must be nonnegative for MC and positive for LHS (the source returns undefined samples at zero)",
        ),
        Logitnormal { mu, sigma } => (
            mu.is_finite() && spread(sigma),
            "Logit-normal mu must be finite; sigma must be nonnegative for MC and positive for LHS (the source returns undefined samples at zero)",
        ),
        Gamma { shape, scale } => (
            positive(shape) && positive(scale),
            "Gamma shape and scale must be positive",
        ),
        Exponential { rate } => (positive(rate), "Exponential rate must be positive"),
        Triangular { lower, mode, upper } => (
            lower.is_finite()
                && mode.is_finite()
                && upper.is_finite()
                && lower < upper
                && lower <= mode
                && mode <= upper,
            "Triangular bounds must satisfy lower <= mode <= upper and lower < upper",
        ),
    };
    if valid {
        Ok(())
    } else {
        Err(PraxisError::Hcl(message.into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn distribution_domains_and_rng_consumption_match_original_source() {
        #[cfg(target_os = "windows")]
        let data = include_str!(
            "../../../tests/fixtures/hcl_mh_distribution_domain/reference-windows.json"
        );
        #[cfg(not(target_os = "windows"))]
        let data =
            include_str!("../../../tests/fixtures/hcl_mh_distribution_domain/reference-linux.json");
        let fixture: serde_json::Value = serde_json::from_str(data).unwrap();
        for case in fixture["cases"].as_array().unwrap() {
            let distribution = serde_json::from_value(case["distribution"].clone()).unwrap();
            let sampler = serde_json::from_value(case["sampler"].clone()).unwrap();
            let count = case["sample_count"].as_u64().unwrap() as usize;
            let mut rng = NumpyRng::new(case["seed"].as_u64().unwrap());
            let actual = sample_probabilities(&distribution, sampler, count, &mut rng);
            if case["status"] != "FINITE" {
                assert!(
                    actual.is_err(),
                    "{}: source rejected these parameters",
                    case["id"]
                );
                continue;
            }
            let following = sample_probabilities(
                &HclProbabilityDistribution::Beta {
                    alpha: 2.0,
                    beta: 8.0,
                },
                sampler,
                count,
                &mut rng,
            )
            .unwrap();
            for (field, values) in [
                ("sample_bits", actual.unwrap()),
                ("following_beta_bits", following),
            ] {
                for (index, (actual, expected)) in values
                    .iter()
                    .zip(case[field].as_array().unwrap())
                    .enumerate()
                {
                    assert_eq!(
                        actual.to_bits(),
                        u64::from_str_radix(expected.as_str().unwrap(), 16).unwrap(),
                        "{} {field}[{index}]",
                        case["id"]
                    );
                }
            }
        }
    }

    #[test]
    fn exponential_lhs_matches_hcl_mh_source_bits() {
        // HCL_MH sample_dist("exponential", {"rate": 2}, 11,
        // default_rng(42), "lhs"), clipped to [0, 1]; NumPy 2.4.4/SciPy 1.17.1.
        // Exact bits detect substitution of the platform log1p kernel.
        let expected = [
            0x3fe57ca02bac9d08,
            0x3fa2ad575e9c978d,
            0x3fe3afb6e0437fb3,
            0x3fcdcb3fd3e26f7b,
            0x3fc3427be80b37de,
            0x3fca37e07224be1b,
            0x3fd913330c53fccc,
            0x3fef5bb4f36b7c1f,
            0x3fb1f1c0ec68f71e,
            0x3ff0000000000000,
            0x3fde83e5e7382640,
        ];
        let actual = sample_probabilities(
            &HclProbabilityDistribution::Exponential { rate: 2.0 },
            HclSampler::LatinHypercube,
            expected.len(),
            &mut NumpyRng::new(42),
        )
        .unwrap();
        for (index, (actual, expected)) in actual.iter().zip(expected).enumerate() {
            assert_eq!(actual.to_bits(), expected, "sample {index}");
        }
    }
}
