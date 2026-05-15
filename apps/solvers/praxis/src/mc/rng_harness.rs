//! Small RNG test harness hooks for Monte Carlo.
//!
//! This is intentionally lightweight and deterministic (no external test suites
//! like BigCrush). It provides basic sanity checks for the Philox4x32-10 stream
//! used by the DPMC engine.

use crate::mc::philox::{philox4x32_10, Philox4x32Ctr, Philox4x32Key};

const TWO_POW_32_F64: f64 = 4294967296.0;

#[inline]
fn u32_to_unit_interval(x: u32) -> f64 {
    // Map to [0,1) via division by 2^32.
    (x as f64) / TWO_POW_32_F64
}

/// Generate `n` u32 values from Philox by incrementing `ctr[3]`.
///
/// This is a convenience helper for deterministic test harnesses.
pub fn philox_u32_stream_from_ctr3(
    mut ctr: Philox4x32Ctr,
    key: Philox4x32Key,
    n: usize,
) -> Vec<u32> {
    let mut out = Vec::with_capacity(n);
    let mut produced = 0usize;

    while produced < n {
        let r = philox4x32_10(ctr, key);
        for &w in &r {
            if produced >= n {
                break;
            }
            out.push(w);
            produced += 1;
        }
        ctr[3] = ctr[3].wrapping_add(1);
    }

    out
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct StreamStats {
    pub mean_u01: f64,
    pub frac_high_bit_set: f64,
    pub corr_lag1_u01: f64,
}

/// Compute lightweight statistics over a u32 stream.
///
/// All computations are deterministic.
pub fn stream_stats_u32(values: &[u32]) -> Option<StreamStats> {
    if values.len() < 2 {
        return None;
    }

    let n = values.len() as f64;

    // Mean in [0,1).
    let mut sum = 0.0;
    let mut high_bit = 0usize;
    for &x in values {
        sum += u32_to_unit_interval(x);
        high_bit += ((x >> 31) & 1) as usize;
    }
    let mean = sum / n;
    let frac_high = (high_bit as f64) / n;

    // Lag-1 correlation of normalized values.
    let mut sum_x = 0.0;
    let mut sum_y = 0.0;
    let mut sum_x2 = 0.0;
    let mut sum_y2 = 0.0;
    let mut sum_xy = 0.0;

    for i in 0..(values.len() - 1) {
        let x = u32_to_unit_interval(values[i]);
        let y = u32_to_unit_interval(values[i + 1]);
        sum_x += x;
        sum_y += y;
        sum_x2 += x * x;
        sum_y2 += y * y;
        sum_xy += x * y;
    }

    let m = (values.len() - 1) as f64;
    let cov = (sum_xy / m) - (sum_x / m) * (sum_y / m);
    let var_x = (sum_x2 / m) - (sum_x / m) * (sum_x / m);
    let var_y = (sum_y2 / m) - (sum_y / m) * (sum_y / m);
    if var_x <= 0.0 || var_y <= 0.0 {
        return None;
    }
    let corr = cov / (var_x.sqrt() * var_y.sqrt());

    Some(StreamStats {
        mean_u01: mean,
        frac_high_bit_set: frac_high,
        corr_lag1_u01: corr,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn philox_stream_is_reproducible() {
        let key: Philox4x32Key = [123, 456];
        let ctr: Philox4x32Ctr = [1, 2, 3, 4];

        let a = philox_u32_stream_from_ctr3(ctr, key, 1000);
        let b = philox_u32_stream_from_ctr3(ctr, key, 1000);
        assert_eq!(a, b);
    }

    #[test]
    fn philox_stream_has_no_duplicates_in_small_prefix() {
        // Not a proof, just a cheap regression guard against accidental misuse.
        let key: Philox4x32Key = [0xDEAD_BEEF, 0x1234_5678];
        let ctr: Philox4x32Ctr = [0, 1, 2, 3];
        let v = philox_u32_stream_from_ctr3(ctr, key, 4096);

        let mut seen = HashSet::with_capacity(v.len());
        for x in v {
            assert!(seen.insert(x), "duplicate u32 in small Philox prefix");
        }
    }

    #[test]
    fn philox_stream_stats_are_reasonable() {
        let key: Philox4x32Key = [0xA5A5_A5A5, 0x5A5A_5A5A];
        let ctr: Philox4x32Ctr = [11, 22, 33, 44];
        let v = philox_u32_stream_from_ctr3(ctr, key, 20_000);
        let s = stream_stats_u32(&v).unwrap();

        // Mean should be near 0.5.
        assert!(
            (s.mean_u01 - 0.5).abs() < 0.01,
            "mean_u01={} out of expected range",
            s.mean_u01
        );

        // High bit set fraction should be near 0.5.
        assert!(
            (s.frac_high_bit_set - 0.5).abs() < 0.03,
            "frac_high_bit_set={} out of expected range",
            s.frac_high_bit_set
        );

        // Lag-1 correlation should be small.
        assert!(
            s.corr_lag1_u01.abs() < 0.03,
            "corr_lag1_u01={} too large",
            s.corr_lag1_u01
        );
    }
}
