/**
 * @file importance_analysis.cc
 * @brief Monte Carlo importance analysis implementation using SYCL-based parallel computation
 * @author Arjun Earthperson
 * @date 2025
 *
 * @copyright Copyright (C) 2025 Arjun Earthperson
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
 *
 **/

#include "importance_analysis.h"
#include "probability_analysis.h"

#include "mc/core/direct_eval.h"

/// ---------------------------------------------------------------------------
///  Stub specialization of ImportanceAnalyzer for Monte-Carlo DirectEval path.
///  This merely wires the class into the existing template dispatch so that the
///  RiskAnalysis -> ImportanceAnalysis call chain compiles.  Full logic will be
///  added later.
/// ---------------------------------------------------------------------------

namespace scram::core {

}  // namespace scram::core