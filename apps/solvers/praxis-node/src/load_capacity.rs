use praxis::analysis::load_capacity::{
    analyze, LoadCapacityModel, LoadCapacityResult, LoadCapacitySettings, SampleSummary,
};
use praxis::core::distribution::{AleatoryVariable, UncertainParameter, UncertainVectorParameter};
use praxis::core::distribution_sampling::{SamplingMethod, SamplingPlan};
use praxis::{PraxisError, Result};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::transport::SolverRequest;

const LOAD_CAPACITY_METHOD: &str = "LOAD_CAPACITY";

fn default_curve_points() -> usize {
    41
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LoadCapacityExecuteRequest {
    schema_version: String,
    method_type: String,
    model_id: String,
    revision: u64,
    requested_by: String,
    settings: SettingsInput,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SettingsInput {
    sampling: SamplingMethod,
    samples: usize,
    seed: u64,
    #[serde(default = "default_curve_points")]
    curve_points: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LoadCapacitySnapshot {
    id: String,
    method_type: String,
    revision: u64,
    load: AleatoryVariable,
    capacity: AleatoryVariable,
    #[serde(default)]
    unit: Option<String>,
    uncertainty_parameters: Vec<UncertainParameter>,
    uncertainty_vectors: Vec<UncertainVectorParameter>,
}

fn serialization_error(context: &str, error: impl std::fmt::Display) -> PraxisError {
    PraxisError::Serialization(format!("{context}: {error}"))
}

fn parse(request: &SolverRequest) -> Result<(LoadCapacityExecuteRequest, LoadCapacitySnapshot)> {
    let execute: LoadCapacityExecuteRequest = serde_json::from_value(request.request.clone())
        .map_err(|error| serialization_error("invalid load-capacity request", error))?;
    if execute.schema_version != request.schema_version {
        return Err(PraxisError::Version(format!(
            "load-capacity request schema version '{}' does not match solver protocol version '{}'",
            execute.schema_version, request.schema_version
        )));
    }
    if execute.method_type != LOAD_CAPACITY_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "load-capacity adapter cannot execute method '{}'",
            execute.method_type
        )));
    }
    if execute.requested_by.trim().is_empty() {
        return Err(PraxisError::Serialization(
            "load-capacity request requires requestedBy".to_string(),
        ));
    }
    let value = request
        .model_snapshots
        .iter()
        .find(|snapshot| {
            snapshot.get("id").and_then(Value::as_str) == Some(execute.model_id.as_str())
        })
        .ok_or_else(|| {
            PraxisError::Logic(format!(
                "load-capacity model snapshot '{}' is missing",
                execute.model_id
            ))
        })?;
    let snapshot: LoadCapacitySnapshot = serde_json::from_value(value.clone())
        .map_err(|error| serialization_error("invalid load-capacity model snapshot", error))?;
    if snapshot.method_type != LOAD_CAPACITY_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "load-capacity snapshot uses method '{}'",
            snapshot.method_type
        )));
    }
    if snapshot.revision != execute.revision {
        return Err(PraxisError::Version(format!(
            "load-capacity snapshot revision {} does not match requested revision {}",
            snapshot.revision, execute.revision
        )));
    }
    Ok((execute, snapshot))
}

fn model_of(snapshot: &LoadCapacitySnapshot) -> LoadCapacityModel {
    LoadCapacityModel {
        load: snapshot.load.clone(),
        capacity: snapshot.capacity.clone(),
        uncertainty_parameters: snapshot.uncertainty_parameters.clone(),
        uncertainty_vectors: snapshot.uncertainty_vectors.clone(),
    }
}

fn settings_of(settings: &SettingsInput) -> LoadCapacitySettings {
    LoadCapacitySettings {
        plan: SamplingPlan {
            method: settings.sampling,
            trials: settings.samples,
            seed: settings.seed,
        },
        curve_points: settings.curve_points,
    }
}

fn summary_json(summary: &SampleSummary) -> Value {
    json!({
        "mean": summary.mean,
        "standardDeviation": summary.standard_deviation,
        "p05": summary.p05,
        "p50": summary.p50,
        "p95": summary.p95,
        "minimum": summary.minimum,
        "maximum": summary.maximum,
    })
}

fn result_json(snapshot: &LoadCapacitySnapshot, result: &LoadCapacityResult) -> Value {
    let uncertainty = result.uncertainty.as_ref().map(|uncertainty| {
        let mut value = summary_json(&uncertainty.summary);
        value["sampling"] = json!(uncertainty.plan.method);
        value["samples"] = json!(uncertainty.plan.trials);
        value["seed"] = json!(uncertainty.plan.seed);
        value["law"] = json!(uncertainty.law);
        value
    });
    let curve: Vec<Value> = result
        .curve
        .iter()
        .map(|point| {
            let mut value = json!({ "load": point.load, "probability": point.probability });
            if let Some(band) = &point.band {
                value["mean"] = json!(band.mean);
                value["p05"] = json!(band.p05);
                value["p50"] = json!(band.p50);
                value["p95"] = json!(band.p95);
            }
            value
        })
        .collect();
    json!({
        "modelId": snapshot.id,
        "modelRevision": snapshot.revision,
        "method": result.point.method.as_str(),
        "pointProbability": result.point.probability,
        "pointLoad": result.load,
        "pointCapacity": result.capacity,
        "unit": snapshot.unit,
        "uncertainty": uncertainty,
        "curve": curve,
        "validationIssues": [],
    })
}

pub(crate) fn validate(request: &SolverRequest) -> Result<Value> {
    let (execute, snapshot) = parse(request)?;
    let mut settings = settings_of(&execute.settings);
    settings.plan.trials = 2;
    analyze(&model_of(&snapshot), &settings)?;
    Ok(json!({
        "scope": LOAD_CAPACITY_METHOD,
        "valid": true,
        "modelId": snapshot.id,
        "modelRevision": snapshot.revision,
    }))
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let (execute, snapshot) = parse(request)?;
    let result = analyze(&model_of(&snapshot), &settings_of(&execute.settings))?;
    Ok(result_json(&snapshot, &result))
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::execute;
    use crate::transport::SolverRequest;

    fn quantity(law: Value) -> Value {
        json!({ "node": "VALUE", "value": { "unit": "QUANTITY", "law": law } })
    }

    fn request(capacity: Value, parameters: Value) -> SolverRequest {
        SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": {
                    "schemaVersion": "1.0.0",
                    "methodType": "LOAD_CAPACITY",
                    "modelId": "CELL",
                    "revision": 3,
                    "requestedBy": "analyst",
                    "settings": { "sampling": "LATIN_HYPERCUBE", "samples": 2000, "seed": 847, "curvePoints": 11 }
                },
                "modelSnapshots": [{
                    "id": "CELL",
                    "methodType": "LOAD_CAPACITY",
                    "revision": 3,
                    "unit": "h",
                    "load": { "law": { "family": "LOGNORMAL", "mean": 31.0, "errorFactor": 1.5, "level": 0.95 }, "fields": [] },
                    "capacity": capacity,
                    "uncertaintyParameters": parameters,
                    "uncertaintyVectors": []
                }],
                "resources": {}
            })
            .to_string(),
        )
        .unwrap()
    }

    #[test]
    fn returns_the_exact_point_the_sampled_split_fraction_and_its_law() {
        let result = execute(&request(
            json!({
                "law": { "family": "LOGNORMAL", "mean": 48.4, "errorFactor": 1.2, "level": 0.95 },
                "fields": [{ "field": "mean", "value": quantity(json!({ "family": "LOGNORMAL", "mean": 50.0, "errorFactor": 1.6, "level": 0.95 })) }]
            }),
            json!([]),
        ))
        .unwrap();
        assert_eq!(result["method"], "CLOSED_FORM_LOGNORMAL");
        assert_eq!(result["unit"], "h");
        assert_eq!(result["pointCapacity"]["mean"], 50.0);
        let point = result["pointProbability"].as_f64().unwrap();
        assert!(point > 0.0 && point < 0.1);
        let uncertainty = &result["uncertainty"];
        assert_eq!(uncertainty["sampling"], "LATIN_HYPERCUBE");
        assert_eq!(uncertainty["samples"], 2000);
        assert!(uncertainty["p05"].as_f64().unwrap() < uncertainty["p95"].as_f64().unwrap());
        assert_eq!(uncertainty["law"]["family"], "TABULATED");
        assert_eq!(uncertainty["law"]["scale"], "LINEAR");
        assert_eq!(uncertainty["law"]["points"].as_array().unwrap().len(), 101);
        assert_eq!(result["curve"].as_array().unwrap().len(), 11);
        assert!(result["curve"][0]["p50"].is_number());
    }

    #[test]
    fn integrates_mixed_laws_shares_parameters_and_names_bad_fields() {
        let weibull = json!({ "family": "WEIBULL", "scale": 50.0, "shape": 6.0, "location": 0.0 });
        let result = execute(&request(json!({ "law": weibull, "fields": [] }), json!([]))).unwrap();
        assert_eq!(result["method"], "QUADRATURE");
        assert!(result["uncertainty"].is_null());
        let reference = json!({ "referenceType": "WORKBOOK_PARAMETER", "workbookId": "esq", "entityId": "scale" });
        let shared = execute(&request(
            json!({ "law": weibull, "fields": [{ "field": "scale", "value": { "node": "PARAMETER", "reference": reference } }] }),
            json!([{ "reference": reference, "expression": quantity(json!({ "family": "UNIFORM", "lower": 45.0, "upper": 55.0 })) }]),
        ))
        .unwrap();
        assert_eq!(shared["pointCapacity"]["scale"], 50.0);
        assert!(shared["uncertainty"]["minimum"].as_f64().unwrap() < shared["uncertainty"]["maximum"].as_f64().unwrap());
        let error = execute(&request(
            json!({ "law": weibull, "fields": [{ "field": "median", "value": quantity(json!({ "family": "POINT", "value": 48.0 })) }] }),
            json!([]),
        ))
        .unwrap_err();
        assert!(error.to_string().contains("no numeric field 'median'"), "{error}");
        assert!(execute(&request(json!({ "law": weibull, "fields": [], "distribution": {} }), json!([]))).is_err());
    }
}
