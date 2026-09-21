use std::collections::{HashMap, HashSet};
use std::time::Duration;

use praxis::algorithms::build::VariableOrder;
use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::analysis::quantify::{quantify, Approximation, Engine, Settings};
use praxis::analysis::sil::{Sil, SilLevel};
use praxis::core::ccf::{CcfGroup, CcfModel, TestingScheme};
use praxis::core::event::{BasicEvent, HouseEvent};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::expression::expr::LOGNORMAL_EF_QUANTILE;
use praxis::expression::Expr;
use praxis::mc::core::{ConvergenceSettings, VrtMode, VrtSettings};
use praxis::mc::DpMonteCarloAnalysis;
use praxis::quantitative::{resolve_basic_event_probability, BasicEventQuantificationBasis};
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
#[serde(rename_all = "camelCase")]
struct BasicEventCatalogue {
    project_id: String,
    basic_events: Vec<CatalogueBasicEvent>,
    #[serde(default)]
    common_cause_failure_groups: Vec<CatalogueCcfGroup>,
    #[serde(default)]
    uncertainty_inputs: Vec<CatalogueUncertaintyInput>,
}

#[derive(Debug, Deserialize)]
struct CatalogueBasicEvent {
    id: String,
    probability: CatalogueProbability,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CatalogueCcfGroup {
    id: String,
    members: Vec<String>,
    model: CatalogueCcfModel,
    total_failure_probability: f64,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "SCREAMING_SNAKE_CASE")]
enum CatalogueCcfModel {
    BetaFactor { beta: f64 },
    Mgl { factors: Vec<f64> },
    AlphaFactor { factors: Vec<f64> },
    PhiFactor { factors: Vec<f64> },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CatalogueUncertaintyInput {
    basic_event_id: String,
    distribution_type: String,
    parameters: HashMap<String, f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CatalogueProbability {
    value: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    quantification_basis: Option<BasicEventQuantificationBasis>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BasicEventQuantificationRecord {
    basic_event_id: String,
    input: CatalogueProbability,
    resolved_probability: f64,
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

fn parse_catalogue(request: &SolverRequest, project_id: &str) -> Result<BasicEventCatalogue> {
    let value = request
        .resources
        .fault_tree_basic_event_catalogue
        .as_ref()
        .ok_or_else(|| {
            PraxisError::Logic(
                "fault-tree execution requires a project basic-event catalogue".to_string(),
            )
        })?;
    let catalogue: BasicEventCatalogue = serde_json::from_value(value.clone())
        .map_err(|error| serialization_error("invalid fault-tree basic-event catalogue", error))?;
    if catalogue.project_id != project_id {
        return Err(PraxisError::Logic(format!(
            "basic-event catalogue project '{}' does not match fault-tree project '{}'",
            catalogue.project_id, project_id
        )));
    }
    Ok(catalogue)
}

fn distribution_parameter(input: &CatalogueUncertaintyInput, names: &[&str]) -> Result<f64> {
    names
        .iter()
        .find_map(|name| input.parameters.get(*name).copied())
        .filter(|value| value.is_finite())
        .ok_or_else(|| {
            PraxisError::Settings(format!(
                "uncertainty distribution '{}' for basic event '{}' requires {}",
                input.distribution_type,
                input.basic_event_id,
                names.join(" or ")
            ))
        })
}

fn uncertainty_expression(input: &CatalogueUncertaintyInput) -> Result<Option<Expr>> {
    let constant = |value| Box::new(Expr::Constant(value));
    let expression = match input.distribution_type.to_ascii_lowercase().as_str() {
        "point_estimate" | "binomial" | "poisson" => return Ok(None),
        "normal" => Expr::NormalDeviate {
            mean: constant(distribution_parameter(input, &["mean", "mu"])?),
            sigma: constant(distribution_parameter(input, &["standardDeviation", "stdDev", "sigma"])?),
        },
        "lognormal" | "lognormal_time" => {
            let (mu, sigma) = match (
                input.parameters.get("mu").copied(),
                input.parameters.get("sigma").copied(),
            ) {
                (Some(mu), Some(sigma)) => (mu, sigma),
                _ => {
                    let median = distribution_parameter(input, &["median"])?;
                    let error_factor = distribution_parameter(input, &["errorFactor", "errorFactor95"])?;
                    if median <= 0.0 || error_factor < 1.0 {
                        return Err(PraxisError::Settings(format!(
                            "lognormal uncertainty for '{}' requires positive median and error factor at least 1",
                            input.basic_event_id
                        )));
                    }
                    (median.ln(), error_factor.ln() / LOGNORMAL_EF_QUANTILE)
                }
            };
            Expr::LognormalDeviate { mu: constant(mu), sigma: constant(sigma) }
        }
        "beta" => Expr::BetaDeviate {
            alpha: constant(distribution_parameter(input, &["alpha"])?),
            beta: constant(distribution_parameter(input, &["beta", "betaParam"])?),
        },
        "gamma" => Expr::GammaDeviate {
            shape: constant(distribution_parameter(input, &["shape", "alpha"])?),
            rate: constant(distribution_parameter(input, &["rate", "beta", "betaParam"])?),
        },
        "exponential" => Expr::GammaDeviate {
            shape: constant(1.0),
            rate: constant(distribution_parameter(input, &["rate", "lambda"])?),
        },
        "uniform" => Expr::UniformDeviate {
            lower: constant(distribution_parameter(input, &["lower", "min"])?),
            upper: constant(distribution_parameter(input, &["upper", "max"])?),
        },
        "triangular" => Expr::TriangularDeviate {
            lower: constant(distribution_parameter(input, &["lower", "min"])?),
            mode: constant(distribution_parameter(input, &["mode"])?),
            upper: constant(distribution_parameter(input, &["upper", "max"])?),
        },
        unsupported => {
            return Err(PraxisError::Settings(format!(
                "uncertainty distribution '{}' for basic event '{}' is not supported by fault-tree sampling",
                unsupported, input.basic_event_id
            )))
        }
    };
    Ok(Some(expression))
}

fn catalogue_ccf_model(model: CatalogueCcfModel) -> CcfModel {
    match model {
        CatalogueCcfModel::BetaFactor { beta } => CcfModel::BetaFactor(beta),
        CatalogueCcfModel::Mgl { factors } => CcfModel::Mgl(factors),
        CatalogueCcfModel::AlphaFactor { factors } => CcfModel::AlphaFactor {
            factors,
            scheme: TestingScheme::NonStaggered,
        },
        CatalogueCcfModel::PhiFactor { factors } => CcfModel::PhiFactor(factors),
    }
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
    let catalogue = parse_catalogue(request, &snapshot.project_id)?;
    let BasicEventCatalogue {
        basic_events: catalogue_events,
        common_cause_failure_groups,
        uncertainty_inputs,
        ..
    } = catalogue;
    let uncertainty_by_event: HashMap<String, CatalogueUncertaintyInput> = uncertainty_inputs
        .into_iter()
        .map(|input| (input.basic_event_id.clone(), input))
        .collect();

    let mut catalogue_probabilities = HashMap::with_capacity(catalogue_events.len());
    let mut basic_event_quantifications = Vec::with_capacity(catalogue_events.len());
    for event in catalogue_events {
        let resolved_probability = resolve_basic_event_probability(
            event.probability.value,
            event.probability.quantification_basis.as_ref(),
        )?;
        basic_event_quantifications.push(BasicEventQuantificationRecord {
            basic_event_id: event.id.clone(),
            input: event.probability,
            resolved_probability,
        });
        if catalogue_probabilities
            .insert(event.id.clone(), resolved_probability)
            .is_some()
        {
            return Err(PraxisError::Logic(format!(
                "basic-event catalogue contains duplicate id '{}'",
                event.id
            )));
        }
    }

    let mut aliases = HashMap::with_capacity(snapshot.leaf_nodes.len());
    let mut basic_event_probabilities = HashMap::new();
    let mut house_events = Vec::new();
    for leaf in snapshot.leaf_nodes {
        match leaf {
            FaultTreeLeaf::BasicEventReference { id, basic_event_id } => {
                let probability = catalogue_probabilities
                    .get(&basic_event_id)
                    .copied()
                    .ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "basic-event reference '{}' cannot resolve catalogue event '{}'",
                            id, basic_event_id
                        ))
                    })?;
                aliases.insert(id, basic_event_id.clone());
                basic_event_probabilities.insert(basic_event_id, probability);
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

    let mut fault_tree = FaultTree::new(snapshot.id.clone(), top_gate_id.clone())?;
    for (id, probability) in basic_event_probabilities {
        let event = match uncertainty_by_event.get(&id).filter(|_| apply_uncertainty) {
            Some(input) => match uncertainty_expression(input)? {
                Some(expression) => BasicEvent::with_value(id, probability, expression)?,
                None => BasicEvent::new(id, probability)?,
            },
            None => BasicEvent::new(id, probability)?,
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
    {
        let ccf = CcfGroup::new(group.id, group.members, catalogue_ccf_model(group.model))?
            .with_distribution(group.total_failure_probability.to_string());
        fault_tree.add_ccf_group(ccf)?;
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
) -> Result<FaultTreeAdapter> {
    let snapshot = find_snapshot(request, model_id, None)?;
    build_fault_tree_snapshot(request, snapshot, false, false)
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
        let levels = [0.05, 0.25, 0.5, 0.75, 0.95];
        json!({
            "mean": value.mean,
            "standardDeviation": value.standard_deviation,
            "errorFactor": value.error_factor,
            "quantiles": levels.iter().zip(value.quantiles.iter()).map(|(probability, quantile)| json!({
                "probability": probability,
                "value": quantile
            })).collect::<Vec<_>>(),
            "sampleCount": execute.settings.num_trials,
            "seed": execute.settings.seed
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
mod tests {
    use serde_json::{json, Value};

    use super::execute;
    use crate::transport::SolverRequest;

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
            .map(|(id, probability)| json!({ "id": id, "probability": { "value": probability } }))
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
    fn converts_failure_rate_and_mission_time_before_fault_tree_analysis() {
        let mut request = request("OR", None, &[("A", 0.0)], &[("ref-a", "A")]);
        request.resources.fault_tree_basic_event_catalogue = Some(json!({
            "projectId": "project-1",
            "basicEvents": [{
                "id": "A",
                "probability": {
                    "value": 0.0,
                    "quantificationBasis": {
                        "kind": "FAILURE_RATE",
                        "failureRate": { "value": 2.0e-5, "unit": "HOUR" },
                        "missionTime": { "value": 24.0, "unit": "HOUR" },
                        "conversion": "EXPONENTIAL"
                    }
                }
            }]
        }));

        let result = execute(&request).unwrap();
        let expected = 0.0004798848184297544; // HCL_MH calculation type 3.
        assert!((result["topEventProbability"].as_f64().unwrap() - expected).abs() < 1e-15);
        assert_eq!(
            result["basicEventQuantifications"][0]["input"]["quantificationBasis"]["kind"],
            "FAILURE_RATE"
        );
        assert!(
            (result["basicEventQuantifications"][0]["resolvedProbability"]
                .as_f64()
                .unwrap()
                - expected)
                .abs()
                < 1e-15
        );
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
        request.resources.fault_tree_basic_event_catalogue = Some(json!({
            "projectId": "project-1",
            "basicEvents": [{ "id": "A", "probability": { "value": 0.1 } }],
            "uncertaintyInputs": [{
                "basicEventId": "A",
                "distributionType": "beta",
                "parameters": { "alpha": 2.0, "beta": 18.0 }
            }]
        }));
        let result = execute(&request).unwrap();
        assert_eq!(result["uncertainty"]["sampleCount"], 2_000);
        assert_eq!(
            result["uncertainty"]["quantiles"].as_array().unwrap().len(),
            5
        );
        assert!(result["uncertainty"]["standardDeviation"].as_f64().unwrap() > 0.0);
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
            "basicEvents": [
                { "id": "A", "probability": { "value": 0.1 } },
                { "id": "B", "probability": { "value": 0.1 } }
            ],
            "commonCauseFailureGroups": [{
                "id": "CCF",
                "members": ["A", "B"],
                "model": { "kind": "BETA_FACTOR", "beta": 0.1 },
                "totalFailureProbability": 0.1
            }]
        }));
        let result = execute(&request).unwrap();
        assert_eq!(result["settings"]["expandCcf"], true);
        assert!(result["topEventProbability"].as_f64().unwrap() > 0.0);
    }
}
