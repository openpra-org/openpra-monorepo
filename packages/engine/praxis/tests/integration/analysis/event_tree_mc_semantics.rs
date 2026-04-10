use praxis::core::event_tree::{
    Branch, BranchTarget, EventTree, Fork, FunctionalEvent, InitiatingEvent, Path, Sequence,
};
use praxis::core::model::Model;
use praxis::mc::DpEventTreeMonteCarloAnalysis;

fn p_of(result: &praxis::mc::EventTreeMonteCarloResult, seq_id: &str) -> f64 {
    result
        .sequences
        .iter()
        .find(|s| s.sequence.id == seq_id)
        .unwrap_or_else(|| panic!("missing sequence '{seq_id}'"))
        .probability_estimate
}

#[test]
fn mc_semantics_ie_probability_scales_sequence_partition() {
    // Expected:
    //   P(S_OK)   = P(IE) * P(FE succeeds) = 0.2 * 0.75 = 0.15
    //   P(S_FAIL) = P(IE) * (1 - 0.75)     = 0.2 * 0.25 = 0.05
    //   Total     = 0.20
    let model = Model::new("M").unwrap();

    let ie = InitiatingEvent::new("IE".to_string()).with_probability(0.2);

    let fe = FunctionalEvent::new("FE".to_string()).with_success_probability(0.75);

    let s_ok = Sequence::new("S_OK".to_string());
    let s_fail = Sequence::new("S_FAIL".to_string());

    let ok_branch = Branch::new(BranchTarget::Sequence("S_OK".to_string()));
    let fail_branch = Branch::new(BranchTarget::Sequence("S_FAIL".to_string()));

    let ok_path = Path::new("success".to_string(), ok_branch).unwrap();
    let fail_path = Path::new("failure".to_string(), fail_branch).unwrap();

    let fork = Fork::new("FE".to_string(), vec![ok_path, fail_path]).unwrap();

    let initial = Branch::new(BranchTarget::Fork(fork));
    let mut et = EventTree::new("ET".to_string(), initial);

    et.add_functional_event(fe).unwrap();
    et.add_sequence(s_ok).unwrap();
    et.add_sequence(s_fail).unwrap();

    let analysis = DpEventTreeMonteCarloAnalysis::new(ie, et, &model, Some(7), 100_000).unwrap();
    let result = analysis.run_cpu().unwrap();

    let p_ok = p_of(&result, "S_OK");
    let p_fail = p_of(&result, "S_FAIL");
    let p_total = p_ok + p_fail;

    assert!((p_ok - 0.15).abs() < 0.01, "p_ok={p_ok}");
    assert!((p_fail - 0.05).abs() < 0.01, "p_fail={p_fail}");
    assert!((p_total - 0.20).abs() < 0.01, "p_total={p_total}");
}

#[test]
fn mc_semantics_collect_formula_negation_routes_complements() {
    // collect-formula semantics: negated => complement.
    // Expected partition: P(S_W) = 0.3, P(S_F) = 0.7.
    let model = Model::new("M").unwrap();

    let ie = InitiatingEvent::new("IE".to_string()).with_probability(1.0);
    let fe = FunctionalEvent::new("FE".to_string()).with_success_probability(0.3);

    let s_w = Sequence::new("S_W".to_string());
    let s_f = Sequence::new("S_F".to_string());

    let w_branch = Branch::new(BranchTarget::Sequence("S_W".to_string()));
    let f_branch = Branch::new(BranchTarget::Sequence("S_F".to_string()));

    let w_path = Path::new("W".to_string(), w_branch)
        .unwrap()
        .with_collect_formula_negated(false);
    let f_path = Path::new("F".to_string(), f_branch)
        .unwrap()
        .with_collect_formula_negated(true);

    let fork = Fork::new("FE".to_string(), vec![w_path, f_path]).unwrap();

    let initial = Branch::new(BranchTarget::Fork(fork));
    let mut et = EventTree::new("ET".to_string(), initial);

    et.add_functional_event(fe).unwrap();
    et.add_sequence(s_w).unwrap();
    et.add_sequence(s_f).unwrap();

    let analysis = DpEventTreeMonteCarloAnalysis::new(ie, et, &model, Some(123), 100_000).unwrap();
    let result = analysis.run_cpu().unwrap();

    let p_w = p_of(&result, "S_W");
    let p_f = p_of(&result, "S_F");

    assert!((p_w - 0.3).abs() < 0.01, "p_w={p_w}");
    assert!((p_f - 0.7).abs() < 0.01, "p_f={p_f}");
    assert!(((p_w + p_f) - 1.0).abs() < 0.01);
}

#[test]
fn mc_semantics_house_event_fixes_boolean_fork() {
    // House-event assignment to the fork's FE id fixes traversal.
    let model = Model::new("M").unwrap();

    let ie = InitiatingEvent::new("IE".to_string()).with_probability(1.0);
    let fe = FunctionalEvent::new("FE".to_string()).with_success_probability(0.3);

    let s_true = Sequence::new("S_TRUE".to_string());
    let s_false = Sequence::new("S_FALSE".to_string());

    let true_branch = Branch::new(BranchTarget::Sequence("S_TRUE".to_string()));
    let false_branch = Branch::new(BranchTarget::Sequence("S_FALSE".to_string()));

    let true_path = Path::new("true".to_string(), true_branch).unwrap();
    let false_path = Path::new("false".to_string(), false_branch).unwrap();

    let fork = Fork::new("FE".to_string(), vec![true_path, false_path]).unwrap();

    // Fix FE=true before we reach the fork.
    let initial =
        Branch::new(BranchTarget::Fork(fork)).with_house_event_assignment("FE".to_string(), true);

    let mut et = EventTree::new("ET".to_string(), initial);

    et.add_functional_event(fe).unwrap();
    et.add_sequence(s_true).unwrap();
    et.add_sequence(s_false).unwrap();

    let analysis = DpEventTreeMonteCarloAnalysis::new(ie, et, &model, Some(1), 10_000).unwrap();
    let result = analysis.run_cpu().unwrap();

    let p_true = p_of(&result, "S_TRUE");
    let p_false = p_of(&result, "S_FALSE");

    assert!(p_true > 0.999, "p_true={p_true}");
    assert!(p_false < 0.001, "p_false={p_false}");
}
