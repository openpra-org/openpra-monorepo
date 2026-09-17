//! Application failure isolation around unchanged PRAXIS batch operations.

use praxis::{PraxisError, Result};
use serde_json::{json, Value};

use crate::transport::SolverErrorResult;

/// Keep the shared-compilation path when it succeeds. After an execution error,
/// evaluate each row independently so one scenario cannot discard its peers.
/// Hazard convolution must not use this helper: its grid is one calculation.
pub(crate) fn execute<T>(
    rows: &[T],
    scenario_id: impl Fn(&T) -> &str,
    mut response: Value,
    run: impl Fn(&[T]) -> Result<Value>,
) -> Result<Value> {
    let error = match run(rows) {
        Ok(result) => return Ok(result),
        Err(error) => error,
    };
    if rows.is_empty() {
        return Err(error);
    }
    let mut results = Vec::with_capacity(rows.len());
    // Reuse the first attempt's error for a one-row batch.
    let mut single_error = (rows.len() == 1).then_some(error);
    for row in rows {
        let outcome = match single_error.take() {
            Some(error) => Err(error),
            None => run(std::slice::from_ref(row)),
        };
        let result = match outcome {
            Ok(mut result) => {
                let mut returned = result["batchResults"].take();
                let values = returned.as_array_mut().ok_or_else(|| {
                    PraxisError::Logic("isolated HCL scenario returned no batch results".into())
                })?;
                if values.len() != 1 || values[0]["scenarioId"] != scenario_id(row) {
                    return Err(PraxisError::Logic(
                        "isolated HCL scenario returned an unexpected result".into(),
                    ));
                }
                values.remove(0)
            }
            Err(error) => {
                let mut error = serde_json::to_value(SolverErrorResult::from_praxis(&error))
                    .map_err(|error| PraxisError::Serialization(error.to_string()))?;
                json!({
                    "scenarioId": scenario_id(row),
                    "status": "FAILED",
                    "failure": error["error"].take(),
                })
            }
        };
        results.push(result);
    }
    response["batchResults"] = json!(results);
    // A failed compilation/evaluation does not report its work counts, so the
    // fallback cannot truthfully publish shared-compilation diagnostics.
    Ok(response)
}
