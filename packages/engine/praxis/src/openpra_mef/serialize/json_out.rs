use crate::openpra_mef::contracts::{
    Diagnostic, EngineOutputs, OpenPraJsonBundle, ResolveMode, Severity,
};
use crate::openpra_mef::json_model::data_analysis::{
    ConsistencyCheck, DataAnalysisJsonModel, DataParameter, ExternalDataSource, IdGroup, IdRef,
};
use crate::openpra_mef::resolve::placeholders::PlaceholderRecord;
use crate::{PraxisError, Result};
use serde_json::json;

pub fn to_json(
    outputs: &EngineOutputs,
    bundle: &OpenPraJsonBundle,
    mode: ResolveMode,
) -> Result<String> {
    let model_id = outputs.model_id.clone().or_else(|| bundle.model_id.clone());
    let mut diagnostics = collect_output_diagnostics(outputs, bundle, mode, &model_id);
    let merged_placeholders = merged_placeholders(outputs, bundle);
    let mut technical_elements = serde_json::Map::new();

    if let Some(data_analysis) = data_analysis_json(bundle) {
        technical_elements.insert("data-analysis".to_string(), data_analysis);
    }

    let quantification_results = normalize_quantification_results(&outputs.result_payload);
    let risk_significant_sequences = derive_risk_significant_sequences(&quantification_results);
    let (cut_sets, cut_set_grouping) = derive_cut_set_payloads(&quantification_results);
    let uncertainty = derive_uncertainty_summary(&quantification_results);
    let convergence = derive_convergence_summary(&quantification_results, outputs);
    if outputs.result_payload.is_none() {
        diagnostics.push(
            Diagnostic::new(
                "OUT_MISSING_REQUIRED_RESULT_FIELD",
                Severity::Error,
                "Required output field 'quantificationResults' is missing",
                "$.technicalElements.event-sequence-quantification.quantificationResults",
            )
            .with_hint("Populate event sequence quantification results before serialization"),
        );
    }

    technical_elements.insert(
        "event-sequence-quantification".to_string(),
        json!({
            "quantificationResults": quantification_results,
            "riskSignificantSequences": risk_significant_sequences,
            "cutSets": cut_sets,
            "cutSetGrouping": cut_set_grouping,
            "uncertainty": uncertainty,
            "convergence": convergence,
        }),
    );
    technical_elements.insert(
        "risk-integration".to_string(),
        json!({
            "placeholderUsed": !merged_placeholders.is_empty(),
            "placeholderReason": if !merged_placeholders.is_empty() {
                Some("Risk Integration execution remains placeholder where Praxis capabilities are not yet available")
            } else {
                None
            }
        }),
    );

    let value = json!({
        "id": model_id,
        "mode": match mode {
            ResolveMode::Strict => "strict",
            ResolveMode::Compatible => "compatible",
        },
        "outputMetadata": output_metadata_json(outputs),
        "technicalElements": serde_json::Value::Object(technical_elements),
        "diagnostics": diagnostics_to_json(&diagnostics),
        "placeholderProvenance": merged_placeholders,
    });

    serde_json::to_string_pretty(&value).map_err(|err| {
        PraxisError::Serialization(format!(
            "Failed to serialize OpenPRA JSON output envelope: {err}"
        ))
    })
}

fn output_metadata_json(outputs: &EngineOutputs) -> serde_json::Value {
    json!({
        "schemaVersion": outputs
            .schema_version
            .as_deref()
            .unwrap_or("openpra-mef-output-v1"),
        "engineVersion": outputs
            .engine_version
            .clone()
            .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string()),
        "schemaCompatibilityPolicy": schema_compatibility_policy_json(),
        "optionalSectionsPolicy": optional_sections_policy_json(),
        "webAppMinimumOutput": webapp_minimum_output_json(),
        "runMetadata": outputs
            .run_metadata
            .clone()
            .unwrap_or_else(|| json!({
                "backend": "unknown",
                "params": null,
                "seed": null,
                "timingMs": null,
                "convergence": null,
            })),
    })
}

fn schema_compatibility_policy_json() -> serde_json::Value {
    json!({
        "current": "openpra-mef-output-v1",
        "backwardCompatibleFrom": ["openpra-mef-output-v1"],
        "forwardCompatibility": {
            "unknownFields": "preserve-or-ignore",
            "unknownDiagnostics": "non-breaking",
        },
        "breakingChangePolicy": "major-schema-version-bump-required",
    })
}

fn optional_sections_policy_json() -> serde_json::Value {
    json!({
        "missingDataAnalysis": "section-omitted",
        "missingRiskIntegration": "placeholder-emitted",
        "missingQuantificationResults": "emit-empty-array-and-diagnostic",
        "missingPlaceholderProvenance": "emit-warning-diagnostic",
        "modeDependentBehavior": {
            "compatible": "allow-placeholders-with-warnings",
            "strict": "required-unresolved-references-are-errors",
        }
    })
}

fn webapp_minimum_output_json() -> serde_json::Value {
    json!({
        "version": "v1",
        "requiredFields": [
            "id",
            "outputMetadata.schemaVersion",
            "outputMetadata.engineVersion",
            "technicalElements.event-sequence-quantification.quantificationResults",
            "technicalElements.event-sequence-quantification.riskSignificantSequences",
            "technicalElements.event-sequence-quantification.cutSets",
            "technicalElements.risk-integration.placeholderUsed",
            "diagnostics",
            "placeholderProvenance"
        ]
    })
}

fn collect_output_diagnostics(
    outputs: &EngineOutputs,
    bundle: &OpenPraJsonBundle,
    mode: ResolveMode,
    model_id: &Option<String>,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    diagnostics.extend(bundle.diagnostics.iter().cloned());
    diagnostics.extend(outputs.diagnostics.iter().cloned());

    if model_id.as_deref().unwrap_or_default().trim().is_empty() {
        diagnostics.push(
            Diagnostic::new(
                "OUT_MISSING_REQUIRED_RESULT_FIELD",
                Severity::Error,
                "Required output field 'id' is missing",
                "$.id",
            )
            .with_hint("Provide model id either in engine outputs or source bundle"),
        );
    }

    let placeholders = merged_placeholders(outputs, bundle);
    if placeholders.is_empty() {
        diagnostics.push(
            Diagnostic::new(
                "OUT_PLACEHOLDER_PROVENANCE_MISSING",
                Severity::Warning,
                "No placeholder provenance records were emitted",
                "$.placeholderProvenance",
            )
            .with_hint("Include placeholder provenance when placeholders are used"),
        );
    }

    for (index, placeholder) in placeholders.iter().enumerate() {
        if placeholder.source_element.trim().is_empty()
            || placeholder.source_id.trim().is_empty()
            || placeholder.target_type.trim().is_empty()
            || placeholder.target_id.trim().is_empty()
            || placeholder.reason.trim().is_empty()
        {
            diagnostics.push(
                Diagnostic::new(
                    "PH_REQUIRED_FIELDS_MISSING",
                    Severity::Error,
                    "Placeholder record missing required provenance fields",
                    format!("$.placeholderProvenance[{index}]"),
                )
                .with_hint("Provide sourceElement/sourceId/targetType/targetId/reason"),
            );
            diagnostics.push(
                Diagnostic::new(
                    "OUT_PLACEHOLDER_PROVENANCE_MISSING",
                    Severity::Warning,
                    "Placeholder emitted without complete provenance metadata",
                    format!("$.placeholderProvenance[{index}]"),
                )
                .with_hint("Complete all required placeholder provenance fields"),
            );
        }
    }

    if matches!(mode, ResolveMode::Strict) && !placeholders.is_empty() {
        diagnostics.push(
            Diagnostic::new(
                "PH_COMPAT_MODE_ONLY",
                Severity::Warning,
                "Placeholder usage is intended for compatible mode",
                "$.placeholderProvenance",
            )
            .with_hint("Prefer strict mode runs without placeholders for release/CI"),
        );
    }

    diagnostics
}

fn normalize_quantification_results(result_payload: &Option<serde_json::Value>) -> serde_json::Value {
    match result_payload {
        Some(serde_json::Value::Array(items)) => serde_json::Value::Array(items.clone()),
        Some(value) => serde_json::Value::Array(vec![value.clone()]),
        None => serde_json::Value::Array(Vec::new()),
    }
}

fn derive_risk_significant_sequences(
    quantification_results: &serde_json::Value,
) -> serde_json::Value {
    let Some(results) = quantification_results.as_array() else {
        return serde_json::Value::Array(Vec::new());
    };

    let mut ranked: Vec<(f64, String, serde_json::Value)> = Vec::new();
    for row in results {
        let Some(row_obj) = row.as_object() else {
            continue;
        };

        let frequency = row_obj.get("frequency").and_then(serde_json::Value::as_f64);
        let probability = row_obj
            .get("probability")
            .and_then(serde_json::Value::as_f64);
        let score = frequency.or(probability).unwrap_or(0.0);

        let event_sequence_id = row_obj
            .get("eventSequenceId")
            .and_then(serde_json::Value::as_str)
            .or_else(|| row_obj.get("id").and_then(serde_json::Value::as_str))
            .unwrap_or_default()
            .to_string();

        ranked.push((
            score,
            event_sequence_id.clone(),
            json!({
                "eventSequenceId": event_sequence_id,
                "id": row_obj.get("id").cloned(),
                "probability": probability,
                "frequency": frequency,
            }),
        ));
    }

    ranked.sort_by(|a, b| {
        b.0.total_cmp(&a.0)
            .then_with(|| a.1.cmp(&b.1))
    });

    serde_json::Value::Array(ranked.into_iter().map(|(_, _, row)| row).collect())
}

fn derive_cut_set_payloads(
    quantification_results: &serde_json::Value,
) -> (serde_json::Value, serde_json::Value) {
    let Some(results) = quantification_results.as_array() else {
        return (serde_json::Value::Array(Vec::new()), serde_json::Value::Null);
    };

    let mut cut_sets = Vec::new();
    let mut cut_set_grouping = Vec::new();

    for row in results {
        let Some(row_obj) = row.as_object() else {
            continue;
        };

        let sequence_id = row_obj
            .get("eventSequenceId")
            .and_then(serde_json::Value::as_str)
            .or_else(|| row_obj.get("id").and_then(serde_json::Value::as_str))
            .unwrap_or_default();

        if let Some(sets) = row_obj.get("cutSets").and_then(serde_json::Value::as_array) {
            for cut_set in sets {
                let item = match cut_set {
                    serde_json::Value::Object(obj) => {
                        let mut out = obj.clone();
                        out.entry("eventSequenceId".to_string())
                            .or_insert_with(|| json!(sequence_id));
                        serde_json::Value::Object(out)
                    }
                    _ => json!({
                        "eventSequenceId": sequence_id,
                        "definition": cut_set,
                    }),
                };
                cut_sets.push(item);
            }
        }

        if let Some(grouping) = row_obj.get("cutSetGrouping") {
            cut_set_grouping.push(json!({
                "eventSequenceId": sequence_id,
                "grouping": grouping,
            }));
        }
    }

    let grouping_value = if cut_set_grouping.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::Value::Array(cut_set_grouping)
    };

    (serde_json::Value::Array(cut_sets), grouping_value)
}

fn derive_uncertainty_summary(quantification_results: &serde_json::Value) -> serde_json::Value {
    let Some(results) = quantification_results.as_array() else {
        return json!({
            "method": "binomial-wald",
            "confidenceLevel": 0.95,
            "perSequence": [],
            "summary": {"maxRelativeHalfWidth95": null, "averageRelativeHalfWidth95": null},
        });
    };

    let mut per_sequence = Vec::new();
    let mut rel_half_widths = Vec::new();

    for row in results {
        let Some(row_obj) = row.as_object() else {
            continue;
        };

        let sequence_id = row_obj
            .get("eventSequenceId")
            .and_then(serde_json::Value::as_str)
            .or_else(|| row_obj.get("id").and_then(serde_json::Value::as_str))
            .unwrap_or_default();

        if let Some(u) = row_obj.get("uncertainty") {
            let rel = u
                .get("relativeHalfWidth95")
                .and_then(serde_json::Value::as_f64);
            if let Some(value) = rel {
                rel_half_widths.push(value);
            }
            per_sequence.push(json!({
                "eventSequenceId": sequence_id,
                "uncertainty": u,
            }));
        }
    }

    let max_rel = rel_half_widths
        .iter()
        .copied()
        .max_by(f64::total_cmp);
    let avg_rel = if rel_half_widths.is_empty() {
        None
    } else {
        Some(rel_half_widths.iter().sum::<f64>() / rel_half_widths.len() as f64)
    };

    json!({
        "method": "binomial-wald",
        "confidenceLevel": 0.95,
        "perSequence": per_sequence,
        "summary": {
            "maxRelativeHalfWidth95": max_rel,
            "averageRelativeHalfWidth95": avg_rel,
        }
    })
}

fn derive_convergence_summary(
    quantification_results: &serde_json::Value,
    outputs: &EngineOutputs,
) -> serde_json::Value {
    let run_convergence = outputs
        .run_metadata
        .as_ref()
        .and_then(|m| m.get("convergence"))
        .cloned()
        .unwrap_or_else(|| {
            json!({
                "enabled": false,
                "criterion": "wald-linear-log10",
                "met": null,
                "trialsEvaluated": null,
            })
        });

    let per_sequence = quantification_results
        .as_array()
        .map(|rows| {
            rows.iter()
                .filter_map(|row| {
                    let row_obj = row.as_object()?;
                    let sequence_id = row_obj
                        .get("eventSequenceId")
                        .and_then(serde_json::Value::as_str)
                        .or_else(|| row_obj.get("id").and_then(serde_json::Value::as_str))
                        .unwrap_or_default();
                    let convergence = row_obj.get("convergence")?;
                    Some(json!({
                        "eventSequenceId": sequence_id,
                        "convergence": convergence,
                    }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    json!({
        "run": run_convergence,
        "perSequence": per_sequence,
    })
}

fn merged_placeholders(
    outputs: &EngineOutputs,
    bundle: &OpenPraJsonBundle,
) -> Vec<PlaceholderRecord> {
    let mut placeholders = bundle.placeholders.clone();
    placeholders.extend(outputs.placeholders.clone());
    placeholders
}

fn data_analysis_json(bundle: &OpenPraJsonBundle) -> Option<serde_json::Value> {
    let da = bundle
        .model
        .as_ref()?
        .technical_elements
        .data_analysis
        .as_ref()?;

    Some(serde_json::Value::Object(data_analysis_object(da)))
}

fn data_analysis_object(da: &DataAnalysisJsonModel) -> serde_json::Map<String, serde_json::Value> {
    let mut object = serde_json::Map::new();

    if let Some(id) = &da.id {
        object.insert("id".to_string(), json!(id));
    }

    object.insert(
        "dataParameters".to_string(),
        serde_json::Value::Array(
            da.data_parameters
                .iter()
                .map(data_parameter_json)
                .collect(),
        ),
    );

    if !da.component_groupings.is_empty() {
        object.insert(
            "componentGroupings".to_string(),
            serde_json::Value::Array(
                da.component_groupings
                    .iter()
                    .map(id_group_json)
                    .collect(),
            ),
        );
    }

    if !da.outlier_components.is_empty() {
        object.insert(
            "outlierComponents".to_string(),
            serde_json::Value::Array(
                da.outlier_components
                    .iter()
                    .map(id_ref_json)
                    .collect(),
            ),
        );
    }

    if !da.external_data_sources.is_empty() {
        object.insert(
            "externalDataSources".to_string(),
            serde_json::Value::Array(
                da.external_data_sources
                    .iter()
                    .map(external_data_source_json)
                    .collect(),
            ),
        );
    }

    if !da.data_consistency_checks.is_empty() {
        object.insert(
            "dataConsistencyChecks".to_string(),
            serde_json::Value::Array(
                da.data_consistency_checks
                    .iter()
                    .map(consistency_check_json)
                    .collect(),
            ),
        );
    }

    if let Some(documentation) = &da.documentation {
        object.insert("documentation".to_string(), documentation.clone());
    }

    if !da.sensitivity_studies.is_empty() {
        object.insert(
            "sensitivityStudies".to_string(),
            serde_json::Value::Array(da.sensitivity_studies.clone()),
        );
    }

    merge_additional_fields(&mut object, &da.additional_fields);
    object
}

fn data_parameter_json(parameter: &DataParameter) -> serde_json::Value {
    let mut object = serde_json::Map::new();
    object.insert("id".to_string(), json!(parameter.id));

    if let Some(probability) = parameter.probability {
        object.insert("probability".to_string(), json!(probability));
    }
    if let Some(frequency) = parameter.frequency {
        object.insert("frequency".to_string(), json!(frequency));
    }
    if let Some(distribution) = &parameter.distribution {
        object.insert("distribution".to_string(), distribution.clone());
    }
    if let Some(system_ref) = &parameter.system_ref {
        object.insert("systemRef".to_string(), json!(system_ref));
    }
    if let Some(component_ref) = &parameter.component_ref {
        object.insert("componentRef".to_string(), json!(component_ref));
    }
    if !parameter.metadata_refs.is_empty() {
        object.insert(
            "metadataRefs".to_string(),
            serde_json::Value::Array(parameter.metadata_refs.iter().map(id_ref_json).collect()),
        );
    }

    merge_additional_fields(&mut object, &parameter.additional_fields);
    serde_json::Value::Object(object)
}

fn id_ref_json(id_ref: &IdRef) -> serde_json::Value {
    let mut object = serde_json::Map::new();
    object.insert("id".to_string(), json!(id_ref.id));
    if let Some(ref_type) = &id_ref.ref_type {
        object.insert("refType".to_string(), json!(ref_type));
    }
    serde_json::Value::Object(object)
}

fn id_group_json(id_group: &IdGroup) -> serde_json::Value {
    json!({
        "id": id_group.id,
        "members": id_group.members,
    })
}

fn external_data_source_json(source: &ExternalDataSource) -> serde_json::Value {
    let mut object = serde_json::Map::new();
    object.insert("id".to_string(), json!(source.id));
    if let Some(source_type) = &source.source_type {
        object.insert("sourceType".to_string(), json!(source_type));
    }
    if let Some(uri) = &source.uri {
        object.insert("uri".to_string(), json!(uri));
    }
    merge_additional_fields(&mut object, &source.additional_fields);
    serde_json::Value::Object(object)
}

fn consistency_check_json(check: &ConsistencyCheck) -> serde_json::Value {
    let mut object = serde_json::Map::new();
    object.insert("id".to_string(), json!(check.id));
    if let Some(check_type) = &check.check_type {
        object.insert("checkType".to_string(), json!(check_type));
    }
    if let Some(status) = &check.status {
        object.insert("status".to_string(), json!(status));
    }
    if let Some(details) = &check.details {
        object.insert("details".to_string(), json!(details));
    }
    merge_additional_fields(&mut object, &check.additional_fields);
    serde_json::Value::Object(object)
}

fn merge_additional_fields(
    object: &mut serde_json::Map<String, serde_json::Value>,
    additional_fields: &std::collections::HashMap<String, serde_json::Value>,
) {
    let mut keys: Vec<&String> = additional_fields.keys().collect();
    keys.sort();

    for key in keys {
        if !object.contains_key(key) {
            if let Some(value) = additional_fields.get(key) {
                object.insert(key.clone(), value.clone());
            }
        }
    }
}

fn diagnostics_to_json(diagnostics: &[crate::openpra_mef::contracts::Diagnostic]) -> serde_json::Value {
    serde_json::Value::Array(
        diagnostics
            .iter()
            .map(|diag| {
                json!({
                    "code": diag.code,
                    "severity": match diag.severity {
                        crate::openpra_mef::contracts::Severity::Error => "error",
                        crate::openpra_mef::contracts::Severity::Warning => "warning",
                        crate::openpra_mef::contracts::Severity::Info => "info",
                    },
                    "message": diag.message,
                    "jsonPath": diag.json_path,
                    "sourceElement": diag.source_element,
                    "sourceId": diag.source_id,
                    "targetType": diag.target_type,
                    "targetId": diag.target_id,
                    "hint": diag.hint,
                })
            })
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::openpra_mef::json_model::data_analysis::{DataAnalysisJsonModel, DataParameter, IdRef};
    use crate::openpra_mef::json_model::{OpenPraJsonModel, TechnicalElements};
    use std::collections::HashMap;

    fn valid_bundle() -> OpenPraJsonBundle {
        OpenPraJsonBundle {
            model_id: Some("MODEL-OUT-1".to_string()),
            placeholders: vec![PlaceholderRecord {
                source_element: "risk-integration".to_string(),
                source_id: "RI-1".to_string(),
                target_type: "ri-solver".to_string(),
                target_id: "praxis-ri-engine".to_string(),
                reason: "Unsupported RI solver".to_string(),
            }],
            ..OpenPraJsonBundle::default()
        }
    }

    fn bundle_with_data_analysis() -> OpenPraJsonBundle {
        let mut parameter_additional = HashMap::new();
        parameter_additional.insert("units".to_string(), json!("per-demand"));

        let model = OpenPraJsonModel {
            id: Some("MODEL-DA-1".to_string()),
            technical_elements: TechnicalElements {
                data_analysis: Some(DataAnalysisJsonModel {
                    id: Some("DA-1".to_string()),
                    data_parameters: vec![DataParameter {
                        id: "DP-1".to_string(),
                        probability: Some(0.0025),
                        frequency: Some(1.2e-5),
                        distribution: Some(json!({"type": "lognormal"})),
                        system_ref: Some("SYS-1".to_string()),
                        component_ref: Some("PUMP-1".to_string()),
                        metadata_refs: vec![IdRef {
                            id: "META-1".to_string(),
                            ref_type: Some("tag".to_string()),
                        }],
                        additional_fields: parameter_additional,
                    }],
                    documentation: Some(json!({"source": "fixture"})),
                    sensitivity_studies: vec![json!({"id": "SS-1"})],
                    ..DataAnalysisJsonModel::default()
                }),
                ..TechnicalElements::default()
            },
            ..OpenPraJsonModel::default()
        };

        OpenPraJsonBundle {
            model_id: Some("MODEL-DA-1".to_string()),
            model: Some(model),
            ..valid_bundle()
        }
    }

    #[test]
    fn output_contract_contains_required_sections() {
        let bundle = valid_bundle();
        let outputs = EngineOutputs {
            model_id: Some("MODEL-OUT-1".to_string()),
            result_payload: Some(json!([
                {"id": "QR-1", "frequency": 1.0e-6},
                {"id": "QR-2", "frequency": 2.0e-6}
            ])),
            ..EngineOutputs::default()
        };

        let rendered = to_json(&outputs, &bundle, ResolveMode::Compatible).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();

        assert_eq!(parsed["id"], "MODEL-OUT-1");
        assert_eq!(parsed["outputMetadata"]["schemaVersion"], "openpra-mef-output-v1");
        assert!(parsed["outputMetadata"]["engineVersion"].is_string());
        assert_eq!(
            parsed["outputMetadata"]["schemaCompatibilityPolicy"]["current"],
            "openpra-mef-output-v1"
        );
        assert_eq!(
            parsed["outputMetadata"]["optionalSectionsPolicy"]["missingDataAnalysis"],
            "section-omitted"
        );
        assert_eq!(parsed["outputMetadata"]["runMetadata"]["backend"], "unknown");
        assert!(parsed["technicalElements"]["event-sequence-quantification"]["quantificationResults"].is_array());
        assert!(parsed["diagnostics"].is_array());
        assert!(parsed["placeholderProvenance"].is_array());
    }

    #[test]
    fn missing_placeholder_fields_emit_ph_and_out_diagnostics() {
        let bundle = OpenPraJsonBundle {
            model_id: Some("MODEL-OUT-2".to_string()),
            placeholders: vec![PlaceholderRecord {
                source_element: "".to_string(),
                source_id: "RI-2".to_string(),
                target_type: "ri-solver".to_string(),
                target_id: "praxis-ri-engine".to_string(),
                reason: "".to_string(),
            }],
            ..OpenPraJsonBundle::default()
        };
        let outputs = EngineOutputs {
            model_id: Some("MODEL-OUT-2".to_string()),
            result_payload: Some(json!({"id": "QR-1", "frequency": 1.0e-6})),
            ..EngineOutputs::default()
        };

        let rendered = to_json(&outputs, &bundle, ResolveMode::Compatible).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();
        let diagnostics = parsed["diagnostics"].as_array().unwrap();

        assert!(diagnostics.iter().any(|d| d["code"] == "PH_REQUIRED_FIELDS_MISSING"));
        assert!(diagnostics.iter().any(|d| d["code"] == "OUT_PLACEHOLDER_PROVENANCE_MISSING"));
    }

    #[test]
    fn strict_mode_with_placeholders_emits_compat_warning() {
        let bundle = valid_bundle();
        let outputs = EngineOutputs {
            model_id: Some("MODEL-OUT-3".to_string()),
            result_payload: Some(json!({"id": "QR-STRICT", "frequency": 3.0e-6})),
            ..EngineOutputs::default()
        };

        let rendered = to_json(&outputs, &bundle, ResolveMode::Strict).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();
        let diagnostics = parsed["diagnostics"].as_array().unwrap();

        assert!(diagnostics.iter().any(|d| d["code"] == "PH_COMPAT_MODE_ONLY"));
    }

    #[test]
    fn serializes_data_analysis_in_mef_output() {
        let bundle = bundle_with_data_analysis();
        let outputs = EngineOutputs {
            model_id: Some("MODEL-DA-1".to_string()),
            result_payload: Some(json!({"id": "QR-DA-1", "frequency": 1.0e-6})),
            ..EngineOutputs::default()
        };

        let rendered = to_json(&outputs, &bundle, ResolveMode::Compatible).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();

        let data_analysis = &parsed["technicalElements"]["data-analysis"];
        assert_eq!(data_analysis["id"], "DA-1");
        assert_eq!(data_analysis["dataParameters"][0]["id"], "DP-1");
        assert_eq!(data_analysis["dataParameters"][0]["probability"], json!(0.0025));
        assert_eq!(data_analysis["dataParameters"][0]["systemRef"], "SYS-1");
        assert_eq!(data_analysis["dataParameters"][0]["metadataRefs"][0]["id"], "META-1");
        assert_eq!(data_analysis["dataParameters"][0]["metadataRefs"][0]["refType"], "tag");
        assert_eq!(data_analysis["dataParameters"][0]["units"], "per-demand");
        assert_eq!(data_analysis["documentation"]["source"], "fixture");
        assert_eq!(data_analysis["sensitivityStudies"][0]["id"], "SS-1");
    }

    #[test]
    fn esq_output_emits_risk_significant_and_cutset_structures() {
        let bundle = valid_bundle();
        let outputs = EngineOutputs {
            model_id: Some("MODEL-ESQ-1".to_string()),
            result_payload: Some(json!([
                {
                    "id": "QR-1",
                    "eventSequenceId": "SEQ-1",
                    "probability": 0.10,
                    "frequency": 1.0e-4,
                    "cutSets": [
                        {"id": "CS-1", "members": ["BE-1", "BE-2"]}
                    ],
                    "cutSetGrouping": {"by": "system", "groupCount": 1}
                },
                {
                    "id": "QR-2",
                    "eventSequenceId": "SEQ-2",
                    "probability": 0.02,
                    "frequency": 2.0e-5
                }
            ])),
            ..EngineOutputs::default()
        };

        let rendered = to_json(&outputs, &bundle, ResolveMode::Compatible).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();
        let esq = &parsed["technicalElements"]["event-sequence-quantification"];

        assert_eq!(esq["riskSignificantSequences"][0]["eventSequenceId"], "SEQ-1");
        assert_eq!(esq["riskSignificantSequences"][1]["eventSequenceId"], "SEQ-2");
        assert_eq!(esq["cutSets"][0]["id"], "CS-1");
        assert_eq!(esq["cutSets"][0]["eventSequenceId"], "SEQ-1");
        assert_eq!(esq["cutSetGrouping"][0]["eventSequenceId"], "SEQ-1");
        assert_eq!(esq["cutSetGrouping"][0]["grouping"]["groupCount"], 1);
    }

    #[test]
    fn output_declares_webapp_minimum_required_set() {
        let bundle = valid_bundle();
        let outputs = EngineOutputs {
            model_id: Some("MODEL-WEBAPP-1".to_string()),
            result_payload: Some(json!({"id": "QR-W-1", "frequency": 1.0e-6})),
            ..EngineOutputs::default()
        };

        let rendered = to_json(&outputs, &bundle, ResolveMode::Compatible).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();

        let minimum = &parsed["outputMetadata"]["webAppMinimumOutput"];
        assert_eq!(minimum["version"], "v1");
        assert!(minimum["requiredFields"].is_array());
        assert!(minimum["requiredFields"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v == "technicalElements.event-sequence-quantification.quantificationResults"));
        assert!(minimum["requiredFields"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v == "diagnostics"));
    }

    #[test]
    fn esq_output_exposes_uncertainty_and_convergence_fields() {
        let bundle = valid_bundle();
        let outputs = EngineOutputs {
            model_id: Some("MODEL-ESQ-UNC-1".to_string()),
            result_payload: Some(json!([
                {
                    "id": "QR-U1",
                    "eventSequenceId": "SEQ-U1",
                    "probability": 0.10,
                    "frequency": 1.0e-4,
                    "uncertainty": {
                        "method": "binomial-wald",
                        "confidenceLevel": 0.95,
                        "relativeHalfWidth95": 0.20
                    },
                    "convergence": {
                        "enabled": false,
                        "criterion": "wald-linear-log10",
                        "met": null,
                        "trialsEvaluated": 256
                    }
                }
            ])),
            run_metadata: Some(json!({
                "backend": "cpu",
                "params": {"numTrialsRequested": 256, "numTrialsExecuted": 256},
                "seed": 42,
                "timingMs": 12.0,
                "convergence": {
                    "enabled": false,
                    "criterion": "wald-linear-log10",
                    "met": null,
                    "trialsEvaluated": 256
                }
            })),
            ..EngineOutputs::default()
        };

        let rendered = to_json(&outputs, &bundle, ResolveMode::Compatible).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();
        let esq = &parsed["technicalElements"]["event-sequence-quantification"];

        assert_eq!(esq["uncertainty"]["method"], "binomial-wald");
        assert_eq!(esq["uncertainty"]["confidenceLevel"], 0.95);
        assert_eq!(esq["uncertainty"]["perSequence"][0]["eventSequenceId"], "SEQ-U1");
        assert_eq!(
            esq["uncertainty"]["summary"]["maxRelativeHalfWidth95"],
            json!(0.20)
        );
        assert_eq!(esq["convergence"]["run"]["criterion"], "wald-linear-log10");
        assert_eq!(esq["convergence"]["perSequence"][0]["eventSequenceId"], "SEQ-U1");
    }
}
