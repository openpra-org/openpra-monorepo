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

#include <cstdio> // vsnprintf
#include <memory>
#include <string>
#include <vector>

#include "initializer.h"
#include "reporter.h"
#include "risk_analysis.h"
#include "serialization.h"
#include "settings.h"
#include <boost/exception/all.hpp>
#include <boost/program_options.hpp>

#include "ConstructSettings.h"

namespace po = boost::program_options;

namespace ScramCLI {

/// Main body of command-line entrance to run the program.
///
/// @param[in] vm  Variables map of program options.
///
/// @throws Error  Exceptions specific to SCRAM.
/// @throws boost::exception  Boost errors with the variables map.
/// @throws std::exception  All other problems.
inline void RunScram(const po::variables_map &vm) {
    scram::core::Settings settings; // Analysis settings.
    std::vector<std::string> input_files;
    ConstructSettings(vm, &settings);
    if (vm.contains("input-files")) {
        auto cmd_input = vm["input-files"].as<std::vector<std::string>>();
        input_files.insert(input_files.end(), cmd_input.begin(), cmd_input.end());
    }
    // Make the CLI-provided input files available inside the analysis settings instance.
    settings.input_files(input_files);
    // Process input files
    // into valid analysis containers and constructs.
    // Throws if anything is invalid.
    std::unique_ptr<scram::mef::Model> model = scram::mef::Initializer(input_files, settings, vm.contains("allow-extern")).model();
    settings.model(model.get());

    if (vm.contains("serialize"))
        return Serialize(*model, stdout);
    if (vm.contains("validate"))
        return; // Stop if only validation is requested.

    // Initiate risk analysis with the given information.
    scram::core::RiskAnalysis analysis(model.get(), settings);
    analysis.Analyze();
    if (vm.contains("no-report") || vm.contains("preprocessor") || vm.contains("print"))
        return;
    scram::Reporter reporter;
    const bool indent = !(vm.contains("no-indent"));
    if (vm.contains("output")) {
        reporter.Report(analysis, vm["output"].as<std::string>(), indent);
    } else {
        reporter.Report(analysis, stdout, indent);
    }
}

} // namespace ScramCLI
