#include "serializer.h"

#include <cstddef>
#include <unordered_map>
#include <variant>
#include <vector>

#include "fault_tree_analysis.h"
#include "importance_analysis.h"
#include "probability_analysis.h"
#include "uncertainty_analysis.h"

namespace scram::boolean {
namespace {

using Result = scram::core::RiskAnalysis::Result;

std::optional<ProbabilityResult> MakeProbability(const Result& result) {
  if (!result.probability_analysis) return std::nullopt;
  ProbabilityResult probability;
  probability.value = result.probability_analysis->p_total();
  return probability;
}

std::optional<CutSetResult> MakeCutSets(const Result& result,
                                        const BuiltModel& built) {
  if (!result.fault_tree_analysis || !result.fault_tree_analysis->has_products())
    return std::nullopt;

  CutSetResult cut_sets;
  std::vector<CutSet> list;
  int count = 0;
  for (const auto& product : result.fault_tree_analysis->products()) {
    CutSet cut_set;
    cut_set.order = product.order();
    cut_set.probability = product.p();
    for (const auto& literal : product) {
      CutSetLiteral cut_set_literal;
      auto found = built.basic_event_to_id.find(&literal.event);
      cut_set_literal.basic_event_id =
          found != built.basic_event_to_id.end() ? found->second : 0;
      cut_set_literal.negated = literal.complement;
      cut_set.literals.push_back(cut_set_literal);
    }
    list.push_back(std::move(cut_set));
    ++count;
  }

  const auto* summary = result.fault_tree_analysis->last_product_summary();
  cut_sets.products = summary ? summary->product_count : count;
  if (summary) {
    cut_sets.original_products = summary->original_product_count;
    cut_sets.distribution_by_order = summary->distribution;
  }
  cut_sets.list = std::move(list);
  return cut_sets;
}

std::optional<std::vector<ImportanceMeasureResult>> MakeImportance(
    const Result& result, const BuiltModel& built) {
  if (!result.importance_analysis) return std::nullopt;
  std::vector<ImportanceMeasureResult> measures;
  for (const auto& record : result.importance_analysis->importance()) {
    ImportanceMeasureResult measure;
    auto found = built.basic_event_to_id.find(&record.event);
    measure.basic_event_id =
        found != built.basic_event_to_id.end() ? found->second : 0;
    measure.fussell_vesely = record.factors.dif;
    measure.risk_achievement_worth = record.factors.raw;
    measure.risk_reduction_worth = record.factors.rrw;
    measure.birnbaum = record.factors.mif;
    measure.criticality = record.factors.cif;
    measures.push_back(measure);
  }
  return measures;
}

std::optional<UncertaintyResult> MakeUncertainty(const Result& result) {
  if (!result.uncertainty_analysis) return std::nullopt;
  const auto& analysis = *result.uncertainty_analysis;
  UncertaintyResult uncertainty;
  uncertainty.mean = analysis.mean();
  uncertainty.standard_deviation = analysis.sigma();
  uncertainty.error_factor = analysis.error_factor();
  const std::vector<double>& values = analysis.quantiles();
  if (!values.empty()) {
    std::vector<Quantile> quantiles;
    for (std::size_t i = 0; i < values.size(); ++i) {
      Quantile quantile;
      quantile.fraction =
          static_cast<double>(i + 1) / static_cast<double>(values.size());
      quantile.value = values[i];
      quantiles.push_back(quantile);
    }
    uncertainty.quantiles = std::move(quantiles);
  }
  return uncertainty;
}

}  // namespace

QuantificationResult Serialize(const scram::core::RiskAnalysis& analysis,
                               const BuiltModel& built,
                               const BooleanModel& model,
                               const BasicEventBindingTable& bindings,
                               const QuantificationSettings& settings) {
  QuantificationResult result;
  result.boolean_model_ref = model.id;
  result.solver_name = settings.solver.value_or(SolverTarget::kScram);

  std::unordered_map<NodeId, const Result*> by_node;
  for (const Result& analysis_result : analysis.results()) {
    if (auto gate =
            std::get_if<const scram::mef::Gate*>(&analysis_result.id.target)) {
      auto found = built.gate_to_node.find(*gate);
      if (found != built.gate_to_node.end())
        by_node.emplace(found->second, &analysis_result);
    }
  }

  std::unordered_map<BasicEventId, double> initiating_frequency;
  for (const BasicEventBinding& binding : bindings.bindings) {
    if (binding.point_probability)
      initiating_frequency[binding.basic_event_id] = *binding.point_probability;
  }

  std::vector<FaultTreeQuantification> fault_trees;
  for (const BooleanTree& tree : model.fault_trees) {
    auto found = by_node.find(tree.top_node_id);
    if (found == by_node.end()) continue;
    const Result& analysis_result = *found->second;
    FaultTreeQuantification quantification;
    quantification.fault_tree_id = tree.id;
    quantification.top_node_id = tree.top_node_id;
    quantification.top_event_probability = MakeProbability(analysis_result);
    quantification.cut_sets = MakeCutSets(analysis_result, built);
    quantification.importance = MakeImportance(analysis_result, built);
    quantification.uncertainty = MakeUncertainty(analysis_result);
    fault_trees.push_back(std::move(quantification));
  }
  if (!fault_trees.empty()) result.fault_trees = std::move(fault_trees);

  std::vector<SequenceQuantification> sequences;
  std::unordered_map<NodeId, double> sequence_frequency;
  for (const BooleanSequence& sequence : model.sequences) {
    auto found = by_node.find(sequence.expression_node_id);
    if (found == by_node.end()) continue;
    const Result& analysis_result = *found->second;
    SequenceQuantification quantification;
    quantification.sequence_id = sequence.id;
    quantification.initiating_event_id = sequence.initiating_event_id;
    quantification.end_state_id = sequence.end_state_id;
    quantification.probability = MakeProbability(analysis_result);
    quantification.cut_sets = MakeCutSets(analysis_result, built);
    quantification.uncertainty = MakeUncertainty(analysis_result);
    if (quantification.probability) {
      auto frequency = initiating_frequency.find(sequence.initiating_event_id);
      double value =
          quantification.probability->value *
          (frequency != initiating_frequency.end() ? frequency->second : 1.0);
      quantification.frequency = value;
      sequence_frequency[sequence.id] = value;
    }
    sequences.push_back(std::move(quantification));
  }
  if (!sequences.empty()) result.sum_of_products = std::move(sequences);

  std::vector<EndStateQuantification> end_states;
  for (const EndStateNode& end_state : model.end_states) {
    EndStateQuantification quantification;
    quantification.end_state_id = end_state.id;
    quantification.name = end_state.name;
    if (end_state.aggregation_node_id) {
      auto found = by_node.find(*end_state.aggregation_node_id);
      if (found != by_node.end()) {
        quantification.probability = MakeProbability(*found->second);
        quantification.uncertainty = MakeUncertainty(*found->second);
      }
    }
    double frequency = 0.0;
    bool has_frequency = false;
    for (NodeId sequence_id : end_state.sequence_ids) {
      auto found = sequence_frequency.find(sequence_id);
      if (found != sequence_frequency.end()) {
        frequency += found->second;
        has_frequency = true;
      }
    }
    if (has_frequency) quantification.frequency = frequency;
    if (!end_state.sequence_ids.empty())
      quantification.contributing_sequence_ids = end_state.sequence_ids;
    end_states.push_back(std::move(quantification));
  }
  if (!end_states.empty()) result.end_states = std::move(end_states);

  return result;
}

}  // namespace scram::boolean
