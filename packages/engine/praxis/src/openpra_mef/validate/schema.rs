use crate::openpra_mef::contracts::{Diagnostic, Severity};
use serde_json::Value;

const SUPPORTED_TECHNICAL_ELEMENTS: [&str; 6] = [
    "data-analysis",
    "systems-analysis",
    "initiating-event-analysis",
    "event-sequence-analysis",
    "event-sequence-quantification",
    "risk-integration",
];

pub fn parse_json_value(input: &str) -> Result<Value, serde_json::Error> {
    serde_json::from_str(input)
}

pub fn validate_schema(input: &str) -> Vec<Diagnostic> {
    if input.trim().is_empty() {
        return vec![Diagnostic::new(
            "SCHEMA_INVALID_JSON",
            Severity::Error,
            "Input is empty",
            "$.input",
        )];
    }

    let value = match parse_json_value(input) {
        Ok(v) => v,
        Err(err) => {
            return vec![Diagnostic::new(
                "SCHEMA_INVALID_JSON",
                Severity::Error,
                format!("Invalid JSON: {err}"),
                "$.input",
            )]
        }
    };

    let mut diagnostics = Vec::new();

    let root = match value.as_object() {
        Some(obj) => obj,
        None => {
            return vec![Diagnostic::new(
                "SCHEMA_VALIDATION_FAILED",
                Severity::Error,
                "Root must be a JSON object",
                "$",
            )]
        }
    };

    let technical_elements_value = match root.get("technicalElements") {
        Some(v) => v,
        None => {
            diagnostics.push(Diagnostic::new(
                "SCHEMA_MISSING_REQUIRED_FIELD",
                Severity::Error,
                "Missing required field 'technicalElements'",
                "$.technicalElements",
            ));
            return diagnostics;
        }
    };

    let technical_elements = match technical_elements_value.as_object() {
        Some(obj) => obj,
        None => {
            diagnostics.push(Diagnostic::new(
                "SCHEMA_VALIDATION_FAILED",
                Severity::Error,
                "'technicalElements' must be an object",
                "$.technicalElements",
            ));
            return diagnostics;
        }
    };

    if let Some(id) = root.get("id") {
        if !id.is_string() {
            diagnostics.push(Diagnostic::new(
                "SCHEMA_VALIDATION_FAILED",
                Severity::Error,
                "'id' must be a string",
                "$.id",
            ));
        }
    }

    for (element_name, element_value) in technical_elements {
        let path = format!("$.technicalElements.{element_name}");

        if !SUPPORTED_TECHNICAL_ELEMENTS.contains(&element_name.as_str()) {
            diagnostics.push(
                Diagnostic::new(
                    "SCHEMA_UNKNOWN_ELEMENT_TYPE",
                    Severity::Warning,
                    format!(
                        "Out-of-scope technical element '{element_name}' preserved as placeholder"
                    ),
                    path,
                )
                .with_hint("Element is retained under additionalElements for v1 placeholder handling"),
            );
            continue;
        }

        if !element_value.is_object() {
            diagnostics.push(Diagnostic::new(
                "SCHEMA_VALIDATION_FAILED",
                Severity::Error,
                format!("Technical element '{element_name}' must be an object"),
                path,
            ));
            continue;
        }

        if let Some(obj) = element_value.as_object() {
            if let Some(id) = obj.get("id") {
                if !id.is_string() {
                    diagnostics.push(Diagnostic::new(
                        "SCHEMA_VALIDATION_FAILED",
                        Severity::Error,
                        format!("'{element_name}.id' must be a string"),
                        format!("$.technicalElements.{element_name}.id"),
                    ));
                }
            }

            match element_name.as_str() {
                "data-analysis" => {
                    validate_optional_array(
                        obj,
                        "dataParameters",
                        &format!("$.technicalElements.{element_name}.dataParameters"),
                        &mut diagnostics,
                    );
                }
                "systems-analysis" => {
                    validate_optional_array(
                        obj,
                        "systemDefinitions",
                        &format!("$.technicalElements.{element_name}.systemDefinitions"),
                        &mut diagnostics,
                    );
                    validate_optional_array(
                        obj,
                        "systemLogicModels",
                        &format!("$.technicalElements.{element_name}.systemLogicModels"),
                        &mut diagnostics,
                    );
                }
                "initiating-event-analysis" => {
                    validate_optional_array(
                        obj,
                        "initiators",
                        &format!("$.technicalElements.{element_name}.initiators"),
                        &mut diagnostics,
                    );
                }
                "event-sequence-analysis" => {
                    validate_optional_array(
                        obj,
                        "eventSequences",
                        &format!("$.technicalElements.{element_name}.eventSequences"),
                        &mut diagnostics,
                    );
                }
                "event-sequence-quantification" => {
                    validate_optional_array(
                        obj,
                        "quantificationResults",
                        &format!("$.technicalElements.{element_name}.quantificationResults"),
                        &mut diagnostics,
                    );
                }
                "risk-integration" => {
                    validate_optional_array(
                        obj,
                        "eventSequenceToReleaseCategoryMappings",
                        &format!(
                            "$.technicalElements.{element_name}.eventSequenceToReleaseCategoryMappings"
                        ),
                        &mut diagnostics,
                    );
                }
                _ => {}
            }
        }
    }

    diagnostics
}

fn validate_optional_array(
    obj: &serde_json::Map<String, Value>,
    key: &str,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    if let Some(value) = obj.get(key) {
        if !value.is_array() {
            diagnostics.push(Diagnostic::new(
                "SCHEMA_VALIDATION_FAILED",
                Severity::Error,
                format!("'{key}' must be an array"),
                path,
            ));
        }
    }
}
