#pragma once

#include "mc/logger/csv.h"
#include "mc/stats/tally.h"

#include <string>
#include <vector>
#include <ostream>

namespace scram::log::tally {

inline auto csv_pairs(const mc::stats::tally &t) {
    using pair_t = std::pair<std::string, std::string>;
    return std::vector<pair_t>{
        {"one_bits",         csv_string(t.num_one_bits)},
        {"total_bits",           csv_string(t.total_bits)},
        {"std_err",              csv_string(t.std_err)},
        {"p01",          csv_string(t.ci[2])},
        {"p05",          csv_string(t.ci[0])},
        {"mean",                 csv_string(t.mean)},
        {"p95",          csv_string(t.ci[1])},
        {"p99",          csv_string(t.ci[3])},
        {"eps",       csv_string(t.linear.epsilon)},
        {"log10_eps",        csv_string(t.log10.epsilon)},
        {"target_eps", csv_string(t.linear.target_epsilon)},
        {"target_log10_eps", csv_string(t.log10.target_epsilon)},
        {"target_bits_eps", csv_string(t.linear.target_trials)},
        {"target_bits_log10_eps",  csv_string(t.log10.target_trials)},
        // {"info_gain_alpha",      csv_string(t.info_gain.alpha())},
        // {"info_gain_beta",       csv_string(t.info_gain.beta())},
        {"cum_info_gain", csv_string(t.info_gain.cumulative_bits())},
        // {"info_gain_last",       csv_string(t.info_gain.last_bits())},
    };
}

} // namespace scram::log::tally
