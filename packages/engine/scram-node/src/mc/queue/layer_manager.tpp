/*
 * Copyright (C) 2025 Arjun Earthperson
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#pragma once

#include <algorithm>
#include <stdexcept>

#include "logger.h"
#include "preprocessor.h"

#include "mc/queue/layer_manager.h"
#include "mc/event/node.h"
#include "mc/stats/ci_utils.h"
#include "mc/queue/kernel_builder.h"

namespace scram::mc::queue {

template <typename bitpack_t_, typename prob_t_, typename size_t_>
void layer_manager<bitpack_t_, prob_t_, size_t_>::gather_all_nodes(
    const std::shared_ptr<core::Gate> &gate, std::vector<std::shared_ptr<core::Node>> &nodes,
    std::unordered_map<std::int32_t, std::shared_ptr<core::Node>> &nodes_by_index) {
    if (gate->Visited())
        return;
    gate->Visit(1);
    nodes.push_back(gate);
    if (nodes_by_index.contains(gate->index())) {
        LOG(ERROR) << "Found gate with duplicate index while gathering all nodes";
        throw std::runtime_error("gather all nodes failed");
    }
    nodes_by_index[gate->index()] = gate;
    for (const auto &arg : gate->args<core::Gate>()) {
        gather_all_nodes(arg.second, nodes, nodes_by_index);
    }
    for (const auto &arg : gate->args<core::Variable>()) {
        if (!arg.second->Visited()) {
            arg.second->Visit(1);
            nodes.push_back(arg.second);
            if (nodes_by_index.contains(arg.second->index())) {
                LOG(ERROR) << "Found basic event with duplicate index while gathering all nodes";
                throw std::runtime_error("gather all nodes failed");
            }
            nodes_by_index[arg.second->index()] = arg.second;
        }
    }
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
void layer_manager<bitpack_t_, prob_t_, size_t_>::layered_toposort(
    core::Pdag *pdag,
    std::vector<std::shared_ptr<core::Node>> &nodes,
    std::unordered_map<index_t_, std::shared_ptr<core::Node>> &nodes_by_index,
    std::vector<std::vector<std::shared_ptr<core::Node>>> &nodes_by_layer) {
    // Ensure the graph has been topologically sorted, by layer/level
    core::pdag::LayeredTopologicalOrder(pdag);
    // TODO:: Add preprocessing rule for normalizing gates by input count

    // Clear visits for the gathering process
    pdag->Clear<core::Pdag::kVisit>();

    // Collect all nodes
    gather_all_nodes(pdag->root_ptr(), nodes, nodes_by_index);

    // Sort nodes by their order
    std::sort(nodes.begin(), nodes.end(),
              [](const std::shared_ptr<core::Node> &a, const std::shared_ptr<core::Node> &b) {
                  return a->order() < b->order();
              });

    size_t max_layer = nodes.back()->order(); // Since nodes are sorted
    nodes_by_layer.resize(max_layer + 1);

    for (auto &node : nodes) {
        nodes_by_layer[node->order()].push_back(node);
    }

    // For each layer, sort so that variables precede gates, and gates are sorted by their Gate::type()
    for (auto &layer : nodes_by_layer) {
        std::sort(layer.begin(), layer.end(),
                  [](const std::shared_ptr<core::Node> &lhs, const std::shared_ptr<core::Node> &rhs) {
                      // Try casting to Variable
                      auto varL = std::dynamic_pointer_cast<core::Variable>(lhs);
                      auto varR = std::dynamic_pointer_cast<core::Variable>(rhs);

                      // If one is a variable and the other is not, variable goes first
                      if (varL && !varR)
                          return true;
                      if (!varL && varR)
                          return false;

                      // If both are variables, treat them as equivalent in this ordering
                      // (no further ordering required among variables)
                      if (varL && varR)
                          return false;

                      // Otherwise, both must be gates. Compare by gate->type()
                      auto gateL = std::dynamic_pointer_cast<core::Gate>(lhs);
                      auto gateR = std::dynamic_pointer_cast<core::Gate>(rhs);
                      return gateL->type() < gateR->type();
                  });
    }
    LOG(DEBUG5) << "num_nodes: " << nodes.size();
    LOG(DEBUG5) << "num_layers: " << nodes_by_layer.size();
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
void layer_manager<bitpack_t_, prob_t_, size_t_>::gather_layer_nodes(
    const std::vector<std::shared_ptr<core::Node>> &layer_nodes,
    std::vector<std::shared_ptr<core::Variable>> &out_variables,
    std::unordered_map<core::Connective, std::vector<std::shared_ptr<core::Gate>>> &out_gates_by_type) {
    out_variables.clear();
    out_gates_by_type.clear();

    for (auto &node : layer_nodes) {
        // If the node is a Variable, store it
        if (auto var = std::dynamic_pointer_cast<core::Variable>(node)) {
            out_variables.push_back(var);
        }
        // Else if the node is a Gate, group it by Connective type
        else if (auto gate = std::dynamic_pointer_cast<core::Gate>(node)) {
            out_gates_by_type[gate->type()].push_back(gate);
        } else {
            LOG(WARNING) << "gather_layer_nodes: Node " << node->index() << " was neither a Variable nor a Gate.";
        }
    }
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
void layer_manager<bitpack_t_, prob_t_, size_t_>::build_kernels_for_layer(
    const std::vector<std::shared_ptr<core::Node>> &layer_nodes) {
    // Step (1): Partition layer_nodes into Variables and gates_by_type
    std::vector<std::shared_ptr<core::Variable>> variables;
    std::unordered_map<core::Connective, std::vector<std::shared_ptr<core::Gate>>> gates_by_type;
    gather_layer_nodes(layer_nodes, variables, gates_by_type);

    // Step (2): Build a single kernel for all variables in this layer (if any)
    auto be_kernel = build_kernel_for_variables<index_t_, prob_t_, bitpack_t_, size_t_>(
        variables, queue_, sample_shape_, queueables_, queueables_by_index_, allocated_basic_events_by_index_, device_basic_event_blocks_);
    // We could store or log “be_kernel” if we want direct reference, or just rely
    // on the global queueables_ list.

    // Step (3): Build one kernel per gate->type() in this layer
    auto gate_kernels = build_kernels_for_gates<index_t_, prob_t_, bitpack_t_, size_t_>(
        gates_by_type, queue_, sample_shape_, queueables_, queueables_by_index_, allocated_basic_events_by_index_,
        allocated_gates_by_index_, device_gate_blocks_, device_atleast_gate_blocks_);

    // Optionally do something with (be_kernel) and the (gate_kernels) vector.
    // The queueables_ container is updated in each subfunction, so
    // they are already “registered” for execution.
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
void layer_manager<bitpack_t_, prob_t_, size_t_>::map_nodes_by_layer(
    const std::vector<std::vector<std::shared_ptr<core::Node>>> &nodes_by_layer) {
    for (const auto &nodes_in_layer : nodes_by_layer) {
        // build kernels for nodes in this layer
        build_kernels_for_layer(nodes_in_layer);
    }
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
event::tally<bitpack_t_> layer_manager<bitpack_t_, prob_t_, size_t_>::fetch_tally_for_event_with_index(const index_t_ evt_idx) {
    event::tally<bitpack_t_> to_tally;
    if (!allocated_tally_events_by_index_.contains(evt_idx)) {
        LOG(ERROR) << "Unable to fetch tally for unknown event with index " << evt_idx;
        return std::move(to_tally);
    }
    const event::tally<bitpack_t_> *computed_tally = allocated_tally_events_by_index_[evt_idx];
    to_tally.num_one_bits = computed_tally->num_one_bits;
    to_tally.total_bits = computed_tally->total_bits;
    // ---------------------------------------------------------------------
    //  Host-side statistical post-processing
    // ---------------------------------------------------------------------
    // The Monte-Carlo kernel only updates `num_one_bits` and `total_bits`.
    // We complete the statistics on the host so that the device kernel does
    // no redundant work (especially when several work-groups process the
    // same tally).
    stats::populate_point_estimates(to_tally);
    return std::move(to_tally);
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
std::size_t layer_manager<bitpack_t_, prob_t_, size_t_>::node_count() const {
    const auto num_nodes = pdag_nodes_.size();
    return num_nodes;
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
[[gnu::always_inline]] sycl::queue layer_manager<bitpack_t_, prob_t_, size_t_>::single_pass() {
    for (const auto &queueable : queueables_) {
        queueable->submit();
    }
    return queue_;
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
sycl::queue layer_manager<bitpack_t_, prob_t_, size_t_>::pass(const size_t count) {
    for (size_t i = 0; i < count; i++) {
        single_pass();
    }
    return queue_;
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
event::tally<bitpack_t_> layer_manager<bitpack_t_, prob_t_, size_t_>::single_pass_and_tally(const index_t_ evt_idx) {
    single_pass().wait_and_throw();
    const event::tally<bitpack_t_> computed_tally = fetch_tally_for_event_with_index(evt_idx);
    return computed_tally;
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
stats::TallyNodeMap &layer_manager<bitpack_t_, prob_t_, size_t_>::pass_wait_collect(
        stats::TallyNodeMap &stats,
        const std::size_t total_passes,
        const std::size_t passes_between_waits) {
    /*
     * The purpose of this routine is to
     *  1. enqueue `total_passes` Monte-Carlo passes, potentially amounting to
     *     hundreds of thousands of kernel launches (10k+ queueables per pass!),
     *  2. periodically wait for the device to drain the queue so that we do not
     *     accumulate an unbounded number of in-flight kernels / SYCL events, and
     *  3. finally aggregate the resulting tallies on the host.
     *
     *  `passes_between_waits` controls the waiting cadence:
     *      – 0   : never wait in-between; we only wait once at the end.
     *      – n>0 : wait after every *n* passes (or sooner if less than *n*
     *              passes remain).
     */

    if (total_passes == 0) {
        throw std::invalid_argument("pass_wait_collect: total_passes must be greater than 0");
    }

    // A value of 0 means "wait only after the final batch".
    const auto interval = passes_between_waits == 0 ? total_passes : passes_between_waits;

    auto passes_remaining = total_passes;
    while (passes_remaining > 0) {
        const auto batch_size = std::min(interval, passes_remaining);

        // Enqueue `batch_size` passes without blocking.
        auto queue = pass(batch_size);

        // Flush the device so we do not let the queue grow without bound.
        queue.wait_and_throw();

        passes_remaining -= batch_size;
    }

    // Once all passes have completed on the device we can safely harvest the
    // tallies and fold them into the caller-supplied statistics map.
    return collect_tallies(stats);
}


template <typename bitpack_t_, typename prob_t_, typename size_t_>
stats::TallyNodeMap &layer_manager<bitpack_t_, prob_t_, size_t_>::collect_tallies(stats::TallyNodeMap &stats) {
    for (auto &pair : allocated_tally_events_by_index_) {
        const auto &idx = pair.first;
        const auto *tally_on_device = allocated_tally_events_by_index_[idx];
        mc::stats::tally &tally = stats[idx].tally_stats;
        tally.update(tally_on_device);
    }
    return stats;
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
layer_manager<bitpack_t_, prob_t_, size_t_>::~layer_manager() {

    // Free allocated basic events
    for (auto &block : device_basic_event_blocks_) {
        event::destroy_basic_event_block(queue_, block);
    }

    // Free allocated gates
    for (auto &block : device_gate_blocks_) {
        event::destroy_gate_block(queue_, block);
    }

    for (auto &block : device_atleast_gate_blocks_) {
        event::destroy_atleast_gate_block(queue_, block);
    }

    for (auto &block : device_tally_blocks_) {
        event::destroy_tally_block(queue_, block);
    }
}

// ------------------------------------------------------------
//  layer_manager :: get_mef_event
// ------------------------------------------------------------

/*!
 * Resolve the underlying MEF event (currently BasicEvent) for a given PDAG
 * node index.  The function supports only Variable nodes because Gate nodes
 * produced by the PDAG do not maintain a one-to-one mapping back to their
 * origin in the MEF fault-tree representation.
 */

template <typename bitpack_t_, typename prob_t_, typename size_t_>
const scram::mef::Event *scram::mc::queue::layer_manager<bitpack_t_, prob_t_, size_t_>::get_mef_event(index_t_ event_id) const {
    // Quick lookup of the core::Node pointer.
    auto it = pdag_nodes_by_index_.find(event_id);
    if (it == pdag_nodes_by_index_.end() || !(it->second)) {
        throw std::runtime_error("layer_manager::get_mef_event – unknown event_id " + std::to_string(event_id));
    }

    const std::shared_ptr<core::Node> &node_ptr = it->second;

    // Currently only Variable nodes carry a mapping back to MEF::BasicEvent.
    if (auto var = std::dynamic_pointer_cast<core::Variable>(node_ptr)) {
        // Variables are indexed starting from core::Pdag::kVariableStartIndex.
        const int adjusted_index = var->index() - core::Pdag::kVariableStartIndex;
        if (adjusted_index < 0) {
            throw std::runtime_error("layer_manager::get_mef_event – invalid variable index computation for event_id " + std::to_string(event_id));
        }

        // Access the index map that lives in the owning PDAG instance.
        const auto &basic_event_map = var->graph().basic_events();
        if (adjusted_index < 0 || static_cast<std::size_t>(adjusted_index) >= basic_event_map.size()) {
            throw std::runtime_error("layer_manager::get_mef_event – BasicEvent not found for variable index " + std::to_string(event_id));
        }
        return basic_event_map.at(adjusted_index);
    }

    // Unsupported node type – provide a clear diagnostic.
    throw std::runtime_error("layer_manager::get_mef_event – resolution for non-variable nodes (gates / constants) is not implemented");
}

template <typename bitpack_t_, typename prob_t_, typename size_t_>
layer_manager<bitpack_t_, prob_t_, size_t_>::layer_manager(core::Pdag *pdag, const size_t_ num_trials, const stats::TallyNodeMap &to_tally, const std::double_t overhead_ratio) {
    // create and sort layers
    layered_toposort(pdag, pdag_nodes_, pdag_nodes_by_index_, pdag_nodes_by_layer_);
    sample_shaper_ = sample_shaper<bitpack_t_>(queue_, num_trials, node_count(), overhead_ratio);
    sample_shape_ = sample_shaper_.SAMPLE_SHAPE;

    // create kernels for all basic-events, gates.
    map_nodes_by_layer(pdag_nodes_by_layer_);

    std::vector<std::shared_ptr<core::Node>> nodes_to_tally(to_tally.size());
    auto i = 0;
    for (const std::pair<int, stats::TallyNode> entry : to_tally) {
        const stats::TallyNode &tally_node = entry.second;
        const std::shared_ptr<core::Node> &node = tally_node.node;
        nodes_to_tally[i++] = node;
    }

    // now, add the tally nodes to the final layer, which is one large tally block.
    build_tallies_for_layer<index_t_, prob_t_, bitpack_t_, size_t_>(nodes_to_tally,
        queue_,
        sample_shape_,
        queueables_,
        queueables_by_index_,
        allocated_basic_events_by_index_,
        allocated_gates_by_index_,
        allocated_tally_events_by_index_,
        device_tally_blocks_);

    // Log sample_shaper configuration
    LOG(DEBUG2) << sample_shaper_;
}

} // namespace scram::mc::queue