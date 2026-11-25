use std::collections::HashMap;

use praxis::analysis::sequence_dependency_cut_sets::{
    rank_base_event_tree_dependency_cut_sets, rank_event_tree_dependency_cut_sets,
    DependencyCutSetScore, DependencyCutSetSettings, RankedCutSet, SequenceRankedCutSets,
};
use praxis::{PraxisError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::{
    batch_evidence_specs, hazard_evidence_specs, EventTreeAdapter, EventTreeEvidenceRow,
    EventTreeExecutionMode,
};

const MAX_KEEP: usize = 10_000;
const MAX_CAUSES: usize = 100;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(super) enum ScoreInput {
    FailedEvents,
    FailedEventsAndSequence,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct DependencyCutSetsInput {
    score: ScoreInput,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    limit_order: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    cut_off: Option<f64>,
    keep: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    causes: Option<usize>,
}

impl DependencyCutSetsInput {
    fn settings(&self) -> DependencyCutSetSettings {
        DependencyCutSetSettings {
            score: match self.score {
                ScoreInput::FailedEvents => DependencyCutSetScore::FailedEvents,
                ScoreInput::FailedEventsAndSequence => {
                    DependencyCutSetScore::FailedEventsAndSequence
                }
            },
            limit_order: self.limit_order,
            cut_off: self.cut_off,
            keep: self.keep,
            causes: self.causes.unwrap_or(0),
        }
    }

    pub(super) fn validate(&self, mode: EventTreeExecutionMode, point: bool) -> Result<()> {
        if !matches!(mode, EventTreeExecutionMode::HybridCausalLogic) || !point {
            return Err(PraxisError::Settings(
                "Ranked cut sets under dependencies are available for dependency probability runs."
                    .into(),
            ));
        }
        self.settings().validate()?;
        if self.keep > MAX_KEEP {
            return Err(PraxisError::Settings(format!(
                "cut sets kept per sequence must be between 1 and {MAX_KEEP}"
            )));
        }
        if self.causes.is_some_and(|causes| causes == 0 || causes > MAX_CAUSES) {
            return Err(PraxisError::Settings(format!(
                "causes listed per cut set must be between 1 and {MAX_CAUSES}"
            )));
        }
        Ok(())
    }
}

fn causes_json(cut_set: &RankedCutSet) -> Value {
    cut_set
        .causes
        .iter()
        .map(|cause| {
            json!({
                "nodeId": cause.node,
                "stateId": cause.state,
                "baseline": cause.baseline,
                "withCutSet": cause.with_cut_set,
                "shift": cause.distance,
            })
        })
        .collect()
}

fn ranked_json(
    input: &DependencyCutSetsInput,
    ranked: &SequenceRankedCutSets,
    probability_scale: f64,
    annual_scale: f64,
    traced: bool,
) -> Value {
    let items: Vec<Value> = ranked
        .cut_sets
        .iter()
        .map(|cut_set| {
            let probability = cut_set.probability * probability_scale;
            let mut item = json!({
                "order": cut_set.events.len(),
                "basicEventIds": cut_set.events,
                "probability": probability,
                "annualFrequency": probability * annual_scale,
            });
            if traced {
                item["causes"] = causes_json(cut_set);
            }
            item
        })
        .collect();
    json!({ "score": input.score, "count": ranked.total, "items": items })
}

fn attach(
    sequences: &mut Value,
    input: &DependencyCutSetsInput,
    ranked: &[SequenceRankedCutSets],
    probability_scale: f64,
    annual_scale: f64,
    traced: bool,
) -> Result<()> {
    let by_sequence: HashMap<&str, &SequenceRankedCutSets> = ranked
        .iter()
        .map(|entry| (entry.sequence_id.as_str(), entry))
        .collect();
    let rows = sequences.as_array_mut().ok_or_else(|| {
        PraxisError::Logic("a dependency result holds no sequence list".to_string())
    })?;
    for row in rows {
        let id = row["sequenceId"].as_str().unwrap_or_default().to_string();
        let entry = by_sequence.get(id.as_str()).ok_or_else(|| {
            PraxisError::Logic(format!("sequence '{id}' has no ranked cut sets"))
        })?;
        row["dependencyCutSets"] = ranked_json(input, entry, probability_scale, annual_scale, traced);
    }
    Ok(())
}

pub(super) fn attach_to_result(
    adapter: &EventTreeAdapter,
    input: &DependencyCutSetsInput,
    value: &mut Value,
) -> Result<()> {
    let context = adapter.hcl_context.as_ref().ok_or_else(|| {
        PraxisError::Hcl("ranked cut sets need a dependency configuration".to_string())
    })?;
    let ranking = rank_base_event_tree_dependency_cut_sets(
        &adapter.model,
        &adapter.event_tree,
        context,
        &input.settings(),
    )?;
    let ranked = ranking.scenarios.first().ok_or_else(|| {
        PraxisError::Logic("the base evidence produced no ranked cut sets".to_string())
    })?;
    attach(
        &mut value["sequences"],
        input,
        ranked,
        1.0,
        adapter.initiating_event_frequency,
        input.causes.is_some(),
    )
}

pub(super) fn attach_to_batch(
    adapter: &EventTreeAdapter,
    input: &DependencyCutSetsInput,
    rows: &[EventTreeEvidenceRow],
    response: &mut Value,
) -> Result<()> {
    let context = adapter.hcl_context.as_ref().ok_or_else(|| {
        PraxisError::Hcl("ranked cut sets need a dependency configuration".to_string())
    })?;
    let evidence = batch_evidence_specs(rows);
    let assignments = adapter
        .hazard_convolution
        .as_ref()
        .map(|_| hazard_evidence_specs(rows));
    let ranking = rank_event_tree_dependency_cut_sets(
        &adapter.model,
        &adapter.event_tree,
        context,
        &evidence,
        assignments.as_deref(),
        &input.settings(),
    )?;
    let results = response["batchResults"].as_array_mut().ok_or_else(|| {
        PraxisError::Logic("a dependency batch holds no scenario results".to_string())
    })?;
    for (ranked, &index) in ranking.scenarios.iter().zip(&ranking.scenario_indices) {
        let result = results.get_mut(index).ok_or_else(|| {
            PraxisError::Logic("a ranked scenario is missing from the batch".to_string())
        })?;
        attach(
            &mut result["sequences"],
            input,
            ranked,
            1.0,
            adapter.initiating_event_frequency,
            input.causes.is_some(),
        )?;
    }
    if let Some(weighted) = &ranking.weighted {
        let hazard = &mut response["hazardConvolution"];
        let normalize = hazard["normalizeWeights"].as_bool().unwrap_or(false);
        let raw_sum = hazard["rawWeightSum"].as_f64().unwrap_or(0.0);
        let annual_scale = hazard["annualizedFrequencyScale"].as_f64().unwrap_or(0.0);
        let probability_scale = if normalize && raw_sum > 0.0 {
            1.0 / raw_sum
        } else {
            1.0
        };
        attach(
            &mut hazard["sequences"],
            input,
            weighted,
            probability_scale,
            annual_scale,
            false,
        )?;
    }
    Ok(())
}
