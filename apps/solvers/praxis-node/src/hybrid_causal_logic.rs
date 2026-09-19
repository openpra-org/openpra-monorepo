use std::collections::{HashMap, HashSet};

use praxis::analysis::event_tree_quantification::EventTreeHclContext;
use praxis::hcl::{
    analyze_hcl, ensure_hazard_convolution_supported, quantify_hcl, quantify_hcl_batch,
    quantify_hcl_hazard_grid_batch, validate_hcl_uncertainty_settings, HclAnalysisResult,
    HclAnalysisSettings, HclBasicEventUncertaintySpec, HclBindingSpec, HclCptGenerator,
    HclCptGeneratorSpec, HclCptPrior, HclCptRowUncertaintySpec, HclEvidenceSpec,
    HclHazardGridBatchResult, HclModel, HclProbabilityDistribution, HclSampler, HclSettings,
    HclUncertaintySettings,
};
use praxis::quantitative::{
    prepare_hazard_weights, AnnualizationConvention, FrequencyUnit, HazardWeightSummary,
};
use praxis::{PraxisError, Result};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::bayesian_network::{build_network_for_model_with_cpt_rows, CptRowIndexMap};
use crate::fault_tree::{
    basic_event_ids_for_model, build_fault_tree_for_model, BasicEventQuantificationRecord,
};
use crate::transport::SolverRequest;

const HCL_METHOD: &str = "HYBRID_CAUSAL_LOGIC";

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(crate) enum HclCalculationType {
    #[default]
    Probability,
    Uncertainty,
}

impl HclCalculationType {
    pub(crate) fn ensure_hazard_supported(self, requested: bool) -> Result<()> {
        if requested && self == Self::Uncertainty {
            return Err(PraxisError::Hcl(
                "Hazard convolution supports point runs only. Select probability or use evidence scenarios.".into(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclExecuteRequest {
    #[serde(default)]
    calculation_type: HclCalculationType,
    schema_version: String,
    method_type: String,
    model_id: String,
    revision: u64,
    requested_by: String,
    fault_tree_top_gate: EntityReference,
    evidence_batch: Option<Vec<HclEvidenceRow>>,
    hazard_convolution: Option<HazardConvolutionRequest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclEvidenceRow {
    scenario_id: String,
    observations: Vec<HclObservation>,
    #[serde(default)]
    hazard_observations: Vec<HclObservation>,
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

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EntityReference {
    model_id: String,
    entity_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HclSnapshot {
    id: String,
    method_type: String,
    revision: u64,
    bayesian_network: ModelReference,
    fault_trees: Vec<FaultTreeReferenceContainer>,
    bindings: Vec<HclBinding>,
    base_evidence: HclEvidence,
    solver_settings: HclSolverSettings,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ModelReference {
    model_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FaultTreeReferenceContainer {
    fault_tree: ModelReference,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclBinding {
    id: String,
    fault_tree_basic_event: EntityReference,
    bayesian_network_node: EntityReference,
    true_state_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct HclEvidence {
    observations: Vec<HclObservation>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclObservation {
    node_id: String,
    state_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclSolverSettings {
    variable_order: Option<Vec<String>>,
    fold_constants: bool,
    splice_null_gates: bool,
    uncertainty: Option<Value>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclUncertaintySnapshot {
    #[serde(default, alias = "basicEventSampler")]
    sampler: HclSampler,
    #[serde(default)]
    cpt_probability_clip_epsilon: f64,
    sample_count: usize,
    seed: u64,
    basic_event_distributions: Vec<HclBasicEventUncertaintySnapshot>,
    cpt_row_distributions: Vec<HclCptRowUncertaintySnapshot>,
    #[serde(default)]
    cpt_generators: Vec<HclCptGeneratorSnapshot>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclBasicEventUncertaintySnapshot {
    fault_tree_basic_event: BasicEventReference,
    distribution: HclProbabilityDistribution,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BasicEventReference {
    entity_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclCptRowUncertaintySnapshot {
    bayesian_network_node: EntityReference,
    cpt_row_id: String,
    prior: HclCptPrior,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct HclCptGeneratorSnapshot {
    bayesian_network_node: EntityReference,
    generator: HclCptGenerator,
}

fn resolve_uncertainty(
    calculation_type: HclCalculationType,
    uncertainty: Option<Value>,
    bayesian_network_model_id: &str,
    cpt_row_indices: &CptRowIndexMap,
) -> Result<Option<HclUncertaintySettings>> {
    if calculation_type == HclCalculationType::Probability {
        return Ok(None);
    }
    let uncertainty = uncertainty.ok_or_else(|| {
        PraxisError::Hcl("Uncertainty execution requires saved uncertainty settings.".into())
    })?;
    let uncertainty: HclUncertaintySnapshot = serde_json::from_value(uncertainty)
        .map_err(|error| serialization_error("invalid uncertainty settings", error))?;
    let basic_event_distributions = uncertainty
        .basic_event_distributions
        .into_iter()
        .map(|definition| HclBasicEventUncertaintySpec {
            event: definition.fault_tree_basic_event.entity_id,
            distribution: definition.distribution,
        })
        .collect();
    let mut cpt_row_distributions = Vec::with_capacity(uncertainty.cpt_row_distributions.len());
    for definition in uncertainty.cpt_row_distributions {
        if definition.bayesian_network_node.model_id != bayesian_network_model_id {
            return Err(PraxisError::Hcl(format!(
                "CPT uncertainty references Bayesian model '{}' instead of '{}'",
                definition.bayesian_network_node.model_id, bayesian_network_model_id
            )));
        }
        let key = (
            definition.bayesian_network_node.entity_id.clone(),
            definition.cpt_row_id.clone(),
        );
        let row_index = cpt_row_indices.get(&key).copied().ok_or_else(|| {
            PraxisError::Hcl(format!(
                "CPT uncertainty row '{}' does not exist on BN node '{}'",
                definition.cpt_row_id, definition.bayesian_network_node.entity_id
            ))
        })?;
        cpt_row_distributions.push(HclCptRowUncertaintySpec {
            node: definition.bayesian_network_node.entity_id,
            row_index,
            prior: definition.prior,
        });
    }
    let mut cpt_generators = Vec::new();
    for definition in uncertainty.cpt_generators {
        if definition.bayesian_network_node.model_id != bayesian_network_model_id {
            return Err(PraxisError::Hcl(
                "CPT generator references a different Bayesian model".into(),
            ));
        }
        cpt_generators.push(HclCptGeneratorSpec {
            node: definition.bayesian_network_node.entity_id,
            generator: definition.generator,
        });
    }
    Ok(Some(HclUncertaintySettings {
        cpt_generators,
        sampler: uncertainty.sampler,
        cpt_probability_clip_epsilon: uncertainty.cpt_probability_clip_epsilon,
        sample_count: uncertainty.sample_count,
        seed: uncertainty.seed,
        basic_event_distributions,
        cpt_row_distributions,
    }))
}

struct HclAdapter {
    model_id: String,
    model_revision: u64,
    fault_tree_top_gate: EntityReference,
    model: HclModel,
    settings: HclAnalysisSettings,
    evidence_batch: Option<Vec<HclEvidenceRow>>,
    hazard_convolution: Option<HazardConvolutionRequest>,
    basic_event_quantifications: Vec<BasicEventQuantificationRecord>,
}

fn serialization_error(context: &str, error: impl std::fmt::Display) -> PraxisError {
    PraxisError::Serialization(format!("{context}: {error}"))
}

fn parse_request(request: &SolverRequest) -> Result<HclExecuteRequest> {
    let parsed: HclExecuteRequest = serde_json::from_value(request.request.clone())
        .map_err(|error| serialization_error("invalid HCL execute request", error))?;
    if parsed.schema_version != request.schema_version {
        return Err(PraxisError::Version(format!(
            "HCL request schema version '{}' does not match solver protocol version '{}'",
            parsed.schema_version, request.schema_version
        )));
    }
    if parsed.method_type != HCL_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "HCL adapter cannot execute method '{}'",
            parsed.method_type
        )));
    }
    if parsed.requested_by.trim().is_empty() {
        return Err(PraxisError::Serialization(
            "HCL execute request requires requestedBy".to_string(),
        ));
    }
    Ok(parsed)
}

fn find_snapshot(request: &SolverRequest, execute: &HclExecuteRequest) -> Result<HclSnapshot> {
    find_snapshot_for_model(request, &execute.model_id, Some(execute.revision))
}

fn find_snapshot_for_model(
    request: &SolverRequest,
    model_id: &str,
    expected_revision: Option<u64>,
) -> Result<HclSnapshot> {
    let snapshot = request
        .model_snapshots
        .iter()
        .find(|snapshot| {
            snapshot.get("methodType").and_then(Value::as_str) == Some(HCL_METHOD)
                && snapshot.get("id").and_then(Value::as_str) == Some(model_id)
        })
        .ok_or_else(|| {
            PraxisError::Logic(format!(
                "HCL configuration snapshot '{}' is missing",
                model_id
            ))
        })?;
    let snapshot: HclSnapshot = serde_json::from_value(snapshot.clone())
        .map_err(|error| serialization_error("invalid HCL configuration snapshot", error))?;
    if snapshot.method_type != HCL_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "HCL snapshot uses method '{}'",
            snapshot.method_type
        )));
    }
    if let Some(expected_revision) = expected_revision {
        if snapshot.revision != expected_revision {
            return Err(PraxisError::Version(format!(
                "HCL snapshot revision {} does not match requested revision {}",
                snapshot.revision, expected_revision
            )));
        }
    }
    Ok(snapshot)
}

fn validate_binding_references(request: &SolverRequest, snapshot: &HclSnapshot) -> Result<()> {
    let declared: HashSet<_> = snapshot
        .fault_trees
        .iter()
        .map(|reference| reference.fault_tree.model_id.as_str())
        .collect();
    let mut events_by_model = HashMap::new();
    for binding in &snapshot.bindings {
        let target = &binding.fault_tree_basic_event;
        if !declared.contains(target.model_id.as_str()) {
            return Err(PraxisError::Hcl(format!(
                "binding '{}' references undeclared fault tree '{}'",
                binding.id, target.model_id
            )));
        }
        if !events_by_model.contains_key(&target.model_id) {
            events_by_model.insert(
                target.model_id.clone(),
                basic_event_ids_for_model(request, &target.model_id)?,
            );
        }
        if !events_by_model[&target.model_id].contains(&target.entity_id) {
            return Err(PraxisError::Hcl(format!(
                "binding '{}' references unknown basic event '{}' in fault tree '{}'",
                binding.id, target.entity_id, target.model_id
            )));
        }
        if binding.bayesian_network_node.model_id != snapshot.bayesian_network.model_id {
            return Err(PraxisError::Hcl(format!(
                "binding '{}' references Bayesian model '{}' instead of '{}'",
                binding.id,
                binding.bayesian_network_node.model_id,
                snapshot.bayesian_network.model_id
            )));
        }
    }
    Ok(())
}

pub(crate) fn build_event_tree_context(
    request: &SolverRequest,
    configuration_id: &str,
    linked_fault_tree_ids: &HashSet<String>,
    calculation_type: HclCalculationType,
) -> Result<EventTreeHclContext> {
    let snapshot = find_snapshot_for_model(request, configuration_id, None)?;
    validate_binding_references(request, &snapshot)?;
    let declared_fault_tree_ids: HashSet<&str> = snapshot
        .fault_trees
        .iter()
        .map(|reference| reference.fault_tree.model_id.as_str())
        .collect();
    if let Some(undeclared) = linked_fault_tree_ids
        .iter()
        .find(|model_id| !declared_fault_tree_ids.contains(model_id.as_str()))
    {
        return Err(PraxisError::Hcl(format!(
            "event tree links fault tree '{undeclared}' that is not declared by HCL configuration '{}'",
            snapshot.id
        )));
    }

    let (network, _network_revision, cpt_row_indices) =
        build_network_for_model_with_cpt_rows(request, &snapshot.bayesian_network.model_id)?;
    let graph = network.into_graph()?;
    let mut bindings_by_event: HashMap<String, HclBindingSpec> = HashMap::new();
    let mut bindings = Vec::new();
    for binding in snapshot.bindings {
        if !linked_fault_tree_ids.contains(&binding.fault_tree_basic_event.model_id) {
            continue;
        }
        let spec = HclBindingSpec {
            event: binding.fault_tree_basic_event.entity_id,
            node: binding.bayesian_network_node.entity_id,
            true_states: binding.true_state_ids,
        };
        if let Some(existing) = bindings_by_event.get(&spec.event) {
            if existing != &spec {
                return Err(PraxisError::Hcl(format!(
                    "basic event '{}' has conflicting HCL bindings across linked fault trees",
                    spec.event
                )));
            }
        } else {
            bindings.push(spec.clone());
            bindings_by_event.insert(spec.event.clone(), spec);
        }
    }
    let base_evidence = snapshot
        .base_evidence
        .observations
        .into_iter()
        .map(|observation| HclEvidenceSpec {
            node: observation.node_id,
            state: observation.state_id,
        })
        .collect();
    let uncertainty = resolve_uncertainty(
        calculation_type,
        snapshot.solver_settings.uncertainty,
        &snapshot.bayesian_network.model_id,
        &cpt_row_indices,
    )?;
    if let Some(settings) = &uncertainty {
        validate_hcl_uncertainty_settings(&graph, settings)?;
    }
    Ok(EventTreeHclContext::new(graph)?
        .with_bindings(bindings)
        .with_base_evidence(base_evidence)
        .with_uncertainty(uncertainty)
        .with_variable_order(snapshot.solver_settings.variable_order))
}

fn build_adapter(request: &SolverRequest) -> Result<HclAdapter> {
    let execute = parse_request(request)?;
    execute
        .calculation_type
        .ensure_hazard_supported(execute.hazard_convolution.is_some())?;
    let snapshot = find_snapshot(request, &execute)?;
    validate_binding_references(request, &snapshot)?;
    if !snapshot
        .fault_trees
        .iter()
        .any(|reference| reference.fault_tree.model_id == execute.fault_tree_top_gate.model_id)
    {
        return Err(PraxisError::Hcl(format!(
            "fault tree '{}' is not declared by HCL configuration '{}'",
            execute.fault_tree_top_gate.model_id, snapshot.id
        )));
    }

    let fault_tree = build_fault_tree_for_model(request, &execute.fault_tree_top_gate.model_id)?;
    if fault_tree.top_gate_id != execute.fault_tree_top_gate.entity_id {
        return Err(PraxisError::Hcl(format!(
            "fault-tree top gate '{}' does not match requested gate '{}'",
            fault_tree.top_gate_id, execute.fault_tree_top_gate.entity_id
        )));
    }
    let (network, _network_revision, cpt_row_indices) =
        build_network_for_model_with_cpt_rows(request, &snapshot.bayesian_network.model_id)?;
    let graph = network.into_graph()?;

    let mut bindings = Vec::new();
    for binding in snapshot.bindings {
        if binding.fault_tree_basic_event.model_id != execute.fault_tree_top_gate.model_id {
            continue;
        }
        bindings.push(HclBindingSpec {
            event: binding.fault_tree_basic_event.entity_id,
            node: binding.bayesian_network_node.entity_id,
            true_states: binding.true_state_ids,
        });
    }
    let base_evidence = snapshot
        .base_evidence
        .observations
        .into_iter()
        .map(|observation| HclEvidenceSpec {
            node: observation.node_id,
            state: observation.state_id,
        })
        .collect();
    let basic_event_quantifications = fault_tree.basic_event_quantifications.clone();
    let model = HclModel::new(fault_tree.fault_tree, graph)?
        .with_bindings(bindings)
        .with_base_evidence(base_evidence);
    let uncertainty = resolve_uncertainty(
        execute.calculation_type,
        snapshot.solver_settings.uncertainty,
        &snapshot.bayesian_network.model_id,
        &cpt_row_indices,
    )?;
    let settings = HclAnalysisSettings {
        variable_order: Some(match snapshot.solver_settings.variable_order {
            Some(order) => order,
            None => praxis::hcl::source_fault_tree_order(&model)?,
        }),
        fold_constants: snapshot.solver_settings.fold_constants,
        splice_null_gates: snapshot.solver_settings.splice_null_gates,
        uncertainty,
    };

    if execute.hazard_convolution.is_some() {
        ensure_hazard_convolution_supported(settings.uncertainty.as_ref())?;
    }
    Ok(HclAdapter {
        model_id: snapshot.id,
        model_revision: snapshot.revision,
        fault_tree_top_gate: execute.fault_tree_top_gate,
        model,
        settings,
        evidence_batch: execute.evidence_batch,
        hazard_convolution: execute.hazard_convolution,
        basic_event_quantifications,
    })
}

pub(crate) fn validate(request: &SolverRequest) -> Result<Value> {
    if request.request["operation"] == "GENERATE_SCENARIOS" {
        return crate::hazard_sweep::validate(request);
    }
    let adapter = build_adapter(request)?;
    if let Some(settings) = &adapter.settings.uncertainty {
        validate_hcl_uncertainty_settings(adapter.model.network(), settings)?;
    }
    // Validation checks model structure with the nominal parameters. Sampling is
    // intentionally reserved for execute so one user run does not pay for the
    // uncertainty population twice.
    let mut validation_settings = adapter.settings.clone();
    validation_settings.uncertainty = None;
    let (bdd_variables, scenario_count) = match &adapter.evidence_batch {
        Some(rows) => {
            validate_evidence_rows(rows)?;
            let evidence = batch_evidence_specs(rows);
            let bdd_variables = if let Some(hazard) = &adapter.hazard_convolution {
                validate_hazard_grid(rows, hazard)?;
                let assignments = hazard_evidence_specs(rows);
                quantify_hcl_hazard_grid_batch(
                    &adapter.model,
                    &evidence,
                    &assignments,
                    &validation_settings,
                )?
                .quantification
                .results
                .first()
                .map_or(0, |result| result.bdd_variables)
            } else {
                quantify_hcl_batch(&adapter.model, &evidence, &validation_settings)?
                    .results
                    .first()
                    .map_or(0, |result| result.bdd_variables)
            };
            (bdd_variables, rows.len())
        }
        None => (
            quantify_hcl(&adapter.model, &HclSettings::from(&validation_settings))?.bdd_variables,
            1,
        ),
    };
    Ok(json!({
        "scope": HCL_METHOD,
        "valid": true,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "bddVariables": bdd_variables,
        "scenarioCount": scenario_count
    }))
}

pub(crate) fn preflight(request: &SolverRequest, executing: bool) -> Result<Value> {
    if request.request["operation"] == "GENERATE_SCENARIOS" {
        return Ok(crate::resource_preflight::no_clique());
    }
    let adapter = build_adapter(request)?;
    if let Some(settings) = &adapter.settings.uncertainty {
        validate_hcl_uncertainty_settings(adapter.model.network(), settings)?;
    }
    let batch =
        crate::resource_preflight::sample_batch(adapter.settings.uncertainty.as_ref(), executing);
    crate::resource_preflight::network(adapter.model.network().clone(), batch)
}

pub(crate) fn preflight_event_tree_network(
    request: &SolverRequest,
    configuration_id: &str,
    calculation_type: HclCalculationType,
    executing: bool,
) -> Result<Value> {
    let snapshot = find_snapshot_for_model(request, configuration_id, None)?;
    let (network, _, rows) =
        build_network_for_model_with_cpt_rows(request, &snapshot.bayesian_network.model_id)?;
    let uncertainty = resolve_uncertainty(
        calculation_type,
        snapshot.solver_settings.uncertainty,
        &snapshot.bayesian_network.model_id,
        &rows,
    )?;
    crate::resource_preflight::network(
        network.into_graph()?,
        crate::resource_preflight::sample_batch(uncertainty.as_ref(), executing),
    )
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    if request.request["operation"] == "GENERATE_SCENARIOS" {
        return crate::hazard_sweep::execute(request);
    }
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
    let result = analyze_hcl(&adapter.model, &adapter.settings)?;
    Ok(hcl_result_json(&adapter, &result, None))
}

fn batch_response(adapter: &HclAdapter) -> Value {
    json!({
        "methodType": HCL_METHOD,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "faultTreeTopGate": {
            "modelId": adapter.fault_tree_top_gate.model_id,
            "entityId": adapter.fault_tree_top_gate.entity_id
        },
    })
}

fn execute_batch(adapter: &HclAdapter, rows: &[HclEvidenceRow]) -> Result<Value> {
    let evidence = batch_evidence_specs(rows);
    let (batch, hazard_convolution) = if let Some(hazard) = &adapter.hazard_convolution {
        validate_hazard_grid(rows, hazard)?;
        let assignments = hazard_evidence_specs(rows);
        let weighted = quantify_hcl_hazard_grid_batch(
            &adapter.model,
            &evidence,
            &assignments,
            &adapter.settings,
        )?;
        let integration = hcl_hazard_convolution_json(rows, hazard, &weighted)?;
        (weighted.quantification, Some(integration))
    } else {
        (
            quantify_hcl_batch(&adapter.model, &evidence, &adapter.settings)?,
            None,
        )
    };
    let evaluated: HashMap<_, _> = batch
        .scenario_indices
        .iter()
        .copied()
        .zip(batch.results.iter())
        .collect();
    let batch_results: Vec<Value> = rows
        .iter()
        .enumerate()
        .map(|(index, row)| match evaluated.get(&index) {
            Some(result) => hcl_result_json(&adapter, result, Some(&row.scenario_id)),
            None => json!({"scenarioId": row.scenario_id, "status": "skipped_zero_weight"}),
        })
        .collect();
    let mut response = batch_response(adapter);
    response["batchResults"] = json!(batch_results);
    response["compilationReuse"] = json!({
        "bddCompilations": batch.compilation.bdd_compilations,
        "junctionTreeCompilations": batch.compilation.junction_tree_compilations,
        "scenarioEvaluations": batch.compilation.scenario_evaluations
    });
    if let Some(hazard_convolution) = hazard_convolution {
        response["hazardConvolution"] = hazard_convolution;
    }
    Ok(response)
}

fn validate_evidence_rows(rows: &[HclEvidenceRow]) -> Result<()> {
    if rows.is_empty() {
        return Err(PraxisError::Hcl(
            "HCL evidence batch requires at least one scenario".to_string(),
        ));
    }
    let mut scenario_ids = HashSet::with_capacity(rows.len());
    if let Some(row) = rows.iter().find(|row| {
        row.scenario_id.trim().is_empty() || !scenario_ids.insert(row.scenario_id.as_str())
    }) {
        return Err(PraxisError::Hcl(format!(
            "HCL evidence batch contains an empty or duplicate scenario id '{}'",
            row.scenario_id
        )));
    }
    Ok(())
}

fn batch_evidence_specs(rows: &[HclEvidenceRow]) -> Vec<Vec<HclEvidenceSpec>> {
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

fn hazard_evidence_specs(rows: &[HclEvidenceRow]) -> Vec<Vec<HclEvidenceSpec>> {
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

fn validate_hazard_grid(rows: &[HclEvidenceRow], hazard: &HazardConvolutionRequest) -> Result<()> {
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

fn hcl_hazard_convolution_json(
    rows: &[HclEvidenceRow],
    hazard: &HazardConvolutionRequest,
    batch: &HclHazardGridBatchResult,
) -> Result<Value> {
    let scale = hazard.annual_frequency_scale;
    let weights = prepare_hazard_weights(
        &batch.raw_weights,
        scale.value,
        scale.unit,
        scale.annualization,
        hazard.normalize_weights,
    )?;
    let evaluated: HashMap<_, _> = batch
        .quantification
        .scenario_indices
        .iter()
        .copied()
        .zip(batch.quantification.results.iter())
        .collect();
    let mut convolved_probability = 0.0;
    let mut integrated_annual_frequency = 0.0;
    let result_rows: Vec<Value> = rows
        .iter()
        .zip(&weights.weights)
        .enumerate()
        .map(|(index, (row, weight))| {
            let result = evaluated.get(&index);
            let probability = result.map(|result| result.probability);
            let contribution = probability.map_or(0.0, |p| weight.convolution_weight * p);
            let annual_contribution = probability.map_or(0.0, |p| weight.annual_frequency * p);
            convolved_probability += contribution;
            integrated_annual_frequency += annual_contribution;
            json!({
                "scenarioId": row.scenario_id,
                "status": if result.is_some() { "ok" } else { "skipped_zero_weight" },
                "rawWeight": weight.raw_weight,
                "normalizedWeight": weight.normalized_weight,
                "convolutionWeight": weight.convolution_weight,
                "annualFrequency": weight.annual_frequency,
                "conditionalProbability": probability,
                "probabilityContribution": contribution,
                "annualContribution": annual_contribution
            })
        })
        .collect();
    let result = hazard_common_json(
        hazard,
        &weights,
        json!({
            "targetKind": "FAULT_TREE",
            "rows": result_rows,
            "convolvedProbability": convolved_probability,
            "integratedAnnualFrequency": integrated_annual_frequency
        }),
    );
    Ok(result)
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

fn hcl_result_json(
    adapter: &HclAdapter,
    result: &HclAnalysisResult,
    scenario_id: Option<&str>,
) -> Value {
    let mut value = json!({
        "methodType": HCL_METHOD,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "faultTreeTopGate": {
            "modelId": adapter.fault_tree_top_gate.model_id,
            "entityId": adapter.fault_tree_top_gate.entity_id
        },
        "probability": result.probability,
        "bddNodes": result.bdd_nodes,
        "bddVariables": result.bdd_variables,
        "variableOrder": result.variable_order,
        "bridge": crate::diagnostics::bridge_stats_json(&result.bridge),
        "junctionTree": crate::diagnostics::junction_tree_stats_json(&result.junction_tree),
        "basicEventQuantifications": adapter.basic_event_quantifications,
        "validationIssues": []
    });
    if let Some(scenario_id) = scenario_id {
        value["scenarioId"] = json!(scenario_id);
    }
    if let Some(uncertainty) = &result.uncertainty {
        value["uncertainty"] = json!(uncertainty);
    }
    value
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::execute;
    use crate::transport::SolverRequest;

    #[test]
    fn preserves_bn_correlation_for_a_linked_fault_tree() {
        let hcl_id = "00000000-0000-4000-8000-000000000201";
        let ft_id = "00000000-0000-4000-8000-000000000202";
        let bn_id = "00000000-0000-4000-8000-000000000203";
        let top = "00000000-0000-4000-8000-000000000204";
        let node_a = "00000000-0000-4000-8000-000000000205";
        let node_b = "00000000-0000-4000-8000-000000000206";
        let a_false = "00000000-0000-4000-8000-000000000207";
        let a_true = "00000000-0000-4000-8000-000000000208";
        let b_false = "00000000-0000-4000-8000-000000000209";
        let b_true = "00000000-0000-4000-8000-000000000210";
        let mut payload = json!({
            "schemaVersion": "1.0.0",
            "request": {
                "schemaVersion": "1.0.0",
                "methodType": "HYBRID_CAUSAL_LOGIC",
                "calculationType": "UNCERTAINTY",
                "modelId": hcl_id,
                "revision": 4,
                "requestedBy": "analyst",
                "faultTreeTopGate": { "modelId": ft_id, "entityId": top }
            },
            "modelSnapshots": [
                {
                    "id": ft_id,
                    "projectId": "project-1",
                    "methodType": "FAULT_TREE",
                    "revision": 2,
                    "topGate": { "gateId": top },
                    "gates": [{ "id": top, "gateType": "AND" }],
                    "leafNodes": [
                        { "id": "ref-a", "kind": "BASIC_EVENT_REFERENCE", "basicEventId": "A" },
                        { "id": "ref-b", "kind": "BASIC_EVENT_REFERENCE", "basicEventId": "B" }
                    ],
                    "gateInputs": [
                        { "id": "input-a", "gateId": top, "childId": "ref-a", "order": 0 },
                        { "id": "input-b", "gateId": top, "childId": "ref-b", "order": 1 }
                    ]
                },
                {
                    "id": bn_id,
                    "methodType": "BAYESIAN_NETWORK",
                    "revision": 3,
                    "nodes": [
                        { "id": node_a, "states": [{ "id": a_false }, { "id": a_true }] },
                        { "id": node_b, "states": [{ "id": b_false }, { "id": b_true }] }
                    ],
                    "conditionalProbabilityTables": [
                        {
                            "nodeId": node_a,
                            "parents": [],
                            "rows": [{
                                "id": "row-a",
                                "parentStates": [],
                                "values": [
                                    { "stateId": a_false, "probability": 0.8 },
                                    { "stateId": a_true, "probability": 0.2 }
                                ]
                            }]
                        },
                        {
                            "nodeId": node_b,
                            "parents": [{ "nodeId": node_a, "order": 0 }],
                            "rows": [
                                {
                                    "id": "row-b-false",
                                    "parentStates": [{ "parentNodeId": node_a, "stateId": a_false }],
                                    "values": [
                                        { "stateId": b_false, "probability": 0.9 },
                                        { "stateId": b_true, "probability": 0.1 }
                                    ]
                                },
                                {
                                    "id": "row-b-true",
                                    "parentStates": [{ "parentNodeId": node_a, "stateId": a_true }],
                                    "values": [
                                        { "stateId": b_false, "probability": 0.2 },
                                        { "stateId": b_true, "probability": 0.8 }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    "id": hcl_id,
                    "methodType": "HYBRID_CAUSAL_LOGIC",
                    "revision": 4,
                    "bayesianNetwork": { "modelId": bn_id },
                    "faultTrees": [{ "faultTree": { "modelId": ft_id } }],
                    "bindings": [
                        {
                            "id": "binding-a",
                            "faultTreeBasicEvent": { "modelId": ft_id, "entityId": "A" },
                            "bayesianNetworkNode": { "modelId": bn_id, "entityId": node_a },
                            "trueStateIds": [a_true]
                        },
                        {
                            "id": "binding-b",
                            "faultTreeBasicEvent": { "modelId": ft_id, "entityId": "B" },
                            "bayesianNetworkNode": { "modelId": bn_id, "entityId": node_b },
                            "trueStateIds": [b_true]
                        }
                    ],
                    "baseEvidence": { "observations": [] },
                    "solverSettings": {
                        "variableOrder": ["A", "B"],
                        "foldConstants": false,
                        "spliceNullGates": false,
                        "uncertainty": {
                            "sampleCount": 200,
                            "seed": 2026,
                            "basicEventDistributions": [],
                            "cptRowDistributions": [{
                                "bayesianNetworkNode": { "modelId": bn_id, "entityId": node_b },
                                "cptRowId": "row-b-true",
                                "prior": { "family": "DIRICHLET", "alpha": [5.0, 20.0] }
                            }]
                        }
                    }
                }
            ],
            "resources": {
                "faultTreeBasicEventCatalogue": {
                    "projectId": "project-1",
                    "basicEvents": [
                        { "id": "A", "probability": { "value": 0.2 } },
                        { "id": "B", "probability": { "value": 0.24 } }
                    ]
                }
            }
        });
        let request = SolverRequest::from_json(&payload.to_string()).unwrap();

        let result = execute(&request).unwrap();
        assert!((result["probability"].as_f64().unwrap() - 0.16).abs() < 1e-12);
        assert_eq!(result["variableOrder"], json!(["A", "B"]));
        assert_eq!(result["faultTreeTopGate"]["entityId"], top);
        assert!(result.get("cutSets").is_none());
        assert!(result.get("importance").is_none());
        assert_eq!(result["bridge"]["quantifications"], 1);
        assert_eq!(result["uncertainty"]["sampleCount"], 200);
        assert_eq!(result["uncertainty"]["seed"], 2026);
        assert!(
            result["uncertainty"]["percentile05"].as_f64().unwrap()
                < result["uncertainty"]["percentile95"].as_f64().unwrap()
        );
        let mut signed_payload = payload.clone();
        signed_payload["modelSnapshots"][0]["gates"]
            .as_array_mut()
            .unwrap()
            .push(json!({"id": "NOT-B", "gateType": "NOT"}));
        signed_payload["modelSnapshots"][0]["gateInputs"][1]["childId"] = json!("NOT-B");
        signed_payload["modelSnapshots"][0]["gateInputs"]
            .as_array_mut()
            .unwrap()
            .push(json!({
                "id": "not-b-input", "gateId": "NOT-B", "childId": "ref-b", "order": 0
            }));
        let signed_request = SolverRequest::from_json(&signed_payload.to_string()).unwrap();
        let signed = execute(&signed_request).unwrap();
        assert!((signed["probability"].as_f64().unwrap() - 0.04).abs() < 1e-12);
        assert!(signed.get("cutSets").is_none());
        assert!(signed.get("importance").is_none());

        let true_scenario = "00000000-0000-4000-8000-000000000211";
        let false_scenario = "00000000-0000-4000-8000-000000000212";
        payload["modelSnapshots"][2]["baseEvidence"]["observations"] = json!([]);
        payload["request"]["evidenceBatch"] = json!([
            {
                "scenarioId": true_scenario,
                "observations": [{ "nodeId": node_a, "stateId": a_true }],
                "hazardObservations": [{ "nodeId": node_a, "stateId": a_true }]
            },
            {
                "scenarioId": false_scenario,
                "observations": [{ "nodeId": node_a, "stateId": a_false }],
                "hazardObservations": [{ "nodeId": node_a, "stateId": a_false }]
            }
        ]);
        payload["request"]["hazardConvolution"] = json!({
            "gridName": "A-state grid",
            "hazardNodeIds": [node_a],
            "annualFrequencyScale": {
                "value": 1.0e-4,
                "unit": "PER_YEAR",
                "annualization": { "basis": "PLANT_YEAR", "hoursPerYear": 8766.0 }
            },
            "normalizeWeights": false
        });
        let rejected = SolverRequest::from_json(&payload.to_string()).unwrap();
        assert!(execute(&rejected)
            .unwrap_err()
            .to_string()
            .contains("point runs only"));
        assert!(super::validate(&rejected)
            .unwrap_err()
            .to_string()
            .contains("point runs only"));
        // Saved settings remain present when switching to point hazard execution.
        payload["request"]["calculationType"] = json!("PROBABILITY");
        let batch_request = SolverRequest::from_json(&payload.to_string()).unwrap();
        let batch = execute(&batch_request).unwrap();
        assert_eq!(batch["compilationReuse"]["bddCompilations"], 1);
        assert_eq!(batch["compilationReuse"]["junctionTreeCompilations"], 1);
        for result in batch["batchResults"].as_array().unwrap() {
            assert!(result.get("cutSets").is_none());
            assert!(result.get("importance").is_none());
        }
        assert_eq!(batch["batchResults"][0]["probability"], 0.8);
        assert_eq!(batch["batchResults"][1]["probability"], 0.0);
        assert!(
            (batch["hazardConvolution"]["rows"][0]["rawWeight"]
                .as_f64()
                .unwrap()
                - 0.2)
                .abs()
                < 1e-12
        );
        assert!(
            (batch["hazardConvolution"]["rows"][1]["rawWeight"]
                .as_f64()
                .unwrap()
                - 0.8)
                .abs()
                < 1e-12
        );
        assert!(
            (batch["hazardConvolution"]["integratedAnnualFrequency"]
                .as_f64()
                .unwrap()
                - 1.6e-5)
                .abs()
                < 1e-12
        );
        assert!(batch["hazardConvolution"].get("uncertainty").is_none());

        payload["request"]["evidenceBatch"][1]["hazardObservations"] =
            json!([{ "nodeId": node_a, "stateId": a_true }]);
        let duplicate_request = SolverRequest::from_json(&payload.to_string()).unwrap();
        assert!(execute(&duplicate_request)
            .unwrap_err()
            .to_string()
            .contains("duplicates an existing grid cell"));
    }
}
