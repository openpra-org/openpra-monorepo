use approx::assert_abs_diff_eq;
use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, Error, EvidenceBatch, ExecutionEngine,
    Factor, NodeId, UNOBSERVED,
};

fn two_node_engine() -> (ExecutionEngine, NodeId, NodeId) {
    let mut graph = BayesianGraph::new();
    let a = graph.add_variable("A", &["false", "true"]).unwrap();
    let b = graph.add_variable("B", &["false", "true"]).unwrap();
    graph.add_edge(a, b).unwrap();
    graph.set_cpt(a, vec![0.6, 0.4]).unwrap();
    // Axes: [A, B].
    graph.set_cpt(b, vec![0.7, 0.3, 0.2, 0.8]).unwrap();
    let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill).unwrap();
    (ExecutionEngine::new(tree), a, b)
}

#[test]
fn factor_multiply_broadcasts_and_marginalizes() {
    let a = NodeId::new(0);
    let b = NodeId::new(1);
    let prior = Factor::from_values(vec![a], vec![2], 1, vec![0.6, 0.4]).unwrap();
    let conditional = Factor::from_values(
        vec![a, b],
        vec![2, 2],
        2,
        vec![0.7, 0.6, 0.3, 0.4, 0.2, 0.1, 0.8, 0.9],
    )
    .unwrap();

    let joint = prior.multiply(&conditional).unwrap();
    assert_eq!(joint.scope(), &[a, b]);
    assert_eq!(joint.batch_size(), 2);
    let marginal = joint.marginalize(&[a]).unwrap();
    assert_abs_diff_eq!(marginal.tensor().values()[0], 0.5, epsilon = 1e-12);
    assert_abs_diff_eq!(marginal.tensor().values()[1], 0.4, epsilon = 1e-12);
    assert_abs_diff_eq!(marginal.tensor().values()[2], 0.5, epsilon = 1e-12);
    assert_abs_diff_eq!(marginal.tensor().values()[3], 0.6, epsilon = 1e-12);
}

#[test]
fn computes_prior_and_hard_evidence_posterior() {
    let (mut engine, a, b) = two_node_engine();
    let no_evidence = EvidenceBatch::unobserved(1, 2).unwrap();
    let b_prior = engine.evaluate(&no_evidence, b).unwrap();
    assert_abs_diff_eq!(b_prior.values()[0], 0.5, epsilon = 1e-12);
    assert_abs_diff_eq!(b_prior.values()[1], 0.5, epsilon = 1e-12);

    let evidence = EvidenceBatch::new(1, 2, vec![UNOBSERVED, 1]).unwrap();
    let posterior = engine.evaluate(&evidence, a).unwrap();
    assert_abs_diff_eq!(posterior.values()[0], 0.36, epsilon = 1e-12);
    assert_abs_diff_eq!(posterior.values()[1], 0.64, epsilon = 1e-12);
}

#[test]
fn calibrates_once_for_multiple_queries_and_rows() {
    let (mut engine, a, b) = two_node_engine();
    let evidence = EvidenceBatch::from_rows(&[vec![UNOBSERVED, 0], vec![UNOBSERVED, 1]]).unwrap();
    let result = engine.evaluate_multi(&evidence, &[a, b]).unwrap();

    assert_eq!(result.offsets(), &[0, 2, 4]);
    assert_abs_diff_eq!(result.marginal(0, 0).unwrap()[0], 0.84, epsilon = 1e-12);
    assert_abs_diff_eq!(result.marginal(0, 0).unwrap()[1], 0.16, epsilon = 1e-12);
    assert_eq!(result.marginal(0, 1).unwrap(), &[1.0, 0.0]);
    assert_abs_diff_eq!(result.marginal(1, 0).unwrap()[0], 0.36, epsilon = 1e-12);
    assert_abs_diff_eq!(result.marginal(1, 0).unwrap()[1], 0.64, epsilon = 1e-12);
    assert_eq!(result.marginal(1, 1).unwrap(), &[0.0, 1.0]);
}

#[test]
fn combines_soft_and_hard_evidence() {
    let (mut engine, a, b) = two_node_engine();
    engine.set_soft_evidence(b, &[0.1, 0.9]).unwrap();
    let no_evidence = EvidenceBatch::unobserved(1, 2).unwrap();
    let posterior = engine.evaluate(&no_evidence, a).unwrap();
    assert_abs_diff_eq!(posterior.values()[0], 0.408, epsilon = 1e-12);
    assert_abs_diff_eq!(posterior.values()[1], 0.592, epsilon = 1e-12);

    let hard = EvidenceBatch::new(1, 2, vec![UNOBSERVED, 0]).unwrap();
    let posterior = engine.evaluate(&hard, a).unwrap();
    assert_abs_diff_eq!(posterior.values()[0], 0.84, epsilon = 1e-12);
    assert_abs_diff_eq!(posterior.values()[1], 0.16, epsilon = 1e-12);
}

#[test]
fn supports_batched_cpts_with_a_final_batch_axis() {
    let mut graph = BayesianGraph::new();
    let a = graph.add_variable("A", &["false", "true"]).unwrap();
    let b = graph.add_variable("B", &["false", "true"]).unwrap();
    graph.add_edge(a, b).unwrap();
    graph.set_cpt(a, vec![0.5, 0.5]).unwrap();
    // Axes: [A, B, batch].
    graph
        .set_cpt(b, vec![0.9, 0.1, 0.1, 0.9, 0.2, 0.8, 0.8, 0.2])
        .unwrap();
    let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill).unwrap();
    let mut engine = ExecutionEngine::new(tree);
    let evidence = EvidenceBatch::unobserved(2, 2).unwrap();
    let result = engine.evaluate(&evidence, b).unwrap();

    assert_eq!(result.row(0).unwrap(), &[0.55, 0.45]);
    assert_eq!(result.row(1).unwrap(), &[0.45, 0.55]);
}

#[test]
fn passes_messages_across_a_multi_clique_chain() {
    let mut graph = BayesianGraph::new();
    let a = graph.add_variable("A", &["false", "true"]).unwrap();
    let b = graph.add_variable("B", &["false", "true"]).unwrap();
    let c = graph.add_variable("C", &["false", "true"]).unwrap();
    graph.add_edge(a, b).unwrap();
    graph.add_edge(b, c).unwrap();
    graph.set_cpt(a, vec![0.5, 0.5]).unwrap();
    graph.set_cpt(b, vec![0.9, 0.1, 0.1, 0.9]).unwrap();
    graph.set_cpt(c, vec![0.8, 0.2, 0.2, 0.8]).unwrap();
    let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill).unwrap();
    assert_eq!(tree.stats().num_cliques, 2);
    let mut engine = ExecutionEngine::new(tree);

    let evidence = EvidenceBatch::new(1, 3, vec![UNOBSERVED, UNOBSERVED, 1]).unwrap();
    let posterior = engine.evaluate(&evidence, a).unwrap();
    assert_abs_diff_eq!(posterior.values()[0], 0.26, epsilon = 1e-12);
    assert_abs_diff_eq!(posterior.values()[1], 0.74, epsilon = 1e-12);
}

#[test]
fn supports_multi_state_set_likelihoods() {
    let mut graph = BayesianGraph::new();
    let weather = graph
        .add_variable("weather", &["sun", "rain", "snow"])
        .unwrap();
    graph.set_cpt(weather, vec![0.5, 0.3, 0.2]).unwrap();
    let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill).unwrap();
    let mut engine = ExecutionEngine::new(tree);
    engine.set_soft_evidence(weather, &[0.0, 1.0, 1.0]).unwrap();
    let evidence = EvidenceBatch::unobserved(1, 1).unwrap();
    let result = engine.evaluate(&evidence, weather).unwrap();
    assert_eq!(result.values()[0], 0.0);
    assert_abs_diff_eq!(result.values()[1], 0.6, epsilon = 1e-12);
    assert_abs_diff_eq!(result.values()[2], 0.4, epsilon = 1e-12);
}

#[test]
fn batched_soft_evidence_is_row_major() {
    let (mut engine, a, b) = two_node_engine();
    engine
        .set_soft_evidence_batch(b, 2, &[1.0, 0.0, 0.0, 1.0])
        .unwrap();
    let evidence = EvidenceBatch::unobserved(2, 2).unwrap();
    let posterior = engine.evaluate(&evidence, a).unwrap();
    assert_abs_diff_eq!(posterior.row(0).unwrap()[0], 0.84, epsilon = 1e-12);
    assert_abs_diff_eq!(posterior.row(0).unwrap()[1], 0.16, epsilon = 1e-12);
    assert_abs_diff_eq!(posterior.row(1).unwrap()[0], 0.36, epsilon = 1e-12);
    assert_abs_diff_eq!(posterior.row(1).unwrap()[1], 0.64, epsilon = 1e-12);
}

#[test]
fn connects_independent_components_with_an_empty_separator() {
    let mut graph = BayesianGraph::new();
    let a = graph.add_variable("A", &["false", "true"]).unwrap();
    let b = graph.add_variable("B", &["false", "true"]).unwrap();
    graph.set_cpt(a, vec![0.7, 0.3]).unwrap();
    graph.set_cpt(b, vec![0.4, 0.6]).unwrap();
    let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill).unwrap();
    assert_eq!(tree.separators().len(), 1);
    assert!(tree.separators()[0].scope().is_empty());
    let mut engine = ExecutionEngine::new(tree);

    let evidence = EvidenceBatch::new(1, 2, vec![UNOBSERVED, 1]).unwrap();
    let posterior = engine.evaluate(&evidence, a).unwrap();
    assert_abs_diff_eq!(posterior.values()[0], 0.7, epsilon = 1e-12);
    assert_abs_diff_eq!(posterior.values()[1], 0.3, epsilon = 1e-12);
}

#[test]
fn reports_zero_mass_evidence() {
    let (mut engine, _a, b) = two_node_engine();
    engine.set_soft_evidence(b, &[0.0, 0.0]).unwrap();
    let evidence = EvidenceBatch::unobserved(1, 2).unwrap();
    assert_eq!(
        engine.evaluate(&evidence, b).unwrap_err(),
        Error::ZeroMassEvidence { batch: 0 }
    );
}

#[test]
fn rejects_cycles_and_non_normalized_cpts() {
    let mut graph = BayesianGraph::new();
    let a = graph.add_variable("A", &["false", "true"]).unwrap();
    let b = graph.add_variable("B", &["false", "true"]).unwrap();
    graph.add_edge(a, b).unwrap();
    assert_eq!(
        graph.add_edge(b, a).unwrap_err(),
        Error::GraphCycle {
            parent: b,
            child: a
        }
    );
    graph.set_cpt(a, vec![0.7, 0.7]).unwrap();
    graph.set_cpt(b, vec![0.5, 0.5, 0.5, 0.5]).unwrap();
    assert!(matches!(
        graph.validate().unwrap_err(),
        Error::CptRowNotNormalized { node, .. } if node == a
    ));
}

#[test]
fn engine_reuses_workspace_without_stale_evidence() {
    let (mut engine, a, _b) = two_node_engine();
    let first = EvidenceBatch::new(1, 2, vec![UNOBSERVED, 0]).unwrap();
    let second = EvidenceBatch::new(1, 2, vec![UNOBSERVED, 1]).unwrap();
    let first_result = engine.evaluate(&first, a).unwrap();
    let second_result = engine.evaluate(&second, a).unwrap();
    assert_abs_diff_eq!(first_result.values()[0], 0.84, epsilon = 1e-12);
    assert_abs_diff_eq!(second_result.values()[0], 0.36, epsilon = 1e-12);
    assert!(engine.workspace().is_calibrated());
}

#[test]
fn preserves_parent_insertion_order_for_every_compile_heuristic() {
    let mut graph = BayesianGraph::new();
    let a = graph.add_variable("A", &["false", "true"]).unwrap();
    let b = graph.add_variable("B", &["false", "true"]).unwrap();
    let c = graph.add_variable("C", &["false", "true"]).unwrap();
    graph.add_edge(b, c).unwrap();
    graph.add_edge(a, c).unwrap();
    graph.set_cpt(a, vec![0.5, 0.5]).unwrap();
    graph.set_cpt(b, vec![0.5, 0.5]).unwrap();
    // Axes are [B, A, C], following edge insertion order. P(C=true) is
    // 0.1, 0.2, 0.3, 0.4 for parent configurations 00, 01, 10, 11.
    graph
        .set_cpt(c, vec![0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4])
        .unwrap();

    for heuristic in [
        CompileHeuristic::MinWeight,
        CompileHeuristic::MinFill,
        CompileHeuristic::MinDegree,
        CompileHeuristic::WeightedMinFill,
    ] {
        let tree = CompiledJunctionTree::compile(graph.clone(), heuristic).unwrap();
        let mut engine = ExecutionEngine::new(tree);
        let evidence = EvidenceBatch::new(1, 3, vec![0, 1, UNOBSERVED]).unwrap();
        let posterior = engine.evaluate(&evidence, c).unwrap();
        assert_abs_diff_eq!(posterior.values()[1], 0.3, epsilon = 1e-12);
    }
}

#[test]
fn applies_separator_soft_evidence_exactly_once() {
    let mut graph = BayesianGraph::new();
    let a = graph.add_variable("A", &["false", "true"]).unwrap();
    let b = graph.add_variable("B", &["low", "medium", "high"]).unwrap();
    let c = graph.add_variable("C", &["false", "true"]).unwrap();
    graph.add_edge(a, b).unwrap();
    graph.add_edge(b, c).unwrap();
    graph.set_cpt(a, vec![0.55, 0.45]).unwrap();
    graph
        .set_cpt(b, vec![0.7, 0.2, 0.1, 0.1, 0.3, 0.6])
        .unwrap();
    graph
        .set_cpt(c, vec![0.95, 0.05, 0.6, 0.4, 0.2, 0.8])
        .unwrap();
    let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill).unwrap();
    assert_eq!(tree.stats().num_cliques, 2);
    let mut engine = ExecutionEngine::new(tree);
    engine.set_soft_evidence(b, &[1.0, 0.2, 0.1]).unwrap();

    let evidence = EvidenceBatch::unobserved(1, 3).unwrap();
    let result = engine.evaluate(&evidence, a).unwrap();
    let weight_a0 = 0.55 * (0.7 * 1.0 + 0.2 * 0.2 + 0.1 * 0.1);
    let weight_a1 = 0.45 * (0.1 * 1.0 + 0.3 * 0.2 + 0.6 * 0.1);
    let expected_a0 = weight_a0 / (weight_a0 + weight_a1);
    assert_abs_diff_eq!(result.values()[0], expected_a0, epsilon = 1e-12);
    assert_abs_diff_eq!(result.values()[1], 1.0 - expected_a0, epsilon = 1e-12);
}
