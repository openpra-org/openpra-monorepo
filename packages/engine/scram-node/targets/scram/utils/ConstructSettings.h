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

#pragma once
#include <string>

#include <boost/exception/all.hpp>
#include <boost/program_options.hpp>

#include "settings.h"

namespace po = boost::program_options;

namespace ScramCLI {

/// Helper macro for ConstructSettings
/// to set the flag in "settings"
/// only if provided by "vm" arguments.
#define SET(tag, type, member) \
  if (vm.contains(tag)) settings->member(vm[tag].as<type>())
    // clang-format on

    /// Updates analysis settings from command-line arguments.
    ///
    /// @param[in] vm  Variables map of program options.
    /// @param[in,out] settings  Pre-configured or default settings.
    ///
    /// @throws SettingsError  The indication of an error in arguments.
    /// @throws std::exception  vm does not contain a required option.
    ///                         At least defaults are expected.
    inline void ConstructSettings(const po::variables_map &vm,
                                  scram::core::Settings *settings) {
        if (vm.contains("bdd")) {
            settings->algorithm(scram::core::Algorithm::kBdd);
        } else if (vm.contains("zbdd")) {
            settings->algorithm(scram::core::Algorithm::kZbdd);
        } else if (vm.contains("mocus")) {
            settings->algorithm(scram::core::Algorithm::kMocus);
        } else if (vm.contains("pdag")) {
            settings->algorithm(scram::core::Algorithm::kDirect);
        }
        settings->prime_implicants(vm.contains("prime-implicants"));

        // Determine if the probability approximation is requested.
        if (vm.contains("monte-carlo")) {
            settings->approximation(scram::core::Approximation::kMonteCarlo);
            // Ensure quantitative analysis is executed when Monte Carlo approximation is requested.
            settings->probability_analysis(true);
        } else if (vm.contains("rare-event")) {
            settings->approximation(scram::core::Approximation::kRareEvent);
        } else if (vm.contains("mcub")) {
            settings->approximation(scram::core::Approximation::kMcub);
        }
        SET("time-step", double, time_step);
        settings->safety_integrity_levels(vm.contains("sil"));
        settings->probability_analysis(vm.contains("probability"));
        settings->importance_analysis(vm.contains("importance"));
        settings->uncertainty_analysis(vm.contains("uncertainty"));
        settings->ccf_analysis(vm.contains("ccf"));
        SET("seed", int, seed);
        SET("limit-order", int, limit_order);
        SET("cut-off", double, cut_off);
        SET("mission-time", double, mission_time);
        SET("batch-size", std::size_t, batch_size);
        SET("sample-size", std::size_t, sample_size);
        SET("num-quantiles", int, num_quantiles);
        SET("num-bins", int, num_bins);
        settings->preprocessor = vm.contains("preprocessor");
        settings->print = vm.contains("print");


        settings->expand_atleast_gates(vm.contains("no-kn"));
        settings->expand_xor_gates(vm.contains("no-xor"));

        SET("compilation-passes", int, compilation_level);
        SET("confidence", double, ci_confidence);
        SET("delta", double, ci_rel_margin_error);
        SET("burn-in", double, ci_burnin_trials);

        SET("overhead-ratio", double, overhead_ratio);


        if (vm.contains("policy")) {
            settings->ci_policy(vm["policy"].as<std::string>());
        }

        SET("oracle", double, oracle_p);

        if (vm.contains("num-trials")) {
            settings->early_stop(vm.contains("early-stop"));// if user passed --early-stop along with --num-trials, intent is clear
            // otherwise, turn off --early-stop with --num-trials
            SET("num-trials", std::double_t, num_trials); // this will also set early-stop to true if num-trials = 0
        } else {
            settings->num_trials(0); // this will also set early-stop to true
        }

        settings->watch_mode(vm.contains("watch"));

    }
#undef SET

}// namespace SCRAMCLI
