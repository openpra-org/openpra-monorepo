use rand::seq::SliceRandom;
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;
use statrs::distribution::{
    Beta as BetaLaw, Continuous, ContinuousCDF, Exp, Gamma as GammaLaw, Normal, Weibull as WeibullLaw,
};
use statrs::function::erf::erfc;

use crate::expression::expr::LOGNORMAL_EF_QUANTILE;
use crate::{PraxisError, Result};

const MAX_SAMPLES: usize = 1_000_000;
const MAX_CURVE_POINTS: usize = 1001;
const MAX_INTERVALS: usize = 4000;
const RELATIVE_TOLERANCE: f64 = 1e-12;
const ABSOLUTE_TOLERANCE: f64 = 1e-300;
const SAMPLE_FLOOR: f64 = 1e-16;
const BREAKPOINT_PROBABILITIES: [f64; 11] = [
    1e-8, 1e-4, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 0.9999, 0.999_999_99,
];

const KRONROD_NODES: [f64; 11] = [
    0.995_657_163_025_808_1,
    0.973_906_528_517_171_7,
    0.930_157_491_355_708_2,
    0.865_063_366_688_984_5,
    0.780_817_726_586_416_9,
    0.679_409_568_299_024_4,
    0.562_757_134_668_604_7,
    0.433_395_394_129_247_2,
    0.294_392_862_701_460_2,
    0.148_874_338_981_631_2,
    0.0,
];
const KRONROD_WEIGHTS: [f64; 11] = [
    0.011_694_638_867_371_874,
    0.032_558_162_307_964_73,
    0.054_755_896_574_351_996,
    0.075_039_674_810_919_95,
    0.093_125_454_583_697_6,
    0.109_387_158_802_297_64,
    0.123_491_976_262_065_85,
    0.134_709_217_311_473_33,
    0.142_775_938_577_060_08,
    0.147_739_104_901_338_49,
    0.149_445_554_002_916_9,
];
const GAUSS_WEIGHTS: [f64; 5] = [
    0.066_671_344_308_688_14,
    0.149_451_349_150_580_6,
    0.219_086_362_515_982_04,
    0.269_266_719_309_996_35,
    0.295_524_224_714_752_87,
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum LoadCapacityLaw {
    Point { value: f64 },
    Normal { mean: f64, std_dev: f64 },
    Lognormal { median: f64, error_factor: f64 },
    Uniform { lower: f64, upper: f64 },
    Exponential { rate: f64 },
    Weibull { scale: f64, shape: f64, location: f64 },
    Gamma { shape: f64, rate: f64 },
    Beta { alpha: f64, beta: f64 },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LawParameter {
    Value,
    Mean,
    StdDev,
    Median,
    ErrorFactor,
    Lower,
    Upper,
    Rate,
    Scale,
    Shape,
    Location,
    Alpha,
    Beta,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LoadCapacitySide {
    Load,
    Capacity,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Sampling {
    MonteCarlo,
    LatinHypercube,
}

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
pub struct UncertainParameter {
    pub side: LoadCapacitySide,
    pub parameter: LawParameter,
    pub law: LoadCapacityLaw,
    pub correlation_key: Option<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct LoadCapacityModel {
    pub load: LoadCapacityLaw,
    pub capacity: LoadCapacityLaw,
    pub uncertain: Vec<UncertainParameter>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LoadCapacitySettings {
    pub sampling: Sampling,
    pub samples: usize,
    pub seed: u64,
    pub curve_points: usize,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FailureProbability {
    pub probability: f64,
    pub method: IntegrationMethod,
    pub error: Option<f64>,
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
    pub sampling: Sampling,
    pub samples: usize,
    pub seed: u64,
    pub summary: SampleSummary,
    pub largest_quadrature_error: Option<f64>,
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
    pub uncertainty: Option<LoadCapacityUncertainty>,
    pub curve: Vec<CurvePoint>,
}

enum Prepared {
    Point(f64),
    Normal(Normal),
    Lognormal { mu: f64, sigma: f64 },
    Uniform { lower: f64, upper: f64 },
    Exponential(Exp),
    Weibull { law: WeibullLaw, location: f64 },
    Gamma(GammaLaw),
    Beta(BetaLaw),
}

fn invalid(message: String) -> PraxisError {
    PraxisError::Settings(message)
}

fn standard_normal_cdf(z: f64) -> f64 {
    0.5 * erfc(-z / std::f64::consts::SQRT_2)
}

fn standard_normal_sf(z: f64) -> f64 {
    0.5 * erfc(z / std::f64::consts::SQRT_2)
}

fn standard_normal_quantile(p: f64) -> f64 {
    let normal = Normal::new(0.0, 1.0).expect("the standard normal is valid");
    normal.inverse_cdf(p)
}

fn finite(value: f64, name: &str, label: &str) -> Result<()> {
    if value.is_finite() {
        Ok(())
    } else {
        Err(invalid(format!("{label} {name} must be finite")))
    }
}

fn positive(value: f64, name: &str, label: &str) -> Result<()> {
    if value.is_finite() && value > 0.0 {
        Ok(())
    } else {
        Err(invalid(format!("{label} {name} must be positive, not {value}")))
    }
}

impl LoadCapacityLaw {
    pub fn validate(&self, label: &str) -> Result<()> {
        match *self {
            LoadCapacityLaw::Point { value } => finite(value, "value", label),
            LoadCapacityLaw::Normal { mean, std_dev } => {
                finite(mean, "mean", label)?;
                if std_dev.is_finite() && std_dev >= 0.0 {
                    Ok(())
                } else {
                    Err(invalid(format!("{label} stdDev must be zero or positive, not {std_dev}")))
                }
            }
            LoadCapacityLaw::Lognormal { median, error_factor } => {
                positive(median, "median", label)?;
                if error_factor.is_finite() && error_factor >= 1.0 {
                    Ok(())
                } else {
                    Err(invalid(format!("{label} errorFactor must be at least 1, not {error_factor}")))
                }
            }
            LoadCapacityLaw::Uniform { lower, upper } => {
                finite(lower, "lower", label)?;
                finite(upper, "upper", label)?;
                if upper >= lower {
                    Ok(())
                } else {
                    Err(invalid(format!("{label} upper must not be below lower")))
                }
            }
            LoadCapacityLaw::Exponential { rate } => positive(rate, "rate", label),
            LoadCapacityLaw::Weibull { scale, shape, location } => {
                positive(scale, "scale", label)?;
                positive(shape, "shape", label)?;
                finite(location, "location", label)
            }
            LoadCapacityLaw::Gamma { shape, rate } => {
                positive(shape, "shape", label)?;
                positive(rate, "rate", label)
            }
            LoadCapacityLaw::Beta { alpha, beta } => {
                positive(alpha, "alpha", label)?;
                positive(beta, "beta", label)
            }
        }
    }

    fn normalized(self) -> Self {
        match self {
            LoadCapacityLaw::Normal { mean, std_dev } if std_dev == 0.0 => LoadCapacityLaw::Point { value: mean },
            LoadCapacityLaw::Lognormal { median, error_factor } if error_factor == 1.0 => LoadCapacityLaw::Point { value: median },
            LoadCapacityLaw::Uniform { lower, upper } if lower == upper => LoadCapacityLaw::Point { value: lower },
            other => other,
        }
    }

    pub fn with(self, parameter: LawParameter, value: f64) -> Result<Self> {
        let law = match (self, parameter) {
            (LoadCapacityLaw::Point { .. }, LawParameter::Value) => LoadCapacityLaw::Point { value },
            (LoadCapacityLaw::Normal { std_dev, .. }, LawParameter::Mean) => LoadCapacityLaw::Normal { mean: value, std_dev },
            (LoadCapacityLaw::Normal { mean, .. }, LawParameter::StdDev) => LoadCapacityLaw::Normal { mean, std_dev: value },
            (LoadCapacityLaw::Lognormal { error_factor, .. }, LawParameter::Median) => LoadCapacityLaw::Lognormal { median: value, error_factor },
            (LoadCapacityLaw::Lognormal { median, .. }, LawParameter::ErrorFactor) => LoadCapacityLaw::Lognormal { median, error_factor: value },
            (LoadCapacityLaw::Uniform { upper, .. }, LawParameter::Lower) => LoadCapacityLaw::Uniform { lower: value, upper },
            (LoadCapacityLaw::Uniform { lower, .. }, LawParameter::Upper) => LoadCapacityLaw::Uniform { lower, upper: value },
            (LoadCapacityLaw::Exponential { .. }, LawParameter::Rate) => LoadCapacityLaw::Exponential { rate: value },
            (LoadCapacityLaw::Weibull { shape, location, .. }, LawParameter::Scale) => LoadCapacityLaw::Weibull { scale: value, shape, location },
            (LoadCapacityLaw::Weibull { scale, location, .. }, LawParameter::Shape) => LoadCapacityLaw::Weibull { scale, shape: value, location },
            (LoadCapacityLaw::Weibull { scale, shape, .. }, LawParameter::Location) => LoadCapacityLaw::Weibull { scale, shape, location: value },
            (LoadCapacityLaw::Gamma { rate, .. }, LawParameter::Shape) => LoadCapacityLaw::Gamma { shape: value, rate },
            (LoadCapacityLaw::Gamma { shape, .. }, LawParameter::Rate) => LoadCapacityLaw::Gamma { shape, rate: value },
            (LoadCapacityLaw::Beta { beta, .. }, LawParameter::Alpha) => LoadCapacityLaw::Beta { alpha: value, beta },
            (LoadCapacityLaw::Beta { alpha, .. }, LawParameter::Beta) => LoadCapacityLaw::Beta { alpha, beta: value },
            (law, parameter) => {
                return Err(invalid(format!(
                    "parameter {parameter:?} does not belong to a {} distribution",
                    law.kind_name()
                )))
            }
        };
        Ok(law)
    }

    fn kind_name(&self) -> &'static str {
        match self {
            LoadCapacityLaw::Point { .. } => "point",
            LoadCapacityLaw::Normal { .. } => "normal",
            LoadCapacityLaw::Lognormal { .. } => "lognormal",
            LoadCapacityLaw::Uniform { .. } => "uniform",
            LoadCapacityLaw::Exponential { .. } => "exponential",
            LoadCapacityLaw::Weibull { .. } => "Weibull",
            LoadCapacityLaw::Gamma { .. } => "gamma",
            LoadCapacityLaw::Beta { .. } => "beta",
        }
    }

    fn prepare(self) -> Result<Prepared> {
        let failed = |error: statrs::StatsError| invalid(format!("invalid {} distribution: {error}", self.kind_name()));
        Ok(match self.normalized() {
            LoadCapacityLaw::Point { value } => Prepared::Point(value),
            LoadCapacityLaw::Normal { mean, std_dev } => Prepared::Normal(Normal::new(mean, std_dev).map_err(failed)?),
            LoadCapacityLaw::Lognormal { median, error_factor } => Prepared::Lognormal {
                mu: median.ln(),
                sigma: error_factor.ln() / LOGNORMAL_EF_QUANTILE,
            },
            LoadCapacityLaw::Uniform { lower, upper } => Prepared::Uniform { lower, upper },
            LoadCapacityLaw::Exponential { rate } => Prepared::Exponential(Exp::new(rate).map_err(failed)?),
            LoadCapacityLaw::Weibull { scale, shape, location } => Prepared::Weibull {
                law: WeibullLaw::new(shape, scale).map_err(failed)?,
                location,
            },
            LoadCapacityLaw::Gamma { shape, rate } => Prepared::Gamma(GammaLaw::new(shape, rate).map_err(failed)?),
            LoadCapacityLaw::Beta { alpha, beta } => Prepared::Beta(BetaLaw::new(alpha, beta).map_err(failed)?),
        })
    }
}

impl Prepared {
    fn support(&self) -> (f64, f64) {
        match self {
            Prepared::Point(value) => (*value, *value),
            Prepared::Normal(_) => (f64::NEG_INFINITY, f64::INFINITY),
            Prepared::Lognormal { .. } | Prepared::Exponential(_) | Prepared::Gamma(_) => (0.0, f64::INFINITY),
            Prepared::Uniform { lower, upper } => (*lower, *upper),
            Prepared::Weibull { location, .. } => (*location, f64::INFINITY),
            Prepared::Beta(_) => (0.0, 1.0),
        }
    }

    fn pdf(&self, x: f64) -> f64 {
        let (low, high) = self.support();
        if x < low || x > high {
            return 0.0;
        }
        match self {
            Prepared::Point(_) => 0.0,
            Prepared::Normal(law) => law.pdf(x),
            Prepared::Lognormal { mu, sigma } => {
                if x <= 0.0 {
                    return 0.0;
                }
                let z = (x.ln() - mu) / sigma;
                (-0.5 * z * z).exp() / (x * sigma * (2.0 * std::f64::consts::PI).sqrt())
            }
            Prepared::Uniform { lower, upper } => 1.0 / (upper - lower),
            Prepared::Exponential(law) => law.pdf(x),
            Prepared::Weibull { law, location } => law.pdf(x - location),
            Prepared::Gamma(law) => law.pdf(x),
            Prepared::Beta(law) => law.pdf(x),
        }
    }

    fn cdf(&self, x: f64) -> f64 {
        match self {
            Prepared::Point(value) => {
                if x >= *value {
                    1.0
                } else {
                    0.0
                }
            }
            Prepared::Normal(law) => law.cdf(x),
            Prepared::Lognormal { mu, sigma } => {
                if x <= 0.0 {
                    0.0
                } else {
                    standard_normal_cdf((x.ln() - mu) / sigma)
                }
            }
            Prepared::Uniform { lower, upper } => ((x - lower) / (upper - lower)).clamp(0.0, 1.0),
            Prepared::Exponential(law) => law.cdf(x),
            Prepared::Weibull { law, location } => law.cdf(x - location),
            Prepared::Gamma(law) => law.cdf(x),
            Prepared::Beta(law) => law.cdf(x.clamp(0.0, 1.0)),
        }
    }

    fn sf(&self, x: f64) -> f64 {
        match self {
            Prepared::Point(value) => {
                if x >= *value {
                    0.0
                } else {
                    1.0
                }
            }
            Prepared::Normal(law) => law.sf(x),
            Prepared::Lognormal { mu, sigma } => {
                if x <= 0.0 {
                    1.0
                } else {
                    standard_normal_sf((x.ln() - mu) / sigma)
                }
            }
            Prepared::Uniform { lower, upper } => ((upper - x) / (upper - lower)).clamp(0.0, 1.0),
            Prepared::Exponential(law) => law.sf(x),
            Prepared::Weibull { law, location } => law.sf(x - location),
            Prepared::Gamma(law) => law.sf(x),
            Prepared::Beta(law) => law.sf(x.clamp(0.0, 1.0)),
        }
    }

    fn quantile(&self, p: f64) -> f64 {
        match self {
            Prepared::Point(value) => *value,
            Prepared::Normal(law) => law.inverse_cdf(p),
            Prepared::Lognormal { mu, sigma } => (mu + sigma * standard_normal_quantile(p)).exp(),
            Prepared::Uniform { lower, upper } => lower + p * (upper - lower),
            Prepared::Exponential(law) => -(-p).ln_1p() / law.rate(),
            Prepared::Weibull { law, location } => location + law.scale() * (-(-p).ln_1p()).powf(1.0 / law.shape()),
            Prepared::Gamma(_) | Prepared::Beta(_) => self.inverted_quantile(p),
        }
    }

    fn inverted_quantile(&self, p: f64) -> f64 {
        let (low, high) = self.support();
        let mut lower = low;
        let mut upper = if high.is_finite() { high } else { 1.0 };
        if !high.is_finite() {
            while self.cdf(upper) < p {
                lower = upper;
                upper *= 2.0;
                if !upper.is_finite() {
                    return f64::INFINITY;
                }
            }
        }
        for _ in 0..200 {
            let middle = 0.5 * (lower + upper);
            if middle <= lower || middle >= upper {
                break;
            }
            if self.cdf(middle) < p {
                lower = middle;
            } else {
                upper = middle;
            }
        }
        0.5 * (lower + upper)
    }
}

fn kronrod(integrand: &dyn Fn(f64) -> f64, a: f64, b: f64) -> (f64, f64) {
    let center = 0.5 * (a + b);
    let half = 0.5 * (b - a);
    let middle = integrand(center);
    let mut kronrod_sum = KRONROD_WEIGHTS[10] * middle;
    let mut gauss_sum = 0.0;
    for (index, weight) in GAUSS_WEIGHTS.iter().enumerate() {
        let node = 2 * index + 1;
        let offset = half * KRONROD_NODES[node];
        let pair = integrand(center - offset) + integrand(center + offset);
        gauss_sum += weight * pair;
        kronrod_sum += KRONROD_WEIGHTS[node] * pair;
    }
    for index in 0..5 {
        let node = 2 * index;
        let offset = half * KRONROD_NODES[node];
        let pair = integrand(center - offset) + integrand(center + offset);
        kronrod_sum += KRONROD_WEIGHTS[node] * pair;
    }
    (kronrod_sum * half, ((kronrod_sum - gauss_sum) * half).abs())
}

fn adaptive(integrand: &dyn Fn(f64) -> f64, pieces: &[(f64, f64)]) -> (f64, f64) {
    let mut intervals: Vec<(f64, f64, f64, f64)> = pieces
        .iter()
        .filter(|(a, b)| b > a)
        .map(|&(a, b)| {
            let (value, error) = kronrod(integrand, a, b);
            (a, b, value, error)
        })
        .collect();
    loop {
        let total: f64 = intervals.iter().map(|interval| interval.2).sum();
        let error: f64 = intervals.iter().map(|interval| interval.3).sum();
        if error <= ABSOLUTE_TOLERANCE.max(RELATIVE_TOLERANCE * total.abs()) || intervals.len() >= MAX_INTERVALS {
            return (total, error);
        }
        let Some((worst, _)) = intervals
            .iter()
            .enumerate()
            .max_by(|left, right| left.1 .3.total_cmp(&right.1 .3))
        else {
            return (total, error);
        };
        let (a, b, _, _) = intervals.swap_remove(worst);
        let middle = 0.5 * (a + b);
        if middle <= a || middle >= b {
            return (total, error);
        }
        let (left, left_error) = kronrod(integrand, a, middle);
        let (right, right_error) = kronrod(integrand, middle, b);
        intervals.push((a, middle, left, left_error));
        intervals.push((middle, b, right, right_error));
    }
}

fn quadrature(load: &Prepared, capacity: &Prepared) -> (f64, f64) {
    let (load_low, load_high) = load.support();
    let (capacity_low, _) = capacity.support();
    let low = load_low.max(capacity_low);
    let high = load_high;
    if low >= high {
        return (0.0, 0.0);
    }
    let mut breakpoints: Vec<f64> = BREAKPOINT_PROBABILITIES
        .iter()
        .flat_map(|&p| [load.quantile(p), capacity.quantile(p)])
        .filter(|x| x.is_finite() && *x > low && *x < high)
        .collect();
    breakpoints.sort_by(f64::total_cmp);
    breakpoints.dedup();
    if breakpoints.is_empty() {
        let anchor = match (low.is_finite(), high.is_finite()) {
            (true, true) => 0.5 * (low + high),
            (true, false) => low + 1.0,
            (false, true) => high - 1.0,
            (false, false) => 0.0,
        };
        breakpoints.push(anchor);
    }
    let integrand = |x: f64| -> f64 {
        let density = load.pdf(x);
        if density == 0.0 {
            0.0
        } else {
            density * capacity.cdf(x)
        }
    };
    let mut total = 0.0;
    let mut error = 0.0;
    let mut finite_pieces: Vec<(f64, f64)> = Vec::new();
    let first = breakpoints.first().copied().unwrap_or(low);
    let last = breakpoints.last().copied().unwrap_or(high);
    if low.is_finite() {
        finite_pieces.push((low, first));
    } else {
        let lower_tail = |t: f64| -> f64 {
            let x = first - t / (1.0 - t);
            integrand(x) / ((1.0 - t) * (1.0 - t))
        };
        let (value, tail_error) = adaptive(&lower_tail, &[(0.0, 1.0)]);
        total += value;
        error += tail_error;
    }
    for pair in breakpoints.windows(2) {
        finite_pieces.push((pair[0], pair[1]));
    }
    if high.is_finite() {
        finite_pieces.push((last, high));
    } else {
        let upper_tail = |t: f64| -> f64 {
            let x = last + t / (1.0 - t);
            integrand(x) / ((1.0 - t) * (1.0 - t))
        };
        let (value, tail_error) = adaptive(&upper_tail, &[(0.0, 1.0)]);
        total += value;
        error += tail_error;
    }
    let (value, body_error) = adaptive(&integrand, &finite_pieces);
    ((total + value).clamp(0.0, 1.0), error + body_error)
}

pub fn failure_probability(load: &LoadCapacityLaw, capacity: &LoadCapacityLaw) -> Result<FailureProbability> {
    load.validate("load")?;
    capacity.validate("capacity")?;
    let exact = |probability: f64, method: IntegrationMethod| FailureProbability { probability, method, error: None };
    Ok(match (load.normalized(), capacity.normalized()) {
        (LoadCapacityLaw::Point { value: x }, LoadCapacityLaw::Point { value: c }) => {
            exact(if c < x { 1.0 } else { 0.0 }, IntegrationMethod::PointBoth)
        }
        (LoadCapacityLaw::Point { value }, other) => exact(other.prepare()?.cdf(value), IntegrationMethod::PointLoad),
        (other, LoadCapacityLaw::Point { value }) => exact(other.prepare()?.sf(value), IntegrationMethod::PointCapacity),
        (
            LoadCapacityLaw::Lognormal { median: load_median, error_factor: load_factor },
            LoadCapacityLaw::Lognormal { median: capacity_median, error_factor: capacity_factor },
        ) => {
            let load_sigma = load_factor.ln() / LOGNORMAL_EF_QUANTILE;
            let capacity_sigma = capacity_factor.ln() / LOGNORMAL_EF_QUANTILE;
            let z = (load_median.ln() - capacity_median.ln()) / load_sigma.hypot(capacity_sigma);
            exact(standard_normal_cdf(z), IntegrationMethod::ClosedFormLognormal)
        }
        (
            LoadCapacityLaw::Normal { mean: load_mean, std_dev: load_sd },
            LoadCapacityLaw::Normal { mean: capacity_mean, std_dev: capacity_sd },
        ) => {
            let z = (load_mean - capacity_mean) / load_sd.hypot(capacity_sd);
            exact(standard_normal_cdf(z), IntegrationMethod::ClosedFormNormal)
        }
        (load_law, capacity_law) => {
            let (probability, error) = quadrature(&load_law.prepare()?, &capacity_law.prepare()?);
            FailureProbability { probability, method: IntegrationMethod::Quadrature, error: Some(error) }
        }
    })
}

pub fn integrate_numerically(load: &LoadCapacityLaw, capacity: &LoadCapacityLaw) -> Result<FailureProbability> {
    load.validate("load")?;
    capacity.validate("capacity")?;
    let (probability, error) = quadrature(&load.prepare()?, &capacity.prepare()?);
    Ok(FailureProbability { probability, method: IntegrationMethod::Quadrature, error: Some(error) })
}

fn percentile(sorted: &[f64], p: f64) -> f64 {
    let position = (sorted.len() - 1) as f64 * p;
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

fn draw_uniforms(sampling: Sampling, samples: usize, dimensions: usize, seed: u64) -> Vec<Vec<f64>> {
    let mut rng = ChaCha8Rng::seed_from_u64(seed);
    let mut rows = vec![vec![0.0; dimensions]; samples];
    for dimension in 0..dimensions {
        match sampling {
            Sampling::MonteCarlo => {
                for row in rows.iter_mut() {
                    row[dimension] = rng.gen::<f64>();
                }
            }
            Sampling::LatinHypercube => {
                let mut strata: Vec<usize> = (0..samples).collect();
                strata.shuffle(&mut rng);
                for (row, stratum) in rows.iter_mut().zip(strata) {
                    row[dimension] = (stratum as f64 + rng.gen::<f64>()) / samples as f64;
                }
            }
        }
    }
    for row in rows.iter_mut() {
        for value in row.iter_mut() {
            *value = value.clamp(SAMPLE_FLOOR, 1.0 - SAMPLE_FLOOR);
        }
    }
    rows
}

fn curve_grid(load: &LoadCapacityLaw, capacity: &LoadCapacityLaw, points: usize) -> Result<Vec<f64>> {
    let load_law = load.normalized();
    let capacity_law = capacity.normalized();
    let (low, high) = match (load_law, capacity_law) {
        (LoadCapacityLaw::Point { value: x }, LoadCapacityLaw::Point { value: c }) => (x.min(c), x.max(c)),
        (LoadCapacityLaw::Point { .. }, other) => {
            let prepared = other.prepare()?;
            (prepared.quantile(0.001), prepared.quantile(0.999))
        }
        (other, _) => {
            let prepared = other.prepare()?;
            (prepared.quantile(0.001), prepared.quantile(0.999))
        }
    };
    if !(low.is_finite() && high.is_finite()) {
        return Err(invalid("the load range for the failure curve is not finite".to_string()));
    }
    Ok((0..points)
        .map(|index| {
            if points == 1 {
                low
            } else {
                low + (high - low) * index as f64 / (points - 1) as f64
            }
        })
        .collect())
}

pub fn analyze(model: &LoadCapacityModel, settings: &LoadCapacitySettings) -> Result<LoadCapacityResult> {
    if settings.curve_points < 2 || settings.curve_points > MAX_CURVE_POINTS {
        return Err(invalid(format!("curve points must be between 2 and {MAX_CURVE_POINTS}")));
    }
    let point = failure_probability(&model.load, &model.capacity)?;
    let grid = curve_grid(&model.load, &model.capacity, settings.curve_points)?;
    let nominal_capacity = model.capacity.prepare()?;
    if model.uncertain.is_empty() {
        let curve = grid
            .iter()
            .map(|&load| CurvePoint { load, probability: nominal_capacity.cdf(load), band: None })
            .collect();
        return Ok(LoadCapacityResult { point, uncertainty: None, curve });
    }
    if settings.samples < 2 || settings.samples > MAX_SAMPLES {
        return Err(invalid(format!("samples must be between 2 and {MAX_SAMPLES}")));
    }
    let mut keys: Vec<Option<String>> = Vec::new();
    let mut dimension_of: Vec<usize> = Vec::with_capacity(model.uncertain.len());
    let mut laws: Vec<LoadCapacityLaw> = Vec::new();
    for parameter in &model.uncertain {
        parameter.law.validate("uncertain parameter")?;
        let shared = parameter
            .correlation_key
            .as_ref()
            .and_then(|key| keys.iter().position(|candidate| candidate.as_deref() == Some(key.as_str())));
        match shared {
            Some(dimension) => {
                if laws[dimension] != parameter.law {
                    return Err(invalid(format!(
                        "correlation key '{}' is shared by different distributions",
                        parameter.correlation_key.clone().unwrap_or_default()
                    )));
                }
                dimension_of.push(dimension);
            }
            None => {
                keys.push(parameter.correlation_key.clone());
                laws.push(parameter.law);
                dimension_of.push(laws.len() - 1);
            }
        }
    }
    let prepared: Vec<Prepared> = laws.iter().map(|law| law.prepare()).collect::<Result<_>>()?;
    let uniforms = draw_uniforms(settings.sampling, settings.samples, laws.len(), settings.seed);
    let mut probabilities = Vec::with_capacity(settings.samples);
    let mut curve_values = vec![Vec::with_capacity(settings.samples); grid.len()];
    let mut largest_error: Option<f64> = None;
    for (index, row) in uniforms.iter().enumerate() {
        let mut load = model.load;
        let mut capacity = model.capacity;
        for (parameter, &dimension) in model.uncertain.iter().zip(dimension_of.iter()) {
            let value = prepared[dimension].quantile(row[dimension]);
            match parameter.side {
                LoadCapacitySide::Load => load = load.with(parameter.parameter, value)?,
                LoadCapacitySide::Capacity => capacity = capacity.with(parameter.parameter, value)?,
            }
        }
        load.validate(&format!("sample {} load", index + 1))?;
        capacity.validate(&format!("sample {} capacity", index + 1))?;
        let sample = failure_probability(&load, &capacity)?;
        if let Some(error) = sample.error {
            largest_error = Some(largest_error.map_or(error, |current: f64| current.max(error)));
        }
        probabilities.push(sample.probability);
        let sampled_capacity = capacity.prepare()?;
        for (values, &x) in curve_values.iter_mut().zip(grid.iter()) {
            values.push(sampled_capacity.cdf(x));
        }
    }
    let summary = summarize(&probabilities)?;
    let curve = grid
        .iter()
        .zip(curve_values.iter())
        .map(|(&load, values)| {
            Ok(CurvePoint { load, probability: nominal_capacity.cdf(load), band: Some(summarize(values)?) })
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(LoadCapacityResult {
        point,
        uncertainty: Some(LoadCapacityUncertainty {
            sampling: settings.sampling,
            samples: settings.samples,
            seed: settings.seed,
            summary,
            largest_quadrature_error: largest_error,
        }),
        curve,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lognormal(median: f64, error_factor: f64) -> LoadCapacityLaw {
        LoadCapacityLaw::Lognormal { median, error_factor }
    }

    fn sigma(error_factor: f64) -> f64 {
        error_factor.ln() / LOGNORMAL_EF_QUANTILE
    }

    fn relative(a: f64, b: f64) -> f64 {
        if b == 0.0 {
            a.abs()
        } else {
            ((a - b) / b).abs()
        }
    }

    #[test]
    fn closed_forms_match_their_formulas() {
        let result = failure_probability(&lognormal(30.0, 1.5), &lognormal(48.0, 1.2)).unwrap();
        let z = (30.0_f64.ln() - 48.0_f64.ln()) / sigma(1.5).hypot(sigma(1.2));
        assert_eq!(result.method, IntegrationMethod::ClosedFormLognormal);
        assert!(relative(result.probability, standard_normal_cdf(z)) < 1e-15);

        let normal = failure_probability(
            &LoadCapacityLaw::Normal { mean: 10.0, std_dev: 2.0 },
            &LoadCapacityLaw::Normal { mean: 16.0, std_dev: 1.5 },
        )
        .unwrap();
        assert_eq!(normal.method, IntegrationMethod::ClosedFormNormal);
        assert!(relative(normal.probability, standard_normal_cdf(-6.0 / 2.5)) < 1e-15);

        let point_load = failure_probability(&LoadCapacityLaw::Point { value: 40.0 }, &lognormal(48.0, 1.2)).unwrap();
        assert_eq!(point_load.method, IntegrationMethod::PointLoad);
        let z = (40.0_f64.ln() - 48.0_f64.ln()) / sigma(1.2);
        assert!(relative(point_load.probability, standard_normal_cdf(z)) < 1e-15);

        let point_capacity = failure_probability(&lognormal(30.0, 1.5), &LoadCapacityLaw::Point { value: 48.0 }).unwrap();
        assert_eq!(point_capacity.method, IntegrationMethod::PointCapacity);
        let z = (48.0_f64.ln() - 30.0_f64.ln()) / sigma(1.5);
        assert!(relative(point_capacity.probability, standard_normal_sf(z)) < 1e-15);

        let both = failure_probability(&LoadCapacityLaw::Point { value: 2.0 }, &LoadCapacityLaw::Point { value: 1.0 }).unwrap();
        assert_eq!((both.probability, both.method), (1.0, IntegrationMethod::PointBoth));
        let tie = failure_probability(&LoadCapacityLaw::Point { value: 2.0 }, &LoadCapacityLaw::Point { value: 2.0 }).unwrap();
        assert_eq!(tie.probability, 0.0);
    }

    #[test]
    fn quadrature_reproduces_the_closed_forms_into_the_far_tail() {
        for (load, capacity) in [
            (lognormal(30.0, 1.5), lognormal(48.0, 1.2)),
            (lognormal(10.0, 2.0), lognormal(200.0, 1.5)),
            (lognormal(1.0, 1.3), lognormal(30.0, 1.4)),
        ] {
            let exact = failure_probability(&load, &capacity).unwrap().probability;
            let numeric = integrate_numerically(&load, &capacity).unwrap().probability;
            assert!(relative(numeric, exact) < 1e-9, "{numeric} vs {exact}");
        }
        let load = LoadCapacityLaw::Normal { mean: 10.0, std_dev: 2.0 };
        let capacity = LoadCapacityLaw::Normal { mean: 30.0, std_dev: 3.0 };
        let exact = failure_probability(&load, &capacity).unwrap().probability;
        let numeric = integrate_numerically(&load, &capacity).unwrap().probability;
        assert!(exact < 1e-7);
        assert!(relative(numeric, exact) < 1e-9, "{numeric} vs {exact}");
    }

    #[test]
    fn sampled_mean_converges_to_the_epistemic_closed_form() {
        let model = LoadCapacityModel {
            load: lognormal(30.0, 1.5),
            capacity: lognormal(48.0, 1.2),
            uncertain: vec![UncertainParameter {
                side: LoadCapacitySide::Capacity,
                parameter: LawParameter::Median,
                law: lognormal(48.0, 1.6),
                correlation_key: None,
            }],
        };
        let z = (30.0_f64.ln() - 48.0_f64.ln()) / (sigma(1.5).powi(2) + sigma(1.2).powi(2) + sigma(1.6).powi(2)).sqrt();
        let expected = standard_normal_cdf(z);
        for sampling in [Sampling::MonteCarlo, Sampling::LatinHypercube] {
            let result = analyze(
                &model,
                &LoadCapacitySettings { sampling, samples: 40_000, seed: 847, curve_points: 21 },
            )
            .unwrap();
            let uncertainty = result.uncertainty.unwrap();
            let standard_error = uncertainty.summary.standard_deviation / (uncertainty.samples as f64).sqrt();
            assert!((uncertainty.summary.mean - expected).abs() < 4.0 * standard_error, "{sampling:?}");
            assert!(uncertainty.summary.p05 <= uncertainty.summary.p50 && uncertainty.summary.p50 <= uncertainty.summary.p95);
            assert_eq!(result.curve.len(), 21);
        }
    }

    #[test]
    fn identical_seeds_repeat_and_shared_keys_draw_once() {
        let model = LoadCapacityModel {
            load: lognormal(30.0, 1.5),
            capacity: lognormal(48.0, 1.2),
            uncertain: vec![
                UncertainParameter { side: LoadCapacitySide::Load, parameter: LawParameter::Median, law: lognormal(30.0, 1.4), correlation_key: Some("k".into()) },
                UncertainParameter { side: LoadCapacitySide::Capacity, parameter: LawParameter::Median, law: lognormal(30.0, 1.4), correlation_key: Some("k".into()) },
            ],
        };
        let settings = LoadCapacitySettings { sampling: Sampling::LatinHypercube, samples: 200, seed: 7, curve_points: 5 };
        let first = analyze(&model, &settings).unwrap();
        let second = analyze(&model, &settings).unwrap();
        assert_eq!(first, second);
        let summary = first.uncertainty.unwrap().summary;
        assert!((summary.maximum - summary.minimum).abs() < 1e-15);
        let mut clashing = model.clone();
        clashing.uncertain[1].law = lognormal(31.0, 1.4);
        assert!(analyze(&clashing, &settings).is_err());
    }

    #[test]
    fn rejects_invalid_parameters_and_misplaced_uncertainty() {
        assert!(failure_probability(&lognormal(-1.0, 1.5), &lognormal(48.0, 1.2)).is_err());
        assert!(failure_probability(&lognormal(30.0, 0.5), &lognormal(48.0, 1.2)).is_err());
        let model = LoadCapacityModel {
            load: lognormal(30.0, 1.5),
            capacity: lognormal(48.0, 1.2),
            uncertain: vec![UncertainParameter {
                side: LoadCapacitySide::Load,
                parameter: LawParameter::Mean,
                law: lognormal(30.0, 1.4),
                correlation_key: None,
            }],
        };
        let settings = LoadCapacitySettings { sampling: Sampling::MonteCarlo, samples: 10, seed: 1, curve_points: 5 };
        assert!(analyze(&model, &settings).is_err());
    }
}
