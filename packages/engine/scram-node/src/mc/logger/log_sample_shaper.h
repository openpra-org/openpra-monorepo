#pragma once

#include "mc/logger/csv.h"
#include "mc/queue/sample_shaper.h"

#include <string>
#include <vector>


namespace scram::log::sample_shaper {

template<typename bitpack_t_>
inline std::vector<std::pair<std::string, std::string>> csv_pairs(const mc::queue::sample_shaper<bitpack_t_> &s) {
    return std::vector<std::pair<std::string, std::string>>{
        {"requested_num_trials",        csv_string(s.requested_num_trials_)},
        {"num_nodes",                   csv_string(s.num_nodes_)},
        {"max_device_bytes",            csv_string(s.max_device_bytes_)},
        {"max_device_bits",             csv_string(s.max_device_bits_)},
        {"bits_in_bitpack",             csv_string(s.bits_in_bitpack_)},
        {"num_trials_rounded",          csv_string(s.num_trials_)},
        {"total_bits_to_sample",        csv_string(s.total_bits_to_sample_)},
        {"target_bits_per_iteration",   csv_string(s.target_bits_per_iteration_)},
        {"bits_per_iteration",          csv_string(s.bits_per_iteration_)},
        {"num_iterations",              csv_string(s.num_iterations_)},
        {"sample_shape_batch_size",     csv_string(s.SAMPLE_SHAPE.batch_size)},
        {"sample_shape_bitpacks_per_batch", csv_string(s.SAMPLE_SHAPE.bitpacks_per_batch)},
        {"sample_shape_num_bitpacks",   csv_string(s.SAMPLE_SHAPE.num_bitpacks())},
        {"total_iterations",            csv_string(s.TOTAL_ITERATIONS)},
    };
}

} // namespace scram::log::sample_shaper