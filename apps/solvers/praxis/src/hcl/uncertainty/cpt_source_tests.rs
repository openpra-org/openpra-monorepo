use super::population::Plan;
use super::statistical_checks::{
    assert_fits_law, assert_mean_within, assert_same_population, contract_settings, floats,
    graph_of, states_in,
};
use crate::core::distribution::Law;
use super::*;
use crate::algorithms::bdd_engine::BddNode;
use crate::core::distribution::{UncertainVector, VectorLaw};
use serde_json::{json, Value};

fn fixture() -> Value {
    serde_json::from_str(include_str!(
        "../../../tests/fixtures/hcl_mh_cpt/reference.json"
    ))
    .unwrap()
}

fn settings_of(case: &Value, network: &BayesianGraph) -> HclUncertaintySettings {
    contract_settings(&case["settings"], &states_in(network))
}

fn sampled_cpts(network: &BayesianGraph, settings: &HclUncertaintySettings) -> BayesianGraph {
    validate_hcl_uncertainty_settings(network, settings).unwrap();
    Plan::new(network, settings, &[])
        .unwrap()
        .draw(network, settings)
        .unwrap()
        .network
}

fn column(values: &[f64], index: usize, count: usize) -> &[f64] {
    &values[index * count..(index + 1) * count]
}

fn exact_moments(row: &UncertainVector) -> Vec<(f64, f64)> {
    let UncertainVector::Value { law } = row else {
        panic!("fixture rows hold their own law");
    };
    let means = law.mean();
    match law {
        VectorLaw::Dirichlet { concentrations } => {
            let total: f64 = concentrations.iter().sum();
            means
                .iter()
                .map(|mean| (*mean, mean * (1.0 - mean) / (total + 1.0)))
                .collect()
        }
        VectorLaw::Fixed { .. } => means.iter().map(|mean| (*mean, 0.0)).collect(),
        VectorLaw::WeightedDirichlet { .. } => panic!("fixture rows hold no weighted law"),
    }
}

fn source_resolves_tails(row: &UncertainVector) -> bool {
    match row {
        UncertainVector::Value {
            law: VectorLaw::Dirichlet { concentrations },
        } => concentrations.iter().all(|value| *value == 0.0 || *value >= 0.1),
        _ => true,
    }
}

fn marginal_law(row: &UncertainVector, state: usize) -> Option<Law> {
    let UncertainVector::Value {
        law: VectorLaw::Dirichlet { concentrations },
    } = row
    else {
        return None;
    };
    let total: f64 = concentrations.iter().sum();
    let own = concentrations[state];
    let rest = total - own;
    if own == 0.0 {
        Some(Law::Point { value: 0.0 })
    } else if rest == 0.0 {
        Some(Law::Point { value: 1.0 })
    } else if own.min(rest) >= 1e-3 {
        Some(Law::Beta {
            alpha: own,
            beta: rest,
            lower: 0.0,
            upper: 1.0,
        })
    } else {
        None
    }
}

fn check_case(case: &Value) {
    let name = case["name"].as_str().unwrap();
    let network = graph_of(case);
    let settings = settings_of(case, &network);
    let sampled = sampled_cpts(&network, &settings);
    let count = settings.sample_count;
    let clipped = name.contains("clipped");
    for variable in network.variables() {
        let width = variable.cardinality();
        let ours = sampled.variable(variable.id()).unwrap().cpt();
        let nominal = variable.cpt();
        let rows = nominal.len() / width;
        if ours.len() == nominal.len() {
            assert_eq!(ours, nominal, "{name}: {} keeps its CPT", variable.name());
            continue;
        }
        assert_eq!(ours.len(), nominal.len() * count, "{name}: batch size");
        for row in 0..rows {
            let sampled_row = settings
                .cpt_rows
                .iter()
                .find(|entry| entry.node == variable.name() && entry.row_index == row);
            for trial in 0..count {
                let total: f64 = (0..width)
                    .map(|state| ours[(row * width + state) * count + trial])
                    .sum();
                assert!((total - 1.0).abs() <= 1e-12, "{name}: row {row} sums to {total}");
            }
            let Some(entry) = sampled_row else {
                for state in 0..width {
                    assert!(column(ours, row * width + state, count)
                        .iter()
                        .all(|value| *value == nominal[row * width + state]));
                }
                continue;
            };
            let moments = exact_moments(&entry.row);
            for (state, (mean, variance)) in moments.iter().enumerate() {
                let values = column(ours, row * width + state, count);
                let label = format!("{name} {} row {row} state {state}", variable.name());
                assert_mean_within(values, *mean, *variance, &label);
                let marginal = marginal_law(&entry.row, state);
                if let Some(law) = &marginal {
                    assert_fits_law(values, law, &format!("{label} sampled"));
                }
                if case["nonfinite"] != true && !clipped && source_resolves_tails(&entry.row) {
                    let reference = floats(&case["cpts"][variable.name()]);
                    let reference = column(&reference, row * width + state, count);
                    assert_same_population(values, reference, &label);
                    if let Some(law) = &marginal {
                        assert_fits_law(reference, law, &format!("{label} reference"));
                    }
                }
            }
        }
    }
}

#[test]
fn every_cpt_prior_matches_the_source_population_and_its_exact_mean() {
    let fixture = fixture();
    for case in fixture["cases"].as_array().unwrap() {
        check_case(case);
    }
    for case in fixture["mixed"].as_array().unwrap() {
        check_case(case);
    }
}

fn mixed_bdd(network: &BayesianGraph) -> (Bdd, BddRef, HclEventBindings) {
    let mut bdd = Bdd::new();
    let e = bdd.alloc_node(BddNode::new(2, BDD_TRUE, BDD_FALSE));
    let b = bdd.alloc_node(BddNode::new(1, BDD_TRUE, BDD_FALSE));
    let root = bdd.alloc_node(BddNode::new(0, e, b));
    bdd.set_var_probs(vec![0.25, 0.3, 0.2]);
    let mut bindings = HclEventBindings::new();
    for (index, name) in ["A", "B"].iter().enumerate() {
        bindings
            .insert(
                HclEventBinding::new(index, network.node_id(name).unwrap(), vec![StateIndex::new(1)])
                    .unwrap(),
            )
            .unwrap();
    }
    (bdd, root, bindings)
}

fn evidence_for(network: &BayesianGraph, scenario: &Value) -> HclBaseEvidence {
    let mut evidence = HclBaseEvidence::unobserved(network.num_variables());
    for (name, state) in scenario["evidence"].as_object().unwrap() {
        evidence
            .observe(
                network.node_id(name).unwrap(),
                StateIndex::new(state.as_u64().unwrap() as usize),
            )
            .unwrap();
    }
    evidence
}

#[test]
fn sampled_cpts_and_ft_vectors_match_the_source_bdd_with_evidence_and_chunking() {
    for case in fixture()["mixed"].as_array().unwrap() {
        let network = graph_of(case);
        let settings = settings_of(case, &network);
        let (bdd, root, bindings) = mixed_bdd(&network);
        let names = [Some("A".into()), Some("B".into()), Some("E".into())];
        let whole = PreparedHclUncertainty::with_chunk_size(&network, &settings, &[], 513).unwrap();
        assert_same_population(&whole.event_samples["E"], &floats(&case["ft_samples"]), "E");
        for scenario in case["outputs"].as_array().unwrap() {
            let expected = whole
                .quantify(&bdd, root, bindings.clone(), evidence_for(&network, scenario), &names)
                .unwrap();
            assert_same_population(&expected, &floats(&scenario["samples"]), &scenario["evidence"].to_string());
            for chunk_size in [1, 31, 256, 512] {
                let prepared =
                    PreparedHclUncertainty::with_chunk_size(&network, &settings, &[], chunk_size).unwrap();
                let values = prepared
                    .quantify(&bdd, root, bindings.clone(), evidence_for(&network, scenario), &names)
                    .unwrap();
                for (left, right) in values.iter().zip(&expected) {
                    assert!((left - right).abs() <= 4.0 * f64::EPSILON, "{left} against {right}");
                }
            }
        }
    }
}

#[test]
fn beta_priors_become_dirichlet_rows_in_state_order() {
    let data = fixture();
    let case = data["cases"]
        .as_array()
        .unwrap()
        .iter()
        .find(|case| case["name"] == "beta_reversed_MC")
        .unwrap();
    let network = graph_of(case);
    let settings = settings_of(case, &network);
    assert_eq!(
        settings.cpt_rows[0].row,
        UncertainVector::Value {
            law: VectorLaw::Dirichlet {
                concentrations: vec![0.2, 0.7]
            }
        }
    );
}

#[test]
fn invalid_rows_and_removed_settings_fail_without_a_fallback() {
    let data = fixture();
    let case = &data["cases"][0];
    let network = graph_of(case);
    for law in [
        VectorLaw::Dirichlet {
            concentrations: vec![0.0, 0.0],
        },
        VectorLaw::Dirichlet {
            concentrations: vec![-1.0, 2.0],
        },
        VectorLaw::Dirichlet {
            concentrations: vec![1.0],
        },
        VectorLaw::Dirichlet {
            concentrations: vec![f64::INFINITY, 1.0],
        },
        VectorLaw::Dirichlet {
            concentrations: vec![1.0, 2.0, 3.0],
        },
        VectorLaw::Fixed {
            values: vec![0.5, 0.3],
        },
    ] {
        let mut settings = settings_of(case, &network);
        settings.cpt_rows[0].row = UncertainVector::Value { law };
        assert!(validate_hcl_uncertainty_settings(&network, &settings).is_err());
    }
    let mut settings = settings_of(case, &network);
    settings.cpt_rows[0].row_index = 1;
    assert!(validate_hcl_uncertainty_settings(&network, &settings).is_err());
    let mut json = serde_json::to_value(settings_of(case, &network)).unwrap();
    json["cptProbabilityClipEpsilon"] = json!(0.05);
    assert!(serde_json::from_value::<HclUncertaintySettings>(json).is_err());
    assert!(serde_json::from_value::<crate::hcl::HclCptRowUncertainty>(
        json!({"node":"N","rowIndex":0,"equivalentSampleSize":20})
    )
    .is_err());
}
