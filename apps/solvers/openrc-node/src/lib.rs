use std::any::Any;
use std::panic::{catch_unwind, AssertUnwindSafe};

use napi::bindgen_prelude::Result;
use napi_derive::napi;
use openrc::error::OpenRcError;
use serde_json::Value;

mod radiological_consequence;
mod transport;

use transport::{SolverErrorResult, SolverRequest, SolverResult, TransportError};

type Operation = fn(&SolverRequest) -> std::result::Result<Value, OpenRcError>;

#[napi]
pub fn validate(request_json: String) -> Result<String> {
    respond(&request_json, radiological_consequence::validate).map_err(to_napi_error)
}

#[napi]
pub fn execute(request_json: String) -> Result<String> {
    respond(&request_json, radiological_consequence::execute).map_err(to_napi_error)
}

fn respond(
    request_json: &str,
    operation: Operation,
) -> std::result::Result<String, TransportError> {
    let request = match SolverRequest::from_json(request_json) {
        Ok(request) => request,
        Err(error) => return SolverErrorResult::from_transport(&error).to_json(),
    };
    match catch_unwind(AssertUnwindSafe(|| operation(&request))) {
        Ok(Ok(result)) => SolverResult::new(result).to_json(),
        Ok(Err(error)) => SolverErrorResult::from_openrc(&error).to_json(),
        Err(payload) => {
            SolverErrorResult::from_panic(&panic_description(payload.as_ref())).to_json()
        }
    }
}

fn panic_description(payload: &(dyn Any + Send)) -> String {
    if let Some(text) = payload.downcast_ref::<&str>() {
        (*text).to_string()
    } else if let Some(text) = payload.downcast_ref::<String>() {
        text.clone()
    } else {
        "no description".to_string()
    }
}

fn to_napi_error(error: TransportError) -> napi::Error {
    napi::Error::from_reason(error.to_string())
}

#[cfg(test)]
mod tests {
    use openrc::error::OpenRcError;
    use serde_json::{json, Value};

    use super::{panic_description, respond};
    use crate::transport::SolverRequest;

    fn envelope(config_text: &str) -> String {
        json!({
            "schemaVersion": "1.0.0",
            "request": {"methodType": "RADIOLOGICAL_CONSEQUENCE", "configText": config_text}
        })
        .to_string()
    }

    fn parsed(text: &str) -> Value {
        serde_json::from_str(text).unwrap()
    }

    fn echo(request: &SolverRequest) -> Result<Value, OpenRcError> {
        Ok(json!({"configText": request.config_text}))
    }

    fn refuse(request: &SolverRequest) -> Result<Value, OpenRcError> {
        Err(OpenRcError::InvalidValue(format!(
            "refused {}",
            request.config_text
        )))
    }

    fn break_with_text(_request: &SolverRequest) -> Result<Value, OpenRcError> {
        panic!("a literal message")
    }

    fn break_with_string(request: &SolverRequest) -> Result<Value, OpenRcError> {
        let values: Vec<f64> = Vec::new();
        Ok(json!(values[request.config_text.len()]))
    }

    #[test]
    fn wraps_a_result_in_the_versioned_envelope() {
        let response = parsed(&respond(&envelope("abc"), echo).unwrap());
        assert_eq!(
            response,
            json!({"schemaVersion": "1.0.0", "result": {"configText": "abc"}})
        );
    }

    #[test]
    fn wraps_an_engine_error_in_the_versioned_envelope() {
        let response = parsed(&respond(&envelope("abc"), refuse).unwrap());
        assert_eq!(
            response,
            json!({
                "schemaVersion": "1.0.0",
                "error": {
                    "kind": "SOLVER_ERROR",
                    "code": "OPENRC_INVALID_VALUE",
                    "message": "refused abc",
                    "details": {}
                }
            })
        );
    }

    #[test]
    fn answers_a_bad_envelope_without_calling_the_engine() {
        let response = parsed(&respond("{", break_with_text).unwrap());
        assert_eq!(response["error"]["kind"], "VALIDATION_ERROR");
        assert_eq!(response["error"]["code"], "INVALID_REQUEST_JSON");
    }

    #[test]
    fn turns_an_engine_panic_into_a_structured_error() {
        let literal = parsed(&respond(&envelope("abc"), break_with_text).unwrap());
        let formatted = parsed(&respond(&envelope("abc"), break_with_string).unwrap());

        assert_eq!(literal["schemaVersion"], "1.0.0");
        assert_eq!(literal["error"]["kind"], "SOLVER_ERROR");
        assert_eq!(literal["error"]["code"], "OPENRC_PANIC");
        assert_eq!(
            literal["error"]["message"],
            "the consequence engine stopped unexpectedly: a literal message"
        );
        assert_eq!(formatted["error"]["code"], "OPENRC_PANIC");
        assert!(formatted["error"]["message"]
            .as_str()
            .unwrap()
            .contains("index out of bounds"));

        let after = parsed(&respond(&envelope("abc"), echo).unwrap());
        assert_eq!(after["result"]["configText"], "abc");
    }

    #[test]
    fn describes_panic_payloads_of_any_type() {
        assert_eq!(panic_description(&"text"), "text");
        assert_eq!(panic_description(&"owned".to_string()), "owned");
        assert_eq!(panic_description(&7_u8), "no description");
    }
}
