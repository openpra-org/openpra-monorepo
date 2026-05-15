#[cfg(feature = "cuda")]
use cubecl::prelude::Runtime;
#[cfg(feature = "cuda")]
use cubecl_cuda::CudaRuntime;

#[cfg(feature = "cuda")]
use praxis::algorithms::pdag::{Pdag, PdagNode};
#[cfg(feature = "cuda")]
use praxis::io::parser::parse_fault_tree;
#[cfg(feature = "cuda")]
use praxis::mc::bernoulli::threshold_from_probability;
#[cfg(feature = "cuda")]
use praxis::mc::gpu_exec::execute_layers_bitpacked_gpu_tallies;
#[cfg(feature = "cuda")]
use praxis::mc::gpu_soa::GpuSoaPlan;
#[cfg(feature = "cuda")]
use praxis::mc::packed_gate::eval_gate_word;
#[cfg(feature = "cuda")]
use praxis::mc::plan::{DpMcPlan, RunParams};
#[cfg(feature = "cuda")]
use praxis::mc::preprocess::preprocess_for_mc;
#[cfg(feature = "cuda")]
use std::fs;

#[cfg(feature = "cuda")]
fn cpu_reference_word(
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
        let ctr = praxis::mc::counter::blueprint_counter_with_increment(event, p, b, t, block);
        let out = praxis::mc::philox::philox4x32_10(ctr, key);
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

#[cfg(feature = "cuda")]
fn cpu_reference_words(
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

    let num_nodes = soa.layout.num_nodes as usize;
    let total_words = (b_count as usize) * (p_count as usize) * num_nodes;

    let mut cpu_words = vec![0u64; total_words];

    // Init events (sampler order is soa.event_nodes).
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

    cpu_words
}

#[cfg(feature = "cuda")]
fn cpu_tallies_from_words(b_count: u32, p_count: u32, num_nodes: usize, words: &[u64]) -> Vec<u64> {
    let mut tallies = vec![0u64; num_nodes];
    for b in 0..b_count {
        for p in 0..p_count {
            let base = ((b * p_count + p) as usize) * num_nodes;
            for n in 0..num_nodes {
                tallies[n] += words[base + n].count_ones() as u64;
            }
        }
    }
    tallies
}

#[cfg(feature = "cuda")]
fn thresholds_for_plan_events(
    pdag: &Pdag,
    fault_tree: &praxis::core::fault_tree::FaultTree,
    soa: &GpuSoaPlan,
) -> (Vec<u32>, Vec<u32>) {
    let mut thresholds = Vec::with_capacity(soa.event_nodes.len());
    let mut full_ranges = Vec::with_capacity(soa.event_nodes.len());

    for &node in &soa.event_nodes {
        let node = node.abs();
        let id = match pdag.get_node(node) {
            Some(PdagNode::BasicEvent { id, .. }) => id,
            other => panic!("expected basic event node {node}, got {other:?}"),
        };

        let event = fault_tree
            .basic_events()
            .get(id)
            .unwrap_or_else(|| panic!("basic event '{id}' not found in fault tree"));

        let th = threshold_from_probability(event.probability());
        thresholds.push(th.t);
        full_ranges.push(if th.full_range { 1u32 } else { 0u32 });
    }

    (thresholds, full_ranges)
}

#[cfg(feature = "cuda")]
fn run_fixture_parity(xml_path: &str) {
    let xml = fs::read_to_string(xml_path).unwrap_or_else(|_| panic!("Failed to read {xml_path}"));
    let fault_tree = parse_fault_tree(&xml).expect("parse fault tree");

    let mut pdag = Pdag::from_fault_tree(&fault_tree).expect("pdag from fault tree");
    preprocess_for_mc(&mut pdag).expect("mc preprocess");

    let params = RunParams::new(
        0,  // t is passed separately
        2,  // B
        3,  // P
        64, // omega
        0xC0FFEEu64,
    );

    let plan = DpMcPlan::from_pdag(&pdag, params).expect("plan");
    let soa = GpuSoaPlan::from_plan(&plan).expect("soa");

    let (thresholds, full_ranges) = thresholds_for_plan_events(&pdag, &fault_tree, &soa);

    let t = 1u32;
    let key = [0xDEAD_BEEF, 0x1234_5678];

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

    let b_count = plan.params.b as u32;
    let p_count = plan.params.p as u32;
    let cpu_words = cpu_reference_words(&pdag, &plan, &soa, &thresholds, &full_ranges, t, key);
    let cpu_tallies =
        cpu_tallies_from_words(b_count, p_count, soa.layout.num_nodes as usize, &cpu_words);

    assert_eq!(gpu_tallies, cpu_tallies, "tally mismatch for {xml_path}");

    // Check accumulation.
    let init = vec![7u64; cpu_tallies.len()];
    let gpu_tallies2 = execute_layers_bitpacked_gpu_tallies::<CudaRuntime>(
        &client,
        &pdag,
        &plan,
        &soa,
        &thresholds,
        &full_ranges,
        t,
        key,
        Some(&init),
        0u32,
    );

    let expected2: Vec<u64> = cpu_tallies.iter().map(|v| v + 7u64).collect();
    assert_eq!(
        gpu_tallies2, expected2,
        "accumulated tally mismatch for {xml_path}"
    );
}

#[cfg(feature = "cuda")]
#[test]
fn cuda_dpmc_parity_tallies_and_xml_and_fixture() {
    run_fixture_parity("tests/fixtures/core/and.xml");
}

#[cfg(feature = "cuda")]
#[test]
fn cuda_dpmc_parity_tallies_or_xml_fixture() {
    run_fixture_parity("tests/fixtures/core/or.xml");
}

#[cfg(feature = "cuda")]
#[test]
fn cuda_dpmc_parity_tallies_xor_xml_fixture() {
    run_fixture_parity("tests/fixtures/core/xor.xml");
}

#[cfg(feature = "cuda")]
#[test]
fn cuda_dpmc_parity_tallies_atleast_xml_fixture() {
    run_fixture_parity("tests/fixtures/core/atleast.xml");
}

// Non-CUDA builds should not try to compile/execute these tests.
#[cfg(not(feature = "cuda"))]
#[test]
fn cuda_dpmc_parity_tests_are_gated() {
    // Keep a tiny test so the file participates in the test suite even without CUDA.
    assert!(std::env::current_exe().is_ok());
}
