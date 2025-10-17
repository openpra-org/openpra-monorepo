/**
 * @file convergence_controller.h
 * @brief High-level convergence manager for Monte-Carlo sampling runs.
 *
 * @details  This helper class delegates the *numerical* work to an existing
 * scram::mc::queue::layer_manager instance but owns the *policy* of how many
 * additional iterations to execute.  It centralizes the classical
 * "half-width ≤ ε with CLT sanity" early-stopping rule that was previously
 * embedded in layer_manager.
 *
 * The controller can be used in two different ways:
 *   1. Call step() repeatedly from user code while interrogating the current
 *      tally after each pass – useful for tight external loop control.
 *   2. Call run_to_convergence() to let the controller iterate until either
 *      the requested precision is achieved or all planned iterations have
 *      been executed.
 *
 * The implementation is header-only and therefore fully inlined for maximum
 * flexibility across translation units.
 */
#pragma once

#include "mc/queue/layer_manager.h"

#include "mc/scheduler/convergence_policy.h"
#include "mc/scheduler/iteration_shape.h"
#include "mc/scheduler/progressbar.h"

#include "mc/stats/ci_utils.h"
#include "mc/stats/diagnostics.h"
#include "mc/stats/info_gain.h"
#include "mc/logger/csv.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <optional>


#define PRECISION_LOG_SCIENTIFIC_DIGITS 3

namespace scram::mc::scheduler {

template <typename policy_t_, typename bitpack_t_, typename prob_t_ = std::double_t, typename size_t_ = std::uint64_t>
struct progress;

template <typename policy_t_, typename bitpack_t_, typename prob_t_ = std::double_t, typename size_t_ = std::uint64_t>
class convergence_controller {
  public:
    using index_t_ = std::int32_t;

    /**
     * @param mgr        Reference to a fully initialised layer_manager.
     * @param settings   Settings
     */
    convergence_controller(queue::layer_manager<bitpack_t_, prob_t_, size_t_> &mgr, const core::Settings &settings)
        : manager_(mgr), settings_(settings) {

        steps_ = {
            .current = iteration_shape<bitpack_t_>(mgr.shaper().SAMPLE_SHAPE, 0),
            .target  = iteration_shape<bitpack_t_>(mgr.shaper().SAMPLE_SHAPE, settings.num_trials()),
        };

        projected_steps_epsilon_ = iteration_shape<bitpack_t_>(mgr.shaper().SAMPLE_SHAPE, settings.num_trials());
        projected_steps_epsilon_log10_ = iteration_shape<bitpack_t_>(mgr.shaper().SAMPLE_SHAPE, settings.num_trials());

        // --- parametrize δ as a function of ε ------------------------------------------------------------
        // ε = |µ - p̂|
        // ε = δ•p̂
        // we don't have a target ε yet since it's a value that gets computed and updated after we run some initial
        // trials. So, we make the target postpone convergence checks until the burn-in phase finishes.
        interval_ = {
            .current = {
                .half_width_epsilon = std::numeric_limits<std::double_t>::infinity(), // not been computed so far, max
                .half_width_epsilon_log10 = std::numeric_limits<std::double_t>::infinity(), // not been computed so far, max
                .two_sided_confidence_level = std::numeric_limits<std::double_t>::quiet_NaN(), // not needed, not tracked for now.
                .normal_quantile_two_sided = std::numeric_limits<std::double_t>::quiet_NaN(),
            },
            .target = {
                .half_width_epsilon = settings_.ci_rel_margin_error() * std::max(0.0, stats::DELTA_EPSILON),
                .half_width_epsilon_log10 = settings_.ci_rel_margin_error(), // for now, assume this is a user-provided constant
                .two_sided_confidence_level = settings_.ci_confidence(), // from settings
                .normal_quantile_two_sided = stats::normal_quantile_two_sided(settings_.ci_confidence()), // compute once
            },
        };
        // ---------------------------------------------------------------------
        //  Build unique progress-log filename: <input>_<YYYYMMDD_HHMMSS>_convergence.csv
        // ---------------------------------------------------------------------
        const std::string progress_log = scram::log::timestamp_string( settings.input_files()[0], "convergence");
        progress_.initialize(this, settings.watch_mode(), progress_log);
    }

    void process_tally(const event::tally<bitpack_t_> &tally) {
        current_tally_ = tally;
        // ------------------ update iterations ---------------------------------------
        steps_.current.trials(tally.total_bits);
        // ------------------ update current epsilon, log10-epsilon--------------------
        const std::double_t &target_z = interval_.target.normal_quantile_two_sided;
        // The half_width helper expects the *Z*-score. We pre-computed the
        // two-sided normal quantile when initialising `targets_`, so use it
        // here instead of the confidence level itself.
        interval_.current.half_width_epsilon = stats::half_width(tally, target_z);
        interval_.current.half_width_epsilon_log10 = stats::half_width_log10(tally, target_z);
        // ------------------ update target epsilon, log10-epsilon----------------------
        const auto p_hat = std::max(tally.mean, stats::DELTA_EPSILON);
        const auto p_hat_log10 = std::log10(p_hat);
        // set the target epsilon as a fraction of the estimated mean
        const std::double_t target_epsilon = settings_.ci_rel_margin_error() * p_hat;
        interval_.target.half_width_epsilon = target_epsilon;
        // Desired half-width in log10 space must be positive.  We therefore
        // take the absolute distance |log10(p̂)| and scale it by the same
        // relative margin-of-error used in linear space.  The max() guard
        // avoids the corner-case p̂ → 1 (log10 p̂ ≈ 0) by falling back to a
        // tiny non-zero baseline so the convergence test remains meaningful.
        // const auto abs_log10_p_hat = std::max(std::abs(p_hat_log10), stats::DELTA_EPSILON);
        // const std::double_t target_epsilon_log10 = settings_.ci_rel_margin_error() * abs_log10_p_hat;
        const std::double_t target_epsilon_log10 = interval_.target.half_width_epsilon_log10;
        // interval_.target.half_width_epsilon_log10 = target_epsilon_log10;
        // ------------------ update projected trials ----------------------------------
        const auto N1 = stats::required_trials_from_normal_quantile_two_sided(p_hat, target_epsilon, target_z);
        const auto N2 = stats::required_trials_log10_from_normal_quantile_two_sided(p_hat, target_epsilon_log10, target_z);
        const auto N = std::max(N1, N2);
        steps_.target.trials(N);
        projected_steps_epsilon_.trials(N1);
        projected_steps_epsilon_log10_.trials(N2);
        // ------------------ update information gain -----------------------------
        const std::size_t successes_delta = tally.num_one_bits - prev_one_bits_;
        const std::size_t failures_delta  = (tally.total_bits - tally.num_one_bits) - (prev_total_bits_ - prev_one_bits_);
        last_info_bits_ = info_gain_tracker_.add_batch(successes_delta, failures_delta);
        prev_one_bits_   = tally.num_one_bits;
        prev_total_bits_ = tally.total_bits;
    }

    /**
     * @brief Update convergence statistics from a collection of *independent* tallies.
     *
     * Every entry in the supplied map represents the Monte-Carlo statistics for a
     * *different* PDAG node evaluated over the **same** set of Bernoulli trials.
     * We stop only when *all* nodes satisfy the ε-bound / CLT criterion.  The
     * controller therefore tracks the *worst-case* (largest half-width, largest
     * projected sample size) across the set.
     */
    void process_tallies(stats::TallyNodeMap &tally_node_map) {

        if (tally_node_map.empty()) {
            return; // nothing to update
        }

        // ---------------------------------------------------------------------
        //  Scan once over all tallies and compute worst-case metrics
        // ---------------------------------------------------------------------
        const std::double_t target_z = interval_.target.normal_quantile_two_sided;

        std::double_t   max_eps          = 0.0;               // ε (linear)  – worst case
        std::double_t   max_eps_log10    = 0.0;               // ε (log10)   – worst case

        std::size_t     max_N1           = 0;                 // projected N from linear ε
        std::size_t     max_N2           = 0;                 // projected N from log10  ε

        std::size_t     sum_one_bits     = 0;                 // aggregated counters for info-gain
        std::size_t     sum_total_bits   = 0;

        //const auto log_target_eps10 = interval_.target.half_width_epsilon_log10;

        // Keep a pointer to the tally that currently sets the worst ε so that we
        // can expose it via current_tally_.
        const stats::tally *worst_tally_ptr = nullptr;

        for (auto [idx, t] : tally_node_map.tallies()) {
            // Ensure mean/std_err are up-to-date in case caller skipped host post-processing.
            // stats::populate_point_estimates(t);

            // -----------------------------------------------------------------
            //  Update convergence metrics via selected statistical policy
            // -----------------------------------------------------------------
            mc::stats::update_convergence<policy_t_>(t, settings_.ci_rel_margin_error(), target_z);

            //LOG(DEBUG4) << "[" << idx << "]: " << t;
            // -----------------------------------------------------------------
            //  Track worst-case (largest ε) across all monitored tallies
            // -----------------------------------------------------------------
            const double eps      = t.linear.epsilon;
            const double eps_log  = t.log10.epsilon;
            const std::size_t N1  = t.linear.target_trials;
            const std::size_t N2  = t.log10.target_trials;

            if (eps > max_eps) {
                max_eps = eps;
                worst_tally_ptr = &t;
            }
            if (eps_log > max_eps_log10) {
                max_eps_log10 = eps_log;
            }

            max_N1 = std::max(max_N1, N1);
            max_N2 = std::max(max_N2, N2);

            // Aggregated counters for information gain ---------------------------
            sum_one_bits   += t.num_one_bits;
            sum_total_bits += t.total_bits;
        }

        // ---------------------------------------------------------------------
        //  Current iteration shape: all nodes share the same trial count – use
        //  the worst-case tally as representative (they should be identical).
        // ---------------------------------------------------------------------
        if (worst_tally_ptr) {
            steps_.current.trials(worst_tally_ptr->total_bits);
        }

        // ---------------------------------------------------------------------
        //  Update controller state with worst-case metrics
        // ---------------------------------------------------------------------
        interval_.current.half_width_epsilon       = max_eps;
        interval_.current.half_width_epsilon_log10 = max_eps_log10;

        //  Target ε is defined as a relative margin of error w.r.t the current
        //  worst-case point estimate.
        if (worst_tally_ptr) {
            const double target_epsilon = settings_.ci_rel_margin_error() *
                                          std::max(worst_tally_ptr->mean, stats::DELTA_EPSILON);
            interval_.target.half_width_epsilon = target_epsilon;
        }

        const std::size_t projected_N = std::max(max_N1, max_N2);
        steps_.target.trials(projected_N);
        projected_steps_epsilon_.trials(max_N1);
        projected_steps_epsilon_log10_.trials(max_N2);

        // ---------------------------------------------------------------------
        //  Information-gain tracking (aggregate across all monitored nodes)
        // ---------------------------------------------------------------------
        const std::size_t successes_delta = sum_one_bits - prev_one_bits_;
        const std::size_t failures_delta  = (sum_total_bits - sum_one_bits) - (prev_total_bits_ - prev_one_bits_);

        last_info_bits_ = info_gain_tracker_.add_batch(successes_delta, failures_delta);
        prev_one_bits_   = sum_one_bits;
        prev_total_bits_ = sum_total_bits;

        // ---------------------------------------------------------------------
        //  Keep a representative tally for API compatibility
        // ---------------------------------------------------------------------
        if (worst_tally_ptr) {
            current_tally_.num_one_bits = worst_tally_ptr->num_one_bits;
            current_tally_.total_bits   = worst_tally_ptr->total_bits;
            current_tally_.mean         = worst_tally_ptr->mean;
            current_tally_.std_err      = worst_tally_ptr->std_err;
            current_tally_.ci           = worst_tally_ptr->ci;
        }
    }

    [[nodiscard]] bool check_convergence() const {
        return check_epsilon_bounded(interval_) && check_log_epsilon_bounded(interval_);
    }

    /** Execute exactly one additional iteration on the device. */
    [[nodiscard]] bool step(const index_t_ event_id) {

        // don't step anymore, just return that we didn't take a step.
        if (all_converged() && stop_on_convergence()) {
            return false;
        }

        // out of iterations, return that we didn't take a step.
        // evals to false if max_iterations_ is 0, which means keep going.
        if (!fixed_iteration_limited_reached_ && iteration_limit_reached()) {
            fixed_iteration_limited_reached_ = true;
            progress_.mark_fixed_iterations_complete(*this);
            return false;
        }

        // still have iterations remaining
        // get the tally
        process_tally(manager_.single_pass_and_tally(event_id));

        // for now, this is our convergence criteria
        // if converged now, set convergence_ sticky to true
        if (!epsilon_converged_ && check_epsilon_bounded(interval_)) {
            epsilon_converged_ = true;
            progress_.mark_converged(*this);
        }

        if (!epsilon_log10_converged_ && check_log_epsilon_bounded(interval_)) {
            epsilon_log10_converged_ = true;
            progress_.mark_log_converged(*this);
        }


        // since we did step, update the iteration count
        return true;
    }

    /** Execute exactly one additional iteration on the device. */
    [[nodiscard]] bool step(stats::TallyNodeMap &tally_node_map) {

        // don't step anymore, just return that we didn't take a step.
        if (all_converged() && stop_on_convergence()) {
            return false;
        }

        // out of iterations, return that we didn't take a step.
        // evals to false if max_iterations_ is 0, which means keep going.
        if (!fixed_iteration_limited_reached_ && iteration_limit_reached()) {
            fixed_iteration_limited_reached_ = true;
            progress_.mark_fixed_iterations_complete(*this);
            return false;
        }

        // still have iterations remaining
        // get the tally
        process_tallies(manager_.pass_wait_collect(tally_node_map));

        // for now, this is our convergence criteria
        // if converged now, set convergence_ sticky to true
        if (!epsilon_converged_ && check_epsilon_bounded(interval_)) {
            epsilon_converged_ = true;
            progress_.mark_converged(*this);
        }

        if (!epsilon_log10_converged_ && check_log_epsilon_bounded(interval_)) {
            epsilon_log10_converged_ = true;
            progress_.mark_log_converged(*this);
        }


        // since we did step, update the iteration count
        return true;
    }

    /**
     * Execute exactly one additional asynchronous iteration on the device, don't worry about getting the tallies yet
     * since they are accumulating on device. The iteration count keeps track of how many trials have been run on device
     * so far.
     */
    [[nodiscard]] bool burn_in_step(const index_t_ event_id) {

        // iteration_ now shows that enough tasks have been queued on device such that by the time they finish,
        // burn-in trials would be complete. So, don't queue up any additional work, just return saying you're done taking
        // burn-in steps.
        if (burn_in_complete()) {
            progress_.mark_burn_in_complete(*this);
            return false;
        }

        process_tally(manager_.single_pass_and_tally(event_id));

        // since we did step, update the iteration count
        return true;
    }

    [[nodiscard]] bool burn_in_step(stats::TallyNodeMap &tally_node_map) {

        // iteration_ now shows that enough tasks have been queued on device such that by the time they finish,
        // burn-in trials would be complete. So, don't queue up any additional work, just return saying you're done taking
        // burn-in steps.
        if (burn_in_complete()) {
            progress_.mark_burn_in_complete(*this);
            return false;
        }

        process_tallies(manager_.pass_wait_collect(tally_node_map));

        // since we did step, update the iteration count
        return true;
    }

    /**
     * Run until the stopping criterion is met (or until the original plan is
     * exhausted).  Returns the final tally.
     */
    [[nodiscard]] event::tally<bitpack_t_> run_to_convergence(stats::TallyNodeMap &tally_node_map) {
        // queue up burn-in trials, but dont check for convergence.
        while(burn_in_step(tally_node_map)) {
            progress_.perform_burn_in_update(*this);
        }
        while (step(tally_node_map)) {
            progress_.perform_normal_update(*this);
        }
        progress_.finalize();
        return current_tally();
    }

    /**
     * Run until the stopping criterion is met (or until the original plan is
     * exhausted).  Returns the final tally.
     */
    [[nodiscard]] event::tally<bitpack_t_> run_to_convergence(const index_t_ event_id) {
        // queue up burn-in trials, but dont check for convergence.
        while(burn_in_step(event_id)) {
            progress_.perform_burn_in_update(*this);
        }
        while (step(event_id)) {
            progress_.perform_normal_update(*this);
        }
        progress_.finalize();
        return current_tally();
    }

private:
    queue::layer_manager<bitpack_t_, prob_t_, size_t_> &manager_;
    //const index_t_ evt_idx_;
    const core::Settings &settings_;
    // Information gain tracking
    stats::info_gain info_gain_tracker_{};
    std::size_t prev_one_bits_ = 0;
    std::size_t prev_total_bits_ = 0;
    double last_info_bits_ = 0.0;
    tracked_pair<stats::ci> interval_;

    tracked_pair<iteration_shape<bitpack_t_>> steps_{};
    iteration_shape<bitpack_t_> projected_steps_epsilon_{};
    iteration_shape<bitpack_t_> projected_steps_epsilon_log10_{};

    event::tally<bitpack_t_> current_tally_{};
    bool epsilon_log10_converged_ = false;
    bool epsilon_converged_ = false;
    bool fixed_iteration_limited_reached_ = false;
    progress<policy_t_, bitpack_t_, prob_t_, size_t_> progress_;

public:
    [[nodiscard]] bool diagnostics_enabled() const { return settings_.oracle_p() >= 0.0; }
    [[nodiscard]] std::double_t ground_truth() const { return settings_.oracle_p(); }

    [[nodiscard]] const iteration_shape<bitpack_t_> &current_steps() const { return steps_.current; }
    [[nodiscard]] const iteration_shape<bitpack_t_> &projected_steps() const { return steps_.target; }

    [[nodiscard]] const iteration_shape<bitpack_t_> &projected_steps_epsilon() const { return projected_steps_epsilon_; }
    [[nodiscard]] const iteration_shape<bitpack_t_> &projected_steps_epsilon_log10() const { return projected_steps_epsilon_log10_; }

    [[nodiscard]] iteration_shape<bitpack_t_> remaining_steps() const {
        auto rem = current_steps();
        const std::size_t rem_trials = (projected_steps().trials() > current_steps().trials()) ?
                                       (projected_steps().trials() - current_steps().trials()) : 0;
        rem.trials(rem_trials);
        return rem;
    }

    [[nodiscard]] bool stop_on_convergence() const { return settings_.early_stop(); }
    [[nodiscard]] bool all_converged() const { return epsilon_log10_converged_ && epsilon_converged_; }
    [[nodiscard]] tracked_triplet<iteration_shape<bitpack_t_>> convergence_status() const {
        return tracked_triplet{
            .current = current_steps(),
            .target = projected_steps(),
            .remaining = remaining_steps(),
        };
    }

    [[nodiscard]] const stats::ci &target_state() const { return interval_.target; }
    [[nodiscard]] const stats::ci &current_state() const { return interval_.current; }

    [[nodiscard]] const event::tally<bitpack_t_> &current_tally() const { return current_tally_; }

    [[nodiscard]] double info_gain_last_iteration() const { return last_info_bits_; }
    [[nodiscard]] double info_gain_cumulative() const { return info_gain_tracker_.cumulative_bits(); }

    [[nodiscard]] std::optional<stats::AccuracyMetrics> accuracy_metrics() const {
        std::optional<stats::AccuracyMetrics> metrics;
        if (diagnostics_enabled()) {
            metrics = stats::compute_accuracy_metrics(current_tally(), settings_.oracle_p());
        }
        return metrics;
    }
    [[nodiscard]] std::optional<stats::SamplingDiagnostics> sampling_diagnostics() const {
        std::optional<stats::SamplingDiagnostics> sampling_diagnostics;
        if (diagnostics_enabled()) {
            sampling_diagnostics = stats::compute_sampling_diagnostics(current_tally(), settings_.oracle_p(), target_state());
        }
        return sampling_diagnostics;
    }

    [[nodiscard]] static bool check_epsilon_bounded(const tracked_pair<stats::ci> &interval) {
        const auto &current = interval.current.half_width_epsilon;
        const auto &target = interval.target.half_width_epsilon;
        return current > 0 && current <= target;
    }

    [[nodiscard]] static bool check_log_epsilon_bounded(const tracked_pair<stats::ci> &interval) {
        const auto &current = interval.current.half_width_epsilon_log10;
        const auto &target = interval.target.half_width_epsilon_log10;
        //LOG(DEBUG3) << "current: " << current << ", target: " << target << ", delta: " << (target - current) << ", abs_delta: " << std::abs(target - current);
        return current > 0 && current <= target;
    }

    [[nodiscard]] bool iteration_limit_reached() const {
        const std::size_t max_iterations = manager_.shaper().TOTAL_ITERATIONS;
        return max_iterations && current_steps().iterations() >= max_iterations;
    }

    [[nodiscard]] bool burn_in_complete() const {
        return current_steps().trials() >= settings_.ci_burnin_trials();
    }

    [[nodiscard]] std::size_t burn_in_trials() const {
        return settings_.ci_burnin_trials();
    }

    [[nodiscard]] iteration_shape<bitpack_t_> burn_in_trials_shape() const {
        return iteration_shape<bitpack_t_>(manager_.shaper().SAMPLE_SHAPE, settings_.ci_burnin_trials());
    }

    [[nodiscard]] bool fixed_iterations() const {
        return manager_.shaper().TOTAL_ITERATIONS;
    }

    [[nodiscard]] iteration_shape<bitpack_t_> fixed_iterations_shape() const {
        auto shape = iteration_shape<bitpack_t_>(manager_.shaper().SAMPLE_SHAPE, 0);
        shape.iterations(manager_.shaper().TOTAL_ITERATIONS);
        return shape;
    }

    [[nodiscard]] std::size_t node_count() const {
        return manager_.node_count();
    }
};
} // namespace scram::mc::scheduler