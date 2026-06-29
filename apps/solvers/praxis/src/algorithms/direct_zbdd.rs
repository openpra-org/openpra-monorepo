use std::collections::{HashMap, HashSet};

use tracing::{debug, trace};

use crate::algorithms::modules::{decompose, Decomposition};
use crate::algorithms::noncoherent_mocus::{
    combinations, gate_expansion, normalize_xor_iff, Expansion,
};
use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::algorithms::zbdd_engine::{ZbddEngine, ZbddRef, ZBDD_BASE, ZBDD_EMPTY};
use crate::algorithms::ordering;
use crate::analysis::width::compute_dfs_metadata_pdag;
use crate::core::fault_tree::FaultTree;
use crate::error::PraxisError;
use crate::Result;

enum NodeKind {
    Basic(usize),
    Constant(bool),
    Gate(Connective, Vec<NodeIndex>, Option<usize>),
    Missing,
}

fn select_variable_order(pdag: &Pdag) -> Result<Vec<NodeIndex>> {
    let which = std::env::var("PRAXIS_ORDER").unwrap_or_default();
    let from_map = |map: HashMap<NodeIndex, usize>| -> Vec<NodeIndex> {
        let mut v: Vec<(usize, NodeIndex)> = map.into_iter().map(|(e, p)| (p, e)).collect();
        v.sort();
        v.into_iter().map(|(_, e)| e).collect()
    };
    let order = match which.as_str() {
        "force" => from_map(ordering::force_order(pdag)),
        "sloan" => from_map(ordering::sloan_fac_order(pdag)),
        "dfs_scram" => from_map(ordering::dfs_order(pdag, true)),
        "dfs_plain" => from_map(ordering::dfs_order(pdag, false)),
        "rev" => {
            let mut o = compute_dfs_metadata_pdag(pdag)?.variable_order;
            o.reverse();
            o
        }
        _ => compute_dfs_metadata_pdag(pdag)?.variable_order,
    };
    Ok(order)
}

struct Builder {
    pdag: Pdag,
    level: HashMap<NodeIndex, usize>,
    var_probs: Vec<f64>,
    zbdd: ZbddEngine,
    cache: HashMap<NodeIndex, ZbddRef>,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    exclusions: HashMap<usize, Vec<Vec<usize>>>,
    mutex_node: Option<NodeIndex>,
    progress: u64,
    explored: u64,
    budget_cache: HashMap<(NodeIndex, i32), ZbddRef>,
    maxcs_memo: HashMap<NodeIndex, f64>,
    decomposition: Option<Decomposition>,
    initiators: HashSet<usize>,
    gc_cache: usize,
}

impl Builder {
    fn new(
        pdag: &Pdag,
        fault_tree: &FaultTree,
        cut_off: Option<f64>,
        limit_order: Option<usize>,
    ) -> Result<Self> {
        let mut owned = pdag.clone();
        normalize_xor_iff(&mut owned)?;

        let order = select_variable_order(&owned)?;

        let mut level = HashMap::new();
        let mut var_probs: Vec<f64> = Vec::with_capacity(order.len() * 2);
        let mut initiators: HashSet<usize> = HashSet::new();
        for (l, &raw) in order.iter().enumerate() {
            let e = raw.abs();
            level.insert(e, l);
            let p = match owned.get_node(e) {
                Some(PdagNode::BasicEvent { id, .. }) => match fault_tree.get_basic_event(id) {
                    Some(be) => {
                        if be.is_initiator() {
                            initiators.insert(l);
                        }
                        be.probability()
                    }
                    None => 0.0,
                },
                _ => 0.0,
            };
            var_probs.push(p);
            var_probs.push(1.0 - p);
        }

        let mut zbdd = ZbddEngine::new();
        zbdd.set_var_probs(var_probs.clone());

        Ok(Builder {
            pdag: owned,
            level,
            var_probs,
            zbdd,
            cache: HashMap::new(),
            cut_off,
            limit_order,
            exclusions: HashMap::new(),
            mutex_node: None,
            progress: 0,
            explored: 0,
            budget_cache: HashMap::new(),
            maxcs_memo: HashMap::new(),
            decomposition: None,
            initiators,
            gc_cache: std::env::var("PRAXIS_GC_CACHE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
        })
    }

    fn setup_mutex(&mut self, name: &str) -> Result<()> {
        let Some(node) = self.pdag.get_index(name) else {
            tracing::warn!(target: "praxis::direct_zbdd", gate = name, "mutex gate not found, delete-term disabled");
            return Ok(());
        };
        let family = self.cut_sets(node)?;
        let combos = self.zbdd.enumerate(family);
        let combinations = combos.len();
        for combo in combos {
            for &v in &combo {
                let others: Vec<usize> = combo.iter().copied().filter(|&x| x != v).collect();
                self.exclusions.entry(v).or_default().push(others);
            }
        }
        self.mutex_node = Some(node);
        self.cache.clear();
        tracing::info!(
            target: "praxis::direct_zbdd",
            gate = name,
            node,
            combinations,
            excluded_literals = self.exclusions.len(),
            "delete-term mutex configured"
        );
        Ok(())
    }

    fn forbidden(&self, var: usize, chosen: &[usize]) -> bool {
        match self.exclusions.get(&var) {
            Some(combos) => combos
                .iter()
                .any(|others| others.iter().all(|o| chosen.contains(o))),
            None => false,
        }
    }

    fn truncate(&mut self, f: ZbddRef) -> ZbddRef {
        let mut f = f;
        if let Some(c) = self.cut_off {
            f = self.zbdd.prune_below_probability(f, c);
        }
        if let Some(k) = self.limit_order {
            f = self.zbdd.limit_order(f, k);
        }
        f
    }

    fn kind(&self, r: NodeIndex) -> NodeKind {
        match self.pdag.get_node(r.abs()) {
            Some(PdagNode::BasicEvent { .. }) => {
                let l = self.level[&r.abs()];
                NodeKind::Basic(l)
            }
            Some(PdagNode::Constant { value, .. }) => NodeKind::Constant(*value),
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => NodeKind::Gate(*connective, operands.clone(), *min_number),
            None => NodeKind::Missing,
        }
    }

    fn var_prob(&self, var: usize) -> f64 {
        self.var_probs.get(var).copied().unwrap_or(0.0)
    }

    fn as_delete_target(&self, ci: NodeIndex) -> Option<NodeIndex> {
        if ci > 0 {
            if let Some(PdagNode::Gate {
                connective: Connective::Not,
                operands,
                ..
            }) = self.pdag.get_node(ci)
            {
                let t = *operands.first()?;
                if t > 0 {
                    if let Some(PdagNode::Gate { .. }) = self.pdag.get_node(t) {
                        return Some(t);
                    }
                }
            }
            None
        } else if let Some(PdagNode::Gate { .. }) = self.pdag.get_node(ci.abs()) {
            Some(ci.abs())
        } else {
            None
        }
    }

    fn delete_covered(&mut self, acc: ZbddRef, dmcs: ZbddRef) -> ZbddRef {
        self.zbdd.nonsuperset(acc, dmcs)
    }

    fn cut_sets(&mut self, r: NodeIndex) -> Result<ZbddRef> {
        if let Some(&z) = self.cache.get(&r) {
            return Ok(z);
        }
        trace!(target: "praxis::direct_zbdd", op = "cut_sets", node = r, "enter gate");
        let neg = r < 0;
        let result = match self.kind(r) {
            NodeKind::Basic(l) => {
                let var = if neg { 2 * l + 1 } else { 2 * l };
                self.zbdd.multiply(var, ZBDD_BASE)
            }
            NodeKind::Constant(value) => {
                if value ^ neg {
                    ZBDD_BASE
                } else {
                    ZBDD_EMPTY
                }
            }
            NodeKind::Gate(conn, ops, min) => match gate_expansion(conn, neg, &ops, min) {
                Expansion::Conjunction(refs) => {
                    let mut acc = ZBDD_BASE;
                    for op in refs {
                        let c = self.cut_sets(op)?;
                        acc = self.zbdd.join(acc, c);
                        acc = self.zbdd.purify(acc);
                        acc = self.truncate(acc);
                    }
                    self.zbdd.minimize(acc)
                }
                Expansion::Disjunction(refs) => {
                    let mut acc = ZBDD_EMPTY;
                    for op in refs {
                        let c = self.cut_sets(op)?;
                        acc = self.zbdd.union(acc, c);
                    }
                    let acc = self.zbdd.minimize(acc);
                    self.truncate(acc)
                }
                Expansion::AtLeast(k, refs) => {
                    if k == 0 {
                        ZBDD_BASE
                    } else if k > refs.len() {
                        ZBDD_EMPTY
                    } else {
                        let mut acc = ZBDD_EMPTY;
                        for combo in combinations(&refs, k) {
                            let mut prod = ZBDD_BASE;
                            for op in combo {
                                let c = self.cut_sets(op)?;
                                prod = self.zbdd.join(prod, c);
                                prod = self.zbdd.purify(prod);
                                prod = self.truncate(prod);
                            }
                            acc = self.zbdd.union(acc, prod);
                            acc = self.truncate(acc);
                        }
                        self.zbdd.minimize(acc)
                    }
                }
                Expansion::Unsupported => {
                    return Err(PraxisError::Logic(
                        "direct ZBDD: XOR/IFF must be normalized before building".to_string(),
                    ));
                }
            },
            NodeKind::Missing => ZBDD_EMPTY,
        };
        debug!(
            target: "praxis::direct_zbdd",
            node = r,
            family = result.raw(),
            total_nodes = self.zbdd.node_count(),
            "gate cut-set family built"
        );
        self.cache.insert(r, result);
        Ok(result)
    }

    fn build(&mut self) -> Result<ZbddRef> {
        let root = self
            .pdag
            .root()
            .ok_or_else(|| PraxisError::Logic("direct ZBDD: PDAG has no root".to_string()))?;
        let eff = if self.pdag.complement() { -root } else { root };
        debug!(target: "praxis::direct_zbdd", root = eff, cut_off = ?self.cut_off, "bottom-up build start");
        let r = self.cut_sets(eff)?;
        debug!(target: "praxis::direct_zbdd", root_family = r.raw(), total_nodes = self.zbdd.node_count(), "bottom-up build done");
        Ok(r)
    }

    fn singleton(&mut self, chosen: &[usize]) -> ZbddRef {
        let mut sorted: Vec<usize> = chosen.to_vec();
        sorted.sort_unstable();
        let mut acc = ZBDD_BASE;
        for &v in sorted.iter().rev() {
            acc = self.zbdd.multiply(v, acc);
        }
        acc
    }

    fn gen(
        &mut self,
        obligations: &[NodeIndex],
        chosen: &mut Vec<usize>,
        prefix: f64,
    ) -> Result<ZbddRef> {
        self.explored += 1;
        if self.explored % 50_000_000 == 0 {
            tracing::info!(
                target: "praxis::direct_zbdd",
                explored = self.explored,
                cut_sets = self.progress,
                nodes = self.zbdd.node_count(),
                "top-down exploring"
            );
        }
        if let Some(c) = self.cut_off {
            if prefix < c {
                return Ok(ZBDD_EMPTY);
            }
        }
        let (first, rest) = match obligations.split_first() {
            Some(parts) => parts,
            None => {
                self.progress += 1;
                if self.progress % 10_000 == 0 {
                    tracing::info!(
                        target: "praxis::direct_zbdd",
                        cut_sets = self.progress,
                        nodes = self.zbdd.node_count(),
                        order = chosen.len(),
                        prob = prefix,
                        "top-down cut sets"
                    );
                }
                trace!(
                    target: "praxis::direct_zbdd",
                    op = "cut_set",
                    literals = ?chosen,
                    prob = prefix,
                    "complete cut set"
                );
                return Ok(self.singleton(chosen));
            }
        };
        let r = *first;
        let neg = r < 0;
        if let Some(m) = self.mutex_node {
            if r.abs() == m {
                return if neg {
                    self.gen(rest, chosen, prefix)
                } else {
                    Ok(ZBDD_EMPTY)
                };
            }
        }
        match self.kind(r) {
            NodeKind::Basic(l) => {
                let var = if neg { 2 * l + 1 } else { 2 * l };
                if chosen.contains(&(var ^ 1)) {
                    return Ok(ZBDD_EMPTY);
                }
                if chosen.contains(&var) {
                    return self.gen(rest, chosen, prefix);
                }
                if self.forbidden(var, chosen) {
                    return Ok(ZBDD_EMPTY);
                }
                let np = prefix * self.var_prob(var);
                if let Some(c) = self.cut_off {
                    if np < c {
                        return Ok(ZBDD_EMPTY);
                    }
                }
                if let Some(lim) = self.limit_order {
                    if chosen.len() + 1 > lim {
                        return Ok(ZBDD_EMPTY);
                    }
                }
                chosen.push(var);
                let res = self.gen(rest, chosen, np);
                chosen.pop();
                res
            }
            NodeKind::Constant(value) => {
                if value ^ neg {
                    self.gen(rest, chosen, prefix)
                } else {
                    Ok(ZBDD_EMPTY)
                }
            }
            NodeKind::Gate(conn, ops, min) => match gate_expansion(conn, neg, &ops, min) {
                Expansion::Conjunction(refs) => {
                    let mut obl = refs;
                    obl.extend_from_slice(rest);
                    self.gen(&obl, chosen, prefix)
                }
                Expansion::Disjunction(refs) => {
                    let mut acc = ZBDD_EMPTY;
                    for op in refs {
                        let mut obl = vec![op];
                        obl.extend_from_slice(rest);
                        let branch = self.gen(&obl, chosen, prefix)?;
                        acc = self.zbdd.union(acc, branch);
                    }
                    Ok(self.zbdd.minimize(acc))
                }
                Expansion::AtLeast(k, refs) => {
                    if k == 0 {
                        return self.gen(rest, chosen, prefix);
                    }
                    if k > refs.len() {
                        return Ok(ZBDD_EMPTY);
                    }
                    let mut acc = ZBDD_EMPTY;
                    for combo in combinations(&refs, k) {
                        let mut obl = combo;
                        obl.extend_from_slice(rest);
                        let branch = self.gen(&obl, chosen, prefix)?;
                        acc = self.zbdd.union(acc, branch);
                    }
                    Ok(self.zbdd.minimize(acc))
                }
                Expansion::Unsupported => Err(PraxisError::Logic(
                    "direct ZBDD: XOR/IFF must be normalized before building".to_string(),
                )),
            },
            NodeKind::Missing => Ok(ZBDD_EMPTY),
        }
    }

    fn build_topdown(&mut self) -> Result<ZbddRef> {
        let root = self
            .pdag
            .root()
            .ok_or_else(|| PraxisError::Logic("direct ZBDD: PDAG has no root".to_string()))?;
        let eff = if self.pdag.complement() { -root } else { root };
        debug!(target: "praxis::direct_zbdd", root = eff, cut_off = ?self.cut_off, "top-down delete-term build start");
        let mut chosen = Vec::new();
        let r = self.gen(&[eff], &mut chosen, 1.0)?;
        debug!(target: "praxis::direct_zbdd", root_family = r.raw(), total_nodes = self.zbdd.node_count(), "top-down build done");
        Ok(r)
    }

    fn maxcs(&mut self, r: NodeIndex) -> f64 {
        if let Some(&m) = self.maxcs_memo.get(&r) {
            return m;
        }
        let neg = r < 0;
        let m = match self.kind(r) {
            NodeKind::Basic(l) => {
                if neg {
                    self.var_prob(2 * l + 1)
                } else {
                    self.var_prob(2 * l)
                }
            }
            NodeKind::Constant(value) => {
                if value ^ neg {
                    1.0
                } else {
                    0.0
                }
            }
            NodeKind::Gate(conn, ops, min) => match gate_expansion(conn, neg, &ops, min) {
                Expansion::Conjunction(refs) => refs
                    .iter()
                    .map(|&c| self.maxcs(c))
                    .fold(f64::INFINITY, f64::min),
                Expansion::Disjunction(refs) => {
                    refs.iter().map(|&c| self.maxcs(c)).fold(0.0_f64, f64::max)
                }
                Expansion::AtLeast(k, refs) => {
                    let mut ms: Vec<f64> = refs.iter().map(|&c| self.maxcs(c)).collect();
                    ms.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
                    ms.get(k.saturating_sub(1)).copied().unwrap_or(0.0)
                }
                Expansion::Unsupported => 0.0,
            },
            NodeKind::Missing => 0.0,
        };
        self.maxcs_memo.insert(r, m);
        m
    }

    fn cut_sets_b(&mut self, r: NodeIndex, budget: f64) -> Result<ZbddRef> {
        self.explored += 1;
        if self.explored % 50_000_000 == 0 {
            tracing::info!(
                target: "praxis::direct_zbdd",
                explored = self.explored,
                nodes = self.zbdd.node_count(),
                buckets = self.budget_cache.len(),
                "budgeted delterm exploring"
            );
        }
        if self.gc_cache > 0
            && self.explored % 1024 == 0
            && self.zbdd.op_cache_len() > self.gc_cache
        {
            self.zbdd.clear_op_caches();
        }
        let b = budget_bucket(budget);
        if let Some(&z) = self.budget_cache.get(&(r, b)) {
            return Ok(self.zbdd.prune_below_probability(z, budget));
        }
        let build_budget = 10f64.powi(b);
        let family = self.compute_b(r, build_budget)?;
        self.budget_cache.insert((r, b), family);
        Ok(self.zbdd.prune_below_probability(family, budget))
    }

    fn compute_b(&mut self, r: NodeIndex, budget: f64) -> Result<ZbddRef> {
        let neg = r < 0;
        if let Some(m) = self.mutex_node {
            if r.abs() == m {
                return Ok(ZBDD_EMPTY);
            }
        }
        if r > 0 {
            if let Some(PdagNode::Gate {
                connective: Connective::Not,
                operands,
                ..
            }) = self.pdag.get_node(r)
            {
                if let Some(&t) = operands.first() {
                    if t > 0 && matches!(self.pdag.get_node(t), Some(PdagNode::Gate { .. })) {
                        return Ok(ZBDD_BASE);
                    }
                }
            }
        }
        let result = match self.kind(r) {
            NodeKind::Basic(l) => {
                let var = if neg { 2 * l + 1 } else { 2 * l };
                if self.var_prob(var) >= budget {
                    self.zbdd.multiply(var, ZBDD_BASE)
                } else {
                    ZBDD_EMPTY
                }
            }
            NodeKind::Constant(value) => {
                if value ^ neg {
                    ZBDD_BASE
                } else {
                    ZBDD_EMPTY
                }
            }
            NodeKind::Gate(conn, ops, min) => match gate_expansion(conn, neg, &ops, min) {
                Expansion::Conjunction(refs) => self.and_build_b(&refs, budget)?,
                Expansion::Disjunction(refs) => {
                    let mut acc = ZBDD_EMPTY;
                    for op in refs {
                        let c = self.cut_sets_b(op, budget)?;
                        acc = self.zbdd.union(acc, c);
                    }
                    let acc = self.zbdd.minimize(acc);
                    self.zbdd.prune_below_probability(acc, budget)
                }
                Expansion::AtLeast(k, refs) => {
                    if k == 0 {
                        ZBDD_BASE
                    } else if k > refs.len() {
                        ZBDD_EMPTY
                    } else {
                        let mut acc = ZBDD_EMPTY;
                        for combo in combinations(&refs, k) {
                            let prod = self.and_build_b(&combo, budget)?;
                            acc = self.zbdd.union(acc, prod);
                            acc = self.zbdd.prune_below_probability(acc, budget);
                        }
                        self.zbdd.minimize(acc)
                    }
                }
                Expansion::Unsupported => {
                    return Err(PraxisError::Logic(
                        "direct ZBDD: XOR/IFF must be normalized before building".to_string(),
                    ));
                }
            },
            NodeKind::Missing => ZBDD_EMPTY,
        };
        Ok(result)
    }

    fn and_build_b(&mut self, refs: &[NodeIndex], budget: f64) -> Result<ZbddRef> {
        let mut pos: Vec<NodeIndex> = Vec::new();
        let mut deletes: Vec<NodeIndex> = Vec::new();
        for &c in refs {
            match self.as_delete_target(c) {
                Some(t) => deletes.push(t),
                None => pos.push(c),
            }
        }

        let mut order: Vec<(f64, NodeIndex)> =
            pos.iter().map(|&c| (self.maxcs(c), c)).collect();
        order.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        let n = order.len();

        let mut budgets = vec![budget; n];
        if let Some(dec) = &self.decomposition {
            for i in 0..n {
                let ci = order[i].1;
                let mut others = f64::INFINITY;
                for j in 0..n {
                    if j != i && order[j].0 > 0.0 && dec.disjoint(order[j].1, ci) {
                        others = others.min(order[j].0);
                    }
                }
                if others.is_finite() {
                    budgets[i] = budget / others;
                }
            }
        }

        let mut acc = ZBDD_BASE;
        for i in 0..n {
            let c = self.cut_sets_b(order[i].1, budgets[i])?;
            acc = self.zbdd.join_budgeted(acc, c, budget);
            acc = self.zbdd.purify(acc);
            acc = self.zbdd.minimize(acc);
            if acc == ZBDD_EMPTY {
                return Ok(ZBDD_EMPTY);
            }
        }

        for t in deletes {
            if acc == ZBDD_EMPTY {
                break;
            }
            let dmcs = self.cut_sets_b(t, budget)?;
            acc = self.delete_covered(acc, dmcs);
        }
        Ok(acc)
    }

    fn build_delterm(&mut self) -> Result<ZbddRef> {
        let root = self
            .pdag
            .root()
            .ok_or_else(|| PraxisError::Logic("direct ZBDD: PDAG has no root".to_string()))?;
        let eff = if self.pdag.complement() { -root } else { root };
        let budget = self.cut_off.unwrap_or(1e-300);
        let dec = decompose(&self.pdag)?;
        self.decomposition = Some(dec);
        debug!(target: "praxis::direct_zbdd", root = eff, budget, "budgeted delterm build start");
        let r = self.cut_sets_b(eff, budget)?;
        debug!(
            target: "praxis::direct_zbdd",
            root_family = r.raw(),
            total_nodes = self.zbdd.node_count(),
            buckets = self.budget_cache.len(),
            "budgeted delterm build done"
        );
        Ok(r)
    }

}

fn budget_bucket(budget: f64) -> i32 {
    if !(budget > 0.0) {
        return 1;
    }
    if budget >= 1.0 {
        return 0;
    }
    budget.log10().floor() as i32
}

pub fn build_zbdd_from_pdag(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
) -> Result<(ZbddEngine, ZbddRef)> {
    let mut builder = Builder::new(pdag, fault_tree, cut_off, limit_order)?;
    let root = builder.build()?;
    Ok((builder.zbdd, root))
}

pub fn build_zbdd_topdown(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    mutex_gate: Option<&str>,
) -> Result<(ZbddEngine, ZbddRef)> {
    let mut builder = Builder::new(pdag, fault_tree, cut_off, limit_order)?;
    if let Some(name) = mutex_gate {
        builder.setup_mutex(name)?;
    }
    let root = builder.build_topdown()?;
    Ok((builder.zbdd, root))
}

pub fn build_zbdd_delterm(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    mutex_gate: Option<&str>,
) -> Result<(ZbddEngine, ZbddRef)> {
    let mut builder = Builder::new(pdag, fault_tree, cut_off, limit_order)?;
    if let Some(name) = mutex_gate {
        builder.setup_mutex(name)?;
    }
    let root = builder.build_delterm()?;
    Ok((builder.zbdd, root))
}

pub fn build_zbdd_delterm_named(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    mutex_gate: Option<&str>,
) -> Result<Vec<Vec<String>>> {
    let mut builder = Builder::new(pdag, fault_tree, cut_off, limit_order)?;
    if let Some(name) = mutex_gate {
        builder.setup_mutex(name)?;
    }

    let root = builder.build_delterm()?;

    let mut inv: HashMap<usize, NodeIndex> = HashMap::new();
    for (&idx, &lvl) in &builder.level {
        inv.insert(lvl, idx);
    }

    let mut root = root;

    if builder.initiators.len() >= 2 {
        let mut levels: Vec<usize> = builder.initiators.iter().copied().collect();
        levels.sort_unstable();
        let mut pairs = ZBDD_EMPTY;
        for i in 0..levels.len() {
            for j in (i + 1)..levels.len() {
                let inner = builder.zbdd.multiply(2 * levels[j], ZBDD_BASE);
                let pair = builder.zbdd.multiply(2 * levels[i], inner);
                pairs = builder.zbdd.union(pairs, pair);
            }
        }
        root = builder.zbdd.nonsuperset(root, pairs);
    }

    if std::env::var("PRAXIS_NOTRIM").is_err() {
        let flags: HashSet<usize> = (0..builder.var_probs.len())
            .filter(|&v| v % 2 == 0 && builder.var_probs[v] >= 1.0)
            .collect();
        if !flags.is_empty() {
            let mut cache: HashMap<ZbddRef, ZbddRef> = HashMap::new();
            root = builder.zbdd.project_out_set(root, &flags, &mut cache);
        }
    }

    root = builder.zbdd.minimize(root);

    let mut out: Vec<Vec<String>> = Vec::new();
    for cs in builder.zbdd.enumerate(root) {
        let mut names: Vec<String> = Vec::new();
        for v in cs {
            let lvl = v / 2;
            let neg = v % 2 == 1;
            let name = inv
                .get(&lvl)
                .and_then(|idx| builder.pdag.get_node(*idx))
                .and_then(|n| n.id())
                .unwrap_or("?")
                .to_string();
            names.push(if neg { format!("~{}", name) } else { name });
        }
        names.sort();
        names.dedup();
        out.push(names);
    }
    out.sort();
    out.dedup();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::parser::parse_fault_tree;

    const MUTEX_MODEL: &str = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="TOP">
    <define-gate name="TOP"><or><gate name="s1"/><gate name="s2"/><gate name="MUTEX"/></or></define-gate>
    <define-gate name="s1"><and><basic-event name="A"/><basic-event name="B"/></and></define-gate>
    <define-gate name="s2"><and><basic-event name="A"/><basic-event name="C"/></and></define-gate>
    <define-gate name="MUTEX"><and><basic-event name="A"/><basic-event name="C"/></and></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="A"><float value="0.1"/></define-basic-event>
    <define-basic-event name="B"><float value="0.1"/></define-basic-event>
    <define-basic-event name="C"><float value="0.1"/></define-basic-event>
  </model-data>
</opsa-mef>"#;

    fn topdown_cut_sets(mutex: Option<&str>) -> u64 {
        let ft = parse_fault_tree(MUTEX_MODEL).unwrap();
        let pdag = Pdag::from_fault_tree(&ft).unwrap();
        let (zbdd, root) = build_zbdd_topdown(&pdag, &ft, Some(1e-12), None, mutex).unwrap();
        zbdd.count_by_order(root).values().sum()
    }

    #[test]
    fn delete_term_drops_mutually_exclusive_cut_sets() {
        assert_eq!(topdown_cut_sets(None), 2);
        assert_eq!(topdown_cut_sets(Some("MUTEX")), 1);
    }
}
