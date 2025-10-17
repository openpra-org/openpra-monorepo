#pragma once

#include "mc/logger/csv.h"
#include "pdag.h"

#include <array>
#include <string>
#include <unordered_set>
#include <vector>
#include <algorithm>

namespace scram::log::pdag {

// Helper lambdas reused below -------------------------------------------------
namespace detail {
inline int count_unique(const std::unordered_set<int> &s) {
    int c = 0;
    for (const int idx : s) {
        if (idx > 0 || !s.contains(-idx)) ++c;
    }
    return c;
}
inline int count_negative(const std::unordered_set<int> &s) {
    return std::ranges::count_if(s, [](const int idx) { return idx < 0; });
}
inline int count_overlap(const std::unordered_set<int> &s) {
    int c = 0;
    for (const int idx : s) {
        if (idx < 0 && s.contains(-idx)) ++c;
    }
    return c;
}
} // namespace detail

// -----------------------------------------------------------------------------
//  csv_pairs – collect a rich set of PDAG statistics for CSV logging
// -----------------------------------------------------------------------------
inline std::vector<std::pair<std::string, std::string>>
csv_pairs(const core::Pdag &g) {
    using pair_t = std::pair<std::string, std::string>;
    using scram::log::csv_string;

    std::vector<pair_t> out;
    out.reserve(64);

    // ---------------------------------------------------------------------
    //  Basic identity / configuration flags
    // ---------------------------------------------------------------------
    out.emplace_back("pdag_root_index",           csv_string(g.root().index()));
    out.emplace_back("pdag_complement_graph",     csv_string(g.complement()));
    out.emplace_back("pdag_coherent_graph",       csv_string(g.coherent()));
    out.emplace_back("pdag_normalized_graph",     csv_string(g.normal()));

    // ---------------------------------------------------------------------
    //  Gather node-level information with one traversal
    // ---------------------------------------------------------------------
    std::unordered_set<int> gate_indices;
    std::unordered_set<int> var_indices;
    std::array<int, core::kNumConnectives> gate_type_counts{}; // zero-initialised
    int num_modules = 0;

    core::TraverseGates(g.root_ptr(), [&](const core::GatePtr &pg) {
        gate_indices.insert(pg->index());
        ++gate_type_counts[pg->type()];
        if (pg->module()) ++num_modules;

        // Record signed indices of all arguments so we can later derive
        // negated / overlap counts in the same way GraphLogger does.
        for (const auto &arg_g : pg->args<core::Gate>()) {
            gate_indices.insert(arg_g.first);
        }
        for (const auto &arg_v : pg->args<core::Variable>()) {
            var_indices.insert(arg_v.first);
        }
    });

    // Clear traversal marks so other algorithms see a pristine graph.
    const_cast<core::Pdag &>(g).Clear<core::Pdag::kGateMark>();

    // ---------------------------------------------------------------------
    //  Size & composition metrics
    // ---------------------------------------------------------------------
    out.emplace_back("pdag_num_gates_total",        csv_string(detail::count_unique(gate_indices)));
    out.emplace_back("pdag_num_modules",            csv_string(num_modules));
    out.emplace_back("pdag_num_gates_neg_indices",  csv_string(detail::count_negative(gate_indices)));
    out.emplace_back("pdag_num_gates_pos_and_neg",  csv_string(detail::count_overlap(gate_indices)));

    out.emplace_back("pdag_num_variables_total",        csv_string(detail::count_unique(var_indices)));
    out.emplace_back("pdag_num_variables_neg_indices",  csv_string(detail::count_negative(var_indices)));
    out.emplace_back("pdag_num_variables_pos_and_neg",  csv_string(detail::count_overlap(var_indices)));

    // Gate-type breakdown – use same labels as earlier suggestion.
    static const char *kTag[core::kNumConnectives] =
        {"and","or","atleast","xor","not","nand","nor","null"};
    for (int i = 0; i < core::kNumConnectives; ++i) {
        out.emplace_back(std::string("pdag_num_gates_") + kTag[i], csv_string(gate_type_counts[i]));
    }

    // ---------------------------------------------------------------------
    //  Constants & pass-through helpers
    // ---------------------------------------------------------------------
    out.emplace_back("pdag_num_constants", csv_string(g.constant()->parents().size()));
    out.emplace_back("pdag_has_constants", csv_string(g.HasConstants()));
    out.emplace_back("pdag_has_null_gates", csv_string(g.HasNullGates()));

    // ---------------------------------------------------------------------
    //  Fan-in statistics (another traversal but cheap)
    // ---------------------------------------------------------------------
    int max_fan_in = 0;
    long long total_fan_in = 0;
    int gate_count = 0;

    core::TraverseGates(g.root_ptr(), [&](const core::GatePtr &pg) {
        const int fan = static_cast<int>(pg->args().size());
        max_fan_in = std::max(max_fan_in, fan);
        total_fan_in += fan;
        ++gate_count;
    });
    const_cast<core::Pdag &>(g).Clear<core::Pdag::kGateMark>();

    const double avg_fan_in = gate_count ? static_cast<double>(total_fan_in) / gate_count : 0.0;
    out.emplace_back("pdag_max_gate_fan_in", csv_string(max_fan_in));
    out.emplace_back("pdag_avg_gate_fan_in", csv_string(avg_fan_in));

    // ---------------------------------------------------------------------
    //  Substitution & watched-gate info (optional)
    // ---------------------------------------------------------------------
    out.emplace_back("pdag_num_substitutions", csv_string(g.substitutions().size()));

    // watched gate indices are stored in static ptrs inside Pdag; guard null
    // int watched = 0;
    // if (const auto *idx_set = scram::core::Pdag::watched_indices_) {
    //     watched = static_cast<int>(idx_set->size());
    // }
    // out.emplace_back("pdag_watched_gate_count", csv_string(watched));

    return out;
}

} // namespace scram::log::pdag
