use std::collections::HashMap;

/// Probability of a single product (cut set or prime-implicant cube) given
/// per-event probabilities keyed by signed event index. A negative index is a
/// complemented literal and contributes `1 - p`. A missing event yields zero.
pub fn cut_set_probability(cut_set: &[i32], probabilities: &HashMap<i32, f64>) -> f64 {
    let mut product = 1.0;
    for &event_index in cut_set {
        let abs_index = event_index.abs();
        match probabilities.get(&abs_index) {
            Some(&prob) => {
                product *= if event_index > 0 { prob } else { 1.0 - prob };
            }
            None => return 0.0,
        }
    }
    product
}

/// Rare-event upper bound: the sum of the cut-set probabilities, capped at one.
/// This is the single source of truth for the rare-event approximation.
pub fn rare_event(cut_set_probabilities: &[f64]) -> f64 {
    let sum: f64 = cut_set_probabilities.iter().sum();
    sum.min(1.0)
}

/// Minimal cut upper bound: `1 - prod(1 - p_i)`, evaluated in log space so that
/// many tiny cut-set probabilities do not underflow the naive product. This is
/// the single source of truth for the MCUB approximation.
pub fn mcub(cut_set_probabilities: &[f64]) -> f64 {
    let log_keep: f64 = cut_set_probabilities.iter().map(|&p| (-p).ln_1p()).sum();
    -log_keep.exp_m1()
}

/// Rare-event approximation over explicit cut sets keyed by signed event index.
pub fn rare_event_approximation(cut_sets: &[Vec<i32>], probabilities: &HashMap<i32, f64>) -> f64 {
    let probs: Vec<f64> = cut_sets
        .iter()
        .map(|cut_set| cut_set_probability(cut_set, probabilities))
        .collect();
    rare_event(&probs)
}

/// MCUB approximation over explicit cut sets keyed by signed event index.
pub fn mcub_approximation(cut_sets: &[Vec<i32>], probabilities: &HashMap<i32, f64>) -> f64 {
    let probs: Vec<f64> = cut_sets
        .iter()
        .map(|cut_set| cut_set_probability(cut_set, probabilities))
        .collect();
    mcub(&probs)
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
    fn test_rare_event_simple() {
        assert!((rare_event(&[0.01, 0.05]) - 0.06).abs() < 1e-10);
    }

    #[test]
    fn test_rare_event_capped_at_one() {
        assert_eq!(rare_event(&[0.9, 0.8]), 1.0);
    }

    #[test]
    fn test_mcub_simple() {
        assert!((mcub(&[0.01, 0.05]) - 0.0595).abs() < 1e-6);
    }

    #[test]
    fn test_mcub_log_space_no_underflow() {
        // Many tiny probabilities: the naive product 1 - prod(1 - p) loses these
        // to rounding; the log-space form keeps the contribution.
        let probs = vec![1e-12; 1000];
        let m = mcub(&probs);
        assert!(m > 0.0);
        assert!((m - 1e-9).abs() < 1e-12);
    }

    #[test]
    fn test_rare_event_approximation_and_gates() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1, 2], vec![3]];
        let p = rare_event_approximation(&cut_sets, &probs);
        assert!((p - 0.0502).abs() < 1e-6);
    }

    #[test]
    fn test_mcub_approximation_and_gates() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1, 2], vec![3]];
        let p = mcub_approximation(&cut_sets, &probs);
        assert!((p - 0.050190).abs() < 1e-6);
    }

    #[test]
    fn test_mcub_vs_rare_event_close_when_rare() {
        let probs = setup_probabilities();
        let cut_sets = vec![vec![1], vec![3]];
        let rare = rare_event_approximation(&cut_sets, &probs);
        let m = mcub_approximation(&cut_sets, &probs);
        assert!((rare - m).abs() < 0.001);
    }

    #[test]
    fn test_empty_cut_sets() {
        assert_eq!(rare_event(&[]), 0.0);
        assert_eq!(mcub(&[]), 0.0);
    }
}
