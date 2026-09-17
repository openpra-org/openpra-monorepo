use crate::hybrid_causal_logic::HclCalculationType;
use std::collections::{HashMap, HashSet};

use praxis::analysis::event_tree_quantification::{
    quantify_event_tree_hazard_grid_batch, quantify_event_tree_sequences,
    quantify_event_tree_sequences_batch, EventTreeHazardGridQuantification, EventTreeHclContext,
    EventTreeSequenceProbability,
};
use praxis::core::event_tree::{
    Branch, BranchTarget, EventTree, Fork, FunctionalEvent, Path, Sequence,
};
use praxis::core::model::Model;
use praxis::hcl::{HclEvidenceSpec, HclUncertaintySummary};
use praxis::quantitative::{
    annualize_frequency, prepare_hazard_weights, AnnualizationConvention, FrequencyUnit,
    HazardWeightSummary,
};
use praxis::{PraxisError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::fault_tree::build_fault_tree_for_model;
use crate::hybrid_causal_logic::build_event_tree_context;
use crate::transport::SolverRequest;

const EVENT_TREE_METHOD: &str = "EVENT_TREE";

mod linked;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EventTreeExecuteRequest {
    #[serde(default)]
    calculation_type: HclCalculationType,
    schema_version: String,
    method_type: String,
    model_id: String,
    revision: u64,
    mode: EventTreeExecutionMode,
    requested_by: String,
    evidence_batch: Option<Vec<EventTreeEvidenceRow>>,
    hazard_convolution: Option<HazardConvolutionRequest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EventTreeEvidenceRow {
    scenario_id: String,
    observations: Vec<EventTreeEvidenceObservation>,
    #[serde(default)]
    hazard_observations: Vec<EventTreeEvidenceObservation>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HazardConvolutionRequest {
    grid_name: String,
    hazard_node_ids: Vec<String>,
    annual_frequency_scale: AnnualFrequencyScale,
    normalize_weights: bool,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AnnualFrequencyScale {
    value: f64,
    unit: FrequencyUnit,
    annualization: AnnualizationConvention,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EventTreeEvidenceObservation {
    node_id: String,
    state_id: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum EventTreeExecutionMode {
    Independent,
    HybridCausalLogic,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventTreeSnapshot {
    id: String,
    method_type: String,
    revision: u64,
    initiating_event: InitiatingEventReference,
    initiating_event_frequency: InitiatingEventFrequency,
    functional_events: Vec<FunctionalEventSnapshot>,
    functional_event_fault_tree_links: Vec<FunctionalEventFaultTreeLink>,
    end_states: Vec<EndStateSnapshot>,
    sequences: Vec<EventTreeSequenceSnapshot>,
    hcl_configuration: Option<EventTreeHclConfigurationReference>,
}

#[derive(Clone, Debug, Deserialize)]
struct InitiatingEventReference {
    target: EntityReference,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct InitiatingEventFrequency {
    value: f64,
    #[serde(default)]
    unit: FrequencyUnit,
    annualization: Option<AnnualizationConvention>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct EntityReference {
    #[serde(rename = "modelId")]
    model_id: String,
    #[serde(rename = "entityId")]
    entity_id: String,
}

#[derive(Clone, Debug, Deserialize)]
struct FunctionalEventSnapshot {
    id: String,
    name: String,
    order: usize,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FunctionalEventFaultTreeLink {
    functional_event_id: String,
    fault_tree_top_gate: EntityReference,
}

#[derive(Clone, Debug, Deserialize)]
struct EndStateSnapshot {
    id: String,
}

#[derive(Clone, Debug, Deserialize)]
struct EventTreeHclConfigurationReference {
    configuration: ModelReference,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelReference {
    model_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct EventTreeSequenceSnapshot {
    id: String,
    path: Vec<EventTreePathStep>,
    result: EventTreeBranchResult,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    sequence_chain: Vec<EntityReference>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct EventTreePathStep {
    functional_event_id: String,
    outcome: EventTreeBranchOutcome,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum EventTreeBranchOutcome {
    Success,
    Failure,
    Bypassed,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "SCREAMING_SNAKE_CASE")]
enum EventTreeBranchResult {
    EndState {
        #[serde(rename = "endStateId")]
        end_state_id: String,
    },
    Transfer {
        target: ModelReference,
    },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SequenceResult<'a> {
    sequence_id: &'a str,
    path: &'a [EventTreePathStep],
    result: &'a EventTreeBranchResult,
    #[serde(skip_serializing_if = "<[EntityReference]>::is_empty")]
    sequence_chain: &'a [EntityReference],
    conditional_probability: f64,
    annual_frequency: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    uncertainty: Option<EventTreeSequenceUncertainty>,
    diagnostics: Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EventTreeSequenceUncertainty {
    conditional_probability: HclUncertaintySummary,
    annual_frequency: HclUncertaintySummary,
}

struct EventTreeAdapter {
    model_id: String,
    model_revision: u64,
    mode: EventTreeExecutionMode,
    initiating_event_frequency: f64,
    initiating_event_frequency_input: InitiatingEventFrequency,
    annualization: AnnualizationConvention,
    event_tree: EventTree,
    model: Model,
    snapshot: EventTreeSnapshot,
    hcl_context: Option<EventTreeHclContext>,
    evidence_batch: Option<Vec<EventTreeEvidenceRow>>,
    hazard_convolution: Option<HazardConvolutionRequest>,
}

fn serialization_error(context: &str, error: impl std::fmt::Display) -> PraxisError {
    PraxisError::Serialization(format!("{context}: {error}"))
}

fn parse_request(request: &SolverRequest) -> Result<EventTreeExecuteRequest> {
    let parsed: EventTreeExecuteRequest = serde_json::from_value(request.request.clone())
        .map_err(|error| serialization_error("invalid event-tree execute request", error))?;
    if parsed.schema_version != request.schema_version {
        return Err(PraxisError::Version(format!(
            "event-tree request schema version '{}' does not match solver protocol version '{}'",
            parsed.schema_version, request.schema_version
        )));
    }
    if parsed.method_type != EVENT_TREE_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "event-tree adapter cannot execute method '{}'",
            parsed.method_type
        )));
    }
    if parsed.requested_by.trim().is_empty() {
        return Err(PraxisError::Serialization(
            "event-tree execute request requires requestedBy".to_string(),
        ));
    }
    Ok(parsed)
}

fn parse_event_tree_snapshots(
    request: &SolverRequest,
) -> Result<HashMap<String, EventTreeSnapshot>> {
    let mut snapshots = HashMap::new();
    for value in request.model_snapshots.iter().filter(|snapshot| {
        snapshot.get("methodType").and_then(Value::as_str) == Some(EVENT_TREE_METHOD)
    }) {
        let snapshot: EventTreeSnapshot = serde_json::from_value(value.clone())
            .map_err(|error| serialization_error("invalid event-tree model snapshot", error))?;
        if snapshots.insert(snapshot.id.clone(), snapshot).is_some() {
            return Err(PraxisError::Logic(
                "solver request contains a duplicate event-tree model snapshot".to_string(),
            ));
        }
    }
    Ok(snapshots)
}

fn build_adapter(request: &SolverRequest) -> Result<EventTreeAdapter> {
    let execute = parse_request(request)?;
    execute
        .calculation_type
        .ensure_hazard_supported(execute.hazard_convolution.is_some())?;
    if matches!(execute.mode, EventTreeExecutionMode::Independent)
        && execute.calculation_type == HclCalculationType::Uncertainty
    {
        return Err(PraxisError::Hcl(
            "Uncertainty execution requires HCL mode.".into(),
        ));
    }
    let event_tree_snapshots = parse_event_tree_snapshots(request)?;
    let snapshot = event_tree_snapshots
        .get(&execute.model_id)
        .cloned()
        .ok_or_else(|| {
            PraxisError::Logic(format!(
                "event-tree model snapshot '{}' is missing",
                execute.model_id
            ))
        })?;
    if snapshot.method_type != EVENT_TREE_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "event-tree snapshot uses method '{}'",
            snapshot.method_type
        )));
    }
    if snapshot.revision != execute.revision {
        return Err(PraxisError::Version(format!(
            "event-tree snapshot revision {} does not match requested revision {}",
            snapshot.revision, execute.revision
        )));
    }
    let annualization = snapshot
        .initiating_event_frequency
        .annualization
        .unwrap_or_default();
    let annualized_initiating_event_frequency = annualize_frequency(
        snapshot.initiating_event_frequency.value,
        snapshot.initiating_event_frequency.unit,
        annualization,
    )?;
    if snapshot.initiating_event.target.model_id.trim().is_empty()
        || snapshot.initiating_event.target.entity_id.trim().is_empty()
    {
        return Err(PraxisError::Logic(
            "event-tree initiating-event reference is empty".to_string(),
        ));
    }

    let linked = linked::build(&snapshot.id, &event_tree_snapshots)?;
    let mut model = Model::new(format!("event-tree-{}", snapshot.id))?;
    let added_fault_trees: HashSet<String> = linked.fault_trees.keys().cloned().collect();
    for (id, top) in &linked.fault_trees {
        let adapter = build_fault_tree_for_model(request, id)?;
        if &adapter.top_gate_id != top {
            return Err(PraxisError::Logic(format!(
                "fault tree '{id}' uses top gate '{}' instead of '{top}'",
                adapter.top_gate_id
            )));
        }
        model.add_fault_tree(adapter.fault_tree)?;
    }

    let hcl_context = match execute.mode {
        EventTreeExecutionMode::Independent => None,
        EventTreeExecutionMode::HybridCausalLogic => {
            let configuration_id = snapshot
                .hcl_configuration
                .as_ref()
                .map(|reference| reference.configuration.model_id.as_str())
                .ok_or_else(|| {
                    PraxisError::Hcl(
                        "HCL event-tree execution requires an HCL configuration".to_string(),
                    )
                })?;
            Some(build_event_tree_context(
                request,
                configuration_id,
                &added_fault_trees,
                execute.calculation_type,
            )?)
        }
    };

    let snapshot = EventTreeSnapshot {
        sequences: linked.sequences,
        ..snapshot
    };
    if execute.hazard_convolution.is_some() {
        hcl_context
            .as_ref()
            .ok_or_else(|| {
                PraxisError::Hcl("event-tree hazard convolution requires HCL mode".into())
            })?
            .ensure_hazard_convolution_supported()?;
    }
    Ok(EventTreeAdapter {
        model_id: snapshot.id.clone(),
        model_revision: snapshot.revision,
        mode: execute.mode,
        initiating_event_frequency: annualized_initiating_event_frequency,
        initiating_event_frequency_input: snapshot.initiating_event_frequency.clone(),
        annualization,
        event_tree: linked.event_tree,
        model,
        snapshot,
        hcl_context,
        evidence_batch: execute.evidence_batch,
        hazard_convolution: execute.hazard_convolution,
    })
}

pub(crate) fn validate(request: &SolverRequest) -> Result<Value> {
    let adapter = build_adapter(request)?;
    // Structural validation uses nominal probabilities. The sampled population
    // is built only by execute, avoiding duplicate Monte Carlo work per run.
    let validation_hcl_context = adapter
        .hcl_context
        .clone()
        .map(|context| context.with_uncertainty(None));
    let (sequence_count, scenario_count) = match &adapter.evidence_batch {
        Some(rows) => {
            validate_evidence_rows(rows)?;
            let evidence = batch_evidence_specs(rows);
            let sequence_count = if let Some(hazard) = &adapter.hazard_convolution {
                validate_hazard_grid(rows, hazard)?;
                let assignments = hazard_evidence_specs(rows);
                let context = validation_hcl_context.as_ref().ok_or_else(|| {
                    PraxisError::Hcl("event-tree hazard convolution requires HCL mode".to_string())
                })?;
                quantify_event_tree_hazard_grid_batch(
                    &adapter.model,
                    &adapter.event_tree,
                    context,
                    &evidence,
                    &assignments,
                )?
                .quantification
                .scenarios
                .first()
                .map_or(0, |scenario| scenario.len())
            } else {
                quantify_event_tree_sequences_batch(
                    &adapter.model,
                    &adapter.event_tree,
                    validation_hcl_context.as_ref(),
                    &evidence,
                )?
                .scenarios
                .first()
                .map_or(0, |scenario| scenario.len())
            };
            (sequence_count, rows.len())
        }
        None => (
            quantify_event_tree_sequences(
                &adapter.model,
                &adapter.event_tree,
                validation_hcl_context.as_ref(),
            )?
            .len(),
            1,
        ),
    };
    Ok(json!({
        "scope": EVENT_TREE_METHOD,
        "valid": true,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "sequenceCount": sequence_count,
        "scenarioCount": scenario_count
    }))
}

pub(crate) fn preflight(request: &SolverRequest, executing: bool) -> Result<Value> {
    let execute = parse_request(request)?;
    let adapter = build_adapter(request)?;
    if adapter.hcl_context.is_none() {
        return Ok(crate::resource_preflight::no_clique());
    }
    let configuration_id = &adapter
        .snapshot
        .hcl_configuration
        .as_ref()
        .expect("HCL adapter requires its configuration")
        .configuration
        .model_id;
    crate::hybrid_causal_logic::preflight_event_tree_network(
        request,
        configuration_id,
        execute.calculation_type,
        executing,
    )
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let adapter = build_adapter(request)?;
    if let Some(rows) = &adapter.evidence_batch {
        validate_evidence_rows(rows)?;
        if adapter.hazard_convolution.is_some() {
            return execute_batch(&adapter, rows);
        }
        return crate::evidence_batch::execute(
            rows,
            |row| row.scenario_id.as_str(),
            batch_response(&adapter),
            |rows| execute_batch(&adapter, rows),
        );
    }
    let probabilities = quantify_event_tree_sequences(
        &adapter.model,
        &adapter.event_tree,
        adapter.hcl_context.as_ref(),
    )?;
    event_tree_result_json(&adapter, &probabilities, None)
}

fn event_tree_result_json(
    adapter: &EventTreeAdapter,
    probabilities: &[EventTreeSequenceProbability],
    scenario_id: Option<&str>,
) -> Result<Value> {
    let probability_by_sequence: HashMap<&str, &EventTreeSequenceProbability> = probabilities
        .iter()
        .map(|result| (result.sequence_id.as_str(), result))
        .collect();
    let mut aggregate_by_end_state: HashMap<String, f64> = HashMap::new();
    let mut aggregate_samples_by_end_state: HashMap<String, Vec<f64>> = HashMap::new();
    let mut sequences = Vec::with_capacity(adapter.snapshot.sequences.len());
    for sequence in &adapter.snapshot.sequences {
        let quantified = probability_by_sequence
            .get(sequence.id.as_str())
            .copied()
            .ok_or_else(|| {
                PraxisError::Logic(format!(
                    "PRAXIS did not return event-tree sequence '{}'",
                    sequence.id
                ))
            })?;
        let conditional_probability = quantified.conditional_probability;
        let annual_frequency = conditional_probability * adapter.initiating_event_frequency;
        let end_state_id = terminal_end_state(sequence)?.to_string();
        *aggregate_by_end_state
            .entry(end_state_id.clone())
            .or_default() += annual_frequency;
        let uncertainty = if let Some(summary) = &quantified.uncertainty {
            let samples = quantified.uncertainty_samples.as_ref().ok_or_else(|| {
                PraxisError::Hcl("event-tree uncertainty is missing its samples".to_string())
            })?;
            // Apply the frequency conversion to each paired sample before
            // calling HCL_MH's summary routine; scaling summaries rounds differently.
            let annual_samples: Vec<f64> = samples
                .iter()
                .map(|sample| sample * adapter.initiating_event_frequency)
                .collect();
            let annual_summary =
                HclUncertaintySummary::from_samples(&annual_samples, summary.seed)?;
            let aggregate = aggregate_samples_by_end_state
                .entry(end_state_id.clone())
                .or_insert_with(|| vec![0.0; samples.len()]);
            if aggregate.len() != samples.len() {
                return Err(PraxisError::Hcl(
                    "event-tree uncertainty sequences use inconsistent sample populations"
                        .to_string(),
                ));
            }
            for (total, sample) in aggregate.iter_mut().zip(&annual_samples) {
                *total += sample;
            }
            Some(EventTreeSequenceUncertainty {
                conditional_probability: summary.clone(),
                annual_frequency: annual_summary,
            })
        } else {
            None
        };
        sequences.push(SequenceResult {
            sequence_id: &sequence.id,
            path: &sequence.path,
            result: &sequence.result,
            sequence_chain: &sequence.sequence_chain,
            conditional_probability,
            annual_frequency,
            diagnostics: crate::diagnostics::sequence_diagnostics_json(&quantified.diagnostics),
            uncertainty,
        });
    }

    let mut end_state_aggregates: Vec<Value> = aggregate_by_end_state
        .into_iter()
        .map(|(end_state_id, annual_frequency)| {
            let uncertainty = aggregate_samples_by_end_state
                .get(&end_state_id)
                .map(|samples| {
                    let seed = probabilities
                        .iter()
                        .find_map(|sequence| {
                            sequence.uncertainty.as_ref().map(|summary| summary.seed)
                        })
                        .ok_or_else(|| {
                            PraxisError::Hcl(
                                "event-tree uncertainty is missing its seed".to_string(),
                            )
                        })?;
                    HclUncertaintySummary::from_samples(samples, seed)
                })
                .transpose()?;
            let mut value =
                json!({ "endStateId": end_state_id, "annualFrequency": annual_frequency });
            if let Some(uncertainty) = uncertainty {
                value["uncertainty"] = json!(uncertainty);
            }
            Ok(value)
        })
        .collect::<Result<Vec<_>>>()?;
    end_state_aggregates.sort_by(|left, right| {
        left["endStateId"]
            .as_str()
            .cmp(&right["endStateId"].as_str())
    });

    let mut value = json!({
        "methodType": EVENT_TREE_METHOD,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "mode": adapter.mode,
        "sequences": sequences,
        "endStateAggregates": end_state_aggregates,
        "frequencySemantics": {
            "initiatingEventFrequency": {
                "value": adapter.initiating_event_frequency_input.value,
                "unit": adapter.initiating_event_frequency_input.unit
            },
            "annualization": adapter.annualization,
            "annualizedInitiatingEventFrequency": {
                "value": adapter.initiating_event_frequency,
                "unit": "PER_YEAR"
            }
        },
        "validationIssues": []
    });
    if let Some(scenario_id) = scenario_id {
        value["scenarioId"] = json!(scenario_id);
    }
    Ok(value)
}

fn batch_response(adapter: &EventTreeAdapter) -> Value {
    json!({
        "methodType": EVENT_TREE_METHOD,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "mode": adapter.mode,
    })
}

fn execute_batch(adapter: &EventTreeAdapter, rows: &[EventTreeEvidenceRow]) -> Result<Value> {
    let evidence = batch_evidence_specs(rows);
    let (batch, hazard_convolution) = if let Some(hazard) = &adapter.hazard_convolution {
        validate_hazard_grid(rows, hazard)?;
        let assignments = hazard_evidence_specs(rows);
        let context = adapter.hcl_context.as_ref().ok_or_else(|| {
            PraxisError::Hcl("event-tree hazard convolution requires HCL mode".to_string())
        })?;
        let weighted = quantify_event_tree_hazard_grid_batch(
            &adapter.model,
            &adapter.event_tree,
            context,
            &evidence,
            &assignments,
        )?;
        let integration = event_tree_hazard_convolution_json(rows, hazard, &weighted, &adapter)?;
        (weighted.quantification, Some(integration))
    } else {
        (
            quantify_event_tree_sequences_batch(
                &adapter.model,
                &adapter.event_tree,
                adapter.hcl_context.as_ref(),
                &evidence,
            )?,
            None,
        )
    };
    let evaluated: HashMap<_, _> = batch
        .scenario_indices
        .iter()
        .copied()
        .zip(batch.scenarios.iter())
        .collect();
    let batch_results = rows
        .iter()
        .enumerate()
        .map(|(index, row)| match evaluated.get(&index) {
            Some(probabilities) => {
                event_tree_result_json(&adapter, probabilities, Some(&row.scenario_id))
            }
            None => Ok(json!({"scenarioId": row.scenario_id, "status": "skipped_zero_weight"})),
        })
        .collect::<Result<Vec<_>>>()?;
    let mut response = batch_response(adapter);
    response["batchResults"] = json!(batch_results);
    response["compilationReuse"] = json!({
        "sequenceBddCompilations": batch.compilation.sequence_bdd_compilations,
        "junctionTreeCompilations": batch.compilation.junction_tree_compilations,
        "scenarioEvaluations": batch.compilation.scenario_evaluations
    });
    if let Some(hazard_convolution) = hazard_convolution {
        response["hazardConvolution"] = hazard_convolution;
    }
    Ok(response)
}

fn validate_evidence_rows(rows: &[EventTreeEvidenceRow]) -> Result<()> {
    if rows.is_empty() {
        return Err(PraxisError::Hcl(
            "event-tree HCL evidence batch requires at least one scenario".to_string(),
        ));
    }
    let mut scenario_ids = HashSet::with_capacity(rows.len());
    if let Some(row) = rows.iter().find(|row| {
        row.scenario_id.trim().is_empty() || !scenario_ids.insert(row.scenario_id.as_str())
    }) {
        return Err(PraxisError::Hcl(format!(
            "event-tree HCL evidence batch contains an empty or duplicate scenario id '{}'",
            row.scenario_id
        )));
    }
    Ok(())
}

fn batch_evidence_specs(rows: &[EventTreeEvidenceRow]) -> Vec<Vec<HclEvidenceSpec>> {
    rows.iter()
        .map(|row| {
            row.observations
                .iter()
                .map(|observation| HclEvidenceSpec {
                    node: observation.node_id.clone(),
                    state: observation.state_id.clone(),
                })
                .collect()
        })
        .collect()
}

fn hazard_evidence_specs(rows: &[EventTreeEvidenceRow]) -> Vec<Vec<HclEvidenceSpec>> {
    rows.iter()
        .map(|row| {
            row.hazard_observations
                .iter()
                .map(|observation| HclEvidenceSpec {
                    node: observation.node_id.clone(),
                    state: observation.state_id.clone(),
                })
                .collect()
        })
        .collect()
}

fn validate_hazard_grid(
    rows: &[EventTreeEvidenceRow],
    hazard: &HazardConvolutionRequest,
) -> Result<()> {
    if hazard.grid_name.trim().is_empty() {
        return Err(PraxisError::Hcl(
            "hazard grid requires a non-empty name".to_string(),
        ));
    }
    let expected: HashSet<&str> = hazard.hazard_node_ids.iter().map(String::as_str).collect();
    if expected.is_empty() || expected.len() != hazard.hazard_node_ids.len() {
        return Err(PraxisError::Hcl(
            "hazard grid requires unique hazard node ids".to_string(),
        ));
    }
    let mut cell_keys = HashSet::with_capacity(rows.len());
    for row in rows {
        let actual: HashSet<&str> = row
            .hazard_observations
            .iter()
            .map(|observation| observation.node_id.as_str())
            .collect();
        if actual.len() != row.hazard_observations.len() || actual != expected {
            return Err(PraxisError::Hcl(format!(
                "hazard scenario '{}' must observe every configured hazard node exactly once",
                row.scenario_id
            )));
        }
        let mut assignments: Vec<_> = row
            .hazard_observations
            .iter()
            .map(|observation| format!("{}={}", observation.node_id, observation.state_id))
            .collect();
        assignments.sort();
        if !cell_keys.insert(assignments.join("|")) {
            return Err(PraxisError::Hcl(format!(
                "hazard scenario '{}' duplicates an existing grid cell",
                row.scenario_id
            )));
        }
    }
    Ok(())
}

fn event_tree_hazard_convolution_json(
    rows: &[EventTreeEvidenceRow],
    hazard: &HazardConvolutionRequest,
    batch: &EventTreeHazardGridQuantification,
    adapter: &EventTreeAdapter,
) -> Result<Value> {
    let scale = hazard.annual_frequency_scale;
    let weights = prepare_hazard_weights(
        &batch.raw_weights,
        scale.value,
        scale.unit,
        scale.annualization,
        hazard.normalize_weights,
    )?;
    let mut sequence_probabilities: HashMap<String, f64> = HashMap::new();
    let mut end_state_probabilities: HashMap<String, f64> = HashMap::new();
    let mut sequence_totals: HashMap<String, f64> = HashMap::new();
    let mut end_state_totals: HashMap<String, f64> = HashMap::new();
    let evaluated: HashMap<_, _> = batch
        .quantification
        .scenario_indices
        .iter()
        .copied()
        .zip(batch.quantification.scenarios.iter())
        .collect();
    let result_rows = rows
        .iter()
        .zip(&weights.weights)
        .enumerate()
        .map(|(index, (row, weight))| {
            let probabilities = evaluated.get(&index);
            let sequences = probabilities
                .into_iter()
                .flat_map(|p| p.iter())
                .map(|probability| {
                    let contribution =
                        weight.annual_frequency * probability.conditional_probability;
                    let probability_contribution =
                        weight.convolution_weight * probability.conditional_probability;
                    *sequence_probabilities
                        .entry(probability.sequence_id.clone())
                        .or_default() += probability_contribution;
                    *sequence_totals
                        .entry(probability.sequence_id.clone())
                        .or_default() += contribution;
                    let sequence = adapter
                        .snapshot
                        .sequences
                        .iter()
                        .find(|sequence| sequence.id == probability.sequence_id)
                        .ok_or_else(|| {
                            PraxisError::Logic("missing expanded event-tree sequence".into())
                        })?;
                    let end_state_id = terminal_end_state(sequence)?.to_string();
                    *end_state_probabilities
                        .entry(end_state_id.clone())
                        .or_default() += probability_contribution;
                    *end_state_totals.entry(end_state_id).or_default() += contribution;
                    Ok(json!({
                        "sequenceId": probability.sequence_id,
                        "conditionalProbability": probability.conditional_probability,
                        "probabilityContribution": probability_contribution,
                        "annualContribution": contribution
                    }))
                })
                .collect::<Result<Vec<_>>>()?;
            Ok(json!({
                "scenarioId": row.scenario_id,
                "status": if probabilities.is_some() { "ok" } else { "skipped_zero_weight" },
                "rawWeight": weight.raw_weight,
                "normalizedWeight": weight.normalized_weight,
                "convolutionWeight": weight.convolution_weight,
                "annualFrequency": weight.annual_frequency,
                "sequences": sequences
            }))
        })
        .collect::<Result<Vec<_>>>()?;
    let mut sequences: Vec<Value> = sequence_totals
        .into_iter()
        .map(|(sequence_id, integrated_annual_frequency)| {
            json!({
                "sequenceId": sequence_id,
                "convolvedProbability": sequence_probabilities[&sequence_id],
                "integratedAnnualFrequency": integrated_annual_frequency
            })
        })
        .collect();
    sequences.sort_by(|left, right| {
        left["sequenceId"]
            .as_str()
            .cmp(&right["sequenceId"].as_str())
    });
    let mut end_state_aggregates: Vec<Value> = end_state_totals
        .into_iter()
        .map(|(end_state_id, integrated_annual_frequency)| {
            json!({
                "endStateId": end_state_id,
                "convolvedProbability": end_state_probabilities[&end_state_id],
                "integratedAnnualFrequency": integrated_annual_frequency
            })
        })
        .collect();
    end_state_aggregates.sort_by(|left, right| {
        left["endStateId"]
            .as_str()
            .cmp(&right["endStateId"].as_str())
    });
    Ok(hazard_common_json(
        hazard,
        &weights,
        json!({
            "targetKind": "EVENT_TREE",
            "rows": result_rows,
            "sequences": sequences,
            "endStateAggregates": end_state_aggregates
        }),
    ))
}

fn hazard_common_json(
    hazard: &HazardConvolutionRequest,
    weights: &HazardWeightSummary,
    mut value: Value,
) -> Value {
    value["gridName"] = json!(hazard.grid_name);
    value["annualFrequencyScale"] = json!({
        "value": hazard.annual_frequency_scale.value,
        "unit": hazard.annual_frequency_scale.unit,
        "annualization": hazard.annual_frequency_scale.annualization
    });
    value["annualizedFrequencyScale"] = json!(weights.annualized_frequency_scale);
    value["normalizeWeights"] = json!(hazard.normalize_weights);
    value["rawWeightSum"] = json!(weights.raw_weight_sum);
    value["convolutionWeightSum"] = json!(weights.convolution_weight_sum);
    value
}

fn terminal_end_state(sequence: &EventTreeSequenceSnapshot) -> Result<&str> {
    match &sequence.result {
        EventTreeBranchResult::EndState { end_state_id } => Ok(end_state_id),
        EventTreeBranchResult::Transfer { .. } => {
            Err(PraxisError::Logic("unexpanded event-tree transfer".into()))
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use serde_json::json;
    use serde_json::Value;

    use super::execute;
    use crate::transport::SolverRequest;

    #[test]
    fn annual_summaries_match_original_source_after_sample_conversion() {
        use praxis::analysis::event_tree_quantification::{
            EventTreeSequenceDiagnostics, EventTreeSequenceProbability,
        };
        use praxis::hcl::HclUncertaintySummary;

        let reference: Value = serde_json::from_str(include_str!(
            "../test/fixtures/annual-statistics/reference.json"
        ))
        .unwrap();
        let from_bits =
            |v: &Value| f64::from_bits(u64::from_str_radix(v.as_str().unwrap(), 16).unwrap());
        let request = SolverRequest::from_json(&json!({
            "schemaVersion": "1.0.0",
            "request": {"schemaVersion":"1.0.0","methodType":"EVENT_TREE","modelId":"ET","revision":1,"mode":"INDEPENDENT","requestedBy":"source-test"},
            "modelSnapshots": [fault_tree("FT", "TOP", "REF"), {
                "id":"ET","methodType":"EVENT_TREE","revision":1,
                "initiatingEvent":{"target":{"modelId":"IE","entityId":"IE"}},
                "initiatingEventFrequency":{"value":1.0},
                "functionalEvents":[{"id":"FE","name":"System","order":0}],
                "functionalEventFaultTreeLinks":[{"functionalEventId":"FE","faultTreeTopGate":{"modelId":"FT","entityId":"TOP"}}],
                "endStates":[{"id":"ALL"}],
                "sequences":[
                    {"id":"S0","path":[{"functionalEventId":"FE","outcome":"FAILURE"}],"result":{"kind":"END_STATE","endStateId":"ALL"}},
                    {"id":"S1","path":[{"functionalEventId":"FE","outcome":"SUCCESS"}],"result":{"kind":"END_STATE","endStateId":"ALL"}}
                ]
            }],
            "resources":{"faultTreeBasicEventCatalogue":{"projectId":"P","basicEvents":[{"id":"SHARED","probability":{"value":0.2}}]}}
        }).to_string()).unwrap();
        let mut adapter = super::build_adapter(&request).unwrap();
        for case in reference["cases"].as_array().unwrap() {
            adapter.initiating_event_frequency = from_bits(&case["scale_bits"]);
            let probabilities: Vec<_> = case["sample_bits"]
                .as_array()
                .unwrap()
                .iter()
                .enumerate()
                .map(|(i, values)| {
                    let samples: Vec<_> =
                        values.as_array().unwrap().iter().map(from_bits).collect();
                    EventTreeSequenceProbability {
                        sequence_id: format!("S{i}"),
                        conditional_probability: 0.2,
                        uncertainty: Some(
                            HclUncertaintySummary::from_samples(&samples, 42).unwrap(),
                        ),
                        uncertainty_samples: Some(samples),
                        diagnostics: EventTreeSequenceDiagnostics {
                            bdd: None,
                            bridge: None,
                            junction_tree: None,
                        },
                    }
                })
                .collect();
            let result = super::event_tree_result_json(&adapter, &probabilities, None).unwrap();
            for sequence in result["sequences"].as_array().unwrap() {
                let i: usize = sequence["sequenceId"].as_str().unwrap()[1..]
                    .parse()
                    .unwrap();
                for (field, bits) in case["annual_bits"][i].as_object().unwrap() {
                    assert_eq!(
                        sequence["uncertainty"]["annualFrequency"][field]
                            .as_f64()
                            .unwrap()
                            .to_bits(),
                        from_bits(bits).to_bits(),
                        "sequence {i} {field}: count {} scale {}",
                        case["count"],
                        adapter.initiating_event_frequency
                    );
                }
                assert_eq!(
                    sequence["uncertainty"]["conditionalProbability"],
                    serde_json::to_value(probabilities[i].uncertainty.as_ref().unwrap()).unwrap()
                );
            }
            for (field, bits) in case["total_bits"].as_object().unwrap() {
                assert_eq!(
                    result["endStateAggregates"][0]["uncertainty"][field]
                        .as_f64()
                        .unwrap()
                        .to_bits(),
                    from_bits(bits).to_bits(),
                    "end-state {field}: count {} scale {}",
                    case["count"],
                    adapter.initiating_event_frequency
                );
            }
        }
    }

    #[test]
    fn quantifies_complete_sequences_without_multiplying_shared_branch_marginals() {
        let request = SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": {
                    "schemaVersion": "1.0.0",
                    "methodType": "EVENT_TREE",
                    "modelId": "ET",
                    "revision": 2,
                    "mode": "INDEPENDENT",
                    "requestedBy": "analyst"
                },
                "modelSnapshots": [
                    fault_tree("FT-A", "TOP-A", "REF-A"),
                    fault_tree("FT-B", "TOP-B", "REF-B"),
                    {
                        "id": "ET",
                        "methodType": "EVENT_TREE",
                        "revision": 2,
                        "initiatingEvent": { "target": { "modelId": "IE", "entityId": "IE-1" } },
                        "initiatingEventFrequency": { "value": 0.01 },
                        "functionalEvents": [
                            { "id": "FE-A", "name": "A", "order": 0 },
                            { "id": "FE-B", "name": "B", "order": 1 }
                        ],
                        "functionalEventFaultTreeLinks": [
                            { "functionalEventId": "FE-A", "faultTreeTopGate": { "modelId": "FT-A", "entityId": "TOP-A" } },
                            { "functionalEventId": "FE-B", "faultTreeTopGate": { "modelId": "FT-B", "entityId": "TOP-B" } }
                        ],
                        "endStates": [{ "id": "SAFE" }, { "id": "RELEASE" }],
                        "sequences": [
                            sequence("SS", "SUCCESS", "SUCCESS", "SAFE"),
                            sequence("SF", "SUCCESS", "FAILURE", "SAFE"),
                            sequence("FS", "FAILURE", "SUCCESS", "SAFE"),
                            sequence("FF", "FAILURE", "FAILURE", "RELEASE")
                        ]
                    }
                ],
                "resources": {
                    "faultTreeBasicEventCatalogue": {
                        "projectId": "P",
                        "basicEvents": [{ "id": "SHARED", "probability": { "value": 0.2 } }]
                    }
                }
            })
            .to_string(),
        )
        .unwrap();

        let result = execute(&request).unwrap();
        let probabilities: HashMap<&str, f64> = result["sequences"]
            .as_array()
            .unwrap()
            .iter()
            .map(|sequence| {
                (
                    sequence["sequenceId"].as_str().unwrap(),
                    sequence["conditionalProbability"].as_f64().unwrap(),
                )
            })
            .collect();
        assert!((probabilities["SS"] - 0.8).abs() < 1e-12);
        assert!(probabilities["SF"].abs() < 1e-12);
        assert!(probabilities["FS"].abs() < 1e-12);
        assert!((probabilities["FF"] - 0.2).abs() < 1e-12);
        assert!(
            (result["endStateAggregates"][0]["annualFrequency"]
                .as_f64()
                .unwrap()
                - 0.002)
                .abs()
                < 1e-12
        );
        assert!(
            (result["endStateAggregates"][1]["annualFrequency"]
                .as_f64()
                .unwrap()
                - 0.008)
                .abs()
                < 1e-12
        );
    }

    #[test]
    fn quantifies_a_bypassed_functional_event_with_unit_probability() {
        let request = SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": {
                    "schemaVersion": "1.0.0",
                    "methodType": "EVENT_TREE",
                    "modelId": "ET-BYPASS",
                    "revision": 1,
                    "mode": "INDEPENDENT",
                    "requestedBy": "analyst"
                },
                "modelSnapshots": [{
                    "id": "ET-BYPASS",
                    "methodType": "EVENT_TREE",
                    "revision": 1,
                    "initiatingEvent": { "target": { "modelId": "IE", "entityId": "IE-1" } },
                    "initiatingEventFrequency": { "value": 0.01 },
                    "functionalEvents": [{ "id": "FE-A", "name": "A", "order": 0 }],
                    "functionalEventFaultTreeLinks": [],
                    "endStates": [{ "id": "SAFE" }],
                    "sequences": [{
                        "id": "B",
                        "path": [{ "functionalEventId": "FE-A", "outcome": "BYPASSED" }],
                        "result": { "kind": "END_STATE", "endStateId": "SAFE" }
                    }]
                }],
                "resources": {
                    "faultTreeBasicEventCatalogue": { "projectId": "P", "basicEvents": [] }
                }
            })
            .to_string(),
        )
        .unwrap();

        let result = execute(&request).unwrap();
        assert_eq!(result["sequences"][0]["conditionalProbability"], 1.0);
        assert_eq!(result["sequences"][0]["annualFrequency"], 0.01);
        assert_eq!(
            result["sequences"][0]["diagnostics"],
            json!({
                "bdd": null, "bridge": null, "junctionTree": null
            })
        );
    }

    #[test]
    fn annualizes_typed_initiating_frequency_before_sequence_aggregation() {
        let request = SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": {
                    "schemaVersion": "1.0.0",
                    "methodType": "EVENT_TREE",
                    "modelId": "ET-ANNUAL",
                    "revision": 1,
                    "mode": "INDEPENDENT",
                    "requestedBy": "analyst"
                },
                "modelSnapshots": [{
                    "id": "ET-ANNUAL",
                    "methodType": "EVENT_TREE",
                    "revision": 1,
                    "initiatingEvent": { "target": { "modelId": "IE", "entityId": "IE-1" } },
                    "initiatingEventFrequency": {
                        "value": 2.0e-5,
                        "unit": "PER_HOUR",
                        "annualization": { "basis": "CRITICAL_YEAR", "hoursPerYear": 7000.0 }
                    },
                    "functionalEvents": [{ "id": "FE-A", "name": "A", "order": 0 }],
                    "functionalEventFaultTreeLinks": [],
                    "endStates": [{ "id": "SAFE" }],
                    "sequences": [{
                        "id": "B",
                        "path": [{ "functionalEventId": "FE-A", "outcome": "BYPASSED" }],
                        "result": { "kind": "END_STATE", "endStateId": "SAFE" }
                    }]
                }],
                "resources": {
                    "faultTreeBasicEventCatalogue": { "projectId": "P", "basicEvents": [] }
                }
            })
            .to_string(),
        )
        .unwrap();

        let result = execute(&request).unwrap();
        assert!((result["sequences"][0]["annualFrequency"].as_f64().unwrap() - 0.14).abs() < 1e-15);
        assert_eq!(
            result["frequencySemantics"]["initiatingEventFrequency"]["unit"],
            "PER_HOUR"
        );
        assert_eq!(
            result["frequencySemantics"]["annualization"]["basis"],
            "CRITICAL_YEAR"
        );
        assert_eq!(
            result["frequencySemantics"]["annualizedInitiatingEventFrequency"]["unit"],
            "PER_YEAR"
        );
    }

    fn transfer_request(events: &[(&str, f64)]) -> SolverRequest {
        let mut snapshots = Vec::new();
        let mut catalogue = HashMap::new();
        for (i, (event, probability)) in events.iter().enumerate() {
            let mut ft = fault_tree(&format!("FT-{i}"), &format!("TOP-{i}"), &format!("REF-{i}"));
            ft["leafNodes"][0]["basicEventId"] = json!(event);
            snapshots.push(ft);
            catalogue.insert(*event, *probability);
            snapshots.push(json!({
                "id": format!("ET-{i}"), "methodType": "EVENT_TREE", "revision": 1,
                "initiatingEvent": {"target": {"modelId": "IE", "entityId": "IE-1"}},
                "initiatingEventFrequency": {"value": 0.01},
                "functionalEvents": [{"id": format!("FE-{i}"), "name": event, "order": 0}],
                "functionalEventFaultTreeLinks": [{"functionalEventId": format!("FE-{i}"),
                    "faultTreeTopGate": {"modelId": format!("FT-{i}"), "entityId": format!("TOP-{i}")}}],
                "endStates": [{"id": format!("SAFE-{i}")}, {"id": "RELEASE"}],
                "sequences": [
                    {"id": format!("S-{i}"), "path": [{"functionalEventId": format!("FE-{i}"), "outcome": "SUCCESS"}],
                     "result": {"kind": "END_STATE", "endStateId": format!("SAFE-{i}")}},
                    {"id": format!("F-{i}"), "path": [{"functionalEventId": format!("FE-{i}"), "outcome": "FAILURE"}],
                     "result": if i + 1 < events.len() { json!({"kind": "TRANSFER", "target": {"modelId": format!("ET-{}", i + 1)}}) }
                               else { json!({"kind": "END_STATE", "endStateId": "RELEASE"}) }}
                ]
            }));
        }
        SolverRequest::from_json(&json!({
            "schemaVersion": "1.0.0",
            "request": {"schemaVersion": "1.0.0", "methodType": "EVENT_TREE", "modelId": "ET-0", "revision": 1,
                "mode": "INDEPENDENT", "requestedBy": "analyst"},
            "modelSnapshots": snapshots,
            "resources": {"faultTreeBasicEventCatalogue": {"projectId": "P", "basicEvents": catalogue.into_iter()
                .map(|(id, probability)| json!({"id": id, "probability": {"value": probability}})).collect::<Vec<_>>()}}
        }).to_string()).unwrap()
    }

    fn terminal_probability(result: &Value, end_state: &str) -> f64 {
        result["sequences"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|sequence| sequence["result"]["endStateId"] == end_state)
            .map(|sequence| sequence["conditionalProbability"].as_f64().unwrap())
            .sum()
    }

    #[test]
    fn transfers_preserve_bn_dependence_and_reset_evidence_between_scenarios() {
        let mut request = transfer_request(&[("A", 0.2), ("B", 0.24)]);
        request.request["mode"] = json!("HYBRID_CAUSAL_LOGIC");
        request.model_snapshots[1]["hclConfiguration"] =
            json!({"configuration": {"modelId": "HCL"}});
        let values = |event: &str, p: f64| {
            json!([
                {"stateId": format!("{event}-0"), "probability": 1.0 - p},
                {"stateId": format!("{event}-1"), "probability": p}
            ])
        };
        request.model_snapshots.push(json!({
            "id": "BN", "methodType": "BAYESIAN_NETWORK", "revision": 1,
            "nodes": (["A", "B"].map(|id| json!({"id": id, "states": [{"id": format!("{id}-0")}, {"id": format!("{id}-1")}]}))),
            "conditionalProbabilityTables": [
                {"nodeId": "A", "parents": [], "rows": [{"id": "a", "parentStates": [], "values": values("A", 0.2)}]},
                {"nodeId": "B", "parents": [{"nodeId": "A", "order": 0}], "rows": [
                    {"id": "b0", "parentStates": [{"parentNodeId": "A", "stateId": "A-0"}], "values": values("B", 0.1)},
                    {"id": "b1", "parentStates": [{"parentNodeId": "A", "stateId": "A-1"}], "values": values("B", 0.8)}
                ]}
            ]
        }));
        request.model_snapshots.push(json!({
            "id": "HCL", "methodType": "HYBRID_CAUSAL_LOGIC", "revision": 1,
            "bayesianNetwork": {"modelId": "BN"},
            "faultTrees": [{"faultTree": {"modelId": "FT-0"}}, {"faultTree": {"modelId": "FT-1"}}],
            "bindings": (["A", "B"].iter().enumerate().map(|(i, event)| json!({
                "id": format!("binding-{event}"),
                "faultTreeBasicEvent": {"modelId": format!("FT-{i}"), "entityId": event},
                "bayesianNetworkNode": {"modelId": "BN", "entityId": event}, "trueStateIds": [format!("{event}-1")]
            })).collect::<Vec<_>>()),
            "baseEvidence": {"observations": []},
            "solverSettings": {"foldConstants": false, "spliceNullGates": false}
        }));
        let result = execute(&request).unwrap();
        assert!((terminal_probability(&result, "RELEASE") - 0.16).abs() < 1e-12);
        assert!((terminal_probability(&result, "SAFE-1") - 0.04).abs() < 1e-12);
        for (state, probability) in [("SAFE-0", 0.8), ("SAFE-1", 0.04), ("RELEASE", 0.16)] {
            let sequence = result["sequences"]
                .as_array()
                .unwrap()
                .iter()
                .find(|sequence| sequence["result"]["endStateId"] == state)
                .unwrap();
            assert!(
                (sequence["conditionalProbability"].as_f64().unwrap() - probability).abs() < 1e-12
            );
            assert!(sequence.get("cutSets").is_none());
            assert!(sequence.get("importance").is_none());
        }
        let mut single_outcome = request.clone();
        single_outcome.model_snapshots[1]["sequences"]
            .as_array_mut()
            .unwrap()
            .retain(|s| s["path"][0]["outcome"] == "FAILURE");
        let partial = execute(&single_outcome).unwrap();
        assert_eq!(partial["sequences"].as_array().unwrap().len(), 2);
        assert!((terminal_probability(&partial, "SAFE-1") - 0.04).abs() < 1e-12);
        assert!((terminal_probability(&partial, "RELEASE") - 0.16).abs() < 1e-12);

        request.request["evidenceBatch"] = json!([
            {"scenarioId": "A-TRUE", "observations": [{"nodeId": "A", "stateId": "A-1"}]},
            {"scenarioId": "A-FALSE", "observations": [{"nodeId": "A", "stateId": "A-0"}]}
        ]);
        let result = execute(&request).unwrap();
        assert!((terminal_probability(&result["batchResults"][0], "RELEASE") - 0.8).abs() < 1e-12);
        assert_eq!(
            terminal_probability(&result["batchResults"][1], "RELEASE"),
            0.0
        );
    }

    #[test]
    fn transfers_include_destination_success_and_failure_conditions() {
        let request = transfer_request(&[("A", 0.2), ("B", 0.3)]);
        let result = execute(&request).unwrap();
        assert_eq!(result["sequences"].as_array().unwrap().len(), 3);
        for (state, probability) in [("SAFE-0", 0.8), ("SAFE-1", 0.14), ("RELEASE", 0.06)] {
            assert!((terminal_probability(&result, state) - probability).abs() < 1e-12);
        }
        let released = result["sequences"]
            .as_array()
            .unwrap()
            .iter()
            .find(|sequence| sequence["result"]["endStateId"] == "RELEASE")
            .unwrap();
        assert_eq!(released["path"].as_array().unwrap().len(), 2);
        assert_eq!(
            released["sequenceChain"],
            json!([
                {"modelId": "ET-0", "entityId": "F-0"}, {"modelId": "ET-1", "entityId": "F-1"}
            ])
        );
        assert!((released["annualFrequency"].as_f64().unwrap() - 0.0006).abs() < 1e-12);
        assert_eq!(result["sequences"], execute(&request).unwrap()["sequences"]);
    }

    #[test]
    fn single_outcome_transfers_preserve_conditions_without_normalizing() {
        for (outcome, expected) in [("SUCCESS", 0.14), ("FAILURE", 0.06)] {
            let mut request = transfer_request(&[("A", 0.2), ("B", 0.3)]);
            for (snapshot, retained) in [(1, "FAILURE"), (3, outcome)] {
                request.model_snapshots[snapshot]["sequences"]
                    .as_array_mut()
                    .unwrap()
                    .retain(|s| s["path"][0]["outcome"] == retained);
            }
            let result = execute(&request).unwrap();
            let sequences = result["sequences"].as_array().unwrap();
            assert_eq!(sequences.len(), 1);
            assert!(
                (sequences[0]["conditionalProbability"].as_f64().unwrap() - expected).abs() < 1e-12
            );
            assert!(
                (sequences[0]["annualFrequency"].as_f64().unwrap() - expected * 0.01).abs() < 1e-12
            );
            assert_eq!(sequences[0]["path"][0]["outcome"], "FAILURE");
            assert_eq!(sequences[0]["path"][1]["outcome"], outcome);
        }
    }

    #[test]
    fn rejects_empty_duplicate_and_mixed_bypass_paths() {
        let request = transfer_request(&[("A", 0.2)]);
        for sequences in [
            json!([]),
            json!(vec![request.model_snapshots[1]["sequences"][0].clone(); 2]),
            json!([
                request.model_snapshots[1]["sequences"][0].clone(),
                {"id": "BYPASS", "path": [{"functionalEventId": "FE-0", "outcome": "BYPASSED"}],
                 "result": {"kind": "END_STATE", "endStateId": "RELEASE"}}
            ]),
        ] {
            let mut invalid = request.clone();
            invalid.model_snapshots[1]["sequences"] = sequences;
            assert!(execute(&invalid).is_err());
        }
    }

    #[test]
    fn transfers_preserve_shared_events_and_distinct_incoming_paths() {
        let mut request = transfer_request(&[("A", 0.2), ("A", 0.2)]);
        let result = execute(&request).unwrap();
        assert!((terminal_probability(&result, "RELEASE") - 0.2).abs() < 1e-12);
        assert_eq!(terminal_probability(&result, "SAFE-1"), 0.0);
        request.model_snapshots[1]["sequences"][0]["result"] =
            json!({"kind": "TRANSFER", "target": {"modelId": "ET-1"}});
        let result = execute(&request).unwrap();
        let sequences = result["sequences"].as_array().unwrap();
        assert_eq!(sequences.len(), 4);
        let ids: std::collections::HashSet<_> = sequences
            .iter()
            .map(|sequence| sequence["sequenceId"].as_str().unwrap())
            .collect();
        assert_eq!(ids.len(), 4);
        assert!((terminal_probability(&result, "SAFE-1") - 0.8).abs() < 1e-12);
        assert!((terminal_probability(&result, "RELEASE") - 0.2).abs() < 1e-12);
    }

    #[test]
    fn follows_transfer_chains_and_rejects_missing_trees_and_loops() {
        let mut request = transfer_request(&[("A", 0.2), ("B", 0.3), ("C", 0.4)]);
        assert!(
            (terminal_probability(&execute(&request).unwrap(), "RELEASE") - 0.024).abs() < 1e-12
        );
        request.model_snapshots[5]["sequences"][1]["result"] =
            json!({"kind": "TRANSFER", "target": {"modelId": "MISSING"}});
        assert!(execute(&request)
            .unwrap_err()
            .to_string()
            .contains("is missing"));
        request.model_snapshots[5]["sequences"][1]["result"]["target"]["modelId"] = json!("ET-0");
        assert!(execute(&request)
            .unwrap_err()
            .to_string()
            .contains("transfer loop"));
    }

    fn fault_tree(id: &str, top: &str, reference: &str) -> Value {
        json!({
            "id": id,
            "projectId": "P",
            "methodType": "FAULT_TREE",
            "revision": 2,
            "topGate": { "gateId": top },
            "gates": [{ "id": top, "gateType": "OR" }],
            "leafNodes": [{ "id": reference, "kind": "BASIC_EVENT_REFERENCE", "basicEventId": "SHARED" }],
            "gateInputs": [{ "id": format!("INPUT-{id}"), "gateId": top, "childId": reference, "order": 0 }]
        })
    }

    fn sequence(id: &str, first: &str, second: &str, end_state: &str) -> Value {
        json!({
            "id": id,
            "path": [
                { "functionalEventId": "FE-A", "outcome": first },
                { "functionalEventId": "FE-B", "outcome": second }
            ],
            "result": { "kind": "END_STATE", "endStateId": end_state }
        })
    }
}
