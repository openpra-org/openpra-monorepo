/*
 * Copyright (C) 2025 OpenPRA ORG Inc.
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

#pragma once

#include <functional>
#include <limits>
#include <vector>

#include "fault_tree_analysis.h"
#include "settings.h"
#include "zbdd.h"

namespace scram::core::product_filter {

struct FilterOptions {
    int limit_order = 0;
    double cut_off = 0.0;
    bool adaptive = false;
    double adaptive_target = -1.0;
    double epsilon = std::numeric_limits<double>::epsilon();
    Approximation approximation = Approximation::kNone;
    bool exact_quantification = false;
};

/// Calculates the probability of a product, optionally short-circuiting
/// when it falls below a stop threshold.
double CalculateProductProbability(const std::vector<int> &product,
                                    const Pdag &graph,
                                    double stop_threshold = -1.0);

using ProductConsumer = std::function<void(const std::vector<int> &product, double probability)>;

/// Applies order-limit, cut-off, and adaptive filters to the provided
/// products and returns a populated summary.  When a consumer is supplied,
/// each retained product is emitted once filtering is complete.  The
/// consumer is only invoked when filters alter the product set.
ProductSummary FilterProducts(const Zbdd &products,
                              const Pdag &graph,
                              const FilterOptions &options,
                              const ProductConsumer &consumer = {});

} // namespace scram::core::product_filter
