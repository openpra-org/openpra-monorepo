#pragma once

#include "settings.h"

#include "contract.h"

namespace scram::boolean {

scram::core::Settings ToScramSettings(const QuantificationSettings& settings);

}  // namespace scram::boolean
