use std::collections::{HashMap, HashSet};

use praxis::analysis::event_tree_quantification::{
    quantify_event_tree_hazard_grid_batch, quantify_event_tree_sequences,
    quantify_event_tree_sequences_batch, summarize_event_tree_hazard_uncertainty,
    EventTreeHazardGridQuantification, EventTreeHclContext, EventTreeSequenceProbability,
};
use praxis::core::event_tree::{
    Branch, BranchTarget, EventTree, Fork, FunctionalEvent, Path, Sequence,
};
use praxis::core::model::Model;
use praxis::hcl::{
    HclCutSetAnalysis, HclEvidenceSpec, HclImportanceAnalysis, HclUncertaintySummary,
};
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EventTreeExecuteRequest {
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

#[derive(Clone, Debug, Deserialize)]
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
        target: EntityReference,
    },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SequenceResult<'a> {
    sequence_id: &'a str,
    path: &'a [EventTreePathStep],
    result: &'a EventTreeBranchResult,
    conditional_probability: f64,
    annual_frequency: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    cut_sets: Option<&'a HclCutSetAnalysis>,
    #[serde(skip_serializing_if = "Option::is_none")]
    importance: Option<&'a HclImportanceAnalysis>,
    #[serde(skip_serializing_if = "Option::is_none")]
    uncertainty: Option<EventTreeSequenceUncertainty>,
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
    event_tree_snapshots: HashMap<String, EventTreeSnapshot>,
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
    let mut event_tree_snapshots = parse_event_tree_snapshots(request)?;
    let snapshot = event_tree_snapshots
        .remove(&execute.model_id)
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

    let mut functional_events = snapshot.functional_events.clone();
    functional_events.sort_by_key(|event| event.order);
    if functional_events
        .iter()
        .enumerate()
        .any(|(order, event)| event.order != order)
    {
        return Err(PraxisError::Logic(
            "event-tree functional-event order must be contiguous from zero".to_string(),
        ));
    }
    let links: HashMap<&str, &FunctionalEventFaultTreeLink> = snapshot
        .functional_event_fault_tree_links
        .iter()
        .map(|link| (link.functional_event_id.as_str(), link))
        .collect();
    if links.len() != snapshot.functional_event_fault_tree_links.len() {
        return Err(PraxisError::Logic(
            "event-tree contains duplicate functional-event fault-tree links".to_string(),
        ));
    }

    let mut model = Model::new(format!("event-tree-{}", snapshot.id))?;
    let mut added_fault_trees = HashSet::new();
    let mut core_functional_events = Vec::with_capacity(functional_events.len());
    for functional_event in &functional_events {
        let link = links.get(functional_event.id.as_str());
        let bypassed_everywhere = !snapshot.sequences.is_empty()
            && snapshot.sequences.iter().all(|sequence| {
                sequence.path.iter().any(|step| {
                    step.functional_event_id == functional_event.id
                        && step.outcome == EventTreeBranchOutcome::Bypassed
                })
            });
        if link.is_none() && !bypassed_everywhere {
            return Err(PraxisError::Logic(format!(
                "functional event '{}' has no fault-tree top-gate link",
                functional_event.id
            )));
        }
        if let Some(link) = link {
            if added_fault_trees.insert(link.fault_tree_top_gate.model_id.clone()) {
                let adapter =
                    build_fault_tree_for_model(request, &link.fault_tree_top_gate.model_id)?;
                if adapter.top_gate_id != link.fault_tree_top_gate.entity_id {
                    return Err(PraxisError::Logic(format!(
                    "functional event '{}' references top gate '{}' but fault tree '{}' uses '{}'",
                    functional_event.id,
                    link.fault_tree_top_gate.entity_id,
                    link.fault_tree_top_gate.model_id,
                    adapter.top_gate_id
                )));
                }
                model.add_fault_tree(adapter.fault_tree)?;
            }
        }
        let order = i32::try_from(functional_event.order).map_err(|_| {
            PraxisError::Logic("functional-event order exceeds PRAXIS range".to_string())
        })?;
        let core_event = FunctionalEvent::new(functional_event.id.clone())
            .with_name(functional_event.name.clone())
            .with_order(order);
        core_functional_events.push(match link {
            Some(link) => core_event.with_fault_tree(link.fault_tree_top_gate.model_id.clone()),
            None => core_event,
        });
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
            )?)
        }
    };

    let ordered_ids: Vec<&str> = functional_events
        .iter()
        .map(|event| event.id.as_str())
        .collect();
    let sequence_refs: Vec<&EventTreeSequenceSnapshot> = snapshot.sequences.iter().collect();
    let initial_state = build_branch(&ordered_ids, &sequence_refs, 0)?;
    let mut event_tree = EventTree::new(snapshot.id.clone(), initial_state);
    for functional_event in core_functional_events {
        event_tree.add_functional_event(functional_event)?;
    }
    for sequence in &snapshot.sequences {
        event_tree.add_sequence(Sequence::new(sequence.id.clone()))?;
    }
    event_tree.validate()?;

    event_tree_snapshots.insert(snapshot.id.clone(), snapshot.clone());
    Ok(EventTreeAdapter {
        model_id: snapshot.id.clone(),
        model_revision: snapshot.revision,
        mode: execute.mode,
        initiating_event_frequency: annualized_initiating_event_frequency,
        initiating_event_frequency_input: snapshot.initiating_event_frequency.clone(),
        annualization,
        event_tree,
        model,
        snapshot,
        event_tree_snapshots,
        hcl_context,
        evidence_batch: execute.evidence_batch,
        hazard_convolution: execute.hazard_convolution,
    })
}

fn build_branch(
    ordered_functional_event_ids: &[&str],
    candidates: &[&EventTreeSequenceSnapshot],
    depth: usize,
) -> Result<Branch> {
    if depth == ordered_functional_event_ids.len() {
        if candidates.len() != 1 {
            return Err(PraxisError::Logic(format!(
                "event-tree path resolves to {} sequences instead of exactly one",
                candidates.len()
            )));
        }
        return Ok(Branch::new(BranchTarget::Sequence(
            candidates[0].id.clone(),
        )));
    }

    let functional_event_id = ordered_functional_event_ids[depth];
    let mut paths = Vec::with_capacity(3);
    for outcome in [
        EventTreeBranchOutcome::Success,
        EventTreeBranchOutcome::Failure,
        EventTreeBranchOutcome::Bypassed,
    ] {
        let matching: Vec<&EventTreeSequenceSnapshot> = candidates
            .iter()
            .copied()
            .filter(|sequence| {
                sequence.path.get(depth).is_some_and(|step| {
                    step.functional_event_id == functional_event_id && step.outcome == outcome
                })
            })
            .collect();
        if matching.is_empty() {
            continue;
        }
        let state = match outcome {
            EventTreeBranchOutcome::Success => "success",
            EventTreeBranchOutcome::Failure => "failure",
            EventTreeBranchOutcome::Bypassed => "bypass",
        };
        let path = Path::new(
            state.to_string(),
            build_branch(ordered_functional_event_ids, &matching, depth + 1)?,
        )?;
        paths.push(if outcome == EventTreeBranchOutcome::Bypassed {
            path.with_probability(1.0)
        } else {
            path.with_collect_formula_negated(outcome == EventTreeBranchOutcome::Success)
        });
    }
    let has_bypass = paths.iter().any(|path| path.state == "bypass");
    if (has_bypass && paths.len() != 1) || (!has_bypass && paths.len() != 2) {
        return Err(PraxisError::Logic(format!(
            "functional event '{}' must define success and failure paths or one bypass path",
            functional_event_id
        )));
    }
    Ok(Branch::new(BranchTarget::Fork(Fork::new(
        functional_event_id.to_string(),
        paths,
    )?)))
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
                .scenarios[0]
                    .len()
            } else {
                quantify_event_tree_sequences_batch(
                    &adapter.model,
                    &adapter.event_tree,
                    validation_hcl_context.as_ref(),
                    &evidence,
                )?
                .scenarios[0]
                    .len()
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

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let adapter = build_adapter(request)?;
    if let Some(rows) = &adapter.evidence_batch {
        validate_evidence_rows(rows)?;
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
            let integration =
                event_tree_hazard_convolution_json(rows, hazard, &weighted, &adapter)?;
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
        let batch_results = rows
            .iter()
            .zip(batch.scenarios.iter())
            .map(|(row, probabilities)| {
                event_tree_result_json(&adapter, probabilities, Some(&row.scenario_id))
            })
            .collect::<Result<Vec<_>>>()?;
        let mut response = json!({
            "methodType": EVENT_TREE_METHOD,
            "modelId": adapter.model_id,
            "modelRevision": adapter.model_revision,
            "mode": adapter.mode,
            "batchResults": batch_results,
            "compilationReuse": {
                "sequenceBddCompilations": batch.compilation.sequence_bdd_compilations,
                "junctionTreeCompilations": batch.compilation.junction_tree_compilations,
                "scenarioEvaluations": batch.compilation.scenario_evaluations
            }
        });
        if let Some(hazard_convolution) = hazard_convolution {
            response["hazardConvolution"] = hazard_convolution;
        }
        return Ok(response);
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
        let end_state_id = resolve_end_state(
            &adapter.model_id,
            &sequence.id,
            &adapter.event_tree_snapshots,
            &mut HashSet::new(),
        )?;
        *aggregate_by_end_state
            .entry(end_state_id.clone())
            .or_default() += annual_frequency;
        if let Some(samples) = &quantified.uncertainty_samples {
            let aggregate = aggregate_samples_by_end_state
                .entry(end_state_id.clone())
                .or_insert_with(|| vec![0.0; samples.len()]);
            if aggregate.len() != samples.len() {
                return Err(PraxisError::Hcl(
                    "event-tree uncertainty sequences use inconsistent sample populations"
                        .to_string(),
                ));
            }
            for (total, sample) in aggregate.iter_mut().zip(samples) {
                *total += sample * adapter.initiating_event_frequency;
            }
        }
        sequences.push(SequenceResult {
            sequence_id: &sequence.id,
            path: &sequence.path,
            result: &sequence.result,
            conditional_probability,
            annual_frequency,
            cut_sets: quantified.cut_sets.as_ref(),
            importance: quantified.importance.as_ref(),
            uncertainty: quantified.uncertainty.as_ref().map(|summary| {
                EventTreeSequenceUncertainty {
                    conditional_probability: summary.clone(),
                    annual_frequency: summary.scaled(adapter.initiating_event_frequency),
                }
            }),
        });
    }

    let declared_end_states: HashSet<&str> = adapter
        .event_tree_snapshots
        .values()
        .flat_map(|snapshot| snapshot.end_states.iter().map(|state| state.id.as_str()))
        .collect();
    if let Some(undeclared) = aggregate_by_end_state
        .keys()
        .find(|end_state_id| !declared_end_states.contains(end_state_id.as_str()))
    {
        return Err(PraxisError::Logic(format!(
            "event-tree result resolves undeclared end state '{undeclared}'"
        )));
    }
    let mut end_state_aggregates: Vec<Value> = aggregate_by_end_state
        .into_iter()
        .map(|(end_state_id, annual_frequency)| {
            let uncertainty =
                aggregate_samples_by_end_state
                    .get(&end_state_id)
                    .and_then(|samples| {
                        probabilities
                            .iter()
                            .find_map(|sequence| {
                                sequence.uncertainty.as_ref().map(|summary| summary.seed)
                            })
                            .and_then(|seed| {
                                HclUncertaintySummary::from_samples(samples, seed).ok()
                            })
                    });
            let mut value =
                json!({ "endStateId": end_state_id, "annualFrequency": annual_frequency });
            if let Some(uncertainty) = uncertainty {
                value["uncertainty"] = json!(uncertainty);
            }
            value
        })
        .collect();
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
    let mut sequence_totals: HashMap<String, f64> = HashMap::new();
    let mut end_state_totals: HashMap<String, f64> = HashMap::new();
    let mut end_state_by_sequence: HashMap<String, String> = HashMap::new();
    let result_rows = rows
        .iter()
        .zip(batch.quantification.scenarios.iter())
        .zip(weights.weights.iter())
        .map(|((row, probabilities), weight)| {
            let sequences = probabilities
                .iter()
                .map(|probability| {
                    let contribution =
                        weight.annual_frequency * probability.conditional_probability;
                    *sequence_totals
                        .entry(probability.sequence_id.clone())
                        .or_default() += contribution;
                    let end_state_id = resolve_end_state(
                        &adapter.model_id,
                        &probability.sequence_id,
                        &adapter.event_tree_snapshots,
                        &mut HashSet::new(),
                    )?;
                    end_state_by_sequence
                        .entry(probability.sequence_id.clone())
                        .or_insert_with(|| end_state_id.clone());
                    *end_state_totals.entry(end_state_id).or_default() += contribution;
                    Ok(json!({
                        "sequenceId": probability.sequence_id,
                        "conditionalProbability": probability.conditional_probability,
                        "annualContribution": contribution
                    }))
                })
                .collect::<Result<Vec<_>>>()?;
            Ok(json!({
                "scenarioId": row.scenario_id,
                "rawWeight": weight.raw_weight,
                "normalizedWeight": weight.normalized_weight,
                "convolutionWeight": weight.convolution_weight,
                "annualFrequency": weight.annual_frequency,
                "sequences": sequences
            }))
        })
        .collect::<Result<Vec<_>>>()?;
    let uncertainty = summarize_event_tree_hazard_uncertainty(
        batch,
        &end_state_by_sequence,
        scale.value,
        scale.unit,
        scale.annualization,
        hazard.normalize_weights,
    )?;
    let mut sequences: Vec<Value> = sequence_totals
        .into_iter()
        .map(|(sequence_id, integrated_annual_frequency)| {
            let uncertainty = uncertainty.sequences.get(&sequence_id);
            let mut value = json!({
                "sequenceId": sequence_id,
                "integratedAnnualFrequency": integrated_annual_frequency
            });
            if let Some(uncertainty) = uncertainty {
                value["uncertainty"] = json!(uncertainty);
            }
            value
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
            let uncertainty = uncertainty.end_states.get(&end_state_id);
            let mut value = json!({
                "endStateId": end_state_id,
                "integratedAnnualFrequency": integrated_annual_frequency
            });
            if let Some(uncertainty) = uncertainty {
                value["uncertainty"] = json!(uncertainty);
            }
            value
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

fn resolve_end_state(
    model_id: &str,
    sequence_id: &str,
    snapshots: &HashMap<String, EventTreeSnapshot>,
    visited: &mut HashSet<(String, String)>,
) -> Result<String> {
    if !visited.insert((model_id.to_string(), sequence_id.to_string())) {
        return Err(PraxisError::Logic(format!(
            "event-tree transfer loop reaches '{model_id}:{sequence_id}'"
        )));
    }
    let snapshot = snapshots.get(model_id).ok_or_else(|| {
        PraxisError::Logic(format!("event-tree transfer model '{model_id}' is missing"))
    })?;
    let sequence = snapshot
        .sequences
        .iter()
        .find(|sequence| sequence.id == sequence_id)
        .ok_or_else(|| {
            PraxisError::Logic(format!(
                "event-tree transfer sequence '{model_id}:{sequence_id}' is missing"
            ))
        })?;
    match &sequence.result {
        EventTreeBranchResult::EndState { end_state_id } => Ok(end_state_id.clone()),
        EventTreeBranchResult::Transfer { target } => {
            resolve_end_state(&target.model_id, &target.entity_id, snapshots, visited)
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::{HashMap, HashSet};

    use serde_json::json;
    use serde_json::Value;

    use super::{execute, resolve_end_state, EventTreeSnapshot};
    use crate::transport::SolverRequest;

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

    #[test]
    fn resolves_transfer_chains_and_rejects_transfer_loops() {
        let source: EventTreeSnapshot = serde_json::from_value(json!({
            "id": "ET-SOURCE",
            "methodType": "EVENT_TREE",
            "revision": 1,
            "initiatingEvent": { "target": { "modelId": "IE", "entityId": "IE-1" } },
            "initiatingEventFrequency": { "value": 1.0 },
            "functionalEvents": [],
            "functionalEventFaultTreeLinks": [],
            "endStates": [],
            "sequences": [{
                "id": "TRANSFER",
                "path": [],
                "result": {
                    "kind": "TRANSFER",
                    "target": { "modelId": "ET-TARGET", "entityId": "TARGET" }
                }
            }]
        }))
        .unwrap();
        let target: EventTreeSnapshot = serde_json::from_value(json!({
            "id": "ET-TARGET",
            "methodType": "EVENT_TREE",
            "revision": 1,
            "initiatingEvent": { "target": { "modelId": "IE", "entityId": "IE-1" } },
            "initiatingEventFrequency": { "value": 1.0 },
            "functionalEvents": [],
            "functionalEventFaultTreeLinks": [],
            "endStates": [{ "id": "SAFE" }],
            "sequences": [{
                "id": "TARGET",
                "path": [],
                "result": { "kind": "END_STATE", "endStateId": "SAFE" }
            }]
        }))
        .unwrap();
        let mut snapshots =
            HashMap::from([(source.id.clone(), source), (target.id.clone(), target)]);

        let end_state =
            resolve_end_state("ET-SOURCE", "TRANSFER", &snapshots, &mut HashSet::new()).unwrap();
        assert_eq!(end_state, "SAFE");

        snapshots.get_mut("ET-TARGET").unwrap().sequences[0].result =
            serde_json::from_value(json!({
                "kind": "TRANSFER",
                "target": { "modelId": "ET-SOURCE", "entityId": "TRANSFER" }
            }))
            .unwrap();
        let error = resolve_end_state("ET-SOURCE", "TRANSFER", &snapshots, &mut HashSet::new())
            .unwrap_err();
        assert!(error.to_string().contains("transfer loop"));
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
