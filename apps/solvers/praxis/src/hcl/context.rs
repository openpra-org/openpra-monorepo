use std::collections::HashMap;
use std::sync::Arc;

use tensorbayes::{BayesianGraph, NodeId};

use crate::algorithms::bdd_engine::{Bdd, BddRef};
use crate::hcl::{HclEventBinding, HclEventBindings};

pub(crate) type PathContext = Arc<[u32]>;

type RelevanceKey = (u32, Box<[u32]>);

const NO_LINKED_EVENTS: u32 = 0;

const UNKNOWN_SUPPORT: u32 = u32::MAX;

const FREE: u8 = 0;
const RESTRICTED: u8 = 1;
const OBSERVED: u8 = 2;

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct Restriction {
    node: u32,
    allowed: Box<[bool]>,
}

pub(crate) struct ContextSpace {
    cardinalities: Vec<usize>,
    parents: Vec<Vec<u32>>,
    children: Vec<Vec<u32>>,
    base: Vec<i32>,
    restrictions: Vec<Restriction>,
    relevance: HashMap<RelevanceKey, Box<[bool]>>,
    restriction_ids: HashMap<Restriction, u32>,
    supports: Vec<Box<[u32]>>,
    support_ids: HashMap<Box<[u32]>, u32>,
    support_unions: HashMap<(u32, u32), u32>,
    node_supports: Vec<u32>,
    empty: PathContext,
}

impl ContextSpace {
    pub(crate) fn new(network: &BayesianGraph, base: &[i32]) -> Self {
        let empty_support: Box<[u32]> = Box::new([]);
        Self {
            cardinalities: network
                .variables()
                .iter()
                .map(|variable| variable.cardinality())
                .collect(),
            parents: adjacency(network, true),
            children: adjacency(network, false),
            base: base.to_vec(),
            restrictions: Vec::new(),
            relevance: HashMap::new(),
            restriction_ids: HashMap::new(),
            supports: vec![empty_support.clone()],
            support_ids: HashMap::from([(empty_support, NO_LINKED_EVENTS)]),
            support_unions: HashMap::new(),
            node_supports: Vec::new(),
            empty: Arc::from(Vec::new()),
        }
    }

    pub(crate) fn empty(&self) -> PathContext {
        Arc::clone(&self.empty)
    }

    pub(crate) fn set_base(&mut self, base: &[i32]) {
        self.base = base.to_vec();
        self.relevance.clear();
    }

    pub(crate) fn node_support(&mut self, node: NodeId) -> u32 {
        self.intern_support(vec![node.index() as u32])
    }

    pub(crate) fn project(&mut self, support: u32, context: &PathContext) -> PathContext {
        if context.is_empty() {
            return Arc::clone(context);
        }
        if support == NO_LINKED_EVENTS {
            return self.empty();
        }
        let signature: Box<[u32]> = context
            .iter()
            .map(|&id| {
                let restriction = &self.restrictions[id as usize];
                let single = restriction.allowed.iter().filter(|&&state| state).count() == 1;
                restriction.node << 1 | u32::from(single)
            })
            .collect();
        let key = (support, signature);
        if !self.relevance.contains_key(&key) {
            let kept = self.requisite(support, &key.1);
            self.relevance.insert(key.clone(), kept);
        }
        let kept = &self.relevance[&key];
        if kept.iter().all(|&keep| keep) {
            return Arc::clone(context);
        }
        context
            .iter()
            .zip(kept.iter())
            .filter(|(_, &keep)| keep)
            .map(|(&id, _)| id)
            .collect()
    }

    fn requisite(&self, support: u32, signature: &[u32]) -> Box<[bool]> {
        let count = self.cardinalities.len();
        let mut kind = vec![FREE; count];
        for (node, &state) in self.base.iter().enumerate() {
            if state >= 0 {
                kind[node] = OBSERVED;
            }
        }
        for &entry in signature {
            kind[(entry >> 1) as usize] = if entry & 1 == 1 { OBSERVED } else { RESTRICTED };
        }
        let mut visited = vec![false; count];
        let mut upward = vec![false; count];
        let mut downward = vec![false; count];
        let mut pending: Vec<(u32, bool)> = self.supports[support as usize]
            .iter()
            .map(|&node| (node, true))
            .collect();
        while let Some((node, from_child)) = pending.pop() {
            let at = node as usize;
            visited[at] = true;
            let to_parents = if from_child {
                kind[at] != OBSERVED
            } else {
                kind[at] != FREE
            };
            if to_parents && !upward[at] {
                upward[at] = true;
                pending.extend(self.parents[at].iter().map(|&parent| (parent, true)));
            }
            if kind[at] != OBSERVED && !downward[at] {
                downward[at] = true;
                pending.extend(self.children[at].iter().map(|&child| (child, false)));
            }
        }
        signature
            .iter()
            .map(|&entry| visited[(entry >> 1) as usize])
            .collect()
    }

    pub(crate) fn restriction(&self, id: u32) -> (NodeId, &[bool]) {
        let restriction = &self.restrictions[id as usize];
        (NodeId::new(restriction.node), &restriction.allowed)
    }

    pub(crate) fn extend(
        &mut self,
        context: &PathContext,
        binding: &HclEventBinding,
        event_occurs: bool,
    ) -> Option<PathContext> {
        let node = binding.bn_node().index();
        let mut allowed = vec![!event_occurs; self.cardinalities[node]];
        for state in binding.true_states() {
            allowed[state.index()] = event_occurs;
        }
        let observed = self.base[node];
        if observed >= 0 {
            return allowed[observed as usize].then(|| Arc::clone(context));
        }
        let position = context
            .iter()
            .position(|&id| self.restrictions[id as usize].node as usize >= node);
        let existing =
            position.filter(|&at| self.restrictions[context[at] as usize].node as usize == node);
        if let Some(at) = existing {
            let previous = &self.restrictions[context[at] as usize].allowed;
            for (state, was_allowed) in allowed.iter_mut().zip(previous.iter()) {
                *state &= *was_allowed;
            }
            if **previous == *allowed {
                return Some(Arc::clone(context));
            }
        }
        if !allowed.iter().any(|&state| state) {
            return None;
        }
        if allowed.iter().all(|&state| state) {
            return Some(Arc::clone(context));
        }
        let id = self.intern_restriction(Restriction {
            node: node as u32,
            allowed: allowed.into_boxed_slice(),
        });
        let mut extended = Vec::with_capacity(context.len() + 1);
        match (existing, position) {
            (Some(at), _) => {
                extended.extend_from_slice(context);
                extended[at] = id;
            }
            (None, Some(at)) => {
                extended.extend_from_slice(&context[..at]);
                extended.push(id);
                extended.extend_from_slice(&context[at..]);
            }
            (None, None) => {
                extended.extend_from_slice(context);
                extended.push(id);
            }
        }
        Some(Arc::from(extended))
    }

    pub(crate) fn support(
        &mut self,
        bdd: &Bdd,
        bindings: &HclEventBindings,
        reference: BddRef,
    ) -> u32 {
        if reference.is_terminal() {
            return NO_LINKED_EVENTS;
        }
        let index = reference.index();
        if let Some(&known) = self.node_supports.get(index) {
            if known != UNKNOWN_SUPPORT {
                return known;
            }
        }
        let node = *bdd.node(reference.regular());
        let high = self.support(bdd, bindings, node.high);
        let low = self.support(bdd, bindings, node.low);
        let mut support = self.union(high, low);
        if let Some(binding) = bindings.get(node.var) {
            let own = self.intern_support(vec![binding.bn_node().index() as u32]);
            support = self.union(support, own);
        }
        if self.node_supports.len() <= index {
            self.node_supports.resize(index + 1, UNKNOWN_SUPPORT);
        }
        self.node_supports[index] = support;
        support
    }

    fn union(&mut self, left: u32, right: u32) -> u32 {
        if left == right || right == NO_LINKED_EVENTS {
            return left;
        }
        if left == NO_LINKED_EVENTS {
            return right;
        }
        let key = (left.min(right), left.max(right));
        if let Some(&known) = self.support_unions.get(&key) {
            return known;
        }
        let mut merged: Vec<u32> = self.supports[left as usize]
            .iter()
            .chain(self.supports[right as usize].iter())
            .copied()
            .collect();
        merged.sort_unstable();
        merged.dedup();
        let id = self.intern_support(merged);
        self.support_unions.insert(key, id);
        id
    }

    fn intern_support(&mut self, nodes: Vec<u32>) -> u32 {
        let nodes = nodes.into_boxed_slice();
        if let Some(&id) = self.support_ids.get(&nodes) {
            return id;
        }
        let id = self.supports.len() as u32;
        self.supports.push(nodes.clone());
        self.support_ids.insert(nodes, id);
        id
    }

    fn intern_restriction(&mut self, restriction: Restriction) -> u32 {
        if let Some(&id) = self.restriction_ids.get(&restriction) {
            return id;
        }
        let id = self.restrictions.len() as u32;
        self.restrictions.push(restriction.clone());
        self.restriction_ids.insert(restriction, id);
        id
    }
}

fn adjacency(network: &BayesianGraph, parents: bool) -> Vec<Vec<u32>> {
    network
        .variables()
        .iter()
        .map(|variable| {
            let nodes = if parents {
                network.parents(variable.id())
            } else {
                network.children(variable.id())
            };
            nodes
                .map(|nodes| nodes.iter().map(|node| node.index() as u32).collect())
                .unwrap_or_default()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use tensorbayes::{StateIndex, UNOBSERVED};

    use super::*;
    use crate::hcl::{CanonicalBayesianNetwork, CanonicalBayesianVariable};

    fn network(nodes: &[(&str, usize, &[&str])]) -> BayesianGraph {
        let cardinality = |name: &str| nodes.iter().find(|node| node.0 == name).unwrap().1;
        CanonicalBayesianNetwork {
            id: None,
            variables: nodes
                .iter()
                .map(|&(name, states, parents)| {
                    let rows: usize = parents.iter().map(|parent| cardinality(parent)).product();
                    CanonicalBayesianVariable {
                        name: name.into(),
                        states: (0..states).map(|state| format!("{name}{state}")).collect(),
                        parents: parents.iter().map(|parent| parent.to_string()).collect(),
                        probabilities: vec![1.0 / states as f64; rows * states],
                    }
                })
                .collect(),
        }
        .into_graph()
        .unwrap()
    }

    fn restrict(
        space: &mut ContextSpace,
        graph: &BayesianGraph,
        context: &PathContext,
        node: &str,
        states: &[usize],
        occurs: bool,
    ) -> Option<PathContext> {
        let binding = HclEventBinding::new(
            0,
            graph.node_id(node).unwrap(),
            states.iter().map(|&state| StateIndex::new(state)).collect(),
        )
        .unwrap();
        space.extend(context, &binding, occurs)
    }

    fn kept(
        space: &mut ContextSpace,
        graph: &BayesianGraph,
        query: &str,
        context: &PathContext,
    ) -> Vec<String> {
        let support = space.node_support(graph.node_id(query).unwrap());
        space
            .project(support, context)
            .iter()
            .map(|&id| {
                graph
                    .variable(space.restriction(id).0)
                    .unwrap()
                    .name()
                    .to_string()
            })
            .collect()
    }

    #[test]
    fn observed_middle_node_blocks_a_chain_and_a_partial_one_does_not() {
        let graph = network(&[("A", 2, &[]), ("B", 3, &["A"]), ("C", 2, &["B"])]);
        let free = vec![UNOBSERVED; 3];
        let mut space = ContextSpace::new(&graph, &free);
        let start = space.empty();
        let a = restrict(&mut space, &graph, &start, "A", &[1], true).unwrap();
        let exact = restrict(&mut space, &graph, &a, "B", &[2], true).unwrap();
        assert_eq!(kept(&mut space, &graph, "C", &exact), ["B"]);
        let partial = restrict(&mut space, &graph, &a, "B", &[2], false).unwrap();
        assert_eq!(kept(&mut space, &graph, "C", &partial), ["A", "B"]);
        assert_eq!(kept(&mut space, &graph, "A", &exact), ["A"]);
    }

    #[test]
    fn common_effect_links_its_causes_only_when_it_or_a_descendant_is_restricted() {
        let graph = network(&[
            ("A", 2, &[]),
            ("B", 2, &[]),
            ("C", 2, &["A", "B"]),
            ("D", 2, &["C"]),
        ]);
        let free = vec![UNOBSERVED; 4];
        let mut space = ContextSpace::new(&graph, &free);
        let start = space.empty();
        let b = restrict(&mut space, &graph, &start, "B", &[1], true).unwrap();
        assert!(kept(&mut space, &graph, "A", &b).is_empty());
        let with_effect = restrict(&mut space, &graph, &b, "C", &[1], true).unwrap();
        assert_eq!(kept(&mut space, &graph, "A", &with_effect), ["B", "C"]);
        let with_descendant = restrict(&mut space, &graph, &b, "D", &[0], true).unwrap();
        assert_eq!(kept(&mut space, &graph, "A", &with_descendant), ["B", "D"]);
    }

    #[test]
    fn base_evidence_blocks_and_is_never_part_of_the_path_context() {
        let graph = network(&[("A", 2, &[]), ("B", 2, &["A"]), ("C", 2, &["B"])]);
        let mut base = vec![UNOBSERVED; 3];
        base[1] = 0;
        let mut space = ContextSpace::new(&graph, &base);
        let start = space.empty();
        let a = restrict(&mut space, &graph, &start, "A", &[1], true).unwrap();
        assert!(kept(&mut space, &graph, "C", &a).is_empty());
        assert!(restrict(&mut space, &graph, &a, "B", &[1], true).is_none());
        let same = restrict(&mut space, &graph, &a, "B", &[1], false).unwrap();
        assert_eq!(same, a);
        space.set_base(&[UNOBSERVED; 3]);
        assert_eq!(kept(&mut space, &graph, "C", &a), ["A"]);
    }

    #[test]
    fn repeated_restrictions_of_one_node_intersect() {
        let graph = network(&[("A", 3, &[])]);
        let free = vec![UNOBSERVED; 1];
        let mut space = ContextSpace::new(&graph, &free);
        let start = space.empty();
        let not_zero = restrict(&mut space, &graph, &start, "A", &[0], false).unwrap();
        let two = restrict(&mut space, &graph, &not_zero, "A", &[1], false).unwrap();
        assert_eq!(space.restriction(two[0]).1, [false, false, true]);
        assert_eq!(two.len(), 1);
        assert!(restrict(&mut space, &graph, &two, "A", &[2], false).is_none());
        let again = restrict(&mut space, &graph, &two, "A", &[2], true).unwrap();
        assert_eq!(again, two);
    }
}
