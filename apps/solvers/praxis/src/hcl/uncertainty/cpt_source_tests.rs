use super::*;
use crate::algorithms::bdd_engine::BddNode;
use crate::hcl::{CanonicalBayesianNetwork, HclCptPrior, HclSampler};
use serde_json::{json, Value};

fn fixture() -> Value {
    serde_json::from_str(include_str!(
        "../../../tests/fixtures/hcl_mh_cpt/reference.json"
    ))
    .unwrap()
}
fn graph(case: &Value) -> BayesianGraph {
    serde_json::from_value::<CanonicalBayesianNetwork>(json!({"variables":case["variables"]}))
        .unwrap()
        .into_graph()
        .unwrap()
}
fn close(actual: &[f64], expected: &Value) {
    let expected: Vec<f64> = serde_json::from_value(expected.clone()).unwrap();
    assert_eq!(actual.len(), expected.len());
    for (i, (a, e)) in actual.iter().zip(expected).enumerate() {
        assert!(
            (a - e).abs() <= 5e-16 + 2e-14 * e.abs(),
            "sample {i}: Rust {a:.17e}, source {e:.17e}"
        );
    }
}

#[test]
fn cpt_mc_and_lhs_match_original_samples_and_batches() {
    let fixture = fixture();
    for case in fixture["cases"]
        .as_array()
        .unwrap()
        .iter()
        .chain(fixture["mixed"].as_array().unwrap())
    {
        let network = graph(case);
        let settings: HclUncertaintySettings =
            serde_json::from_value(case["settings"].clone()).unwrap();
        validate_hcl_uncertainty_settings(&network, &settings).unwrap();
        let sampled = cpt_sampling::sample_network(&network, &settings);
        if case["nonfinite"] == true {
            assert!(sampled.is_err(), "{}", case["name"]);
            continue;
        }
        let sampled = sampled.unwrap_or_else(|e| panic!("{}: {e}", case["name"]));
        for (name, values) in case["cpts"].as_object().unwrap() {
            close(
                sampled
                    .variable(sampled.node_id(name).unwrap())
                    .unwrap()
                    .cpt(),
                values,
            );
        }
    }
}

#[test]
fn sampled_cpts_and_ft_vectors_match_source_bdd_with_evidence_and_chunking() {
    for case in fixture()["mixed"].as_array().unwrap() {
        let network = graph(case);
        let settings = serde_json::from_value(case["settings"].clone()).unwrap();
        let mut bdd = Bdd::new();
        let e = bdd.alloc_node(BddNode::new(2, BDD_TRUE, BDD_FALSE));
        let b = bdd.alloc_node(BddNode::new(1, BDD_TRUE, BDD_FALSE));
        let root = bdd.alloc_node(BddNode::new(0, e, b));
        bdd.set_var_probs(vec![0.25, 0.3, 0.2]);
        let mut bindings = HclEventBindings::new();
        for (index, name) in ["A", "B"].iter().enumerate() {
            bindings
                .insert(
                    HclEventBinding::new(
                        index,
                        network.node_id(name).unwrap(),
                        vec![StateIndex::new(1)],
                    )
                    .unwrap(),
                )
                .unwrap();
        }
        for chunk_size in [1, 31, 256, 512, 513] {
            let prepared =
                PreparedHclUncertainty::with_chunk_size(&network, &settings, chunk_size).unwrap();
            close(&prepared.event_samples["E"], &case["ft_samples"]);
            for scenario in case["outputs"].as_array().unwrap() {
                let mut evidence = HclBaseEvidence::unobserved(3);
                for (name, state) in scenario["evidence"].as_object().unwrap() {
                    evidence
                        .observe(
                            network.node_id(name).unwrap(),
                            StateIndex::new(state.as_u64().unwrap() as usize),
                        )
                        .unwrap();
                }
                let values = prepared
                    .quantify(
                        &bdd,
                        root,
                        bindings.clone(),
                        evidence,
                        &[Some("A".into()), Some("B".into()), Some("E".into())],
                    )
                    .unwrap();
                close(&values, &scenario["samples"]);
            }
        }
    }
}

#[test]
fn beta_state_ids_are_a_label_mapping_not_a_new_sampling_method() {
    let prior = HclCptPrior::Beta {
        alpha: 2.,
        beta: 8.,
        true_state: "state-uuid".into(),
    };
    let states = vec!["state-uuid".into(), "other-uuid".into()];
    cpt_sampling::validate_prior(&prior, &states).unwrap();
    let actual = cpt_sampling::sample_row(
        &prior,
        &states,
        HclSampler::MonteCarlo,
        513,
        0.,
        &mut NumpyRng::new(42),
    )
    .unwrap();
    let reference = fixture();
    let source = &reference["cases"][0]["cpts"]["N"];
    let expected: Vec<f64> = serde_json::from_value(source.clone()).unwrap();
    for (i, row) in actual.chunks_exact(2).enumerate() {
        assert!((row[0] - expected[513 + i]).abs() < 2e-14);
        assert_eq!(row[0] + row[1], 1.);
    }
}

#[test]
fn invalid_priors_and_removed_ess_settings_fail_without_a_fallback() {
    let states = vec!["False".into(), "True".into()];
    for prior in [
        HclCptPrior::Beta {
            alpha: 0.,
            beta: 1.,
            true_state: "True".into(),
        },
        HclCptPrior::Beta {
            alpha: 1.,
            beta: 1.,
            true_state: "missing".into(),
        },
        HclCptPrior::Dirichlet {
            alpha: vec![0., 0.],
        },
        HclCptPrior::Dirichlet {
            alpha: vec![-1., 2.],
        },
        HclCptPrior::Dirichlet { alpha: vec![1.] },
        HclCptPrior::Dirichlet {
            alpha: vec![f64::INFINITY, 1.],
        },
    ] {
        assert!(cpt_sampling::validate_prior(&prior, &states).is_err());
    }
    let beta = HclCptPrior::Beta {
        alpha: 1.,
        beta: 1.,
        true_state: "True".into(),
    };
    assert!(
        cpt_sampling::validate_prior(&beta, &["False".into(), "True".into(), "Other".into()])
            .is_err()
    );
    let case = &fixture()["cases"][0];
    let network = graph(case);
    for epsilon in [-0.01, 0.5, 1., f64::NAN] {
        let mut settings: HclUncertaintySettings =
            serde_json::from_value(case["settings"].clone()).unwrap();
        settings.cpt_probability_clip_epsilon = epsilon;
        assert!(validate_hcl_uncertainty_settings(&network, &settings).is_err());
    }
    assert!(
        serde_json::from_value::<crate::hcl::HclCptRowUncertaintySpec>(
            json!({"node":"N","row_index":0,"equivalent_sample_size":20})
        )
        .is_err()
    );
}

#[test]
fn beta_rows_share_one_source_true_label_per_node() {
    let data = fixture();
    let case = &data["mixed"][0];
    let network = graph(case);
    let mut settings: HclUncertaintySettings =
        serde_json::from_value(case["settings"].clone()).unwrap();
    settings.cpt_row_distributions[3].prior = HclCptPrior::Beta {
        alpha: 9.0,
        beta: 1.0,
        true_state: "False".into(),
    };
    assert!(validate_hcl_uncertainty_settings(&network, &settings)
        .unwrap_err()
        .to_string()
        .contains("same probability state"));
    settings.cpt_row_distributions[3].prior = HclCptPrior::Beta {
        alpha: 1.0,
        beta: 9.0,
        true_state: "True".into(),
    };
    validate_hcl_uncertainty_settings(&network, &settings).unwrap();
}
