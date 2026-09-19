use super::*;
use crate::algorithms::bdd_engine::BddNode;
use crate::hcl::{CanonicalBayesianNetwork, HclCptGenerator};
use serde_json::{json, Value};

fn fixture() -> Value {
    serde_json::from_str(include_str!(
        "../../../tests/fixtures/hcl_mh_seismic/reference.json"
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
fn seismic_mc_and_lhs_match_original_samples_and_batches() {
    let fixture = fixture();
    for case in fixture["cases"].as_array().unwrap().iter() {
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
fn seismic_source_bdd_matches_across_chunks_and_evidence() {
    for case in fixture()["cases"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|case| case["outputs"].is_array())
    {
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
                        vec![StateIndex::new(if *name == "A" { 1 } else { 0 })],
                    )
                    .unwrap(),
                )
                .unwrap();
        }
        for chunk_size in [1, 31, 256, 512, 513] {
            let prepared =
                PreparedHclUncertainty::with_chunk_size(&network, &settings, chunk_size).unwrap();

            for scenario in case["outputs"].as_array().unwrap() {
                let mut evidence = HclBaseEvidence::unobserved(4);
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
fn source_rejects_excessive_bin_totals_without_renormalizing() {
    for case in fixture()["errors"].as_array().unwrap() {
        let network = graph(case);
        let settings = serde_json::from_value(case["settings"].clone()).unwrap();
        validate_hcl_uncertainty_settings(&network, &settings).unwrap();
        let error = cpt_sampling::sample_network(&network, &settings)
            .unwrap_err()
            .to_string();
        assert!(error.contains("1 + 1e-9"), "{error}");
    }
}

#[test]
fn generator_validation_rejects_invalid_structure_and_parameters() {
    let data = fixture();
    let case = &data["cases"][0];
    let network = graph(case);
    let base: HclUncertaintySettings = serde_json::from_value(case["settings"].clone()).unwrap();
    for field in [
        "theta",
        "betaR",
        "betaU",
        "trueStateId",
        "pgaParentId",
        "pgaCenters",
    ] {
        let mut json = case["settings"].clone();
        let g = &mut json["cpt_generators"][0]["generator"];
        g[field] = match field {
            "theta" | "betaR" => json!(0),
            "betaU" => json!(-1),
            "pgaCenters" => json!([]),
            _ => json!("missing"),
        };
        let settings = serde_json::from_value(json).unwrap();
        assert!(
            validate_hcl_uncertainty_settings(&network, &settings).is_err(),
            "{field}"
        );
    }
    let mut duplicate = base.clone();
    duplicate
        .cpt_generators
        .push(base.cpt_generators[0].clone());
    assert!(validate_hcl_uncertainty_settings(&network, &duplicate).is_err());
    let mut mixed = base.clone();
    mixed
        .cpt_row_distributions
        .push(crate::hcl::HclCptRowUncertaintySpec {
            node: "A".into(),
            row_index: 0,
            prior: crate::hcl::HclCptPrior::Dirichlet {
                alpha: vec![1., 1.],
            },
        });
    assert!(validate_hcl_uncertainty_settings(&network, &mixed).is_err());
    let case = &data["cases"][3];
    for field in ["noneStateId", "missionTime", "bins"] {
        let mut json = case["settings"].clone();
        json["cpt_generators"][0]["generator"][field] = match field {
            "missionTime" => json!(0),
            "bins" => json!([]),
            _ => json!("missing"),
        };
        let settings = serde_json::from_value(json).unwrap();
        assert!(
            validate_hcl_uncertainty_settings(&network, &settings).is_err(),
            "{field}"
        );
    }
    let mut settings: HclUncertaintySettings =
        serde_json::from_value(case["settings"].clone()).unwrap();
    if let HclCptGenerator::SeismicPgaBins { bins, .. } = &mut settings.cpt_generators[0].generator
    {
        bins[0].error_factor95 = 1.;
    }
    assert!(validate_hcl_uncertainty_settings(&network, &settings).is_err());
}

#[test]
fn generator_normal_inverse_cdf_matches_python_including_tails() {
    for value in fixture()["normal_quantiles"].as_array().unwrap() {
        let actual = statistics_normal::inverse_cdf(value["q"].as_f64().unwrap());
        let expected = value["z"].as_f64().unwrap();
        assert!((actual - expected).abs() < 2e-14, "{value}: {actual}");
    }
}
