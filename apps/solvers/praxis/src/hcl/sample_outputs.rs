use serde::{Deserialize, Serialize};

use crate::core::distribution::{Law, MixtureComponent};
use crate::core::distribution_math::NORMAL_QUANTILE_95;
use crate::core::special_functions as kernels;
use crate::hcl::numpy_statistics;
use crate::Result;

const HISTOGRAM_BINS: usize = 44;
const BOUNDARY: f64 = 1e-12;
const MINIMUM_FIT_SAMPLES: usize = 5;
const MINIMUM_INTERIOR_SAMPLES: usize = 3;
const DENSITY_FLOOR: f64 = 1e-300;
const SEARCH_STEP: f64 = 0.55;
const SEARCH_SHRINK: f64 = 0.72;
const SEARCH_STOP: f64 = 1e-4;
const SEARCH_ROUNDS: usize = 260;
const LOG_PARAMETER_LIMIT: f64 = 20.0;
const FLAT_VARIANCE: f64 = 1e-12;
const FLAT_CONCENTRATION: f64 = 5000.0;
const MEAN_FLOOR: f64 = 1e-6;
const VARIANCE_SHARE: f64 = 0.999;
const CONCENTRATION_FLOOR: f64 = 1e-3;
const SPREAD_FLOOR: f64 = 1e-8;
const FALLBACK_BINS_LOW: usize = 10;
const FALLBACK_BINS_HIGH: usize = 50;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HclQuantity {
    Probability,
    Frequency,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclHistogram {
    pub edges: Vec<f64>,
    pub counts: Vec<usize>,
    pub densities: Vec<f64>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclExceedancePoint {
    pub value: f64,
    pub probability: f64,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HclFitFamily {
    Beta,
    LogitNormal,
    ZeroOneInflatedBeta,
    ZeroOneInflatedLogitNormal,
    Lognormal,
    Gamma,
    ZeroInflatedLognormal,
    ZeroInflatedGamma,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclFitCandidate {
    pub family: HclFitFamily,
    pub law: Law,
    pub parameter_count: usize,
    pub log_likelihood: f64,
    pub aic: f64,
    pub bic: f64,
    pub ks_statistic: f64,
    pub cdf_rmse: f64,
    pub pdf_rmse: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclRejectedFit {
    pub family: HclFitFamily,
    pub reason: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclDistributionFit {
    pub samples: usize,
    pub zero_samples: usize,
    pub one_samples: usize,
    pub candidates: Vec<HclFitCandidate>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub rejected: Vec<HclRejectedFit>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclHazardExceedancePoint {
    pub threshold: f64,
    pub weight: f64,
    pub exceedance_weight: f64,
    pub exceedance_frequency: f64,
}

#[derive(Clone, Copy)]
enum Base {
    Beta { alpha: f64, beta: f64 },
    LogitNormal { mu: f64, sigma: f64 },
    Lognormal { mu: f64, sigma: f64 },
    Gamma { shape: f64, rate: f64 },
}

fn clipped(value: f64) -> f64 {
    value.clamp(BOUNDARY, 1.0 - BOUNDARY)
}

fn logit(value: f64) -> f64 {
    let x = clipped(value);
    (x / (1.0 - x)).ln()
}

fn standard_normal_log_density(z: f64) -> f64 {
    -0.5 * z * z - 0.5 * (2.0 * std::f64::consts::PI).ln()
}

impl Base {
    fn law(self) -> Law {
        match self {
            Base::Beta { alpha, beta } => Law::Beta {
                alpha,
                beta,
                lower: 0.0,
                upper: 1.0,
            },
            Base::LogitNormal { mu, sigma } => Law::LogitNormal { mu, sigma },
            Base::Lognormal { mu, sigma } => Law::Lognormal {
                mean: (mu + 0.5 * sigma * sigma).exp(),
                error_factor: (NORMAL_QUANTILE_95 * sigma).exp(),
                level: 0.95,
            },
            Base::Gamma { shape, rate } => Law::Gamma { shape, rate },
        }
    }

    fn cdf(self, value: f64) -> Result<f64> {
        match self {
            Base::Beta { alpha, beta } => kernels::beta_cdf(clipped(value), alpha, beta),
            Base::LogitNormal { mu, sigma } => kernels::normal_cdf((logit(value) - mu) / sigma),
            Base::Lognormal { mu, sigma } => {
                if value <= 0.0 {
                    Ok(0.0)
                } else {
                    kernels::normal_cdf((value.ln() - mu) / sigma)
                }
            }
            Base::Gamma { shape, rate } => {
                if value <= 0.0 {
                    Ok(0.0)
                } else {
                    kernels::gamma_cdf(rate * value, shape)
                }
            }
        }
    }

    fn density(self, value: f64) -> Result<f64> {
        match self {
            Base::Beta { alpha, beta } => kernels::beta_density(clipped(value), alpha, beta),
            Base::LogitNormal { mu, sigma } => {
                let x = clipped(value);
                Ok(logit_normal_log_density(x, mu, sigma).exp())
            }
            Base::Lognormal { mu, sigma } => {
                if value <= 0.0 {
                    Ok(0.0)
                } else {
                    let y = value.ln();
                    Ok((standard_normal_log_density((y - mu) / sigma) - sigma.ln() - y).exp())
                }
            }
            Base::Gamma { shape, rate } => {
                if value <= 0.0 {
                    Ok(0.0)
                } else {
                    Ok(rate * kernels::gamma_density(rate * value, shape)?)
                }
            }
        }
    }
}

fn logit_normal_log_density(x: f64, mu: f64, sigma: f64) -> f64 {
    let z = (x / (1.0 - x)).ln();
    standard_normal_log_density((z - mu) / sigma) - sigma.ln() - x.ln() - (1.0 - x).ln()
}

struct Fitted {
    family: HclFitFamily,
    base: Option<Base>,
    zero: f64,
    one: f64,
    unit: bool,
    log_likelihood: f64,
    parameters: usize,
}

impl Fitted {
    fn continuous(&self) -> f64 {
        (1.0 - self.zero - self.one).max(0.0)
    }

    fn cdf(&self, value: f64) -> Result<f64> {
        if value < 0.0 {
            return Ok(0.0);
        }
        if self.unit && value >= 1.0 {
            return Ok(1.0);
        }
        let base = match self.base {
            Some(base) if self.continuous() > 0.0 => base.cdf(value)?,
            _ => 0.0,
        };
        Ok((self.zero + self.continuous() * base).clamp(0.0, 1.0))
    }

    fn density(&self, value: f64) -> Result<f64> {
        match self.base {
            Some(base) if self.continuous() > 0.0 => Ok(self.continuous() * base.density(value)?),
            _ => Ok(0.0),
        }
    }

    fn law(&self) -> Law {
        let mut components = Vec::new();
        if self.zero > 0.0 {
            components.push(MixtureComponent {
                weight: self.zero,
                law: Law::Point { value: 0.0 },
            });
        }
        if self.one > 0.0 {
            components.push(MixtureComponent {
                weight: self.one,
                law: Law::Point { value: 1.0 },
            });
        }
        if let Some(base) = self.base {
            if self.continuous() > 0.0 {
                components.push(MixtureComponent {
                    weight: self.continuous(),
                    law: base.law(),
                });
            }
        }
        if components.len() == 1 {
            return components.remove(0).law;
        }
        Law::Mixture { components }
    }
}

fn mean(values: &[f64]) -> f64 {
    values.iter().sum::<f64>() / values.len() as f64
}

fn population_spread(values: &[f64], center: f64) -> f64 {
    (values.iter().map(|value| (value - center) * (value - center)).sum::<f64>() / values.len() as f64).sqrt()
}

fn directions(dimensions: usize) -> Vec<Vec<f64>> {
    let mut found: Vec<Vec<f64>> = vec![Vec::new()];
    for _ in 0..dimensions {
        found = found
            .into_iter()
            .flat_map(|prefix| {
                [0.0, 1.0, -1.0].into_iter().map(move |step| {
                    let mut next = prefix.clone();
                    next.push(step);
                    next
                })
            })
            .collect();
    }
    found.into_iter().filter(|direction| direction.iter().any(|step| *step != 0.0)).collect()
}

fn pattern_search<F: FnMut(&[f64]) -> Result<f64>>(start: Vec<f64>, mut objective: F) -> Result<(Vec<f64>, f64)> {
    let worse = |value: f64| if value.is_finite() { value } else { f64::INFINITY };
    let offsets = directions(start.len());
    let mut best = start;
    let mut best_value = worse(objective(&best)?);
    let mut step = SEARCH_STEP;
    for _ in 0..SEARCH_ROUNDS {
        let mut improved = false;
        for direction in &offsets {
            let candidate: Vec<f64> = best.iter().zip(direction).map(|(point, sign)| point + sign * step).collect();
            let value = worse(objective(&candidate)?);
            if value < best_value {
                best = candidate;
                best_value = value;
                improved = true;
            }
        }
        if improved {
            continue;
        }
        step *= SEARCH_SHRINK;
        if step < SEARCH_STOP {
            break;
        }
    }
    Ok((best, best_value))
}

fn bounded_exp(log_value: f64) -> f64 {
    log_value.clamp(-LOG_PARAMETER_LIMIT, LOG_PARAMETER_LIMIT).exp()
}

fn beta_start(values: &[f64]) -> (f64, f64) {
    let center = mean(values).clamp(MEAN_FLOOR, 1.0 - MEAN_FLOOR);
    let raw_center = mean(values);
    let variance = values.iter().map(|value| (value - raw_center) * (value - raw_center)).sum::<f64>() / values.len() as f64;
    if variance <= FLAT_VARIANCE {
        return (center * FLAT_CONCENTRATION, (1.0 - center) * FLAT_CONCENTRATION);
    }
    let limit = center * (1.0 - center);
    let variance = variance.min(VARIANCE_SHARE * limit);
    let mut common = limit / variance.max(FLAT_VARIANCE) - 1.0;
    if common <= 0.0 {
        common = 2.0;
    }
    (
        (center * common).max(CONCENTRATION_FLOOR),
        ((1.0 - center) * common).max(CONCENTRATION_FLOOR),
    )
}

fn fit_beta(values: &[f64]) -> Result<(Base, f64)> {
    let count = values.len() as f64;
    let log_values: f64 = values.iter().map(|value| value.ln()).sum();
    let log_complements: f64 = values.iter().map(|value| (1.0 - value).ln()).sum();
    let (alpha, beta) = beta_start(values);
    let (best, value) = pattern_search(vec![alpha.ln(), beta.ln()], |point| {
        let alpha = bounded_exp(point[0]);
        let beta = bounded_exp(point[1]);
        let log_beta = kernels::log_gamma(alpha)? + kernels::log_gamma(beta)? - kernels::log_gamma(alpha + beta)?;
        Ok(-((alpha - 1.0) * log_values + (beta - 1.0) * log_complements - count * log_beta))
    })?;
    Ok((
        Base::Beta {
            alpha: bounded_exp(best[0]),
            beta: bounded_exp(best[1]),
        },
        -value,
    ))
}

fn fit_logit_normal(values: &[f64]) -> (Base, f64) {
    let logits: Vec<f64> = values.iter().map(|value| logit(*value)).collect();
    let mu = mean(&logits);
    let sigma = population_spread(&logits, mu).max(SPREAD_FLOOR);
    let floor = DENSITY_FLOOR.ln();
    let log_likelihood = values
        .iter()
        .map(|value| logit_normal_log_density(clipped(*value), mu, sigma).max(floor))
        .sum();
    (Base::LogitNormal { mu, sigma }, log_likelihood)
}

fn fit_lognormal(values: &[f64]) -> (Base, f64) {
    let logs: Vec<f64> = values.iter().map(|value| value.ln()).collect();
    let mu = mean(&logs);
    let sigma = population_spread(&logs, mu).max(SPREAD_FLOOR);
    let log_likelihood = logs
        .iter()
        .map(|y| standard_normal_log_density((y - mu) / sigma) - sigma.ln() - y)
        .sum();
    (Base::Lognormal { mu, sigma }, log_likelihood)
}

fn fit_gamma(values: &[f64]) -> Result<(Base, f64)> {
    let count = values.len() as f64;
    let total: f64 = values.iter().sum();
    let center = total / count;
    let log_total: f64 = values.iter().map(|value| value.ln()).sum();
    let gap = center.ln() - log_total / count;
    let start = if gap > 0.0 {
        (3.0 - gap + ((gap - 3.0) * (gap - 3.0) + 24.0 * gap).sqrt()) / (12.0 * gap)
    } else {
        FLAT_CONCENTRATION
    };
    let (best, value) = pattern_search(vec![start.ln()], |point| {
        let shape = bounded_exp(point[0]);
        let rate = shape / center;
        Ok(-(count * (shape * rate.ln() - kernels::log_gamma(shape)?) + (shape - 1.0) * log_total - rate * total))
    })?;
    let shape = bounded_exp(best[0]);
    Ok((Base::Gamma { shape, rate: shape / center }, -value))
}

fn mass_log_likelihood(count: usize, share: f64) -> f64 {
    if count == 0 {
        0.0
    } else {
        count as f64 * share.ln()
    }
}

struct Attempts {
    fitted: Vec<Fitted>,
    rejected: Vec<HclRejectedFit>,
}

impl Attempts {
    fn new() -> Self {
        Self {
            fitted: Vec::new(),
            rejected: Vec::new(),
        }
    }

    fn attempt<F: FnOnce() -> Result<Fitted>>(&mut self, family: HclFitFamily, build: F) {
        match build() {
            Ok(fitted) => self.fitted.push(fitted),
            Err(error) => self.rejected.push(HclRejectedFit {
                family,
                reason: error.to_string(),
            }),
        }
    }
}

fn probability_candidates(samples: &[f64]) -> (Attempts, usize, usize) {
    let count = samples.len();
    let all: Vec<f64> = samples.iter().map(|value| clipped(*value)).collect();
    let zeros = samples.iter().filter(|value| **value <= BOUNDARY).count();
    let ones = samples.iter().filter(|value| **value >= 1.0 - BOUNDARY).count();
    let zero = zeros as f64 / count as f64;
    let one = ones as f64 / count as f64;
    let continuous = (1.0 - zero - one).max(0.0);
    let interior: Vec<f64> = samples
        .iter()
        .copied()
        .filter(|value| *value > BOUNDARY && *value < 1.0 - BOUNDARY)
        .collect();
    let boundary = mass_log_likelihood(zeros, zero) + mass_log_likelihood(ones, one);
    let mut attempts = Attempts::new();
    if interior.is_empty() {
        attempts.attempt(HclFitFamily::ZeroOneInflatedBeta, || {
            Ok(Fitted {
                family: HclFitFamily::ZeroOneInflatedBeta,
                base: None,
                zero,
                one,
                unit: true,
                log_likelihood: boundary,
                parameters: 2,
            })
        });
    } else if interior.len() >= MINIMUM_INTERIOR_SAMPLES {
        let interior_share = mass_log_likelihood(interior.len(), continuous);
        attempts.attempt(HclFitFamily::ZeroOneInflatedBeta, || {
            let (beta, beta_likelihood) = fit_beta(&interior)?;
            Ok(Fitted {
                family: HclFitFamily::ZeroOneInflatedBeta,
                base: Some(beta),
                zero,
                one,
                unit: true,
                log_likelihood: boundary + interior_share + beta_likelihood,
                parameters: 4,
            })
        });
        attempts.attempt(HclFitFamily::ZeroOneInflatedLogitNormal, || {
            let (logit_normal, logit_likelihood) = fit_logit_normal(&interior);
            Ok(Fitted {
                family: HclFitFamily::ZeroOneInflatedLogitNormal,
                base: Some(logit_normal),
                zero,
                one,
                unit: true,
                log_likelihood: boundary + interior_share + logit_likelihood,
                parameters: 4,
            })
        });
    }
    attempts.attempt(HclFitFamily::Beta, || {
        let (beta, beta_likelihood) = fit_beta(&all)?;
        Ok(Fitted {
            family: HclFitFamily::Beta,
            base: Some(beta),
            zero: 0.0,
            one: 0.0,
            unit: true,
            log_likelihood: beta_likelihood,
            parameters: 2,
        })
    });
    attempts.attempt(HclFitFamily::LogitNormal, || {
        let (logit_normal, logit_likelihood) = fit_logit_normal(&all);
        Ok(Fitted {
            family: HclFitFamily::LogitNormal,
            base: Some(logit_normal),
            zero: 0.0,
            one: 0.0,
            unit: true,
            log_likelihood: logit_likelihood,
            parameters: 2,
        })
    });
    (attempts, zeros, ones)
}

fn frequency_candidates(samples: &[f64]) -> (Attempts, usize) {
    let count = samples.len();
    let zeros = samples.iter().filter(|value| **value <= 0.0).count();
    let positive: Vec<f64> = samples.iter().copied().filter(|value| *value > 0.0).collect();
    let zero = zeros as f64 / count as f64;
    let mut attempts = Attempts::new();
    if positive.len() >= MINIMUM_INTERIOR_SAMPLES {
        let masses = mass_log_likelihood(zeros, zero) + mass_log_likelihood(positive.len(), 1.0 - zero);
        let (lognormal, lognormal_likelihood) = fit_lognormal(&positive);
        attempts.attempt(HclFitFamily::ZeroInflatedLognormal, || {
            Ok(Fitted {
                family: HclFitFamily::ZeroInflatedLognormal,
                base: Some(lognormal),
                zero,
                one: 0.0,
                unit: false,
                log_likelihood: masses + lognormal_likelihood,
                parameters: 3,
            })
        });
        if zeros == 0 {
            attempts.attempt(HclFitFamily::Lognormal, || {
                Ok(Fitted {
                    family: HclFitFamily::Lognormal,
                    base: Some(lognormal),
                    zero: 0.0,
                    one: 0.0,
                    unit: false,
                    log_likelihood: lognormal_likelihood,
                    parameters: 2,
                })
            });
        }
        match fit_gamma(&positive) {
            Ok((gamma, gamma_likelihood)) => {
                attempts.attempt(HclFitFamily::ZeroInflatedGamma, || {
                    Ok(Fitted {
                        family: HclFitFamily::ZeroInflatedGamma,
                        base: Some(gamma),
                        zero,
                        one: 0.0,
                        unit: false,
                        log_likelihood: masses + gamma_likelihood,
                        parameters: 3,
                    })
                });
                if zeros == 0 {
                    attempts.attempt(HclFitFamily::Gamma, || {
                        Ok(Fitted {
                            family: HclFitFamily::Gamma,
                            base: Some(gamma),
                            zero: 0.0,
                            one: 0.0,
                            unit: false,
                            log_likelihood: gamma_likelihood,
                            parameters: 2,
                        })
                    });
                }
            }
            Err(error) => {
                let reason = error.to_string();
                attempts.rejected.push(HclRejectedFit {
                    family: HclFitFamily::ZeroInflatedGamma,
                    reason: reason.clone(),
                });
                if zeros == 0 {
                    attempts.rejected.push(HclRejectedFit {
                        family: HclFitFamily::Gamma,
                        reason,
                    });
                }
            }
        }
    }
    (attempts, zeros)
}

fn freedman_diaconis(sorted: &[f64]) -> (f64, f64, usize) {
    let low = sorted[0];
    let high = sorted[sorted.len() - 1];
    let count = sorted.len();
    let spread = numpy_statistics::percentile(sorted, 0.75) - numpy_statistics::percentile(sorted, 0.25);
    let width = 2.0 * spread * (count as f64).powf(-1.0 / 3.0);
    let bins = if width > 0.0 && width.is_finite() {
        ((high - low) / width).ceil()
    } else {
        f64::NAN
    };
    let bins = if bins.is_finite() && bins >= 1.0 {
        (bins as usize).min(count)
    } else {
        ((count as f64).sqrt() as usize).clamp(FALLBACK_BINS_LOW, FALLBACK_BINS_HIGH)
    };
    (low, high, bins)
}

fn binned(sorted: &[f64], low: f64, high: f64, bins: usize) -> Vec<usize> {
    let width = (high - low) / bins as f64;
    let mut counts = vec![0; bins];
    for value in sorted {
        let index = (((value - low) / width).floor() as usize).min(bins - 1);
        counts[index] += 1;
    }
    counts
}

fn goodness(fitted: &Fitted, sorted: &[f64]) -> Result<(f64, f64, f64)> {
    let count = sorted.len() as f64;
    let mut largest: f64 = 0.0;
    let mut squares = 0.0;
    for (index, value) in sorted.iter().enumerate() {
        let deviation = fitted.cdf(*value)? - (index + 1) as f64 / count;
        largest = largest.max(deviation.abs());
        squares += deviation * deviation;
    }
    let (low, high, bins) = freedman_diaconis(sorted);
    let width = (high - low) / bins as f64;
    let counts = binned(sorted, low, high, bins);
    let mut density_squares = 0.0;
    for (bin, observed) in counts.iter().enumerate() {
        let center = low + (bin as f64 + 0.5) * width;
        let deviation = fitted.density(center)? - *observed as f64 / (count * width);
        density_squares += deviation * deviation;
    }
    Ok((largest, (squares / count).sqrt(), (density_squares / bins as f64).sqrt()))
}

pub(crate) fn distribution_fit(samples: &[f64], quantity: HclQuantity) -> Result<Option<HclDistributionFit>> {
    if samples.len() < MINIMUM_FIT_SAMPLES {
        return Ok(None);
    }
    let mut sorted = samples.to_vec();
    sorted.sort_by(|left, right| left.total_cmp(right));
    if sorted[0] == sorted[sorted.len() - 1] {
        return Ok(None);
    }
    let (attempts, zero_samples, one_samples) = match quantity {
        HclQuantity::Probability => probability_candidates(samples),
        HclQuantity::Frequency => {
            let (attempts, zeros) = frequency_candidates(samples);
            (attempts, zeros, 0)
        }
    };
    let count = samples.len() as f64;
    let mut rejected = attempts.rejected;
    let mut candidates = Vec::with_capacity(attempts.fitted.len());
    for fit in &attempts.fitted {
        let (ks_statistic, cdf_rmse, pdf_rmse) = match goodness(fit, &sorted) {
            Ok(statistics) => statistics,
            Err(error) => {
                rejected.push(HclRejectedFit {
                    family: fit.family,
                    reason: error.to_string(),
                });
                continue;
            }
        };
        let aic = 2.0 * fit.parameters as f64 - 2.0 * fit.log_likelihood;
        let bic = fit.parameters as f64 * count.ln() - 2.0 * fit.log_likelihood;
        if ![fit.log_likelihood, aic, bic, ks_statistic, cdf_rmse, pdf_rmse].iter().all(|value| value.is_finite()) {
            rejected.push(HclRejectedFit {
                family: fit.family,
                reason: "the fit gave a likelihood or a goodness-of-fit statistic that is not finite".to_string(),
            });
            continue;
        }
        candidates.push(HclFitCandidate {
            family: fit.family,
            law: fit.law(),
            parameter_count: fit.parameters,
            log_likelihood: fit.log_likelihood,
            aic,
            bic,
            ks_statistic,
            cdf_rmse,
            pdf_rmse,
        });
    }
    if candidates.is_empty() && rejected.is_empty() {
        return Ok(None);
    }
    candidates.sort_by(|left, right| left.aic.total_cmp(&right.aic).then(left.bic.total_cmp(&right.bic)));
    Ok(Some(HclDistributionFit {
        samples: samples.len(),
        zero_samples,
        one_samples,
        candidates,
        rejected,
    }))
}

pub(crate) fn histogram(sorted: &[f64]) -> Option<HclHistogram> {
    let low = *sorted.first()?;
    let high = *sorted.last()?;
    if high <= low {
        return None;
    }
    let width = (high - low) / HISTOGRAM_BINS as f64;
    let counts = binned(sorted, low, high, HISTOGRAM_BINS);
    let count = sorted.len() as f64;
    Some(HclHistogram {
        edges: (0..=HISTOGRAM_BINS).map(|edge| low + edge as f64 * width).collect(),
        densities: counts.iter().map(|observed| *observed as f64 / (count * width)).collect(),
        counts,
    })
}

pub(crate) fn exceedance(sorted: &[f64], histogram: &HclHistogram) -> Vec<HclExceedancePoint> {
    let count = sorted.len() as f64;
    histogram
        .edges
        .iter()
        .map(|edge| HclExceedancePoint {
            value: *edge,
            probability: (sorted.len() - sorted.partition_point(|value| value < edge)) as f64 / count,
        })
        .collect()
}

pub fn hazard_exceedance(cells: &[(f64, f64, f64)]) -> Vec<HclHazardExceedancePoint> {
    let mut pairs: Vec<(f64, f64, f64)> = cells
        .iter()
        .copied()
        .filter(|(value, weight, _)| *value > 0.0 && *weight > 0.0)
        .collect();
    pairs.sort_by(|left, right| right.0.total_cmp(&left.0));
    let mut exceedance_weight = 0.0;
    let mut exceedance_frequency = 0.0;
    let mut points: Vec<HclHazardExceedancePoint> = pairs
        .into_iter()
        .map(|(threshold, weight, frequency)| {
            exceedance_weight += weight;
            exceedance_frequency += frequency;
            HclHazardExceedancePoint {
                threshold,
                weight,
                exceedance_weight,
                exceedance_frequency,
            }
        })
        .collect();
    points.reverse();
    points
}
