/*
 * Copyright (C) 2015-2018 Olzhas Rakhimov
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
/// Implementation of common facilities for all analysis classes.

#include "analysis.h"

namespace scram::core {

Analysis::Analysis(Settings settings)
    : settings_(std::move(settings)), analysis_time_(0) {}

Analysis::~Analysis() = default;  ///< Pure virtual destructor.

}  // namespace scram::core
