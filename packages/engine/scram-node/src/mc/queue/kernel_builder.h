/**
 * @file kernel_builder.h
 * @brief SYCL kernel factory functions for parallel pdag computation
 * @author Arjun Earthperson
 * @date 2025
 * 
 * @details This file provides a comprehensive set of factory functions for constructing
 * optimized SYCL kernels for parallel pdag computations. The kernel
 * builders create and configure specialized kernels for different types of computations:
 * basic events (random sampling), gate operations (logical operations), and tally
 * computations (statistical analysis).
 * 
 * The implementation follows a layered approach where kernels are built for each
 * layer of the computation graph, enabling efficient parallel execution with proper
 * dependency management. Each kernel type is optimized for specific computational
 * patterns and memory access requirements.
 * 
 * **Core Design Principles:**
 * - Template-based compile-time optimization for different data types
 * - Unified memory management for optimal host-device data transfer
 * - Dependency-aware kernel scheduling for correct execution order
 * - Scalable architecture supporting thousands of parallel computation units
 * - Memory-efficient bit-packed data representations
 * 
 * **Kernel Types Supported:**
 * - **Basic Event Kernels**: Parallel random sampling using Philox PRNG
 * - **Gate Operation Kernels**: Logical operations (AND, OR, XOR, NOT, NAND, NOR, ATLEAST)
 * - **Tally Kernels**: Statistical computation with confidence intervals
 * 
 * **Memory Management Strategy:**
 * - Contiguous memory allocation for optimal cache performance
 * - Unified shared memory for seamless host-device access
 * - Reference counting and automatic cleanup for memory safety
 * - Optimized buffer layouts for different kernel types
 * 
 * **Performance Optimization Features:**
 * - Work-group size optimization for target device architectures
 * - Memory coalescing for efficient GPU memory access
 * - Compile-time specialization for different operation types
 * - Dependency-based scheduling to minimize synchronization overhead
 * 
 * @note All functions assume SYCL unified shared memory availability
 * @note Template parameters should be consistent across all kernel types
 * @note Memory management follows RAII principles with automatic cleanup
 * 
 * @copyright Copyright (C) 2025 Arjun Earthperson
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

#include "mc/event/node.h"
#include "working_set.h"

#include "mc/kernel/basic_event.h"
#include "mc/kernel/gate.h"
#include "mc/kernel/tally.h"

#include "mc/queue/queueable.h"

#include "logger.h"
#include "pdag.h"

#include <sycl/sycl.hpp>
#include <stdexcept>

namespace scram::mc::queue {

    /**
     * @brief Builds a SYCL kernel for parallel basic event sampling
     * 
     * @details Creates an optimized SYCL kernel for parallel random sampling of basic events
     * using the Philox pseudorandom number generator. The function allocates device memory
     * for basic event structures, initializes them with probability and index data, and
     * creates a queueable kernel partition ready for execution.
     * 
     * **Algorithm Overview:**
     * 1. **Parameter Extraction**: Extracts indices and probabilities from Variable objects
     * 2. **Memory Allocation**: Creates contiguous device memory for basic event structures
     * 3. **Kernel Creation**: Instantiates specialized basic event kernel with optimal configuration
     * 4. **Work-Group Sizing**: Computes optimal 3D work-group dimensions for target device
     * 5. **Queueable Packaging**: Wraps kernel in queueable object with dependency management
     * 6. **Index Registration**: Updates global maps for efficient lookup and dependency tracking
     * 
     * **Memory Layout Optimization:**
     * - Contiguous allocation reduces memory fragmentation
     * - Aligned memory access patterns optimize cache performance
     * - Unified shared memory enables efficient host-device data transfer
     * - Per-event buffer allocation supports parallel processing
     * 
     * **Performance Characteristics:**
     * - Linear scaling with number of basic events
     * - Optimal work-group sizes computed dynamically
     * - Minimal synchronization overhead through independent event processing
     * - Memory bandwidth optimization through bit-packed representations
     * 
     * @tparam index_t_ Signed integer type for node indexing
     * @tparam prob_t_ Floating-point type for probability calculations
     * @tparam bitpack_t_ Integer type for bit-packed result storage
     * @tparam size_t_ Integer type for size and indexing operations
     * 
     * @param variables_ Vector of Variable objects containing basic event definitions
     * @param queue_ SYCL queue for kernel execution and memory management
     * @param sample_shape_ Configuration defining batch size and bit-packing dimensions
     * @param queueables_ [in,out] Vector to store the created queueable kernel
     * @param queueables_by_index_ [in,out] Map from node index to queueable for dependency tracking
     * @param allocated_basic_events_by_index_ [in,out] Map from node index to allocated basic event structures
     *
     * @return Shared pointer to the created queueable kernel, or nullptr if no variables provided
     * 
     * @throws std::bad_alloc if device memory allocation fails
     * @throws std::runtime_error if Variable objects contain invalid data
     * 
     * @note The function handles PDAG index mapping (subtracts 2 for internal indexing)
     * @note All allocated memory is managed automatically by the queueable object
     * @note Basic event probabilities are validated to be in range [0.0, 1.0]
     * 
     * @example Basic usage:
     * @code
     * std::vector<std::shared_ptr<core::Variable>> variables = {var1, var2, var3};
     * sample_shape<uint32_t> shape{1024, 16};
     * 
     * auto kernel = build_kernel_for_variables<int32_t, double, uint64_t, uint32_t>(
     *     variables, queue, shape, queueables, queueables_by_index, allocated_basic_events
     * );
     * 
     * if (kernel) {
     *     // Kernel is ready for execution
     *     kernel->submit();
     * }
     * @endcode
     * 
     * @example Advanced configuration:
     * @code
     * // Create kernel with custom work-group sizing
     * auto kernel = build_kernel_for_variables<int32_t, float, uint32_t, uint16_t>(
     *     variables, queue, shape, queueables, queueables_by_index, allocated_basic_events
     * );
     * 
     * // Access individual basic events for inspection
     * for (const auto& [index, event] : allocated_basic_events_by_index) {
     *     std::cout << "Event " << index << " probability: " << event->probability << std::endl;
     * }
     * @endcode
     */
    template<typename index_t_, typename prob_t_, typename bitpack_t_, typename size_t_>
    static std::shared_ptr<queueable_base> build_kernel_for_variables(
        const std::vector<std::shared_ptr<core::Variable>> &variables_,
        sycl::queue &queue_,
        const event::sample_shape<size_t_> &sample_shape_,
        std::vector<std::shared_ptr<queueable_base>> &queueables_,
        std::unordered_map<index_t_, std::shared_ptr<queueable_base>> &queueables_by_index_,
        std::unordered_map<index_t_, event::basic_event<prob_t_, bitpack_t_>*> &allocated_basic_events_by_index_,
        std::vector<event::basic_event_block<prob_t_, bitpack_t_, index_t_>> &device_basic_event_blocks_) {

        if (variables_.empty()) {
            return nullptr;
        }

        // 1) Gather each Variable's index and probability from the BasicEvent data
        std::vector<std::pair<index_t_, prob_t_>> indexed_probabilities;
        indexed_probabilities.reserve(variables_.size());

        for (const auto& variable : variables_) {
            const auto var_unique_index = variable->index();
            const auto var_unique_index_in_pdag_index_map = var_unique_index - 2;

            // Retrieve the mef::BasicEvent for this variable
            const core::Pdag::IndexMap<const mef::BasicEvent*>& events = variable->graph().basic_events();
            const mef::BasicEvent* event = events.at(var_unique_index_in_pdag_index_map);
            const double p = event->expression().value();

            indexed_probabilities.push_back(std::pair<index_t_, prob_t_>{var_unique_index, static_cast<prob_t_>(p)});
        }

        if (indexed_probabilities.empty()) {
            return nullptr;
        }

        const auto num_events_in_kernel = indexed_probabilities.size();

        // 2) Create a contiguous block of basic_events
        using block_type = event::basic_event_block<prob_t_, bitpack_t_>;
        block_type event_block = event::create_basic_event_block<prob_t_, bitpack_t_>(queue_, indexed_probabilities, sample_shape_.num_bitpacks());

        // 3) Build the basic_event kernel using the block wrapper
        using kernel_type = kernel::basic_event<prob_t_, bitpack_t_, size_t_>;
        kernel_type be_kernel(event_block, sample_shape_);

        // 4) Compute the ND-range and create a queueable partition
        const auto local_range = working_set<size_t_, bitpack_t_>(queue_, num_events_in_kernel, sample_shape_).compute_optimal_local_range_3d();
        const auto nd_range = be_kernel.get_range(num_events_in_kernel, local_range, sample_shape_);
        iterable_queueable<kernel_type, 3> be_partition(queue_, be_kernel, nd_range);
        auto queueable_partition = std::make_shared<decltype(be_partition)>(be_partition);

        // 5) Update allocated objects and queueables in the global maps
        for (auto i = 0; i < num_events_in_kernel; ++i) {
            const auto event_index_in_pdag = indexed_probabilities[i].first;
            // allocated_basic_events_by_index_[event_index_in_pdag] = event_block.data + i;
            allocated_basic_events_by_index_[event_index_in_pdag] = &event_block[i];
            queueables_by_index_[event_index_in_pdag] = queueable_partition;
        }

        // 6) Store the basic events block for dealloc
        device_basic_event_blocks_.push_back(event_block);

        // 7) Enqueue for computation
        queueables_.push_back(queueable_partition);
        return queueable_partition;
    }

    /**
     * @brief Builds a SYCL kernel for gates of a specific logical operation type
     * 
     * @details Creates a specialized SYCL kernel for parallel execution of logical gate
     * operations of a single type (AND, OR, XOR, etc.). The function uses template
     * specialization to generate optimized code for each gate type, eliminating runtime
     * branching and maximizing GPU throughput.
     * 
     * **Algorithm Overview:**
     * 1. **Input Validation**: Checks for empty gate list and returns early if needed
     * 2. **Dependency Resolution**: Resolves input dependencies from basic events and other gates
     * 3. **Input Organization**: Separates positive and negated inputs for efficient processing
     * 4. **Memory Allocation**: Allocates device memory for gate structures with optimal layout
     * 5. **Kernel Specialization**: Creates type-specific kernel using template specialization
     * 6. **Work-Group Optimization**: Computes optimal work-group dimensions for the operation type
     * 7. **Dependency Tracking**: Establishes dependency relationships for correct execution order
     * 8. **Registration**: Updates global maps for efficient lookup and scheduling
     * 
     * **Input Processing Strategy:**
     * - Positive inputs: indices [0, negated_inputs_offset)
     * - Negated inputs: indices [negated_inputs_offset, num_inputs)
     * - Dependency collection ensures proper execution ordering
     * - Buffer pointer management enables direct device memory access
     *
     * @tparam gate_type_ Compile-time constant specifying the logical operation type
     * @tparam index_t_ Signed integer type for node indexing
     * @tparam prob_t_ Floating-point type for probability calculations
     * @tparam bitpack_t_ Integer type for bit-packed result storage
     * @tparam size_t_ Integer type for size and indexing operations
     * 
     * @param gates_ Vector of Gate objects of the specified type
     * @param queue_ SYCL queue for kernel execution and memory management
     * @param sample_shape_ Configuration defining batch size and bit-packing dimensions
     * @param queueables_ [in,out] Vector to store the created queueable kernel
     * @param queueables_by_index_ [in,out] Map from node index to queueable for dependency tracking
     * @param allocated_basic_events_by_index_ [in] Map from node index to basic event structures
     * @param allocated_gates_by_index_ [in,out] Map from node index to allocated gate structures
     * 
     * @return Shared pointer to the created queueable kernel, or nullptr if no gates provided
     * 
     * @throws std::runtime_error if unknown input dependencies are encountered
     * @throws std::bad_alloc if device memory allocation fails
     * @throws std::logic_error if gate configuration is invalid
     * 
     * @note The function handles both Variable and Gate inputs through dependency resolution
     * @note At-least gates receive special treatment with additional threshold parameter
     * @note Dependency relationships are automatically established for correct execution order
     * 
     * @example AND gate kernel creation:
     * @code
     * std::vector<std::shared_ptr<core::Gate>> and_gates = {gate1, gate2};
     * 
     * auto kernel = build_kernel_for_gates_of_type<core::Connective::kAnd, int32_t, double, uint64_t, uint32_t>(
     *     and_gates, queue, shape, queueables, queueables_by_index, 
     *     allocated_basic_events, allocated_gates
     * );
     * 
     * if (kernel) {
     *     // Kernel includes dependency management
     *     kernel->submit();  // Will wait for input dependencies
     * }
     * @endcode
     * 
     * @example At-least gate with mixed inputs:
     * @code
     * // Gate with positive and negated inputs
     * std::vector<std::shared_ptr<core::Gate>> atleast_gates = {gate_2_of_4};
     * 
     * auto kernel = build_kernel_for_gates_of_type<core::Connective::kAtleast, int32_t, double, uint64_t, uint32_t>(
     *     atleast_gates, queue, shape, queueables, queueables_by_index,
     *     allocated_basic_events, allocated_gates
     * );
     * 
     * // Kernel automatically handles threshold logic and mixed positive/negative inputs
     * @endcode
     */
    template<const core::Connective gate_type_, typename index_t_, typename prob_t_, typename bitpack_t_, typename size_t_>
    static std::shared_ptr<queueable_base> build_kernel_for_gates_of_type(
        const std::vector<std::shared_ptr<core::Gate>> &gates_,
        sycl::queue &queue_,
        const event::sample_shape<size_t_> &sample_shape_,
        std::vector<std::shared_ptr<queueable_base>> &queueables_,
        std::unordered_map<index_t_, std::shared_ptr<queueable_base>> &queueables_by_index_,
        const std::unordered_map<index_t_, event::basic_event<prob_t_, bitpack_t_>*> &allocated_basic_events_by_index_,
        std::unordered_map<index_t_, event::gate<bitpack_t_, size_t_>*> &allocated_gates_by_index_,
        std::vector<event::gate_block<bitpack_t_, size_t_>> &device_gate_blocks_,
        std::vector<event::atleast_gate_block<bitpack_t_, size_t_>> &device_atleast_gate_blocks_) {

        if (gates_.empty()) {
            return nullptr;
        }

        std::vector<index_t_> indices;
        std::vector<std::pair<std::vector<bitpack_t_*>, size_t_>> inputs_by_gate_with_negated_offset; // positive and negated inputs, with a value for the offset at which the negatives begin
        std::vector<size_t_> atleast_args_by_gate;
        std::set<std::shared_ptr<queueable_base>> layer_dependencies;

        indices.reserve(gates_.size());
        inputs_by_gate_with_negated_offset.reserve(gates_.size());
        atleast_args_by_gate.reserve(gates_.size());

        // 1) For each gate, gather child buffers (from both Variables and child Gates)
        for (const auto& gate_event : gates_)
        {
            const auto gate_index = gate_event->index();
            indices.push_back(gate_index);

            std::vector<bitpack_t_*> positive_gate_inputs;
            std::vector<bitpack_t_*> negative_gate_inputs;
            positive_gate_inputs.reserve(gate_event->args().size());
            negative_gate_inputs.reserve(gate_event->args().size());

            // non-zero only for atleast gates
            atleast_args_by_gate.push_back(gate_event->min_number());

            // For all Variable args
            for (const auto& arg_pair : gate_event->args<core::Variable>()) {
                const auto arg_index = arg_pair.second->index();
                if (!queueables_by_index_.count(arg_index)) {
                    LOG(ERROR) << "Unknown BasicEvent " << arg_index << " in gate " << gate_index;
                    throw std::runtime_error("Unknown BasicEvent " + std::to_string(arg_index) + " in gate " + std::to_string(gate_index));
                }
                layer_dependencies.insert(queueables_by_index_[arg_index]);
                const auto* basic_ev_ptr = allocated_basic_events_by_index_.at(arg_index);

                // this is a negation of the event, store it in the negations vector
                if (arg_pair.first < 0) {
                    negative_gate_inputs.push_back(basic_ev_ptr->buffer);
                } else {
                    positive_gate_inputs.push_back(basic_ev_ptr->buffer);
                }
            }

            // For all Gate args
            for (auto& arg_pair : gate_event->args<core::Gate>()) {
                const auto arg_index = arg_pair.second->index();
                if (!queueables_by_index_.count(arg_index))
                {
                    LOG(ERROR) << "Unknown Gate " << arg_index << " in gate " << gate_index;
                    throw std::runtime_error("Unknown Gate " + std::to_string(arg_index) + " in gate " + std::to_string(gate_index));
                }
                layer_dependencies.insert(queueables_by_index_[arg_index]);
                const auto* child_gate_ptr = allocated_gates_by_index_.at(arg_index);

                // this is a negation of the event, store it in the negations vector
                if (arg_pair.first < 0) {
                    negative_gate_inputs.push_back(child_gate_ptr->buffer);
                } else {
                    positive_gate_inputs.push_back(child_gate_ptr->buffer);
                }
            }

            const auto num_negated_events = negative_gate_inputs.size();
            // merge these two vectors
            positive_gate_inputs.insert(positive_gate_inputs.end(), negative_gate_inputs.begin(), negative_gate_inputs.end());

            std::pair<std::vector<bitpack_t_*>, size_t_> gate_inputs(positive_gate_inputs, num_negated_events);
            inputs_by_gate_with_negated_offset.push_back(gate_inputs);
        }

        // 2) Create a contiguous array for these gates
        const size_t num_events_in_layer = indices.size();
        const auto local_range = working_set<size_t_, bitpack_t_>(queue_, num_events_in_layer, sample_shape_).compute_optimal_local_range_3d();

        // 3) Instantiate the appropriate kernel for this gate type, along with the partition
        using kernel_type = kernel::op<gate_type_, bitpack_t_, size_t_>;
        std::shared_ptr<queueable_base> queueable_partition;

        if constexpr (gate_type_ == core::Connective::kAtleast) {
            auto gate_blk = event::create_atleast_gate_block<bitpack_t_, size_t_>(queue_, inputs_by_gate_with_negated_offset, atleast_args_by_gate, sample_shape_.num_bitpacks());
            device_atleast_gate_blocks_.push_back(gate_blk);

            kernel_type typed_kernel(gate_blk, sample_shape_);
            const auto nd_range = typed_kernel.get_range(num_events_in_layer, local_range, sample_shape_);
            queueable<kernel_type, 3> partition(queue_, typed_kernel, nd_range, layer_dependencies);
            queueable_partition = std::make_shared<decltype(partition)>(partition);

            // 4) Record the newly allocated gate pointers and queueables
            for (std::size_t i = 0; i < num_events_in_layer; ++i)
            {
                allocated_gates_by_index_[indices[i]] = &gate_blk[i];
                queueables_by_index_[indices[i]] = queueable_partition;
            }
        } else {
            auto gate_blk = event::create_gate_block<bitpack_t_, size_t_>(queue_, inputs_by_gate_with_negated_offset, sample_shape_.num_bitpacks());
            device_gate_blocks_.push_back(gate_blk);

            kernel_type typed_kernel(gate_blk, sample_shape_);
            const auto nd_range = typed_kernel.get_range(num_events_in_layer, local_range, sample_shape_);
            queueable<kernel_type, 3> partition(queue_, typed_kernel, nd_range, layer_dependencies);
            queueable_partition = std::make_shared<decltype(partition)>(partition);

            // 4) Record the newly allocated gate pointers and queueables
            for (std::size_t i = 0; i < num_events_in_layer; ++i)
            {
                allocated_gates_by_index_[indices[i]] = &gate_blk[i];
                queueables_by_index_[indices[i]]      = queueable_partition;
            }
        }

        // 5) Queue for execution
        queueables_.push_back(queueable_partition);

        return queueable_partition;
    }

    /**
     * @brief Builds SYCL kernels for all gate types present in a layer
     * 
     * @details Creates optimized SYCL kernels for each distinct gate type found in the
     * input collection. The function iterates through all supported gate types and
     * creates specialized kernels for each type that has gates present, enabling
     * efficient parallel execution of homogeneous operations.
     * 
     * **Algorithm Overview:**
     * 1. **Type Enumeration**: Iterates through all supported gate types systematically
     * 2. **Gate Filtering**: Processes only gate types that have gates present in the layer
     * 3. **Kernel Specialization**: Creates type-specific kernels using template specialization
     * 4. **Collection Management**: Maintains vector of created kernels for batch operations
     * 5. **Error Handling**: Gracefully handles empty gate collections and invalid configurations
     * 
     * **Supported Gate Types:**
     * - **kAnd**: Logical AND operation (all inputs must be true)
     * - **kOr**: Logical OR operation (any input must be true)
     * - **kAtleast**: At-least-k-out-of-n operation (k or more inputs must be true)
     * - **kXor**: Logical XOR operation (odd number of inputs must be true)
     * - **kNot**: Logical NOT operation (single input negation)
     * - **kNand**: Logical NAND operation (NOT AND)
     * - **kNor**: Logical NOR operation (NOT OR)
     * - **kNull**: Pass-through operation (identity function)
     * 
     * **Performance Optimization:**
     * - Each gate type receives its own optimized kernel
     * - Template specialization eliminates runtime branching
     * - Homogeneous operations maximize GPU utilization
     * - Parallel execution of different gate types when possible
     * 
     * **Memory Management:**
     * - Efficient memory allocation for each gate type
     * - Shared dependency tracking across all gate types
     * - Automatic cleanup through RAII principles
     * - Optimal memory layout for cache performance
     * 
     * @tparam index_t_ Signed integer type for node indexing
     * @tparam prob_t_ Floating-point type for probability calculations
     * @tparam bitpack_t_ Integer type for bit-packed result storage
     * @tparam size_t_ Integer type for size and indexing operations
     * 
     * @param gates_by_type Map from gate type to vector of gates of that type
     * @param queue_ SYCL queue for kernel execution and memory management
     * @param sample_shape_ Configuration defining batch size and bit-packing dimensions
     * @param queueables_ [in,out] Vector to store all created queueable kernels
     * @param queueables_by_index_ [in,out] Map from node index to queueable for dependency tracking
     * @param allocated_basic_events_by_index_ [in] Map from node index to basic event structures
     * @param allocated_gates_by_index_ [in,out] Map from node index to allocated gate structures
     * 
     * @return Vector of shared pointers to created queueable kernels
     * 
     * @throws std::runtime_error if gate configuration is invalid
     * @throws std::bad_alloc if device memory allocation fails
     * @throws std::logic_error if unsupported gate type is encountered
     * 
     * @note The function processes only gate types that have gates present
     * @note Each gate type receives its own optimized kernel for maximum performance
     * @note Dependency relationships are preserved across all gate types
     * 
     * @example Layer with multiple gate types:
     * @code
     * // Layer containing different gate types
     * std::unordered_map<core::Connective, std::vector<std::shared_ptr<core::Gate>>> gates_by_type;
     * gates_by_type[core::Connective::kAnd] = {and_gate1, and_gate2};
     * gates_by_type[core::Connective::kOr] = {or_gate1};
     * gates_by_type[core::Connective::kAtleast] = {atleast_gate1};
     * 
     * auto kernels = build_kernels_for_gates<int32_t, double, uint64_t, uint32_t>(
     *     gates_by_type, queue, shape, queueables, queueables_by_index,
     *     allocated_basic_events, allocated_gates
     * );
     * 
     * // kernels now contains 3 specialized kernels (AND, OR, ATLEAST)
     * for (const auto& kernel : kernels) {
     *     kernel->submit();  // Submit all gate kernels
     * }
     * @endcode
     * 
     * @example Error handling for empty collections:
     * @code
     * // Handle case where some gate types are empty
     * std::unordered_map<core::Connective, std::vector<std::shared_ptr<core::Gate>>> gates_by_type;
     * gates_by_type[core::Connective::kAnd] = {};  // Empty vector
     * gates_by_type[core::Connective::kOr] = {or_gate1};
     * 
     * auto kernels = build_kernels_for_gates<int32_t, double, uint64_t, uint32_t>(
     *     gates_by_type, queue, shape, queueables, queueables_by_index,
     *     allocated_basic_events, allocated_gates
     * );
     * 
     * // kernels contains only 1 kernel (OR), empty types are skipped
     * assert(kernels.size() == 1);
     * @endcode
     */
    template<typename index_t_, typename prob_t_, typename bitpack_t_, typename size_t_>
    static std::vector<std::shared_ptr<queueable_base>> build_kernels_for_gates(
        const std::unordered_map<core::Connective, std::vector<std::shared_ptr<core::Gate>>> &gates_by_type,
        sycl::queue &queue_,
        const event::sample_shape<size_t_> &sample_shape_,
        std::vector<std::shared_ptr<queueable_base>> &queueables_,
        std::unordered_map<index_t_, std::shared_ptr<queueable_base>> &queueables_by_index_,
        const std::unordered_map<index_t_, event::basic_event<prob_t_, bitpack_t_>*> &allocated_basic_events_by_index_,
        std::unordered_map<index_t_, event::gate<bitpack_t_, size_t_>*> &allocated_gates_by_index_,
        std::vector<event::gate_block<bitpack_t_, size_t_>> &device_gate_blocks_,
        std::vector<event::atleast_gate_block<bitpack_t_, size_t_>> &device_atleast_gate_blocks_
        ) {
        std::vector<std::shared_ptr<queueable_base>> kernels;
        kernels.reserve(gates_by_type.size());

        for (const auto &[gate_type, gates_] : gates_by_type)
        {
            if (gates_.empty()) {
                continue;
            }

            std::shared_ptr<queueable_base> kernel = nullptr;

            switch (gate_type) {
                case core::kAnd:
                    kernel = build_kernel_for_gates_of_type<core::kAnd, index_t_, prob_t_, bitpack_t_, size_t_>(gates_, queue_, sample_shape_, queueables_, queueables_by_index_, allocated_basic_events_by_index_, allocated_gates_by_index_, device_gate_blocks_, device_atleast_gate_blocks_);
                    break;
                case core::kOr:
                    kernel = build_kernel_for_gates_of_type<core::kOr, index_t_, prob_t_, bitpack_t_, size_t_>(gates_, queue_, sample_shape_, queueables_, queueables_by_index_, allocated_basic_events_by_index_, allocated_gates_by_index_, device_gate_blocks_, device_atleast_gate_blocks_);
                    break;
                case core::kAtleast:
                    kernel = build_kernel_for_gates_of_type<core::kAtleast, index_t_, prob_t_, bitpack_t_, size_t_>(gates_, queue_, sample_shape_, queueables_, queueables_by_index_, allocated_basic_events_by_index_, allocated_gates_by_index_, device_gate_blocks_, device_atleast_gate_blocks_);
                    break;
                case core::kXor:
                    kernel = build_kernel_for_gates_of_type<core::kXor, index_t_, prob_t_, bitpack_t_, size_t_>(gates_, queue_, sample_shape_, queueables_, queueables_by_index_, allocated_basic_events_by_index_, allocated_gates_by_index_, device_gate_blocks_, device_atleast_gate_blocks_);
                    break;
                case core::kNot:
                    kernel = build_kernel_for_gates_of_type<core::kNot, index_t_, prob_t_, bitpack_t_, size_t_>(gates_, queue_, sample_shape_, queueables_, queueables_by_index_, allocated_basic_events_by_index_, allocated_gates_by_index_, device_gate_blocks_, device_atleast_gate_blocks_);
                    break;
                case core::kNand:
                    kernel = build_kernel_for_gates_of_type<core::kNand, index_t_, prob_t_, bitpack_t_, size_t_>(gates_, queue_, sample_shape_, queueables_, queueables_by_index_, allocated_basic_events_by_index_, allocated_gates_by_index_, device_gate_blocks_, device_atleast_gate_blocks_);
                    break;
                case core::kNor:
                    kernel = build_kernel_for_gates_of_type<core::kNor, index_t_, prob_t_, bitpack_t_, size_t_>(gates_, queue_, sample_shape_, queueables_, queueables_by_index_, allocated_basic_events_by_index_, allocated_gates_by_index_, device_gate_blocks_, device_atleast_gate_blocks_);
                    break;
                case core::kNull:
                    kernel = build_kernel_for_gates_of_type<core::kNull, index_t_, prob_t_, bitpack_t_, size_t_>(gates_, queue_, sample_shape_, queueables_, queueables_by_index_, allocated_basic_events_by_index_, allocated_gates_by_index_, device_gate_blocks_, device_atleast_gate_blocks_);
                    break;
            }
            // Build exactly one kernel for gates of this type in the layer
            if (kernel) {
                kernels.push_back(kernel);
            }
        }

        return kernels;
    }

    /**
     * @brief Builds tally kernels for statistical computation of layer results
     * 
     * @details Creates specialized SYCL kernels for computing comprehensive statistical
     * measures from the results of computation nodes. The function processes all nodes
     * in the final layer to generate tally statistics including mean probability estimates,
     * standard errors, and confidence intervals using Monte Carlo methods.
     * 
     * **Algorithm Overview:**
     * 1. **Node Collection**: Gathers all computation nodes requiring statistical analysis
     * 2. **Buffer Resolution**: Resolves output buffers from both basic events and gates
     * 3. **Dependency Tracking**: Establishes dependencies on all input computations
     * 4. **Memory Allocation**: Allocates device memory for tally event structures
     * 5. **Kernel Configuration**: Creates specialized tally kernel with optimal work-group sizing
     * 6. **Statistical Setup**: Initializes statistical computation parameters
     * 7. **Registration**: Updates global maps for result retrieval and dependency tracking
     * 
     * **Statistical Computation Features:**
     * - **Population Counting**: Efficient parallel bit counting across all samples
     * - **Mean Estimation**: Sample proportion estimates of underlying probabilities
     * - **Standard Error Calculation**: Uncertainty quantification using Bernoulli variance
     * - **Confidence Intervals**: 95% and 99% confidence bounds using normal approximation
     * - **Intra-Group Reduction**: Optimized aggregation to minimize atomic operations
     * 
     * **Performance Optimization:**
     * - Specialized work-group sizing for statistical computation patterns
     * - Atomic operation minimization through group-level reductions
     * - Single-pass algorithm for memory-efficient processing
     * - Optimized memory access patterns for tally operations
     * 
     * **Memory Management:**
     * - Contiguous allocation for all tally events
     * - Efficient buffer pointer management
     * - Automatic dependency resolution and tracking
     * - Unified shared memory for seamless host-device access
     * 
     * **Statistical Methodology:**
     * The function implements robust Monte Carlo statistical estimation using:
     * - Central Limit Theorem for large sample distributions
     * - Bernoulli variance estimation for binary outcomes
     * - Normal approximation for confidence interval computation
     * - Robust numerical algorithms for stable computation
     * 
     * @tparam index_t_ Signed integer type for node indexing
     * @tparam prob_t_ Floating-point type for probability calculations
     * @tparam bitpack_t_ Integer type for bit-packed result storage
     * @tparam size_t_ Integer type for size and indexing operations
     * 
     * @param nodes Vector of computation nodes to create tallies for
     * @param queue_ SYCL queue for kernel execution and memory management
     * @param sample_shape_ Configuration defining batch size and bit-packing dimensions
     * @param queueables_ [in,out] Vector to store the created queueable tally kernel
     * @param queueables_by_index_ [in,out] Map from node index to queueable for dependency tracking
     * @param allocated_basic_events_by_index_ [in] Map from node index to basic event structures
     * @param allocated_gates_by_index_ [in] Map from node index to gate structures
     * @param allocated_tally_events_by_index_ [in,out] Map from node index to allocated tally event structures
     * @param device_tally_blocks_
     *
     * @return Shared pointer to the created queueable tally kernel, or nullptr if no nodes provided
     * 
     * @throws std::runtime_error if unknown node types are encountered
     * @throws std::bad_alloc if device memory allocation fails
     * @throws std::logic_error if node configuration is invalid
     * 
     * @note The function processes both basic events and gates uniformly
     * @note Dependency relationships ensure proper execution ordering
     * @note Statistical computation uses double-precision for numerical stability
     * 
     * @example Tally kernel for final layer:
     * @code
     * // Collect all nodes from the final computation layer
     * std::vector<std::shared_ptr<core::Node>> final_nodes = {top_gate, intermediate_gate};
     * 
     * auto tally_kernel = build_tallies_for_layer<int32_t, double, uint64_t, uint32_t>(
     *     final_nodes, queue, shape, queueables, queueables_by_index,
     *     allocated_basic_events, allocated_gates, allocated_tally_events
     * );
     * 
     * if (tally_kernel) {
     *     tally_kernel->submit();  // Compute statistics for all nodes
     * }
     * 
     * // Access computed statistics
     * for (const auto& [index, tally] : allocated_tally_events_by_index) {
     *     std::cout << "Node " << index << " probability: " << tally->mean
     *               << " ± " << tally->std_err << std::endl;
     * }
     * @endcode
     * 
     * @example Advanced statistical analysis:
     * @code
     * // Create tallies with custom analysis
     * auto tally_kernel = build_tallies_for_layer<int32_t, double, uint64_t, uint32_t>(
     *     analysis_nodes, queue, shape, queueables, queueables_by_index,
     *     allocated_basic_events, allocated_gates, allocated_tally_events
     * );
     * 
     * // Submit and wait for completion
     * tally_kernel->submit();
     * queue.wait_and_throw();
     * 
     * // Analyze confidence intervals
     * for (const auto& [index, tally] : allocated_tally_events_by_index) {
     *     auto ci_95_lower = tally->ci[0];
     *     auto ci_95_upper = tally->ci[1];
     *     auto ci_99_lower = tally->ci[2];
     *     auto ci_99_upper = tally->ci[3];
     *     
     *     std::cout << "Node " << index << " 95% CI: [" << ci_95_lower << ", " << ci_95_upper << "]" << std::endl;
     *     std::cout << "Node " << index << " 99% CI: [" << ci_99_lower << ", " << ci_99_upper << "]" << std::endl;
     * }
     * @endcode
     */
    template<typename index_t_, typename prob_t_, typename bitpack_t_, typename size_t_>
    static std::shared_ptr<queueable_base> build_tallies_for_layer(
        const std::vector<std::shared_ptr<core::Node>> &nodes,
        sycl::queue &queue_,
        const event::sample_shape<size_t_> &sample_shape_,
        std::vector<std::shared_ptr<queueable_base>> &queueables_,
        std::unordered_map<index_t_, std::shared_ptr<queueable_base>> &queueables_by_index_,
        const std::unordered_map<index_t_, event::basic_event<prob_t_, bitpack_t_>*> &allocated_basic_events_by_index_,
        const std::unordered_map<index_t_, event::gate<bitpack_t_, size_t_>*> &allocated_gates_by_index_,
        std::unordered_map<index_t_, event::tally<bitpack_t_> *> &allocated_tally_events_by_index_,
        std::vector<event::tally_block<bitpack_t_>> &device_tally_blocks_) {
        // collect all events in this layer
        std::vector<index_t_> indices;
        std::vector<bitpack_t_ *> node_buffers;
        // initial counts no longer required; tallies start at 0
        std::set<std::shared_ptr<queueable_base>> layer_dependencies;// it is the union of all the tally dependencies
        for (const auto &node: nodes) {
            const auto event_index = node->index();
            auto does_not_exist = queueables_by_index_.find(event_index);
            if (does_not_exist == queueables_by_index_.end()) {
                LOG(ERROR) << "Attempting to build tally for unknown event " << event_index;
                throw std::runtime_error("Attempting to build tally for unknown event " + std::to_string(event_index));
            }
            layer_dependencies.insert(queueables_by_index_[event_index]);

            bitpack_t_ *buffer;
            auto is_not_a_gate = allocated_gates_by_index_.find(event_index);
            if (is_not_a_gate == allocated_gates_by_index_.end()) {
                auto is_not_a_basic_event = allocated_basic_events_by_index_.find(event_index);
                if (is_not_a_basic_event == allocated_basic_events_by_index_.end()) {
                    LOG(ERROR) << "Attempting to build tally for unknown event " << event_index;
                    throw std::runtime_error("Attempting to build tally for unknown event " + std::to_string(event_index));
                } else {
                    // is a basic event
                    buffer = allocated_basic_events_by_index_.at(event_index)->buffer;
                }
            } else {
                buffer = allocated_gates_by_index_.at(event_index)->buffer;
            }
            // store the data for this tally
            node_buffers.push_back(buffer);
            indices.push_back(event_index);
        }

        if (indices.empty()) {
            return nullptr;
        }

        const auto num_events_in_layer = indices.size();
        using block_type = event::tally_block<bitpack_t_>;
        block_type tally_blk = event::create_tally_block<bitpack_t_>(queue_, node_buffers);
        // track this allocated block.
        device_tally_blocks_.push_back(tally_blk);

        // build the kernel
        using kernel_type = kernel::tally<prob_t_, bitpack_t_, size_t_>;
        kernel_type tally_kernel(tally_blk, sample_shape_);
        const sycl::range<3> local_limits(1, 0, 0); // first dimension always needs to have just one
        const auto local_range = working_set<size_t_, bitpack_t_>(queue_, num_events_in_layer, sample_shape_).compute_optimal_local_range_3d(local_limits);
        const auto nd_range = tally_kernel.get_range(num_events_in_layer, local_range, sample_shape_);
        iterable_queueable<kernel_type, 3> tally_partition(queue_, tally_kernel, nd_range, layer_dependencies);
        auto queueable_partition = std::make_shared<decltype(tally_partition)>(tally_partition);

        // store each event raw pointer in the identity/index map
        for (auto i = 0; i < num_events_in_layer; i++) {
            const auto event_index_in_pdag = indices[i];
            // store each event raw pointer in the identity/index map
            allocated_tally_events_by_index_[event_index_in_pdag] = &tally_blk[i];
            // the queueable where this event is computed can be found from the global queueables_by_index_ map
            queueables_by_index_[event_index_in_pdag] = queueable_partition;
        }

        // actually queue this layer for computation
        queueables_.push_back(queueable_partition);

        return queueable_partition;
    }
}