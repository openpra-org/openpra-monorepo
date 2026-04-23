/// Approximation methods for probability calculation
///
/// This module provides efficient approximation algorithms for calculating
/// system failure probabilities from minimal cut sets. These methods trade
/// some accuracy for significant computational efficiency, making them suitable
/// for large fault trees where exact calculation is impractical.
///
/// # Approximation Methods
///
/// - **Rare-Event Approximation**: Assumes all event probabilities are small
/// - **MCUB (Minimal Cut Upper Bound)**: Provides conservative upper bound
///
/// # Examples
///
/// ```
/// use praxis::analysis::approximations::{rare_event_approximation, mcub_approximation};
/// use std::collections::HashMap;
///
/// // Minimal cut sets: {E1, E2}, {E3}
/// let cut_sets = vec![
///     vec![1, 2],  // E1 AND E2
///     vec![3],     // E3
/// ];
///
/// // Event probabilities
/// let mut probabilities = HashMap::new();
/// probabilities.insert(1, 0.01);  // P(E1) = 0.01
/// probabilities.insert(2, 0.02);  // P(E2) = 0.02
/// probabilities.insert(3, 0.05);  // P(E3) = 0.05
///
/// // Rare-event approximation
/// let p_rare = rare_event_approximation(&cut_sets, &probabilities);
/// println!("Rare-Event: {:.6}", p_rare);  // ≈ 0.0502
///
/// // MCUB approximation
/// let p_mcub = mcub_approximation(&cut_sets, &probabilities);
/// println!("MCUB: {:.6}", p_mcub);  // ≈ 0.0501
/// ```
use std::collections::HashMap;

/// Calculate cut set probability (product of individual event probabilities)
///
/// For a cut set {E1, E2, ..., En}, the probability is:
/// P(cut set) = P(E1) × P(E2) × ... × P(En)
///
/// # Arguments
/// * `cut_set` - Indices of basic events in the cut set
/// * `probabilities` - Map from event index to probability
///
/// # Returns
/// * `f64` - Probability of the cut set occurring
///
/// # Examples
///
/// ```
/// use praxis::analysis::approximations::cut_set_probability;
/// use std::collections::HashMap;
///
/// let mut probs = HashMap::new();
/// probs.insert(1, 0.1);
/// probs.insert(2, 0.2);
///
/// let cut_set = vec![1, 2];
/// let p = cut_set_probability(&cut_set, &probs);
/// assert!((p - 0.02).abs() < 1e-10);  // 0.1 × 0.2 = 0.02
/// ```
pub fn cut_set_probability(cut_set: &[i32], probabilities: &HashMap<i32, f64>) -> f64 {
    let mut product = 1.0;
    for &event_index in cut_set {
        let abs_index = event_index.abs();
        if let Some(&prob) = probabilities.get(&abs_index) {
            // For positive index: use probability
            // For negative index (complement): use (1 - probability)
            if event_index > 0 {
                product *= prob;
            } else {
                product *= 1.0 - prob;
            }
        } else {
            // If probability not found, assume 0 (event cannot occur)
            return 0.0;
        }
    }
    product
}

/// Rare-Event approximation for system failure probability
///
/// This approximation is valid when all basic event probabilities are small
/// (typically < 0.1). It approximates the union of cut sets by summing their
/// individual probabilities:
///
/// P(system failure) ≈ Σ P(cut set_i)
///
/// # Mathematical Background
///
/// For rare events with small probabilities, the inclusion-exclusion principle
/// simplifies because intersection terms become negligible:
///
/// P(A ∪ B) = P(A) + P(B) - P(A ∩ B) ≈ P(A) + P(B)  when P(A), P(B) << 1
///
/// # Accuracy
///
/// - **Good**: P(events) < 0.01 (error < 1%)
/// - **Acceptable**: P(events) < 0.1 (error < 10%)
/// - **Poor**: P(events) > 0.1 (can significantly underestimate)
///
/// # Arguments
/// * `cut_sets` - Collection of minimal cut sets (each cut set is a Vec of event indices)
/// * `probabilities` - Map from event index to failure probability
///
/// # Returns
/// * `f64` - Approximate system failure probability (capped at 1.0)
///
/// # Examples
///
/// ```
/// use praxis::analysis::approximations::rare_event_approximation;
/// use std::collections::HashMap;
///
/// let cut_sets = vec![
///     vec![1, 2],  // P = 0.01 × 0.02 = 0.0002
///     vec![3],     // P = 0.05
/// ];
///
/// let mut probs = HashMap::new();
/// probs.insert(1, 0.01);
/// probs.insert(2, 0.02);
/// probs.insert(3, 0.05);
///
/// let p = rare_event_approximation(&cut_sets, &probs);
/// assert!((p - 0.0502).abs() < 1e-6);
/// ```
///
/// # Note
///
/// If the calculated probability exceeds 1.0, it is capped at 1.0.
/// This indicates the approximation is not appropriate for the given probabilities.
pub fn rare_event_approximation(cut_sets: &[Vec<i32>], probabilities: &HashMap<i32, f64>) -> f64 {
    let mut sum = 0.0;

    for cut_set in cut_sets {
        sum += cut_set_probability(cut_set, probabilities);
    }

    // Cap at 1.0 (probability cannot exceed 1)
    if sum > 1.0 {
        1.0
    } else {
        sum
    }
}

/// MCUB (Minimal Cut Upper Bound) approximation
///
/// Provides a conservative upper bound on system failure probability using
/// minimal cut sets. More accurate than rare-event for moderate probabilities.
///
/// Formula: P(system) ≤ 1 - ∏(1 - P(cut set_i))
///
/// # Mathematical Background
///
/// The MCUB formula is derived from the principle that the system survives
/// only if ALL cut sets do not occur:
///
/// P(survival) = P(no cut set occurs) ≤ ∏(1 - P(cut set_i))
/// P(failure) = 1 - P(survival) ≥ 1 - ∏(1 - P(cut set_i))
///
/// This provides an upper bound because it assumes cut sets are independent,
/// which overestimates failure probability when events are shared.
///
/// # Accuracy
///
/// - **Good**: P(cut sets) < 0.3 (typically within 5-10%)
/// - **Acceptable**: P(cut sets) < 0.5
/// - **Conservative**: Always provides upper bound (never underestimates)
///
/// # Arguments
/// * `cut_sets` - Collection of minimal cut sets
/// * `probabilities` - Map from event index to failure probability
///
/// # Returns
/// * `f64` - Upper bound on system failure probability
///
/// # Examples
///
/// ```
/// use praxis::analysis::approximations::mcub_approximation;
/// use std::collections::HashMap;
///
/// let cut_sets = vec![
///     vec![1, 2],  // P = 0.1 × 0.2 = 0.02
///     vec![3],     // P = 0.3
/// ];
///
/// let mut probs = HashMap::new();
/// probs.insert(1, 0.1);
/// probs.insert(2, 0.2);
/// probs.insert(3, 0.3);
///
/// let p = mcub_approximation(&cut_sets, &probs);
/// // P ≈ 1 - (1-0.02)(1-0.3) = 1 - 0.686 = 0.314
/// assert!((p - 0.314).abs() < 1e-3);
/// ```
pub fn mcub_approximation(cut_sets: &[Vec<i32>], probabilities: &HashMap<i32, f64>) -> f64 {
    let mut m = 1.0;

    for cut_set in cut_sets {
        let p_cut_set = cut_set_probability(cut_set, probabilities);
        m *= 1.0 - p_cut_set;
    }

    1.0 - m
}

/// Calculate error bounds for rare-event approximation
///
/// Estimates the potential error by comparing with a more accurate method.
/// For very small probabilities, both approximations are close.
///
/// # Arguments
/// * `cut_sets` - Collection of minimal cut sets
/// * `probabilities` - Map from event index to failure probability
///
/// # Returns
/// * `(f64, f64)` - (rare-event result, mcub result) as reference points
pub fn rare_event_error_bounds(
    cut_sets: &[Vec<i32>],
    probabilities: &HashMap<i32, f64>,
) -> (f64, f64) {
    let rare_event = rare_event_approximation(cut_sets, probabilities);
    let mcub = mcub_approximation(cut_sets, probabilities);

    // Both are approximations; for very small probabilities they're very close
    // For larger probabilities, MCUB tends to be an upper bound
    (rare_event, mcub)
}

/// Validate if rare-event approximation is appropriate
///
/// Checks if all event probabilities and cut set probabilities are small
/// enough for rare-event approximation to be accurate.
///
/// # Arguments
/// * `cut_sets` - Collection of minimal cut sets
/// * `probabilities` - Map from event index to failure probability
/// * `threshold` - Maximum acceptable probability (default: 0.1)
///
/// # Returns
/// * `true` - If approximation is valid
/// * `false` - If probabilities are too large
///
/// # Examples
///
/// ```
/// use praxis::analysis::approximations::validate_rare_event;
/// use std::collections::HashMap;
///
/// let mut probs = HashMap::new();
/// probs.insert(1, 0.01);
/// probs.insert(2, 0.02);
///
/// let cut_sets = vec![vec![1], vec![2]];
/// assert!(validate_rare_event(&cut_sets, &probs, 0.1));
///
/// probs.insert(3, 0.5);
/// let cut_sets2 = vec![vec![3]];
/// assert!(!validate_rare_event(&cut_sets2, &probs, 0.1));
/// ```
pub fn validate_rare_event(
    cut_sets: &[Vec<i32>],
    probabilities: &HashMap<i32, f64>,
    threshold: f64,
) -> bool {
    // Check individual event probabilities
    for &prob in probabilities.values() {
        if prob > threshold {
            return false;
        }
    }

    // Check cut set probabilities
    for cut_set in cut_sets {
        let p_cut = cut_set_probability(cut_set, probabilities);
        if p_cut > threshold {
            return false;
        }
    }

    true
}

/// Statistics about approximation quality
#[derive(Debug, Clone, PartialEq)]
pub struct ApproximationStats {
    /// Rare-event approximation result
    pub rare_event: f64,
    /// MCUB approximation result
    pub mcub: f64,
    /// Maximum individual event probability
    pub max_event_prob: f64,
    /// Maximum cut set probability
    pub max_cut_set_prob: f64,
    /// Number of cut sets
    pub num_cut_sets: usize,
    /// Whether rare-event is valid (all probs < 0.1)
    pub rare_event_valid: bool,
}

impl ApproximationStats {
    /// Calculate statistics for a set of cut sets
    pub fn calculate(cut_sets: &[Vec<i32>], probabilities: &HashMap<i32, f64>) -> Self {
        let rare_event = rare_event_approximation(cut_sets, probabilities);
        let mcub = mcub_approximation(cut_sets, probabilities);

        let max_event_prob = probabilities
            .values()
            .copied()
            .max_by(|a, b| a.partial_cmp(b).unwrap())
            .unwrap_or(0.0);

        let max_cut_set_prob = cut_sets
            .iter()
            .map(|cs| cut_set_probability(cs, probabilities))
            .max_by(|a, b| a.partial_cmp(b).unwrap())
            .unwrap_or(0.0);

        let rare_event_valid = validate_rare_event(cut_sets, probabilities, 0.1);

        ApproximationStats {
            rare_event,
            mcub,
            max_event_prob,
            max_cut_set_prob,
            num_cut_sets: cut_sets.len(),
            rare_event_valid,
        }
    }

    /// Get the relative difference between rare-event and MCUB
    pub fn relative_error(&self) -> f64 {
        if self.mcub > 0.0 {
            ((self.mcub - self.rare_event) / self.mcub).abs()
        } else {
            0.0
        }
    }

    /// Get a recommended approximation method
    pub fn recommended_method(&self) -> &'static str {
        if self.rare_event_valid && self.relative_error() < 0.05 {
            "rare-event (accurate)"
        } else if self.max_cut_set_prob < 0.3 {
            "mcub (moderate accuracy)"
        } else {
            "exact method recommended"
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_probabilities() -> HashMap<i32, f64> {
        let mut probs = HashMap::new();
        probs.insert(1, 0.01);
        probs.insert(2, 0.02);
        probs.insert(3, 0.05);
        probs.insert(4, 0.10);
        probs
    }

    #[test]
    fn test_cut_set_probability() {
        let probs = setup_probabilities();

        // Single event
        let cs1 = vec![1];
        assert!((cut_set_probability(&cs1, &probs) - 0.01).abs() < 1e-10);

        // Two events
        let cs2 = vec![1, 2];
        assert!((cut_set_probability(&cs2, &probs) - 0.0002).abs() < 1e-10);

        // Three events
        let cs3 = vec![1, 2, 3];
        assert!((cut_set_probability(&cs3, &probs) - 0.00001).abs() < 1e-10);
    }

    #[test]
    fn test_cut_set_probability_with_complement() {
        let mut probs = HashMap::new();
        probs.insert(1, 0.2);

        // Normal event
        let cs_normal = vec![1];
        assert!((cut_set_probability(&cs_normal, &probs) - 0.2).abs() < 1e-10);

        // Complement (NOT event)
        let cs_complement = vec![-1];
        assert!((cut_set_probability(&cs_complement, &probs) - 0.8).abs() < 1e-10);
    }

    #[test]
    fn test_cut_set_probability_missing_event() {
        let probs = setup_probabilities();

        // Event 999 doesn't exist
        let cs = vec![1, 999];
        assert_eq!(cut_set_probability(&cs, &probs), 0.0);
    }

    #[test]
    fn test_rare_event_approximation_simple() {
        let probs = setup_probabilities();

        // Two independent events: P = P(E1) + P(E3)
        let cut_sets = vec![vec![1], vec![3]];
        let p = rare_event_approximation(&cut_sets, &probs);

        // 0.01 + 0.05 = 0.06
        assert!((p - 0.06).abs() < 1e-10);
    }

    #[test]
    fn test_rare_event_approximation_and_gates() {
        let probs = setup_probabilities();

        // Cut sets: {E1,E2}, {E3}
        // P = P(E1∧E2) + P(E3) = 0.01×0.02 + 0.05 = 0.0502
        let cut_sets = vec![vec![1, 2], vec![3]];
        let p = rare_event_approximation(&cut_sets, &probs);

        assert!((p - 0.0502).abs() < 1e-6);
    }

    #[test]
    fn test_rare_event_capped_at_one() {
        let mut probs = HashMap::new();
        probs.insert(1, 0.9);
        probs.insert(2, 0.8);

        // Sum would be > 1.0
        let cut_sets = vec![vec![1], vec![2]];
        let p = rare_event_approximation(&cut_sets, &probs);

        assert_eq!(p, 1.0);
    }

    #[test]
    fn test_mcub_approximation_simple() {
        let probs = setup_probabilities();

        // Two independent events
        let cut_sets = vec![vec![1], vec![3]];
        let p = mcub_approximation(&cut_sets, &probs);

        // P = 1 - (1-0.01)(1-0.05) = 1 - 0.9405 = 0.0595
        assert!((p - 0.0595).abs() < 1e-6);
    }

    #[test]
    fn test_mcub_approximation_and_gates() {
        let probs = setup_probabilities();

        // Cut sets: {E1,E2}, {E3}
        let cut_sets = vec![vec![1, 2], vec![3]];
        let p = mcub_approximation(&cut_sets, &probs);

        // P(E1∧E2) = 0.0002, P(E3) = 0.05
        // P = 1 - (1-0.0002)(1-0.05) = 1 - 0.9498 = 0.0502 (approximately)
        assert!((p - 0.050190).abs() < 1e-6);
    }

    #[test]
    fn test_mcub_vs_rare_event() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1], vec![3]];

        let rare = rare_event_approximation(&cut_sets, &probs);
        let mcub = mcub_approximation(&cut_sets, &probs);

        // For very small probabilities, rare-event and MCUB should be very close
        // In this case, rare-event is actually slightly higher than MCUB
        // Both are valid approximations
        assert!((rare - mcub).abs() < 0.001);
    }

    #[test]
    fn test_rare_event_error_bounds() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1], vec![3]];

        let (lower, upper) = rare_event_error_bounds(&cut_sets, &probs);

        // For very small probabilities, the bounds should be very close
        assert!((lower - upper).abs() < 0.001);
        assert!((0.0..=1.0).contains(&lower));
        assert!((0.0..=1.0).contains(&upper));
    }

    #[test]
    fn test_validate_rare_event_valid() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1], vec![2], vec![3]];

        assert!(validate_rare_event(&cut_sets, &probs, 0.1));
    }

    #[test]
    fn test_validate_rare_event_invalid() {
        let mut probs = HashMap::new();
        probs.insert(1, 0.5); // Too high

        let cut_sets = vec![vec![1]];

        assert!(!validate_rare_event(&cut_sets, &probs, 0.1));
    }

    #[test]
    fn test_approximation_stats() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1], vec![3]];

        let stats = ApproximationStats::calculate(&cut_sets, &probs);

        assert_eq!(stats.num_cut_sets, 2);
        assert!((stats.rare_event - 0.06).abs() < 1e-6);
        assert!((stats.mcub - 0.0595).abs() < 1e-6);
        assert!((stats.max_event_prob - 0.10).abs() < 1e-10);
        assert!(stats.rare_event_valid);
    }

    #[test]
    fn test_approximation_stats_relative_error() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1], vec![3]];

        let stats = ApproximationStats::calculate(&cut_sets, &probs);
        let error = stats.relative_error();

        // Should be very small for rare events
        assert!(error < 0.01);
    }

    #[test]
    fn test_approximation_stats_recommended_method() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1], vec![3]];

        let stats = ApproximationStats::calculate(&cut_sets, &probs);
        let method = stats.recommended_method();

        assert!(method.contains("rare-event") || method.contains("mcub"));
    }

    #[test]
    fn test_empty_cut_sets() {
        let probs = setup_probabilities();
        let cut_sets: Vec<Vec<i32>> = vec![];

        assert_eq!(rare_event_approximation(&cut_sets, &probs), 0.0);
        assert_eq!(mcub_approximation(&cut_sets, &probs), 0.0);
    }

    #[test]
    fn test_single_cut_set() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1, 2]];

        let rare = rare_event_approximation(&cut_sets, &probs);
        let mcub = mcub_approximation(&cut_sets, &probs);

        // For a single cut set, both methods should give the same result
        assert!((rare - mcub).abs() < 1e-10);
        assert!((rare - 0.0002).abs() < 1e-10);
    }
}
