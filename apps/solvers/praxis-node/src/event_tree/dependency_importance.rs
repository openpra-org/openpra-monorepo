use praxis::analysis::event_tree_quantification::{
    event_tree_sampled_hazard_weights, EventTreeBatchQuantification, EventTreeUnion,
};
use praxis::analysis::sequence_dependency_importance::{
    base_event_tree_dependency_importance, event_tree_dependency_importance,
    event_tree_sampled_importance, sum_of, DependencyImportance, SampledScenarioImportance,
    SequenceConditionals,
};
use praxis::hcl::sampled_hazard_convolution;
use praxis::{PraxisError, Result};
use serde_json::Value;

use super::{
    batch_evidence_specs, hazard_evidence_specs, EventTreeAdapter, EventTreeEvidenceRow,
    EventTreeExecutionMode,
};
use crate::dependency_importance::{importance_json, sampled_hazard_json, sampled_importance_json};

pub(super) fn validate(
    mode: EventTreeExecutionMode,
    point: bool,
    events: Option<usize>,
    hazard: bool,
) -> Result<()> {
    if !matches!(mode, EventTreeExecutionMode::HybridCausalLogic) {
        return Err(PraxisError::Settings(
            "Importance under dependencies is available for dependency runs.".into(),
        ));
    }
    crate::dependency_importance::sampled_events(point, events)?;
    if !point && hazard {
        return Err(PraxisError::Settings(
            "Importance over a hazard grid is available for probability runs.".into(),
        ));
    }
    Ok(())
}

fn groups_of(sequences: &[Value]) -> Vec<EventTreeUnion> {
    let mut groups: Vec<EventTreeUnion> = Vec::new();
    for (end_state, sequence) in end_state_sequences(sequences) {
        match groups.iter_mut().find(|group| group.id == end_state) {
            Some(group) => group.sequence_ids.push(sequence),
            None => groups.push(EventTreeUnion {
                id: end_state,
                sequence_ids: vec![sequence],
            }),
        }
    }
    groups
}

fn attach_sampled(result: &mut Value, scenario: &SampledScenarioImportance) -> Result<()> {
    for row in rows_of(result, "sequences")?.iter_mut() {
        let id = row["sequenceId"].as_str().unwrap_or_default().to_string();
        let entry = scenario
            .sequences
            .iter()
            .find(|candidate| candidate.id == id)
            .ok_or_else(|| PraxisError::Logic(format!("sequence '{id}' has no importance")))?;
        row["dependencyImportance"] =
            sampled_importance_json(&entry.point, &entry.leading, &entry.sampled);
    }
    for row in rows_of(result, "endStateAggregates")?.iter_mut() {
        let id = row["endStateId"].as_str().unwrap_or_default().to_string();
        if let Some(entry) = scenario.groups.iter().find(|candidate| candidate.id == id) {
            row["dependencyImportance"] =
                sampled_importance_json(&entry.point, &entry.leading, &entry.sampled);
        }
    }
    Ok(())
}

pub(super) fn attach_sampled_to_result(
    adapter: &EventTreeAdapter,
    events: usize,
    value: &mut Value,
) -> Result<()> {
    let hcl = context(adapter)?;
    let groups = groups_of(rows_of(value, "sequences")?);
    let rows = [hcl_base_evidence(adapter)?];
    let run = event_tree_sampled_importance(
        &adapter.model,
        &adapter.event_tree,
        hcl,
        &rows,
        &groups,
        events,
    )?;
    let scenario = run.scenarios.first().ok_or_else(|| {
        PraxisError::Logic("the base evidence produced no importance".to_string())
    })?;
    attach_sampled(value, scenario)
}

pub(super) fn attach_sampled_to_batch(
    adapter: &EventTreeAdapter,
    events: usize,
    rows: &[EventTreeEvidenceRow],
    response: &mut Value,
) -> Result<()> {
    let evidence = batch_evidence_specs(rows);
    let results = rows_of(response, "batchResults")?;
    let groups = match results.iter_mut().find(|result| result["sequences"].is_array()) {
        Some(result) => groups_of(rows_of(result, "sequences")?),
        None => return Ok(()),
    };
    let run = event_tree_sampled_importance(
        &adapter.model,
        &adapter.event_tree,
        context(adapter)?,
        &evidence,
        &groups,
        events,
    )?;
    for (scenario, &index) in run.scenarios.iter().zip(&run.scenario_indices) {
        let result = results.get_mut(index).ok_or_else(|| {
            PraxisError::Logic("an importance scenario is missing from the batch".to_string())
        })?;
        if result["sequences"].is_array() {
            attach_sampled(result, scenario)?;
        }
    }
    Ok(())
}

pub(super) fn attach_sampled_hazard(
    adapter: &EventTreeAdapter,
    rows: &[EventTreeEvidenceRow],
    batch: &EventTreeBatchQuantification,
    response: &mut Value,
) -> Result<()> {
    let hcl = context(adapter)?;
    let Some(uncertainty) = hcl.uncertainty() else {
        return Ok(());
    };
    let seed = uncertainty.seed;
    let weights = event_tree_sampled_hazard_weights(
        &adapter.model,
        hcl,
        &batch_evidence_specs(rows),
        &hazard_evidence_specs(rows),
    )?;
    let hazard = &mut response["hazardConvolution"];
    let normalize = hazard["normalizeWeights"].as_bool().unwrap_or(false);
    let scale = hazard["annualizedFrequencyScale"].as_f64().unwrap_or(0.0);
    let convolve = |id: &str, scenarios: &[Vec<praxis::analysis::event_tree_quantification::EventTreeSequenceProbability>]| -> Result<Option<Value>> {
        let mut values: Vec<&[f64]> = Vec::with_capacity(scenarios.len());
        for scenario in scenarios {
            let Some(samples) = scenario
                .iter()
                .find(|entry| entry.sequence_id == id)
                .and_then(|entry| entry.uncertainty_samples.as_deref())
            else {
                return Ok(None);
            };
            values.push(samples);
        }
        let convolved =
            sampled_hazard_convolution(&weights, &batch.scenario_indices, &values, normalize)?;
        sampled_hazard_json(&convolved, scale, seed).map(Some)
    };
    for row in rows_of(hazard, "sequences")?.iter_mut() {
        let id = row["sequenceId"].as_str().unwrap_or_default().to_string();
        if let Some(summary) = convolve(&id, &batch.scenarios)? {
            row["uncertainty"] = summary;
        }
    }
    for row in rows_of(hazard, "endStateAggregates")?.iter_mut() {
        let id = row["endStateId"].as_str().unwrap_or_default().to_string();
        if let Some(summary) = convolve(&id, &batch.unions)? {
            row["uncertainty"] = summary;
        }
    }
    Ok(())
}

fn hcl_base_evidence(adapter: &EventTreeAdapter) -> Result<Vec<praxis::hcl::HclEvidenceSpec>> {
    Ok(context(adapter)?.base_evidence_specs().to_vec())
}

fn rows_of<'a>(value: &'a mut Value, key: &str) -> Result<&'a mut Vec<Value>> {
    value[key]
        .as_array_mut()
        .ok_or_else(|| PraxisError::Logic(format!("a dependency result holds no {key} list")))
}

fn end_state_sequences(sequences: &[Value]) -> Vec<(String, String)> {
    sequences
        .iter()
        .filter_map(|row| {
            let sequence = row["sequenceId"].as_str()?;
            let end_state = row["result"]["endStateId"].as_str()?;
            Some((end_state.to_string(), sequence.to_string()))
        })
        .collect()
}

fn members<'a>(groups: &'a [(String, String)], end_state: &str) -> Vec<&'a str> {
    groups
        .iter()
        .filter(|(state, _)| state == end_state)
        .map(|(_, sequence)| sequence.as_str())
        .collect()
}

fn attach(result: &mut Value, scenario: &[SequenceConditionals]) -> Result<Vec<(String, String)>> {
    let sequences = rows_of(result, "sequences")?;
    let groups = end_state_sequences(sequences);
    for row in sequences.iter_mut() {
        let id = row["sequenceId"].as_str().unwrap_or_default().to_string();
        let entry = scenario
            .iter()
            .find(|candidate| candidate.sequence_id == id)
            .ok_or_else(|| PraxisError::Logic(format!("sequence '{id}' has no importance")))?;
        row["dependencyImportance"] = importance_json(&entry.conditionals);
    }
    for row in rows_of(result, "endStateAggregates")?.iter_mut() {
        let id = row["endStateId"].as_str().unwrap_or_default().to_string();
        row["dependencyImportance"] = importance_json(&sum_of(scenario, &members(&groups, &id)));
    }
    Ok(groups)
}

fn context(adapter: &EventTreeAdapter) -> Result<&super::EventTreeHclContext> {
    adapter.hcl_context.as_ref().ok_or_else(|| {
        PraxisError::Hcl("importance under dependencies needs a dependency configuration".to_string())
    })
}

pub(super) fn attach_to_result(adapter: &EventTreeAdapter, value: &mut Value) -> Result<()> {
    let run = base_event_tree_dependency_importance(
        &adapter.model,
        &adapter.event_tree,
        context(adapter)?,
    )?;
    let scenario = run.scenarios.first().ok_or_else(|| {
        PraxisError::Logic("the base evidence produced no importance".to_string())
    })?;
    attach(value, scenario).map(|_| ())
}

fn attach_weighted(hazard: &mut Value, run: &DependencyImportance, groups: &[(String, String)]) -> Result<()> {
    for row in rows_of(hazard, "sequences")?.iter_mut() {
        let id = row["sequenceId"].as_str().unwrap_or_default().to_string();
        if let Some(mixed) = run.weighted(&[id.as_str()]) {
            row["dependencyImportance"] = importance_json(&mixed);
        }
    }
    for row in rows_of(hazard, "endStateAggregates")?.iter_mut() {
        let id = row["endStateId"].as_str().unwrap_or_default().to_string();
        if let Some(mixed) = run.weighted(&members(groups, &id)) {
            row["dependencyImportance"] = importance_json(&mixed);
        }
    }
    Ok(())
}

pub(super) fn attach_to_batch(
    adapter: &EventTreeAdapter,
    rows: &[EventTreeEvidenceRow],
    response: &mut Value,
) -> Result<()> {
    let evidence = batch_evidence_specs(rows);
    let assignments = adapter
        .hazard_convolution
        .as_ref()
        .map(|_| hazard_evidence_specs(rows));
    let run = event_tree_dependency_importance(
        &adapter.model,
        &adapter.event_tree,
        context(adapter)?,
        &evidence,
        assignments.as_deref(),
    )?;
    let results = rows_of(response, "batchResults")?;
    let mut groups = Vec::new();
    for (scenario, &index) in run.scenarios.iter().zip(&run.scenario_indices) {
        let result = results.get_mut(index).ok_or_else(|| {
            PraxisError::Logic("an importance scenario is missing from the batch".to_string())
        })?;
        groups = attach(result, scenario)?;
    }
    if run.raw_weights.is_some() && !run.scenarios.is_empty() {
        attach_weighted(&mut response["hazardConvolution"], &run, &groups)?;
    }
    Ok(())
}
