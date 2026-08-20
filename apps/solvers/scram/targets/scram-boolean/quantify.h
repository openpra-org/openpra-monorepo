#pragma once

#include "contract.h"

namespace scram::boolean {

QuantificationResult Quantify(const BooleanModel& model,
                              const BasicEventBindingTable& bindings,
                              const CcfGroupTable& ccf_groups,
                              const QuantificationSettings& settings);

}  // namespace scram::boolean
