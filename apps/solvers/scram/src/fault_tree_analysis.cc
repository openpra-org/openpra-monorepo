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
/// Implementation of fault tree analysis.

#include "fault_tree_analysis.h"

#include <algorithm>
#include <cmath>
#include <exception>
#include <functional>
#include <memory>
#include <limits>
#include <optional>
#include <utility>
#include <vector>

#include "bdd.h"
#include <boost/range/algorithm.hpp>

#include "event.h"
#include "logger.h"
#include "model.h"
#include "parameter.h"
#include "probability_analysis.h"
#include "product_filter.h"

namespace scram::core {

    namespace {

        product_filter::FilterOptions BuildFilterOptions(const Settings &settings,
                                                         bool adaptive_active,
                                                         double adaptive_target) {
            product_filter::FilterOptions options;
            options.limit_order = settings.limit_order();
            options.cut_off = settings.cut_off();
            options.adaptive = adaptive_active;
            options.adaptive_target = adaptive_target;
            options.approximation = settings.approximation();
            options.exact_quantification =
                settings.algorithm() == Algorithm::kBdd && settings.approximation() == Approximation::kNone;
            return options;
        }

    }// namespace

    void Print(const ProductContainer &) {
        // Intentionally left blank to prevent excessive console output during analyses.
    }

        ProductContainer::ProductContainer(const Zbdd &products, const Pdag &graph,
                                                                             const ProductSummary *summary,
                                                                             std::shared_ptr<const ProductList> filtered_products)
                : products_(products), graph_(graph), size_(0),
                    filtered_products_(std::move(filtered_products)) {
        if (summary) {
                        size_ = summary->product_count;
            distribution_ = summary->distribution;
            product_events_.reserve(summary->event_indices.size());
            for (int index: summary->event_indices) {
                const int first_index = Pdag::kVariableStartIndex;
                const int last_index_exclusive = first_index + static_cast<int>(graph_.basic_events().size());
                assert(index >= first_index &&
                       index < last_index_exclusive &&
                       "Product summary basic event index exceeds bounds.");
                product_events_.push_back(graph_.basic_events()[index]);
            }
            boost::sort(product_events_, [](const mef::BasicEvent *lhs, const mef::BasicEvent *rhs) {
                return lhs->id() < rhs->id();
            });
            product_events_.erase(std::unique(product_events_.begin(), product_events_.end()), product_events_.end());
            return;
        }

        Pdag::IndexMap<bool> filter(graph_.basic_events().size());
        const int kFirstIndex = Pdag::kVariableStartIndex;
        const int kLastIndexExclusive = kFirstIndex + static_cast<int>(graph_.basic_events().size());
        for (const std::vector<int> &product: products_) {
            int order_index = product.empty() ? 0 : product.size() - 1;
            if (distribution_.size() <= order_index)
                distribution_.resize(order_index + 1);
            distribution_[order_index]++;
            ++size_;

            for (int i: product) {
                i = std::abs(i);
                if (i < kFirstIndex || i >= kLastIndexExclusive)
                    continue;
                if (filter[i])
                    continue;
                filter[i] = true;
                product_events_.push_back(graph_.basic_events()[i]);
            }
        }
        boost::sort(product_events_, [](const mef::BasicEvent *lhs, const mef::BasicEvent *rhs) {
            return lhs->id() < rhs->id();
        });
        product_events_.erase(std::unique(product_events_.begin(), product_events_.end()), product_events_.end());
    }

    ProductContainer::Iterator::Iterator() = default;

    ProductContainer::Iterator::Iterator(const Pdag &graph, Zbdd::const_iterator it)
        : source_(Source::kZbdd), graph_(&graph) {
        zbdd_it_.emplace(it);
    }

    ProductContainer::Iterator::Iterator(const Pdag &graph,
                                         std::shared_ptr<const ProductList> filtered,
                                         ProductList::const_iterator it)
        : source_(Source::kFiltered), filtered_(std::move(filtered)),
          filtered_it_(it), graph_(&graph) {}

    void ProductContainer::Iterator::increment() {
        cache_.reset();
        if (source_ == Source::kZbdd) {
            assert(zbdd_it_ && "Increment on uninitialized ZBDD iterator.");
            ++(*zbdd_it_);
        } else {
            ++filtered_it_;
        }
    }

    bool ProductContainer::Iterator::equal(const Iterator &other) const {
        if (graph_ == nullptr || other.graph_ == nullptr)
            return graph_ == other.graph_;
        if (source_ != other.source_)
            return false;
        if (graph_ != other.graph_)
            return false;
        if (source_ == Source::kZbdd) {
            if (!zbdd_it_ || !other.zbdd_it_)
                return zbdd_it_.has_value() == other.zbdd_it_.has_value();
            return *zbdd_it_ == *other.zbdd_it_;
        }
        if (filtered_.get() != other.filtered_.get())
            return false;
        return filtered_it_ == other.filtered_it_;
    }

    const Product &ProductContainer::Iterator::dereference() const {
        assert(graph_ && "Dereferencing invalid iterator.");
        if (source_ == Source::kZbdd) {
            assert(zbdd_it_ && "Dereferencing uninitialized ZBDD iterator.");
            cache_.emplace(**zbdd_it_, *graph_);
        } else {
            cache_.emplace(*filtered_it_, *graph_);
        }
        return *cache_;
    }

    ProductContainer::Iterator ProductContainer::begin() const {
        if (filtered_products_)
            return Iterator(graph_, filtered_products_, filtered_products_->cbegin());
        return Iterator(graph_, products_.begin());
    }

    ProductContainer::Iterator ProductContainer::end() const {
        if (filtered_products_)
            return Iterator(graph_, filtered_products_, filtered_products_->cend());
        return Iterator(graph_, products_.end());
    }

    double Product::p() const {
        double p = 1;
        for (const Literal &literal: *this) {
            p *= literal.complement ? 1 - literal.event.p() : literal.event.p();
        }
        return p * graph_.initiating_event_frequency();
    }

    FaultTreeAnalysis::FaultTreeAnalysis(const mef::Gate &root,
                                         const Settings &settings,
                                         const mef::Model *model)
        : Analysis(settings), top_event_(root), model_(model) {}

    void FaultTreeAnalysis::Analyze()  {
        CLOCK(analysis_time);
        graph_ = std::make_unique<Pdag>(top_event_, Analysis::settings().ccf_analysis(), model_);
        graph_->initiating_event_frequency(initiating_event_frequency_);
        adaptive_mode_used_ = false;
        adaptive_target_probability_ = -1.0;
        last_summary_.reset();
        this->Preprocess(graph_.get());
#ifndef NDEBUG
        if (Analysis::settings().preprocessor)
            return;  // Preprocessor only option.
#endif
        // If products are required (most cases), run the algorithm to enumerate.
        // Otherwise (BDD probability-only kNone), skip product generation.
        if (Analysis::settings().requires_products()) {
            CLOCK(algo_time);
            LOG(DEBUG2) << "Launching the algorithm...";
            const Zbdd &products = this->GenerateProducts(graph_.get());
            const bool adaptive_requested = Analysis::settings().adaptive();
            double exact_probability = -1.0;
            bool adaptive_active = false;

            if (adaptive_requested) {
                exact_probability = GetExactProbabilityValue();
                adaptive_active = exact_probability > 0.0;
                if (!adaptive_active) {
                    LOG(WARNING) << "Adaptive quantification requested, but exact probability is unavailable."
                                 << " Falling back to cut-off filtering.";
                }
            }

            std::shared_ptr<ProductSummary::ProductList> filtered_products;
            const auto consumer = [&filtered_products](const std::vector<int> &product, double) {
                if (!filtered_products)
                    filtered_products = std::make_shared<ProductSummary::ProductList>();
                filtered_products->push_back(product);
            };

            const auto options = BuildFilterOptions(Analysis::settings(), adaptive_active, exact_probability);
            ProductSummary summary = product_filter::FilterProducts(products, *graph_, options, consumer);

            if (adaptive_active) {
                LOG(DEBUG2) << "Adaptive quantification kept " << summary.product_count
                            << " of " << summary.original_product_count << " products.";
                LOG(DEBUG2) << "Exact probability target: " << exact_probability;
                if (summary.cut_off_applied) {
                    LOG(DEBUG2) << "Adaptive convergence cut-off: " << summary.applied_cut_off;
                } else {
                    LOG(DEBUG2) << "Adaptive convergence retained all products (no truncation).";
                }
            } else if (summary.cut_off_applied) {
                LOG(DEBUG2) << "Cut-off retained " << summary.product_count
                            << " of " << summary.original_product_count << " products.";
            }
            LOG(DEBUG2) << "The algorithm finished in " << DUR(algo_time);
            LOG(DEBUG2) << "# of products: " << summary.product_count;
            if (!adaptive_active && summary.cut_off_applied) {
                LOG(DEBUG2) << "Cut-off " << Analysis::settings().cut_off() << " pruned "
                            << summary.pruned_products << " products.";
            } else if (!adaptive_active && summary.pruned_products > 0) {
                LOG(DEBUG2) << "Order limit " << Analysis::settings().limit_order() << " retained "
                            << summary.product_count << " of " << summary.original_product_count
                            << " products.";
            }
            adaptive_mode_used_ = adaptive_active;
            adaptive_target_probability_ = adaptive_active ? exact_probability : -1.0;
            last_summary_ = summary;
            Analysis::AddAnalysisTime(DUR(analysis_time));
            CLOCK(store_time);
            std::shared_ptr<const ProductSummary::ProductList> filtered_products_const;
            if (filtered_products) {
                filtered_products_const = std::static_pointer_cast<const ProductSummary::ProductList>(filtered_products);
            }
            Store(products, *graph_, summary, std::move(filtered_products_const));
            LOG(DEBUG2) << "Stored the result for reporting in " << DUR(store_time);
        } else {
            // For BDD probability-only mode, algorithm invocation is deferred to
            // the ProbabilityAnalyzer which constructs/evaluates directly on BDD.
            LOG(DEBUG2) << "Skipping product enumeration (BDD probability-only mode).";
            Analysis::AddAnalysisTime(DUR(analysis_time));
        }
    }

    double FaultTreeAnalysis::GetExactProbabilityValue() const {
        return ComputeAdaptiveTargetProbability();
    }

    double FaultTreeAnalysis::ComputeAdaptiveTargetProbability() const {
        if (!Analysis::settings().adaptive())
            return -1.0;

        LOG(DEBUG2) << "Adaptive quantification: deriving exact probability via internal BDD run.";

        Settings oracle_settings = Analysis::settings();
        oracle_settings.adaptive(false);
        oracle_settings.prime_implicants(false);
        oracle_settings.importance_analysis(false);
        oracle_settings.uncertainty_analysis(false);
        oracle_settings.safety_integrity_levels(false);
        oracle_settings.skip_products(false);
        oracle_settings.probability_analysis(true);
        oracle_settings.algorithm(Algorithm::kBdd);
        oracle_settings.approximation(Approximation::kNone);

        try {
            FaultTreeAnalyzer<Bdd> oracle_analyzer(top_event_, oracle_settings, model_);
            oracle_analyzer.initiating_event_frequency(initiating_event_frequency_);
            oracle_analyzer.Analyze();

            mef::MissionTime *mission_time_ptr = nullptr;
            std::optional<mef::MissionTime> fallback_time;
            if (model_) {
                mission_time_ptr = &const_cast<mef::Model *>(model_)->mission_time();
            } else {
                fallback_time.emplace(Analysis::settings().mission_time());
                mission_time_ptr = &fallback_time.value();
            }

            ProbabilityAnalyzer<Bdd> oracle_probability(&oracle_analyzer, mission_time_ptr);
            oracle_probability.Analyze();
            const double exact_probability = oracle_probability.p_total();
            LOG(DEBUG2) << "Adaptive quantification: BDD-derived probability "
                        << exact_probability;
            return exact_probability;
        } catch (const std::exception &ex) {
            LOG(WARNING) << "Adaptive quantification: failed to compute exact probability via BDD: " << ex.what();
        } catch (...) {
            LOG(WARNING) << "Adaptive quantification: failed to compute exact probability via BDD (unknown error).";
        }

        return -1.0;
    }

    void FaultTreeAnalysis::Store(const Zbdd &products,
                                  const Pdag &graph,
                                  const ProductSummary &summary,
                                  std::shared_ptr<const ProductSummary::ProductList> filtered_products)  {
        // Special cases of sets.
        if (products.empty()) {
            Analysis::AddWarning("The set is NULL/Empty.");
        } else if (products.base()) {
            Analysis::AddWarning("The set is UNITY/Base.");
        }
        if (summary.cut_off_applied && summary.product_count == 0) {
            Analysis::AddWarning("All products were removed by the cut-off threshold.");
        }
        filtered_products_ = std::move(filtered_products);
        products_ = std::make_unique<const ProductContainer>(products, graph, &summary, filtered_products_);

#ifndef NDEBUG
        for (const Product &product: *products_)
            assert(product.size() <= Analysis::settings().limit_order() &&
                   "Miscalculated product sets with larger-than-required order.");

        if (Analysis::settings().print)
            Print(*products_);
#endif
    }

}// namespace scram::core
