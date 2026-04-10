//! Importance sampling utilities for Monte Carlo (blueprint Chapter 17).
//!
//! This module provides the core likelihood-ratio math for Bernoulli vectors:
//!
//! - Target distribution per event:   $P(X_i=1)=p_i$
//! - Proposal distribution per event: $Q(X_i=1)=q_i$
//! - Likelihood ratio for a sample $x$ is:
//!   $$L(x) = \prod_i \frac{p_i^{x_i}(1-p_i)^{1-x_i}}{q_i^{x_i}(1-q_i)^{1-x_i}}$$
//!
//! We compute in log-space to avoid underflow for large vectors.

use crate::{PraxisError, Result};

fn validate_probability_in_unit_interval(p: f64, name: &str) -> Result<f64> {
    if !p.is_finite() {
        return Err(PraxisError::Settings(format!(
            "{name} probability must be finite, got {p}"
        )));
    }
    if !(0.0..=1.0).contains(&p) {
        return Err(PraxisError::Settings(format!(
            "{name} probability must be in [0,1], got {p}"
        )));
    }
    Ok(p)
}

/// Log likelihood ratio contribution for a single Bernoulli outcome.
///
/// `x=true` means the event occurred.
///
/// Notes:
/// - When `q` assigns zero probability to an observed outcome, this returns an error.
///   (In importance sampling, samples are drawn from `q`, so such a sample indicates a bug.)
/// - When `p` assigns zero probability to an observed outcome (but `q` does not), the
///   ratio is zero and we return `-inf`.
#[inline]
pub fn bernoulli_log_likelihood_ratio(x: bool, p: f64, q: f64) -> Result<f64> {
    let p = validate_probability_in_unit_interval(p, "target")?;
    let q = validate_probability_in_unit_interval(q, "proposal")?;

    if x {
        if q == 0.0 {
            return Err(PraxisError::Settings(
                "proposal q=0 cannot generate x=true".to_string(),
            ));
        }
        if p == 0.0 {
            return Ok(f64::NEG_INFINITY);
        }
        Ok((p / q).ln())
    } else {
        if q == 1.0 {
            return Err(PraxisError::Settings(
                "proposal q=1 cannot generate x=false".to_string(),
            ));
        }
        if p == 1.0 {
            return Ok(f64::NEG_INFINITY);
        }
        Ok(((1.0 - p) / (1.0 - q)).ln())
    }
}

/// Log likelihood ratio for a Bernoulli vector sample.
///
/// `sample[i]` is the observed boolean outcome for event `i`.
pub fn bernoulli_vector_log_likelihood_ratio(
    sample: &[bool],
    target_p: &[f64],
    proposal_q: &[f64],
) -> Result<f64> {
    if sample.len() != target_p.len() || sample.len() != proposal_q.len() {
        return Err(PraxisError::Settings(format!(
            "sample/target_p/proposal_q lengths must match (got {}, {}, {})",
            sample.len(),
            target_p.len(),
            proposal_q.len()
        )));
    }

    let mut sum = 0.0;
    for i in 0..sample.len() {
        sum += bernoulli_log_likelihood_ratio(sample[i], target_p[i], proposal_q[i])?;
    }
    Ok(sum)
}

/// Likelihood ratio $L(x)$ for a Bernoulli vector sample.
///
/// This is `exp(bernoulli_vector_log_likelihood_ratio(...))`.
pub fn bernoulli_vector_likelihood_ratio(
    sample: &[bool],
    target_p: &[f64],
    proposal_q: &[f64],
) -> Result<f64> {
    Ok(bernoulli_vector_log_likelihood_ratio(sample, target_p, proposal_q)?.exp())
}

/// Convenience wrapper holding a target/proposal pair.
#[derive(Debug, Clone, PartialEq)]
pub struct ImportanceSamplingBernoulli {
    target_p: Vec<f64>,
    proposal_q: Vec<f64>,
}

impl ImportanceSamplingBernoulli {
    pub fn new(target_p: Vec<f64>, proposal_q: Vec<f64>) -> Result<Self> {
        if target_p.len() != proposal_q.len() {
            return Err(PraxisError::Settings(format!(
                "target_p/proposal_q lengths must match (got {} vs {})",
                target_p.len(),
                proposal_q.len()
            )));
        }
        for &p in &target_p {
            validate_probability_in_unit_interval(p, "target")?;
        }
        for &q in &proposal_q {
            validate_probability_in_unit_interval(q, "proposal")?;
        }
        Ok(Self {
            target_p,
            proposal_q,
        })
    }

    pub fn target_p(&self) -> &[f64] {
        &self.target_p
    }

    pub fn proposal_q(&self) -> &[f64] {
        &self.proposal_q
    }

    pub fn log_likelihood_ratio(&self, sample: &[bool]) -> Result<f64> {
        bernoulli_vector_log_likelihood_ratio(sample, &self.target_p, &self.proposal_q)
    }

    pub fn likelihood_ratio(&self, sample: &[bool]) -> Result<f64> {
        Ok(self.log_likelihood_ratio(sample)?.exp())
    }
}

/// Weighted tallies for importance sampling.
///
/// Blueprint intent:
/// - For indicator $Y \in \{0,1\}$ (e.g., top event occurred):
///   - $S_1 = \sum w \cdot Y$
///   - $S_0 = \sum w$
///   - estimate $\hat{p} = S_1 / S_0$ (self-normalized IS)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct WeightedTallies {
    pub s1: f64,
    pub s0: f64,
}

impl WeightedTallies {
    pub fn new() -> Self {
        Self { s1: 0.0, s0: 0.0 }
    }

    /// Add a single weighted indicator observation.
    ///
    /// `weight` is the likelihood ratio $L(x)$ (or any non-negative weight).
    /// `y` is the indicator outcome.
    /// `multiplicity` allows aggregating repeated identical samples.
    pub fn add_weighted_indicator(
        &mut self,
        weight: f64,
        y: bool,
        multiplicity: u64,
    ) -> Result<()> {
        if multiplicity == 0 {
            return Ok(());
        }
        if !weight.is_finite() {
            return Err(PraxisError::Settings(format!(
                "weight must be finite, got {weight}"
            )));
        }
        if weight < 0.0 {
            return Err(PraxisError::Settings(format!(
                "weight must be >= 0, got {weight}"
            )));
        }
        let m = multiplicity as f64;
        self.s0 += weight * m;
        if y {
            self.s1 += weight * m;
        }
        Ok(())
    }

    /// Add an observation from a Bernoulli-vector sample using target/proposal.
    pub fn add_sample(
        &mut self,
        sample: &[bool],
        target_p: &[f64],
        proposal_q: &[f64],
        y: bool,
        multiplicity: u64,
    ) -> Result<()> {
        let lr = bernoulli_vector_likelihood_ratio(sample, target_p, proposal_q)?;
        self.add_weighted_indicator(lr, y, multiplicity)
    }

    /// Returns the self-normalized estimate $S_1/S_0$.
    ///
    /// Returns `None` if `S0 == 0`.
    pub fn estimate(&self) -> Option<f64> {
        if self.s0 > 0.0 {
            Some(self.s1 / self.s0)
        } else {
            None
        }
    }
}

impl Default for WeightedTallies {
    fn default() -> Self {
        Self::new()
    }
}

/// Diagnostics derived from importance weights.
///
/// Effective sample size (ESS) for non-negative weights $w_i$:
/// $$ESS = \frac{(\sum_i w_i)^2}{\sum_i w_i^2}$$
///
/// - Scale invariant in `w`.
/// - Bounded: $1 \le ESS \le N$ for nonzero weights.
pub mod diagnostics {
    use crate::{PraxisError, Result};

    /// Compute ESS for a slice of nonnegative, finite weights.
    ///
    /// Returns `None` when `weights` is empty or sums are zero.
    pub fn effective_sample_size(weights: &[f64]) -> Result<Option<f64>> {
        if weights.is_empty() {
            return Ok(None);
        }
        let mut sum = 0.0;
        let mut sum_sq = 0.0;
        for &w in weights {
            if !w.is_finite() {
                return Err(PraxisError::Settings(format!(
                    "weight must be finite, got {w}"
                )));
            }
            if w < 0.0 {
                return Err(PraxisError::Settings(format!(
                    "weight must be >= 0, got {w}"
                )));
            }
            sum += w;
            sum_sq += w * w;
        }
        if sum <= 0.0 || sum_sq <= 0.0 {
            return Ok(None);
        }
        Ok(Some((sum * sum) / sum_sq))
    }

    /// ESS ratio in `(0,1]`: `ESS / N`.
    ///
    /// Returns `None` when ESS is undefined.
    pub fn effective_sample_size_ratio(weights: &[f64]) -> Result<Option<f64>> {
        let n = weights.len();
        if n == 0 {
            return Ok(None);
        }
        Ok(effective_sample_size(weights)?.map(|ess| ess / (n as f64)))
    }

    /// Returns the maximum normalized weight `max_i w_i / sum_j w_j`.
    ///
    /// Returns `None` when the sum is zero or the slice is empty.
    pub fn max_normalized_weight(weights: &[f64]) -> Result<Option<f64>> {
        if weights.is_empty() {
            return Ok(None);
        }
        let mut sum = 0.0;
        let mut max_w = 0.0;
        for &w in weights {
            if !w.is_finite() {
                return Err(PraxisError::Settings(format!(
                    "weight must be finite, got {w}"
                )));
            }
            if w < 0.0 {
                return Err(PraxisError::Settings(format!(
                    "weight must be >= 0, got {w}"
                )));
            }
            sum += w;
            if w > max_w {
                max_w = w;
            }
        }
        if sum <= 0.0 {
            return Ok(None);
        }
        Ok(Some(max_w / sum))
    }

    /// Simple degeneracy flag: true when ESS ratio falls below `min_ess_ratio`.
    ///
    /// `min_ess_ratio` is clamped to `[0,1]`.
    pub fn is_weight_degenerate_by_ess(weights: &[f64], min_ess_ratio: f64) -> Result<bool> {
        let min_ess_ratio = if min_ess_ratio.is_finite() {
            min_ess_ratio.clamp(0.0, 1.0)
        } else {
            0.0
        };
        let Some(ratio) = effective_sample_size_ratio(weights)? else {
            return Ok(false);
        };
        Ok(ratio < min_ess_ratio)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_close(a: f64, b: f64) {
        let err = (a - b).abs();
        assert!(err <= 1e-12, "{a} != {b} (err={err})");
    }

    #[test]
    fn likelihood_ratio_all_zero_vector() {
        // L = ((1-p1)/(1-q1)) * ((1-p2)/(1-q2))
        let p = vec![0.2, 0.3];
        let q = vec![0.4, 0.6];
        let sample = vec![false, false];

        let is = ImportanceSamplingBernoulli::new(p.clone(), q.clone()).unwrap();
        let lr = is.likelihood_ratio(&sample).unwrap();

        let expected = (0.8 / 0.6) * (0.7 / 0.4);
        assert_close(lr, expected);

        let direct = bernoulli_vector_likelihood_ratio(&sample, &p, &q).unwrap();
        assert_close(direct, expected);
    }

    #[test]
    fn likelihood_ratio_all_one_vector() {
        // L = (p1/q1) * (p2/q2)
        let p = vec![0.2, 0.3];
        let q = vec![0.4, 0.6];
        let sample = vec![true, true];

        let lr = bernoulli_vector_likelihood_ratio(&sample, &p, &q).unwrap();
        let expected = (0.2 / 0.4) * (0.3 / 0.6);
        assert_close(lr, expected);
    }

    #[test]
    fn likelihood_ratio_mixed_vector() {
        // L = (p1/q1) * ((1-p2)/(1-q2))
        let p = vec![0.2, 0.3];
        let q = vec![0.4, 0.6];
        let sample = vec![true, false];

        let lr = bernoulli_vector_likelihood_ratio(&sample, &p, &q).unwrap();
        let expected = (0.2 / 0.4) * (0.7 / 0.4);
        assert_close(lr, expected);
    }

    #[test]
    fn vector_length_mismatch_is_error() {
        let p = vec![0.2, 0.3];
        let q = vec![0.4, 0.6];
        let sample = vec![true];
        assert!(bernoulli_vector_likelihood_ratio(&sample, &p, &q).is_err());
    }

    #[test]
    fn proposal_impossible_outcome_is_error() {
        // If q=0, proposal cannot produce x=true.
        let p = vec![0.2];
        let q = vec![0.0];
        let sample = vec![true];
        assert!(bernoulli_vector_likelihood_ratio(&sample, &p, &q).is_err());

        // If q=1, proposal cannot produce x=false.
        let p2 = vec![0.2];
        let q2 = vec![1.0];
        let sample2 = vec![false];
        assert!(bernoulli_vector_likelihood_ratio(&sample2, &p2, &q2).is_err());
    }

    fn bernoulli_vector_prob(sample: &[bool], probs: &[f64]) -> f64 {
        assert_eq!(sample.len(), probs.len());
        let mut out = 1.0;
        for i in 0..sample.len() {
            let p = probs[i];
            out *= if sample[i] { p } else { 1.0 - p };
        }
        out
    }

    #[test]
    fn weighted_tally_estimate_is_s1_over_s0() {
        let mut t = WeightedTallies::new();
        // Two observations with multiplicity.
        t.add_weighted_indicator(2.0, true, 3).unwrap(); // s1 += 6, s0 += 6
        t.add_weighted_indicator(1.0, false, 2).unwrap(); // s1 += 0, s0 += 2
        assert_close(t.s1, 6.0);
        assert_close(t.s0, 8.0);
        assert_close(t.estimate().unwrap(), 0.75);
    }

    #[test]
    fn weighted_tally_exact_enumeration_matches_analytic_or_probability() {
        // Use exact enumeration under q, weighting by L=p/q.
        // For Y = OR(X1, X2), we must recover P_p(Y=1) = 1 - (1-p1)(1-p2).
        let p = vec![0.2, 0.3];
        let q = vec![0.4, 0.6];

        let samples = [[false, false], [false, true], [true, false], [true, true]];
        let mut tallies = WeightedTallies::new();
        for s in &samples {
            let s = s.to_vec();
            let y = s[0] || s[1];
            let qx = bernoulli_vector_prob(&s, &q);
            let lr = bernoulli_vector_likelihood_ratio(&s, &p, &q).unwrap();
            // Use multiplicity=1 but inject q(x) into weight to represent exact expectation.
            tallies.add_weighted_indicator(qx * lr, y, 1).unwrap();
        }

        let estimate = tallies.estimate().unwrap();
        let analytic = 1.0 - (1.0 - p[0]) * (1.0 - p[1]);
        assert_close(estimate, analytic);

        // Denominator should be sum_x q(x) * p(x)/q(x) = 1.
        assert_close(tallies.s0, 1.0);
    }

    #[test]
    fn ess_is_n_for_equal_weights() {
        let w = vec![2.0; 10];
        let ess = diagnostics::effective_sample_size(&w).unwrap().unwrap();
        assert_close(ess, 10.0);
        let ratio = diagnostics::effective_sample_size_ratio(&w)
            .unwrap()
            .unwrap();
        assert_close(ratio, 1.0);
    }

    #[test]
    fn ess_is_one_for_single_nonzero_weight() {
        let mut w = vec![0.0; 9];
        w.push(5.0);
        let ess = diagnostics::effective_sample_size(&w).unwrap().unwrap();
        assert_close(ess, 1.0);
        let ratio = diagnostics::effective_sample_size_ratio(&w)
            .unwrap()
            .unwrap();
        assert_close(ratio, 0.1);
    }

    #[test]
    fn ess_is_scale_invariant() {
        let w1 = vec![1.0, 2.0, 3.0, 4.0];
        let w2 = w1.iter().map(|x| x * 7.0).collect::<Vec<_>>();
        let ess1 = diagnostics::effective_sample_size(&w1).unwrap().unwrap();
        let ess2 = diagnostics::effective_sample_size(&w2).unwrap().unwrap();
        assert_close(ess1, ess2);
    }

    #[test]
    fn degeneracy_flag_triggers_for_spiky_weights() {
        // N=10, one weight dominates -> ESS ratio ~= 0.1.
        let mut w = vec![1.0; 9];
        w.push(1000.0);
        let ratio = diagnostics::effective_sample_size_ratio(&w)
            .unwrap()
            .unwrap();
        assert!(ratio < 0.3);
        assert!(diagnostics::is_weight_degenerate_by_ess(&w, 0.3).unwrap());
        assert!(!diagnostics::is_weight_degenerate_by_ess(&w, 0.05).unwrap());
    }

    #[test]
    fn max_normalized_weight_is_one_for_singleton() {
        let w = vec![2.0];
        let maxn = diagnostics::max_normalized_weight(&w).unwrap().unwrap();
        assert_close(maxn, 1.0);
    }
}
