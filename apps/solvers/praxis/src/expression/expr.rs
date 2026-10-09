use std::cell::RefCell;
use std::collections::HashMap;

use crate::core::distribution::{Law, VectorLaw};
use crate::error::MefError;
use crate::core::distribution_math::{exp_minus_one_over_x_squared, PreparedLaw};
use crate::core::special_functions as kernels;
use crate::{PraxisError, Result};

const MAX_DEPTH: usize = 128;

pub struct EvalContext<'a> {
    parameters: &'a HashMap<String, Expr>,
    mission_time: f64,
    time: f64,
    draws: Option<&'a HashMap<String, f64>>,
    cache: Option<RefCell<HashMap<String, f64>>>,
}

impl<'a> EvalContext<'a> {
    pub fn new(parameters: &'a HashMap<String, Expr>, mission_time: f64, time: f64) -> Self {
        EvalContext {
            parameters,
            mission_time,
            time,
            draws: None,
            cache: None,
        }
    }

    pub fn constant(parameters: &'a HashMap<String, Expr>, mission_time: f64) -> Self {
        EvalContext::new(parameters, mission_time, mission_time)
    }

    pub fn trial(
        parameters: &'a HashMap<String, Expr>,
        mission_time: f64,
        draws: &'a HashMap<String, f64>,
    ) -> Self {
        EvalContext {
            parameters,
            mission_time,
            time: mission_time,
            draws: Some(draws),
            cache: Some(RefCell::new(HashMap::new())),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Constant(f64),
    Parameter(String),
    MissionTime,
    Time,
    Pi,

    Add(Vec<Expr>),
    Sub(Vec<Expr>),
    Mul(Vec<Expr>),
    Div(Vec<Expr>),
    Min(Vec<Expr>),
    Max(Vec<Expr>),
    Mean(Vec<Expr>),
    Pow(Box<Expr>, Box<Expr>),
    Mod(Box<Expr>, Box<Expr>),

    Neg(Box<Expr>),
    Abs(Box<Expr>),
    Sqrt(Box<Expr>),
    Exp(Box<Expr>),
    Ln(Box<Expr>),
    Log10(Box<Expr>),
    Sin(Box<Expr>),
    Cos(Box<Expr>),
    Tan(Box<Expr>),
    Asin(Box<Expr>),
    Acos(Box<Expr>),
    Atan(Box<Expr>),
    Sinh(Box<Expr>),
    Cosh(Box<Expr>),
    Tanh(Box<Expr>),
    Floor(Box<Expr>),
    Ceil(Box<Expr>),

    And(Vec<Expr>),
    Or(Vec<Expr>),
    Not(Box<Expr>),
    Eq(Box<Expr>, Box<Expr>),
    Ne(Box<Expr>, Box<Expr>),
    Lt(Box<Expr>, Box<Expr>),
    Gt(Box<Expr>, Box<Expr>),
    Le(Box<Expr>, Box<Expr>),
    Ge(Box<Expr>, Box<Expr>),
    Ite(Box<Expr>, Box<Expr>, Box<Expr>),

    Exponential {
        lambda: Box<Expr>,
        time: Box<Expr>,
    },
    Glm {
        gamma: Box<Expr>,
        lambda: Box<Expr>,
        mu: Box<Expr>,
        time: Box<Expr>,
    },
    Weibull {
        scale: Box<Expr>,
        shape: Box<Expr>,
        t0: Box<Expr>,
        time: Box<Expr>,
    },
    StandbyAverage {
        lambda: Box<Expr>,
        interval: Box<Expr>,
    },
    Draw {
        key: String,
        law: Box<Law>,
    },
    Fragility {
        median: Box<Expr>,
        randomness: Box<Expr>,
        demand: Box<Expr>,
    },
    Component {
        key: String,
        index: usize,
        law: Box<VectorLaw>,
    },
}

pub fn component_key(key: &str, index: usize) -> String {
    format!("{}#{}", key, index)
}

fn domain_error(message: String, value: f64) -> PraxisError {
    PraxisError::Mef(MefError::Domain {
        message,
        value: Some(value.to_string()),
        attribute: None,
    })
}

pub fn fragility_probability(median: f64, randomness: f64, demand: f64) -> Result<f64> {
    if !(median > 0.0 && median.is_finite()) {
        return Err(domain_error("A fragility median must be positive".to_string(), median));
    }
    if !(randomness >= 0.0 && randomness.is_finite()) {
        return Err(domain_error("A fragility randomness must not be negative".to_string(), randomness));
    }
    if demand.is_nan() {
        return Err(domain_error("A fragility demand must be a number".to_string(), demand));
    }
    if demand <= 0.0 {
        return Ok(0.0);
    }
    if randomness == 0.0 {
        return Ok(if demand > median { 1.0 } else { 0.0 });
    }
    kernels::normal_cdf((demand / median).ln() / randomness)
}

pub struct DrawSet<'a> {
    pub scalars: Vec<(&'a str, &'a Law)>,
    pub vectors: Vec<(&'a str, &'a VectorLaw)>,
}

struct Walk<'a, 'b> {
    ctx: &'a EvalContext<'b>,
    resolving: Vec<String>,
    depth: usize,
}

impl Walk<'_, '_> {
    fn eval(&mut self, expr: &Expr) -> Result<f64> {
        self.depth += 1;
        if self.depth > MAX_DEPTH {
            self.depth -= 1;
            return Err(PraxisError::Logic(
                "Expression nesting too deep".to_string(),
            ));
        }
        let result = self.eval_node(expr);
        self.depth -= 1;
        result
    }

    fn eval_node(&mut self, expr: &Expr) -> Result<f64> {
        Ok(match expr {
            Expr::Constant(value) => *value,
            Expr::Parameter(name) => {
                if let Some(cache) = &self.ctx.cache {
                    if let Some(value) = cache.borrow().get(name) {
                        return Ok(*value);
                    }
                }
                if self.resolving.iter().any(|n| n == name) {
                    return Err(PraxisError::Logic(format!(
                        "Parameter cycle detected at '{}'",
                        name
                    )));
                }
                let definition =
                    self.ctx.parameters.get(name).ok_or_else(|| {
                        PraxisError::Logic(format!("Undefined parameter '{}'", name))
                    })?;
                self.resolving.push(name.clone());
                let value = self.eval(definition);
                self.resolving.pop();
                let value = value?;
                if let Some(cache) = &self.ctx.cache {
                    cache.borrow_mut().insert(name.clone(), value);
                }
                value
            }
            Expr::MissionTime => self.ctx.mission_time,
            Expr::Time => self.ctx.time,
            Expr::Pi => std::f64::consts::PI,

            Expr::Add(items) => {
                let mut total = 0.0;
                for item in items {
                    total += self.eval(item)?;
                }
                total
            }
            Expr::Sub(items) => self.fold_first(items, |a, b| a - b)?,
            Expr::Mul(items) => {
                let mut total = 1.0;
                for item in items {
                    total *= self.eval(item)?;
                }
                total
            }
            Expr::Div(items) => self.fold_first(items, |a, b| a / b)?,
            Expr::Min(items) => self.fold_first(items, f64::min)?,
            Expr::Max(items) => self.fold_first(items, f64::max)?,
            Expr::Mean(items) => {
                if items.is_empty() {
                    return Err(PraxisError::Logic("mean requires arguments".to_string()));
                }
                let mut total = 0.0;
                for item in items {
                    total += self.eval(item)?;
                }
                total / items.len() as f64
            }
            Expr::Pow(base, power) => self.eval(base)?.powf(self.eval(power)?),
            Expr::Mod(a, b) => self.eval(a)? % self.eval(b)?,

            Expr::Neg(x) => -self.eval(x)?,
            Expr::Abs(x) => self.eval(x)?.abs(),
            Expr::Sqrt(x) => self.eval(x)?.sqrt(),
            Expr::Exp(x) => self.eval(x)?.exp(),
            Expr::Ln(x) => self.eval(x)?.ln(),
            Expr::Log10(x) => self.eval(x)?.log10(),
            Expr::Sin(x) => self.eval(x)?.sin(),
            Expr::Cos(x) => self.eval(x)?.cos(),
            Expr::Tan(x) => self.eval(x)?.tan(),
            Expr::Asin(x) => self.eval(x)?.asin(),
            Expr::Acos(x) => self.eval(x)?.acos(),
            Expr::Atan(x) => self.eval(x)?.atan(),
            Expr::Sinh(x) => self.eval(x)?.sinh(),
            Expr::Cosh(x) => self.eval(x)?.cosh(),
            Expr::Tanh(x) => self.eval(x)?.tanh(),
            Expr::Floor(x) => self.eval(x)?.floor(),
            Expr::Ceil(x) => self.eval(x)?.ceil(),

            Expr::And(items) => {
                let mut result = 1.0;
                for item in items {
                    if self.eval(item)? == 0.0 {
                        result = 0.0;
                        break;
                    }
                }
                result
            }
            Expr::Or(items) => {
                let mut result = 0.0;
                for item in items {
                    if self.eval(item)? != 0.0 {
                        result = 1.0;
                        break;
                    }
                }
                result
            }
            Expr::Not(x) => bool_value(self.eval(x)? == 0.0),
            Expr::Eq(a, b) => bool_value(self.eval(a)? == self.eval(b)?),
            Expr::Ne(a, b) => bool_value(self.eval(a)? != self.eval(b)?),
            Expr::Lt(a, b) => bool_value(self.eval(a)? < self.eval(b)?),
            Expr::Gt(a, b) => bool_value(self.eval(a)? > self.eval(b)?),
            Expr::Le(a, b) => bool_value(self.eval(a)? <= self.eval(b)?),
            Expr::Ge(a, b) => bool_value(self.eval(a)? >= self.eval(b)?),
            Expr::Ite(cond, then, otherwise) => {
                if self.eval(cond)? != 0.0 {
                    self.eval(then)?
                } else {
                    self.eval(otherwise)?
                }
            }

            Expr::Exponential { lambda, time } => {
                let exposure = self.eval(lambda)? * self.eval(time)?;
                -kernels::exp_minus_one(-exposure)?
            }
            Expr::Glm {
                gamma,
                lambda,
                mu,
                time,
            } => {
                let g = self.eval(gamma)?;
                let l = self.eval(lambda)?;
                let m = self.eval(mu)?;
                let t = self.eval(time)?;
                let total = l + m;
                if total == 0.0 {
                    g
                } else {
                    g * (-total * t).exp() + l / total * -kernels::exp_minus_one(-total * t)?
                }
            }
            Expr::Weibull {
                scale,
                shape,
                t0,
                time,
            } => {
                let a = self.eval(scale)?;
                let b = self.eval(shape)?;
                let shift = self.eval(t0)?;
                let t = self.eval(time)?;
                if t <= shift || a <= 0.0 {
                    0.0
                } else {
                    -kernels::exp_minus_one(-((t - shift) / a).powf(b))?
                }
            }
            Expr::StandbyAverage { lambda, interval } => {
                let exposure = self.eval(lambda)? * self.eval(interval)?;
                if exposure == 0.0 {
                    0.0
                } else {
                    exposure * exp_minus_one_over_x_squared(-exposure)?
                }
            }
            Expr::Draw { key, law } => match self.ctx.draws {
                Some(draws) => *draws.get(key).ok_or_else(|| {
                    PraxisError::Logic(format!("no sampled value for uncertain input '{}'", key))
                })?,
                None => PreparedLaw::new(law)?.mean(),
            },
            Expr::Fragility {
                median,
                randomness,
                demand,
            } => {
                let m = self.eval(median)?;
                let r = self.eval(randomness)?;
                let d = self.eval(demand)?;
                fragility_probability(m, r, d)?
            }
            Expr::Component { key, index, law } => match self.ctx.draws {
                Some(draws) => *draws.get(&component_key(key, *index)).ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "no sampled value for component {} of uncertain vector '{}'",
                        index, key
                    ))
                })?,
                None => law.mean().get(*index).copied().ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "uncertain vector '{}' has no component {}",
                        key, index
                    ))
                })?,
            },
        })
    }

    fn fold_first(&mut self, items: &[Expr], op: impl Fn(f64, f64) -> f64) -> Result<f64> {
        let mut iter = items.iter();
        let first = iter
            .next()
            .ok_or_else(|| PraxisError::Logic("operator requires arguments".to_string()))?;
        let mut acc = self.eval(first)?;
        for item in iter {
            acc = op(acc, self.eval(item)?);
        }
        Ok(acc)
    }
}

impl Expr {
    pub fn evaluate(&self, ctx: &EvalContext) -> Result<f64> {
        let mut walk = Walk {
            ctx,
            resolving: Vec::new(),
            depth: 0,
        };
        walk.eval(self)
    }

    pub fn constant(value: f64) -> Expr {
        Expr::Constant(value)
    }

    pub fn draw(law: Law) -> Expr {
        Expr::Draw {
            key: String::new(),
            law: Box::new(law),
        }
    }

    pub fn normal(mean: f64, standard_deviation: f64) -> Expr {
        Expr::draw(Law::Normal {
            mean,
            standard_deviation,
        })
    }

    pub fn uniform(lower: f64, upper: f64) -> Expr {
        Expr::draw(Law::Uniform { lower, upper })
    }

    pub fn gamma(shape: f64, rate: f64) -> Expr {
        Expr::draw(Law::Gamma { shape, rate })
    }

    pub fn beta(alpha: f64, beta: f64) -> Expr {
        Expr::draw(Law::Beta {
            alpha,
            beta,
            lower: 0.0,
            upper: 1.0,
        })
    }

    pub fn triangular(lower: f64, mode: f64, upper: f64) -> Expr {
        Expr::draw(Law::Triangular { lower, mode, upper })
    }

    fn children_mut(&mut self) -> Vec<(String, &mut Expr)> {
        match self {
            Expr::Add(items)
            | Expr::Sub(items)
            | Expr::Mul(items)
            | Expr::Div(items)
            | Expr::Min(items)
            | Expr::Max(items)
            | Expr::Mean(items)
            | Expr::And(items)
            | Expr::Or(items) => indexed(items),
            Expr::Pow(a, b)
            | Expr::Mod(a, b)
            | Expr::Eq(a, b)
            | Expr::Ne(a, b)
            | Expr::Lt(a, b)
            | Expr::Gt(a, b)
            | Expr::Le(a, b)
            | Expr::Ge(a, b) => vec![("0".to_string(), a.as_mut()), ("1".to_string(), b.as_mut())],
            Expr::Neg(x)
            | Expr::Abs(x)
            | Expr::Sqrt(x)
            | Expr::Exp(x)
            | Expr::Ln(x)
            | Expr::Log10(x)
            | Expr::Sin(x)
            | Expr::Cos(x)
            | Expr::Tan(x)
            | Expr::Asin(x)
            | Expr::Acos(x)
            | Expr::Atan(x)
            | Expr::Sinh(x)
            | Expr::Cosh(x)
            | Expr::Tanh(x)
            | Expr::Floor(x)
            | Expr::Ceil(x)
            | Expr::Not(x) => vec![("0".to_string(), x.as_mut())],
            Expr::Ite(a, b, c) => vec![
                ("0".to_string(), a.as_mut()),
                ("1".to_string(), b.as_mut()),
                ("2".to_string(), c.as_mut()),
            ],
            Expr::Exponential { lambda, time } => vec![
                ("lambda".to_string(), lambda.as_mut()),
                ("time".to_string(), time.as_mut()),
            ],
            Expr::Glm {
                gamma,
                lambda,
                mu,
                time,
            } => vec![
                ("gamma".to_string(), gamma.as_mut()),
                ("lambda".to_string(), lambda.as_mut()),
                ("mu".to_string(), mu.as_mut()),
                ("time".to_string(), time.as_mut()),
            ],
            Expr::Weibull {
                scale,
                shape,
                t0,
                time,
            } => vec![
                ("scale".to_string(), scale.as_mut()),
                ("shape".to_string(), shape.as_mut()),
                ("t0".to_string(), t0.as_mut()),
                ("time".to_string(), time.as_mut()),
            ],
            Expr::StandbyAverage { lambda, interval } => vec![
                ("lambda".to_string(), lambda.as_mut()),
                ("interval".to_string(), interval.as_mut()),
            ],
            Expr::Fragility {
                median,
                randomness,
                demand,
            } => vec![
                ("median".to_string(), median.as_mut()),
                ("randomness".to_string(), randomness.as_mut()),
                ("demand".to_string(), demand.as_mut()),
            ],
            Expr::Constant(_)
            | Expr::Parameter(_)
            | Expr::MissionTime
            | Expr::Time
            | Expr::Pi
            | Expr::Draw { .. }
            | Expr::Component { .. } => Vec::new(),
        }
    }

    pub fn assign_draw_keys(&mut self, prefix: &str) {
        if let Expr::Draw { key, .. } | Expr::Component { key, .. } = self {
            if key.is_empty() {
                *key = prefix.to_string();
            }
            return;
        }
        for (segment, child) in self.children_mut() {
            child.assign_draw_keys(&format!("{}/{}", prefix, segment));
        }
    }

    pub fn draws(&self) -> Vec<(&str, &Law)> {
        self.draw_set().scalars
    }

    pub fn vector_draws(&self) -> Vec<(&str, &VectorLaw)> {
        self.draw_set().vectors
    }

    pub fn draw_set(&self) -> DrawSet<'_> {
        let mut found = DrawSet {
            scalars: Vec::new(),
            vectors: Vec::new(),
        };
        self.collect_draws(&mut found);
        found
    }

    fn collect_draws<'a>(&'a self, found: &mut DrawSet<'a>) {
        match self {
            Expr::Draw { key, law } => found.scalars.push((key.as_str(), law.as_ref())),
            Expr::Component { key, law, .. } => found.vectors.push((key.as_str(), law.as_ref())),
            Expr::Fragility {
                median,
                randomness,
                demand,
            } => {
                median.collect_draws(found);
                randomness.collect_draws(found);
                demand.collect_draws(found);
            }
            Expr::Add(items)
            | Expr::Sub(items)
            | Expr::Mul(items)
            | Expr::Div(items)
            | Expr::Min(items)
            | Expr::Max(items)
            | Expr::Mean(items)
            | Expr::And(items)
            | Expr::Or(items) => items.iter().for_each(|item| item.collect_draws(found)),
            Expr::Pow(a, b)
            | Expr::Mod(a, b)
            | Expr::Eq(a, b)
            | Expr::Ne(a, b)
            | Expr::Lt(a, b)
            | Expr::Gt(a, b)
            | Expr::Le(a, b)
            | Expr::Ge(a, b)
            | Expr::Exponential { lambda: a, time: b }
            | Expr::StandbyAverage {
                lambda: a,
                interval: b,
            } => {
                a.collect_draws(found);
                b.collect_draws(found);
            }
            Expr::Neg(x)
            | Expr::Abs(x)
            | Expr::Sqrt(x)
            | Expr::Exp(x)
            | Expr::Ln(x)
            | Expr::Log10(x)
            | Expr::Sin(x)
            | Expr::Cos(x)
            | Expr::Tan(x)
            | Expr::Asin(x)
            | Expr::Acos(x)
            | Expr::Atan(x)
            | Expr::Sinh(x)
            | Expr::Cosh(x)
            | Expr::Tanh(x)
            | Expr::Floor(x)
            | Expr::Ceil(x)
            | Expr::Not(x) => x.collect_draws(found),
            Expr::Ite(a, b, c) => {
                a.collect_draws(found);
                b.collect_draws(found);
                c.collect_draws(found);
            }
            Expr::Glm {
                gamma,
                lambda,
                mu,
                time,
            } => {
                gamma.collect_draws(found);
                lambda.collect_draws(found);
                mu.collect_draws(found);
                time.collect_draws(found);
            }
            Expr::Weibull {
                scale,
                shape,
                t0,
                time,
            } => {
                scale.collect_draws(found);
                shape.collect_draws(found);
                t0.collect_draws(found);
                time.collect_draws(found);
            }
            Expr::Constant(_)
            | Expr::Parameter(_)
            | Expr::MissionTime
            | Expr::Time
            | Expr::Pi => {}
        }
    }

    pub fn parameter_names(&self) -> Vec<&str> {
        let mut found = Vec::new();
        self.collect_parameters(&mut found);
        found
    }

    fn collect_parameters<'a>(&'a self, found: &mut Vec<&'a str>) {
        match self {
            Expr::Parameter(name) => found.push(name.as_str()),
            Expr::Add(items)
            | Expr::Sub(items)
            | Expr::Mul(items)
            | Expr::Div(items)
            | Expr::Min(items)
            | Expr::Max(items)
            | Expr::Mean(items)
            | Expr::And(items)
            | Expr::Or(items) => items.iter().for_each(|item| item.collect_parameters(found)),
            Expr::Pow(a, b)
            | Expr::Mod(a, b)
            | Expr::Eq(a, b)
            | Expr::Ne(a, b)
            | Expr::Lt(a, b)
            | Expr::Gt(a, b)
            | Expr::Le(a, b)
            | Expr::Ge(a, b)
            | Expr::Exponential { lambda: a, time: b }
            | Expr::StandbyAverage {
                lambda: a,
                interval: b,
            } => {
                a.collect_parameters(found);
                b.collect_parameters(found);
            }
            Expr::Neg(x)
            | Expr::Abs(x)
            | Expr::Sqrt(x)
            | Expr::Exp(x)
            | Expr::Ln(x)
            | Expr::Log10(x)
            | Expr::Sin(x)
            | Expr::Cos(x)
            | Expr::Tan(x)
            | Expr::Asin(x)
            | Expr::Acos(x)
            | Expr::Atan(x)
            | Expr::Sinh(x)
            | Expr::Cosh(x)
            | Expr::Tanh(x)
            | Expr::Floor(x)
            | Expr::Ceil(x)
            | Expr::Not(x) => x.collect_parameters(found),
            Expr::Ite(a, b, c) => {
                a.collect_parameters(found);
                b.collect_parameters(found);
                c.collect_parameters(found);
            }
            Expr::Glm {
                gamma,
                lambda,
                mu,
                time,
            } => {
                gamma.collect_parameters(found);
                lambda.collect_parameters(found);
                mu.collect_parameters(found);
                time.collect_parameters(found);
            }
            Expr::Weibull {
                scale,
                shape,
                t0,
                time,
            } => {
                scale.collect_parameters(found);
                shape.collect_parameters(found);
                t0.collect_parameters(found);
                time.collect_parameters(found);
            }
            Expr::Fragility {
                median,
                randomness,
                demand,
            } => {
                median.collect_parameters(found);
                randomness.collect_parameters(found);
                demand.collect_parameters(found);
            }
            Expr::Constant(_)
            | Expr::MissionTime
            | Expr::Time
            | Expr::Pi
            | Expr::Draw { .. }
            | Expr::Component { .. } => {}
        }
    }
}

fn indexed(items: &mut [Expr]) -> Vec<(String, &mut Expr)> {
    items
        .iter_mut()
        .enumerate()
        .map(|(index, item)| (index.to_string(), item))
        .collect()
}

fn bool_value(condition: bool) -> f64 {
    if condition {
        1.0
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty() -> HashMap<String, Expr> {
        HashMap::new()
    }

    fn b(expr: Expr) -> Box<Expr> {
        Box::new(expr)
    }

    #[test]
    fn arithmetic_and_functions() {
        let params = empty();
        let ctx = EvalContext::new(&params, 1.0, 1.0);
        let add = Expr::Add(vec![Expr::Constant(2.0), Expr::Constant(3.0)]);
        assert_eq!(add.evaluate(&ctx).unwrap(), 5.0);
        let sub = Expr::Sub(vec![
            Expr::Constant(10.0),
            Expr::Constant(3.0),
            Expr::Constant(2.0),
        ]);
        assert_eq!(sub.evaluate(&ctx).unwrap(), 5.0);
        let div = Expr::Div(vec![
            Expr::Constant(12.0),
            Expr::Constant(3.0),
            Expr::Constant(2.0),
        ]);
        assert_eq!(div.evaluate(&ctx).unwrap(), 2.0);
        let pow = Expr::Pow(b(Expr::Constant(2.0)), b(Expr::Constant(10.0)));
        assert_eq!(pow.evaluate(&ctx).unwrap(), 1024.0);
        let expr = Expr::Exp(b(Expr::Ln(b(Expr::Constant(7.0)))));
        assert!((expr.evaluate(&ctx).unwrap() - 7.0).abs() < 1e-9);
    }

    #[test]
    fn parameters_resolve_and_detect_cycles() {
        let mut params = empty();
        params.insert("lambda".to_string(), Expr::Constant(0.001));
        params.insert(
            "q".to_string(),
            Expr::Mul(vec![
                Expr::Parameter("lambda".to_string()),
                Expr::Constant(2.0),
            ]),
        );
        let ctx = EvalContext::new(&params, 1.0, 1.0);
        assert!((Expr::Parameter("q".to_string()).evaluate(&ctx).unwrap() - 0.002).abs() < 1e-12);

        let mut cyclic = empty();
        cyclic.insert("a".to_string(), Expr::Parameter("b".to_string()));
        cyclic.insert("b".to_string(), Expr::Parameter("a".to_string()));
        let cyclic_ctx = EvalContext::new(&cyclic, 1.0, 1.0);
        assert!(Expr::Parameter("a".to_string())
            .evaluate(&cyclic_ctx)
            .is_err());
    }

    #[test]
    fn comparison_and_conditional() {
        let params = empty();
        let ctx = EvalContext::new(&params, 1.0, 1.0);
        let ite = Expr::Ite(
            b(Expr::Lt(b(Expr::Constant(1.0)), b(Expr::Constant(2.0)))),
            b(Expr::Constant(10.0)),
            b(Expr::Constant(20.0)),
        );
        assert_eq!(ite.evaluate(&ctx).unwrap(), 10.0);
    }

    #[test]
    fn exponential_keeps_digits_for_small_exposure() {
        let params = empty();
        let ctx = EvalContext::new(&params, 100.0, 100.0);
        let expr = Expr::Exponential {
            lambda: b(Expr::Constant(1e-12)),
            time: b(Expr::MissionTime),
        };
        assert_eq!(expr.evaluate(&ctx).unwrap(), -(-1e-10f64).exp_m1());
    }

    #[test]
    fn glm_endpoints() {
        let params = empty();
        let at_zero = EvalContext::new(&params, 0.0, 0.0);
        let glm = Expr::Glm {
            gamma: b(Expr::Constant(0.02)),
            lambda: b(Expr::Constant(0.001)),
            mu: b(Expr::Constant(0.1)),
            time: b(Expr::Time),
        };
        assert!((glm.evaluate(&at_zero).unwrap() - 0.02).abs() < 1e-12);

        let steady = EvalContext::new(&params, 1.0e6, 1.0e6);
        let expected = 0.001 / (0.001 + 0.1);
        assert!((glm.evaluate(&steady).unwrap() - expected).abs() < 1e-9);
    }

    #[test]
    fn weibull_shifted() {
        let params = empty();
        let ctx = EvalContext::new(&params, 5.0, 5.0);
        let expr = Expr::Weibull {
            scale: b(Expr::Constant(10.0)),
            shape: b(Expr::Constant(2.0)),
            t0: b(Expr::Constant(1.0)),
            time: b(Expr::Time),
        };
        let expected = 1.0 - (-((5.0f64 - 1.0) / 10.0).powf(2.0)).exp();
        assert!((expr.evaluate(&ctx).unwrap() - expected).abs() < 1e-12);
    }

    #[test]
    fn standby_average_matches_the_closed_form() {
        let params = empty();
        let ctx = EvalContext::new(&params, 1.0, 1.0);
        for (lambda, interval) in [(1e-6, 720.0), (1e-3, 720.0), (1e-9, 1.0)] {
            let expr = Expr::StandbyAverage {
                lambda: b(Expr::Constant(lambda)),
                interval: b(Expr::Constant(interval)),
            };
            let x: f64 = lambda * interval;
            let series = x / 2.0 - x * x / 6.0 + x * x * x / 24.0 - x.powi(4) / 120.0;
            let value = expr.evaluate(&ctx).unwrap();
            assert!((value - series).abs() <= 4.0 * f64::EPSILON * series + x.powi(5) / 720.0);
        }
    }

    #[test]
    fn draws_evaluate_to_the_law_mean_without_sampled_values() {
        let params = empty();
        let ctx = EvalContext::new(&params, 1.0, 1.0);
        assert!((Expr::beta(2.0, 8.0).evaluate(&ctx).unwrap() - 0.2).abs() < 1e-15);
        assert!((Expr::gamma(4.0, 2.0).evaluate(&ctx).unwrap() - 2.0).abs() < 1e-15);
    }

    #[test]
    fn draws_read_their_sampled_value_and_shared_parameters_reuse_it() {
        let mut params = empty();
        let mut shared = Expr::uniform(0.0, 1.0);
        shared.assign_draw_keys("p");
        params.insert("p".to_string(), shared);
        let mut draws = HashMap::new();
        draws.insert("p".to_string(), 0.25);
        let ctx = EvalContext::trial(&params, 1.0, &draws);
        let twice = Expr::Add(vec![
            Expr::Parameter("p".to_string()),
            Expr::Parameter("p".to_string()),
        ]);
        assert_eq!(twice.evaluate(&ctx).unwrap(), 0.5);
        let mut missing = Expr::uniform(0.0, 1.0);
        missing.assign_draw_keys("other");
        assert!(missing.evaluate(&ctx).is_err());
    }

    #[test]
    fn draw_keys_follow_the_expression_path() {
        let mut expr = Expr::Mul(vec![Expr::Constant(2.0), Expr::gamma(1.0, 2.0)]);
        expr.assign_draw_keys("event:E1");
        assert_eq!(expr.draws()[0].0, "event:E1/1");
    }
}
