/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
 * Copyright (C) 2024 OpenPRA ORG Inc.
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
        }
        settings->prime_implicants(vm.contains("prime-implicants"));

        bool probability_requested = vm.contains("probability");

        // Determine if the probability approximation is requested.
        if (vm.contains("rare-event")) {
            settings->approximation(scram::core::Approximation::kRareEvent);
            probability_requested = true;
        } else if (vm.contains("mcub")) {
            settings->approximation(scram::core::Approximation::kMcub);
            probability_requested = true;
        }     
        SET("time-step", double, time_step);
        settings->safety_integrity_levels(vm.contains("sil"));
        // For BDD algorithm: enable probability analysis by default UNLESS prime-implicants is requested alone
        // This allows:
        // --bdd => probability only
        // --bdd --probability => probability only
        // --bdd --prime-implicants => products only
        // --bdd --prime-implicants --probability => both products and probability
        if (vm.contains("bdd")) {
            if (vm.contains("prime-implicants")) {
                // Only enable probability if explicitly requested
                settings->probability_analysis(probability_requested);
            } else {
                // Enable probability by default for BDD (unless explicitly using --prime-implicants)
                settings->probability_analysis(true);
            }
        } else {
            // For non-BDD algorithms, enable probability when explicitly requested or implied by approximation flags
            settings->probability_analysis(probability_requested);
        }
        settings->importance_analysis(vm.contains("importance"));
        settings->uncertainty_analysis(vm.contains("uncertainty"));
        settings->ccf_analysis(vm.contains("ccf"));
        settings->adaptive(vm.contains("adaptive"));
        SET("seed", int, seed);
        SET("limit-order", int, limit_order);
        SET("cut-off", double, cut_off);
        SET("mission-time", double, mission_time);
        SET("num-quantiles", int, num_quantiles);
        SET("num-bins", int, num_bins);
        settings->preprocessor = vm.contains("preprocessor");
        settings->print = vm.contains("print");


        settings->expand_atleast_gates(vm.contains("no-kn"));
        settings->expand_xor_gates(vm.contains("no-xor"));

        SET("compilation-passes", int, compilation_level);

    }
#undef SET

}// namespace SCRAMCLI
