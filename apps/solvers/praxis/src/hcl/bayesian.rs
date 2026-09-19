use std::collections::HashSet;

use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, EvidenceBatch, ExecutionEngine,
    UNOBSERVED,
};

use crate::hcl::{CanonicalBayesianNetwork, HclEvidenceSpec};
use crate::{PraxisError, Result};

#[derive(Clone, Debug, PartialEq)]
pub struct BayesianStateProbability {
    pub state: String,
    pub probability: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct BayesianMarginal {
    pub node: String,
    pub values: Vec<BayesianStateProbability>,
}

/// Runs exact finite-discrete BN inference through TensorBayes while keeping
/// the process boundary owned by PRAXIS.
pub fn query_bayesian_network(
    network: CanonicalBayesianNetwork,
    evidence: &[HclEvidenceSpec],
    query_nodes: &[String],
) -> Result<Vec<BayesianMarginal>> {
    query_bayesian_network_batch(network, &[evidence.to_vec()], query_nodes)?
        .scenarios
        .remove(0)
}

#[derive(Debug)]
pub struct BayesianBatchResult {
    pub scenarios: Vec<Result<Vec<BayesianMarginal>>>,
    pub junction_tree_compilations: usize,
}

fn evidence_row(graph: &BayesianGraph, evidence: &[HclEvidenceSpec]) -> Result<Vec<i32>> {
    let mut evidence_states = vec![UNOBSERVED; graph.num_variables()];
    let mut observed_nodes = HashSet::with_capacity(evidence.len());
    for observation in evidence {
        let node = graph.node_id(&observation.node)?;
        if !observed_nodes.insert(node) {
            return Err(PraxisError::Bayesian(format!(
                "evidence observes Bayesian node '{}' more than once",
                observation.node
            )));
        }
        let variable = graph.variable(node)?;
        let state = variable
            .states()
            .iter()
            .position(|candidate| candidate == &observation.state)
            .ok_or_else(|| {
                PraxisError::Bayesian(format!(
                    "evidence state '{}' does not exist on Bayesian node '{}'",
                    observation.state, observation.node
                ))
            })?;
        evidence_states[node.index()] = i32::try_from(state).map_err(|_| {
            PraxisError::Bayesian(format!(
                "state index {state} on Bayesian node '{}' cannot be represented",
                observation.node
            ))
        })?;
    }

    Ok(evidence_states)
}

/// Application batching adapter over main's unchanged TensorBayes engine.
/// Compile once and evaluate evidence rows together, preserving per-row errors.
pub fn query_bayesian_network_batch(
    network: CanonicalBayesianNetwork,
    scenarios: &[Vec<HclEvidenceSpec>],
    query_nodes: &[String],
) -> Result<BayesianBatchResult> {
    if scenarios.is_empty() || query_nodes.is_empty() {
        return Err(PraxisError::Bayesian(
            "a Bayesian-network batch requires evidence rows and query nodes".to_string(),
        ));
    }
    let graph = network.into_graph()?;
    let mut unique_queries = HashSet::with_capacity(query_nodes.len());
    let mut queries = Vec::with_capacity(query_nodes.len());
    let mut query_states = Vec::with_capacity(query_nodes.len());
    for name in query_nodes {
        if !unique_queries.insert(name.as_str()) {
            return Err(PraxisError::Bayesian(format!(
                "Bayesian query node '{name}' is duplicated"
            )));
        }
        let node = graph.node_id(name)?;
        queries.push(node);
        query_states.push(graph.variable(node)?.states().to_vec());
    }

    let mut rows = Vec::new();
    let mut indices = Vec::new();
    let mut outcomes = Vec::with_capacity(scenarios.len());
    for (index, scenario) in scenarios.iter().enumerate() {
        match evidence_row(&graph, scenario) {
            Ok(row) => {
                indices.push(index);
                rows.push(row);
                outcomes.push(None);
            }
            Err(error) => outcomes.push(Some(Err(error))),
        }
    }
    let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill)?;
    let mut engine = ExecutionEngine::new(tree);
    while !rows.is_empty() {
        let evidence = EvidenceBatch::from_rows(&rows)?;
        match engine.evaluate_multi(&evidence, &queries) {
            Ok(results) => {
                for (batch, &index) in indices.iter().enumerate() {
                    let mut marginals = Vec::with_capacity(query_nodes.len());
                    for (query_index, (node, states)) in
                        query_nodes.iter().zip(&query_states).enumerate()
                    {
                        let probabilities = results.marginal(batch, query_index).ok_or_else(|| {
                            PraxisError::Bayesian(format!(
                                "TensorBayes did not return marginal {query_index} for node '{node}'"
                            ))
                        })?;
                        marginals.push(BayesianMarginal {
                            node: node.clone(),
                            values: states
                                .iter()
                                .zip(probabilities)
                                .map(|(state, &probability)| BayesianStateProbability {
                                    state: state.clone(),
                                    probability,
                                })
                                .collect(),
                        });
                    }
                    outcomes[index] = Some(Ok(marginals));
                }
                break;
            }
            Err(tensorbayes::Error::ZeroMassEvidence { batch }) => {
                // TensorBayes identifies the offending row. Retry the remaining
                // rows on the same compiled engine; no inference rule is changed.
                let index = indices.remove(batch);
                rows.remove(batch);
                outcomes[index] = Some(Err(
                    tensorbayes::Error::ZeroMassEvidence { batch: index }.into()
                ));
                engine.invalidate_workspace_cache();
            }
            Err(error) => return Err(error.into()),
        }
    }
    Ok(BayesianBatchResult {
        scenarios: outcomes
            .into_iter()
            .map(|outcome| outcome.expect("every scenario has an outcome"))
            .collect(),
        junction_tree_compilations: 1,
    })
}

#[cfg(test)]
mod tests {
    use super::{query_bayesian_network, query_bayesian_network_batch};
    use crate::hcl::{CanonicalBayesianNetwork, CanonicalBayesianVariable, HclEvidenceSpec};

    fn network() -> CanonicalBayesianNetwork {
        CanonicalBayesianNetwork {
            id: Some("two-node".to_string()),
            variables: vec![
                CanonicalBayesianVariable {
                    name: "A".to_string(),
                    states: vec!["false".to_string(), "true".to_string()],
                    parents: vec![],
                    probabilities: vec![0.6, 0.4],
                },
                CanonicalBayesianVariable {
                    name: "B".to_string(),
                    states: vec!["false".to_string(), "true".to_string()],
                    parents: vec!["A".to_string()],
                    probabilities: vec![0.7, 0.3, 0.2, 0.8],
                },
            ],
        }
    }

    #[test]
    fn batch_matches_individual_queries_in_both_orders() {
        let observation = |state: &str| {
            vec![HclEvidenceSpec {
                node: "B".into(),
                state: state.into(),
            }]
        };
        let mut rows = vec![
            vec![],
            observation("true"),
            observation("false"),
            observation("true"),
        ];
        let queries = vec!["B".to_string(), "A".to_string()];
        for _ in 0..2 {
            let batch = query_bayesian_network_batch(network(), &rows, &queries).unwrap();
            assert_eq!(batch.junction_tree_compilations, 1);
            for (row, outcome) in rows.iter().zip(batch.scenarios) {
                let marginals = outcome.unwrap();
                let expected = match row.first().map(|observation| observation.state.as_str()) {
                    None => 0.4,
                    Some("true") => 0.64,
                    Some("false") => 0.16,
                    _ => unreachable!(),
                };
                assert!((marginals[1].values[1].probability - expected).abs() < 1e-12);
                assert_eq!(
                    marginals,
                    query_bayesian_network(network(), row, &queries).unwrap()
                );
            }
            rows.reverse();
        }
    }

    #[test]
    fn batch_isolates_invalid_and_zero_mass_evidence_without_stale_results() {
        let mut model = network();
        model.variables[1].probabilities = vec![1.0, 0.0, 0.0, 1.0];
        let obs = |node: &str, state: &str| HclEvidenceSpec {
            node: node.into(),
            state: state.into(),
        };
        let rows = vec![
            vec![obs("B", "true")],
            vec![obs("A", "false"), obs("B", "true")],
            vec![obs("A", "missing")],
            vec![obs("B", "false")],
            vec![obs("missing", "true")],
            vec![obs("A", "true"), obs("B", "false")],
            vec![obs("A", "true"), obs("A", "true")],
            vec![],
        ];
        let queries = vec!["A".to_string()];
        let batch = query_bayesian_network_batch(model.clone(), &rows, &queries).unwrap();
        assert_eq!(batch.junction_tree_compilations, 1);
        for (index, outcome) in batch.scenarios.into_iter().enumerate() {
            if [0, 3, 7].contains(&index) {
                assert_eq!(
                    outcome.unwrap(),
                    query_bayesian_network(model.clone(), &rows[index], &queries).unwrap()
                );
            } else {
                assert!(outcome.is_err(), "row {index} must fail");
            }
        }
        let all_impossible =
            query_bayesian_network_batch(model, &[rows[1].clone(), rows[5].clone()], &queries)
                .unwrap();
        assert!(all_impossible.scenarios.iter().all(Result::is_err));
    }

    #[test]
    fn rejects_empty_batches_and_invalid_shared_queries() {
        assert!(query_bayesian_network_batch(network(), &[], &["A".into()]).is_err());
        for queries in [vec![], vec!["missing".into()], vec!["A".into(), "A".into()]] {
            assert!(query_bayesian_network_batch(network(), &[vec![]], &queries).is_err());
        }
    }

    #[test]
    fn returns_exact_prior_marginals_in_query_and_state_order() {
        let result =
            query_bayesian_network(network(), &[], &["B".to_string(), "A".to_string()]).unwrap();

        assert_eq!(result[0].node, "B");
        assert!((result[0].values[0].probability - 0.5).abs() < 1e-12);
        assert!((result[0].values[1].probability - 0.5).abs() < 1e-12);
        assert!((result[1].values[0].probability - 0.6).abs() < 1e-12);
        assert!((result[1].values[1].probability - 0.4).abs() < 1e-12);
    }

    #[test]
    fn returns_exact_posteriors_under_hard_evidence() {
        let result = query_bayesian_network(
            network(),
            &[HclEvidenceSpec {
                node: "B".to_string(),
                state: "true".to_string(),
            }],
            &["A".to_string()],
        )
        .unwrap();

        assert!((result[0].values[0].probability - 0.36).abs() < 1e-12);
        assert!((result[0].values[1].probability - 0.64).abs() < 1e-12);
    }
}
