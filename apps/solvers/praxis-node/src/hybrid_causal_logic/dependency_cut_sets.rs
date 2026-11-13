use praxis::analysis::sequence_dependency_cut_sets::{
    DependencyCutSetScore, DependencyCutSetSettings,
};
use praxis::hcl::{rank_hcl_cut_sets, rank_hcl_cut_sets_batch, FaultTreeRankedCutSets};
use praxis::{PraxisError, Result};
use serde::Deserialize;
use serde_json::{json, Value};

use super::{batch_evidence_specs, hazard_evidence_specs, HclAdapter, HclEvidenceRow};

const MAX_KEEP: usize = 10_000;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct FaultTreeCutSetsInput {
    #[serde(default)]
    limit_order: Option<usize>,
    #[serde(default)]
    cut_off: Option<f64>,
    keep: usize,
}

impl FaultTreeCutSetsInput {
    fn settings(&self) -> DependencyCutSetSettings {
        DependencyCutSetSettings {
            score: DependencyCutSetScore::FailedEvents,
            limit_order: self.limit_order,
            cut_off: self.cut_off,
            keep: self.keep,
        }
    }

    pub(super) fn validate(&self, point: bool) -> Result<()> {
        if !point {
            return Err(PraxisError::Settings(
                "Ranked cut sets under dependencies are available for dependency probability runs."
                    .into(),
            ));
        }
        self.settings().validate()?;
        if self.keep > MAX_KEEP {
            return Err(PraxisError::Settings(format!(
                "cut sets kept must be between 1 and {MAX_KEEP}"
            )));
        }
        Ok(())
    }
}

fn ranked_json(ranked: &FaultTreeRankedCutSets, probability_scale: f64) -> Value {
    let items: Vec<Value> = ranked
        .cut_sets
        .iter()
        .map(|cut_set| {
            json!({
                "order": cut_set.events.len(),
                "basicEventIds": cut_set.events,
                "probability": cut_set.probability * probability_scale,
            })
        })
        .collect();
    json!({ "count": ranked.total, "items": items })
}

pub(super) fn attach_to_result(
    adapter: &HclAdapter,
    input: &FaultTreeCutSetsInput,
    value: &mut Value,
) -> Result<()> {
    let ranking = rank_hcl_cut_sets(&adapter.model, &adapter.settings, &input.settings())?;
    let ranked = ranking.scenarios.first().ok_or_else(|| {
        PraxisError::Logic("the base evidence produced no ranked cut sets".to_string())
    })?;
    value["dependencyCutSets"] = ranked_json(ranked, 1.0);
    Ok(())
}

pub(super) fn attach_to_batch(
    adapter: &HclAdapter,
    input: &FaultTreeCutSetsInput,
    rows: &[HclEvidenceRow],
    response: &mut Value,
) -> Result<()> {
    let evidence = batch_evidence_specs(rows);
    let assignments = adapter
        .hazard_convolution
        .as_ref()
        .map(|_| hazard_evidence_specs(rows));
    let ranking = rank_hcl_cut_sets_batch(
        &adapter.model,
        &evidence,
        assignments.as_deref(),
        &adapter.settings,
        &input.settings(),
    )?;
    let results = response["batchResults"].as_array_mut().ok_or_else(|| {
        PraxisError::Logic("a dependency batch holds no scenario results".to_string())
    })?;
    for (ranked, &index) in ranking.scenarios.iter().zip(&ranking.scenario_indices) {
        let result = results.get_mut(index).ok_or_else(|| {
            PraxisError::Logic("a ranked scenario is missing from the batch".to_string())
        })?;
        result["dependencyCutSets"] = ranked_json(ranked, 1.0);
    }
    if let Some(weighted) = &ranking.weighted {
        let hazard = &mut response["hazardConvolution"];
        let normalize = hazard["normalizeWeights"].as_bool().unwrap_or(false);
        let raw_sum = hazard["rawWeightSum"].as_f64().unwrap_or(0.0);
        let probability_scale = if normalize && raw_sum > 0.0 {
            1.0 / raw_sum
        } else {
            1.0
        };
        hazard["dependencyCutSets"] = ranked_json(weighted, probability_scale);
    }
    Ok(())
}
