use super::{
    conditional_evidence_probabilities_for_network, CanonicalBayesianNetwork, HclEvidenceSpec,
};
use crate::quantitative::{prepare_hazard_weights, AnnualizationConvention, FrequencyUnit};
use serde_json::{json, Value};
use tensorbayes::{CompileHeuristic, CompiledJunctionTree};

fn fixture() -> Value {
    serde_json::from_str(include_str!(
        "../../tests/fixtures/hcl_mh_hazard/reference.json"
    ))
    .unwrap()
}

fn evidence(value: &Value) -> Vec<HclEvidenceSpec> {
    value
        .as_object()
        .unwrap()
        .iter()
        .map(|(node, state)| HclEvidenceSpec {
            node: node.clone(),
            state: state.as_str().unwrap().into(),
        })
        .collect()
}

#[test]
fn point_weights_match_source_for_dependence_evidence_and_zero_mass() {
    for case in fixture()["cases"].as_array().unwrap() {
        let network = serde_json::from_value::<CanonicalBayesianNetwork>(
            json!({"variables":case["variables"]}),
        )
        .unwrap()
        .into_graph()
        .unwrap();
        let tree =
            CompiledJunctionTree::compile(network.clone(), CompileHeuristic::MinFill).unwrap();
        let rows: Vec<_> = case["scenarios"]
            .as_array()
            .unwrap()
            .iter()
            .map(|r| evidence(&r["evidence"]))
            .collect();
        let weights = conditional_evidence_probabilities_for_network(
            &network,
            &evidence(&case["base"]),
            &tree,
            &rows,
        )
        .unwrap();
        for (actual, expected) in weights.iter().zip(case["weights"].as_array().unwrap()) {
            let expected = expected["hazard_weight_raw"].as_f64().unwrap();
            assert!(
                (actual - expected).abs() <= 5e-16 + 3e-14 * expected.abs(),
                "{}: {actual} != {expected}",
                case["name"]
            );
        }
    }
}

#[test]
fn normalization_matches_source_python_sum_and_all_zero_rules() {
    let fixture = fixture();
    let raw: Vec<f64> = serde_json::from_value(fixture["normalization"]["raw"].clone()).unwrap();
    let actual = prepare_hazard_weights(
        &raw,
        2.0,
        FrequencyUnit::PerYear,
        AnnualizationConvention::default(),
        true,
    )
    .unwrap();
    let expected = &fixture["normalization"]["expected"];
    assert!((actual.raw_weight_sum - expected["raw_weight_sum"].as_f64().unwrap()).abs() < 1e-15);
    for (actual, expected) in actual
        .weights
        .iter()
        .zip(expected["rows"].as_array().unwrap())
    {
        assert!(
            (actual.normalized_weight - expected["hazard_weight_normalized"].as_f64().unwrap())
                .abs()
                < 1e-15
        );
    }
    for normalize in [false, true] {
        let zero = prepare_hazard_weights(
            &[0.0, 0.0],
            2.0,
            FrequencyUnit::PerYear,
            AnnualizationConvention::default(),
            normalize,
        )
        .unwrap();
        assert_eq!(zero.raw_weight_sum, 0.0);
        assert_eq!(zero.convolution_weight_sum, 0.0);
        assert!(zero
            .weights
            .iter()
            .all(|w| w.annual_frequency == 0.0 && w.normalized_weight == 0.0));
    }
}
