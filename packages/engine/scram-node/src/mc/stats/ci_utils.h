#pragma once

#include <cmath>
#include <cstddef>
#include <algorithm>

#include "mc/event/node.h"

namespace scram::mc::stats {

static constexpr std::double_t DELTA_EPSILON = 1.0e-12;

struct ci {
    std::double_t half_width_epsilon;
    std::double_t half_width_epsilon_log10;
    std::double_t two_sided_confidence_level;
    std::double_t normal_quantile_two_sided;
};

/**
 * Two-sided normal quantile: returns \(z\) such that
 *     P(|Z| ≤ z) = confidence               (Z ~ N(0,1)).
 * In other words the function computes Φ⁻¹(1−α/2) where
 *     α = 1 − confidence.
 *
 * Implementation  =  Acklam’s rational approximation (2003)
 * which reproduces the inverse CDF to < 5·10⁻¹⁶ over (0,1).
 * See also A&S 26.2.23.
 */
[[nodiscard]] inline double normal_quantile_two_sided(const double confidence) {
    // Clamp to a sensible open interval to avoid infinities / NaNs.
    const double p = std::clamp(confidence, DELTA_EPSILON, 1.0 - DELTA_EPSILON);
    // Two-sided: need quantile(1 − α/2) where α = 1-confidence
    const double alpha = 1.0 - p;
    const double q = 1.0 - alpha / 2.0;   // central CDF point

    // -----------------------------------------------------------------
    //  Inverse normal CDF (Acklam 2003).  Max error ~5e-16.
    // -----------------------------------------------------------------
    static constexpr double a[] = {
        -3.969683028665376e+01,
         2.209460984245205e+02,
        -2.759285104469687e+02,
         1.383577518672690e+02,
        -3.066479806614716e+01,
         2.506628277459239e+00};

    static constexpr double b[] = {
        -5.447609879822406e+01,
         1.615858368580409e+02,
        -1.556989798598866e+02,
         6.680131188771972e+01,
        -1.328068155288572e+01};

    static constexpr double c[] = {
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e+00,
        -2.549732539343734e+00,
         4.374664141464968e+00,
         2.938163982698783e+00};

    static constexpr double d[] = {
         7.784695709041462e-03,
         3.224671290700398e-01,
         2.445134137142996e+00,
         3.754408661907416e+00};

    // Define break-points.
    constexpr double plow  = 0.02425;
    constexpr double phigh = 1 - plow;

    double x;
    if (q < plow) {
        // Rational approximation for lower region
        const double u = std::sqrt(-2.0 * std::log(q));
        x = (((((c[0]*u + c[1])*u + c[2])*u + c[3])*u + c[4])*u + c[5]) /
            ((((d[0]*u + d[1])*u + d[2])*u + d[3])*u + 1.0);
    } else if (phigh < q) {
        // Rational approximation for upper region
        const double u = std::sqrt(-2.0 * std::log(1.0 - q));
        x = -(((((c[0]*u + c[1])*u + c[2])*u + c[3])*u + c[4])*u + c[5]) /
             ((((d[0]*u + d[1])*u + d[2])*u + d[3])*u + 1.0);
    } else {
        // Rational approximation for central region
        const double u = q - 0.5;
        const double t = u * u;
        x = (((((a[0]*t + a[1])*t + a[2])*t + a[3])*t + a[4])*t + a[5])*u /
            (((((b[0]*t + b[1])*t + b[2])*t + b[3])*t + b[4])*t + 1.0);
    }
    return x;
}

// Backwards-compatibility wrapper (to be removed).
[[deprecated("Use normal_quantile_two_sided")]]
[[nodiscard]] inline double z_score(const double confidence) {
    return normal_quantile_two_sided(confidence);
}

/**
 * Sample-size formula for a Bernoulli proportion.
 *   N ≥ z² · p(1-p) / ε²
 * where ε is the desired half-width (margin of error).
 */
[[nodiscard]] inline std::size_t required_trials(const double p,
                                                const double eps,
                                                const double confidence) {
    const double z  = normal_quantile_two_sided(confidence);
    const double pq = p * (1.0 - p);
    return static_cast<std::size_t>(std::ceil((z * z * pq) / (eps * eps)));
}

/**
 * Sample-size formula for a Bernoulli proportion.
 *   N ≥ z² · p(1-p) / ε²
 * where ε is the desired half-width (margin of error).
 */
[[nodiscard]] inline std::size_t required_trials_from_normal_quantile_two_sided(const std::double_t &p,
                                                                                const std::double_t &epsilon,
                                                                                const std::double_t &normal_quantile_two_sided) {
    const std::double_t &z  = normal_quantile_two_sided;
    const double pq = p * (1.0 - p);
    return static_cast<std::size_t>(std::ceil((z * z * pq) / (epsilon * epsilon)));
}

// Return the half-width (margin of error) of the confidence interval for a
// given Z-score.  Call this after `populate_point_estimates` so that `std_err`
// has been initialized.
template <typename tally_t_>
[[nodiscard]] inline double half_width(const tally_t_ &tally, const double z) {
    return z * tally.std_err;
}

template <typename tally_t_>
inline double half_width_log10(const tally_t_ &tally, const double z) {
    const double p = std::max(tally.mean, DELTA_EPSILON);
    return z * tally.std_err / (p * std::log(10.0));
}

inline std::size_t required_trials_log10_from_normal_quantile_two_sided(const double p, const double eps_log10, const double z) {
    const double denom = p * eps_log10 * eps_log10 * std::log(10.0) * std::log(10.0);
    return static_cast<std::size_t>(std::ceil(z * z * (1.0 - p) / denom));
}

/**
 * Inverted sample-size formula: compute the achievable margin of error ε
 * given a fixed sample budget N.
 *   ε = z · √[p(1-p) / N]
 * This tells you the best possible half-width you can achieve with N trials.
 */
[[nodiscard]] inline std::double_t epsilon_from_trials(const std::double_t p, const std::size_t N, const std::double_t z) {
    if (N == 0) return std::numeric_limits<std::double_t>::infinity();
    const std::double_t pq = p * (1.0 - p);
    const std::double_t epsilon = z * std::sqrt(pq / static_cast<std::double_t>(N));
    return epsilon;
}

// Add helper functions for tally post-processing ---------------------------------------------------
// These routines move the statistical post-processing that used to live in the
// SYCL tally kernel to the host side.  They work directly with the `event::tally`
// struct which only needs the raw counters (`num_one_bits`, `total_bits`) that
// the device kernel fills in.

// Populate the point estimates (mean probability and standard error) for a tally
// object based only on its raw counters.  The function is templated so that it
// works with any specialisation of `event::tally<bitpack_t_>`.
template <typename tally_t_>
inline tally_t_ &populate_point_estimates(tally_t_ &tally) {
    if (tally.total_bits == 0) {
        // Avoid division-by-zero – this generally means no samples have been
        // processed yet.  Leave everything zero-initialised.
        tally.mean    = 0.0;
        tally.std_err = 0.0;
        tally.ci      = {0.0, 0.0, 0.0, 0.0};
        return tally;
    }

    const auto total_bits_d = static_cast<std::double_t>(tally.total_bits);
    const auto p     = static_cast<std::double_t>(tally.num_one_bits) / total_bits_d;

    tally.mean    = p;
    tally.std_err = std::sqrt(p * (1.0 - p) / total_bits_d);

    // ------------------------------------------------------------------
    //  Confidence intervals (two-sided) – lower/upper 5% and 1%
    // ------------------------------------------------------------------
    constexpr double z_95 = 1.959963984540054;   // 95% two-sided → 2.5% tails
    constexpr double z_99 = 2.5758293035489004;  // 99% two-sided → 0.5% tails

    const double hw95 = half_width(tally, z_95);
    const double hw99 = half_width(tally, z_99);

    const std::double_t lower95 = std::clamp(p - hw95, 0.0, 1.0);
    const std::double_t upper95 = std::clamp(p + hw95, 0.0, 1.0);
    const std::double_t lower99 = std::clamp(p - hw99, 0.0, 1.0);
    const std::double_t upper99 = std::clamp(p + hw99, 0.0, 1.0);

    tally.ci = { lower95, upper95, lower99, upper99 };

    return tally;
}

} // namespace scram::mc::stats