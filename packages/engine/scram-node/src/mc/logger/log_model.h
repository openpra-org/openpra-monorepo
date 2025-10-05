#pragma once

#include "mc/logger/csv.h"
#include "model.h"

#include <string>
#include <vector>
#include <utility>

#include <algorithm>

namespace scram::log::model {

inline std::vector<std::pair<std::string, std::string>>
csv_pairs(const mef::Model &m) {
    using pair_t = std::pair<std::string, std::string>;
    using scram::log::csv_string;

    std::vector<pair_t> out;
    out.reserve(48);

    // ---------------------------------------------------------------------
    //  Identity / metadata
    // ---------------------------------------------------------------------
    out.emplace_back("model_name", csv_string(m.GetOptionalName()));
    out.emplace_back("model_has_default_name", csv_string(m.HasDefaultName()));

    // mission time
    // const double mt_val = m.mission_time().value();
    // const auto mt_unit = mef::kUnitsToString[m.mission_time().unit()];
    // out.emplace_back("model_mission_time", csv_string(mt_val));
    // out.emplace_back("model_mission_time_unit", csv_string(mt_unit));

    // ---------------------------------------------------------------------
    //  Size metrics for top-level MEF constructs
    // ---------------------------------------------------------------------
    out.emplace_back("model_num_fault_trees",      csv_string(std::distance(m.fault_trees().begin(), m.fault_trees().end())));
    out.emplace_back("model_num_event_trees",      csv_string(std::distance(m.event_trees().begin(), m.event_trees().end())));
    out.emplace_back("model_num_alignments",       csv_string(std::distance(m.alignments().begin(), m.alignments().end())));
    out.emplace_back("model_num_rules",            csv_string(std::distance(m.rules().begin(), m.rules().end())));
    out.emplace_back("model_num_sequences",        csv_string(std::distance(m.sequences().begin(), m.sequences().end())));

    out.emplace_back("model_num_parameters",       csv_string(std::distance(m.parameters().begin(), m.parameters().end())));
    out.emplace_back("model_num_substitutions",    csv_string(std::distance(m.substitutions().begin(), m.substitutions().end())));

    // Event counts
    const auto num_basic_events  = std::distance(m.basic_events().begin(),  m.basic_events().end());
    const auto num_house_events  = std::distance(m.house_events().begin(),  m.house_events().end());
    const auto num_gates         = std::distance(m.gates().begin(),         m.gates().end());
    out.emplace_back("model_num_basic_events",  csv_string(num_basic_events));
    out.emplace_back("model_num_house_events",  csv_string(num_house_events));
    out.emplace_back("model_num_gates",         csv_string(num_gates));

    // CCF groups, libraries, extern funcs
    out.emplace_back("model_num_ccf_groups",     csv_string(std::distance(m.ccf_groups().begin(), m.ccf_groups().end())));
    // out.emplace_back("model_num_libraries",      csv_string(std::distance(m.libraries().begin(), m.libraries().end())));
    // out.emplace_back("model_num_extern_funcs",   csv_string(std::distance(m.extern_functions().begin(), m.extern_functions().end())));

    // Total expressions & instructions (private containers)
    // out.emplace_back("model_num_expressions",    csv_string(m.expressions().size()));
    // out.emplace_back("model_num_instructions",   csv_string(m.instructions().size()));

    // Gate type breakdown
    std::array<int, 8> gate_type_counts{}; // zero-initialized for and, or, atleast, xor, not, nand, nor, null
    for (const auto& gate : m.gates()) {
        if (gate.HasFormula()) {
            const auto connective = gate.formula().connective();
            if (connective >= mef::kAnd && connective <= mef::kNull) {
                ++gate_type_counts[static_cast<int>(connective)];
            }
        }
    }
    
    // Add gate type counts to output
    static const char *kGateTypes[8] = {"and","or","atleast","xor","not","nand","nor","null"};
    for (int i = 0; i < 8; ++i) {
        out.emplace_back(std::string("model_num_gates_") + kGateTypes[i], csv_string(gate_type_counts[i]));
    }

    return out;
}

} // namespace scram::log::model
