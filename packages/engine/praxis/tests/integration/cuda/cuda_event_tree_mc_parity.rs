#![cfg(feature = "cuda")]

use cubecl::prelude::Runtime;
use cubecl_cuda::CudaRuntime;

use praxis::core::event_tree::{
    Branch, BranchTarget, EventTree, Fork, FunctionalEvent, InitiatingEvent, Path, Sequence,
};
use praxis::core::model::Model;
use praxis::mc::plan::RunParams;
use praxis::mc::DpEventTreeMonteCarloAnalysis;

#[test]
fn cuda_event_tree_mc_matches_cpu_bit_for_bit() {
    // Minimal ET with one functional event and two terminal sequences.
    // Uses `collect_formula_negated` so we cover that fork semantics.
    let model = Model::new("").unwrap();

    let seq_ok = Sequence::new("SEQ_OK".to_string());
    let seq_fail = Sequence::new("SEQ_FAIL".to_string());

    let ok_branch = Branch::new(BranchTarget::Sequence(seq_ok.id.clone()));
    let fail_branch = Branch::new(BranchTarget::Sequence(seq_fail.id.clone()));

    let ok_path = Path::new("success".to_string(), ok_branch)
        .unwrap()
        .with_collect_formula_negated(false);
    let fail_path = Path::new("failure".to_string(), fail_branch)
        .unwrap()
        .with_collect_formula_negated(true);

    let fork = Fork::new("FE1".to_string(), vec![ok_path, fail_path]).unwrap();
    let initial = Branch::new(BranchTarget::Fork(fork));

    let mut et = EventTree::new("ET1".to_string(), initial);
    et.add_sequence(seq_ok).unwrap();
    et.add_sequence(seq_fail).unwrap();

    et.add_functional_event(FunctionalEvent::new("FE1".to_string()).with_success_probability(0.30))
        .unwrap();

    let ie = InitiatingEvent::new("IE".to_string())
        .with_probability(1.0)
        .with_frequency(2.0);

    // Use explicit params so CPU/GPU both run the same (t,b,p) layout.
    let params = RunParams::new(3, 2, 2, 64, 123456789);
    let mc = DpEventTreeMonteCarloAnalysis::with_run_params(ie, et, &model, params).unwrap();

    let cpu = mc.run_cpu().unwrap();

    let device = <CudaRuntime as Runtime>::Device::default();
    let gpu = mc.run_gpu::<CudaRuntime>(&device).unwrap();

    assert_eq!(cpu.num_trials, gpu.num_trials);
    assert_eq!(cpu.sequences.len(), gpu.sequences.len());

    for (c, g) in cpu.sequences.iter().zip(gpu.sequences.iter()) {
        assert_eq!(c.sequence.id, g.sequence.id);
        assert_eq!(c.successes, g.successes);
        assert_eq!(c.num_trials, g.num_trials);
        assert_eq!(
            c.probability_estimate.to_bits(),
            g.probability_estimate.to_bits()
        );
        assert_eq!(
            c.frequency_estimate.to_bits(),
            g.frequency_estimate.to_bits()
        );
    }
}
