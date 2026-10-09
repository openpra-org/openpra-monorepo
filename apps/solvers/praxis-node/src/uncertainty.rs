use praxis::analysis::uncertainty::UncertaintyAnalysis;
use praxis::core::distribution::{
    EvidenceTerm, Law, Likelihood, MixtureComponent, QuantilePoint, UncertainExpression, UncertainParameter,
    UncertainUnit, UncertainValue,
};
use praxis::core::distribution_math::PreparedLaw;
use praxis::core::distribution_operations::{
    constrained_noninformative, homogeneity, laplace_trend, lognormal_fit, pool, prior_predictive, scale_law,
    Pooling,
};
use praxis::core::distribution_sampling::{SamplingMethod, SamplingPlan, UncertaintyProgram};
use praxis::{PraxisError, Result};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::transport::SolverRequest;

const UNCERTAINTY_METHOD: &str = "UNCERTAINTY";
const MAX_TRIALS: usize = 100_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UncertaintyRequest {
    schema_version: String,
    method_type: String,
    #[serde(default)]
    parameters: Vec<UncertainParameter>,
    #[serde(default)]
    laws: Vec<LawQuery>,
    #[serde(default)]
    expressions: Vec<ExpressionQuery>,
    #[serde(default)]
    operations: Vec<OperationQuery>,
}

#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum Operation {
    Scale {
        law: Law,
        factor: f64,
    },
    ConstrainedNoninformative {
        law: Law,
        likelihood: Likelihood,
    },
    LognormalFit {
        mean: Option<f64>,
        median: Option<f64>,
        quantiles: Vec<QuantilePoint>,
    },
    Pool {
        pooling: Pooling,
        components: Vec<MixtureComponent>,
    },
    PriorPredictive {
        law: Law,
        term: EvidenceTerm,
    },
    Homogeneity {
        terms: Vec<EvidenceTerm>,
    },
    LaplaceTrend {
        times: Vec<f64>,
        start: f64,
        end: f64,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OperationQuery {
    id: String,
    operation: Operation,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LawQuery {
    id: String,
    value: UncertainValue,
    #[serde(default)]
    probabilities: Vec<f64>,
    #[serde(default)]
    curve_probabilities: Vec<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SamplingQuery {
    method: SamplingMethod,
    trials: usize,
    seed: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExpressionQuery {
    id: String,
    expression: UncertainExpression,
    unit: UncertainUnit,
    #[serde(default)]
    probabilities: Vec<f64>,
    #[serde(default)]
    sampling: Option<SamplingQuery>,
}

fn parse_request(request: &SolverRequest) -> Result<UncertaintyRequest> {
    let parsed: UncertaintyRequest = serde_json::from_value(request.request.clone()).map_err(|error| {
        PraxisError::Serialization(format!("invalid uncertainty request: {error}"))
    })?;
    if parsed.schema_version != request.schema_version {
        return Err(PraxisError::Version(format!(
            "uncertainty request schema version '{}' does not match solver protocol version '{}'",
            parsed.schema_version, request.schema_version
        )));
    }
    if parsed.method_type != UNCERTAINTY_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "uncertainty adapter cannot execute method '{}'",
            parsed.method_type
        )));
    }
    let probabilities = parsed
        .laws
        .iter()
        .flat_map(|law| law.probabilities.iter().chain(&law.curve_probabilities))
        .chain(parsed.expressions.iter().flat_map(|query| query.probabilities.iter()));
    for probability in probabilities {
        if !(*probability > 0.0 && *probability < 1.0) {
            return Err(PraxisError::Settings(format!(
                "probability {probability} must lie strictly between 0 and 1"
            )));
        }
    }
    if let Some(query) = parsed.expressions.iter().find(|query| {
        query
            .sampling
            .as_ref()
            .is_some_and(|sampling| sampling.trials == 0 || sampling.trials > MAX_TRIALS)
    }) {
        return Err(PraxisError::Settings(format!(
            "expression '{}' needs between 1 and {MAX_TRIALS} trials",
            query.id
        )));
    }
    Ok(parsed)
}

fn law_summary(query: &LawQuery) -> Result<Value> {
    query.value.law.check_shape()?;
    query.value.check_meaning()?;
    let law = PreparedLaw::new(&query.value.law)?;
    let pairs: Vec<(f64, f64)> = query
        .probabilities
        .iter()
        .chain(query.curve_probabilities.iter())
        .map(|probability| (*probability, 1.0 - probability))
        .collect();
    let values = law.quantile_pairs(&pairs)?;
    let (quantile_values, curve_values) = values.split_at(query.probabilities.len());
    let quantiles: Vec<Value> = query
        .probabilities
        .iter()
        .zip(quantile_values)
        .map(|(probability, value)| json!({ "probability": probability, "value": value }))
        .collect();
    let atoms = law.atoms();
    let curve = curve_values
        .iter()
        .map(|x| {
            let density = if atoms.is_empty() { Some(law.density(*x)?) } else { None };
            Ok(json!({ "x": x, "cumulative": law.cdf(*x)?, "density": density }))
        })
        .collect::<Result<Vec<_>>>()?;
    let (lower, upper) = query.value.law.support();
    let (peaks, valleys) = turning_points(&curve);
    Ok(json!({
        "id": query.id,
        "mean": law.mean(),
        "standardDeviation": law.variance().sqrt(),
        "quantiles": quantiles,
        "support": { "lower": finite_or_null(lower), "upper": finite_or_null(upper) },
        "curve": curve,
        "peaks": peaks,
        "valleys": valleys,
        "atoms": atoms.iter().map(|(value, probability)| json!({ "value": value, "probability": probability })).collect::<Vec<_>>()
    }))
}

fn turning_points(curve: &[Value]) -> (Vec<Value>, Vec<Value>) {
    let density = |point: &Value| point["density"].as_f64();
    let mut peaks = Vec::new();
    let mut valleys = Vec::new();
    for window in curve.windows(3) {
        let (Some(left), Some(middle), Some(right)) = (density(&window[0]), density(&window[1]), density(&window[2])) else {
            continue;
        };
        let point = json!({ "x": window[1]["x"], "density": middle });
        if middle > left && middle >= right {
            peaks.push(point);
        } else if middle < left && middle <= right {
            valleys.push(point);
        }
    }
    (peaks, valleys)
}

fn law_value(law: &Law) -> Value {
    serde_json::to_value(law).unwrap_or(Value::Null)
}

fn serialized<T: serde::Serialize>(value: T) -> Result<Value> {
    serde_json::to_value(value).map_err(|error| PraxisError::Serialization(error.to_string()))
}

fn operation_summary(query: &OperationQuery) -> Result<Value> {
    let mut summary = match &query.operation {
        Operation::Scale { law, factor } => json!({ "law": law_value(&scale_law(law, *factor)?) }),
        Operation::ConstrainedNoninformative { law, likelihood } => {
            json!({ "law": law_value(&constrained_noninformative(law, *likelihood)?) })
        }
        Operation::LognormalFit {
            mean,
            median,
            quantiles,
        } => json!({ "law": law_value(&lognormal_fit(*mean, *median, quantiles)?) }),
        Operation::Pool {
            pooling,
            components,
        } => json!({ "law": law_value(&pool(*pooling, components)?) }),
        Operation::PriorPredictive { law, term } => serialized(prior_predictive(law, term)?)?,
        Operation::Homogeneity { terms } => serialized(homogeneity(terms)?)?,
        Operation::LaplaceTrend { times, start, end } => serialized(laplace_trend(times, *start, *end)?)?,
    };
    summary["id"] = json!(query.id);
    Ok(summary)
}

fn finite_or_null(value: f64) -> Value {
    if value.is_finite() {
        json!(value)
    } else {
        Value::Null
    }
}

fn expression_summary(
    program: &UncertaintyProgram,
    parameters: &[UncertainParameter],
    query: &ExpressionQuery,
) -> Result<Value> {
    let target = UncertaintyProgram::target(parameters, &query.expression, &format!("expression:{}", query.id), query.unit)?;
    let point = program.point(&target)?;
    let sampled = match &query.sampling {
        Some(sampling) => {
            let plan = SamplingPlan {
                method: sampling.method,
                trials: sampling.trials,
                seed: sampling.seed,
            };
            let samples = program.sample(&[&target], &plan)?.remove(0);
            let probabilities = if query.probabilities.is_empty() {
                praxis::analysis::uncertainty::DEFAULT_QUANTILE_PROBABILITIES.to_vec()
            } else {
                query.probabilities.clone()
            };
            let summary = if matches!(query.unit, UncertainUnit::Probability | UncertainUnit::Fraction) {
                let analysis = UncertaintyAnalysis::from_samples_at(samples, &probabilities)?;
                json!({
                    "mean": analysis.mean(),
                    "standardDeviation": analysis.standard_deviation(),
                    "standardError": analysis.standard_error(),
                    "quantiles": analysis.quantiles(),
                    "samples": analysis.samples()
                })
            } else {
                let count = samples.len() as f64;
                let mean = samples.iter().sum::<f64>() / count;
                let deviation = if samples.len() > 1 {
                    (samples.iter().map(|value| (value - mean).powi(2)).sum::<f64>() / (count - 1.0)).sqrt()
                } else {
                    0.0
                };
                let mut sorted = samples.clone();
                sorted.sort_by(|a, b| a.total_cmp(b));
                let quantiles: Vec<Value> = probabilities
                    .iter()
                    .map(|probability| {
                        let position = probability * (sorted.len() - 1) as f64;
                        let index = position.floor() as usize;
                        let fraction = position - index as f64;
                        let value = if index + 1 < sorted.len() {
                            sorted[index] * (1.0 - fraction) + sorted[index + 1] * fraction
                        } else {
                            sorted[index]
                        };
                        json!({ "probability": probability, "value": value })
                    })
                    .collect();
                json!({
                    "mean": mean,
                    "standardDeviation": deviation,
                    "standardError": deviation / count.sqrt(),
                    "quantiles": quantiles,
                    "samples": samples
                })
            };
            Some(summary)
        }
        None => None,
    };
    Ok(json!({ "id": query.id, "unit": query.unit, "point": point, "sampled": sampled }))
}

fn item_error(id: &str, error: PraxisError) -> Value {
    json!({ "id": id, "error": error.to_string() })
}

pub(crate) fn validate(request: &SolverRequest) -> Result<Value> {
    let parsed = parse_request(request)?;
    UncertaintyProgram::from_table(&parsed.parameters)?;
    Ok(json!({ "scope": UNCERTAINTY_METHOD, "valid": true, "parameterCount": parsed.parameters.len() }))
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let parsed = parse_request(request)?;
    let laws: Vec<Value> = parsed
        .laws
        .iter()
        .map(|query| law_summary(query).unwrap_or_else(|error| item_error(&query.id, error)))
        .collect();
    let expressions: Vec<Value> = match UncertaintyProgram::from_table(&parsed.parameters) {
        Ok(program) => parsed
            .expressions
            .iter()
            .map(|query| {
                expression_summary(&program, &parsed.parameters, query)
                    .unwrap_or_else(|error| item_error(&query.id, error))
            })
            .collect(),
        Err(error) => {
            let message = error.to_string();
            parsed
                .expressions
                .iter()
                .map(|query| json!({ "id": query.id, "error": message }))
                .collect()
        }
    };
    let operations: Vec<Value> = parsed
        .operations
        .iter()
        .map(|query| operation_summary(query).unwrap_or_else(|error| item_error(&query.id, error)))
        .collect();
    Ok(json!({ "methodType": UNCERTAINTY_METHOD, "laws": laws, "expressions": expressions, "operations": operations }))
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::execute;
    use crate::transport::SolverRequest;

    fn run(request: Value) -> Value {
        let payload = json!({
            "schemaVersion": "1.0.0",
            "request": request,
            "modelSnapshots": []
        });
        execute(&SolverRequest::from_json(&payload.to_string()).unwrap()).unwrap()
    }

    #[test]
    fn summarizes_a_law_with_quantiles_curve_and_support() {
        let result = run(json!({
            "schemaVersion": "1.0.0",
            "methodType": "UNCERTAINTY",
            "laws": [{
                "id": "beta",
                "value": { "unit": "PROBABILITY", "law": { "family": "BETA", "alpha": 2.0, "beta": 8.0, "lower": 0.0, "upper": 1.0 } },
                "probabilities": [0.05, 0.5, 0.95],
                "curveProbabilities": [0.1, 0.5, 0.9]
            }, {
                "id": "tail",
                "value": { "unit": "PROBABILITY", "law": { "family": "LOGNORMAL", "mean": 0.1, "errorFactor": 3.0, "level": 0.95 } }
            }, {
                "id": "outside",
                "value": { "unit": "PROBABILITY", "law": { "family": "UNIFORM", "lower": 1.5, "upper": 2.0 } }
            }]
        }));
        let beta = &result["laws"][0];
        assert!((beta["mean"].as_f64().unwrap() - 0.2).abs() < 1e-15);
        assert_eq!(beta["quantiles"].as_array().unwrap().len(), 3);
        assert_eq!(beta["support"]["upper"], 1.0);
        let curve = beta["curve"].as_array().unwrap();
        assert!((curve[1]["cumulative"].as_f64().unwrap() - 0.5).abs() < 1e-14);
        assert!(curve[1]["density"].as_f64().unwrap() > 0.0);
        assert!((result["laws"][1]["mean"].as_f64().unwrap() - 0.1).abs() < 1e-12);
        assert!(result["laws"][2]["error"].as_str().unwrap().contains("UNIFORM"));
    }

    #[test]
    fn evaluates_expressions_at_their_point_and_by_sampling() {
        let reference = json!({ "referenceType": "WORKBOOK_PARAMETER", "workbookId": "da", "entityId": "rate" });
        let result = run(json!({
            "schemaVersion": "1.0.0",
            "methodType": "UNCERTAINTY",
            "parameters": [{ "reference": reference, "expression": { "node": "VALUE", "value": {
                "unit": "PER_HOUR", "law": { "family": "GAMMA", "shape": 2.0, "rate": 1.0e5 } } } }],
            "expressions": [{
                "id": "pump",
                "unit": "PROBABILITY",
                "expression": { "node": "MODEL", "model": {
                    "form": "MISSION",
                    "rate": { "node": "PARAMETER", "reference": reference },
                    "missionTime": { "node": "VALUE", "value": { "unit": "HOURS", "law": { "family": "POINT", "value": 24.0 } } }
                } },
                "sampling": { "method": "LATIN_HYPERCUBE", "trials": 4000, "seed": 3 }
            }, {
                "id": "wrong",
                "unit": "PROBABILITY",
                "expression": { "node": "PARAMETER", "reference": reference }
            }]
        }));
        let pump = &result["expressions"][0];
        let point = pump["point"].as_f64().unwrap();
        assert!((point - -(-24.0f64 * 2.0e-5).exp_m1()).abs() < 1e-18);
        let sampled = &pump["sampled"];
        assert_eq!(sampled["samples"].as_array().unwrap().len(), 4000);
        let error = sampled["standardError"].as_f64().unwrap();
        assert!((sampled["mean"].as_f64().unwrap() - point).abs() < 5.0 * error);
        assert!(result["expressions"][1]["error"].is_string());
    }

    #[test]
    fn answers_operations_with_laws_tests_and_errors() {
        let result = run(json!({
            "schemaVersion": "1.0.0",
            "methodType": "UNCERTAINTY",
            "operations": [
                { "id": "scaled", "operation": { "kind": "SCALE", "law": { "family": "GAMMA", "shape": 2.0, "rate": 1.0 }, "factor": 0.5 } },
                { "id": "fit", "operation": { "kind": "LOGNORMAL_FIT", "mean": null, "median": 1e-3, "quantiles": [{ "probability": 0.95, "value": 5e-3 }] } },
                { "id": "test", "operation": { "kind": "HOMOGENEITY", "terms": [
                    { "likelihood": "POISSON", "failures": 1.0, "exposure": 1e5 },
                    { "likelihood": "POISSON", "failures": 4.0, "exposure": 2e5 }
                ] } },
                { "id": "bad", "operation": { "kind": "SCALE", "law": { "family": "GAMMA", "shape": 2.0, "rate": 1.0 }, "factor": -1.0 } }
            ]
        }));
        let operations = result["operations"].as_array().unwrap();
        assert_eq!(operations[0]["law"]["rate"], 2.0);
        assert_eq!(operations[1]["law"]["family"], "LOGNORMAL");
        assert!(operations[2]["probability"].as_f64().unwrap() > 0.0);
        assert!(operations[3]["error"].is_string());
    }

    #[test]
    fn reports_the_peaks_of_a_two_humped_posterior() {
        let result = run(json!({
            "schemaVersion": "1.0.0",
            "methodType": "UNCERTAINTY",
            "laws": [{
                "id": "split",
                "value": { "unit": "PER_HOUR", "law": {
                    "family": "POSTERIOR",
                    "prior": { "family": "MIXTURE", "components": [
                        { "weight": 0.5, "law": { "family": "LOGNORMAL", "mean": 1e-6, "errorFactor": 2.0, "level": 0.95 } },
                        { "weight": 0.5, "law": { "family": "LOGNORMAL", "mean": 1e-3, "errorFactor": 2.0, "level": 0.95 } }
                    ] },
                    "evidence": [{ "likelihood": "POISSON", "failures": 0.0, "exposure": 1e3 }]
                } },
                "curveProbabilities": (1..200).map(|index| f64::from(index) / 200.0).collect::<Vec<_>>()
            }]
        }));
        let law = &result["laws"][0];
        assert_eq!(law["peaks"].as_array().unwrap().len(), 2, "{law}");
        assert_eq!(law["valleys"].as_array().unwrap().len(), 1);
    }
}
