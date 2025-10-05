#pragma once

#include "mc/logger/csv.h"
#include "settings.h"

#include <string>

namespace scram::log::settings {

inline auto csv_pairs(const core::Settings &s) {
    using pair_t = std::pair<std::string, std::string>;
    return std::vector<pair_t>{
        // {"algorithm",                core::kAlgorithmToString[static_cast<int>(s.algorithm())]},
        // {"approximation",            core::kApproximationToString[static_cast<int>(s.approximation())]},
        // {"prime_implicants",         csv_string(static_cast<bool>(s.prime_implicants()))},
        // {"limit_order",              csv_string(s.limit_order())},
        // {"cut_off",                  csv_string(s.cut_off())},
        // {"batch_size",               csv_string(s.batch_size())},
        // {"sample_size",              csv_string(s.sample_size())},
        // {"num_quantiles",            csv_string(s.num_quantiles())},
        // {"num_bins",                 csv_string(s.num_bins())},
        // {"mission_time",             csv_string(s.mission_time())},
        // {"time_step",                csv_string(s.time_step())},
        // {"probability_analysis",     csv_string(static_cast<bool>(s.probability_analysis()))},
        // {"safety_integrity_levels",  csv_string(static_cast<bool>(s.safety_integrity_levels()))},
        // {"importance_analysis",      csv_string(static_cast<bool>(s.importance_analysis()))},
        // {"uncertainty_analysis",     csv_string(static_cast<bool>(s.uncertainty_analysis()))},

        // {"skip_products",            csv_string(static_cast<bool>(s.skip_products()))},
        // {"seed",                     csv_string(s.seed())},
           {"input_file",               csv_string(s.input_files()[0])},
        {"req_trials",               csv_string(s.num_trials())},
        {"req_burnin_trials",         csv_string(s.ci_burnin_trials())},
        {"req_conf_lvl",            csv_string(s.ci_confidence())},
        {"req_delta",      csv_string(s.ci_rel_margin_error())},
        {"req_stop_on_conv",   csv_string(static_cast<bool>(s.early_stop()))},
        {"req_conv_pol",                core::kCIPolicyToString[static_cast<int>(s.ci_policy())]},
        // {"watch_mode",               csv_string(static_cast<bool>(s.watch_mode()))},
        {"req_no_kn",     csv_string(static_cast<bool>(s.expand_atleast_gates()))},
        {"req_no_xor",         csv_string(static_cast<bool>(s.expand_xor_gates()))},
        // {"keep",          csv_string(static_cast<bool>(s.keep_null_gates()))},
        {"req_compile",        "C"+csv_string(s.compilation_level())},
        {"req_ccf",             csv_string(static_cast<bool>(s.ccf_analysis()))},
        {"req_overhead_ratio",             csv_string(s.overhead_ratio())},
        // {"oracle_p",                 csv_string(s.oracle_p())},
    };
}
} // namespace scram::log::settings