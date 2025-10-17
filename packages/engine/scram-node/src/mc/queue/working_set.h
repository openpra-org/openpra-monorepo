/**
 * @file working_set.h
 * @brief Optimal working-set configuration for SYCL device performance tuning
 * @author Arjun Earthperson
 * @date 11/06/2024
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
 *
 */

#pragma once

#include "mc/event/node.h"

#include <cstddef>
#include <stdexcept>
#include <sycl/sycl.hpp>

namespace scram::mc {

    /**
     * @struct working_set
     * @brief SYCL device information
     * @tparam size_type Integer type for sizes and counts (typically uint32_t or uint64_t)
     * @tparam bitpack_type Integer type for bit-packed sample storage (typically uint64_t)
     */
    template<typename size_type, typename bitpack_type>
    struct working_set {
        /// @brief Number of events in the Monte Carlo simulation
        size_type num_events_;
        
        /// @brief Number of sample bits per event (for bit-packed storage)
        size_type samples_per_event_in_bits_;
        
        /// @brief Number of sample bytes per event (for memory allocation)
        size_type samples_per_event_in_bytes_;
        
        /// @brief Sample buffer organization and dimensions
        event::sample_shape<size_type> bitpack_buffer_shape_;
        
        /// @brief Total sample buffer size in bytes
        size_type samples_in_bytes_;

        // Device capabilities and constraints
        /// @brief Type of SYCL device (CPU, GPU, accelerator, etc.)
        sycl::info::device_type device_type;
        
        /// @brief Device name
        std::string name;
        
        /// @brief Vendor ID of the device
        sycl::detail::u_int vendor_id;
        
        /// @brief Vendor name of the device
        std::string vendor;
        
        /// @brief Driver version string
        std::string driver_version;
        
        /// @brief Device profile string
        std::string profile;
        
        /// @brief Device version string
        std::string version;
        
        /// @brief OpenCL C version string
        std::string opencl_c_version;
        
        /// @brief Supported aspects on this device
        std::vector<sycl::aspect> aspects;
        
        /// @brief Supported extensions on this device
        std::vector<std::string> extensions;
        
        /// @brief Maximum number of compute units on the device
        sycl::detail::u_int max_compute_units;
        
        /// @brief Maximum clock frequency of the device in MHz
        sycl::detail::u_int max_clock_frequency;

        // Work-item capabilities
        /// @brief Maximum number of work-item dimensions supported
        sycl::detail::u_int max_work_item_dimensions;
        
        /// @brief Maximum work-item sizes for 1D kernels
        sycl::range<1> max_work_item_sizes_1d;
        
        /// @brief Maximum work-item sizes for 2D kernels
        sycl::range<2> max_work_item_sizes_2d;
        
        /// @brief Maximum work-item sizes for 3D kernels
        sycl::range<3> max_work_item_sizes_3d;
        
        /// @brief Whether work-items can make independent forward progress
        bool work_item_independent_forward_progress;

        // Work-group capabilities
        /// @brief Maximum size of a work-group
        std::size_t max_work_group_size;

        // Sub-group capabilities
        /// @brief Maximum number of sub-groups per work-group
        sycl::detail::u_int max_num_sub_groups;
        
        /// @brief Whether sub-groups can make independent forward progress
        bool sub_group_independent_forward_progress;
        
        /// @brief Supported sub-group sizes on this device
        std::vector<std::size_t> sub_group_sizes;
        
        /// @brief Preferred vector width for char operations
        sycl::detail::u_int preferred_vector_width_char;

        // Memory allocation capabilities
        /// @brief Maximum size of a single memory allocation in bytes
        sycl::detail::u_long max_mem_alloc_size;
        
        // Global memory characteristics
        /// @brief Cache line size for global memory in bytes
        sycl::detail::u_int global_mem_cache_line_size;
        
        /// @brief Total global memory size in bytes
        sycl::detail::u_long global_mem_size;
        
        /// @brief Global memory cache size in bytes
        sycl::detail::u_long global_mem_cache_size;
        
        /// @brief Type of global memory cache (none, read-only, read-write)
        sycl::info::global_mem_cache_type global_mem_cache_type;
        
        // Local memory characteristics
        /// @brief Type of local memory (none, local, global)
        sycl::info::local_mem_type local_mem_type;
        
        /// @brief Local memory size in bytes
        sycl::detail::u_long local_mem_size;

        /**
         * @brief Constructs working set configuration for a SYCL device
         *
         * The constructor queries:
         * - Device type and compute capabilities
         * - Work-group and sub-group constraints
         * - Memory hierarchy characteristics
         * - Backend-specific optimal occupancy rates
         *
         * @param queue SYCL queue for device access and memory operations
         * @param num_events Number of events in the Monte Carlo simulation
         * @param requested_shape Desired sample buffer organization
         */
        explicit working_set(const sycl::queue &queue, const size_type num_events = 0, const event::sample_shape<size_type> &requested_shape = {}) {
            const auto device = queue.get_device();
            num_events_ = num_events;
            bitpack_buffer_shape_ = requested_shape;
            samples_per_event_in_bytes_ = bitpack_buffer_shape_.num_bitpacks() * sizeof(bitpack_type);
            samples_per_event_in_bits_ = samples_per_event_in_bytes_ * 8;
            samples_in_bytes_ = samples_per_event_in_bytes_ * num_events_;

            device_type = device.get_info<sycl::info::device::device_type>();
            name = device.get_info<sycl::info::device::name>();
            vendor_id = device.get_info<sycl::info::device::vendor_id>();
            vendor = device.get_info<sycl::info::device::vendor>();
            driver_version = device.get_info<sycl::info::device::driver_version>();
            profile = device.get_info<sycl::info::device::profile>();
            version = device.get_info<sycl::info::device::version>();
            opencl_c_version = device.get_info<sycl::info::device::opencl_c_version>();
            aspects = device.get_info<sycl::info::device::aspects>();
            extensions = device.get_info<sycl::info::device::extensions>();
            max_compute_units = device.get_info<sycl::info::device::max_compute_units>();
            max_clock_frequency = device.get_info<sycl::info::device::max_clock_frequency>();

            max_work_item_dimensions = device.get_info<sycl::info::device::max_work_item_dimensions>();
            max_work_item_sizes_1d = device.get_info<sycl::info::device::max_work_item_sizes<1>>();
            max_work_item_sizes_2d = device.get_info<sycl::info::device::max_work_item_sizes<2>>();
            max_work_item_sizes_3d = device.get_info<sycl::info::device::max_work_item_sizes<3>>();
            work_item_independent_forward_progress = false;

            max_work_group_size = device.get_info<sycl::info::device::max_work_group_size>();

            max_num_sub_groups = device.get_info<sycl::info::device::max_num_sub_groups>();
            sub_group_sizes = device.get_info<sycl::info::device::sub_group_sizes>();
            preferred_vector_width_char = device.get_info<sycl::info::device::preferred_vector_width_char>();
            sub_group_independent_forward_progress = device.get_info<sycl::info::device::sub_group_independent_forward_progress>();

            // memory allocation
            max_mem_alloc_size = device.get_info<sycl::info::device::max_mem_alloc_size>();
            global_mem_size = device.get_info<sycl::info::device::global_mem_size>();
            global_mem_cache_size = device.get_info<sycl::info::device::global_mem_cache_size>();
            global_mem_cache_line_size = device.get_info<sycl::info::device::global_mem_cache_line_size>();
            global_mem_cache_type = device.get_info<sycl::info::device::global_mem_cache_type>();
            local_mem_type = device.get_info<sycl::info::device::local_mem_type>();
            local_mem_size = device.get_info<sycl::info::device::local_mem_size>();
        }
        /** CUDA **/
        // num_samples = 1e9, num_products = 1e9
        //
        // [GP104]   Tesla P4, 2560 CUDA cores @ 1531 MHz = 25600  : 2.64s
        // [GP104]   Tesla P4, 2560 CUDA cores @ 1531 MHz = 102400 : 1.17s
        // [GP104]   Tesla P4, 2560 CUDA cores @ 1531 MHz = 204800 : 0.95s
        // [GP104]   Tesla P4, 2560 CUDA cores @ 1531 MHz = 256000 : 1.02s
        //
        // [TU116] 1660 Super, 1408 CUDA cores @ 1735 MHz = 102400 : 1.34s
        // [TU116] 1660 Super, 1408 CUDA cores @ 1735 MHz = 112640 : 1.31s
        // [TU116] 1660 Super, 1408 CUDA cores @ 1735 MHz = 204800 : 1.29s
        // [TU116] 1660 Super, 1408 CUDA cores @ 1735 MHz = 307200 : 1.49s
        size_type desired_occupancy = 102400;////< Number of work-groups per compute unit. A higher number can increase
                                             /// parallelism but may also lead to resource contention. Adjust based on
                                             /// performance measurements.


        /** OpenCL **/
        // for OpenCL 64 CPU, 128 threads @ 2.35 GHz, 12800 : 3.28s
        // for OpenCL 64 CPU, 128 threads @ 2.35 GHz, 6400  : 2.85s
        // for OpenCL 64 CPU, 128 threads @ 2.35 GHz, 3200  : 3.99s

        // for OpenCL 8 CPU, 16 threads @ 3.80 GHz = 6400 * 64 = 409600 : 15.0s
        // for OpenCL 8 CPU, 16 threads @ 3.80 GHz = 6400 * 16 = 102400 : 9.55s

        /** OpenMP **/
        // for OpenMP 64 CPU, 128 threads @ 2.35 GHz, 6400 * 32 = 204800 : 8.90s
        // for OpenMP 64 CPU, 128 threads @ 2.35 GHz, 6400 * 16 = 102400 : 7.86s
        // for OpenMP 64 CPU, 128 threads @ 2.35 GHz,           = 32768  : 8.61s
        // for OpenMP 64 CPU, 128 threads @ 2.35 GHz,           = 20480  : 9.00s
        // for OpenMP 64 CPU, 128 threads @ 2.35 GHz, 6400 * 2  = 12800  : 10.7s

        // for OpenMP 8 CPU, 16 threads @ 3.80 GHz, 6400 * 64 = 409600 : 22.9s
        // for OpenMP 8 CPU, 16 threads @ 3.80 GHz, 6400 * 32 = 204800 : 21.6s
        // for OpenMP 8 CPU, 16 threads @ 3.80 GHz, 6400 * 16 = 102400 : 30.8s
        // for OpenMP 8 CPU, 16 threads @ 3.80 GHz, 6400 * 8 = 51200 : 54.9s
        /**
         * @brief Formatted output operator for working set configuration
         * @param os Output stream for formatted output
         * @param ws Working set instance to format
         * @return Reference to the output stream for chaining
         */
        friend std::ostream &operator<<(std::ostream &os, const working_set &ws) {
            os  << "device_type: ";
            switch (ws.device_type) {
                case sycl::info::device_type::cpu: os << "cpu"; break;
                case sycl::info::device_type::gpu: os << "gpu"; break;
                case sycl::info::device_type::all: os << "all"; break;
                case sycl::info::device_type::custom: os << "custom"; break;
                case sycl::info::device_type::automatic: os << "automatic"; break;
                case sycl::info::device_type::accelerator: os << "accelerator";  break;
                case sycl::info::device_type::host: os << "host"; break;
                default: os << "unknown"; break;
            } os << std::endl;
            os  << "name: " << ws.name << std::endl
                << "vendor_id: " << ws.vendor_id << std::endl
                << "vendor: " << ws.vendor << std::endl
                << "driver_version: " << ws.driver_version << std::endl
                << "profile: " << ws.profile << std::endl
                << "version: " << ws.version << std::endl
                << "opencl_c_version: " << ws.opencl_c_version << std::endl
                << "aspects: ";
            for (const auto &aspect : ws.aspects) { 
                os << static_cast<int>(aspect) << ", "; 
            } 
            os << std::endl
                << "extensions: ";
            for (const auto &ext : ws.extensions) { 
                os << ext << ", "; 
            } 
            os << std::endl;
            os  << "max_compute_units: " << ws.max_compute_units << std::endl
                << "max_clock_frequency: " << ws.max_clock_frequency << std::endl
                << "------------------------------------------------" << std::endl;
            os  << "max_work_item_dimensions: " << ws.max_work_item_dimensions << std::endl
                << "max_work_item_sizes_1d: " << ws.max_work_item_sizes_1d[0] << std::endl
                << "max_work_item_sizes_2d: " << ws.max_work_item_sizes_2d[0] << ", " << ws.max_work_item_sizes_2d[1] << std::endl
                << "max_work_item_sizes_3d: " << ws.max_work_item_sizes_3d[0] << ", " << ws.max_work_item_sizes_3d[1] << ", " << ws.max_work_item_sizes_3d[2] << std::endl
                << "work_item_independent_forward_progress: " << ws.work_item_independent_forward_progress << std::endl
                << "------------------------------------------------" << std::endl;
            os  << "max_work_group_size: " << ws.max_work_group_size << std::endl
                << "------------------------------------------------" << std::endl;
            os  << "max_num_sub_groups: " << ws.max_num_sub_groups << std::endl
                << "sub_group_sizes: "; for (const auto &size : ws.sub_group_sizes) { os << size <<", "; } os << std::endl
                << "preferred_vector_width_char: "<< ws.preferred_vector_width_char << std::endl
                << "sub_group_independent_forward_progress: " << ws.sub_group_independent_forward_progress << std::endl
                << "------------------------------------------------" << std::endl;
            os  << "max_mem_alloc_size: " << ws.max_mem_alloc_size << std::endl
                << "global_mem_size: " << ws.global_mem_size << std::endl
                << "global_mem_cache_size: " << ws.global_mem_cache_size << std::endl
                << "global_mem_cache_line_size: " << ws.global_mem_cache_line_size << std::endl
                << "global_mem_cache_type: ";
                switch (ws.global_mem_cache_type) {
                    case sycl::info::global_mem_cache_type::none: os << "none"; break;
                    case sycl::info::global_mem_cache_type::read_only: os << "read_only"; break;
                    case sycl::info::global_mem_cache_type::read_write: os << "read_write"; break;
                    default: os << "unknown"; break;
                } os << std::endl
                << "local_mem_type: ";
                switch (ws.local_mem_type) {
                    case sycl::info::local_mem_type::none: os << "none"; break;
                    case sycl::info::local_mem_type::local: os << "local"; break;
                    case sycl::info::local_mem_type::global: os << "global"; break;
                    default: os << "unknown"; break;
                } os << std::endl
                << "local_mem_size: " << ws.local_mem_size << std::endl
                << "------------------------------------------------" << std::endl;
            os  << "num_events_: " << ws.num_events_ << std::endl
                << "buffer_shape_batch_size: " << ws.bitpack_buffer_shape_.batch_size << std::endl
                << "buffer_shape_bitpacks_per_batch: " << ws.bitpack_buffer_shape_.bitpacks_per_batch << std::endl
                << "buffer_samples_per_event_in_bytes: " << ws.samples_per_event_in_bytes_ << std::endl
                << "sample_buffer_in_bytes: " << ws.samples_in_bytes_ << std::endl
                << "sampled_bits_per_event: " << ws.samples_per_event_in_bits_ << std::endl;
            return os;
        }

        /**
         * @brief Computes optimal nd_range for 1D tally kernels
         *
         * The method uses different strategies based on device type:
         * - GPU devices: Use largest sub-group size with power-of-2 multipliers
         * - CPU devices: Use preferred vector width with power-of-2 scaling
         * - Fallback: Use conservative defaults for unknown device types
         * 
         * @param queue SYCL queue for device capability queries
         * @param total_elements Total number of elements to process
         * @return Optimal nd_range with computed global and local sizes
         */
        static sycl::nd_range<1> compute_optimal_nd_range_for_tally(const sycl::queue &queue, const size_type total_elements) {
            const auto device = queue.get_device();
            size_type max_work_group_size = device.get_info<sycl::info::device::max_work_group_size>();

            // Try to obtain sub_group_sizes
            std::vector<size_t> sub_group_sizes;
            if (device.has(sycl::aspect::gpu)) {
                sub_group_sizes = device.get_info<sycl::info::device::sub_group_sizes>();
            }

            size_type optimal_local_size = 0;

            if (!sub_group_sizes.empty()) {
                // Choose the maximum sub-group size as the base for local size
                size_type max_sub_group_size = *std::max_element(sub_group_sizes.begin(), sub_group_sizes.end());

                // Multiply sub-group size to get an optimal local size, ensuring it's within max work-group size
                size_type multiplier = 1;
                while (max_sub_group_size * multiplier <= max_work_group_size) {
                    multiplier *= 2;// Adjust as needed (e.g., double the multiplier)
                }
                multiplier /= 2;// Step back to the last valid multiplier
                optimal_local_size = max_sub_group_size * multiplier;
            } else {
                // If sub_group_sizes are not available, use other device parameters
                // For CPUs or devices without sub-groups, we can use the preferred vector width
                size_type preferred_vector_width = device.get_info<sycl::info::device::preferred_vector_width_char>();

                if (preferred_vector_width == 0) {
                    // If preferred vector width is not available, default to 1
                    preferred_vector_width = 1;
                }

                // Multiply preferred vector width to get an optimal local size, within constraints
                optimal_local_size = preferred_vector_width;
                while (optimal_local_size * 2 <= max_work_group_size) {
                    optimal_local_size *= 2;
                }
            }

            // Ensure that optimal_local_size is at least 1 and does not exceed max_work_group_size
            optimal_local_size = std::max<size_type>(1, std::min(optimal_local_size, max_work_group_size));

            // Calculate global range, ensuring it's a multiple of local size
            size_type num_work_groups = (total_elements + optimal_local_size - 1) / optimal_local_size;
            size_type global_range = num_work_groups * optimal_local_size;

            // Construct and return the nd_range object
            sycl::range<1> global_range_obj(global_range);
            sycl::range<1> local_range_obj(optimal_local_size);

            return sycl::nd_range<1>(global_range_obj, local_range_obj);
        }

        /**
         * @brief Computes optimal sample shape for device memory constraints
         *
         * The search strategy:
         * 1. Start with maximum batch size (2^16) and sample size (2^16)
         * 2. Iteratively reduce sizes until memory requirements fit
         * 3. Validate against max_mem_alloc_size device limit
         * 4. Return the largest valid configuration found
         * 
         * @param queue SYCL queue for device capability queries
         * @param num_events Number of events requiring sample storage
         * @return Optimal sample_shape within memory constraints
         */
        static event::sample_shape<size_type> compute_optimal_sample_shape(const sycl::queue &queue, const size_type num_events) {
            const auto device = queue.get_device();
            const size_t max_malloc_size = device.get_info<sycl::info::device::max_mem_alloc_size>();
            static constexpr size_type max_sample_size = 16;
            static constexpr size_type max_batch_size = 16;
            static constexpr size_type one = 1;
            size_type ss = max_sample_size;
            size_type bs = max_batch_size;
            bool found = false;

            for (; ss >= 0; --ss) {
                bs = max_batch_size;// Reinitialize bs for each ss
                for (; bs >= 0; --bs) {
                    uint64_t used_bytes = static_cast<uint64_t>(num_events) * (static_cast<uint64_t>(one) << bs) * (static_cast<uint64_t>(one) << ss) * sizeof(bitpack_type);
                    if (used_bytes <= max_malloc_size) {
                        found = true;
                        break;// Breaks out of the inner loop
                    }
                }
                if (found) {
                    break;// Breaks out of the outer loop
                }
            }
            if (!found) {
                ss = 0;
                bs = 0;
            } else {
                // Adjust ss and bs because they were decremented after finding the valid values
                // (since the for loop decrements before checking the condition)
                ss = ss;
                bs = bs;
            }
            event::sample_shape<size_type> shape = {
                    .batch_size = one << bs,
                    .bitpacks_per_batch = one << ss,
            };
            return shape;
        }

        /**
         * @brief Finds the closest power of 2 to a given value
         * @param n Input value to find closest power of 2 for
         * @return Closest power of 2 to the input value
         */
        static size_type closest_power_of_2(const size_type n) {
            if (n == 0) return 1;  // Edge case: define closest power of 2 to 0 as 1

            size_type min_diff = std::numeric_limits<size_type>::max();  // Initialize minimum difference
            size_type closest = 0;  // To store the closest power of 2

            // Iterate over possible exponents x
            for (size_type x = 0; x < sizeof(size_type) * 8; ++x) {
                const size_type pow2 = static_cast<size_type>(1) << x;  // Compute 2^x
                long diff = pow2 > n ? pow2 - n : n - pow2;
                if (diff < min_diff) {
                    min_diff = diff;
                    closest = pow2;
                } else if (diff == min_diff) {
                    // If there's a tie, choose the smaller power of 2
                    if (pow2 < closest) {
                        closest = pow2;
                    }
                } else {
                    // Since the differences will start increasing after the minimum,
                    // we can break out of the loop early
                    break;
                }
            }

            return static_cast<size_type>(closest);
        }

        /**
         * @brief Computes optimal 3D local range for CPU devices
         * 
         * @details Calculates the optimal local work-group size for CPU devices
         * in 3D kernels, considering data type alignment and memory access patterns.
         * CPU devices typically benefit from smaller work-groups that align with
         * cache lines and SIMD instruction widths.
         * 
         * The CPU optimization strategy:
         * - Sets X and Y dimensions to 1 for simplicity
         * - Computes Z dimension based on data type size and alignment
         * - Considers 8-byte alignment for optimal memory access
         * - Respects device work-item size limits
         * 
         * @param limits Optional constraints on each dimension (0 = no limit)
         * @return Optimal 3D local range for CPU execution
         */
        [[nodiscard]] sycl::range<3> compute_optimal_local_range_3d_for_cpu(const sycl::range<3> &limits = {0, 0, 0}) const {
            const auto num_bytes_in_dtype = sizeof(bitpack_type); // in bytes
            const auto div_8 = 8 / num_bytes_in_dtype;
            const auto lz = !limits[2] ? div_8 : std::clamp(div_8, static_cast<decltype(limits[2])>(1), limits[2]);
            const auto hw_limited_target_z = std::clamp(lz, lz, max_work_item_sizes_3d[2]);
            return sycl::range<3>{1, 1, hw_limited_target_z};
        }

        /**
         * @brief Computes optimal 3D local range for GPU devices
         * 
         * @details Calculates the optimal local work-group size for GPU devices
         * in 3D kernels by distributing the work-group size budget across all
         * three dimensions. The algorithm uses logarithmic scaling to ensure
         * power-of-2 work-group sizes while respecting device constraints.
         * 
         * The GPU optimization strategy:
         * 1. Start with total work-group size budget (log2 of max_work_group_size)
         * 2. Distribute budget across X, Y, Z dimensions based on problem size
         * 3. Use power-of-2 sizes for optimal GPU warp/wavefront utilization
         * 4. Respect per-dimension work-item size limits
         * 5. Ensure total work-group size doesn't exceed device limits
         * 
         * @param limits Optional constraints on each dimension (0 = no limit)
         * @return Optimal 3D local range for GPU execution
         * 
         * @note GPU devices benefit from larger work-groups (e.g., 256, 512, 1024)
         * @note All dimensions are powers of 2 for optimal hardware utilization
         */
        [[nodiscard]] sycl::range<3> compute_optimal_local_range_3d_for_gpu(const sycl::range<3> &limits = {0, 0, 0}) const {
            const auto log_2_max_work_group_size = static_cast<std::uint8_t>(std::log2(max_work_group_size));
            auto remaining_budget = log_2_max_work_group_size;

            const auto target_x = !limits[0] ? num_events_ : std::clamp(static_cast<decltype(limits[0])>(num_events_), static_cast<decltype(limits[0])>(1), limits[0]);
            const auto hw_limited_target_x = std::clamp(target_x, target_x, max_work_item_sizes_3d[0]);
            const auto log_2_rounded_x = static_cast<std::uint8_t>(std::log2(closest_power_of_2(hw_limited_target_x)));
            const auto log2_local_x = std::min<std::uint8_t>(log_2_rounded_x, remaining_budget); // between 0 and 10,13

            remaining_budget = remaining_budget - log2_local_x; // between 0 and 10,13

            const auto target_y = !limits[1] ? bitpack_buffer_shape_.batch_size : std::clamp(static_cast<decltype(limits[1])>(bitpack_buffer_shape_.batch_size), static_cast<decltype(limits[1])>(1), limits[1]);
            const auto hw_limited_target_y = std::clamp(target_y, target_y, max_work_item_sizes_3d[1]);
            const auto log_2_rounded_y = static_cast<std::uint8_t>(std::log2(closest_power_of_2(hw_limited_target_y)));
            const auto log2_local_y = std::min<std::uint8_t>(log_2_rounded_y, remaining_budget); // between 0 and 10,13

            remaining_budget = remaining_budget - log2_local_y; // between 0 and 10,13

            const auto target_z = !limits[2] ? bitpack_buffer_shape_.bitpacks_per_batch : std::clamp(static_cast<decltype(limits[2])>(bitpack_buffer_shape_.bitpacks_per_batch), static_cast<decltype(limits[2])>(1), limits[2]);
            const auto hw_limited_target_z = std::clamp(target_z, target_z, max_work_item_sizes_3d[2]);
            const auto log_2_rounded_z = static_cast<std::uint8_t>(std::log2(closest_power_of_2(hw_limited_target_z)));
            const auto log2_local_z = std::min<std::uint8_t>(log_2_rounded_z, remaining_budget); // between 0 and 10,13

            const auto lx = static_cast<std::size_t>(1) << log2_local_x;
            const auto ly = static_cast<std::size_t>(1) << log2_local_y;
            const auto lz = static_cast<std::size_t>(1) << log2_local_z;
            return {lx, ly, lz};
        }

        /**
         * @brief Computes optimal 3D local range for current device type
         * @param limits Optional constraints on each dimension (0 = no limit)
         * @return Optimal 3D local range for the current device
         */
        [[nodiscard]] sycl::range<3> compute_optimal_local_range_3d(const sycl::range<3> &limits = {0, 0, 0}) const {
            sycl::range<3> local_range;
            switch (device_type) {
                case sycl::info::device_type::cpu:
                    local_range = compute_optimal_local_range_3d_for_cpu(limits);
                    break;
                case sycl::info::device_type::gpu:
                case sycl::info::device_type::accelerator:
                case sycl::info::device_type::custom:
                case sycl::info::device_type::automatic:
                case sycl::info::device_type::host:
                case sycl::info::device_type::all:
                    local_range = compute_optimal_local_range_3d_for_gpu(limits);
                    break;
            }
            const auto total_work_items = local_range[0] * local_range[1] * local_range[2];
            if (total_work_items > max_work_group_size) {
                throw std::runtime_error("Computed local range exceeds max work group size: " + 
                    std::to_string(total_work_items) + " > " + std::to_string(max_work_group_size));
            }
            return local_range;
        }
    };
}// namespace scram::mc
