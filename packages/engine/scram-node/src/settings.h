/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
 * Copyright (C) 2025 Arjun Earthperson
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// @file
/// Builder for settings.

#pragma once

#include "model.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <stdexcept>

#include <string_view>
#include <string>
#include <vector>

namespace scram::core {

/// Qualitative analysis algorithms.
enum class Algorithm : std::uint8_t { kBdd = 0, kZbdd, kMocus, kDirect };

/// String representations for algorithms.
const char* const kAlgorithmToString[] = { "bdd", "zbdd", "mocus", "pdag" };

/// Quantitative analysis approximations.
enum class Approximation : std::uint8_t { kNone = 0, kRareEvent, kMcub, kMonteCarlo };

/// String representations for approximations.
const char* const kApproximationToString[] = { "none", "rare-event", "mcub", "monte-carlo" };

/// Convergence interval policy for Monte-Carlo stopping criterion
enum class CIPolicy : std::uint8_t { kBayes = 0, kWald };

inline constexpr const char* kCIPolicyToString[] = { "bayes", "wald" };

/// Builder for analysis settings.
/// Analysis facilities are guaranteed not to throw or fail
/// with an instance of this class.
///
/// @warning Some settings with defaults and constraints
///          may have side-effects on other settings.
///
/// @warning The order of building the settings matters.
class Settings {
 public:
  /// @returns The Qualitative analysis algorithm.
  [[nodiscard]] Algorithm algorithm() const { return algorithm_; }

  /// Sets the algorithm for Qualitative analysis.
  /// Appropriate defaults are given to other settings
  /// relevant to the algorithm.
  ///
  /// MOCUS and ZBDD based analyses run
  /// with the Rare-Event approximation by default.
  /// Whereas, BDD based analyses run with exact quantitative analysis.
  ///
  /// @param[in] value  The algorithm kind.
  ///
  /// @returns Reference to this object.
  Settings& algorithm(Algorithm value) ;

  /// Provides a convenient wrapper for algorithm setting from a string.
  ///
  /// @param[in] value  The string representation of the algorithm.
  ///
  /// @throws SettingsError  The algorithm is not recognized.
  ///
  /// @returns Reference to this object.
  Settings& algorithm(std::string_view value);

  /// @returns The quantitative analysis approximation.
  [[nodiscard]] Approximation approximation() const { return approximation_; }

  /// Sets the approximation for quantitative analysis.
  ///
  /// @param[in] value  Approximation kind to be applied.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The approximation is not recognized
  ///                          or inappropriate for analysis.
  /// @{
  Settings& approximation(Approximation value);
  Settings& approximation(std::string_view value);
  /// @}

  /// @returns true if prime implicants are to be calculated
  ///               instead of minimal cut sets.
  [[nodiscard]] bool prime_implicants() const { return prime_implicants_; }

  /// Sets a flag to calculate prime implicants instead of minimal cut sets.
  /// Prime implicants can only be calculated with BDD-based algorithms.
  ///
  /// The request for prime implicants cancels
  /// the request for inapplicable quantitative analysis approximations.
  ///
  /// @param[in] flag  True for the request.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The request is not relevant to the algorithm.
  Settings& prime_implicants(bool flag);

  /// @returns The limit on the size of products.
  [[nodiscard]] int limit_order() const { return limit_order_; }

  /// Sets the limit order for products.
  ///
  /// @param[in] order  A non-negative number for the limit order.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The number is less than 0.
  Settings& limit_order(int order);

  /// @returns The minimum required probability for products.
  [[nodiscard]] double cut_off() const { return cut_off_; }

  /// Sets the cut-off probability for products
  /// to be considered for analysis.
  ///
  /// @param[in] prob  The minimum probability for products.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The probability is not in the [0, 1] range.
  Settings& cut_off(double prob);

  /// @returns The number of trials for Monte-Carlo simulations.
  [[nodiscard]] std::size_t num_trials() const { return num_trials_; }

  /// Sets the number of trials for Monte Carlo simulations.
  ///
  /// @param[in] n  A natural number for the number of trials.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The number is less than 1.
  Settings& num_trials(std::double_t n);

  /// @returns The batch size for Monte-Carlo simulations.
  [[nodiscard]] std::size_t batch_size() const { return batch_size_; }

  /// Sets the batch size for Monte Carlo simulations.
  ///
  /// @param[in] n  A natural number for the batch size.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The number is less than 1.
  Settings& batch_size(std::size_t n) { batch_size_ = n; return *this; }

  /// @returns The batch size for Monte-Carlo simulations.
  [[nodiscard]] std::size_t sample_size() const { return sample_size_; }

  /// Sets the sample size for Monte Carlo simulations.
  ///
  /// @param[in] n  A natural number for the sample size.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The number is less than 1.
  Settings& sample_size(std::size_t n) { sample_size_ = n; return *this; }

  /// @returns The number of quantiles for distributions.
  [[nodiscard]] int num_quantiles() const { return num_quantiles_; }

  /// Sets the number of quantiles for distributions.
  ///
  /// @param[in] n  A natural number for the number of quantiles.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The number is less than 1.
  Settings& num_quantiles(int n);

  /// @returns The number of bins for histograms.
  [[nodiscard]] int num_bins() const { return num_bins_; }

  /// Sets the number of bins for histograms.
  ///
  /// @param[in] n  A natural number for the number of bins.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The number is less than 1.
  Settings& num_bins(int n);

  /// @returns The seed of the pseudo-random number generator.
  [[nodiscard]] int seed() const { return seed_; }

  /// Sets the seed for the pseudo-random number generator.
  ///
  /// @param[in] s  A positive number.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The number is negative.
  Settings& seed(int s);

  /// @returns The length time of the system under risk.
  [[nodiscard]] double mission_time() const { return mission_time_; }

  /// Sets the system mission time.
  ///
  /// @param[in] time  A positive number in hours by default.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The time value is negative.
  Settings& mission_time(double time);

  /// @returns The time step in hours for probability analyses.
  ///          0 if the time step doesn't apply.
  [[nodiscard]] double time_step() const { return time_step_; }

  /// Sets the time step for probability analyses.
  /// 0 value signifies that the time step doesn't apply.
  ///
  /// @param[in] time  The time in hours to partition the mission time.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The time value is negative.
  /// @throws SettingsError  The time step is being disabled (value 0)
  ///                          while the SIL metrics are requested.
  Settings& time_step(double time);

  /// @returns true if probability analysis is requested.
  [[nodiscard]] bool probability_analysis() const { return probability_analysis_; }

  /// Sets the flag for probability analysis.
  /// If another analysis requires probability analysis,
  /// it won't be possible to turn off probability analysis
  /// before the parent analysis.
  ///
  /// @param[in] flag  True or false for turning on or off the analysis.
  ///
  /// @returns Reference to this object.
  Settings& probability_analysis(bool flag) {
    if (!importance_analysis_ && !uncertainty_analysis_ &&
        !safety_integrity_levels_) {
      probability_analysis_ = flag;
    }
    return *this;
  }

  /// Sets the flag for skipping products calculation.
  ///
  /// @param[in] flag  True or false for turning on or off the products calculation.
  ///
  /// @returns Reference to this object.
  Settings& skip_products(bool flag) {
    skip_products_ = flag;
    return *this;
  }

  /// @returns true if the products calculation will be skipped.
  [[nodiscard]] bool skip_products() const { return skip_products_; }

  /// @returns true if the SIL metrics are requested.
  [[nodiscard]] bool safety_integrity_levels() const { return safety_integrity_levels_; }

  /// Sets the flag for calculation of the SIL metrics.
  /// This requires that time-step is set.
  ///
  /// @param[in] flag  True or false for turning on or off the analysis.
  ///
  /// @returns Reference to this object.
  ///
  /// @throws SettingsError  The flag is True, but no time-step is set.
  Settings& safety_integrity_levels(bool flag);

  /// @returns true if importance analysis is requested.
  [[nodiscard]] bool importance_analysis() const { return importance_analysis_; }

  /// Sets the flag for importance analysis.
  /// Importance analysis is performed
  /// together with probability analysis.
  /// Appropriate flags are turned on.
  ///
  /// @param[in] flag  True or false for turning on or off the analysis.
  ///
  /// @returns Reference to this object.
  Settings& importance_analysis(bool flag) {
    importance_analysis_ = flag;
    if (importance_analysis_)
      probability_analysis_ = true;
    return *this;
  }

  /// @returns true if uncertainty analysis is requested.
  [[nodiscard]] bool uncertainty_analysis() const { return uncertainty_analysis_; }

  /// Sets the flag for uncertainty analysis.
  /// Uncertainty analysis implies probability analysis,
  /// so the probability analysis is turned on implicitly.
  ///
  /// @param[in] flag  True or false for turning on or off the analysis.
  ///
  /// @returns Reference to this object.
  Settings& uncertainty_analysis(bool flag) {
    uncertainty_analysis_ = flag;
    if (uncertainty_analysis_)
      probability_analysis_ = true;
    return *this;
  }

  /// @returns true if CCF groups must be incorporated into analysis.
  [[nodiscard]] bool ccf_analysis() const { return ccf_analysis_; }

  /// Sets the flag for CCF analysis.
  ///
  /// @param[in] flag  True or false for turning on or off the analysis.
  ///
  /// @returns Reference to this object.
  Settings& ccf_analysis(bool flag) { ccf_analysis_ = flag; return *this; }

  /// @returns The desired confidence level for automatic CI tuning (0 disables).
  [[nodiscard]] double ci_confidence() const { return std::clamp(ci_confidence_, 0.0, 1.0); }

  /// Sets the confidence level (two-sided) used when automatically choosing
  /// the number of Monte-Carlo trials.  Accepts values in (0,1).
  Settings& ci_confidence(const double p) { ci_confidence_ = std::clamp(p, 0.0, 1.0); return *this; }

  /// @returns The relative margin of error δ (fraction of p̂) if set (>0), otherwise 0.
  [[nodiscard]] double ci_rel_margin_error() const { return std::abs(ci_rel_margin_error_); }

  /// Sets the relative margin of error δ used to derive an absolute ε as δ·p̂. negative values are set to 0.
  Settings& ci_rel_margin_error(const double delta) { ci_rel_margin_error_ =  delta > 0 ? delta : 0; return *this; }

  // ---------------------------------------------------------------------
  //  Convergence policy selection (Bayes vs Wald)
  // ---------------------------------------------------------------------
  [[nodiscard]] CIPolicy ci_policy() const { return ci_policy_; }

  Settings& ci_policy(const CIPolicy p) { ci_policy_ = p; return *this; }

  Settings& ci_policy(std::string_view s) {
    if (s == "bayes")      return ci_policy(CIPolicy::kBayes);
    if (s == "wald")       return ci_policy(CIPolicy::kWald);
    throw std::invalid_argument("unknown ci-policy: " + std::string{s});
  }

  /// @returns Number of burn-in trials to run before enabling convergence checks.
  [[nodiscard]] std::size_t ci_burnin_trials() const { return static_cast<std::size_t>(ci_burnin_trials_); }

  /// Sets the number of pilot iterations (non-negative).
  Settings& ci_burnin_trials(const double n) { ci_burnin_trials_= n > 0 ? std::round(n) : 0; return *this; }

  [[nodiscard]] bool early_stop() const { return early_stop_; }

  Settings& early_stop(const bool on) { early_stop_ = on; return *this; }

  [[nodiscard]] bool watch_mode() const { return watch_mode_; }

  Settings& watch_mode(const bool on) { watch_mode_ = on; return *this; }

  [[nodiscard]] bool expand_atleast_gates() const { return expand_atleast_gates_; }
  [[nodiscard]] bool expand_xor_gates() const { return expand_xor_gates_; }
  [[nodiscard]] bool keep_null_gates() const { return keep_null_gates_; }
  [[nodiscard]] int compilation_level() const { return compilation_level_; }

  Settings& expand_xor_gates(const bool on) { expand_xor_gates_ = on; return *this; }
  Settings& expand_atleast_gates(const bool on) { expand_atleast_gates_ = on; return *this; }
  Settings& keep_null_gates(const bool on) { keep_null_gates_ = on; return *this; }
  Settings& compilation_level(const int level) { compilation_level_ = std::clamp(level, 0, 8); return *this; }

  /// @returns The known ground-truth probability provided by the user (negative when unset).
  [[nodiscard]] double oracle_p() const { return oracle_p_; }

  /// Sets the ground-truth probability/frequency that will be used for diagnostic statistics.
  /// Accepts non-negative values. Negative values are simply set as -1 to unset the variable.
  Settings &oracle_p(const double p) { oracle_p_ = p >= 0 ? p : -1.0; return *this; }

    /// @returns Node allocation overhead ratio
    [[nodiscard]] double overhead_ratio() const { return overhead_ratio_; }

    /// Sets the ground-truth probability/frequency that will be used for diagnostic statistics.
    /// Accepts non-negative values. Negative values are simply set as -1 to unset the variable.
    Settings &overhead_ratio(const double r) { overhead_ratio_ = r >= 0 ? r : 0.; return *this; }

  /// @returns the list of MEF input files provided for the analysis (can be empty).
  [[nodiscard]] const std::vector<std::string>& input_files() const { return input_files_; }

  /// Sets/overwrites the list of MEF input files (primarily called by CLI glue code).
  /// A reference is not kept – a copy of the vector is stored inside the Settings instance.
  Settings& input_files(const std::vector<std::string>& files) {
    input_files_ = files;
    return *this;
  }

  /// @returns an optional shared pointer to the MEF model
  [[nodiscard]] mef::Model* model() const { return model_; }

    /// Sets/overwrites the list of MEF input files (primarily called by CLI glue code).
    /// A reference is not kept – a copy of the vector is stored inside the Settings instance.
  Settings& model(mef::Model *model) {
      model_ = model;
      return *this;
  }

  bool preprocessor = false;  ///< Stop analysis after preprocessor.
  bool print = false;  ///< Print analysis results in a terminal friendly way.

  bool watch_mode_ = false;  ///< Display analysis status on TTY.
  CIPolicy ci_policy_ = CIPolicy::kBayes;

 private:
  Algorithm algorithm_ = Algorithm::kDirect;                  ///< Algorithm for minimal cut set / prime implicant analysis
  Approximation approximation_ = Approximation::kMonteCarlo ; ///< The approximations for calculations
  bool probability_analysis_ = false;                 ///< A flag for probability analysis.
  bool safety_integrity_levels_ = false;              ///< Calculation of the SIL metrics.
  bool importance_analysis_ = false;                  ///< A flag for importance analysis.
  bool uncertainty_analysis_ = false;                 ///< A flag for uncertainty analysis.
  bool ccf_analysis_ = false;                         ///< A flag for common-cause analysis.
  bool prime_implicants_ = false;                     ///< Calculation of prime implicants.
  bool skip_products_ = false;                        ///< Do not compute the products.
  int limit_order_ = 20;                              ///< Limit on the order of products.
  int seed_ = 372;                                    ///< The seed for the pseudo-random number generator.
  std::size_t num_trials_  = 0;                       ///< The number of trials for Monte Carlo simulations (default 2^26).
  std::size_t batch_size_  = 0;                       ///< Batch size for Monte Carlo simulations.
  std::size_t sample_size_ = 0;                       ///< Sample size for Monte Carlo simulations.
  int num_quantiles_ = 20;                            ///< The number of quantiles for distributions.
  int num_bins_ = 20;                                 ///< The number of bins for histograms.
  double mission_time_ = 8760;                        ///< System mission time.
  double time_step_ = 0;                              ///< The time step for probability analyses.
  double cut_off_ = 1e-8;                             ///< The cut-off probability for products.


  double oracle_p_           = -1.0;    ///< negative means unset.

  // --- NEW: adaptive Monte-Carlo CI tuning ---------------------------------
  bool   early_stop_          = true;    ///< stop as soon as convergence occurs
  double ci_confidence_       = 0.99;    ///< two-sided confidence level (0.99 default)
  double ci_rel_margin_error_ = 0.001;   ///< δ (relative ε). 0 → disabled.
  double ci_burnin_trials_    = 1 << 20; ///< burn-in trials before convergence checks (2^20 default), 0 → disabled.

  // Graph Compilation Options
  bool keep_null_gates_ = false;
  bool expand_atleast_gates_ = false;
  bool expand_xor_gates_ = false;
  int compilation_level_ = 2;

  double overhead_ratio_ = 0.05;

  // A copy of the final list of MEF input files passed on the command-line.  Read-only access is provided via the getter above.
  std::vector<std::string> input_files_;

  mef::Model* model_ = nullptr;
};

}  // namespace scram::core
