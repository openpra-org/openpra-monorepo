use std::cmp::Ordering;
use std::collections::HashMap;

use crate::algorithms::bdd_engine::BddRef;
use crate::hcl::{HclImportanceAnalysis, HclImportanceMeasure, HclQuantifier};
use crate::Result;

/// Computes conventional PRA importance by pinning each structural
/// fault-tree basic event directly in the already-compiled HCL BDD. Bayesian
/// probabilities for every other bound event continue to be evaluated under
/// the active evidence, so the calculation remains dependency-aware without
/// treating the pin as a new observation.
pub(crate) fn evaluate_importance(
    root: BddRef,
    event_by_variable: &[Option<String>],
    binding_node_by_event: &HashMap<String, String>,
    quantifier: &mut HclQuantifier<'_>,
    baseline_probability: f64,
) -> Result<HclImportanceAnalysis> {
    let mut measures = Vec::new();
    for (variable, event) in event_by_variable.iter().enumerate() {
        let Some(event) = event else {
            continue;
        };
        let event_probability = quantifier.event_probability(variable)?;
        let probability_if_true = quantifier.quantify_with_pinned_variable(root, variable, true)?;
        let probability_if_false =
            quantifier.quantify_with_pinned_variable(root, variable, false)?;
        let birnbaum = probability_if_true - probability_if_false;
        let criticality = ratio(birnbaum * event_probability, baseline_probability);
        let fussell_vesely = ratio(
            baseline_probability - probability_if_false,
            baseline_probability,
        );
        let risk_achievement_worth = ratio(probability_if_true, baseline_probability);
        let risk_reduction_worth = ratio(baseline_probability, probability_if_false);
        measures.push(HclImportanceMeasure {
            rank: 0,
            basic_event_id: event.clone(),
            bayesian_network_node_id: binding_node_by_event.get(event).cloned(),
            event_probability,
            probability_if_true,
            probability_if_false,
            birnbaum,
            criticality,
            fussell_vesely,
            risk_achievement_worth,
            risk_reduction_worth,
        });
    }

    measures.sort_by(|left, right| {
        compare_optional_desc(left.fussell_vesely, right.fussell_vesely)
            .then_with(|| compare_f64_desc(left.birnbaum, right.birnbaum))
            .then_with(|| left.basic_event_id.cmp(&right.basic_event_id))
    });
    for (index, measure) in measures.iter_mut().enumerate() {
        measure.rank = index + 1;
    }
    Ok(HclImportanceAnalysis {
        total_count: measures.len(),
        measures,
    })
}

fn ratio(numerator: f64, denominator: f64) -> Option<f64> {
    if denominator <= 0.0 {
        return None;
    }
    let value = numerator / denominator;
    value.is_finite().then_some(value)
}

fn compare_optional_desc(left: Option<f64>, right: Option<f64>) -> Ordering {
    match (left, right) {
        (Some(left), Some(right)) => compare_f64_desc(left, right),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

fn compare_f64_desc(left: f64, right: f64) -> Ordering {
    right.partial_cmp(&left).unwrap_or(Ordering::Equal)
}

#[cfg(test)]
mod tests {
    use super::ratio;

    #[test]
    fn leaves_undefined_ratios_explicit() {
        assert_eq!(ratio(1.0, 0.0), None);
        assert_eq!(ratio(0.5, 0.25), Some(2.0));
    }
}
