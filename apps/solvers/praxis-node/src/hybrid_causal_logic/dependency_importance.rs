use praxis::hcl::{
    hcl_importance, hcl_importance_batch, hcl_sampled_hazard_weights,
    hcl_sampled_importance_batch, sampled_hazard_convolution, HclBatchResult, HclEvidenceSpec,
};
use praxis::{PraxisError, Result};
use serde_json::Value;

use super::{batch_evidence_specs, hazard_evidence_specs, HclAdapter, HclEvidenceRow};
use crate::dependency_importance::{importance_json, sampled_hazard_json, sampled_importance_json};

pub(super) fn validate(point: bool, events: Option<usize>, hazard: bool) -> Result<()> {
    crate::dependency_importance::sampled_events(point, events)?;
    if !point && hazard {
        return Err(PraxisError::Settings(
            "Importance over a hazard grid is available for probability runs.".into(),
        ));
    }
    Ok(())
}

pub(super) fn attach_sampled(
    adapter: &HclAdapter,
    events: usize,
    evidence: &[Vec<HclEvidenceSpec>],
    results: &mut [Value],
    positions: &[usize],
) -> Result<()> {
    let run = hcl_sampled_importance_batch(&adapter.model, evidence, &adapter.settings, events)?;
    for (scenario, &index) in run.scenarios.iter().zip(&run.scenario_indices) {
        let position = positions.get(index).copied().ok_or_else(|| {
            PraxisError::Logic("an importance scenario is missing from the batch".to_string())
        })?;
        let result = results.get_mut(position).ok_or_else(|| {
            PraxisError::Logic("an importance scenario is missing from the batch".to_string())
        })?;
        if result["probability"].is_number() {
            result["dependencyImportance"] =
                sampled_importance_json(&scenario.point, &scenario.leading, &scenario.sampled);
        }
    }
    Ok(())
}

pub(super) fn attach_sampled_hazard(
    adapter: &HclAdapter,
    rows: &[HclEvidenceRow],
    batch: &HclBatchResult,
    response: &mut Value,
) -> Result<()> {
    let Some(uncertainty) = adapter.settings.uncertainty.as_ref() else {
        return Ok(());
    };
    let weights = hcl_sampled_hazard_weights(
        &adapter.model,
        &batch_evidence_specs(rows),
        &hazard_evidence_specs(rows),
        &adapter.settings,
    )?;
    let mut values: Vec<&[f64]> = Vec::with_capacity(batch.results.len());
    for result in &batch.results {
        values.push(result.uncertainty_samples.as_deref().ok_or_else(|| {
            PraxisError::Logic("a sampled hazard row holds no samples".to_string())
        })?);
    }
    let hazard = &mut response["hazardConvolution"];
    let normalize = hazard["normalizeWeights"].as_bool().unwrap_or(false);
    let scale = hazard["annualizedFrequencyScale"].as_f64().unwrap_or(0.0);
    let convolved =
        sampled_hazard_convolution(&weights, &batch.scenario_indices, &values, normalize)?;
    hazard["uncertainty"] = sampled_hazard_json(&convolved, scale, uncertainty.seed)?;
    Ok(())
}

pub(super) fn attach_to_result(adapter: &HclAdapter, value: &mut Value) -> Result<()> {
    let run = hcl_importance(&adapter.model, &adapter.settings)?;
    let scenario = run.scenarios.first().ok_or_else(|| {
        PraxisError::Logic("the base evidence produced no importance".to_string())
    })?;
    value["dependencyImportance"] = importance_json(scenario);
    Ok(())
}

pub(super) fn attach_to_batch(
    adapter: &HclAdapter,
    rows: &[HclEvidenceRow],
    response: &mut Value,
) -> Result<()> {
    let evidence = batch_evidence_specs(rows);
    let assignments = adapter
        .hazard_convolution
        .as_ref()
        .map(|_| hazard_evidence_specs(rows));
    let run = hcl_importance_batch(
        &adapter.model,
        &evidence,
        assignments.as_deref(),
        &adapter.settings,
    )?;
    let results = response["batchResults"].as_array_mut().ok_or_else(|| {
        PraxisError::Logic("a dependency batch holds no scenario results".to_string())
    })?;
    for (scenario, &index) in run.scenarios.iter().zip(&run.scenario_indices) {
        let result = results.get_mut(index).ok_or_else(|| {
            PraxisError::Logic("an importance scenario is missing from the batch".to_string())
        })?;
        result["dependencyImportance"] = importance_json(scenario);
    }
    if let Some(weighted) = &run.weighted {
        response["hazardConvolution"]["dependencyImportance"] = importance_json(weighted);
    }
    Ok(())
}
