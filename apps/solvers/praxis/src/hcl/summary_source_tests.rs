use super::HclUncertaintySummary;
use serde_json::Value;

fn from_bits(value: &Value) -> f64 {
    f64::from_bits(u64::from_str_radix(value.as_str().unwrap(), 16).unwrap())
}

#[test]
fn summaries_match_unchanged_hcl_mh_functions() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../tests/fixtures/hcl_mh_summaries/reference.json"
    ))
    .unwrap();
    for case in fixture["cases"].as_array().unwrap() {
        let samples: Vec<f64> = case["sample_bits"]
            .as_array()
            .unwrap()
            .iter()
            .map(from_bits)
            .collect();
        let original = samples.clone();
        let summary = HclUncertaintySummary::from_samples(&samples, 42).unwrap();
        assert_eq!(samples, original, "summary must preserve sample pairing");
        assert_eq!(summary.sample_count, samples.len());
        assert_eq!(summary.seed, 42);
        for (field, actual) in [
            ("mean", summary.mean),
            ("standardDeviation", summary.standard_deviation),
            ("minimum", summary.minimum),
            ("percentile05", summary.percentile_05),
            ("median", summary.median),
            ("percentile95", summary.percentile_95),
            ("maximum", summary.maximum),
        ] {
            let expected = from_bits(&case["expected_bits"][field]);
            assert_eq!(
                actual.to_bits(),
                expected.to_bits(),
                "{} {field}: Rust {actual:.17e}, source {expected:.17e}",
                case["name"],
            );
        }
    }
}

#[test]
fn summary_boundary_rejects_invalid_populations() {
    for values in [vec![], vec![-0.1], vec![f64::NAN], vec![f64::INFINITY]] {
        assert!(HclUncertaintySummary::from_samples(&values, 42).is_err());
    }
}

#[test]
fn serialized_summaries_omit_and_reject_removed_cv() {
    let summary = HclUncertaintySummary::from_samples(&[0.1, 0.2, 0.3], 42).unwrap();
    let mut value = serde_json::to_value(&summary).unwrap();
    assert!(value.get("coefficientOfVariation").is_none());
    value["coefficientOfVariation"] = Value::from(0.5);
    assert!(serde_json::from_value::<HclUncertaintySummary>(value).is_err());
}
