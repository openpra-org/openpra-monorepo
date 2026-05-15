use praxis::io::parser::parse_fault_tree;
use praxis::mc::DpMonteCarloAnalysis;
use std::fs;

#[test]
fn monte_carlo_accepts_unary_or_gate() {
    let xml_path = "tests/fixtures/core/unary_or.xml";
    let xml = fs::read_to_string(xml_path).expect("read unary_or.xml");
    let ft = parse_fault_tree(&xml).expect("parse fault tree");

    // If unary OR is unsupported anywhere in the pipeline (parser/PDAG/plan/kernels),
    // this will typically error during plan construction or execution.
    let mc = DpMonteCarloAnalysis::new(&ft, Some(1), 200_000).expect("build MC analysis");
    let result = mc.run_cpu().expect("run MC");

    // Unary OR should behave like a pass-through of the single operand.
    let expected_p = 0.123_f64;
    let err = (result.probability_estimate - expected_p).abs();

    assert!(
        err < 0.01,
        "unary OR p_hat={} differs from expected {} by {}",
        result.probability_estimate,
        expected_p,
        err
    );
}
