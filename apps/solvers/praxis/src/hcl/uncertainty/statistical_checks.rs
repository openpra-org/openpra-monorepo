use serde_json::{json, Value};

use crate::core::distribution::{
    Law, MixtureComponent, UncertainExpression, UncertainUnit, UncertainValue, UncertainVector,
    VectorLaw,
};
use crate::core::distribution_math::{PreparedLaw, NORMAL_QUANTILE_95};
use crate::hcl::{
    HclBasicEventUncertainty, HclCptGenerator, HclCptGeneratorSpec, HclCptRowUncertainty,
    HclFragilityDemand, HclPgaBin, HclPgaFrequencyConversion, HclSampler, HclUncertaintySettings,
};

pub(super) const Z_LIMIT: f64 = 5.0;
const SOURCE_EF_QUANTILE: f64 = 1.645;
const QUANTILE_PROBABILITIES: [f64; 5] = [0.05, 0.25, 0.5, 0.75, 0.95];

pub(super) fn mean_and_variance(values: &[f64]) -> (f64, f64) {
    let count = values.len() as f64;
    let mean = values.iter().sum::<f64>() / count;
    if values.len() < 2 {
        return (mean, 0.0);
    }
    let variance = values.iter().map(|value| (value - mean).powi(2)).sum::<f64>() / (count - 1.0);
    (mean, variance)
}

fn tolerance(value: f64) -> f64 {
    1e-12 * value.abs().max(1.0)
}

fn at_or_below(values: &[f64], bound: f64) -> f64 {
    let reach = bound + f64::MIN_POSITIVE;
    values.iter().filter(|value| **value <= reach).count() as f64
}

pub(super) fn assert_same_population(ours: &[f64], reference: &[f64], label: &str) {
    assert!(!ours.is_empty() && !reference.is_empty(), "{label}: empty population");
    assert!(ours.iter().all(|value| value.is_finite()), "{label}: a sample is not finite");
    let (n1, n2) = (ours.len() as f64, reference.len() as f64);
    let (m1, v1) = mean_and_variance(ours);
    let (m2, v2) = mean_and_variance(reference);
    let error = (v1 / n1 + v2 / n2).sqrt();
    assert!(
        (m1 - m2).abs() <= Z_LIMIT * error + tolerance(m2),
        "{label}: mean {m1:.6e} against reference {m2:.6e}, standard error {error:.3e}"
    );
    let mut sorted = reference.to_vec();
    sorted.sort_by(f64::total_cmp);
    for probability in QUANTILE_PROBABILITIES {
        let bound = sorted[(probability * (n2 - 1.0)).floor() as usize];
        let ours_below = at_or_below(ours, bound);
        let reference_below = at_or_below(reference, bound);
        let pooled = (ours_below + reference_below) / (n1 + n2);
        let spread = (pooled * (1.0 - pooled) * (1.0 / n1 + 1.0 / n2)).sqrt();
        let difference = (ours_below / n1 - reference_below / n2).abs();
        assert!(
            difference <= Z_LIMIT * spread + 1e-12,
            "{label}: fraction at or below the reference {probability} quantile {bound:.6e} is {:.4} against {:.4}",
            ours_below / n1,
            reference_below / n2
        );
    }
}

pub(super) fn assert_fits(values: &[f64], points: &[f64], cdf: &dyn Fn(f64) -> f64, label: &str) {
    let count = values.len() as f64;
    for point in points {
        let exact = cdf(*point);
        let empirical = at_or_below(values, *point) / count;
        let spread = (exact * (1.0 - exact) / count).sqrt();
        assert!(
            (empirical - exact).abs() <= Z_LIMIT * spread + 1e-9,
            "{label}: fraction at or below {point:.6e} is {empirical:.4} against the exact {exact:.4}"
        );
    }
}

pub(super) fn standard_points() -> Vec<f64> {
    QUANTILE_PROBABILITIES
        .iter()
        .map(|probability| crate::core::special_functions::normal_quantile(*probability).unwrap())
        .collect()
}

pub(super) fn assert_fits_law(values: &[f64], law: &Law, label: &str) {
    let prepared = PreparedLaw::new(law).unwrap();
    let points: Vec<f64> = QUANTILE_PROBABILITIES
        .iter()
        .map(|probability| prepared.quantile(*probability).unwrap())
        .collect();
    assert_fits(values, &points, &|x| prepared.cdf(x).unwrap(), label);
    assert_mean_within(values, prepared.mean(), prepared.variance(), label);
}

pub(super) fn assert_mean_within(values: &[f64], mean: f64, variance: f64, label: &str) {
    let (sampled, _) = mean_and_variance(values);
    let error = (variance / values.len() as f64).sqrt();
    assert!(
        (sampled - mean).abs() <= Z_LIMIT * error + tolerance(mean),
        "{label}: mean {sampled:.6e} against exact {mean:.6e}, exact standard error {error:.3e}"
    );
}

pub(super) fn assert_mean_near(ours: &[f64], expected: f64, label: &str) {
    let (mean, variance) = mean_and_variance(ours);
    let error = (variance / ours.len() as f64).sqrt();
    assert!(
        (mean - expected).abs() <= Z_LIMIT * error + tolerance(expected),
        "{label}: mean {mean:.6e} against exact {expected:.6e}, standard error {error:.3e}"
    );
}

fn clip(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

fn clipped(base: Law) -> Law {
    let prepared = PreparedLaw::new(&base).unwrap();
    let below = prepared.cdf(0.0).unwrap();
    let above = prepared.survival(1.0).unwrap();
    let inside = 1.0 - below - above;
    let mut components = Vec::new();
    if below > 0.0 {
        components.push(MixtureComponent {
            weight: below,
            law: Law::Point { value: 0.0 },
        });
    }
    if inside > 0.0 {
        let law = if below > 0.0 || above > 0.0 {
            Law::Truncated {
                law: Box::new(base),
                lower: (below > 0.0).then_some(0.0),
                upper: (above > 0.0).then_some(1.0),
            }
        } else {
            base
        };
        components.push(MixtureComponent { weight: inside, law });
    }
    if above > 0.0 {
        components.push(MixtureComponent {
            weight: above,
            law: Law::Point { value: 1.0 },
        });
    }
    if components.len() == 1 {
        return components.remove(0).law;
    }
    Law::Mixture { components }
}

fn number(value: &Value, field: &str) -> f64 {
    value[field].as_f64().unwrap()
}

fn logistic(value: f64) -> f64 {
    1.0 / (1.0 + (-value).exp())
}

pub(super) fn source_lognormal(median: f64, error_factor: f64) -> Law {
    let sigma = error_factor.ln() / SOURCE_EF_QUANTILE;
    Law::Lognormal {
        mean: median * (0.5 * sigma * sigma).exp(),
        error_factor: (NORMAL_QUANTILE_95 * sigma).exp(),
        level: 0.95,
    }
}

pub(super) fn probability_law(distribution: &Value) -> Option<Law> {
    let positive = |value: f64| value.is_finite() && value > 0.0;
    match distribution["family"].as_str().unwrap() {
        "BETA" => {
            let (alpha, beta) = (number(distribution, "alpha"), number(distribution, "beta"));
            (positive(alpha) && positive(beta)).then_some(Law::Beta {
                alpha,
                beta,
                lower: 0.0,
                upper: 1.0,
            })
        }
        "UNIFORM" => {
            let (lower, upper) = (number(distribution, "lower"), number(distribution, "upper"));
            if lower == upper {
                Some(Law::Point { value: clip(lower) })
            } else if lower < upper {
                Some(clipped(Law::Uniform { lower, upper }))
            } else {
                None
            }
        }
        "NORMAL" => {
            let mean = number(distribution, "mean");
            let deviation = number(distribution, "standard_deviation");
            if deviation == 0.0 {
                Some(Law::Point { value: clip(mean) })
            } else if deviation > 0.0 {
                Some(clipped(Law::Normal {
                    mean,
                    standard_deviation: deviation,
                }))
            } else {
                None
            }
        }
        "LOGNORMAL" => {
            let median = number(distribution, "median");
            let factor = number(distribution, "error_factor");
            if !positive(median) || factor.is_nan() || factor < 1.0 {
                None
            } else if factor == 1.0 {
                Some(Law::Point { value: clip(median) })
            } else {
                Some(clipped(source_lognormal(median, factor)))
            }
        }
        "LOGITNORMAL" => {
            let (mu, sigma) = (number(distribution, "mu"), number(distribution, "sigma"));
            if sigma == 0.0 {
                Some(Law::Point { value: logistic(mu) })
            } else if sigma > 0.0 {
                Some(Law::LogitNormal { mu, sigma })
            } else {
                None
            }
        }
        "GAMMA" => {
            let (shape, scale) = (number(distribution, "shape"), number(distribution, "scale"));
            (positive(shape) && positive(scale)).then(|| {
                clipped(Law::Gamma {
                    shape,
                    rate: 1.0 / scale,
                })
            })
        }
        "EXPONENTIAL" => {
            let rate = number(distribution, "rate");
            positive(rate).then(|| clipped(Law::Gamma { shape: 1.0, rate }))
        }
        "TRIANGULAR" => {
            let lower = number(distribution, "lower");
            let mode = number(distribution, "mode");
            let upper = number(distribution, "upper");
            (lower < upper && lower <= mode && mode <= upper)
                .then(|| clipped(Law::Triangular { lower, mode, upper }))
        }
        other => panic!("unknown fixture family {other}"),
    }
}

pub(super) fn probability(law: Law) -> UncertainExpression {
    UncertainExpression::Value {
        value: UncertainValue {
            unit: UncertainUnit::Probability,
            law,
        },
    }
}

pub(super) fn valued(unit: UncertainUnit, law: Law) -> UncertainExpression {
    UncertainExpression::Value {
        value: UncertainValue { unit, law },
    }
}

fn sampler(value: &Value) -> HclSampler {
    match value.as_str().unwrap() {
        "MC" => HclSampler::MonteCarlo,
        "LHS" => HclSampler::LatinHypercube,
        other => panic!("unknown sampler {other}"),
    }
}

fn dirichlet_row(prior: &Value, states: &[String]) -> UncertainVector {
    let concentrations = match prior["family"].as_str().unwrap() {
        "DIRICHLET" => serde_json::from_value(prior["alpha"].clone()).unwrap(),
        "BETA" => {
            let true_state = prior["true_state"].as_str().unwrap();
            states
                .iter()
                .map(|state| {
                    if state == true_state {
                        number(prior, "alpha")
                    } else {
                        number(prior, "beta")
                    }
                })
                .collect()
        }
        other => panic!("unknown prior {other}"),
    };
    UncertainVector::Value {
        law: VectorLaw::Dirichlet { concentrations },
    }
}

fn generator(spec: &Value) -> HclCptGeneratorSpec {
    let source = &spec["generator"];
    let generator = match source["type"].as_str().unwrap() {
        "seismic_fragility" => {
            let theta = number(source, "theta");
            let uncertainty = number(source, "betaU");
            let median = if uncertainty == 0.0 {
                Law::Point { value: theta }
            } else {
                Law::Lognormal {
                    mean: theta * (0.5 * uncertainty * uncertainty).exp(),
                    error_factor: (NORMAL_QUANTILE_95 * uncertainty).exp(),
                    level: 0.95,
                }
            };
            HclCptGenerator::SeismicFragility {
                pga_parent_id: source["pgaParentId"].as_str().unwrap().to_string(),
                true_state_id: source["trueStateId"].as_str().unwrap().to_string(),
                false_state_id: source["falseStateId"].as_str().unwrap().to_string(),
                median: valued(UncertainUnit::Quantity, median),
                randomness: valued(
                    UncertainUnit::Factor,
                    Law::Point {
                        value: number(source, "betaR"),
                    },
                ),
                demands: source["pgaCenters"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|center| HclFragilityDemand {
                        state_id: center["stateId"].as_str().unwrap().to_string(),
                        demand: number(center, "value"),
                    })
                    .collect(),
            }
        }
        "seismic_pga_bins" => HclCptGenerator::SeismicPgaBins {
            none_state_id: source["noneStateId"].as_str().unwrap().to_string(),
            mission_time: valued(
                UncertainUnit::Years,
                Law::Point {
                    value: number(source, "missionTime"),
                },
            ),
            conversion: match source["frequencyToProbability"].as_str().unwrap() {
                "poisson" => HclPgaFrequencyConversion::Poisson,
                "linear" => HclPgaFrequencyConversion::Linear,
                other => panic!("unknown conversion {other}"),
            },
            bins: source["bins"]
                .as_array()
                .unwrap()
                .iter()
                .map(|bin| {
                    let median = number(bin, "medianFrequency");
                    let factor = number(bin, "errorFactor95");
                    let law = if median == 0.0 {
                        Law::Point { value: 0.0 }
                    } else {
                        source_lognormal(median, factor)
                    };
                    HclPgaBin {
                        state_id: bin["stateId"].as_str().unwrap().to_string(),
                        frequency: valued(UncertainUnit::PerYear, law),
                    }
                })
                .collect(),
        },
        other => panic!("unknown generator {other}"),
    };
    HclCptGeneratorSpec {
        node: spec["node"].as_str().unwrap().to_string(),
        generator,
    }
}

pub(super) fn contract_settings(source: &Value, states_of: &dyn Fn(&str) -> Vec<String>) -> HclUncertaintySettings {
    let basic_events = source["basic_event_distributions"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| HclBasicEventUncertainty {
            event: entry["event"].as_str().unwrap().to_string(),
            expression: probability(probability_law(&entry["distribution"]).unwrap()),
        })
        .collect();
    let cpt_rows = source["cpt_row_distributions"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| {
            let node = entry["node"].as_str().unwrap();
            HclCptRowUncertainty {
                node: node.to_string(),
                row_index: entry["row_index"].as_u64().unwrap() as usize,
                row: dirichlet_row(&entry["prior"], &states_of(node)),
            }
        })
        .collect();
    let cpt_generators = source["cpt_generators"]
        .as_array()
        .map(|generators| generators.iter().map(generator).collect())
        .unwrap_or_default();
    let sampler_field = if source["sampler"].is_null() {
        &source["basic_event_sampler"]
    } else {
        &source["sampler"]
    };
    HclUncertaintySettings {
        sample_count: source["sample_count"].as_u64().unwrap() as usize,
        seed: source["seed"].as_u64().unwrap(),
        sampler: sampler(sampler_field),
        basic_events,
        cpt_rows,
        cpt_generators,
        uncertainty_parameters: Vec::new(),
        uncertainty_vectors: Vec::new(),
    }
}

pub(super) fn floats(value: &Value) -> Vec<f64> {
    serde_json::from_value(value.clone()).unwrap()
}

pub(super) fn graph_of(case: &Value) -> tensorbayes::BayesianGraph {
    serde_json::from_value::<crate::hcl::CanonicalBayesianNetwork>(json!({ "variables": case["variables"] }))
        .unwrap()
        .into_graph()
        .unwrap()
}

pub(super) fn states_in(graph: &tensorbayes::BayesianGraph) -> impl Fn(&str) -> Vec<String> + '_ {
    move |name: &str| {
        graph
            .variable(graph.node_id(name).unwrap())
            .unwrap()
            .states()
            .to_vec()
    }
}



