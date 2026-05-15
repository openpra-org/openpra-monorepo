/// Pseudo-random number generator for Monte Carlo simulation
///
/// Uses ChaCha8Rng for reproducible, high-quality random number generation
/// with cryptographic security properties.
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

/// Initialize a ChaCha8 RNG with an optional seed
///
/// # Arguments
/// * `seed` - Optional 64-bit seed for reproducibility. If None, uses system entropy.
///
/// # Returns
/// * ChaCha8Rng instance
///
/// # Examples
/// ```
/// use praxis::mc::prng::initialize_rng;
///
/// // Deterministic RNG for reproducibility
/// let rng = initialize_rng(Some(42));
///
/// // Non-deterministic RNG from system entropy
/// let rng_random = initialize_rng(None);
/// ```
pub fn initialize_rng(seed: Option<u64>) -> ChaCha8Rng {
    match seed {
        Some(s) => ChaCha8Rng::seed_from_u64(s),
        None => ChaCha8Rng::from_entropy(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::Rng;

    // T146: Test seed reproducibility
    #[test]
    fn test_initialize_rng_with_seed() {
        let mut rng1 = initialize_rng(Some(42));
        let mut rng2 = initialize_rng(Some(42));

        // Same seed should produce same sequence
        for _ in 0..100 {
            assert_eq!(rng1.gen::<u64>(), rng2.gen::<u64>());
        }
    }

    #[test]
    fn test_initialize_rng_different_seeds() {
        let mut rng1 = initialize_rng(Some(42));
        let mut rng2 = initialize_rng(Some(123));

        // Different seeds should produce different sequences
        let mut same_count = 0;
        for _ in 0..100 {
            if rng1.gen::<u64>() == rng2.gen::<u64>() {
                same_count += 1;
            }
        }

        // Very unlikely to have more than a few matches by chance
        assert!(
            same_count < 10,
            "RNGs with different seeds produced too many identical values"
        );
    }

    #[test]
    fn test_initialize_rng_without_seed() {
        let mut rng1 = initialize_rng(None);
        let mut rng2 = initialize_rng(None);

        // Without seed, should produce different sequences
        let mut same_count = 0;
        for _ in 0..100 {
            if rng1.gen::<u64>() == rng2.gen::<u64>() {
                same_count += 1;
            }
        }

        // Very unlikely to match without fixed seed
        assert!(
            same_count < 10,
            "Unseeded RNGs produced too many identical values"
        );
    }

    #[test]
    fn test_uniform_distribution() {
        let mut rng = initialize_rng(Some(42));

        // Generate uniform samples in [0, 1)
        let samples: Vec<f64> = (0..1000).map(|_| rng.gen::<f64>()).collect();

        // Check all samples are in valid range
        for &s in &samples {
            assert!((0.0..1.0).contains(&s), "Sample {} out of range", s);
        }

        // Check roughly uniform distribution (mean should be ~0.5)
        let mean: f64 = samples.iter().sum::<f64>() / samples.len() as f64;
        assert!((mean - 0.5).abs() < 0.05, "Mean {} too far from 0.5", mean);
    }
}
