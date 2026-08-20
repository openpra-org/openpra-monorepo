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

#include <iostream>
#include <string>
#include <vector>

#include <boost/exception/all.hpp>
#include <boost/program_options.hpp>
#include <boost/version.hpp>

#include <libxml/xmlversion.h>// LIBXML_TEST_VERSION, LIBXML_DOTTED_VERSION

#include "error.h"
#include "logger.h"


#include "ConstructOptions.h"

namespace po = boost::program_options;

namespace ScramCLI {
    /// Parses the command-line arguments.
    ///
    /// @param[in] argc  Count of arguments.
    /// @param[in] argv  Values of arguments.
    /// @param[out] vm  Variables map of program options.
    ///
    /// @returns 0 for success.
    /// @returns 1 for errored state.
    /// @returns -1 for information only state like help and version.
    inline int ParseArguments(int argc, char *argv[], po::variables_map *vm) {
        const char *usage = "Usage:    scram [options] input-files...";
        po::options_description desc = ConstructOptions();
        try {
            po::store(po::parse_command_line(argc, argv, desc), *vm);
        } catch (std::exception &err) {
            std::cerr << "Option error: " << err.what() << "\n\n"
                      << usage << "\n\n"
                      << desc << std::endl;
            return 1;
        }
        po::options_description options("All options with positional input files.");
        options.add(desc).add_options()("input-files",
                                        po::value<std::vector<std::string>>(),
                                        "MEF input files with analysis constructs");
        po::positional_options_description p;
        p.add("input-files", -1);// All input files are implicit.
        po::store(
                po::command_line_parser(argc, argv).options(options).positional(p).run(),
                *vm);
        po::notify(*vm);

        auto print_help = [&usage, &desc](std::ostream &out) {
            out << usage << "\n\n"
                << desc << std::endl;
        };

        // Process command-line arguments.
        if (vm->count("help")) {
            print_help(std::cout);
            return -1;
        }
        if (vm->count("version")) {
            std::cout << "SCRAM "
                      << "\n\nDependencies:\n"
                      << "   Boost       " << BOOST_LIB_VERSION << "\n"
                      << "   libxml2     " << LIBXML_DOTTED_VERSION << std::endl;
            return -1;
        }

        if (vm->count("verbosity")) {
            int level = (*vm)["verbosity"].as<int>();
            if (level < 0 || level > scram::kMaxVerbosity) {
                std::cerr << "Log verbosity must be between 0 and "
                          << scram::kMaxVerbosity << ".\n\n";
                print_help(std::cerr);
                return 1;
            }
        }

        if (!vm->count("input-files") && !vm->count("project")) {
            std::cerr << "No input or configuration file is given.\n\n";
            print_help(std::cerr);
            return 1;
        }
        if ((vm->count("bdd") + vm->count("pdag") + vm->count("zbdd") + vm->count("mocus")) > 1) {
            std::cerr << "Mutually exclusive qualitative analysis algorithms.\n"
                      << "(MOCUS/BDD/ZBDD/PDAG) cannot be applied at the same time.\n\n";
            print_help(std::cerr);
            return 1;
        }
        if ((vm->count("rare-event") + vm->count("mcub") + vm->count("monte-carlo")) > 1) {
            std::cerr << "Mutually exclusive quantitative analysis algorithms.\n"
                      << "(rare-event/mcub/monte-carlo) cannot be applied at the same time.\n\n";
            print_help(std::cerr);
            return 1;
        }
        return 0;
    }
}// namespace SCRAMCLI
