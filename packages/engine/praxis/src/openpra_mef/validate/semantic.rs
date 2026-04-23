use crate::openpra_mef::contracts::{Diagnostic, Severity};
use crate::openpra_mef::json_model::OpenPraJsonModel;
use std::collections::HashSet;

pub fn validate_semantic(model: &OpenPraJsonModel) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();

    if let Some(da) = &model.technical_elements.data_analysis {
        push_duplicate_id_diagnostics(
            &mut diagnostics,
            da.data_parameters.iter().map(|x| x.id.as_str()),
            "$.technicalElements.data-analysis.dataParameters",
        );

        for (idx, parameter) in da.data_parameters.iter().enumerate() {
            if let Some(probability) = parameter.probability {
                if !(0.0..=1.0).contains(&probability) {
                    diagnostics.push(Diagnostic::new(
                        "SEM_INVALID_PROBABILITY_RANGE",
                        Severity::Error,
                        "Probability outside [0,1]",
                        format!(
                            "$.technicalElements.data-analysis.dataParameters[{idx}].probability"
                        ),
                    ));
                }
            }
            if let Some(frequency) = parameter.frequency {
                if frequency < 0.0 {
                    diagnostics.push(Diagnostic::new(
                        "SEM_NEGATIVE_FREQUENCY",
                        Severity::Error,
                        "Frequency cannot be negative",
                        format!(
                            "$.technicalElements.data-analysis.dataParameters[{idx}].frequency"
                        ),
                    ));
                }
            }
        }
    }

    if let Some(iea) = &model.technical_elements.initiating_event_analysis {
        push_duplicate_id_diagnostics(
            &mut diagnostics,
            iea.initiators.iter().map(|x| x.id.as_str()),
            "$.technicalElements.initiating-event-analysis.initiators",
        );

        for (idx, initiator) in iea.initiators.iter().enumerate() {
            if let Some(probability) = initiator.probability {
                if !(0.0..=1.0).contains(&probability) {
                    diagnostics.push(Diagnostic::new(
                        "SEM_INVALID_PROBABILITY_RANGE",
                        Severity::Error,
                        "Probability outside [0,1]",
                        format!(
                            "$.technicalElements.initiating-event-analysis.initiators[{idx}].probability"
                        ),
                    ));
                }
            }
            if let Some(frequency) = initiator.frequency {
                if frequency < 0.0 {
                    diagnostics.push(Diagnostic::new(
                        "SEM_NEGATIVE_FREQUENCY",
                        Severity::Error,
                        "Frequency cannot be negative",
                        format!(
                            "$.technicalElements.initiating-event-analysis.initiators[{idx}].frequency"
                        ),
                    ));
                }
            }
            if initiator.frequency.is_none()
                && initiator.probability.is_none()
                && initiator.data_parameter_refs.is_empty()
            {
                diagnostics.push(Diagnostic::new(
                    "RUN_MISSING_IE_FREQUENCY_SOURCE",
                    Severity::Error,
                    "IE frequency/probability source missing for run",
                    format!(
                        "$.technicalElements.initiating-event-analysis.initiators[{idx}]"
                    ),
                ));
            }
        }
    } else {
        diagnostics.push(Diagnostic::new(
            "RUN_MISSING_IE_FREQUENCY_SOURCE",
            Severity::Error,
            "Missing initiating-event-analysis technical element",
            "$.technicalElements.initiating-event-analysis",
        ));
    }

    if let Some(esa) = &model.technical_elements.event_sequence_analysis {
        push_duplicate_id_diagnostics(
            &mut diagnostics,
            esa.event_sequences.iter().map(|x| x.id.as_str()),
            "$.technicalElements.event-sequence-analysis.eventSequences",
        );

        for (seq_idx, sequence) in esa.event_sequences.iter().enumerate() {
            for (bind_idx, binding) in sequence.functional_event_bindings.iter().enumerate() {
                let has_binding = binding.fault_tree_id.is_some()
                    || binding.data_parameter_id.is_some()
                    || binding.success_probability.is_some();
                if !has_binding {
                    diagnostics.push(Diagnostic::new(
                        "RUN_MISSING_FUNCTIONAL_EVENT_BINDING",
                        Severity::Error,
                        "Functional event lacks required fault-tree/probability binding",
                        format!(
                            "$.technicalElements.event-sequence-analysis.eventSequences[{seq_idx}].functionalEventBindings[{bind_idx}]"
                        ),
                    ));
                }
                if let Some(probability) = binding.success_probability {
                    if !(0.0..=1.0).contains(&probability) {
                        diagnostics.push(Diagnostic::new(
                            "SEM_INVALID_PROBABILITY_RANGE",
                            Severity::Error,
                            "Probability outside [0,1]",
                            format!(
                                "$.technicalElements.event-sequence-analysis.eventSequences[{seq_idx}].functionalEventBindings[{bind_idx}].successProbability"
                            ),
                        ));
                    }
                }
            }
        }
    } else {
        diagnostics.push(Diagnostic::new(
            "RUN_MISSING_FUNCTIONAL_EVENT_BINDING",
            Severity::Error,
            "Missing event-sequence-analysis technical element",
            "$.technicalElements.event-sequence-analysis",
        ));
    }

    if let Some(esq) = &model.technical_elements.event_sequence_quantification {
        push_duplicate_id_diagnostics(
            &mut diagnostics,
            esq.quantification_results.iter().map(|x| x.id.as_str()),
            "$.technicalElements.event-sequence-quantification.quantificationResults",
        );

        for (idx, result) in esq.quantification_results.iter().enumerate() {
            if let Some(probability) = result.probability {
                if !(0.0..=1.0).contains(&probability) {
                    diagnostics.push(Diagnostic::new(
                        "SEM_INVALID_PROBABILITY_RANGE",
                        Severity::Error,
                        "Probability outside [0,1]",
                        format!(
                            "$.technicalElements.event-sequence-quantification.quantificationResults[{idx}].probability"
                        ),
                    ));
                }
            }
            if let Some(frequency) = result.frequency {
                if frequency < 0.0 {
                    diagnostics.push(Diagnostic::new(
                        "SEM_NEGATIVE_FREQUENCY",
                        Severity::Error,
                        "Frequency cannot be negative",
                        format!(
                            "$.technicalElements.event-sequence-quantification.quantificationResults[{idx}].frequency"
                        ),
                    ));
                }
            }
        }
    }

    diagnostics
}

fn push_duplicate_id_diagnostics<'a>(
    diagnostics: &mut Vec<Diagnostic>,
    ids: impl Iterator<Item = &'a str>,
    json_path: &str,
) {
    let mut seen = HashSet::new();
    let mut duplicates = HashSet::new();
    for id in ids {
        if !seen.insert(id.to_string()) {
            duplicates.insert(id.to_string());
        }
    }

    for duplicate in duplicates {
        diagnostics.push(Diagnostic::new(
            "REF_DUPLICATE_ID",
            Severity::Error,
            format!("Duplicate ID found: '{duplicate}'"),
            json_path.to_string(),
        ));
    }
}
