#pragma once

#include <memory>
#include <unordered_map>

#include "contract.h"
#include "model.h"

namespace scram::boolean {

struct BuiltModel {
  std::unique_ptr<scram::mef::Model> model;
  std::unordered_map<NodeId, const scram::mef::Gate*> root_gates;
  std::unordered_map<const scram::mef::Gate*, NodeId> gate_to_node;
  std::unordered_map<const scram::mef::BasicEvent*, BasicEventId>
      basic_event_to_id;
};

BuiltModel BuildModel(const BooleanModel& boolean_model,
                      const BasicEventBindingTable& bindings,
                      const CcfGroupTable& ccf_groups);

}  // namespace scram::boolean
