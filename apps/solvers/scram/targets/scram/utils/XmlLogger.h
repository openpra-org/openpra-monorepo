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

#include <cstdarg>
#include <cstdio> // vsnprintf
#include <cstring>// strerror

#include <iostream>
#include <memory>
#include <string>
#include <vector>

#include <boost/core/typeinfo.hpp>
#include <boost/exception/all.hpp>
#include <boost/program_options.hpp>

#include "error.h"
#include "ext/scope_guard.h"
#include "initializer.h"
#include "logger.h"

namespace po = boost::program_options;

namespace ScramCLI {

    /// Callback function to redirect XML library error/warning messages to logging.
    /// Otherwise, the messages are printed to the standard error.
    ///
    /// @param[in] msg  The printf-style format string.
    /// @param[in] ...  The variadic arguments for the format string.
    ///
    /// @pre The library strictly follows validity conditions of printf.
    extern "C" inline void LogXmlError(void * /*ctx*/, const char *msg, ...)  {
        std::va_list args;
        va_start(args, msg);
        SCOPE_EXIT([&args] { va_end(args); });

        std::va_list args_for_nchar;// Only used to determine the string length.
        va_copy(args_for_nchar, args);
        int nchar = std::vsnprintf(nullptr, 0, msg, args_for_nchar);
        va_end(args_for_nchar);
        if (nchar < 0) {
            LOG(scram::ERROR) << "String formatting failure: " << std::strerror(errno);
            return;
        }

        std::vector<char> buffer(nchar + /*null terminator*/ 1);
        std::vsnprintf(buffer.data(), buffer.size(), msg, args);
        LOG(scram::WARNING) << buffer.data();
    }

    /// Prints error information into the standard error.
    ///
    /// @tparam Tag  The error info tag to retrieve the error value.
    ///
    /// @param[in] tag_string  The string for the tag type.
    /// @param[in] err  The error.
    template<class Tag>
    void PrintErrorInfo(const char *tag_string, const scram::Error &err) {
        if (const auto *value = boost::get_error_info<Tag>(err))
            std::cerr << tag_string << ": " << *value << "\n";
    }

}// namespace SCRAMCLI
