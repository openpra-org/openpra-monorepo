#pragma once

#include "mc/logger/csv.h"
#include "mc/logger/log_sample_shaper.h"
#include "mc/queue/layer_manager.h"
#include "mc/event/node.h"
#include "pdag.h"

#include <string>
#include <vector>
#include <memory>

namespace scram::log::layers {

/**
 * Return a vector of (header,value) pairs suitable for CSV output that describe
 * the configuration of a `scram::mc::queue::layer_manager` instance.  The
 * function is modeled after `scram::log::sample_shaper::csv_pairs()` so that
 * it can be used seamlessly with the generic CSV helpers found in
 * `mc/logger/csv.h`.
 *
 * We purposely make this a free function (instead of a member) so that it can
 * be specialized for any layer-manager template instantiation while still
 * having direct access to the class’ private data via a `friend` declaration
 * inside `layer_manager`.
 */

template <typename bitpack_t_, typename prob_t_, typename size_t_>
inline std::vector<std::pair<std::string, std::string>>
csv_pairs(const mc::queue::layer_manager<bitpack_t_, prob_t_, size_t_> &lm) {
    using scram::log::csv_string;
    using pair_t = std::pair<std::string, std::string>;

    std::vector<pair_t> out;
    out.reserve(32);  // rough upper-bound – avoids reallocs.

    // ---------------------------------------------------------------------
    //  Basic structural information
    // ---------------------------------------------------------------------
    out.emplace_back("num_nodes",                  csv_string(lm.pdag_nodes_.size()));
    out.emplace_back("num_layers",                 csv_string(lm.pdag_nodes_by_layer_.size()));
    out.emplace_back("num_kernels",             csv_string(lm.queueables_.size()));

    const auto avg_kernels_per_layer = static_cast<double>(lm.queueables_.size())/static_cast<double>(lm.pdag_nodes_by_layer_.size());
    out.emplace_back("avg_kernels_per_layer",             csv_string(avg_kernels_per_layer));

    // Device-side resource blocks.
    out.emplace_back("device_basic_event_blocks",  csv_string(lm.device_basic_event_blocks_.size()));
    out.emplace_back("device_gate_blocks",         csv_string(lm.device_gate_blocks_.size()));
    out.emplace_back("device_atleast_gate_blocks", csv_string(lm.device_atleast_gate_blocks_.size()));
    out.emplace_back("device_tally_blocks",        csv_string(lm.device_tally_blocks_.size()));

    const auto all_blocks = lm.device_basic_event_blocks_.size() + lm.device_gate_blocks_.size() + lm.device_atleast_gate_blocks_.size() + lm.device_tally_blocks_.size();
    out.emplace_back("device_total_blocks",        csv_string(all_blocks));

    const auto avg_blocks_per_kernel = static_cast<double>(all_blocks)/static_cast<double>(lm.queueables_.size());
    out.emplace_back("avg_blocks_per_kernel",             csv_string(avg_kernels_per_layer));

    // Tally-related bookkeeping.
    out.emplace_back("tally_events_tracked",       csv_string(lm.allocated_tally_events_by_index_.size()));

    // ---------------------------------------------------------------------
    //  Detailed node composition – count variables vs. gates.
    // ---------------------------------------------------------------------
    std::size_t num_variables = 0;
    std::size_t num_gates     = 0;

    for (const auto &node_ptr : lm.pdag_nodes_) {
        if (std::dynamic_pointer_cast<scram::core::Variable>(node_ptr)) {
            ++num_variables;
        } else if (std::dynamic_pointer_cast<scram::core::Gate>(node_ptr)) {
            ++num_gates;
        }
    }
    out.emplace_back("num_variables", csv_string(num_variables));
    out.emplace_back("num_gates",     csv_string(num_gates));

    // ---------------------------------------------------------------------
    //  Flatten the associated sample-shaper statistics (prefixed with "shaper_").
    // ---------------------------------------------------------------------
    const auto shaper_pairs = scram::log::sample_shaper::csv_pairs(lm.sample_shaper_);
    for (const auto &p : shaper_pairs) {
        out.emplace_back("shaper_" + p.first, p.second);
    }

    return out;
}

} // namespace scram::log::layers