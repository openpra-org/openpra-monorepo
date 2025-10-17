#pragma once

#include "mc/stats/ci_utils.h"
#include "mc/stats/tally.h"

#include <algorithm>
#include <cmath>
#include <boost/math/distributions/beta.hpp>
#include <boost/math/distributions/normal.hpp>
#include <boost/math/special_functions/erf.hpp>

namespace scram::mc::stats {

// -----------------------------------------------------------------------------
//  Tag types that identify the statistical strategy at *compile-time*.
// -----------------------------------------------------------------------------
struct wald_policy  { };   // classical Wald (normal approximation) interval
struct bayes_policy { };   // Beta–posterior credible interval (Jeffreys prior)

// -----------------------------------------------------------------------------
//  Internal helpers – implementation is hidden inside the detail namespace so
//  that we can specialize cleanly per-policy while exposing only one public
//  API:  ConvergencePolicy<Policy>::update(tally, rel_err, z_score)
// -----------------------------------------------------------------------------
namespace detail {

// Utility: update a tally with Wald (frequentist) formulas --------------------------------------
inline void update_wald(mc::stats::tally &t,
                        const double rel_margin_error,
                        const double z)
{
    // ------------------------------------------------------------------
    //  Ensure first- and second-order moments are up-to-date.
    // ------------------------------------------------------------------
    mc::stats::tally::compute_moments(t);

    // ------------------------------------------------------------------
    //  Linear space (probability)
    // ------------------------------------------------------------------
    const double eps_linear = half_width(t, z);                // current half-width ε
    const double p_hat      = std::max(t.mean, DELTA_EPSILON); // guard against p→0
    const double target_eps = rel_margin_error * p_hat;        // desired ε
    const std::size_t N_req_linear =
        required_trials_from_normal_quantile_two_sided(p_hat, target_eps, z);

    t.linear.epsilon        = eps_linear;
    t.linear.target_epsilon = target_eps;
    t.linear.target_trials  = N_req_linear;

    // ------------------------------------------------------------------
    //  Log-scaled probability (log10 p)
    // ------------------------------------------------------------------
    const double eps_log10  = half_width_log10(t, z);
    const double target_eps_log10 = rel_margin_error;          // currently fixed fraction
    const std::size_t N_req_log10 =
        required_trials_log10_from_normal_quantile_two_sided(p_hat, target_eps_log10, z);

    t.log10.epsilon         = eps_log10;
    t.log10.target_epsilon  = target_eps_log10;
    t.log10.target_trials   = N_req_log10;
}

// TODO: Complete Bayesian implementation.  We provide a placeholder that simply
//       falls back to the Wald update so that compilation succeeds.  The
//       signature is identical so that callers are oblivious to the strategy.
inline void update_bayes(mc::stats::tally &t,
                         const double rel_margin_error,
                         const double z)
{
    // Ensure basic sample moments are up-to-date for tools that still rely on
    // mean / std_err being populated (e.g. diagnostics, progress-bars).
    mc::stats::tally::compute_moments(t);

    using boost::math::beta_distribution;
    using boost::math::normal;

    // ------------------------------------------------------------------
    //  Jeffreys non-informative prior Beta(½,½)
    // ------------------------------------------------------------------
    constexpr double alpha0 = 0.5;
    constexpr double beta0  = 0.5;

    const std::size_t successes = t.num_one_bits;
    const std::size_t failures  = t.total_bits - t.num_one_bits;

    const double alpha = alpha0 + static_cast<double>(successes);
    const double beta  = beta0  + static_cast<double>(failures);

    // ------------------------------------------------------------------
    //  Posterior mean and credible interval (central) at the same two-sided
    //  confidence level encoded by *z*.
    // ------------------------------------------------------------------
    const double total   = alpha + beta;
    const double p_hat   = alpha / total;

    // Convert z-score → credibility γ.
    //  two-sided:  γ = 2·Φ(z) − 1
    const normal Zdist(0.0, 1.0);
    const double Phi_z   = boost::math::cdf(Zdist, z);
    const double cred_level = std::clamp(2.0 * Phi_z - 1.0, 0.0, 1.0);

    const double tail = (1.0 - cred_level) / 2.0;

    beta_distribution<> post(alpha, beta);
    const double lower = boost::math::quantile(post, tail);
    const double upper = boost::math::quantile(post, 1.0 - tail);

    const double eps_linear = (upper - lower) / 2.0;

    // ------------------------------------------------------------------
    //  Store current precision
    // ------------------------------------------------------------------
    t.linear.epsilon = eps_linear;

    const double eps_log10 = eps_linear / (p_hat * std::log(10.0));
    t.log10.epsilon  = eps_log10;

    // ------------------------------------------------------------------
    //  Desired target half-widths
    // ------------------------------------------------------------------
    const double target_eps_linear    = rel_margin_error * p_hat;
    const double target_eps_log10     = rel_margin_error;     // fixed fraction

    t.linear.target_epsilon = target_eps_linear;
    t.log10.target_epsilon  = target_eps_log10;

    // ------------------------------------------------------------------
    //  Required total sample size N ≥ z²·p(1−p)/ε²  −  (α0+β0+1)
    //  (see derivation in earlier notes).  Clamp to ≥ current N.
    // ------------------------------------------------------------------
    const double var_term   = p_hat * (1.0 - p_hat);

    const double rhs_lin = (z * z * var_term) / (target_eps_linear * target_eps_linear);
    const double rhs_log = (z * z * (1.0 - p_hat)) / (p_hat * target_eps_log10 * target_eps_log10 * std::pow(std::log(10.0), 2));

    constexpr double correction = alpha0 + beta0 + 1.0; // effective prior sample size

    const std::size_t N_req_linear = static_cast<std::size_t>(std::ceil(std::max(0.0, rhs_lin - correction)));
    const std::size_t N_req_log10 = static_cast<std::size_t>(std::ceil(std::max(0.0, rhs_log - correction)));

    t.linear.target_trials = std::max<std::size_t>(N_req_linear, t.total_bits);
    t.log10.target_trials  = std::max<std::size_t>(N_req_log10, t.total_bits);
}

} // namespace detail

// -----------------------------------------------------------------------------
//  Primary template – intentionally undefined.  Only the specializations below
//  are ever instantiated; attempting to use an unknown Policy triggers a clear
//  compiler error.
// -----------------------------------------------------------------------------
template <class Policy> struct ConvergencePolicy; // undefined

// Wald specialization ---------------------------------------------------------------------------
template <> struct ConvergencePolicy<wald_policy> {
    static void update(mc::stats::tally &t, const double rel_margin_error, const double z)
    {
        detail::update_wald(t, rel_margin_error, z);
    }
};

// Bayesian specialization -----------------------------------------------------------------------
template <> struct ConvergencePolicy<bayes_policy> {
    static void update(mc::stats::tally &t, const double rel_margin_error, const double z)
    {
        detail::update_bayes(t, rel_margin_error, z);
    }
};

// Convenience wrapper – deduces Policy from template argument -----------------------------------
template <class Policy>
inline void update_convergence(mc::stats::tally &t,
                               const double rel_margin_error,
                               const double z)
{
    ConvergencePolicy<Policy>::update(t, rel_margin_error, z);
}

} // namespace scram::mc::stats 