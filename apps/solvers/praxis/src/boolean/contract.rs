use std::collections::{BTreeMap, HashMap};

pub type NodeId = i64;
pub type BasicEventId = i64;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BooleanOperator {
    And,
    Or,
    Not,
    Xor,
    Atleast,
    Null,
}

#[derive(Debug, Clone, PartialEq)]
pub enum BooleanNode {
    Gate {
        id: NodeId,
        operator: BooleanOperator,
        inputs: Vec<NodeId>,
        k: Option<usize>,
    },
    BasicEvent {
        id: NodeId,
        basic_event_id: BasicEventId,
    },
    HouseEvent {
        id: NodeId,
    },
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct BooleanTree {
    pub id: i64,
    pub name: Option<String>,
    pub top_node_id: NodeId,
    pub system_reference: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct BooleanSequence {
    pub id: i64,
    pub name: Option<String>,
    pub initiating_event_id: BasicEventId,
    pub expression_node_id: NodeId,
    pub end_state_id: Option<i64>,
    pub event_sequence_reference: Option<String>,
    pub plant_operating_state_reference: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct EndStateNode {
    pub id: i64,
    pub name: Option<String>,
    pub sequence_ids: Vec<i64>,
    pub aggregation_node_id: Option<NodeId>,
    pub release_category_reference: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct BooleanModel {
    pub id: i64,
    pub name: Option<String>,
    pub nodes: HashMap<NodeId, BooleanNode>,
    pub fault_trees: Vec<BooleanTree>,
    pub sequences: Vec<BooleanSequence>,
    pub end_states: Vec<EndStateNode>,
    pub house_event_ids: Vec<NodeId>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ParameterDistribution {
    Lognormal {
        median: f64,
        error_factor: f64,
    },
    Beta {
        alpha: f64,
        beta_param: f64,
    },
    Normal {
        mean: f64,
        std_dev: f64,
    },
    Uniform {
        lower: f64,
        upper: f64,
    },
    Exponential {
        failure_rate: f64,
    },
    Weibull {
        scale: f64,
        shape: f64,
        location: f64,
    },
    Gamma {
        shape: f64,
        rate: f64,
    },
    LognormalTime {
        mean: f64,
        std_dev: f64,
    },
    PointEstimate {
        value: f64,
    },
    Binomial {
        probability: f64,
        trials: f64,
    },
    Poisson {
        rate: f64,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum BasicEventValueModel {
    #[default]
    Probability,
    RatePerHour,
    RatePerDemand,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct BasicEventBinding {
    pub basic_event_id: BasicEventId,
    pub value_model: BasicEventValueModel,
    pub point_probability: Option<f64>,
    pub distribution: Option<ParameterDistribution>,
    pub data_analysis_parameter_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct HouseEventStateBinding {
    pub house_event_id: NodeId,
    pub state: bool,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct BasicEventBindingTable {
    pub id: i64,
    pub name: Option<String>,
    pub bindings: Vec<BasicEventBinding>,
    pub house_event_states: Vec<HouseEventStateBinding>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum CcfTestingScheme {
    #[default]
    NonStaggered,
    Staggered,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CcfParameterModel {
    BetaFactor {
        beta: f64,
        total_failure_probability: f64,
    },
    Mgl {
        beta: f64,
        gamma: Option<f64>,
        delta: Option<f64>,
        additional_factors: BTreeMap<String, f64>,
        total_failure_probability: f64,
    },
    AlphaFactor {
        alpha_factors: BTreeMap<String, f64>,
        total_failure_probability: f64,
        testing_scheme: Option<CcfTestingScheme>,
    },
    PhiFactor {
        phi_factors: BTreeMap<String, f64>,
        total_failure_probability: f64,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct CcfGroup {
    pub id: i64,
    pub name: Option<String>,
    pub member_basic_event_ids: Vec<BasicEventId>,
    pub model: CcfParameterModel,
    pub data_analysis_ccf_parameter_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct CcfGroupTable {
    pub id: i64,
    pub boolean_model_ref: i64,
    pub groups: Vec<CcfGroup>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SolverTarget {
    Scram,
    #[default]
    Praxis,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConvergenceIntervalPolicy {
    Bayes,
    Wald,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct QuantificationSettings {
    pub solver: Option<SolverTarget>,
    pub mocus: Option<bool>,
    pub bdd: Option<bool>,
    pub zbdd: Option<bool>,
    pub pdag: Option<bool>,
    pub adaptive: Option<bool>,
    pub rare_event: Option<bool>,
    pub mcub: Option<bool>,
    pub monte_carlo: Option<bool>,
    pub prime_implicants: Option<bool>,
    pub probability: Option<bool>,
    pub importance: Option<bool>,
    pub uncertainty: Option<bool>,
    pub ccf: Option<bool>,
    pub sil: Option<bool>,
    pub limit_order: Option<u32>,
    pub cut_off: Option<f64>,
    pub mission_time: Option<f64>,
    pub time_step: Option<f64>,
    pub num_trials: Option<u32>,
    pub num_quantiles: Option<u32>,
    pub num_bins: Option<u32>,
    pub seed: Option<u64>,
    pub confidence: Option<f64>,
    pub delta: Option<f64>,
    pub burn_in: Option<u64>,
    pub early_stop: Option<bool>,
    pub ci_policy: Option<ConvergenceIntervalPolicy>,
    pub batch_size: Option<u32>,
    pub sample_size: Option<u32>,
    pub overhead_ratio: Option<f64>,
    pub no_kn: Option<bool>,
    pub no_xor: Option<bool>,
    pub keep_null_gates: Option<bool>,
    pub compilation_level: Option<u32>,
    pub oracle_p: Option<f64>,
    pub watch_mode: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct RuntimeSummary {
    pub analysis_seconds: Option<f64>,
    pub total_seconds: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct CutSetLiteral {
    pub basic_event_id: BasicEventId,
    pub negated: bool,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct CutSet {
    pub order: usize,
    pub literals: Vec<CutSetLiteral>,
    pub probability: Option<f64>,
    pub contribution: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct CutSetResult {
    pub products: usize,
    pub original_products: Option<usize>,
    pub prime_implicants: Option<bool>,
    pub distribution_by_order: Option<Vec<usize>>,
    pub truncation_probability_error: Option<f64>,
    pub list: Option<Vec<CutSet>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Approximation {
    RareEvent,
    Mcub,
    Exact,
    MonteCarlo,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ProbabilityResult {
    pub value: f64,
    pub exact_probability: Option<f64>,
    pub approximate_probability: Option<f64>,
    pub relative_error: Option<f64>,
    pub approximation: Option<Approximation>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Quantile {
    pub fraction: f64,
    pub value: f64,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct HistogramBin {
    pub lower_bound: f64,
    pub upper_bound: f64,
    pub count: usize,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct UncertaintyResult {
    pub mean: f64,
    pub standard_deviation: Option<f64>,
    pub error_factor: Option<f64>,
    pub quantiles: Option<Vec<Quantile>>,
    pub percentiles: Option<BTreeMap<String, f64>>,
    pub histogram_bins: Option<Vec<HistogramBin>>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ConvergenceResult {
    pub converged: bool,
    pub trials: usize,
    pub confidence: Option<f64>,
    pub delta: Option<f64>,
    pub ci_policy: Option<ConvergenceIntervalPolicy>,
    pub achieved_margin_of_error: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ImportanceMeasureResult {
    pub basic_event_id: BasicEventId,
    pub fussell_vesely: Option<f64>,
    pub risk_achievement_worth: Option<f64>,
    pub risk_reduction_worth: Option<f64>,
    pub birnbaum: Option<f64>,
    pub criticality: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct SensitivityResultEntry {
    pub study_id: i64,
    pub varied_item: String,
    pub baseline_value: Option<f64>,
    pub perturbed_value: Option<f64>,
    pub result_delta: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct SafetyIntegrityLevelResult {
    pub fault_tree_id: i64,
    pub average_probability: Option<f64>,
    pub sil_band: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct FaultTreeQuantification {
    pub fault_tree_id: i64,
    pub top_node_id: NodeId,
    pub top_event_probability: Option<ProbabilityResult>,
    pub cut_sets: Option<CutSetResult>,
    pub importance: Option<Vec<ImportanceMeasureResult>>,
    pub uncertainty: Option<UncertaintyResult>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct SequenceQuantification {
    pub sequence_id: i64,
    pub initiating_event_id: BasicEventId,
    pub end_state_id: Option<i64>,
    pub frequency: Option<f64>,
    pub probability: Option<ProbabilityResult>,
    pub cut_sets: Option<CutSetResult>,
    pub uncertainty: Option<UncertaintyResult>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct EndStateQuantification {
    pub end_state_id: i64,
    pub name: Option<String>,
    pub frequency: Option<f64>,
    pub probability: Option<ProbabilityResult>,
    pub uncertainty: Option<UncertaintyResult>,
    pub contributing_sequence_ids: Option<Vec<i64>>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct InitiatingEventQuantification {
    pub initiating_event_id: BasicEventId,
    pub name: Option<String>,
    pub sequences: Vec<SequenceQuantification>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ModelFeatureValue {
    Text(String),
    Number(f64),
    Flag(bool),
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct QuantificationResult {
    pub id: i64,
    pub request_ref: i64,
    pub boolean_model_ref: i64,
    pub model_version_ref: Option<String>,
    pub solver_name: SolverTarget,
    pub solver_version: Option<String>,
    pub configuration_control_record_id: Option<String>,
    pub timestamp: Option<String>,
    pub model_features: Option<BTreeMap<String, ModelFeatureValue>>,
    pub runtime_summary: Option<RuntimeSummary>,
    pub fault_trees: Option<Vec<FaultTreeQuantification>>,
    pub initiating_events: Option<Vec<InitiatingEventQuantification>>,
    pub sum_of_products: Option<Vec<SequenceQuantification>>,
    pub end_states: Option<Vec<EndStateQuantification>>,
    pub importance: Option<Vec<ImportanceMeasureResult>>,
    pub uncertainty: Option<UncertaintyResult>,
    pub convergence: Option<ConvergenceResult>,
    pub sensitivity: Option<Vec<SensitivityResultEntry>>,
    pub safety_integrity_levels: Option<Vec<SafetyIntegrityLevelResult>>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct BasicEventLabel {
    pub basic_event_id: BasicEventId,
    pub name: String,
    pub data_analysis_parameter_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct NodeLabel {
    pub node_id: NodeId,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct SymbolTable {
    pub id: i64,
    pub boolean_model_ref: i64,
    pub basic_event_labels: Option<Vec<BasicEventLabel>>,
    pub node_labels: Option<Vec<NodeLabel>>,
}
