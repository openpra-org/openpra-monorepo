//! Small utility kernels that operate on the `(B,P,node)` packed word buffers.

#[cfg(feature = "gpu")]
use cubecl::prelude::*;

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Set constant nodes in-place.
///
/// For each constant node, writes either all-zeros or all-ones bitpack across all `(b,p)`.
///
/// # Arguments
/// - `const_nodes`  : node indices to set
/// - `const_values` : 0/1 values (0 => false => 0x0000.., 1 => true => 0xFFFF..)
/// - `num_consts`   : number of constants
/// - `num_nodes`    : total nodes in `(B,P,node)` layout
/// - `b_count`/`p_count` : dimensions
/// - `node_words_lo`/`node_words_hi` : packed word halves, length `B*P*num_nodes`
pub fn set_constant_nodes_kernel(
    const_nodes: &Array<u32>,
    const_values: &Array<u32>,
    num_consts: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let gid = ABSOLUTE_POS as u32;
    let total = num_consts * b_count * p_count;
    if gid >= total {
        terminate!();
    }

    let c = gid % num_consts;
    let bp = gid / num_consts;
    let p = bp % p_count;
    let b = bp / p_count;

    let node_ix = const_nodes[c as usize];
    let value = const_values[c as usize] != 0u32;

    let bp_base = (b * p_count + p) * num_nodes;
    let out_ix = bp_base + node_ix;

    if value {
        node_words_lo[out_ix as usize] = !0u32;
        node_words_hi[out_ix as usize] = !0u32;
    } else {
        node_words_lo[out_ix as usize] = 0u32;
        node_words_hi[out_ix as usize] = 0u32;
    }
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
pub fn gather_selected_nodes_kernel(
    selected_nodes: &Array<u32>,
    num_selected: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &Array<u32>,
    node_words_hi: &Array<u32>,
    out_lo: &mut Array<u32>,
    out_hi: &mut Array<u32>,
) {
    let gid = ABSOLUTE_POS as u32;
    let total = num_selected * b_count * p_count;
    if gid >= total {
        terminate!();
    }

    let selected_ix = gid % num_selected;
    let bp = gid / num_selected;
    let p = bp % p_count;
    let b = bp / p_count;

    let node_ix = selected_nodes[selected_ix as usize];
    let in_ix = (b * p_count + p) * num_nodes + node_ix;
    let out_ix = bp * num_selected + selected_ix;

    out_lo[out_ix as usize] = node_words_lo[in_ix as usize];
    out_hi[out_ix as usize] = node_words_hi[in_ix as usize];
}
