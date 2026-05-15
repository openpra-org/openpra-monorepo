//! Blueprint counter assignment for counter-based RNG streams.
//!
//! Blueprint mapping (reserving 6 low bits for intra-thread increments):
//!
//! $$C(ix, iy, iz, t) = (ix+1, iz+1, iy+1, (t+1)\ll 6)$$

use crate::mc::philox::Philox4x32Ctr;

/// Number of low bits reserved for intra-thread increments.
pub const INTRA_THREAD_BITS: u32 = 6;

/// Number of unique increments available per base counter.
pub const INTRA_THREAD_SPACE: u32 = 1u32 << INTRA_THREAD_BITS;

#[inline]
fn checked_plus_one(x: u32) -> u32 {
    x.checked_add(1).expect("counter component overflow on +1")
}

#[inline]
fn checked_t_to_ctr3(t: u32) -> u32 {
    // Need (t+1) << 6 to fit in u32.
    let tp1 = checked_plus_one(t);
    tp1.checked_shl(INTRA_THREAD_BITS)
        .expect("counter component overflow on (t+1)<<6")
}

/// Base blueprint counter for a work-item.
///
/// Panics on overflow (debug-friendly) if indices are too large.
#[inline]
pub fn blueprint_base_counter(ix: u32, iy: u32, iz: u32, t: u32) -> Philox4x32Ctr {
    [
        checked_plus_one(ix),
        checked_plus_one(iz),
        checked_plus_one(iy),
        checked_t_to_ctr3(t),
    ]
}

/// Derive a unique counter for an intra-thread increment in `[0, 64)`.
///
/// This is how we generate multiple Philox blocks per work-item without collisions.
#[inline]
pub fn blueprint_counter_with_increment(
    ix: u32,
    iy: u32,
    iz: u32,
    t: u32,
    increment: u32,
) -> Philox4x32Ctr {
    assert!(
        increment < INTRA_THREAD_SPACE,
        "increment must be < {}",
        INTRA_THREAD_SPACE
    );
    let mut ctr = blueprint_base_counter(ix, iy, iz, t);
    ctr[3] = ctr[3].wrapping_add(increment);
    ctr
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn pack_ctr(c: Philox4x32Ctr) -> u128 {
        ((c[0] as u128) << 96) | ((c[1] as u128) << 64) | ((c[2] as u128) << 32) | (c[3] as u128)
    }

    #[test]
    fn base_counter_is_deterministic() {
        let a = blueprint_base_counter(1, 2, 3, 4);
        let b = blueprint_base_counter(1, 2, 3, 4);
        assert_eq!(a, b);
    }

    #[test]
    fn counters_are_unique_for_small_nd_range() {
        let mut seen = HashSet::<u128>::new();

        for t in 0..3u32 {
            for ix in 0..5u32 {
                for iy in 0..4u32 {
                    for iz in 0..3u32 {
                        for inc in 0..INTRA_THREAD_SPACE {
                            let ctr = blueprint_counter_with_increment(ix, iy, iz, t, inc);
                            let key = pack_ctr(ctr);
                            assert!(seen.insert(key), "duplicate counter: {ctr:?}");
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn increment_affects_only_ctr3_low_bits() {
        let base = blueprint_base_counter(0, 0, 0, 0);
        let c0 = blueprint_counter_with_increment(0, 0, 0, 0, 0);
        let c1 = blueprint_counter_with_increment(0, 0, 0, 0, 1);

        assert_eq!(base, c0);
        assert_eq!(c1[0], base[0]);
        assert_eq!(c1[1], base[1]);
        assert_eq!(c1[2], base[2]);
        assert_eq!(c1[3], base[3].wrapping_add(1));
    }
}
