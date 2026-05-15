//! Runtime diagnostics for Monte Carlo.
//!
//! This module is intended for lightweight, deterministic diagnostics that can
//! run in unit tests and during MC execution.

use crate::error::{PraxisError, Result};
use statrs::distribution::{ChiSquared, ContinuousCDF};

fn clamp01(x: f64) -> f64 {
    if x.is_nan() {
        return 0.0;
    }
    x.clamp(0.0, 1.0)
}

/// Compute the required sample size $n$ to achieve a target relative half-width
/// under the Wald CI for a Bernoulli proportion.
///
/// Using:
///
/// $$\mathrm{RHW} = \frac{z\sqrt{\hat{p}(1-\hat{p})/n}}{\hat{p}}$$
///
/// solving for $n$ yields:
///
/// $$n_{\min} = \frac{z^2(1-\hat{p})}{\mathrm{RHW}^2\hat{p}}$$
///
/// Returns `None` when inputs are invalid or when $\hat{p}$ clamps to 0.
pub fn required_n_for_relative_half_width_wald(p_hat: f64, target_rhw: f64, z: f64) -> Option<f64> {
    if !(target_rhw.is_finite() && target_rhw > 0.0) {
        return None;
    }
    if !z.is_finite() {
        return None;
    }

    let p = clamp01(p_hat);
    if p == 0.0 {
        return None;
    }
    if p == 1.0 {
        return Some(0.0);
    }

    let z2 = z.abs() * z.abs();
    Some(z2 * (1.0 - p) / (target_rhw * target_rhw * p))
}

/// Sample-size adequacy ratio for meeting a target Wald relative half-width.
///
/// Defined as:
///
/// $$\mathrm{adequacy} = \frac{n}{n_{\min}}$$
///
/// where $n_{\min}$ is computed by [`required_n_for_relative_half_width_wald`].
///
/// Returns `None` when inputs are invalid or $n_{\min}$ is undefined.
pub fn sample_size_adequacy_ratio_relative_half_width_wald(
    p_hat: f64,
    n: u64,
    target_rhw: f64,
    z: f64,
) -> Option<f64> {
    let n_req = required_n_for_relative_half_width_wald(p_hat, target_rhw, z)?;
    if n_req == 0.0 {
        return Some(f64::INFINITY);
    }
    Some((n as f64) / n_req)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ChiSquareGof {
    /// Pearson chi-square statistic.
    pub chi2: f64,
    /// Degrees of freedom.
    pub dof: u64,
    /// Upper-tail p-value: $P(\chi^2_{dof} \ge \chi^2)$.
    pub p_value: f64,
}

/// Pearson chi-square goodness-of-fit test for categorical counts.
///
/// - `observed`: observed counts per category.
/// - `expected_probs`: expected probabilities per category (need not sum to 1; will be normalized).
///
/// Returns `Ok(None)` when `observed` is empty, has fewer than 2 categories, or sums to 0.
/// Returns an error for invalid inputs (mismatched lengths, negative/NaN probabilities,
/// or a zero expected probability for a category).
pub fn chi_square_gof(observed: &[u64], expected_probs: &[f64]) -> Result<Option<ChiSquareGof>> {
    if observed.len() < 2 {
        return Ok(None);
    }
    if observed.len() != expected_probs.len() {
        return Err(PraxisError::Logic(
            "chi_square_gof: observed/expected length mismatch".to_string(),
        ));
    }

    let total_obs: u64 = observed.iter().sum();
    if total_obs == 0 {
        return Ok(None);
    }

    let mut sum_p = 0.0;
    for &p in expected_probs {
        if !(p.is_finite() && p >= 0.0) {
            return Err(PraxisError::Logic(
                "chi_square_gof: expected_probs must be finite and non-negative".to_string(),
            ));
        }
        sum_p += p;
    }
    if !(sum_p.is_finite() && sum_p > 0.0) {
        return Err(PraxisError::Logic(
            "chi_square_gof: expected_probs must sum to a positive value".to_string(),
        ));
    }

    let n = total_obs as f64;
    let mut chi2 = 0.0;
    for (o, p_raw) in observed.iter().zip(expected_probs.iter()) {
        let p = p_raw / sum_p;
        let expected = n * p;
        if expected <= 0.0 {
            return Err(PraxisError::Logic(
                "chi_square_gof: zero expected count for category".to_string(),
            ));
        }
        let diff = (*o as f64) - expected;
        chi2 += diff * diff / expected;
    }

    let dof = (observed.len() - 1) as u64;
    let dist = ChiSquared::new(dof as f64)
        .map_err(|e| PraxisError::Logic(format!("chi_square_gof: invalid dof: {e}")))?;

    // Upper-tail p-value.
    let p_value = 1.0 - dist.cdf(chi2);

    Ok(Some(ChiSquareGof { chi2, dof, p_value }))
}

/// Special-case chi-square GOF for a Bernoulli model aggregated as `(successes, trials)`.
///
/// Equivalent to a 2-category chi-square test with `dof=1`.
///
/// Returns `Ok(None)` when `trials == 0`.
pub fn chi_square_gof_bernoulli(
    successes: u64,
    trials: u64,
    expected_p: f64,
) -> Result<Option<ChiSquareGof>> {
    if trials == 0 {
        return Ok(None);
    }
    if successes > trials {
        return Err(PraxisError::Logic(
            "chi_square_gof_bernoulli: successes > trials".to_string(),
        ));
    }

    let p = clamp01(expected_p);
    let failures = trials - successes;

    // If p is exactly 0 or 1 we must avoid expected=0 bins.
    if p == 0.0 {
        if successes == 0 {
            return Ok(Some(ChiSquareGof {
                chi2: 0.0,
                dof: 1,
                p_value: 1.0,
            }));
        }
        return Err(PraxisError::Logic(
            "chi_square_gof_bernoulli: expected_p=0 implies successes must be 0".to_string(),
        ));
    }
    if p == 1.0 {
        if failures == 0 {
            return Ok(Some(ChiSquareGof {
                chi2: 0.0,
                dof: 1,
                p_value: 1.0,
            }));
        }
        return Err(PraxisError::Logic(
            "chi_square_gof_bernoulli: expected_p=1 implies failures must be 0".to_string(),
        ));
    }

    let n = trials as f64;
    let exp_s = n * p;
    let exp_f = n * (1.0 - p);

    let diff_s = (successes as f64) - exp_s;
    let diff_f = (failures as f64) - exp_f;
    let chi2 = diff_s * diff_s / exp_s + diff_f * diff_f / exp_f;

    let dist = ChiSquared::new(1.0)
        .map_err(|e| PraxisError::Logic(format!("chi_square_gof_bernoulli: invalid dof: {e}")))?;

    Ok(Some(ChiSquareGof {
        chi2,
        dof: 1,
        p_value: 1.0 - dist.cdf(chi2),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn required_n_for_rhw_matches_hand_calc() {
        // p=0.1, rhw=0.1, z=1.96 => n_req ~ 3457.44
        let n_req = required_n_for_relative_half_width_wald(0.1, 0.1, 1.96).unwrap();
        assert!((n_req - 3457.44).abs() < 1e-2);
    }

    #[test]
    fn adequacy_ratio_is_above_1_when_n_exceeds_required() {
        let ratio =
            sample_size_adequacy_ratio_relative_half_width_wald(0.1, 4000, 0.1, 1.96).unwrap();
        assert!(ratio > 1.0);

        let ratio2 =
            sample_size_adequacy_ratio_relative_half_width_wald(0.1, 1000, 0.1, 1.96).unwrap();
        assert!(ratio2 < 1.0);
    }

    #[test]
    fn adequacy_ratio_handles_edge_cases() {
        assert!(required_n_for_relative_half_width_wald(0.0, 0.1, 1.96).is_none());
        assert_eq!(
            required_n_for_relative_half_width_wald(1.0, 0.1, 1.96).unwrap(),
            0.0
        );
        assert!(required_n_for_relative_half_width_wald(0.5, 0.0, 1.96).is_none());

        let ratio_inf =
            sample_size_adequacy_ratio_relative_half_width_wald(1.0, 1, 0.1, 1.96).unwrap();
        assert!(ratio_inf.is_infinite());
    }

    #[test]
    fn chi_square_gof_categorical_zero_statistic() {
        let r = chi_square_gof(&[50, 50], &[0.5, 0.5]).unwrap().unwrap();
        assert!(r.chi2.abs() < 1e-12);
        assert_eq!(r.dof, 1);
        assert!((r.p_value - 1.0).abs() < 1e-12);
    }

    #[test]
    fn chi_square_gof_categorical_detects_mismatch() {
        let r = chi_square_gof(&[90, 10], &[0.5, 0.5]).unwrap().unwrap();
        assert!(r.chi2 > 10.0);
        assert!(r.p_value < 1e-10);
    }

    #[test]
    fn chi_square_gof_length_mismatch_is_error() {
        assert!(chi_square_gof(&[1, 2], &[1.0]).is_err());
    }

    #[test]
    fn chi_square_gof_bernoulli_matches_two_bin_form() {
        let r = chi_square_gof_bernoulli(50, 100, 0.5).unwrap().unwrap();
        assert!(r.chi2.abs() < 1e-12);
        assert_eq!(r.dof, 1);
        assert!((r.p_value - 1.0).abs() < 1e-12);

        let r2 = chi_square_gof_bernoulli(90, 100, 0.5).unwrap().unwrap();
        assert!(r2.chi2 > 10.0);
        assert!(r2.p_value < 1e-10);
    }
}
