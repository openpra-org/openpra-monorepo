#pragma once

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <unordered_map>
#include <variant>
#include <vector>

namespace scram::boolean {

using NodeId = std::int64_t;
using BasicEventId = std::int64_t;

enum class BooleanOperator { kAnd, kOr, kNot, kXor, kAtleast, kNull };

enum class BooleanNodeKind { kGate, kBasicEvent, kHouseEvent };

struct BooleanNode {
  NodeId id = 0;
  BooleanNodeKind kind = BooleanNodeKind::kGate;
  BooleanOperator op = BooleanOperator::kAnd;
  std::vector<NodeId> inputs;
  std::optional<int> k;
  BasicEventId basic_event_id = 0;
};

struct BooleanTree {
  NodeId id = 0;
  std::optional<std::string> name;
  NodeId top_node_id = 0;
  std::optional<std::string> system_reference;
};

struct BooleanSequence {
  NodeId id = 0;
  std::optional<std::string> name;
  BasicEventId initiating_event_id = 0;
  NodeId expression_node_id = 0;
  std::optional<NodeId> end_state_id;
  std::optional<std::string> event_sequence_reference;
  std::optional<std::string> plant_operating_state_reference;
};

struct EndStateNode {
  NodeId id = 0;
  std::optional<std::string> name;
  std::vector<NodeId> sequence_ids;
  std::optional<NodeId> aggregation_node_id;
  std::optional<std::string> release_category_reference;
};

struct BooleanModel {
  NodeId id = 0;
  std::optional<std::string> name;
  std::unordered_map<NodeId, BooleanNode> nodes;
  std::vector<BooleanTree> fault_trees;
  std::vector<BooleanSequence> sequences;
  std::vector<EndStateNode> end_states;
  std::vector<NodeId> house_event_ids;
};

enum class DistributionType {
  kLognormal,
  kBeta,
  kNormal,
  kUniform,
  kExponential,
  kWeibull,
  kGamma,
  kLognormalTime,
  kPointEstimate,
  kBinomial,
  kPoisson,
};

struct ParameterDistribution {
  DistributionType type = DistributionType::kPointEstimate;
  std::optional<double> median;
  std::optional<double> error_factor;
  std::optional<double> alpha;
  std::optional<double> beta_param;
  std::optional<double> mean;
  std::optional<double> std_dev;
  std::optional<double> lower;
  std::optional<double> upper;
  std::optional<double> failure_rate;
  std::optional<double> scale;
  std::optional<double> shape;
  std::optional<double> location;
  std::optional<double> rate;
  std::optional<double> value;
  std::optional<double> probability;
  std::optional<double> trials;
};

enum class BasicEventValueModel { kProbability, kRatePerHour, kRatePerDemand };

struct BasicEventBinding {
  BasicEventId basic_event_id = 0;
  BasicEventValueModel value_model = BasicEventValueModel::kProbability;
  std::optional<double> point_probability;
  std::optional<ParameterDistribution> distribution;
  std::optional<std::string> data_analysis_parameter_ref;
};

struct HouseEventStateBinding {
  NodeId house_event_id = 0;
  bool state = false;
};

struct BasicEventBindingTable {
  NodeId id = 0;
  std::optional<std::string> name;
  std::vector<BasicEventBinding> bindings;
  std::vector<HouseEventStateBinding> house_event_states;
};

enum class CcfModelType { kBetaFactor, kMgl, kAlphaFactor, kPhiFactor };

struct CcfParameterModel {
  CcfModelType model_type = CcfModelType::kBetaFactor;
  std::optional<double> beta;
  std::optional<double> gamma;
  std::optional<double> delta;
  std::map<std::string, double> additional_factors;
  std::map<std::string, double> alpha_factors;
  std::map<std::string, double> phi_factors;
  double total_failure_probability = 0.0;
};

struct CcfGroup {
  NodeId id = 0;
  std::optional<std::string> name;
  std::vector<BasicEventId> member_basic_event_ids;
  CcfParameterModel model;
  std::optional<std::string> data_analysis_ccf_parameter_ref;
};

struct CcfGroupTable {
  NodeId id = 0;
  NodeId boolean_model_ref = 0;
  std::vector<CcfGroup> groups;
};

enum class SolverTarget { kScram, kPraxis };

enum class ConvergenceIntervalPolicy { kBayes, kWald };

struct QuantificationSettings {
  std::optional<SolverTarget> solver;
  std::optional<bool> mocus;
  std::optional<bool> bdd;
  std::optional<bool> zbdd;
  std::optional<bool> pdag;
  std::optional<bool> adaptive;
  std::optional<bool> rare_event;
  std::optional<bool> mcub;
  std::optional<bool> monte_carlo;
  std::optional<bool> prime_implicants;
  std::optional<bool> probability;
  std::optional<bool> importance;
  std::optional<bool> uncertainty;
  std::optional<bool> ccf;
  std::optional<bool> sil;
  std::optional<int> limit_order;
  std::optional<double> cut_off;
  std::optional<double> mission_time;
  std::optional<double> time_step;
  std::optional<int> num_trials;
  std::optional<int> num_quantiles;
  std::optional<int> num_bins;
  std::optional<std::int64_t> seed;
  std::optional<double> confidence;
  std::optional<double> delta;
  std::optional<std::int64_t> burn_in;
  std::optional<bool> early_stop;
  std::optional<ConvergenceIntervalPolicy> ci_policy;
  std::optional<int> batch_size;
  std::optional<int> sample_size;
  std::optional<double> overhead_ratio;
  std::optional<bool> no_kn;
  std::optional<bool> no_xor;
  std::optional<bool> keep_null_gates;
  std::optional<int> compilation_level;
  std::optional<double> oracle_p;
  std::optional<bool> watch_mode;
};

struct RuntimeSummary {
  std::optional<double> analysis_seconds;
  std::optional<double> total_seconds;
};

struct CutSetLiteral {
  BasicEventId basic_event_id = 0;
  bool negated = false;
};

struct CutSet {
  int order = 0;
  std::vector<CutSetLiteral> literals;
  std::optional<double> probability;
  std::optional<double> contribution;
};

struct CutSetResult {
  int products = 0;
  std::optional<int> original_products;
  std::optional<bool> prime_implicants;
  std::optional<std::vector<int>> distribution_by_order;
  std::optional<double> truncation_probability_error;
  std::optional<std::vector<CutSet>> list;
};

enum class Approximation { kRareEvent, kMcub, kExact, kMonteCarlo };

struct ProbabilityResult {
  double value = 0.0;
  std::optional<double> exact_probability;
  std::optional<double> approximate_probability;
  std::optional<double> relative_error;
  std::optional<Approximation> approximation;
};

struct Quantile {
  double fraction = 0.0;
  double value = 0.0;
};

struct HistogramBin {
  double lower_bound = 0.0;
  double upper_bound = 0.0;
  int count = 0;
};

struct UncertaintyResult {
  double mean = 0.0;
  std::optional<double> standard_deviation;
  std::optional<double> error_factor;
  std::optional<std::vector<Quantile>> quantiles;
  std::optional<std::map<std::string, double>> percentiles;
  std::optional<std::vector<HistogramBin>> histogram_bins;
};

struct ConvergenceResult {
  bool converged = false;
  int trials = 0;
  std::optional<double> confidence;
  std::optional<double> delta;
  std::optional<ConvergenceIntervalPolicy> ci_policy;
  std::optional<double> achieved_margin_of_error;
};

struct ImportanceMeasureResult {
  BasicEventId basic_event_id = 0;
  std::optional<double> fussell_vesely;
  std::optional<double> risk_achievement_worth;
  std::optional<double> risk_reduction_worth;
  std::optional<double> birnbaum;
  std::optional<double> criticality;
};

struct SensitivityResultEntry {
  NodeId study_id = 0;
  std::string varied_item;
  std::optional<double> baseline_value;
  std::optional<double> perturbed_value;
  std::optional<double> result_delta;
};

struct SafetyIntegrityLevelResult {
  NodeId fault_tree_id = 0;
  std::optional<double> average_probability;
  std::optional<int> sil_band;
};

struct FaultTreeQuantification {
  NodeId fault_tree_id = 0;
  NodeId top_node_id = 0;
  std::optional<ProbabilityResult> top_event_probability;
  std::optional<CutSetResult> cut_sets;
  std::optional<std::vector<ImportanceMeasureResult>> importance;
  std::optional<UncertaintyResult> uncertainty;
};

struct SequenceQuantification {
  NodeId sequence_id = 0;
  BasicEventId initiating_event_id = 0;
  std::optional<NodeId> end_state_id;
  std::optional<double> frequency;
  std::optional<ProbabilityResult> probability;
  std::optional<CutSetResult> cut_sets;
  std::optional<UncertaintyResult> uncertainty;
};

struct EndStateQuantification {
  NodeId end_state_id = 0;
  std::optional<std::string> name;
  std::optional<double> frequency;
  std::optional<ProbabilityResult> probability;
  std::optional<UncertaintyResult> uncertainty;
  std::optional<std::vector<NodeId>> contributing_sequence_ids;
};

struct InitiatingEventQuantification {
  BasicEventId initiating_event_id = 0;
  std::optional<std::string> name;
  std::vector<SequenceQuantification> sequences;
};

using ModelFeatureValue = std::variant<std::string, double, bool>;

struct QuantificationResult {
  NodeId id = 0;
  NodeId request_ref = 0;
  NodeId boolean_model_ref = 0;
  std::optional<std::string> model_version_ref;
  SolverTarget solver_name = SolverTarget::kScram;
  std::optional<std::string> solver_version;
  std::optional<std::string> configuration_control_record_id;
  std::optional<std::string> timestamp;
  std::optional<std::map<std::string, ModelFeatureValue>> model_features;
  std::optional<RuntimeSummary> runtime_summary;
  std::optional<std::vector<FaultTreeQuantification>> fault_trees;
  std::optional<std::vector<InitiatingEventQuantification>> initiating_events;
  std::optional<std::vector<SequenceQuantification>> sum_of_products;
  std::optional<std::vector<EndStateQuantification>> end_states;
  std::optional<std::vector<ImportanceMeasureResult>> importance;
  std::optional<UncertaintyResult> uncertainty;
  std::optional<ConvergenceResult> convergence;
  std::optional<std::vector<SensitivityResultEntry>> sensitivity;
  std::optional<std::vector<SafetyIntegrityLevelResult>> safety_integrity_levels;
};

struct BasicEventLabel {
  BasicEventId basic_event_id = 0;
  std::string name;
  std::optional<std::string> data_analysis_parameter_ref;
};

struct NodeLabel {
  NodeId node_id = 0;
  std::string name;
};

struct SymbolTable {
  NodeId id = 0;
  NodeId boolean_model_ref = 0;
  std::optional<std::vector<BasicEventLabel>> basic_event_labels;
  std::optional<std::vector<NodeLabel>> node_labels;
};

}  // namespace scram::boolean
