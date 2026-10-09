use std::fs;
use std::path::PathBuf;

use praxis::core::distribution::Law;
use praxis::core::distribution_math::{PreparedLaw, NUMERIC_TOLERANCE};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use serde::Deserialize;

#[derive(Deserialize)]
struct Bounded {
    value: f64,
    tolerance: f64,
}

#[derive(Deserialize)]
struct QuantileCase {
    u: Option<f64>,
    q: Option<f64>,
    value: f64,
    tolerance: f64,
}

#[derive(Deserialize)]
struct CdfCase {
    x: f64,
    cdf: Bounded,
    survival: Bounded,
}

#[derive(Deserialize)]
struct DensityCase {
    x: f64,
    value: f64,
    tolerance: f64,
}

#[derive(Deserialize)]
struct ReferenceCase {
    name: String,
    law: Law,
    quantiles: Vec<QuantileCase>,
    cdf: Vec<CdfCase>,
    density: Vec<DensityCase>,
    mean: Bounded,
    variance: Option<Bounded>,
}

#[derive(Deserialize)]
struct Reference {
    library: String,
    cases: Vec<ReferenceCase>,
}

fn reference() -> Reference {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/data/distribution_reference.json");
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}

fn check(failures: &mut Vec<String>, name: &str, what: String, got: f64, expected: f64, reference: f64) {
    let error = (got - expected).abs();
    let tolerance = reference.max(NUMERIC_TOLERANCE * expected.abs());
    if error.is_nan() || error > tolerance {
        failures.push(format!(
            "{name} {what}: got {got:e}, reference {expected:e}, error {error:e} over {tolerance:e} ({:.1} times)",
            error / tolerance
        ));
    }
}

fn three_term_metalog(skew: f64) -> Law {
    let points = [0.1, 0.5, 0.9]
        .iter()
        .map(|y: &f64| {
            let logit = (y / (1.0 - y)).ln();
            serde_json::json!({ "probability": y, "value": logit + skew * (y - 0.5) * logit })
        })
        .collect::<Vec<_>>();
    serde_json::from_value(serde_json::json!({
        "family": "METALOG", "points": points, "lower": null, "upper": null
    }))
    .unwrap()
}

#[test]
fn metalog_feasibility_matches_the_published_three_term_bound() {
    assert!(PreparedLaw::new(&three_term_metalog(1.6671)).is_ok());
    assert!(PreparedLaw::new(&three_term_metalog(-1.6671)).is_ok());
    assert!(PreparedLaw::new(&three_term_metalog(1.6672)).is_err());
    assert!(PreparedLaw::new(&three_term_metalog(-1.6672)).is_err());
}

#[test]
fn laws_without_a_finite_mean_have_no_point_value() {
    let cauchy: Law = serde_json::from_value(serde_json::json!({
        "family": "STUDENT_T", "location": 0.0, "scale": 1.0, "degreesOfFreedom": 1.0
    }))
    .unwrap();
    assert!(PreparedLaw::new(&cauchy).is_err());
    let truncated: Law = serde_json::from_value(serde_json::json!({
        "family": "TRUNCATED",
        "law": { "family": "STUDENT_T", "location": 0.0, "scale": 1.0, "degreesOfFreedom": 1.0 },
        "lower": -5.0, "upper": 5.0
    }))
    .unwrap();
    let prepared = PreparedLaw::new(&truncated).unwrap();
    assert!(prepared.mean().abs() < 1e-15);
    assert!(prepared.variance().is_finite());
    let heavy: Law = serde_json::from_value(serde_json::json!({
        "family": "METALOG",
        "points": [
            { "probability": 0.05, "value": 1e-6 },
            { "probability": 0.5, "value": 1e-5 },
            { "probability": 0.95, "value": 1e-3 }
        ],
        "lower": 0.0, "upper": null
    }))
    .unwrap();
    assert!(PreparedLaw::new(&heavy).is_err());
}

#[test]
fn every_law_matches_the_reference_values() {
    let reference = reference();
    assert_eq!(reference.library, "1.17.1");
    let mut failures = Vec::new();
    for case in &reference.cases {
        let law = match PreparedLaw::new(&case.law) {
            Ok(law) => law,
            Err(error) => {
                failures.push(format!("{} could not be prepared: {}", case.name, error));
                continue;
            }
        };
        for quantile in &case.quantiles {
            let (u, one_minus_u, label) = match (quantile.u, quantile.q) {
                (Some(u), _) => (u, 1.0 - u, format!("quantile({u})")),
                (_, Some(q)) => (1.0 - q, q, format!("upper quantile({q})")),
                _ => unreachable!(),
            };
            match law.quantile_pair(u, one_minus_u) {
                Ok(got) => check(&mut failures, &case.name, label, got, quantile.value, quantile.tolerance),
                Err(error) => failures.push(format!("{} {}: {}", case.name, label, error)),
            }
        }
        for point in &case.cdf {
            match (law.cdf(point.x), law.survival(point.x)) {
                (Ok(cdf), Ok(survival)) => {
                    check(&mut failures, &case.name, format!("cdf({})", point.x), cdf, point.cdf.value, point.cdf.tolerance);
                    check(&mut failures, &case.name, format!("survival({})", point.x), survival, point.survival.value, point.survival.tolerance);
                }
                (Err(error), _) | (_, Err(error)) => failures.push(format!("{} cdf({}): {}", case.name, point.x, error)),
            }
        }
        for point in &case.density {
            match law.density(point.x) {
                Ok(got) => check(&mut failures, &case.name, format!("density({})", point.x), got, point.value, point.tolerance),
                Err(error) => failures.push(format!("{} density({}): {}", case.name, point.x, error)),
            }
        }
        check(&mut failures, &case.name, "mean".to_string(), law.mean(), case.mean.value, case.mean.tolerance);
        match &case.variance {
            Some(variance) => check(&mut failures, &case.name, "variance".to_string(), law.variance(), variance.value, variance.tolerance),
            None => {
                if law.variance() != f64::INFINITY {
                    failures.push(format!("{} variance: got {:e}, expected infinite", case.name, law.variance()));
                }
            }
        }
    }
    assert!(failures.is_empty(), "{} mismatches:\n{}", failures.len(), failures.join("\n"));
}

#[test]
fn monte_carlo_draws_follow_every_reference_law() {
    let reference = reference();
    let draws = 200_000;
    let mut failures = Vec::new();
    for (index, case) in reference.cases.iter().enumerate() {
        let law = match PreparedLaw::new(&case.law) {
            Ok(law) => law,
            Err(error) => {
                failures.push(format!("{} could not be prepared: {}", case.name, error));
                continue;
            }
        };
        let mut rng = ChaCha8Rng::seed_from_u64(20_261_008 + index as u64);
        let mut samples = Vec::with_capacity(draws);
        for _ in 0..draws {
            match law.draw(&mut rng) {
                Ok(value) => samples.push(value),
                Err(error) => {
                    failures.push(format!("{} draw failed: {}", case.name, error));
                    break;
                }
            }
        }
        if samples.len() < draws {
            continue;
        }
        let count = draws as f64;
        for quantile in &case.quantiles {
            let probability = quantile.u.unwrap_or_else(|| 1.0 - quantile.q.unwrap_or(0.0));
            let below = samples.iter().filter(|value| **value <= quantile.value).count() as f64 / count;
            let spread = (probability * (1.0 - probability) / count).sqrt().max(1.0 / count);
            if (below - probability).abs() > 6.0 * spread {
                failures.push(format!("{} share below the {} quantile: {:e} against {:e}", case.name, probability, below, probability));
            }
        }
        if let Some(variance) = &case.variance {
            let mean = samples.iter().sum::<f64>() / count;
            let error = (variance.value / count).sqrt();
            if error.is_finite() && (mean - case.mean.value).abs() > 6.0 * error {
                failures.push(format!("{} sample mean {:e} against {:e}", case.name, mean, case.mean.value));
            }
        }
    }
    assert!(failures.is_empty(), "{} mismatches:
{}", failures.len(), failures.join("
"));
}

#[test]
fn batched_quantiles_match_the_exact_quantiles() {
    let reference = reference();
    let strata = 500;
    let mut failures = Vec::new();
    for case in &reference.cases {
        let Ok(law) = PreparedLaw::new(&case.law) else {
            continue;
        };
        let mut pairs: Vec<(f64, f64)> = (0..strata)
            .map(|stratum| ((stratum as f64 + 0.5) / strata as f64, ((strata - 1 - stratum) as f64 + 0.5) / strata as f64))
            .collect();
        pairs.extend(case.quantiles.iter().map(|quantile| match (quantile.u, quantile.q) {
            (Some(u), _) => (u, 1.0 - u),
            (None, Some(q)) => (1.0 - q, q),
            (None, None) => (0.5, 0.5),
        }));
        let batched = match law.quantile_pairs(&pairs) {
            Ok(values) => values,
            Err(error) => {
                failures.push(format!("{} batched quantiles failed: {}", case.name, error));
                continue;
            }
        };
        let mut worst = 0.0_f64;
        for ((u, v), got) in pairs.iter().zip(&batched) {
            let exact = law.quantile_pair(*u, *v).unwrap();
            let error = (got - exact).abs() / exact.abs().max(f64::MIN_POSITIVE);
            worst = worst.max(error);
        }
        if worst > NUMERIC_TOLERANCE {
            failures.push(format!("{} worst relative error {:e}", case.name, worst));
        }
    }
    assert!(failures.is_empty(), "{} mismatches:\n{}", failures.len(), failures.join("\n"));
}

#[test]
fn a_point_mass_on_the_lower_edge_of_a_mixture_is_its_own_quantile() {
    let continuous: Law = serde_json::from_value(serde_json::json!({
        "family": "MIXTURE",
        "components": [
            { "weight": 0.5, "law": { "family": "POINT", "value": 0.0 } },
            { "weight": 0.5, "law": { "family": "UNIFORM", "lower": 0.0, "upper": 1.0 } }
        ]
    }))
    .unwrap();
    let atomic: Law = serde_json::from_value(serde_json::json!({
        "family": "MIXTURE",
        "components": [
            { "weight": 0.5, "law": { "family": "POINT", "value": 0.0 } },
            { "weight": 0.5, "law": { "family": "POINT", "value": 1.0 } }
        ]
    }))
    .unwrap();
    let continuous = PreparedLaw::new(&continuous).unwrap();
    let atomic = PreparedLaw::new(&atomic).unwrap();
    for u in [0.01, 0.25, 0.49] {
        assert_eq!(continuous.quantile_pair(u, 1.0 - u).unwrap(), 0.0);
        assert_eq!(atomic.quantile_pair(u, 1.0 - u).unwrap(), 0.0);
    }
    assert!((continuous.quantile_pair(0.75, 0.25).unwrap() - 0.5).abs() <= NUMERIC_TOLERANCE);
    assert_eq!(atomic.quantile_pair(0.75, 0.25).unwrap(), 1.0);
    let pairs: Vec<(f64, f64)> = (0..10).map(|k| ((k as f64 + 0.5) / 10.0, (9.5 - k as f64) / 10.0)).collect();
    for (value, (u, _)) in continuous.quantile_pairs(&pairs).unwrap().iter().zip(&pairs) {
        if *u < 0.5 {
            assert_eq!(*value, 0.0);
        }
    }
}
