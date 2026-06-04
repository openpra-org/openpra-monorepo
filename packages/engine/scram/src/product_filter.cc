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

#include "product_filter.h"

#include <algorithm>
#include <cmath>
#include <limits>

#include <boost/range/algorithm.hpp>

namespace scram::core::product_filter {

namespace {

struct ScoredProduct {
    std::vector<int> product;
    double probability;
};

} // namespace

double CalculateProductProbability(const std::vector<int> &product,
                                    const Pdag &graph,
                                    double stop_threshold) {
    const int kFirstIndex = Pdag::kVariableStartIndex;
    const int kLastIndexExclusive =
        kFirstIndex + static_cast<int>(graph.basic_events().size());
    double probability = 1.0;
    for (int literal : product) {
        const int index = std::abs(literal);
        if (index < kFirstIndex || index >= kLastIndexExclusive)
            continue;
        const mef::BasicEvent *event = graph.basic_events()[index];
        const double event_probability = event ? event->p() : 0.0;
        probability *= literal < 0 ? 1.0 - event_probability : event_probability;
        if (stop_threshold >= 0.0 && probability < stop_threshold)
            break;
    }
    probability *= graph.initiating_event_frequency();
    return probability;
}

ProductSummary FilterProducts(const Zbdd &products,
                              const Pdag &graph,
                              const FilterOptions &options,
                              const ProductConsumer &consumer) {
    ProductSummary summary;
    const bool enforce_order = options.limit_order > 0;
    const bool enforce_cut_off = options.cut_off > 0.0;
    const bool adaptive_active = options.adaptive && options.adaptive_target > 0.0;
    const bool filtering_requested = enforce_order || enforce_cut_off || adaptive_active;
    const bool requires_probability = enforce_cut_off || adaptive_active;

    if (!filtering_requested) {
        Pdag::IndexMap<bool> seen_events(graph.basic_events().size());
        const int kFirstIndex = Pdag::kVariableStartIndex;
        const int kLastIndexExclusive = kFirstIndex + static_cast<int>(graph.basic_events().size());

        for (const std::vector<int> &product : products) {
            summary.original_product_count++;
            summary.product_count++;
            const int order_index = product.empty() ? 0 : static_cast<int>(product.size()) - 1;
            if (static_cast<int>(summary.distribution.size()) <= order_index)
                summary.distribution.resize(order_index + 1, 0);
            summary.distribution[order_index]++;

            for (int literal : product) {
                const int index = std::abs(literal);
                if (index < kFirstIndex || index >= kLastIndexExclusive)
                    continue;
                if (seen_events[index])
                    continue;
                seen_events[index] = true;
                summary.event_indices.push_back(index);
            }
        }

        boost::sort(summary.event_indices);
        return summary;
    }

    std::vector<ScoredProduct> retained;
    retained.reserve(64);

    for (const std::vector<int> &product : products) {
        summary.original_product_count++;

        if (enforce_order && static_cast<int>(product.size()) > options.limit_order)
            continue;

        double probability = 0.0;
        if (requires_probability || adaptive_active) {
            if (options.exact_quantification) {
                const double stop_threshold = enforce_cut_off ? options.cut_off : -1.0;
                probability = CalculateProductProbability(product, graph, stop_threshold);
            } else {
                probability = CalculateProductProbability(product, graph);
            }
        }

        // Filter based on the mean of probability and machine epsilon.
        double epsilon = std::numeric_limits<double>::epsilon();
        double threshold = 0.0;

        // Method 1: Log 10 based arithmetic mean
        if (probability > 0) {
            double log_prob = std::log10(probability);
            double log_eps = std::log10(epsilon);
            double log_mean = (log_prob + log_eps) / 2.0;
            threshold = std::pow(10, log_mean);
        }

        // Method 2: Harmonic Mean
        // threshold = (2.0 * probability * epsilon) / (probability + epsilon);

        // Method 3: Geometric Mean
        // threshold = std::sqrt(probability * epsilon);

        if (probability <= threshold)
            continue;

        if (enforce_cut_off && probability < options.cut_off)
            continue;

        retained.push_back({product, probability});
    }

    double applied_cut_off = enforce_cut_off ? options.cut_off : 0.0;

    if (adaptive_active && !retained.empty()) {
        const bool use_rare_event = options.approximation == Approximation::kRareEvent;
        boost::sort(retained, [](const ScoredProduct &lhs, const ScoredProduct &rhs) {
            return lhs.probability > rhs.probability;
        });

        std::vector<ScoredProduct> adaptive_subset;
        adaptive_subset.reserve(retained.size());
        double complement_acc = 1.0;
        double rare_sum = 0.0;
        for (const auto &item : retained) {
            adaptive_subset.push_back(item);
            double estimated_total = 0.0;
            if (use_rare_event) {
                rare_sum += item.probability;
                rare_sum = std::min(rare_sum, 1.0);
                estimated_total = rare_sum;
            } else {
                const double complement_factor = std::clamp(1.0 - item.probability, 0.0, 1.0);
                complement_acc *= complement_factor;
                estimated_total = 1.0 - complement_acc;
            }

            if (estimated_total + options.epsilon >= options.adaptive_target) {
                applied_cut_off = item.probability;
                break;
            }
        }
        if (!adaptive_subset.empty()) {
            retained.swap(adaptive_subset);
        }
    }

    summary.product_count = static_cast<int>(retained.size());
    summary.pruned_products = std::max(0, summary.original_product_count - summary.product_count);
    summary.cut_off_applied = enforce_cut_off || (adaptive_active && !retained.empty());
    summary.applied_cut_off = summary.cut_off_applied ? applied_cut_off : 0.0;

    Pdag::IndexMap<bool> seen_events(graph.basic_events().size());
    const int kFirstIndex = Pdag::kVariableStartIndex;
    const int kLastIndexExclusive = kFirstIndex + static_cast<int>(graph.basic_events().size());

    for (const auto &item : retained) {
        const std::vector<int> &product = item.product;
        const int order_index = product.empty() ? 0 : static_cast<int>(product.size()) - 1;
        if (static_cast<int>(summary.distribution.size()) <= order_index)
            summary.distribution.resize(order_index + 1, 0);
        summary.distribution[order_index]++;

        for (int literal : product) {
            const int index = std::abs(literal);
            if (index < kFirstIndex || index >= kLastIndexExclusive)
                continue;
            if (seen_events[index])
                continue;
            seen_events[index] = true;
            summary.event_indices.push_back(index);
        }
    }

    const bool emit_filtered = consumer && (!retained.empty()) &&
                               (summary.pruned_products > 0 || summary.cut_off_applied || adaptive_active);
    if (emit_filtered) {
        for (const auto &item : retained)
            consumer(item.product, item.probability);
    }

    boost::sort(summary.event_indices);
    return summary;
}

} // namespace scram::core::product_filter
