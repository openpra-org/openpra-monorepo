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
/// Helper facilities to get source file information.

#pragma once

#include <string_view>
#include <cstring>

/// Check if CMake provides required definitions.
#ifndef PROJECT_SOURCE_DIR
#error "The project source directory is not provided w/ CMake."
#endif

/// Helper function to extract relative path at compile time
constexpr const char* extract_filename(const char* path) {
  constexpr const char* source_dir = PROJECT_SOURCE_DIR;
  constexpr size_t source_dir_len = std::string_view(PROJECT_SOURCE_DIR).length();

  // Check if path starts with source directory
  if (std::string_view(path).length() > source_dir_len &&
      std::string_view(path).substr(0, source_dir_len) == source_dir) {
    // Skip source directory and potential path separator
    const char* result = path + source_dir_len;
    if (*result == '/' || *result == '\\') {
      result++;
    }
    return result;
  }
  return path;  // Return original path if it doesn't start with source dir
}

/// The current file path relative to the project source directory.
/// With CMake, the default __FILE__ is absolute.
#define FILE_REL_PATH extract_filename(__FILE__)
