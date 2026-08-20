#include "quantify.h"

#include "risk_analysis.h"

#include "builder.h"
#include "serializer.h"
#include "settings_map.h"

namespace scram::boolean {

QuantificationResult Quantify(const BooleanModel& model,
                              const BasicEventBindingTable& bindings,
                              const CcfGroupTable& ccf_groups,
                              const QuantificationSettings& settings) {
  BuiltModel built = BuildModel(model, bindings, ccf_groups);
  scram::core::Settings scram_settings = ToScramSettings(settings);
  scram::core::RiskAnalysis analysis(built.model.get(), scram_settings);
  analysis.Analyze();
  return Serialize(analysis, built, model, bindings, settings);
}

}  // namespace scram::boolean
