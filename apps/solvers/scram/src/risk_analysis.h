/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
 * Copyright (C) 2023 OpenPRA ORG Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// @file
/// Contains the main system for performing analysis.

#pragma once

#include <memory>
#include <optional>
#include <utility>
#include <variant>
#include <vector>
#include <unordered_set>

#include "alignment.h"
#include "analysis.h"
#include "event.h"
#include "event_tree_analysis.h"
#include "fault_tree_analysis.h"
#include "importance_analysis.h"
#include "model.h"
#include "probability_analysis.h"
#include "settings.h"
#include "uncertainty_analysis.h"

namespace scram::core {

/// Main system that performs analyses.
class RiskAnalysis : public Analysis {
 public:
  /// Provides the optional context of the analysis.
  struct Context {
    const mef::Alignment& alignment;  ///< The model alignment.
    const mef::Phase& phase;  ///< The phase within the alignment.
  };

  /// The analysis results binding to the unique analysis target.
  struct Result {
    /// The analysis target type as a unique identifier.
    struct Id {
      std::variant<const mef::Gate*, std::pair<const mef::InitiatingEvent&, const mef::Sequence&>> target;  ///< The main input to the analysis.
      std::optional<Context> context;  ///< Optional analysis context.
    };

    const Id id;  ///< The main analysis input or target.

    /// Optional analyses, i.e., may be nullptr.
    /// @{
    std::unique_ptr<const FaultTreeAnalysis> fault_tree_analysis;
    std::unique_ptr<const ProbabilityAnalysis> probability_analysis;
    std::unique_ptr<const ImportanceAnalysis> importance_analysis;
    std::unique_ptr<const UncertaintyAnalysis> uncertainty_analysis;
    /// @}
    
    /// Per-sequence/gate timing metrics
    std::optional<double> preprocessing_seconds;  ///< Time spent on preprocessing and building PDAG for this target.
    std::optional<double> report_generation_seconds;  ///< Time spent generating report for this target (if measured).
  };

  /// The analysis results grouped by an event-tree.
  ///
  /// @todo Replace with query (group_by).
  struct EtaResult {
    const mef::InitiatingEvent& initiating_event;  ///< Unique event per tree.
    std::optional<Context> context;  ///< The alignment context.
    /// The holder of the analysis.
    std::unique_ptr<const EventTreeAnalysis> event_tree_analysis;
  };

  /// Captures high-level runtime diagnostics for the overall analysis pass.
  struct RuntimeMetrics {
    double analysis_seconds = 0.0;  ///< Wall-clock seconds spent in Analyze().
    std::optional<double> total_runtime_seconds;  ///< Optional end-to-end runtime.
    std::optional<double> post_analysis_rss_mib;  ///< Resident set size after Analyze().
    std::optional<double> post_analysis_peak_rss_mib;  ///< Peak RSS after Analyze().
    std::optional<double> post_run_rss_mib;  ///< Resident set size at CLI completion.
    std::optional<double> post_run_peak_rss_mib;  ///< Peak RSS at CLI completion.
  };

  /// @param[in] model  An analysis model with fault trees, events, etc.
  /// @param[in] settings  Analysis settings for the given model.
  ///
  /// @note The model is not const
  ///       because mission time and event-tree walk context are manipulated.
  ///       However, at the end of analysis, everything is reset.
  ///
  /// @todo Make the analysis work with a constant model.
  RiskAnalysis(mef::Model* model, const Settings& settings);

  /// @returns The model under analysis.
  const mef::Model& model() const { return *model_; }

  /// Analyzes the model
  /// and performs computations specified in the settings.
  ///
  /// @note This function must be called
  ///       only after full initialization of the model
  ///       with or without its probabilities.
  ///
  /// @pre The analysis is performed only once.
  void Analyze();

  /// @returns The results of the analysis.
  const std::vector<Result>& results() const { return results_; }

  /// @returns The results of the event tree analysis.
  const std::vector<EtaResult>& event_tree_results() const {
    return event_tree_results_;
  }

  /// Stores runtime diagnostics for later reporting.
  void set_runtime_metrics(RuntimeMetrics metrics);

  /// @returns Stored runtime diagnostics, if any.
  const std::optional<RuntimeMetrics>& runtime_metrics() const {
    return runtime_metrics_;
  }

 private:
  /// Runs the whole analysis with the given alignment.
  ///
  /// @param[in] context  The optional context with the current alignment/phase.
  ///
  /// @pre The model is in pristine.
  ///
  /// @post The model is restored to the original state.
  void RunAnalysis(const std::optional<Context> &context = {}) ;

  /// Runs all possible analysis on a given target.
  /// Analysis types are deduced from the settings.
  ///
  /// @param[in] target  Analysis target.
  /// @param[in,out] result  The result container element.
  /// @param[in] initiating_frequency  Optional initiating event frequency (default 1.0).
  void RunAnalysis(const mef::Gate& target, Result* result, double initiating_frequency = 1.0) ;

  /// Defines and runs Qualitative analysis on the target.
  /// Calls the Quantitative analysis if requested in settings.
  ///
  /// @tparam Algorithm  Qualitative analysis algorithm.
  ///
  /// @param[in] target  Analysis target.
  /// @param[in,out] result  The result container element.
  /// @param[in] initiating_frequency  Optional initiating event frequency (default 1.0).
  template <class Algorithm>
  void RunAnalysis(const mef::Gate& target, Result* result, double initiating_frequency = 1.0) ;

  /// Defines and runs Quantitative analysis on the target.
  ///
  /// @tparam Algorithm  Qualitative analysis algorithm.
  /// @tparam Calculator  Quantitative analysis algorithm.
  ///
  /// @param[in] fta  The result of Qualitative analysis.
  /// @param[in,out] result  The result container element.
  ///
  /// @pre FaultTreeAnalyzer is ready to tolerate
  ///      giving its internals to Quantitative analyzers.
  template <class Algorithm, class Calculator>
  void RunAnalysis(FaultTreeAnalyzer<Algorithm>* fta, Result* result) ;

  mef::Model* model_;  ///< The model with constructs.
  std::vector<Result> results_;  ///< The analysis result storage.
  std::vector<EtaResult> event_tree_results_;  ///< Grouping of sequences.

  std::optional<RuntimeMetrics> runtime_metrics_;
};

}  // namespace scram::core
