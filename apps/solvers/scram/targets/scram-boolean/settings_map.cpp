#include "settings_map.h"

namespace scram::boolean {

scram::core::Settings ToScramSettings(const QuantificationSettings& source) {
  scram::core::Settings settings;
  settings.input_files({"scram-boolean-model"});

  const bool needs_pdag = source.monte_carlo.value_or(false);
  if (source.mocus.value_or(false)) {
    settings.algorithm("mocus");
  } else if (source.bdd.value_or(false)) {
    settings.algorithm("bdd");
  } else if (source.zbdd.value_or(false)) {
    settings.algorithm("zbdd");
  } else if (source.pdag.value_or(false)) {
    settings.algorithm("pdag");
  } else {
    settings.algorithm(needs_pdag ? "pdag" : "mocus");
  }

  if (source.rare_event.value_or(false)) {
    settings.approximation("rare-event");
  } else if (source.mcub.value_or(false)) {
    settings.approximation("mcub");
  } else if (source.monte_carlo.value_or(false)) {
    settings.approximation("monte-carlo");
  }

  if (source.limit_order) settings.limit_order(*source.limit_order);
  if (source.cut_off) settings.cut_off(*source.cut_off);
  if (source.mission_time) settings.mission_time(*source.mission_time);
  if (source.time_step) settings.time_step(*source.time_step);
  if (source.num_trials) settings.num_trials(*source.num_trials);
  if (source.num_quantiles) settings.num_quantiles(*source.num_quantiles);
  if (source.num_bins) settings.num_bins(*source.num_bins);
  if (source.seed) settings.seed(static_cast<int>(*source.seed));

  if (source.no_kn) settings.expand_atleast_gates(*source.no_kn);
  if (source.no_xor) settings.expand_xor_gates(*source.no_xor);
  if (source.keep_null_gates) settings.keep_null_gates(*source.keep_null_gates);
  if (source.compilation_level)
    settings.compilation_level(*source.compilation_level);

  if (source.prime_implicants) settings.prime_implicants(*source.prime_implicants);
  if (source.adaptive) settings.adaptive(*source.adaptive);
  if (source.probability) settings.probability_analysis(*source.probability);
  if (source.importance) settings.importance_analysis(*source.importance);
  if (source.uncertainty) settings.uncertainty_analysis(*source.uncertainty);
  if (source.ccf) settings.ccf_analysis(*source.ccf);
  if (source.sil) settings.safety_integrity_levels(*source.sil);

  return settings;
}

}  // namespace scram::boolean
