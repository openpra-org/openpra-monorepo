#pragma once


#include <indicators/cursor_control.hpp>
#include <indicators/dynamic_progress.hpp>
#include <indicators/progress_bar.hpp>
#include <iomanip>
#include <sstream>
#include <vector>
#include <optional>
#include <chrono>
#include <thread>
#include <condition_variable>
#include <atomic>
#include <mutex>

#include "mc/stats/diagnostics.h"
#include "mc/logger/log_benchmark.h"
#include "mc/logger/log_progress.h"

#define PRECISION_LOG_SCIENTIFIC_DIGITS 3

namespace scram::mc::scheduler {

template <typename policy_t_, typename bitpack_t_, typename prob_t_, typename size_t_>
class convergence_controller;

template <typename policy_t_, typename bitpack_t_, typename prob_t_, typename size_t_>
struct progress {

    void initialize(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> *controller, const bool watch_mode, const std::optional<std::string> &log_to_file = std::nullopt) {
        // Initialize timing for throughput tracking
        last_tick_time_ = std::chrono::high_resolution_clock::now();
        first_tick_ = true;

        // if passed a progressbar log file, initialize the logger
        if (log_to_file) {
            const std::string& filepath = *log_to_file;
            progress_logger_.emplace(filepath);
            LOG(DEBUG2) << "Progress log in :: " << filepath;
        }

        // Check if we can actually display progress bars (need TTY)
        const bool has_tty = isatty(fileno(stdout)) && isatty(fileno(stderr));
        
        // Configure progress bar only if watch mode is enabled AND we have a TTY
        if (!has_tty && !log_to_file) {
            LOG(WARNING) << "Disabling progressbar since neither STDOUT nor STDERR are TTYs.";
            watch_mode_ = false;
            return;
        }

        if (!watch_mode) {
            LOG(WARNING) << "Disabling progressbar since watch mode is disabled. Enable with --watch flag";
        }

        // Only create visual progress bars if we have a TTY, but set watch_mode_ 
        // to true if either watch_mode or log_to_file is set (for logging purposes)
        watch_mode_ = watch_mode || log_to_file;
        
        // Don't create progress bar widgets if there's no TTY to display them
        if (!has_tty) {
            LOG(WARNING) << "Disabling visual progress bars (no TTY), but continuing with logging.";
            return;
        }
        
        if (!watch_mode_) {
            return;
        }

        bars_ = std::make_unique<indicators::DynamicProgress<indicators::ProgressBar>>();
        bars_->set_option(indicators::option::HideBarWhenComplete{false});
        indicators::show_console_cursor(false);

        // all-inclusive progress bar, will be dynamically updated
        setup_fixed_bar(*controller);
        setup_burn_in_bar(*controller);
        setup_convergence_bar(*controller);
        setup_log_convergence_bar(*controller);
        setup_estimate(*controller);
        if (controller->diagnostics_enabled()) {
            setup_diagnostics(*controller);
            setup_accuracy_metrics(*controller);
        }
        setup_throughput(*controller);
        setup_info_gain(*controller);

        // Launch background worker that will handle UI refreshes without
        // blocking the sampling loop.
        worker_thread_ = std::thread([this]() { worker_loop(); });
    }

    void tick(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> *controller) {
        // Fast path: if we are *not* in watch mode, behave exactly as before.
        if (!watch_mode_) {
            // No terminal attached – fallback to lightweight logging only.
            LOG(DEBUG2) << controller->current_tally();
            return;
        }

        {
            std::lock_guard<std::mutex> lk(cv_mutex_);
            pending_controller_ = controller;
            burn_in_pending_    = false;
            tick_pending_.store(true, std::memory_order_release);
        }
        cv_.notify_one();
    }

    void finalize() {
        // Signal the worker thread to stop and wait for it to finish.
        stop_worker_ = true;
        cv_.notify_all();
        if (worker_thread_.joinable()) {
            worker_thread_.join();
        }

        indicators::show_console_cursor(true);
        for (auto &bar: owned_bars_) {
            bar->mark_as_completed();
        }
    }

    ~progress() {
        finalize();
    }

    void tick_text(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> *controller) const {
        tick_estimate_bar(*controller);
        tick_diagnostics(*controller);
        tick_accuracy_metrics(*controller);
        tick_throughput_bar(*controller);
        tick_info_gain(*controller);
    }

    // Mark the convergence bar as complete once the controller reports success.
    void mark_converged(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        tick_convergence_bar(controller);
        if (convergence_ && !bars_->operator[](*convergence_).is_completed()) {
            bars_->operator[](*convergence_).mark_as_completed();
        }
    }

    // Mark the convergence bar as complete once the controller reports success.
    void mark_log_converged(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        tick_log_convergence_bar(controller);
        if (log_convergence_ && !bars_->operator[](*log_convergence_).is_completed()) {
            bars_->operator[](*log_convergence_).mark_as_completed();
        }
    }

    // Mark the iterations bar as complete when the planned iterations finish.
    void mark_fixed_iterations_complete(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        tick_fixed_bar(controller);
        if (fixed_iterations_ && !bars_->operator[](*fixed_iterations_).is_completed()) {
            bars_->operator[](*fixed_iterations_).mark_as_completed();
        }
    }

    void mark_burn_in_complete(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        tick_burn_in(controller);
        if (burn_in_ && !bars_->operator[](*burn_in_).is_completed()) {
            bars_->operator[](*burn_in_).mark_as_completed();
        }
    }

    void tick_burn_in(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        // If watch mode is disabled we can perform the update synchronously.
        if (!watch_mode_) {
            LOG(DEBUG2) << controller.current_tally();
            return;
        }

        {
            std::lock_guard<std::mutex> lk(cv_mutex_);
            pending_controller_ = &controller;
            burn_in_pending_    = true;
            tick_pending_.store(true, std::memory_order_release);
        }
        cv_.notify_one();
    }

    void perform_normal_update(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        tick_fixed_bar(controller);
        tick_convergence_bar(controller);
        tick_log_convergence_bar(controller);
        tick_text(&controller);

        // -----------------------------------------------------------------
        //  CSV logging – one row per normal update
        // -----------------------------------------------------------------
        if (progress_logger_) {
            const auto pairs = scram::log::progress::csv_pairs(controller);
            progress_logger_->log_pairs(pairs);
        }
    }

    void perform_burn_in_update(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        tick_fixed_bar(controller);
        tick_text(&controller);

        if (burn_in_ && !bars_->operator[](*burn_in_).is_completed()) {
            auto &bar = bars_->operator[](*burn_in_);

            std::ostringstream tar_ss;
            tar_ss << std::scientific << std::setprecision(PRECISION_LOG_SCIENTIFIC_DIGITS)
                   << controller.target_state().half_width_epsilon;
            const std::string t = tar_ss.str();

            std::ostringstream cur_ss;
            cur_ss << std::scientific << std::setprecision(PRECISION_LOG_SCIENTIFIC_DIGITS)
                   << controller.current_state().half_width_epsilon;
            const std::string c = cur_ss.str();

            bar.set_option(indicators::option::PrefixText{"[burn-in]     ::      (ε)= "+c+" |      (ε₀)= "+t+" :: "});

            const auto cur_ite = controller.current_steps().iterations();
            const auto tot_ite = controller.burn_in_trials_shape().iterations();
            const std::string ite = std::to_string(cur_ite) + "/" + std::to_string(tot_ite);
            bar.set_option(indicators::option::PostfixText{"[" + ite + "]"});
            bar.set_progress(cur_ite);
        }
    }

  private:
    // Container managed by the indicators library (prints the bars)
    std::unique_ptr<indicators::DynamicProgress<indicators::ProgressBar>> bars_;

    // We must keep the ProgressBar objects alive for as long as the DynamicProgress
    // references them.  Store owning pointers here.
    std::vector<std::unique_ptr<indicators::ProgressBar>> owned_bars_;

    // Indices into `bars_`; use std::optional so that index 0 is not interpreted
    // as *false*.
    std::optional<std::size_t> burn_in_{};
    std::optional<std::size_t> convergence_{};
    std::optional<std::size_t> log_convergence_{};
    std::optional<std::size_t> fixed_iterations_{};
    std::optional<std::size_t> accuracy_metrics_{};
    std::optional<std::size_t> diagnostics_{};
    std::optional<std::size_t> estimate_{};
    std::optional<std::size_t> throughput_{};
    std::optional<std::size_t> info_gain_{};  // new info-gain line
    std::optional<std::size_t> all_inclusive_progress_{};

    static constexpr std::uint8_t bar_width_ = 30;
    // Throughput tracking state
    mutable std::chrono::high_resolution_clock::time_point last_tick_time_;
    mutable bool first_tick_ = true;
    mutable std::size_t last_iteration_ = 0;

    // timing state for info-gain rate
    mutable std::chrono::high_resolution_clock::time_point last_info_time_{};
    mutable bool first_info_tick_ = true;
    mutable double prev_info_total_bits_ = 0.0;
    mutable std::size_t prev_info_iteration_ = 0;

    bool watch_mode_ = false;

    mutable std::optional<scram::log::BenchmarkLogger> progress_logger_{};

    // -------------------------------------------------------------------------
    // Deferred tick machinery.  Updates to the (potentially slow) terminal UI
    // should not block the main sampling loop.  Instead, we queue a request and
    // let a background worker satisfy it at most once every PERIOD.  This keeps
    // the main thread free while still providing timely progress feedback.
    // -------------------------------------------------------------------------

    // Limit UI refreshes to PERIOD ms
    static constexpr std::chrono::milliseconds PERIOD{std::chrono::milliseconds(100)};

    // Set by the main thread to request a UI refresh. Cleared by the worker
    // once the refresh has been executed.
    mutable std::atomic<bool> tick_pending_{false};

    // True if the pending request refers to a burn-in update (rather than a
    // regular convergence update).
    mutable bool burn_in_pending_{false};

    // Pointer to the controller associated with the pending request.  We only
    // ever have one controller per progress instance, so keeping a raw pointer
    // is safe as long as the controller out-lives *this* progress object.
    mutable const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_>* pending_controller_{nullptr};

    // Synchronisation primitives for the worker thread.
    mutable std::mutex cv_mutex_;
    mutable std::condition_variable cv_;
    std::thread worker_thread_;
    std::atomic<bool> stop_worker_{false};

    // ---------------------------------------------------------------------
    // Background worker implementation
    // ---------------------------------------------------------------------

    void worker_loop() {
        std::unique_lock<std::mutex> lock(cv_mutex_);
        auto last_exec = std::chrono::high_resolution_clock::now();

        while (!stop_worker_) {
            // Wait until there is work or until we are asked to stop
            cv_.wait(lock, [this]() {
                return tick_pending_.load(std::memory_order_acquire) || stop_worker_.load();
            });

            if (stop_worker_) {
                break;
            }

            // Ensure we do not execute updates more often than PERIOD
            auto now = std::chrono::high_resolution_clock::now();
            if (now - last_exec < PERIOD) {
                auto remaining = PERIOD - (now - last_exec);

                // Wait for the remaining time *or* until we are asked to stop.
                cv_.wait_for(lock, remaining, [this, &last_exec]() {
                    // Wake early only if we are shutting down or the rate limit expired.
                    return stop_worker_.load() || (std::chrono::high_resolution_clock::now() - last_exec >= PERIOD);
                });

                if (stop_worker_) {
                    break;
                }

                // After the timed wait the period may still not have elapsed (spurious wake-up).
                now = std::chrono::high_resolution_clock::now();
                if (now - last_exec < PERIOD) {
                    // Too early – go back to the top of the loop and wait again.
                    continue;
                }
            }

            if (!tick_pending_.load(std::memory_order_acquire)) {
                // Spurious wake-up or the pending flag cleared elsewhere.
                continue;
            }

            // Capture state for the update
            const auto controller = pending_controller_;
            const bool is_burn_in  = burn_in_pending_;

            // Reset request state before releasing the lock so that new
            // requests can be queued while we are performing the expensive
            // terminal update.
            tick_pending_.store(false, std::memory_order_release);
            lock.unlock();

            if (controller) {
                if (is_burn_in) {
                    perform_burn_in_update(*controller);
                } else {
                    perform_normal_update(*controller);
                }
            }

            last_exec = std::chrono::high_resolution_clock::now();
            lock.lock();
        }
    }

    indicators::ProgressBar &add_text(std::optional<std::size_t> &idx, const std::optional<std::string> &pretext) {
        if (!idx) {
            auto bar_ptr = make_text(pretext);
            idx = bars_->push_back(*bar_ptr);
            owned_bars_.push_back(std::move(bar_ptr));
        }
        return bars_->operator[](*idx);
    }

    indicators::ProgressBar &add_iterations_bar(std::optional<std::size_t> &idx, const std::size_t count = 0) {
        if (!idx) {
            auto bar_ptr = make_iterations_progress_bar(count);
            idx = bars_->push_back(*bar_ptr);
            owned_bars_.push_back(std::move(bar_ptr));
        }
        return bars_->operator[](*idx);
    }

    void setup_burn_in_bar(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) {
        if (controller.burn_in_trials()) {
            auto &bar = add_iterations_bar(burn_in_);
            const auto tot_ite = controller.burn_in_trials_shape().iterations();
            bar.set_option(indicators::option::BarWidth{bar_width_});
            bar.set_option(indicators::option::MaxProgress{tot_ite});
            bar.set_option(indicators::option::ShowPercentage{true});
            bar.set_option(indicators::option::ShowElapsedTime{true});
            bar.set_option(indicators::option::ShowRemainingTime{true});
            bar.set_option(indicators::option::ForegroundColor{indicators::Color::white});
            tick_burn_in(controller);
        }
    }

    void setup_fixed_bar(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) {
        if (controller.fixed_iterations()) {
            auto &bar = add_iterations_bar(fixed_iterations_);
            const auto tot_ite = controller.fixed_iterations_shape().iterations();
            bar.set_option(indicators::option::PrefixText{"[fixed]       :: "});
            bar.set_option(indicators::option::BarWidth{bar_width_*2+2});
            bar.set_option(indicators::option::MinProgress{0});
            bar.set_option(indicators::option::MaxProgress{tot_ite});
            bar.set_option(indicators::option::ShowPercentage{true});
            bar.set_option(indicators::option::ShowElapsedTime{true});
            bar.set_option(indicators::option::ShowRemainingTime{true});
            bar.set_option(indicators::option::ForegroundColor{indicators::Color::white});
            tick_fixed_bar(controller);
        }
    }

    void setup_convergence_bar(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) {
        auto &bar = add_iterations_bar(convergence_);
        bar.set_option(indicators::option::BarWidth{bar_width_});
        bar.set_option(indicators::option::ForegroundColor{indicators::Color::white});
    }

    void setup_log_convergence_bar(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) {
        auto &bar = add_iterations_bar(log_convergence_);
        bar.set_option(indicators::option::BarWidth{bar_width_});
        bar.set_option(indicators::option::ForegroundColor{indicators::Color::white});
    }

    void setup_throughput(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) {
        auto &bar = add_text(throughput_, "[throughput]  ::");
        bar.set_option(indicators::option::ForegroundColor{indicators::Color::magenta});
    }

    void setup_info_gain(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) {
        auto &bar = add_text(info_gain_, "[info-gain]   ::");
        bar.set_option(indicators::option::ForegroundColor{indicators::Color::cyan});
    }

    void setup_estimate(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) {
        auto &bar = add_text(estimate_, "[estimate]    ::");
        bar.set_option(indicators::option::ForegroundColor{indicators::Color::yellow});
    }

    void setup_accuracy_metrics(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) {
        std::ostringstream true_p_ss;
        true_p_ss << std::scientific << std::setprecision(PRECISION_LOG_SCIENTIFIC_DIGITS) << controller.ground_truth();
        const std::string str_prefix = "[accuracy]    :: true(p)= "+true_p_ss.str()+" |";
        auto &bar = add_text(accuracy_metrics_, str_prefix);
        bar.set_option(indicators::option::ForegroundColor{indicators::Color::white});
    }

    void setup_diagnostics(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) {
        auto &bar = add_text(diagnostics_,"[diagnostics] ::");
        bar.set_option(indicators::option::ForegroundColor{indicators::Color::green});
    }

    void tick_convergence_bar(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        if (convergence_ && !bars_->operator[](*convergence_).is_completed()) {
            auto &bar = bars_->operator[](*convergence_);
            const auto cur_ite = controller.current_steps().iterations();
            const auto projected_ite = controller.projected_steps_epsilon().iterations();
            const std::string ite = std::to_string(cur_ite) + "/" + std::to_string(projected_ite);
            std::ostringstream tar_ss;
            tar_ss << std::scientific << std::setprecision(PRECISION_LOG_SCIENTIFIC_DIGITS) << controller.target_state().half_width_epsilon;
            const std::string t = tar_ss.str();
            std::ostringstream cur_ss;
            cur_ss << std::scientific << std::setprecision(PRECISION_LOG_SCIENTIFIC_DIGITS) << controller.current_state().half_width_epsilon;
            const std::string c = cur_ss.str();
            bar.set_option(indicators::option::PrefixText{"[convergence] ::      (ε)= "+c+" |      (ε₀)= "+t+" :: "});
            bar.set_option(indicators::option::PostfixText{"["+ite+"]"});
            bar.set_option(indicators::option::MinProgress{0});
            bar.set_option(indicators::option::MaxProgress{projected_ite}); // moving target
            bar.set_option(indicators::option::ShowPercentage{true});
            bar.set_option(indicators::option::ShowElapsedTime{true});
            bar.set_option(indicators::option::ShowRemainingTime{true});
            bar.set_progress(cur_ite);
        }
    }

    void tick_log_convergence_bar(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        if (log_convergence_ && !bars_->operator[](*log_convergence_).is_completed()) {
            auto &bar = bars_->operator[](*log_convergence_);
            const auto cur_ite = controller.current_steps().iterations();
            const auto projected_ite = controller.projected_steps_epsilon_log10().iterations();
            const std::string ite = std::to_string(cur_ite) + "/" + std::to_string(projected_ite);
            std::ostringstream tar_ss;
            tar_ss << std::scientific << std::setprecision(PRECISION_LOG_SCIENTIFIC_DIGITS) << controller.target_state().half_width_epsilon_log10;
            const std::string t = tar_ss.str();
            std::ostringstream cur_ss;
            cur_ss << std::scientific << std::setprecision(PRECISION_LOG_SCIENTIFIC_DIGITS) << controller.current_state().half_width_epsilon_log10;
            const std::string c = cur_ss.str();
            bar.set_option(indicators::option::PrefixText{"[log10-conv]  :: log10(ε)= "+c+" | log10(ε₀)= "+t+" :: "});
            bar.set_option(indicators::option::PostfixText{"["+ite+"]"});
            bar.set_option(indicators::option::MinProgress{0});
            bar.set_option(indicators::option::MaxProgress{projected_ite}); // moving target
            bar.set_option(indicators::option::ShowPercentage{true});
            bar.set_option(indicators::option::ShowElapsedTime{true});
            bar.set_option(indicators::option::ShowRemainingTime{true});
            bar.set_progress(cur_ite);
        }
    }

    void tick_fixed_bar(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        if (fixed_iterations_ && !bars_->operator[](*fixed_iterations_).is_completed()) {
            auto &bar = bars_->operator[](*fixed_iterations_);
            const auto cur_ite = controller.current_steps().iterations();
            const auto tot_ite = controller.fixed_iterations_shape().iterations();
            const std::string ite = std::to_string(cur_ite) + "/" + std::to_string(tot_ite);
            bar.set_option(indicators::option::PostfixText{"["+ite+"]"});
            bar.set_progress(cur_ite);
        }
    }

    void tick_estimate_bar(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        if (!estimate_) {
            return;
        }
        auto &bar = bars_->operator[](*estimate_);
        std::ostringstream ss;
        ss << std::scientific << std::setprecision(5) << controller.current_tally();
        bar.set_option(indicators::option::PostfixText{ss.str()});
    }

    void tick_diagnostics(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        if (!diagnostics_) {
            return;
        }
        auto &bar = bars_->operator[](*diagnostics_);
        std::ostringstream ss;
        ss << std::scientific << std::setprecision(PRECISION_LOG_SCIENTIFIC_DIGITS) << *controller.sampling_diagnostics();
        bar.set_option(indicators::option::PostfixText{ss.str()});
    }

    void tick_accuracy_metrics(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        if (!accuracy_metrics_) {
            return;
        }
        auto &bar = bars_->operator[](*accuracy_metrics_);
        std::ostringstream metrics_ss;
        metrics_ss << std::scientific << std::setprecision(PRECISION_LOG_SCIENTIFIC_DIGITS) << *controller.accuracy_metrics();
        bar.set_option(indicators::option::PostfixText{metrics_ss.str()});
    }


    void tick_throughput_bar(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        if (!throughput_) {
            return;
        }

        auto &bar = bars_->operator[](*throughput_);

        const auto current_time = std::chrono::high_resolution_clock::now();
        const auto current_iteration = controller.current_steps().iterations();

        if (first_tick_) {
            first_tick_ = false;
            last_tick_time_ = current_time;
            last_iteration_ = current_iteration;
            bar.set_option(indicators::option::PostfixText{"initializing..."});
            return;
        }

        const auto elapsed_time = std::chrono::duration_cast<std::chrono::duration<double>>(current_time - last_tick_time_).count();
        const auto iterations_delta = current_iteration - last_iteration_;

        if (elapsed_time <= 0.0 || iterations_delta == 0) {
            return; // Avoid division by zero
        }

        // Calculate iterations per second or seconds per iteration
        const double iterations_per_sec = static_cast<double>(iterations_delta) / elapsed_time;
        std::string iter_rate_str;
        if (iterations_per_sec >= 1.0) {
            std::ostringstream ss;
            ss << std::fixed << std::setprecision(2) << iterations_per_sec << " it/s";
            iter_rate_str = ss.str();
        } else {
            const double sec_per_iteration = elapsed_time / static_cast<double>(iterations_delta);
            std::ostringstream ss;
            ss << std::fixed << std::setprecision(2) << sec_per_iteration << " s/it";
            iter_rate_str = ss.str();
        }

       //  Calculate bits per iteration with appropriate units
        // const std::double_t bits_per_iteration_whole_graph = static_cast<double_t>(controller.fixed_iterations_shape().trials_per_iteration());
        const std::double_t bits_per_iteration_per_node = static_cast<double_t>(controller.fixed_iterations_shape().trials_per_iteration());
        const std::double_t nodes_per_graph = static_cast<double_t>(controller.node_count());
        // const std::double_t bits_per_iteration = bits_per_iteration_whole_graph;
         std::string bits_iter_node_str;
        if (bits_per_iteration_per_node >= 1024 * 1024 * 1024) {
            std::ostringstream ss;
            ss << std::fixed << std::setprecision(2) << bits_per_iteration_per_node / (1024.0 * 1024.0 * 1024.0) << " Gbit/node/it";
            bits_iter_node_str = ss.str();
        } else if (bits_per_iteration_per_node >= 1024 * 1024) {
             std::ostringstream ss;
             ss << std::fixed << std::setprecision(2) << bits_per_iteration_per_node / (1024.0 * 1024.0) << " Mbit/node/it";
             bits_iter_node_str = ss.str();
         } else if (bits_per_iteration_per_node >= 1024) {
             std::ostringstream ss;
             ss << std::fixed << std::setprecision(2) << bits_per_iteration_per_node / 1024.0 << " kbit/node/it";
             bits_iter_node_str = ss.str();
         } else {
             std::ostringstream ss;
             ss << bits_per_iteration_per_node << " bit/node/it";
             bits_iter_node_str = ss.str();
         }

         // Calculate bits per second with appropriate units
         const double bits_per_node_sec = static_cast<double>(bits_per_iteration_per_node * iterations_delta) / elapsed_time;
         std::string bits_sec_node_str;
        if (bits_per_node_sec >= 1024.0 * 1024.0 * 1024.0) {
            std::ostringstream ss;
            ss << std::fixed << std::setprecision(2) << bits_per_node_sec / (1024.0 * 1024.0 * 1024.0) << " Gbit/node/s";
            bits_sec_node_str = ss.str();
        } else if (bits_per_node_sec >= 1024.0 * 1024.0) {
             std::ostringstream ss;
             ss << std::fixed << std::setprecision(2) << bits_per_node_sec / (1024.0 * 1024.0) << " Mbit/node/s";
             bits_sec_node_str = ss.str();
         } else if (bits_per_node_sec >= 1024.0) {
             std::ostringstream ss;
             ss << std::fixed << std::setprecision(2) << bits_per_node_sec / 1024.0 << " kbit/node/s";
             bits_sec_node_str = ss.str();
         } else {
             std::ostringstream ss;
             ss << std::fixed << std::setprecision(2) << bits_per_node_sec << " bit/node/s";
             bits_sec_node_str = ss.str();
         }

         // Global Metrics
         const auto nodes = static_cast<std::double_t>(controller.node_count());
         std::string bits_iter_str;
         std::string bits_sec_str;
         if (nodes >= 1) {
             const double bits_iter = bits_per_iteration_per_node * nodes;
             const double bits_sec  = bits_per_node_sec * nodes;

             if (bits_iter >= 1024.0 * 1024.0 * 1024.0) {
                 std::ostringstream ss; ss << std::fixed << std::setprecision(2) << bits_iter / (1024.0*1024.0*1024.0) << " Gbit/it"; bits_iter_str = ss.str();
             } else if (bits_iter >= 1024.0 * 1024.0) {
                 std::ostringstream ss; ss << std::fixed << std::setprecision(2) << bits_iter / (1024.0*1024.0) << " Mbit/it"; bits_iter_str = ss.str();
             } else if (bits_iter >= 1024.0) {
                 std::ostringstream ss; ss << std::fixed << std::setprecision(2) << bits_iter / 1024.0 << " kbit/it"; bits_iter_str = ss.str();
             } else {
                 std::ostringstream ss; ss << std::fixed << std::setprecision(2) << bits_iter << " bit/it"; bits_iter_str = ss.str();
             }

             if (bits_sec >= 1024.0 * 1024.0 * 1024.0) {
                 std::ostringstream ss; ss << std::fixed << std::setprecision(2) << bits_sec / (1024.0*1024.0*1024.0) << " Gbit/s"; bits_sec_str = ss.str();
             } else if (bits_sec >= 1024.0 * 1024.0) {
                 std::ostringstream ss; ss << std::fixed << std::setprecision(2) << bits_sec / (1024.0*1024.0) << " Mbit/s"; bits_sec_str = ss.str();
             } else if (bits_sec >= 1024.0) {
                 std::ostringstream ss; ss << std::fixed << std::setprecision(2) << bits_sec / 1024.0 << " kbit/s"; bits_sec_str = ss.str();
             } else {
                 std::ostringstream ss; ss << std::fixed << std::setprecision(2) << bits_sec << " bit/s"; bits_sec_str = ss.str();
             }
         }

         // Combine all metrics into a single line
        const std::string global_stats = bits_iter_str + " | " +bits_sec_str;
        const std::string node_stats = bits_iter_node_str + " | " +bits_sec_node_str;
        const std::string throughput_text = iter_rate_str + " | " + global_stats + " | " + node_stats;

         bar.set_option(indicators::option::PostfixText{throughput_text});

         // Update state for next tick
         last_tick_time_ = current_time;
         last_iteration_ = current_iteration;
    }

    void tick_info_gain(const convergence_controller<policy_t_, bitpack_t_, prob_t_, size_t_> &controller) const {
        if (!info_gain_) {
            return;
        }

        auto &bar = bars_->operator[](*info_gain_);

        const double total_bits = controller.info_gain_cumulative();

        if (total_bits == 0.0) {
            bar.set_option(indicators::option::PostfixText{"initializing..."});
            return;
        }

        // Time delta for rate
        const auto now = std::chrono::high_resolution_clock::now();
        double seconds = 0.0;
        if (first_info_tick_) {
            first_info_tick_ = false;
            last_info_time_ = now;
        } else {
            seconds = std::chrono::duration<double>(now - last_info_time_).count();
            last_info_time_ = now;
        }

        const double delta_bits = total_bits - prev_info_total_bits_;

        double bits_per_sec = std::numeric_limits<double>::quiet_NaN();
        if (seconds > 0.0) {
            bits_per_sec = delta_bits / seconds;
        }

        const std::size_t current_iteration = controller.current_steps().iterations();
        const std::size_t iterations_delta  = current_iteration - prev_info_iteration_;

        // bits per iteration
        double bits_per_iter = std::numeric_limits<double>::quiet_NaN();
        if (iterations_delta > 0) {
            bits_per_iter = delta_bits / static_cast<double>(iterations_delta);
        }

        // Format human-friendly strings
        auto format_bits = [](double bits) {
            std::ostringstream oss;
            bits = std::abs(bits);
            if (std::isnan(bits)) {
                oss << "nan bit";
            } else if (bits >= 1024.0 * 1024.0) {
                oss << std::fixed << std::setprecision(6) << bits / (1024.0 * 1024.0) << " Mbit";
            } else if (bits >= 1024.0) {
                oss << std::fixed << std::setprecision(6) << bits / 1024.0 << " kbit";
            } else {
                oss << std::fixed << std::setprecision(6) << bits << " bit";
            }
            return oss.str();
        };

        const std::string rate_str  = format_bits(bits_per_sec) + "/s";
        const std::string iter_str  = format_bits(bits_per_iter) + "/iter";
        const std::string total_str = "Σ " + format_bits(total_bits);

        bar.set_option(indicators::option::PostfixText{rate_str + " | " + iter_str + " | " + total_str});

        prev_info_total_bits_ = total_bits;
        prev_info_iteration_  = current_iteration;
    }


    static std::unique_ptr<indicators::ProgressBar> make_iterations_progress_bar(const std::size_t max_iterations = 0) {
        //const std::string str_ite = "0/" + max_iterations;
        //const std::string str_prefix = "["+str_ite+"] :: ";
        return std::make_unique<indicators::ProgressBar>(
            indicators::option::BarWidth{bar_width_},
            indicators::option::PrefixText{""},
            indicators::option::PostfixText{""},
            indicators::option::Start{"["},
            indicators::option::Fill{"■"},
            indicators::option::Lead{"■"},
            indicators::option::Remainder{"-"},
            indicators::option::End{"]"});
    }

    static std::unique_ptr<indicators::ProgressBar> make_text(const std::optional<std::string> &pretext) {
        return std::make_unique<indicators::ProgressBar>(
            indicators::option::BarWidth{0},
            indicators::option::PrefixText{pretext ? *pretext : ""},
            indicators::option::PostfixText{""},
            indicators::option::Start{""},
            indicators::option::Fill{""},
            indicators::option::Lead{""},
            indicators::option::Remainder{""},
            indicators::option::End{""},
            indicators::option::ForegroundColor{indicators::Color::white},
            indicators::option::ShowPercentage{false},
            indicators::option::ShowElapsedTime{false},
            indicators::option::ShowRemainingTime{false});
    }

};
} // namespace scram::mc::scheduler