use super::population::Plan;
use super::statistical_checks::{
    assert_fits, assert_mean_near, assert_same_population, contract_settings, floats, graph_of,
    standard_points, states_in, valued,
};
use super::*;
use crate::algorithms::bdd_engine::BddNode;
use crate::core::distribution::{Law, UncertainUnit};
use crate::core::special_functions as kernels;
use crate::hcl::{HclCptGenerator, HclFragilityDemand};
use serde_json::Value;

type GeneratorChange = Box<dyn Fn(&mut HclCptGenerator)>;

fn fixture() -> Value {
    serde_json::from_str(include_str!(
        "../../../tests/fixtures/hcl_mh_seismic/reference.json"
    ))
    .unwrap()
}

fn settings_of(case: &Value, network: &BayesianGraph) -> HclUncertaintySettings {
    contract_settings(&case["settings"], &states_in(network))
}

fn column(values: &[f64], index: usize, count: usize) -> &[f64] {
    &values[index * count..(index + 1) * count]
}

fn parent_state_of_rows(network: &BayesianGraph, node: &str, parent: &str) -> Vec<String> {
    let node = network.node_id(node).unwrap();
    let parent = network.node_id(parent).unwrap();
    let parents = network.parents(node).unwrap();
    let position = parents.iter().position(|candidate| *candidate == parent).unwrap();
    let stride: usize = parents[position + 1..]
        .iter()
        .map(|other| network.variable(*other).unwrap().cardinality())
        .product();
    let states = network.variable(parent).unwrap().states().to_vec();
    let rows = network.family_size(node).unwrap() / network.variable(node).unwrap().cardinality();
    (0..rows)
        .map(|row| states[(row / stride) % states.len()].clone())
        .collect()
}

fn source_generator<'a>(case: &'a Value, node: &str) -> &'a Value {
    case["settings"]["cpt_generators"]
        .as_array()
        .unwrap()
        .iter()
        .find(|generator| generator["node"] == node)
        .map(|generator| &generator["generator"])
        .unwrap()
}

#[test]
fn seismic_generators_match_the_source_population_and_exact_expectations() {
    for case in fixture()["cases"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let network = graph_of(case);
        let settings = settings_of(case, &network);
        validate_hcl_uncertainty_settings(&network, &settings).unwrap();
        let sampled = Plan::new(&network, &settings, &[])
            .unwrap()
            .draw(&network, &settings)
            .unwrap()
            .network;
        let count = settings.sample_count;
        for spec in &settings.cpt_generators {
            let ours = sampled.variable(sampled.node_id(&spec.node).unwrap()).unwrap().cpt().to_vec();
            let reference = floats(&case["cpts"][spec.node.as_str()]);
            let states = network.variable(network.node_id(&spec.node).unwrap()).unwrap().states().to_vec();
            match &spec.generator {
                HclCptGenerator::SeismicFragility {
                    pga_parent_id,
                    true_state_id,
                    demands,
                    ..
                } => {
                    let source = source_generator(case, &spec.node);
                    let theta = source["theta"].as_f64().unwrap();
                    let spread = source["betaR"].as_f64().unwrap().hypot(source["betaU"].as_f64().unwrap());
                    let true_index = states.iter().position(|state| state == true_state_id).unwrap();
                    for (row, state) in parent_state_of_rows(&network, &spec.node, pga_parent_id).iter().enumerate() {
                        let demand = demands.iter().find(|entry| &entry.state_id == state).unwrap().demand;
                        let exact = if demand > 0.0 {
                            kernels::normal_cdf((demand / theta).ln() / spread).unwrap()
                        } else {
                            0.0
                        };
                        let label = format!("{name} {} row {row}", spec.node);
                        let values = column(&ours, row * 2 + true_index, count);
                        assert_mean_near(values, exact, &label);
                        let uncertainty = source["betaU"].as_f64().unwrap();
                        let randomness = source["betaR"].as_f64().unwrap();
                        let fits = |population: &[f64], label: &str| {
                            if demand > 0.0 && uncertainty > 0.0 {
                                let center = (demand / theta).ln() / randomness;
                                let scale = uncertainty / randomness;
                                let points: Vec<f64> = standard_points()
                                    .iter()
                                    .map(|z| kernels::normal_cdf(center + scale * z).unwrap())
                                    .collect();
                                let cdf = |q: f64| {
                                    kernels::normal_cdf((kernels::normal_quantile(q).unwrap() - center) / scale)
                                        .unwrap()
                                };
                                assert_fits(population, &points, &cdf, label);
                            }
                        };
                        fits(values, &format!("{label} sampled"));
                        if !name.contains("clipped") {
                            let reference = column(&reference, row * 2 + true_index, count);
                            assert_same_population(values, reference, &label);
                            fits(reference, &format!("{label} reference"));
                        }
                    }
                }
                HclCptGenerator::SeismicPgaBins { bins, conversion, .. } => {
                    for (index, state) in states.iter().enumerate() {
                        let label = format!("{name} {} state {state}", spec.node);
                        let values = column(&ours, index, count);
                        assert_same_population(values, column(&reference, index, count), &label);
                        let source = source_generator(case, &spec.node)["bins"]
                            .as_array()
                            .unwrap()
                            .iter()
                            .find(|bin| bin["stateId"] == state.as_str());
                        let Some(source) = source else {
                            continue;
                        };
                        let median = source["medianFrequency"].as_f64().unwrap();
                        let sigma = source["errorFactor95"].as_f64().unwrap().ln() / 1.645;
                        if median == 0.0 {
                            assert!(values.iter().all(|value| *value == 0.0));
                            continue;
                        }
                        let linear = *conversion == crate::hcl::HclPgaFrequencyConversion::Linear;
                        if linear {
                            assert_mean_near(values, median * (0.5 * sigma * sigma).exp(), &label);
                        }
                        let points: Vec<f64> = standard_points()
                            .iter()
                            .map(|z| {
                                let exposure = median * (sigma * z).exp();
                                if linear {
                                    exposure
                                } else {
                                    -(-exposure).exp_m1()
                                }
                            })
                            .collect();
                        let cdf = |q: f64| {
                            let exposure = if linear { q } else { -(-q).ln_1p() };
                            kernels::normal_cdf((exposure / median).ln() / sigma).unwrap()
                        };
                        assert_fits(values, &points, &cdf, &format!("{label} sampled"));
                        assert_fits(column(&reference, index, count), &points, &cdf, &format!("{label} reference"));
                    }
                    assert_eq!(bins.len() + 1, states.len());
                    for trial in 0..count {
                        let total: f64 = (0..states.len()).map(|index| ours[index * count + trial]).sum();
                        assert!((total - 1.0).abs() <= 1e-12, "{name}: bins sum to {total}");
                    }
                }
            }
        }
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
                HclEventBinding::new(
                    index,
                    network.node_id(name).unwrap(),
                    vec![StateIndex::new(if *name == "A" { 1 } else { 0 })],
                )
                .unwrap(),
            )
            .unwrap();
    }
    (bdd, root, bindings)
}

#[test]
fn seismic_bdd_matches_the_source_across_chunks_and_evidence() {
    for case in fixture()["cases"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|case| case["outputs"].is_array())
    {
        let network = graph_of(case);
        let settings = settings_of(case, &network);
        let (bdd, root, bindings) = mixed_bdd(&network);
        let names = [Some("A".into()), Some("B".into()), Some("E".into())];
        let whole = PreparedHclUncertainty::with_chunk_size(&network, &settings, &[], 513).unwrap();
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
            let expected = whole
                .quantify(&bdd, root, bindings.clone(), evidence.clone(), &names)
                .unwrap();
            assert_same_population(&expected, &floats(&scenario["samples"]), &scenario["evidence"].to_string());
            for chunk_size in [1, 31, 256, 512] {
                let prepared =
                    PreparedHclUncertainty::with_chunk_size(&network, &settings, &[], chunk_size).unwrap();
                let values = prepared
                    .quantify(&bdd, root, bindings.clone(), evidence.clone(), &names)
                    .unwrap();
                for (left, right) in values.iter().zip(&expected) {
                    assert!((left - right).abs() <= 4.0 * f64::EPSILON, "{left} against {right}");
                }
            }
        }
    }
}

#[test]
fn excessive_bin_totals_fail_without_renormalizing() {
    for case in fixture()["errors"].as_array().unwrap() {
        let network = graph_of(case);
        let settings = settings_of(case, &network);
        validate_hcl_uncertainty_settings(&network, &settings).unwrap();
        let error = Plan::new(&network, &settings, &[])
            .unwrap()
            .draw(&network, &settings)
            .err()
            .unwrap()
            .to_string();
        assert!(error.contains("PGA bin"), "{error}");
    }
}

#[test]
fn generator_validation_rejects_invalid_structure_and_parameters() {
    let data = fixture();
    let case = &data["cases"][0];
    let network = graph_of(case);
    let base = settings_of(case, &network);
    let fragility = |change: &dyn Fn(&mut HclCptGenerator)| {
        let mut settings = base.clone();
        change(&mut settings.cpt_generators[0].generator);
        validate_hcl_uncertainty_settings(&network, &settings)
    };
    let changes: Vec<GeneratorChange> = vec![
        Box::new(|generator| {
            if let HclCptGenerator::SeismicFragility { randomness, .. } = generator {
                *randomness = valued(UncertainUnit::Factor, Law::Point { value: -0.3 });
            }
        }),
        Box::new(|generator| {
            if let HclCptGenerator::SeismicFragility { true_state_id, .. } = generator {
                *true_state_id = "missing".into();
            }
        }),
        Box::new(|generator| {
            if let HclCptGenerator::SeismicFragility { pga_parent_id, .. } = generator {
                *pga_parent_id = "B".into();
            }
        }),
        Box::new(|generator| {
            if let HclCptGenerator::SeismicFragility { demands, .. } = generator {
                demands.pop();
            }
        }),
        Box::new(|generator| {
            if let HclCptGenerator::SeismicFragility { demands, .. } = generator {
                demands.push(HclFragilityDemand {
                    state_id: "low".into(),
                    demand: 0.2,
                });
            }
        }),
    ];
    for change in &changes {
        assert!(fragility(change.as_ref()).is_err());
    }
    let mut zero_median = base.clone();
    if let HclCptGenerator::SeismicFragility { median, .. } = &mut zero_median.cpt_generators[0].generator {
        *median = valued(UncertainUnit::Quantity, Law::Point { value: 0.0 });
    }
    validate_hcl_uncertainty_settings(&network, &zero_median).unwrap();
    let error = Plan::new(&network, &zero_median, &[])
        .unwrap()
        .draw(&network, &zero_median)
        .err()
        .unwrap()
        .to_string();
    assert!(error.contains("median of BN node 'A'"), "{error}");
    let mut duplicate = base.clone();
    duplicate.cpt_generators.push(base.cpt_generators[0].clone());
    assert!(validate_hcl_uncertainty_settings(&network, &duplicate).is_err());
    let mut mixed = base.clone();
    mixed.cpt_rows.push(crate::hcl::HclCptRowUncertainty {
        node: "A".into(),
        row_index: 0,
        row: crate::core::distribution::UncertainVector::Value {
            law: crate::core::distribution::VectorLaw::Dirichlet {
                concentrations: vec![1., 1.],
            },
        },
    });
    assert!(validate_hcl_uncertainty_settings(&network, &mixed).is_err());
    let case = &data["cases"][3];
    let bins = settings_of(case, &network);
    for change in [0usize, 1, 2] {
        let mut settings = bins.clone();
        if let HclCptGenerator::SeismicPgaBins {
            none_state_id,
            bins,
            ..
        } = &mut settings.cpt_generators[0].generator
        {
            match change {
                0 => *none_state_id = "missing".into(),
                1 => bins.clear(),
                _ => bins[0].state_id = "none".into(),
            }
        }
        assert!(validate_hcl_uncertainty_settings(&network, &settings).is_err(), "{change}");
    }
}
