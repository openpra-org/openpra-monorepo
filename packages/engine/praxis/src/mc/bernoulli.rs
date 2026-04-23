//! Integer-threshold Bernoulli sampling.
//!
//! The blueprint uses 32-bit uniform integers and compares against a precomputed
//! threshold derived from $p \cdot 2^{32}$.

use crate::mc::counter::blueprint_counter_with_increment;
use crate::mc::philox::philox4x32_10;
use crate::mc::philox::Philox4x32Ctr;
use crate::mc::philox::Philox4x32Key;

/// $2^{32}$ as f64 (exact).
const TWO_POW_32_F64: f64 = 4_294_967_296.0;

/// Bernoulli threshold representation.
///
/// When `full_range=true`, the outcome is always true (i.e., p=1 exactly).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BernoulliThreshold {
    pub t: u32,
    pub full_range: bool,
}

impl BernoulliThreshold {
    #[inline]
    pub const fn always_false() -> Self {
        Self {
            t: 0,
            full_range: false,
        }
    }

    #[inline]
    pub const fn always_true() -> Self {
        Self {
            t: 0,
            full_range: true,
        }
    }
}

/// Convert a probability in $[0, 1]$ to a threshold compatible with `sample_u32`.
///
/// Computes $T = \lfloor p \cdot 2^{32} \rfloor$ using `f64` and returns:
/// - `full_range=true` if $T = 2^{32}$ (i.e., p=1).
/// - otherwise `full_range=false` with `t = T as u32`.
#[inline]
pub fn threshold_from_probability(p: f64) -> BernoulliThreshold {
    if !p.is_finite() {
        if p.is_nan() {
            return BernoulliThreshold::always_false();
        }
        return if p.is_sign_positive() {
            BernoulliThreshold::always_true()
        } else {
            BernoulliThreshold::always_false()
        };
    }

    let p = p.clamp(0.0, 1.0);
    let scaled = (p * TWO_POW_32_F64).floor();

    if scaled <= 0.0 {
        return BernoulliThreshold::always_false();
    }
    if scaled >= TWO_POW_32_F64 {
        return BernoulliThreshold::always_true();
    }

    BernoulliThreshold {
        t: scaled as u32,
        full_range: false,
    }
}

/// Sample a Bernoulli outcome from a 32-bit uniform integer `r`.
///
/// Uses `r < T` where `T` is derived by `threshold_from_probability`.
#[inline]
pub fn sample_u32(r: u32, threshold: BernoulliThreshold) -> bool {
    if threshold.full_range {
        return true;
    }
    r < threshold.t
}

/// Deterministic helper that generates one Philox4x32-10 block and returns the 4 outcomes.
///
/// This is primarily intended for unit tests and CPU reference behavior.
#[inline]
pub fn sample_block_philox4x32_10(
    ctr: Philox4x32Ctr,
    key: Philox4x32Key,
    threshold: BernoulliThreshold,
) -> [bool; 4] {
    let r = philox4x32_10(ctr, key);
    [
        sample_u32(r[0], threshold),
        sample_u32(r[1], threshold),
        sample_u32(r[2], threshold),
        sample_u32(r[3], threshold),
    ]
}

/// Sample one Philox4x32-10 block using the blueprint counter mapping.
///
/// `increment` must be in `[0, 64)` and corresponds to the reserved 6 bits in ctr[3].
#[inline]
pub fn sample_block_blueprint(
    ix: u32,
    iy: u32,
    iz: u32,
    t: u32,
    increment: u32,
    key: Philox4x32Key,
    threshold: BernoulliThreshold,
) -> [bool; 4] {
    let ctr = blueprint_counter_with_increment(ix, iy, iz, t, increment);
    sample_block_philox4x32_10(ctr, key, threshold)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn threshold_edge_cases() {
        let z = threshold_from_probability(0.0);
        assert_eq!(
            z,
            BernoulliThreshold {
                t: 0,
                full_range: false
            }
        );

        let o = threshold_from_probability(1.0);
        assert_eq!(
            o,
            BernoulliThreshold {
                t: 0,
                full_range: true
            }
        );

        // This is exactly (2^32 - 1)/2^32. It should NOT become full_range.
        let p_almost_one = (TWO_POW_32_F64 - 1.0) / TWO_POW_32_F64;
        let th = threshold_from_probability(p_almost_one);
        assert!(!th.full_range);
        assert_eq!(th.t, u32::MAX);

        // Non-finite inputs should be safe.
        assert_eq!(
            threshold_from_probability(f64::NAN),
            BernoulliThreshold::always_false()
        );
        assert_eq!(
            threshold_from_probability(f64::INFINITY),
            BernoulliThreshold::always_true()
        );
        assert_eq!(
            threshold_from_probability(f64::NEG_INFINITY),
            BernoulliThreshold::always_false()
        );
    }

    #[test]
    fn sampling_matches_threshold_contract() {
        let th = BernoulliThreshold {
            t: 10,
            full_range: false,
        };
        assert!(sample_u32(0, th));
        assert!(sample_u32(9, th));
        assert!(!sample_u32(10, th));

        let th0 = threshold_from_probability(0.0);
        assert!(!sample_u32(0, th0));
        assert!(!sample_u32(u32::MAX, th0));

        let th1 = threshold_from_probability(1.0);
        assert!(sample_u32(0, th1));
        assert!(sample_u32(u32::MAX, th1));
    }

    #[test]
    fn sampling_is_reproducible_with_fixed_key_and_counter() {
        let key: Philox4x32Key = [123, 456];
        let ctr: Philox4x32Ctr = [0, 1, 2, 3];
        let th = threshold_from_probability(0.25);

        let a = sample_block_philox4x32_10(ctr, key, th);
        let b = sample_block_philox4x32_10(ctr, key, th);
        assert_eq!(a, b);
    }

    #[test]
    fn sampling_mean_is_close_to_p_for_fixed_counter_stream() {
        // Deterministic, non-flaky because Philox is deterministic.
        // We just want a coarse sanity check (not a statistical test suite).
        let key: Philox4x32Key = [0xDEAD_BEEF, 0x1234_5678];
        let threshold = threshold_from_probability(0.5);

        let mut ones: u64 = 0;
        let mut total: u64 = 0;

        // Walk a simple counter stream by incrementing ctr[0].
        // Each Philox block yields 4 u32 values.
        for i in 0..10_000u32 {
            let ctr: Philox4x32Ctr = [i, 0, 0, 0];
            let r = philox4x32_10(ctr, key);
            for &x in &r {
                if sample_u32(x, threshold) {
                    ones += 1;
                }
                total += 1;
            }
        }

        let mean = ones as f64 / total as f64;
        assert!((mean - 0.5).abs() < 0.02, "mean={mean}");
    }

    #[test]
    fn blueprint_helper_is_reproducible() {
        let key: Philox4x32Key = [0xDEAD_BEEF, 0x1234_5678];
        let threshold = threshold_from_probability(0.5);

        let a = sample_block_blueprint(1, 2, 3, 4, 0, key, threshold);
        let b = sample_block_blueprint(1, 2, 3, 4, 0, key, threshold);
        assert_eq!(a, b);

        let c = sample_block_blueprint(1, 2, 3, 4, 1, key, threshold);
        assert_ne!(a, c);
    }
}
