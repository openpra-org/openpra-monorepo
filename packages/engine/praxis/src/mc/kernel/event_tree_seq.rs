//! GPU kernels for Event-Tree Monte Carlo sequence evaluation (bitpacked).
//!
//! This module evaluates an event tree over packed `(B,P)` trial words and produces
//! per-sequence packed mask words in a `(B,P,seq)` layout, suitable for popcount tally.
//!
//! CubeCL currently has some control-flow and local-storage restrictions, so this kernel
//! uses a compilation strategy that avoids per-thread stacks:
//!
//! - The host compiles the event tree into *per-sequence* sets of paths.
//! - Each path is represented as a list of functional-event (FE) conditions:
//!   FE must be true (success) or false (failure).
//! - The kernel runs one thread per `(b,p,seq)` and computes:
//!   `mask(seq) = OR_over_paths( IE_word AND_over_conditions( FE_word or !FE_word ) )`.
//!
//! This yields bit-for-bit parity with the CPU mask-propagation traversal.

#[cfg(feature = "gpu")]
use cubecl::prelude::*;

#[cfg(feature = "gpu")]
const ROUTE_FE_TRUE: u32 = 0;

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Evaluate an event tree for each `(b,p)` word and write per-sequence packed masks.
///
/// Layouts:
/// - `node_words_{lo,hi}`: `(B,P,node)` packed words
/// - `seq_words_{lo,hi}`: `(B,P,seq)` packed words
///
/// Plan representation:
/// - For each sequence `s`, a contiguous range of *paths* in `path_cond_{start,len}`:
///   `paths = [seq_path_start[s], seq_path_start[s] + seq_path_len[s])`
/// - For each path `p`, a contiguous range of *conditions*:
///   `conds = [path_cond_start[p], path_cond_start[p] + path_cond_len[p])`
/// - For each condition `c`:
///   - `cond_fe_node[c]`: absolute PDAG node index for the FE's success mask
///   - `cond_route[c]`: 0 => require FE true, 1 => require FE false
pub fn event_tree_sequence_words_kernel(
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    valid_lanes_last_word: u32,
    ie_node: u32,
    seq_count: u32,
    seq_path_start: &Array<u32>,
    seq_path_len: &Array<u32>,
    path_cond_start: &Array<u32>,
    path_cond_len: &Array<u32>,
    cond_fe_node: &Array<u32>,
    cond_route: &Array<u32>,
    node_words_lo: &Array<u32>,
    node_words_hi: &Array<u32>,
    seq_words_lo: &mut Array<u32>,
    seq_words_hi: &mut Array<u32>,
) {
    let seq_ix = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;
    if seq_ix >= seq_count || p >= p_count || b >= b_count {
        terminate!();
    }

    let bp_total = b_count * p_count;
    let bp = b * p_count + p;

    // Base indices for this (b,p) word.
    let node_base = (bp * num_nodes) as usize;
    let out_ix = (bp * seq_count + seq_ix) as usize;

    // Base mask = IE occurrence.
    let mut ie_lo = node_words_lo[node_base + ie_node as usize];
    let mut ie_hi = node_words_hi[node_base + ie_node as usize];

    // Mask padded lanes only for the final (b,p) word.
    if valid_lanes_last_word != 0u32 && bp + 1u32 == bp_total {
        if valid_lanes_last_word < 32u32 {
            let lo_mask = (1u32 << valid_lanes_last_word) - 1u32;
            ie_lo &= lo_mask;
            ie_hi = 0u32;
        } else {
            let hi_bits = valid_lanes_last_word - 32u32;
            if hi_bits == 0u32 {
                ie_hi = 0u32;
            } else {
                ie_hi &= (1u32 << hi_bits) - 1u32;
            }
        }
    }

    if (ie_lo | ie_hi) == 0u32 {
        seq_words_lo[out_ix] = 0u32;
        seq_words_hi[out_ix] = 0u32;
        terminate!();
    }

    let mut out_lo = 0u32;
    let mut out_hi = 0u32;

    let path_start = seq_path_start[seq_ix as usize];
    let path_len = seq_path_len[seq_ix as usize];

    let mut pi = 0u32;
    while pi < path_len {
        let path_ix = (path_start + pi) as usize;
        let cond_start = path_cond_start[path_ix];
        let cond_len = path_cond_len[path_ix];

        let mut m_lo = ie_lo;
        let mut m_hi = ie_hi;

        let mut ci = 0u32;
        while ci < cond_len {
            if (m_lo | m_hi) == 0u32 {
                // Early-exit this path.
                ci = cond_len;
            } else {
                let cond_ix = (cond_start + ci) as usize;
                let fe_node = cond_fe_node[cond_ix];
                let route = cond_route[cond_ix];

                let mut fe_lo = node_words_lo[node_base + fe_node as usize];
                let mut fe_hi = node_words_hi[node_base + fe_node as usize];

                // Mask padded lanes only for the final (b,p) word.
                if valid_lanes_last_word != 0u32 && bp + 1u32 == bp_total {
                    if valid_lanes_last_word < 32u32 {
                        let lo_mask = (1u32 << valid_lanes_last_word) - 1u32;
                        fe_lo &= lo_mask;
                        fe_hi = 0u32;
                    } else {
                        let hi_bits = valid_lanes_last_word - 32u32;
                        if hi_bits == 0u32 {
                            fe_hi = 0u32;
                        } else {
                            fe_hi &= (1u32 << hi_bits) - 1u32;
                        }
                    }
                }

                if route == ROUTE_FE_TRUE {
                    m_lo &= fe_lo;
                    m_hi &= fe_hi;
                } else {
                    m_lo &= !fe_lo;
                    m_hi &= !fe_hi;
                }

                ci += 1u32;
            }
        }

        out_lo |= m_lo;
        out_hi |= m_hi;
        pi += 1u32;
    }

    seq_words_lo[out_ix] = out_lo;
    seq_words_hi[out_ix] = out_hi;
}
