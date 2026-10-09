use std::cmp::Ordering;

use serde_json::Value;

use crate::core::distribution::{
    AleatoryVariable, Law, QuantilePoint, TabulatedScale, UncertainParameter, UncertainUnit,
    UncertainVectorParameter,
};
use crate::core::distribution_math::{kronrod_collect, Axis, PreparedLaw, Spot, NUMERIC_TOLERANCE};
use crate::core::distribution_sampling::{require_probability, SamplingPlan, UncertaintyProgram};
use crate::core::special_functions as kernels;
use crate::expression::Expr;
use crate::{PraxisError, Result};

const MAX_SAMPLES: usize = 1_000_000;
const MAX_CURVE_POINTS: usize = 1001;
const LAW_POINTS: usize = 101;
const CURVE_RANGE: (f64, f64) = (0.001, 0.999);
const BREAKPOINTS: [f64; 10] = [1e-15, 1e-12, 1e-9, 1e-6, 1e-4, 0.001, 0.01, 0.05, 0.1, 0.25];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IntegrationMethod {
    PointBoth,
    PointLoad,
    PointCapacity,
    ClosedFormLognormal,
    ClosedFormNormal,
    Quadrature,
}

impl IntegrationMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            IntegrationMethod::PointBoth => "POINT_BOTH",
            IntegrationMethod::PointLoad => "POINT_LOAD",
            IntegrationMethod::PointCapacity => "POINT_CAPACITY",
            IntegrationMethod::ClosedFormLognormal => "CLOSED_FORM_LOGNORMAL",
            IntegrationMethod::ClosedFormNormal => "CLOSED_FORM_NORMAL",
            IntegrationMethod::Quadrature => "QUADRATURE",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct LoadCapacityModel {
    pub load: AleatoryVariable,
    pub capacity: AleatoryVariable,
    pub uncertainty_parameters: Vec<UncertainParameter>,
    pub uncertainty_vectors: Vec<UncertainVectorParameter>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LoadCapacitySettings {
    pub plan: SamplingPlan,
    pub curve_points: usize,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FailureProbability {
    pub probability: f64,
    pub method: IntegrationMethod,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SampleSummary {
    pub mean: f64,
    pub standard_deviation: f64,
    pub p05: f64,
    pub p50: f64,
    pub p95: f64,
    pub minimum: f64,
    pub maximum: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct LoadCapacityUncertainty {
    pub plan: SamplingPlan,
    pub summary: SampleSummary,
    pub law: Law,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CurvePoint {
    pub load: f64,
    pub probability: f64,
    pub band: Option<SampleSummary>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct LoadCapacityResult {
    pub point: FailureProbability,
    pub load: Law,
    pub capacity: Law,
    pub uncertainty: Option<LoadCapacityUncertainty>,
    pub curve: Vec<CurvePoint>,
}

fn invalid(message: String) -> PraxisError {
    PraxisError::Settings(message)
}

fn prepared(law: &Law, side: &str) -> Result<PreparedLaw> {
    law.check_shape()
        .and_then(|_| law.check_meaning())
        .and_then(|_| PreparedLaw::new(law))
        .map_err(|error| invalid(format!("the {side} law is not valid: {error}")))
}

fn strictly_below(law: &PreparedLaw, x: f64) -> Result<f64> {
    let tied: f64 = law
        .atoms()
        .iter()
        .filter(|(value, _)| *value == x)
        .map(|(_, mass)| mass)
        .sum();
    Ok(law.cdf(x)? - tied)
}

fn lognormal_parameters(mean: f64, error_factor: f64, level: f64) -> Result<(f64, f64)> {
    let sigma = error_factor.ln() / kernels::normal_quantile(level)?;
    Ok((mean.ln() - 0.5 * sigma * sigma, sigma))
}

fn exact(probability: f64, method: IntegrationMethod) -> FailureProbability {
    FailureProbability {
        probability,
        method,
    }
}

pub fn failure_probability(load: &Law, capacity: &Law) -> Result<FailureProbability> {
    let load_law = prepared(load, "load")?;
    let capacity_law = prepared(capacity, "capacity")?;
    let result = match (load, capacity) {
        (Law::Point { value: x }, Law::Point { value: c }) => {
            exact(if c < x { 1.0 } else { 0.0 }, IntegrationMethod::PointBoth)
        }
        (_, Law::Point { value }) => exact(load_law.survival(*value)?, IntegrationMethod::PointCapacity),
        (Law::Point { value }, _) => exact(strictly_below(&capacity_law, *value)?, IntegrationMethod::PointLoad),
        (
            Law::Lognormal {
                mean: load_mean,
                error_factor: load_factor,
                level: load_level,
            },
            Law::Lognormal {
                mean: capacity_mean,
                error_factor: capacity_factor,
                level: capacity_level,
            },
        ) => {
            let (load_mu, load_sigma) = lognormal_parameters(*load_mean, *load_factor, *load_level)?;
            let (capacity_mu, capacity_sigma) =
                lognormal_parameters(*capacity_mean, *capacity_factor, *capacity_level)?;
            let z = (load_mu - capacity_mu) / load_sigma.hypot(capacity_sigma);
            exact(kernels::normal_cdf(z)?, IntegrationMethod::ClosedFormLognormal)
        }
        (
            Law::Normal {
                mean: load_mean,
                standard_deviation: load_deviation,
            },
            Law::Normal {
                mean: capacity_mean,
                standard_deviation: capacity_deviation,
            },
        ) => {
            let z = (load_mean - capacity_mean) / load_deviation.hypot(*capacity_deviation);
            exact(kernels::normal_cdf(z)?, IntegrationMethod::ClosedFormNormal)
        }
        _ => exact(quadrature(&load_law, &capacity_law)?, IntegrationMethod::Quadrature),
    };
    require_probability("the failure probability", None, result.probability)?;
    Ok(result)
}

pub fn integrate_numerically(load: &Law, capacity: &Law) -> Result<f64> {
    quadrature(&prepared(load, "load")?, &prepared(capacity, "capacity")?)
}

fn spot_order(left: &Spot, right: &Spot) -> Ordering {
    if left.value >= 0.5 && right.value >= 0.5 {
        right.complement.total_cmp(&left.complement)
    } else {
        left.value.total_cmp(&right.value)
    }
}

fn quadrature(load: &PreparedLaw, capacity: &PreparedLaw) -> Result<f64> {
    let resolution = f64::MIN_POSITIVE / f64::EPSILON;
    let mut breaks = vec![Spot::unit(0.0, 1.0), Spot::unit(0.5, 0.5), Spot::unit(1.0, 0.0)];
    let mut locations: Vec<f64> = capacity.atoms().iter().map(|(value, _)| *value).collect();
    for probability in BREAKPOINTS {
        breaks.push(Spot::unit(probability, 1.0 - probability));
        breaks.push(Spot::unit(1.0 - probability, probability));
        locations.push(capacity.quantile_pair(probability, 1.0 - probability)?);
        locations.push(capacity.quantile_pair(1.0 - probability, probability)?);
    }
    for location in locations {
        breaks.push(Spot::unit(load.cdf(location)?, load.survival(location)?));
    }
    let mut cumulative = 0.0;
    for (_, mass) in load.atoms() {
        cumulative += mass;
        breaks.push(Spot::unit(cumulative, 1.0 - cumulative));
    }
    breaks.retain(|spot| {
        spot.value.is_finite()
            && spot.complement.is_finite()
            && (spot.value == 0.0 || spot.complement == 0.0 || (spot.value > resolution && spot.complement > resolution))
    });
    breaks.sort_by(spot_order);
    breaks.dedup_by(|later, earlier| spot_order(later, earlier) == Ordering::Equal);
    let nodes = kronrod_collect(Axis::Unit, &breaks, NUMERIC_TOLERANCE, |spot| {
        let x = load.quantile_pair(spot.value, spot.complement)?;
        Ok((strictly_below(capacity, x)?, ()))
    })
    .map_err(|error| invalid(format!("the failure probability integral cannot be evaluated: {error}")))?;
    Ok(nodes.iter().map(|(weight, value, _)| weight * value).sum())
}

fn percentile(sorted: &[f64], probability: f64) -> f64 {
    let position = (sorted.len() - 1) as f64 * probability;
    let lower = position.floor() as usize;
    let upper = (lower + 1).min(sorted.len() - 1);
    let fraction = position - lower as f64;
    sorted[lower] + fraction * (sorted[upper] - sorted[lower])
}

pub fn summarize(values: &[f64]) -> Result<SampleSummary> {
    if values.len() < 2 {
        return Err(invalid("at least two samples are needed".to_string()));
    }
    let count = values.len() as f64;
    let mean = values.iter().sum::<f64>() / count;
    let variance = values.iter().map(|value| (value - mean) * (value - mean)).sum::<f64>() / (count - 1.0);
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    Ok(SampleSummary {
        mean,
        standard_deviation: variance.sqrt(),
        p05: percentile(&sorted, 0.05),
        p50: percentile(&sorted, 0.5),
        p95: percentile(&sorted, 0.95),
        minimum: sorted[0],
        maximum: sorted[sorted.len() - 1],
    })
}

pub fn tabulated_law(values: &[f64]) -> Result<Law> {
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let law = Law::Tabulated {
        points: (0..LAW_POINTS)
            .map(|index| {
                let probability = index as f64 / (LAW_POINTS - 1) as f64;
                QuantilePoint {
                    probability,
                    value: percentile(&sorted, probability),
                }
            })
            .collect(),
        scale: TabulatedScale::Linear,
    };
    law.check_shape()?;
    Ok(law)
}

struct Side<'a> {
    name: &'static str,
    variable: &'a AleatoryVariable,
    targets: Vec<Expr>,
}

impl Side<'_> {
    fn law(&self, values: &[f64], place: &str) -> Result<Law> {
        let mut json = serde_json::to_value(&self.variable.law)
            .map_err(|error| PraxisError::Serialization(error.to_string()))?;
        for (entry, value) in self.variable.fields.iter().zip(values) {
            let (holder, field) = match entry.field.strip_prefix("law.") {
                Some(inner) => (json.get_mut("law"), inner),
                None => (Some(&mut json), entry.field.as_str()),
            };
            let slot = holder
                .and_then(|holder| holder.get_mut(field))
                .filter(|slot| slot.is_number())
                .ok_or_else(|| {
                    invalid(format!(
                        "the {} law has no numeric field '{}'",
                        self.name, entry.field
                    ))
                })?;
            *slot = serde_json::Number::from_f64(*value).map(Value::Number).ok_or_else(|| {
                invalid(format!(
                    "the {} field '{}' is {} in {}, not a finite number",
                    self.name, entry.field, value, place
                ))
            })?;
        }
        let law: Law = serde_json::from_value(json)
            .map_err(|error| PraxisError::Serialization(error.to_string()))?;
        law.check_shape()
            .and_then(|_| law.check_meaning())
            .map_err(|error| invalid(format!("the {} law in {} is not valid: {}", self.name, place, error)))?;
        Ok(law)
    }
}

fn curve_grid(load: &Law, capacity: &Law, points: usize) -> Result<Vec<f64>> {
    let (low, high) = match (load, capacity) {
        (Law::Point { value: x }, Law::Point { value: c }) => (x.min(*c), x.max(*c)),
        (Law::Point { .. }, other) | (other, _) => {
            let law = PreparedLaw::new(other)?;
            (law.quantile(CURVE_RANGE.0)?, law.quantile(CURVE_RANGE.1)?)
        }
    };
    if !(low.is_finite() && high.is_finite()) {
        return Err(invalid("the load range for the failure curve is not finite".to_string()));
    }
    Ok((0..points)
        .map(|index| low + (high - low) * index as f64 / (points - 1) as f64)
        .collect())
}

pub fn analyze(model: &LoadCapacityModel, settings: &LoadCapacitySettings) -> Result<LoadCapacityResult> {
    if settings.curve_points < 2 || settings.curve_points > MAX_CURVE_POINTS {
        return Err(invalid(format!("curve points must be between 2 and {MAX_CURVE_POINTS}")));
    }
    model.load.check_shape()?;
    model.capacity.check_shape()?;
    let table = &model.uncertainty_parameters;
    let program = UncertaintyProgram::from_table(table)?.with_vectors(&model.uncertainty_vectors)?;
    let mut sides = Vec::with_capacity(2);
    for (name, variable) in [("load", &model.load), ("capacity", &model.capacity)] {
        let targets = variable
            .fields
            .iter()
            .map(|entry| {
                UncertaintyProgram::target(
                    table,
                    &entry.value,
                    &format!("{}:{}", name, entry.field),
                    UncertainUnit::Quantity,
                )
            })
            .collect::<Result<Vec<Expr>>>()?;
        sides.push(Side {
            name,
            variable,
            targets,
        });
    }
    let points = sides
        .iter()
        .map(|side| {
            let values = side
                .targets
                .iter()
                .map(|target| program.point(target))
                .collect::<Result<Vec<f64>>>()?;
            side.law(&values, "the point value")
        })
        .collect::<Result<Vec<Law>>>()?;
    let (load, capacity) = (points[0].clone(), points[1].clone());
    let point = failure_probability(&load, &capacity)?;
    let grid = curve_grid(&load, &capacity, settings.curve_points)?;
    let nominal = PreparedLaw::new(&capacity)?;
    let nominal_curve = grid
        .iter()
        .map(|x| nominal.cdf(*x))
        .collect::<Result<Vec<f64>>>()?;
    if sides.iter().all(|side| side.targets.is_empty()) {
        return Ok(LoadCapacityResult {
            point,
            load,
            capacity,
            uncertainty: None,
            curve: grid
                .iter()
                .zip(nominal_curve)
                .map(|(x, probability)| CurvePoint {
                    load: *x,
                    probability,
                    band: None,
                })
                .collect(),
        });
    }
    if settings.plan.trials < 2 || settings.plan.trials > MAX_SAMPLES {
        return Err(invalid(format!("samples must be between 2 and {MAX_SAMPLES}")));
    }
    let targets: Vec<&Expr> = sides.iter().flat_map(|side| side.targets.iter()).collect();
    let columns = program.sample(&targets, &settings.plan)?;
    let split = sides[0].targets.len();
    let mut probabilities = Vec::with_capacity(settings.plan.trials);
    let mut curve_values = vec![Vec::with_capacity(settings.plan.trials); grid.len()];
    for trial in 0..settings.plan.trials {
        let values: Vec<f64> = columns.iter().map(|column| column[trial]).collect();
        let place = format!("trial {}", trial + 1);
        let sampled_load = sides[0].law(&values[..split], &place)?;
        let sampled_capacity = sides[1].law(&values[split..], &place)?;
        let probability = failure_probability(&sampled_load, &sampled_capacity)?.probability;
        require_probability("the failure probability", Some(trial), probability)?;
        probabilities.push(probability);
        let capacity_law = PreparedLaw::new(&sampled_capacity)?;
        for (values, x) in curve_values.iter_mut().zip(&grid) {
            values.push(capacity_law.cdf(*x)?);
        }
    }
    let curve = grid
        .iter()
        .zip(nominal_curve)
        .zip(&curve_values)
        .map(|((x, probability), values)| {
            Ok(CurvePoint {
                load: *x,
                probability,
                band: Some(summarize(values)?),
            })
        })
        .collect::<Result<Vec<CurvePoint>>>()?;
    Ok(LoadCapacityResult {
        point,
        load,
        capacity,
        uncertainty: Some(LoadCapacityUncertainty {
            plan: settings.plan,
            summary: summarize(&probabilities)?,
            law: tabulated_law(&probabilities)?,
        }),
        curve,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::distribution::{
        ParameterReference, ParameterReferenceType, UncertainExpression, UncertainLawField,
        UncertainValue,
    };
    use crate::core::distribution_math::NORMAL_QUANTILE_95;
    use crate::core::distribution_sampling::SamplingMethod;

    fn lognormal(median: f64, error_factor: f64) -> Law {
        let sigma = error_factor.ln() / NORMAL_QUANTILE_95;
        Law::Lognormal {
            mean: median * (0.5 * sigma * sigma).exp(),
            error_factor,
            level: 0.95,
        }
    }

    fn sigma(error_factor: f64) -> f64 {
        error_factor.ln() / NORMAL_QUANTILE_95
    }

    fn relative(a: f64, b: f64) -> f64 {
        ((a - b) / b).abs()
    }

    fn quantity(law: Law) -> UncertainExpression {
        UncertainExpression::Value {
            value: UncertainValue {
                unit: UncertainUnit::Quantity,
                law,
            },
        }
    }

    fn fixed(law: Law) -> AleatoryVariable {
        AleatoryVariable { law, fields: Vec::new() }
    }

    fn with_field(law: Law, field: &str, value: UncertainExpression) -> AleatoryVariable {
        AleatoryVariable {
            law,
            fields: vec![UncertainLawField {
                field: field.to_string(),
                value,
            }],
        }
    }

    fn settings(method: SamplingMethod, trials: usize, seed: u64, curve_points: usize) -> LoadCapacitySettings {
        LoadCapacitySettings {
            plan: SamplingPlan { method, trials, seed },
            curve_points,
        }
    }

    fn model(load: AleatoryVariable, capacity: AleatoryVariable) -> LoadCapacityModel {
        LoadCapacityModel {
            load,
            capacity,
            uncertainty_parameters: Vec::new(),
            uncertainty_vectors: Vec::new(),
        }
    }

    fn normal_cdf(z: f64) -> f64 {
        kernels::normal_cdf(z).unwrap()
    }

    #[test]
    fn closed_forms_and_point_sides_match_their_formulas() {
        let result = failure_probability(&lognormal(30.0, 1.5), &lognormal(48.0, 1.2)).unwrap();
        let z = (30.0_f64.ln() - 48.0_f64.ln()) / sigma(1.5).hypot(sigma(1.2));
        assert_eq!(result.method, IntegrationMethod::ClosedFormLognormal);
        assert!(relative(result.probability, normal_cdf(z)) < 1e-12);

        let normal = failure_probability(
            &Law::Normal { mean: 10.0, standard_deviation: 2.0 },
            &Law::Normal { mean: 16.0, standard_deviation: 1.5 },
        )
        .unwrap();
        assert_eq!(normal.method, IntegrationMethod::ClosedFormNormal);
        assert!(relative(normal.probability, normal_cdf(-6.0 / 2.5)) < 1e-15);

        let point_load = failure_probability(&Law::Point { value: 40.0 }, &lognormal(48.0, 1.2)).unwrap();
        assert_eq!(point_load.method, IntegrationMethod::PointLoad);
        let z = (40.0_f64.ln() - 48.0_f64.ln()) / sigma(1.2);
        assert!(relative(point_load.probability, normal_cdf(z)) < 1e-9);

        let point_capacity = failure_probability(&lognormal(30.0, 1.5), &Law::Point { value: 48.0 }).unwrap();
        assert_eq!(point_capacity.method, IntegrationMethod::PointCapacity);
        let z = (48.0_f64.ln() - 30.0_f64.ln()) / sigma(1.5);
        assert!(relative(point_capacity.probability, normal_cdf(-z)) < 1e-9);

        let both = failure_probability(&Law::Point { value: 2.0 }, &Law::Point { value: 1.0 }).unwrap();
        assert_eq!((both.probability, both.method), (1.0, IntegrationMethod::PointBoth));
        let tie = failure_probability(&Law::Point { value: 2.0 }, &Law::Point { value: 2.0 }).unwrap();
        assert_eq!(tie.probability, 0.0);
        let discrete = Law::Discrete {
            outcomes: vec![
                crate::core::distribution::DiscreteOutcome { value: 1.0, weight: 1.0 },
                crate::core::distribution::DiscreteOutcome { value: 2.0, weight: 3.0 },
            ],
        };
        let strict = failure_probability(&Law::Point { value: 2.0 }, &discrete).unwrap();
        assert!((strict.probability - 0.25).abs() < 1e-15);
    }

    #[test]
    fn quadrature_reproduces_the_closed_forms_into_the_far_tail() {
        for (load, capacity) in [
            (lognormal(30.0, 1.5), lognormal(48.0, 1.2)),
            (lognormal(10.0, 2.0), lognormal(200.0, 1.5)),
            (lognormal(1.0, 1.3), lognormal(30.0, 1.4)),
        ] {
            let exact = failure_probability(&load, &capacity).unwrap().probability;
            let numeric = integrate_numerically(&load, &capacity).unwrap();
            assert!(relative(numeric, exact) < NUMERIC_TOLERANCE, "{numeric} vs {exact}");
        }
        let load = Law::Normal { mean: 10.0, standard_deviation: 2.0 };
        let capacity = Law::Normal { mean: 30.0, standard_deviation: 3.0 };
        let exact = failure_probability(&load, &capacity).unwrap().probability;
        let numeric = integrate_numerically(&load, &capacity).unwrap();
        assert!(exact < 1e-7);
        assert!(relative(numeric, exact) < NUMERIC_TOLERANCE, "{numeric} vs {exact}");
        let weibull = failure_probability(
            &lognormal(30.0, 1.5),
            &Law::Weibull { scale: 50.0, shape: 6.0, location: 0.0 },
        )
        .unwrap();
        assert_eq!(weibull.method, IntegrationMethod::Quadrature);
        assert!(weibull.probability > 0.0 && weibull.probability < 1.0);
    }

    #[test]
    fn sampled_mean_converges_to_the_epistemic_expectation() {
        let capacity = with_field(lognormal(48.0, 1.2), "mean", quantity(lognormal(lognormal_mean(48.0, 1.2), 1.6)));
        let study = model(fixed(lognormal(30.0, 1.5)), capacity);
        let z = (30.0_f64.ln() - 48.0_f64.ln()) / (sigma(1.5).powi(2) + sigma(1.2).powi(2) + sigma(1.6).powi(2)).sqrt();
        let expected = normal_cdf(z);
        for method in [SamplingMethod::MonteCarlo, SamplingMethod::LatinHypercube] {
            let result = analyze(&study, &settings(method, 20_000, 847, 21)).unwrap();
            let uncertainty = result.uncertainty.unwrap();
            let standard_error = uncertainty.summary.standard_deviation / 20_000f64.sqrt();
            assert!((uncertainty.summary.mean - expected).abs() < 5.0 * standard_error, "{method:?}");
            assert!(uncertainty.summary.p05 <= uncertainty.summary.p50 && uncertainty.summary.p50 <= uncertainty.summary.p95);
            assert_eq!(result.curve.len(), 21);
            let Law::Tabulated { points, scale } = &uncertainty.law else {
                panic!("a tabulated law is expected");
            };
            assert_eq!(*scale, TabulatedScale::Linear);
            assert_eq!(points.len(), 101);
            assert_eq!(points[50].probability, 0.5);
            assert!((points[50].value - uncertainty.summary.p50).abs() <= 1e-15);
            assert_eq!(points[0].value, uncertainty.summary.minimum);
            assert_eq!(points[100].value, uncertainty.summary.maximum);
        }
    }

    fn lognormal_mean(median: f64, error_factor: f64) -> f64 {
        let Law::Lognormal { mean, .. } = lognormal(median, error_factor) else {
            panic!("lognormal expected");
        };
        mean
    }

    fn reference(entity: &str) -> ParameterReference {
        ParameterReference {
            reference_type: ParameterReferenceType::WorkbookParameter,
            workbook_id: "esq".to_string(),
            entity_id: entity.to_string(),
        }
    }

    #[test]
    fn a_shared_parameter_moves_both_sides_together_and_seeds_repeat() {
        let shared = UncertainExpression::Parameter { reference: reference("median") };
        let mut study = model(
            with_field(Law::Normal { mean: 30.0, standard_deviation: 3.0 }, "mean", shared.clone()),
            with_field(Law::Normal { mean: 30.0, standard_deviation: 4.0 }, "mean", shared),
        );
        study.uncertainty_parameters = vec![UncertainParameter {
            reference: reference("median"),
            expression: quantity(Law::Uniform { lower: 20.0, upper: 40.0 }),
        }];
        let plan = settings(SamplingMethod::LatinHypercube, 200, 7, 5);
        let first = analyze(&study, &plan).unwrap();
        let second = analyze(&study, &plan).unwrap();
        assert_eq!(first, second);
        let summary = first.uncertainty.unwrap().summary;
        assert!((summary.maximum - summary.minimum).abs() < 1e-15);
        assert!((summary.mean - 0.5).abs() < 1e-15);
        study.capacity.fields[0].value = quantity(Law::Uniform { lower: 20.0, upper: 40.0 });
        let apart = analyze(&study, &plan).unwrap().uncertainty.unwrap().summary;
        assert!(apart.maximum - apart.minimum > 0.5);
    }

    #[test]
    fn truncated_inner_fields_are_set_by_name() {
        let capacity = with_field(
            Law::Truncated {
                law: Box::new(Law::Normal { mean: 50.0, standard_deviation: 5.0 }),
                lower: Some(0.0),
                upper: None,
            },
            "law.mean",
            quantity(Law::Uniform { lower: 45.0, upper: 55.0 }),
        );
        let result = analyze(&model(fixed(Law::Point { value: 40.0 }), capacity), &settings(SamplingMethod::MonteCarlo, 400, 3, 5)).unwrap();
        assert_eq!(result.point.method, IntegrationMethod::PointLoad);
        let Law::Truncated { law, .. } = &result.capacity else {
            panic!("a truncated capacity is expected");
        };
        assert_eq!(**law, Law::Normal { mean: 50.0, standard_deviation: 5.0 });
        let summary = result.uncertainty.unwrap().summary;
        assert!(summary.minimum < summary.maximum);
    }

    #[test]
    fn rejects_invalid_laws_fields_and_draws() {
        assert!(failure_probability(&Law::Lognormal { mean: -1.0, error_factor: 1.5, level: 0.95 }, &lognormal(48.0, 1.2)).is_err());
        assert!(failure_probability(&lognormal(30.0, 1.5), &Law::Lognormal { mean: 48.0, error_factor: 0.5, level: 0.95 }).is_err());
        let plan = settings(SamplingMethod::MonteCarlo, 50, 1, 5);
        let unknown = model(with_field(lognormal(30.0, 1.5), "median", quantity(Law::Point { value: 3.0 })), fixed(lognormal(48.0, 1.2)));
        assert!(analyze(&unknown, &plan).unwrap_err().to_string().contains("no numeric field 'median'"));
        let negative = model(
            fixed(lognormal(30.0, 1.5)),
            with_field(lognormal(48.0, 1.2), "mean", quantity(Law::Normal { mean: 40.0, standard_deviation: 30.0 })),
        );
        let error = analyze(&negative, &plan).unwrap_err().to_string();
        assert!(error.contains("capacity law in trial"), "{error}");
        let timed = model(
            fixed(lognormal(30.0, 1.5)),
            with_field(
                lognormal(48.0, 1.2),
                "mean",
                UncertainExpression::Value {
                    value: UncertainValue { unit: UncertainUnit::Hours, law: Law::Point { value: 40.0 } },
                },
            ),
        );
        assert!(analyze(&timed, &plan).is_err());
    }
}
