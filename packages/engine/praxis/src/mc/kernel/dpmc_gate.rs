//! Blueprint-style DPMC packed gate kernels (bitpacked words).
//!
//! These kernels evaluate gates over bitpacks (omega=64 lanes) in a
//! `(B,P,node)` layout:
//!
//! `node_words[((b * p_count + p) * num_nodes + node_ix)] = u64`
//!
//! Gate operands are provided in SoA form:
//! - `operand_offsets[gate]` .. `operand_offsets[gate+1]` in the flattened arrays
//! - `operand_indices[j]` (node index)
//! - `operand_negated[j]` (0/1) to represent complemented edges
//!
//! This module includes `AtLeast(k/n)` using a lane-parallel, bit-sliced counter
//! and compare implementation (blueprint-style) validated by CUDA parity tests.

#[cfg(feature = "gpu")]
use cubecl::prelude::*;

// --- Optional u64 kernels ----------------------------------------------------
//
// CubeCL support for `u64` varies by backend and code shape. We keep the
// production path on `u32` lo/hi halves for robustness, and provide opt-in
// `u64` kernels (currently: idempotent/parity gates) to evaluate feasibility.

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Evaluate packed AND gates.
pub fn eval_gates_packed_and_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let gate = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;
    if gate >= num_gates || p >= p_count || b >= b_count {
        terminate!();
    }

    let out_node = gate_out_indices[gate as usize];

    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];

    // Base address for this (b,p) slice.
    let bp_base = (b * p_count + p) * num_nodes;

    // We store packed words as two u32 halves (lo/hi) to avoid CubeCL u64
    // expansion edge-cases.
    let fold_and_lo = RuntimeCell::<u32>::new(!0u32);
    let fold_and_hi = RuntimeCell::<u32>::new(!0u32);

    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u32) * (operand_negated[j as usize] & 1u32);
        let w_lo = node_words_lo[(bp_base + node_ix) as usize];
        let w_hi = node_words_hi[(bp_base + node_ix) as usize];
        let v_lo = w_lo ^ neg_mask;
        let v_hi = w_hi ^ neg_mask;

        let acc_lo = fold_and_lo.read();
        let acc_hi = fold_and_hi.read();
        fold_and_lo.store(acc_lo & v_lo);
        fold_and_hi.store(acc_hi & v_hi);
    }

    node_words_lo[(bp_base + out_node) as usize] = fold_and_lo.read();
    node_words_hi[(bp_base + out_node) as usize] = fold_and_hi.read();
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Evaluate packed OR gates.
pub fn eval_gates_packed_or_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let gate = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;
    if gate >= num_gates || p >= p_count || b >= b_count {
        terminate!();
    }

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let fold_or_lo = RuntimeCell::<u32>::new(0u32);
    let fold_or_hi = RuntimeCell::<u32>::new(0u32);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u32) * (operand_negated[j as usize] & 1u32);
        let w_lo = node_words_lo[(bp_base + node_ix) as usize];
        let w_hi = node_words_hi[(bp_base + node_ix) as usize];
        let v_lo = w_lo ^ neg_mask;
        let v_hi = w_hi ^ neg_mask;
        let acc_lo = fold_or_lo.read();
        let acc_hi = fold_or_hi.read();
        fold_or_lo.store(acc_lo | v_lo);
        fold_or_hi.store(acc_hi | v_hi);
    }

    node_words_lo[(bp_base + out_node) as usize] = fold_or_lo.read();
    node_words_hi[(bp_base + out_node) as usize] = fold_or_hi.read();
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Evaluate packed XOR gates.
pub fn eval_gates_packed_xor_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let gate = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;
    if gate >= num_gates || p >= p_count || b >= b_count {
        terminate!();
    }

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let fold_xor_lo = RuntimeCell::<u32>::new(0u32);
    let fold_xor_hi = RuntimeCell::<u32>::new(0u32);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u32) * (operand_negated[j as usize] & 1u32);
        let w_lo = node_words_lo[(bp_base + node_ix) as usize];
        let w_hi = node_words_hi[(bp_base + node_ix) as usize];
        let v_lo = w_lo ^ neg_mask;
        let v_hi = w_hi ^ neg_mask;
        let acc_lo = fold_xor_lo.read();
        let acc_hi = fold_xor_hi.read();
        fold_xor_lo.store(acc_lo ^ v_lo);
        fold_xor_hi.store(acc_hi ^ v_hi);
    }

    node_words_lo[(bp_base + out_node) as usize] = fold_xor_lo.read();
    node_words_hi[(bp_base + out_node) as usize] = fold_xor_hi.read();
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Evaluate packed NAND gates.
pub fn eval_gates_packed_nand_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let gate = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;
    if gate >= num_gates || p >= p_count || b >= b_count {
        terminate!();
    }

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let fold_and_lo = RuntimeCell::<u32>::new(!0u32);
    let fold_and_hi = RuntimeCell::<u32>::new(!0u32);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u32) * (operand_negated[j as usize] & 1u32);
        let w_lo = node_words_lo[(bp_base + node_ix) as usize];
        let w_hi = node_words_hi[(bp_base + node_ix) as usize];
        let v_lo = w_lo ^ neg_mask;
        let v_hi = w_hi ^ neg_mask;
        let acc_lo = fold_and_lo.read();
        let acc_hi = fold_and_hi.read();
        fold_and_lo.store(acc_lo & v_lo);
        fold_and_hi.store(acc_hi & v_hi);
    }

    node_words_lo[(bp_base + out_node) as usize] = !fold_and_lo.read();
    node_words_hi[(bp_base + out_node) as usize] = !fold_and_hi.read();
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Evaluate packed NOR gates.
pub fn eval_gates_packed_nor_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let gate = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;
    if gate >= num_gates || p >= p_count || b >= b_count {
        terminate!();
    }

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let fold_or_lo = RuntimeCell::<u32>::new(0u32);
    let fold_or_hi = RuntimeCell::<u32>::new(0u32);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u32) * (operand_negated[j as usize] & 1u32);
        let w_lo = node_words_lo[(bp_base + node_ix) as usize];
        let w_hi = node_words_hi[(bp_base + node_ix) as usize];
        let v_lo = w_lo ^ neg_mask;
        let v_hi = w_hi ^ neg_mask;
        let acc_lo = fold_or_lo.read();
        let acc_hi = fold_or_hi.read();
        fold_or_lo.store(acc_lo | v_lo);
        fold_or_hi.store(acc_hi | v_hi);
    }

    node_words_lo[(bp_base + out_node) as usize] = !fold_or_lo.read();
    node_words_hi[(bp_base + out_node) as usize] = !fold_or_hi.read();
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Evaluate packed IFF gates.
pub fn eval_gates_packed_iff_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let gate = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;
    if gate >= num_gates || p >= p_count || b >= b_count {
        terminate!();
    }

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let all_true_lo = RuntimeCell::<u32>::new(!0u32);
    let all_true_hi = RuntimeCell::<u32>::new(!0u32);
    let all_false_lo = RuntimeCell::<u32>::new(!0u32);
    let all_false_hi = RuntimeCell::<u32>::new(!0u32);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u32) * (operand_negated[j as usize] & 1u32);
        let w_lo = node_words_lo[(bp_base + node_ix) as usize];
        let w_hi = node_words_hi[(bp_base + node_ix) as usize];
        let v_lo = w_lo ^ neg_mask;
        let v_hi = w_hi ^ neg_mask;

        let t_lo = all_true_lo.read();
        let t_hi = all_true_hi.read();
        let f_lo = all_false_lo.read();
        let f_hi = all_false_hi.read();
        all_true_lo.store(t_lo & v_lo);
        all_true_hi.store(t_hi & v_hi);
        all_false_lo.store(f_lo & (!v_lo));
        all_false_hi.store(f_hi & (!v_hi));
    }

    node_words_lo[(bp_base + out_node) as usize] = all_true_lo.read() | all_false_lo.read();
    node_words_hi[(bp_base + out_node) as usize] = all_true_hi.read() | all_false_hi.read();
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Evaluate packed AtLeast(k/n) gates for small fan-in (n <= 8).
///
/// `min_numbers[gate]` is k.
pub fn eval_gates_packed_atleast_small_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    min_numbers: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let gate = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;
    if gate >= num_gates || p >= p_count || b >= b_count {
        terminate!();
    }

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let n_ops = op_end - op_begin;
    if n_ops > 8u32 {
        terminate!();
    }
    let k = min_numbers[gate as usize];

    let bp_base = (b * p_count + p) * num_nodes;

    let out_lo = RuntimeCell::<u32>::new(0u32);
    let out_hi = RuntimeCell::<u32>::new(0u32);

    if k == 0u32 {
        out_lo.store(!0u32);
        out_hi.store(!0u32);
    } else if k > n_ops {
        // Keep (0,0) from initialization.
    } else {
        // 4-bit bit-sliced lane-parallel counter is sufficient for n<=8.
        let c0_lo = RuntimeCell::<u32>::new(0u32);
        let c1_lo = RuntimeCell::<u32>::new(0u32);
        let c2_lo = RuntimeCell::<u32>::new(0u32);
        let c3_lo = RuntimeCell::<u32>::new(0u32);

        let c0_hi = RuntimeCell::<u32>::new(0u32);
        let c1_hi = RuntimeCell::<u32>::new(0u32);
        let c2_hi = RuntimeCell::<u32>::new(0u32);
        let c3_hi = RuntimeCell::<u32>::new(0u32);

        for j in op_begin..op_end {
            let node_ix = operand_indices[j as usize];
            let neg_mask = (!0u32) * (operand_negated[j as usize] & 1u32);
            let w_lo = node_words_lo[(bp_base + node_ix) as usize] ^ neg_mask;
            let w_hi = node_words_hi[(bp_base + node_ix) as usize] ^ neg_mask;

            // Add w_lo into (c*_lo).
            let a0 = c0_lo.read();
            let carry1_lo = a0 & w_lo;
            c0_lo.store(a0 ^ w_lo);
            let a1 = c1_lo.read();
            let carry2_lo = a1 & carry1_lo;
            c1_lo.store(a1 ^ carry1_lo);
            let a2 = c2_lo.read();
            let carry3_lo = a2 & carry2_lo;
            c2_lo.store(a2 ^ carry2_lo);
            let a3 = c3_lo.read();
            c3_lo.store(a3 ^ carry3_lo);

            // Add w_hi into (c*_hi).
            let b0 = c0_hi.read();
            let carry1_hi = b0 & w_hi;
            c0_hi.store(b0 ^ w_hi);
            let b1 = c1_hi.read();
            let carry2_hi = b1 & carry1_hi;
            c1_hi.store(b1 ^ carry1_hi);
            let b2 = c2_hi.read();
            let carry3_hi = b2 & carry2_hi;
            c2_hi.store(b2 ^ carry2_hi);
            let b3 = c3_hi.read();
            c3_hi.store(b3 ^ carry3_hi);
        }

        let eq_lo = RuntimeCell::<u32>::new(!0u32);
        let lt_lo = RuntimeCell::<u32>::new(0u32);
        let eq_hi = RuntimeCell::<u32>::new(!0u32);
        let lt_hi = RuntimeCell::<u32>::new(0u32);

        // bit 3
        let p3_lo = c3_lo.read();
        let p3_hi = c3_hi.read();
        if ((k >> 3u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p3_lo)));
            eq_lo.store(eq0_lo & p3_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p3_hi)));
            eq_hi.store(eq0_hi & p3_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p3_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p3_hi));
        }

        // bit 2
        let p2_lo = c2_lo.read();
        let p2_hi = c2_hi.read();
        if ((k >> 2u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p2_lo)));
            eq_lo.store(eq0_lo & p2_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p2_hi)));
            eq_hi.store(eq0_hi & p2_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p2_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p2_hi));
        }

        // bit 1
        let p1_lo = c1_lo.read();
        let p1_hi = c1_hi.read();
        if ((k >> 1u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p1_lo)));
            eq_lo.store(eq0_lo & p1_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p1_hi)));
            eq_hi.store(eq0_hi & p1_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p1_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p1_hi));
        }

        // bit 0
        let p0_lo = c0_lo.read();
        let p0_hi = c0_hi.read();
        if (k & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p0_lo)));

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p0_hi)));
        }

        out_lo.store(!lt_lo.read());
        out_hi.store(!lt_hi.read());
    }

    node_words_lo[(bp_base + out_node) as usize] = out_lo.read();
    node_words_hi[(bp_base + out_node) as usize] = out_hi.read();
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Evaluate packed AtLeast(k/n) gates.
///
/// `min_numbers[gate]` is k.
pub fn eval_gates_packed_atleast_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    min_numbers: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let gate = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;
    if gate >= num_gates || p >= p_count || b >= b_count {
        terminate!();
    }

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let n_ops = op_end - op_begin;
    if n_ops <= 8u32 {
        terminate!();
    }
    let k = min_numbers[gate as usize];

    let bp_base = (b * p_count + p) * num_nodes;

    let out_lo = RuntimeCell::<u32>::new(0u32);
    let out_hi = RuntimeCell::<u32>::new(0u32);

    if k == 0u32 {
        out_lo.store(!0u32);
        out_hi.store(!0u32);
    } else if k > n_ops {
        // Keep (0,0) from initialization.
    } else {
        // Bit-sliced lane-parallel counter, using RuntimeCell for CubeCL compatibility.
        let c0_lo = RuntimeCell::<u32>::new(0u32);
        let c1_lo = RuntimeCell::<u32>::new(0u32);
        let c2_lo = RuntimeCell::<u32>::new(0u32);
        let c3_lo = RuntimeCell::<u32>::new(0u32);
        let c4_lo = RuntimeCell::<u32>::new(0u32);
        let c5_lo = RuntimeCell::<u32>::new(0u32);
        let c6_lo = RuntimeCell::<u32>::new(0u32);
        let c7_lo = RuntimeCell::<u32>::new(0u32);
        let c8_lo = RuntimeCell::<u32>::new(0u32);
        let c9_lo = RuntimeCell::<u32>::new(0u32);
        let c10_lo = RuntimeCell::<u32>::new(0u32);
        let c11_lo = RuntimeCell::<u32>::new(0u32);
        let c12_lo = RuntimeCell::<u32>::new(0u32);
        let c13_lo = RuntimeCell::<u32>::new(0u32);
        let c14_lo = RuntimeCell::<u32>::new(0u32);
        let c15_lo = RuntimeCell::<u32>::new(0u32);

        let c0_hi = RuntimeCell::<u32>::new(0u32);
        let c1_hi = RuntimeCell::<u32>::new(0u32);
        let c2_hi = RuntimeCell::<u32>::new(0u32);
        let c3_hi = RuntimeCell::<u32>::new(0u32);
        let c4_hi = RuntimeCell::<u32>::new(0u32);
        let c5_hi = RuntimeCell::<u32>::new(0u32);
        let c6_hi = RuntimeCell::<u32>::new(0u32);
        let c7_hi = RuntimeCell::<u32>::new(0u32);
        let c8_hi = RuntimeCell::<u32>::new(0u32);
        let c9_hi = RuntimeCell::<u32>::new(0u32);
        let c10_hi = RuntimeCell::<u32>::new(0u32);
        let c11_hi = RuntimeCell::<u32>::new(0u32);
        let c12_hi = RuntimeCell::<u32>::new(0u32);
        let c13_hi = RuntimeCell::<u32>::new(0u32);
        let c14_hi = RuntimeCell::<u32>::new(0u32);
        let c15_hi = RuntimeCell::<u32>::new(0u32);

        for j in op_begin..op_end {
            let node_ix = operand_indices[j as usize];
            let neg_mask = (!0u32) * (operand_negated[j as usize] & 1u32);
            let w_lo = node_words_lo[(bp_base + node_ix) as usize] ^ neg_mask;
            let w_hi = node_words_hi[(bp_base + node_ix) as usize] ^ neg_mask;

            // Add w_lo into (c*_lo).
            let a0 = c0_lo.read();
            let carry1_lo = a0 & w_lo;
            c0_lo.store(a0 ^ w_lo);
            let a1 = c1_lo.read();
            let carry2_lo = a1 & carry1_lo;
            c1_lo.store(a1 ^ carry1_lo);
            let a2 = c2_lo.read();
            let carry3_lo = a2 & carry2_lo;
            c2_lo.store(a2 ^ carry2_lo);
            let a3 = c3_lo.read();
            let carry4_lo = a3 & carry3_lo;
            c3_lo.store(a3 ^ carry3_lo);
            let a4 = c4_lo.read();
            let carry5_lo = a4 & carry4_lo;
            c4_lo.store(a4 ^ carry4_lo);
            let a5 = c5_lo.read();
            let carry6_lo = a5 & carry5_lo;
            c5_lo.store(a5 ^ carry5_lo);
            let a6 = c6_lo.read();
            let carry7_lo = a6 & carry6_lo;
            c6_lo.store(a6 ^ carry6_lo);
            let a7 = c7_lo.read();
            let carry8_lo = a7 & carry7_lo;
            c7_lo.store(a7 ^ carry7_lo);
            let a8 = c8_lo.read();
            let carry9_lo = a8 & carry8_lo;
            c8_lo.store(a8 ^ carry8_lo);
            let a9 = c9_lo.read();
            let carry10_lo = a9 & carry9_lo;
            c9_lo.store(a9 ^ carry9_lo);
            let a10 = c10_lo.read();
            let carry11_lo = a10 & carry10_lo;
            c10_lo.store(a10 ^ carry10_lo);
            let a11 = c11_lo.read();
            let carry12_lo = a11 & carry11_lo;
            c11_lo.store(a11 ^ carry11_lo);
            let a12 = c12_lo.read();
            let carry13_lo = a12 & carry12_lo;
            c12_lo.store(a12 ^ carry12_lo);
            let a13 = c13_lo.read();
            let carry14_lo = a13 & carry13_lo;
            c13_lo.store(a13 ^ carry13_lo);
            let a14 = c14_lo.read();
            let carry15_lo = a14 & carry14_lo;
            c14_lo.store(a14 ^ carry14_lo);
            let a15 = c15_lo.read();
            c15_lo.store(a15 ^ carry15_lo);

            // Add w_hi into (c*_hi).
            let b0 = c0_hi.read();
            let carry1_hi = b0 & w_hi;
            c0_hi.store(b0 ^ w_hi);
            let b1 = c1_hi.read();
            let carry2_hi = b1 & carry1_hi;
            c1_hi.store(b1 ^ carry1_hi);
            let b2 = c2_hi.read();
            let carry3_hi = b2 & carry2_hi;
            c2_hi.store(b2 ^ carry2_hi);
            let b3 = c3_hi.read();
            let carry4_hi = b3 & carry3_hi;
            c3_hi.store(b3 ^ carry3_hi);
            let b4 = c4_hi.read();
            let carry5_hi = b4 & carry4_hi;
            c4_hi.store(b4 ^ carry4_hi);
            let b5 = c5_hi.read();
            let carry6_hi = b5 & carry5_hi;
            c5_hi.store(b5 ^ carry5_hi);
            let b6 = c6_hi.read();
            let carry7_hi = b6 & carry6_hi;
            c6_hi.store(b6 ^ carry6_hi);
            let b7 = c7_hi.read();
            let carry8_hi = b7 & carry7_hi;
            c7_hi.store(b7 ^ carry7_hi);
            let b8 = c8_hi.read();
            let carry9_hi = b8 & carry8_hi;
            c8_hi.store(b8 ^ carry8_hi);
            let b9 = c9_hi.read();
            let carry10_hi = b9 & carry9_hi;
            c9_hi.store(b9 ^ carry9_hi);
            let b10 = c10_hi.read();
            let carry11_hi = b10 & carry10_hi;
            c10_hi.store(b10 ^ carry10_hi);
            let b11 = c11_hi.read();
            let carry12_hi = b11 & carry11_hi;
            c11_hi.store(b11 ^ carry11_hi);
            let b12 = c12_hi.read();
            let carry13_hi = b12 & carry12_hi;
            c12_hi.store(b12 ^ carry12_hi);
            let b13 = c13_hi.read();
            let carry14_hi = b13 & carry13_hi;
            c13_hi.store(b13 ^ carry13_hi);
            let b14 = c14_hi.read();
            let carry15_hi = b14 & carry14_hi;
            c14_hi.store(b14 ^ carry14_hi);
            let b15 = c15_hi.read();
            c15_hi.store(b15 ^ carry15_hi);
        }

        let eq_lo = RuntimeCell::<u32>::new(!0u32);
        let lt_lo = RuntimeCell::<u32>::new(0u32);
        let eq_hi = RuntimeCell::<u32>::new(!0u32);
        let lt_hi = RuntimeCell::<u32>::new(0u32);

        // Bit-sliced compare: compute lt_mask (count < k) by walking bits MSB..LSB.
        // bit 15
        let p15_lo = c15_lo.read();
        let p15_hi = c15_hi.read();
        if ((k >> 15u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p15_lo)));
            eq_lo.store(eq0_lo & p15_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p15_hi)));
            eq_hi.store(eq0_hi & p15_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p15_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p15_hi));
        }
        // bit 14
        let p14_lo = c14_lo.read();
        let p14_hi = c14_hi.read();
        if ((k >> 14u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p14_lo)));
            eq_lo.store(eq0_lo & p14_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p14_hi)));
            eq_hi.store(eq0_hi & p14_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p14_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p14_hi));
        }
        // bit 13
        let p13_lo = c13_lo.read();
        let p13_hi = c13_hi.read();
        if ((k >> 13u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p13_lo)));
            eq_lo.store(eq0_lo & p13_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p13_hi)));
            eq_hi.store(eq0_hi & p13_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p13_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p13_hi));
        }
        // bit 12
        let p12_lo = c12_lo.read();
        let p12_hi = c12_hi.read();
        if ((k >> 12u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p12_lo)));
            eq_lo.store(eq0_lo & p12_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p12_hi)));
            eq_hi.store(eq0_hi & p12_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p12_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p12_hi));
        }
        // bit 11
        let p11_lo = c11_lo.read();
        let p11_hi = c11_hi.read();
        if ((k >> 11u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p11_lo)));
            eq_lo.store(eq0_lo & p11_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p11_hi)));
            eq_hi.store(eq0_hi & p11_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p11_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p11_hi));
        }
        // bit 10
        let p10_lo = c10_lo.read();
        let p10_hi = c10_hi.read();
        if ((k >> 10u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p10_lo)));
            eq_lo.store(eq0_lo & p10_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p10_hi)));
            eq_hi.store(eq0_hi & p10_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p10_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p10_hi));
        }
        // bit 9
        let p9_lo = c9_lo.read();
        let p9_hi = c9_hi.read();
        if ((k >> 9u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p9_lo)));
            eq_lo.store(eq0_lo & p9_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p9_hi)));
            eq_hi.store(eq0_hi & p9_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p9_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p9_hi));
        }
        // bit 8
        let p8_lo = c8_lo.read();
        let p8_hi = c8_hi.read();
        if ((k >> 8u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p8_lo)));
            eq_lo.store(eq0_lo & p8_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p8_hi)));
            eq_hi.store(eq0_hi & p8_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p8_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p8_hi));
        }
        // bit 7
        let p7_lo = c7_lo.read();
        let p7_hi = c7_hi.read();
        if ((k >> 7u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p7_lo)));
            eq_lo.store(eq0_lo & p7_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p7_hi)));
            eq_hi.store(eq0_hi & p7_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p7_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p7_hi));
        }
        // bit 6
        let p6_lo = c6_lo.read();
        let p6_hi = c6_hi.read();
        if ((k >> 6u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p6_lo)));
            eq_lo.store(eq0_lo & p6_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p6_hi)));
            eq_hi.store(eq0_hi & p6_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p6_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p6_hi));
        }
        // bit 5
        let p5_lo = c5_lo.read();
        let p5_hi = c5_hi.read();
        if ((k >> 5u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p5_lo)));
            eq_lo.store(eq0_lo & p5_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p5_hi)));
            eq_hi.store(eq0_hi & p5_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p5_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p5_hi));
        }
        // bit 4
        let p4_lo = c4_lo.read();
        let p4_hi = c4_hi.read();
        if ((k >> 4u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p4_lo)));
            eq_lo.store(eq0_lo & p4_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p4_hi)));
            eq_hi.store(eq0_hi & p4_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p4_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p4_hi));
        }
        // bit 3
        let p3_lo = c3_lo.read();
        let p3_hi = c3_hi.read();
        if ((k >> 3u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p3_lo)));
            eq_lo.store(eq0_lo & p3_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p3_hi)));
            eq_hi.store(eq0_hi & p3_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p3_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p3_hi));
        }
        // bit 2
        let p2_lo = c2_lo.read();
        let p2_hi = c2_hi.read();
        if ((k >> 2u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p2_lo)));
            eq_lo.store(eq0_lo & p2_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p2_hi)));
            eq_hi.store(eq0_hi & p2_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p2_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p2_hi));
        }
        // bit 1
        let p1_lo = c1_lo.read();
        let p1_hi = c1_hi.read();
        if ((k >> 1u32) & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p1_lo)));
            eq_lo.store(eq0_lo & p1_lo);

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p1_hi)));
            eq_hi.store(eq0_hi & p1_hi);
        } else {
            let eq0_lo = eq_lo.read();
            eq_lo.store(eq0_lo & (!p1_lo));
            let eq0_hi = eq_hi.read();
            eq_hi.store(eq0_hi & (!p1_hi));
        }
        // bit 0
        let p0_lo = c0_lo.read();
        let p0_hi = c0_hi.read();
        if (k & 1u32) != 0u32 {
            let eq0_lo = eq_lo.read();
            let lt0_lo = lt_lo.read();
            lt_lo.store(lt0_lo | (eq0_lo & (!p0_lo)));

            let eq0_hi = eq_hi.read();
            let lt0_hi = lt_hi.read();
            lt_hi.store(lt0_hi | (eq0_hi & (!p0_hi)));
        }

        out_lo.store(!lt_lo.read());
        out_hi.store(!lt_hi.read());
    }

    node_words_lo[(bp_base + out_node) as usize] = out_lo.read();
    node_words_hi[(bp_base + out_node) as usize] = out_hi.read();
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Evaluate packed AtLeast(k/n) gates for large fan-in (n > 8) using cooperative
/// lo/hi split threads per gate.
///
/// `total_gate_threads` is `num_gates * 2`, where even x-thread computes lo and
/// odd x-thread computes hi for the same `(gate, p, b)`.
pub fn eval_gates_packed_atleast_large_coop_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    min_numbers: &Array<u32>,
    total_gate_threads: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let gate_thread = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;
    if gate_thread >= total_gate_threads || p >= p_count || b >= b_count {
        terminate!();
    }

    let gate = gate_thread >> 1u32;
    let is_hi = (gate_thread & 1u32) != 0u32;

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let n_ops = op_end - op_begin;
    if n_ops <= 8u32 {
        terminate!();
    }
    let k = min_numbers[gate as usize];

    let bp_base = (b * p_count + p) * num_nodes;

    let out_word = RuntimeCell::<u32>::new(0u32);

    if k == 0u32 {
        out_word.store(!0u32);
    } else if k > n_ops {
        // Keep 0 from initialization.
    } else {
        let c0 = RuntimeCell::<u32>::new(0u32);
        let c1 = RuntimeCell::<u32>::new(0u32);
        let c2 = RuntimeCell::<u32>::new(0u32);
        let c3 = RuntimeCell::<u32>::new(0u32);
        let c4 = RuntimeCell::<u32>::new(0u32);
        let c5 = RuntimeCell::<u32>::new(0u32);
        let c6 = RuntimeCell::<u32>::new(0u32);
        let c7 = RuntimeCell::<u32>::new(0u32);
        let c8 = RuntimeCell::<u32>::new(0u32);
        let c9 = RuntimeCell::<u32>::new(0u32);
        let c10 = RuntimeCell::<u32>::new(0u32);
        let c11 = RuntimeCell::<u32>::new(0u32);
        let c12 = RuntimeCell::<u32>::new(0u32);
        let c13 = RuntimeCell::<u32>::new(0u32);
        let c14 = RuntimeCell::<u32>::new(0u32);
        let c15 = RuntimeCell::<u32>::new(0u32);

        for j in op_begin..op_end {
            let node_ix = operand_indices[j as usize];
            let neg_mask = (!0u32) * (operand_negated[j as usize] & 1u32);
            let w = if is_hi {
                node_words_hi[(bp_base + node_ix) as usize]
            } else {
                node_words_lo[(bp_base + node_ix) as usize]
            } ^ neg_mask;

            let a0 = c0.read();
            let carry1 = a0 & w;
            c0.store(a0 ^ w);
            let a1 = c1.read();
            let carry2 = a1 & carry1;
            c1.store(a1 ^ carry1);
            let a2 = c2.read();
            let carry3 = a2 & carry2;
            c2.store(a2 ^ carry2);
            let a3 = c3.read();
            let carry4 = a3 & carry3;
            c3.store(a3 ^ carry3);
            let a4 = c4.read();
            let carry5 = a4 & carry4;
            c4.store(a4 ^ carry4);
            let a5 = c5.read();
            let carry6 = a5 & carry5;
            c5.store(a5 ^ carry5);
            let a6 = c6.read();
            let carry7 = a6 & carry6;
            c6.store(a6 ^ carry6);
            let a7 = c7.read();
            let carry8 = a7 & carry7;
            c7.store(a7 ^ carry7);
            let a8 = c8.read();
            let carry9 = a8 & carry8;
            c8.store(a8 ^ carry8);
            let a9 = c9.read();
            let carry10 = a9 & carry9;
            c9.store(a9 ^ carry9);
            let a10 = c10.read();
            let carry11 = a10 & carry10;
            c10.store(a10 ^ carry10);
            let a11 = c11.read();
            let carry12 = a11 & carry11;
            c11.store(a11 ^ carry11);
            let a12 = c12.read();
            let carry13 = a12 & carry12;
            c12.store(a12 ^ carry12);
            let a13 = c13.read();
            let carry14 = a13 & carry13;
            c13.store(a13 ^ carry13);
            let a14 = c14.read();
            let carry15 = a14 & carry14;
            c14.store(a14 ^ carry14);
            let a15 = c15.read();
            c15.store(a15 ^ carry15);
        }

        let eq = RuntimeCell::<u32>::new(!0u32);
        let lt = RuntimeCell::<u32>::new(0u32);

        let p15 = c15.read();
        if ((k >> 15u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p15)));
            eq.store(eq0 & p15);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p15));
        }

        let p14 = c14.read();
        if ((k >> 14u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p14)));
            eq.store(eq0 & p14);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p14));
        }

        let p13 = c13.read();
        if ((k >> 13u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p13)));
            eq.store(eq0 & p13);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p13));
        }

        let p12 = c12.read();
        if ((k >> 12u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p12)));
            eq.store(eq0 & p12);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p12));
        }

        let p11 = c11.read();
        if ((k >> 11u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p11)));
            eq.store(eq0 & p11);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p11));
        }

        let p10 = c10.read();
        if ((k >> 10u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p10)));
            eq.store(eq0 & p10);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p10));
        }

        let p9 = c9.read();
        if ((k >> 9u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p9)));
            eq.store(eq0 & p9);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p9));
        }

        let p8 = c8.read();
        if ((k >> 8u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p8)));
            eq.store(eq0 & p8);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p8));
        }

        let p7 = c7.read();
        if ((k >> 7u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p7)));
            eq.store(eq0 & p7);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p7));
        }

        let p6 = c6.read();
        if ((k >> 6u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p6)));
            eq.store(eq0 & p6);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p6));
        }

        let p5 = c5.read();
        if ((k >> 5u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p5)));
            eq.store(eq0 & p5);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p5));
        }

        let p4 = c4.read();
        if ((k >> 4u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p4)));
            eq.store(eq0 & p4);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p4));
        }

        let p3 = c3.read();
        if ((k >> 3u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p3)));
            eq.store(eq0 & p3);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p3));
        }

        let p2 = c2.read();
        if ((k >> 2u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p2)));
            eq.store(eq0 & p2);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p2));
        }

        let p1 = c1.read();
        if ((k >> 1u32) & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p1)));
            eq.store(eq0 & p1);
        } else {
            let eq0 = eq.read();
            eq.store(eq0 & (!p1));
        }

        let p0 = c0.read();
        if (k & 1u32) != 0u32 {
            let eq0 = eq.read();
            let lt0 = lt.read();
            lt.store(lt0 | (eq0 & (!p0)));
        }

        out_word.store(!lt.read());
    }

    if is_hi {
        node_words_hi[(bp_base + out_node) as usize] = out_word.read();
    } else {
        node_words_lo[(bp_base + out_node) as usize] = out_word.read();
    }
}

#[cfg(all(feature = "gpu", feature = "gpu_u64"))]
#[cube(launch_unchecked)]
/// Evaluate packed AND gates over true `u64` words.
pub fn eval_gates_packed_and_u64_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words: &mut Array<u64>,
) {
    let gid = ABSOLUTE_POS as u32;
    let total = num_gates * b_count * p_count;
    if gid >= total {
        terminate!();
    }

    let gate = gid % num_gates;
    let bp = gid / num_gates;
    let p = bp % p_count;
    let b = bp / p_count;

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let fold_and = RuntimeCell::<u64>::new(!0u64);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u64) * ((operand_negated[j as usize] & 1u32) as u64);
        let w = node_words[(bp_base + node_ix) as usize];
        let v = w ^ neg_mask;
        let acc = fold_and.read();
        fold_and.store(acc & v);
    }

    node_words[(bp_base + out_node) as usize] = fold_and.read();
}

#[cfg(all(feature = "gpu", feature = "gpu_u64"))]
#[cube(launch_unchecked)]
/// Evaluate packed OR gates over true `u64` words.
pub fn eval_gates_packed_or_u64_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words: &mut Array<u64>,
) {
    let gid = ABSOLUTE_POS as u32;
    let total = num_gates * b_count * p_count;
    if gid >= total {
        terminate!();
    }

    let gate = gid % num_gates;
    let bp = gid / num_gates;
    let p = bp % p_count;
    let b = bp / p_count;

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let fold_or = RuntimeCell::<u64>::new(0u64);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u64) * ((operand_negated[j as usize] & 1u32) as u64);
        let w = node_words[(bp_base + node_ix) as usize];
        let v = w ^ neg_mask;
        let acc = fold_or.read();
        fold_or.store(acc | v);
    }

    node_words[(bp_base + out_node) as usize] = fold_or.read();
}

#[cfg(all(feature = "gpu", feature = "gpu_u64"))]
#[cube(launch_unchecked)]
/// Evaluate packed XOR gates over true `u64` words.
pub fn eval_gates_packed_xor_u64_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words: &mut Array<u64>,
) {
    let gid = ABSOLUTE_POS as u32;
    let total = num_gates * b_count * p_count;
    if gid >= total {
        terminate!();
    }

    let gate = gid % num_gates;
    let bp = gid / num_gates;
    let p = bp % p_count;
    let b = bp / p_count;

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let fold_xor = RuntimeCell::<u64>::new(0u64);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u64) * ((operand_negated[j as usize] & 1u32) as u64);
        let w = node_words[(bp_base + node_ix) as usize];
        let v = w ^ neg_mask;
        let acc = fold_xor.read();
        fold_xor.store(acc ^ v);
    }

    node_words[(bp_base + out_node) as usize] = fold_xor.read();
}

#[cfg(all(feature = "gpu", feature = "gpu_u64"))]
#[cube(launch_unchecked)]
/// Evaluate packed NAND gates over true `u64` words.
pub fn eval_gates_packed_nand_u64_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words: &mut Array<u64>,
) {
    let gid = ABSOLUTE_POS as u32;
    let total = num_gates * b_count * p_count;
    if gid >= total {
        terminate!();
    }

    let gate = gid % num_gates;
    let bp = gid / num_gates;
    let p = bp % p_count;
    let b = bp / p_count;

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let fold_and = RuntimeCell::<u64>::new(!0u64);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u64) * ((operand_negated[j as usize] & 1u32) as u64);
        let w = node_words[(bp_base + node_ix) as usize];
        let v = w ^ neg_mask;
        let acc = fold_and.read();
        fold_and.store(acc & v);
    }

    node_words[(bp_base + out_node) as usize] = !fold_and.read();
}

#[cfg(all(feature = "gpu", feature = "gpu_u64"))]
#[cube(launch_unchecked)]
/// Evaluate packed NOR gates over true `u64` words.
pub fn eval_gates_packed_nor_u64_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words: &mut Array<u64>,
) {
    let gid = ABSOLUTE_POS as u32;
    let total = num_gates * b_count * p_count;
    if gid >= total {
        terminate!();
    }

    let gate = gid % num_gates;
    let bp = gid / num_gates;
    let p = bp % p_count;
    let b = bp / p_count;

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let fold_or = RuntimeCell::<u64>::new(0u64);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u64) * ((operand_negated[j as usize] & 1u32) as u64);
        let w = node_words[(bp_base + node_ix) as usize];
        let v = w ^ neg_mask;
        let acc = fold_or.read();
        fold_or.store(acc | v);
    }

    node_words[(bp_base + out_node) as usize] = !fold_or.read();
}

#[cfg(all(feature = "gpu", feature = "gpu_u64"))]
#[cube(launch_unchecked)]
/// Evaluate packed IFF gates over true `u64` words.
pub fn eval_gates_packed_iff_u64_kernel(
    operand_offsets: &Array<u32>,
    operand_indices: &Array<u32>,
    operand_negated: &Array<u32>,
    gate_out_indices: &Array<u32>,
    num_gates: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words: &mut Array<u64>,
) {
    let gid = ABSOLUTE_POS as u32;
    let total = num_gates * b_count * p_count;
    if gid >= total {
        terminate!();
    }

    let gate = gid % num_gates;
    let bp = gid / num_gates;
    let p = bp % p_count;
    let b = bp / p_count;

    let out_node = gate_out_indices[gate as usize];
    let op_begin = operand_offsets[gate as usize];
    let op_end = operand_offsets[(gate + 1u32) as usize];
    let bp_base = (b * p_count + p) * num_nodes;

    let all_true = RuntimeCell::<u64>::new(!0u64);
    let all_false = RuntimeCell::<u64>::new(!0u64);
    for j in op_begin..op_end {
        let node_ix = operand_indices[j as usize];
        let neg_mask = (!0u64) * ((operand_negated[j as usize] & 1u32) as u64);
        let w = node_words[(bp_base + node_ix) as usize];
        let v = w ^ neg_mask;

        let t = all_true.read();
        let f = all_false.read();
        all_true.store(t & v);
        all_false.store(f & (!v));
    }

    node_words[(bp_base + out_node) as usize] = all_true.read() | all_false.read();
}

#[cfg(feature = "gpu")]
/// Launch the packed gate kernel.
///
/// `node_words` is updated in-place.
#[allow(clippy::too_many_arguments)]
pub fn eval_gates_packed_gpu<R: Runtime>(
    client: &ComputeClient<R>,
    op_code: u32,
    operand_offsets: &[u32],
    operand_indices: &[u32],
    operand_negated: &[u32],
    gate_out_indices: &[u32],
    min_numbers: Option<&[u32]>,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words: &mut [u64],
) {
    let num_gates = gate_out_indices.len() as u32;
    assert_eq!(
        operand_offsets.len(),
        (num_gates as usize) + 1,
        "operand_offsets must be num_gates+1"
    );
    assert_eq!(
        operand_indices.len(),
        operand_negated.len(),
        "operand_indices/negated mismatch"
    );

    let total_words = (b_count as usize) * (p_count as usize) * (num_nodes as usize);
    assert_eq!(
        node_words.len(),
        total_words,
        "node_words must be B*P*num_nodes"
    );

    let offsets_h = client.create_from_slice(u32::as_bytes(operand_offsets));
    let indices_h = client.create_from_slice(u32::as_bytes(operand_indices));
    let neg_h = client.create_from_slice(u32::as_bytes(operand_negated));
    let out_h = client.create_from_slice(u32::as_bytes(gate_out_indices));

    let mut words_lo = Vec::with_capacity(node_words.len());
    let mut words_hi = Vec::with_capacity(node_words.len());
    for &w in node_words.iter() {
        words_lo.push((w & 0xFFFF_FFFFu64) as u32);
        words_hi.push((w >> 32) as u32);
    }

    let words_lo_h = client.create_from_slice(u32::as_bytes(&words_lo));
    let words_hi_h = client.create_from_slice(u32::as_bytes(&words_hi));

    let cube_dim_x = if num_gates >= 32 { 32 } else if num_gates >= 16 { 16 } else if num_gates >= 8 { 8 } else if num_gates >= 4 { 4 } else if num_gates >= 2 { 2 } else { 1 };
    let cube_dim_y = p_count.max(1).min((256 / cube_dim_x).max(1).min(8));
    let cube_dim = CubeDim::new_2d(cube_dim_x, cube_dim_y);
    let cube_count = CubeCount::new_3d(
        num_gates.div_ceil(cube_dim.x),
        p_count.div_ceil(cube_dim.y),
        b_count.div_ceil(cube_dim.z),
    );

    unsafe {
        let offsets_arg = ArrayArg::from_raw_parts::<u32>(&offsets_h, operand_offsets.len(), 1);
        let indices_arg = ArrayArg::from_raw_parts::<u32>(&indices_h, operand_indices.len(), 1);
        let neg_arg = ArrayArg::from_raw_parts::<u32>(&neg_h, operand_negated.len(), 1);
        let out_arg = ArrayArg::from_raw_parts::<u32>(&out_h, gate_out_indices.len(), 1);
        let words_lo_arg = ArrayArg::from_raw_parts::<u32>(&words_lo_h, words_lo.len(), 1);
        let words_hi_arg = ArrayArg::from_raw_parts::<u32>(&words_hi_h, words_hi.len(), 1);

        let result = if op_code == 0u32 {
            eval_gates_packed_and_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_lo_arg,
                words_hi_arg,
            )
        } else if op_code == 1u32 {
            eval_gates_packed_or_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_lo_arg,
                words_hi_arg,
            )
        } else if op_code == 2u32 {
            eval_gates_packed_xor_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_lo_arg,
                words_hi_arg,
            )
        } else if op_code == 3u32 {
            eval_gates_packed_nand_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_lo_arg,
                words_hi_arg,
            )
        } else if op_code == 4u32 {
            eval_gates_packed_nor_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_lo_arg,
                words_hi_arg,
            )
        } else if op_code == 5u32 {
            eval_gates_packed_iff_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_lo_arg,
                words_hi_arg,
            )
        } else if op_code == 6u32 {
            let mins = min_numbers.expect("min_numbers is required for AtLeast (op_code=6)");
            assert_eq!(
                mins.len(),
                gate_out_indices.len(),
                "min_numbers must be per-gate"
            );
            let mins_h = client.create_from_slice(u32::as_bytes(mins));
            let total_gate_threads = num_gates * 2u32;
            let cube_dim_x_large = if total_gate_threads >= 32 {
                32
            } else if total_gate_threads >= 16 {
                16
            } else if total_gate_threads >= 8 {
                8
            } else if total_gate_threads >= 4 {
                4
            } else if total_gate_threads >= 2 {
                2
            } else {
                1
            };
            let cube_dim_y_large = p_count.max(1).min((256 / cube_dim_x_large).max(1).min(8));
            let cube_dim_large = CubeDim::new_2d(cube_dim_x_large, cube_dim_y_large);
            let cube_count_large = CubeCount::new_3d(
                total_gate_threads.div_ceil(cube_dim_large.x),
                p_count.div_ceil(cube_dim_large.y),
                b_count.div_ceil(cube_dim_large.z),
            );

            let mins_arg_small = ArrayArg::from_raw_parts::<u32>(&mins_h, mins.len(), 1);
            let offsets_arg_small =
                ArrayArg::from_raw_parts::<u32>(&offsets_h, operand_offsets.len(), 1);
            let indices_arg_small =
                ArrayArg::from_raw_parts::<u32>(&indices_h, operand_indices.len(), 1);
            let neg_arg_small = ArrayArg::from_raw_parts::<u32>(&neg_h, operand_negated.len(), 1);
            let out_arg_small =
                ArrayArg::from_raw_parts::<u32>(&out_h, gate_out_indices.len(), 1);
            let words_lo_arg_small = ArrayArg::from_raw_parts::<u32>(&words_lo_h, words_lo.len(), 1);
            let words_hi_arg_small = ArrayArg::from_raw_parts::<u32>(&words_hi_h, words_hi.len(), 1);

            eval_gates_packed_atleast_small_kernel::launch_unchecked::<R>(
                client,
                cube_count.clone(),
                cube_dim,
                offsets_arg_small,
                indices_arg_small,
                neg_arg_small,
                out_arg_small,
                mins_arg_small,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_lo_arg_small,
                words_hi_arg_small,
            )
            .expect("Failed to launch packed AtLeast small-fan-in kernel");

            let mins_arg_large = ArrayArg::from_raw_parts::<u32>(&mins_h, mins.len(), 1);
            let offsets_arg_large =
                ArrayArg::from_raw_parts::<u32>(&offsets_h, operand_offsets.len(), 1);
            let indices_arg_large =
                ArrayArg::from_raw_parts::<u32>(&indices_h, operand_indices.len(), 1);
            let neg_arg_large = ArrayArg::from_raw_parts::<u32>(&neg_h, operand_negated.len(), 1);
            let out_arg_large =
                ArrayArg::from_raw_parts::<u32>(&out_h, gate_out_indices.len(), 1);
            let words_lo_arg_large = ArrayArg::from_raw_parts::<u32>(&words_lo_h, words_lo.len(), 1);
            let words_hi_arg_large = ArrayArg::from_raw_parts::<u32>(&words_hi_h, words_hi.len(), 1);

            eval_gates_packed_atleast_large_coop_kernel::launch_unchecked::<R>(
                client,
                cube_count_large,
                cube_dim_large,
                offsets_arg_large,
                indices_arg_large,
                neg_arg_large,
                out_arg_large,
                mins_arg_large,
                ScalarArg::new(total_gate_threads),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_lo_arg_large,
                words_hi_arg_large,
            )
        } else {
            Ok(())
        };

        result.expect("Failed to launch packed gate kernel");
    }

    let out_lo_bytes = client.read_one(words_lo_h);
    let out_hi_bytes = client.read_one(words_hi_h);
    let out_lo = u32::from_bytes(&out_lo_bytes).to_vec();
    let out_hi = u32::from_bytes(&out_hi_bytes).to_vec();
    for i in 0..node_words.len() {
        node_words[i] = (out_lo[i] as u64) | ((out_hi[i] as u64) << 32);
    }
}

#[cfg(all(feature = "gpu", feature = "gpu_u64"))]
/// Launch the packed gate kernel using true `u64` words.
///
/// Currently supports op_codes 0..=5 (AND/OR/XOR/NAND/NOR/IFF). For `AtLeast`
/// we keep the `u32` lo/hi path.
#[allow(clippy::too_many_arguments)]
pub fn eval_gates_packed_gpu_u64<R: Runtime>(
    client: &ComputeClient<R>,
    op_code: u32,
    operand_offsets: &[u32],
    operand_indices: &[u32],
    operand_negated: &[u32],
    gate_out_indices: &[u32],
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words: &mut [u64],
) {
    let num_gates = gate_out_indices.len() as u32;
    assert_eq!(
        operand_offsets.len(),
        (num_gates as usize) + 1,
        "operand_offsets must be num_gates+1"
    );
    assert_eq!(
        operand_indices.len(),
        operand_negated.len(),
        "operand_indices/negated mismatch"
    );

    let total_words = (b_count as usize) * (p_count as usize) * (num_nodes as usize);
    assert_eq!(
        node_words.len(),
        total_words,
        "node_words must be B*P*num_nodes"
    );
    assert!(
        op_code <= 5u32,
        "u64 kernel launcher supports op_code 0..=5"
    );

    let offsets_h = client.create_from_slice(u32::as_bytes(operand_offsets));
    let indices_h = client.create_from_slice(u32::as_bytes(operand_indices));
    let neg_h = client.create_from_slice(u32::as_bytes(operand_negated));
    let out_h = client.create_from_slice(u32::as_bytes(gate_out_indices));
    let words_h = client.create_from_slice(u64::as_bytes(node_words));

    let threads_per_block = 256u32;
    let total = num_gates * b_count * p_count;
    let blocks = total.div_ceil(threads_per_block);

    unsafe {
        let cube_count = CubeCount::Static(blocks, 1, 1);
        let cube_dim = CubeDim::new_1d(threads_per_block);
        let offsets_arg = ArrayArg::from_raw_parts::<u32>(&offsets_h, operand_offsets.len(), 1);
        let indices_arg = ArrayArg::from_raw_parts::<u32>(&indices_h, operand_indices.len(), 1);
        let neg_arg = ArrayArg::from_raw_parts::<u32>(&neg_h, operand_negated.len(), 1);
        let out_arg = ArrayArg::from_raw_parts::<u32>(&out_h, gate_out_indices.len(), 1);
        let words_arg = ArrayArg::from_raw_parts::<u64>(&words_h, node_words.len(), 1);

        let result = if op_code == 0u32 {
            eval_gates_packed_and_u64_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_arg,
            )
        } else if op_code == 1u32 {
            eval_gates_packed_or_u64_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_arg,
            )
        } else if op_code == 2u32 {
            eval_gates_packed_xor_u64_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_arg,
            )
        } else if op_code == 3u32 {
            eval_gates_packed_nand_u64_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_arg,
            )
        } else if op_code == 4u32 {
            eval_gates_packed_nor_u64_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_arg,
            )
        } else {
            eval_gates_packed_iff_u64_kernel::launch_unchecked::<R>(
                client,
                cube_count,
                cube_dim,
                offsets_arg,
                indices_arg,
                neg_arg,
                out_arg,
                ScalarArg::new(num_gates),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                words_arg,
            )
        };

        result.expect("Failed to launch packed u64 gate kernel");
    }

    let out_bytes = client.read_one(words_h);
    let out = u64::from_bytes(&out_bytes).to_vec();
    node_words.copy_from_slice(&out);
}

#[cfg(test)]
#[allow(dead_code)]
fn cpu_eval_word(op_code: u32, operands: &[(u64, bool)]) -> u64 {
    match op_code {
        0 => {
            let mut acc = !0u64;
            for (w, neg) in operands {
                let v = if *neg { !*w } else { *w };
                acc &= v;
            }
            acc
        }
        1 => {
            let mut acc = 0u64;
            for (w, neg) in operands {
                let v = if *neg { !*w } else { *w };
                acc |= v;
            }
            acc
        }
        2 => {
            let mut acc = 0u64;
            for (w, neg) in operands {
                let v = if *neg { !*w } else { *w };
                acc ^= v;
            }
            acc
        }
        3 => !cpu_eval_word(0, operands),
        4 => !cpu_eval_word(1, operands),
        5 => {
            let mut all_true = !0u64;
            let mut all_false = !0u64;
            for (w, neg) in operands {
                let v = if *neg { !*w } else { *w };
                all_true &= v;
                all_false &= !v;
            }
            all_true | all_false
        }
        _ => 0,
    }
}

#[cfg(test)]
#[allow(dead_code)]
fn cpu_eval_atleast_word(operands: &[(u64, bool)], k: u32) -> u64 {
    if k == 0 {
        return !0u64;
    }
    if k as usize > operands.len() {
        return 0u64;
    }

    let mut out = 0u64;
    for lane in 0..64u32 {
        let mut count = 0u32;
        for (w, neg) in operands {
            let v = if *neg { !*w } else { *w };
            let bit = (v >> lane) & 1u64;
            count += bit as u32;
        }
        if count >= k {
            out |= 1u64 << lane;
        }
    }
    out
}

#[cfg(all(test, feature = "cuda"))]
mod cuda_tests {
    use super::*;
    use cubecl_cuda::CudaRuntime;

    #[test]
    fn cuda_packed_gate_kernel_matches_cpu() {
        let device = <CudaRuntime as Runtime>::Device::default();
        let client = CudaRuntime::client(&device);

        // Layout: num_nodes includes operand nodes and one output node.
        let num_nodes = 6u32;
        let b_count = 2u32;
        let p_count = 3u32;

        // We'll evaluate 2 gates.
        // Gate0 out=node4, operands: node0, node1 (negated), node2
        // Gate1 out=node5, operands: node3, node2
        let gate_out_indices = vec![4u32, 5u32];
        let operand_offsets = vec![0u32, 3u32, 5u32];
        let operand_indices = vec![0u32, 1u32, 2u32, 3u32, 2u32];
        let operand_negated = vec![0u32, 1u32, 0u32, 0u32, 0u32];

        // Initialize node words deterministically per (b,p,node).
        let total_words = (b_count as usize) * (p_count as usize) * (num_nodes as usize);
        let mut node_words = vec![0u64; total_words];
        for b in 0..b_count {
            for p in 0..p_count {
                let bp_base = ((b * p_count + p) * num_nodes) as usize;
                for n in 0..num_nodes {
                    // simple pattern; different per node and per bp
                    node_words[bp_base + n as usize] = 0x9E37_79B9_7F4A_7C15u64
                        ^ ((b as u64) << 48)
                        ^ ((p as u64) << 32)
                        ^ ((n as u64) * 0xD251_1F53u64);
                }
            }
        }

        let min_numbers = vec![2u32, 1u32];

        for op_code in [0u32, 1u32, 2u32, 3u32, 4u32, 5u32, 6u32] {
            let mut words_gpu = node_words.clone();
            eval_gates_packed_gpu::<CudaRuntime>(
                &client,
                op_code,
                &operand_offsets,
                &operand_indices,
                &operand_negated,
                &gate_out_indices,
                if op_code == 6u32 {
                    Some(&min_numbers)
                } else {
                    None
                },
                num_nodes,
                b_count,
                p_count,
                &mut words_gpu,
            );

            // CPU expected
            let mut words_cpu = node_words.clone();
            for b in 0..b_count {
                for p in 0..p_count {
                    let bp_base = ((b * p_count + p) * num_nodes) as usize;

                    // gate0
                    let ops0 = [
                        (words_cpu[bp_base], false),
                        (words_cpu[bp_base + 1], true),
                        (words_cpu[bp_base + 2], false),
                    ];
                    words_cpu[bp_base + 4] = if op_code == 6u32 {
                        cpu_eval_atleast_word(&ops0, min_numbers[0])
                    } else {
                        cpu_eval_word(op_code, &ops0)
                    };

                    // gate1
                    let ops1 = [
                        (words_cpu[bp_base + 3], false),
                        (words_cpu[bp_base + 2], false),
                    ];
                    words_cpu[bp_base + 5] = if op_code == 6u32 {
                        cpu_eval_atleast_word(&ops1, min_numbers[1])
                    } else {
                        cpu_eval_word(op_code, &ops1)
                    };
                }
            }

            assert_eq!(words_gpu, words_cpu, "op_code={op_code}");
        }
    }

    #[cfg(feature = "gpu_u64")]
    #[test]
    fn cuda_packed_gate_u64_kernel_matches_cpu() {
        let device = <CudaRuntime as Runtime>::Device::default();
        let client = CudaRuntime::client(&device);

        let num_nodes = 6u32;
        let b_count = 2u32;
        let p_count = 3u32;

        let gate_out_indices = vec![4u32, 5u32];
        let operand_offsets = vec![0u32, 3u32, 5u32];
        let operand_indices = vec![0u32, 1u32, 2u32, 3u32, 2u32];
        let operand_negated = vec![0u32, 1u32, 0u32, 0u32, 0u32];

        let total_words = (b_count as usize) * (p_count as usize) * (num_nodes as usize);
        let mut node_words = vec![0u64; total_words];
        for b in 0..b_count {
            for p in 0..p_count {
                let bp_base = ((b * p_count + p) * num_nodes) as usize;
                for n in 0..num_nodes {
                    node_words[bp_base + n as usize] = 0x9E37_79B9_7F4A_7C15u64
                        ^ ((b as u64) << 48)
                        ^ ((p as u64) << 32)
                        ^ ((n as u64) * 0xD251_1F53u64);
                }
            }
        }

        for op_code in [0u32, 1u32, 2u32, 3u32, 4u32, 5u32] {
            let mut words_gpu = node_words.clone();
            eval_gates_packed_gpu_u64::<CudaRuntime>(
                &client,
                op_code,
                &operand_offsets,
                &operand_indices,
                &operand_negated,
                &gate_out_indices,
                num_nodes,
                b_count,
                p_count,
                &mut words_gpu,
            );

            let mut words_cpu = node_words.clone();
            for b in 0..b_count {
                for p in 0..p_count {
                    let bp_base = ((b * p_count + p) * num_nodes) as usize;
                    let ops0 = [
                        (words_cpu[bp_base], false),
                        (words_cpu[bp_base + 1], true),
                        (words_cpu[bp_base + 2], false),
                    ];
                    words_cpu[bp_base + 4] = cpu_eval_word(op_code, &ops0);

                    let ops1 = [
                        (words_cpu[bp_base + 3], false),
                        (words_cpu[bp_base + 2], false),
                    ];
                    words_cpu[bp_base + 5] = cpu_eval_word(op_code, &ops1);
                }
            }

            assert_eq!(words_gpu, words_cpu, "op_code={op_code}");
        }
    }
}
