#pragma once
#include "mc/stats/info_gain.h"

#include <array>
#include <ostream>
#include <cmath>
#include <algorithm>

namespace scram::mc::stats {

struct convergence_result {
    std::double_t epsilon         = 0.0;        // current half-width ε
    std::double_t target_epsilon  = 0.0;        // desired precision εₜ
    std::size_t   target_trials  = 0;          // projected trials to reach εₜ
};

// to be used by probability_analysis
struct tally {
    /// @brief Count of positive outcomes (1-bits) across all samples
    std::size_t num_one_bits = 0;

    /// @brief Count of total outcomes evaluated so far
    std::size_t total_bits = 0;

    /// @brief Estimated mean probability based on sample proportion
    std::double_t mean = 0.;

    /// @brief Standard error of the probability estimate
    std::double_t std_err = 0.;

    std::array<double_t, 4> ci = {0., 0., 0., 0.};
    convergence_result linear{};
    convergence_result log10{};
    stats::info_gain info_gain{};

    tally &compute() {
        return update(num_one_bits, total_bits);
    }

    std::double_t half_width(const std::double_t z) const {
        return this->std_err * z;
    }

    std::double_t update_entropy(const std::size_t prev_ones, const std::size_t prev_total) {
        const std::size_t delta_ones = num_one_bits - prev_ones;
        const std::size_t zeros = total_bits - num_one_bits;
        const std::size_t prev_zeros = prev_total - prev_ones;
        const std::size_t delta_zeros  = zeros - prev_zeros;
        return info_gain.add_batch(delta_ones, delta_zeros);
    }

    static tally &compute_moments(tally &to_compute) {
        const auto total = static_cast<std::double_t>(to_compute.total_bits);
        to_compute.mean = total ? static_cast<std::double_t>(to_compute.num_one_bits) / total : 0.;
        to_compute.std_err = total ? std::sqrt(to_compute.mean * (1.0 - to_compute.mean) /total) : 0.;
        return to_compute;
    }

    static tally &compute_ci(tally &to_compute) {
        // ------------------------------------------------------------------
        //  Confidence intervals (two-sided) – lower/upper 5% and 1%
        // ------------------------------------------------------------------
        constexpr double z_95 = 1.959963984540054;   // 95% two-sided → 2.5% tails
        constexpr double z_99 = 2.5758293035489004;  // 99% two-sided → 0.5% tails

        const double hw95 = to_compute.half_width(z_95);
        const double hw99 = to_compute.half_width(z_99);

        const std::double_t lower95 = std::clamp(to_compute.mean - hw95, 0.0, 1.0);
        const std::double_t upper95 = std::clamp(to_compute.mean + hw95, 0.0, 1.0);
        const std::double_t lower99 = std::clamp(to_compute.mean - hw99, 0.0, 1.0);
        const std::double_t upper99 = std::clamp(to_compute.mean + hw99, 0.0, 1.0);

        to_compute.ci = { lower95, upper95, lower99, upper99 };
        return to_compute;
    }

    template <typename device_tally_type>
    tally &update(const device_tally_type &device_tally) {
        return update(device_tally->num_one_bits, device_tally->total_bits);
    }

    tally &update(const std::size_t ones, const std::size_t all) {
        // clear all
        if (all == 0) {
            *this = tally{};
            return *this;
        }

        const std::size_t one_bits_before_update = num_one_bits;
        const std::size_t total_bits_before_update = total_bits;
        num_one_bits = ones;
        total_bits = all;

        compute_ci(compute_moments(*this));

        update_entropy(one_bits_before_update, total_bits_before_update);

        return *this;
    }
};

inline std::ostream &operator<<(std::ostream &os, const convergence_result &r) {
    os << std::scientific << std::setprecision(3)
       << "cur(ε)= " << r.epsilon << "  |  "
       << "tar(ε)= " << r.target_epsilon << "  |  "
       << "tar(N)= " << r.target_trials;
    return os;
}

/// Pretty-print tally statistics in a compact, column-aligned format.
inline std::ostream &operator<<(std::ostream &os, const tally &t) {
    os << std::scientific << std::setprecision(3)
    << "µ= " << t.mean << "  |  "
   << "SE= " << t.std_err << "  |  "
   << "linear= " << t.linear << "  |  "
   << "log_10= " << t.log10;
    return os;
}



} // namespace scram::mc::stats