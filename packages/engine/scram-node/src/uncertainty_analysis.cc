/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
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
/// Implements the functionality to run Monte Carlo simulations.

#include "uncertainty_analysis.h"

#include <cmath>
#include <algorithm>            // std::clamp

#include <boost/accumulators/accumulators.hpp>
#include <boost/accumulators/statistics/density.hpp>
#include <boost/accumulators/statistics/extended_p_square_quantile.hpp>
#include <boost/accumulators/statistics/mean.hpp>
#include <boost/accumulators/statistics/stats.hpp>
#include <boost/accumulators/statistics/variance.hpp>

#include "event.h"
#include "expression.h"
#include "logger.h"
#include "mc/stats/tally_node.h"

namespace scram::core {

// ---------------------------------------------------------------------------
//  Compatibility constructor – retains original behavior when built from a
//  completed ProbabilityAnalysis.
// ---------------------------------------------------------------------------
UncertaintyAnalysis::UncertaintyAnalysis(const ProbabilityAnalysis* prob_analysis)
    : Analysis(prob_analysis->settings()),
      mean_(0),
      sigma_(0),
      error_factor_(1) {}

UncertaintyAnalysis::UncertaintyAnalysis(const mc::stats::tally& tally)
    : Analysis(Settings{}),  // use default settings – analysis won’t be run
      mean_(tally.mean),
      sigma_(0),
      error_factor_(1) {
  using stats_t = mc::stats::tally;
  const stats_t& stats = tally;

  // Estimate the standard deviation (σ) from the standard error (SE).
  // SE = σ / √N   ⇒   σ = SE·√N
  const double n = static_cast<double>(stats.total_bits);
  sigma_ = n > 0 ? stats.std_err * std::sqrt(n) : 0.0;

  // 95 % error factor (log-normal assumption, as in original implementation).
  error_factor_ = std::exp(1.96 * sigma_);

  // 95 % confidence interval for the mean (two-sided).
  const double hw95 = 1.96 * stats.std_err;
  confidence_interval_.first  = std::clamp(mean_ - hw95, 0.0, 1.0);
  confidence_interval_.second = std::clamp(mean_ + hw95, 0.0, 1.0);

  // Minimal placeholder distributions/quantiles so Reporter can iterate safely.
  quantiles_.clear();
  quantiles_.push_back(mean_);

  distribution_.clear();
  distribution_.push_back({0.0, mean_});
  distribution_.push_back({1.0, mean_});
}

void UncertaintyAnalysis::Analyze()  {
  CLOCK(analysis_time);
  CLOCK(sample_time);
  LOG(DEBUG3) << "Sampling probabilities...";
  // Sample probabilities and generate data.
  std::vector<double> samples = this->Sample();
  LOG(DEBUG3) << "Finished sampling probabilities in " << DUR(sample_time);

  {
    TIMER(DEBUG3, "Calculating statistics");
    CalculateStatistics(samples);  // Perform statistical analysis.
  }

  Analysis::AddAnalysisTime(DUR(analysis_time));
}

std::vector<std::pair<int, mef::Expression&>>
UncertaintyAnalysis::GatherDeviateExpressions(const Pdag* graph)  {
  std::vector<std::pair<int, mef::Expression&>> deviate_expressions;
  int index = Pdag::kVariableStartIndex;
  for (const mef::BasicEvent* event : graph->basic_events()) {
    if (event->expression().IsDeviate())
      deviate_expressions.emplace_back(index, event->expression());
    ++index;
  }
  return deviate_expressions;
}

void UncertaintyAnalysis::SampleExpressions(
    const std::vector<std::pair<int, mef::Expression&>>& deviate_expressions,
    Pdag::IndexMap<double>* p_vars)  {
  // Reset distributions.
  for (const auto& expression : deviate_expressions)
    expression.second.Reset();

  // Sample all expressions with distributions.
  for (const auto& expression : deviate_expressions) {
    double prob = expression.second.Sample();
    (*p_vars)[expression.first] = prob > 1 ? 1 : prob < 0 ? 0 : prob;
  }
}

void UncertaintyAnalysis::CalculateStatistics(
    const std::vector<double>& samples)  {
  using namespace boost;  // NOLINT
  using namespace boost::accumulators;  // NOLINT
  using histogram_type =
      iterator_range<std::vector<std::pair<double, double>>::iterator>;
  quantiles_.clear();
  int num_quantiles = Analysis::settings().num_quantiles();
  double delta = 1.0 / num_quantiles;
  for (int i = 0; i < num_quantiles; ++i) {
    quantiles_.push_back(delta * (i + 1));
  }
  int num_trials = Analysis::settings().num_trials();
  accumulator_set<double, stats<tag::mean, tag::variance, tag::density,
                                tag::extended_p_square_quantile>>
      acc(tag::density::num_bins = Analysis::settings().num_bins(),
          tag::density::cache_size = num_trials,
          extended_p_square_probabilities = quantiles_);
  for (double sample : samples) {
    acc(sample);
  }
  histogram_type hist = density(acc);
  for (int i = 1; i < hist.size(); i++) {
    distribution_.push_back(hist[i]);
  }
  mean_ = boost::accumulators::mean(acc);
  sigma_ = std::sqrt(num_trials * variance(acc) / (num_trials - 1));
  error_factor_ = std::exp(1.96 * sigma_);
  confidence_interval_.first = mean_ - sigma_ * 1.96 / std::sqrt(num_trials);
  confidence_interval_.second = mean_ + sigma_ * 1.96 / std::sqrt(num_trials);

  for (int i = 0; i < num_quantiles; ++i) {
    quantiles_[i] = quantile(acc, quantile_probability = quantiles_[i]);
  }
}

}  // namespace scram::core
