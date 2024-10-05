/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
 * Copyright (C) 2024 OpenPRA Initiative
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
#include <iostream>
#include <string>


#include <boost/program_options.hpp>

namespace po = boost::program_options;

namespace ScramCLI {
    /// Provides an options value type.
#define OPT_VALUE(type) po::value<type>()->value_name(#type)

    /// @returns Command-line option descriptions.
    inline po::options_description ConstructOptions() {
        using path = std::string;// To print argument type as path.

        po::options_description desc("Options");
        // clang-format off
        desc.add_options()
            ("help", "Display this help message")
            ("version", "Display version information")
            ("project", OPT_VALUE(path), "Project file with analysis configurations")
            ("allow-extern", "**UNSAFE** Allow external libraries")
            ("validate", "Validate input files without analysis")
            ("bdd", "Perform qualitative analysis with BDD")
            ("zbdd", "Perform qualitative analysis with ZBDD")
            ("mocus", "Perform qualitative analysis with MOCUS")
            ("prime-implicants", "Calculate prime implicants")
            ("probability", "Perform probability analysis")
            ("importance", "Perform importance analysis")
            ("uncertainty", "Perform uncertainty analysis")
            ("ccf", "Perform common-cause failure analysis")
            ("sil", "Compute the Safety Integrity Level metrics")
            ("rare-event", "Use the rare event approximation")
            ("mcub", "Use the MCUB approximation")
            ("limit-order,l", OPT_VALUE(int), "Upper limit for the product order")
            ("cut-off", OPT_VALUE(double), "Cut-off probability for products")
            ("mission-time", OPT_VALUE(double), "System mission time in hours")
            ("time-step", OPT_VALUE(double),
             "Time step in hours for probability analysis")
            ("num-trials", OPT_VALUE(int),
             "Number of trials for Monte Carlo simulations")
            ("num-quantiles", OPT_VALUE(int),
             "Number of quantiles for distributions")
            ("num-bins", OPT_VALUE(int), "Number of bins for histograms")
            ("seed", OPT_VALUE(int), "Seed for the pseudo-random number generator")
            ("output,o", OPT_VALUE(path), "Output file for reports")
            ("no-indent", "Omit indentation whitespace in output XML")
            ("verbosity", OPT_VALUE(int), "Set log verbosity");
#ifndef NDEBUG
        po::options_description debug("Debug Options");
        debug.add_options()
            ("serialize", "Serialize the input model without further analysis")
            ("preprocessor", "Stop analysis after the preprocessing step")
            ("print", "Print analysis results in a terminal friendly way")
            ("no-report", "Don't generate analysis report");
        desc.add(debug);
#endif
        // clang-format on
        return desc;
    }
#undef OPT_VALUE
}