use std::collections::HashSet;

use tensorbayes::{
    CompileHeuristic, CompiledJunctionTree, EvidenceBatch, ExecutionEngine, UNOBSERVED,
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
    if query_nodes.is_empty() {
        return Err(PraxisError::Bayesian(
            "a Bayesian-network query requires at least one node".to_string(),
        ));
    }

    let graph = network.into_graph()?;
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

    let evidence = EvidenceBatch::new(1, graph.num_variables(), evidence_states)?;
    let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill)?;
    let mut engine = ExecutionEngine::new(tree);
    let results = engine.evaluate_multi(&evidence, &queries)?;

    query_nodes
        .iter()
        .zip(query_states)
        .enumerate()
        .map(|(query_index, (node, states))| {
            let probabilities = results.marginal(0, query_index).ok_or_else(|| {
                PraxisError::Bayesian(format!(
                    "TensorBayes did not return marginal {query_index} for node '{node}'"
                ))
            })?;
            let values = states
                .into_iter()
                .zip(probabilities.iter().copied())
                .map(|(state, probability)| BayesianStateProbability { state, probability })
                .collect();
            Ok(BayesianMarginal {
                node: node.clone(),
                values,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::query_bayesian_network;
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
