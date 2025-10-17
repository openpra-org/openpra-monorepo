#pragma once

#include "mc/logger/csv.h"
#include "mc/stats/diagnostics.h"

#include <string>
#include <vector>
#include <utility>

namespace scram {
namespace mc {
namespace scheduler {

// Forward declaration to avoid heavy include and circular dependency
template <typename policy_t_, typename bitpack_t_, typename prob_t_, typename size_t_>
class convergence_controller;

} // namespace scheduler
} // namespace mc
} // namespace scram

namespace scram::log::progress {

/**
 * @brief Return key–value pairs representing the current progress of a sampling run.
 *
 * This helper is designed to be called once per UI refresh from progressbar.h.  It
 * extracts the most relevant convergence statistics from the convergence_controller
 * so they can be written to a CSV file via BenchmarkLogger.
 */
template <typename policy_t_, typename bitpack_t_, typename prob_t_, typename size_t_>
inline std::vector<std::pair<std::string, std::string>>
csv_pairs(const scram::mc::scheduler::convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &c)
{
    using pair_t = std::pair<std::string, std::string>;
    std::vector<pair_t> kv;
    kv.reserve(32);

    const auto cur_steps = c.current_steps();
    const auto projected_steps = c.projected_steps();
    
    // Basic iteration counters
    kv.emplace_back("iterations",        csv_string(cur_steps.iterations()));
    kv.emplace_back("trials",            csv_string(cur_steps.trials()));

    // Projected sample size estimates
    kv.emplace_back("projected_iterations", csv_string(projected_steps.iterations()));
    kv.emplace_back("projected_trials", csv_string(projected_steps.trials()));

    // Remaining work to reach target
    const auto rem = c.remaining_steps();
    kv.emplace_back("remaining_iterations", csv_string(rem.iterations()));
    kv.emplace_back("remaining_trials", csv_string(rem.trials()));



    // Convergence statistics (current vs. target)
    const auto cur_state = c.current_state();
    const auto tar_state = c.target_state();
    kv.emplace_back("epsilon",           csv_string(cur_state.half_width_epsilon));
    kv.emplace_back("epsilon_log10",     csv_string(cur_state.half_width_epsilon_log10));
    kv.emplace_back("target_epsilon",    csv_string(tar_state.half_width_epsilon));
    kv.emplace_back("target_epsilon_log10", csv_string(tar_state.half_width_epsilon_log10));

    // Convergence flags
    const bool epsilon_converged_flag = (cur_state.half_width_epsilon > 0) && (cur_state.half_width_epsilon <= tar_state.half_width_epsilon);
    const bool epsilon_log10_converged_flag = (cur_state.half_width_epsilon_log10 > 0) && (cur_state.half_width_epsilon_log10 <= tar_state.half_width_epsilon_log10);
    kv.emplace_back("epsilon_converged", csv_string(epsilon_converged_flag));
    kv.emplace_back("epsilon_log10_converged", csv_string(epsilon_log10_converged_flag));


    // Point estimate and error
    kv.emplace_back("std_err",           csv_string(c.current_tally().std_err));
    // Confidence interval percentiles
    kv.emplace_back("p01",               csv_string(c.current_tally().ci[2]));
    kv.emplace_back("p05",               csv_string(c.current_tally().ci[0]));
    kv.emplace_back("mean",              csv_string(c.current_tally().mean));
    kv.emplace_back("p95",               csv_string(c.current_tally().ci[1]));
    kv.emplace_back("p99",               csv_string(c.current_tally().ci[3]));

    // Information-gain metrics
    kv.emplace_back("info_bits_last",    csv_string(c.info_gain_last_iteration()));
    kv.emplace_back("info_bits_total",   csv_string(c.info_gain_cumulative()));

    if (c.ground_truth() >= 0) {
        // Oracle probability (ground truth)
        kv.emplace_back("oracle_p",          csv_string(c.ground_truth()));

        // Accuracy metrics (if diagnostics enabled)
        if (auto metrics = c.accuracy_metrics()) {
            kv.emplace_back("bias",              csv_string(metrics->bias));
            kv.emplace_back("abs_error",         csv_string(metrics->abs_error));
            kv.emplace_back("rel_error",         csv_string(metrics->rel_error));
            kv.emplace_back("mse",               csv_string(metrics->mse));
            kv.emplace_back("log10_abs_error",   csv_string(metrics->log10_abs_error));
            kv.emplace_back("abs_log10_error",   csv_string(metrics->abs_log10_error));
        }

        // Sampling diagnostics (if diagnostics enabled)
        if (auto diag = c.sampling_diagnostics()) {
            kv.emplace_back("z_score",           csv_string(diag->z_score));
            kv.emplace_back("p_value",           csv_string(diag->p_value));
            kv.emplace_back("ci95_covered",      csv_string(diag->ci95_covered));
            kv.emplace_back("ci99_covered",      csv_string(diag->ci99_covered));
            kv.emplace_back("n_required",        csv_string(diag->n_required));
            kv.emplace_back("n_ratio",           csv_string(diag->n_ratio));
        }
    }

    return kv;
}

} // namespace scram::log::progress
