use crate::Result;

/// Per-node popcount tally accumulators.
///
/// Blueprint-style DPMC uses popcount tallies (`s_v`) rather than storing
/// per-trial booleans. The host tracks the total number of Bernoulli samples
/// processed (`n_v`) and derives probability estimates as `p_hat = s_v / n_v`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodeTallies {
    ones: Vec<u64>,
    bits: u64,
}

impl NodeTallies {
    pub fn new(num_nodes: usize) -> Self {
        Self {
            ones: vec![0u64; num_nodes],
            bits: 0u64,
        }
    }

    pub fn num_nodes(&self) -> usize {
        self.ones.len()
    }

    pub fn ones_by_node(&self) -> &[u64] {
        &self.ones
    }

    pub fn bits_total(&self) -> u64 {
        self.bits
    }

    pub fn add_iteration(&mut self, ones_by_node: &[u64], bits_in_iteration: u64) -> Result<()> {
        if bits_in_iteration == 0 {
            return Err(crate::error::PraxisError::Settings(
                "bits_in_iteration must be > 0".to_string(),
            ));
        }
        if ones_by_node.len() != self.ones.len() {
            return Err(crate::error::PraxisError::Logic(format!(
                "Expected {} node tallies, got {}",
                self.ones.len(),
                ones_by_node.len()
            )));
        }

        for (dst, src) in self.ones.iter_mut().zip(ones_by_node.iter()) {
            *dst = dst.wrapping_add(*src);
        }
        self.bits = self.bits.wrapping_add(bits_in_iteration);

        Ok(())
    }

    pub fn p_hat(&self, node: usize) -> Result<f64> {
        if self.bits == 0 {
            return Err(crate::error::PraxisError::Logic(
                "Cannot compute p_hat with zero total bits".to_string(),
            ));
        }
        let ones = *self.ones.get(node).ok_or_else(|| {
            crate::error::PraxisError::Logic(format!(
                "Node index {node} out of bounds (num_nodes={})",
                self.ones.len()
            ))
        })?;

        Ok((ones as f64) / (self.bits as f64))
    }
}

/// Compute the effective number of trial-bits represented by a `(B,P,omega)` layout.
///
/// If `valid_lanes_last_word != 0`, the final word is treated as having only that
/// many valid lanes and the remaining padded lanes are excluded from the total.
pub fn effective_bits_per_iteration(
    b: usize,
    p: usize,
    omega: usize,
    valid_lanes_last_word: u32,
) -> Result<u64> {
    if b == 0 || p == 0 || omega == 0 {
        return Err(crate::error::PraxisError::Settings(
            "b, p, and omega must be > 0".to_string(),
        ));
    }

    let total = b
        .checked_mul(p)
        .and_then(|bp| bp.checked_mul(omega))
        .ok_or_else(|| {
            crate::error::PraxisError::Settings("B*P*omega overflows usize".to_string())
        })? as u64;

    if valid_lanes_last_word == 0 {
        return Ok(total);
    }

    let valid = valid_lanes_last_word as usize;
    if valid > omega {
        return Err(crate::error::PraxisError::Settings(format!(
            "valid_lanes_last_word ({valid}) must be <= omega ({omega})"
        )));
    }
    if valid == omega {
        return Ok(total);
    }

    Ok(total - (omega as u64 - valid as u64))
}

/// Compute per-node popcount tallies from a packed `(B,P,node)` word buffer.
///
/// Layout contract:
/// - `node_words` is length `B*P*num_nodes`.
/// - Indexing matches the GPU kernels: `ix = (bp * num_nodes + node)` with
///   `bp = b*p_count + p`.
///
/// Masking contract:
/// - If `valid_lanes_last_word == 0`, all 64 lanes are considered valid.
/// - Otherwise, only the lowest `valid_lanes_last_word` bits of the *final* `(b,p)` word
///   contribute to the tallies (used when `num_trials` is not divisible by 64).
pub fn popcount_tallies_from_node_words_u64(
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words: &[u64],
    valid_lanes_last_word: u32,
) -> Result<Vec<u64>> {
    let total_words = (num_nodes as usize)
        .checked_mul(b_count as usize)
        .and_then(|x| x.checked_mul(p_count as usize))
        .ok_or_else(|| {
            crate::error::PraxisError::Settings("B*P*num_nodes overflows usize".to_string())
        })?;

    if node_words.len() != total_words {
        return Err(crate::error::PraxisError::Logic(format!(
            "node_words must be B*P*num_nodes (expected {total_words}, got {})",
            node_words.len()
        )));
    }

    if valid_lanes_last_word > 64 {
        return Err(crate::error::PraxisError::Settings(
            "valid_lanes_last_word must be in 0..=64".to_string(),
        ));
    }

    let bp_total = (b_count as usize) * (p_count as usize);
    let num_nodes_usize = num_nodes as usize;
    let mut out = vec![0u64; num_nodes_usize];

    for bp in 0..bp_total {
        let is_last_word = bp + 1 == bp_total;
        let lane_mask: u64 = if is_last_word && valid_lanes_last_word != 0 {
            if valid_lanes_last_word == 64 {
                !0u64
            } else {
                (1u64 << valid_lanes_last_word) - 1u64
            }
        } else {
            !0u64
        };

        let base = bp * num_nodes_usize;
        for n in 0..num_nodes_usize {
            out[n] += (node_words[base + n] & lane_mask).count_ones() as u64;
        }
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_tallies_accumulate_across_iterations() {
        let mut tallies = NodeTallies::new(3);

        tallies.add_iteration(&[1, 2, 3], 64).unwrap();
        tallies.add_iteration(&[4, 5, 6], 32).unwrap();

        assert_eq!(tallies.bits_total(), 96);
        assert_eq!(tallies.ones_by_node(), &[5, 7, 9]);
        assert!((tallies.p_hat(0).unwrap() - (5.0 / 96.0)).abs() < 1e-12);
    }

    #[test]
    fn node_tallies_reject_wrong_len() {
        let mut tallies = NodeTallies::new(2);
        let err = tallies.add_iteration(&[1, 2, 3], 64).unwrap_err();
        assert!(format!("{err}").contains("Expected 2 node tallies"));
    }

    #[test]
    fn effective_bits_accounts_for_lane_mask() {
        // Two 64-lane words, but only 10 lanes valid in the last word.
        let bits = effective_bits_per_iteration(1, 2, 64, 10).unwrap();
        assert_eq!(bits, 128 - (64 - 10));

        // Full words.
        let bits_full = effective_bits_per_iteration(2, 3, 64, 0).unwrap();
        assert_eq!(bits_full, 2 * 3 * 64);
    }

    fn scalar_per_bit_count(word: u64, valid_lanes: u32) -> u64 {
        let lanes = if valid_lanes == 0 {
            64
        } else {
            valid_lanes as usize
        };
        let mut sum = 0u64;
        for lane in 0..lanes {
            sum += (word >> lane) & 1u64;
        }
        sum
    }

    #[test]
    fn popcount_tallies_matches_scalar_per_bit_count_randomized() {
        let num_nodes = 11u32;
        let b_count = 3u32;
        let p_count = 4u32;
        let total_words = (num_nodes * b_count * p_count) as usize;

        // Deterministic pseudo-random words.
        let mut words: Vec<u64> = Vec::with_capacity(total_words);
        let mut x = 0xD1B5_D00Du64;
        for _ in 0..total_words {
            x = x
                .wrapping_mul(6364136223846793005u64)
                .wrapping_add(1442695040888963407u64);
            words.push(x);
        }

        for &valid in &[0u32, 1u32, 17u32, 32u32, 63u32] {
            let got =
                popcount_tallies_from_node_words_u64(num_nodes, b_count, p_count, &words, valid)
                    .expect("tally");

            let bp_total = (b_count * p_count) as usize;
            let num_nodes_usize = num_nodes as usize;
            let mut expected = vec![0u64; num_nodes_usize];
            for bp in 0..bp_total {
                let is_last = bp + 1 == bp_total;
                let lanes = if is_last { valid } else { 0u32 };
                let base = bp * num_nodes_usize;
                for n in 0..num_nodes_usize {
                    expected[n] += scalar_per_bit_count(words[base + n], lanes);
                }
            }

            assert_eq!(got, expected);
        }
    }

    #[test]
    fn popcount_tallies_rejects_invalid_valid_lanes() {
        let err = popcount_tallies_from_node_words_u64(1, 1, 1, &[0u64], 65).unwrap_err();
        assert!(format!("{err}").contains("valid_lanes_last_word"));
    }
}
