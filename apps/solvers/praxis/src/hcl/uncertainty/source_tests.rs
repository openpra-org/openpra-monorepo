use super::*;
use crate::algorithms::bdd_engine::BddNode;
use crate::hcl::HclCptRowUncertaintySpec;

fn reference() -> serde_json::Value {
    serde_json::from_str(include_str!(
        "../../../tests/fixtures/hcl_mh_uq/reference.json"
    ))
    .unwrap()
}

fn expected(value: &serde_json::Value) -> Vec<f64> {
    serde_json::from_value(value.clone()).unwrap()
}

fn assert_samples(actual: &[f64], expected: &[f64], label: &str) {
    assert_eq!(actual.len(), expected.len(), "{label}: sample count");
    for (index, (actual, expected)) in actual.iter().zip(expected).enumerate() {
        // NumPy and Rust can use different platform exp/log implementations.
        // This allows rounding differences, not different random draws.
        let tolerance = 5e-16 + 2e-14 * expected.abs();
        assert!(
            (actual - expected).abs() <= tolerance,
            "{label}[{index}]: Rust={actual:.17e}, HCL_MH={expected:.17e}"
        );
    }
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

#[test]
fn all_monte_carlo_and_lhs_distributions_match_hcl_mh_sample_by_sample() {
    let fixture = reference();
    let graph = network();
    for case in fixture["cases"].as_array().unwrap() {
        let settings = serde_json::from_value(case["settings"].clone()).unwrap();
        let population = PreparedHclUncertainty::new(&graph, &settings).unwrap();
        assert_samples(
            &population.event_samples["E"],
            &expected(&case["samples"]),
            case["name"].as_str().unwrap(),
        );
    }
}

#[test]
fn mixed_lhs_vectors_and_bdd_match_the_source() {
    let fixture = reference();
    let case = &fixture["lhs_vector_case"];
    let settings = serde_json::from_value(case["settings"].clone()).unwrap();
    let graph = network();
    let prepared = PreparedHclUncertainty::new(&graph, &settings).unwrap();
    for (name, values) in case["event_samples"].as_object().unwrap() {
        assert_samples(&prepared.event_samples[name], &expected(values), name);
    }
    // Same source function: (BETA AND NORMAL) OR (NOT BETA AND GAMMA).
    let mut bdd = Bdd::new();
    let normal = bdd.alloc_node(BddNode::new(1, BDD_TRUE, BDD_FALSE));
    let gamma = bdd.alloc_node(BddNode::new(2, BDD_TRUE, BDD_FALSE));
    let top = bdd.alloc_node(BddNode::new(0, normal, gamma));
    bdd.set_var_probs(vec![0.2; 3]);
    let names = ["BETA", "NORMAL", "GAMMA"].map(|name| Some(name.to_string()));
    let actual = prepared
        .quantify(
            &bdd,
            top,
            HclEventBindings::new(),
            HclBaseEvidence::unobserved(2),
            &names,
        )
        .unwrap();
    assert_samples(&actual, &expected(&case["top"]), "LHS vector BDD");
}

#[test]
fn lhs_stratification_preserves_one_draw_per_probability_interval() {
    for size in [10, 513, 1_000, 10_000] {
        let mut rng = NumpyRng::new(42);
        for _ in 0..3 {
            let draws = rng.lhs_quantiles(size);
            let mut bins = vec![0; size];
            for draw in &draws {
                assert!((0.0..1.0).contains(draw));
                bins[(draw * size as f64).floor() as usize] += 1;
            }
            assert!(bins.iter().all(|count| *count == 1));
            assert!(draws.windows(2).any(|pair| pair[0] > pair[1]));
        }
    }
}

#[test]
fn legacy_settings_default_to_mc_and_unknown_samplers_are_rejected() {
    let mut settings = reference()["cases"][0]["settings"].clone();
    settings
        .as_object_mut()
        .unwrap()
        .remove("basic_event_sampler");
    let parsed: HclUncertaintySettings = serde_json::from_value(settings.clone()).unwrap();
    assert_eq!(parsed.sampler, crate::hcl::HclSampler::MonteCarlo);
    settings["sampler"] = "APPROXIMATE".into();
    assert!(serde_json::from_value::<HclUncertaintySettings>(settings).is_err());
}

#[test]
fn vectors_complements_and_nominal_endpoints_match_hcl_mh() {
    let fixture = reference();
    let case = &fixture["vector_case"];
    let settings: HclUncertaintySettings =
        serde_json::from_value(case["settings"].clone()).unwrap();
    let graph = network();
    let prepared = PreparedHclUncertainty::new(&graph, &settings).unwrap();
    for event in ["E", "L", "U"] {
        assert_samples(
            &prepared.event_samples[event],
            &expected(&case["event_samples"][event]),
            event,
        );
    }

    // (E AND U) OR (NOT E AND L), using one BDD for every sample chunk.
    let mut bdd = Bdd::new();
    let u = bdd.alloc_node(BddNode::new(2, BDD_TRUE, BDD_FALSE));
    let l = bdd.alloc_node(BddNode::new(1, BDD_TRUE, BDD_FALSE));
    let top = bdd.alloc_node(BddNode::new(0, u, l));
    let zero = bdd.alloc_node(BddNode::new(3, BDD_TRUE, BDD_FALSE));
    let one = bdd.alloc_node(BddNode::new(4, BDD_TRUE, BDD_FALSE));
    bdd.set_var_probs(vec![0.2, 0.2, 0.2, 0.0, 1.0]);
    let names = ["E", "L", "U", "Z", "O"].map(|s| Some(s.to_string()));
    for (label, root) in [("TOP", top), ("ZERO", zero), ("ONE", one)] {
        let samples = prepared
            .quantify(
                &bdd,
                root,
                HclEventBindings::new(),
                HclBaseEvidence::unobserved(2),
                &names,
            )
            .unwrap();
        assert_samples(&samples, &expected(&case["outputs"][label]), label);
    }
    let complement = prepared
        .quantify(
            &bdd,
            top.complement(),
            HclEventBindings::new(),
            HclBaseEvidence::unobserved(2),
            &names,
        )
        .unwrap();
    let expected_complement = expected(&case["outputs"]["TOP"])
        .iter()
        .map(|p| 1.0 - p)
        .collect::<Vec<_>>();
    assert_samples(&complement, &expected_complement, "complement");
}

fn linked_bdd(graph: &BayesianGraph) -> (Bdd, BddRef, HclEventBindings, Vec<Option<String>>) {
    // (A AND E) OR (NOT A AND B AND L); A and B are BN-linked.
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
fn vectorized_bn_conditioning_matches_hcl_mh_under_evidence() {
    let fixture = reference();
    let case = &fixture["vector_case"];
    let settings = serde_json::from_value(case["settings"].clone()).unwrap();
    let graph = network();
    let prepared = PreparedHclUncertainty::new(&graph, &settings).unwrap();
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
        let actual = prepared
            .quantify(&bdd, root, bindings.clone(), evidence, &names)
            .unwrap();
        assert_samples(&actual, &expected(&scenario["samples"]), "BN evidence");
    }
}

#[test]
fn chunks_preserve_cpt_and_ft_sample_pairing() {
    let case = &reference()["vector_case"];
    let mut settings: HclUncertaintySettings =
        serde_json::from_value(case["settings"].clone()).unwrap();
    let graph = network();
    let ft_only = PreparedHclUncertainty::new(&graph, &settings).unwrap();
    settings.cpt_row_distributions = vec![
        HclCptRowUncertaintySpec {
            node: "A".into(),
            row_index: 0,
            prior: crate::hcl::HclCptPrior::Dirichlet {
                alpha: vec![16.0, 4.0],
            },
        },
        HclCptRowUncertaintySpec {
            node: "B".into(),
            row_index: 1,
            prior: crate::hcl::HclCptPrior::Dirichlet {
                alpha: vec![1.5, 13.5],
            },
        },
    ];
    let whole =
        PreparedHclUncertainty::with_chunk_size(&graph, &settings, settings.sample_count).unwrap();
    // The FT stream must not depend on the BN CPT uncertainty settings.
    assert_eq!(ft_only.event_samples, whole.event_samples);
    let (bdd, root, bindings, names) = linked_bdd(&graph);
    let evidence = HclBaseEvidence::unobserved(2);
    let expected = whole
        .quantify(&bdd, root, bindings.clone(), evidence.clone(), &names)
        .unwrap();
    for size in [1, 31, 256, 512] {
        let chunks = PreparedHclUncertainty::with_chunk_size(&graph, &settings, size).unwrap();
        assert_eq!(chunks.event_samples, whole.event_samples);
        assert!(chunks
            .chunks
            .iter()
            .all(|chunk| chunk.end - chunk.start <= size));
        let actual = chunks
            .quantify(&bdd, root, bindings.clone(), evidence.clone(), &names)
            .unwrap();
        assert_samples(&actual, &expected, "chunk sample pairing");
    }
}
