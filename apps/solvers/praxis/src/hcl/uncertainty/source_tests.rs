use super::statistical_checks::{
    assert_fits_law, assert_mean_near, assert_same_population, contract_settings, floats,
    probability, states_in, valued,
};
use super::*;
use crate::algorithms::bdd_engine::BddNode;
use crate::core::distribution::{
    Law, ParameterReference, ParameterReferenceType, UncertainExpression, UncertainParameter,
    UncertainUnit, UncertainVector, VectorLaw,
};
use crate::core::event::BasicEvent;
use crate::expression::Expr;
use crate::hcl::{HclBasicEventUncertainty, HclCptRowUncertainty, HclSampler};

fn reference() -> serde_json::Value {
    serde_json::from_str(include_str!(
        "../../../tests/fixtures/hcl_mh_uq/reference.json"
    ))
    .unwrap()
}

fn network() -> BayesianGraph {
    let mut graph = BayesianGraph::new();
    let a = graph.add_variable("A", &["F", "T"]).unwrap();
    let b = graph.add_variable("B", &["F", "T"]).unwrap();
    graph.add_edge(a, b).unwrap();
    graph.set_cpt(a, vec![0.75, 0.25]).unwrap();
    graph.set_cpt(b, vec![0.9, 0.1, 0.1, 0.9]).unwrap();
    graph
}

fn prepared(graph: &BayesianGraph, settings: &HclUncertaintySettings) -> PreparedHclUncertainty {
    PreparedHclUncertainty::new(graph, settings, &[]).unwrap()
}

fn settings_of(graph: &BayesianGraph, case: &serde_json::Value) -> HclUncertaintySettings {
    contract_settings(&case["settings"], &states_in(graph))
}

fn event_law(settings: &HclUncertaintySettings, event: &str) -> Law {
    let entry = settings
        .basic_events
        .iter()
        .find(|entry| entry.event == event)
        .unwrap();
    match &entry.expression {
        UncertainExpression::Value { value } => value.law.clone(),
        _ => panic!("fixture events hold one law"),
    }
}

fn assert_event_matches(
    population: &PreparedHclUncertainty,
    settings: &HclUncertaintySettings,
    event: &str,
    reference: &[f64],
    label: &str,
) {
    let ours = &population.event_samples[event];
    let law = event_law(settings, event);
    assert_same_population(ours, reference, label);
    assert_fits_law(ours, &law, &format!("{label} sampled"));
    assert_fits_law(reference, &law, &format!("{label} reference"));
}

#[test]
fn every_source_distribution_matches_the_reference_population() {
    let fixture = reference();
    let graph = network();
    for case in fixture["cases"].as_array().unwrap() {
        let settings = settings_of(&graph, case);
        let population = prepared(&graph, &settings);
        let reference = floats(&case["samples"]);
        assert_event_matches(&population, &settings, "E", &reference, case["name"].as_str().unwrap());
    }
}

#[test]
fn mixed_lhs_vectors_and_bdd_match_the_source_populations() {
    let fixture = reference();
    let case = &fixture["lhs_vector_case"];
    let graph = network();
    let settings = settings_of(&graph, case);
    let population = prepared(&graph, &settings);
    for (name, values) in case["event_samples"].as_object().unwrap() {
        assert_event_matches(&population, &settings, name, &floats(values), name);
    }
    let mut bdd = Bdd::new();
    let normal = bdd.alloc_node(BddNode::new(1, BDD_TRUE, BDD_FALSE));
    let gamma = bdd.alloc_node(BddNode::new(2, BDD_TRUE, BDD_FALSE));
    let top = bdd.alloc_node(BddNode::new(0, normal, gamma));
    bdd.set_var_probs(vec![0.2; 3]);
    let names = ["BETA", "NORMAL", "GAMMA"].map(|name| Some(name.to_string()));
    let actual = population
        .quantify(
            &bdd,
            top,
            HclEventBindings::new(),
            HclBaseEvidence::unobserved(2),
            &names,
        )
        .unwrap();
    assert_same_population(&actual, &floats(&case["top"]), "LHS vector BDD");
}

#[test]
fn vectors_complements_and_endpoints_match_the_source_populations() {
    let fixture = reference();
    let case = &fixture["vector_case"];
    let graph = network();
    let settings = settings_of(&graph, case);
    let population = prepared(&graph, &settings);
    for event in ["E", "L", "U"] {
        assert_event_matches(&population, &settings, event, &floats(&case["event_samples"][event]), event);
    }
    let mut bdd = Bdd::new();
    let u = bdd.alloc_node(BddNode::new(2, BDD_TRUE, BDD_FALSE));
    let l = bdd.alloc_node(BddNode::new(1, BDD_TRUE, BDD_FALSE));
    let top = bdd.alloc_node(BddNode::new(0, u, l));
    let zero = bdd.alloc_node(BddNode::new(3, BDD_TRUE, BDD_FALSE));
    let one = bdd.alloc_node(BddNode::new(4, BDD_TRUE, BDD_FALSE));
    bdd.set_var_probs(vec![0.2, 0.2, 0.2, 0.0, 1.0]);
    let names = ["E", "L", "U", "Z", "O"].map(|s| Some(s.to_string()));
    let run = |root| {
        population
            .quantify(
                &bdd,
                root,
                HclEventBindings::new(),
                HclBaseEvidence::unobserved(2),
                &names,
            )
            .unwrap()
    };
    let samples = run(top);
    assert_same_population(&samples, &floats(&case["outputs"]["TOP"]), "TOP");
    assert!(run(zero).iter().all(|value| *value == 0.0));
    assert!(run(one).iter().all(|value| *value == 1.0));
    for ((e, (l, u)), top) in population.event_samples["E"]
        .iter()
        .zip(population.event_samples["L"].iter().zip(&population.event_samples["U"]))
        .zip(&samples)
    {
        let exact = e * u + (1.0 - e) * l;
        assert!((top - exact).abs() <= 4.0 * f64::EPSILON, "{top} against {exact}");
    }
    let complement = run(top.complement());
    for (value, top) in complement.iter().zip(&samples) {
        assert!((value - (1.0 - top)).abs() <= 2.0 * f64::EPSILON);
    }
}

fn linked_bdd(graph: &BayesianGraph) -> (Bdd, BddRef, HclEventBindings, Vec<Option<String>>) {
    let mut bdd = Bdd::new();
    let e = bdd.alloc_node(BddNode::new(2, BDD_TRUE, BDD_FALSE));
    let l = bdd.alloc_node(BddNode::new(3, BDD_TRUE, BDD_FALSE));
    let b = bdd.alloc_node(BddNode::new(1, l, BDD_FALSE));
    let top = bdd.alloc_node(BddNode::new(0, e, b));
    bdd.set_var_probs(vec![0.25, 0.3, 0.2, 0.2]);
    let mut bindings = HclEventBindings::new();
    for (index, name) in ["A", "B"].iter().enumerate() {
        bindings
            .insert(
                HclEventBinding::new(
                    index,
                    graph.node_id(name).unwrap(),
                    vec![StateIndex::new(1)],
                )
                .unwrap(),
            )
            .unwrap();
    }
    let names = ["A", "B", "E", "L"].map(|s| Some(s.to_string())).to_vec();
    (bdd, top, bindings, names)
}

#[test]
fn vectorized_bn_conditioning_matches_the_source_under_evidence() {
    let fixture = reference();
    let case = &fixture["vector_case"];
    let graph = network();
    let population = prepared(&graph, &settings_of(&graph, case));
    let (bdd, root, bindings, names) = linked_bdd(&graph);
    for scenario in case["linked"].as_array().unwrap() {
        let mut evidence = HclBaseEvidence::unobserved(2);
        for (node, state) in scenario["evidence"].as_object().unwrap() {
            evidence
                .observe(
                    graph.node_id(node).unwrap(),
                    StateIndex::new(state.as_u64().unwrap() as usize),
                )
                .unwrap();
        }
        let actual = population
            .quantify(&bdd, root, bindings.clone(), evidence, &names)
            .unwrap();
        assert_same_population(&actual, &floats(&scenario["samples"]), "BN evidence");
    }
}

fn dirichlet(node: &str, row_index: usize, concentrations: Vec<f64>) -> HclCptRowUncertainty {
    HclCptRowUncertainty {
        node: node.into(),
        row_index,
        row: UncertainVector::Value {
            law: VectorLaw::Dirichlet { concentrations },
        },
    }
}

#[test]
fn chunks_preserve_cpt_and_ft_sample_pairing() {
    let case = &reference()["vector_case"];
    let graph = network();
    let mut settings = settings_of(&graph, case);
    let ft_only = prepared(&graph, &settings);
    settings.cpt_rows = vec![dirichlet("A", 0, vec![16.0, 4.0]), dirichlet("B", 1, vec![1.5, 13.5])];
    let whole =
        PreparedHclUncertainty::with_chunk_size(&graph, &settings, &[], settings.sample_count).unwrap();
    assert_eq!(ft_only.event_samples, whole.event_samples);
    let (bdd, root, bindings, names) = linked_bdd(&graph);
    let evidence = HclBaseEvidence::unobserved(2);
    let expected = whole
        .quantify(&bdd, root, bindings.clone(), evidence.clone(), &names)
        .unwrap();
    for size in [1, 31, 256, 512] {
        let chunks = PreparedHclUncertainty::with_chunk_size(&graph, &settings, &[], size).unwrap();
        assert_eq!(chunks.event_samples, whole.event_samples);
        assert!(chunks.chunks.iter().all(|chunk| chunk.end - chunk.start <= size));
        let actual = chunks
            .quantify(&bdd, root, bindings.clone(), evidence.clone(), &names)
            .unwrap();
        for (left, right) in actual.iter().zip(&expected) {
            assert!((left - right).abs() <= 4.0 * f64::EPSILON, "{left} against {right}");
        }
    }
}

fn plain_settings(sampler: HclSampler, count: usize, seed: u64) -> HclUncertaintySettings {
    HclUncertaintySettings {
        sample_count: count,
        seed,
        sampler,
        basic_events: Vec::new(),
        cpt_rows: Vec::new(),
        cpt_generators: Vec::new(),
        uncertainty_parameters: Vec::new(),
        uncertainty_vectors: Vec::new(),
    }
}

#[test]
fn samples_cpt_rows_and_typed_events_reproducibly() {
    let mut graph = BayesianGraph::new();
    let node = graph.add_variable("N", &["F", "T"]).unwrap();
    graph.set_cpt(node, vec![0.8, 0.2]).unwrap();
    let mut settings = plain_settings(HclSampler::MonteCarlo, 2000, 42);
    settings.basic_events = vec![HclBasicEventUncertainty {
        event: "E".to_string(),
        expression: probability(Law::Beta {
            alpha: 2.0,
            beta: 8.0,
            lower: 0.0,
            upper: 1.0,
        }),
    }];
    settings.cpt_rows = vec![dirichlet("N", 0, vec![16.0, 4.0])];
    let first = prepared(&graph, &settings);
    let second = prepared(&graph, &settings);
    assert_eq!(first.event_samples["E"], second.event_samples["E"]);
    assert_eq!(first.sample_count(), 2000);
    assert_eq!(first.seed(), 42);
    assert_mean_near(&first.event_samples["E"], 0.2, "Beta(2, 8)");
}

#[test]
fn quantifies_a_sampled_unbound_bdd() {
    let mut graph = BayesianGraph::new();
    let node = graph.add_variable("N", &["F", "T"]).unwrap();
    graph.set_cpt(node, vec![0.8, 0.2]).unwrap();
    let mut settings = plain_settings(HclSampler::LatinHypercube, 100, 7);
    settings.basic_events = vec![HclBasicEventUncertainty {
        event: "E".to_string(),
        expression: probability(Law::Uniform {
            lower: 0.1,
            upper: 0.3,
        }),
    }];
    let population = prepared(&graph, &settings);
    let mut bdd = Bdd::new();
    let root = bdd.alloc_node(BddNode::new(0, BDD_TRUE, BDD_FALSE));
    bdd.set_var_probs(vec![0.2]);
    let samples = population
        .quantify(
            &bdd,
            root,
            HclEventBindings::new(),
            HclBaseEvidence::unobserved(1),
            &[Some("E".to_string())],
        )
        .unwrap();
    assert_eq!(samples.len(), 100);
    assert!(samples.iter().all(|sample| (0.1..0.3).contains(sample)));
    let mut bins = [0usize; 100];
    for sample in &samples {
        bins[((sample - 0.1) / 0.2 * 100.0).floor() as usize] += 1;
    }
    assert!(bins.iter().all(|count| *count == 1));
}

fn reference_to(entity: &str) -> ParameterReference {
    ParameterReference {
        reference_type: ParameterReferenceType::WorkbookParameter,
        workbook_id: "da".to_string(),
        entity_id: entity.to_string(),
    }
}

#[test]
fn catalogue_expressions_sample_unless_overridden_and_points_stay_points() {
    let graph = network();
    let mut tree = FaultTree::new("FT", "TOP").unwrap();
    let shared = Expr::Parameter("da:pump".to_string());
    tree.set_parameter(
        "da:pump".to_string(),
        Expr::Draw {
            key: "da:pump".to_string(),
            law: Box::new(Law::Uniform {
                lower: 0.01,
                upper: 0.2,
            }),
        },
    );
    tree.add_basic_event(BasicEvent::with_value("C".to_string(), 0.105, shared.clone()).unwrap())
        .unwrap();
    tree.add_basic_event(BasicEvent::with_value("D".to_string(), 0.105, shared).unwrap())
        .unwrap();
    tree.add_basic_event(BasicEvent::new("P".to_string(), 0.3).unwrap())
        .unwrap();
    let mut settings = plain_settings(HclSampler::MonteCarlo, 500, 5);
    settings.uncertainty_parameters = vec![UncertainParameter {
        reference: reference_to("pump"),
        expression: probability(Law::Uniform {
            lower: 0.01,
            upper: 0.2,
        }),
    }];
    settings.basic_events = vec![HclBasicEventUncertainty {
        event: "D".to_string(),
        expression: UncertainExpression::Operation {
            operation: crate::core::distribution::UncertainOperation::Multiply,
            operands: vec![
                valued(UncertainUnit::Factor, Law::Point { value: 2.0 }),
                UncertainExpression::Parameter {
                    reference: reference_to("pump"),
                },
            ],
        },
    }];
    let population = PreparedHclUncertainty::new(&graph, &settings, &[&tree]).unwrap();
    let c = &population.event_samples["C"];
    let d = &population.event_samples["D"];
    assert!(!population.event_samples.contains_key("P"));
    for (left, right) in c.iter().zip(d) {
        assert!((2.0 * left - right).abs() <= 2.0 * f64::EPSILON);
        assert!((0.01..=0.2).contains(left));
    }
    let mut bdd = Bdd::new();
    let root = bdd.alloc_node(BddNode::new(0, BDD_TRUE, BDD_FALSE));
    bdd.set_var_probs(vec![0.3]);
    let points = population
        .quantify(
            &bdd,
            root,
            HclEventBindings::new(),
            HclBaseEvidence::unobserved(2),
            &[Some("P".to_string())],
        )
        .unwrap();
    assert!(points.iter().all(|value| *value == 0.3));
}

#[test]
fn bound_overrides_unknown_samplers_and_laws_outside_probability_fail() {
    let graph = network();
    let (bdd, root, bindings, names) = linked_bdd(&graph);
    let mut settings = plain_settings(HclSampler::MonteCarlo, 50, 3);
    settings.basic_events = vec![HclBasicEventUncertainty {
        event: "A".to_string(),
        expression: probability(Law::Uniform {
            lower: 0.1,
            upper: 0.3,
        }),
    }];
    let error = prepared(&graph, &settings)
        .quantify(&bdd, root, bindings, HclBaseEvidence::unobserved(2), &names)
        .unwrap_err();
    assert!(error.to_string().contains("BN-bound"), "{error}");
    settings.basic_events[0].expression = probability(Law::Lognormal {
        mean: 0.2,
        error_factor: 8.0,
        level: 0.95,
    });
    assert!(validate_hcl_uncertainty_settings(&graph, &settings).is_err());
    let mut json = serde_json::to_value(plain_settings(HclSampler::MonteCarlo, 50, 3)).unwrap();
    json["sampler"] = "APPROXIMATE".into();
    assert!(serde_json::from_value::<HclUncertaintySettings>(json.clone()).is_err());
    json.as_object_mut().unwrap().remove("sampler");
    assert!(serde_json::from_value::<HclUncertaintySettings>(json).is_err());
}

fn raw_law(distribution: &serde_json::Value) -> Law {
    let number = |field: &str| distribution[field].as_f64().unwrap();
    match distribution["family"].as_str().unwrap() {
        "BETA" => Law::Beta {
            alpha: number("alpha"),
            beta: number("beta"),
            lower: 0.0,
            upper: 1.0,
        },
        "UNIFORM" => Law::Uniform {
            lower: number("lower"),
            upper: number("upper"),
        },
        "NORMAL" => Law::Normal {
            mean: number("mean"),
            standard_deviation: number("standard_deviation"),
        },
        "LOGNORMAL" => super::statistical_checks::source_lognormal(number("median"), number("error_factor")),
        "LOGITNORMAL" => Law::LogitNormal {
            mu: number("mu"),
            sigma: number("sigma"),
        },
        "GAMMA" => Law::Gamma {
            shape: number("shape"),
            rate: 1.0 / number("scale"),
        },
        "EXPONENTIAL" => Law::Gamma {
            shape: 1.0,
            rate: number("rate"),
        },
        "TRIANGULAR" => Law::Triangular {
            lower: number("lower"),
            mode: number("mode"),
            upper: number("upper"),
        },
        other => panic!("unknown family {other}"),
    }
}

fn from_bits(values: &serde_json::Value) -> Vec<f64> {
    values
        .as_array()
        .unwrap()
        .iter()
        .map(|value| f64::from_bits(u64::from_str_radix(value.as_str().unwrap(), 16).unwrap()))
        .collect()
}

#[test]
fn distribution_domains_match_the_source_or_fail_validation() {
    #[cfg(target_os = "windows")]
    let data = include_str!("../../../tests/fixtures/hcl_mh_distribution_domain/reference-windows.json");
    #[cfg(not(target_os = "windows"))]
    let data = include_str!("../../../tests/fixtures/hcl_mh_distribution_domain/reference-linux.json");
    let fixture: serde_json::Value = serde_json::from_str(data).unwrap();
    let graph = network();
    for case in fixture["cases"].as_array().unwrap() {
        let label = case["id"].as_str().unwrap();
        let mut settings = plain_settings(
            if case["sampler"] == "MC" {
                HclSampler::MonteCarlo
            } else {
                HclSampler::LatinHypercube
            },
            case["sample_count"].as_u64().unwrap() as usize,
            case["seed"].as_u64().unwrap(),
        );
        match super::statistical_checks::probability_law(&case["distribution"]) {
            Some(law) => {
                settings.basic_events = vec![HclBasicEventUncertainty {
                    event: "E".to_string(),
                    expression: probability(law.clone()),
                }];
                let ours = prepared(&graph, &settings).event_samples["E"].clone();
                assert_fits_law(&ours, &law, label);
                if case["status"] == "FINITE" {
                    let reference = from_bits(&case["sample_bits"]);
                    assert_same_population(&ours, &reference, label);
                    assert_fits_law(&reference, &law, &format!("{label} reference"));
                }
            }
            None => {
                settings.basic_events = vec![HclBasicEventUncertainty {
                    event: "E".to_string(),
                    expression: probability(raw_law(&case["distribution"])),
                }];
                assert!(validate_hcl_uncertainty_settings(&graph, &settings).is_err(), "{label}");
            }
        }
    }
}
