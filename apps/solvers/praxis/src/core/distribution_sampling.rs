use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::{Arc, Mutex};

use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;
use rand_distr::{Distribution, Gamma};
use serde::{Deserialize, Serialize};

use crate::core::distribution::{
    expression_time_power, validate_parameter_table, ComponentModel, Law, ParameterReference,
    UncertainExpression, UncertainOperation, UncertainParameter, UncertainUnit, UncertainVector,
    UncertainVectorParameter, VectorLaw,
};
use crate::core::distribution_math::{open_unit_pair, PreparedLaw};
use crate::core::special_functions as kernels;
use crate::error::MefError;
use crate::expression::{component_key, EvalContext, Expr};
use crate::quantitative::DEFAULT_HOURS_PER_YEAR;
use crate::{PraxisError, Result};

const MINUTES_PER_HOUR: f64 = 60.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SamplingMethod {
    MonteCarlo,
    LatinHypercube,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SamplingPlan {
    pub method: SamplingMethod,
    pub trials: usize,
    pub seed: u64,
}

pub fn stream_seed(seed: u64, key: &str) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in key.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    let mut mixed = seed ^ hash;
    mixed = (mixed ^ (mixed >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    mixed = (mixed ^ (mixed >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    mixed ^ (mixed >> 31)
}

pub fn draw_law(key: &str, law: &PreparedLaw, plan: &SamplingPlan) -> Result<Vec<f64>> {
    let mut rng = ChaCha8Rng::seed_from_u64(stream_seed(plan.seed, key));
    match plan.method {
        SamplingMethod::MonteCarlo => (0..plan.trials).map(|_| law.draw(&mut rng)).collect(),
        SamplingMethod::LatinHypercube => law.quantile_pairs(&stratified_pairs(&mut rng, plan.trials)),
    }
}

fn stratified_pairs(rng: &mut ChaCha8Rng, trials: usize) -> Vec<(f64, f64)> {
    let mut strata: Vec<usize> = (0..trials).collect();
    for index in (1..trials).rev() {
        let other = rng.gen_range(0..=index);
        strata.swap(index, other);
    }
    let count = trials as f64;
    strata
        .into_iter()
        .map(|stratum| {
            let (inside, inside_complement) = open_unit_pair(rng);
            let u = (stratum as f64 + inside) / count;
            let one_minus_u = ((trials - 1 - stratum) as f64 + inside_complement) / count;
            (u, one_minus_u)
        })
        .collect()
}

fn log_gamma_quantile(u: f64, one_minus_u: f64, shape: f64) -> Result<f64> {
    let value = if u > 0.5 {
        kernels::gamma_inverse_survival(one_minus_u, shape)?
    } else {
        kernels::gamma_quantile(u, shape)?
    };
    if value > 0.0 {
        return Ok(value.ln());
    }
    Ok((u.ln() + kernels::log_gamma(shape + 1.0)?) / shape)
}

fn normalized_logs(logs: &[f64]) -> Result<Vec<f64>> {
    let top = logs.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    if !top.is_finite() {
        return Err(PraxisError::Logic(
            "a Dirichlet draw has no finite component".to_string(),
        ));
    }
    let weights: Vec<f64> = logs.iter().map(|log| (log - top).exp()).collect();
    let total: f64 = weights.iter().sum();
    Ok(weights.into_iter().map(|weight| weight / total).collect())
}

fn gamma_generator(shape: f64) -> Result<Gamma<f64>> {
    Gamma::new(shape, 1.0)
        .map_err(|error| PraxisError::Logic(format!("a Dirichlet draw cannot be made: {}", error)))
}

pub fn draw_vector(key: &str, law: &VectorLaw, plan: &SamplingPlan) -> Result<Vec<Vec<f64>>> {
    law.check_shape()?;
    let concentrations = match law {
        VectorLaw::Fixed { values } => {
            return Ok(values.iter().map(|value| vec![*value; plan.trials]).collect());
        }
        VectorLaw::Dirichlet { concentrations } => concentrations,
    };
    let mut logs = vec![vec![f64::NEG_INFINITY; concentrations.len()]; plan.trials];
    match plan.method {
        SamplingMethod::MonteCarlo => {
            let mut rng = ChaCha8Rng::seed_from_u64(stream_seed(plan.seed, key));
            let generators = concentrations
                .iter()
                .map(|value| if *value > 0.0 { gamma_generator(value + 1.0).map(Some) } else { Ok(None) })
                .collect::<Result<Vec<Option<Gamma<f64>>>>>()?;
            for row in logs.iter_mut() {
                for (component, generator) in generators.iter().enumerate() {
                    if let Some(generator) = generator {
                        let draw = generator.sample(&mut rng);
                        let (u, _) = open_unit_pair(&mut rng);
                        row[component] = draw.ln() + u.ln() / concentrations[component];
                    }
                }
            }
        }
        SamplingMethod::LatinHypercube => {
            for (component, concentration) in concentrations.iter().enumerate() {
                if *concentration <= 0.0 {
                    continue;
                }
                let mut rng = ChaCha8Rng::seed_from_u64(stream_seed(plan.seed, &component_key(key, component)));
                for (trial, (u, one_minus_u)) in stratified_pairs(&mut rng, plan.trials).into_iter().enumerate() {
                    logs[trial][component] = log_gamma_quantile(u, one_minus_u, *concentration)?;
                }
            }
        }
    }
    let rows = logs
        .iter()
        .map(|row| normalized_logs(row))
        .collect::<Result<Vec<Vec<f64>>>>()?;
    Ok((0..concentrations.len())
        .map(|component| rows.iter().map(|row| row[component]).collect())
        .collect())
}

pub fn hours_per_unit(unit: UncertainUnit) -> f64 {
    match unit {
        UncertainUnit::PerYear => 1.0 / DEFAULT_HOURS_PER_YEAR,
        UncertainUnit::Years => DEFAULT_HOURS_PER_YEAR,
        UncertainUnit::Minutes => 1.0 / MINUTES_PER_HOUR,
        UncertainUnit::Probability
        | UncertainUnit::Fraction
        | UncertainUnit::Factor
        | UncertainUnit::PerHour
        | UncertainUnit::Hours
        | UncertainUnit::Quantity => 1.0,
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum TimeBase {
    Hours,
    Years { hours_per_year: f64 },
}

impl TimeBase {
    pub fn per_unit(self, unit: UncertainUnit) -> f64 {
        match self {
            TimeBase::Hours => hours_per_unit(unit),
            TimeBase::Years { hours_per_year } => match unit {
                UncertainUnit::PerHour => hours_per_year,
                UncertainUnit::Hours => 1.0 / hours_per_year,
                UncertainUnit::Minutes => 1.0 / (MINUTES_PER_HOUR * hours_per_year),
                UncertainUnit::PerYear
                | UncertainUnit::Years
                | UncertainUnit::Probability
                | UncertainUnit::Fraction
                | UncertainUnit::Factor
                | UncertainUnit::Quantity => 1.0,
            },
        }
    }
}

pub fn parameter_name(reference: &ParameterReference) -> String {
    let (workbook, entity) = reference.key();
    format!("{}:{}", workbook, entity)
}

fn scaled(expression: Expr, scale: f64) -> Expr {
    if scale == 1.0 {
        expression
    } else {
        Expr::Mul(vec![expression, Expr::Constant(scale)])
    }
}

pub fn lower_expression(expression: &UncertainExpression, key: &str) -> Expr {
    lower_expression_in(expression, key, TimeBase::Hours)
}

pub fn lower_expression_in(expression: &UncertainExpression, key: &str, base: TimeBase) -> Expr {
    let child = |segment: &str, inner: &UncertainExpression| {
        Box::new(lower_expression_in(inner, &format!("{}/{}", key, segment), base))
    };
    match expression {
        UncertainExpression::Value { value } => {
            let scale = base.per_unit(value.unit);
            match &value.law {
                Law::Point { value } => Expr::Constant(value * scale),
                law => scaled(
                    Expr::Draw {
                        key: key.to_string(),
                        law: Box::new(law.clone()),
                    },
                    scale,
                ),
            }
        }
        UncertainExpression::Parameter { reference } => Expr::Parameter(parameter_name(reference)),
        UncertainExpression::Operation {
            operation,
            operands,
        } => {
            let lowered: Vec<Expr> = operands
                .iter()
                .enumerate()
                .map(|(index, operand)| lower_expression_in(operand, &format!("{}/{}", key, index), base))
                .collect();
            let mut pieces = lowered.into_iter();
            match operation {
                UncertainOperation::Add => Expr::Add(pieces.collect()),
                UncertainOperation::Subtract => Expr::Sub(pieces.collect()),
                UncertainOperation::Multiply => Expr::Mul(pieces.collect()),
                UncertainOperation::Divide => Expr::Div(pieces.collect()),
                UncertainOperation::Min => Expr::Min(pieces.collect()),
                UncertainOperation::Max => Expr::Max(pieces.collect()),
                UncertainOperation::Power => {
                    let base = pieces.next().unwrap_or(Expr::Constant(f64::NAN));
                    let exponent = pieces.next().unwrap_or(Expr::Constant(f64::NAN));
                    Expr::Pow(Box::new(base), Box::new(exponent))
                }
                UncertainOperation::Exp => {
                    Expr::Exp(Box::new(pieces.next().unwrap_or(Expr::Constant(f64::NAN))))
                }
                UncertainOperation::Log => {
                    Expr::Ln(Box::new(pieces.next().unwrap_or(Expr::Constant(f64::NAN))))
                }
            }
        }
        UncertainExpression::Model { model } => match model {
            ComponentModel::Mission { rate, mission_time } => Expr::Exponential {
                lambda: child("rate", rate),
                time: child("missionTime", mission_time),
            },
            ComponentModel::Standby {
                rate,
                test_interval,
            } => Expr::StandbyAverage {
                lambda: child("rate", rate),
                interval: child("testInterval", test_interval),
            },
            ComponentModel::Repairable {
                demand_failure,
                rate,
                repair_rate,
                time,
            } => Expr::Glm {
                gamma: child("demandFailure", demand_failure),
                lambda: child("rate", rate),
                mu: child("repairRate", repair_rate),
                time: child("time", time),
            },
            ComponentModel::Weibull {
                scale,
                shape,
                location,
                time,
            } => Expr::Weibull {
                scale: child("scale", scale),
                shape: child("shape", shape),
                t0: child("location", location),
                time: child("time", time),
            },
            ComponentModel::Fragility {
                median,
                randomness,
                demand,
            } => Expr::Fragility {
                median: child("median", median),
                randomness: child("randomness", randomness),
                demand: child("demand", demand),
            },
        },
    }
}

pub fn require_probability(subject: &str, trial: Option<usize>, value: f64) -> Result<()> {
    if (0.0..=1.0).contains(&value) {
        return Ok(());
    }
    let place = trial.map_or("the point value".to_string(), |trial| format!("trial {}", trial + 1));
    Err(PraxisError::Mef(MefError::Domain {
        message: format!(
            "{} is {} in {}, outside 0 to 1. Bound its formula, for example with MIN.",
            subject, value, place
        ),
        value: Some(value.to_string()),
        attribute: None,
    }))
}

pub struct UncertaintyProgram {
    parameters: HashMap<String, Expr>,
    vectors: HashMap<String, VectorLaw>,
    mission_time: f64,
    prepared: Mutex<HashMap<String, (Law, Arc<PreparedLaw>)>>,
}

#[derive(Default)]
struct Collected<'a> {
    laws: BTreeMap<String, &'a Law>,
    vectors: BTreeMap<String, &'a VectorLaw>,
    visited: HashSet<&'a str>,
}

fn same_key_same_law<T: PartialEq>(key: &str, existing: Option<&&T>, law: &T) -> Result<bool> {
    match existing {
        Some(known) if *known != law => Err(PraxisError::Mef(MefError::Validity(format!(
            "sampling key '{}' is used by two different laws",
            key
        )))),
        Some(_) => Ok(false),
        None => Ok(true),
    }
}

impl UncertaintyProgram {
    pub fn from_table(table: &[UncertainParameter]) -> Result<UncertaintyProgram> {
        UncertaintyProgram::from_table_in(table, TimeBase::Hours)
    }

    pub fn from_table_in(table: &[UncertainParameter], base: TimeBase) -> Result<UncertaintyProgram> {
        validate_parameter_table(table)?;
        let parameters = table
            .iter()
            .map(|parameter| {
                let name = parameter_name(&parameter.reference);
                let lowered = lower_expression_in(&parameter.expression, &name, base);
                (name, lowered)
            })
            .collect();
        Ok(UncertaintyProgram {
            parameters,
            vectors: HashMap::new(),
            mission_time: 0.0,
            prepared: Mutex::new(HashMap::new()),
        })
    }

    pub fn from_expressions(parameters: HashMap<String, Expr>, mission_time: f64) -> UncertaintyProgram {
        UncertaintyProgram {
            parameters,
            vectors: HashMap::new(),
            mission_time,
            prepared: Mutex::new(HashMap::new()),
        }
    }

    pub fn with_vectors(mut self, table: &[UncertainVectorParameter]) -> Result<UncertaintyProgram> {
        for parameter in table {
            parameter.vector.check_shape()?;
            let name = parameter_name(&parameter.reference);
            if self.parameters.contains_key(&name) || self.vectors.insert(name.clone(), parameter.vector.clone()).is_some() {
                return Err(PraxisError::Mef(MefError::DuplicateElement {
                    element_id: name,
                    element_type: "parameter".to_string(),
                    container_id: None,
                }));
            }
        }
        Ok(self)
    }

    pub fn vector_components(&self, vector: &UncertainVector, key: &str) -> Result<Vec<Expr>> {
        vector.check_shape()?;
        let (name, law) = match vector {
            UncertainVector::Value { law } => (key.to_string(), law.clone()),
            UncertainVector::Parameter { reference } => {
                let name = parameter_name(reference);
                let law = self.vectors.get(&name).cloned().ok_or_else(|| {
                    PraxisError::Mef(MefError::UndefinedElement {
                        reference: name.clone(),
                        element_type: "vector parameter".to_string(),
                    })
                })?;
                (name, law)
            }
        };
        Ok((0..law.len())
            .map(|index| Expr::Component {
                key: name.clone(),
                index,
                law: Box::new(law.clone()),
            })
            .collect())
    }

    fn prepared_law(&self, key: &str, law: &Law) -> Result<Arc<PreparedLaw>> {
        let held = |_| PraxisError::Logic("the prepared law store is unavailable".to_string());
        if let Some((known, prepared)) = self.prepared.lock().map_err(held)?.get(key) {
            if known == law {
                return Ok(Arc::clone(prepared));
            }
        }
        let prepared = Arc::new(PreparedLaw::new(law)?);
        self.prepared
            .lock()
            .map_err(held)?
            .insert(key.to_string(), (law.clone(), Arc::clone(&prepared)));
        Ok(prepared)
    }

    pub fn parameters(&self) -> &HashMap<String, Expr> {
        &self.parameters
    }

    pub fn into_parameters(self) -> HashMap<String, Expr> {
        self.parameters
    }

    pub fn target(
        table: &[UncertainParameter],
        expression: &UncertainExpression,
        key: &str,
        output: UncertainUnit,
    ) -> Result<Expr> {
        UncertaintyProgram::target_in(table, expression, key, output, TimeBase::Hours)
    }

    pub fn target_in(
        table: &[UncertainParameter],
        expression: &UncertainExpression,
        key: &str,
        output: UncertainUnit,
        base: TimeBase,
    ) -> Result<Expr> {
        let power = expression_time_power(table, expression)?;
        if power != output.time_power() {
            return Err(PraxisError::Mef(MefError::Domain {
                message: format!(
                    "'{}' has time power {} but is used as a {} value",
                    key,
                    power,
                    output.label()
                ),
                value: None,
                attribute: None,
            }));
        }
        Ok(scaled(
            lower_expression_in(expression, key, base),
            1.0 / base.per_unit(output),
        ))
    }

    pub fn point(&self, target: &Expr) -> Result<f64> {
        let mut collected = Collected::default();
        if !self.collect_laws(target, &mut collected)? {
            return target.evaluate(&EvalContext::constant(&self.parameters, self.mission_time));
        }
        let mut means = collected
            .laws
            .iter()
            .map(|(key, law)| Ok((key.clone(), self.prepared_law(key, law)?.mean())))
            .collect::<Result<HashMap<String, f64>>>()?;
        for (key, law) in &collected.vectors {
            for (index, mean) in law.mean().into_iter().enumerate() {
                means.insert(component_key(key, index), mean);
            }
        }
        target.evaluate(&EvalContext::trial(&self.parameters, self.mission_time, &means))
    }

    fn collect_laws<'a>(&'a self, expression: &'a Expr, collected: &mut Collected<'a>) -> Result<bool> {
        let mut keyed = true;
        let found = expression.draw_set();
        for (key, law) in found.scalars {
            if key.is_empty() {
                keyed = false;
                continue;
            }
            if same_key_same_law(key, collected.laws.get(key), law)? {
                collected.laws.insert(key.to_string(), law);
            }
        }
        for (key, law) in found.vectors {
            if key.is_empty() {
                keyed = false;
                continue;
            }
            if same_key_same_law(key, collected.vectors.get(key), law)? {
                collected.vectors.insert(key.to_string(), law);
            }
        }
        for name in expression.parameter_names() {
            if !collected.visited.insert(name) {
                continue;
            }
            let definition = self.parameters.get(name).ok_or_else(|| {
                PraxisError::Logic(format!("Undefined parameter '{}'", name))
            })?;
            keyed = self.collect_laws(definition, collected)? && keyed;
        }
        Ok(keyed)
    }

    pub fn sample(&self, targets: &[&Expr], plan: &SamplingPlan) -> Result<Vec<Vec<f64>>> {
        if plan.trials == 0 {
            return Err(PraxisError::Settings(
                "sampling needs at least one trial".to_string(),
            ));
        }
        let mut collected = Collected::default();
        for target in targets {
            if !self.collect_laws(target, &mut collected)? {
                return Err(PraxisError::Logic(
                    "an uncertain input has no sampling key".to_string(),
                ));
            }
        }
        let mut columns = Vec::with_capacity(collected.laws.len());
        for (key, law) in &collected.laws {
            let prepared = self.prepared_law(key, law)?;
            columns.push((key.clone(), draw_law(key, &prepared, plan)?));
        }
        for (key, law) in &collected.vectors {
            for (index, column) in draw_vector(key, law, plan)?.into_iter().enumerate() {
                columns.push((component_key(key, index), column));
            }
        }
        let mut values: HashMap<String, f64> =
            columns.iter().map(|(key, _)| (key.clone(), 0.0)).collect();
        let mut results = vec![Vec::with_capacity(plan.trials); targets.len()];
        for trial in 0..plan.trials {
            for (key, column) in &columns {
                if let Some(slot) = values.get_mut(key) {
                    *slot = column[trial];
                }
            }
            let context = EvalContext::trial(&self.parameters, self.mission_time, &values);
            for (index, target) in targets.iter().enumerate() {
                let value = target.evaluate(&context)?;
                if !value.is_finite() {
                    return Err(PraxisError::Mef(MefError::Domain {
                        message: format!(
                            "an uncertain expression is not finite in trial {}",
                            trial + 1
                        ),
                        value: Some(value.to_string()),
                        attribute: None,
                    }));
                }
                results[index].push(value);
            }
        }
        Ok(results)
    }
}
