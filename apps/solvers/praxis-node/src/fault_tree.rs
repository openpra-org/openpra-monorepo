use std::collections::{HashMap, HashSet};
use std::time::Duration;

use praxis::algorithms::build::VariableOrder;
use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::analysis::quantify::{quantify, Approximation, Engine, Settings};
use praxis::analysis::sil::{Sil, SilLevel};
use praxis::core::ccf::{require_total, CcfGroup, CcfModel};
use praxis::core::event::{BasicEvent, HouseEvent};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::core::distribution::{
    CcfFactorModel, UncertainExpression, UncertainParameter, UncertainUnit,
    UncertainVectorParameter,
};
use praxis::core::distribution_sampling::{require_probability, SamplingMethod, UncertaintyProgram};
use praxis::expression::Expr;
use praxis::mc::core::{ConvergenceSettings, VrtMode, VrtSettings};
use praxis::mc::DpMonteCarloAnalysis;
use praxis::{PraxisError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::transport::SolverRequest;

const FAULT_TREE_METHOD: &str = "FAULT_TREE";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FaultTreeExecuteRequest {
    schema_version: String,
    method_type: String,
    model_id: String,
    revision: u64,
    requested_by: String,
    #[serde(default)]
    calculation_type: FaultTreeCalculationType,
    #[serde(default)]
    workflow: FaultTreeWorkflow,
    #[serde(default)]
    settings: FaultTreeAnalysisSettings,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum FaultTreeCalculationType {
    #[default]
    Probability,
    CutSets,
    ProbabilityAndCutSets,
    Importance,
    Uncertainty,
    Sil,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum FaultTreeWorkflow {
    #[default]
    Manual,
    Batch,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum FaultTreeAlgorithm {
    #[default]
    Bdd,
    Zbdd,
    ZbddDirect,
    ZbddDelterm,
    Mocus,
    MocusPi,
    MonteCarlo,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum FaultTreeApproximation {
    #[default]
    Exact,
    RareEvent,
    Mcub,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum FaultTreeVariableOrder {
    #[default]
    Dfs,
    Force,
    Sloan,
    DfsScram,
    DfsPlain,
    Reverse,
    Sift,
    Gsift,
    Ils,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum FaultTreeVarianceReduction {
    #[default]
    None,
    ImportanceSampling,
    StratifiedSampling,
}

fn default_reorder_budget_seconds() -> f64 {
    60.0
}
fn default_num_trials() -> usize {
    10_000
}
fn default_seed() -> u64 {
    847
}
fn default_mission_time_hours() -> f64 {
    8_760.0
}
fn default_convergence_delta() -> f64 {
    0.1
}
fn default_confidence_level() -> f64 {
    0.95
}
fn default_importance_sampling_bias_factor() -> f64 {
    10.0
}
fn default_importance_sampling_max_events() -> usize {
    32
}
fn default_importance_sampling_minimum_probability() -> f64 {
    1.0e-12
}
fn default_stratify_events() -> usize {
    4
}
fn default_sampling_method() -> SamplingMethod {
    SamplingMethod::MonteCarlo
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FaultTreeAnalysisSettings {
    #[serde(default)]
    algorithm: FaultTreeAlgorithm,
    #[serde(default)]
    approximation: FaultTreeApproximation,
    #[serde(skip_serializing_if = "Option::is_none")]
    limit_order: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cut_off: Option<f64>,
    #[serde(default)]
    variable_order: FaultTreeVariableOrder,
    #[serde(default = "default_reorder_budget_seconds")]
    reorder_budget_seconds: f64,
    #[serde(default)]
    expand_ccf: bool,
    #[serde(default = "default_num_trials")]
    num_trials: usize,
    #[serde(default = "default_seed")]
    seed: u64,
    #[serde(default = "default_sampling_method")]
    sampling_method: SamplingMethod,
    #[serde(default = "default_mission_time_hours")]
    mission_time_hours: f64,
    #[serde(default)]
    early_stop: bool,
    #[serde(default = "default_convergence_delta")]
    convergence_delta: f64,
    #[serde(default = "default_confidence_level")]
    confidence_level: f64,
    #[serde(default)]
    burn_in_trials: u64,
    #[serde(default)]
    variance_reduction: FaultTreeVarianceReduction,
    #[serde(default = "default_importance_sampling_bias_factor")]
    importance_sampling_bias_factor: f64,
    #[serde(default = "default_importance_sampling_max_events")]
    importance_sampling_max_events: usize,
    #[serde(default = "default_importance_sampling_minimum_probability")]
    importance_sampling_minimum_probability: f64,
    #[serde(default = "default_stratify_events")]
    stratify_events: usize,
}

impl Default for FaultTreeAnalysisSettings {
    fn default() -> Self {
        Self {
            algorithm: FaultTreeAlgorithm::Bdd,
            approximation: FaultTreeApproximation::Exact,
            limit_order: None,
            cut_off: None,
            variable_order: FaultTreeVariableOrder::Dfs,
            reorder_budget_seconds: default_reorder_budget_seconds(),
            expand_ccf: false,
            num_trials: default_num_trials(),
            seed: default_seed(),
            sampling_method: default_sampling_method(),
            mission_time_hours: default_mission_time_hours(),
            early_stop: false,
            convergence_delta: default_convergence_delta(),
            confidence_level: default_confidence_level(),
            burn_in_trials: 0,
            variance_reduction: FaultTreeVarianceReduction::None,
            importance_sampling_bias_factor: default_importance_sampling_bias_factor(),
            importance_sampling_max_events: default_importance_sampling_max_events(),
            importance_sampling_minimum_probability:
                default_importance_sampling_minimum_probability(),
            stratify_events: default_stratify_events(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FaultTreeSnapshot {
    id: String,
    project_id: String,
    method_type: String,
    revision: u64,
    top_gate: Option<FaultTreeTopGate>,
    gates: Vec<FaultTreeGate>,
    leaf_nodes: Vec<FaultTreeLeaf>,
    gate_inputs: Vec<FaultTreeGateInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FaultTreeTopGate {
    gate_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "gateType")]
enum FaultTreeGate {
    #[serde(rename = "AND")]
    And { id: String },
    #[serde(rename = "OR")]
    Or { id: String },
    #[serde(rename = "XOR")]
    Xor { id: String },
    #[serde(rename = "NOT")]
    Not { id: String },
    #[serde(rename = "K_OF_N")]
    KOfN { id: String, k: usize },
}

impl FaultTreeGate {
    fn id(&self) -> &str {
        match self {
            Self::And { id }
            | Self::Or { id }
            | Self::Xor { id }
            | Self::Not { id }
            | Self::KOfN { id, .. } => id,
        }
    }

    fn formula(&self) -> Formula {
        match self {
            Self::And { .. } => Formula::And,
            Self::Or { .. } => Formula::Or,
            Self::Xor { .. } => Formula::Xor,
            Self::Not { .. } => Formula::Not,
            Self::KOfN { k, .. } => Formula::AtLeast { min: *k },
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind")]
enum FaultTreeLeaf {
    #[serde(rename = "BASIC_EVENT_REFERENCE")]
    BasicEventReference {
        id: String,
        #[serde(rename = "basicEventId")]
        basic_event_id: String,
    },
    #[serde(rename = "HOUSE_EVENT")]
    HouseEvent { id: String, state: bool },
    #[serde(rename = "UNDEVELOPED_EVENT")]
    UndevelopedEvent { id: String },
    #[serde(rename = "TRANSFER_REFERENCE")]
    TransferReference { id: String },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FaultTreeGateInput {
    id: String,
    gate_id: String,
    child_id: String,
    order: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BasicEventCatalogue {
    project_id: String,
    basic_events: Vec<CatalogueBasicEvent>,
    #[serde(default)]
    common_cause_failure_groups: Vec<CatalogueCcfGroup>,
    #[serde(default)]
    uncertainty_parameters: Vec<UncertainParameter>,
    #[serde(default)]
    uncertainty_vectors: Vec<UncertainVectorParameter>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CatalogueBasicEvent {
    id: String,
    expression: UncertainExpression,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CatalogueCcfGroup {
    id: String,
    members: Vec<String>,
    factors: CcfFactorModel,
    #[serde(default)]
    total: Option<UncertainExpression>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BasicEventQuantificationRecord {
    basic_event_id: String,
    expression: UncertainExpression,
    point_probability: f64,
}

pub(crate) struct FaultTreeAdapter {
    pub(crate) fault_tree: FaultTree,
    pub(crate) model_id: String,
    pub(crate) model_revision: u64,
    pub(crate) top_gate_id: String,
    pub(crate) basic_event_quantifications: Vec<BasicEventQuantificationRecord>,
}

fn serialization_error(context: &str, error: impl std::fmt::Display) -> PraxisError {
    PraxisError::Serialization(format!("{context}: {error}"))
}

fn parse_request(request: &SolverRequest) -> Result<FaultTreeExecuteRequest> {
    let parsed: FaultTreeExecuteRequest = serde_json::from_value(request.request.clone())
        .map_err(|error| serialization_error("invalid fault-tree execute request", error))?;
    if parsed.schema_version != request.schema_version {
        return Err(PraxisError::Version(format!(
            "fault-tree request schema version '{}' does not match solver protocol version '{}'",
            parsed.schema_version, request.schema_version
        )));
    }
    if parsed.method_type != FAULT_TREE_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "fault-tree adapter cannot execute method '{}'",
            parsed.method_type
        )));
    }
    if parsed.requested_by.trim().is_empty() {
        return Err(PraxisError::Serialization(
            "fault-tree execute request requires requestedBy".to_string(),
        ));
    }
    if parsed.settings.num_trials == 0
        || !parsed.settings.reorder_budget_seconds.is_finite()
        || parsed.settings.reorder_budget_seconds <= 0.0
        || !parsed.settings.mission_time_hours.is_finite()
        || parsed.settings.mission_time_hours <= 0.0
        || !parsed.settings.convergence_delta.is_finite()
        || parsed.settings.convergence_delta <= 0.0
        || !parsed.settings.confidence_level.is_finite()
        || !(0.0..1.0).contains(&parsed.settings.confidence_level)
        || !parsed.settings.importance_sampling_bias_factor.is_finite()
        || parsed.settings.importance_sampling_bias_factor <= 0.0
        || !parsed
            .settings
            .importance_sampling_minimum_probability
            .is_finite()
        || !(0.0..0.5).contains(&parsed.settings.importance_sampling_minimum_probability)
        || parsed.settings.stratify_events == 0
        || parsed
            .settings
            .cut_off
            .is_some_and(|value| !(0.0..=1.0).contains(&value))
    {
        return Err(PraxisError::Settings(
            "fault-tree analysis settings contain an invalid numeric value".to_string(),
        ));
    }
    let cut_set_algorithm = matches!(
        parsed.settings.algorithm,
        FaultTreeAlgorithm::Zbdd
            | FaultTreeAlgorithm::ZbddDirect
            | FaultTreeAlgorithm::ZbddDelterm
            | FaultTreeAlgorithm::Mocus
            | FaultTreeAlgorithm::MocusPi
    );
    if matches!(
        parsed.calculation_type,
        FaultTreeCalculationType::CutSets | FaultTreeCalculationType::ProbabilityAndCutSets
    ) && !cut_set_algorithm
    {
        return Err(PraxisError::Settings(
            "cut-set calculations require a cut-set algorithm".to_string(),
        ));
    }
    if parsed.settings.early_stop
        && !matches!(
            parsed.settings.variance_reduction,
            FaultTreeVarianceReduction::None
        )
    {
        return Err(PraxisError::Settings(
            "Monte Carlo early stopping cannot be combined with variance reduction".to_string(),
        ));
    }
    if (parsed.settings.early_stop
        || !matches!(
            parsed.settings.variance_reduction,
            FaultTreeVarianceReduction::None
        ))
        && !matches!(parsed.settings.algorithm, FaultTreeAlgorithm::MonteCarlo)
    {
        return Err(PraxisError::Settings(
            "Monte Carlo controls require the Monte Carlo algorithm".to_string(),
        ));
    }
    if matches!(parsed.settings.algorithm, FaultTreeAlgorithm::MonteCarlo)
        && !matches!(
            parsed.calculation_type,
            FaultTreeCalculationType::Probability
        )
    {
        return Err(PraxisError::Settings(
            "Monte Carlo supports probability calculations".to_string(),
        ));
    }
    if matches!(
        parsed.settings.algorithm,
        FaultTreeAlgorithm::Bdd | FaultTreeAlgorithm::MonteCarlo
    ) && !matches!(parsed.settings.approximation, FaultTreeApproximation::Exact)
    {
        return Err(PraxisError::Settings(
            "BDD and Monte Carlo do not use a cut-set probability approximation".to_string(),
        ));
    }
    if matches!(
        parsed.calculation_type,
        FaultTreeCalculationType::Importance
            | FaultTreeCalculationType::Uncertainty
            | FaultTreeCalculationType::Sil
    ) && (parsed.settings.limit_order.is_some() || parsed.settings.cut_off.is_some())
    {
        return Err(PraxisError::Settings(
            "limits are not used by this fault-tree calculation".to_string(),
        ));
    }
    if matches!(
        parsed.calculation_type,
        FaultTreeCalculationType::Importance
            | FaultTreeCalculationType::Uncertainty
            | FaultTreeCalculationType::Sil
    ) && !matches!(parsed.settings.algorithm, FaultTreeAlgorithm::Bdd)
    {
        return Err(PraxisError::Settings(
            "importance, uncertainty, and SIL calculations require BDD".to_string(),
        ));
    }
    if matches!(
        parsed.settings.algorithm,
        FaultTreeAlgorithm::ZbddDirect
            | FaultTreeAlgorithm::ZbddDelterm
            | FaultTreeAlgorithm::Mocus
            | FaultTreeAlgorithm::MocusPi
    ) && matches!(parsed.settings.approximation, FaultTreeApproximation::Exact)
    {
        return Err(PraxisError::Settings(
            "the selected cut-set algorithm requires rare-event or MCUB approximation".to_string(),
        ));
    }
    Ok(parsed)
}

fn find_snapshot(
    request: &SolverRequest,
    model_id: &str,
    expected_revision: Option<u64>,
) -> Result<FaultTreeSnapshot> {
    let snapshot = request
        .model_snapshots
        .iter()
        .find(|snapshot| {
            snapshot.get("methodType").and_then(Value::as_str) == Some(FAULT_TREE_METHOD)
                && snapshot.get("id").and_then(Value::as_str) == Some(model_id)
        })
        .ok_or_else(|| {
            PraxisError::Logic(format!(
                "fault-tree model snapshot '{}' is missing",
                model_id
            ))
        })?;

    let snapshot: FaultTreeSnapshot = serde_json::from_value(snapshot.clone())
        .map_err(|error| serialization_error("invalid fault-tree model snapshot", error))?;
    if snapshot.method_type != FAULT_TREE_METHOD {
        return Err(PraxisError::IllegalOperation(format!(
            "fault-tree snapshot uses method '{}'",
            snapshot.method_type
        )));
    }
    if let Some(expected_revision) = expected_revision {
        if snapshot.revision != expected_revision {
            return Err(PraxisError::Version(format!(
                "fault-tree snapshot revision {} does not match requested revision {}",
                snapshot.revision, expected_revision
            )));
        }
    }
    Ok(snapshot)
}

pub(crate) fn basic_event_ids_for_model(
    request: &SolverRequest,
    model_id: &str,
) -> Result<HashSet<String>> {
    let snapshot = find_snapshot(request, model_id, None)?;
    let catalogue = parse_catalogue(request, &snapshot.project_id)?;
    let mut catalogue_counts = HashMap::new();
    for event in catalogue.basic_events {
        *catalogue_counts.entry(event.id).or_insert(0usize) += 1;
    }
    Ok(snapshot
        .leaf_nodes
        .into_iter()
        .filter_map(|leaf| match leaf {
            FaultTreeLeaf::BasicEventReference { basic_event_id, .. }
                if catalogue_counts.get(&basic_event_id) == Some(&1) =>
            {
                Some(basic_event_id)
            }
            _ => None,
        })
        .collect())
}

fn catalogue_value(request: &SolverRequest) -> Result<BasicEventCatalogue> {
    let value = request
        .resources
        .fault_tree_basic_event_catalogue
        .as_ref()
        .ok_or_else(|| {
            PraxisError::Logic(
                "fault-tree execution requires a project basic-event catalogue".to_string(),
            )
        })?;
    serde_json::from_value(value.clone())
        .map_err(|error| serialization_error("invalid fault-tree basic-event catalogue", error))
}

pub(crate) fn catalogue_tables(
    request: &SolverRequest,
) -> Result<(Vec<UncertainParameter>, Vec<UncertainVectorParameter>)> {
    if request.resources.fault_tree_basic_event_catalogue.is_none() {
        return Ok((Vec::new(), Vec::new()));
    }
    let catalogue = catalogue_value(request)?;
    Ok((catalogue.uncertainty_parameters, catalogue.uncertainty_vectors))
}

fn parse_catalogue(request: &SolverRequest, project_id: &str) -> Result<BasicEventCatalogue> {
    let catalogue = catalogue_value(request)?;
    if catalogue.project_id != project_id {
        return Err(PraxisError::Logic(format!(
            "basic-event catalogue project '{}' does not match fault-tree project '{}'",
            catalogue.project_id, project_id
        )));
    }
    Ok(catalogue)
}

struct ResolvedCcfGroup {
    id: String,
    members: Vec<String>,
    model: CcfModel,
    total: Option<Expr>,
}

struct ResolvedCatalogue {
    program: UncertaintyProgram,
    events: HashMap<String, (f64, Expr)>,
    groups: Vec<ResolvedCcfGroup>,
    records: Vec<BasicEventQuantificationRecord>,
}

fn resolve_catalogue(catalogue: BasicEventCatalogue) -> Result<ResolvedCatalogue> {
    let parameters = catalogue.uncertainty_parameters;
    let program =
        UncertaintyProgram::from_table(&parameters)?.with_vectors(&catalogue.uncertainty_vectors)?;
    let mut events = HashMap::with_capacity(catalogue.basic_events.len());
    let mut records = Vec::with_capacity(catalogue.basic_events.len());
    for event in catalogue.basic_events {
        let target = UncertaintyProgram::target(
            &parameters,
            &event.expression,
            &format!("event:{}", event.id),
            UncertainUnit::Probability,
        )?;
        let point = program.point(&target)?;
        require_probability(&format!("basic event '{}'", event.id), None, point)?;
        records.push(BasicEventQuantificationRecord {
            basic_event_id: event.id.clone(),
            expression: event.expression,
            point_probability: point,
        });
        if events.insert(event.id.clone(), (point, target)).is_some() {
            return Err(PraxisError::Logic(format!(
                "basic-event catalogue contains duplicate id '{}'",
                event.id
            )));
        }
    }
    let mut groups = Vec::with_capacity(catalogue.common_cause_failure_groups.len());
    for group in catalogue.common_cause_failure_groups {
        let model = CcfModel::from_factors(&group.id, &group.factors, &parameters, &program)?;
        require_total(&group.id, &model, group.total.is_some())?;
        let total = match &group.total {
            Some(expression) => {
                let total = UncertaintyProgram::target(
                    &parameters,
                    expression,
                    &format!("ccf:{}/total", group.id),
                    UncertainUnit::Probability,
                )?;
                require_probability(
                    &format!("common cause group '{}' total", group.id),
                    None,
                    program.point(&total)?,
                )?;
                Some(total)
            }
            None => None,
        };
        groups.push(ResolvedCcfGroup {
            id: group.id,
            members: group.members,
            model,
            total,
        });
    }
    Ok(ResolvedCatalogue {
        program,
        events,
        groups,
        records,
    })
}

fn build_fault_tree_snapshot(
    request: &SolverRequest,
    snapshot: FaultTreeSnapshot,
    apply_uncertainty: bool,
    include_ccf: bool,
) -> Result<FaultTreeAdapter> {
    let top_gate_id = snapshot
        .top_gate
        .as_ref()
        .map(|top_gate| top_gate.gate_id.clone())
        .ok_or_else(|| PraxisError::Logic("fault-tree snapshot has no top gate".to_string()))?;
    let ResolvedCatalogue {
        program,
        events: catalogue_events,
        groups: common_cause_failure_groups,
        records: basic_event_quantifications,
    } = resolve_catalogue(parse_catalogue(request, &snapshot.project_id)?)?;

    let mut aliases = HashMap::with_capacity(snapshot.leaf_nodes.len());
    let mut basic_event_probabilities = HashMap::new();
    let mut house_events = Vec::new();
    for leaf in snapshot.leaf_nodes {
        match leaf {
            FaultTreeLeaf::BasicEventReference { id, basic_event_id } => {
                let resolved = catalogue_events
                    .get(&basic_event_id)
                    .cloned()
                    .ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "basic-event reference '{}' cannot resolve catalogue event '{}'",
                            id, basic_event_id
                        ))
                    })?;
                aliases.insert(id, basic_event_id.clone());
                basic_event_probabilities.insert(basic_event_id, resolved);
            }
            FaultTreeLeaf::HouseEvent { id, state } => {
                aliases.insert(id.clone(), id.clone());
                house_events.push((id, state));
            }
            FaultTreeLeaf::UndevelopedEvent { id } => {
                return Err(PraxisError::IllegalOperation(format!(
                    "undeveloped event '{id}' has no quantifiable probability"
                )));
            }
            FaultTreeLeaf::TransferReference { id } => {
                return Err(PraxisError::IllegalOperation(format!(
                    "fault-tree transfer reference '{id}' is not supported by the initial adapter"
                )));
            }
        }
    }

    let gate_ids: HashSet<&str> = snapshot.gates.iter().map(FaultTreeGate::id).collect();
    if !gate_ids.contains(top_gate_id.as_str()) {
        return Err(PraxisError::Logic(format!(
            "fault-tree top gate '{}' does not exist",
            top_gate_id
        )));
    }

    let mut inputs_by_gate: HashMap<String, Vec<FaultTreeGateInput>> = HashMap::new();
    for input in snapshot.gate_inputs {
        if !gate_ids.contains(input.gate_id.as_str()) {
            return Err(PraxisError::Logic(format!(
                "gate input '{}' references missing gate '{}'",
                input.id, input.gate_id
            )));
        }
        inputs_by_gate
            .entry(input.gate_id.clone())
            .or_default()
            .push(input);
    }
    for inputs in inputs_by_gate.values_mut() {
        inputs.sort_by_key(|input| input.order);
    }

    let referenced_events: HashSet<String> = basic_event_probabilities.keys().cloned().collect();
    let mut fault_tree = FaultTree::new(snapshot.id.clone(), top_gate_id.clone())?;
    for (id, (probability, target)) in basic_event_probabilities {
        let event = if apply_uncertainty {
            BasicEvent::with_value(id, probability, target)?
        } else {
            BasicEvent::new(id, probability)?
        };
        fault_tree.add_basic_event(event)?;
    }
    for (id, state) in house_events {
        fault_tree.add_house_event(HouseEvent::new(id, state)?)?;
    }
    for gate_snapshot in snapshot.gates {
        let gate_id = gate_snapshot.id().to_string();
        let mut gate = Gate::new(gate_id.clone(), gate_snapshot.formula())?;
        for input in inputs_by_gate.remove(&gate_id).unwrap_or_default() {
            let operand = aliases
                .get(&input.child_id)
                .cloned()
                .unwrap_or(input.child_id);
            gate.add_operand(operand);
        }
        fault_tree.add_gate(gate)?;
    }
    for group in common_cause_failure_groups
        .into_iter()
        .filter(|_| include_ccf)
        .filter(|group| {
            group
                .members
                .iter()
                .any(|member| referenced_events.contains(member))
        })
    {
        fault_tree.add_ccf_group(CcfGroup::new(
            group.id,
            group.members,
            group.model,
            group.total,
        )?)?;
    }
    for (name, expression) in program.into_parameters() {
        fault_tree.set_parameter(name, expression);
    }

    Ok(FaultTreeAdapter {
        fault_tree,
        model_id: snapshot.id,
        model_revision: snapshot.revision,
        top_gate_id,
        basic_event_quantifications,
    })
}

pub(crate) fn build_fault_tree_for_model(
    request: &SolverRequest,
    model_id: &str,
    apply_uncertainty: bool,
) -> Result<FaultTreeAdapter> {
    let snapshot = find_snapshot(request, model_id, None)?;
    build_fault_tree_snapshot(request, snapshot, apply_uncertainty, false)
}

pub(crate) fn build_expanded_fault_tree_for_model(
    request: &SolverRequest,
    model_id: &str,
    apply_uncertainty: bool,
) -> Result<FaultTreeAdapter> {
    let snapshot = find_snapshot(request, model_id, None)?;
    let mut adapter = build_fault_tree_snapshot(request, snapshot, apply_uncertainty, true)?;
    adapter.fault_tree.expand_ccf_groups()?;
    Ok(adapter)
}

fn build_fault_tree(
    request: &SolverRequest,
) -> Result<(FaultTreeAdapter, FaultTreeExecuteRequest)> {
    let execute = parse_request(request)?;
    let snapshot = find_snapshot(request, &execute.model_id, Some(execute.revision))?;
    let apply_uncertainty = matches!(
        execute.calculation_type,
        FaultTreeCalculationType::Uncertainty
    );
    let include_ccf = execute.settings.expand_ccf;
    Ok((
        build_fault_tree_snapshot(request, snapshot, apply_uncertainty, include_ccf)?,
        execute,
    ))
}

pub(crate) fn validate(request: &SolverRequest) -> Result<Value> {
    let (adapter, _) = build_fault_tree(request)?;
    FaultTreeAnalysis::new(&adapter.fault_tree)?.analyze()?;
    Ok(json!({
        "scope": FAULT_TREE_METHOD,
        "valid": true,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "basicEventCount": adapter.fault_tree.basic_events().len()
    }))
}

fn analysis_settings(request: &FaultTreeExecuteRequest) -> Settings {
    let engine = match request.settings.algorithm {
        FaultTreeAlgorithm::Bdd => Engine::Bdd,
        FaultTreeAlgorithm::Zbdd => Engine::Zbdd,
        FaultTreeAlgorithm::ZbddDirect => Engine::ZbddDirect,
        FaultTreeAlgorithm::ZbddDelterm => Engine::ZbddDelterm,
        FaultTreeAlgorithm::Mocus => Engine::Mocus,
        FaultTreeAlgorithm::MocusPi => Engine::MocusPi,
        FaultTreeAlgorithm::MonteCarlo => Engine::MonteCarlo,
    };
    let approximation = match request.settings.approximation {
        FaultTreeApproximation::Exact => Approximation::Exact,
        FaultTreeApproximation::RareEvent => Approximation::RareEvent,
        FaultTreeApproximation::Mcub => Approximation::Mcub,
    };
    let variable_order = match request.settings.variable_order {
        FaultTreeVariableOrder::Dfs => VariableOrder::Dfs,
        FaultTreeVariableOrder::Force => VariableOrder::Force,
        FaultTreeVariableOrder::Sloan => VariableOrder::Sloan,
        FaultTreeVariableOrder::DfsScram => VariableOrder::DfsScram,
        FaultTreeVariableOrder::DfsPlain => VariableOrder::DfsPlain,
        FaultTreeVariableOrder::Reverse => VariableOrder::Reverse,
        FaultTreeVariableOrder::Sift => VariableOrder::Sift,
        FaultTreeVariableOrder::Gsift => VariableOrder::Gsift,
        FaultTreeVariableOrder::Ils => VariableOrder::Ils,
    };
    Settings {
        engine,
        approximation: Some(approximation),
        limit_order: request.settings.limit_order,
        cut_off: request.settings.cut_off,
        importance: matches!(
            request.calculation_type,
            FaultTreeCalculationType::Importance
        ),
        uncertainty: matches!(
            request.calculation_type,
            FaultTreeCalculationType::Uncertainty
        ),
        ccf: request.settings.expand_ccf,
        num_trials: request.settings.num_trials,
        seed: request.settings.seed,
        sampling: request.settings.sampling_method,
        variable_order,
        reorder_budget: Duration::from_secs_f64(request.settings.reorder_budget_seconds),
    }
}

fn sil_level(level: SilLevel) -> &'static str {
    match level {
        SilLevel::None => "NONE",
        SilLevel::Sil1 => "SIL_1",
        SilLevel::Sil2 => "SIL_2",
        SilLevel::Sil3 => "SIL_3",
        SilLevel::Sil4 => "SIL_4",
    }
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value> {
    let (adapter, execute) = build_fault_tree(request)?;
    let settings = analysis_settings(&execute);
    let mut monte_carlo = None;
    let mut monte_carlo_probability = None;
    let quantified = if matches!(execute.settings.algorithm, FaultTreeAlgorithm::MonteCarlo) {
        let analysis = DpMonteCarloAnalysis::new(
            &adapter.fault_tree,
            Some(execute.settings.seed),
            execute.settings.num_trials,
        )?;
        let convergence = ConvergenceSettings {
            enabled: execute.settings.early_stop,
            delta: execute.settings.convergence_delta,
            confidence: execute.settings.confidence_level,
            burn_in: execute.settings.burn_in_trials,
        };
        let variance_reduction = VrtSettings {
            mode: match execute.settings.variance_reduction {
                FaultTreeVarianceReduction::None => VrtMode::None,
                FaultTreeVarianceReduction::ImportanceSampling => VrtMode::ImportanceSampling,
                FaultTreeVarianceReduction::StratifiedSampling => VrtMode::StratifiedSampling,
            },
            is_bias_factor: execute.settings.importance_sampling_bias_factor,
            is_max_events: execute.settings.importance_sampling_max_events,
            is_q_min: execute.settings.importance_sampling_minimum_probability,
            stratify_events: execute.settings.stratify_events,
        };
        let result = if matches!(variance_reduction.mode, VrtMode::None) {
            analysis.run_cpu_with_watch_and_convergence(false, convergence)?
        } else {
            analysis.run_cpu_with_watch_convergence_and_vrt(
                false,
                convergence,
                variance_reduction,
            )?
        };
        monte_carlo_probability = Some(result.probability_estimate);
        monte_carlo = Some(json!({
            "trials": result.num_trials,
            "requestedTrials": execute.settings.num_trials,
            "stoppedEarly": result.num_trials < execute.settings.num_trials,
            "successes": result.successes,
            "standardDeviation": result.std_dev,
            "confidenceInterval": {
                "lower": result.confidence_interval_lower,
                "upper": result.confidence_interval_upper,
                "confidence": 0.95
            },
            "seed": execute.settings.seed,
            "varianceReduction": execute.settings.variance_reduction
        }));
        None
    } else {
        Some(quantify(&adapter.fault_tree, &settings)?)
    };
    let (top_event_probability, probability_method) = match &quantified {
        Some(result) => {
            let probability = result.probability.as_ref().ok_or_else(|| {
                PraxisError::IllegalOperation(
                    "selected fault-tree settings did not produce a probability".to_string(),
                )
            })?;
            let method = match probability.approximation {
                Approximation::Exact
                    if matches!(execute.settings.algorithm, FaultTreeAlgorithm::Bdd)
                        && (execute.settings.limit_order.is_some()
                            || execute.settings.cut_off.is_some()) =>
                {
                    "LIMITED"
                }
                Approximation::Exact => "EXACT",
                Approximation::RareEvent => "RARE_EVENT",
                Approximation::Mcub => "MCUB",
                Approximation::MonteCarlo => "MONTE_CARLO",
            };
            (probability.value, method)
        }
        None => (
            monte_carlo_probability.expect("Monte Carlo probability exists"),
            "MONTE_CARLO",
        ),
    };
    let cut_sets = quantified
        .as_ref()
        .and_then(|result| result.cut_sets.as_ref())
        .map(|sets| {
            json!({
                "primeImplicants": sets.prime_implicants,
                "count": sets.products,
                "distributionByOrder": sets.distribution_by_order,
                "items": sets.list.iter().map(|set| json!({
                    "order": set.literals.len(),
                    "probability": set.probability,
                    "literals": set.literals.iter().map(|(id, negated)| json!({
                        "basicEventId": id,
                        "negated": negated
                    })).collect::<Vec<_>>()
                })).collect::<Vec<_>>()
            })
        });
    let importance = quantified
        .as_ref()
        .and_then(|result| result.importance.as_ref())
        .map(|rows| {
            rows.iter()
                .map(|row| {
                    json!({
                        "basicEventId": row.event,
                        "birnbaum": row.birnbaum,
                        "criticality": row.criticality,
                        "fussellVesely": row.fussell_vesely,
                        "riskAchievementWorth": row.raw,
                        "riskReductionWorth": row.rrw
                    })
                })
                .collect::<Vec<_>>()
        });
    let uncertainty = quantified.as_ref().and_then(|result| result.uncertainty.as_ref()).map(|value| {
        json!({
            "mean": value.mean,
            "standardDeviation": value.standard_deviation,
            "standardError": value.standard_error,
            "quantiles": value.quantiles,
            "samples": value.samples,
            "sampleCount": execute.settings.num_trials,
            "seed": execute.settings.seed,
            "samplingMethod": execute.settings.sampling_method
        })
    });
    let sil = if matches!(execute.calculation_type, FaultTreeCalculationType::Sil) {
        let pfd = Sil::from_probability(top_event_probability);
        let survival = (1.0 - top_event_probability).max(f64::MIN_POSITIVE);
        let pfh = -survival.ln() / execute.settings.mission_time_hours;
        Some(json!({
            "probabilityOfFailureOnDemand": pfd.pfd_avg,
            "dangerousFailureRatePerHour": pfh,
            "pfdLevel": sil_level(SilLevel::from_pfd(pfd.pfd_avg)),
            "pfhLevel": sil_level(SilLevel::from_pfh(pfh))
        }))
    } else {
        None
    };
    let mut result = json!({
        "methodType": FAULT_TREE_METHOD,
        "modelId": adapter.model_id,
        "modelRevision": adapter.model_revision,
        "topGateId": adapter.top_gate_id,
        "topEventProbability": top_event_probability,
        "calculationType": execute.calculation_type,
        "workflow": execute.workflow,
        "algorithm": execute.settings.algorithm,
        "settings": execute.settings,
        "probabilityMethod": probability_method,
        "cutSets": cut_sets,
        "importance": importance,
        "uncertainty": uncertainty,
        "monteCarlo": monte_carlo,
        "sil": sil,
        "basicEventQuantifications": adapter.basic_event_quantifications,
        "validationIssues": []
    });
    if let Some(object) = result.as_object_mut() {
        object.retain(|_, value| !value.is_null());
    }
    Ok(result)
}

#[cfg(test)]
pub(crate) mod tests {
    use serde_json::{json, Value};

    use super::execute;
    use crate::transport::SolverRequest;

    pub(crate) fn value(unit: &str, law: Value) -> Value {
        json!({ "node": "VALUE", "value": { "unit": unit, "law": law } })
    }

    pub(crate) fn point(probability: f64) -> Value {
        value("PROBABILITY", json!({ "family": "POINT", "value": probability }))
    }

    pub(crate) fn point_event(id: &str, probability: f64) -> Value {
        json!({ "id": id, "expression": point(probability) })
    }

    pub(crate) fn per_year(frequency: f64) -> Value {
        crate::fault_tree::tests::value("PER_YEAR", json!({ "family": "POINT", "value": frequency }))
    }

    pub(crate) fn fraction(value: f64) -> Value {
        crate::fault_tree::tests::value("FRACTION", json!({ "family": "POINT", "value": value }))
    }

    pub(crate) fn beta_factor(beta: f64) -> Value {
        json!({ "model": "BETA_FACTOR", "beta": fraction(beta) })
    }

    fn pump_parameter() -> Value {
        json!({ "referenceType": "WORKBOOK_PARAMETER", "workbookId": "da", "entityId": "pump" })
    }

    fn pump_table(upper: f64) -> Value {
        json!([{
            "reference": pump_parameter(),
            "expression": value("PROBABILITY", json!({ "family": "UNIFORM", "lower": 0.01, "upper": upper }))
        }])
    }

    fn pump_event(id: &str) -> Value {
        json!({ "id": id, "expression": { "node": "PARAMETER", "reference": pump_parameter() } })
    }

    fn request(
        gate_type: &str,
        k: Option<usize>,
        probabilities: &[(&str, f64)],
        operands: &[(&str, &str)],
    ) -> SolverRequest {
        let gate_id = "00000000-0000-4000-8000-000000000001";
        let model_id = "00000000-0000-4000-8000-000000000002";
        let project_id = "project-1";
        let mut gate = json!({
            "id": gate_id,
            "kind": "GATE",
            "gateType": gate_type,
            "code": "TOP",
            "name": "Top",
            "description": ""
        });
        if let Some(k) = k {
            gate["k"] = json!(k);
        }
        let leaf_nodes: Vec<Value> = operands
            .iter()
            .enumerate()
            .map(|(index, (reference_id, basic_event_id))| {
                json!({
                    "id": reference_id,
                    "kind": "BASIC_EVENT_REFERENCE",
                    "basicEventId": basic_event_id,
                    "index": index
                })
            })
            .collect();
        let gate_inputs: Vec<Value> = operands
            .iter()
            .enumerate()
            .map(|(index, (reference_id, _))| {
                json!({
                    "id": format!("input-{index}"),
                    "gateId": gate_id,
                    "childId": reference_id,
                    "order": index
                })
            })
            .collect();
        let basic_events: Vec<Value> = probabilities
            .iter()
            .map(|(id, probability)| point_event(id, *probability))
            .collect();

        SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": {
                    "schemaVersion": "1.0.0",
                    "methodType": "FAULT_TREE",
                    "modelId": model_id,
                    "revision": 3,
                    "requestedBy": "analyst"
                },
                "modelSnapshots": [{
                    "id": model_id,
                    "projectId": project_id,
                    "methodType": "FAULT_TREE",
                    "revision": 3,
                    "topGate": { "gateId": gate_id },
                    "gates": [gate],
                    "leafNodes": leaf_nodes,
                    "gateInputs": gate_inputs
                }],
                "resources": {
                    "faultTreeBasicEventCatalogue": {
                        "projectId": project_id,
                        "basicEvents": basic_events
                    }
                }
            })
            .to_string(),
        )
        .unwrap()
    }

    #[test]
    fn quantifies_and_and_or_gates_exactly() {
        let and = execute(&request(
            "AND",
            None,
            &[("A", 0.1), ("B", 0.2)],
            &[("ref-a", "A"), ("ref-b", "B")],
        ))
        .unwrap();
        assert!((and["topEventProbability"].as_f64().unwrap() - 0.02).abs() < 1e-12);

        let or = execute(&request(
            "OR",
            None,
            &[("A", 0.1), ("B", 0.2)],
            &[("ref-a", "A"), ("ref-b", "B")],
        ))
        .unwrap();
        assert!((or["topEventProbability"].as_f64().unwrap() - 0.28).abs() < 1e-12);
        assert!(or.get("minimalCutSetCount").is_none());
        assert!(or.get("leadingCutSets").is_none());
    }

    #[test]
    fn quantifies_a_mission_model_with_its_point_inputs() {
        let mut request = request("OR", None, &[("A", 0.0)], &[("ref-a", "A")]);
        request.resources.fault_tree_basic_event_catalogue = Some(json!({
            "projectId": "project-1",
            "basicEvents": [{
                "id": "A",
                "expression": { "node": "MODEL", "model": {
                    "form": "MISSION",
                    "rate": value("PER_HOUR", json!({ "family": "POINT", "value": 2.0e-5 })),
                    "missionTime": value("HOURS", json!({ "family": "POINT", "value": 24.0 }))
                } }
            }]
        }));

        let result = execute(&request).unwrap();
        let expected = -(-4.8e-4f64).exp_m1();
        assert!((result["topEventProbability"].as_f64().unwrap() - expected).abs() < 1e-18);
        let record = &result["basicEventQuantifications"][0];
        assert_eq!(record["expression"]["model"]["form"], "MISSION");
        assert!((record["pointProbability"].as_f64().unwrap() - expected).abs() < 1e-18);
    }

    #[test]
    fn matches_boolean_gate_truth_tables_exhaustively() {
        for a in [0.0, 1.0] {
            for b in [0.0, 1.0] {
                let inputs = &[("A", a), ("B", b)];
                let references = &[("ref-a", "A"), ("ref-b", "B")];
                let and = execute(&request("AND", None, inputs, references)).unwrap();
                let or = execute(&request("OR", None, inputs, references)).unwrap();
                assert_eq!(and["topEventProbability"].as_f64().unwrap(), a * b);
                assert_eq!(
                    or["topEventProbability"].as_f64().unwrap(),
                    if a == 1.0 || b == 1.0 { 1.0 } else { 0.0 }
                );
            }
        }

        for a in [0.0, 1.0] {
            for b in [0.0, 1.0] {
                for c in [0.0, 1.0] {
                    let inputs = &[("A", a), ("B", b), ("C", c)];
                    let references = &[("ref-a", "A"), ("ref-b", "B"), ("ref-c", "C")];
                    let voting = execute(&request("K_OF_N", Some(2), inputs, references)).unwrap();
                    let true_count = [a, b, c].iter().filter(|value| **value == 1.0).count();
                    assert_eq!(
                        voting["topEventProbability"].as_f64().unwrap(),
                        if true_count >= 2 { 1.0 } else { 0.0 }
                    );
                }
            }
        }

        for a in [0.0, 1.0] {
            let not = execute(&request("NOT", None, &[("A", a)], &[("ref-a", "A")])).unwrap();
            assert_eq!(not["topEventProbability"].as_f64().unwrap(), 1.0 - a);
        }
    }

    #[test]
    fn preserves_shared_basic_event_identity() {
        let result = execute(&request(
            "OR",
            None,
            &[("SHARED", 0.25)],
            &[("ref-a", "SHARED"), ("ref-b", "SHARED")],
        ))
        .unwrap();
        assert!((result["topEventProbability"].as_f64().unwrap() - 0.25).abs() < 1e-12);
    }

    #[test]
    fn quantifies_k_of_n_exactly() {
        let result = execute(&request(
            "K_OF_N",
            Some(2),
            &[("A", 0.5), ("B", 0.5), ("C", 0.5)],
            &[("ref-a", "A"), ("ref-b", "B"), ("ref-c", "C")],
        ))
        .unwrap();
        assert!((result["topEventProbability"].as_f64().unwrap() - 0.5).abs() < 1e-12);
    }

    #[test]
    fn quantifies_not_gates_exactly() {
        let result = execute(&request("NOT", None, &[("A", 0.2)], &[("ref-a", "A")])).unwrap();
        assert!((result["topEventProbability"].as_f64().unwrap() - 0.8).abs() < 1e-12);
        assert_eq!(result["validationIssues"], json!([]));
    }

    fn product_request(
        probabilities: &[(&str, f64)],
        products: &[Vec<(&str, bool)>],
    ) -> SolverRequest {
        let references: Vec<_> = probabilities.iter().map(|(id, _)| (*id, *id)).collect();
        let mut request = request("OR", None, probabilities, &references);
        let snapshot = &mut request.model_snapshots[0];
        let top = snapshot["topGate"]["gateId"].as_str().unwrap().to_string();
        snapshot["gateInputs"] = json!([]);
        for (id, _) in probabilities {
            let gate = format!("not-{id}");
            snapshot["gates"]
                .as_array_mut()
                .unwrap()
                .push(json!({ "id": gate, "gateType": "NOT" }));
            snapshot["gateInputs"].as_array_mut().unwrap().push(json!({
                "id": format!("input-{gate}"), "gateId": gate, "childId": id, "order": 0
            }));
        }
        for (index, product) in products.iter().enumerate() {
            let gate = format!("product-{index}");
            snapshot["gates"]
                .as_array_mut()
                .unwrap()
                .push(json!({ "id": gate, "gateType": "AND" }));
            let inputs = snapshot["gateInputs"].as_array_mut().unwrap();
            inputs.push(json!({ "id": format!("top-{index}"), "gateId": top, "childId": gate, "order": index }));
            for (order, (id, complemented)) in product.iter().enumerate() {
                let child = if *complemented {
                    format!("not-{id}")
                } else {
                    id.to_string()
                };
                inputs.push(json!({ "id": format!("{gate}-{order}"), "gateId": gate, "childId": child, "order": order }));
            }
        }
        request
    }

    #[test]
    fn quantifies_mixed_success_and_failure_conditions_exactly() {
        let result = execute(&product_request(
            &[("A", 0.2), ("B", 0.3), ("C", 0.4)],
            &[
                vec![("A", false), ("B", false)],
                vec![("A", true), ("C", false)],
            ],
        ))
        .unwrap();
        assert!((result["topEventProbability"].as_f64().unwrap() - 0.38).abs() < 1e-12);
    }

    #[test]
    fn matches_all_two_event_truth_tables() {
        let names = ["A", "B"];
        let probabilities = [0.2, 0.7];
        for truth in 0u8..16 {
            let products: Vec<_> = (0..4)
                .filter(|assignment| truth & (1 << assignment) != 0)
                .map(|assignment| {
                    (0..2)
                        .map(|v| (names[v], assignment & (1 << v) == 0))
                        .collect()
                })
                .collect();
            let result = execute(&product_request(
                &[("A", probabilities[0]), ("B", probabilities[1])],
                &products,
            ))
            .unwrap();
            let exact: f64 = (0..4)
                .filter(|assignment| truth & (1 << assignment) != 0)
                .map(|assignment| {
                    (0..2)
                        .map(|v| {
                            if assignment & (1 << v) != 0 {
                                probabilities[v]
                            } else {
                                1.0 - probabilities[v]
                            }
                        })
                        .product::<f64>()
                })
                .sum();
            assert!((result["topEventProbability"].as_f64().unwrap() - exact).abs() < 1e-12);
        }
    }

    #[test]
    fn quantifies_overlapping_products_exactly() {
        let request = product_request(
            &[("A", 0.1), ("B", 0.2), ("C", 0.3)],
            &[
                vec![("A", false), ("B", false)],
                vec![("A", false), ("C", false)],
                vec![("A", false), ("B", false), ("C", false)],
            ],
        );
        let result = execute(&request).unwrap();
        assert!((result["topEventProbability"].as_f64().unwrap() - 0.044).abs() < 1e-12);
        assert_eq!(result["validationIssues"], json!([]));
    }

    #[test]
    fn quantifies_constant_and_zero_probability_events() {
        let always_true = execute(&request("AND", None, &[], &[])).unwrap();
        assert_eq!(always_true["topEventProbability"], 1.0);
        let always_false = execute(&request("OR", None, &[], &[])).unwrap();
        assert_eq!(always_false["topEventProbability"], 0.0);
        assert_eq!(always_false["validationIssues"], json!([]));

        let zero = execute(&request("OR", None, &[("A", 0.0)], &[("ref-a", "A")])).unwrap();
        assert_eq!(zero["topEventProbability"], 0.0);
    }

    #[test]
    fn probability_execution_does_not_enumerate_exponential_cut_sets() {
        // AND of 32 independent two-event ORs has 2^32 minimal cut sets.
        let names: Vec<_> = (0..64).map(|index| format!("E{index:02}")).collect();
        let probabilities: Vec<_> = names.iter().map(|id| (id.as_str(), 0.1)).collect();
        let references: Vec<_> = names.iter().map(|id| (id.as_str(), id.as_str())).collect();
        let mut request = request("AND", None, &probabilities, &references);
        let snapshot = &mut request.model_snapshots[0];
        let top = snapshot["topGate"]["gateId"].as_str().unwrap().to_string();
        snapshot["gateInputs"] = json!([]);
        for (index, pair) in names.chunks(2).enumerate() {
            let gate = format!("pair-{index}");
            snapshot["gates"].as_array_mut().unwrap().push(json!({
                "id": gate, "gateType": "OR"
            }));
            let inputs = snapshot["gateInputs"].as_array_mut().unwrap();
            inputs.push(json!({
                "id": format!("top-{index}"), "gateId": top, "childId": gate, "order": index
            }));
            for (order, child) in pair.iter().enumerate() {
                inputs.push(json!({
                    "id": format!("input-{child}"), "gateId": gate, "childId": child, "order": order
                }));
            }
        }
        let result = execute(&request).unwrap();
        let probability = result["topEventProbability"].as_f64().unwrap();
        assert!((probability / 0.19_f64.powi(32) - 1.0).abs() < 1e-12);
        assert!(result.get("minimalCutSetCount").is_none());
        assert!(result.get("leadingCutSets").is_none());
    }

    fn configure(
        request: &mut SolverRequest,
        calculation_type: &str,
        algorithm: &str,
        approximation: &str,
    ) {
        request.request["calculationType"] = json!(calculation_type);
        request.request["workflow"] = json!("MANUAL");
        request.request["settings"] = json!({
            "algorithm": algorithm,
            "approximation": approximation,
            "variableOrder": "DFS",
            "reorderBudgetSeconds": 60,
            "expandCcf": false,
            "numTrials": 2_000,
            "seed": 847,
            "missionTimeHours": 8_760
        });
    }

    #[test]
    fn exposes_cut_sets_with_limits_and_probability_method() {
        let mut request = request(
            "OR",
            None,
            &[("A", 0.1), ("B", 0.2)],
            &[("ref-a", "A"), ("ref-b", "B")],
        );
        configure(&mut request, "PROBABILITY_AND_CUT_SETS", "ZBDD", "EXACT");
        request.request["settings"]["limitOrder"] = json!(1);
        let result = execute(&request).unwrap();
        assert_eq!(result["calculationType"], "PROBABILITY_AND_CUT_SETS");
        assert_eq!(result["probabilityMethod"], "EXACT");
        assert_eq!(result["cutSets"]["count"], 2);
        assert_eq!(result["cutSets"]["items"][0]["order"], 1);
    }

    #[test]
    fn labels_bdd_probability_limits_without_claiming_an_exact_full_result() {
        let mut request = request("OR", None, &[("A", 0.1)], &[("ref-a", "A")]);
        configure(&mut request, "PROBABILITY", "BDD", "EXACT");
        request.request["settings"]["limitOrder"] = json!(1);
        let result = execute(&request).unwrap();
        assert_eq!(result["probabilityMethod"], "LIMITED");
    }

    #[test]
    fn exposes_importance_measures() {
        let mut request = request(
            "OR",
            None,
            &[("A", 0.1), ("B", 0.2)],
            &[("ref-a", "A"), ("ref-b", "B")],
        );
        configure(&mut request, "IMPORTANCE", "BDD", "EXACT");
        let result = execute(&request).unwrap();
        assert_eq!(result["importance"].as_array().unwrap().len(), 2);
        assert!(result["importance"][0]["birnbaum"].is_number());
    }

    #[test]
    fn exposes_uncertainty_sampling_summary() {
        let mut request = request("OR", None, &[("A", 0.1)], &[("ref-a", "A")]);
        configure(&mut request, "UNCERTAINTY", "BDD", "EXACT");
        request.request["settings"]["samplingMethod"] = json!("LATIN_HYPERCUBE");
        request.resources.fault_tree_basic_event_catalogue = Some(json!({
            "projectId": "project-1",
            "basicEvents": [{ "id": "A", "expression": value("PROBABILITY", json!({
                "family": "BETA", "alpha": 2.0, "beta": 18.0, "lower": 0.0, "upper": 1.0
            })) }]
        }));
        let result = execute(&request).unwrap();
        let uncertainty = &result["uncertainty"];
        assert_eq!(uncertainty["sampleCount"], 2_000);
        assert_eq!(uncertainty["samplingMethod"], "LATIN_HYPERCUBE");
        assert_eq!(uncertainty["samples"].as_array().unwrap().len(), 2_000);
        assert_eq!(uncertainty["quantiles"].as_array().unwrap().len(), 5);
        assert!(uncertainty["standardError"].as_f64().unwrap() > 0.0);
        assert!(((uncertainty["mean"].as_f64().unwrap() - 0.1) / 0.1).abs() < 0.01);
        assert!((result["topEventProbability"].as_f64().unwrap() - 0.1).abs() < 1e-15);
    }

    fn sampled_pair(catalogue: Value) -> SolverRequest {
        let mut request = request(
            "AND",
            None,
            &[("A", 0.105), ("B", 0.105)],
            &[("ref-a", "A"), ("ref-b", "B")],
        );
        configure(&mut request, "UNCERTAINTY", "BDD", "EXACT");
        request.request["settings"]["numTrials"] = json!(100_000);
        request.request["settings"]["expandCcf"] = json!(true);
        request.resources.fault_tree_basic_event_catalogue = Some(catalogue);
        request
    }

    #[test]
    fn samples_one_draw_for_events_sharing_an_estimate() {
        let request = sampled_pair(json!({
            "projectId": "project-1",
            "basicEvents": [pump_event("A"), pump_event("B")],
            "uncertaintyParameters": pump_table(0.2)
        }));
        let mean = execute(&request).unwrap()["uncertainty"]["mean"]
            .as_f64()
            .unwrap();
        assert!(
            (mean / (0.007999 / 0.57) - 1.0).abs() < 0.01,
            "sampled mean {mean}"
        );
    }

    fn binomial_failure_rate() -> Value {
        json!({
            "model": "BINOMIAL_FAILURE_RATE",
            "independent": point(1e-3),
            "nonLethalShock": point(2e-4),
            "componentFailure": fraction(0.15),
            "lethalShock": point(3e-6)
        })
    }

    fn triple(groups: Value) -> SolverRequest {
        let mut request = request(
            "AND",
            None,
            &[("A", 0.01), ("B", 0.01), ("C", 0.01)],
            &[("ref-a", "A"), ("ref-b", "B"), ("ref-c", "C")],
        );
        configure(&mut request, "PROBABILITY", "BDD", "EXACT");
        request.request["settings"]["expandCcf"] = json!(true);
        let mut catalogue = request.resources.fault_tree_basic_event_catalogue.clone().unwrap();
        catalogue["commonCauseFailureGroups"] = groups;
        request.resources.fault_tree_basic_event_catalogue = Some(catalogue);
        request
    }

    #[test]
    fn quantifies_a_binomial_failure_rate_group_without_a_total() {
        let result = execute(&triple(json!([{
            "id": "G", "members": ["A", "B", "C"], "factors": binomial_failure_rate()
        }])))
        .unwrap();
        let top = result["topEventProbability"].as_f64().unwrap();
        assert!((top / 3.6878339078995066e-06 - 1.0).abs() < 1e-12, "{top}");
        let with_total = execute(&triple(json!([{
            "id": "G", "members": ["A", "B", "C"], "factors": binomial_failure_rate(), "total": point(0.01)
        }])))
        .unwrap_err()
        .to_string();
        assert!(with_total.contains("takes no total"), "{with_total}");
        let without_total = execute(&triple(json!([{
            "id": "G", "members": ["A", "B", "C"], "factors": beta_factor(0.1)
        }])))
        .unwrap_err()
        .to_string();
        assert!(without_total.contains("needs a total"), "{without_total}");
    }

    #[test]
    fn samples_common_cause_totals_from_the_member_estimate() {
        let request = sampled_pair(json!({
            "projectId": "project-1",
            "basicEvents": [pump_event("A"), pump_event("B")],
            "commonCauseFailureGroups": [{
                "id": "CCF",
                "members": ["A", "B"],
                "factors": crate::fault_tree::tests::beta_factor(0.1),
                "total": { "node": "PARAMETER", "reference": pump_parameter() }
            }],
            "uncertaintyParameters": pump_table(0.2)
        }));
        let result = execute(&request).unwrap();
        let point = result["topEventProbability"].as_f64().unwrap();
        let independent = 0.0945_f64.powi(2);
        assert!((point - (independent + 0.0105 - independent * 0.0105)).abs() < 1e-15);
        let mean = result["uncertainty"]["mean"].as_f64().unwrap();
        assert!(
            (mean / 0.02169647475 - 1.0).abs() < 0.01,
            "sampled mean {mean}"
        );
    }

    #[test]
    fn rejects_a_parameter_defined_twice() {
        let mut table = pump_table(0.2);
        table
            .as_array_mut()
            .unwrap()
            .push(pump_table(0.3)[0].clone());
        let request = sampled_pair(json!({
            "projectId": "project-1",
            "basicEvents": [pump_event("A"), pump_event("B")],
            "uncertaintyParameters": table
        }));
        let error = execute(&request).unwrap_err().to_string();
        assert!(error.contains("da:pump"), "{error}");
    }

    #[test]
    fn refuses_a_basic_event_law_that_leaves_probability() {
        let request = sampled_pair(json!({
            "projectId": "project-1",
            "basicEvents": [
                { "id": "A", "expression": value("PROBABILITY", json!({
                    "family": "LOGNORMAL", "mean": 0.1, "errorFactor": 3.0, "level": 0.95
                })) },
                point_event("B", 0.105)
            ]
        }));
        assert!(execute(&request).is_err());
    }

    #[test]
    fn exposes_monte_carlo_diagnostics() {
        let mut request = request("OR", None, &[("A", 0.25)], &[("ref-a", "A")]);
        configure(&mut request, "PROBABILITY", "MONTE_CARLO", "EXACT");
        let result = execute(&request).unwrap();
        assert_eq!(result["probabilityMethod"], "MONTE_CARLO");
        assert_eq!(result["monteCarlo"]["trials"], 2_000);
        assert!(result["monteCarlo"]["confidenceInterval"]["lower"].is_number());
    }

    #[test]
    fn exposes_monte_carlo_convergence_and_variance_reduction_controls() {
        let mut request = request("OR", None, &[("A", 0.01)], &[("ref-a", "A")]);
        configure(&mut request, "PROBABILITY", "MONTE_CARLO", "EXACT");
        request.request["settings"]["earlyStop"] = json!(true);
        request.request["settings"]["convergenceDelta"] = json!(0.5);
        request.request["settings"]["confidenceLevel"] = json!(0.95);
        request.request["settings"]["burnInTrials"] = json!(128);
        let early = execute(&request).unwrap();
        assert_eq!(early["monteCarlo"]["requestedTrials"], 2_000);

        request.request["settings"]["earlyStop"] = json!(false);
        request.request["settings"]["varianceReduction"] = json!("IMPORTANCE_SAMPLING");
        request.request["settings"]["importanceSamplingBiasFactor"] = json!(10.0);
        request.request["settings"]["importanceSamplingMaxEvents"] = json!(32);
        request.request["settings"]["importanceSamplingMinimumProbability"] = json!(1e-12);
        let variance_reduced = execute(&request).unwrap();
        assert_eq!(
            variance_reduced["monteCarlo"]["varianceReduction"],
            "IMPORTANCE_SAMPLING"
        );
        assert_eq!(variance_reduced["monteCarlo"]["trials"], 2_000);
        let estimate = variance_reduced["topEventProbability"].as_f64().unwrap();
        assert!(estimate > 0.0 && estimate < 0.05);
    }

    #[test]
    fn exposes_sil_classification_for_the_selected_mission_time() {
        let mut request = request("OR", None, &[("A", 0.001)], &[("ref-a", "A")]);
        configure(&mut request, "SIL", "BDD", "EXACT");
        let result = execute(&request).unwrap();
        assert_eq!(result["sil"]["pfdLevel"], "SIL_2");
        assert!(
            result["sil"]["dangerousFailureRatePerHour"]
                .as_f64()
                .unwrap()
                > 0.0
        );
    }

    #[test]
    fn expands_application_supplied_common_cause_groups() {
        let mut request = request(
            "OR",
            None,
            &[("A", 0.1), ("B", 0.1)],
            &[("ref-a", "A"), ("ref-b", "B")],
        );
        configure(&mut request, "PROBABILITY", "BDD", "EXACT");
        request.request["settings"]["expandCcf"] = json!(true);
        request.resources.fault_tree_basic_event_catalogue = Some(json!({
            "projectId": "project-1",
            "basicEvents": [point_event("A", 0.1), point_event("B", 0.1)],
            "commonCauseFailureGroups": [{
                "id": "CCF",
                "members": ["A", "B"],
                "factors": crate::fault_tree::tests::beta_factor(0.1),
                "total": point(0.1)
            }]
        }));
        let result = execute(&request).unwrap();
        assert_eq!(result["settings"]["expandCcf"], true);
        assert!(result["topEventProbability"].as_f64().unwrap() > 0.0);
    }

    fn vector_reference(entity: &str) -> Value {
        json!({ "referenceType": "WORKBOOK_PARAMETER", "workbookId": "da", "entityId": entity })
    }

    fn alpha_group(id: &str, members: [&str; 2], testing: &str, alphas: Value) -> Value {
        json!({
            "id": id,
            "members": members,
            "factors": { "model": "ALPHA_FACTOR", "testing": testing, "alphas": alphas },
            "total": point(0.3)
        })
    }

    fn ccf_request(gate_type: &str, events: &[&str], top: &[&str], groups: Value, vectors: Value) -> SolverRequest {
        let references: Vec<(&str, &str)> = top.iter().map(|id| (*id, *id)).collect();
        let probabilities: Vec<(&str, f64)> = events.iter().map(|id| (*id, 0.3)).collect();
        let mut request = request(gate_type, None, &probabilities, &references);
        configure(&mut request, "UNCERTAINTY", "BDD", "EXACT");
        request.request["settings"]["expandCcf"] = json!(true);
        request.request["settings"]["numTrials"] = json!(400);
        request.resources.fault_tree_basic_event_catalogue = Some(json!({
            "projectId": "project-1",
            "basicEvents": events.iter().map(|id| point_event(id, 0.3)).collect::<Vec<_>>(),
            "commonCauseFailureGroups": groups,
            "uncertaintyVectors": vectors
        }));
        request
    }

    #[test]
    fn honors_the_alpha_factor_testing_scheme() {
        let fixed = json!({ "node": "VALUE", "law": { "family": "FIXED", "values": [0.8, 0.2] } });
        for (testing, single, common) in [
            ("NON_STAGGERED", 0.8 / 1.2 * 0.3, 2.0 * 0.2 / 1.2 * 0.3),
            ("STAGGERED", 0.8 * 0.3, 0.2 * 0.3),
        ] {
            let mut request = ccf_request(
                "AND",
                &["A", "B"],
                &["A", "B"],
                json!([alpha_group("G", ["A", "B"], testing, fixed.clone())]),
                json!([]),
            );
            configure(&mut request, "PROBABILITY", "BDD", "EXACT");
            request.request["settings"]["expandCcf"] = json!(true);
            let result = execute(&request).unwrap();
            let both = common + (1.0 - common) * single * single;
            let top = result["topEventProbability"].as_f64().unwrap();
            assert!((top - both).abs() < 1e-15, "{testing}: {top} against {both}");
        }
    }

    #[test]
    fn a_shared_vector_parameter_gives_every_group_one_draw_per_trial() {
        let shared = json!({ "node": "PARAMETER", "reference": vector_reference("alphas") });
        let table = json!([{
            "reference": vector_reference("alphas"),
            "vector": { "family": "DIRICHLET", "concentrations": [3.0, 2.0] }
        }]);
        let groups = json!([
            alpha_group("G1", ["A", "B"], "NON_STAGGERED", shared.clone()),
            alpha_group("G2", ["C", "D"], "NON_STAGGERED", shared)
        ]);
        let events = ["A", "B", "C", "D"];
        let single = execute(&ccf_request("OR", &events, &["A"], groups.clone(), table.clone())).unwrap();
        let joint = execute(&ccf_request("AND", &events, &["A", "C"], groups, table)).unwrap();
        let single = single["uncertainty"]["samples"].as_array().unwrap();
        let joint = joint["uncertainty"]["samples"].as_array().unwrap();
        let mut spread = 0.0_f64;
        for (alone, together) in single.iter().zip(joint) {
            let alone = alone.as_f64().unwrap();
            let together = together.as_f64().unwrap();
            assert!((together - alone * alone).abs() <= 1e-15, "{together} against {alone}");
            spread = spread.max((alone - single[0].as_f64().unwrap()).abs());
        }
        assert!(spread > 1e-3);
    }

    #[test]
    fn rejects_factor_vectors_and_draws_outside_their_group() {
        let three = json!({ "node": "VALUE", "law": { "family": "DIRICHLET", "concentrations": [3.0, 2.0, 1.0] } });
        let error = execute(&ccf_request(
            "OR",
            &["A", "B"],
            &["A"],
            json!([alpha_group("G", ["A", "B"], "STAGGERED", three)]),
            json!([]),
        ))
        .unwrap_err()
        .to_string();
        assert!(error.contains("common cause group 'G'"), "{error}");
        let missing = json!({ "node": "PARAMETER", "reference": vector_reference("absent") });
        assert!(execute(&ccf_request(
            "OR",
            &["A", "B"],
            &["A"],
            json!([alpha_group("G", ["A", "B"], "STAGGERED", missing)]),
            json!([]),
        ))
        .is_err());
        let doubled = json!({ "node": "OPERATION", "operation": "MULTIPLY", "operands": [
            value("FACTOR", json!({ "family": "POINT", "value": 2.0 })),
            value("FRACTION", json!({ "family": "UNIFORM", "lower": 0.0, "upper": 0.9 }))
        ] });
        let error = execute(&ccf_request(
            "OR",
            &["A", "B"],
            &["A"],
            json!([{ "id": "G", "members": ["A", "B"], "factors": { "model": "BETA_FACTOR", "beta": doubled }, "total": point(0.3) }]),
            json!([]),
        ))
        .unwrap_err()
        .to_string();
        assert!(error.contains("common cause group 'G' beta factor") && error.contains("trial"), "{error}");
        let error = execute(&ccf_request(
            "OR",
            &["A", "B"],
            &["A"],
            json!([{ "id": "G", "members": ["A", "B"], "factors": { "model": "MGL", "factors": [fraction(0.1), fraction(0.2)] }, "total": point(0.3) }]),
            json!([]),
        ))
        .unwrap_err()
        .to_string();
        assert!(error.contains("MGL factors"), "{error}");
    }
}
