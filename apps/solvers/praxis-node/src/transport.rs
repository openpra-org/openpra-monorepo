use std::collections::BTreeMap;
use std::error::Error;
use std::fmt::{Display, Formatter};

use praxis::PraxisError;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub(crate) const SOLVER_PROTOCOL_VERSION: &str = "1.0.0";

#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SolverRequest {
    pub(crate) schema_version: String,
    pub(crate) request: Value,
    pub(crate) model_snapshots: Vec<Value>,
    #[serde(default)]
    pub(crate) resources: SolverResources,
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct SolverResources {
    pub(crate) fault_tree_basic_event_catalogue: Option<Value>,
}

impl SolverRequest {
    pub(crate) fn from_json(json: &str) -> Result<Self, TransportError> {
        let request: Self = serde_json::from_str(json).map_err(TransportError::InvalidJson)?;
        if request.schema_version != SOLVER_PROTOCOL_VERSION {
            return Err(TransportError::UnsupportedSchemaVersion {
                received: request.schema_version,
            });
        }
        Ok(request)
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
            TransportError::InvalidJson(error) => (
                "INVALID_REQUEST_JSON",
                BTreeMap::from([
                    ("column".to_string(), json!(error.column())),
                    ("line".to_string(), json!(error.line())),
                ]),
            ),
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

    pub(crate) fn from_praxis(error: &PraxisError) -> Self {
        let code = match error {
            PraxisError::Io(_) => "PRAXIS_IO",
            PraxisError::DynamicLibrary(_) => "PRAXIS_DYNAMIC_LIBRARY",
            PraxisError::Logic(_) => "PRAXIS_LOGIC",
            PraxisError::IllegalOperation(_) => "PRAXIS_ILLEGAL_OPERATION",
            PraxisError::Settings(_) => "PRAXIS_SETTINGS",
            PraxisError::Bayesian(_) => "PRAXIS_BAYESIAN",
            PraxisError::Hcl(_) => "PRAXIS_HCL",
            PraxisError::Version(_) => "PRAXIS_VERSION",
            PraxisError::Serialization(_) => "PRAXIS_SERIALIZATION",
            PraxisError::Mef(_) => "PRAXIS_MEF",
            PraxisError::Xml(_) => "PRAXIS_XML",
        };

        Self {
            schema_version: SOLVER_PROTOCOL_VERSION,
            error: StructuredError {
                kind: ErrorKind::SolverError,
                code,
                message: error.to_string(),
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
    UnsupportedSchemaVersion { received: String },
}

impl Display for TransportError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidJson(error) => write!(formatter, "invalid solver JSON: {error}"),
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
            Self::InvalidJson(error) => Some(error),
            Self::UnsupportedSchemaVersion { .. } => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use praxis::{MefError, PraxisError, XmlError};
    use serde_json::json;

    use super::{
        SolverErrorResult, SolverRequest, SolverResult, TransportError, SOLVER_PROTOCOL_VERSION,
    };

    fn request_json(version: &str) -> String {
        json!({
            "schemaVersion": version,
            "request": {
                "schemaVersion": "1.0.0",
                "methodType": "HYBRID_CAUSAL_LOGIC",
                "modelId": "7bb125f8-a864-47b5-9824-0ac7f3588698",
                "revision": 3
            },
            "modelSnapshots": [
                {
                    "schemaVersion": "1.0.0",
                    "methodType": "HYBRID_CAUSAL_LOGIC",
                    "id": "7bb125f8-a864-47b5-9824-0ac7f3588698",
                    "revision": 3
                }
            ]
        })
        .to_string()
    }

    #[test]
    fn accepts_the_current_versioned_request_without_rewriting_payloads() {
        let request = SolverRequest::from_json(&request_json(SOLVER_PROTOCOL_VERSION)).unwrap();

        assert_eq!(request.schema_version, SOLVER_PROTOCOL_VERSION);
        assert_eq!(request.request["methodType"], "HYBRID_CAUSAL_LOGIC");
        assert_eq!(request.model_snapshots.len(), 1);
        assert_eq!(request.model_snapshots[0]["revision"], 3);
    }

    #[test]
    fn rejects_unknown_versions_missing_fields_and_extra_envelope_fields() {
        let error = SolverRequest::from_json(&request_json("2.0.0")).unwrap_err();
        assert!(matches!(
            error,
            TransportError::UnsupportedSchemaVersion { received } if received == "2.0.0"
        ));

        let missing_models = json!({
            "schemaVersion": SOLVER_PROTOCOL_VERSION,
            "request": {}
        });
        assert!(matches!(
            SolverRequest::from_json(&missing_models.to_string()),
            Err(TransportError::InvalidJson(_))
        ));

        let extra_field = json!({
            "schemaVersion": SOLVER_PROTOCOL_VERSION,
            "request": {},
            "modelSnapshots": [],
            "unplannedOption": true
        });
        assert!(matches!(
            SolverRequest::from_json(&extra_field.to_string()),
            Err(TransportError::InvalidJson(_))
        ));
    }

    #[test]
    fn returns_results_in_the_current_versioned_json_envelope() {
        let json = SolverResult::new(json!({
            "methodType": "HYBRID_CAUSAL_LOGIC",
            "probability": 0.16
        }))
        .to_json()
        .unwrap();
        let result: serde_json::Value = serde_json::from_str(&json).unwrap();

        assert_eq!(result["schemaVersion"], SOLVER_PROTOCOL_VERSION);
        assert_eq!(result["result"]["methodType"], "HYBRID_CAUSAL_LOGIC");
        assert_eq!(result["result"]["probability"], 0.16);
        assert_eq!(result.as_object().unwrap().len(), 2);
    }

    #[test]
    fn returns_structured_request_validation_errors() {
        let invalid_json = SolverRequest::from_json("{").unwrap_err();
        let response: serde_json::Value = serde_json::from_str(
            &SolverErrorResult::from_transport(&invalid_json)
                .to_json()
                .unwrap(),
        )
        .unwrap();

        assert_eq!(response["schemaVersion"], SOLVER_PROTOCOL_VERSION);
        assert_eq!(response["error"]["kind"], "VALIDATION_ERROR");
        assert_eq!(response["error"]["code"], "INVALID_REQUEST_JSON");
        assert_eq!(response["error"]["details"]["line"], 1);
        assert!(response["error"]["message"]
            .as_str()
            .unwrap()
            .starts_with("invalid solver JSON:"));

        let unsupported = SolverRequest::from_json(&request_json("2.0.0")).unwrap_err();
        let response: serde_json::Value = serde_json::from_str(
            &SolverErrorResult::from_transport(&unsupported)
                .to_json()
                .unwrap(),
        )
        .unwrap();
        assert_eq!(response["error"]["code"], "UNSUPPORTED_SCHEMA_VERSION");
        assert_eq!(
            response["error"]["details"]["expectedSchemaVersion"],
            SOLVER_PROTOCOL_VERSION
        );
        assert_eq!(
            response["error"]["details"]["receivedSchemaVersion"],
            "2.0.0"
        );
    }

    #[test]
    fn maps_every_praxis_error_family_to_a_stable_solver_code() {
        let cases = [
            (PraxisError::Io("disk".to_string()), "PRAXIS_IO"),
            (
                PraxisError::DynamicLibrary("library".to_string()),
                "PRAXIS_DYNAMIC_LIBRARY",
            ),
            (PraxisError::Logic("graph".to_string()), "PRAXIS_LOGIC"),
            (
                PraxisError::IllegalOperation("operation".to_string()),
                "PRAXIS_ILLEGAL_OPERATION",
            ),
            (
                PraxisError::Settings("setting".to_string()),
                "PRAXIS_SETTINGS",
            ),
            (
                PraxisError::Bayesian("network".to_string()),
                "PRAXIS_BAYESIAN",
            ),
            (PraxisError::Hcl("binding".to_string()), "PRAXIS_HCL"),
            (
                PraxisError::Version("version".to_string()),
                "PRAXIS_VERSION",
            ),
            (
                PraxisError::Serialization("json".to_string()),
                "PRAXIS_SERIALIZATION",
            ),
            (
                PraxisError::Mef(MefError::Validity("model".to_string())),
                "PRAXIS_MEF",
            ),
            (
                PraxisError::Xml(XmlError::XInclude("include".to_string())),
                "PRAXIS_XML",
            ),
        ];

        for (error, expected_code) in cases {
            let response: serde_json::Value =
                serde_json::from_str(&SolverErrorResult::from_praxis(&error).to_json().unwrap())
                    .unwrap();

            assert_eq!(response["schemaVersion"], SOLVER_PROTOCOL_VERSION);
            assert_eq!(response["error"]["kind"], "SOLVER_ERROR");
            assert_eq!(response["error"]["code"], expected_code);
            assert!(response["error"]["message"]
                .as_str()
                .unwrap()
                .contains(error.to_string().as_str()));
            assert_eq!(response["error"]["details"], json!({}));
        }
    }
}
