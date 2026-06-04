//! Blueprint-style GPU layer scheduler / executor for DPMC.
//!
//! This wires together:
//! - bitpacked Philox sampling (writing directly into `(B,P,node)` words)
//! - constant node initialization
//! - per-layer packed gate kernels, in depth order
//!
//! The intent is to keep node words resident on device and only read back once
//! at the end of execution.

#[cfg(feature = "gpu")]
use cubecl::prelude::*;

#[cfg(feature = "gpu")]
use cubecl::stream_id::StreamId;

#[cfg(feature = "gpu")]
use cubecl::server::Handle;

#[cfg(feature = "gpu")]
use crate::algorithms::pdag::{Pdag, PdagNode};

#[cfg(feature = "gpu")]
use crate::mc::gpu_soa::GpuSoaPlan;

#[cfg(feature = "gpu")]
use crate::mc::plan::{ConnectiveRank, DpMcPlan};

#[cfg(feature = "gpu")]
#[inline]
fn cube_count_for_1d_blocks(blocks: u32) -> CubeCount {
    const MAX_DIM: u32 = 65_535;
    if blocks <= MAX_DIM {
        CubeCount::Static(blocks, 1, 1)
    } else {
        let x = MAX_DIM;
        let y = blocks.div_ceil(MAX_DIM);
        assert!(
            y <= MAX_DIM,
            "Dispatch too large for 2D mapping: blocks={blocks} => ({x},{y})"
        );
        CubeCount::Static(x, y, 1)
    }
}

#[cfg(feature = "gpu")]
#[inline]
fn choose_primary_lane(primary: u32) -> u32 {
    if primary >= 32 {
        32
    } else if primary >= 16 {
        16
    } else if primary >= 8 {
        8
    } else if primary >= 4 {
        4
    } else if primary >= 2 {
        2
    } else {
        1
    }
}

#[cfg(feature = "gpu")]
#[inline]
fn choose_sample_cube_dim(num_events: u32, p_count: u32) -> CubeDim {
    let x = choose_primary_lane(num_events.max(1));
    let max_y = (256 / x).max(1).min(8);
    let y = p_count.max(1).min(max_y);
    CubeDim::new_2d(x, y)
}

#[cfg(feature = "gpu")]
#[inline]
fn choose_gate_cube_dim(num_gates: u32, p_count: u32) -> CubeDim {
    let x = choose_primary_lane(num_gates.max(1));
    let max_y = (256 / x).max(1).min(8);
    let y = p_count.max(1).min(max_y);
    CubeDim::new_2d(x, y)
}

#[cfg(feature = "gpu")]
#[inline]
fn choose_seq_cube_dim(seq_count: u32, p_count: u32) -> CubeDim {
    let x = choose_primary_lane(seq_count.max(1));
    let max_y = (256 / x).max(1).min(8);
    let y = p_count.max(1).min(max_y);
    CubeDim::new_2d(x, y)
}

#[cfg(feature = "gpu")]
#[inline]
fn choose_tally_cube_dim(bp_total: u32) -> CubeDim {
    let y = if bp_total > 128 {
        8
    } else if bp_total > 64 {
        4
    } else if bp_total > 32 {
        2
    } else {
        1
    };
    CubeDim::new_2d(32, y)
}

#[cfg(feature = "gpu")]
#[inline]
fn cube_count_for_sample_launch(num_events: u32, p_count: u32, b_count: u32, cube_dim: CubeDim) -> CubeCount {
    CubeCount::new_3d(
        num_events.div_ceil(cube_dim.x),
        p_count.div_ceil(cube_dim.y),
        b_count.div_ceil(cube_dim.z),
    )
}

#[cfg(feature = "gpu")]
#[inline]
fn cube_count_for_gate_launch(num_gates: u32, p_count: u32, b_count: u32, cube_dim: CubeDim) -> CubeCount {
    CubeCount::new_3d(
        num_gates.div_ceil(cube_dim.x),
        p_count.div_ceil(cube_dim.y),
        b_count.div_ceil(cube_dim.z),
    )
}

#[cfg(feature = "gpu")]
#[inline]
fn cube_count_for_seq_launch(seq_count: u32, p_count: u32, b_count: u32, cube_dim: CubeDim) -> CubeCount {
    CubeCount::new_3d(
        seq_count.div_ceil(cube_dim.x),
        p_count.div_ceil(cube_dim.y),
        b_count.div_ceil(cube_dim.z),
    )
}

#[cfg(feature = "gpu")]
#[inline]
fn build_gate_stream_clients<R: Runtime>(
    client: &ComputeClient<R>,
    stream_count: usize,
) -> Vec<ComputeClient<R>> {
    let mut clients = Vec::with_capacity(stream_count);
    for i in 0..stream_count {
        let mut c = client.clone();
        unsafe {
            c.set_stream(StreamId {
                value: 10_000u64 + (i as u64),
            });
        }
        clients.push(c);
    }
    clients
}

#[cfg(feature = "gpu")]
#[inline]
fn align_gate_streams_with_markers<R: Runtime>(
    clients: &[ComputeClient<R>],
    markers: &[Handle],
) {
    if markers.is_empty() {
        return;
    }
    for client in clients {
        for marker in markers {
            let _ = client.get_resource(marker.clone().binding());
        }
    }
}

#[cfg(feature = "gpu")]
#[inline]
fn capture_gate_layer_markers<R: Runtime>(
    clients: &[ComputeClient<R>],
    used_streams: &[bool],
) -> Vec<Handle> {
    let mut markers: Vec<Handle> = Vec::new();
    for (stream_ix, client) in clients.iter().enumerate() {
        if used_streams.get(stream_ix).copied().unwrap_or(false) {
            markers.push(client.create_from_slice(u32::as_bytes(&[0u32])));
        }
    }
    markers
}

#[cfg(feature = "gpu")]
#[derive(Debug)]
struct UploadedGateGroup {
    op_code: u32,
    num_gates: u32,
    offsets_h: Handle,
    offsets_len: usize,
    indices_h: Handle,
    indices_len: usize,
    neg_h: Handle,
    neg_len: usize,
    out_h: Handle,
    out_len: usize,
    mins_h: Option<Handle>,
    mins_len: usize,
}

#[cfg(feature = "gpu")]
#[derive(Debug)]
struct UploadedLayer {
    gate_groups: Vec<UploadedGateGroup>,
}

#[cfg(feature = "gpu")]
fn upload_gate_groups<R: Runtime>(
    client: &ComputeClient<R>,
    soa: &GpuSoaPlan,
) -> Vec<UploadedLayer> {
    let mut uploaded_layers: Vec<UploadedLayer> = Vec::with_capacity(soa.layers.len());

    for layer in &soa.layers {
        let mut gate_groups: Vec<UploadedGateGroup> = Vec::with_capacity(layer.gate_groups.len());

        for (rank, group) in &layer.gate_groups {
            let op_code = op_code_for_rank(*rank, group);
            let num_gates = group.out_nodes.len() as u32;
            if num_gates == 0 {
                continue;
            }

            let offsets_h = client.create_from_slice(u32::as_bytes(&group.operand_offsets));
            let indices_h = client.create_from_slice(u32::as_bytes(&group.operand_indices));
            let neg_h = client.create_from_slice(u32::as_bytes(&group.operand_negated));
            let out_h = client.create_from_slice(u32::as_bytes(&group.out_nodes));

            let (mins_h, mins_len) = if op_code == 6u32 {
                let mins = group
                    .min_numbers
                    .as_ref()
                    .expect("AtLeast requires min_numbers");
                (
                    Some(client.create_from_slice(u32::as_bytes(mins))),
                    mins.len(),
                )
            } else {
                (None, 0usize)
            };

            gate_groups.push(UploadedGateGroup {
                op_code,
                num_gates,
                offsets_h,
                offsets_len: group.operand_offsets.len(),
                indices_h,
                indices_len: group.operand_indices.len(),
                neg_h,
                neg_len: group.operand_negated.len(),
                out_h,
                out_len: group.out_nodes.len(),
                mins_h,
                mins_len,
            });
        }

        uploaded_layers.push(UploadedLayer { gate_groups });
    }

    uploaded_layers
}

#[cfg(feature = "gpu")]
fn op_code_for_rank(rank: ConnectiveRank, soa: &crate::mc::gpu_soa::GateGroupSoa) -> u32 {
    use crate::algorithms::pdag::Connective;

    match soa.connective {
        Connective::And => 0u32,
        Connective::Or => 1u32,
        Connective::Xor => 2u32,
        Connective::Nand => 3u32,
        Connective::Nor => 4u32,
        Connective::Iff => 5u32,
        Connective::AtLeast => 6u32,
        Connective::Not | Connective::Null => panic!(
            "Unexpected connective in GPU packed plan (rank={:?}, connective={:?})",
            rank, soa.connective
        ),
    }
}

#[cfg(feature = "gpu")]
#[allow(clippy::too_many_arguments)]
unsafe fn launch_gate_group<R: Runtime>(
    client: &ComputeClient<R>,
    group: &UploadedGateGroup,
    b_count: u32,
    p_count: u32,
    num_nodes: u32,
    total_words: usize,
    node_words_lo_h: &Handle,
    node_words_hi_h: &Handle,
    cube_dim: CubeDim,
) {
    let op_code = group.op_code;
    let num_gates = group.num_gates;
    if num_gates == 0 {
        return;
    }
    let cube_count = cube_count_for_gate_launch(num_gates, p_count, b_count, cube_dim);
    let offsets_arg = ArrayArg::from_raw_parts::<u32>(&group.offsets_h, group.offsets_len, 1);
    let indices_arg = ArrayArg::from_raw_parts::<u32>(&group.indices_h, group.indices_len, 1);
    let neg_arg = ArrayArg::from_raw_parts::<u32>(&group.neg_h, group.neg_len, 1);
    let out_arg = ArrayArg::from_raw_parts::<u32>(&group.out_h, group.out_len, 1);
    let words_lo_arg = ArrayArg::from_raw_parts::<u32>(node_words_lo_h, total_words, 1);
    let words_hi_arg = ArrayArg::from_raw_parts::<u32>(node_words_hi_h, total_words, 1);
    let result = if op_code == 0u32 {
        crate::mc::kernel::dpmc_gate::eval_gates_packed_and_kernel::launch_unchecked::<R>(
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
        crate::mc::kernel::dpmc_gate::eval_gates_packed_or_kernel::launch_unchecked::<R>(
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
        crate::mc::kernel::dpmc_gate::eval_gates_packed_xor_kernel::launch_unchecked::<R>(
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
        crate::mc::kernel::dpmc_gate::eval_gates_packed_nand_kernel::launch_unchecked::<R>(
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
        crate::mc::kernel::dpmc_gate::eval_gates_packed_nor_kernel::launch_unchecked::<R>(
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
        crate::mc::kernel::dpmc_gate::eval_gates_packed_iff_kernel::launch_unchecked::<R>(
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
        let mins_h = group.mins_h.as_ref().expect("AtLeast gate requires mins_h");
        let mins_arg = ArrayArg::from_raw_parts::<u32>(mins_h, group.mins_len, 1);
        crate::mc::kernel::dpmc_gate::eval_gates_packed_atleast_kernel::launch_unchecked::<R>(
            client,
            cube_count,
            cube_dim,
            offsets_arg,
            indices_arg,
            neg_arg,
            out_arg,
            mins_arg,
            ScalarArg::new(num_gates),
            ScalarArg::new(num_nodes),
            ScalarArg::new(b_count),
            ScalarArg::new(p_count),
            words_lo_arg,
            words_hi_arg,
        )
    } else {
        Ok(())
    };
    result.expect("Failed to launch packed gate kernel");
}

#[cfg(feature = "gpu")]
/// Execute a DPMC plan on GPU using the SoA gate layout.
///
/// - `thresholds`/`full_ranges` must be per-event in `soa.event_nodes` order.
/// - Returns `(B,P,node)` packed words as `u64`, with `B=plan.params.b`, `P=plan.params.p`.
#[allow(clippy::too_many_arguments)]
pub fn execute_layers_bitpacked_gpu<R: Runtime>(
    client: &ComputeClient<R>,
    pdag: &Pdag,
    plan: &DpMcPlan,
    soa: &GpuSoaPlan,
    thresholds: &[u32],
    full_ranges: &[u32],
    t: u32,
    key: [u32; 2],
) -> Vec<u64> {
    let b_count = plan.params.b as u32;
    let p_count = plan.params.p as u32;
    assert_eq!(soa.layout.b_count, b_count);
    assert_eq!(soa.layout.p_count, p_count);

    let num_nodes = soa.layout.num_nodes;

    let num_events = soa.event_nodes.len() as u32;
    assert_eq!(
        thresholds.len(),
        num_events as usize,
        "thresholds must be per event"
    );
    assert_eq!(
        full_ranges.len(),
        num_events as usize,
        "full_ranges must be per event"
    );

    let total_words = (b_count as usize) * (p_count as usize) * (num_nodes as usize);

    // Allocate `(B,P,node)` buffers on device.
    // Start from zeros (host init once) to avoid relying on uninitialized `empty()`.
    let zeros = vec![0u32; total_words];
    let node_words_lo_h = client.create_from_slice(u32::as_bytes(&zeros));
    let node_words_hi_h = client.create_from_slice(u32::as_bytes(&zeros));

    // Sample events directly into node word buffer.
    let event_nodes_u32: Vec<u32> = soa.event_nodes.iter().map(|&n| n.unsigned_abs()).collect();
    let thresholds_h = client.create_from_slice(u32::as_bytes(thresholds));
    let full_ranges_h = client.create_from_slice(u32::as_bytes(full_ranges));
    let event_nodes_h = client.create_from_slice(u32::as_bytes(&event_nodes_u32));

    let threads_per_block = 256u32;
    let sample_cube_dim = choose_sample_cube_dim(num_events, p_count);

    unsafe {
        crate::mc::kernel::dpmc_event::sample_events_bitpacked_to_nodes_kernel::launch_unchecked::<R>(
            client,
            cube_count_for_sample_launch(num_events, p_count, b_count, sample_cube_dim),
            sample_cube_dim,
            ArrayArg::from_raw_parts::<u32>(&thresholds_h, thresholds.len(), 1),
            ArrayArg::from_raw_parts::<u32>(&full_ranges_h, full_ranges.len(), 1),
            ArrayArg::from_raw_parts::<u32>(&event_nodes_h, event_nodes_u32.len(), 1),
            ScalarArg::new(num_events),
            ScalarArg::new(num_nodes),
            ScalarArg::new(b_count),
            ScalarArg::new(p_count),
            ScalarArg::new(t),
            ScalarArg::new(key[0]),
            ScalarArg::new(key[1]),
            ArrayArg::from_raw_parts::<u32>(&node_words_lo_h, total_words, 1),
            ArrayArg::from_raw_parts::<u32>(&node_words_hi_h, total_words, 1),
        )
        .expect("Failed to launch event sampling-to-node kernel");
    }

    // Initialize constant nodes (once up-front).
    let mut const_nodes: Vec<u32> = Vec::new();
    let mut const_values: Vec<u32> = Vec::new();
    for layer in &soa.layers {
        for &node in &layer.constants {
            let node = node.abs();
            match pdag.get_node(node) {
                Some(PdagNode::Constant { value, .. }) => {
                    const_nodes.push(node as u32);
                    const_values.push(if *value { 1u32 } else { 0u32 });
                }
                other => panic!("Layer constant node {node} is not a constant: {other:?}"),
            }
        }
    }

    if !const_nodes.is_empty() {
        let const_nodes_h = client.create_from_slice(u32::as_bytes(&const_nodes));
        let const_values_h = client.create_from_slice(u32::as_bytes(&const_values));

        let num_consts = const_nodes.len() as u32;
        let total_threads = num_consts * b_count * p_count;
        let blocks = total_threads.div_ceil(threads_per_block);

        unsafe {
            crate::mc::kernel::dpmc_node::set_constant_nodes_kernel::launch_unchecked::<R>(
                client,
                cube_count_for_1d_blocks(blocks),
                CubeDim::new_1d(threads_per_block),
                ArrayArg::from_raw_parts::<u32>(&const_nodes_h, const_nodes.len(), 1),
                ArrayArg::from_raw_parts::<u32>(&const_values_h, const_values.len(), 1),
                ScalarArg::new(num_consts),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                ArrayArg::from_raw_parts::<u32>(&node_words_lo_h, total_words, 1),
                ArrayArg::from_raw_parts::<u32>(&node_words_hi_h, total_words, 1),
            )
            .expect("Failed to launch constant node init kernel");
        }
    }

    // Upload all SoA gate-group arrays once, then run packed gate kernels.
    // This avoids per-gate-group heap allocations in the hot submission loop.
    let uploaded_layers = upload_gate_groups(client, soa);

    // Run packed gate kernels layer-by-layer.
    for layer in &uploaded_layers {
        for group in &layer.gate_groups {
            unsafe {
                launch_gate_group::<R>(
                    client,
                    group,
                    b_count,
                    p_count,
                    num_nodes,
                    total_words,
                    &node_words_lo_h,
                    &node_words_hi_h,
                    choose_gate_cube_dim(group.num_gates, p_count),
                );
            }
        }
    }

    // Read back once at the end.
    let out_lo_bytes = client.read_one(node_words_lo_h);
    let out_hi_bytes = client.read_one(node_words_hi_h);
    let out_lo = u32::from_bytes(&out_lo_bytes).to_vec();
    let out_hi = u32::from_bytes(&out_hi_bytes).to_vec();

    let mut out = Vec::with_capacity(total_words);
    for i in 0..total_words {
        out.push((out_lo[i] as u64) | ((out_hi[i] as u64) << 32));
    }
    out
}

#[cfg(feature = "gpu")]
#[allow(clippy::too_many_arguments)]
pub fn execute_layers_bitpacked_gpu_tallies<R: Runtime>(
    client: &ComputeClient<R>,
    pdag: &Pdag,
    plan: &DpMcPlan,
    soa: &GpuSoaPlan,
    thresholds: &[u32],
    full_ranges: &[u32],
    t: u32,
    key: [u32; 2],
    initial_tallies: Option<&[u64]>,
    valid_lanes_last_word: u32,
) -> Vec<u64> {
    execute_layers_bitpacked_gpu_tallies_many_iters::<R>(
        client,
        pdag,
        plan,
        soa,
        thresholds,
        full_ranges,
        1u32,
        t,
        key,
        initial_tallies,
        valid_lanes_last_word,
    )
}

#[cfg(feature = "gpu")]
#[allow(clippy::too_many_arguments)]
pub fn execute_layers_bitpacked_gpu_tallies_many_iters<R: Runtime>(
    client: &ComputeClient<R>,
    pdag: &Pdag,
    plan: &DpMcPlan,
    soa: &GpuSoaPlan,
    thresholds: &[u32],
    full_ranges: &[u32],
    t_count: u32,
    t_start: u32,
    key: [u32; 2],
    initial_tallies: Option<&[u64]>,
    valid_lanes_last_word: u32,
) -> Vec<u64> {
    let mut context = FtGpuContext::<R>::new(
        client,
        pdag,
        plan,
        soa,
        thresholds,
        full_ranges,
        initial_tallies,
        valid_lanes_last_word,
    );
    context.execute_chunk(t_count, t_start, key);
    context.read_tallies()
}

#[cfg(feature = "gpu")]
#[allow(clippy::too_many_arguments)]
pub fn execute_layers_bitpacked_gpu_selected_nodes_process_many_iters<R: Runtime, F: FnMut(&[u64], u32) -> bool>(
    client: &ComputeClient<R>,
    pdag: &Pdag,
    plan: &DpMcPlan,
    soa: &GpuSoaPlan,
    thresholds: &[u32],
    full_ranges: &[u32],
    t_count: u32,
    t_start: u32,
    key: [u32; 2],
    selected_nodes: &[u32],
    mut on_iter: F,
) {
    let b_count = plan.params.b as u32;
    let p_count = plan.params.p as u32;
    assert_eq!(soa.layout.b_count, b_count);
    assert_eq!(soa.layout.p_count, p_count);

    let num_nodes = soa.layout.num_nodes;
    let num_events = soa.event_nodes.len() as u32;
    assert_eq!(thresholds.len(), num_events as usize);
    assert_eq!(full_ranges.len(), num_events as usize);

    let num_selected = selected_nodes.len() as u32;
    assert!(num_selected > 0, "selected_nodes must be non-empty");

    let total_words = (b_count as usize) * (p_count as usize) * (num_nodes as usize);
    let selected_total_words = (b_count as usize) * (p_count as usize) * (num_selected as usize);

    let node_words_lo_h = client.empty(total_words * std::mem::size_of::<u32>());
    let node_words_hi_h = client.empty(total_words * std::mem::size_of::<u32>());

    let event_nodes_u32: Vec<u32> = soa.event_nodes.iter().map(|&n| n.unsigned_abs()).collect();
    let thresholds_h = client.create_from_slice(u32::as_bytes(thresholds));
    let full_ranges_h = client.create_from_slice(u32::as_bytes(full_ranges));
    let event_nodes_h = client.create_from_slice(u32::as_bytes(&event_nodes_u32));

    let selected_nodes_h = client.create_from_slice(u32::as_bytes(selected_nodes));

    let threads_per_block = 256u32;
    let sample_cube_dim = choose_sample_cube_dim(num_events, p_count);

    let mut const_nodes: Vec<u32> = Vec::new();
    let mut const_values: Vec<u32> = Vec::new();
    for layer in &soa.layers {
        for &node in &layer.constants {
            let node = node.abs();
            match pdag.get_node(node) {
                Some(PdagNode::Constant { value, .. }) => {
                    const_nodes.push(node as u32);
                    const_values.push(if *value { 1u32 } else { 0u32 });
                }
                other => panic!("Layer constant node {node} is not a constant: {other:?}"),
            }
        }
    }

    let (const_nodes_h, const_values_h, num_consts, const_blocks) = if !const_nodes.is_empty() {
        let const_nodes_h = client.create_from_slice(u32::as_bytes(&const_nodes));
        let const_values_h = client.create_from_slice(u32::as_bytes(&const_values));

        let num_consts = const_nodes.len() as u32;
        let total_threads = num_consts * b_count * p_count;
        let blocks = total_threads.div_ceil(threads_per_block);
        (Some(const_nodes_h), Some(const_values_h), num_consts, blocks)
    } else {
        (None, None, 0u32, 0u32)
    };

    let uploaded_layers = upload_gate_groups(client, soa);

    let gather_total_threads = num_selected * b_count * p_count;
    let gather_blocks = gather_total_threads.div_ceil(threads_per_block);

    for iter in 0..t_count {
        let t_counter = t_start + iter;

        unsafe {
            crate::mc::kernel::dpmc_event::sample_events_bitpacked_to_nodes_kernel::launch_unchecked::<R>(
                client,
                cube_count_for_sample_launch(num_events, p_count, b_count, sample_cube_dim),
                sample_cube_dim,
                ArrayArg::from_raw_parts::<u32>(&thresholds_h, thresholds.len(), 1),
                ArrayArg::from_raw_parts::<u32>(&full_ranges_h, full_ranges.len(), 1),
                ArrayArg::from_raw_parts::<u32>(&event_nodes_h, event_nodes_u32.len(), 1),
                ScalarArg::new(num_events),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                ScalarArg::new(t_counter),
                ScalarArg::new(key[0]),
                ScalarArg::new(key[1]),
                ArrayArg::from_raw_parts::<u32>(&node_words_lo_h, total_words, 1),
                ArrayArg::from_raw_parts::<u32>(&node_words_hi_h, total_words, 1),
            )
            .expect("Failed to launch event sampling-to-node kernel");
        }

        if let (Some(const_nodes_h), Some(const_values_h)) = (&const_nodes_h, &const_values_h) {
            unsafe {
                crate::mc::kernel::dpmc_node::set_constant_nodes_kernel::launch_unchecked::<R>(
                    client,
                    cube_count_for_1d_blocks(const_blocks),
                    CubeDim::new_1d(threads_per_block),
                    ArrayArg::from_raw_parts::<u32>(const_nodes_h, const_nodes.len(), 1),
                    ArrayArg::from_raw_parts::<u32>(const_values_h, const_values.len(), 1),
                    ScalarArg::new(num_consts),
                    ScalarArg::new(num_nodes),
                    ScalarArg::new(b_count),
                    ScalarArg::new(p_count),
                    ArrayArg::from_raw_parts::<u32>(&node_words_lo_h, total_words, 1),
                    ArrayArg::from_raw_parts::<u32>(&node_words_hi_h, total_words, 1),
                )
                .expect("Failed to launch constant node init kernel");
            }
        }

        for layer in &uploaded_layers {
            for group in &layer.gate_groups {
                unsafe {
                    launch_gate_group::<R>(
                        client,
                        group,
                        b_count,
                        p_count,
                        num_nodes,
                        total_words,
                        &node_words_lo_h,
                        &node_words_hi_h,
                        choose_gate_cube_dim(group.num_gates, p_count),
                    );
                }
            }
        }

        let selected_words_lo_h = client.empty(selected_total_words * std::mem::size_of::<u32>());
        let selected_words_hi_h = client.empty(selected_total_words * std::mem::size_of::<u32>());

        unsafe {
            crate::mc::kernel::dpmc_node::gather_selected_nodes_kernel::launch_unchecked::<R>(
                client,
                cube_count_for_1d_blocks(gather_blocks),
                CubeDim::new_1d(threads_per_block),
                ArrayArg::from_raw_parts::<u32>(&selected_nodes_h, selected_nodes.len(), 1),
                ScalarArg::new(num_selected),
                ScalarArg::new(num_nodes),
                ScalarArg::new(b_count),
                ScalarArg::new(p_count),
                ArrayArg::from_raw_parts::<u32>(&node_words_lo_h, total_words, 1),
                ArrayArg::from_raw_parts::<u32>(&node_words_hi_h, total_words, 1),
                ArrayArg::from_raw_parts::<u32>(&selected_words_lo_h, selected_total_words, 1),
                ArrayArg::from_raw_parts::<u32>(&selected_words_hi_h, selected_total_words, 1),
            )
            .expect("Failed to launch selected-node gather kernel");
        }

        let out_lo_bytes = client.read_one(selected_words_lo_h);
        let out_hi_bytes = client.read_one(selected_words_hi_h);
        let out_lo = u32::from_bytes(&out_lo_bytes).to_vec();
        let out_hi = u32::from_bytes(&out_hi_bytes).to_vec();

        let mut out_words: Vec<u64> = Vec::with_capacity(selected_total_words);
        for i in 0..selected_total_words {
            out_words.push((out_lo[i] as u64) | ((out_hi[i] as u64) << 32));
        }

        if !on_iter(&out_words, t_counter) {
            break;
        }
    }
}

#[cfg(feature = "gpu")]
#[allow(clippy::too_many_arguments)]
pub fn execute_layers_bitpacked_gpu_event_tree_seq_tallies<R: Runtime>(
    client: &ComputeClient<R>,
    pdag: &Pdag,
    plan: &DpMcPlan,
    soa: &GpuSoaPlan,
    thresholds: &[u32],
    full_ranges: &[u32],
    t: u32,
    key: [u32; 2],
    ie_node: u32,
    seq_count: u32,
    seq_path_start: &[u32],
    seq_path_len: &[u32],
    path_cond_start: &[u32],
    path_cond_len: &[u32],
    cond_fe_node: &[u32],
    cond_route: &[u32],
    initial_seq_tallies: Option<&[u64]>,
    valid_lanes_last_word: u32,
) -> Vec<u64> {
    execute_layers_bitpacked_gpu_event_tree_seq_tallies_many_iters::<R>(
        client,
        pdag,
        plan,
        soa,
        thresholds,
        full_ranges,
        1u32,
        t,
        key,
        ie_node,
        seq_count,
        seq_path_start,
        seq_path_len,
        path_cond_start,
        path_cond_len,
        cond_fe_node,
        cond_route,
        initial_seq_tallies,
        valid_lanes_last_word,
    )
}

#[cfg(feature = "gpu")]
#[allow(clippy::too_many_arguments)]
pub fn execute_layers_bitpacked_gpu_event_tree_seq_tallies_many_iters<R: Runtime>(
    client: &ComputeClient<R>,
    pdag: &Pdag,
    plan: &DpMcPlan,
    soa: &GpuSoaPlan,
    thresholds: &[u32],
    full_ranges: &[u32],
    t_count: u32,
    t_start: u32,
    key: [u32; 2],
    ie_node: u32,
    seq_count: u32,
    seq_path_start: &[u32],
    seq_path_len: &[u32],
    path_cond_start: &[u32],
    path_cond_len: &[u32],
    cond_fe_node: &[u32],
    cond_route: &[u32],
    initial_seq_tallies: Option<&[u64]>,
    valid_lanes_last_word: u32,
) -> Vec<u64> {
    let mut context = EtGpuContext::<R>::new(
        client,
        pdag,
        plan,
        soa,
        thresholds,
        full_ranges,
        ie_node,
        seq_count,
        seq_path_start,
        seq_path_len,
        path_cond_start,
        path_cond_len,
        cond_fe_node,
        cond_route,
        initial_seq_tallies,
        valid_lanes_last_word,
    );
    context.execute_chunk(t_count, t_start, key);
    context.read_tallies()
}

#[cfg(feature = "gpu")]
pub struct FtGpuContext<R: Runtime> {
    client: ComputeClient<R>,
    uploaded_layers: Vec<UploadedLayer>,
    thresholds_h: Handle,
    full_ranges_h: Handle,
    event_nodes_h: Handle,
    const_nodes_h: Option<Handle>,
    const_values_h: Option<Handle>,
    node_words_lo_h: Handle,
    node_words_hi_h: Handle,
    tally_lo_h: Handle,
    tally_hi_h: Handle,
    thresholds_len: usize,
    full_ranges_len: usize,
    event_nodes_len: usize,
    const_nodes_len: usize,
    const_values_len: usize,
    tally_len: usize,
    b_count: u32,
    p_count: u32,
    num_nodes: u32,
    num_events: u32,
    num_consts: u32,
    const_blocks: u32,
    total_words: usize,
    threads_per_block: u32,
    valid_lanes_last_word: u32,
}

#[cfg(feature = "gpu")]
impl<R: Runtime> FtGpuContext<R> {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        client: &ComputeClient<R>,
        pdag: &Pdag,
        plan: &DpMcPlan,
        soa: &GpuSoaPlan,
        thresholds: &[u32],
        full_ranges: &[u32],
        initial_tallies: Option<&[u64]>,
        valid_lanes_last_word: u32,
    ) -> Self {
        let b_count = plan.params.b as u32;
        let p_count = plan.params.p as u32;
        assert_eq!(soa.layout.b_count, b_count);
        assert_eq!(soa.layout.p_count, p_count);

        let num_nodes = soa.layout.num_nodes;
        let num_events = soa.event_nodes.len() as u32;
        assert_eq!(thresholds.len(), num_events as usize, "thresholds must be per event");
        assert_eq!(full_ranges.len(), num_events as usize, "full_ranges must be per event");

        let total_words = (b_count as usize) * (p_count as usize) * (num_nodes as usize);
        let zeros = vec![0u32; total_words];
        let node_words_lo_h = client.create_from_slice(u32::as_bytes(&zeros));
        let node_words_hi_h = client.create_from_slice(u32::as_bytes(&zeros));

        let event_nodes_u32: Vec<u32> = soa.event_nodes.iter().map(|&n| n.unsigned_abs()).collect();
        let thresholds_h = client.create_from_slice(u32::as_bytes(thresholds));
        let full_ranges_h = client.create_from_slice(u32::as_bytes(full_ranges));
        let event_nodes_h = client.create_from_slice(u32::as_bytes(&event_nodes_u32));

        let threads_per_block = 256u32;

        let mut const_nodes: Vec<u32> = Vec::new();
        let mut const_values: Vec<u32> = Vec::new();
        for layer in &soa.layers {
            for &node in &layer.constants {
                let node = node.abs();
                match pdag.get_node(node) {
                    Some(PdagNode::Constant { value, .. }) => {
                        const_nodes.push(node as u32);
                        const_values.push(if *value { 1u32 } else { 0u32 });
                    }
                    other => panic!("Layer constant node {node} is not a constant: {other:?}"),
                }
            }
        }

        let (const_nodes_h, const_values_h, num_consts, const_blocks, const_nodes_len, const_values_len) =
            if !const_nodes.is_empty() {
                let const_nodes_h = client.create_from_slice(u32::as_bytes(&const_nodes));
                let const_values_h = client.create_from_slice(u32::as_bytes(&const_values));
                let num_consts = const_nodes.len() as u32;
                let total_threads = num_consts * b_count * p_count;
                let blocks = total_threads.div_ceil(threads_per_block);
                (
                    Some(const_nodes_h),
                    Some(const_values_h),
                    num_consts,
                    blocks,
                    const_nodes.len(),
                    const_values.len(),
                )
            } else {
                (None, None, 0u32, 0u32, 0usize, 0usize)
            };

        let uploaded_layers = upload_gate_groups(client, soa);

        let mut tally_lo: Vec<u32> = vec![0u32; num_nodes as usize];
        let mut tally_hi: Vec<u32> = vec![0u32; num_nodes as usize];
        if let Some(init) = initial_tallies {
            assert_eq!(init.len(), num_nodes as usize, "initial_tallies must be per-node");
            for (i, &t) in init.iter().enumerate() {
                tally_lo[i] = (t & 0xFFFF_FFFFu64) as u32;
                tally_hi[i] = (t >> 32) as u32;
            }
        }
        let tally_lo_h = client.create_from_slice(u32::as_bytes(&tally_lo));
        let tally_hi_h = client.create_from_slice(u32::as_bytes(&tally_hi));

        Self {
            client: client.clone(),
            uploaded_layers,
            thresholds_h,
            full_ranges_h,
            event_nodes_h,
            const_nodes_h,
            const_values_h,
            node_words_lo_h,
            node_words_hi_h,
            tally_lo_h,
            tally_hi_h,
            thresholds_len: thresholds.len(),
            full_ranges_len: full_ranges.len(),
            event_nodes_len: event_nodes_u32.len(),
            const_nodes_len,
            const_values_len,
            tally_len: num_nodes as usize,
            b_count,
            p_count,
            num_nodes,
            num_events,
            num_consts,
            const_blocks,
            total_words,
            threads_per_block,
            valid_lanes_last_word,
        }
    }

    pub fn execute_chunk(&mut self, t_count: u32, t_start: u32, key: [u32; 2]) {
        let gate_stream_count = self
            .uploaded_layers
            .iter()
            .map(|layer| layer.gate_groups.len())
            .max()
            .unwrap_or(0)
            .min(8usize);
        let gate_stream_clients = build_gate_stream_clients(&self.client, gate_stream_count);

        for iter in 0..t_count {
            let t_counter = t_start + iter;

            let sample_cube_dim = choose_sample_cube_dim(self.num_events, self.p_count);
            let tally_cube_dim = choose_tally_cube_dim(self.b_count * self.p_count);

            unsafe {
                crate::mc::kernel::dpmc_event::sample_events_bitpacked_to_nodes_kernel::launch_unchecked::<R>(
                    &self.client,
                    cube_count_for_sample_launch(self.num_events, self.p_count, self.b_count, sample_cube_dim),
                    sample_cube_dim,
                    ArrayArg::from_raw_parts::<u32>(&self.thresholds_h, self.thresholds_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.full_ranges_h, self.full_ranges_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.event_nodes_h, self.event_nodes_len, 1),
                    ScalarArg::new(self.num_events),
                    ScalarArg::new(self.num_nodes),
                    ScalarArg::new(self.b_count),
                    ScalarArg::new(self.p_count),
                    ScalarArg::new(t_counter),
                    ScalarArg::new(key[0]),
                    ScalarArg::new(key[1]),
                    ArrayArg::from_raw_parts::<u32>(&self.node_words_lo_h, self.total_words, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.node_words_hi_h, self.total_words, 1),
                )
                .expect("Failed to launch event sampling-to-node kernel");
            }

            if let (Some(const_nodes_h), Some(const_values_h)) = (&self.const_nodes_h, &self.const_values_h) {
                unsafe {
                    crate::mc::kernel::dpmc_node::set_constant_nodes_kernel::launch_unchecked::<R>(
                        &self.client,
                        cube_count_for_1d_blocks(self.const_blocks),
                        CubeDim::new_1d(self.threads_per_block),
                        ArrayArg::from_raw_parts::<u32>(const_nodes_h, self.const_nodes_len, 1),
                        ArrayArg::from_raw_parts::<u32>(const_values_h, self.const_values_len, 1),
                        ScalarArg::new(self.num_consts),
                        ScalarArg::new(self.num_nodes),
                        ScalarArg::new(self.b_count),
                        ScalarArg::new(self.p_count),
                        ArrayArg::from_raw_parts::<u32>(&self.node_words_lo_h, self.total_words, 1),
                        ArrayArg::from_raw_parts::<u32>(&self.node_words_hi_h, self.total_words, 1),
                    )
                    .expect("Failed to launch constant node init kernel");
                }
            }

            let mut prev_layer_markers: Vec<Handle> = Vec::new();
            for layer in &self.uploaded_layers {
                if gate_stream_clients.is_empty() {
                    for group in &layer.gate_groups {
                        unsafe {
                            launch_gate_group::<R>(
                                &self.client,
                                group,
                                self.b_count,
                                self.p_count,
                                self.num_nodes,
                                self.total_words,
                                &self.node_words_lo_h,
                                &self.node_words_hi_h,
                                choose_gate_cube_dim(group.num_gates, self.p_count),
                            );
                        }
                    }
                } else {
                    align_gate_streams_with_markers(&gate_stream_clients, &prev_layer_markers);
                    let mut used_streams = vec![false; gate_stream_clients.len()];
                    for (group_index, group) in layer.gate_groups.iter().enumerate() {
                        let stream_ix = group_index % gate_stream_clients.len();
                        used_streams[stream_ix] = true;
                        let stream_client = &gate_stream_clients[stream_ix];
                        unsafe {
                            launch_gate_group::<R>(
                                stream_client,
                                group,
                                self.b_count,
                                self.p_count,
                                self.num_nodes,
                                self.total_words,
                                &self.node_words_lo_h,
                                &self.node_words_hi_h,
                                choose_gate_cube_dim(group.num_gates, self.p_count),
                            );
                        }
                    }
                    prev_layer_markers =
                        capture_gate_layer_markers(&gate_stream_clients, &used_streams);
                }
            }

            unsafe {
                crate::mc::kernel::dpmc_tally::tally_popcount_per_node_reduced_kernel::launch_unchecked::<R>(
                    &self.client,
                    CubeCount::new_1d(self.num_nodes),
                    tally_cube_dim,
                    ScalarArg::new(self.num_nodes),
                    ScalarArg::new(self.b_count),
                    ScalarArg::new(self.p_count),
                    ScalarArg::new(self.valid_lanes_last_word),
                    ArrayArg::from_raw_parts::<u32>(&self.node_words_lo_h, self.total_words, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.node_words_hi_h, self.total_words, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.tally_lo_h, self.tally_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.tally_hi_h, self.tally_len, 1),
                )
                .expect("Failed to launch DPMC tally kernel");
            }

        }

        if t_count != 0 {
            self.client.flush();
        }
    }

    pub fn read_tallies(&self) -> Vec<u64> {
        let out_lo_bytes = self.client.read_one(self.tally_lo_h.clone());
        let out_hi_bytes = self.client.read_one(self.tally_hi_h.clone());
        let out_lo = u32::from_bytes(&out_lo_bytes).to_vec();
        let out_hi = u32::from_bytes(&out_hi_bytes).to_vec();

        let mut out: Vec<u64> = Vec::with_capacity(self.num_nodes as usize);
        for i in 0..(self.num_nodes as usize) {
            out.push((out_lo[i] as u64) | ((out_hi[i] as u64) << 32));
        }
        out
    }
}

#[cfg(feature = "gpu")]
pub struct EtGpuContext<R: Runtime> {
    client: ComputeClient<R>,
    uploaded_layers: Vec<UploadedLayer>,
    thresholds_h: Handle,
    full_ranges_h: Handle,
    event_nodes_h: Handle,
    const_nodes_h: Option<Handle>,
    const_values_h: Option<Handle>,
    node_words_lo_h: Handle,
    node_words_hi_h: Handle,
    seq_path_start_h: Handle,
    seq_path_len_h: Handle,
    path_cond_start_h: Handle,
    path_cond_len_h: Handle,
    cond_fe_node_h: Handle,
    cond_route_h: Handle,
    seq_words_lo_h: Handle,
    seq_words_hi_h: Handle,
    tally_lo_h: Handle,
    tally_hi_h: Handle,
    thresholds_len: usize,
    full_ranges_len: usize,
    event_nodes_len: usize,
    const_nodes_len: usize,
    const_values_len: usize,
    seq_path_start_len: usize,
    seq_path_len_len: usize,
    path_cond_start_len: usize,
    path_cond_len_len: usize,
    cond_fe_node_len: usize,
    cond_route_len: usize,
    tally_len: usize,
    b_count: u32,
    p_count: u32,
    num_nodes: u32,
    num_events: u32,
    num_consts: u32,
    const_blocks: u32,
    total_words: usize,
    total_seq_words: usize,
    threads_per_block: u32,
    valid_lanes_last_word: u32,
    ie_node: u32,
    seq_count: u32,
}

#[cfg(feature = "gpu")]
impl<R: Runtime> EtGpuContext<R> {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        client: &ComputeClient<R>,
        pdag: &Pdag,
        plan: &DpMcPlan,
        soa: &GpuSoaPlan,
        thresholds: &[u32],
        full_ranges: &[u32],
        ie_node: u32,
        seq_count: u32,
        seq_path_start: &[u32],
        seq_path_len: &[u32],
        path_cond_start: &[u32],
        path_cond_len: &[u32],
        cond_fe_node: &[u32],
        cond_route: &[u32],
        initial_seq_tallies: Option<&[u64]>,
        valid_lanes_last_word: u32,
    ) -> Self {
        let b_count = plan.params.b as u32;
        let p_count = plan.params.p as u32;
        assert_eq!(soa.layout.b_count, b_count);
        assert_eq!(soa.layout.p_count, p_count);

        let num_nodes = soa.layout.num_nodes;

        let num_events = soa.event_nodes.len() as u32;
        assert_eq!(thresholds.len(), num_events as usize, "thresholds must be per event");
        assert_eq!(full_ranges.len(), num_events as usize, "full_ranges must be per event");

        let total_words = (b_count as usize) * (p_count as usize) * (num_nodes as usize);
        let zeros = vec![0u32; total_words];
        let node_words_lo_h = client.create_from_slice(u32::as_bytes(&zeros));
        let node_words_hi_h = client.create_from_slice(u32::as_bytes(&zeros));

        let event_nodes_u32: Vec<u32> = soa.event_nodes.iter().map(|&n| n.unsigned_abs()).collect();
        let thresholds_h = client.create_from_slice(u32::as_bytes(thresholds));
        let full_ranges_h = client.create_from_slice(u32::as_bytes(full_ranges));
        let event_nodes_h = client.create_from_slice(u32::as_bytes(&event_nodes_u32));

        let threads_per_block = 256u32;

        let mut const_nodes: Vec<u32> = Vec::new();
        let mut const_values: Vec<u32> = Vec::new();
        for layer in &soa.layers {
            for &node in &layer.constants {
                let node = node.abs();
                match pdag.get_node(node) {
                    Some(PdagNode::Constant { value, .. }) => {
                        const_nodes.push(node as u32);
                        const_values.push(if *value { 1u32 } else { 0u32 });
                    }
                    other => panic!("Layer constant node {node} is not a constant: {other:?}"),
                }
            }
        }

        let (const_nodes_h, const_values_h, num_consts, const_blocks, const_nodes_len, const_values_len) =
            if !const_nodes.is_empty() {
                let const_nodes_h = client.create_from_slice(u32::as_bytes(&const_nodes));
                let const_values_h = client.create_from_slice(u32::as_bytes(&const_values));
                let num_consts = const_nodes.len() as u32;
                let total_threads = num_consts * b_count * p_count;
                let blocks = total_threads.div_ceil(threads_per_block);
                (
                    Some(const_nodes_h),
                    Some(const_values_h),
                    num_consts,
                    blocks,
                    const_nodes.len(),
                    const_values.len(),
                )
            } else {
                (None, None, 0u32, 0u32, 0usize, 0usize)
            };

        let uploaded_layers = upload_gate_groups(client, soa);

        assert_eq!(seq_path_start.len(), seq_count as usize);
        assert_eq!(seq_path_len.len(), seq_count as usize);
        assert_eq!(path_cond_start.len(), path_cond_len.len());
        assert_eq!(cond_fe_node.len(), cond_route.len());

        let seq_path_start_h = client.create_from_slice(u32::as_bytes(seq_path_start));
        let seq_path_len_h = client.create_from_slice(u32::as_bytes(seq_path_len));
        let path_cond_start_h = client.create_from_slice(u32::as_bytes(path_cond_start));
        let path_cond_len_h = client.create_from_slice(u32::as_bytes(path_cond_len));
        let cond_fe_node_h = client.create_from_slice(u32::as_bytes(cond_fe_node));
        let cond_route_h = client.create_from_slice(u32::as_bytes(cond_route));

        let bp_total = (b_count as usize) * (p_count as usize);
        let total_seq_words = bp_total * (seq_count as usize);
        let zeros_seq = vec![0u32; total_seq_words];
        let seq_words_lo_h = client.create_from_slice(u32::as_bytes(&zeros_seq));
        let seq_words_hi_h = client.create_from_slice(u32::as_bytes(&zeros_seq));

        let mut tally_lo: Vec<u32> = vec![0u32; seq_count as usize];
        let mut tally_hi: Vec<u32> = vec![0u32; seq_count as usize];
        if let Some(init) = initial_seq_tallies {
            assert_eq!(init.len(), seq_count as usize);
            for (i, &v) in init.iter().enumerate() {
                tally_lo[i] = (v & 0xFFFF_FFFFu64) as u32;
                tally_hi[i] = (v >> 32) as u32;
            }
        }
        let tally_lo_h = client.create_from_slice(u32::as_bytes(&tally_lo));
        let tally_hi_h = client.create_from_slice(u32::as_bytes(&tally_hi));

        Self {
            client: client.clone(),
            uploaded_layers,
            thresholds_h,
            full_ranges_h,
            event_nodes_h,
            const_nodes_h,
            const_values_h,
            node_words_lo_h,
            node_words_hi_h,
            seq_path_start_h,
            seq_path_len_h,
            path_cond_start_h,
            path_cond_len_h,
            cond_fe_node_h,
            cond_route_h,
            seq_words_lo_h,
            seq_words_hi_h,
            tally_lo_h,
            tally_hi_h,
            thresholds_len: thresholds.len(),
            full_ranges_len: full_ranges.len(),
            event_nodes_len: event_nodes_u32.len(),
            const_nodes_len,
            const_values_len,
            seq_path_start_len: seq_path_start.len(),
            seq_path_len_len: seq_path_len.len(),
            path_cond_start_len: path_cond_start.len(),
            path_cond_len_len: path_cond_len.len(),
            cond_fe_node_len: cond_fe_node.len(),
            cond_route_len: cond_route.len(),
            tally_len: seq_count as usize,
            b_count,
            p_count,
            num_nodes,
            num_events,
            num_consts,
            const_blocks,
            total_words,
            total_seq_words,
            threads_per_block,
            valid_lanes_last_word,
            ie_node,
            seq_count,
        }
    }

    pub fn execute_chunk(&mut self, t_count: u32, t_start: u32, key: [u32; 2]) {
        let gate_stream_count = self
            .uploaded_layers
            .iter()
            .map(|layer| layer.gate_groups.len())
            .max()
            .unwrap_or(0)
            .min(8usize);
        let gate_stream_clients = build_gate_stream_clients(&self.client, gate_stream_count);

        for iter in 0..t_count {
            let t_counter = t_start + iter;

            let sample_cube_dim = choose_sample_cube_dim(self.num_events, self.p_count);
            let seq_cube_dim = choose_seq_cube_dim(self.seq_count, self.p_count);
            let tally_cube_dim = choose_tally_cube_dim(self.b_count * self.p_count);

            unsafe {
                crate::mc::kernel::dpmc_event::sample_events_bitpacked_to_nodes_kernel::launch_unchecked::<R>(
                    &self.client,
                    cube_count_for_sample_launch(self.num_events, self.p_count, self.b_count, sample_cube_dim),
                    sample_cube_dim,
                    ArrayArg::from_raw_parts::<u32>(&self.thresholds_h, self.thresholds_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.full_ranges_h, self.full_ranges_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.event_nodes_h, self.event_nodes_len, 1),
                    ScalarArg::new(self.num_events),
                    ScalarArg::new(self.num_nodes),
                    ScalarArg::new(self.b_count),
                    ScalarArg::new(self.p_count),
                    ScalarArg::new(t_counter),
                    ScalarArg::new(key[0]),
                    ScalarArg::new(key[1]),
                    ArrayArg::from_raw_parts::<u32>(&self.node_words_lo_h, self.total_words, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.node_words_hi_h, self.total_words, 1),
                )
                .expect("Failed to launch event sampling-to-node kernel");
            }

            if let (Some(const_nodes_h), Some(const_values_h)) = (&self.const_nodes_h, &self.const_values_h) {
                unsafe {
                    crate::mc::kernel::dpmc_node::set_constant_nodes_kernel::launch_unchecked::<R>(
                        &self.client,
                        cube_count_for_1d_blocks(self.const_blocks),
                        CubeDim::new_1d(self.threads_per_block),
                        ArrayArg::from_raw_parts::<u32>(const_nodes_h, self.const_nodes_len, 1),
                        ArrayArg::from_raw_parts::<u32>(const_values_h, self.const_values_len, 1),
                        ScalarArg::new(self.num_consts),
                        ScalarArg::new(self.num_nodes),
                        ScalarArg::new(self.b_count),
                        ScalarArg::new(self.p_count),
                        ArrayArg::from_raw_parts::<u32>(&self.node_words_lo_h, self.total_words, 1),
                        ArrayArg::from_raw_parts::<u32>(&self.node_words_hi_h, self.total_words, 1),
                    )
                    .expect("Failed to launch constant node init kernel");
                }
            }

            let mut prev_layer_markers: Vec<Handle> = Vec::new();
            for layer in &self.uploaded_layers {
                if gate_stream_clients.is_empty() {
                    for group in &layer.gate_groups {
                        unsafe {
                            launch_gate_group::<R>(
                                &self.client,
                                group,
                                self.b_count,
                                self.p_count,
                                self.num_nodes,
                                self.total_words,
                                &self.node_words_lo_h,
                                &self.node_words_hi_h,
                                choose_gate_cube_dim(group.num_gates, self.p_count),
                            );
                        }
                    }
                } else {
                    align_gate_streams_with_markers(&gate_stream_clients, &prev_layer_markers);
                    let mut used_streams = vec![false; gate_stream_clients.len()];
                    for (group_index, group) in layer.gate_groups.iter().enumerate() {
                        let stream_ix = group_index % gate_stream_clients.len();
                        used_streams[stream_ix] = true;
                        let stream_client = &gate_stream_clients[stream_ix];
                        unsafe {
                            launch_gate_group::<R>(
                                stream_client,
                                group,
                                self.b_count,
                                self.p_count,
                                self.num_nodes,
                                self.total_words,
                                &self.node_words_lo_h,
                                &self.node_words_hi_h,
                                choose_gate_cube_dim(group.num_gates, self.p_count),
                            );
                        }
                    }
                    prev_layer_markers =
                        capture_gate_layer_markers(&gate_stream_clients, &used_streams);
                }
            }

            unsafe {
                crate::mc::kernel::event_tree_seq::event_tree_sequence_words_kernel::launch_unchecked::<R>(
                    &self.client,
                    cube_count_for_seq_launch(self.seq_count, self.p_count, self.b_count, seq_cube_dim),
                    seq_cube_dim,
                    ScalarArg::new(self.num_nodes),
                    ScalarArg::new(self.b_count),
                    ScalarArg::new(self.p_count),
                    ScalarArg::new(self.valid_lanes_last_word),
                    ScalarArg::new(self.ie_node),
                    ScalarArg::new(self.seq_count),
                    ArrayArg::from_raw_parts::<u32>(&self.seq_path_start_h, self.seq_path_start_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.seq_path_len_h, self.seq_path_len_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.path_cond_start_h, self.path_cond_start_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.path_cond_len_h, self.path_cond_len_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.cond_fe_node_h, self.cond_fe_node_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.cond_route_h, self.cond_route_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.node_words_lo_h, self.total_words, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.node_words_hi_h, self.total_words, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.seq_words_lo_h, self.total_seq_words, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.seq_words_hi_h, self.total_seq_words, 1),
                )
                .expect("Failed to launch event-tree sequence kernel");
            }

            unsafe {
                crate::mc::kernel::dpmc_tally::tally_popcount_per_node_reduced_kernel::launch_unchecked::<R>(
                    &self.client,
                    CubeCount::new_1d(self.seq_count),
                    tally_cube_dim,
                    ScalarArg::new(self.seq_count),
                    ScalarArg::new(self.b_count),
                    ScalarArg::new(self.p_count),
                    ScalarArg::new(self.valid_lanes_last_word),
                    ArrayArg::from_raw_parts::<u32>(&self.seq_words_lo_h, self.total_seq_words, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.seq_words_hi_h, self.total_seq_words, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.tally_lo_h, self.tally_len, 1),
                    ArrayArg::from_raw_parts::<u32>(&self.tally_hi_h, self.tally_len, 1),
                )
                .expect("Failed to launch sequence tally kernel");
            }

        }

        if t_count != 0 {
            self.client.flush();
        }
    }

    pub fn read_tallies(&self) -> Vec<u64> {
        let out_lo_bytes = self.client.read_one(self.tally_lo_h.clone());
        let out_hi_bytes = self.client.read_one(self.tally_hi_h.clone());
        let out_lo = u32::from_bytes(&out_lo_bytes).to_vec();
        let out_hi = u32::from_bytes(&out_hi_bytes).to_vec();

        let mut out = Vec::with_capacity(self.seq_count as usize);
        for i in 0..(self.seq_count as usize) {
            out.push((out_lo[i] as u64) | ((out_hi[i] as u64) << 32));
        }
        out
    }
}

#[cfg(all(test, feature = "cuda"))]
mod cuda_tests {
    use super::*;
    use crate::algorithms::pdag::{Connective, Pdag};
    use crate::mc::kernel::dpmc_event::cpu_reference_word;
    use crate::mc::packed_gate::eval_gate_word;
    use crate::mc::plan::RunParams;
    use cubecl_cuda::CudaRuntime;

    #[test]
    fn cuda_dpmc_gpu_exec_runs_layers_and_matches_cpu() {
        // Build a small multi-layer PDAG:
        //   e1, e2, e3 are basic events
        //   c1 is a true constant
        //   g4 = AND(e1, e2)
        //   g5 = OR(g4, !e3)
        //   g6 = AtLeast(k=2, [g5, c1, e1])
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("e1".to_string());
        let e2 = pdag.add_basic_event("e2".to_string());
        let e3 = pdag.add_basic_event("e3".to_string());
        let c1 = pdag.add_constant(true);

        let g4 = pdag
            .add_gate("g4".to_string(), Connective::And, vec![e1, e2], None)
            .expect("add g4");
        let g5 = pdag
            .add_gate("g5".to_string(), Connective::Or, vec![g4, -e3], None)
            .expect("add g5");
        let g6 = pdag
            .add_gate(
                "g6".to_string(),
                Connective::AtLeast,
                vec![g5, c1, e1],
                Some(2),
            )
            .expect("add g6");
        pdag.set_root(g6).expect("set root");

        let params = RunParams::new(
            0,  // t (iterations) - we pass t separately
            2,  // B
            3,  // P
            64, // omega
            1234u64,
        );

        let plan = DpMcPlan::from_pdag(&pdag, params).expect("plan");
        let soa = GpuSoaPlan::from_plan(&plan).expect("soa");

        let b_count = plan.params.b as u32;
        let p_count = plan.params.p as u32;
        let t = 1u32;
        let key = [0xDEAD_BEEF, 0x1234_5678];

        // thresholds/full_ranges per event in soa.event_nodes order.
        // Give each event a distinct probability.
        let mut thresholds = Vec::new();
        let mut full_ranges = Vec::new();
        for &node in &soa.event_nodes {
            let node = node.abs();
            let thr = match node {
                n if n == e1.abs() => u32::MAX / 3,
                n if n == e2.abs() => u32::MAX / 2,
                n if n == e3.abs() => u32::MAX / 5,
                _ => 0u32,
            };
            thresholds.push(thr);
            full_ranges.push(0u32);
        }

        let device = <CudaRuntime as Runtime>::Device::default();
        let client = CudaRuntime::client(&device);

        let gpu_words = execute_layers_bitpacked_gpu::<CudaRuntime>(
            &client,
            &pdag,
            &plan,
            &soa,
            &thresholds,
            &full_ranges,
            t,
            key,
        );

        // CPU packed reference, evaluating in layer order.
        let num_nodes = soa.layout.num_nodes as usize;
        let total_words = (b_count as usize) * (p_count as usize) * num_nodes;
        assert_eq!(gpu_words.len(), total_words);

        let mut cpu_words = vec![0u64; total_words];

        // Init events.
        for b in 0..b_count {
            for p in 0..p_count {
                for (event_ord, &node) in soa.event_nodes.iter().enumerate() {
                    let idx = soa.layout.index(b, p, node.unsigned_abs());
                    let thr = thresholds[event_ord];
                    let full = full_ranges[event_ord] != 0u32;
                    cpu_words[idx] = cpu_reference_word(event_ord as u32, p, b, t, key, thr, full);
                }
            }
        }

        // Init constants.
        for layer in &soa.layers {
            for &node in &layer.constants {
                let node = node.abs();
                let value = match pdag.get_node(node) {
                    Some(PdagNode::Constant { value, .. }) => *value,
                    other => panic!("expected constant node {node}, got {other:?}"),
                };
                for b in 0..b_count {
                    for p in 0..p_count {
                        let idx = soa.layout.index(b, p, node.unsigned_abs());
                        cpu_words[idx] = if value { !0u64 } else { 0u64 };
                    }
                }
            }
        }

        // Evaluate gates layer-by-layer.
        for layer in &soa.layers {
            for gates in layer.gate_groups.values() {
                // Each `out_nodes[i]` is a gate node; eval from plan.gates descriptor.
                for &out_node in &gates.out_nodes {
                    let desc = plan.gates.get(&(out_node as i32)).expect("gate desc");

                    for b in 0..b_count {
                        for p in 0..p_count {
                            // Build a per-node slice view for this (b,p).
                            let base = ((b * p_count + p) as usize) * num_nodes;
                            let view = &cpu_words[base..base + num_nodes];
                            let w = eval_gate_word(desc, view);
                            cpu_words[base + out_node as usize] = w;
                        }
                    }
                }
            }
        }

        assert_eq!(gpu_words, cpu_words);
    }

    #[test]
    fn cuda_dpmc_gpu_exec_can_tally_without_node_readback() {
        // Same PDAG as the word-parity test, but validate tallies.
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("e1".to_string());
        let e2 = pdag.add_basic_event("e2".to_string());
        let e3 = pdag.add_basic_event("e3".to_string());
        let c1 = pdag.add_constant(true);

        let g4 = pdag
            .add_gate("g4".to_string(), Connective::And, vec![e1, e2], None)
            .expect("add g4");
        let g5 = pdag
            .add_gate("g5".to_string(), Connective::Or, vec![g4, -e3], None)
            .expect("add g5");
        let g6 = pdag
            .add_gate(
                "g6".to_string(),
                Connective::AtLeast,
                vec![g5, c1, e1],
                Some(2),
            )
            .expect("add g6");
        pdag.set_root(g6).expect("set root");

        let params = RunParams::new(0, 2, 3, 64, 1234u64);
        let plan = DpMcPlan::from_pdag(&pdag, params).expect("plan");
        let soa = GpuSoaPlan::from_plan(&plan).expect("soa");

        let b_count = plan.params.b as u32;
        let p_count = plan.params.p as u32;
        let t = 1u32;
        let key = [0xDEAD_BEEF, 0x1234_5678];

        let mut thresholds = Vec::new();
        let mut full_ranges = Vec::new();
        for &node in &soa.event_nodes {
            let node = node.abs();
            let thr = match node {
                n if n == e1.abs() => u32::MAX / 3,
                n if n == e2.abs() => u32::MAX / 2,
                n if n == e3.abs() => u32::MAX / 5,
                _ => 0u32,
            };
            thresholds.push(thr);
            full_ranges.push(0u32);
        }

        let device = <CudaRuntime as Runtime>::Device::default();
        let client = CudaRuntime::client(&device);

        let gpu_tallies = execute_layers_bitpacked_gpu_tallies::<CudaRuntime>(
            &client,
            &pdag,
            &plan,
            &soa,
            &thresholds,
            &full_ranges,
            t,
            key,
            None,
            0u32,
        );

        // CPU packed reference: compute words then popcount tally per node.
        let num_nodes = soa.layout.num_nodes as usize;
        let total_words = (b_count as usize) * (p_count as usize) * num_nodes;
        let mut cpu_words = vec![0u64; total_words];

        for b in 0..b_count {
            for p in 0..p_count {
                for (event_ord, &node) in soa.event_nodes.iter().enumerate() {
                    let idx = soa.layout.index(b, p, node.unsigned_abs());
                    let thr = thresholds[event_ord];
                    let full = full_ranges[event_ord] != 0u32;
                    cpu_words[idx] = cpu_reference_word(event_ord as u32, p, b, t, key, thr, full);
                }
            }
        }

        for layer in &soa.layers {
            for &node in &layer.constants {
                let node = node.abs();
                let value = match pdag.get_node(node) {
                    Some(PdagNode::Constant { value, .. }) => *value,
                    other => panic!("expected constant node {node}, got {other:?}"),
                };
                for b in 0..b_count {
                    for p in 0..p_count {
                        let idx = soa.layout.index(b, p, node.unsigned_abs());
                        cpu_words[idx] = if value { !0u64 } else { 0u64 };
                    }
                }
            }
        }

        for layer in &soa.layers {
            for gates in layer.gate_groups.values() {
                for &out_node in &gates.out_nodes {
                    let desc = plan.gates.get(&(out_node as i32)).expect("gate desc");
                    for b in 0..b_count {
                        for p in 0..p_count {
                            let base = ((b * p_count + p) as usize) * num_nodes;
                            let view = &cpu_words[base..base + num_nodes];
                            let w = eval_gate_word(desc, view);
                            cpu_words[base + out_node as usize] = w;
                        }
                    }
                }
            }
        }

        let mut cpu_tallies = vec![0u64; num_nodes];
        for b in 0..b_count {
            for p in 0..p_count {
                let base = ((b * p_count + p) as usize) * num_nodes;
                for n in 0..num_nodes {
                    cpu_tallies[n] += cpu_words[base + n].count_ones() as u64;
                }
            }
        }

        assert_eq!(gpu_tallies, cpu_tallies);
    }
}

#[cfg(test)]
mod dependency_tests {
    use crate::algorithms::pdag::{Connective, Pdag, PdagNode};
    use crate::mc::packed_gate::eval_gate_word;
    use crate::mc::plan::{ConnectiveRank, DpMcPlan, RunParams};

    fn exec_cpu_words_within_layer_rank_order(
        plan: &DpMcPlan,
        rank_desc: bool,
        mut node_words: Vec<u64>,
    ) -> Vec<u64> {
        for layer in &plan.layers {
            let mut ranks: Vec<ConnectiveRank> =
                layer.gates_by_connective.keys().copied().collect();
            if rank_desc {
                ranks.sort_by(|a, b| b.cmp(a));
            } else {
                ranks.sort();
            }

            for rank in ranks {
                let gates = layer.gates_by_connective.get(&rank).expect("rank exists");
                for &gate_node in gates {
                    let gate_node_abs = gate_node.abs();
                    let desc = plan.gates.get(&gate_node_abs).expect("gate desc");
                    let w = eval_gate_word(desc, &node_words);
                    node_words[gate_node_abs as usize] = w;
                }
            }
        }
        node_words
    }

    #[test]
    fn within_layer_gate_group_order_is_irrelevant_but_layer_order_matters() {
        // PDAG with two independent gates in the same layer:
        //  g_and = AND(e1, e2)
        //  g_xor = XOR(e3, e4)
        //  root  = OR(g_and, g_xor)
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("e1".to_string());
        let e2 = pdag.add_basic_event("e2".to_string());
        let e3 = pdag.add_basic_event("e3".to_string());
        let e4 = pdag.add_basic_event("e4".to_string());

        let g_and = pdag
            .add_gate("g_and".to_string(), Connective::And, vec![e1, e2], None)
            .expect("add g_and");
        let g_xor = pdag
            .add_gate("g_xor".to_string(), Connective::Xor, vec![e3, e4], None)
            .expect("add g_xor");
        let root = pdag
            .add_gate("root".to_string(), Connective::Or, vec![g_and, g_xor], None)
            .expect("add root");
        pdag.set_root(root).expect("set root");

        let plan = DpMcPlan::from_pdag(&pdag, RunParams::new(1, 1, 1, 64, 0)).expect("plan");

        // Seed node_words so that gate outputs are guaranteed to differ if evaluated out-of-order.
        let num_nodes = plan
            .depths
            .keys()
            .map(|n| n.unsigned_abs() as usize)
            .max()
            .unwrap_or(0)
            + 1;
        let mut base_words = vec![0u64; num_nodes];

        // Events: choose fixed patterns.
        base_words[e1.unsigned_abs() as usize] = !0u64;
        base_words[e2.unsigned_abs() as usize] = !0u64;
        base_words[e3.unsigned_abs() as usize] = 0u64;
        base_words[e4.unsigned_abs() as usize] = 0u64;

        // Any constant nodes should be initialized to their word values.
        for &node in plan.depths.keys() {
            if let Some(PdagNode::Constant { value, .. }) = pdag.get_node(node.abs()) {
                base_words[node.unsigned_abs() as usize] = if *value { !0u64 } else { 0u64 };
            }
        }

        // Two different within-layer group orders must yield identical outputs.
        let asc = exec_cpu_words_within_layer_rank_order(&plan, false, base_words.clone());
        let desc = exec_cpu_words_within_layer_rank_order(&plan, true, base_words.clone());

        assert_eq!(
            asc[root.unsigned_abs() as usize],
            desc[root.unsigned_abs() as usize]
        );
        assert_eq!(
            asc, desc,
            "full node_words should match regardless of within-layer group order"
        );

        // Demonstrate that violating *layer* dependencies changes results (mock scheduler bug).
        // Evaluate root first using its uninitialized operands; it should differ.
        let root_desc = plan.gates.get(&root.abs()).expect("root desc");
        let wrong_root = eval_gate_word(root_desc, &base_words);
        assert_ne!(
            wrong_root,
            asc[root.unsigned_abs() as usize],
            "layer ordering must be enforced"
        );
    }
}
