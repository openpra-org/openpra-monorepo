/**
 * @file basic_event.h
 * @brief SYCL kernel implementation for parallel basic event sampling using Philox PRNG
 * @author Arjun Earthperson
 * @date 2025
 *
 * @details This file implements a high-performance SYCL kernel for generating random samples
 * from basic events in probabilistic analysis. It uses the Philox counter-based pseudorandom
 * number generator to ensure reproducible, high-quality random numbers suitable for Monte
 * Carlo simulations in parallel computing environments.
 *
 * The implementation provides efficient bit-packed sampling with configurable bit widths
 * and supports massive parallelization across GPU threads. Each basic event is sampled
 * independently using its failure probability, with results stored in bit-packed format
 * for memory efficiency and computational performance.
 *
 * Key features:
 * - Philox 4x32-10 PRNG for cryptographic-quality randomness
 * - Memory-efficient bit-packed storage
 * - Reproducible results with deterministic seeding
 * - Optimal SYCL kernel dispatch and work-group sizing
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
#include "mc/prng/philox128.h"
#include "mc/prng/state128.h"
#include "mc/prng/xorshift128.h"
#include "prng/sfc64.h"
#include "prng/wyrand.h"

#include <sycl/sycl.hpp>

namespace scram::mc::kernel {

    template<typename prob_t_, typename bitpack_t_, typename size_t_>
    class basic_event {

        using be_block = event::basic_event_block<prob_t_, bitpack_t_>;
        be_block basic_events_block_;

        using sample_shape = event::sample_shape<size_t_>;
        /// @brief Configuration for sample batch dimensions and bit-packing
        const sample_shape sample_shape_;

    public:
        basic_event(
                const be_block &basic_events_block,
                const sample_shape &sample_shape)
                : basic_events_block_(basic_events_block),
                  sample_shape_(sample_shape) {}

        struct positional_counter  {
            /// @brief Basic event position in block
            /// range: [0, basic_events_block_.count)
            /// constraints: [[ event_idx < basic_events_block_.count ]]
            /// @warning typically, pdag_idx and event_idx could be correlated
            uint32_t event_idx;

            /// @brief Unique index identifier in the pdag
            /// range: [2, ?)
            uint32_t pdag_idx;

            /// @brief Batch index/position:
            /// range: [0, sample_shape_.batch_size)
            /// constraints: [[ batch_idx < sample_shape_.batch_size ]]
            uint32_t batch_idx;

            /// @brief Bitpack index within the current batch
            /// range: [0, sample_shape_.bitpacks_per_batch)
            /// constraints: [[ bitpack_idx < sample_shape_.bitpacks_per_batch ]]
            uint32_t bitpack_idx;

            /// @brief linearized index
            /// batch_idx * bitpacks_per_batch + bitpack_idx
            uint32_t sample_idx;

            /// @brief iteration index
            /// (iteration + 1) << 6,
            uint32_t iteration_idx;

            bool is_out_of_bounds;

            [[gnu::always_inline]] explicit positional_counter(const sycl::nd_item<3> &item,
                                                               const be_block &event_block,
                                                               const sample_shape &sample_shape,
                                                               const uint32_t &iteration) {
                event_idx     = static_cast<uint32_t>(item.get_global_id(0));
                batch_idx     = static_cast<uint32_t>(item.get_global_id(1));
                bitpack_idx   = static_cast<uint32_t>(item.get_global_id(2));
                pdag_idx      = static_cast<uint32_t>(event_block[event_idx].index);
                sample_idx    = batch_idx * sample_shape.bitpacks_per_batch + bitpack_idx;
                iteration_idx = iteration;
                is_out_of_bounds = event_idx >= event_block.count || batch_idx >= sample_shape.batch_size || bitpack_idx >= sample_shape.bitpacks_per_batch;
            }

            [[gnu::always_inline]] [[nodiscard]] static prng::state128 fill(const positional_counter &args) {
                const prng::state128 to_fill = {
                    .x = {
                        args.pdag_idx + 1,
                        args.event_idx + 1,
                        args.sample_idx + 1,
                        (args.iteration_idx + 1) << 6, // spare 6 bits to store generation count (i)
                    }
                };
                return to_fill;
            }
        };

        void operator()(const sycl::nd_item<3> &item, const uint32_t iteration) const {

            const positional_counter args(item, basic_events_block_, sample_shape_, iteration);

            // Bounds checking
            if (args.is_out_of_bounds) {
                return;
            }

            const prng::state128 seed_base = positional_counter::fill(args);

            const auto &p_threshold = basic_events_block_[args.event_idx].probability_threshold;
            const bitpack_t_ bitpack_value = prng::philox::pack_bernoulli_draws<bitpack_t_>(seed_base, p_threshold);

            // Store the bitpacked samples into the buffer
            bitpack_t_ *output = basic_events_block_[args.event_idx].buffer;
            output[args.sample_idx] = bitpack_value;
        }

        static sycl::nd_range<3> get_range(const size_t_ num_events,
                                           const sycl::range<3> &local_range,
                                           const event::sample_shape<size_t_> &sample_shape_) {

            size_t global_size_x = num_events;
            size_t global_size_y = sample_shape_.batch_size;
            size_t global_size_z = sample_shape_.bitpacks_per_batch;

            // Round up to the next multiple of the local size in each dimension
            global_size_x = ((global_size_x + local_range[0] - 1) / local_range[0]) * local_range[0];
            global_size_y = ((global_size_y + local_range[1] - 1) / local_range[1]) * local_range[1];
            global_size_z = ((global_size_z + local_range[2] - 1) / local_range[2]) * local_range[2];

            sycl::range<3> global_range(global_size_x, global_size_y, global_size_z);
            LOG(INFO) << "kernel::basic_event::\tlocal_range{x,y,z}:(" << local_range[0] <<", " << local_range[1] <<", " << local_range[2] <<")\tglobal_range{x,y,z}:("<< global_range[0] <<", " << global_range[1] <<", " << global_range[2] <<")\tnum_events:" << num_events << " | " << sample_shape_;
            return {global_range, local_range};
        }
    };
}// namespace scram::mc::kernel