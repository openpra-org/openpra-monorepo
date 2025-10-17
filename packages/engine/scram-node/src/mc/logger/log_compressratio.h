#pragma once
#include "mc/logger/csv.h"

#include <algorithm>
#include <array>
#include <string>
#include <vector>

namespace scram::log::compressratio {

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

    // Helper function to add compression factor
    auto add_compression_factor = [&kv](const std::string &name, double model_count, double pdag_count) {
        const double factor = (pdag_count > 0) ? (model_count / pdag_count) : 0.0;
        kv.emplace_back(name, log::csv_string(factor));
    };

    // Basic events / Variables compression
    const double model_basic_events = find_value("model_num_basic_events");
    const double pdag_variables = find_value("pdag_num_variables_total");
    add_compression_factor("compression_factor_basic_events", model_basic_events, pdag_variables);

    // House events / Constants compression
    const double model_house_events = find_value("model_num_house_events");
    const double pdag_constants = find_value("pdag_num_constants");
    add_compression_factor("compression_factor_house_events", model_house_events, pdag_constants);

    // Gates (aggregate) compression
    const double model_gates = find_value("model_num_gates");
    const double pdag_gates = find_value("pdag_num_gates_total");
    add_compression_factor("compression_factor_gates", model_gates, pdag_gates);

    // Gates by type compression
    const std::array<const char *, 8> gate_types = {"and", "or", "atleast", "xor", "not", "nand", "nor", "null"};
    for (const auto &type : gate_types) {
        double model_gate_type = find_value(std::string("model_num_gates_") + type);
        double pdag_gate_type = find_value(std::string("pdag_num_gates_") + type);
        add_compression_factor(std::string("compression_factor_gates_") + type, model_gate_type, pdag_gate_type);
    }

    // All nodes (aggregate) compression
    const double model_all_nodes = model_basic_events + model_house_events + model_gates;
    const double pdag_all_nodes = pdag_variables + pdag_constants + pdag_gates;
    add_compression_factor("compression_factor_all_nodes", model_all_nodes, pdag_all_nodes);

    return kv;
}
} // namespace scram::log::compressratio