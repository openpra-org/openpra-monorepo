#pragma once

/*
 * @file info_gain.h
 * @brief Helper routines to compute Shannon information gain for a Bernoulli
 *        probability estimated with a Beta prior/posterior.
 *
 * The Monte-Carlo engine represents the unknown failure probability *p* with a
 * conjugate Beta(α, β) distribution.  After each batch of Bernoulli trials the
 * parameters are updated
 *
 *     α ← α + #successes,
 *     β ← β + #failures.
 *
 * The expected Shannon information gained from that batch is the *reduction of
 * entropy* of the Beta distribution,
 *
 *     I  =  H(Beta(α_prev, β_prev)) − H(Beta(α_new, β_new)) [bits].
 *
 * This header provides:
 *   • beta_entropy_*       – Shannon entropy of a Beta distribution (nats/bits)
 *   • information_gain_*   – entropy reduction between two Beta states
 *   • info_gain_per_second – convenience wrapper to normalise by wall-time
 *
 * References
 * ----------
 *   H(Beta) = ln B(α,β) − (α−1)ψ(α) − (β−1)ψ(β) + (α+β−2)ψ(α+β)
 *   where  ψ  is the digamma function and  B  the Beta function.
 */

#include <boost/math/special_functions/digamma.hpp>
#include <cmath>

namespace scram::mc::stats {

// -----------------------------------------------------------------------------
//  Internal helpers
// -----------------------------------------------------------------------------
namespace detail {
    // Natural-log Beta:  ln B(a,b) = lgamma(a)+lgamma(b)−lgamma(a+b)
    [[nodiscard]] inline double ln_beta(const double a, const double b)
    {
        return std::lgamma(a) + std::lgamma(b) - std::lgamma(a + b);
    }
} // namespace detail

// -----------------------------------------------------------------------------
//  Entropy of Beta(α,β)
// -----------------------------------------------------------------------------

/**
 * Shannon entropy H[Beta(α,β)] in natural units (nats).
 * Preconditions: α>0, β>0.
 */
[[nodiscard]] inline double beta_entropy_nats(const double alpha, const double beta)
{
    using boost::math::digamma;
    const double lnB = detail::ln_beta(alpha, beta);
    const double term1 = (alpha - 1.0) * digamma(alpha);
    const double term2 = (beta  - 1.0) * digamma(beta);
    const double term3 = (alpha + beta - 2.0) * digamma(alpha + beta);
    return lnB - term1 - term2 + term3;
}

/**
 * Shannon entropy of Beta(α,β) in bits.
 */
[[nodiscard]] inline double beta_entropy_bits(const double alpha, const double beta)
{
    static constexpr double LN2 = 0.693147180559945309417232121458176568; // ln 2
    return beta_entropy_nats(alpha, beta) / LN2;
}

// -----------------------------------------------------------------------------
//  Information gain between two Beta states
// -----------------------------------------------------------------------------

/**
 * Expected information gained (bits) when moving from (α_prev,β_prev) to
 * (α_new,β_new).
 */
[[nodiscard]] inline double information_gain_bits(const double alpha_prev,
                                                  const double beta_prev,
                                                  const double alpha_new,
                                                  const double beta_new)
{
    return beta_entropy_bits(alpha_prev, beta_prev) - beta_entropy_bits(alpha_new, beta_new);
}

/**
 * Information-gain rate (bits per second).
 * @param seconds  Wall-clock time elapsed.  Values ≤0 return NaN.
 */
[[nodiscard]] inline double info_gain_bits_per_second(const double alpha_prev,
                                                      const double beta_prev,
                                                      const double alpha_new,
                                                      const double beta_new,
                                                      const double seconds)
{
    const double ig = information_gain_bits(alpha_prev, beta_prev, alpha_new, beta_new);
    return (seconds > 0.0) ? ig / seconds : std::numeric_limits<double>::quiet_NaN();
}

// -----------------------------------------------------------------------------
//  Convenience RAII tracker ----------------------------------------------------
// -----------------------------------------------------------------------------

/**
 * Simple accumulator that tracks the Beta parameters
 */
class info_gain {
public:
    explicit info_gain(const double alpha0 = 0.5, const double beta0 = 0.5)
        : alpha_(alpha0), beta_(beta0) {}

    /**
     * Register a batch of Bernoulli results and return the information gained
     * for this batch **in bits** (time-agnostic).
     */
    [[nodiscard]] double add_batch(const std::size_t successes, const std::size_t failures)
    {
        const double alpha_prev = alpha_;
        const double beta_prev  = beta_;

        alpha_ += static_cast<double>(successes);
        beta_  += static_cast<double>(failures);

        last_bits_ = information_gain_bits(alpha_prev, beta_prev, alpha_, beta_);
        cumulative_bits_ += last_bits_;
        return last_bits_;
    }

    [[nodiscard]] double alpha() const { return alpha_; }
    [[nodiscard]] double beta()  const { return beta_;  }
    [[nodiscard]] double cumulative_bits() const { return cumulative_bits_; }
    [[nodiscard]] double last_bits() const { return last_bits_; }

private:
    double alpha_;
    double beta_;
    double cumulative_bits_ = 0.0;
    double last_bits_ = 0.0;
};

} // namespace scram::mc::stats 