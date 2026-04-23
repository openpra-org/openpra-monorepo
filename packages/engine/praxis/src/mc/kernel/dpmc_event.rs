#[cfg(feature = "gpu")]
use cubecl::prelude::*;

pub const OMEGA: u32 = 64;

#[cfg(feature = "gpu")]
const PHILOX_M4X32_0: u32 = 0xD251_1F53;
#[cfg(feature = "gpu")]
const PHILOX_M4X32_1: u32 = 0xCD9E_8D57;
#[cfg(feature = "gpu")]
const PHILOX_W32_0: u32 = 0x9E37_79B9;
#[cfg(feature = "gpu")]
const PHILOX_W32_1: u32 = 0xBB67_AE85;

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
pub fn sample_events_bitpacked_kernel(
    thresholds: &Array<u32>,
    full_ranges: &Array<u32>,
    num_events: u32,
    b_count: u32,
    p_count: u32,
    t: u32,
    key0: u32,
    key1: u32,
    out_words_lohi: &mut Array<u32>,
) {
    let event = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;

    if event >= num_events || p >= p_count || b >= b_count {
        terminate!();
    }

    let full = full_ranges[event as usize] != 0u32;
    let thr = thresholds[event as usize];

    let mut word_lo = 0u32;
    let mut word_hi = 0u32;
    if full {
        word_lo = !0u32;
        word_hi = !0u32;
    } else if thr == 0u32 {
        word_lo = 0u32;
        word_hi = 0u32;
    } else {
        let c0_base = event + 1u32;
        let c1_base = b + 1u32;
        let c2_base = p + 1u32;
        let c3_base = (t + 1u32) << 6u32;

        for block in 0u32..16u32 {
            let mut c0 = c0_base;
            let mut c1 = c1_base;
            let mut c2 = c2_base;
            let mut c3 = c3_base + block;

            let mut k0 = key0;
            let mut k1 = key1;

            for round in 0u32..10u32 {
                if round > 0u32 {
                    k0 += PHILOX_W32_0;
                    k1 += PHILOX_W32_1;
                }

                let a0 = PHILOX_M4X32_0;
                let b0 = c0;
                let a0_lo = a0 & 0xFFFFu32;
                let a0_hi = a0 >> 16u32;
                let b0_lo = b0 & 0xFFFFu32;
                let b0_hi = b0 >> 16u32;
                let p00 = a0_lo * b0_lo;
                let p01 = a0_lo * b0_hi;
                let p02 = a0_hi * b0_lo;
                let p03 = a0_hi * b0_hi;
                let carry0 = p00 >> 16u32;
                let mid0 = (p01 & 0xFFFFu32) + (p02 & 0xFFFFu32) + carry0;
                let carry1 = mid0 >> 16u32;
                let lo0 = (p00 & 0xFFFFu32) | ((mid0 & 0xFFFFu32) << 16u32);
                let hi0 = p03 + (p01 >> 16u32) + (p02 >> 16u32) + carry1;

                let a1 = PHILOX_M4X32_1;
                let b1v = c2;
                let a1_lo = a1 & 0xFFFFu32;
                let a1_hi = a1 >> 16u32;
                let b1_lo = b1v & 0xFFFFu32;
                let b1_hi = b1v >> 16u32;
                let p10 = a1_lo * b1_lo;
                let p11 = a1_lo * b1_hi;
                let p12 = a1_hi * b1_lo;
                let p13 = a1_hi * b1_hi;
                let carry0b = p10 >> 16u32;
                let mid1 = (p11 & 0xFFFFu32) + (p12 & 0xFFFFu32) + carry0b;
                let carry1b = mid1 >> 16u32;
                let lo1 = (p10 & 0xFFFFu32) | ((mid1 & 0xFFFFu32) << 16u32);
                let hi1 = p13 + (p11 >> 16u32) + (p12 >> 16u32) + carry1b;

                let n0 = hi1 ^ c1 ^ k0;
                let n1 = lo1;
                let n2 = hi0 ^ c3 ^ k1;
                let n3 = lo0;

                c0 = n0;
                c1 = n1;
                c2 = n2;
                c3 = n3;
            }

            let lane0 = block * 4u32;
            let lane1 = block * 4u32 + 1u32;
            let lane2 = block * 4u32 + 2u32;
            let lane3 = block * 4u32 + 3u32;

            if c0 < thr {
                if lane0 < 32u32 {
                    word_lo |= 1u32 << lane0;
                } else {
                    word_hi |= 1u32 << (lane0 - 32u32);
                }
            }
            if c1 < thr {
                if lane1 < 32u32 {
                    word_lo |= 1u32 << lane1;
                } else {
                    word_hi |= 1u32 << (lane1 - 32u32);
                }
            }
            if c2 < thr {
                if lane2 < 32u32 {
                    word_lo |= 1u32 << lane2;
                } else {
                    word_hi |= 1u32 << (lane2 - 32u32);
                }
            }
            if c3 < thr {
                if lane3 < 32u32 {
                    word_lo |= 1u32 << lane3;
                } else {
                    word_hi |= 1u32 << (lane3 - 32u32);
                }
            }
        }
    }

    let gid = (b * p_count + p) * num_events + event;
    let out_base = (gid as usize) * 2usize;
    out_words_lohi[out_base] = word_lo;
    out_words_lohi[out_base + 1] = word_hi;
}

#[cfg(feature = "gpu")]
#[cube(launch_unchecked)]
pub fn sample_events_bitpacked_to_nodes_kernel(
    thresholds: &Array<u32>,
    full_ranges: &Array<u32>,
    event_nodes: &Array<u32>,
    num_events: u32,
    num_nodes: u32,
    b_count: u32,
    p_count: u32,
    t: u32,
    key0: u32,
    key1: u32,
    node_words_lo: &mut Array<u32>,
    node_words_hi: &mut Array<u32>,
) {
    let event = ABSOLUTE_POS_X;
    let p = ABSOLUTE_POS_Y;
    let b = ABSOLUTE_POS_Z;

    if event >= num_events || p >= p_count || b >= b_count {
        terminate!();
    }

    let full = full_ranges[event as usize] != 0u32;
    let thr = thresholds[event as usize];

    let mut word_lo = 0u32;
    let mut word_hi = 0u32;
    if full {
        word_lo = !0u32;
        word_hi = !0u32;
    } else if thr == 0u32 {
        word_lo = 0u32;
        word_hi = 0u32;
    } else {
        let c0_base = event + 1u32;
        let c1_base = b + 1u32;
        let c2_base = p + 1u32;
        let c3_base = (t + 1u32) << 6u32;

        for block in 0u32..16u32 {
            let mut c0 = c0_base;
            let mut c1 = c1_base;
            let mut c2 = c2_base;
            let mut c3 = c3_base + block;

            let mut k0 = key0;
            let mut k1 = key1;

            for round in 0u32..10u32 {
                if round > 0u32 {
                    k0 += PHILOX_W32_0;
                    k1 += PHILOX_W32_1;
                }

                let a0 = PHILOX_M4X32_0;
                let b0 = c0;
                let a0_lo = a0 & 0xFFFFu32;
                let a0_hi = a0 >> 16u32;
                let b0_lo = b0 & 0xFFFFu32;
                let b0_hi = b0 >> 16u32;
                let p00 = a0_lo * b0_lo;
                let p01 = a0_lo * b0_hi;
                let p02 = a0_hi * b0_lo;
                let p03 = a0_hi * b0_hi;
                let carry0 = p00 >> 16u32;
                let mid0 = (p01 & 0xFFFFu32) + (p02 & 0xFFFFu32) + carry0;
                let carry1 = mid0 >> 16u32;
                let lo0 = (p00 & 0xFFFFu32) | ((mid0 & 0xFFFFu32) << 16u32);
                let hi0 = p03 + (p01 >> 16u32) + (p02 >> 16u32) + carry1;

                let a1 = PHILOX_M4X32_1;
                let b1v = c2;
                let a1_lo = a1 & 0xFFFFu32;
                let a1_hi = a1 >> 16u32;
                let b1_lo = b1v & 0xFFFFu32;
                let b1_hi = b1v >> 16u32;
                let p10 = a1_lo * b1_lo;
                let p11 = a1_lo * b1_hi;
                let p12 = a1_hi * b1_lo;
                let p13 = a1_hi * b1_hi;
                let carry0b = p10 >> 16u32;
                let mid1 = (p11 & 0xFFFFu32) + (p12 & 0xFFFFu32) + carry0b;
                let carry1b = mid1 >> 16u32;
                let lo1 = (p10 & 0xFFFFu32) | ((mid1 & 0xFFFFu32) << 16u32);
                let hi1 = p13 + (p11 >> 16u32) + (p12 >> 16u32) + carry1b;

                let n0 = hi1 ^ c1 ^ k0;
                let n1 = lo1;
                let n2 = hi0 ^ c3 ^ k1;
                let n3 = lo0;

                c0 = n0;
                c1 = n1;
                c2 = n2;
                c3 = n3;
            }

            let lane0 = block * 4u32;
            let lane1 = block * 4u32 + 1u32;
            let lane2 = block * 4u32 + 2u32;
            let lane3 = block * 4u32 + 3u32;

            if c0 < thr {
                if lane0 < 32u32 {
                    word_lo |= 1u32 << lane0;
                } else {
                    word_hi |= 1u32 << (lane0 - 32u32);
                }
            }
            if c1 < thr {
                if lane1 < 32u32 {
                    word_lo |= 1u32 << lane1;
                } else {
                    word_hi |= 1u32 << (lane1 - 32u32);
                }
            }
            if c2 < thr {
                if lane2 < 32u32 {
                    word_lo |= 1u32 << lane2;
                } else {
                    word_hi |= 1u32 << (lane2 - 32u32);
                }
            }
            if c3 < thr {
                if lane3 < 32u32 {
                    word_lo |= 1u32 << lane3;
                } else {
                    word_hi |= 1u32 << (lane3 - 32u32);
                }
            }
        }
    }

    let out_node = event_nodes[event as usize];
    let bp_base = (b * p_count + p) * num_nodes;
    let out_ix = bp_base + out_node;
    node_words_lo[out_ix as usize] = word_lo;
    node_words_hi[out_ix as usize] = word_hi;
}

#[cfg(test)]
pub(crate) fn cpu_reference_word(
    event: u32,
    p: u32,
    b: u32,
    t: u32,
    key: [u32; 2],
    thr: u32,
    full: bool,
) -> u64 {
    if full {
        return !0u64;
    }
    if thr == 0u32 {
        return 0u64;
    }

    let mut word = 0u64;
    for block in 0u32..16u32 {
        let ctr = crate::mc::counter::blueprint_counter_with_increment(event, p, b, t, block);
        let out = crate::mc::philox::philox4x32_10(ctr, key);
        let lanes = [out[0], out[1], out[2], out[3]];
        for j in 0..4u32 {
            let lane = block * 4u32 + j;
            if lanes[j as usize] < thr {
                word |= 1u64 << lane;
            }
        }
    }
    word
}

#[cfg(feature = "gpu")]
pub fn sample_events_bitpacked_gpu<R: Runtime>(
    client: &ComputeClient<R>,
    thresholds: &[u32],
    full_ranges: &[u32],
    b_count: u32,
    p_count: u32,
    t: u32,
    key: [u32; 2],
) -> Vec<u64> {
    let num_events = thresholds.len() as u32;
    assert_eq!(
        full_ranges.len(),
        thresholds.len(),
        "full_ranges must be per-event"
    );

    let total_words = (num_events as usize) * (b_count as usize) * (p_count as usize);

    let thresholds_handle = client.create_from_slice(u32::as_bytes(thresholds));
    let full_ranges_handle = client.create_from_slice(u32::as_bytes(full_ranges));
    let out_handle = client.empty((total_words * 2) * std::mem::size_of::<u32>());

    let cube_dim_x = if num_events >= 32 { 32 } else if num_events >= 16 { 16 } else if num_events >= 8 { 8 } else if num_events >= 4 { 4 } else if num_events >= 2 { 2 } else { 1 };
    let cube_dim_y = p_count.max(1).min((256 / cube_dim_x).max(1).min(8));
    let cube_dim = CubeDim::new_2d(cube_dim_x, cube_dim_y);

    unsafe {
        sample_events_bitpacked_kernel::launch_unchecked::<R>(
            client,
            CubeCount::new_3d(
                num_events.div_ceil(cube_dim.x),
                p_count.div_ceil(cube_dim.y),
                b_count.div_ceil(cube_dim.z),
            ),
            cube_dim,
            ArrayArg::from_raw_parts::<u32>(&thresholds_handle, thresholds.len(), 1),
            ArrayArg::from_raw_parts::<u32>(&full_ranges_handle, full_ranges.len(), 1),
            ScalarArg::new(num_events),
            ScalarArg::new(b_count),
            ScalarArg::new(p_count),
            ScalarArg::new(t),
            ScalarArg::new(key[0]),
            ScalarArg::new(key[1]),
            ArrayArg::from_raw_parts::<u32>(&out_handle, total_words * 2, 1),
        )
        .expect("Failed to launch DPMC bitpacked sampling kernel");
    }

    let out_bytes = client.read_one(out_handle);
    let halves = u32::from_bytes(&out_bytes).to_vec();
    debug_assert_eq!(halves.len(), total_words * 2);
    let mut out = Vec::with_capacity(total_words);
    for i in 0..total_words {
        let lo = halves[2 * i] as u64;
        let hi = halves[2 * i + 1] as u64;
        out.push((hi << 32) | lo);
    }
    out
}

#[cfg(test)]
mod tests {
    #[test]
    fn cpu_reference_word_handles_edge_cases() {
        let key = [0xDEAD_BEEF, 0x1234_5678];
        assert_eq!(super::cpu_reference_word(0, 0, 0, 0, key, 0, false), 0u64);
        assert_eq!(super::cpu_reference_word(0, 0, 0, 0, key, 1, true), !0u64);
    }
}

#[cfg(all(test, feature = "cuda"))]
mod cuda_tests {
    use super::*;
    use cubecl_cuda::CudaRuntime;

    #[test]
    fn cuda_bitpacked_sampling_matches_cpu_reference() {
        let device = <CudaRuntime as Runtime>::Device::default();
        let client = CudaRuntime::client(&device);

        let b_count = 2u32;
        let p_count = 3u32;
        let t = 1u32;
        let key = [0xDEAD_BEEF, 0x1234_5678];

        let thresholds: Vec<u32> = vec![
            0u32,
            u32::MAX / 2,
            u32::MAX,
        ];
        let full_ranges: Vec<u32> = vec![0u32, 0u32, 0u32];

        let gpu = sample_events_bitpacked_gpu::<CudaRuntime>(
            &client,
            &thresholds,
            &full_ranges,
            b_count,
            p_count,
            t,
            key,
        );

        let num_events = thresholds.len() as u32;
        assert_eq!(gpu.len(), (num_events * b_count * p_count) as usize);

        for b in 0..b_count {
            for p in 0..p_count {
                for event in 0..num_events {
                    let idx = ((b * p_count + p) * num_events + event) as usize;
                    let expected = super::cpu_reference_word(
                        event,
                        p,
                        b,
                        t,
                        key,
                        thresholds[event as usize],
                        full_ranges[event as usize] != 0u32,
                    );
                    assert_eq!(gpu[idx], expected, "b={b} p={p} event={event}");
                }
            }
        }
    }

    #[test]
    fn cuda_bitpacked_sampling_respects_full_range_flag() {
        let device = <CudaRuntime as Runtime>::Device::default();
        let client = CudaRuntime::client(&device);

        let b_count = 1u32;
        let p_count = 1u32;
        let t = 0u32;
        let key = [1u32, 2u32];

        let thresholds: Vec<u32> = vec![123u32];
        let full_ranges: Vec<u32> = vec![1u32];

        let gpu = sample_events_bitpacked_gpu::<CudaRuntime>(
            &client,
            &thresholds,
            &full_ranges,
            b_count,
            p_count,
            t,
            key,
        );
        assert_eq!(gpu, vec![!0u64]);
    }
}
