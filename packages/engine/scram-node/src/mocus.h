/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
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
/// Fault tree analysis with the MOCUS algorithm.
/// This algorithm requires a fault tree in negation normal form.
/// The fault tree must only contain AND and OR gates.
/// All gates must be positive.
/// That is, negations must be pushed down to leaves, basic events.
/// The fault tree should not contain constants or house events.

#pragma once

#include "pdag.h"
#include "settings.h"
#include "zbdd.h"

namespace scram::core {

/// This class analyzes normalized, preprocessed, and indexed fault trees
/// to generate minimal cut sets with the MOCUS algorithm.
class Mocus : private boost::noncopyable {
 public:
  /// Prepares a PDAG for analysis with the MOCUS algorithm.
  ///
  /// @param[in] graph  Preprocessed and normalized PDAG.
  /// @param[in] settings  The analysis settings.
  ///
  /// @pre The passed PDAG already has variable ordering.
  /// @pre The PDAG is in negation normal form;
  ///      that is, it contains only positive AND/OR gates.
  Mocus(const Pdag* graph, const Settings& settings);

  /// Finds minimal cut sets from the PDAG.
  ///
  /// @param[in] graph  The optional PDAG with non-declarative substitutions.
  void Analyze(const Pdag* graph = nullptr) ;

  /// @returns Generated minimal cut sets with basic event indices.
  [[nodiscard]] const Zbdd& products() const {
    assert(zbdd_ && "Analysis is not done.");
    return *zbdd_;
  }

 private:
  /// Runs analysis on a module gate.
  /// All submodules are analyzed and joined recursively.
  ///
  /// @param[in] gate  A PDAG gate for analysis.
  /// @param[in] settings  Settings for analysis.
  ///
  /// @returns Fully processed, minimized Zbdd cut set container.
  std::unique_ptr<zbdd::CutSetContainer>
  AnalyzeModule(const Gate& gate, const Settings& settings) ;

  const Pdag* graph_;  ///< The analysis PDAG.
  const Settings kSettings_;  ///< Analysis settings.
  std::unique_ptr<Zbdd> zbdd_;  ///< ZBDD as a result of analysis.
};

}  // namespace scram::core
