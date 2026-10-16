use std::cmp::Ordering;

use serde::{Deserialize, Serialize};

use crate::core::distribution::{
    CountEvidence, CountLikelihood, DiscreteOutcome, DurationOutput, DurationParameter, DurationPrior, EvidenceTerm,
    Law, Likelihood, MixtureComponent, QuantilePoint, SampleSmoothing, TabulatedScale, TrendBin,
};
use crate::core::distribution_math::{closed_form, PreparedLaw, NORMAL_QUANTILE_95};
use crate::core::special_functions as kernels;
use crate::error::MefError;
use crate::{PraxisError, Result};

fn operation_error(message: String) -> PraxisError {
    PraxisError::Mef(MefError::Domain {
        message,
        value: None,
        attribute: None,
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Pooling {
    Linear,
    Logarithmic,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriorPredictive {
    pub expected: f64,
    pub at_most: f64,
    pub at_least: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Homogeneity {
    pub statistic: f64,
    pub degrees_of_freedom: f64,
    pub probability: f64,
    pub small_expected: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Trend {
    pub statistic: f64,
    pub probability: f64,
}

fn scaled_points(points: &[QuantilePoint], factor: f64) -> Vec<QuantilePoint> {
    points
        .iter()
        .map(|point| QuantilePoint {
            probability: point.probability,
            value: point.value * factor,
        })
        .collect()
}

fn shifted_points(points: &[QuantilePoint], delta: f64) -> Vec<QuantilePoint> {
    points
        .iter()
        .map(|point| QuantilePoint {
            probability: point.probability,
            value: point.value + delta,
        })
        .collect()
}

fn shift_law(law: &Law, delta: f64) -> Option<Law> {
    Some(match law {
        Law::Point { value } => Law::Point { value: value + delta },
        Law::Normal {
            mean,
            standard_deviation,
        } => Law::Normal {
            mean: mean + delta,
            standard_deviation: *standard_deviation,
        },
        Law::StudentT {
            location,
            scale,
            degrees_of_freedom,
        } => Law::StudentT {
            location: location + delta,
            scale: *scale,
            degrees_of_freedom: *degrees_of_freedom,
        },
        Law::Uniform { lower, upper } => Law::Uniform {
            lower: lower + delta,
            upper: upper + delta,
        },
        Law::Triangular { lower, mode, upper } => Law::Triangular {
            lower: lower + delta,
            mode: mode + delta,
            upper: upper + delta,
        },
        Law::Discrete { outcomes } => Law::Discrete {
            outcomes: outcomes
                .iter()
                .map(|outcome| DiscreteOutcome {
                    value: outcome.value + delta,
                    weight: outcome.weight,
                })
                .collect(),
        },
        Law::Tabulated {
            points,
            scale: TabulatedScale::Linear,
        } => Law::Tabulated {
            points: shifted_points(points, delta),
            scale: TabulatedScale::Linear,
        },
        Law::Metalog { points, lower, upper } => Law::Metalog {
            points: shifted_points(points, delta),
            lower: lower.map(|bound| bound + delta),
            upper: upper.map(|bound| bound + delta),
        },
        Law::Samples {
            values,
            weights,
            smoothing,
        } => Law::Samples {
            values: values.iter().map(|value| value + delta).collect(),
            weights: weights.clone(),
            smoothing: smoothing.clone(),
        },
        Law::Truncated { law, lower, upper } => Law::Truncated {
            law: Box::new(shift_law(law, delta)?),
            lower: lower.map(|bound| bound + delta),
            upper: upper.map(|bound| bound + delta),
        },
        Law::Mixture { components } => Law::Mixture {
            components: components
                .iter()
                .map(|component| {
                    Some(MixtureComponent {
                        weight: component.weight,
                        law: shift_law(&component.law, delta)?,
                    })
                })
                .collect::<Option<Vec<_>>>()?,
        },
        _ => return None,
    })
}

fn scaled_evidence(term: &EvidenceTerm, factor: f64) -> Option<EvidenceTerm> {
    Some(match term {
        EvidenceTerm::Poisson { failures, exposure } => EvidenceTerm::Poisson {
            failures: *failures,
            exposure: exposure / factor,
        },
        EvidenceTerm::StandbyDemand {
            demand,
            failures,
            exposure,
            test_interval,
        } => EvidenceTerm::StandbyDemand {
            demand: *demand,
            failures: *failures,
            exposure: *exposure,
            test_interval: test_interval / factor,
        },
        EvidenceTerm::UncertainCount {
            count: CountLikelihood::Poisson,
            outcomes,
            exposure,
        } => EvidenceTerm::UncertainCount {
            count: CountLikelihood::Poisson,
            outcomes: outcomes.clone(),
            exposure: exposure / factor,
        },
        EvidenceTerm::Binomial { .. } | EvidenceTerm::UncertainCount { .. } => return None,
    })
}

fn scaled_terms(evidence: &[EvidenceTerm], factor: f64) -> Option<Vec<EvidenceTerm>> {
    evidence.iter().map(|term| scaled_evidence(term, factor)).collect()
}

fn updated_scale(law: &Law, factor: f64) -> Result<Option<Law>> {
    match closed_form(law)? {
        Some(closed) => closed_scale(&closed, factor),
        None => Ok(None),
    }
}

fn duration_prior(prior: &DurationPrior, factor: f64) -> Result<Option<DurationPrior>> {
    let law = match prior.parameter {
        DurationParameter::Rate => closed_scale(&prior.law, 1.0 / factor)?,
        DurationParameter::Scale => closed_scale(&prior.law, factor)?,
        DurationParameter::Mu => shift_law(&prior.law, factor.ln()),
        DurationParameter::Sigma | DurationParameter::Shape => Some(prior.law.clone()),
    };
    Ok(law.map(|law| DurationPrior {
        parameter: prior.parameter,
        law,
    }))
}

fn closed_scale(law: &Law, factor: f64) -> Result<Option<Law>> {
    Ok(Some(match law {
        Law::Point { value } => Law::Point {
            value: value * factor,
        },
        Law::Beta {
            alpha,
            beta,
            lower,
            upper,
        } => Law::Beta {
            alpha: *alpha,
            beta: *beta,
            lower: lower * factor,
            upper: upper * factor,
        },
        Law::Gamma { shape, rate } => Law::Gamma {
            shape: *shape,
            rate: rate / factor,
        },
        Law::Lognormal {
            mean,
            error_factor,
            level,
        } => Law::Lognormal {
            mean: mean * factor,
            error_factor: *error_factor,
            level: *level,
        },
        Law::Normal {
            mean,
            standard_deviation,
        } => Law::Normal {
            mean: mean * factor,
            standard_deviation: standard_deviation * factor,
        },
        Law::StudentT {
            location,
            scale,
            degrees_of_freedom,
        } => Law::StudentT {
            location: location * factor,
            scale: scale * factor,
            degrees_of_freedom: *degrees_of_freedom,
        },
        Law::Uniform { lower, upper } => Law::Uniform {
            lower: lower * factor,
            upper: upper * factor,
        },
        Law::LogUniform { lower, upper } => Law::LogUniform {
            lower: lower * factor,
            upper: upper * factor,
        },
        Law::Triangular { lower, mode, upper } => Law::Triangular {
            lower: lower * factor,
            mode: mode * factor,
            upper: upper * factor,
        },
        Law::LogTriangular { lower, mode, upper } => Law::LogTriangular {
            lower: lower * factor,
            mode: mode * factor,
            upper: upper * factor,
        },
        Law::Weibull {
            scale,
            shape,
            location,
        } => Law::Weibull {
            scale: scale * factor,
            shape: *shape,
            location: location * factor,
        },
        Law::MaximumEntropy { lower, mean, upper } => Law::MaximumEntropy {
            lower: lower * factor,
            mean: mean * factor,
            upper: upper * factor,
        },
        Law::Discrete { outcomes } => Law::Discrete {
            outcomes: outcomes
                .iter()
                .map(|outcome| DiscreteOutcome {
                    value: outcome.value * factor,
                    weight: outcome.weight,
                })
                .collect(),
        },
        Law::Tabulated { points, scale } => Law::Tabulated {
            points: scaled_points(points, factor),
            scale: *scale,
        },
        Law::Metalog {
            points,
            lower,
            upper,
        } => Law::Metalog {
            points: scaled_points(points, factor),
            lower: lower.map(|bound| bound * factor),
            upper: upper.map(|bound| bound * factor),
        },
        Law::Samples {
            values,
            weights,
            smoothing,
        } => Law::Samples {
            values: values.iter().map(|value| value * factor).collect(),
            weights: weights.clone(),
            smoothing: match smoothing {
                SampleSmoothing::None => SampleSmoothing::None,
                SampleSmoothing::GaussianKernel { bandwidth } => SampleSmoothing::GaussianKernel {
                    bandwidth: bandwidth * factor,
                },
            },
        },
        Law::Truncated { law, lower, upper } => match closed_scale(law, factor)? {
            Some(inner) => Law::Truncated {
                law: Box::new(inner),
                lower: lower.map(|bound| bound * factor),
                upper: upper.map(|bound| bound * factor),
            },
            None => return Ok(None),
        },
        Law::Mixture { components } => {
            let mut scaled = Vec::with_capacity(components.len());
            for component in components {
                match closed_scale(&component.law, factor)? {
                    Some(law) => scaled.push(MixtureComponent {
                        weight: component.weight,
                        law,
                    }),
                    None => return Ok(None),
                }
            }
            Law::Mixture { components: scaled }
        }
        Law::Posterior { prior, evidence } => {
            let prior = match prior {
                Some(inner) => match closed_scale(inner, factor)? {
                    Some(scaled) => Some(Box::new(scaled)),
                    None => return updated_scale(law, factor),
                },
                None => None,
            };
            match scaled_terms(evidence, factor) {
                Some(evidence) => Law::Posterior { prior, evidence },
                None => return updated_scale(law, factor),
            }
        }
        Law::Population {
            mu,
            sigma,
            upper,
            evidence,
            target,
        } => match (shift_law(mu, factor.ln()), scaled_terms(evidence, factor)) {
            (Some(mu), Some(evidence)) => Law::Population {
                mu: Box::new(mu),
                sigma: sigma.clone(),
                upper: upper.map(|bound| bound * factor),
                evidence,
                target: *target,
            },
            _ => return Ok(None),
        },
        Law::EmpiricalBayes { .. } => return updated_scale(law, factor),
        Law::Trend { bins, at } => Law::Trend {
            bins: bins
                .iter()
                .map(|bin| TrendBin {
                    time: bin.time,
                    failures: bin.failures,
                    exposure: bin.exposure / factor,
                })
                .collect(),
            at: *at,
        },
        Law::Duration {
            model,
            times,
            censored,
            priors,
            output: DurationOutput::Mean,
        } => {
            let mut scaled = Vec::with_capacity(priors.len());
            for prior in priors {
                match duration_prior(prior, factor)? {
                    Some(prior) => scaled.push(prior),
                    None => return Ok(None),
                }
            }
            Law::Duration {
                model: *model,
                times: times.iter().map(|time| time * factor).collect(),
                censored: censored.iter().map(|time| time * factor).collect(),
                priors: scaled,
                output: DurationOutput::Mean,
            }
        }
        Law::Product { factors } => {
            let mut scaled = factors.clone();
            match scaled.iter_mut().find(|factor| matches!(factor, Law::Point { .. })) {
                Some(Law::Point { value }) => *value *= factor,
                _ => scaled.push(Law::Point { value: factor }),
            }
            Law::Product { factors: scaled }
        }
        Law::Duration { .. } | Law::LogitNormal { .. } | Law::ConstrainedNoninformative { .. } => return Ok(None),
    }))
}

fn scaled_product(law: &Law, factor: f64) -> Law {
    Law::Product {
        factors: vec![law.clone(), Law::Point { value: factor }],
    }
}

pub fn scale_law(law: &Law, factor: f64) -> Result<Law> {
    if !(factor > 0.0 && factor.is_finite()) {
        return Err(operation_error(format!(
            "a law can only be scaled by a positive factor, not {factor}"
        )));
    }
    match closed_scale(law, factor)? {
        Some(scaled) => Ok(scaled),
        None => Ok(scaled_product(law, factor)),
    }
}

pub fn constrained_noninformative(law: &Law, likelihood: Likelihood) -> Result<Law> {
    let mean = PreparedLaw::new(law)?.mean();
    match likelihood {
        Likelihood::Binomial if mean > 0.0 && mean < 1.0 => {
            Ok(Law::ConstrainedNoninformative { mean })
        }
        Likelihood::UncertainCount => Err(operation_error(
            "a constrained noninformative prior needs a binomial, Poisson or standby likelihood".to_string(),
        )),
        Likelihood::Poisson | Likelihood::StandbyDemand if mean > 0.0 && mean.is_finite() => Ok(Law::Gamma {
            shape: 0.5,
            rate: 0.5 / mean,
        }),
        _ => Err(operation_error(format!(
            "a constrained noninformative prior needs a mean inside the likelihood's range, not {mean}"
        ))),
    }
}

fn normal_quantile_of(probability: f64) -> Result<f64> {
    if !(probability > 0.0 && probability < 1.0) {
        return Err(operation_error(format!(
            "a quantile probability lies strictly between 0 and 1, not {probability}"
        )));
    }
    kernels::normal_quantile(probability)
}

pub fn lognormal_fit(mean: Option<f64>, median: Option<f64>, quantiles: &[QuantilePoint]) -> Result<Law> {
    for value in mean.iter().chain(median.iter()).chain(quantiles.iter().map(|point| &point.value)) {
        if !(*value > 0.0 && value.is_finite()) {
            return Err(operation_error(format!(
                "a lognormal is fitted to positive values, not {value}"
            )));
        }
    }
    let sigma = match (quantiles, median, mean) {
        ([low, high], _, _) => {
            let spread = normal_quantile_of(high.probability)? - normal_quantile_of(low.probability)?;
            (high.value / low.value).ln() / spread
        }
        ([only], Some(center), _) => (only.value / center).ln() / normal_quantile_of(only.probability)?,
        ([], Some(center), Some(average)) => (2.0 * (average / center).ln()).sqrt(),
        _ => {
            return Err(operation_error(
                "a lognormal fit needs two quantiles, one quantile and the median, or the mean and the median"
                    .to_string(),
            ))
        }
    };
    if !(sigma > 0.0 && sigma.is_finite()) {
        return Err(operation_error(
            "these values do not describe a spread that rises with probability".to_string(),
        ));
    }
    let fitted_mean = match (mean, median, quantiles) {
        (Some(average), _, _) => average,
        (None, Some(center), _) => center * (0.5 * sigma * sigma).exp(),
        (None, None, [low, ..]) => {
            let log_median = low.value.ln() - sigma * normal_quantile_of(low.probability)?;
            (log_median + 0.5 * sigma * sigma).exp()
        }
        (None, None, []) => {
            return Err(operation_error(
                "a lognormal fit needs a mean or a median".to_string(),
            ))
        }
    };
    Ok(Law::Lognormal {
        mean: fitted_mean,
        error_factor: (sigma * NORMAL_QUANTILE_95).exp(),
        level: 0.95,
    })
}

pub fn pool(pooling: Pooling, components: &[MixtureComponent]) -> Result<Law> {
    if components.is_empty() {
        return Err(operation_error("pooling needs at least one judgment".to_string()));
    }
    if components.iter().any(|component| component.weight.is_nan() || component.weight <= 0.0) {
        return Err(operation_error("pooling weights must be positive".to_string()));
    }
    if components.len() == 1 {
        return Ok(components[0].law.clone());
    }
    match pooling {
        Pooling::Linear => {
            let law = Law::Mixture {
                components: components.to_vec(),
            };
            law.check_shape()?;
            Ok(law)
        }
        Pooling::Logarithmic => {
            let total: f64 = components.iter().map(|component| component.weight).sum();
            let mut precision = 0.0;
            let mut weighted = 0.0;
            for component in components {
                let Law::Lognormal {
                    mean,
                    error_factor,
                    level,
                } = &component.law
                else {
                    return Err(operation_error(format!(
                        "logarithmic pooling has a closed form for lognormal judgments only, not {}",
                        component.law.family()
                    )));
                };
                let sigma = error_factor.ln() / kernels::normal_quantile(*level)?;
                let mu = mean.ln() - 0.5 * sigma * sigma;
                let share = component.weight / total;
                precision += share / (sigma * sigma);
                weighted += share * mu / (sigma * sigma);
            }
            let mu = weighted / precision;
            let sigma = (1.0 / precision).sqrt();
            Ok(Law::Lognormal {
                mean: (mu + 0.5 * sigma * sigma).exp(),
                error_factor: (sigma * NORMAL_QUANTILE_95).exp(),
                level: 0.95,
            })
        }
    }
}

fn count_term(term: &EvidenceTerm, purpose: &str) -> Result<CountEvidence> {
    term.check_shape()?;
    term.as_count().ok_or_else(|| {
        operation_error(format!("{purpose} needs binomial or Poisson evidence"))
    })
}

fn conditional_tails(term: &CountEvidence, theta: f64) -> Result<(f64, f64)> {
    let count = term.failures;
    match term.likelihood {
        CountLikelihood::Poisson => {
            let expected = theta * term.exposure;
            let at_most = kernels::gamma_survival(expected, count + 1.0)?;
            let at_least = if count == 0.0 {
                1.0
            } else {
                kernels::gamma_cdf(expected, count)?
            };
            Ok((at_most, at_least))
        }
        CountLikelihood::Binomial => {
            let demands = term.exposure;
            let at_most = if count >= demands {
                1.0
            } else if theta >= 1.0 {
                0.0
            } else {
                kernels::beta_survival(theta, count + 1.0, demands - count)?
            };
            let at_least = if count == 0.0 || theta >= 1.0 {
                1.0
            } else {
                kernels::beta_cdf(theta, count, demands - count + 1.0)?
            };
            Ok((at_most, at_least))
        }
    }
}

pub fn prior_predictive(law: &Law, term: &EvidenceTerm) -> Result<PriorPredictive> {
    let term = &count_term(term, "a prior predictive check")?;
    let prepared = PreparedLaw::new(law)?;
    let expected = prepared.mean() * term.exposure;
    if let (Law::Gamma { shape, rate }, CountLikelihood::Poisson) = (law, term.likelihood) {
        let share = rate / (rate + term.exposure);
        let rest = term.exposure / (rate + term.exposure);
        let at_most = kernels::beta_cdf(share, *shape, term.failures + 1.0)?;
        let at_least = if term.failures == 0.0 {
            1.0
        } else {
            kernels::beta_cdf(rest, term.failures, *shape)?
        };
        return Ok(PriorPredictive {
            expected,
            at_most,
            at_least,
        });
    }
    let atoms = prepared.atoms();
    if !atoms.is_empty() {
        let mut at_most = 0.0;
        let mut at_least = 0.0;
        for (value, probability) in atoms {
            let (low, high) = conditional_tails(term, value)?;
            at_most += probability * low;
            at_least += probability * high;
        }
        return Ok(PriorPredictive {
            expected,
            at_most,
            at_least,
        });
    }
    let (support_low, support_high) = law.support();
    let pivot = term.failures / term.exposure;
    let mut cuts = vec![(0.0, 1.0)];
    if pivot > support_low && pivot < support_high {
        cuts.push((prepared.cdf(pivot)?, prepared.survival(pivot)?));
    }
    cuts.push((1.0, 0.0));
    let mut at_most = 0.0;
    let mut at_least = 0.0;
    for pair in cuts.windows(2) {
        let (start, start_complement) = pair[0];
        let (end, end_complement) = pair[1];
        let width = if start >= 0.5 {
            start_complement - end_complement
        } else {
            end - start
        };
        if width.is_nan() || width <= 0.0 {
            continue;
        }
        at_most += width
            * tanh_sinh_pairs(start, start_complement, end, end_complement, width, |u, v| {
                Ok(conditional_tails(term, prepared.quantile_pair(u, v)?)?.0)
            })?;
        at_least += width
            * tanh_sinh_pairs(start, start_complement, end, end_complement, width, |u, v| {
                Ok(conditional_tails(term, prepared.quantile_pair(u, v)?)?.1)
            })?;
    }
    Ok(PriorPredictive {
        expected,
        at_most: at_most.min(1.0),
        at_least: at_least.min(1.0),
    })
}

fn tanh_sinh_pairs<F: FnMut(f64, f64) -> Result<f64>>(
    start: f64,
    start_complement: f64,
    end: f64,
    end_complement: f64,
    width: f64,
    mut integrand: F,
) -> Result<f64> {
    crate::core::distribution_math::tanh_sinh(|fraction, rest| {
        let (u, v) = if fraction <= 0.5 {
            (start + width * fraction, start_complement - width * fraction)
        } else {
            (end - width * rest, end_complement + width * rest)
        };
        if u > 0.0 && v > 0.0 {
            integrand(u, v)
        } else {
            Ok(0.0)
        }
    })
}

pub fn homogeneity(terms: &[EvidenceTerm]) -> Result<Homogeneity> {
    let terms = terms
        .iter()
        .map(|term| count_term(term, "a pooling test"))
        .collect::<Result<Vec<CountEvidence>>>()?;
    if terms.len() < 2 {
        return Err(operation_error("a pooling test needs two evidence sets".to_string()));
    }
    let likelihood = terms[0].likelihood;
    if terms.iter().any(|term| term.likelihood != likelihood) {
        return Err(operation_error(
            "a pooling test needs evidence sets of one likelihood".to_string(),
        ));
    }
    let failures: f64 = terms.iter().map(|term| term.failures).sum();
    let exposure: f64 = terms.iter().map(|term| term.exposure).sum();
    if failures == 0.0 {
        return Err(operation_error(
            "a pooling test needs at least one failure".to_string(),
        ));
    }
    let rate = failures / exposure;
    if likelihood == CountLikelihood::Binomial && rate >= 1.0 {
        return Err(operation_error(
            "a pooling test needs at least one success".to_string(),
        ));
    }
    let mut statistic = 0.0;
    let mut small_expected = false;
    for term in &terms {
        let expected = rate * term.exposure;
        if expected < 5.0 {
            small_expected = true;
        }
        statistic += (term.failures - expected).powi(2) / expected;
        if likelihood == CountLikelihood::Binomial {
            let survivals = (1.0 - rate) * term.exposure;
            statistic += (term.exposure - term.failures - survivals).powi(2) / survivals;
        }
    }
    let degrees_of_freedom = (terms.len() - 1) as f64;
    Ok(Homogeneity {
        statistic,
        degrees_of_freedom,
        probability: kernels::gamma_survival(0.5 * statistic, 0.5 * degrees_of_freedom)?,
        small_expected,
    })
}

pub fn laplace_trend(times: &[f64], start: f64, end: f64) -> Result<Trend> {
    if times.len() < 3 {
        return Err(operation_error(
            "a trend test needs at least three failure times".to_string(),
        ));
    }
    if end.partial_cmp(&start) != Some(Ordering::Greater) {
        return Err(operation_error(
            "a trend test needs a window that ends after it starts".to_string(),
        ));
    }
    if times.iter().any(|time| *time < start || *time > end) {
        return Err(operation_error(
            "every failure time must lie inside the window".to_string(),
        ));
    }
    let count = times.len() as f64;
    let length = end - start;
    let center = times.iter().map(|time| time - start).sum::<f64>() / count;
    let statistic = (center - 0.5 * length) / (length * (1.0 / (12.0 * count)).sqrt());
    Ok(Trend {
        statistic,
        probability: 2.0 * kernels::normal_cdf(-statistic.abs())?,
    })
}
