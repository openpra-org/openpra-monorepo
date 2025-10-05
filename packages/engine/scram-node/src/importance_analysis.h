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
/// Contains functionality to do numerical analysis
/// of importance factors.

#pragma once

#include <vector>

#include "bdd.h"
#include "probability_analysis.h"
#include "settings.h"

namespace scram::mef {  // Decouple from the analysis code header.
class BasicEvent;
}  // namespace scram::mef

namespace scram::core {

/// Collection of importance factors for variables.
struct ImportanceFactors {
  int occurrence;  ///< The number of products the variable is present in.
  double mif;  ///< Birnbaum marginal importance factor.
  double cif;  ///< Critical importance factor.
  double dif;  ///< Fussel-Vesely diagnosis importance factor.
  double raw;  ///< Risk achievement worth factor.
  double rrw;  ///< Risk reduction worth factor.
};

/// Mapping of an event and its importance.
struct ImportanceRecord {
  const mef::BasicEvent& event;  ///< The event occurring in products.
  const ImportanceFactors factors;  ///< The importance factors of the event.
};

class Zbdd;  // The container of products to be queries for important events.

/// Analysis of importance factors of risk model variables.
class ImportanceAnalysis : public Analysis {
 public:
  /// Importance analysis
  /// on the fault tree represented by
  /// its probability analysis.
  ///
  /// @param[in] prob_analysis  Completed probability analysis.
  explicit ImportanceAnalysis(const ProbabilityAnalysis* prob_analysis);

  virtual ~ImportanceAnalysis() = default;

  /// Performs quantitative analysis of importance factors
  /// of basic events in products.
  ///
  /// @pre Analysis is called only once.
  void Analyze() ;

  /// @returns A collection of important events and their importance factors.
  ///
  /// @pre The importance analysis is done.
  const std::vector<ImportanceRecord>& importance() const {
    return importance_;
  }

 private:
  /// @returns Total probability from the probability analysis.
  virtual double p_total()  = 0;
  /// @returns All basic event candidates for importance calculations.
  virtual const std::vector<const mef::BasicEvent*>&
  basic_events()  = 0;
  /// @returns Occurrences of basic events in products.
  virtual std::vector<int> occurrences()  = 0;

  /// Calculates Marginal Importance Factor.
  ///
  /// @param[in] index  The position index of an event in events vector.
  ///
  /// @returns Calculated value for MIF.
  virtual double CalculateMif(int index)  = 0;

  /// Container of important events and their importance factors.
  std::vector<ImportanceRecord> importance_;
};

/// Base class for analyzers of importance factors
/// with the help from probability analyzers.
class ImportanceAnalyzerBase : public ImportanceAnalysis {
 public:
  /// Constructs importance analyzer from probability analyzer.
  /// Probability analyzer facilities are used
  /// to calculate the total and conditional probabilities for factors.
  ///
  /// @param[in] prob_analyzer  Instantiated probability analyzer.
  explicit ImportanceAnalyzerBase(ProbabilityAnalyzerBase* prob_analyzer)
      : ImportanceAnalysis(prob_analyzer), prob_analyzer_(prob_analyzer) {}

 protected:
  virtual ~ImportanceAnalyzerBase() = default;

  /// @returns A pointer to the helper probability analyzer.
  ProbabilityAnalyzerBase* prob_analyzer() { return prob_analyzer_; }

 private:
  double p_total()  override { return prob_analyzer_->p_total(); }
  const std::vector<const mef::BasicEvent*>& basic_events()  override {
    return prob_analyzer_->graph()->basic_events();
  }
  std::vector<int> occurrences()  override;

  /// Calculator of the total probability.
  ProbabilityAnalyzerBase* prob_analyzer_;
};

/// Analyzer of importance factors
/// with the help from probability analyzers.
///
/// @tparam Calculator  Quantitative calculator of probability values.
template <class Calculator>
class ImportanceAnalyzer : public ImportanceAnalyzerBase {
 public:
  /// @copydoc ImportanceAnalyzerBase::ImportanceAnalyzerBase
  explicit ImportanceAnalyzer(ProbabilityAnalyzer<Calculator>* prob_analyzer)
      : ImportanceAnalyzerBase(prob_analyzer),
        p_vars_(prob_analyzer->p_vars()) {}

 private:
  double CalculateMif(int index)  override;
  Pdag::IndexMap<double> p_vars_;  ///< A copy of variable probabilities.
};

template <class Calculator>
double ImportanceAnalyzer<Calculator>::CalculateMif(int index)  {
  index += Pdag::kVariableStartIndex;
  auto p_conditional = [index, this](bool state) {
    p_vars_[index] = state;
    return static_cast<ProbabilityAnalyzer<Calculator>*>(prob_analyzer())
        ->CalculateTotalProbability(p_vars_);
  };
  double p_store = p_vars_[index];  // Save the original value for restoring.
  double mif = p_conditional(true) - p_conditional(false);
  p_vars_[index] = p_store;  // Restore the probability for next calculation.
  return mif;
}

/// Specialization of importance analyzer with Binary Decision Diagrams.
template <>
class ImportanceAnalyzer<Bdd> : public ImportanceAnalyzerBase {
 public:
  /// Constructs importance analyzer from probability analyzer.
  /// Probability analyzer facilities are used
  /// to calculate the total and conditional probabilities for factors.
  ///
  /// @param[in] prob_analyzer  Instantiated probability analyzer.
  explicit ImportanceAnalyzer(ProbabilityAnalyzer<Bdd>* prob_analyzer)
      : ImportanceAnalyzerBase(prob_analyzer),
        bdd_graph_(prob_analyzer->bdd_graph()) {}

 private:
  double CalculateMif(int index)  override;

  /// Calculates Marginal Importance Factor of a variable.
  ///
  /// @param[in] vertex  The root vertex of a function graph.
  /// @param[in] order  The identifying order of the variable.
  /// @param[in] mark  A flag to mark traversed vertices.
  ///
  /// @returns Importance factor value.
  ///
  /// @note Probability factor fields are used to save results.
  /// @note The graph needs cleaning its marks after this function
  ///       because the graph gets continuously-but-partially marked.
  double CalculateMif(const Bdd::VertexPtr& vertex, int order,
                      bool mark) ;

  /// Retrieves memorized probability values for BDD function graphs.
  ///
  /// @param[in] vertex  Vertex with calculated probabilities.
  ///
  /// @returns Saved probability value of the vertex.
  double RetrieveProbability(const Bdd::VertexPtr& vertex) ;

  Bdd* bdd_graph_;  ///< Binary decision diagram for the analyzer.
};

// Forward declaration – implemented below.
template <>
class ImportanceAnalyzer<scram::mc::DirectEval> : public ImportanceAnalyzerBase {
public:
    explicit ImportanceAnalyzer(ProbabilityAnalyzer<scram::mc::DirectEval>* prob_analyzer)
        : ImportanceAnalyzerBase(prob_analyzer), prob_analyzer_(prob_analyzer) {}

private:
    //  Temporary implementation – returns zero so that the analysis completes.
    //  A future commit will compute true MIF from Monte-Carlo tallies.
    double CalculateMif(int /*index*/)  override { return 0.0; }

    /// @brief Returns a dummy occurrence count (1) for every basic event.
    ///
    /// The regular BDD/ZBDD path counts how many minimal cut sets contain a
    /// variable.  For Monte-Carlo we currently do not compute cut sets, so to
    /// keep the ImportanceAnalysis runner happy we pretend that every variable
    /// appears exactly once.  This prevents the call chain from touching the
    /// stub ZBDD container.
    std::vector<int> occurrences()  override {
        const auto &events = prob_analyzer_->graph()->basic_events();
        return std::vector<int>(events.size(), 1);
    }

    ProbabilityAnalyzer<scram::mc::DirectEval>* prob_analyzer_;
};

}  // namespace scram::core
