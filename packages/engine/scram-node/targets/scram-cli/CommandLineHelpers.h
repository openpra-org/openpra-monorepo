/**
* @file CommandLineHelpers.h
* @brief This file contains helper functions and data structures for the @link CommandLine.h header file.
*/

#pragma once

#include <iomanip>
#include <iostream>
#include <limits>
#include <sstream>
#include <string>

#include <boost/program_options.hpp>
#include <boost/accumulators/accumulators.hpp>
#include <boost/accumulators/statistics.hpp>

/**
* @brief This function replaces the value of a specified option in a map with a new value.
*
* @tparam T The type of the value to be replaced.
* @param vm A map containing program options and their values.
* @param opt The option whose value is to be replaced.
* @param val The new value to replace the old value with.
*
* @note This function uses the boost library's any class to allow for type erasure,
* meaning the function can accept any type for the new value.
*/
template <class T>
void replace(std::map<std::string, boost::program_options::variable_value> &vm, const std::string &opt, const T &val) {
   vm[opt].value() = boost::any(val);
}

/**
* @brief Checks if a container contains a specific value.
*
* @details This function uses the std::find algorithm to check if a specific value is present in a container.
*
* @tparam Container The type of the container. It should support begin() and end() methods.
* @param container The container in which to search for the value.
* @param value The value to search for in the container.
*
* @return True if the value is found in the container, false otherwise.
*/
template <typename Container>
bool contains(const Container& container, const typename Container::value_type& value) {
   return std::find(container.begin(), container.end(), value) != container.end();
}
