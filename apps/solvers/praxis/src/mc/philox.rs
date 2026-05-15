//! Philox counter-based PRNG core.
//!
//! This module implements Philox4x32 with configurable rounds.
//! It is designed to be CPU/GPU-friendly: only `u32` ops plus `u64` for mul hi/lo.

/// Philox4x32 key (2 x 32-bit words).
pub type Philox4x32Key = [u32; 2];

/// Philox4x32 counter/state (4 x 32-bit words).
pub type Philox4x32Ctr = [u32; 4];

const PHILOX_M4X32_0: u32 = 0xD251_1F53;
const PHILOX_M4X32_1: u32 = 0xCD9E_8D57;

const PHILOX_W32_0: u32 = 0x9E37_79B9;
const PHILOX_W32_1: u32 = 0xBB67_AE85;

#[inline]
fn mul_hi_lo_u32(a: u32, b: u32) -> (u32, u32) {
    let product = (a as u64) * (b as u64);
    let lo = product as u32;
    let hi = (product >> 32) as u32;
    (hi, lo)
}

#[inline]
fn bumpkey_4x32(key: Philox4x32Key) -> Philox4x32Key {
    [
        key[0].wrapping_add(PHILOX_W32_0),
        key[1].wrapping_add(PHILOX_W32_1),
    ]
}

#[inline]
fn round_4x32(ctr: Philox4x32Ctr, key: Philox4x32Key) -> Philox4x32Ctr {
    let (hi0, lo0) = mul_hi_lo_u32(PHILOX_M4X32_0, ctr[0]);
    let (hi1, lo1) = mul_hi_lo_u32(PHILOX_M4X32_1, ctr[2]);

    [hi1 ^ ctr[1] ^ key[0], lo1, hi0 ^ ctr[3] ^ key[1], lo0]
}

/// Compute Philox4x32 with the specified number of rounds.
///
/// This follows Random123's reference definition:
/// - Round 0 uses the provided key.
/// - Each subsequent round bumps the key by Weyl constants before applying the round.
///
/// Panics if `rounds > 16`.
pub fn philox4x32_r(rounds: u32, mut ctr: Philox4x32Ctr, mut key: Philox4x32Key) -> Philox4x32Ctr {
    assert!(
        rounds <= 16,
        "Philox is only unrolled up to 16 rounds in Random123"
    );

    if rounds == 0 {
        return ctr;
    }

    ctr = round_4x32(ctr, key);
    for _ in 1..rounds {
        key = bumpkey_4x32(key);
        ctr = round_4x32(ctr, key);
    }
    ctr
}

/// Philox4x32-10 (the default Philox4x32 variant).
#[inline]
pub fn philox4x32_10(ctr: Philox4x32Ctr, key: Philox4x32Key) -> Philox4x32Ctr {
    philox4x32_r(10, ctr, key)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Known-answer vectors sourced from Random123 `tests/time_initkeyctr.h`.
    const EXAMPLE_KEY0: u32 = 0xDEAD_BEEF;
    const EXAMPLE_KEY1: u32 = 0x1234_5678;

    const EXAMPLE_CTR0: u32 = 0x0000_0000;
    const EXAMPLE_CTR1: u32 = 0x1000_0000;
    const EXAMPLE_CTR2: u32 = 0x2000_0000;
    const EXAMPLE_CTR3: u32 = 0x3000_0000;

    #[test]
    fn kat_philox4x32_10_matches_random123() {
        let key: Philox4x32Key = [EXAMPLE_KEY0, EXAMPLE_KEY1];
        let ctr: Philox4x32Ctr = [EXAMPLE_CTR0, EXAMPLE_CTR1, EXAMPLE_CTR2, EXAMPLE_CTR3];

        let out = philox4x32_r(10, ctr, key);
        let expected: Philox4x32Ctr = [0xF16D_828E, 0xA1C5_962D, 0xACAC_820C, 0x5811_3D7A];
        assert_eq!(out, expected);

        // Also exercise the convenience wrapper.
        assert_eq!(philox4x32_10(ctr, key), expected);
    }

    #[test]
    fn kat_philox4x32_7_matches_random123() {
        let key: Philox4x32Key = [EXAMPLE_KEY0, EXAMPLE_KEY1];
        let ctr: Philox4x32Ctr = [EXAMPLE_CTR0, EXAMPLE_CTR1, EXAMPLE_CTR2, EXAMPLE_CTR3];

        let out = philox4x32_r(7, ctr, key);
        let expected: Philox4x32Ctr = [0x40BA_6A95, 0x799E_6A43, 0x7DCA_BE10, 0xA7A8_1636];
        assert_eq!(out, expected);
    }

    #[test]
    fn philox4x32_is_deterministic() {
        let key: Philox4x32Key = [1, 2];
        let ctr: Philox4x32Ctr = [3, 4, 5, 6];

        let a = philox4x32_10(ctr, key);
        let b = philox4x32_10(ctr, key);
        assert_eq!(a, b);

        let c = philox4x32_10([3, 4, 5, 7], key);
        assert_ne!(a, c);
    }
}
