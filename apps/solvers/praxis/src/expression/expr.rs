use std::cell::RefCell;
use std::collections::HashMap;

use rand::Rng;
use rand_distr::{Beta, Distribution as RandDistribution, Gamma, LogNormal, Normal, Uniform};

use crate::{PraxisError, Result};

pub const LOGNORMAL_EF_QUANTILE: f64 = 1.6448536269514722;

const MAX_DEPTH: usize = 128;

pub struct EvalContext<'a> {
    parameters: &'a HashMap<String, Expr>,
    mission_time: f64,
    time: f64,
    sample_cache: Option<RefCell<HashMap<String, f64>>>,
}

impl<'a> EvalContext<'a> {
    pub fn new(parameters: &'a HashMap<String, Expr>, mission_time: f64, time: f64) -> Self {
        EvalContext {
            parameters,
            mission_time,
            time,
            sample_cache: None,
        }
    }

    pub fn constant(parameters: &'a HashMap<String, Expr>, mission_time: f64) -> Self {
        EvalContext::new(parameters, mission_time, mission_time)
    }

    pub fn correlated(parameters: &'a HashMap<String, Expr>, mission_time: f64) -> Self {
        EvalContext {
            parameters,
            mission_time,
            time: mission_time,
            sample_cache: Some(RefCell::new(HashMap::new())),
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
    UniformDeviate {
        lower: Box<Expr>,
        upper: Box<Expr>,
    },
    NormalDeviate {
        mean: Box<Expr>,
        sigma: Box<Expr>,
    },
    LognormalDeviate {
        mu: Box<Expr>,
        sigma: Box<Expr>,
    },
    GammaDeviate {
        shape: Box<Expr>,
        rate: Box<Expr>,
    },
    BetaDeviate {
        alpha: Box<Expr>,
        beta: Box<Expr>,
    },
    TriangularDeviate {
        lower: Box<Expr>,
        mode: Box<Expr>,
        upper: Box<Expr>,
    },
    Histogram {
        boundaries: Vec<Expr>,
        weights: Vec<Expr>,
    },
}

struct Walk<'a, 'b, R: Rng> {
    ctx: &'a EvalContext<'b>,
    rng: Option<&'a mut R>,
    resolving: Vec<String>,
    depth: usize,
}

impl<R: Rng> Walk<'_, '_, R> {
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
                if self.rng.is_some() {
                    if let Some(cache) = &self.ctx.sample_cache {
                        if let Some(value) = cache.borrow().get(name) {
                            return Ok(*value);
                        }
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
                let definition = definition.clone();
                self.resolving.push(name.clone());
                let value = self.eval(&definition);
                self.resolving.pop();
                let value = value?;
                if self.rng.is_some() {
                    if let Some(cache) = &self.ctx.sample_cache {
                        cache.borrow_mut().insert(name.clone(), value);
                    }
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
                let l = self.eval(lambda)?;
                let t = self.eval(time)?;
                1.0 - (-l * t).exp()
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
                let denom = l + m;
                if denom == 0.0 {
                    g
                } else {
                    l / denom - (l - g * denom) / denom * (-denom * t).exp()
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
                    1.0 - (-((t - shift) / a).powf(b)).exp()
                }
            }
            Expr::UniformDeviate { lower, upper } => {
                let lo = self.eval(lower)?;
                let hi = self.eval(upper)?;
                match self.rng.as_deref_mut() {
                    Some(r) => Uniform::new(lo, hi).sample(r),
                    None => (lo + hi) / 2.0,
                }
            }
            Expr::NormalDeviate { mean, sigma } => {
                let m = self.eval(mean)?;
                let s = self.eval(sigma)?;
                match self.rng.as_deref_mut() {
                    Some(r) => Normal::new(m, s)
                        .map_err(|e| PraxisError::Logic(format!("normal deviate: {}", e)))?
                        .sample(r),
                    None => m,
                }
            }
            Expr::LognormalDeviate { mu, sigma } => {
                let location = self.eval(mu)?;
                let s = self.eval(sigma)?;
                match self.rng.as_deref_mut() {
                    Some(r) => LogNormal::new(location, s)
                        .map_err(|e| PraxisError::Logic(format!("lognormal deviate: {}", e)))?
                        .sample(r),
                    None => (location + s * s / 2.0).exp(),
                }
            }
            Expr::GammaDeviate { shape, rate } => {
                let k = self.eval(shape)?;
                let r = self.eval(rate)?;
                match self.rng.as_deref_mut() {
                    Some(rng_ref) => Gamma::new(k, 1.0 / r)
                        .map_err(|e| PraxisError::Logic(format!("gamma deviate: {}", e)))?
                        .sample(rng_ref),
                    None => k / r,
                }
            }
            Expr::BetaDeviate { alpha, beta } => {
                let a = self.eval(alpha)?;
                let b = self.eval(beta)?;
                match self.rng.as_deref_mut() {
                    Some(r) => Beta::new(a, b)
                        .map_err(|e| PraxisError::Logic(format!("beta deviate: {}", e)))?
                        .sample(r),
                    None => a / (a + b),
                }
            }
            Expr::TriangularDeviate { lower, mode, upper } => {
                let lo = self.eval(lower)?;
                let md = self.eval(mode)?;
                let hi = self.eval(upper)?;
                match self.rng.as_deref_mut() {
                    Some(r) => sample_triangular(lo, md, hi, r),
                    None => (lo + md + hi) / 3.0,
                }
            }
            Expr::Histogram {
                boundaries,
                weights,
            } => self.histogram(boundaries, weights)?,
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

    fn histogram(&mut self, boundaries: &[Expr], weights: &[Expr]) -> Result<f64> {
        if boundaries.len() != weights.len() + 1 || weights.is_empty() {
            return Err(PraxisError::Logic(
                "histogram needs one more boundary than weights".to_string(),
            ));
        }
        let mut bounds = Vec::with_capacity(boundaries.len());
        for boundary in boundaries {
            bounds.push(self.eval(boundary)?);
        }
        let mut masses = Vec::with_capacity(weights.len());
        for weight in weights {
            masses.push(self.eval(weight)?);
        }
        let total: f64 = masses.iter().sum();
        if total <= 0.0 {
            return Err(PraxisError::Logic(
                "histogram weights must sum to a positive value".to_string(),
            ));
        }

        match self.rng.as_deref_mut() {
            Some(r) => {
                let mut target = r.gen::<f64>() * total;
                for (index, mass) in masses.iter().enumerate() {
                    if target < *mass {
                        let lo = bounds[index];
                        let hi = bounds[index + 1];
                        return Ok(lo + (hi - lo) * r.gen::<f64>());
                    }
                    target -= *mass;
                }
                Ok(bounds[bounds.len() - 1])
            }
            None => {
                let mut mean = 0.0;
                for (index, mass) in masses.iter().enumerate() {
                    mean += (bounds[index] + bounds[index + 1]) / 2.0 * mass;
                }
                Ok(mean / total)
            }
        }
    }
}

impl Expr {
    pub fn evaluate(&self, ctx: &EvalContext) -> Result<f64> {
        let mut walk: Walk<rand::rngs::StdRng> = Walk {
            ctx,
            rng: None,
            resolving: Vec::new(),
            depth: 0,
        };
        walk.eval(self)
    }

    pub fn sample<R: Rng>(&self, ctx: &EvalContext, rng: &mut R) -> Result<f64> {
        let mut walk = Walk {
            ctx,
            rng: Some(rng),
            resolving: Vec::new(),
            depth: 0,
        };
        walk.eval(self)
    }

    pub fn constant(value: f64) -> Expr {
        Expr::Constant(value)
    }

    pub fn normal(mean: f64, sigma: f64) -> Expr {
        Expr::NormalDeviate {
            mean: Box::new(Expr::Constant(mean)),
            sigma: Box::new(Expr::Constant(sigma)),
        }
    }

    pub fn lognormal(mu: f64, sigma: f64) -> Expr {
        Expr::LognormalDeviate {
            mu: Box::new(Expr::Constant(mu)),
            sigma: Box::new(Expr::Constant(sigma)),
        }
    }

    pub fn uniform(lower: f64, upper: f64) -> Expr {
        Expr::UniformDeviate {
            lower: Box::new(Expr::Constant(lower)),
            upper: Box::new(Expr::Constant(upper)),
        }
    }

    pub fn gamma(shape: f64, rate: f64) -> Expr {
        Expr::GammaDeviate {
            shape: Box::new(Expr::Constant(shape)),
            rate: Box::new(Expr::Constant(rate)),
        }
    }

    pub fn beta(alpha: f64, beta: f64) -> Expr {
        Expr::BetaDeviate {
            alpha: Box::new(Expr::Constant(alpha)),
            beta: Box::new(Expr::Constant(beta)),
        }
    }

    pub fn triangular(lower: f64, mode: f64, upper: f64) -> Expr {
        Expr::TriangularDeviate {
            lower: Box::new(Expr::Constant(lower)),
            mode: Box::new(Expr::Constant(mode)),
            upper: Box::new(Expr::Constant(upper)),
        }
    }
}

fn bool_value(condition: bool) -> f64 {
    if condition {
        1.0
    } else {
        0.0
    }
}

pub(crate) fn inverse_normal_cdf(p: f64) -> f64 {
    const A: [f64; 6] = [
        -3.969683028665376e+01,
        2.209460984245205e+02,
        -2.759285104469687e+02,
        1.38357751867269e+02,
        -3.066479806614716e+01,
        2.506628277459239e+00,
    ];
    const B: [f64; 5] = [
        -5.447609879822406e+01,
        1.615858368580409e+02,
        -1.556989798598866e+02,
        6.680131188771972e+01,
        -1.328068155288572e+01,
    ];
    const C: [f64; 6] = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e+00,
        -2.549732539343734e+00,
        4.374664141464968e+00,
        2.938163982698783e+00,
    ];
    const D: [f64; 4] = [
        7.784695709041462e-03,
        3.224671290700398e-01,
        2.445134137142996e+00,
        3.754408661907416e+00,
    ];
    let plow = 0.02425;
    let phigh = 1.0 - plow;
    if p <= 0.0 {
        f64::NEG_INFINITY
    } else if p >= 1.0 {
        f64::INFINITY
    } else if p < plow {
        let q = (-2.0 * p.ln()).sqrt();
        (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5])
            / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1.0)
    } else if p <= phigh {
        let q = p - 0.5;
        let r = q * q;
        (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q
            / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1.0)
    } else {
        let q = (-2.0 * (1.0 - p).ln()).sqrt();
        -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5])
            / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1.0)
    }
}

fn sample_triangular<R: Rng>(lower: f64, mode: f64, upper: f64, rng: &mut R) -> f64 {
    let span = upper - lower;
    if span <= 0.0 {
        return lower;
    }
    let split = (mode - lower) / span;
    let u: f64 = rng.gen();
    if u < split {
        lower + (u * span * (mode - lower)).sqrt()
    } else {
        upper - ((1.0 - u) * span * (upper - mode)).sqrt()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand_chacha::ChaCha8Rng;

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
    fn exponential_uses_mission_time() {
        let params = empty();
        let ctx = EvalContext::new(&params, 100.0, 100.0);
        let expr = Expr::Exponential {
            lambda: b(Expr::Constant(0.001)),
            time: b(Expr::MissionTime),
        };
        let expected = 1.0 - (-0.001f64 * 100.0).exp();
        assert!((expr.evaluate(&ctx).unwrap() - expected).abs() < 1e-12);
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
    fn deviate_evaluate_returns_mean() {
        let params = empty();
        let ctx = EvalContext::new(&params, 1.0, 1.0);
        let beta = Expr::BetaDeviate {
            alpha: b(Expr::Constant(2.0)),
            beta: b(Expr::Constant(8.0)),
        };
        assert!((beta.evaluate(&ctx).unwrap() - 0.2).abs() < 1e-12);
        let gamma = Expr::GammaDeviate {
            shape: b(Expr::Constant(4.0)),
            rate: b(Expr::Constant(2.0)),
        };
        assert!((gamma.evaluate(&ctx).unwrap() - 2.0).abs() < 1e-12);
        let lognormal = Expr::LognormalDeviate {
            mu: b(Expr::Constant(0.0)),
            sigma: b(Expr::Constant(0.5)),
        };
        assert!((lognormal.evaluate(&ctx).unwrap() - (0.5f64 * 0.5 / 2.0).exp()).abs() < 1e-12);
    }

    #[test]
    fn deviate_sample_is_within_support() {
        let params = empty();
        let ctx = EvalContext::new(&params, 1.0, 1.0);
        let mut rng = ChaCha8Rng::seed_from_u64(7);
        let beta = Expr::BetaDeviate {
            alpha: b(Expr::Constant(2.0)),
            beta: b(Expr::Constant(8.0)),
        };
        for _ in 0..1000 {
            let value = beta.sample(&ctx, &mut rng).unwrap();
            assert!((0.0..=1.0).contains(&value));
        }
    }

    #[test]
    fn histogram_mean_matches_weighted_midpoints() {
        let params = empty();
        let ctx = EvalContext::new(&params, 1.0, 1.0);
        let hist = Expr::Histogram {
            boundaries: vec![
                Expr::Constant(0.0),
                Expr::Constant(0.2),
                Expr::Constant(0.4),
            ],
            weights: vec![Expr::Constant(1.0), Expr::Constant(3.0)],
        };
        let expected = (0.1 * 1.0 + 0.3 * 3.0) / 4.0;
        assert!((hist.evaluate(&ctx).unwrap() - expected).abs() < 1e-12);
    }

    #[test]
    fn correlated_context_shares_parameter_draws() {
        let mut params = empty();
        params.insert("p".to_string(), Expr::uniform(0.0, 1.0));

        let correlated = EvalContext::correlated(&params, 1.0);
        let mut rng = ChaCha8Rng::seed_from_u64(1);
        let first = Expr::Parameter("p".to_string())
            .sample(&correlated, &mut rng)
            .unwrap();
        let second = Expr::Parameter("p".to_string())
            .sample(&correlated, &mut rng)
            .unwrap();
        assert_eq!(first, second);

        let independent = EvalContext::new(&params, 1.0, 1.0);
        let mut rng2 = ChaCha8Rng::seed_from_u64(1);
        let a = Expr::Parameter("p".to_string())
            .sample(&independent, &mut rng2)
            .unwrap();
        let bb = Expr::Parameter("p".to_string())
            .sample(&independent, &mut rng2)
            .unwrap();
        assert_ne!(a, bb);
    }
}
