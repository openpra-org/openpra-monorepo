/**
 * @file gate.h
 * @brief SYCL kernel implementations for parallel logical gate operations
 * @author Arjun Earthperson
 * @date 2025
 * 
 * @details This file implements high-performance SYCL kernels for computing logical
 * gate operations (AND, OR, XOR, NOT, NAND, NOR, ATLEAST) on bit-packed data in
 * parallel. The implementation provides efficient computation of boolean logic across
 * massive datasets using GPU parallelization.
 * 
 * The kernels operate on bit-packed representations where each bitpack contains
 * multiple independent boolean samples. This design enables simultaneous evaluation
 * of thousands of logical expressions with minimal memory overhead and optimal
 * computational throughput.
 * 
 * Key architectural features:
 * - Template-based compile-time optimization for specific gate types
 * - Bit-packed parallel processing for memory efficiency
 * - Support for mixed positive/negative input logic
 * - Specialized implementations for different logical operations
 * - Configurable work-group sizing for different GPU architectures
 * - At-least-k-out-of-n gate support for complex reliability analysis
 * 
 * Performance optimization strategies:
 * - Compile-time operation specialization using template metaprogramming
 * - Efficient bit manipulation with unrolled loops
 * - Optimal memory access patterns for GPU architectures
 * - Work-group level parallelization for large input sets
 * 
 * @note All kernels assume bit-packed input data with consistent formatting
 * @note Gates support both positive and negated inputs through offset indexing
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
#include "pdag.h"

#include <sycl/sycl.hpp>

/**
 * @section optimization_strategies Performance Optimization Strategies
 * 
 * @subsection work_item_distribution Split Per-Bit Accumulation Across Work-Items
 * 
 * @details The current implementation processes all inputs sequentially within each
 * work-item, which can become a bottleneck for gates with large numbers of inputs.
 * Advanced optimization strategies can distribute this workload across multiple
 * threads for improved performance:
 * 
 * **Strategy A: Distributed Input Processing**
 * 1. Each work-item processes only a subset of inputs (e.g., 8-16 inputs per thread)
 * 2. Partial results are stored in work-group local memory with per-bit counters
 * 3. Intra-group reduction combines partial bit-counts from all work-items
 * 4. Group leader writes final results or performs threshold comparisons
 * 
 * **Performance Benefits:**
 * - Transforms O(num_inputs) serial loop into O(num_inputs/group_size) parallel operation
 * - Reduces memory latency through better cache utilization
 * - Enables processing of very large gate fan-ins efficiently
 * - Particularly beneficial for at-least-k gates with high input counts
 * 
 * **Implementation Considerations:**
 * - Work-group size must be chosen based on input count distribution
 * - Local memory usage should be optimized for target GPU architecture
 * - Synchronization overhead must be balanced against parallel benefits
 * - Load balancing across work-groups requires careful input distribution
 * 
 * @example Advanced parallel reduction for large gates:
 * @code
 * // Distribute inputs across work-group threads
 * const auto items_per_thread = (num_inputs + group_size - 1) / group_size;
 * const auto start_idx = thread_id * items_per_thread;
 * const auto end_idx = sycl::min(start_idx + items_per_thread, num_inputs);
 * 
 * // Process subset of inputs
 * for (auto i = start_idx; i < end_idx; ++i) {
 *     // Process input[i] and accumulate partial results
 * }
 * 
 * // Reduce partial results across work-group
 * auto group_result = sycl::reduce_over_group(item.get_group(), partial_result, sycl::plus<>());
 * @endcode
 */
namespace scram::mc::kernel {

    /**
     * @class op
     * @brief Templated SYCL kernel for logical gate operations with compile-time optimization
     * 
     * @details This class template implements high-performance SYCL kernels for various
     * logical operations (AND, OR, XOR, NOT, NAND, NOR) on bit-packed data. The template
     * uses compile-time specialization to generate optimized code for each specific
     * operation type, eliminating runtime branching and maximizing GPU throughput.
     * 
     * The kernel operates in a 3D execution space where each thread processes one
     * gate-batch-bitpack combination. The bit-packed representation allows simultaneous
     * evaluation of multiple boolean expressions within a single bitpack operation.
     * 
     * **Key Design Features:**
     * - Compile-time operation specialization for zero-overhead abstraction
     * - Support for mixed positive/negative input logic
     * - Efficient bit manipulation with minimal branching
     * - Configurable initialization based on operation type
     * - Optimal memory access patterns for GPU architectures
     * 
     * **Operation Types Supported:**
     * - AND: All inputs must be true
     * - OR: Any input must be true  
     * - XOR: Odd number of inputs must be true
     * - NOT: Logical negation of single input
     * - NAND: NOT AND operation
     * - NOR: NOT OR operation
     * - NULL: Pass-through operation
     * 
     * @tparam OpType Logical operation type from core::Connective enum
     * @tparam bitpack_t_ Integer type for bit-packed data storage
     * @tparam size_t_ Integer type for indexing and sizes
     * 
     * @note The class uses CRTP-style template specialization for performance
     * @note All operations support both positive and negated inputs
     * @warning Template specialization requires compile-time constant operation types
     * 
     * @example Basic gate kernel usage:
     * @code
     * // Create AND gate kernel
     * op<core::Connective::kAnd, uint64_t, uint32_t> and_kernel(gates, num_gates, sample_shape);
     * 
     * // Submit kernel for execution
     * queue.submit([&](sycl::handler& h) {
     *     auto range = and_kernel.get_range(num_gates, local_range, sample_shape);
     *     h.parallel_for(range, [=](sycl::nd_item<3> item) {
     *         and_kernel(item);
     *     });
     * });
     * @endcode
     */
    template<core::Connective OpType, typename bitpack_t_, typename size_t_>
    class op {
    protected:
        /// @brief Contiguous block of gates (and associated buffers)
        const event::gate_block<bitpack_t_, size_t_> gates_block_;
        
        /// @brief Configuration for sample batch dimensions and bit-packing
        const event::sample_shape<size_t_> sample_shape_;

    public:
        /**
         * @brief Constructs a logical gate operation kernel
         * 
         * @details Initializes the kernel with the gates array and sampling configuration.
         * The kernel instance can be used multiple times for different execution contexts.
         * 
         * @param gates_block Pointer to array of gates (must be in unified shared memory)
         * @param sample_shape Configuration defining batch size and bit-packing dimensions
         * 
         * @note The gates array must remain valid for the lifetime of the kernel
         * @note All parameters are stored by reference and should not be modified after construction
         * 
         * @example
         * @code
         * sample_shape<uint32_t> shape{1024, 16};
         * op<core::Connective::kOr, uint64_t, uint32_t> or_kernel(gates, num_gates, shape);
         * @endcode
         */
        op(const event::gate_block<bitpack_t_, size_t_> &gates_block, const event::sample_shape<size_t_> &sample_shape)
            : gates_block_(gates_block),
              sample_shape_(sample_shape) {}

        /**
         * @brief Calculates optimal SYCL nd_range for gate kernel execution
         * 
         * @details Computes the global and local work-group sizes for optimal kernel
         * dispatch. The function ensures that global sizes are multiples of local
         * sizes (required by SYCL) and provides adequate thread coverage for all
         * gate operations.
         * 
         * The 3D execution space is organized as:
         * - X dimension: Number of gates
         * - Y dimension: Batch size from sample shape
         * - Z dimension: Bitpacks per batch from sample shape
         * 
         * @param num_gates Number of gates to process
         * @param local_range Desired local work-group size (should be optimized for target device)
         * @param sample_shape_ Sample shape configuration defining Y and Z dimensions
         * 
         * @return SYCL nd_range object ready for kernel submission
         * 
         * @note Global sizes are always multiples of corresponding local sizes
         * @note Over-provisioning is handled by kernel bounds checking
         * @note Local range should be tuned for specific GPU architecture
         * 
         * @example
         * @code
         * sycl::range<3> local_range(8, 16, 4);  // Optimized for specific GPU
         * auto nd_range = op::get_range(num_gates, local_range, sample_shape);
         * @endcode
         */
        static sycl::nd_range<3> get_range(const size_t_ num_gates,
                                           const sycl::range<3> &local_range,
                                           const event::sample_shape<size_t_> &sample_shape_) {
            // Compute global range
            auto global_size_x = static_cast<size_t>(num_gates);
            auto global_size_y = static_cast<size_t>(sample_shape_.batch_size);
            auto global_size_z = static_cast<size_t>(sample_shape_.bitpacks_per_batch);

            // Adjust global sizes to be multiples of the corresponding local sizes
            global_size_x = ((global_size_x + local_range[0] - 1) / local_range[0]) * local_range[0];
            global_size_y = ((global_size_y + local_range[1] - 1) / local_range[1]) * local_range[1];
            global_size_z = ((global_size_z + local_range[2] - 1) / local_range[2]) * local_range[2];

            sycl::range<3> global_range(global_size_x, global_size_y, global_size_z);

            LOG(INFO) << "kernel::optype<"<<core::OpName.at(OpType)<<">::\tlocal_range{x,y,z}:(" << local_range[0] <<", " << local_range[1] <<", " << local_range[2] <<")\tglobal_range{x,y,z}:("<< global_range[0] <<", " << global_range[1] <<", " << global_range[2] <<")\tnum_gates:" << num_gates << " | " << sample_shape_;
            return {global_range, local_range};
        }

        /**
         * @brief Initializes bitpack value based on the logical operation type
         * 
         * @details Provides compile-time initialization of bitpack values based on
         * the operation type. AND-type operations (AND, NAND) start with all bits
         * set to 1, while OR-type operations (OR, NOR, XOR) start with all bits
         * set to 0. This initialization ensures correct logical accumulation.
         * 
         * **Operation-specific initialization:**
         * - AND/NAND: Start with all 1s (0xFFFFFFFF...) - any 0 input yields 0
         * - OR/NOR/XOR: Start with all 0s (0x00000000...) - any 1 input affects result
         * - NOT/NULL: Initialization doesn't matter as result is directly assigned
         * 
         * @return Initial bitpack value for the operation type
         * 
         * @note This is a compile-time constant expression for optimal performance
         * @note Template specialization eliminates runtime branching
         * 
         * @example
         * @code
         * // AND operation initialization
         * constexpr auto and_init = op<core::Connective::kAnd, uint64_t, uint32_t>::init_bitpack();
         * // and_init == 0xFFFFFFFFFFFFFFFF
         * 
         * // OR operation initialization  
         * constexpr auto or_init = op<core::Connective::kOr, uint64_t, uint32_t>::init_bitpack();
         * // or_init == 0x0000000000000000
         * @endcode
         */
        static constexpr bitpack_t_ init_bitpack() {
            return (OpType == core::Connective::kAnd || OpType == core::Connective::kNand) ? ~bitpack_t_(0) : bitpack_t_(0);
        }

        /**
         * @brief SYCL kernel operator for parallel logical gate computation
         * 
         * @details This is the main kernel function executed by each SYCL thread.
         * It processes one gate-batch-bitpack combination, performing the specified
         * logical operation on all inputs and storing the result in the gate's output buffer.
         * 
         * **Algorithm Overview:**
         * 1. Extract thread indices and perform bounds checking
         * 2. Initialize result bitpack based on operation type
         * 3. Process positive inputs with the specified logical operation
         * 4. Process negated inputs with the same logical operation
         * 5. Apply final negation if required (NAND, NOR, NOT)
         * 6. Store result in the gate's output buffer
         * 
         * **Input Processing:**
         * - Positive inputs: indices [0, negated_inputs_offset)
         * - Negated inputs: indices [negated_inputs_offset, num_inputs)
         * - Each input contributes to the logical operation result
         * 
         * @param item SYCL nd_item providing thread indices and group information
         * 
         * @note Performs bounds checking to handle over-provisioned thread grids
         * @note Accesses unified shared memory for gate parameters and input data
         * @note Uses compile-time template specialization for optimal performance
         * 
         * @example Operation-specific behavior:
         * @code
         * // AND gate: result = input1 & input2 & input3 & ~input4
         * // OR gate:  result = input1 | input2 | input3 | ~input4
         * // XOR gate: result = input1 ^ input2 ^ input3 ^ ~input4
         * @endcode
         */
        void operator()(const sycl::nd_item<3> &item) const {
            const auto gate_idx = static_cast<size_t_>(item.get_global_id(0));
            const auto batch_idx = static_cast<size_t_>(item.get_global_id(1));
            const auto bitpack_idx = static_cast<size_t_>(item.get_global_id(2));

            // Bounds checking
            if (gate_idx >= this->gates_block_.count || batch_idx >= this->sample_shape_.batch_size || bitpack_idx >= this->sample_shape_.bitpacks_per_batch) {
                return;
            }

            // Compute the linear index into the buffer
            const size_t_ index = batch_idx * sample_shape_.bitpacks_per_batch + bitpack_idx;

            // Get gate
            const auto &g = gates_block_[gate_idx];
            const size_t_ num_inputs = g.num_inputs;
            const size_t_ negations_offset = g.negated_inputs_offset;
            // ---------------------------------------------------------------------
            // 1) Initialize, depending on the base operation
            //    (AND-type ops start with all bits=1, OR/XOR-type ops start with 0)
            // ---------------------------------------------------------------------
            bitpack_t_ result = init_bitpack();

            // ---------------------------------------------------------------------
            // 2) Do the base operation, looping over one word from each input
            // ---------------------------------------------------------------------
            for (size_t_ i = 0; i < negations_offset; ++i) {
                const bitpack_t_ val = g.inputs[i][index];
                if constexpr (OpType == core::Connective::kOr || OpType == core::Connective::kNor) {
                    result |= val;
                } else if constexpr (OpType == core::Connective::kAnd || OpType == core::Connective::kNand) {
                    result &= val;
                } else if constexpr (OpType == core::Connective::kXor)// OpType == core::Connective::kXnor
                {
                    result ^= val;
                } else if constexpr (OpType == core::Connective::kNull || OpType == core::Connective::kNot) {
                    result = val;
                }
            }

            for (size_t_ i = negations_offset; i < num_inputs; ++i) {
                const bitpack_t_ val = ~(g.inputs[i][index]);
                if constexpr (OpType == core::Connective::kOr || OpType == core::Connective::kNor) {
                    result |= val;
                } else if constexpr (OpType == core::Connective::kAnd || OpType == core::Connective::kNand) {
                    result &= val;
                } else if constexpr (OpType == core::Connective::kXor)// OpType == core::Connective::kXnor
                {
                    result ^= val;
                } else if constexpr (OpType == core::Connective::kNull || OpType == core::Connective::kNot) {
                    result = val;
                }
            }

            // ---------------------------------------------------------------------
            // 3) If this is a negated op (NOT, NAND, NOR, XNOR), invert the result
            // ---------------------------------------------------------------------
            if constexpr (OpType == core::Connective::kNand || OpType == core::Connective::kNor || OpType == core::Connective::kNot) {
                result = ~result;
            }

            // 4) Write final result into the gate's output buffer
            g.buffer[index] = result;
        }
    };

    /**
     * @class op<core::Connective::kAtleast, bitpack_t_, size_t_>
     * @brief Specialized SYCL kernel for at-least-k-out-of-n gate operations
     * 
     * @details This template specialization implements high-performance at-least-k-out-of-n
     * gate operations, where the output is true if at least k out of n inputs are true.
     * This is a fundamental building block for reliability analysis, voting systems,
     * and redundancy modeling.
     * 
     * The implementation uses a bit-counting algorithm that processes
     * all bits in parallel. For each bit position across all inputs, it counts how
     * many inputs have that bit set, then compares against the threshold to determine
     * the output bit value.
     * 
     * **Algorithm Complexity:**
     * - Time: O(num_inputs × num_bits) per gate
     * - Space: O(num_bits) for accumulation arrays
     * - Parallel: All bits processed simultaneously
     * 
     * **Special Cases:**
     * - k = 0: Always outputs true (trivial case)
     * - k = 1: Equivalent to OR gate
     * - k = n: Equivalent to AND gate  
     * - k > n: Always outputs false (impossible case)
     * 
     * @tparam bitpack_t_ Integer type for bit-packed data storage
     * @tparam size_t_ Integer type for indexing and sizes
     * 
     * @note This specialization handles atleast_gate structures instead of basic gates
     * @note The algorithm is optimized for parallel bit processing on GPUs
     * @warning Large input counts may require work-group level parallelization
     * 
     * @example At-least gate applications:
     * @code
     * // 2-out-of-3 voting system
     * atleast_gate<uint64_t, uint32_t> voting_gate;
     * voting_gate.at_least = 2;
     * voting_gate.num_inputs = 3;
     * 
     * // Triple redundancy system (all must work)
     * atleast_gate<uint64_t, uint32_t> redundancy_gate;
     * redundancy_gate.at_least = 3;
     * redundancy_gate.num_inputs = 3;
     * 
     * // Majority vote (more than half)
     * atleast_gate<uint64_t, uint32_t> majority_gate;
     * majority_gate.at_least = 3;  // 3 out of 5
     * majority_gate.num_inputs = 5;
     * @endcode
     */
    template<typename bitpack_t_, typename size_t_>
    class op<core::Connective::kAtleast, bitpack_t_, size_t_> {
    protected:
        /// @brief Pointer to array of at-least gates to be processed
        event::atleast_gate_block<bitpack_t_, size_t_> gates_block_;
        
        /// @brief Configuration for sample batch dimensions and bit-packing
        const event::sample_shape<size_t_> sample_shape_;

    public:
        /**
         * @brief Constructs an at-least gate operation kernel
         * 
         * @details Initializes the kernel with the at-least gates array and sampling
         * configuration. The kernel is specifically designed for processing gates
         * with at-least-k-out-of-n logic.
         * 
         * @param gates Pointer to array of at-least gates (must be in unified shared memory)
         * @param num_gates Number of at-least gates in the gates array
         * @param sample_shape Configuration defining batch size and bit-packing dimensions
         * 
         * @note The gates array must remain valid for the lifetime of the kernel
         * @note At-least gates contain additional threshold information beyond basic gates
         * 
         * @example
         * @code
         * sample_shape<uint32_t> shape{1024, 16};
         * op<core::Connective::kAtleast, uint64_t, uint32_t> atleast_kernel(gates, num_gates, shape);
         * @endcode
         */
        op(const event::atleast_gate_block<bitpack_t_, size_t_> &gates, const event::sample_shape<size_t_> &sample_shape)
            : gates_block_(gates),
              sample_shape_(sample_shape) {}

        /**
         * @brief Calculates optimal SYCL nd_range for at-least gate kernel execution
         * 
         * @details Computes the global and local work-group sizes for optimal kernel
         * dispatch. The function is identical to the base gate implementation but
         * provided for consistency and potential future specialization.
         * 
         * @param num_gates Number of at-least gates to process
         * @param local_range Desired local work-group size (should be optimized for target device)
         * @param sample_shape_ Sample shape configuration defining Y and Z dimensions
         * 
         * @return SYCL nd_range object ready for kernel submission
         * 
         * @note At-least gates may benefit from different work-group sizes due to higher complexity
         * @note Consider input count distribution when choosing local range
         * 
         * @example
         * @code
         * sycl::range<3> local_range(4, 16, 8);  // Smaller X for complex gates
         * auto nd_range = op::get_range(num_gates, local_range, sample_shape);
         * @endcode
         */
        static sycl::nd_range<3> get_range(const size_t_ num_gates,
                                           const sycl::range<3> &local_range,
                                           const event::sample_shape<size_t_> &sample_shape_) {

            /* ------------------------------------------------------------------
             *  Launch strategy (warp/ISA agnostic)
             *  ---------------------------------------------------------------
             *  – 1 work-group   ≙   1 gate × 1 batch × 1 bit-pack
             *  – |local|.z      =   NUM_BITS  (= 64 for uint64_t)
             *  – Each thread in the work-group owns one *bit position* (lane)
             *  – The work-group leader (lane 0) writes the final 64-bit word
             */

            static constexpr std::size_t NUM_BITS = sizeof(bitpack_t_) * 8;

            sycl::range<3> new_local_range = local_range;
            new_local_range[0] = 1;            // one gate per group in X
            new_local_range[2] = NUM_BITS;     // one thread per output bit

            // Compute desired global sizes.
            auto global_size_x = static_cast<size_t>(num_gates);
            auto global_size_y = static_cast<size_t>(sample_shape_.batch_size);
            auto global_size_z = static_cast<size_t>(sample_shape_.bitpacks_per_batch) * NUM_BITS;

            // Round global sizes up to multiples of the local size.
            global_size_x = ((global_size_x + new_local_range[0] - 1) / new_local_range[0]) * new_local_range[0];
            global_size_y = ((global_size_y + new_local_range[1] - 1) / new_local_range[1]) * new_local_range[1];
            global_size_z = ((global_size_z + new_local_range[2] - 1) / new_local_range[2]) * new_local_range[2];

            sycl::range<3> global_range(global_size_x, global_size_y, global_size_z);

            LOG(INFO) << "kernel::op<kAtleast>:: local_range{x,y,z}:(" << new_local_range[0] <<", " << new_local_range[1] <<", " << new_local_range[2] <<")\tglobal_range{x,y,z}:("<< global_range[0] <<", " << global_range[1] <<", " << global_range[2] <<")\tnum_gates:" << num_gates << " | " << sample_shape_;
            return {global_range, new_local_range};
        }

        void operator()(const sycl::nd_item<3> &item) const {
            // Thread coordinates
            static constexpr std::uint32_t NUM_BITS = sizeof(bitpack_t_) * 8;

            const auto gate_idx    = static_cast<std::uint32_t>(item.get_global_id(0));
            const auto batch_idx   = static_cast<std::uint32_t>(item.get_global_id(1));

            /*  group_id.z identifies the bit-pack, local_id.z (lane) identifies the bit */
            const auto bitpack_idx = static_cast<std::uint32_t>(item.get_group().get_group_id(2));
            const auto lane        = item.get_local_id(2);   // 0 … NUM_BITS-1

            if (lane >= NUM_BITS ||
                gate_idx >= gates_block_.count ||
                batch_idx >= sample_shape_.batch_size ||
                bitpack_idx >= sample_shape_.bitpacks_per_batch) {
                return;
                }

            const size_t index = batch_idx * sample_shape_.bitpacks_per_batch + bitpack_idx;

            const auto &g = gates_block_[gate_idx];
            const auto num_inputs = g.num_inputs;
            const auto negations_offset = g.negated_inputs_offset;
            const std::uint8_t k      = g.at_least;

            // --- every thread owns one bit position ---
            std::uint8_t cnt = 0;
            const bitpack_t_ mask = bitpack_t_(1) << lane;

            // positive inputs
            for (auto i = 0; i < negations_offset; ++i) {
                cnt += (g.inputs[i][index] & mask) ? bitpack_t_(1) : bitpack_t_(0);
            }

            // negated inputs
            for (auto i = negations_offset; i < num_inputs; ++i) {
                cnt += (~g.inputs[i][index] & mask) ? bitpack_t_(1) : bitpack_t_(0);
            }

            const bitpack_t_ my_bit = (cnt >= k) ? mask : bitpack_t_(0);

            /* Reduction across the *whole* work-group (64 lanes) */
            const auto &wg = item.get_group();
            const bitpack_t_ result = sycl::reduce_over_group(wg, my_bit, sycl::bit_or<bitpack_t_>());

            /* Single thread (lane 0) writes the 64-bit result */
            if (lane == 0) {
                g.buffer[index] = result;
            }
        }
    };
}