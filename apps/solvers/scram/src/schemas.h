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
/// Embedded RelaxNG schema definitions.
/// These schemas are embedded at compile time to eliminate runtime file dependencies.

#pragma once

#include <string_view>

namespace scram::schemas {

/// @returns The RelaxNG schema for input files (embedded at compile time).
const std::string_view& get_INPUT_SCHEMA();

/// @returns The RelaxNG schema for project files (embedded at compile time).
const std::string_view& get_PROJECT_SCHEMA();

/// @returns The RelaxNG schema for report files (embedded at compile time).
const std::string_view& get_REPORT_SCHEMA();

}  // namespace scram::schemas
