use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Deserializer, Serialize};

use crate::error::{MefError, PraxisError, Result};

fn required_nullable<'de, D, T>(deserializer: D) -> std::result::Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UncertainUnit {
    Probability,
    Fraction,
    Factor,
    PerHour,
    PerYear,
    Hours,
    Minutes,
    Years,
    Quantity,
}

impl UncertainUnit {
    pub fn time_power(self) -> i8 {
        match self {
            UncertainUnit::Probability
            | UncertainUnit::Fraction
            | UncertainUnit::Factor
            | UncertainUnit::Quantity => 0,
            UncertainUnit::PerHour | UncertainUnit::PerYear => -1,
            UncertainUnit::Hours | UncertainUnit::Minutes | UncertainUnit::Years => 1,
        }
    }

    pub fn domain(self) -> (f64, f64) {
        match self {
            UncertainUnit::Probability | UncertainUnit::Fraction => (0.0, 1.0),
            UncertainUnit::Quantity => (f64::NEG_INFINITY, f64::INFINITY),
            _ => (0.0, f64::INFINITY),
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            UncertainUnit::Probability => "PROBABILITY",
            UncertainUnit::Fraction => "FRACTION",
            UncertainUnit::Factor => "FACTOR",
            UncertainUnit::PerHour => "PER_HOUR",
            UncertainUnit::PerYear => "PER_YEAR",
            UncertainUnit::Hours => "HOURS",
            UncertainUnit::Minutes => "MINUTES",
            UncertainUnit::Years => "YEARS",
            UncertainUnit::Quantity => "QUANTITY",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DiscreteOutcome {
    pub value: f64,
    pub weight: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct QuantilePoint {
    pub probability: f64,
    pub value: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TabulatedScale {
    Linear,
    Log,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum SampleSmoothing {
    None,
    GaussianKernel { bandwidth: f64 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MixtureComponent {
    pub weight: f64,
    pub law: Law,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CountLikelihood {
    Binomial,
    Poisson,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Likelihood {
    Binomial,
    Poisson,
    StandbyDemand,
    UncertainCount,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StandbyDemandKind {
    Test,
    Random,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CountEvidence {
    pub likelihood: CountLikelihood,
    pub failures: f64,
    pub exposure: f64,
}

impl CountEvidence {
    pub fn check_shape(&self) -> Result<()> {
        require(
            self.failures.is_finite() && self.failures >= 0.0,
            "Evidence failures must be zero or more",
        )?;
        require(
            self.exposure.is_finite() && self.exposure > 0.0,
            "Evidence exposure must be positive",
        )?;
        require(
            self.likelihood == CountLikelihood::Poisson || self.failures <= self.exposure,
            "Binomial evidence cannot have more failures than demands",
        )
    }

    pub fn term(&self) -> EvidenceTerm {
        match self.likelihood {
            CountLikelihood::Binomial => EvidenceTerm::Binomial {
                failures: self.failures,
                exposure: self.exposure,
            },
            CountLikelihood::Poisson => EvidenceTerm::Poisson {
                failures: self.failures,
                exposure: self.exposure,
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "likelihood",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum EvidenceTerm {
    Binomial {
        failures: f64,
        exposure: f64,
    },
    Poisson {
        failures: f64,
        exposure: f64,
    },
    StandbyDemand {
        demand: StandbyDemandKind,
        failures: f64,
        exposure: f64,
        test_interval: f64,
    },
    UncertainCount {
        count: CountLikelihood,
        outcomes: Vec<DiscreteOutcome>,
        exposure: f64,
    },
}

impl EvidenceTerm {
    pub fn count(likelihood: CountLikelihood, failures: f64, exposure: f64) -> EvidenceTerm {
        CountEvidence {
            likelihood,
            failures,
            exposure,
        }
        .term()
    }

    pub fn likelihood(&self) -> Likelihood {
        match self {
            EvidenceTerm::Binomial { .. } => Likelihood::Binomial,
            EvidenceTerm::Poisson { .. } => Likelihood::Poisson,
            EvidenceTerm::StandbyDemand { .. } => Likelihood::StandbyDemand,
            EvidenceTerm::UncertainCount { .. } => Likelihood::UncertainCount,
        }
    }

    pub fn as_count(&self) -> Option<CountEvidence> {
        match self {
            EvidenceTerm::Binomial { failures, exposure } => Some(CountEvidence {
                likelihood: CountLikelihood::Binomial,
                failures: *failures,
                exposure: *exposure,
            }),
            EvidenceTerm::Poisson { failures, exposure } => Some(CountEvidence {
                likelihood: CountLikelihood::Poisson,
                failures: *failures,
                exposure: *exposure,
            }),
            _ => None,
        }
    }

    pub fn is_probability(&self) -> bool {
        matches!(
            self,
            EvidenceTerm::Binomial { .. }
                | EvidenceTerm::UncertainCount {
                    count: CountLikelihood::Binomial,
                    ..
                }
        )
    }

    pub fn check_shape(&self) -> Result<()> {
        match self {
            EvidenceTerm::Binomial { .. } | EvidenceTerm::Poisson { .. } => {
                self.as_count().map_or(Ok(()), |count| count.check_shape())
            }
            EvidenceTerm::StandbyDemand {
                failures,
                exposure,
                test_interval,
                ..
            } => {
                require(
                    failures.is_finite() && *failures >= 0.0,
                    "Evidence failures must be zero or more",
                )?;
                require(
                    exposure.is_finite() && *exposure > 0.0,
                    "Standby evidence needs a positive number of demands",
                )?;
                require(
                    failures <= exposure,
                    "Standby evidence cannot have more failures than demands",
                )?;
                require(
                    test_interval.is_finite() && *test_interval > 0.0,
                    "Standby evidence needs a positive test interval",
                )
            }
            EvidenceTerm::UncertainCount {
                count,
                outcomes,
                exposure,
            } => {
                require(
                    exposure.is_finite() && *exposure > 0.0,
                    "Evidence exposure must be positive",
                )?;
                require(!outcomes.is_empty(), "An uncertain count needs an outcome")?;
                require(
                    outcomes
                        .iter()
                        .all(|outcome| outcome.value.is_finite() && outcome.value >= 0.0),
                    "Uncertain count outcomes must be zero or more failures",
                )?;
                require(
                    outcomes
                        .iter()
                        .all(|outcome| outcome.weight.is_finite() && outcome.weight > 0.0),
                    "Uncertain count weights must be positive",
                )?;
                require(
                    *count == CountLikelihood::Poisson
                        || outcomes.iter().all(|outcome| outcome.value <= *exposure),
                    "An uncertain binomial count cannot have more failures than demands",
                )
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DurationModel {
    Exponential,
    Lognormal,
    Weibull,
    Gamma,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DurationParameter {
    Rate,
    Mu,
    Sigma,
    Shape,
    Scale,
}

impl DurationModel {
    pub fn parameters(self) -> &'static [DurationParameter] {
        match self {
            DurationModel::Exponential => &[DurationParameter::Rate],
            DurationModel::Lognormal => &[DurationParameter::Mu, DurationParameter::Sigma],
            DurationModel::Weibull => &[DurationParameter::Shape, DurationParameter::Scale],
            DurationModel::Gamma => &[DurationParameter::Shape, DurationParameter::Rate],
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            DurationModel::Exponential => "EXPONENTIAL",
            DurationModel::Lognormal => "LOGNORMAL",
            DurationModel::Weibull => "WEIBULL",
            DurationModel::Gamma => "GAMMA",
        }
    }
}

impl DurationParameter {
    pub fn positive(self) -> bool {
        self != DurationParameter::Mu
    }

    pub fn label(self) -> &'static str {
        match self {
            DurationParameter::Rate => "RATE",
            DurationParameter::Mu => "MU",
            DurationParameter::Sigma => "SIGMA",
            DurationParameter::Shape => "SHAPE",
            DurationParameter::Scale => "SCALE",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DurationPrior {
    pub parameter: DurationParameter,
    pub law: Law,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum DurationOutput {
    Exceedance { time: f64 },
    Mean,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TrendBin {
    pub time: f64,
    pub failures: f64,
    pub exposure: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "family",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Law {
    Point {
        value: f64,
    },
    Beta {
        alpha: f64,
        beta: f64,
        lower: f64,
        upper: f64,
    },
    Gamma {
        shape: f64,
        rate: f64,
    },
    Lognormal {
        mean: f64,
        error_factor: f64,
        level: f64,
    },
    Normal {
        mean: f64,
        standard_deviation: f64,
    },
    StudentT {
        location: f64,
        scale: f64,
        degrees_of_freedom: f64,
    },
    LogitNormal {
        mu: f64,
        sigma: f64,
    },
    Uniform {
        lower: f64,
        upper: f64,
    },
    LogUniform {
        lower: f64,
        upper: f64,
    },
    Triangular {
        lower: f64,
        mode: f64,
        upper: f64,
    },
    LogTriangular {
        lower: f64,
        mode: f64,
        upper: f64,
    },
    Weibull {
        scale: f64,
        shape: f64,
        location: f64,
    },
    MaximumEntropy {
        lower: f64,
        mean: f64,
        upper: f64,
    },
    ConstrainedNoninformative {
        mean: f64,
    },
    Discrete {
        outcomes: Vec<DiscreteOutcome>,
    },
    Tabulated {
        points: Vec<QuantilePoint>,
        scale: TabulatedScale,
    },
    Metalog {
        points: Vec<QuantilePoint>,
        #[serde(deserialize_with = "required_nullable")]
        lower: Option<f64>,
        #[serde(deserialize_with = "required_nullable")]
        upper: Option<f64>,
    },
    Samples {
        values: Vec<f64>,
        weights: Vec<f64>,
        smoothing: SampleSmoothing,
    },
    Truncated {
        law: Box<Law>,
        #[serde(deserialize_with = "required_nullable")]
        lower: Option<f64>,
        #[serde(deserialize_with = "required_nullable")]
        upper: Option<f64>,
    },
    Mixture {
        components: Vec<MixtureComponent>,
    },
    Posterior {
        #[serde(deserialize_with = "required_nullable")]
        prior: Option<Box<Law>>,
        evidence: Vec<EvidenceTerm>,
    },
    Population {
        mu: Box<Law>,
        sigma: Box<Law>,
        #[serde(deserialize_with = "required_nullable")]
        upper: Option<f64>,
        evidence: Vec<EvidenceTerm>,
        #[serde(deserialize_with = "required_nullable")]
        target: Option<usize>,
    },
    EmpiricalBayes {
        evidence: Vec<CountEvidence>,
        #[serde(deserialize_with = "required_nullable")]
        target: Option<usize>,
    },
    Duration {
        model: DurationModel,
        times: Vec<f64>,
        censored: Vec<f64>,
        priors: Vec<DurationPrior>,
        output: DurationOutput,
    },
    Trend {
        bins: Vec<TrendBin>,
        at: f64,
    },
    Product {
        factors: Vec<Law>,
    },
}

fn shape_error(message: &str) -> PraxisError {
    PraxisError::Mef(MefError::Validity(message.to_string()))
}

fn meaning_error(message: String) -> PraxisError {
    PraxisError::Mef(MefError::Domain {
        message,
        value: None,
        attribute: None,
    })
}

fn require(condition: bool, message: &str) -> Result<()> {
    if condition {
        Ok(())
    } else {
        Err(shape_error(message))
    }
}

fn increasing_probabilities(points: &[QuantilePoint]) -> bool {
    points.windows(2).all(|pair| pair[1].probability > pair[0].probability)
}

fn nondecreasing_values(points: &[QuantilePoint]) -> bool {
    points.windows(2).all(|pair| pair[1].value >= pair[0].value)
}

fn increasing_values(points: &[QuantilePoint]) -> bool {
    points.windows(2).all(|pair| pair[1].value > pair[0].value)
}

fn optional_ordered(lower: Option<f64>, upper: Option<f64>) -> bool {
    match (lower, upper) {
        (Some(low), Some(high)) => low < high,
        _ => true,
    }
}

impl Law {
    pub fn family(&self) -> &'static str {
        match self {
            Law::Point { .. } => "POINT",
            Law::Beta { .. } => "BETA",
            Law::Gamma { .. } => "GAMMA",
            Law::Lognormal { .. } => "LOGNORMAL",
            Law::Normal { .. } => "NORMAL",
            Law::StudentT { .. } => "STUDENT_T",
            Law::LogitNormal { .. } => "LOGIT_NORMAL",
            Law::Uniform { .. } => "UNIFORM",
            Law::LogUniform { .. } => "LOG_UNIFORM",
            Law::Triangular { .. } => "TRIANGULAR",
            Law::LogTriangular { .. } => "LOG_TRIANGULAR",
            Law::Weibull { .. } => "WEIBULL",
            Law::MaximumEntropy { .. } => "MAXIMUM_ENTROPY",
            Law::ConstrainedNoninformative { .. } => "CONSTRAINED_NONINFORMATIVE",
            Law::Discrete { .. } => "DISCRETE",
            Law::Tabulated { .. } => "TABULATED",
            Law::Metalog { .. } => "METALOG",
            Law::Samples { .. } => "SAMPLES",
            Law::Truncated { .. } => "TRUNCATED",
            Law::Mixture { .. } => "MIXTURE",
            Law::Posterior { .. } => "POSTERIOR",
            Law::Population { .. } => "POPULATION",
            Law::EmpiricalBayes { .. } => "EMPIRICAL_BAYES",
            Law::Duration { .. } => "DURATION",
            Law::Trend { .. } => "TREND",
            Law::Product { .. } => "PRODUCT",
        }
    }

    fn is_updated(&self) -> bool {
        matches!(
            self,
            Law::Posterior { .. }
                | Law::Population { .. }
                | Law::EmpiricalBayes { .. }
                | Law::Duration { .. }
                | Law::Trend { .. }
        )
    }

    pub fn is_probability_output(&self) -> bool {
        match self {
            Law::Duration { output, .. } => matches!(output, DurationOutput::Exceedance { .. }),
            Law::EmpiricalBayes { evidence, .. } => evidence
                .first()
                .is_some_and(|term| term.likelihood == CountLikelihood::Binomial),
            _ => false,
        }
    }

    pub fn check_shape(&self) -> Result<()> {
        match self {
            Law::Point { .. } => Ok(()),
            Law::Beta {
                alpha,
                beta,
                lower,
                upper,
            } => {
                require(*alpha > 0.0 && *beta > 0.0, "Beta alpha and beta must be positive")?;
                require(lower < upper, "Beta lower bound must be below its upper bound")
            }
            Law::Gamma { shape, rate } => {
                require(*shape > 0.0 && *rate > 0.0, "Gamma shape and rate must be positive")
            }
            Law::Lognormal {
                mean,
                error_factor,
                level,
            } => {
                require(*mean > 0.0, "Lognormal mean must be positive")?;
                require(*error_factor > 1.0, "Lognormal error factor must exceed 1")?;
                require(
                    *level > 0.5 && *level < 1.0,
                    "Lognormal level lies between 0.5 and 1",
                )
            }
            Law::Normal {
                standard_deviation, ..
            } => require(
                *standard_deviation > 0.0,
                "Normal standard deviation must be positive",
            ),
            Law::StudentT {
                scale,
                degrees_of_freedom,
                ..
            } => require(
                *scale > 0.0 && *degrees_of_freedom > 0.0,
                "Student t scale and degrees of freedom must be positive",
            ),
            Law::LogitNormal { sigma, .. } => {
                require(*sigma > 0.0, "Logit-normal sigma must be positive")
            }
            Law::Uniform { lower, upper } => require(
                lower < upper,
                "Uniform lower bound must be below its upper bound",
            ),
            Law::LogUniform { lower, upper } => {
                require(
                    *lower > 0.0 && *upper > 0.0,
                    "Log-uniform bounds must be positive",
                )?;
                require(
                    lower < upper,
                    "Log-uniform lower bound must be below its upper bound",
                )
            }
            Law::Triangular { lower, mode, upper } => require(
                lower <= mode && mode <= upper && lower < upper,
                "Triangular needs lower <= mode <= upper with lower < upper",
            ),
            Law::LogTriangular { lower, mode, upper } => {
                require(
                    *lower > 0.0 && *mode > 0.0 && *upper > 0.0,
                    "Log-triangular values must be positive",
                )?;
                require(
                    lower <= mode && mode <= upper && lower < upper,
                    "Log-triangular needs lower <= mode <= upper with lower < upper",
                )
            }
            Law::Weibull { scale, shape, .. } => require(
                *scale > 0.0 && *shape > 0.0,
                "Weibull scale and shape must be positive",
            ),
            Law::MaximumEntropy { lower, mean, upper } => require(
                lower < mean && mean < upper,
                "Maximum entropy needs lower < mean < upper",
            ),
            Law::ConstrainedNoninformative { mean } => require(
                *mean > 0.0 && *mean < 1.0,
                "Constrained noninformative mean lies between 0 and 1",
            ),
            Law::Discrete { outcomes } => {
                require(!outcomes.is_empty(), "A discrete law needs an outcome")?;
                require(
                    outcomes.iter().all(|outcome| outcome.weight > 0.0),
                    "Discrete weights must be positive",
                )
            }
            Law::Tabulated { points, scale } => {
                require(points.len() >= 2, "A tabulated law needs two points")?;
                require(
                    points[0].probability == 0.0 && points[points.len() - 1].probability == 1.0,
                    "A tabulated law starts at probability 0 and ends at probability 1",
                )?;
                require(
                    increasing_probabilities(points),
                    "Tabulated probabilities must increase",
                )?;
                require(
                    nondecreasing_values(points),
                    "Tabulated values must not decrease",
                )?;
                require(
                    *scale == TabulatedScale::Linear || points[0].value > 0.0,
                    "A log-scale tabulated law needs positive values",
                )
            }
            Law::Metalog {
                points,
                lower,
                upper,
            } => {
                require(points.len() >= 2, "A metalog law needs two points")?;
                require(
                    points
                        .iter()
                        .all(|point| point.probability > 0.0 && point.probability < 1.0),
                    "Metalog probabilities lie strictly between 0 and 1",
                )?;
                require(
                    increasing_probabilities(points),
                    "Metalog probabilities must increase",
                )?;
                require(increasing_values(points), "Metalog values must increase")?;
                require(
                    lower.is_none_or(|low| low < points[0].value),
                    "Metalog lower bound must be below the first value",
                )?;
                require(
                    upper.is_none_or(|high| high > points[points.len() - 1].value),
                    "Metalog upper bound must be above the last value",
                )
            }
            Law::Samples {
                values,
                weights,
                smoothing,
            } => {
                require(!values.is_empty(), "A samples law needs a value")?;
                require(
                    weights.iter().all(|weight| *weight > 0.0),
                    "Sample weights must be positive",
                )?;
                require(
                    weights.is_empty() || weights.len() == values.len(),
                    "Sample weights are empty or one per value",
                )?;
                match smoothing {
                    SampleSmoothing::None => Ok(()),
                    SampleSmoothing::GaussianKernel { bandwidth } => {
                        require(*bandwidth > 0.0, "Kernel bandwidth must be positive")
                    }
                }
            }
            Law::Truncated { law, lower, upper } => {
                require(
                    !matches!(law.as_ref(), Law::Truncated { .. }) && !law.is_updated(),
                    "A truncated law wraps a base law or a mixture",
                )?;
                law.check_shape()?;
                require(
                    lower.is_some() || upper.is_some(),
                    "A truncated law needs at least one bound",
                )?;
                require(
                    optional_ordered(*lower, *upper),
                    "Truncation lower bound must be below its upper bound",
                )
            }
            Law::Mixture { components } => {
                require(components.len() >= 2, "A mixture needs two components")?;
                for component in components {
                    require(component.weight > 0.0, "Mixture weights must be positive")?;
                    require(
                        !matches!(component.law, Law::Mixture { .. }) && !component.law.is_updated(),
                        "A mixture holds base laws and truncated laws",
                    )?;
                    component.law.check_shape()?;
                }
                Ok(())
            }
            Law::Posterior { prior, evidence } => {
                require(!evidence.is_empty(), "A posterior needs evidence")?;
                evidence.iter().try_for_each(EvidenceTerm::check_shape)?;
                match prior {
                    Some(law) => {
                        require(
                            !law.is_updated(),
                            "A posterior prior is a base law, a truncated law or a mixture",
                        )?;
                        law.check_shape()
                    }
                    None => Ok(()),
                }
            }
            Law::EmpiricalBayes { evidence, target } => {
                require(
                    evidence.len() >= 2,
                    "Empirical Bayes needs two or more members",
                )?;
                evidence.iter().try_for_each(CountEvidence::check_shape)?;
                require(
                    evidence
                        .iter()
                        .all(|term| term.likelihood == evidence[0].likelihood),
                    "Empirical Bayes members share one likelihood. Fit binomial and Poisson members apart",
                )?;
                require(
                    target.is_none_or(|index| index < evidence.len()),
                    "An empirical Bayes target names one of its members",
                )
            }
            Law::Duration {
                model,
                times,
                censored,
                priors,
                output,
            } => {
                require(
                    !times.is_empty()
                        || model
                            .parameters()
                            .iter()
                            .all(|parameter| priors.iter().any(|prior| prior.parameter == *parameter)),
                    "A duration law needs a completed time or a prior on each parameter",
                )?;
                require(
                    times
                        .iter()
                        .chain(censored.iter())
                        .all(|time| time.is_finite() && *time > 0.0),
                    "Duration times must be positive hours",
                )?;
                let mut seen = HashSet::new();
                for prior in priors {
                    require(
                        model.parameters().contains(&prior.parameter),
                        "A duration prior names a parameter of its model",
                    )?;
                    require(
                        seen.insert(prior.parameter),
                        "Each duration parameter has at most one prior",
                    )?;
                    require(
                        !prior.law.is_updated() && !matches!(prior.law, Law::Mixture { .. }),
                        "A duration prior is a base law or a truncated law",
                    )?;
                    prior.law.check_shape()?;
                }
                match output {
                    DurationOutput::Exceedance { time } => require(
                        time.is_finite() && *time > 0.0,
                        "An exceedance needs a positive time",
                    ),
                    DurationOutput::Mean => Ok(()),
                }
            }
            Law::Trend { bins, at } => {
                require(at.is_finite(), "A trend needs a finite time to report")?;
                require(
                    bins.iter().all(|bin| {
                        bin.time.is_finite()
                            && bin.failures.is_finite()
                            && bin.failures >= 0.0
                            && bin.exposure.is_finite()
                            && bin.exposure > 0.0
                    }),
                    "Trend bins need finite times, zero or more failures and positive exposure",
                )?;
                require(
                    bins.iter().any(|bin| bin.time != bins[0].time),
                    "A trend needs bins at two or more times",
                )?;
                require(
                    bins.iter().any(|bin| bin.failures > 0.0),
                    "A trend needs at least one failure",
                )
            }
            Law::Product { factors } => {
                require(factors.len() >= 2, "A product law needs two or more factors")?;
                factors.iter().try_for_each(Law::check_shape)
            }
            Law::Population {
                mu,
                sigma,
                upper,
                evidence,
                target,
            } => {
                require(evidence.len() >= 2, "A population needs two evidence sets")?;
                evidence.iter().try_for_each(EvidenceTerm::check_shape)?;
                for hyperprior in [mu.as_ref(), sigma.as_ref()] {
                    require(
                        !hyperprior.is_updated() && !matches!(hyperprior, Law::Mixture { .. }),
                        "A population hyperprior is a base law or a truncated law",
                    )?;
                    hyperprior.check_shape()?;
                }
                require(
                    upper.is_none_or(|bound| bound > 0.0 && bound.is_finite()),
                    "A population upper bound must be positive",
                )?;
                require(
                    target.is_none_or(|index| index < evidence.len()),
                    "A population target names one of its evidence sets",
                )
            }
        }
    }

    pub fn check_meaning(&self) -> Result<()> {
        match self {
            Law::Truncated { law, .. } => law.check_meaning(),
            Law::Mixture { components } => components
                .iter()
                .try_for_each(|component| component.law.check_meaning()),
            Law::Posterior { prior, evidence } => {
                if let Some(law) = prior {
                    law.check_meaning()?;
                    let (low, high) = law.support();
                    if low < 0.0 {
                        return Err(meaning_error(format!(
                            "The {} prior of a posterior reaches below 0",
                            law.family()
                        )));
                    }
                    if high > 1.0 && evidence.iter().any(EvidenceTerm::is_probability) {
                        return Err(meaning_error(format!(
                            "The {} prior of a posterior with binomial evidence reaches above 1",
                            law.family()
                        )));
                    }
                }
                Ok(())
            }
            Law::Population {
                mu,
                sigma,
                upper,
                evidence,
                ..
            } => {
                mu.check_meaning()?;
                sigma.check_meaning()?;
                if sigma.support().0 < 0.0 {
                    return Err(meaning_error(
                        "The sigma hyperprior of a population reaches below 0".to_string(),
                    ));
                }
                if upper.is_none_or(|bound| bound > 1.0)
                    && evidence.iter().any(EvidenceTerm::is_probability)
                {
                    return Err(meaning_error(
                        "A population with binomial evidence needs an upper bound of at most 1"
                            .to_string(),
                    ));
                }
                Ok(())
            }
            Law::Duration { priors, .. } => {
                for prior in priors {
                    prior.law.check_meaning()?;
                    if prior.parameter.positive() && prior.law.support().0 < 0.0 {
                        return Err(meaning_error(format!(
                            "The {} prior on {} reaches below 0",
                            prior.law.family(),
                            prior.parameter.label()
                        )));
                    }
                }
                Ok(())
            }
            Law::Product { factors } => factors.iter().try_for_each(Law::check_meaning),
            _ => Ok(()),
        }
    }

    pub fn support(&self) -> (f64, f64) {
        match self {
            Law::Point { value } => (*value, *value),
            Law::Beta { lower, upper, .. }
            | Law::Uniform { lower, upper }
            | Law::LogUniform { lower, upper }
            | Law::Triangular { lower, upper, .. }
            | Law::LogTriangular { lower, upper, .. }
            | Law::MaximumEntropy { lower, upper, .. } => (*lower, *upper),
            Law::Gamma { .. } | Law::Lognormal { .. } => (0.0, f64::INFINITY),
            Law::Normal { .. } | Law::StudentT { .. } => (f64::NEG_INFINITY, f64::INFINITY),
            Law::LogitNormal { .. } | Law::ConstrainedNoninformative { .. } => (0.0, 1.0),
            Law::Weibull { location, .. } => (*location, f64::INFINITY),
            Law::Discrete { outcomes } => outcomes.iter().fold(
                (f64::INFINITY, f64::NEG_INFINITY),
                |(low, high), outcome| (low.min(outcome.value), high.max(outcome.value)),
            ),
            Law::Tabulated { points, .. } => (points[0].value, points[points.len() - 1].value),
            Law::Metalog { lower, upper, .. } => (
                lower.unwrap_or(f64::NEG_INFINITY),
                upper.unwrap_or(f64::INFINITY),
            ),
            Law::Samples {
                values, smoothing, ..
            } => match smoothing {
                SampleSmoothing::None => values.iter().fold(
                    (f64::INFINITY, f64::NEG_INFINITY),
                    |(low, high), value| (low.min(*value), high.max(*value)),
                ),
                SampleSmoothing::GaussianKernel { .. } => (f64::NEG_INFINITY, f64::INFINITY),
            },
            Law::Truncated { law, lower, upper } => {
                let (inner_low, inner_high) = law.support();
                (
                    lower.map_or(inner_low, |low| low.max(inner_low)),
                    upper.map_or(inner_high, |high| high.min(inner_high)),
                )
            }
            Law::Mixture { components } => components.iter().fold(
                (f64::INFINITY, f64::NEG_INFINITY),
                |(low, high), component| {
                    let (component_low, component_high) = component.law.support();
                    (low.min(component_low), high.max(component_high))
                },
            ),
            Law::Posterior { prior, evidence } => {
                let bounded = evidence.iter().any(EvidenceTerm::is_probability);
                match prior {
                    Some(law) if bounded => {
                        let (low, high) = law.support();
                        (low.max(0.0), high.min(1.0))
                    }
                    Some(law) => law.support(),
                    None if bounded => (0.0, 1.0),
                    None => (0.0, f64::INFINITY),
                }
            }
            Law::Population { upper, .. } => (0.0, upper.unwrap_or(f64::INFINITY)),
            Law::EmpiricalBayes { .. } | Law::Duration { .. } if self.is_probability_output() => {
                (0.0, 1.0)
            }
            Law::EmpiricalBayes { .. } | Law::Duration { .. } | Law::Trend { .. } => {
                (0.0, f64::INFINITY)
            }
            Law::Product { factors } => factors.iter().fold((1.0, 1.0), |(low, high), factor| {
                let (factor_low, factor_high) = factor.support();
                let corners = [low * factor_low, low * factor_high, high * factor_low, high * factor_high]
                    .map(|value| if value.is_nan() { 0.0 } else { value });
                (
                    corners.iter().copied().fold(f64::INFINITY, f64::min),
                    corners.iter().copied().fold(f64::NEG_INFINITY, f64::max),
                )
            }),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UncertainValue {
    pub unit: UncertainUnit,
    pub law: Law,
}

impl UncertainValue {
    pub fn check_meaning(&self) -> Result<()> {
        self.law.check_meaning()?;
        if self.law.is_probability_output() && self.unit.time_power() != 0 {
            return Err(meaning_error(format!(
                "The {} law gives a probability, so it cannot be a {} value",
                self.law.family(),
                self.unit.label()
            )));
        }
        if let Law::Duration {
            output: DurationOutput::Mean,
            ..
        } = &self.law
        {
            if self.unit != UncertainUnit::Hours {
                return Err(meaning_error(format!(
                    "A DURATION mean is in hours, so it cannot be a {} value",
                    self.unit.label()
                )));
            }
        }
        if matches!(self.law, Law::Trend { .. }) && self.unit.time_power() != -1 {
            return Err(meaning_error(format!(
                "A TREND law gives a rate, so it cannot be a {} value",
                self.unit.label()
            )));
        }
        let (low, high) = self.law.support();
        if low > high {
            return Err(meaning_error(format!(
                "The {} law has an empty support",
                self.law.family()
            )));
        }
        let (domain_low, domain_high) = self.unit.domain();
        if low > domain_high || high < domain_low {
            return Err(meaning_error(format!(
                "The {} law for a {} value lies entirely outside [{}, {}]",
                self.law.family(),
                self.unit.label(),
                domain_low,
                domain_high
            )));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ParameterReferenceType {
    #[serde(rename = "WORKBOOK_PARAMETER")]
    WorkbookParameter,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ParameterReference {
    pub reference_type: ParameterReferenceType,
    pub workbook_id: String,
    pub entity_id: String,
}

impl ParameterReference {
    pub fn key(&self) -> (String, String) {
        (
            self.workbook_id.trim().to_string(),
            self.entity_id.trim().to_string(),
        )
    }

    fn check_shape(&self) -> Result<()> {
        require(
            !self.workbook_id.trim().is_empty() && !self.entity_id.trim().is_empty(),
            "A parameter reference needs a workbook and an entity",
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UncertainOperation {
    Add,
    Subtract,
    Multiply,
    Divide,
    Power,
    Exp,
    Log,
    Min,
    Max,
}

impl UncertainOperation {
    pub fn label(self) -> &'static str {
        match self {
            UncertainOperation::Add => "ADD",
            UncertainOperation::Subtract => "SUBTRACT",
            UncertainOperation::Multiply => "MULTIPLY",
            UncertainOperation::Divide => "DIVIDE",
            UncertainOperation::Power => "POWER",
            UncertainOperation::Exp => "EXP",
            UncertainOperation::Log => "LOG",
            UncertainOperation::Min => "MIN",
            UncertainOperation::Max => "MAX",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "form",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ComponentModel {
    Mission {
        rate: Box<UncertainExpression>,
        mission_time: Box<UncertainExpression>,
    },
    Standby {
        rate: Box<UncertainExpression>,
        test_interval: Box<UncertainExpression>,
    },
    Repairable {
        demand_failure: Box<UncertainExpression>,
        rate: Box<UncertainExpression>,
        repair_rate: Box<UncertainExpression>,
        time: Box<UncertainExpression>,
    },
    Weibull {
        scale: Box<UncertainExpression>,
        shape: Box<UncertainExpression>,
        location: Box<UncertainExpression>,
        time: Box<UncertainExpression>,
    },
    Fragility {
        median: Box<UncertainExpression>,
        randomness: Box<UncertainExpression>,
        demand: Box<UncertainExpression>,
    },
}

impl ComponentModel {
    fn arguments(&self) -> Vec<(&'static str, &UncertainExpression, i8)> {
        match self {
            ComponentModel::Mission { rate, mission_time } => {
                vec![("rate", rate, -1), ("missionTime", mission_time, 1)]
            }
            ComponentModel::Standby {
                rate,
                test_interval,
            } => vec![("rate", rate, -1), ("testInterval", test_interval, 1)],
            ComponentModel::Repairable {
                demand_failure,
                rate,
                repair_rate,
                time,
            } => vec![
                ("demandFailure", demand_failure, 0),
                ("rate", rate, -1),
                ("repairRate", repair_rate, -1),
                ("time", time, 1),
            ],
            ComponentModel::Weibull {
                scale,
                shape,
                location,
                time,
            } => vec![
                ("scale", scale, 1),
                ("shape", shape, 0),
                ("location", location, 1),
                ("time", time, 1),
            ],
            ComponentModel::Fragility {
                median,
                randomness,
                demand,
            } => vec![
                ("median", median, 0),
                ("randomness", randomness, 0),
                ("demand", demand, 0),
            ],
        }
    }

    pub fn form(&self) -> &'static str {
        match self {
            ComponentModel::Mission { .. } => "MISSION",
            ComponentModel::Standby { .. } => "STANDBY",
            ComponentModel::Repairable { .. } => "REPAIRABLE",
            ComponentModel::Weibull { .. } => "WEIBULL",
            ComponentModel::Fragility { .. } => "FRAGILITY",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "node",
    rename_all = "SCREAMING_SNAKE_CASE",
    deny_unknown_fields
)]
pub enum UncertainExpression {
    Value { value: UncertainValue },
    Parameter { reference: ParameterReference },
    Operation {
        operation: UncertainOperation,
        operands: Vec<UncertainExpression>,
    },
    Model { model: ComponentModel },
}

impl UncertainExpression {
    pub fn check_shape(&self) -> Result<()> {
        match self {
            UncertainExpression::Value { value } => value.law.check_shape(),
            UncertainExpression::Parameter { reference } => reference.check_shape(),
            UncertainExpression::Operation {
                operation,
                operands,
            } => {
                let count = operands.len();
                let arity_ok = match operation {
                    UncertainOperation::Exp | UncertainOperation::Log => count == 1,
                    UncertainOperation::Subtract
                    | UncertainOperation::Divide
                    | UncertainOperation::Power => count == 2,
                    _ => count >= 2,
                };
                require(arity_ok, "Operation has the wrong number of operands")?;
                operands.iter().try_for_each(UncertainExpression::check_shape)
            }
            UncertainExpression::Model { model } => model
                .arguments()
                .into_iter()
                .try_for_each(|(_, argument, _)| argument.check_shape()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UncertainParameter {
    pub reference: ParameterReference,
    pub expression: UncertainExpression,
}

const SIMPLEX_TOLERANCE: f64 = 1e-6;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "family", rename_all = "SCREAMING_SNAKE_CASE", deny_unknown_fields)]
pub enum VectorLaw {
    Dirichlet { concentrations: Vec<f64> },
    Fixed { values: Vec<f64> },
    WeightedDirichlet { concentrations: Vec<f64>, weights: Vec<f64> },
}

impl VectorLaw {
    pub fn len(&self) -> usize {
        match self {
            VectorLaw::Dirichlet { concentrations } | VectorLaw::WeightedDirichlet { concentrations, .. } => concentrations.len(),
            VectorLaw::Fixed { values } => values.len(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn family(&self) -> &'static str {
        match self {
            VectorLaw::Dirichlet { .. } => "DIRICHLET",
            VectorLaw::Fixed { .. } => "FIXED",
            VectorLaw::WeightedDirichlet { .. } => "WEIGHTED_DIRICHLET",
        }
    }

    pub fn check_shape(&self) -> Result<()> {
        match self {
            VectorLaw::Dirichlet { concentrations } => {
                require(concentrations.len() >= 2, "A Dirichlet law needs two or more components")?;
                require(
                    concentrations.iter().all(|value| value.is_finite() && *value >= 0.0),
                    "Dirichlet concentrations are finite and not negative",
                )?;
                require(
                    concentrations.iter().any(|value| *value > 0.0),
                    "A Dirichlet law needs a positive concentration",
                )
            }
            VectorLaw::Fixed { values } => {
                require(!values.is_empty(), "A fixed vector needs a component")?;
                require(
                    values.iter().all(|value| value.is_finite() && (0.0..=1.0).contains(value)),
                    "Fixed vector components lie between 0 and 1",
                )?;
                require(
                    (values.iter().sum::<f64>() - 1.0).abs() <= SIMPLEX_TOLERANCE,
                    "A fixed vector of fractions sums to 1",
                )
            }
            VectorLaw::WeightedDirichlet { concentrations, weights } => {
                require(concentrations.len() >= 2, "A weighted Dirichlet law needs two or more components")?;
                require(
                    weights.len() == concentrations.len(),
                    "A weighted Dirichlet law needs one weight per concentration",
                )?;
                require(
                    concentrations.iter().chain(weights.iter()).all(|value| value.is_finite() && *value > 0.0),
                    "Weighted Dirichlet concentrations and weights are finite and positive",
                )
            }
        }
    }

    pub fn mean(&self) -> Vec<f64> {
        match self {
            VectorLaw::Dirichlet { concentrations } => {
                let total: f64 = concentrations.iter().sum();
                concentrations.iter().map(|value| value / total).collect()
            }
            VectorLaw::Fixed { values } => values.clone(),
            VectorLaw::WeightedDirichlet { concentrations, weights } => {
                let scaled: Vec<f64> = concentrations.iter().zip(weights).map(|(value, weight)| value * weight).collect();
                let total: f64 = scaled.iter().sum();
                scaled.into_iter().map(|value| value / total).collect()
            }
        }
    }

    pub fn log_weights(&self) -> Vec<f64> {
        match self {
            VectorLaw::WeightedDirichlet { weights, .. } => weights.iter().map(|weight| weight.ln()).collect(),
            VectorLaw::Dirichlet { concentrations } => vec![0.0; concentrations.len()],
            VectorLaw::Fixed { values } => vec![0.0; values.len()],
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "node", rename_all = "SCREAMING_SNAKE_CASE", deny_unknown_fields)]
pub enum UncertainVector {
    Value { law: VectorLaw },
    Parameter { reference: ParameterReference },
}

impl UncertainVector {
    pub fn check_shape(&self) -> Result<()> {
        match self {
            UncertainVector::Value { law } => law.check_shape(),
            UncertainVector::Parameter { reference } => reference.check_shape(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UncertainVectorParameter {
    pub reference: ParameterReference,
    pub vector: VectorLaw,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CcfTesting {
    Staggered,
    NonStaggered,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "model",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum CcfFactorModel {
    BetaFactor { beta: UncertainExpression },
    Mgl { factors: Vec<UncertainExpression> },
    AlphaFactor { testing: CcfTesting, alphas: UncertainVector },
    PhiFactor { phis: UncertainVector },
    BinomialFailureRate {
        independent: Box<UncertainExpression>,
        non_lethal_shock: Box<UncertainExpression>,
        component_failure: Box<UncertainExpression>,
        lethal_shock: Box<UncertainExpression>,
    },
}

impl CcfFactorModel {
    pub fn check_shape(&self) -> Result<()> {
        match self {
            CcfFactorModel::BetaFactor { beta } => beta.check_shape(),
            CcfFactorModel::Mgl { factors } => {
                require(!factors.is_empty(), "An MGL model needs a factor")?;
                factors.iter().try_for_each(UncertainExpression::check_shape)
            }
            CcfFactorModel::AlphaFactor { alphas, .. } => alphas.check_shape(),
            CcfFactorModel::PhiFactor { phis } => phis.check_shape(),
            CcfFactorModel::BinomialFailureRate {
                independent,
                non_lethal_shock,
                component_failure,
                lethal_shock,
            } => [independent, non_lethal_shock, component_failure, lethal_shock]
                .into_iter()
                .try_for_each(|part| part.check_shape()),
        }
    }

    pub fn takes_total(&self) -> bool {
        !matches!(self, CcfFactorModel::BinomialFailureRate { .. })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UncertainLawField {
    pub field: String,
    pub value: UncertainExpression,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AleatoryVariable {
    pub law: Law,
    pub fields: Vec<UncertainLawField>,
}

impl AleatoryVariable {
    pub fn check_shape(&self) -> Result<()> {
        self.law.check_shape()?;
        let mut seen = HashSet::new();
        for entry in &self.fields {
            require(!entry.field.trim().is_empty(), "An uncertain law field needs a name")?;
            require(seen.insert(entry.field.as_str()), "Each law field is uncertain at most once")?;
            entry.value.check_shape()?;
        }
        Ok(())
    }
}

pub fn parse_parameter_table(json: &str) -> Result<Vec<UncertainParameter>> {
    let table: Vec<UncertainParameter> = serde_json::from_str(json)
        .map_err(|error| PraxisError::Serialization(error.to_string()))?;
    require(!table.is_empty(), "A parameter table needs a parameter")?;
    for parameter in &table {
        parameter.reference.check_shape()?;
        parameter.expression.check_shape()?;
    }
    Ok(table)
}

struct TableCheck<'a> {
    definitions: HashMap<(String, String), &'a UncertainExpression>,
    powers: HashMap<(String, String), i8>,
    visiting: HashSet<(String, String)>,
}

impl<'a> TableCheck<'a> {
    fn parameter_power(&mut self, reference: &ParameterReference) -> Result<i8> {
        let key = reference.key();
        if let Some(power) = self.powers.get(&key) {
            return Ok(*power);
        }
        let expression = *self.definitions.get(&key).ok_or_else(|| {
            PraxisError::Mef(MefError::UndefinedElement {
                reference: format!("{}:{}", key.0, key.1),
                element_type: "parameter".to_string(),
            })
        })?;
        if !self.visiting.insert(key.clone()) {
            return Err(PraxisError::Mef(MefError::Cycle {
                cycle_path: format!("{}:{}", key.0, key.1),
            }));
        }
        let power = self.expression_power(expression)?;
        self.visiting.remove(&key);
        self.powers.insert(key, power);
        Ok(power)
    }

    fn expression_power(&mut self, expression: &UncertainExpression) -> Result<i8> {
        let power = match expression {
            UncertainExpression::Value { value } => {
                value.check_meaning()?;
                value.unit.time_power()
            }
            UncertainExpression::Parameter { reference } => self.parameter_power(reference)?,
            UncertainExpression::Operation {
                operation,
                operands,
            } => {
                let powers = operands
                    .iter()
                    .map(|operand| self.expression_power(operand))
                    .collect::<Result<Vec<i8>>>()?;
                match operation {
                    UncertainOperation::Add
                    | UncertainOperation::Subtract
                    | UncertainOperation::Min
                    | UncertainOperation::Max => {
                        if powers.iter().any(|power| *power != powers[0]) {
                            return Err(meaning_error(format!(
                                "{} needs operands with the same dimension",
                                operation.label()
                            )));
                        }
                        powers[0]
                    }
                    UncertainOperation::Multiply => powers.iter().sum(),
                    UncertainOperation::Divide => powers[0] - powers[1],
                    UncertainOperation::Power | UncertainOperation::Exp | UncertainOperation::Log => {
                        if powers.iter().any(|power| *power != 0) {
                            return Err(meaning_error(format!(
                                "{} needs dimensionless operands",
                                operation.label()
                            )));
                        }
                        0
                    }
                }
            }
            UncertainExpression::Model { model } => {
                for (name, argument, expected) in model.arguments() {
                    let actual = self.expression_power(argument)?;
                    if actual != expected {
                        return Err(meaning_error(format!(
                            "The {} model needs {} with time power {}, not {}",
                            model.form(),
                            name,
                            expected,
                            actual
                        )));
                    }
                }
                0
            }
        };
        if !(-1..=1).contains(&power) {
            return Err(meaning_error(format!(
                "An expression reaches time power {}, outside rate, dimensionless and time",
                power
            )));
        }
        Ok(power)
    }
}

impl<'a> TableCheck<'a> {
    fn new(table: &'a [UncertainParameter]) -> Result<TableCheck<'a>> {
        let mut definitions = HashMap::new();
        for parameter in table {
            let key = parameter.reference.key();
            if definitions.insert(key.clone(), &parameter.expression).is_some() {
                return Err(PraxisError::Mef(MefError::DuplicateElement {
                    element_id: format!("{}:{}", key.0, key.1),
                    element_type: "parameter".to_string(),
                    container_id: None,
                }));
            }
        }
        Ok(TableCheck {
            definitions,
            powers: HashMap::new(),
            visiting: HashSet::new(),
        })
    }
}

pub fn validate_parameter_table(table: &[UncertainParameter]) -> Result<()> {
    let mut check = TableCheck::new(table)?;
    for parameter in table {
        check.parameter_power(&parameter.reference)?;
    }
    Ok(())
}

pub fn expression_time_power(
    table: &[UncertainParameter],
    expression: &UncertainExpression,
) -> Result<i8> {
    expression.check_shape()?;
    TableCheck::new(table)?.expression_power(expression)
}
