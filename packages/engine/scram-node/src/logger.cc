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
/// Initializing static members and member functions of Logger class.

#include "logger.h"

#include <cstdio>

#include <string>

namespace scram {

const char* const Logger::kLevelToString_[] = {"ERROR",  "WARNING", "INFO",
                                               "DEBUG1", "DEBUG2",  "DEBUG3",
                                               "DEBUG4", "DEBUG5"};
LogLevel Logger::report_level_ = ERROR;

Logger::~Logger()  {
  os_ << "\n";
  std::fputs(os_.str().c_str(), stderr);  // stdio is used for thread safety.
  std::fflush(stderr);  // Should be no-op for the unbuffered stderr.
}

std::ostringstream& Logger::Get(LogLevel level) {
  os_ << Logger::kLevelToString_[level] << ": ";
  if (level > INFO)
    os_ << std::string(level - INFO, '\t');
  return os_;
}

}  // namespace scram
