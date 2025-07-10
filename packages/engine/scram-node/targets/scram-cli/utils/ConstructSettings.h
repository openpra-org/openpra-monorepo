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
  if (vm.count(tag)) settings->member(vm[tag].as<type>())
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
        if (vm.count("bdd")) {
            settings->algorithm(scram::core::Algorithm::kBdd);
        } else if (vm.count("zbdd")) {
            settings->algorithm(scram::core::Algorithm::kZbdd);
        } else if (vm.count("mocus")) {
            settings->algorithm(scram::core::Algorithm::kMocus);
        }
        settings->prime_implicants(vm.count("prime-implicants"));
        // Determine if the probability approximation is requested.
        if (vm.count("rare-event")) {
            assert(!vm.count("mcub"));
            settings->approximation(scram::core::Approximation::kRareEvent);
        } else if (vm.count("mcub")) {
            settings->approximation(scram::core::Approximation::kMcub);
        }
        SET("time-step", double, time_step);
        settings->safety_integrity_levels(vm.count("sil"));

        settings->probability_analysis(vm.count("probability"));
        settings->importance_analysis(vm.count("importance"));
        settings->uncertainty_analysis(vm.count("uncertainty"));
        settings->ccf_analysis(vm.count("ccf"));
        SET("seed", int, seed);
        SET("limit-order", int, limit_order);
        SET("cut-off", double, cut_off);
        SET("mission-time", double, mission_time);
        SET("num-trials", int, num_trials);
        SET("num-quantiles", int, num_quantiles);
        SET("num-bins", int, num_bins);
#ifndef NDEBUG
        settings->preprocessor = vm.count("preprocessor");
        settings->print = vm.count("print");
#endif
    }
#undef SET

}// namespace ScramCLI
