use praxis::hcl::{generate_hazard_sweep_scenarios, HazardSweepSpec};
use praxis::{PraxisError, Result};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::transport::SolverRequest;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GenerateRequest {
    schema_version: String,
    method_type: String,
    operation: String,
    model_id: String,
    revision: u64,
    requested_by: String,
    bayesian_network_model_id: String,
    spec: HazardSweepSpec,
}

fn parse(envelope: &SolverRequest) -> Result<GenerateRequest> {
    let request: GenerateRequest = serde_json::from_value(envelope.request.clone())
        .map_err(|e| PraxisError::Hcl(format!("Invalid hazard sweep request: {e}")))?;
    if request.schema_version != "1.0.0"
        || request.method_type != "HYBRID_CAUSAL_LOGIC"
        || request.operation != "GENERATE_SCENARIOS"
        || request.model_id.is_empty()
        || request.requested_by.is_empty()
    {
        return Err(PraxisError::Hcl(
            "Invalid hazard sweep request identity".into(),
        ));
    }
    let _revision = request.revision;
    let models: Vec<_> = envelope
        .model_snapshots
        .iter()
        .filter(|snapshot| {
            snapshot["id"] == request.bayesian_network_model_id
                && snapshot["methodType"] == "BAYESIAN_NETWORK"
        })
        .collect();
    if models.len() != 1 {
        return Err(PraxisError::Hcl(
            "Hazard sweep requires exactly one referenced BN snapshot".into(),
        ));
    }
    let nodes = models[0]["nodes"]
        .as_array()
        .ok_or_else(|| PraxisError::Hcl("Hazard sweep BN snapshot has no nodes".into()))?;
    for dim in &request.spec.dimensions {
        let node = nodes
            .iter()
            .find(|n| n["id"] == dim.bn_node)
            .ok_or_else(|| PraxisError::Hcl(format!("Unknown hazard BN node '{}'", dim.bn_node)))?;
        let states = node["states"]
            .as_array()
            .ok_or_else(|| PraxisError::Hcl("Hazard BN node has no states".into()))?;
        if dim
            .states
            .iter()
            .any(|id| !states.iter().any(|s| s["id"] == *id))
        {
            return Err(PraxisError::Hcl(format!(
                "Unknown state for hazard BN node '{}'",
                dim.bn_node
            )));
        }
    }
    request.spec.validate()?;
    Ok(request)
}

pub(crate) fn validate(envelope: &SolverRequest) -> Result<Value> {
    parse(envelope)?;
    Ok(json!({ "valid": true, "scope": "HAZARD_SWEEP" }))
}

pub(crate) fn execute(envelope: &SolverRequest) -> Result<Value> {
    let request = parse(envelope)?;
    Ok(json!({ "scenarios": generate_hazard_sweep_scenarios(&request.spec)? }))
}
