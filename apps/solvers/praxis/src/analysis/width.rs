use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::time::Instant;

use serde::{Deserialize, Serialize};

use crate::algorithms::bdd_pdag::{BddPdag, BddPdagNode, NodeIdx};
use crate::error::{PraxisError, Result};

#[derive(Debug, Clone)]
pub struct DfsMetadata {
    pub variable_order: Vec<NodeIdx>,
    pub module_gates: HashSet<NodeIdx>,
    pub gate_min_time: HashMap<NodeIdx, usize>,
    pub gate_max_time: HashMap<NodeIdx, usize>,
}

pub fn compute_dfs_metadata(pdag: &BddPdag) -> Result<DfsMetadata> {
    let root = pdag.root().ok_or_else(|| {
        PraxisError::Logic("BddPdag: cannot order variables — root not set".to_string())
    })?;

    let mut state = DfsState {
        pdag,
        counter: 0,
        order: Vec::new(),
        cache: HashMap::new(),
        gate_min: HashMap::new(),
        gate_max: HashMap::new(),
        modules: HashSet::new(),
    };
    state.visit(root);

    let mut parents: HashMap<NodeIdx, Vec<NodeIdx>> = HashMap::new();
    for &idx in state.cache.keys() {
        if let Some(BddPdagNode::Gate { operands, .. }) = pdag.node(idx) {
            for &op in operands {
                parents.entry(op.abs()).or_default().push(idx);
            }
        }
    }
    let candidates: Vec<NodeIdx> = state.modules.iter().copied().collect();
    let mut true_modules: HashSet<NodeIdx> = HashSet::new();
    for g in candidates {
        if is_exclusive_module(pdag, g, &parents) {
            true_modules.insert(g);
        }
    }
    state.modules = true_modules;

    Ok(DfsMetadata {
        variable_order: state.order,
        module_gates: state.modules,
        gate_min_time: state.gate_min,
        gate_max_time: state.gate_max,
    })
}

fn subtree_of(pdag: &BddPdag, g: NodeIdx) -> HashSet<NodeIdx> {
    let mut s: HashSet<NodeIdx> = HashSet::new();
    let mut stack = vec![g.abs()];
    s.insert(g.abs());
    while let Some(n) = stack.pop() {
        if let Some(BddPdagNode::Gate { operands, .. }) = pdag.node(n) {
            for &op in operands {
                let a = op.abs();
                if s.insert(a) {
                    stack.push(a);
                }
            }
        }
    }
    s
}

fn is_exclusive_module(
    pdag: &BddPdag,
    g: NodeIdx,
    parents: &HashMap<NodeIdx, Vec<NodeIdx>>,
) -> bool {
    let sub = subtree_of(pdag, g);
    let g_abs = g.abs();
    for &n in &sub {
        if n == g_abs {
            continue;
        }
        if let Some(ps) = parents.get(&n) {
            if ps.iter().any(|p| !sub.contains(p)) {
                return false;
            }
        }
    }
    true
}

struct DfsState<'a> {
    pdag: &'a BddPdag,
    counter: usize,
    order: Vec<NodeIdx>,
    cache: HashMap<NodeIdx, (usize, usize, usize)>,
    gate_min: HashMap<NodeIdx, usize>,
    gate_max: HashMap<NodeIdx, usize>,
    modules: HashSet<NodeIdx>,
}

impl<'a> DfsState<'a> {
    fn visit(&mut self, idx: NodeIdx) -> (usize, usize, usize) {
        let abs_idx: NodeIdx = idx.abs();

        if let Some(&(mn, mx, _)) = self.cache.get(&abs_idx) {
            return (mn, mx, 0);
        }

        match self.pdag.node(abs_idx) {
            Some(BddPdagNode::Variable { .. }) => {
                let t = self.counter;
                self.counter += 1;
                self.order.push(abs_idx);
                let result = (t, t, 1);
                self.cache.insert(abs_idx, result);
                result
            }
            Some(BddPdagNode::Gate { operands, .. }) => {
                let ops: Vec<NodeIdx> = operands.clone();
                let mut mn = usize::MAX;
                let mut mx = 0usize;
                let mut new_vars = 0usize;

                for op in ops {
                    let (op_mn, op_mx, op_new) = self.visit(op);
                    if op_mn != usize::MAX {
                        mn = mn.min(op_mn);
                        mx = mx.max(op_mx);
                    }
                    new_vars += op_new;
                }

                if new_vars > 0 && mn != usize::MAX && mx - mn + 1 == new_vars {
                    self.modules.insert(abs_idx);
                }
                self.gate_min.insert(abs_idx, mn);
                self.gate_max.insert(abs_idx, mx);

                let result = (mn, mx, new_vars);
                self.cache.insert(abs_idx, result);
                result
            }
            _ => {
                let result = (usize::MAX, 0, 0);
                self.cache.insert(abs_idx, result);
                result
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidthReport {
    pub upper_bound: usize,
    pub compute_time_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleWidthReport {
    pub root_gate_idx: NodeIdx,
    pub root_gate_id: Option<String>,
    pub kind: ModuleKind,
    pub num_vertices: usize,
    pub num_edges: usize,
    pub treewidth: Option<WidthReport>,
    pub pathwidth: Option<WidthReport>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ModuleKind {
    Skeleton,
    Module,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidthsReport {
    pub coherent: bool,
    pub num_basic_events: usize,
    pub num_gates: usize,
    pub num_modules: usize,
    pub max_treewidth: Option<usize>,
    pub max_pathwidth: Option<usize>,
    pub treewidth_total_time_ms: u128,
    pub pathwidth_total_time_ms: u128,
    pub modules: Vec<ModuleWidthReport>,
}

#[derive(Debug, Clone, Copy)]
pub struct WidthOptions {
    pub compute_treewidth: bool,
    pub compute_pathwidth: bool,
}

#[derive(Debug, Clone)]
pub struct IncidenceGraph {
    adjacency: BTreeMap<NodeIdx, BTreeSet<NodeIdx>>,
}

impl IncidenceGraph {
    pub fn new() -> Self {
        Self {
            adjacency: BTreeMap::new(),
        }
    }

    pub fn add_vertex(&mut self, v: NodeIdx) {
        self.adjacency.entry(v).or_default();
    }

    pub fn add_edge(&mut self, u: NodeIdx, v: NodeIdx) {
        if u == v {
            return;
        }
        self.adjacency.entry(u).or_default().insert(v);
        self.adjacency.entry(v).or_default().insert(u);
    }

    pub fn num_vertices(&self) -> usize {
        self.adjacency.len()
    }

    pub fn num_edges(&self) -> usize {
        self.adjacency.values().map(|s| s.len()).sum::<usize>() / 2
    }

    pub fn vertices(&self) -> impl Iterator<Item = NodeIdx> + '_ {
        self.adjacency.keys().copied()
    }

    pub fn neighbors(&self, v: NodeIdx) -> Option<&BTreeSet<NodeIdx>> {
        self.adjacency.get(&v)
    }
}

impl Default for IncidenceGraph {
    fn default() -> Self {
        Self::new()
    }
}

pub fn maximal_modules(meta: &DfsMetadata) -> Vec<NodeIdx> {
    let modules: Vec<NodeIdx> = {
        let mut m: Vec<NodeIdx> = meta.module_gates.iter().copied().collect();
        m.sort();
        m
    };

    let mut maximals: Vec<NodeIdx> = Vec::new();
    for &g in &modules {
        let g_min = meta.gate_min_time.get(&g).copied().unwrap_or(usize::MAX);
        let g_max = meta.gate_max_time.get(&g).copied().unwrap_or(0);
        if g_min == usize::MAX {
            continue;
        }
        let mut strictly_contained = false;
        for &h in &modules {
            if h == g {
                continue;
            }
            let h_min = meta.gate_min_time.get(&h).copied().unwrap_or(usize::MAX);
            let h_max = meta.gate_max_time.get(&h).copied().unwrap_or(0);
            if h_min == usize::MAX {
                continue;
            }
            let h_contains_g = h_min <= g_min && g_max <= h_max;
            let strict = h_min < g_min || g_max < h_max;
            if h_contains_g && strict {
                strictly_contained = true;
                break;
            }
        }
        if !strictly_contained {
            maximals.push(g);
        }
    }
    maximals
}

pub fn build_incidence_graph_full(pdag: &BddPdag, root: NodeIdx) -> IncidenceGraph {
    let mut g = IncidenceGraph::new();
    let mut visited: HashSet<NodeIdx> = HashSet::new();
    let mut stack: Vec<NodeIdx> = vec![root.abs()];
    while let Some(idx) = stack.pop() {
        let abs = idx.abs();
        if !visited.insert(abs) {
            continue;
        }
        g.add_vertex(abs);
        if let Some(BddPdagNode::Gate { operands, .. }) = pdag.node(abs) {
            for &op in operands {
                let op_abs = op.abs();
                g.add_edge(abs, op_abs);
                stack.push(op_abs);
            }
        }
    }
    g
}

pub fn build_incidence_graph_skeleton(
    pdag: &BddPdag,
    root: NodeIdx,
    leaves: &HashSet<NodeIdx>,
) -> IncidenceGraph {
    let mut g = IncidenceGraph::new();
    let mut visited: HashSet<NodeIdx> = HashSet::new();
    let mut stack: Vec<NodeIdx> = vec![root.abs()];
    while let Some(idx) = stack.pop() {
        let abs = idx.abs();
        if !visited.insert(abs) {
            continue;
        }
        g.add_vertex(abs);
        if leaves.contains(&abs) && abs != root.abs() {
            continue;
        }
        if let Some(BddPdagNode::Gate { operands, .. }) = pdag.node(abs) {
            for &op in operands {
                let op_abs = op.abs();
                g.add_edge(abs, op_abs);
                stack.push(op_abs);
            }
        }
    }
    g
}

pub fn min_fill_treewidth(graph: &IncidenceGraph) -> WidthReport {
    let start = Instant::now();
    let mut adj: BTreeMap<NodeIdx, BTreeSet<NodeIdx>> = graph.adjacency.clone();
    let n = adj.len();
    let mut max_bag: usize = 0;

    for _ in 0..n {
        let vertices: Vec<NodeIdx> = adj.keys().copied().collect();
        let mut best: Option<(usize, usize, NodeIdx)> = None;
        for &v in &vertices {
            let nbrs: Vec<NodeIdx> = adj[&v].iter().copied().collect();
            let degree = nbrs.len();
            let mut fill: usize = 0;
            for i in 0..nbrs.len() {
                for j in (i + 1)..nbrs.len() {
                    if !adj[&nbrs[i]].contains(&nbrs[j]) {
                        fill += 1;
                    }
                }
            }
            let candidate = (fill, degree, v);
            best = Some(match best {
                None => candidate,
                Some(cur) => {
                    if candidate < cur {
                        candidate
                    } else {
                        cur
                    }
                }
            });
        }
        let (_, _, v) = best.expect("non-empty adjacency");
        let nbrs: Vec<NodeIdx> = adj[&v].iter().copied().collect();
        let bag_size = nbrs.len() + 1;
        if bag_size > max_bag {
            max_bag = bag_size;
        }
        for i in 0..nbrs.len() {
            for j in (i + 1)..nbrs.len() {
                let a = nbrs[i];
                let b = nbrs[j];
                adj.get_mut(&a).expect("neighbor exists").insert(b);
                adj.get_mut(&b).expect("neighbor exists").insert(a);
            }
        }
        for &u in &nbrs {
            adj.get_mut(&u).expect("neighbor exists").remove(&v);
        }
        adj.remove(&v);
    }

    let elapsed_ms = start.elapsed().as_millis();
    WidthReport {
        upper_bound: if max_bag == 0 { 0 } else { max_bag - 1 },
        compute_time_ms: elapsed_ms,
    }
}

pub fn greedy_vertex_separation_pathwidth(graph: &IncidenceGraph) -> WidthReport {
    let start = Instant::now();
    let adj = &graph.adjacency;
    let n = adj.len();
    let mut processed: HashSet<NodeIdx> = HashSet::new();
    let mut frontier: BTreeSet<NodeIdx> = BTreeSet::new();
    let mut max_sep: usize = 0;

    let all_vertices: Vec<NodeIdx> = adj.keys().copied().collect();

    for _ in 0..n {
        let mut best: Option<(usize, NodeIdx)> = None;
        for &v in &all_vertices {
            if processed.contains(&v) {
                continue;
            }
            let mut new_size = frontier.len();
            if frontier.contains(&v) {
                new_size -= 1;
            }
            if let Some(nbrs) = adj.get(&v) {
                for &u in nbrs {
                    if !processed.contains(&u) && u != v && !frontier.contains(&u) {
                        new_size += 1;
                    }
                }
            }
            let candidate = (new_size, v);
            best = Some(match best {
                None => candidate,
                Some(cur) => {
                    if candidate < cur {
                        candidate
                    } else {
                        cur
                    }
                }
            });
        }
        let (_, v) = best.expect("unprocessed vertex exists");
        processed.insert(v);
        frontier.remove(&v);
        if let Some(nbrs) = adj.get(&v) {
            for &u in nbrs {
                if !processed.contains(&u) {
                    frontier.insert(u);
                }
            }
        }
        if frontier.len() > max_sep {
            max_sep = frontier.len();
        }
    }

    let elapsed_ms = start.elapsed().as_millis();
    WidthReport {
        upper_bound: max_sep,
        compute_time_ms: elapsed_ms,
    }
}

pub fn compute_widths(pdag: &BddPdag, options: WidthOptions) -> Result<WidthsReport> {
    let meta = compute_dfs_metadata(pdag)?;
    let root = pdag.root().ok_or_else(|| {
        PraxisError::Logic("BddPdag: cannot compute widths — root not set".to_string())
    })?;

    let maximals = maximal_modules(&meta);
    let leaves: HashSet<NodeIdx> = maximals.iter().copied().collect();

    let mut module_reports: Vec<ModuleWidthReport> = Vec::new();
    let mut treewidth_total_ms: u128 = 0;
    let mut pathwidth_total_ms: u128 = 0;

    let skeleton_kind = if maximals.contains(&root.abs()) {
        None
    } else {
        Some(ModuleKind::Skeleton)
    };

    if let Some(kind) = skeleton_kind {
        let skeleton = build_incidence_graph_skeleton(pdag, root, &leaves);
        let (tw_report, pw_report) = run_width_pair(&skeleton, options);
        if let Some(ref tw) = tw_report {
            treewidth_total_ms += tw.compute_time_ms;
        }
        if let Some(ref pw) = pw_report {
            pathwidth_total_ms += pw.compute_time_ms;
        }
        module_reports.push(ModuleWidthReport {
            root_gate_idx: root.abs(),
            root_gate_id: pdag.node(root).and_then(|n| n.id().map(|s| s.to_string())),
            kind,
            num_vertices: skeleton.num_vertices(),
            num_edges: skeleton.num_edges(),
            treewidth: tw_report,
            pathwidth: pw_report,
        });
    }

    for &m_root in &maximals {
        let module_graph = build_incidence_graph_full(pdag, m_root);
        let (tw_report, pw_report) = run_width_pair(&module_graph, options);
        if let Some(ref tw) = tw_report {
            treewidth_total_ms += tw.compute_time_ms;
        }
        if let Some(ref pw) = pw_report {
            pathwidth_total_ms += pw.compute_time_ms;
        }
        module_reports.push(ModuleWidthReport {
            root_gate_idx: m_root,
            root_gate_id: pdag.node(m_root).and_then(|n| n.id().map(|s| s.to_string())),
            kind: ModuleKind::Module,
            num_vertices: module_graph.num_vertices(),
            num_edges: module_graph.num_edges(),
            treewidth: tw_report,
            pathwidth: pw_report,
        });
    }

    let max_tw = if options.compute_treewidth {
        module_reports
            .iter()
            .filter_map(|r| r.treewidth.as_ref().map(|w| w.upper_bound))
            .max()
    } else {
        None
    };
    let max_pw = if options.compute_pathwidth {
        module_reports
            .iter()
            .filter_map(|r| r.pathwidth.as_ref().map(|w| w.upper_bound))
            .max()
    } else {
        None
    };

    Ok(WidthsReport {
        coherent: pdag.is_coherent(),
        num_basic_events: pdag.num_variables(),
        num_gates: pdag.num_gates(),
        num_modules: maximals.len(),
        max_treewidth: max_tw,
        max_pathwidth: max_pw,
        treewidth_total_time_ms: treewidth_total_ms,
        pathwidth_total_time_ms: pathwidth_total_ms,
        modules: module_reports,
    })
}

fn run_width_pair(
    graph: &IncidenceGraph,
    options: WidthOptions,
) -> (Option<WidthReport>, Option<WidthReport>) {
    let tw = if options.compute_treewidth {
        Some(min_fill_treewidth(graph))
    } else {
        None
    };
    let pw = if options.compute_pathwidth {
        Some(greedy_vertex_separation_pathwidth(graph))
    } else {
        None
    };
    (tw, pw)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn incidence_graph_basic_ops() {
        let mut g = IncidenceGraph::new();
        g.add_edge(1, 2);
        g.add_edge(2, 3);
        g.add_edge(3, 1);
        assert_eq!(g.num_vertices(), 3);
        assert_eq!(g.num_edges(), 3);
    }

    #[test]
    fn incidence_graph_ignores_self_loops() {
        let mut g = IncidenceGraph::new();
        g.add_edge(1, 1);
        assert_eq!(g.num_edges(), 0);
    }

    #[test]
    fn min_fill_isolated_vertex_is_zero() {
        let mut g = IncidenceGraph::new();
        g.add_vertex(1);
        let w = min_fill_treewidth(&g);
        assert_eq!(w.upper_bound, 0);
    }

    #[test]
    fn min_fill_edge_is_one() {
        let mut g = IncidenceGraph::new();
        g.add_edge(1, 2);
        let w = min_fill_treewidth(&g);
        assert_eq!(w.upper_bound, 1);
    }

    #[test]
    fn min_fill_triangle_is_two() {
        let mut g = IncidenceGraph::new();
        g.add_edge(1, 2);
        g.add_edge(2, 3);
        g.add_edge(3, 1);
        let w = min_fill_treewidth(&g);
        assert_eq!(w.upper_bound, 2);
    }

    #[test]
    fn min_fill_star_is_one() {
        let mut g = IncidenceGraph::new();
        for leaf in 2..=10 {
            g.add_edge(1, leaf);
        }
        let w = min_fill_treewidth(&g);
        assert_eq!(w.upper_bound, 1);
    }

    #[test]
    fn min_fill_k4_is_three() {
        let mut g = IncidenceGraph::new();
        for i in 1..=4 {
            for j in (i + 1)..=4 {
                g.add_edge(i, j);
            }
        }
        let w = min_fill_treewidth(&g);
        assert_eq!(w.upper_bound, 3);
    }

    #[test]
    fn min_fill_path_is_one() {
        let mut g = IncidenceGraph::new();
        for i in 1..10 {
            g.add_edge(i, i + 1);
        }
        let w = min_fill_treewidth(&g);
        assert_eq!(w.upper_bound, 1);
    }

    #[test]
    fn pathwidth_isolated_vertex_is_zero() {
        let mut g = IncidenceGraph::new();
        g.add_vertex(1);
        let w = greedy_vertex_separation_pathwidth(&g);
        assert_eq!(w.upper_bound, 0);
    }

    #[test]
    fn pathwidth_edge_is_one() {
        let mut g = IncidenceGraph::new();
        g.add_edge(1, 2);
        let w = greedy_vertex_separation_pathwidth(&g);
        assert_eq!(w.upper_bound, 1);
    }

    #[test]
    fn pathwidth_triangle_is_two() {
        let mut g = IncidenceGraph::new();
        g.add_edge(1, 2);
        g.add_edge(2, 3);
        g.add_edge(3, 1);
        let w = greedy_vertex_separation_pathwidth(&g);
        assert_eq!(w.upper_bound, 2);
    }

    #[test]
    fn pathwidth_path_is_one() {
        let mut g = IncidenceGraph::new();
        for i in 1..10 {
            g.add_edge(i, i + 1);
        }
        let w = greedy_vertex_separation_pathwidth(&g);
        assert_eq!(w.upper_bound, 1);
    }

    #[test]
    fn pathwidth_at_least_treewidth() {
        let mut g = IncidenceGraph::new();
        for i in 1..=6 {
            for j in (i + 1)..=6 {
                g.add_edge(i, j);
            }
        }
        let tw = min_fill_treewidth(&g);
        let pw = greedy_vertex_separation_pathwidth(&g);
        assert!(pw.upper_bound >= tw.upper_bound);
    }
}
