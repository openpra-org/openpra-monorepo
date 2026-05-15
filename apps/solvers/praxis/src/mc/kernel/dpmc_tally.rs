//! Blueprint-style DPMC tally kernels (popcount over packed words).
//!
//! This module provides:
//! - a correctness-first kernel (one thread per node)
//! - an optimized kernel (one cube per node) that parallelizes over `(B,P)` and
//!   reduces within shared memory, updating global tallies once per node.

#[cfg(feature = "gpu")]
use cubecl::prelude::*;

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Optimized per-node tally kernel.
///
/// Launch configuration:
/// - 1 cube (block) per node (use `CubeCount::Static(num_nodes, 1, 1)`)
/// - cube_dim chosen by the host, typically a 2D tile over the local `(p,b)` workset
///
/// Each unit in the cube accumulates popcounts for a strided subset of `(B,P)`
/// indices, then a shared-memory tree reduction produces the node sum.
pub fn tally_popcount_per_node_reduced_kernel(
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    valid_lanes_last_word: u32,
    node_words_lo: &Array<u32>,
    node_words_hi: &Array<u32>,
    tally_lo: &mut Array<u32>,
    tally_hi: &mut Array<u32>,
) {
    let node = CUBE_POS as u32;
    if node >= num_nodes {
        terminate!();
    }

    let tid = UNIT_POS_X + UNIT_POS_Y * CUBE_DIM_X + UNIT_POS_Z * (CUBE_DIM_X * CUBE_DIM_Y);

    let bp_total = b_count * p_count;
    let mut local = 0u32;

    // Stride over (b,p) indices.
    let mut bp = tid;
    while bp < bp_total {
        let ix = (bp * num_nodes + node) as usize;
        let mut w_lo = node_words_lo[ix];
        let mut w_hi = node_words_hi[ix];

        // If the host requested a non-full final word (num_trials not divisible by 64),
        // mask off invalid lanes in the last (b,p) word so they don't contribute to tallies.
        if valid_lanes_last_word != 0u32 && bp + 1u32 == bp_total {
            // valid_lanes_last_word is in 1..=63 (0 means full 64).
            if valid_lanes_last_word < 32u32 {
                let lo_mask = (1u32 << valid_lanes_last_word) - 1u32;
                w_lo &= lo_mask;
                w_hi = 0u32;
            } else {
                // valid in 32..=63
                let hi_bits = valid_lanes_last_word - 32u32;
                if hi_bits == 0u32 {
                    w_hi = 0u32;
                } else {
                    // low half fully valid.
                    w_hi &= (1u32 << hi_bits) - 1u32;
                }
            }
        }

        // Inline u32 popcount (Hacker's Delight).
        let mut x = w_lo;
        x = x - ((x >> 1u32) & 0x5555_5555u32);
        x = (x & 0x3333_3333u32) + ((x >> 2u32) & 0x3333_3333u32);
        x = (x + (x >> 4u32)) & 0x0F0F_0F0Fu32;
        x = x + (x >> 8u32);
        x = x + (x >> 16u32);
        local += x & 0x3Fu32;

        let mut y = w_hi;
        y = y - ((y >> 1u32) & 0x5555_5555u32);
        y = (y & 0x3333_3333u32) + ((y >> 2u32) & 0x3333_3333u32);
        y = (y + (y >> 4u32)) & 0x0F0F_0F0Fu32;
        y = y + (y >> 8u32);
        y = y + (y >> 16u32);
        local += y & 0x3Fu32;

        bp += CUBE_DIM;
    }

    // Reduce within the cube.
    let mut smem = SharedMemory::<u32>::new(256usize);
    smem[tid as usize] = local;
    sync_cube();

    // Tree reduction: 256 -> 1.
    if tid < 128u32 {
        smem[tid as usize] = smem[tid as usize] + smem[(tid + 128u32) as usize];
    }
    sync_cube();
    if tid < 64u32 {
        smem[tid as usize] = smem[tid as usize] + smem[(tid + 64u32) as usize];
    }
    sync_cube();
    if tid < 32u32 {
        smem[tid as usize] = smem[tid as usize] + smem[(tid + 32u32) as usize];
    }
    sync_cube();
    if tid < 16u32 {
        smem[tid as usize] = smem[tid as usize] + smem[(tid + 16u32) as usize];
    }
    sync_cube();
    if tid < 8u32 {
        smem[tid as usize] = smem[tid as usize] + smem[(tid + 8u32) as usize];
    }
    sync_cube();
    if tid < 4u32 {
        smem[tid as usize] = smem[tid as usize] + smem[(tid + 4u32) as usize];
    }
    sync_cube();
    if tid < 2u32 {
        smem[tid as usize] = smem[tid as usize] + smem[(tid + 2u32) as usize];
    }
    sync_cube();
    if tid < 1u32 {
        smem[tid as usize] = smem[tid as usize] + smem[(tid + 1u32) as usize];
    }
    sync_cube();

    if tid == 0u32 {
        let sum = smem[0usize];

        let old_lo = tally_lo[node as usize];
        let old_hi = tally_hi[node as usize];
        let new_lo = old_lo + sum;
        let new_hi = if new_lo < old_lo {
            old_hi + 1u32
        } else {
            old_hi
        };
        tally_lo[node as usize] = new_lo;
        tally_hi[node as usize] = new_hi;
    }
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
/// Accumulate per-node tallies by popcounting all words for that node.
///
/// Tallies are stored as two u32 halves to avoid CubeCL u64 lowering edge-cases.
///
/// # Arguments
/// - `num_nodes`: number of nodes
/// - `b_count`/`p_count`: dimensions
/// - `node_words_lo`/`node_words_hi`: `(B,P,node)` packed words split in halves, length `B*P*num_nodes`
/// - `tally_lo`/`tally_hi`: per-node running tallies split in halves, length `num_nodes`
pub fn tally_popcount_per_node_kernel(
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    valid_lanes_last_word: u32,
    node_words_lo: &Array<u32>,
    node_words_hi: &Array<u32>,
    tally_lo: &mut Array<u32>,
    tally_hi: &mut Array<u32>,
) {
    let node = ABSOLUTE_POS as u32;
    if node >= num_nodes {
        terminate!();
    }

    let bp_total = b_count * p_count;
    let mut sum = 0u32;

    for bp in 0u32..bp_total {
        let ix = (bp * num_nodes + node) as usize;
        let mut w_lo = node_words_lo[ix];
        let mut w_hi = node_words_hi[ix];

        if valid_lanes_last_word != 0u32 && bp + 1u32 == bp_total {
            if valid_lanes_last_word < 32u32 {
                let lo_mask = (1u32 << valid_lanes_last_word) - 1u32;
                w_lo &= lo_mask;
                w_hi = 0u32;
            } else {
                let hi_bits = valid_lanes_last_word - 32u32;
                if hi_bits == 0u32 {
                    w_hi = 0u32;
                } else {
                    w_hi &= (1u32 << hi_bits) - 1u32;
                }
            }
        }

        // Inline u32 popcount (Hacker's Delight) to avoid CubeCL call restrictions.
        let mut x = w_lo;
        x = x - ((x >> 1u32) & 0x5555_5555u32);
        x = (x & 0x3333_3333u32) + ((x >> 2u32) & 0x3333_3333u32);
        x = (x + (x >> 4u32)) & 0x0F0F_0F0Fu32;
        x = x + (x >> 8u32);
        x = x + (x >> 16u32);
        sum += x & 0x3Fu32;

        let mut y = w_hi;
        y = y - ((y >> 1u32) & 0x5555_5555u32);
        y = (y & 0x3333_3333u32) + ((y >> 2u32) & 0x3333_3333u32);
        y = (y + (y >> 4u32)) & 0x0F0F_0F0Fu32;
        y = y + (y >> 8u32);
        y = y + (y >> 16u32);
        sum += y & 0x3Fu32;
    }

    // 64-bit add: tally += sum.
    let old_lo = tally_lo[node as usize];
    let old_hi = tally_hi[node as usize];

    let new_lo = old_lo + sum;
    let new_hi = if new_lo < old_lo {
        old_hi + 1u32
    } else {
        old_hi
    };

    tally_lo[node as usize] = new_lo;
    tally_hi[node as usize] = new_hi;
}

#[cfg(feature = "gpu")]
/// Host launcher: popcount tallies for a `(B,P,node)` packed node-word buffer.
///
/// This function uploads `node_words` and an optional initial tally, runs the kernel,
/// then returns the updated tallies.
pub fn tally_popcount_per_node_gpu<R: Runtime>(
    client: &ComputeClient<R>,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    node_words: &[u64],
    initial_tallies: Option<&[u64]>,
    valid_lanes_last_word: u32,
) -> Vec<u64> {
    let total_words = (b_count as usize) * (p_count as usize) * (num_nodes as usize);
    assert_eq!(
        node_words.len(),
        total_words,
        "node_words must be B*P*num_nodes"
    );

    let mut words_lo: Vec<u32> = Vec::with_capacity(node_words.len());
    let mut words_hi: Vec<u32> = Vec::with_capacity(node_words.len());
    for &w in node_words {
        words_lo.push((w & 0xFFFF_FFFFu64) as u32);
        words_hi.push((w >> 32) as u32);
    }

    let node_words_lo_h = client.create_from_slice(u32::as_bytes(&words_lo));
    let node_words_hi_h = client.create_from_slice(u32::as_bytes(&words_hi));

    let mut tally_lo: Vec<u32> = vec![0u32; num_nodes as usize];
    let mut tally_hi: Vec<u32> = vec![0u32; num_nodes as usize];
    if let Some(tallies) = initial_tallies {
        assert_eq!(
            tallies.len(),
            num_nodes as usize,
            "initial_tallies must be per-node"
        );
        for (i, &t) in tallies.iter().enumerate() {
            tally_lo[i] = (t & 0xFFFF_FFFFu64) as u32;
            tally_hi[i] = (t >> 32) as u32;
        }
    }

    let tally_lo_h = client.create_from_slice(u32::as_bytes(&tally_lo));
    let tally_hi_h = client.create_from_slice(u32::as_bytes(&tally_hi));

    let bp_total = b_count * p_count;
    let cube_dim_y = if bp_total > 128 {
        8
    } else if bp_total > 64 {
        4
    } else if bp_total > 32 {
        2
    } else {
        1
    };
    let cube_dim = CubeDim::new_2d(32, cube_dim_y);

    unsafe {
        tally_popcount_per_node_reduced_kernel::launch_unchecked::<R>(
            client,
            CubeCount::new_1d(num_nodes),
            cube_dim,
            ScalarArg::new(num_nodes),
            ScalarArg::new(b_count),
            ScalarArg::new(p_count),
            ScalarArg::new(valid_lanes_last_word),
            ArrayArg::from_raw_parts::<u32>(&node_words_lo_h, words_lo.len(), 1),
            ArrayArg::from_raw_parts::<u32>(&node_words_hi_h, words_hi.len(), 1),
            ArrayArg::from_raw_parts::<u32>(&tally_lo_h, tally_lo.len(), 1),
            ArrayArg::from_raw_parts::<u32>(&tally_hi_h, tally_hi.len(), 1),
        )
        .expect("Failed to launch DPMC tally kernel");
    }

    let out_lo_bytes = client.read_one(tally_lo_h);
    let out_hi_bytes = client.read_one(tally_hi_h);
    let out_lo = u32::from_bytes(&out_lo_bytes).to_vec();
    let out_hi = u32::from_bytes(&out_hi_bytes).to_vec();

    let mut out: Vec<u64> = Vec::with_capacity(num_nodes as usize);
    for i in 0..(num_nodes as usize) {
        out.push((out_lo[i] as u64) | ((out_hi[i] as u64) << 32));
    }
    out
}

#[cfg(test)]
#[allow(dead_code)]
fn cpu_tallies(num_nodes: u32, b_count: u32, p_count: u32, node_words: &[u64]) -> Vec<u64> {
    let total_words = (b_count as usize) * (p_count as usize) * (num_nodes as usize);
    assert_eq!(node_words.len(), total_words);
    let mut out = vec![0u64; num_nodes as usize];

    for b in 0..b_count {
        for p in 0..p_count {
            let bp_base = ((b * p_count + p) * num_nodes) as usize;
            for n in 0..num_nodes {
                let w = node_words[bp_base + (n as usize)];
                out[n as usize] += w.count_ones() as u64;
            }
        }
    }
    out
}

#[cfg(all(test, feature = "cuda"))]
mod cuda_tests {
    use super::*;
    use cubecl_cuda::CudaRuntime;

    #[test]
    fn cuda_dpmc_tally_popcount_matches_cpu() {
        let device = <CudaRuntime as Runtime>::Device::default();
        let client = CudaRuntime::client(&device);

        let num_nodes = 17u32;
        let b_count = 2u32;
        let p_count = 3u32;

        // Deterministic pseudo-random words.
        let total_words = (num_nodes * b_count * p_count) as usize;
        let mut words: Vec<u64> = Vec::with_capacity(total_words);
        let mut x = 0x1234_5678_9ABC_DEF0u64;
        for _ in 0..total_words {
            // LCG-ish.
            x = x.wrapping_mul(6364136223846793005u64).wrapping_add(1);
            words.push(x);
        }

        let cpu0 = cpu_tallies(num_nodes, b_count, p_count, &words);
        let gpu0 = tally_popcount_per_node_gpu::<CudaRuntime>(
            &client, num_nodes, b_count, p_count, &words, None, 0u32,
        );
        assert_eq!(gpu0, cpu0);

        // Accumulation over an existing tally.
        let cpu1: Vec<u64> = cpu0.iter().map(|v| v + 7u64).collect();
        let gpu1 = tally_popcount_per_node_gpu::<CudaRuntime>(
            &client,
            num_nodes,
            b_count,
            p_count,
            &words,
            Some(&vec![7u64; num_nodes as usize]),
            0u32,
        );
        assert_eq!(gpu1, cpu1);
    }
}
