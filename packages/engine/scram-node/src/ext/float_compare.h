/*
 * Copyright (C) 2017-2018 Olzhas Rakhimov
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
/// Floating pointing comparison helper functions.

#pragma once

#include <cassert>
#include <cmath>

namespace ext {

/// Compares two floating point number within tolerance.
///
/// @param[in] lhs  The reference comparison value.
/// @param[in] rhs  The test value.
/// @param[in] tolerance  The percent tolerance for the difference.
///
/// @returns true if the values are close within the tolerance.
///
/// @note The implementation does not deal with overflows and underflows.
///       Therefore, the compared numbers must not be too large or small.
inline bool is_close(double lhs, double rhs, double tolerance)  {
  assert(tolerance < 1 && "Invalid tolerance for float comparison.");
  return std::abs(lhs - rhs) <= std::abs(lhs) * tolerance;
}

}  // namespace ext
