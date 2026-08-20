use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, EvidenceBatch, ExecutionEngine,
    MultiMarginalBatch, NodeId,
};

#[derive(Debug)]
struct Record {
    case: String,
    batch: usize,
    query: usize,
    state: usize,
    value: f64,
}

#[test]
#[ignore = "requires the maintained C++ BNCore source; use verification/run_cpp_equivalence.sh"]
fn matches_maintained_cpp_bncore() {
    let oracle = PathBuf::from(
        std::env::var_os("TENSORBAYES_BNCORE_ORACLE")
            .expect("TENSORBAYES_BNCORE_ORACLE must point to the compiled C++ oracle"),
    );
    let output = Command::new(&oracle)
        .output()
        .expect("failed to execute the C++ BNCore oracle");
    assert!(
        output.status.success(),
        "C++ BNCore oracle failed:\n{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let cpp = parse_records(&String::from_utf8(output.stdout).unwrap());
    let rust = rust_records();
    let squared_separator = rust_squared_separator_records()
        .into_iter()
        .map(|record| {
            (
                (
                    record.case.clone(),
                    record.batch,
                    record.query,
                    record.state,
                ),
                record.value,
            )
        })
        .collect::<HashMap<_, _>>();

    assert_eq!(cpp.len(), rust.len(), "record count differs");
    let mut direct_matches = 0usize;
    let mut known_deviations = 0usize;
    for (index, (cpp, rust)) in cpp.iter().zip(&rust).enumerate() {
        assert_eq!(cpp.case, rust.case, "case differs at record {index}");
        assert_eq!(cpp.batch, rust.batch, "batch differs at record {index}");
        assert_eq!(cpp.query, rust.query, "query differs at record {index}");
        assert_eq!(cpp.state, rust.state, "state differs at record {index}");
        let is_separator_soft = cpp.case == "chain_soft_batched_separator";
        let expected = if is_separator_soft {
            *squared_separator
                .get(&(cpp.case.clone(), cpp.batch, cpp.query, cpp.state))
                .expect("missing squared-likelihood reference record")
        } else {
            rust.value
        };
        let scale = cpp.value.abs().max(expected.abs()).max(1.0);
        let tolerance = 1e-12 * scale;
        assert!(
            (cpp.value - expected).abs() <= tolerance,
            "value differs at record {index} ({}/{}/{}/{}): C++={}, expected={}, tolerance={}",
            cpp.case,
            cpp.batch,
            cpp.query,
            cpp.state,
            cpp.value,
            expected,
            tolerance
        );
        if is_separator_soft {
            if (cpp.value - rust.value).abs() > tolerance {
                known_deviations += 1;
            }
        } else {
            direct_matches += 1;
        }
    }
    assert!(
        known_deviations > 0,
        "the tracked C++ separator soft-evidence defect was not reproduced"
    );
    eprintln!(
        "verified {direct_matches} direct marginal matches across {} cases; tracked {known_deviations} separator-soft differences caused by repeated C++ likelihood application",
        cpp.iter()
            .map(|record| record.case.as_str())
            .collect::<std::collections::BTreeSet<_>>()
            .len()
    );
}

fn parse_records(output: &str) -> Vec<Record> {
    output
        .lines()
        .map(|line| {
            let fields: Vec<&str> = line.split('\t').collect();
            assert_eq!(fields.len(), 5, "invalid C++ oracle record: {line}");
            Record {
                case: fields[0].to_owned(),
                batch: fields[1].parse().unwrap(),
                query: fields[2].parse().unwrap(),
                state: fields[3].parse().unwrap(),
                value: fields[4].parse().unwrap(),
            }
        })
        .collect()
}

fn rust_records() -> Vec<Record> {
    let mut records = Vec::new();

    {
        let (mut engine, nodes) = chain_engine();
        let evidence = EvidenceBatch::new(1, 3, vec![-1, -1, -1]).unwrap();
        collect("chain_prior", &mut engine, &evidence, &nodes, &mut records);
    }
    {
        let (mut engine, nodes) = chain_engine();
        let evidence =
            EvidenceBatch::new(4, 3, vec![-1, -1, -1, -1, -1, 1, -1, 2, -1, 1, -1, 0]).unwrap();
        collect(
            "chain_hard_batch",
            &mut engine,
            &evidence,
            &nodes,
            &mut records,
        );
    }
    {
        let (mut engine, nodes) = chain_engine();
        engine
            .set_soft_evidence(nodes[1], &[0.0, 1.0, 1.0])
            .unwrap();
        engine.set_soft_evidence(nodes[2], &[0.25, 1.5]).unwrap();
        let evidence = EvidenceBatch::new(2, 3, vec![-1, -1, -1, 0, -1, -1]).unwrap();
        collect(
            "chain_soft_shared",
            &mut engine,
            &evidence,
            &[nodes[0], nodes[2]],
            &mut records,
        );
    }
    {
        let (mut engine, nodes) = chain_engine();
        engine
            .set_soft_evidence_batch(nodes[2], 3, &[1.0, 0.2, 0.2, 1.0, 0.5, 0.5])
            .unwrap();
        let evidence = EvidenceBatch::new(3, 3, vec![-1; 9]).unwrap();
        collect(
            "chain_soft_batched_leaf",
            &mut engine,
            &evidence,
            &nodes,
            &mut records,
        );
    }
    {
        let (mut engine, nodes) = chain_engine();
        engine
            .set_soft_evidence_batch(nodes[1], 3, &[1.0, 0.2, 0.1, 0.1, 1.0, 0.1, 0.1, 0.2, 1.0])
            .unwrap();
        let evidence = EvidenceBatch::new(3, 3, vec![-1; 9]).unwrap();
        collect(
            "chain_soft_batched_separator",
            &mut engine,
            &evidence,
            &nodes,
            &mut records,
        );
    }
    {
        let mut graph = BayesianGraph::new();
        let a = graph.add_variable("A", &["false", "true"]).unwrap();
        let b = graph.add_variable("B", &["false", "true"]).unwrap();
        let c = graph.add_variable("C", &["low", "medium", "high"]).unwrap();
        graph.add_edge(a, b).unwrap();
        graph.add_edge(b, c).unwrap();
        graph.set_cpt(a, vec![0.4, 0.6]).unwrap();
        graph
            .set_cpt(
                b,
                vec![0.9, 0.6, 0.2, 0.1, 0.4, 0.8, 0.3, 0.5, 0.7, 0.7, 0.5, 0.3],
            )
            .unwrap();
        graph
            .set_cpt(c, vec![0.5, 0.3, 0.2, 0.1, 0.2, 0.7])
            .unwrap();
        let mut engine = compile(graph);
        let evidence = EvidenceBatch::new(3, 3, vec![-1, -1, -1, -1, 1, -1, -1, -1, 2]).unwrap();
        collect(
            "batched_cpt",
            &mut engine,
            &evidence,
            &[a, b, c],
            &mut records,
        );
    }
    {
        let mut graph = BayesianGraph::new();
        let a = graph.add_variable("A", &["false", "true"]).unwrap();
        let b = graph.add_variable("B", &["false", "true"]).unwrap();
        let c = graph.add_variable("C", &["false", "true"]).unwrap();
        graph.add_edge(b, c).unwrap();
        graph.add_edge(a, c).unwrap();
        graph.set_cpt(a, vec![0.5, 0.5]).unwrap();
        graph.set_cpt(b, vec![0.5, 0.5]).unwrap();
        graph
            .set_cpt(c, vec![0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4])
            .unwrap();
        let mut engine = compile(graph);
        let evidence =
            EvidenceBatch::new(4, 3, vec![0, 0, -1, 1, 0, -1, 0, 1, -1, 1, 1, -1]).unwrap();
        collect("parent_order", &mut engine, &evidence, &[c], &mut records);
    }

    records
}

fn rust_squared_separator_records() -> Vec<Record> {
    let (mut engine, nodes) = chain_engine();
    let likelihoods = [1.0_f64, 0.2, 0.1, 0.1, 1.0, 0.1, 0.1, 0.2, 1.0].map(|value| value * value);
    engine
        .set_soft_evidence_batch(nodes[1], 3, &likelihoods)
        .unwrap();
    let evidence = EvidenceBatch::new(3, 3, vec![-1; 9]).unwrap();
    let mut records = Vec::new();
    collect(
        "chain_soft_batched_separator",
        &mut engine,
        &evidence,
        &nodes,
        &mut records,
    );
    records
}

fn chain_engine() -> (ExecutionEngine, [NodeId; 3]) {
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
    (compile(graph), [a, b, c])
}

fn compile(graph: BayesianGraph) -> ExecutionEngine {
    let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill).unwrap();
    ExecutionEngine::new(tree)
}

fn collect(
    case: &str,
    engine: &mut ExecutionEngine,
    evidence: &EvidenceBatch,
    queries: &[NodeId],
    records: &mut Vec<Record>,
) {
    let result = engine.evaluate_multi(evidence, queries).unwrap();
    append_records(case, queries, &result, records);
}

fn append_records(
    case: &str,
    queries: &[NodeId],
    result: &MultiMarginalBatch,
    records: &mut Vec<Record>,
) {
    for batch in 0..result.batch_size() {
        for (query_index, query) in queries.iter().enumerate() {
            for (state, &value) in result
                .marginal(batch, query_index)
                .unwrap()
                .iter()
                .enumerate()
            {
                records.push(Record {
                    case: case.to_owned(),
                    batch,
                    query: query.index(),
                    state,
                    value,
                });
            }
        }
    }
}
