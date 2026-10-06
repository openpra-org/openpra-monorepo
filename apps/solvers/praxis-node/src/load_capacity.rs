use praxis::analysis::load_capacity::{
    analyze, LawParameter, LoadCapacityLaw, LoadCapacityModel, LoadCapacityResult,
    LoadCapacitySettings, LoadCapacitySide, SampleSummary, Sampling, UncertainParameter,
};
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
    sampling: SamplingInput,
    samples: usize,
    seed: u64,
    #[serde(default = "default_curve_points")]
    curve_points: usize,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum SamplingInput {
    MonteCarlo,
    LatinHypercube,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LoadCapacitySnapshot {
    id: String,
    method_type: String,
    revision: u64,
    load: SideInput,
    capacity: SideInput,
    #[serde(default)]
    unit: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SideInput {
    distribution: DistributionInput,
    #[serde(default)]
    uncertain_parameters: Vec<UncertainInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UncertainInput {
    parameter: String,
    distribution: DistributionInput,
    #[serde(default)]
    correlation_key: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(tag = "type")]
enum DistributionInput {
    #[serde(rename = "point_estimate")]
    PointEstimate { value: f64 },
    #[serde(rename = "normal", rename_all = "camelCase")]
    Normal { mean: f64, std_dev: f64 },
    #[serde(rename = "lognormal", rename_all = "camelCase")]
    Lognormal { median: f64, error_factor: f64 },
    #[serde(rename = "uniform")]
    Uniform { lower: f64, upper: f64 },
    #[serde(rename = "exponential", rename_all = "camelCase")]
    Exponential { failure_rate: f64 },
    #[serde(rename = "weibull")]
    Weibull {
        scale: f64,
        shape: f64,
        location: f64,
    },
    #[serde(rename = "gamma")]
    Gamma { shape: f64, rate: f64 },
    #[serde(rename = "beta", rename_all = "camelCase")]
    Beta { alpha: f64, beta_param: f64 },
}

impl DistributionInput {
    fn law(self) -> LoadCapacityLaw {
        match self {
            DistributionInput::PointEstimate { value } => LoadCapacityLaw::Point { value },
            DistributionInput::Normal { mean, std_dev } => {
                LoadCapacityLaw::Normal { mean, std_dev }
            }
            DistributionInput::Lognormal {
                median,
                error_factor,
            } => LoadCapacityLaw::Lognormal {
                median,
                error_factor,
            },
            DistributionInput::Uniform { lower, upper } => {
                LoadCapacityLaw::Uniform { lower, upper }
            }
            DistributionInput::Exponential { failure_rate } => {
                LoadCapacityLaw::Exponential { rate: failure_rate }
            }
            DistributionInput::Weibull {
                scale,
                shape,
                location,
            } => LoadCapacityLaw::Weibull {
                scale,
                shape,
                location,
            },
            DistributionInput::Gamma { shape, rate } => LoadCapacityLaw::Gamma { shape, rate },
            DistributionInput::Beta { alpha, beta_param } => LoadCapacityLaw::Beta {
                alpha,
                beta: beta_param,
            },
        }
    }

    fn parameter(self, name: &str, side: &str) -> Result<LawParameter> {
        let parameter = match (self, name) {
            (DistributionInput::PointEstimate { .. }, "value") => LawParameter::Value,
            (DistributionInput::Normal { .. }, "mean") => LawParameter::Mean,
            (DistributionInput::Normal { .. }, "stdDev") => LawParameter::StdDev,
            (DistributionInput::Lognormal { .. }, "median") => LawParameter::Median,
            (DistributionInput::Lognormal { .. }, "errorFactor") => LawParameter::ErrorFactor,
            (DistributionInput::Uniform { .. }, "lower") => LawParameter::Lower,
            (DistributionInput::Uniform { .. }, "upper") => LawParameter::Upper,
            (DistributionInput::Exponential { .. }, "failureRate") => LawParameter::Rate,
            (DistributionInput::Weibull { .. }, "scale") => LawParameter::Scale,
            (DistributionInput::Weibull { .. }, "shape") => LawParameter::Shape,
            (DistributionInput::Weibull { .. }, "location") => LawParameter::Location,
            (DistributionInput::Gamma { .. }, "shape") => LawParameter::Shape,
            (DistributionInput::Gamma { .. }, "rate") => LawParameter::Rate,
            (DistributionInput::Beta { .. }, "alpha") => LawParameter::Alpha,
            (DistributionInput::Beta { .. }, "betaParam") => LawParameter::Beta,
            _ => {
                return Err(PraxisError::Settings(format!(
                    "the {side} distribution has no parameter '{name}'"
                )))
            }
        };
        Ok(parameter)
    }
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

fn uncertain(
    side: &SideInput,
    which: LoadCapacitySide,
    label: &str,
) -> Result<Vec<UncertainParameter>> {
    side.uncertain_parameters
        .iter()
        .map(|input| {
            Ok(UncertainParameter {
                side: which,
                parameter: side.distribution.parameter(&input.parameter, label)?,
                law: input.distribution.law(),
                correlation_key: input.correlation_key.clone(),
            })
        })
        .collect()
}

fn model_of(snapshot: &LoadCapacitySnapshot) -> Result<LoadCapacityModel> {
    let mut parameters = uncertain(&snapshot.load, LoadCapacitySide::Load, "load")?;
    parameters.extend(uncertain(
        &snapshot.capacity,
        LoadCapacitySide::Capacity,
        "capacity",
    )?);
    Ok(LoadCapacityModel {
        load: snapshot.load.distribution.law(),
        capacity: snapshot.capacity.distribution.law(),
        uncertain: parameters,
    })
}

fn settings_of(settings: &SettingsInput) -> LoadCapacitySettings {
    LoadCapacitySettings {
        sampling: match settings.sampling {
            SamplingInput::MonteCarlo => Sampling::MonteCarlo,
            SamplingInput::LatinHypercube => Sampling::LatinHypercube,
        },
        samples: settings.samples,
        seed: settings.seed,
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
        value["sampling"] = json!(match uncertainty.sampling {
            Sampling::MonteCarlo => "MONTE_CARLO",
            Sampling::LatinHypercube => "LATIN_HYPERCUBE",
        });
        value["samples"] = json!(uncertainty.samples);
        value["seed"] = json!(uncertainty.seed);
        value["largestQuadratureError"] = json!(uncertainty.largest_quadrature_error);
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
        "quadratureError": result.point.error,
        "unit": snapshot.unit,
        "uncertainty": uncertainty,
        "curve": curve,
        "validationIssues": [],
    })
}

pub(crate) fn validate(request: &SolverRequest) -> Result<Value> {
    let (_, snapshot) = parse(request)?;
    let model = model_of(&snapshot)?;
    praxis::analysis::load_capacity::failure_probability(&model.load, &model.capacity)?;
    Ok(json!({
        "scope": LOAD_CAPACITY_METHOD,
        "valid": true,
        "modelId": snapshot.id,
        "modelRevision": snapshot.revision,
    }))
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let (execute, snapshot) = parse(request)?;
    let model = model_of(&snapshot)?;
    let result = analyze(&model, &settings_of(&execute.settings))?;
    Ok(result_json(&snapshot, &result))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::execute;
    use crate::transport::SolverRequest;

    fn request(capacity: serde_json::Value) -> SolverRequest {
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
                    "load": { "distribution": { "type": "lognormal", "median": 30.0, "errorFactor": 1.5 } },
                    "capacity": capacity
                }],
                "resources": {}
            })
            .to_string(),
        )
        .unwrap()
    }

    #[test]
    fn returns_the_exact_point_and_the_sampled_split_fraction() {
        let result = execute(&request(json!({
            "distribution": { "type": "lognormal", "median": 48.0, "errorFactor": 1.2 },
            "uncertainParameters": [{ "parameter": "median", "distribution": { "type": "lognormal", "median": 48.0, "errorFactor": 1.6 } }]
        })))
        .unwrap();
        assert_eq!(result["method"], "CLOSED_FORM_LOGNORMAL");
        assert_eq!(result["unit"], "h");
        assert!(result["quadratureError"].is_null());
        let point = result["pointProbability"].as_f64().unwrap();
        assert!(point > 0.0 && point < 0.1);
        let uncertainty = &result["uncertainty"];
        assert_eq!(uncertainty["sampling"], "LATIN_HYPERCUBE");
        assert_eq!(uncertainty["samples"], 2000);
        assert!(uncertainty["p05"].as_f64().unwrap() < uncertainty["p95"].as_f64().unwrap());
        assert_eq!(result["curve"].as_array().unwrap().len(), 11);
        assert!(result["curve"][0]["p50"].is_number());
    }

    #[test]
    fn integrates_mixed_distributions_and_names_bad_parameters() {
        let result = execute(&request(json!({
            "distribution": { "type": "weibull", "scale": 50.0, "shape": 6.0, "location": 0.0 }
        })))
        .unwrap();
        assert_eq!(result["method"], "QUADRATURE");
        assert!(result["uncertainty"].is_null());
        assert!(result["quadratureError"].as_f64().unwrap() >= 0.0);
        let error = execute(&request(json!({
            "distribution": { "type": "weibull", "scale": 50.0, "shape": 6.0, "location": 0.0 },
            "uncertainParameters": [{ "parameter": "median", "distribution": { "type": "lognormal", "median": 48.0, "errorFactor": 1.6 } }]
        })))
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("the capacity distribution has no parameter 'median'"));
    }
}
