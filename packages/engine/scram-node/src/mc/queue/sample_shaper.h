/**
 * @file sample_shaper.h
 * @brief SYCL-based MC-scheduling helper for the compute graph layers.
 * @author Arjun Earthperson
 * @date 2025
 *
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

#include "logger.h"

#include <sycl/sycl.hpp>
#include <algorithm>
#include <limits>
#include <string>
#include <vector>

// Forward declare the sample_shaper template so we can reference it before its full definition.
namespace scram::mc::queue {
    template<typename bitpack_t_> struct sample_shaper;
}

namespace scram::log::sample_shaper {
    // Forward declaration so that friend declaration inside mc::queue::sample_shaper
    // can find the template before it is defined in log_sample_shaper.h.
    template<typename bitpack_t_>
    std::vector<std::pair<std::string, std::string>>
    csv_pairs(const scram::mc::queue::sample_shaper<bitpack_t_>&);
}


namespace scram::mc::queue {
template<typename bitpack_t_>
struct sample_shaper {

    std::size_t TOTAL_ITERATIONS = 0;
    event::sample_shape<std::size_t> SAMPLE_SHAPE{};

    explicit sample_shaper()= default;

    sample_shaper(const sycl::queue &queue, const std::size_t requested_num_trials, const std::size_t num_nodes, const std::double_t overhead_ratio)
        : requested_num_trials_(requested_num_trials), num_nodes_(num_nodes) {

        const sycl::device device = queue.get_device();
        max_device_bytes_ = device.get_info<sycl::info::device::max_mem_alloc_size>();
        max_device_bits_ = max_device_bytes_ * static_cast<std::size_t>(8);

        const bool no_limits_on_iterations = !requested_num_trials_;

        // still set a bound to compute the sample shape appropriately
        if (no_limits_on_iterations) {
            requested_num_trials_ = 64 * 1024 * 1024;
        }

        // round number of sampled bits to nearest multiple of bits in bitpack_t_
        const std::size_t remainder = requested_num_trials_ % bits_in_bitpack_;
        if (remainder == 0) {
            num_trials_ = requested_num_trials_;
        } else if (remainder <= bits_in_bitpack_ / 2) {
            // Round down
            num_trials_ = requested_num_trials_ - remainder;
        } else {
            // Round up
            num_trials_ = requested_num_trials_ + bits_in_bitpack_ - remainder;
        }

        // num_trials is now the number of bits to sample, over all iterations, for each node.
        total_bits_to_sample_ = num_trials_;

        // but the resident memory will need to be split between each node's outputs
        target_bits_per_iteration_ = static_cast<std::size_t>(std::floor(max_device_bits_ / static_cast<std::double_t>(num_nodes_)));

        // ------------------------------------------------------------------
        //  pick a sample shape that is as close as possible to the
        //  *requested* number of trials (rounded to a whole bit-pack)
        //  while *also* respecting the per-iteration memory budget.
        //
        //  Rationale: the previous heuristic always maximized utilisation of
        //  the available device memory which could lead to *massive* over-sampling
        //  for small --num-trials values (e.g. requesting 1024
        //  trials resulted in > 67 M sampled bits).  This updated logic preserves
        //  the "num-trials is a *minimum*" guarantee but tries to converge on
        //  the exact request so we neither under- nor grossly over-sample.
        // ------------------------------------------------------------------

        const std::size_t per_iteration_target_bits = std::min(total_bits_to_sample_, target_bits_per_iteration_);
        event::sample_shape<std::size_t> sample_shape = compute_closest_sample_shape_for_bits(device,
                                                                                              per_iteration_target_bits,
                                                                                              target_bits_per_iteration_);

        // move all the work to the last dimension
        if (sample_shape.bitpacks_per_batch) {
            sample_shape.bitpacks_per_batch *= sample_shape.batch_size;
            sample_shape.batch_size = 1;
        }

        //const auto cu = device.get_info<sycl::info::device::max_compute_units>(); // thread count
        //const auto cf = device.get_info<sycl::info::device::max_clock_frequency>();

        // nvidia backend is exceptional at maximizing block-level throughput, all we need to do is be greedy
        // about the work we want to assign -- perform a max allocation
        if (device.has(sycl::aspect::gpu) && device.get_info<sycl::info::device::vendor>() == "NVIDIA") {
            const std::double_t max_device_bitpacks = static_cast<std::double_t>(max_device_bytes_) / static_cast<std::double_t>(sizeof(bitpack_t_));
            // Allow a 5 % allocator overhead per node so we don't exceed the device limit
            // once buffers are rounded-up internally.
            const auto num_nodes_d = static_cast<std::double_t>(num_nodes);
            const std::double_t effective_nodes = num_nodes_d * (1.0 + std::clamp(overhead_ratio, 0.0, 1e6));
            const auto bitpacks = static_cast<std::size_t>(std::floor(max_device_bitpacks / effective_nodes));
            const auto cache_line_bytes = static_cast<std::double_t>(device.get_info<sycl::info::device::global_mem_cache_line_size>());
            const auto cache_line_bitpacks = static_cast<std::size_t>(cache_line_bytes / static_cast<std::double_t>(sizeof(bitpack_t_)));
            const std::size_t bitpacks_aligned = bitpacks - (bitpacks % cache_line_bitpacks);
            if (sample_shape.bitpacks_per_batch) {
                sample_shape.bitpacks_per_batch = bitpacks_aligned;
                sample_shape.batch_size = 1;
            }
        }

        // Log working_set configuration
        LOG(DEBUG2) << working_set<std::size_t, bitpack_t_>(queue, num_nodes, sample_shape);

        // the actual number of bits per sample shape per iteration
        bits_per_iteration_ = sample_shape.num_bitpacks() * bits_in_bitpack_;

        // so, it will take these many iterations to collect the total samples
        num_iterations_ = static_cast<std::size_t>(std::ceil(total_bits_to_sample_ / static_cast<std::double_t>(bits_per_iteration_)));

        TOTAL_ITERATIONS = no_limits_on_iterations ? 0 : num_iterations_;
        SAMPLE_SHAPE = sample_shape;
    }

    /**
     * @brief Formatted output operator for scheduler configuration
     * @param os Output stream for formatted output
     * @param sched Scheduler instance to format
     * @return Reference to the output stream for chaining
     */
    friend std::ostream &operator<<(std::ostream &os, const sample_shaper &sched) {
        os << "requested_num_trials: " << sched.requested_num_trials_ << std::endl
           << "num_nodes: " << sched.num_nodes_ << std::endl
           << "------------------------------------------------" << std::endl
           << "max_device_bytes: " << sched.max_device_bytes_ << std::endl
           << "max_device_bits: " << sched.max_device_bits_ << std::endl
           << "bits_in_bitpack: " << sched.bits_in_bitpack_ << std::endl
           << "------------------------------------------------" << std::endl
           << "num_trials (rounded): " << sched.num_trials_ << std::endl
           << "total_bits_to_sample: " << sched.total_bits_to_sample_ << std::endl
           << "target_bits_per_iteration: " << sched.target_bits_per_iteration_ << std::endl
           << "bits_per_iteration: " << sched.bits_per_iteration_ << std::endl
           << "num_iterations: " << sched.num_iterations_ << std::endl
           << "------------------------------------------------" << std::endl
           << "SAMPLE_SHAPE.batch_size: " << sched.SAMPLE_SHAPE.batch_size << std::endl
           << "SAMPLE_SHAPE.bitpacks_per_batch: " << sched.SAMPLE_SHAPE.bitpacks_per_batch << std::endl
           << "SAMPLE_SHAPE.num_bitpacks(): " << sched.SAMPLE_SHAPE.num_bitpacks() << std::endl
           << "TOTAL_ITERATIONS: " << sched.TOTAL_ITERATIONS << std::endl;
        return os;
    }

    // Friend declaration for logging function
    template<typename U>
    friend std::vector<std::pair<std::string, std::string>> scram::log::sample_shaper::csv_pairs(const sample_shaper<U>&);

    static event::sample_shape<std::size_t> compute_optimal_sample_shape_for_bitpacks(const sycl::device &device,
                                                                                      const std::size_t bitpack_count) {
        // Heuristic search balancing Y (batch_size) and Z (bitpacks_per_batch)
        // while respecting device limits and maximizing utilized bitpacks.
        event::sample_shape<std::size_t> shape{1, 1};

        // ---------------------------------------------------------------------
        // 1) Query hardware limits that constrain the split
        // ---------------------------------------------------------------------
        const auto max_sizes = device.get_info<sycl::info::device::max_work_item_sizes<3>>();
        const std::size_t limit_y = max_sizes[1]; // Y-dimension (batch_size)
        const std::size_t limit_z = max_sizes[2]; // Z-dimension (bitpacks_per_batch)

        // Largest available sub-group (warp/wavefront) size – may be empty on CPUs.
        std::vector<std::size_t> sg_sizes;
        if (device.has(sycl::aspect::gpu)) {
            sg_sizes = device.get_info<sycl::info::device::sub_group_sizes>();
        }
        const std::size_t subgroup = sg_sizes.empty() ? 1 : *std::max_element(sg_sizes.begin(), sg_sizes.end());

        // ---------------------------------------------------------------------
        // 2) Helper: highest power-of-two ≤ v  (0 → 0)
        // ---------------------------------------------------------------------
        const auto highest_pow2_le = [](std::size_t v) -> std::size_t {
            if (v == 0)
                return 0;
            std::size_t p = 1;
            while ((p << 1) <= v)
                p <<= 1;
            return p;
        };

        // ---------------------------------------------------------------------
        // 3) Enumerate candidate batch sizes (powers of two, multiples of subgroup)
        // ---------------------------------------------------------------------
        std::size_t best_bs = 1;
        std::size_t best_ss = 1;
        std::size_t best_product = 0;

        const std::size_t max_bs_start = std::min(limit_y, bitpack_count);
        std::size_t bs = subgroup ? subgroup : 1;
        if ((bs & (bs - 1)) != 0) { // round up to next power of two if needed
            bs = highest_pow2_le(bs) << 1;
        }

        for (; bs && bs <= max_bs_start; bs <<= 1) {
            if (bs % subgroup)
                continue; // honour SIMD alignment

            const std::size_t max_ss = std::min(limit_z, bitpack_count / bs);
            const std::size_t ss = highest_pow2_le(max_ss);
            if (ss == 0)
                continue;

            const std::size_t product = bs * ss;
            if (product > best_product) {
                best_product = product;
                best_bs = bs;
                best_ss = ss;
                if (product == bitpack_count)
                    break; // perfect utilization
            }
        }

        // ---------------------------------------------------------------------
        // 4) Fallback for very small totals (or pathological limits)
        // ---------------------------------------------------------------------
        if (best_product == 0) {
            best_bs = std::min<std::size_t>(subgroup, limit_y);
            best_ss = highest_pow2_le(std::min(limit_z, bitpack_count / best_bs));
            best_ss = std::max<std::size_t>(best_ss, 1);
        }

        shape.batch_size = best_bs;
        shape.bitpacks_per_batch = best_ss;

        // Sanity: never exceed requested capacity
        assert(shape.num_bitpacks() <= bitpack_count);
        return shape;
    }

    static event::sample_shape<std::size_t> compute_optimal_sample_shape_for_bits(const sycl::device &device, const std::size_t bit_count) {
        constexpr std::size_t bits_in_bitpack = sizeof(bitpack_t_) * static_cast<std::size_t>(8);
        const std::size_t rounded_bit_count = bit_count + bits_in_bitpack - (bit_count % bits_in_bitpack);
        const std::size_t rounded_bitpack_count = rounded_bit_count / bits_in_bitpack;
        return compute_optimal_sample_shape_for_bitpacks(device, rounded_bitpack_count);
    }

    /* ---------------------------------------------------------------------
     *  NEW: "closest-fit" search – minimize |product − target| instead of
     *       maximizing utilization.  The search space and constraints are
     *       identical to the original heuristic so this is strictly a
     *       refinement, not a behavior change elsewhere in the code.
     * -------------------------------------------------------------------*/
    static event::sample_shape<std::size_t> compute_closest_sample_shape_for_bitpacks(const sycl::device &device,
                                                                                      const std::size_t target_bitpack_count,
                                                                                      const std::size_t max_bitpack_capacity) {
        event::sample_shape<std::size_t> shape{1, 1};

        const auto max_sizes = device.get_info<sycl::info::device::max_work_item_sizes<3>>();
        const std::size_t limit_y = max_sizes[1];                      // Y-dimension (batch_size)
        const std::size_t limit_z = max_sizes[2];                      // Z-dimension (bitpacks_per_batch)

        std::vector<std::size_t> sg_sizes;
        if (device.has(sycl::aspect::gpu)) {
            sg_sizes = device.get_info<sycl::info::device::sub_group_sizes>();
        }
        const std::size_t subgroup = sg_sizes.empty() ? 1 : *std::max_element(sg_sizes.begin(), sg_sizes.end());

        const auto highest_pow2_le = [](std::size_t v) -> std::size_t {
            if (v == 0) return 0;
            std::size_t p = 1; while ((p << 1) <= v) p <<= 1; return p;
        };

        std::size_t best_bs = 1;
        std::size_t best_ss = 1;
        std::size_t best_diff = std::numeric_limits<std::size_t>::max();

        // Enumerate powers-of-two up to the HW limits and capacity.
        for (std::size_t bs = 1; bs <= limit_y && bs <= max_bitpack_capacity; bs <<= 1) {
            // Honour SIMD alignment if possible but relax for very small counts.
            if (bs >= subgroup && bs % subgroup) continue;

            const std::size_t max_ss_for_bs = std::min(limit_z, max_bitpack_capacity / bs);
            for (std::size_t ss = 1; ss <= max_ss_for_bs; ss <<= 1) {
                const std::size_t product = bs * ss;
                if (product == 0) continue; // overflow guard (should never happen)

                const std::size_t diff = (product > target_bitpack_count)
                                            ? product - target_bitpack_count
                                            : target_bitpack_count - product;

                if (diff < best_diff || (diff == best_diff && product < best_bs * best_ss)) {
                    best_diff = diff;
                    best_bs   = bs;
                    best_ss   = ss;
                    if (best_diff == 0) break; // perfect match
                }
            }
            if (best_diff == 0) break;
        }

        // Fallback: in pathological cases pick the smallest legal shape.
        if (best_diff == std::numeric_limits<std::size_t>::max()) {
            best_bs = std::clamp<std::size_t>(subgroup, 1, limit_y);
            best_ss = 1;
        }

        shape.batch_size = best_bs;
        shape.bitpacks_per_batch = best_ss;

        // Never exceed per-iteration capacity.
        assert(shape.num_bitpacks() <= max_bitpack_capacity);
        return shape;
    }

    static event::sample_shape<std::size_t> compute_closest_sample_shape_for_bits(const sycl::device &device,
                                                                                  const std::size_t target_bit_count,
                                                                                  const std::size_t max_bit_count) {
        constexpr std::size_t bits_in_bitpack = sizeof(bitpack_t_) * static_cast<std::size_t>(8);

        // Round target up to whole bit-packs for simplicity.
        const std::size_t rounded_target_bits = (target_bit_count + (bits_in_bitpack - 1)) & ~(bits_in_bitpack - 1);
        const std::size_t target_bitpacks     = rounded_target_bits / bits_in_bitpack;

        const std::size_t max_bitpacks = max_bit_count / bits_in_bitpack;

        return compute_closest_sample_shape_for_bitpacks(device, target_bitpacks, max_bitpacks);
    }
    
protected:
    // Input parameters
    std::size_t requested_num_trials_ = 0;
    std::size_t num_nodes_ = 0;
    
    // Device capabilities
    std::size_t max_device_bytes_ = 0;
    std::size_t max_device_bits_ = 0;
    
    // Computed constants
    static constexpr std::size_t bits_in_bitpack_ = sizeof(bitpack_t_) * static_cast<std::size_t>(8);
    
    // Intermediate calculations
    std::size_t num_trials_ = 0;
    std::size_t total_bits_to_sample_ = 0;
    std::size_t target_bits_per_iteration_ = 0;
    std::size_t bits_per_iteration_ = 0;
    std::size_t num_iterations_ = 0;
};
}

