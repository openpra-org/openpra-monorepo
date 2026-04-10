#![cfg(feature = "cuda")]

use cubecl::prelude::Runtime;
use cubecl_cuda::CudaRuntime;

use praxis::io::parser::parse_event_tree_model;
use praxis::mc::DpEventTreeMonteCarloAnalysis;

use std::collections::HashMap;

#[test]
fn cuda_gas_leak_event_tree_mc_matches_cpu_bit_for_bit() {
    let xml_top = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/gas_leak/gas_leak.xml"
    ));
    let xml_reactive = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/gas_leak/gas_leak_reactive.xml"
    ));

    let (mut model_top, initiating_events_top, event_trees_top) =
        parse_event_tree_model(xml_top).unwrap();
    let (model_reactive, _initiating_events_reactive, event_trees_reactive) =
        parse_event_tree_model(xml_reactive).unwrap();

    // Merge reactive model content into the top-level model.
    for (_id, ft) in model_reactive.fault_trees().iter() {
        model_top.add_fault_tree(ft.clone()).unwrap();
    }
    for (_id, be) in model_reactive.basic_events().iter() {
        model_top.add_basic_event(be.clone()).unwrap();
    }

    // Build an event-tree library across both parses.
    let mut library: HashMap<String, praxis::core::event_tree::EventTree> = HashMap::new();
    for et in event_trees_top.iter().chain(event_trees_reactive.iter()) {
        library.insert(et.id.clone(), et.clone());
    }

    let ie = initiating_events_top[0].clone();
    let et_top = event_trees_top[0].clone();

    // Keep runtime modest; parity is independent of sample size.
    let analysis = DpEventTreeMonteCarloAnalysis::new(ie, et_top, &model_top, Some(123), 25_000)
        .unwrap()
        .with_event_tree_library(&library);

    let cpu = analysis.run_cpu().unwrap();

    let device = <CudaRuntime as Runtime>::Device::default();
    let gpu = analysis.run_gpu::<CudaRuntime>(&device).unwrap();

    assert_eq!(cpu.num_trials, gpu.num_trials);

    let mut cpu_by_id: HashMap<String, (usize, u64)> = HashMap::new();
    for s in &cpu.sequences {
        cpu_by_id.insert(
            s.sequence.id.clone(),
            (s.successes, s.probability_estimate.to_bits()),
        );
    }

    let mut gpu_by_id: HashMap<String, (usize, u64)> = HashMap::new();
    for s in &gpu.sequences {
        gpu_by_id.insert(
            s.sequence.id.clone(),
            (s.successes, s.probability_estimate.to_bits()),
        );
    }

    // Expect S9 from the top-level tree + S1..S8 from the linked reactive tree.
    for id in ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"] {
        let (cpu_s, cpu_p) = cpu_by_id.get(id).copied().unwrap();
        let (gpu_s, gpu_p) = gpu_by_id.get(id).copied().unwrap();
        assert_eq!(cpu_s, gpu_s, "successes mismatch for {id}");
        assert_eq!(cpu_p, gpu_p, "p_hat bits mismatch for {id}");
    }
}
