#include "builder.h"

#include <map>
#include <optional>
#include <string>

#include "ccf_group.h"
#include "event.h"
#include "expression/constant.h"
#include "fault_tree.h"

namespace scram::boolean {
namespace {

std::string GateKey(NodeId id) { return "G" + std::to_string(id); }
std::string HouseKey(NodeId id) { return "H" + std::to_string(id); }
std::string BasicKey(BasicEventId id) { return "E" + std::to_string(id); }
std::string FaultTreeKey(NodeId id) { return "FT" + std::to_string(id); }
std::string CcfKey(NodeId id) { return "CCF" + std::to_string(id); }

scram::mef::Connective ToConnective(BooleanOperator op) {
  switch (op) {
    case BooleanOperator::kAnd:
      return scram::mef::kAnd;
    case BooleanOperator::kOr:
      return scram::mef::kOr;
    case BooleanOperator::kAtleast:
      return scram::mef::kAtleast;
    case BooleanOperator::kXor:
      return scram::mef::kXor;
    case BooleanOperator::kNot:
      return scram::mef::kNot;
    case BooleanOperator::kNull:
      return scram::mef::kNull;
  }
  return scram::mef::kNull;
}

}  // namespace

BuiltModel BuildModel(const BooleanModel& boolean_model,
                      const BasicEventBindingTable& bindings,
                      const CcfGroupTable& ccf_groups) {
  BuiltModel built;
  built.model =
      std::make_unique<scram::mef::Model>(boolean_model.name.value_or(""));
  scram::mef::Model& model = *built.model;

  std::map<BasicEventId, double> point_probabilities;
  for (const BasicEventBinding& binding : bindings.bindings) {
    if (binding.point_probability)
      point_probabilities[binding.basic_event_id] = *binding.point_probability;
  }

  std::map<NodeId, bool> house_states;
  for (const HouseEventStateBinding& house_state : bindings.house_event_states)
    house_states[house_state.house_event_id] = house_state.state;

  std::unordered_map<NodeId, scram::mef::Formula::ArgEvent> node_args;
  std::unordered_map<BasicEventId, scram::mef::BasicEvent*> basic_events;
  std::unordered_map<NodeId, scram::mef::Gate*> gates;

  for (const auto& [node_id, node] : boolean_model.nodes) {
    switch (node.kind) {
      case BooleanNodeKind::kBasicEvent: {
        scram::mef::BasicEvent* ptr = nullptr;
        auto found = basic_events.find(node.basic_event_id);
        if (found != basic_events.end()) {
          ptr = found->second;
        } else {
          auto basic_event = std::make_unique<scram::mef::BasicEvent>(
              BasicKey(node.basic_event_id));
          ptr = basic_event.get();
          auto probability = point_probabilities.find(node.basic_event_id);
          double value = probability != point_probabilities.end()
                             ? probability->second
                             : 0.0;
          auto expression =
              std::make_unique<scram::mef::ConstantExpression>(value);
          ptr->expression(expression.get());
          model.Add(std::move(expression));
          model.Add(std::move(basic_event));
          basic_events.emplace(node.basic_event_id, ptr);
          built.basic_event_to_id.emplace(ptr, node.basic_event_id);
        }
        node_args.emplace(node_id, ptr);
        break;
      }
      case BooleanNodeKind::kHouseEvent: {
        auto house_event =
            std::make_unique<scram::mef::HouseEvent>(HouseKey(node_id));
        scram::mef::HouseEvent* ptr = house_event.get();
        auto state = house_states.find(node_id);
        ptr->state(state != house_states.end() ? state->second : false);
        model.Add(std::move(house_event));
        node_args.emplace(node_id, ptr);
        break;
      }
      case BooleanNodeKind::kGate: {
        auto gate = std::make_unique<scram::mef::Gate>(GateKey(node_id));
        scram::mef::Gate* ptr = gate.get();
        model.Add(std::move(gate));
        gates.emplace(node_id, ptr);
        built.gate_to_node.emplace(ptr, node_id);
        node_args.emplace(node_id, ptr);
        break;
      }
    }
  }

  for (const auto& [node_id, node] : boolean_model.nodes) {
    if (node.kind != BooleanNodeKind::kGate) continue;
    scram::mef::Formula::ArgSet arg_set;
    for (NodeId input : node.inputs) arg_set.Add(node_args.at(input));
    std::optional<int> min_number;
    if (node.op == BooleanOperator::kAtleast) min_number = node.k;
    auto formula = std::make_unique<scram::mef::Formula>(
        ToConnective(node.op), std::move(arg_set), min_number);
    gates.at(node_id)->formula(std::move(formula));
  }

  // Each root is registered as its own single-gate fault tree so RiskAnalysis
  // treats it as a top event; the rest of the reachable graph is shared
  // through formula pointers rather than fault-tree membership.
  auto register_root = [&](NodeId root_id) {
    auto gate = gates.find(root_id);
    if (gate == gates.end()) return;
    auto fault_tree =
        std::make_unique<scram::mef::FaultTree>(FaultTreeKey(root_id));
    fault_tree->Add(gate->second);
    fault_tree->CollectTopEvents();
    model.Add(std::move(fault_tree));
    built.root_gates.emplace(root_id, gate->second);
  };

  for (const BooleanTree& tree : boolean_model.fault_trees)
    register_root(tree.top_node_id);
  for (const BooleanSequence& sequence : boolean_model.sequences)
    register_root(sequence.expression_node_id);
  for (const EndStateNode& end_state : boolean_model.end_states) {
    if (end_state.aggregation_node_id)
      register_root(*end_state.aggregation_node_id);
  }

  for (const CcfGroup& group : ccf_groups.groups) {
    std::unique_ptr<scram::mef::CcfGroup> ccf;
    switch (group.model.model_type) {
      case CcfModelType::kBetaFactor:
        ccf = std::make_unique<scram::mef::BetaFactorModel>(CcfKey(group.id));
        break;
      case CcfModelType::kMgl:
        ccf = std::make_unique<scram::mef::MglModel>(CcfKey(group.id));
        break;
      case CcfModelType::kAlphaFactor:
        ccf = std::make_unique<scram::mef::AlphaFactorModel>(CcfKey(group.id));
        break;
      case CcfModelType::kPhiFactor:
        ccf = std::make_unique<scram::mef::PhiFactorModel>(CcfKey(group.id));
        break;
    }
    for (BasicEventId member : group.member_basic_event_ids) {
      auto found = basic_events.find(member);
      if (found != basic_events.end()) ccf->AddMember(found->second);
    }
    auto distribution = std::make_unique<scram::mef::ConstantExpression>(
        group.model.total_failure_probability);
    ccf->AddDistribution(distribution.get());
    model.Add(std::move(distribution));

    auto add_factor = [&](double value, std::optional<int> level) {
      auto factor = std::make_unique<scram::mef::ConstantExpression>(value);
      ccf->AddFactor(factor.get(), level);
      model.Add(std::move(factor));
    };
    switch (group.model.model_type) {
      case CcfModelType::kBetaFactor:
        if (group.model.beta) add_factor(*group.model.beta, std::nullopt);
        break;
      case CcfModelType::kMgl: {
        int level = 2;
        if (group.model.beta) add_factor(*group.model.beta, level++);
        if (group.model.gamma) add_factor(*group.model.gamma, level++);
        if (group.model.delta) add_factor(*group.model.delta, level++);
        for (const auto& [key, value] : group.model.additional_factors)
          add_factor(value, level++);
        break;
      }
      case CcfModelType::kAlphaFactor: {
        int level = 1;
        for (const auto& [key, value] : group.model.alpha_factors)
          add_factor(value, level++);
        break;
      }
      case CcfModelType::kPhiFactor: {
        int level = 1;
        for (const auto& [key, value] : group.model.phi_factors)
          add_factor(value, level++);
        break;
      }
    }
    model.Add(std::move(ccf));
  }

  return built;
}

}  // namespace scram::boolean
