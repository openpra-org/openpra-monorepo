use std::collections::HashMap;

pub fn cut_set_probability(cut_set: &[i32], probabilities: &HashMap<i32, f64>) -> f64 {
    let mut product = 1.0;
    for &event_index in cut_set {
        let abs_index = event_index.abs();
        if let Some(&prob) = probabilities.get(&abs_index) {

            if event_index > 0 {
                product *= prob;
            } else {
                product *= 1.0 - prob;
            }
        } else {

            return 0.0;
        }
    }
    product
}

pub fn rare_event_approximation(cut_sets: &[Vec<i32>], probabilities: &HashMap<i32, f64>) -> f64 {
    let mut sum = 0.0;

    for cut_set in cut_sets {
        sum += cut_set_probability(cut_set, probabilities);
    }

    if sum > 1.0 {
        1.0
    } else {
        sum
    }
}

pub fn mcub_approximation(cut_sets: &[Vec<i32>], probabilities: &HashMap<i32, f64>) -> f64 {
    let mut m = 1.0;

    for cut_set in cut_sets {
        let p_cut_set = cut_set_probability(cut_set, probabilities);
        m *= 1.0 - p_cut_set;
    }

    1.0 - m
}

pub fn rare_event_error_bounds(
    cut_sets: &[Vec<i32>],
    probabilities: &HashMap<i32, f64>,
) -> (f64, f64) {
    let rare_event = rare_event_approximation(cut_sets, probabilities);
    let mcub = mcub_approximation(cut_sets, probabilities);

    (rare_event, mcub)
}

pub fn validate_rare_event(
    cut_sets: &[Vec<i32>],
    probabilities: &HashMap<i32, f64>,
    threshold: f64,
) -> bool {

    for &prob in probabilities.values() {
        if prob > threshold {
            return false;
        }
    }

    for cut_set in cut_sets {
        let p_cut = cut_set_probability(cut_set, probabilities);
        if p_cut > threshold {
            return false;
        }
    }

    true
}

#[derive(Debug, Clone, PartialEq)]
pub struct ApproximationStats {

    pub rare_event: f64,

    pub mcub: f64,

    pub max_event_prob: f64,

    pub max_cut_set_prob: f64,

    pub num_cut_sets: usize,

    pub rare_event_valid: bool,
}

impl ApproximationStats {

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

    pub fn relative_error(&self) -> f64 {
        if self.mcub > 0.0 {
            ((self.mcub - self.rare_event) / self.mcub).abs()
        } else {
            0.0
        }
    }

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

        let cs1 = vec![1];
        assert!((cut_set_probability(&cs1, &probs) - 0.01).abs() < 1e-10);

        let cs2 = vec![1, 2];
        assert!((cut_set_probability(&cs2, &probs) - 0.0002).abs() < 1e-10);

        let cs3 = vec![1, 2, 3];
        assert!((cut_set_probability(&cs3, &probs) - 0.00001).abs() < 1e-10);
    }

    #[test]
    fn test_cut_set_probability_with_complement() {
        let mut probs = HashMap::new();
        probs.insert(1, 0.2);

        let cs_normal = vec![1];
        assert!((cut_set_probability(&cs_normal, &probs) - 0.2).abs() < 1e-10);

        let cs_complement = vec![-1];
        assert!((cut_set_probability(&cs_complement, &probs) - 0.8).abs() < 1e-10);
    }

    #[test]
    fn test_cut_set_probability_missing_event() {
        let probs = setup_probabilities();

        let cs = vec![1, 999];
        assert_eq!(cut_set_probability(&cs, &probs), 0.0);
    }

    #[test]
    fn test_rare_event_approximation_simple() {
        let probs = setup_probabilities();

        let cut_sets = vec![vec![1], vec![3]];
        let p = rare_event_approximation(&cut_sets, &probs);

        assert!((p - 0.06).abs() < 1e-10);
    }

    #[test]
    fn test_rare_event_approximation_and_gates() {
        let probs = setup_probabilities();

        let cut_sets = vec![vec![1, 2], vec![3]];
        let p = rare_event_approximation(&cut_sets, &probs);

        assert!((p - 0.0502).abs() < 1e-6);
    }

    #[test]
    fn test_rare_event_capped_at_one() {
        let mut probs = HashMap::new();
        probs.insert(1, 0.9);
        probs.insert(2, 0.8);

        let cut_sets = vec![vec![1], vec![2]];
        let p = rare_event_approximation(&cut_sets, &probs);

        assert_eq!(p, 1.0);
    }

    #[test]
    fn test_mcub_approximation_simple() {
        let probs = setup_probabilities();

        let cut_sets = vec![vec![1], vec![3]];
        let p = mcub_approximation(&cut_sets, &probs);

        assert!((p - 0.0595).abs() < 1e-6);
    }

    #[test]
    fn test_mcub_approximation_and_gates() {
        let probs = setup_probabilities();

        let cut_sets = vec![vec![1, 2], vec![3]];
        let p = mcub_approximation(&cut_sets, &probs);

        assert!((p - 0.050190).abs() < 1e-6);
    }

    #[test]
    fn test_mcub_vs_rare_event() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1], vec![3]];

        let rare = rare_event_approximation(&cut_sets, &probs);
        let mcub = mcub_approximation(&cut_sets, &probs);

        assert!((rare - mcub).abs() < 0.001);
    }

    #[test]
    fn test_rare_event_error_bounds() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1], vec![3]];

        let (lower, upper) = rare_event_error_bounds(&cut_sets, &probs);

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
        probs.insert(1, 0.5);

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

        assert!((rare - mcub).abs() < 1e-10);
        assert!((rare - 0.0002).abs() < 1e-10);
    }
}
