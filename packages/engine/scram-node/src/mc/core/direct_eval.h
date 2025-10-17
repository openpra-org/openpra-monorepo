/*
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
/// Fault tree analysis using direct evaluation.
///

#pragma once

#include "pdag.h"
#include "settings.h"
#include "zbdd.h"

namespace scram::mc {

class DirectEval : private boost::noncopyable {
 public:
  /// Prepares a PDAG
  ///
  /// @param[in] graph  Preprocessed PDAG.
  /// @param[in] settings  The analysis settings.
  ///
  /// @pre The passed PDAG already has variable ordering.
  DirectEval(const core::Pdag* graph, const core::Settings& settings) : graph_(graph), kSettings_(settings) {
  }

  /// Finds minimal cut sets from the PDAG.
  /// STUB implementation:: broken
  /// @param[in] graph  The optional PDAG with non-declarative substitutions.
  void Analyze(const core::Pdag* /*graph*/ = nullptr)  {
      zbdd_ = std::make_unique<core::Zbdd>(graph_, kSettings_);
  }

  /// @returns Generated minimal cut sets with basic event indices.
  const core::Zbdd& products() const {
     return *zbdd_;
  }

 private:
  /// Runs analysis on a module gate.
  /// All sub-modules are analyzed and joined recursively.
  ///
  /// @param[in] gate  A PDAG gate for analysis.
  /// @param[in] settings  Settings for analysis.
  ///
  /// @returns stub/empty ZBDD container
  std::unique_ptr<core::zbdd::CutSetContainer>
  AnalyzeModule(const core::Gate& gate, const core::Settings& /*settings*/)  {
      const int kMaxVariableIndex = core::Pdag::kVariableStartIndex + static_cast<int>(graph_->basic_events().size()) - 1;
      auto empty_container = std::make_unique<core::zbdd::CutSetContainer>(kSettings_, gate.index(), kMaxVariableIndex);
      return empty_container;
  }

  const core::Pdag* graph_;  ///< The analysis PDAG.
  const core::Settings kSettings_;  ///< Analysis settings.
  std::unique_ptr<core::Zbdd> zbdd_; ///< Stub ZBDD
};

}  // namespace scram::core
