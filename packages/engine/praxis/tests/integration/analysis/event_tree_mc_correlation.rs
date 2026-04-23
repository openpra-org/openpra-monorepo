use praxis::core::event::BasicEvent;
use praxis::core::event_tree::{
    Branch, BranchTarget, EventTree, Fork, FunctionalEvent, InitiatingEvent, Path, Sequence,
};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
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
fn correlation_shared_basic_event_makes_dependent_functional_events() {
    // Two functional events FE1, FE2 reference two different fault trees FT1 and FT2.
    // Both trees have the same top event: a single shared basic event X.
    // With *shared* sampling, FE1 and FE2 outcomes are identical per trial.
    // Therefore P(FE1=true and FE2=true) = P(X) (not P(X)^2).

    let mut model = Model::new("M").unwrap();

    // Shared basic event.
    let x = BasicEvent::new("X".to_string(), 0.2).unwrap();
    model.add_basic_event(x).unwrap();

    // FT1: root = OR(X)
    let mut ft1 = FaultTree::new("FT1", "root").unwrap();
    ft1.add_basic_event(BasicEvent::new("X".to_string(), 0.2).unwrap())
        .unwrap();
    let mut g1 = Gate::new("root".to_string(), Formula::Or).unwrap();
    g1.add_operand("X".to_string());
    ft1.add_gate(g1).unwrap();

    // FT2: root = OR(X)
    let mut ft2 = FaultTree::new("FT2", "root").unwrap();
    ft2.add_basic_event(BasicEvent::new("X".to_string(), 0.2).unwrap())
        .unwrap();
    let mut g2 = Gate::new("root".to_string(), Formula::Or).unwrap();
    g2.add_operand("X".to_string());
    ft2.add_gate(g2).unwrap();

    model.add_fault_tree(ft1).unwrap();
    model.add_fault_tree(ft2).unwrap();

    let ie = InitiatingEvent::new("IE".to_string()).with_probability(1.0);

    let fe1 = FunctionalEvent::new("FE1".to_string()).with_fault_tree("FT1".to_string());
    let fe2 = FunctionalEvent::new("FE2".to_string()).with_fault_tree("FT2".to_string());

    let s_both = Sequence::new("S_BOTH".to_string());
    let s_fe2_fail = Sequence::new("S_FE2_FAIL".to_string());
    let s_fe1_fail = Sequence::new("S_FE1_FAIL".to_string());

    // Second fork (FE2)
    let fe2_success = Path::new(
        "success".to_string(),
        Branch::new(BranchTarget::Sequence("S_BOTH".to_string())),
    )
    .unwrap();
    let fe2_failure = Path::new(
        "failure".to_string(),
        Branch::new(BranchTarget::Sequence("S_FE2_FAIL".to_string())),
    )
    .unwrap();
    let fork2 = Fork::new("FE2".to_string(), vec![fe2_success, fe2_failure]).unwrap();

    // First fork (FE1)
    let fe1_success = Path::new(
        "success".to_string(),
        Branch::new(BranchTarget::Fork(fork2)),
    )
    .unwrap();
    let fe1_failure = Path::new(
        "failure".to_string(),
        Branch::new(BranchTarget::Sequence("S_FE1_FAIL".to_string())),
    )
    .unwrap();
    let fork1 = Fork::new("FE1".to_string(), vec![fe1_success, fe1_failure]).unwrap();

    let initial = Branch::new(BranchTarget::Fork(fork1));
    let mut et = EventTree::new("ET".to_string(), initial);
    et.add_functional_event(fe1).unwrap();
    et.add_functional_event(fe2).unwrap();
    et.add_sequence(s_both).unwrap();
    et.add_sequence(s_fe2_fail).unwrap();
    et.add_sequence(s_fe1_fail).unwrap();

    let analysis = DpEventTreeMonteCarloAnalysis::new(ie, et, &model, Some(999), 100_000).unwrap();
    let result = analysis.run_cpu().unwrap();

    let p_both = p_of(&result, "S_BOTH");
    let p_fe2_fail = p_of(&result, "S_FE2_FAIL");
    let p_fe1_fail = p_of(&result, "S_FE1_FAIL");

    assert!((p_both - 0.2).abs() < 0.01, "p_both={p_both}");
    // If outcomes are identical, FE2 cannot fail given FE1 succeeded.
    assert!(p_fe2_fail < 0.001, "p_fe2_fail={p_fe2_fail}");
    assert!((p_fe1_fail - 0.8).abs() < 0.01, "p_fe1_fail={p_fe1_fail}");
    assert!(((p_both + p_fe2_fail + p_fe1_fail) - 1.0).abs() < 0.01);
}
