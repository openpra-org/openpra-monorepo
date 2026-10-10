use praxis::core::distribution::{CountLikelihood, EvidenceTerm, Law, Likelihood, MixtureComponent, QuantilePoint};
use praxis::core::distribution_math::PreparedLaw;
use praxis::core::distribution_operations::{
    constrained_noninformative, homogeneity, laplace_trend, lognormal_fit, pool, prior_predictive, scale_law,
    Pooling,
};
use serde_json::json;

fn law(value: serde_json::Value) -> Law {
    serde_json::from_value(value).unwrap()
}

fn near(got: f64, expected: f64, tolerance: f64) {
    assert!(
        (got - expected).abs() <= tolerance,
        "got {got:e}, reference {expected:e}, error {:e} over {tolerance:e}",
        (got - expected).abs()
    );
}

fn close(got: f64, expected: f64) {
    near(got, expected, 64.0 * f64::EPSILON * expected.abs());
}

fn term(likelihood: Likelihood, failures: f64, exposure: f64) -> EvidenceTerm {
    let count = if likelihood == Likelihood::Binomial {
        CountLikelihood::Binomial
    } else {
        CountLikelihood::Poisson
    };
    EvidenceTerm::count(count, failures, exposure)
}

#[test]
fn prior_predictive_matches_negative_binomial_beta_binomial_and_quadrature() {
    let gamma = law(json!({ "family": "GAMMA", "shape": 1.5, "rate": 3e5 }));
    let check = prior_predictive(&gamma, &term(Likelihood::Poisson, 4.0, 5e5)).unwrap();
    close(check.at_most, 0.8219925926248245);
    close(check.at_least, 0.2642392279186621);
    close(check.expected, 2.5);
    let beta = law(json!({ "family": "BETA", "alpha": 0.5, "beta": 499.5, "lower": 0.0, "upper": 1.0 }));
    let check = prior_predictive(&beta, &term(Likelihood::Binomial, 3.0, 1000.0)).unwrap();
    close(check.at_most, 0.9194839184317852);
    close(check.at_least, 0.13405477691322443);
    let lognormal = law(json!({ "family": "LOGNORMAL", "mean": 1e-5, "errorFactor": 10.0, "level": 0.95 }));
    let check = prior_predictive(&lognormal, &term(Likelihood::Poisson, 3.0, 2e5)).unwrap();
    near(check.at_most, 0.8486167204341076, 9.9e-15 + 64.0 * f64::EPSILON);
    near(check.at_least, 0.21409761749837458, 2.8e-15 + 64.0 * f64::EPSILON);
}

#[test]
fn pooling_test_matches_chi_square() {
    let poisson = [
        term(Likelihood::Poisson, 1.0, 1e5),
        term(Likelihood::Poisson, 4.0, 2e5),
        term(Likelihood::Poisson, 0.0, 5e4),
    ];
    let result = homogeneity(&poisson).unwrap();
    close(result.statistic, 1.3);
    close(result.probability, 0.5220457767610162);
    assert_eq!(result.degrees_of_freedom, 2.0);
    assert!(result.small_expected);
    let binomial = [
        term(Likelihood::Binomial, 1.0, 500.0),
        term(Likelihood::Binomial, 3.0, 400.0),
        term(Likelihood::Binomial, 0.0, 800.0),
    ];
    let result = homogeneity(&binomial).unwrap();
    close(result.statistic, 6.427623820754718);
    close(result.probability, 0.04020307031103097);
    assert!(homogeneity(&[poisson[0].clone(), binomial[0].clone()]).is_err());
}

#[test]
fn laplace_trend_matches_the_normal_statistic() {
    let result = laplace_trend(&[2001.2, 2003.7, 2007.1, 2008.4, 2009.9], 2000.0, 2010.0).unwrap();
    close(result.statistic, 0.8210724693960004);
    close(result.probability, 0.411604990501344);
    assert!(laplace_trend(&[2001.0, 2002.0], 2000.0, 2010.0).is_err());
    assert!(laplace_trend(&[2001.0, 2002.0, 2011.0], 2000.0, 2010.0).is_err());
}

fn lognormal_fields(fitted: &Law) -> (f64, f64, f64) {
    match fitted {
        Law::Lognormal {
            mean,
            error_factor,
            level,
        } => (*mean, *error_factor, *level),
        other => panic!("expected a lognormal, got {}", other.family()),
    }
}

#[test]
fn lognormal_fits_keep_the_stated_center_and_spread() {
    let point = |probability: f64, value: f64| QuantilePoint { probability, value };
    let (mean, error_factor, level) = lognormal_fields(&lognormal_fit(None, Some(1e-3), &[point(0.95, 5e-3)]).unwrap());
    close(mean, 0.0016139757924286207);
    close(error_factor, 5.0);
    assert_eq!(level, 0.95);
    let (mean, error_factor, _) =
        lognormal_fields(&lognormal_fit(Some(2e-3), None, &[point(0.05, 4e-4), point(0.95, 8e-3)]).unwrap());
    close(mean, 2e-3);
    close(error_factor, 4.472135954999578);
    let (_, error_factor, _) =
        lognormal_fields(&lognormal_fit(Some(2e-3), None, &[point(0.025, 3e-4), point(0.975, 9e-3)]).unwrap());
    close(error_factor, 4.166962740873224);
    assert!(lognormal_fit(Some(2e-3), None, &[]).is_err());
    assert!(lognormal_fit(None, Some(1e-3), &[point(0.05, 5e-3)]).is_err());
}

#[test]
fn logarithmic_pooling_weights_precisions() {
    let lognormal = |mean: f64, error_factor: f64| law(json!({ "family": "LOGNORMAL", "mean": mean, "errorFactor": error_factor, "level": 0.95 }));
    let pooled = pool(
        Pooling::Logarithmic,
        &[
            MixtureComponent { weight: 1.0, law: lognormal(1e-3, 3.0) },
            MixtureComponent { weight: 3.0, law: lognormal(4e-3, 10.0) },
        ],
    )
    .unwrap();
    let (mean, error_factor, _) = lognormal_fields(&pooled);
    close(mean, 0.0017551560671213765);
    close(error_factor, 5.439663453551299);
    let linear = pool(
        Pooling::Linear,
        &[
            MixtureComponent { weight: 1.0, law: lognormal(1e-3, 3.0) },
            MixtureComponent { weight: 3.0, law: lognormal(4e-3, 10.0) },
        ],
    )
    .unwrap();
    close(PreparedLaw::new(&linear).unwrap().mean(), 0.25e-3 + 0.75 * 4e-3);
    assert!(pool(
        Pooling::Logarithmic,
        &[
            MixtureComponent { weight: 1.0, law: lognormal(1e-3, 3.0) },
            MixtureComponent { weight: 1.0, law: law(json!({ "family": "GAMMA", "shape": 2.0, "rate": 1e3 })) },
        ],
    )
    .is_err());
}

#[test]
fn scaling_moves_every_quantile_by_the_factor() {
    let laws = [
        json!({ "family": "LOGNORMAL", "mean": 3e-5, "errorFactor": 5.0, "level": 0.95 }),
        json!({ "family": "GAMMA", "shape": 1.5, "rate": 3e5 }),
        json!({ "family": "BETA", "alpha": 2.5, "beta": 40.0, "lower": 0.0, "upper": 1.0 }),
        json!({ "family": "WEIBULL", "scale": 10.0, "shape": 1.5, "location": 2.0 }),
        json!({ "family": "MAXIMUM_ENTROPY", "lower": 0.0, "mean": 0.01, "upper": 0.1 }),
        json!({ "family": "METALOG", "points": [{ "probability": 0.05, "value": 1e-6 }, { "probability": 0.5, "value": 1e-5 }, { "probability": 0.95, "value": 1e-4 }], "lower": 0.0, "upper": null }),
        json!({ "family": "TRUNCATED", "law": { "family": "NORMAL", "mean": 0.015, "standardDeviation": 0.0063 }, "lower": 0.0, "upper": 1.0 }),
        json!({ "family": "POSTERIOR", "prior": { "family": "LOGNORMAL", "mean": 1e-5, "errorFactor": 10.0, "level": 0.95 }, "evidence": [{ "likelihood": "POISSON", "failures": 3.0, "exposure": 2e5 }] }),
    ];
    let factor = 1.0 / 8760.0;
    for original in laws {
        let original = law(original);
        let scaled = scale_law(&original, factor).unwrap();
        let before = PreparedLaw::new(&original).unwrap();
        let after = PreparedLaw::new(&scaled).unwrap();
        let scale = factor * before.quantile(0.5).unwrap().abs();
        for u in [1e-6, 0.05, 0.5, 0.95] {
            let expected = before.quantile(u).unwrap() * factor;
            let got = after.quantile(u).unwrap();
            assert!(
                (got - expected).abs() <= 64.0 * f64::EPSILON * (expected.abs() + scale),
                "{} at {u}: {got:e} against {expected:e}",
                original.family()
            );
        }
    }
    let binomial = law(json!({ "family": "POSTERIOR", "prior": null, "evidence": [{ "likelihood": "BINOMIAL", "failures": 1.0, "exposure": 10.0 }] }));
    assert_eq!(scale_law(&binomial, 0.5).unwrap(), law(json!({ "family": "BETA", "alpha": 1.5, "beta": 9.5, "lower": 0.0, "upper": 0.5 })));
    assert_eq!(scale_law(&law(json!({ "family": "CONSTRAINED_NONINFORMATIVE", "mean": 0.01 })), 0.5).unwrap().family(), "SAMPLES");
    assert!(scale_law(&law(json!({ "family": "GAMMA", "shape": 1.0, "rate": 1.0 })), 0.0).is_err());
}

#[test]
fn constrained_noninformative_priors_keep_the_source_mean() {
    let source = law(json!({ "family": "BETA", "alpha": 0.5, "beta": 249.5, "lower": 0.0, "upper": 1.0 }));
    match constrained_noninformative(&source, Likelihood::Binomial).unwrap() {
        Law::ConstrainedNoninformative { mean } => close(mean, 0.002),
        other => panic!("expected the constrained noninformative family, got {}", other.family()),
    }
    let source = law(json!({ "family": "GAMMA", "shape": 2.0, "rate": 1e5 }));
    match constrained_noninformative(&source, Likelihood::Poisson).unwrap() {
        Law::Gamma { shape, rate } => {
            assert_eq!(shape, 0.5);
            close(rate, 25000.0);
        }
        other => panic!("expected a gamma, got {}", other.family()),
    }
    let rate = law(json!({ "family": "GAMMA", "shape": 2.0, "rate": 1.0 }));
    assert!(constrained_noninformative(&rate, Likelihood::Binomial).is_err());
}
