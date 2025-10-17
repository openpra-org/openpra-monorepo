#pragma once

#include <cmath>
#include <cstddef>
#include <limits>
#include <ostream>
#include <iomanip>

#include "mc/event/node.h"
#include "mc/stats/ci_utils.h"

#define PRECISION_LOG_SCIENTIFIC_DIGITS 3

namespace scram::mc::stats {

/* -------------------------------------------------------------------------
 * Accuracy metrics compare the *point estimate* \(\hat p\) coming out of the
 * Monte-Carlo run with the *ground-truth* probability \(p_\*\).
 * All quantities are dimensionless.
 * --------------------------------------------------------------------- */
struct AccuracyMetrics {
    /* Absolute error  Δ = |\hat p − p_*|.  Zero means a perfect estimate. */
    double abs_error = std::numeric_limits<double>::quiet_NaN();

    /* Relative error  δ = Δ / p_*  (undefined when p_* = 0).
     * Useful for contextualising the absolute error, especially when the
     * true probability is very small. */
    double rel_error = std::numeric_limits<double>::quiet_NaN();

    /* Signed bias  b = \hat p − p_*.  Positive → over-estimation; negative →
     * under-estimation.  Averaging bias over many independent runs reveals
     * whether the estimator is systematically off-centre. */
    double bias = std::numeric_limits<double>::quiet_NaN();

    /* Mean-squared error  MSE = (\hat p − p_*)².
     * Captures both variance and bias in a single non-negative number.
     * Here computed for a single run – still useful for optimisation. */
    double mse = std::numeric_limits<double>::quiet_NaN();

    /* Log10 absolute error  log10(Δ) = log10(|\hat p − p_*|).
     * Useful for comparing errors across different scales. */
    double log10_abs_error = std::numeric_limits<double>::quiet_NaN();

    /* Absolute error on a logarithmic scale: |log10(\hat p) − log10(p_*)|.
     * Unlike log10_abs_error, this metric focuses on relative discrepancies
     * and is independent of the magnitude of the true probability. */
    double abs_log10_error = std::numeric_limits<double>::quiet_NaN();
};

/* -------------------------------------------------------------------------
 * Sampling-theory diagnostics test whether the statistical assumptions hold.
 * They rely on the Central Limit Theorem and a provided ground-truth value.
 * --------------------------------------------------------------------- */
struct SamplingDiagnostics {
    /* Standardised deviation  z = (\hat p − p_*) / SE.
     * Under ideal unbiased sampling z ~ N(0,1).  Large |z| signals that the
     * observed deviation is unlikely to be pure noise. */
    double z_score = std::numeric_limits<double>::quiet_NaN();

    /* Two-sided p-value = P(|Z| ≥ |z|) = erfc(|z| / √2).
     * Probability of observing a deviation at least this extreme if the
     * estimator is correct. */
    double p_value = std::numeric_limits<double>::quiet_NaN();

    /* Coverage flags – does the reported confidence interval actually cover
     * the ground-truth value?  Ideally, across many runs, CI95 should cover
     * ~95 % and CI99 ~99 %. */
    bool ci95_covered = false;
    bool ci99_covered = false;

    /* n_required  = z² · p_*(1−p_*) / ε²  – sample size needed to reach the
     * user-requested margin ε at the chosen confidence when the *true* variance
     * is known.  Useful for gauging whether the automatic early-stop quits too
     * early (n_actual < n_required) or overshoots. */
    std::size_t n_required = 0;

    /* n_ratio = n_actual / n_required.  >1 ⇒ oversampling, <1 ⇒ undersampling. */
    double n_ratio = std::numeric_limits<double>::quiet_NaN();
};

//---------------------------------------------------------------------
//  Helper: standard-normal two-sided p-value from z
//---------------------------------------------------------------------
inline double two_sided_p_value(const double z) {
    const double z_abs = std::fabs(z);
    // erfc(x/√2) gives 2·(1-Φ(x)) for x ≥ 0
    return std::erfc(z_abs / std::sqrt(2.0));
}

//---------------------------------------------------------------------
//  Accuracy metrics
//---------------------------------------------------------------------

template <typename tally_t_>
[[nodiscard]] AccuracyMetrics compute_accuracy_metrics(const tally_t_ &tally,
                                                       const double    p_true) {
    AccuracyMetrics m;
    m.bias      = tally.mean - p_true;
    m.abs_error = std::fabs(m.bias);
    m.rel_error = (p_true != 0.0) ? m.abs_error / p_true : std::numeric_limits<double>::quiet_NaN();
    m.mse       = m.bias * m.bias; // single-run squared error
    m.log10_abs_error = (m.abs_error > 0.0) ? std::log10(m.abs_error) : std::numeric_limits<double>::quiet_NaN();

    // Absolute logarithmic error: |log10(p_hat) - log10(p_true)|
    if (tally.mean > 0.0 && p_true > 0.0) {
        m.abs_log10_error = std::fabs(std::log10(tally.mean) - std::log10(p_true));
    }
    return m;
}

//---------------------------------------------------------------------
//  Sampling-theory diagnostics
//---------------------------------------------------------------------

template <typename tally_t_>
[[nodiscard]] SamplingDiagnostics compute_sampling_diagnostics(const tally_t_ &tally,
                                                               const double    p_true,
                                                               const double    confidence,
                                                               const double    eps_target) {
    SamplingDiagnostics d;

    if (tally.std_err > 0.0) {
        d.z_score = (tally.mean - p_true) / tally.std_err;
        d.p_value = two_sided_p_value(d.z_score);
    }

    // CI coverage tests (95% & 99%).  Convention from populate_point_estimates:
    //   ci = {lower95, upper95, lower99, upper99}
    d.ci95_covered = (p_true >= tally.ci[0] && p_true <= tally.ci[1]);
    d.ci99_covered = (p_true >= tally.ci[2] && p_true <= tally.ci[3]);

    // Required sample size based on true p, requested ε and confidence.
    if (eps_target > 0.0 && confidence > 0.0 && confidence < 1.0) {
        d.n_required = required_trials(p_true, eps_target, confidence);
        if (d.n_required > 0) {
            d.n_ratio = static_cast<double>(tally.total_bits) / static_cast<double>(d.n_required);
        }
    }
    return d;
}

template <typename tally_t_>
[[nodiscard]] SamplingDiagnostics compute_sampling_diagnostics(const tally_t_ &tally,
                                                               const double    p_true,
                                                               const ci        &targets) {
    return compute_sampling_diagnostics(tally, p_true, targets.two_sided_confidence_level, targets.half_width_epsilon);
}

// -------------------------------------------------------------------------
//  I/O helpers
// -------------------------------------------------------------------------
inline std::ostream &operator<<(std::ostream &os, const AccuracyMetrics &m) {
    // Print each metric as label=value with a fixed-width field so columns line up.
    auto print_pair = [&os](const char *label, const double value) {
        os << label << std::setw(11) << value;
    };

    print_pair("Δ=",           m.abs_error);       os << " | ";
    print_pair("δ=",           m.rel_error);       os << " | ";
    print_pair("b=",           m.bias);            os << " | ";
    print_pair("MSE=",         m.mse);             os << " | ";
    print_pair("log10(Δ)=",    m.log10_abs_error); os << " | ";
    print_pair("|log10|=",     m.abs_log10_error);
    return os;
}

inline std::ostream &operator<<(std::ostream &os, const SamplingDiagnostics &d) {
    auto print_pair = [&os](const char *label, const double value) {
        os << label << std::setw(11) << value;
    };
    auto print_bool = [&os](const char *label, const bool flag) {
        os << label << (flag ? 'T' : 'F');
    };

    print_pair("z=",      d.z_score);        os << " | ";
    print_pair("p_val=",  d.p_value);        os << " | ";
    print_bool("CI95=",   d.ci95_covered);   os << " | ";
    print_bool("CI99=",   d.ci99_covered);   os << " | ";
    os << "n_req=" << d.n_required << " | ";
    print_pair("n_rat=",  d.n_ratio);
    return os;
}

} // namespace scram::mc::stats 