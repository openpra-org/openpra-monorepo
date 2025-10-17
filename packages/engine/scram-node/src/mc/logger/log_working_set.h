#pragma once

#include "mc/logger/csv.h"
#include "mc/queue/working_set.h"

#include <string>
#include <vector>
#include <ostream>
#include <sstream>

namespace scram::log::working_set {

template<typename size_type, typename bitpack_type>
inline auto csv_pairs(const mc::working_set<size_type, bitpack_type> &ws) {
    using pair_t = std::pair<std::string, std::string>;
    
    // Helper function to convert device_type enum to string
    auto device_type_to_string = [](sycl::info::device_type dt) -> std::string {
        switch (dt) {
            case sycl::info::device_type::cpu: return "cpu";
            case sycl::info::device_type::gpu: return "gpu";
            case sycl::info::device_type::all: return "all";
            case sycl::info::device_type::custom: return "custom";
            case sycl::info::device_type::automatic: return "automatic";
            case sycl::info::device_type::accelerator: return "accelerator";
            case sycl::info::device_type::host: return "host";
            default: return "unknown";
        }
    };
    
    // Helper function to convert global_mem_cache_type enum to string
    auto cache_type_to_string = [](sycl::info::global_mem_cache_type ct) -> std::string {
        switch (ct) {
            case sycl::info::global_mem_cache_type::none: return "none";
            case sycl::info::global_mem_cache_type::read_only: return "read_only";
            case sycl::info::global_mem_cache_type::read_write: return "read_write";
            default: return "unknown";
        }
    };
    
    // Helper function to convert local_mem_type enum to string
    auto local_mem_type_to_string = [](sycl::info::local_mem_type lt) -> std::string {
        switch (lt) {
            case sycl::info::local_mem_type::none: return "none";
            case sycl::info::local_mem_type::local: return "local";
            case sycl::info::local_mem_type::global: return "global";
            default: return "unknown";
        }
    };
    
    // Helper function to serialize vector of sub_group_sizes
    auto sub_group_sizes_to_string = [](const std::vector<std::size_t> &sizes) -> std::string {
        if (sizes.empty()) return "";
        std::ostringstream oss;
        for (size_t i = 0; i < sizes.size(); ++i) {
            if (i > 0) oss << ";";
            oss << sizes[i];
        }
        return oss.str();
    };
    
    return std::vector<pair_t>{
        // Simulation parameters
        // {"num_events", csv_string(ws.num_events_)},
        // {"samples_per_event_in_bits", csv_string(ws.samples_per_event_in_bits_)},
        // {"samples_per_event_in_bytes", csv_string(ws.samples_per_event_in_bytes_)},
        // {"samples_in_bytes", csv_string(ws.samples_in_bytes_)},
        
        // Buffer shape
        // {"buffer_batch_size", csv_string(ws.bitpack_buffer_shape_.batch_size)},
        // {"buffer_bitpacks_per_batch", csv_string(ws.bitpack_buffer_shape_.bitpacks_per_batch)},
        
        // Device information
        {"device_type", device_type_to_string(ws.device_type)},
        {"device_name", csv_string(ws.name)},
        {"vendor_id", csv_string(ws.vendor_id)},
        {"vendor", csv_string(ws.vendor)},
        {"driver_version", csv_string(ws.driver_version)},
        {"profile", csv_string(ws.profile)},
        {"version", csv_string(ws.version)},
        {"opencl_c_version", csv_string(ws.opencl_c_version)},
        
        // Device capabilities
        {"max_compute_units", csv_string(ws.max_compute_units)},
        {"max_clock_frequency", csv_string(ws.max_clock_frequency)},
        
        // Work-item capabilities
        {"max_work_item_dimensions", csv_string(ws.max_work_item_dimensions)},
        {"max_work_item_sizes_1d", csv_string(ws.max_work_item_sizes_1d[0])},
        {"max_work_item_sizes_2d_x", csv_string(ws.max_work_item_sizes_2d[0])},
        {"max_work_item_sizes_2d_y", csv_string(ws.max_work_item_sizes_2d[1])},
        {"max_work_item_sizes_3d_x", csv_string(ws.max_work_item_sizes_3d[0])},
        {"max_work_item_sizes_3d_y", csv_string(ws.max_work_item_sizes_3d[1])},
        {"max_work_item_sizes_3d_z", csv_string(ws.max_work_item_sizes_3d[2])},
        {"work_item_independent_forward_progress", csv_string(ws.work_item_independent_forward_progress)},
        
        // Work-group capabilities
        {"max_work_group_size", csv_string(ws.max_work_group_size)},
        
        // Sub-group capabilities
        {"max_num_sub_groups", csv_string(ws.max_num_sub_groups)},
        {"sub_group_independent_forward_progress", csv_string(ws.sub_group_independent_forward_progress)},
        {"sub_group_sizes", sub_group_sizes_to_string(ws.sub_group_sizes)},
        {"preferred_vector_width_char", csv_string(ws.preferred_vector_width_char)},
        
        // Memory allocation capabilities
        {"max_mem_alloc_size", csv_string(ws.max_mem_alloc_size)},
        
        // Global memory characteristics
        {"global_mem_cache_line_size", csv_string(ws.global_mem_cache_line_size)},
        {"global_mem_size", csv_string(ws.global_mem_size)},
        {"global_mem_cache_size", csv_string(ws.global_mem_cache_size)},
        {"global_mem_cache_type", cache_type_to_string(ws.global_mem_cache_type)},
        
        // Local memory characteristics
        {"local_mem_type", local_mem_type_to_string(ws.local_mem_type)},
        {"local_mem_size", csv_string(ws.local_mem_size)},
        
        // Performance tuning
        // {"desired_occupancy", csv_string(ws.desired_occupancy)},
    };
}

} // namespace scram::log::working_set
