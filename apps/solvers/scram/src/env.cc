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
/// The environment variables discovered at run-time.

#include "env.h"
#include "schemas.h"

#include <cstdlib>

namespace scram::env {

const std::string_view& project_schema() {
  return schemas::get_PROJECT_SCHEMA();
}

const std::string_view& input_schema() {
  return schemas::get_INPUT_SCHEMA();
}

const std::string_view& report_schema() {
  return schemas::get_REPORT_SCHEMA();
}

}  // namespace scram::env
