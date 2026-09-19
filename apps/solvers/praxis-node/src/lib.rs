use napi::bindgen_prelude::{Object, Result};
use napi_derive::napi;
use praxis::PraxisError;

mod bayesian_network;
mod diagnostics;
mod event_tree;
mod evidence_batch;
mod fault_tree;
mod hazard_sweep;
mod hybrid_causal_logic;
mod resource_preflight;
mod transport;

use transport::{SolverErrorResult, SolverRequest, SolverResult, TransportError};

/// Report the largest planned dense Bayesian clique table before inference.
/// This is a per-table requirement, not a total-memory estimate or reservation.
#[napi]
pub fn preflight(request_json: String, operation: String) -> Result<String> {
    let request = match SolverRequest::from_json(&request_json) {
        Ok(request) => request,
        Err(error) => {
            return SolverErrorResult::from_transport(&error)
                .to_json()
                .map_err(to_napi_error)
        }
    };
    let executing = match operation.as_str() {
        "execute" => true,
        "validate" => false,
        _ => {
            return Err(napi::Error::from_reason(
                "Invalid PRAXIS preflight operation",
            ))
        }
    };
    let result = match request.request["methodType"].as_str() {
        Some("BAYESIAN_NETWORK") => bayesian_network::preflight(&request, executing),
        Some("HYBRID_CAUSAL_LOGIC") => hybrid_causal_logic::preflight(&request, executing),
        Some("EVENT_TREE") => event_tree::preflight(&request, executing),
        _ => Ok(resource_preflight::no_clique()),
    };
    match result {
        Ok(result) => SolverResult::new(result).to_json().map_err(to_napi_error),
        Err(error) => SolverErrorResult::from_praxis(&error)
            .to_json()
            .map_err(to_napi_error),
    }
}

/// Initialize the native module; public operations are exported below.
#[napi(module_exports)]
pub fn initialize(_exports: Object) -> Result<()> {
    Ok(())
}

/// Validate the versioned request and its method-specific model.
#[napi]
pub fn validate(request_json: String) -> Result<String> {
    match SolverRequest::from_json(&request_json) {
        Ok(request) => {
            let result = match request.request["methodType"].as_str() {
                Some("FAULT_TREE") => fault_tree::validate(&request),
                Some("BAYESIAN_NETWORK") => bayesian_network::validate(&request),
                Some("EVENT_TREE") => event_tree::validate(&request),
                Some("HYBRID_CAUSAL_LOGIC") => hybrid_causal_logic::validate(&request),
                _ => Err(PraxisError::IllegalOperation(
                    "unsupported solver method".to_string(),
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
                    "unsupported solver method".to_string(),
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
