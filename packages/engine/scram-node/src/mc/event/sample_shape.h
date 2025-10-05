#pragma once

namespace scram::mc::event {
    /**
     * @struct sample_shape
     * @brief Configuration structure for sampling dimensions and batch processing
     *
     * @details Defines the shape and organization of sample data for parallel processing.
     * This structure encapsulates the batch size and bit-packing configuration used
     * throughout the computation pipeline for consistent memory layout and processing.
     *
     * The sample shape determines how random samples are organized in memory and
     * processed by SYCL kernels. Proper configuration of these parameters is critical
     * for achieving optimal performance on different device architectures.
     *
     * @tparam size_t_ Integer type for size and indexing
     *
     * @note Total bitpacks = batch_size × bitpacks_per_batch
     * @note Batch size should be aligned with device work-group sizes for optimal performance
     *
     * @example
     * @code
     * sample_shape<std::uint32_t> shape;
     * shape.batch_size = 1024;         // Process 1024 samples per batch
     * shape.bitpacks_per_batch = 16;   // Use 16 bitpacks per batch
     *
     * auto total_bitpacks = shape.num_bitpacks();  // Returns 16384
     * @endcode
     */
    template<typename size_t_>
    struct sample_shape {
        /// @brief Number of samples processed in each batch
        size_t_ batch_size;

        /// @brief Number of bitpacks used per batch for bit-packed storage
        size_t_ bitpacks_per_batch;

        /**
         * @brief Calculates the total number of bitpacks needed
         *
         * @details Computes the total number of bitpacks required for the configured
         * batch size and bitpacks per batch. This value is used for memory allocation
         * and kernel dispatch calculations.
         *
         * @return Total number of bitpacks (batch_size × bitpacks_per_batch)
         *
         * @note This is a convenience function for memory allocation calculations
         *
         * @example
         * @code
         * sample_shape<std::uint32_t> shape{1024, 16};
         * auto total = shape.num_bitpacks();  // Returns 16384
         * auto buffer = working_set<std::size_t, std::uint64_t>::smart_alloc_device<std::uint64_t>(queue, total);
         * @endcode
         */
        size_t_ num_bitpacks() const { return batch_size * bitpacks_per_batch; }
    };

    template<typename size_t_>
    inline std::ostream &operator<<(std::ostream &os, const event::sample_shape<size_t_> &ss) {
        os << "batch_size= " << ss.batch_size << " | "
           << "bitpacks_per_batch= " << ss.bitpacks_per_batch << " | "
           << "num_bitpacks= " << ss.num_bitpacks();
        return os;
    }
}