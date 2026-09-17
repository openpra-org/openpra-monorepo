//! Port of HCL_MH's strict two-block order: BN depth (stable mapping order),
//! then BFS FT-only events. Dependency grouping is disabled.
//! Sources: oracle/bn_path_oracle.py::compute_topological_order,
//! oracle/hcl_integration.py::derive_inter_order_from_yaml and
//! utils/bdd_ordering.py::compute_ft_bfs_order.

use std::collections::{BTreeSet, HashMap, HashSet, VecDeque};

use tensorbayes::{BayesianGraph, NodeId};

use crate::algorithms::bdd_engine::{Bdd, BddRef};
use crate::algorithms::pdag::{NodeIndex, Pdag, PdagNode};
use crate::analysis::width::compute_dfs_metadata_pdag;
use crate::hcl::{HclBindingSpec, HclModel};
use crate::{PraxisError, Result};

/// Mapping order breaks equal-depth ties, exactly as in HCL_MH. The caller
/// validates the network and bindings; this function only supplies BDD order.
fn source_variable_order(
    network: &BayesianGraph,
    bindings: &[HclBindingSpec],
    events: impl IntoIterator<Item = String>,
) -> Vec<String> {
    fn depth(
        network: &BayesianGraph,
        node: NodeId,
        memo: &mut HashMap<NodeId, usize>,
        visiting: &mut HashSet<NodeId>,
    ) -> Option<usize> {
        if let Some(&value) = memo.get(&node) {
            return Some(value);
        }
        if !visiting.insert(node) {
            return None;
        }
        let parents = network.parents(node).unwrap_or(&[]);
        let mut value = 0;
        for &parent in parents {
            value = value.max(1 + depth(network, parent, memo, visiting)?);
        }
        memo.insert(node, value);
        visiting.remove(&node);
        Some(value)
    }

    let mut remaining: BTreeSet<_> = events.into_iter().collect();
    let mut memo = HashMap::new();
    let mut linked: Vec<_> = bindings
        .iter()
        .filter(|b| remaining.contains(&b.event))
        .map(|binding| {
            let value = network
                .node_id(&binding.node)
                .ok()
                .map(|node| depth(network, node, &mut memo, &mut HashSet::new()).unwrap_or(999999))
                .unwrap_or(0);
            (value, binding.event.clone())
        })
        .collect();
    linked.sort_by_key(|(depth, _)| *depth);
    let mut order = Vec::with_capacity(remaining.len());
    for (_, event) in linked {
        remaining.remove(&event);
        order.push(event);
    }
    order.extend(remaining);
    order
}

fn source_bfs_order(
    network: &BayesianGraph,
    bindings: &[HclBindingSpec],
    pdag: &Pdag,
    root: NodeIndex,
    events: impl IntoIterator<Item = String>,
) -> Vec<String> {
    let linked: HashSet<_> = bindings
        .iter()
        .map(|binding| binding.event.as_str())
        .collect();
    let mut order = source_variable_order(network, bindings, events);
    let mut remaining: BTreeSet<_> = order
        .iter()
        .filter(|name| !linked.contains(name.as_str()))
        .cloned()
        .collect();
    order.retain(|name| linked.contains(name.as_str()));
    // The source BFS visits children in stored order and appends unvisited
    // events alphabetically. PDAG references supply the same gate adjacency.
    let mut visited = HashSet::from([root.abs()]);
    let mut queue = VecDeque::from([root.abs()]);
    while let Some(index) = queue.pop_front() {
        match pdag.get_node(index) {
            Some(PdagNode::BasicEvent { id, .. }) => {
                if remaining.remove(id) {
                    order.push(id.clone());
                }
            }
            Some(PdagNode::Gate { operands, .. }) => {
                for child in operands {
                    if visited.insert(child.abs()) {
                        queue.push_back(child.abs());
                    }
                }
            }
            _ => {}
        }
    }
    order.extend(remaining);
    order
}

/// Default application order, supplied to main's unchanged probability API.
pub fn source_fault_tree_order(model: &HclModel) -> Result<Vec<String>> {
    let pdag = Pdag::from_fault_tree(model.fault_tree())?;
    let root = pdag
        .root()
        .ok_or_else(|| PraxisError::Hcl("fault tree has no root".into()))?;
    Ok(source_bfs_order(
        model.network(),
        model.bindings(),
        &pdag,
        root,
        model.fault_tree().basic_events().keys().cloned(),
    ))
}

/// Supplies the source order to the existing PRAXIS BDD builder. Each sequence
/// keeps its own BDD. No end-state union or Boolean algorithm is introduced.
pub(crate) fn build_sequence_bdd(
    pdag: &mut Pdag,
    probabilities: &HashMap<String, f64>,
    root: NodeIndex,
    network: &BayesianGraph,
    bindings: &[HclBindingSpec],
    supplied: Option<&[String]>,
) -> Result<(Vec<NodeIndex>, Bdd, BddRef)> {
    pdag.set_root(root)?;
    let metadata = compute_dfs_metadata_pdag(pdag)?;
    let by_name: HashMap<_, _> = metadata
        .variable_order
        .iter()
        .map(|&index| {
            (
                pdag.get_node(index).unwrap().id().unwrap().to_string(),
                index,
            )
        })
        .collect();
    let names = if let Some(supplied) = supplied {
        let names: Vec<_> = supplied
            .iter()
            .filter(|name| by_name.contains_key(*name))
            .cloned()
            .collect();
        if names.len() != by_name.len() || names.iter().collect::<HashSet<_>>().len() != names.len()
        {
            return Err(PraxisError::Hcl(
                "supplied BDD order must cover every sequence event exactly once".into(),
            ));
        }
        names
    } else {
        source_bfs_order(network, bindings, pdag, root, by_name.keys().cloned())
    };
    let order: Vec<_> = names.iter().map(|name| by_name[name]).collect();
    let var_of = order
        .iter()
        .enumerate()
        .map(|(variable, &node)| (node, variable))
        .collect();
    let probabilities = pdag.level_var_probs_from_map(probabilities, &var_of);
    let (bdd, root) = Bdd::from_pdag_with_order_and_probs(pdag, &var_of, probabilities)?;
    Ok((order, bdd, root))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::pdag::Connective;
    use crate::hcl::{CanonicalBayesianNetwork, CanonicalBayesianVariable};

    #[test]
    fn source_bfs_keeps_linked_prefix_and_sequence_cones() {
        let graph = CanonicalBayesianNetwork {
            id: None,
            variables: vec![CanonicalBayesianVariable {
                name: "LINK".into(),
                states: vec!["F".into(), "T".into()],
                parents: vec![],
                probabilities: vec![0.8, 0.2],
            }],
        }
        .into_graph()
        .unwrap();
        let bindings = vec![HclBindingSpec {
            event: "linked".into(),
            node: "LINK".into(),
            true_states: vec!["T".into()],
        }];
        let mut pdag = Pdag::new();
        let ids: HashMap<_, _> = ["a", "b", "z", "linked", "unused"]
            .into_iter()
            .map(|name| (name, pdag.add_basic_event(name.into())))
            .collect();
        let sub = pdag
            .add_gate(
                "SUB".into(),
                Connective::And,
                vec![ids["a"], ids["b"]],
                None,
            )
            .unwrap();
        let top = pdag
            .add_gate(
                "TOP".into(),
                Connective::Or,
                vec![sub, ids["z"], ids["linked"]],
                None,
            )
            .unwrap();
        // HCL_MH compute_ft_bfs_order visits z before the deeper a/b; the
        // two-block wrapper prepends linked and appends unreachable events.
        assert_eq!(
            source_bfs_order(
                &graph,
                &bindings,
                &pdag,
                top,
                ids.keys().map(|s| s.to_string())
            ),
            ["linked", "z", "a", "b", "unused"]
        );
        let probabilities = ids.keys().map(|s| (s.to_string(), 0.2)).collect();
        let (order, bdd, root) =
            build_sequence_bdd(&mut pdag, &probabilities, top, &graph, &bindings, None).unwrap();
        assert_eq!(order, [ids["linked"], ids["z"], ids["a"], ids["b"]]);
        assert!((bdd.probability(root) - 0.3856).abs() < 1e-12);
        // A global explicit order is filtered to this sequence's reachable events.
        let supplied = ["unused", "b", "linked", "z", "a"].map(String::from);
        let (order, bdd, root) = build_sequence_bdd(
            &mut pdag,
            &probabilities,
            sub,
            &graph,
            &bindings,
            Some(&supplied),
        )
        .unwrap();
        assert_eq!(order, [ids["b"], ids["a"]]);
        assert!((bdd.probability(root) - 0.04).abs() < 1e-12);
        assert!(build_sequence_bdd(
            &mut pdag,
            &probabilities,
            sub,
            &graph,
            &bindings,
            Some(&["b".into()])
        )
        .is_err());
    }

    #[test]
    fn source_depth_order_preserves_mapping_ties_and_unlinked_ancestors() {
        let variables = [
            ("ROOT", vec![]),
            ("B", vec!["ROOT"]),
            ("C", vec!["ROOT"]),
            ("DEEP", vec!["B"]),
        ];
        let graph = CanonicalBayesianNetwork {
            id: None,
            variables: variables
                .into_iter()
                .map(|(name, parents)| CanonicalBayesianVariable {
                    name: name.into(),
                    states: vec!["F".into(), "T".into()],
                    probabilities: vec![0.5; 2 << parents.len()],
                    parents: parents.into_iter().map(String::from).collect(),
                })
                .collect(),
        }
        .into_graph()
        .unwrap();
        let bindings: Vec<_> = ["DEEP", "C", "B", "ROOT"]
            .into_iter()
            .map(|name| HclBindingSpec {
                event: name.into(),
                node: name.into(),
                true_states: vec!["T".into()],
            })
            .collect();
        let events = ["z", "B", "a", "DEEP", "C", "ROOT"].map(String::from);
        assert_eq!(
            source_variable_order(&graph, &bindings, events),
            ["ROOT", "C", "B", "DEEP", "a", "z"]
        );
        let events = ["z", "B", "a", "DEEP", "C"].map(String::from);
        assert_eq!(
            source_variable_order(&graph, &bindings, events),
            ["C", "B", "DEEP", "a", "z"]
        );
    }
}
