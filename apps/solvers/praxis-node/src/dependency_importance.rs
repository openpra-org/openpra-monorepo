use praxis::hcl::{
    EventImportance, HclUncertaintySummary, MeasureSummary, SampledTarget, TargetConditionals,
};
use praxis::{PraxisError, Result};
use serde_json::{json, Value};

pub(crate) const MAX_SAMPLED_EVENTS: usize = 100;

pub(crate) fn sampled_events(point: bool, events: Option<usize>) -> Result<Option<usize>> {
    match (point, events) {
        (true, _) => Ok(None),
        (false, Some(events)) if (1..=MAX_SAMPLED_EVENTS).contains(&events) => Ok(Some(events)),
        (false, _) => Err(PraxisError::Settings(format!(
            "Importance under uncertainty needs the number of events to sample, between 1 and {MAX_SAMPLED_EVENTS}."
        ))),
    }
}

pub(crate) fn importance_json(conditionals: &TargetConditionals) -> Value {
    conditionals
        .measures()
        .iter()
        .map(|row: &EventImportance| {
            json!({
                "basicEventId": row.event,
                "probability": row.probability,
                "occurred": row.occurred,
                "notOccurred": row.not_occurred,
                "birnbaum": row.birnbaum,
                "riskAchievementWorth": row.risk_achievement_worth,
                "riskReductionWorth": row.risk_reduction_worth,
                "fussellVesely": row.fussell_vesely,
                "criticality": row.criticality,
            })
        })
        .collect()
}

fn summary_json(summary: Option<MeasureSummary>) -> Value {
    match summary {
        Some(summary) => json!({
            "sampleCount": summary.sample_count,
            "mean": summary.mean,
            "percentile05": summary.percentile_05,
            "median": summary.median,
            "percentile95": summary.percentile_95,
        }),
        None => Value::Null,
    }
}

pub(crate) fn sampled_importance_json(
    point: &TargetConditionals,
    leading: &[String],
    sampled: &SampledTarget,
) -> Value {
    let mut rows = importance_json(point);
    let measures = sampled.measures(leading);
    if let Some(rows) = rows.as_array_mut() {
        for row in rows {
            let Some(measure) = measures
                .iter()
                .find(|measure| Some(measure.event.as_str()) == row["basicEventId"].as_str())
            else {
                continue;
            };
            row["uncertainty"] = json!({
                "birnbaum": summary_json(measure.birnbaum),
                "riskAchievementWorth": summary_json(measure.risk_achievement_worth),
                "riskReductionWorth": summary_json(measure.risk_reduction_worth),
                "fussellVesely": summary_json(measure.fussell_vesely),
                "criticality": summary_json(measure.criticality),
            });
        }
    }
    rows
}

pub(crate) fn sampled_hazard_json(convolved: &[f64], annual_scale: f64, seed: u64) -> Result<Value> {
    let clamped: Vec<f64> = convolved.iter().map(|value| value.max(0.0)).collect();
    let annual: Vec<f64> = clamped.iter().map(|value| value * annual_scale).collect();
    Ok(json!({
        "convolvedProbability": HclUncertaintySummary::from_samples(&clamped, seed)?,
        "integratedAnnualFrequency": HclUncertaintySummary::from_frequency_samples(&annual, seed)?,
    }))
}
