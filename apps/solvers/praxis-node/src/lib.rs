use napi::bindgen_prelude::{Object, Result};
use napi_derive::napi;
use praxis::PraxisError;
use serde_json::json;

mod transport;

use transport::{SolverErrorResult, SolverRequest, SolverResult, TransportError};

/// Initialize the native module without exposing solver operations yet.
///
/// Public operations are introduced separately so the addon scaffold can be
/// built and load-tested before it is coupled to PRAXIS.
#[napi(module_exports)]
pub fn initialize(_exports: Object) -> Result<()> {
    Ok(())
}

/// Validate the versioned solver transport envelope.
#[napi]
pub fn validate(request_json: String) -> Result<String> {
    match SolverRequest::from_json(&request_json) {
        Ok(request) => SolverResult::new(json!({
            "scope": "TRANSPORT",
            "valid": true,
            "modelSnapshotCount": request.model_snapshots.len()
        }))
        .to_json()
        .map_err(to_napi_error),
        Err(error) => SolverErrorResult::from_transport(&error)
            .to_json()
            .map_err(to_napi_error),
    }
}

/// Execute a versioned solver request through its method-specific adapter.
#[napi]
pub fn execute(request_json: String) -> Result<String> {
    if let Err(error) = SolverRequest::from_json(&request_json) {
        return SolverErrorResult::from_transport(&error)
            .to_json()
            .map_err(to_napi_error);
    }

    SolverErrorResult::from_praxis(&PraxisError::IllegalOperation(
        "no method-specific execution adapter is available yet".to_string(),
    ))
    .to_json()
    .map_err(to_napi_error)
}

fn to_napi_error(error: TransportError) -> napi::Error {
    napi::Error::from_reason(error.to_string())
}
