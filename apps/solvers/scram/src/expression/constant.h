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
/// Constant expressions that cannot have uncertainties.

#pragma once

#include "src/expression.h"
#include "src/scram_export.h"

namespace scram::mef {

/// Indicates a constant value.
class ConstantExpression : public Expression {
 public:
  static SCRAM_EXPORT ConstantExpression kOne;  ///< Constant 1 or True.
  static SCRAM_EXPORT ConstantExpression kZero;  ///< Constant 0 or False.
  static SCRAM_EXPORT ConstantExpression kPi;  ///< Constant PI value.

  /// Constructor for constant integer, float, and bool values.
  /// In other words, this constructor is implicitly generic.
  ///
  /// @param[in] value  Numerical value.
  explicit ConstantExpression(double value) : value_(value) {}

  double value()  override { return value_; }
  bool IsDeviate()  override { return false; }

 private:
  double DoSample()  override { return value_; }

  const double value_;  ///< The universal value to represent int, bool, double.
};

}  // namespace scram::mef
