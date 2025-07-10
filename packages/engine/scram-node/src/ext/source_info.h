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

/// Check if CMake provides required definitions.
#ifndef PROJECT_SOURCE_DIR
#error "The project source directory is not provided w/ CMake."
#endif

/// The current file path relative to the project source directory.
/// With CMake, the default __FILE__ is absolute.
#define FILE_REL_PATH                                                      \
  [] {                                                                     \
    static_assert(sizeof(__FILE__) > sizeof(PROJECT_SOURCE_DIR),           \
                  "The source file is not inside the project directory."); \
    return __FILE__ + sizeof(PROJECT_SOURCE_DIR);                          \
  }()
