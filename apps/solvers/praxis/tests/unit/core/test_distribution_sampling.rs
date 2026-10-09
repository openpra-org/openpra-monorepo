use praxis::core::distribution::{Law, UncertainExpression, UncertainParameter, UncertainUnit};
use praxis::core::distribution_math::PreparedLaw;
use praxis::core::distribution_sampling::{
    draw_law, draw_vector, require_probability, SamplingMethod, SamplingPlan, TimeBase,
    UncertaintyProgram,
};
use serde_json::json;

fn plan(method: SamplingMethod, trials: usize, seed: u64) -> SamplingPlan {
    SamplingPlan {
        method,
        trials,
        seed,
    }
}

fn law(value: serde_json::Value) -> Law {
    serde_json::from_value(value).unwrap()
}

fn table(value: serde_json::Value) -> Vec<UncertainParameter> {
    serde_json::from_value(value).unwrap()
}

fn expression(value: serde_json::Value) -> UncertainExpression {
    serde_json::from_value(value).unwrap()
}

fn reference(entity: &str) -> serde_json::Value {
    json!({ "referenceType": "WORKBOOK_PARAMETER", "workbookId": "da", "entityId": entity })
}

#[test]
fn a_key_repeats_its_draws_and_other_keys_or_seeds_differ() {
    let prepared = PreparedLaw::new(&law(json!({
        "family": "LOGNORMAL", "mean": 1e-3, "errorFactor": 5.0, "level": 0.95
    })))
    .unwrap();
    let base = plan(SamplingMethod::MonteCarlo, 200, 7);
    let first = draw_law("da:1", &prepared, &base).unwrap();
    assert_eq!(first, draw_law("da:1", &prepared, &base).unwrap());
    assert_ne!(first, draw_law("da:2", &prepared, &base).unwrap());
    assert_ne!(first, draw_law("da:1", &prepared, &plan(SamplingMethod::MonteCarlo, 200, 8)).unwrap());
}

#[test]
fn latin_hypercube_puts_one_draw_in_every_stratum() {
    let prepared = PreparedLaw::new(&law(json!({ "family": "UNIFORM", "lower": 0.0, "upper": 1.0 }))).unwrap();
    let draws = draw_law("u", &prepared, &plan(SamplingMethod::LatinHypercube, 500, 3)).unwrap();
    assert!(draws.iter().all(|u| *u > 0.0 && *u < 1.0));
    let mut strata: Vec<usize> = draws.iter().map(|u| (u * 500.0).floor() as usize).collect();
    strata.sort_unstable();
    assert_eq!(strata, (0..500).collect::<Vec<_>>());
}

#[test]
fn sample_means_approach_the_exact_means() {
    let laws = [
        json!({ "family": "LOGNORMAL", "mean": 1e-3, "errorFactor": 5.0, "level": 0.95 }),
        json!({ "family": "GAMMA", "shape": 2.5, "rate": 10759.29 }),
        json!({ "family": "BETA", "alpha": 0.5, "beta": 656.5, "lower": 0.0, "upper": 1.0 }),
        json!({ "family": "CONSTRAINED_NONINFORMATIVE", "mean": 2e-3 }),
        json!({ "family": "MAXIMUM_ENTROPY", "lower": 0.0, "mean": 0.01, "upper": 0.1 }),
        json!({ "family": "METALOG", "points": [
            { "probability": 0.05, "value": 1e-4 },
            { "probability": 0.5, "value": 1e-3 },
            { "probability": 0.95, "value": 1e-2 }
        ], "lower": 0.0, "upper": 1.0 }),
        json!({ "family": "TRUNCATED", "law": {
            "family": "LOGNORMAL", "mean": 0.05, "errorFactor": 10.0, "level": 0.95
        }, "lower": null, "upper": 1.0 }),
        json!({ "family": "MIXTURE", "components": [
            { "weight": 0.6, "law": { "family": "LOGNORMAL", "mean": 1e-5, "errorFactor": 10.0, "level": 0.95 } },
            { "weight": 0.4, "law": { "family": "GAMMA", "shape": 2.0, "rate": 1e5 } }
        ] }),
    ];
    for value in laws {
        let prepared = PreparedLaw::new(&law(value.clone())).unwrap();
        for (method, trials) in [(SamplingMethod::MonteCarlo, 40_000), (SamplingMethod::LatinHypercube, 8_000)] {
            let draws = draw_law("k", &prepared, &plan(method, trials, 11)).unwrap();
            let count = draws.len() as f64;
            let mean = draws.iter().sum::<f64>() / count;
            let variance = draws.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (count - 1.0);
            let error = (variance / count).sqrt();
            assert!(
                (mean - prepared.mean()).abs() < 5.0 * error,
                "{value} {method:?}: sample mean {mean}, exact {}",
                prepared.mean()
            );
        }
    }
}

#[test]
fn a_shared_parameter_gives_every_user_the_same_draw() {
    let parameters = table(json!([
        { "reference": reference("pump-rate"), "expression": { "node": "VALUE", "value": {
            "unit": "PER_HOUR", "law": { "family": "GAMMA", "shape": 3.5, "rate": 1.2e5 } } } }
    ]));
    let mission = |hours: f64| {
        expression(json!({ "node": "MODEL", "model": { "form": "MISSION",
            "rate": { "node": "PARAMETER", "reference": reference("pump-rate") },
            "missionTime": { "node": "VALUE", "value": { "unit": "HOURS", "law": { "family": "POINT", "value": hours } } }
        } }))
    };
    let program = UncertaintyProgram::from_table(&parameters).unwrap();
    let pump_a = UncertaintyProgram::target(&parameters, &mission(24.0), "event:A", UncertainUnit::Probability).unwrap();
    let pump_b = UncertaintyProgram::target(&parameters, &mission(24.0), "event:B", UncertainUnit::Probability).unwrap();
    let sampled = program
        .sample(&[&pump_a, &pump_b], &plan(SamplingMethod::LatinHypercube, 300, 5))
        .unwrap();
    assert_eq!(sampled[0], sampled[1]);
    let point = program.point(&pump_a).unwrap();
    assert!((point - -(-24.0f64 * 3.5 / 1.2e5).exp_m1()).abs() < 1e-18);
}

#[test]
fn units_convert_to_hours_once() {
    let parameters = table(json!([
        { "reference": reference("yearly"), "expression": { "node": "VALUE", "value": {
            "unit": "PER_YEAR", "law": { "family": "POINT", "value": 8.76 } } } }
    ]));
    let program = UncertaintyProgram::from_table(&parameters).unwrap();
    let thirty_minutes = expression(json!({ "node": "MODEL", "model": { "form": "MISSION",
        "rate": { "node": "PARAMETER", "reference": reference("yearly") },
        "missionTime": { "node": "VALUE", "value": { "unit": "MINUTES", "law": { "family": "POINT", "value": 30.0 } } }
    } }));
    let target = UncertaintyProgram::target(&parameters, &thirty_minutes, "event:A", UncertainUnit::Probability).unwrap();
    let point = program.point(&target).unwrap();
    assert!((point - -(-0.0005f64).exp_m1()).abs() < 1e-18);
    let as_frequency = UncertaintyProgram::target(
        &parameters,
        &expression(json!({ "node": "PARAMETER", "reference": reference("yearly") })),
        "initiator",
        UncertainUnit::PerYear,
    )
    .unwrap();
    assert!((program.point(&as_frequency).unwrap() - 8.76).abs() < 1e-14);
}

#[test]
fn a_year_base_keeps_yearly_values_and_annualizes_hourly_ones() {
    let parameters = table(json!([
        { "reference": reference("yearly"), "expression": { "node": "VALUE", "value": {
            "unit": "PER_YEAR", "law": { "family": "POINT", "value": 0.3 } } } }
    ]));
    let base = TimeBase::Years { hours_per_year: 7000.0 };
    let program = UncertaintyProgram::from_table_in(&parameters, base).unwrap();
    let yearly = expression(json!({ "node": "PARAMETER", "reference": reference("yearly") }));
    let target = UncertaintyProgram::target_in(&parameters, &yearly, "initiator", UncertainUnit::PerYear, base).unwrap();
    assert_eq!(program.point(&target).unwrap(), 0.3);
    let hourly = expression(json!({ "node": "VALUE", "value": {
        "unit": "PER_HOUR", "law": { "family": "UNIFORM", "lower": 1e-4, "upper": 3e-4 } } }));
    let target = UncertaintyProgram::target_in(&parameters, &hourly, "initiator", UncertainUnit::PerYear, base).unwrap();
    assert!((program.point(&target).unwrap() - 1.4).abs() < 1e-12);
    let draws = program.sample(&[&target], &plan(SamplingMethod::LatinHypercube, 100, 3)).unwrap();
    assert!(draws[0].iter().all(|value| (0.7..=2.1).contains(value)));
    assert_eq!(TimeBase::Hours.per_unit(UncertainUnit::PerYear), 1.0 / 8760.0);
}

#[test]
fn a_target_with_the_wrong_dimension_is_refused() {
    let parameters = table(json!([
        { "reference": reference("rate"), "expression": { "node": "VALUE", "value": {
            "unit": "PER_HOUR", "law": { "family": "POINT", "value": 1e-5 } } } }
    ]));
    let rate = expression(json!({ "node": "PARAMETER", "reference": reference("rate") }));
    assert!(UncertaintyProgram::target(&parameters, &rate, "event:A", UncertainUnit::Probability).is_err());
}

#[test]
fn mission_model_is_exact_and_agrees_with_the_hcl_mh_source() {
    let reference: serde_json::Value = serde_json::from_str(include_str!(
        "../../fixtures/hcl_mh_failure_rate/reference.json"
    ))
    .unwrap();
    let empty: Vec<UncertainParameter> = Vec::new();
    let program = UncertaintyProgram::from_expressions(std::collections::HashMap::new(), 1.0);
    for case in reference["cases"].as_array().unwrap() {
        let rate = case["rate"].as_f64().unwrap();
        let time = case["time"].as_f64().unwrap();
        let mission = expression(json!({ "node": "MODEL", "model": { "form": "MISSION",
            "rate": { "node": "VALUE", "value": { "unit": "PER_HOUR", "law": { "family": "POINT", "value": rate } } },
            "missionTime": { "node": "VALUE", "value": { "unit": "HOURS", "law": { "family": "POINT", "value": time } } }
        } }));
        let target = UncertaintyProgram::target(&empty, &mission, "event:A", UncertainUnit::Probability).unwrap();
        let value = program.point(&target).unwrap();
        let exact = -praxis::core::special_functions::exp_minus_one(-rate * time).unwrap();
        assert_eq!(value, exact, "{}", case["name"]);
        let source: f64 = case["probability"].as_str().unwrap().parse().unwrap();
        assert!((value - source).abs() <= f64::EPSILON, "{}: {value} against {source}", case["name"]);
    }
}

#[test]
fn probabilities_outside_zero_to_one_name_their_trial() {
    assert!(require_probability("basic event 'A'", Some(4), 0.5).is_ok());
    let message = require_probability("basic event 'A'", Some(4), 1.2).unwrap_err().to_string();
    assert!(message.contains("basic event 'A'") && message.contains("trial 5"));
}

fn dirichlet_moments(concentrations: &[f64]) -> Vec<(f64, f64)> {
    let total: f64 = concentrations.iter().sum();
    concentrations
        .iter()
        .map(|value| (value / total, value * (total - value) / (total * total * (total + 1.0))))
        .collect()
}

#[test]
fn dirichlet_draws_sum_to_one_and_follow_the_marginal_moments() {
    for concentrations in [vec![167.3, 1.82, 0.4, 0.02], vec![0.5, 0.5], vec![3.0, 0.0, 7.0]] {
        let law = praxis::core::distribution::VectorLaw::Dirichlet { concentrations: concentrations.clone() };
        for (method, trials) in [(SamplingMethod::MonteCarlo, 200_000), (SamplingMethod::LatinHypercube, 50_000)] {
            let columns = draw_vector("ccf:alphas", &law, &plan(method, trials, 5)).unwrap();
            assert_eq!(columns.len(), concentrations.len());
            for trial in 0..trials {
                let total: f64 = columns.iter().map(|column| column[trial]).sum();
                assert!((total - 1.0).abs() < 1e-12, "{concentrations:?} {method:?} trial {trial} sums to {total}");
                assert!(columns.iter().all(|column| column[trial] >= 0.0));
            }
            for (component, (mean, variance)) in dirichlet_moments(&concentrations).into_iter().enumerate() {
                let sample_mean = columns[component].iter().sum::<f64>() / trials as f64;
                let error = (variance / trials as f64).sqrt();
                assert!(
                    (sample_mean - mean).abs() <= 6.0 * error.max(f64::EPSILON),
                    "{concentrations:?} {method:?} component {component}: {sample_mean} against {mean}"
                );
            }
        }
    }
}

#[test]
fn a_vector_parameter_is_drawn_once_per_trial_for_every_user() {
    let alphas: praxis::core::distribution::UncertainVectorParameter = serde_json::from_value(json!({
        "reference": reference("ccf-alphas"),
        "vector": { "family": "DIRICHLET", "concentrations": [2.0, 3.0, 5.0] }
    }))
    .unwrap();
    let program = UncertaintyProgram::from_table(&[]).unwrap().with_vectors(&[alphas]).unwrap();
    let shared: praxis::core::distribution::UncertainVector =
        serde_json::from_value(json!({ "node": "PARAMETER", "reference": reference("ccf-alphas") })).unwrap();
    let first = program.vector_components(&shared, "group:A").unwrap();
    let second = program.vector_components(&shared, "group:B").unwrap();
    let doubled = praxis::expression::Expr::Mul(vec![first[1].clone(), praxis::expression::Expr::Constant(2.0)]);
    let total = praxis::expression::Expr::Add(second.clone());
    let sampled = program
        .sample(&[&doubled, &second[1], &total], &plan(SamplingMethod::MonteCarlo, 2_000, 9))
        .unwrap();
    for ((doubled, component), total) in sampled[0].iter().zip(&sampled[1]).zip(&sampled[2]) {
        assert_eq!(*doubled, 2.0 * component);
        assert!((total - 1.0).abs() < 1e-12);
    }
    assert!((program.point(&second[1]).unwrap() - 0.3).abs() < 1e-15);
    let missing: praxis::core::distribution::UncertainVector =
        serde_json::from_value(json!({ "node": "PARAMETER", "reference": reference("absent") })).unwrap();
    assert!(program.vector_components(&missing, "group:C").is_err());
}

#[test]
fn a_fragility_model_gives_the_lognormal_failure_probability() {
    use praxis::expression::fragility_probability;
    assert!((fragility_probability(1.0, 0.3, 1.0).unwrap() - 0.5).abs() < 1e-15);
    let expected = praxis::core::special_functions::normal_cdf((0.5f64).ln() / 0.5).unwrap();
    assert_eq!(fragility_probability(2.0, 0.5, 1.0).unwrap(), expected);
    assert_eq!(fragility_probability(2.0, 0.5, 0.0).unwrap(), 0.0);
    assert_eq!(fragility_probability(2.0, 0.0, 2.5).unwrap(), 1.0);
    assert_eq!(fragility_probability(2.0, 0.0, 2.0).unwrap(), 0.0);
    assert!(fragility_probability(0.0, 0.3, 1.0).is_err());
    assert!(fragility_probability(1.0, -0.1, 1.0).is_err());
    let empty: Vec<UncertainParameter> = Vec::new();
    let model = expression(json!({ "node": "MODEL", "model": { "form": "FRAGILITY",
        "median": { "node": "VALUE", "value": { "unit": "QUANTITY", "law": { "family": "LOGNORMAL", "mean": 0.9, "errorFactor": 1.6, "level": 0.95 } } },
        "randomness": { "node": "VALUE", "value": { "unit": "FACTOR", "law": { "family": "POINT", "value": 0.3 } } },
        "demand": { "node": "VALUE", "value": { "unit": "QUANTITY", "law": { "family": "POINT", "value": 0.5 } } }
    } }));
    let program = UncertaintyProgram::from_table(&empty).unwrap();
    let target = UncertaintyProgram::target(&empty, &model, "cpt:pga", UncertainUnit::Probability).unwrap();
    assert_eq!(program.point(&target).unwrap(), fragility_probability(0.9, 0.3, 0.5).unwrap());
    let sampled = program.sample(&[&target], &plan(SamplingMethod::LatinHypercube, 4_000, 3)).unwrap();
    assert!(sampled[0].iter().all(|value| (0.0..=1.0).contains(value)));
}
