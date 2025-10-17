#pragma once
#include "mc/logger/csv.h"

#include <algorithm>
#include <array>
#include <string>
#include <vector>

namespace scram::log::convergence {

inline std::vector<std::pair<std::string, std::string>>
csv_pairs(std::vector<std::pair<std::string, std::string>> &kv) {
    // compression factors
    // Helper function to find value in kv pairs
    auto find_value = [&kv](const std::string &key) -> double {
        auto it = std::find_if(kv.begin(), kv.end(), [&key](const auto &pair) { return pair.first == key; });
        if (it != kv.end()) {
            try {
                return std::stod(it->second);
            } catch (...) {
                return 0.0;
            }
        }
        return 0.0;
    };

    const double bits_per_iteration = find_value("shaper_bits_per_iteration");
    const double total_bits = find_value("total_bits");
    const double total_time = find_value("convergence_time_ms");


    kv.emplace_back("bits_per_iteration", log::csv_string(bits_per_iteration));

    const double total_iterations = total_bits / bits_per_iteration;
    kv.emplace_back("total_iterations", log::csv_string(total_iterations));

    const double iterations_per_second = (total_iterations / total_time) * 1000.0;
    kv.emplace_back("iterations_per_second", log::csv_string(iterations_per_second));

    const double bits_per_second = total_bits / total_time;
    kv.emplace_back("bits_per_second", log::csv_string(bits_per_second));

    return kv;
}
} // namespace scram::log::compressratio