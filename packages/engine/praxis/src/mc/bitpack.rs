//! Bitpacking utilities for the DPMC (data-parallel Monte Carlo) engine.
//!
//! Blueprint intent:
//! - A single machine word encodes `omega` Bernoulli trial outcomes.
//! - Least-significant bit corresponds to lane 0.
//! - Global trial indices are derived from `(t, b, p, lane)`.

use crate::mc::plan::RunParams;
use crate::Result;

pub type Bitpack = u64;

/// Number of trial lanes per packed word.
///
/// For `Bitpack = u64`, this is 64.
pub const OMEGA: usize = Bitpack::BITS as usize;

/// Returns the number of trials per iteration: $N = B \cdot P \cdot \omega$.
pub fn trials_per_iteration(params: &RunParams) -> Result<usize> {
    params
        .b
        .checked_mul(params.p)
        .and_then(|x| x.checked_mul(params.omega))
        .ok_or_else(|| {
            crate::error::PraxisError::Logic(
                "Overflow computing trials_per_iteration (B*P*omega)".to_string(),
            )
        })
}

/// Mapping from `(b, p, lane)` to the local trial index within one iteration.
///
/// This follows the TODO/blueprint convention:
/// `local = (b * P + p) * omega + lane`.
pub fn local_trial_index(params: &RunParams, b: usize, p: usize, lane: usize) -> Result<usize> {
    if params.omega != OMEGA {
        return Err(crate::error::PraxisError::Logic(format!(
            "RunParams.omega={} does not match Bitpack omega={} (u64)",
            params.omega, OMEGA
        )));
    }
    if b >= params.b {
        return Err(crate::error::PraxisError::Logic(format!(
            "b={} out of range (B={})",
            b, params.b
        )));
    }
    if p >= params.p {
        return Err(crate::error::PraxisError::Logic(format!(
            "p={} out of range (P={})",
            p, params.p
        )));
    }
    if lane >= params.omega {
        return Err(crate::error::PraxisError::Logic(format!(
            "lane={} out of range (omega={})",
            lane, params.omega
        )));
    }

    let bp = b
        .checked_mul(params.p)
        .and_then(|x| x.checked_add(p))
        .ok_or_else(|| crate::error::PraxisError::Logic("Overflow computing b*P+p".to_string()))?;

    bp.checked_mul(params.omega)
        .and_then(|x| x.checked_add(lane))
        .ok_or_else(|| {
            crate::error::PraxisError::Logic("Overflow computing local trial index".to_string())
        })
}

/// Mapping from `(t, b, p, lane)` to the global trial index across all iterations.
pub fn global_trial_index(
    params: &RunParams,
    t: usize,
    b: usize,
    p: usize,
    lane: usize,
) -> Result<usize> {
    if t >= params.t {
        return Err(crate::error::PraxisError::Logic(format!(
            "t={} out of range (T={})",
            t, params.t
        )));
    }

    let n = trials_per_iteration(params)?;
    let local = local_trial_index(params, b, p, lane)?;

    t.checked_mul(n)
        .and_then(|x| x.checked_add(local))
        .ok_or_else(|| {
            crate::error::PraxisError::Logic("Overflow computing global trial index".to_string())
        })
}

#[inline]
pub fn lane_mask(lane: usize) -> Bitpack {
    debug_assert!(lane < OMEGA);
    1u64 << lane
}

#[inline]
pub fn get_lane(word: Bitpack, lane: usize) -> bool {
    (word & lane_mask(lane)) != 0
}

#[inline]
pub fn set_lane(word: &mut Bitpack, lane: usize, value: bool) {
    let mask = lane_mask(lane);
    if value {
        *word |= mask;
    } else {
        *word &= !mask;
    }
}

#[inline]
pub fn popcount(word: Bitpack) -> u32 {
    word.count_ones()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bit_order_is_lsb_first() {
        let mut w: Bitpack = 0;
        set_lane(&mut w, 0, true);
        assert_eq!(w, 1);

        set_lane(&mut w, 1, true);
        assert_eq!(w, 3);

        set_lane(&mut w, 1, false);
        assert_eq!(w, 1);

        set_lane(&mut w, 63, true);
        assert_eq!(w, (1u64 << 63) | 1);
        assert!(get_lane(w, 0));
        assert!(get_lane(w, 63));
        assert!(!get_lane(w, 1));
    }

    #[test]
    fn popcount_sanity() {
        assert_eq!(popcount(0), 0);
        assert_eq!(popcount(0b1011), 3);
        assert_eq!(popcount(!0u64), 64);
    }

    #[test]
    fn lane_mapping_is_contiguous_within_bp() {
        let params = RunParams::new(2, 2, 3, OMEGA, 0);

        assert_eq!(local_trial_index(&params, 0, 0, 0).unwrap(), 0);
        assert_eq!(local_trial_index(&params, 0, 0, 1).unwrap(), 1);

        assert_eq!(local_trial_index(&params, 0, 1, 0).unwrap(), 64);
        assert_eq!(local_trial_index(&params, 0, 2, 63).unwrap(), 191);

        assert_eq!(local_trial_index(&params, 1, 0, 0).unwrap(), 192);
        assert_eq!(local_trial_index(&params, 1, 2, 63).unwrap(), 383);

        assert_eq!(trials_per_iteration(&params).unwrap(), 384);

        assert_eq!(global_trial_index(&params, 1, 0, 0, 0).unwrap(), 384);
        assert_eq!(global_trial_index(&params, 1, 1, 2, 63).unwrap(), 767);
    }

    #[test]
    fn lane_mapping_rejects_wrong_omega() {
        let params = RunParams::new(1, 1, 1, 32, 0);
        assert!(local_trial_index(&params, 0, 0, 0).is_err());
    }
}
