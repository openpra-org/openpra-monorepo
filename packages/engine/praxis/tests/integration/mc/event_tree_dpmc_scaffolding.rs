use praxis::io::parser::parse_event_tree_model;
use praxis::mc::DpEventTreeMonteCarloAnalysis;

const FIXTURE: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/eta/EventTrees/linked_fault_trees_shared_be.xml"
));

fn analytic_both_fail(p_a: f64, p_b: f64, p_c: f64) -> f64 {
    p_a + (1.0 - p_a) * p_b * p_c
}

fn naive_independence_product(p_a: f64, p_b: f64, p_c: f64) -> f64 {
    let p_ft1 = 1.0 - (1.0 - p_a) * (1.0 - p_b);
    let p_ft2 = 1.0 - (1.0 - p_a) * (1.0 - p_c);
    p_ft1 * p_ft2
}

#[test]
fn parses_event_tree_structure_and_ft_links() {
    let (model, initiating_events, event_trees) = parse_event_tree_model(FIXTURE).unwrap();

    assert_eq!(initiating_events.len(), 1);
    assert_eq!(event_trees.len(), 1);

    let et = &event_trees[0];

    assert!(et.functional_events.contains_key("FE1"));
    assert!(et.functional_events.contains_key("FE2"));
    assert!(et.sequences.contains_key("BothFail"));
    assert!(et.sequences.contains_key("Other"));

    assert!(model.get_fault_tree("FT1").is_some());
    assert!(model.get_fault_tree("FT2").is_some());
    assert!(model.get_basic_event("A").is_some());
    assert!(model.get_basic_event("B").is_some());
    assert!(model.get_basic_event("C").is_some());
}

#[test]
fn correlation_changes_sequence_probability_vs_independence() {
    let p_a = 0.3;
    let p_b = 0.01;
    let p_c = 0.01;

    let analytic = analytic_both_fail(p_a, p_b, p_c);
    let product = naive_independence_product(p_a, p_b, p_c);

    // Sanity: these should be very different because A is shared.
    assert!((analytic - product).abs() > 0.1);

    let (model, initiating_events, event_trees) = parse_event_tree_model(FIXTURE).unwrap();
    let ie = initiating_events[0].clone();
    let et = event_trees[0].clone();

    // Run ET+linked-FT DPMC and assert the BothFail estimate ~= analytic.
    // - DPMC must sample A once and reuse it across both FT evaluations.
    // - The result must NOT match the naive product approximation.
    let analysis = DpEventTreeMonteCarloAnalysis::new(ie, et, &model, Some(123), 200_000).unwrap();
    let result = analysis.run_cpu().unwrap();

    let both_fail = result
        .sequences
        .iter()
        .find(|s| s.sequence.id == "BothFail")
        .expect("BothFail sequence should be present")
        .probability_estimate;

    assert!(
        (both_fail - analytic).abs() < 0.01,
        "both_fail={both_fail} analytic={analytic}"
    );
    assert!(
        (both_fail - product).abs() > 0.05,
        "both_fail={both_fail} product={product}"
    );
}

#[test]
#[ignore = "Scaffolding: enable once multi-root DPMC is implemented"]
fn multi_root_matches_repeated_single_root_runs_for_fixed_seed() {
    // TODO (future):
    // - Build a plan for both FT roots (FT1.root, FT2.root).
    // - Run once with multi-root tallying and record (s_v, n_v) for both roots.
    // - Run twice with single-root evaluation and assert tallies match exactly.
    unimplemented!("Multi-root DPMC output not implemented yet");
}
