use std::collections::BTreeMap;
use std::error::Error;
use std::fmt::{Display, Formatter};

use openrc::error::OpenRcError;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub(crate) const SOLVER_PROTOCOL_VERSION: &str = "1.0.0";
pub(crate) const RADIOLOGICAL_CONSEQUENCE_METHOD: &str = "RADIOLOGICAL_CONSEQUENCE";

#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SolverEnvelope {
    schema_version: String,
    request: Value,
}

#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SolverRequest {
    pub(crate) method_type: String,
    pub(crate) config_text: String,
    #[serde(default)]
    pub(crate) met_file_text: Option<String>,
}

impl SolverRequest {
    pub(crate) fn from_json(json: &str) -> Result<Self, TransportError> {
        let envelope: SolverEnvelope =
            serde_json::from_str(json).map_err(TransportError::InvalidJson)?;
        if envelope.schema_version != SOLVER_PROTOCOL_VERSION {
            return Err(TransportError::UnsupportedSchemaVersion {
                received: envelope.schema_version,
            });
        }
        if envelope.request["methodType"].as_str() != Some(RADIOLOGICAL_CONSEQUENCE_METHOD) {
            return Err(TransportError::UnsupportedMethodType {
                received: envelope.request["methodType"].clone(),
            });
        }
        serde_json::from_value(envelope.request).map_err(TransportError::InvalidRequest)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SolverResult<T> {
    schema_version: &'static str,
    result: T,
}

impl<T> SolverResult<T>
where
    T: Serialize,
{
    pub(crate) const fn new(result: T) -> Self {
        Self {
            schema_version: SOLVER_PROTOCOL_VERSION,
            result,
        }
    }

    pub(crate) fn to_json(&self) -> Result<String, TransportError> {
        serde_json::to_string(self).map_err(TransportError::InvalidJson)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(crate) enum ErrorKind {
    ValidationError,
    SolverError,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StructuredError {
    kind: ErrorKind,
    code: &'static str,
    message: String,
    details: BTreeMap<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SolverErrorResult {
    schema_version: &'static str,
    error: StructuredError,
}

impl SolverErrorResult {
    pub(crate) fn from_transport(error: &TransportError) -> Self {
        let (code, details) = match error {
            TransportError::UnsupportedMethodType { received } => (
                "UNSUPPORTED_METHOD_TYPE",
                BTreeMap::from([("receivedMethodType".to_string(), received.clone())]),
            ),
            TransportError::InvalidJson(error) => (
                "INVALID_REQUEST_JSON",
                BTreeMap::from([
                    ("column".to_string(), json!(error.column())),
                    ("line".to_string(), json!(error.line())),
                ]),
            ),
            TransportError::InvalidRequest(_) => ("INVALID_REQUEST", BTreeMap::new()),
            TransportError::UnsupportedSchemaVersion { received } => (
                "UNSUPPORTED_SCHEMA_VERSION",
                BTreeMap::from([
                    (
                        "expectedSchemaVersion".to_string(),
                        json!(SOLVER_PROTOCOL_VERSION),
                    ),
                    ("receivedSchemaVersion".to_string(), json!(received)),
                ]),
            ),
        };

        Self {
            schema_version: SOLVER_PROTOCOL_VERSION,
            error: StructuredError {
                kind: ErrorKind::ValidationError,
                code,
                message: error.to_string(),
                details,
            },
        }
    }

    pub(crate) fn from_openrc(error: &OpenRcError) -> Self {
        let code = match error {
            OpenRcError::FileNotFound(_) => "OPENRC_FILE_NOT_FOUND",
            OpenRcError::InvalidValue(_) => "OPENRC_INVALID_VALUE",
            OpenRcError::MissingKey(_) => "OPENRC_MISSING_KEY",
            OpenRcError::ConfigSyntax(_) => "OPENRC_CONFIG_SYNTAX",
            OpenRcError::Json(_) => "OPENRC_JSON",
            OpenRcError::Io(_) => "OPENRC_IO",
            OpenRcError::ZeroDivision(_) => "OPENRC_ZERO_DIVISION",
            OpenRcError::OutOfRange(_) => "OPENRC_OUT_OF_RANGE",
            OpenRcError::InvalidType(_) => "OPENRC_INVALID_TYPE",
        };

        Self::solver_error(code, error.to_string())
    }

    pub(crate) fn from_panic(description: &str) -> Self {
        Self::solver_error(
            "OPENRC_PANIC",
            format!("the consequence engine stopped unexpectedly: {description}"),
        )
    }

    fn solver_error(code: &'static str, message: String) -> Self {
        Self {
            schema_version: SOLVER_PROTOCOL_VERSION,
            error: StructuredError {
                kind: ErrorKind::SolverError,
                code,
                message,
                details: BTreeMap::new(),
            },
        }
    }

    pub(crate) fn to_json(&self) -> Result<String, TransportError> {
        serde_json::to_string(self).map_err(TransportError::InvalidJson)
    }
}

#[derive(Debug)]
pub(crate) enum TransportError {
    InvalidJson(serde_json::Error),
    InvalidRequest(serde_json::Error),
    UnsupportedMethodType { received: Value },
    UnsupportedSchemaVersion { received: String },
}

impl Display for TransportError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsupportedMethodType { received } => write!(
                formatter,
                "unsupported or missing solver method type: {received}"
            ),
            Self::InvalidJson(error) => write!(formatter, "invalid solver JSON: {error}"),
            Self::InvalidRequest(error) => {
                write!(formatter, "invalid consequence request: {error}")
            }
            Self::UnsupportedSchemaVersion { received } => write!(
                formatter,
                "unsupported solver schema version '{received}'; expected '{SOLVER_PROTOCOL_VERSION}'"
            ),
        }
    }
}

impl Error for TransportError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::InvalidJson(error) | Self::InvalidRequest(error) => Some(error),
            Self::UnsupportedSchemaVersion { .. } | Self::UnsupportedMethodType { .. } => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use openrc::error::OpenRcError;
    use serde_json::{json, Value};

    use super::{
        SolverErrorResult, SolverRequest, SolverResult, TransportError,
        RADIOLOGICAL_CONSEQUENCE_METHOD, SOLVER_PROTOCOL_VERSION,
    };

    fn request_json(version: &str) -> String {
        json!({
            "schemaVersion": version,
            "request": {
                "methodType": RADIOLOGICAL_CONSEQUENCE_METHOD,
                "configText": "[run]\ncase_name = a\n",
                "metFileText": "D,3.0\n"
            }
        })
        .to_string()
    }

    fn response(result: &SolverErrorResult) -> Value {
        serde_json::from_str(&result.to_json().unwrap()).unwrap()
    }

    #[test]
    fn accepts_the_current_versioned_request_without_rewriting_its_texts() {
        let request = SolverRequest::from_json(&request_json(SOLVER_PROTOCOL_VERSION)).unwrap();

        assert_eq!(request.method_type, RADIOLOGICAL_CONSEQUENCE_METHOD);
        assert_eq!(request.config_text, "[run]\ncase_name = a\n");
        assert_eq!(request.met_file_text.as_deref(), Some("D,3.0\n"));
    }

    #[test]
    fn treats_a_missing_or_null_met_file_text_as_absent() {
        for request in [
            json!({"methodType": RADIOLOGICAL_CONSEQUENCE_METHOD, "configText": "x"}),
            json!({"methodType": RADIOLOGICAL_CONSEQUENCE_METHOD, "configText": "x", "metFileText": null}),
        ] {
            let json = json!({"schemaVersion": SOLVER_PROTOCOL_VERSION, "request": request});
            let parsed = SolverRequest::from_json(&json.to_string()).unwrap();
            assert_eq!(parsed.config_text, "x");
            assert_eq!(parsed.met_file_text, None);
        }
        let empty = json!({
            "schemaVersion": SOLVER_PROTOCOL_VERSION,
            "request": {
                "methodType": RADIOLOGICAL_CONSEQUENCE_METHOD,
                "configText": "",
                "metFileText": ""
            }
        });
        let parsed = SolverRequest::from_json(&empty.to_string()).unwrap();
        assert_eq!(parsed.config_text, "");
        assert_eq!(parsed.met_file_text.as_deref(), Some(""));
    }

    #[test]
    fn keeps_every_character_of_the_texts_across_the_json_boundary() {
        let config =
            "[run]\r\ncase_name = caf\u{e9} \u{3c7}/Q \u{1f600}\ttab\\slash \"quote\"\u{0}\u{1c}\n";
        let met = "D,0.09999999999999999,270\r\nE,5e-324,1e308\n";
        let json = json!({
            "schemaVersion": SOLVER_PROTOCOL_VERSION,
            "request": {
                "methodType": RADIOLOGICAL_CONSEQUENCE_METHOD,
                "configText": config,
                "metFileText": met
            }
        });
        let parsed = SolverRequest::from_json(&json.to_string()).unwrap();
        assert_eq!(parsed.config_text, config);
        assert_eq!(parsed.met_file_text.as_deref(), Some(met));
    }

    #[test]
    fn rejects_unknown_versions_missing_fields_and_extra_envelope_fields() {
        let error = SolverRequest::from_json(&request_json("2.0.0")).unwrap_err();
        assert!(matches!(
            error,
            TransportError::UnsupportedSchemaVersion { received } if received == "2.0.0"
        ));

        for envelope in [
            json!({"schemaVersion": SOLVER_PROTOCOL_VERSION}),
            json!({"request": {}}),
            json!({"schemaVersion": 1, "request": {}}),
            json!({"schemaVersion": SOLVER_PROTOCOL_VERSION, "request": {}, "modelSnapshots": []}),
            json!({"schemaVersion": SOLVER_PROTOCOL_VERSION, "request": {}, "unplannedOption": true}),
            json!([]),
            json!(null),
            json!("text"),
        ] {
            assert!(
                matches!(
                    SolverRequest::from_json(&envelope.to_string()),
                    Err(TransportError::InvalidJson(_))
                ),
                "{envelope}"
            );
        }
        for text in [
            "",
            "{",
            "{\"schemaVersion\":\"1.0.0\",\"request\":{}} trailing",
        ] {
            assert!(
                matches!(
                    SolverRequest::from_json(text),
                    Err(TransportError::InvalidJson(_))
                ),
                "{text}"
            );
        }
    }

    #[test]
    fn rejects_missing_malformed_and_unsupported_method_types() {
        for method in [
            json!(null),
            json!(1),
            json!({}),
            json!(""),
            json!("FAULT_TREE"),
            json!("radiological_consequence"),
        ] {
            let envelope = json!({
                "schemaVersion": SOLVER_PROTOCOL_VERSION,
                "request": {"methodType": method, "configText": "x"}
            });
            let error = SolverRequest::from_json(&envelope.to_string()).unwrap_err();
            assert!(
                matches!(&error, TransportError::UnsupportedMethodType { received } if *received == method),
                "{method}"
            );
        }
        for request in [json!({}), json!([]), json!("text"), json!(null), json!(7)] {
            let envelope = json!({"schemaVersion": SOLVER_PROTOCOL_VERSION, "request": request});
            assert!(
                matches!(
                    SolverRequest::from_json(&envelope.to_string()),
                    Err(TransportError::UnsupportedMethodType { received }) if received.is_null()
                ),
                "{request}"
            );
        }
    }

    #[test]
    fn rejects_requests_with_missing_mistyped_or_extra_fields() {
        for request in [
            json!({"methodType": RADIOLOGICAL_CONSEQUENCE_METHOD}),
            json!({"methodType": RADIOLOGICAL_CONSEQUENCE_METHOD, "configText": 5}),
            json!({"methodType": RADIOLOGICAL_CONSEQUENCE_METHOD, "configText": null}),
            json!({"methodType": RADIOLOGICAL_CONSEQUENCE_METHOD, "configText": ["x"]}),
            json!({"methodType": RADIOLOGICAL_CONSEQUENCE_METHOD, "configText": "x", "metFileText": 5}),
            json!({"methodType": RADIOLOGICAL_CONSEQUENCE_METHOD, "configText": "x", "metFileText": ["D,3"]}),
            json!({"methodType": RADIOLOGICAL_CONSEQUENCE_METHOD, "configText": "x", "configPath": "a.txt"}),
            json!({"methodType": RADIOLOGICAL_CONSEQUENCE_METHOD, "configText": "x", "config_text": "x"}),
        ] {
            let envelope = json!({"schemaVersion": SOLVER_PROTOCOL_VERSION, "request": request});
            let error = SolverRequest::from_json(&envelope.to_string()).unwrap_err();
            assert!(
                matches!(error, TransportError::InvalidRequest(_)),
                "{request}: {error}"
            );
            let response = response(&SolverErrorResult::from_transport(&error));
            assert_eq!(response["error"]["kind"], "VALIDATION_ERROR");
            assert_eq!(response["error"]["code"], "INVALID_REQUEST");
            assert_eq!(response["error"]["details"], json!({}));
            assert!(response["error"]["message"]
                .as_str()
                .unwrap()
                .starts_with("invalid consequence request: "));
        }
    }

    #[test]
    fn checks_the_version_before_the_method_and_the_method_before_the_fields() {
        let both_wrong = json!({"schemaVersion": "0.9.0", "request": {"methodType": "OTHER"}});
        assert!(matches!(
            SolverRequest::from_json(&both_wrong.to_string()),
            Err(TransportError::UnsupportedSchemaVersion { .. })
        ));
        let method_and_fields_wrong = json!({
            "schemaVersion": SOLVER_PROTOCOL_VERSION,
            "request": {"methodType": "OTHER", "unknown": true}
        });
        assert!(matches!(
            SolverRequest::from_json(&method_and_fields_wrong.to_string()),
            Err(TransportError::UnsupportedMethodType { .. })
        ));
    }

    #[test]
    fn preserves_result_number_bits_and_signed_zero() {
        let values = [
            0.09999999999999999_f64,
            1.999980000133572e-05,
            0.49999999999999994,
            1e-308,
            f64::from_bits(1),
            f64::MAX,
            -0.0,
            0.0,
            1e22,
            123456789012345680.0,
        ];
        let text = SolverResult::new(json!({ "values": values }))
            .to_json()
            .unwrap();
        let parsed: Value = serde_json::from_str(&text).unwrap();
        for (index, expected) in values.iter().enumerate() {
            assert_eq!(
                parsed["result"]["values"][index]
                    .as_f64()
                    .unwrap()
                    .to_bits(),
                expected.to_bits(),
                "{expected:e}"
            );
        }
    }

    #[test]
    fn returns_results_in_the_current_versioned_json_envelope() {
        let json = SolverResult::new(json!({
            "methodType": RADIOLOGICAL_CONSEQUENCE_METHOD,
            "console": "",
            "results": {"tede_sv": 0.16}
        }))
        .to_json()
        .unwrap();
        let result: Value = serde_json::from_str(&json).unwrap();

        assert_eq!(result["schemaVersion"], SOLVER_PROTOCOL_VERSION);
        assert_eq!(
            result["result"]["methodType"],
            RADIOLOGICAL_CONSEQUENCE_METHOD
        );
        assert_eq!(result["result"]["results"]["tede_sv"], 0.16);
        assert_eq!(result.as_object().unwrap().len(), 2);
        assert!(json.starts_with("{\"schemaVersion\":\"1.0.0\",\"result\":{\"methodType\":"));
    }

    #[test]
    fn returns_structured_request_validation_errors() {
        let invalid_json = SolverRequest::from_json("{").unwrap_err();
        let response_value = response(&SolverErrorResult::from_transport(&invalid_json));

        assert_eq!(response_value["schemaVersion"], SOLVER_PROTOCOL_VERSION);
        assert_eq!(response_value["error"]["kind"], "VALIDATION_ERROR");
        assert_eq!(response_value["error"]["code"], "INVALID_REQUEST_JSON");
        assert_eq!(response_value["error"]["details"]["line"], 1);
        assert_eq!(response_value["error"]["details"]["column"], 1);
        assert!(response_value["error"]["message"]
            .as_str()
            .unwrap()
            .starts_with("invalid solver JSON:"));

        let unsupported = SolverRequest::from_json(&request_json("2.0.0")).unwrap_err();
        let response_value = response(&SolverErrorResult::from_transport(&unsupported));
        assert_eq!(
            response_value["error"]["code"],
            "UNSUPPORTED_SCHEMA_VERSION"
        );
        assert_eq!(
            response_value["error"]["details"]["expectedSchemaVersion"],
            SOLVER_PROTOCOL_VERSION
        );
        assert_eq!(
            response_value["error"]["details"]["receivedSchemaVersion"],
            "2.0.0"
        );

        let method = json!({
            "schemaVersion": SOLVER_PROTOCOL_VERSION,
            "request": {"methodType": "FAULT_TREE"}
        });
        let unsupported = SolverRequest::from_json(&method.to_string()).unwrap_err();
        let response_value = response(&SolverErrorResult::from_transport(&unsupported));
        assert_eq!(response_value["error"]["kind"], "VALIDATION_ERROR");
        assert_eq!(response_value["error"]["code"], "UNSUPPORTED_METHOD_TYPE");
        assert_eq!(
            response_value["error"]["details"]["receivedMethodType"],
            "FAULT_TREE"
        );
        assert_eq!(
            response_value["error"]["message"],
            "unsupported or missing solver method type: \"FAULT_TREE\""
        );
    }

    #[test]
    fn maps_every_engine_error_family_to_a_stable_solver_code() {
        let cases = [
            (
                OpenRcError::FileNotFound("file".to_string()),
                "OPENRC_FILE_NOT_FOUND",
            ),
            (
                OpenRcError::InvalidValue("value".to_string()),
                "OPENRC_INVALID_VALUE",
            ),
            (
                OpenRcError::MissingKey("key".to_string()),
                "OPENRC_MISSING_KEY",
            ),
            (
                OpenRcError::ConfigSyntax("syntax".to_string()),
                "OPENRC_CONFIG_SYNTAX",
            ),
            (OpenRcError::Json("json".to_string()), "OPENRC_JSON"),
            (OpenRcError::Io("disk".to_string()), "OPENRC_IO"),
            (
                OpenRcError::ZeroDivision("zero".to_string()),
                "OPENRC_ZERO_DIVISION",
            ),
            (
                OpenRcError::OutOfRange("index".to_string()),
                "OPENRC_OUT_OF_RANGE",
            ),
            (
                OpenRcError::InvalidType("type".to_string()),
                "OPENRC_INVALID_TYPE",
            ),
        ];

        for (error, expected_code) in cases {
            let response_value = response(&SolverErrorResult::from_openrc(&error));

            assert_eq!(response_value["schemaVersion"], SOLVER_PROTOCOL_VERSION);
            assert_eq!(response_value["error"]["kind"], "SOLVER_ERROR");
            assert_eq!(response_value["error"]["code"], expected_code);
            assert_eq!(response_value["error"]["message"], error.message());
            assert_eq!(response_value["error"]["details"], json!({}));
            assert_eq!(response_value.as_object().unwrap().len(), 2);
        }
    }

    #[test]
    fn reports_an_engine_panic_as_a_solver_error() {
        let response_value = response(&SolverErrorResult::from_panic("index out of bounds"));

        assert_eq!(response_value["error"]["kind"], "SOLVER_ERROR");
        assert_eq!(response_value["error"]["code"], "OPENRC_PANIC");
        assert_eq!(
            response_value["error"]["message"],
            "the consequence engine stopped unexpectedly: index out of bounds"
        );
        assert_eq!(response_value["error"]["details"], json!({}));
    }
}
