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
/// Common facilities for all analysis classes.

#pragma once

#include <cassert>

#include <string>

#include <boost/noncopyable.hpp>

#include "settings.h"

namespace scram::core {

/// Base abstract class for all analysis with settings.
class Analysis : private boost::noncopyable {
 public:
  /// @param[in] settings  Analysis settings for all calculations.
  explicit Analysis(Settings settings);

  virtual ~Analysis() = 0;  ///< Abstract class.

  /// @returns Analysis settings.
  const Settings& settings() const { return settings_; }

  /// @returns Warnings generated upon analysis.
  const std::string& warnings() const { return warnings_; }

  /// @returns Time taken by the analysis.
  double analysis_time() const { return analysis_time_; }

 protected:
  /// @returns Modifiable analysis settings.
  Settings& settings() { return settings_; }

  /// Appends a warning message to the analysis warnings.
  /// Warnings are separated by spaces.
  ///
  /// @param[in] msg  Informative message without special characters.
  void AddWarning(std::string msg) {
    assert(!msg.empty() && "Warnings cannot be empty.");
    warnings_ += (warnings_.empty() ? "" : "; ") + msg;
  }

  /// Adds time to the total analysis time.
  ///
  /// @param[in] time  Additional time spent on analysis.
  void AddAnalysisTime(double time) {
    assert(time >= 0 && "Cannot subtract time.");
    analysis_time_ += time;
  }

 private:
  Settings settings_;  ///< All settings for analysis.
  double analysis_time_;  ///< Time taken by the analysis.
  std::string warnings_;  ///< Generated warnings in analysis.
};

}  // namespace scram::core
