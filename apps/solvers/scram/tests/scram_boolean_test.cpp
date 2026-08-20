#include <catch2/catch_approx.hpp>
#include <catch2/catch_test_macros.hpp>

#include <utility>
#include <vector>

#include "quantify.h"

namespace {

scram::boolean::BooleanNode MakeGate(scram::boolean::NodeId id,
                                     scram::boolean::BooleanOperator op,
                                     std::vector<scram::boolean::NodeId> inputs) {
  scram::boolean::BooleanNode node;
  node.id = id;
  node.kind = scram::boolean::BooleanNodeKind::kGate;
  node.op = op;
  node.inputs = std::move(inputs);
  return node;
}

scram::boolean::BooleanNode MakeBasicEvent(
    scram::boolean::NodeId id, scram::boolean::BasicEventId basic_event_id) {
  scram::boolean::BooleanNode node;
  node.id = id;
  node.kind = scram::boolean::BooleanNodeKind::kBasicEvent;
  node.basic_event_id = basic_event_id;
  return node;
}

scram::boolean::BasicEventBinding MakeBinding(
    scram::boolean::BasicEventId id, double probability) {
  scram::boolean::BasicEventBinding binding;
  binding.basic_event_id = id;
  binding.value_model = scram::boolean::BasicEventValueModel::kProbability;
  binding.point_probability = probability;
  return binding;
}

}  // namespace

TEST_CASE("OR of two basic events quantifies to the exact probability",
          "[scram-boolean]") {
  using namespace scram::boolean;

  BooleanModel model;
  model.id = 1;
  model.nodes[1] = MakeGate(1, BooleanOperator::kOr, {2, 3});
  model.nodes[2] = MakeBasicEvent(2, 10);
  model.nodes[3] = MakeBasicEvent(3, 11);
  BooleanTree tree;
  tree.id = 100;
  tree.top_node_id = 1;
  model.fault_trees.push_back(tree);

  BasicEventBindingTable bindings;
  bindings.id = 1;
  bindings.bindings.push_back(MakeBinding(10, 0.1));
  bindings.bindings.push_back(MakeBinding(11, 0.2));

  CcfGroupTable ccf_groups;
  ccf_groups.id = 1;
  ccf_groups.boolean_model_ref = 1;

  QuantificationSettings settings;
  settings.bdd = true;
  settings.probability = true;

  QuantificationResult result = Quantify(model, bindings, ccf_groups, settings);

  REQUIRE(result.solver_name == SolverTarget::kScram);
  REQUIRE(result.fault_trees.has_value());
  REQUIRE(result.fault_trees->size() == 1);

  const FaultTreeQuantification& fault_tree = result.fault_trees->front();
  REQUIRE(fault_tree.fault_tree_id == 100);
  REQUIRE(fault_tree.top_event_probability.has_value());
  REQUIRE(fault_tree.top_event_probability->value ==
          Catch::Approx(0.28).epsilon(0.01));
}
