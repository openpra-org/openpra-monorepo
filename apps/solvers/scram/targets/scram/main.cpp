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

#include <libxml/parser.h>  // xmlInitParser, xmlCleanupParser
#include <libxml/xmlversion.h>  // LIBXML_TEST_VERSION, LIBXML_DOTTED_VERSION

#include <boost/core/typeinfo.hpp>
#include <boost/exception/all.hpp>
#include <boost/program_options.hpp>
#include <cstdarg>
#include <cstdio>  // vsnprintf
#include <cstring>  // strerror
#include <iostream>
#include <memory>
#include <string>
#include <vector>

#include "error.h"
#include "ext/scope_guard.h"
#include "initializer.h"
#include "logger.h"
#include "reporter.h"
#include "risk_analysis.h"
#include "utils/ParseArguments.h"
#include "utils/RunScram.h"
#include "utils/XmlLogger.h"

namespace po = boost::program_options;

/// Command-line SCRAM entrance.
///
/// @param[in] argc  Argument count.
/// @param[in] argv  Argument vector.
///
/// @returns 0 for success.
/// @returns 1 for errored state.
int main(const int argc, char *argv[]) {
    LIBXML_TEST_VERSION
    xmlInitParser();
    SCOPE_EXIT(&xmlCleanupParser);

    xmlGenericErrorFunc xml_error_printer = ScramCLI::LogXmlError;
    initGenericErrorDefaultFunc(&xml_error_printer);

    try {
        // Parse command-line options.
        po::variables_map vm;
        const int ret = ScramCLI::ParseArguments(argc, argv, &vm);
        if (ret == 1)
            return 1;

        if (vm.count("verbosity")) {
            scram::Logger::report_level(
                    static_cast<scram::LogLevel>(vm["verbosity"].as<int>()));
        }

        if (ret == 0)
            ScramCLI::RunScram(vm);
    } catch (const scram::LogicError &err) {
        LOG(scram::ERROR) << "Logic Error:\n"
                          << boost::diagnostic_information(err);
        return 1;
    } catch (const scram::IOError &err) {
        LOG(scram::DEBUG1) << boost::diagnostic_information(err);
        std::cerr << boost::core::demangled_name(typeid(err)) << "\n\n";
        ScramCLI::PrintErrorInfo<boost::errinfo_file_name>("File", err);
        ScramCLI::PrintErrorInfo<boost::errinfo_file_open_mode>("Open mode", err);
        if (const int *errnum = boost::get_error_info<boost::errinfo_errno>(err)) {
            std::cerr << "Error code: " << *errnum << "\n";
            std::cerr << "Error string: " << std::strerror(*errnum) << "\n";
        }
        std::cerr << "\n"
                  << err.what() << std::endl;
        return 1;
    } catch (const scram::Error &err) {
        using namespace scram;// NOLINT
        LOG(DEBUG1) << boost::diagnostic_information(err);
        std::cerr << boost::core::demangled_name(typeid(err)) << "\n\n";
        ScramCLI::PrintErrorInfo<errinfo_value>("Value", err);
        ScramCLI::PrintErrorInfo<boost::errinfo_file_name>("File", err);
        ScramCLI::PrintErrorInfo<boost::errinfo_at_line>("Line", err);
        ScramCLI::PrintErrorInfo<mef::errinfo_connective>("MEF Connective", err);
        ScramCLI::PrintErrorInfo<mef::errinfo_reference>("MEF reference", err);
        ScramCLI::PrintErrorInfo<mef::errinfo_base_path>("MEF base path", err);
        ScramCLI::PrintErrorInfo<mef::errinfo_element_id>("MEF Element ID", err);
        ScramCLI::PrintErrorInfo<mef::errinfo_element_type>("MEF Element type", err);
        ScramCLI::PrintErrorInfo<mef::errinfo_container_id>("MEF Container", err);
        ScramCLI::PrintErrorInfo<mef::errinfo_container_type>("MEF Container type", err);
        ScramCLI::PrintErrorInfo<mef::errinfo_attribute>("MEF Attribute", err);
        ScramCLI::PrintErrorInfo<mef::errinfo_cycle>("Cycle", err);
        ScramCLI::PrintErrorInfo<xml::errinfo_element>("XML element", err);
        ScramCLI::PrintErrorInfo<xml::errinfo_attribute>("XML attribute", err);
        std::cerr << "\n"
                  << err.what() << std::endl;
        return 1;
    } catch (const boost::exception &boost_err) {
        LOG(scram::ERROR) << "Unexpected Boost Exception:\n"
                          << boost::diagnostic_information(boost_err);
        return 1;
    } catch (const std::exception &err) {
        LOG(scram::ERROR) << "Unexpected Exception: "
                          << boost::core::demangled_name(typeid(err)) << ":\n"
                          << err.what();
        return 1;
    }
    return 0;
}
