use napi::bindgen_prelude::{Object, Result};
use napi_derive::napi;
use praxis::PraxisError;
use serde_json::json;

mod bayesian_network;
mod event_tree;
mod fault_tree;
mod hybrid_causal_logic;
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
        Ok(request) => {
            let result = match request.request["methodType"].as_str() {
                Some("FAULT_TREE") => fault_tree::validate(&request),
                Some("BAYESIAN_NETWORK") => bayesian_network::validate(&request),
                Some("EVENT_TREE") => event_tree::validate(&request),
                Some("HYBRID_CAUSAL_LOGIC") => hybrid_causal_logic::validate(&request),
                _ => Ok(json!({
                    "scope": "TRANSPORT",
                    "valid": true,
                    "modelSnapshotCount": request.model_snapshots.len()
                })),
            };
            match result {
                Ok(result) => SolverResult::new(result).to_json().map_err(to_napi_error),
                Err(error) => SolverErrorResult::from_praxis(&error)
                    .to_json()
                    .map_err(to_napi_error),
            }
        }
        Err(error) => SolverErrorResult::from_transport(&error)
            .to_json()
            .map_err(to_napi_error),
    }
}

/// Execute a versioned solver request through its method-specific adapter.
#[napi]
pub fn execute(request_json: String) -> Result<String> {
    match SolverRequest::from_json(&request_json) {
        Ok(request) => {
            let result = match request.request["methodType"].as_str() {
                Some("FAULT_TREE") => fault_tree::execute(&request),
                Some("BAYESIAN_NETWORK") => bayesian_network::execute(&request),
                Some("EVENT_TREE") => event_tree::execute(&request),
                Some("HYBRID_CAUSAL_LOGIC") => hybrid_causal_logic::execute(&request),
                _ => Err(PraxisError::IllegalOperation(
                    "no method-specific execution adapter is available yet".to_string(),
                )),
            };
            match result {
                Ok(result) => SolverResult::new(result).to_json().map_err(to_napi_error),
                Err(error) => SolverErrorResult::from_praxis(&error)
                    .to_json()
                    .map_err(to_napi_error),
            }
        }
        Err(error) => SolverErrorResult::from_transport(&error)
            .to_json()
            .map_err(to_napi_error),
    }
}

fn to_napi_error(error: TransportError) -> napi::Error {
    napi::Error::from_reason(error.to_string())
}
