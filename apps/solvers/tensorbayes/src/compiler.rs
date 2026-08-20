use crate::junction_tree::{clique, separator};
use crate::{BayesianGraph, CompiledJunctionTree, Error, JunctionTreeStats, NodeId, Result};
use std::cmp::Reverse;
use std::collections::BTreeSet;

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum CompileHeuristic {
    MinWeight,
    #[default]
    MinFill,
    MinDegree,
    WeightedMinFill,
}

pub(crate) fn compile(
    graph: BayesianGraph,
    heuristic: CompileHeuristic,
) -> Result<CompiledJunctionTree> {
    if graph.num_variables() == 0 {
        return Err(Error::EmptyGraph);
    }
    graph.validate()?;

    let mut adjacency = moralize(&graph)?;
    let mut eliminated = vec![false; graph.num_variables()];
    let mut candidate_cliques = Vec::with_capacity(graph.num_variables());

    for _ in 0..graph.num_variables() {
        let node = select_next(&graph, &adjacency, &eliminated, heuristic)?;
        let active_neighbors: Vec<NodeId> = adjacency[node.index()]
            .iter()
            .copied()
            .filter(|neighbor| !eliminated[neighbor.index()])
            .collect();

        let mut scope = active_neighbors.clone();
        scope.push(node);
        scope.sort_unstable();
        candidate_cliques.push(scope);

        for left in 0..active_neighbors.len() {
            for right in left + 1..active_neighbors.len() {
                let a = active_neighbors[left];
                let b = active_neighbors[right];
                adjacency[a.index()].insert(b);
                adjacency[b.index()].insert(a);
            }
        }
        eliminated[node.index()] = true;
    }

    candidate_cliques.sort_by_key(|scope| (Reverse(scope.len()), scope.clone()));
    let mut maximal_scopes: Vec<Vec<NodeId>> = Vec::new();
    for scope in candidate_cliques {
        if !maximal_scopes
            .iter()
            .any(|maximal| is_sorted_subset(&scope, maximal))
        {
            maximal_scopes.push(scope);
        }
    }

    let clique_count = maximal_scopes.len();
    let mut assigned = vec![Vec::new(); clique_count];
    for variable in graph.variables() {
        let family = graph.family_scope(variable.id())?;
        let Some(clique_id) = maximal_scopes
            .iter()
            .position(|scope| family.iter().all(|node| scope.contains(node)))
        else {
            return Err(Error::CptAssignmentFailure(variable.id()));
        };
        assigned[clique_id].push(variable.id());
    }

    let tree_edges = maximum_spanning_tree(&maximal_scopes);
    let mut neighbors = vec![Vec::new(); clique_count];
    let mut separators = Vec::with_capacity(clique_count.saturating_sub(1));
    let mut separator_by_edge = vec![vec![None; clique_count]; clique_count];
    for (left, right, scope) in tree_edges {
        let separator_id = separators.len();
        neighbors[left].push(right);
        neighbors[right].push(left);
        separator_by_edge[left][right] = Some(separator_id);
        separator_by_edge[right][left] = Some(separator_id);
        separators.push(separator(left, right, scope));
    }
    for adjacent in &mut neighbors {
        adjacent.sort_unstable();
    }

    let mut cliques = Vec::with_capacity(clique_count);
    for (id, scope) in maximal_scopes.into_iter().enumerate() {
        cliques.push(clique(
            id,
            scope,
            std::mem::take(&mut assigned[id]),
            std::mem::take(&mut neighbors[id]),
        ));
    }

    let max_clique_size = cliques
        .iter()
        .map(|clique| clique.scope().len())
        .max()
        .unwrap_or(0);
    let total_table_entries = cliques.iter().try_fold(0usize, |total, clique| {
        let entries = clique.scope().iter().try_fold(1usize, |product, &node| {
            product
                .checked_mul(graph.cardinality(node)?)
                .ok_or(Error::DimensionOverflow {
                    context: "junction-tree table size",
                })
        })?;
        total.checked_add(entries).ok_or(Error::DimensionOverflow {
            context: "junction-tree total table size",
        })
    })?;
    let stats = JunctionTreeStats {
        num_cliques: cliques.len(),
        max_clique_size,
        treewidth: max_clique_size.saturating_sub(1),
        total_table_entries,
    };

    Ok(CompiledJunctionTree::new(
        graph,
        cliques,
        separators,
        separator_by_edge,
        stats,
    ))
}

fn moralize(graph: &BayesianGraph) -> Result<Vec<BTreeSet<NodeId>>> {
    let mut adjacency = vec![BTreeSet::new(); graph.num_variables()];
    for variable in graph.variables() {
        let node = variable.id();
        let parents = graph.parents(node)?;
        for &parent in parents {
            adjacency[node.index()].insert(parent);
            adjacency[parent.index()].insert(node);
        }
        for left in 0..parents.len() {
            for right in left + 1..parents.len() {
                adjacency[parents[left].index()].insert(parents[right]);
                adjacency[parents[right].index()].insert(parents[left]);
            }
        }
    }
    Ok(adjacency)
}

fn select_next(
    graph: &BayesianGraph,
    adjacency: &[BTreeSet<NodeId>],
    eliminated: &[bool],
    heuristic: CompileHeuristic,
) -> Result<NodeId> {
    let mut best: Option<((usize, usize, usize, usize), NodeId)> = None;
    for variable in graph.variables() {
        let node = variable.id();
        if eliminated[node.index()] {
            continue;
        }
        let neighbors: Vec<NodeId> = adjacency[node.index()]
            .iter()
            .copied()
            .filter(|neighbor| !eliminated[neighbor.index()])
            .collect();
        let mut fill_edges = 0usize;
        let mut weighted_fill = 0usize;
        for left in 0..neighbors.len() {
            for right in left + 1..neighbors.len() {
                if !adjacency[neighbors[left].index()].contains(&neighbors[right]) {
                    fill_edges = fill_edges.saturating_add(1);
                    weighted_fill = weighted_fill.saturating_add(
                        graph
                            .cardinality(neighbors[left])?
                            .saturating_mul(graph.cardinality(neighbors[right])?),
                    );
                }
            }
        }
        let weight = neighbors
            .iter()
            .try_fold(variable.cardinality(), |weight, &neighbor| {
                Ok::<usize, Error>(weight.saturating_mul(graph.cardinality(neighbor)?))
            })?;
        let degree = neighbors.len() + 1;
        let score = match heuristic {
            CompileHeuristic::MinWeight => (weight, fill_edges, degree, node.index()),
            CompileHeuristic::MinFill => (fill_edges, weight, degree, node.index()),
            CompileHeuristic::MinDegree => (degree, fill_edges, weight, node.index()),
            CompileHeuristic::WeightedMinFill => (weighted_fill, weight, degree, node.index()),
        };
        if best.as_ref().is_none_or(|(current, _)| score < *current) {
            best = Some((score, node));
        }
    }
    best.map(|(_, node)| node).ok_or(Error::EmptyGraph)
}

fn is_sorted_subset(candidate: &[NodeId], superset: &[NodeId]) -> bool {
    candidate
        .iter()
        .all(|node| superset.binary_search(node).is_ok())
}

fn maximum_spanning_tree(scopes: &[Vec<NodeId>]) -> Vec<(usize, usize, Vec<NodeId>)> {
    #[derive(Debug)]
    struct Edge {
        left: usize,
        right: usize,
        intersection: Vec<NodeId>,
    }

    let mut edges = Vec::new();
    for left in 0..scopes.len() {
        for right in left + 1..scopes.len() {
            let intersection = scopes[left]
                .iter()
                .copied()
                .filter(|node| scopes[right].binary_search(node).is_ok())
                .collect();
            edges.push(Edge {
                left,
                right,
                intersection,
            });
        }
    }
    edges.sort_by_key(|edge| (Reverse(edge.intersection.len()), edge.left, edge.right));

    let mut disjoint = DisjointSet::new(scopes.len());
    let mut result = Vec::with_capacity(scopes.len().saturating_sub(1));
    for edge in edges {
        if disjoint.union(edge.left, edge.right) {
            result.push((edge.left, edge.right, edge.intersection));
            if result.len() + 1 == scopes.len() {
                break;
            }
        }
    }
    result
}

struct DisjointSet {
    parent: Vec<usize>,
    rank: Vec<u8>,
}

impl DisjointSet {
    fn new(size: usize) -> Self {
        Self {
            parent: (0..size).collect(),
            rank: vec![0; size],
        }
    }

    fn find(&mut self, item: usize) -> usize {
        if self.parent[item] != item {
            self.parent[item] = self.find(self.parent[item]);
        }
        self.parent[item]
    }

    fn union(&mut self, left: usize, right: usize) -> bool {
        let mut left_root = self.find(left);
        let mut right_root = self.find(right);
        if left_root == right_root {
            return false;
        }
        if self.rank[left_root] < self.rank[right_root] {
            std::mem::swap(&mut left_root, &mut right_root);
        }
        self.parent[right_root] = left_root;
        if self.rank[left_root] == self.rank[right_root] {
            self.rank[left_root] += 1;
        }
        true
    }
}
