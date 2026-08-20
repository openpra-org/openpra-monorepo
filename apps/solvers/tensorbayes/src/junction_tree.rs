use crate::{compiler, BayesianGraph, CompileHeuristic, NodeId, Result};

#[derive(Clone, Debug)]
pub struct Clique {
    id: usize,
    scope: Vec<NodeId>,
    assigned_cpts: Vec<NodeId>,
    neighbors: Vec<usize>,
}

impl Clique {
    pub fn id(&self) -> usize {
        self.id
    }

    pub fn scope(&self) -> &[NodeId] {
        &self.scope
    }

    pub fn assigned_cpts(&self) -> &[NodeId] {
        &self.assigned_cpts
    }

    pub fn neighbors(&self) -> &[usize] {
        &self.neighbors
    }
}

#[derive(Clone, Debug)]
pub struct Separator {
    clique1: usize,
    clique2: usize,
    scope: Vec<NodeId>,
}

impl Separator {
    pub fn clique1(&self) -> usize {
        self.clique1
    }

    pub fn clique2(&self) -> usize {
        self.clique2
    }

    pub fn scope(&self) -> &[NodeId] {
        &self.scope
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct JunctionTreeStats {
    pub num_cliques: usize,
    pub max_clique_size: usize,
    pub treewidth: usize,
    pub total_table_entries: usize,
}

/// Immutable compiled structure shared by reusable inference workspaces.
#[derive(Clone, Debug)]
pub struct CompiledJunctionTree {
    pub(crate) graph: BayesianGraph,
    pub(crate) cliques: Vec<Clique>,
    pub(crate) separators: Vec<Separator>,
    pub(crate) separator_by_edge: Vec<Vec<Option<usize>>>,
    stats: JunctionTreeStats,
}

impl CompiledJunctionTree {
    pub fn compile(graph: BayesianGraph, heuristic: CompileHeuristic) -> Result<Self> {
        compiler::compile(graph, heuristic)
    }

    pub fn graph(&self) -> &BayesianGraph {
        &self.graph
    }

    pub fn cliques(&self) -> &[Clique] {
        &self.cliques
    }

    pub fn separators(&self) -> &[Separator] {
        &self.separators
    }

    pub fn stats(&self) -> JunctionTreeStats {
        self.stats
    }

    pub(crate) fn new(
        graph: BayesianGraph,
        cliques: Vec<Clique>,
        separators: Vec<Separator>,
        separator_by_edge: Vec<Vec<Option<usize>>>,
        stats: JunctionTreeStats,
    ) -> Self {
        Self {
            graph,
            cliques,
            separators,
            separator_by_edge,
            stats,
        }
    }
}

pub(crate) fn clique(
    id: usize,
    scope: Vec<NodeId>,
    assigned_cpts: Vec<NodeId>,
    neighbors: Vec<usize>,
) -> Clique {
    Clique {
        id,
        scope,
        assigned_cpts,
        neighbors,
    }
}

pub(crate) fn separator(clique1: usize, clique2: usize, scope: Vec<NodeId>) -> Separator {
    Separator {
        clique1,
        clique2,
        scope,
    }
}
