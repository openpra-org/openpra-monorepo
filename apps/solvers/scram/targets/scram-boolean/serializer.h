#pragma once

#include "risk_analysis.h"

#include "builder.h"
#include "contract.h"

namespace scram::boolean {

QuantificationResult Serialize(const scram::core::RiskAnalysis& analysis,
                               const BuiltModel& built,
                               const BooleanModel& model,
                               const BasicEventBindingTable& bindings,
                               const QuantificationSettings& settings);

}  // namespace scram::boolean
