use std::f64::consts::PI;

use crate::core::distribution::{
    CountEvidence, CountLikelihood, DurationModel, DurationOutput, DurationParameter, DurationPrior, TrendBin,
};
use crate::core::distribution_math::PreparedLaw;
use crate::core::special_functions as kernels;
use crate::error::MefError;
use crate::{PraxisError, Result};

const SEARCH_ITERATIONS: usize = 5000;

const SEARCH_VALUE_TOLERANCE: f64 = 1e-14;

const SEARCH_SIZE_TOLERANCE: f64 = 1e-11;

const DEGENERATE_DISPERSION: f64 = -25.0;

const DEGENERATE_GAIN: f64 = 1e-9;

const GRID_DROP: f64 = 37.0;

const GRID_START_REACH: f64 = 6.0;

const GRID_MAX_REACH: f64 = 80.0;

const GRID_FACE_SAMPLES: usize = 33;

const GRID_LINE_NODES: usize = 2001;

const GRID_PLANE_NODES: usize = 161;

const GRID_STRETCH: f64 = 1.5;

fn inference_error(message: String) -> PraxisError {
    PraxisError::Mef(MefError::Domain {
        message,
        value: None,
        attribute: None,
    })
}

fn ranked(value: f64) -> f64 {
    if value.is_nan() {
        f64::NEG_INFINITY
    } else {
        value
    }
}

fn simplex_search<F: FnMut(&[f64]) -> Result<f64>>(objective: &mut F, start: &[f64], step: f64) -> Result<(Vec<f64>, f64)> {
    let size = start.len();
    let mut simplex: Vec<(Vec<f64>, f64)> = Vec::with_capacity(size + 1);
    simplex.push((start.to_vec(), ranked(objective(start)?)));
    for axis in 0..size {
        let mut point = start.to_vec();
        point[axis] += step;
        let value = ranked(objective(&point)?);
        simplex.push((point, value));
    }
    let blend = |from: &[f64], to: &[f64], amount: f64| -> Vec<f64> {
        from.iter().zip(to).map(|(origin, target)| origin + amount * (target - origin)).collect()
    };
    for _ in 0..SEARCH_ITERATIONS {
        simplex.sort_by(|left, right| right.1.total_cmp(&left.1));
        let best = simplex[0].1;
        let worst = simplex[size].1;
        let spread = simplex
            .iter()
            .flat_map(|(point, _)| point.iter().zip(&simplex[0].0).map(|(value, anchor)| (value - anchor).abs()))
            .fold(0.0, f64::max);
        if best.is_finite() && (best - worst).abs() <= SEARCH_VALUE_TOLERANCE * (1.0 + best.abs()) && spread <= SEARCH_SIZE_TOLERANCE {
            break;
        }
        let mut centroid = vec![0.0; size];
        for (point, _) in simplex.iter().take(size) {
            for (sum, value) in centroid.iter_mut().zip(point) {
                *sum += value / size as f64;
            }
        }
        let worst_point = simplex[size].0.clone();
        let reflected = blend(&centroid, &worst_point, -1.0);
        let reflected_value = ranked(objective(&reflected)?);
        if reflected_value > best {
            let expanded = blend(&centroid, &worst_point, -2.0);
            let expanded_value = ranked(objective(&expanded)?);
            simplex[size] = if expanded_value > reflected_value {
                (expanded, expanded_value)
            } else {
                (reflected, reflected_value)
            };
            continue;
        }
        if reflected_value > simplex[size - 1].1 {
            simplex[size] = (reflected, reflected_value);
            continue;
        }
        let (contracted, limit) = if reflected_value > worst {
            (blend(&centroid, &reflected, 0.5), reflected_value)
        } else {
            (blend(&centroid, &worst_point, 0.5), worst)
        };
        let contracted_value = ranked(objective(&contracted)?);
        if contracted_value > limit {
            simplex[size] = (contracted, contracted_value);
            continue;
        }
        let anchor = simplex[0].0.clone();
        for entry in simplex.iter_mut().skip(1) {
            let point = blend(&anchor, &entry.0, 0.5);
            let value = ranked(objective(&point)?);
            *entry = (point, value);
        }
    }
    simplex.sort_by(|left, right| right.1.total_cmp(&left.1));
    Ok(simplex.swap_remove(0))
}

fn maximize<F: FnMut(&[f64]) -> Result<f64>>(mut objective: F, start: &[f64]) -> Result<(Vec<f64>, f64)> {
    let mut found = simplex_search(&mut objective, start, 0.5)?;
    for step in [0.1, 0.01] {
        let again = simplex_search(&mut objective, &found.0, step)?;
        if again.1 >= found.1 {
            found = again;
        }
    }
    Ok(found)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum FittedPopulation {
    Gamma { shape: f64, rate: f64 },
    Beta { alpha: f64, beta: f64 },
}

fn log_choose(demands: f64, failures: f64) -> Result<f64> {
    Ok(kernels::log_gamma(demands + 1.0)? - kernels::log_gamma(failures + 1.0)? - kernels::log_gamma(demands - failures + 1.0)?)
}

fn log_beta(alpha: f64, beta: f64) -> Result<f64> {
    Ok(kernels::log_gamma(alpha)? + kernels::log_gamma(beta)? - kernels::log_gamma(alpha + beta)?)
}

fn power_log(power: f64, log_base: f64) -> f64 {
    if power == 0.0 {
        0.0
    } else {
        power * log_base
    }
}

pub(crate) fn fit_population(evidence: &[CountEvidence]) -> Result<FittedPopulation> {
    if evidence.len() < 2 {
        return Err(inference_error("empirical Bayes needs two or more members".to_string()));
    }
    evidence.iter().try_for_each(CountEvidence::check_shape)?;
    let likelihood = evidence[0].likelihood;
    if evidence.iter().any(|term| term.likelihood != likelihood) {
        return Err(inference_error(
            "empirical Bayes members share one likelihood. Fit binomial and Poisson members apart".to_string(),
        ));
    }
    let failures: f64 = evidence.iter().map(|term| term.failures).sum();
    let exposure: f64 = evidence.iter().map(|term| term.exposure).sum();
    if failures == 0.0 {
        return Err(inference_error(
            "the members show no failures, so the population fit degenerates. Use a pooled posterior instead".to_string(),
        ));
    }
    if likelihood == CountLikelihood::Binomial && failures == exposure {
        return Err(inference_error(
            "every demand failed, so the population fit degenerates. Use a pooled posterior instead".to_string(),
        ));
    }
    let pooled = failures / exposure;
    let score: f64 = evidence
        .iter()
        .map(|term| {
            let expected = pooled * term.exposure;
            let spread = match likelihood {
                CountLikelihood::Poisson => expected,
                CountLikelihood::Binomial => expected * (1.0 - pooled),
            };
            (term.failures - expected).powi(2) - spread
        })
        .sum();
    let flat = || {
        inference_error(
            "the members vary no more than chance allows, so the population fit has no spread. Use a pooled posterior instead"
                .to_string(),
        )
    };
    if score <= 0.0 {
        return Err(flat());
    }
    let (pooled_log, found) = match likelihood {
        CountLikelihood::Poisson => {
            let mut pooled_log = 0.0;
            for term in evidence {
                pooled_log += power_log(term.failures, (pooled * term.exposure).ln()) - pooled * term.exposure
                    - kernels::log_gamma(term.failures + 1.0)?;
            }
            let found = maximize(
                |point| {
                    let shape = (-point[1]).exp();
                    let rate = shape / point[0].exp();
                    if !(shape.is_finite() && rate.is_finite() && shape > 0.0 && rate > 0.0) {
                        return Ok(f64::NEG_INFINITY);
                    }
                    let mut total = 0.0;
                    for term in evidence {
                        total += kernels::log_gamma(shape + term.failures)? - kernels::log_gamma(shape)?
                            - kernels::log_gamma(term.failures + 1.0)?
                            - shape * (term.exposure / rate).ln_1p()
                            - term.failures * (rate + term.exposure).ln()
                            + power_log(term.failures, term.exposure.ln());
                    }
                    Ok(total)
                },
                &[pooled.ln(), 0.0],
            )?;
            (pooled_log, found)
        }
        CountLikelihood::Binomial => {
            let mut pooled_log = 0.0;
            for term in evidence {
                pooled_log += log_choose(term.exposure, term.failures)? + power_log(term.failures, pooled.ln())
                    + power_log(term.exposure - term.failures, (-pooled).ln_1p());
            }
            let found = maximize(
                |point| {
                    let mean = 1.0 / (1.0 + (-point[0]).exp());
                    let total_count = (-point[1]).exp();
                    let alpha = mean * total_count;
                    let beta = (1.0 - mean) * total_count;
                    if !(alpha.is_finite() && beta.is_finite() && alpha > 0.0 && beta > 0.0) {
                        return Ok(f64::NEG_INFINITY);
                    }
                    let mut total = 0.0;
                    for term in evidence {
                        total += log_choose(term.exposure, term.failures)?
                            + log_beta(alpha + term.failures, beta + term.exposure - term.failures)?
                            - log_beta(alpha, beta)?;
                    }
                    Ok(total)
                },
                &[(pooled / (1.0 - pooled)).ln(), 0.0],
            )?;
            (pooled_log, found)
        }
    };
    let (point, best) = found;
    if !best.is_finite() || point[1] < DEGENERATE_DISPERSION || best - pooled_log <= DEGENERATE_GAIN * pooled_log.abs().max(1.0) {
        return Err(flat());
    }
    Ok(match likelihood {
        CountLikelihood::Poisson => {
            let shape = (-point[1]).exp();
            FittedPopulation::Gamma {
                shape,
                rate: shape / point[0].exp(),
            }
        }
        CountLikelihood::Binomial => {
            let mean = 1.0 / (1.0 + (-point[0]).exp());
            let total_count = (-point[1]).exp();
            FittedPopulation::Beta {
                alpha: mean * total_count,
                beta: (1.0 - mean) * total_count,
            }
        }
    })
}

pub(crate) type OutputRow = Vec<(f64, f64)>;

fn grid_atoms<P, G>(subject: &str, log_posterior: P, start: &[f64], output: G) -> Result<Vec<OutputRow>>
where
    P: Fn(&[f64]) -> Result<f64>,
    G: Fn(&[f64]) -> Result<f64>,
{
    let size = start.len();
    if size == 0 {
        return Ok(vec![vec![(output(start)?, 1.0)]]);
    }
    let unsettled = || inference_error(format!("the data do not settle the {subject}. Add data or a prior"));
    let (mode, peak) = maximize(&log_posterior, start)?;
    if !peak.is_finite() {
        return Err(inference_error(format!("the data are impossible for the {subject}")));
    }
    let shifted = |offsets: &[f64]| -> Result<f64> {
        let point: Vec<f64> = mode.iter().zip(offsets).map(|(center, offset)| center + offset).collect();
        Ok(ranked(log_posterior(&point)?))
    };
    let mut steps = vec![1e-3; size];
    let mut curvature = vec![vec![0.0; size]; size];
    let mut settled = true;
    for _ in 0..2 {
        for row in 0..size {
            for column in 0..size {
                let mut offset = vec![0.0; size];
                curvature[row][column] = if row == column {
                    offset[row] = steps[row];
                    let up = shifted(&offset)?;
                    offset[row] = -steps[row];
                    let down = shifted(&offset)?;
                    -(up - 2.0 * peak + down) / (steps[row] * steps[row])
                } else {
                    let mut corner = |sign_row: f64, sign_column: f64| -> Result<f64> {
                        offset[row] = sign_row * steps[row];
                        offset[column] = sign_column * steps[column];
                        shifted(&offset)
                    };
                    -(corner(1.0, 1.0)? - corner(1.0, -1.0)? - corner(-1.0, 1.0)? + corner(-1.0, -1.0)?)
                        / (4.0 * steps[row] * steps[column])
                };
            }
        }
        let determinant = if size == 1 {
            curvature[0][0]
        } else {
            curvature[0][0] * curvature[1][1] - curvature[0][1] * curvature[1][0]
        };
        if !(curvature[0][0] > 0.0 && determinant > 0.0 && determinant.is_finite()) {
            settled = false;
            break;
        }
        for (axis, step) in steps.iter_mut().enumerate() {
            let variance = if size == 1 {
                1.0 / curvature[0][0]
            } else {
                curvature[1 - axis][1 - axis] / determinant
            };
            *step = 0.2 * variance.sqrt();
        }
    }
    let factor: Vec<Vec<f64>> = if !settled {
        let mut factor = vec![vec![0.0; size]; size];
        for (axis, row) in factor.iter_mut().enumerate() {
            let mut reaches = [0.0; 2];
            for (side, reach) in reaches.iter_mut().enumerate() {
                let sign = if side == 0 { -1.0 } else { 1.0 };
                let drop = |distance: f64| -> Result<f64> {
                    let mut offset = vec![0.0; size];
                    offset[axis] = sign * distance;
                    Ok(shifted(&offset)? - peak + 0.5)
                };
                let mut outer = 1e-6;
                while drop(outer)? > 0.0 {
                    outer *= 2.0;
                    if outer > 1e6 {
                        return Err(unsettled());
                    }
                }
                let mut inner = 0.0;
                for _ in 0..60 {
                    let middle = 0.5 * (inner + outer);
                    if drop(middle)? > 0.0 {
                        inner = middle;
                    } else {
                        outer = middle;
                    }
                }
                *reach = outer;
            }
            row[axis] = reaches[0].max(reaches[1]);
        }
        factor
    } else if size == 1 {
        vec![vec![(1.0 / curvature[0][0]).sqrt()]]
    } else {
        let determinant = curvature[0][0] * curvature[1][1] - curvature[0][1] * curvature[1][0];
        let first = curvature[1][1] / determinant;
        let cross = -curvature[0][1] / determinant;
        let second = curvature[0][0] / determinant;
        let lead = first.sqrt();
        let lower = cross / lead;
        vec![vec![lead, 0.0], vec![lower, (second - lower * lower).max(0.0).sqrt()]]
    };
    let place = |whitened: &[f64]| -> Vec<f64> {
        (0..size)
            .map(|row| mode[row] + (0..size).map(|column| factor[row][column] * whitened[column]).sum::<f64>())
            .collect()
    };
    let level = |whitened: &[f64]| -> Result<f64> { Ok(ranked(log_posterior(&place(whitened))?) - peak) };
    let mut reach = vec![[GRID_START_REACH, GRID_START_REACH]; size];
    loop {
        let mut grown = false;
        for axis in 0..size {
            for side in 0..2 {
                let sign = if side == 0 { -1.0 } else { 1.0 };
                let face_high = (0..GRID_FACE_SAMPLES)
                    .map(|sample| {
                        let mut whitened = vec![0.0; size];
                        whitened[axis] = sign * reach[axis][side];
                        if size == 2 {
                            let other = 1 - axis;
                            let fraction = sample as f64 / (GRID_FACE_SAMPLES - 1) as f64;
                            whitened[other] = -reach[other][0] + fraction * (reach[other][0] + reach[other][1]);
                        }
                        level(&whitened)
                    })
                    .collect::<Result<Vec<f64>>>()?
                    .into_iter()
                    .fold(f64::NEG_INFINITY, f64::max);
                if face_high > -GRID_DROP {
                    if reach[axis][side] >= GRID_MAX_REACH {
                        return Err(unsettled());
                    }
                    reach[axis][side] = (1.5 * reach[axis][side]).min(GRID_MAX_REACH);
                    grown = true;
                }
            }
        }
        if !grown {
            break;
        }
    }
    let nodes = if size == 1 { GRID_LINE_NODES } else { GRID_PLANE_NODES };
    let coordinate = |axis: usize, index: usize| -> (f64, f64) {
        let start = -GRID_STRETCH * (reach[axis][0] / GRID_STRETCH).asinh();
        let end = GRID_STRETCH * (reach[axis][1] / GRID_STRETCH).asinh();
        let stretched = start + (end - start) * index as f64 / (nodes - 1) as f64;
        (
            GRID_STRETCH * (stretched / GRID_STRETCH).sinh(),
            (stretched / GRID_STRETCH).cosh(),
        )
    };
    let rows = if size == 1 { 1 } else { nodes };
    let mut grid = Vec::with_capacity(rows);
    for row in 0..rows {
        let mut line = Vec::with_capacity(nodes);
        for index in 0..nodes {
            let parts: Vec<(f64, f64)> = if size == 1 {
                vec![coordinate(0, index)]
            } else {
                vec![coordinate(0, row), coordinate(1, index)]
            };
            let whitened: Vec<f64> = parts.iter().map(|(position, _)| *position).collect();
            let stretch: f64 = parts.iter().map(|(_, slope)| slope).product();
            let point = place(&whitened);
            let weight = (ranked(log_posterior(&point)?) - peak).exp() * stretch;
            let value = output(&point)?;
            line.push((value, if weight.is_finite() { weight } else { 0.0 }));
        }
        grid.push(line);
    }
    Ok(grid)
}

fn log_normal_cdf(x: f64) -> Result<f64> {
    if x > -30.0 {
        return Ok(kernels::normal_cdf(x)?.ln());
    }
    let inverse = 1.0 / (x * x);
    Ok(-0.5 * x * x - (-x).ln() - 0.5 * (2.0 * PI).ln() + (1.0 - inverse + 3.0 * inverse * inverse).ln())
}

struct Slot {
    parameter: DurationParameter,
    fixed: Option<f64>,
    prior: Option<PreparedLaw>,
    bounds: (f64, f64),
}

impl Slot {
    fn new(parameter: DurationParameter, priors: &[DurationPrior]) -> Result<Slot> {
        let Some(prior) = priors.iter().find(|prior| prior.parameter == parameter) else {
            return Ok(Slot {
                parameter,
                fixed: None,
                prior: None,
                bounds: (f64::NEG_INFINITY, f64::INFINITY),
            });
        };
        let law = PreparedLaw::new(&prior.law)?;
        let atoms = law.atoms();
        let (low, high) = prior.law.support();
        let bounds = if parameter.positive() {
            (if low > 0.0 { low.ln() } else { f64::NEG_INFINITY }, high.ln())
        } else {
            (low, high)
        };
        match atoms.as_slice() {
            [] => Ok(Slot {
                parameter,
                fixed: None,
                prior: Some(law),
                bounds,
            }),
            [(value, _)] => {
                if parameter.positive() && *value <= 0.0 {
                    return Err(inference_error(format!("the {} prior must be positive", parameter.label())));
                }
                Ok(Slot {
                    parameter,
                    fixed: Some(*value),
                    prior: None,
                    bounds,
                })
            }
            _ => Err(inference_error(format!(
                "the {} prior must be continuous or a single point",
                parameter.label()
            ))),
        }
    }

    fn natural(&self, free: f64) -> f64 {
        if self.parameter.positive() {
            free.exp()
        } else {
            free
        }
    }

    fn free(&self, natural: f64) -> f64 {
        if self.parameter.positive() {
            natural.ln()
        } else {
            natural
        }
    }

    fn unbounded(&self) -> bool {
        self.bounds.0 == f64::NEG_INFINITY && self.bounds.1 == f64::INFINITY
    }

    fn opened(&self, coordinate: f64) -> (f64, f64) {
        let (low, high) = self.bounds;
        match (low.is_finite(), high.is_finite()) {
            (true, true) => {
                let share = 1.0 / (1.0 + (-coordinate).exp());
                let rest = 1.0 / (1.0 + coordinate.exp());
                (low + (high - low) * share, (high - low).ln() + share.ln() + rest.ln())
            }
            (true, false) => (low + coordinate.exp(), coordinate),
            (false, true) => (high - (-coordinate).exp(), -coordinate),
            (false, false) => (coordinate, 0.0),
        }
    }

    fn closed(&self, free: f64) -> f64 {
        let (low, high) = self.bounds;
        let inside = if low.is_finite() && high.is_finite() {
            free.clamp(low + 1e-9 * (high - low), high - 1e-9 * (high - low))
        } else {
            free
        };
        match (low.is_finite(), high.is_finite()) {
            (true, true) => ((inside - low) / (high - inside)).ln(),
            (true, false) => (inside - low).max(f64::MIN_POSITIVE).ln(),
            (false, true) => -(high - inside).max(f64::MIN_POSITIVE).ln(),
            (false, false) => inside,
        }
    }

    fn log_prior(&self, free: f64) -> Result<f64> {
        let Some(law) = &self.prior else {
            return Ok(0.0);
        };
        let natural = self.natural(free);
        let density = law.density(natural)?;
        Ok(density.ln() + if self.parameter.positive() { free } else { 0.0 })
    }
}

struct DurationData {
    times: Vec<f64>,
    logs: Vec<f64>,
    censored: Vec<f64>,
    censored_logs: Vec<f64>,
    log_sum: f64,
    sum: f64,
}

impl DurationData {
    fn new(times: &[f64], censored: &[f64]) -> DurationData {
        let logs: Vec<f64> = times.iter().map(|time| time.ln()).collect();
        DurationData {
            times: times.to_vec(),
            log_sum: logs.iter().sum(),
            sum: times.iter().sum(),
            logs,
            censored: censored.to_vec(),
            censored_logs: censored.iter().map(|time| time.ln()).collect(),
        }
    }

    fn log_likelihood(&self, model: DurationModel, first: f64, second: f64) -> Result<f64> {
        let count = self.times.len() as f64;
        Ok(match model {
            DurationModel::Lognormal => {
                let (mu, sigma) = (first, second);
                let mut total = -self.log_sum - count * (sigma.ln() + 0.5 * (2.0 * PI).ln());
                for log in &self.logs {
                    let z = (log - mu) / sigma;
                    total -= 0.5 * z * z;
                }
                for log in &self.censored_logs {
                    total += log_normal_cdf(-(log - mu) / sigma)?;
                }
                total
            }
            DurationModel::Weibull => {
                let (shape, scale) = (first, second);
                let mut total = count * (shape.ln() - shape * scale.ln()) + (shape - 1.0) * self.log_sum;
                for time in self.times.iter().chain(self.censored.iter()) {
                    total -= (time / scale).powf(shape);
                }
                total
            }
            DurationModel::Gamma => {
                let (shape, rate) = (first, second);
                let mut total = count * (shape * rate.ln() - kernels::log_gamma(shape)?) + (shape - 1.0) * self.log_sum
                    - rate * self.sum;
                for time in &self.censored {
                    total += kernels::gamma_survival(rate * time, shape)?.ln();
                }
                total
            }
            DurationModel::Exponential => count * first.ln() - first * (self.sum + self.censored.iter().sum::<f64>()),
        })
    }

    fn start(&self, model: DurationModel) -> (f64, f64) {
        let count = self.times.len() as f64;
        let mean_log = self.log_sum / count;
        let spread = if self.logs.len() > 1 {
            (self.logs.iter().map(|log| (log - mean_log).powi(2)).sum::<f64>() / (count - 1.0)).sqrt()
        } else {
            1.0
        };
        let mean = self.sum / count;
        match model {
            DurationModel::Lognormal => (mean_log, spread.max(0.1)),
            DurationModel::Weibull => (1.0, mean),
            DurationModel::Gamma => (1.0, 1.0 / mean),
            DurationModel::Exponential => (1.0 / mean, 1.0),
        }
    }
}

fn duration_log_output(model: DurationModel, output: &DurationOutput, first: f64, second: f64) -> Result<f64> {
    Ok(match (model, output) {
        (DurationModel::Lognormal, DurationOutput::Exceedance { time }) => log_normal_cdf(-(time.ln() - first) / second)?,
        (DurationModel::Lognormal, DurationOutput::Mean) => first + 0.5 * second * second,
        (DurationModel::Weibull, DurationOutput::Exceedance { time }) => -(time / second).powf(first),
        (DurationModel::Weibull, DurationOutput::Mean) => second.ln() + kernels::log_gamma(1.0 + 1.0 / first)?,
        (DurationModel::Gamma, DurationOutput::Exceedance { time }) => kernels::gamma_survival(second * time, first)?.ln(),
        (DurationModel::Gamma, DurationOutput::Mean) => first.ln() - second.ln(),
        (DurationModel::Exponential, DurationOutput::Exceedance { time }) => -first * time,
        (DurationModel::Exponential, DurationOutput::Mean) => -first.ln(),
    })
}

pub(crate) fn duration_atoms(
    model: DurationModel,
    times: &[f64],
    censored: &[f64],
    priors: &[DurationPrior],
    output: &DurationOutput,
) -> Result<Vec<OutputRow>> {
    let slots = model
        .parameters()
        .iter()
        .map(|parameter| Slot::new(*parameter, priors))
        .collect::<Result<Vec<Slot>>>()?;
    let observed = !times.is_empty();
    if !observed && slots.iter().any(|slot| slot.fixed.is_none() && slot.prior.is_none()) {
        return Err(inference_error(
            "a duration law needs a completed time or a prior on each parameter".to_string(),
        ));
    }
    let data = DurationData::new(times, censored);
    let (first_start, second_start) = data.start(model);
    let starts = [first_start, second_start];
    let free: Vec<usize> = (0..slots.len()).filter(|index| slots[*index].fixed.is_none()).collect();
    let location = if model == DurationModel::Lognormal { 0 } else { 1 };
    let spread = &slots[1 - location];
    if free.len() == 2 && spread.prior.is_none() && times.iter().all(|time| *time == times[0]) {
        return Err(inference_error(format!(
            "the {} parameters need two different completed times or a prior on {}",
            model.label(),
            spread.parameter.label()
        )));
    }
    let paired = observed && free.len() == 2 && slots[location].unbounded();
    let count = times.len() as f64;
    let log_center = data.log_sum / count;
    let mean_center = (data.sum + censored.iter().sum::<f64>()) / count;
    let scale_center = |shape: f64| -> f64 {
        (times.iter().chain(censored.iter()).map(|time| time.powf(shape)).sum::<f64>() / count).ln()
    };
    let plain = |point: &[f64]| -> (Vec<f64>, f64) {
        let mut values = vec![0.0; free.len()];
        let mut jacobian = 0.0;
        for (position, index) in free.iter().enumerate() {
            if paired && *index == location {
                continue;
            }
            let (value, part) = slots[*index].opened(point[position]);
            values[position] = value;
            jacobian += part;
        }
        if paired {
            let driver = values[1 - location];
            let (value, part) = match model {
                DurationModel::Lognormal => (log_center + driver.exp() * point[location], driver),
                DurationModel::Weibull => {
                    let shape = driver.exp();
                    ((scale_center(shape) + point[location]) / shape, -driver)
                }
                _ => (driver - mean_center.ln() - point[location] * (-0.5 * driver).exp(), -0.5 * driver),
            };
            values[location] = value;
            jacobian += part;
        }
        (values, jacobian)
    };
    let naturals = |point: &[f64]| -> (Vec<f64>, Vec<f64>, f64) {
        let (free_values, jacobian) = plain(point);
        let mut values = vec![0.0; 2];
        for (index, slot) in slots.iter().enumerate() {
            values[index] = match slot.fixed {
                Some(value) => value,
                None => {
                    let position = free.iter().position(|candidate| *candidate == index).unwrap_or(0);
                    slot.natural(free_values[position])
                }
            };
        }
        (values, free_values, jacobian)
    };
    let log_posterior = |point: &[f64]| -> Result<f64> {
        let (values, free_values, jacobian) = naturals(point);
        if values.iter().take(slots.len()).any(|value| !value.is_finite() || *value == 0.0) || !jacobian.is_finite() {
            return Ok(f64::NEG_INFINITY);
        }
        let mut total = data.log_likelihood(model, values[0], values[1])? + jacobian;
        for (position, index) in free.iter().enumerate() {
            total += slots[*index].log_prior(free_values[position])?;
        }
        Ok(total)
    };
    let plain_start: Vec<f64> = free
        .iter()
        .map(|index| {
            let slot = &slots[*index];
            let natural = match &slot.prior {
                Some(law) if !slot.log_prior(slot.free(starts[*index]))?.is_finite() => law.quantile(0.5)?,
                _ => starts[*index],
            };
            Ok(slot.free(natural))
        })
        .collect::<Result<Vec<f64>>>()?;
    let start: Vec<f64> = free
        .iter()
        .enumerate()
        .map(|(position, index)| {
            if !(paired && *index == location) {
                return slots[*index].closed(plain_start[position]);
            }
            let driver = plain_start[1 - location];
            let value = plain_start[location];
            match model {
                DurationModel::Lognormal => (value - log_center) / driver.exp(),
                DurationModel::Weibull => {
                    let shape = driver.exp();
                    shape * value - scale_center(shape)
                }
                _ => (driver - value - mean_center.ln()) * (0.5 * driver).exp(),
            }
        })
        .collect();
    let subject = format!("{} parameters", model.label());
    grid_atoms(&subject, log_posterior, &start, |point| {
        let (values, _, _) = naturals(point);
        duration_log_output(model, output, values[0], values[1])
    })
}

pub(crate) fn trend_atoms(bins: &[TrendBin], at: f64) -> Result<Vec<OutputRow>> {
    let exposure: f64 = bins.iter().map(|bin| bin.exposure).sum();
    let failures: f64 = bins.iter().map(|bin| bin.failures).sum();
    if failures == 0.0 {
        return Err(inference_error("a trend needs at least one failure".to_string()));
    }
    let center = bins.iter().map(|bin| bin.time * bin.exposure).sum::<f64>() / exposure;
    let log_posterior = |point: &[f64]| -> Result<f64> {
        let mut total = 0.0;
        for bin in bins {
            let log_rate = point[0] + point[1] * (bin.time - center);
            total += power_log(bin.failures, 1.0) * log_rate - bin.exposure * log_rate.exp();
        }
        Ok(total)
    };
    grid_atoms("trend slope", log_posterior, &[(failures / exposure).ln(), 0.0], |point| {
        Ok(point[0] + point[1] * (at - center))
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::core::distribution::{Law, UncertainValue};
    use crate::core::distribution_math::PreparedLaw;
    use crate::core::distribution_operations::scale_law;

    fn law(value: serde_json::Value) -> Law {
        let law: Law = serde_json::from_value(value).unwrap();
        law.check_shape().unwrap();
        law
    }

    fn mean(value: serde_json::Value) -> f64 {
        PreparedLaw::new(&law(value)).unwrap().mean()
    }

    fn close(actual: f64, expected: f64, tolerance: f64) {
        assert!(
            ((actual - expected) / expected).abs() <= tolerance,
            "{actual} against {expected}"
        );
    }

    #[test]
    fn standby_demands_update_the_standby_rate() {
        let test = mean(json!({ "family": "POSTERIOR", "prior": null, "evidence": [
            { "likelihood": "STANDBY_DEMAND", "demand": "TEST", "failures": 1.0, "exposure": 10.0, "testInterval": 720.0 }
        ] }));
        close(test, 0.00021980581003476545, 1e-6);
        let random = mean(json!({ "family": "POSTERIOR", "prior": null, "evidence": [
            { "likelihood": "STANDBY_DEMAND", "demand": "RANDOM", "failures": 1.0, "exposure": 10.0, "testInterval": 720.0 }
        ] }));
        close(random, 0.00047825962825450205, 1e-6);
    }

    #[test]
    fn an_uncertain_zero_or_one_count_updates_a_lognormal_prior() {
        let actual = mean(json!({ "family": "POSTERIOR", "prior": { "family": "TRUNCATED", "law": { "family": "LOGNORMAL", "mean": 0.001, "errorFactor": 5.0, "level": 0.95 }, "lower": null, "upper": 1.0 }, "evidence": [
            { "likelihood": "UNCERTAIN_COUNT", "count": "BINOMIAL", "outcomes": [{ "value": 0.0, "weight": 1.0 }, { "value": 1.0, "weight": 1.0 }], "exposure": 20000.0 }
        ] }));
        close(actual, 0.00012504906550508797, 1e-3);
    }

    #[test]
    fn a_duration_with_no_times_keeps_its_published_priors() {
        let actual = mean(json!({ "family": "DURATION", "model": "LOGNORMAL", "times": [], "censored": [], "priors": [
            { "parameter": "MU", "law": { "family": "NORMAL", "mean": 2.0f64.ln(), "standardDeviation": 0.5 } },
            { "parameter": "SIGMA", "law": { "family": "POINT", "value": 1.0 } }
        ], "output": { "kind": "EXCEEDANCE", "time": 4.0 } }));
        close(actual, 0.26763887255801133, 1e-4);
    }

    #[test]
    fn an_uncertain_count_with_a_gamma_prior_is_a_mixture_of_gamma_posteriors() {
        let (shape, rate, exposure) = (1.0f64, 1000.0f64, 1000.0f64);
        let weight = |count: i32, share: f64| share * exposure.powi(count) / (rate + exposure).powi(1 + count);
        let (one, two) = (weight(1, 0.25), weight(2, 0.75));
        let expected = (one * (shape + 1.0) + two * (shape + 2.0)) / ((one + two) * (rate + exposure));
        let actual = mean(json!({ "family": "POSTERIOR", "prior": { "family": "GAMMA", "shape": shape, "rate": rate }, "evidence": [
            { "likelihood": "UNCERTAIN_COUNT", "count": "POISSON", "outcomes": [{ "value": 1.0, "weight": 1.0 }, { "value": 2.0, "weight": 3.0 }], "exposure": exposure }
        ] }));
        close(actual, expected, 1e-12);
    }

    #[test]
    fn a_jeffreys_posterior_keeps_poisson_exposure_beside_binomial_demands() {
        let actual = mean(json!({ "family": "POSTERIOR", "prior": null, "evidence": [
            { "likelihood": "BINOMIAL", "failures": 1.0, "exposure": 100.0 },
            { "likelihood": "POISSON", "failures": 0.0, "exposure": 50.0 }
        ] }));
        close(actual, 0.009988590692907336, 1e-6);
    }

    #[test]
    fn empirical_bayes_fits_a_gamma_population_by_marginal_likelihood() {
        let evidence = json!([
            { "likelihood": "POISSON", "failures": 0.0, "exposure": 1e4 },
            { "likelihood": "POISSON", "failures": 3.0, "exposure": 2e4 },
            { "likelihood": "POISSON", "failures": 10.0, "exposure": 1.5e4 }
        ]);
        let population = mean(json!({ "family": "EMPIRICAL_BAYES", "evidence": evidence, "target": null }));
        close(population, 0.8678451708741912 / 3125.6619333838144, 1e-6);
        let member = mean(json!({ "family": "EMPIRICAL_BAYES", "evidence": evidence, "target": 1 }));
        close(member, 0.00016725338206603443, 1e-6);
        let flat = law(json!({ "family": "EMPIRICAL_BAYES", "target": null, "evidence": [
            { "likelihood": "POISSON", "failures": 2.0, "exposure": 1e4 },
            { "likelihood": "POISSON", "failures": 2.0, "exposure": 1e4 }
        ] }));
        assert!(PreparedLaw::new(&flat).unwrap_err().to_string().contains("pooled posterior"));
    }

    #[test]
    fn durations_give_exceedance_and_mean_laws() {
        let (shape, rate, failures, exposure, time) = (2.0f64, 10.0f64, 3.0f64, 7.0f64, 4.0f64);
        let exponential = mean(json!({ "family": "DURATION", "model": "EXPONENTIAL", "times": [1.0, 2.0, 3.0], "censored": [1.0],
            "priors": [{ "parameter": "RATE", "law": { "family": "GAMMA", "shape": shape, "rate": rate } }],
            "output": { "kind": "EXCEEDANCE", "time": time } }));
        close(exponential, ((rate + exposure) / (rate + exposure + time)).powf(shape + failures), 1e-12);
        let logs = [1.0f64, 2.0, 4.0, 8.0].map(f64::ln);
        let sigma = 0.8f64;
        let center = logs.iter().sum::<f64>() / 4.0;
        let spread = (sigma * sigma * 1.25).sqrt();
        let expected = crate::core::special_functions::normal_cdf(-(10.0f64.ln() - center) / spread).unwrap();
        let lognormal = mean(json!({ "family": "DURATION", "model": "LOGNORMAL", "times": [1.0, 2.0, 4.0, 8.0], "censored": [],
            "priors": [{ "parameter": "SIGMA", "law": { "family": "POINT", "value": sigma } }],
            "output": { "kind": "EXCEEDANCE", "time": 10.0 } }));
        close(lognormal, expected, 1e-4);
    }

    #[test]
    fn a_trend_reports_the_loglinear_rate_at_a_time() {
        let actual = mean(json!({ "family": "TREND", "at": 5.0, "bins": [
            { "time": 1.0, "failures": 2.0, "exposure": 1.0 },
            { "time": 2.0, "failures": 3.0, "exposure": 1.0 },
            { "time": 3.0, "failures": 6.0, "exposure": 1.0 },
            { "time": 4.0, "failures": 8.0, "exposure": 1.0 }
        ] }));
        close(actual, 14.921812660961088, 1e-4);
    }

    #[test]
    fn every_law_scales() {
        let binomial = law(json!({ "family": "POSTERIOR", "prior": { "family": "BETA", "alpha": 1.0, "beta": 9.0, "lower": 0.0, "upper": 1.0 },
            "evidence": [{ "likelihood": "BINOMIAL", "failures": 2.0, "exposure": 40.0 }] }));
        assert_eq!(
            scale_law(&binomial, 2.0).unwrap(),
            law(json!({ "family": "BETA", "alpha": 3.0, "beta": 47.0, "lower": 0.0, "upper": 2.0 }))
        );
        let logit = law(json!({ "family": "LOGIT_NORMAL", "mu": -4.0, "sigma": 0.5 }));
        let scaled = PreparedLaw::new(&scale_law(&logit, 3.0).unwrap()).unwrap().mean();
        close(scaled, 3.0 * PreparedLaw::new(&logit).unwrap().mean(), 1e-12);
        let value: UncertainValue = serde_json::from_value(json!({ "unit": "PER_HOUR", "law": { "family": "DURATION", "model": "EXPONENTIAL",
            "times": [1.0], "censored": [], "priors": [], "output": { "kind": "EXCEEDANCE", "time": 1.0 } } })).unwrap();
        assert!(value.check_meaning().is_err());
    }

    fn gamma_lognormal(rate: f64) -> serde_json::Value {
        json!({ "family": "PRODUCT", "factors": [
            { "family": "GAMMA", "shape": 2.0, "rate": rate },
            { "family": "LOGNORMAL", "mean": 1.0, "errorFactor": 3.0, "level": 0.95 }
        ] })
    }

    #[test]
    fn a_product_of_a_gamma_and_a_lognormal_matches_the_exact_law() {
        let prepared = PreparedLaw::new(&law(gamma_lognormal(1000.0))).unwrap();
        close(prepared.mean(), 2e-3, 1e-12);
        close(prepared.quantile(0.95).unwrap(), 6.134363913302e-3, 1e-4);
    }

    #[test]
    fn a_bayes_update_takes_a_product_prior() {
        let actual = mean(json!({ "family": "POSTERIOR", "prior": gamma_lognormal(1500.0),
            "evidence": [{ "likelihood": "POISSON", "failures": 3.0, "exposure": 800.0 }] }));
        close(actual, 2.526324555436e-3, 1e-4);
    }
}
