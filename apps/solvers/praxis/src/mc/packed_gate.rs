//! Packed (bitwise) gate evaluation over `Bitpack` words.
//!
//! This is the CPU reference for the blueprint-style kernels:
//! - Each `Bitpack` word encodes `omega` Bernoulli outcomes (one bit per lane).
//! - Complemented edges are handled by inverting the input word (`!word`).

use crate::algorithms::pdag::Connective;
use crate::mc::bitpack::Bitpack;
use crate::mc::bitpack::{get_lane, set_lane, OMEGA};
use crate::mc::plan::{GateDescriptor, GateInput};

/// Evaluate a single gate's output word from already-computed input words.
///
/// `node_words` is indexed by absolute `NodeIndex` as `usize`.
#[inline]
pub fn eval_gate_word(desc: &GateDescriptor, node_words: &[Bitpack]) -> Bitpack {
    eval_connective_word(desc.connective, &desc.operands, node_words, desc.min_number)
}

#[inline]
fn eval_connective_word(
    connective: Connective,
    operands: &[GateInput],
    node_words: &[Bitpack],
    min_number: Option<usize>,
) -> Bitpack {
    match connective {
        Connective::And => fold_and(operands, node_words),
        Connective::Or => fold_or(operands, node_words),
        Connective::Xor => fold_xor(operands, node_words),
        Connective::Nand => !fold_and(operands, node_words),
        Connective::Nor => !fold_or(operands, node_words),
        Connective::Iff => eval_iff(operands, node_words),
        Connective::AtLeast => {
            let k = min_number.expect("AtLeast requires min_number");
            eval_atleast(operands, node_words, k)
        }
        Connective::Not | Connective::Null => {
            // MC-minimal preprocessing should have removed these from the plan.
            panic!("Unexpected connective in packed gate evaluation: {connective:?}")
        }
    }
}

#[inline]
fn operand_word(op: &GateInput, node_words: &[Bitpack]) -> Bitpack {
    let idx = op.index.unsigned_abs() as usize;
    let mut w = node_words[idx];
    if op.is_negated {
        w = !w;
    }
    w
}

#[inline]
fn fold_and(operands: &[GateInput], node_words: &[Bitpack]) -> Bitpack {
    let mut acc = !0u64;
    for op in operands {
        acc &= operand_word(op, node_words);
    }
    acc
}

#[inline]
fn fold_or(operands: &[GateInput], node_words: &[Bitpack]) -> Bitpack {
    let mut acc = 0u64;
    for op in operands {
        acc |= operand_word(op, node_words);
    }
    acc
}

#[inline]
fn fold_xor(operands: &[GateInput], node_words: &[Bitpack]) -> Bitpack {
    let mut acc = 0u64;
    for op in operands {
        acc ^= operand_word(op, node_words);
    }
    acc
}

#[inline]
fn eval_iff(operands: &[GateInput], node_words: &[Bitpack]) -> Bitpack {
    // IFF is true when all operands are equal.
    // For booleans, this is equivalent to (AND operands) OR (AND (NOT operands)).
    // Works for any arity >= 1.
    let mut all_true = !0u64;
    let mut all_false = !0u64;

    for op in operands {
        let w = operand_word(op, node_words);
        all_true &= w;
        all_false &= !w;
    }

    all_true | all_false
}

#[inline]
fn eval_atleast(operands: &[GateInput], node_words: &[Bitpack], k: usize) -> Bitpack {
    // CPU fallback: evaluate lane-by-lane.
    // This is correct and matches the blueprint semantics, even if not the fastest approach.
    let n = operands.len();
    if k == 0 {
        return !0u64;
    }
    if n == 0 || k > n {
        return 0u64;
    }

    let mut out = 0u64;
    for lane in 0..OMEGA {
        let mut count = 0usize;
        for op in operands {
            let mut v = get_lane(node_words[op.index.unsigned_abs() as usize], lane);
            if op.is_negated {
                v = !v;
            }
            if v {
                count += 1;
                if count >= k {
                    break;
                }
            }
        }
        set_lane(&mut out, lane, count >= k);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::Rng;
    use rand::SeedableRng;
    use rand_chacha::ChaCha8Rng;

    fn scalar_eval(connective: Connective, values: Vec<bool>, min_number: Option<usize>) -> bool {
        match connective {
            Connective::And => values.into_iter().all(|x| x),
            Connective::Or => values.into_iter().any(|x| x),
            Connective::Xor => values.into_iter().filter(|x| *x).count() % 2 == 1,
            Connective::Nand => !values.into_iter().all(|x| x),
            Connective::Nor => !values.into_iter().any(|x| x),
            Connective::Iff => {
                let true_count = values.iter().filter(|x| **x).count();
                true_count == 0 || true_count == values.len()
            }
            Connective::AtLeast => {
                let k = min_number.expect("min_number");
                values.into_iter().filter(|x| *x).count() >= k
            }
            Connective::Not | Connective::Null => panic!("unexpected"),
        }
    }

    fn packed_vs_scalar(connective: Connective, arity: usize, seed: u64) {
        let mut rng = ChaCha8Rng::seed_from_u64(seed);

        // We'll create node_words where indices 1..=arity map to operand words.
        let mut node_words = vec![0u64; arity + 1];
        let mut gate_inputs: Vec<GateInput> = Vec::with_capacity(arity);

        for i in 0..arity {
            let idx = (i + 1) as i32;
            let mut w = 0u64;
            for lane in 0..OMEGA {
                let bit: bool = rng.gen();
                set_lane(&mut w, lane, bit);
            }
            node_words[idx as usize] = w;

            let is_negated: bool = rng.gen::<bool>() && rng.gen::<bool>(); // bias toward false
            gate_inputs.push(GateInput {
                index: idx,
                is_negated,
            });
        }

        let min_number = match connective {
            Connective::AtLeast => Some(rng.gen_range(0..=arity)),
            _ => None,
        };

        let desc = GateDescriptor {
            connective,
            operands: gate_inputs.clone(),
            min_number,
        };

        let out = eval_gate_word(&desc, &node_words);

        for lane in 0..OMEGA {
            let mut vals = Vec::with_capacity(arity);
            for op in &gate_inputs {
                let mut v = get_lane(node_words[op.index as usize], lane);
                if op.is_negated {
                    v = !v;
                }
                vals.push(v);
            }

            let expected = scalar_eval(connective, vals, min_number);
            assert_eq!(
                get_lane(out, lane),
                expected,
                "lane={lane} connective={connective:?}"
            );
        }
    }

    #[test]
    fn packed_and_or_xor_and_inverses_match_scalar() {
        let connectives = [
            Connective::And,
            Connective::Or,
            Connective::Xor,
            Connective::Nand,
            Connective::Nor,
            Connective::Iff,
            Connective::AtLeast,
        ];

        for (ci, c) in connectives.into_iter().enumerate() {
            for arity in 1..=6 {
                packed_vs_scalar(
                    c,
                    arity,
                    0xC0FFEE_u64 ^ ((ci as u64) << 16) ^ (arity as u64),
                );
            }
        }
    }

    #[test]
    fn packed_atleast_edge_cases() {
        // Build three operands with deterministic patterns.
        let mut node_words = vec![0u64; 4];
        node_words[1] = 0xFFFF_FFFF_0000_0000;
        node_words[2] = 0xAAAA_AAAA_AAAA_AAAA;
        node_words[3] = 0x5555_5555_5555_5555;

        let ops = vec![
            GateInput {
                index: 1,
                is_negated: false,
            },
            GateInput {
                index: 2,
                is_negated: false,
            },
            GateInput {
                index: 3,
                is_negated: false,
            },
        ];

        // k=0 => always true
        let desc0 = GateDescriptor {
            connective: Connective::AtLeast,
            operands: ops.clone(),
            min_number: Some(0),
        };
        assert_eq!(eval_gate_word(&desc0, &node_words), !0u64);

        // k>n => always false
        let desc_big = GateDescriptor {
            connective: Connective::AtLeast,
            operands: ops.clone(),
            min_number: Some(4),
        };
        assert_eq!(eval_gate_word(&desc_big, &node_words), 0u64);
    }
}
