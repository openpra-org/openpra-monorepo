/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
 * Copyright (C) 2023 OpenPRA Initiative
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

#include <cstdarg>
#include <cstdio> // vsnprintf

#include <iostream>
#include <memory>
#include <string>
#include <vector>

#include <boost/exception/all.hpp>
#include <boost/program_options.hpp>
#include "initializer.h"
#include "reporter.h"
#include "risk_analysis.h"
#include "serialization.h"
#include "settings.h"

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
        scram::core::Settings settings;// Analysis settings.
        std::vector<std::string> input_files;
        ConstructSettings(vm, &settings);
        if (vm.count("input-files")) {
            auto cmd_input = vm["input-files"].as<std::vector<std::string>>();
            input_files.insert(input_files.end(), cmd_input.begin(), cmd_input.end());
        }
        // Process input files
        // into valid analysis containers and constructs.
        // Throws if anything is invalid.
        // Step 1: Create an Initializer instance with the provided parameters
        scram::mef::Initializer initializer(input_files, settings, vm.count("allow-extern"));

        // Step 2: Use the initializer to build and retrieve the Model
        std::unique_ptr<scram::mef::Model> model = std::move(initializer).model();
#ifndef NDEBUG
        if (vm.count("serialize"))
            return Serialize(*model, stdout);
#endif
        if (vm.count("validate"))
            return;// Stop if only validation is requested.

        // Initiate risk analysis with the given information.
        scram::core::RiskAnalysis analysis(model.get(), settings);
        analysis.Analyze();
#ifndef NDEBUG
        if (vm.count("no-report") || vm.count("preprocessor") || vm.count("print"))
            return;
#endif
        scram::Reporter reporter;
        bool indent = vm.count("no-indent") ? false : true;
        if (vm.count("output")) {
            reporter.Report(analysis, vm["output"].as<std::string>(), indent);
        } else {
            reporter.Report(analysis, stdout, indent);
        }
    }

}// namespace ScramCLI
