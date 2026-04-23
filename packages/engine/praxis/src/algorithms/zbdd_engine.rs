use std::collections::HashMap;

use crate::algorithms::bdd_engine::{Bdd, BddRef};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ZbddRef(u32);

pub const ZBDD_EMPTY: ZbddRef = ZbddRef(0);
pub const ZBDD_BASE: ZbddRef = ZbddRef(1);

impl ZbddRef {
    pub fn new(raw: u32) -> Self {
        Self(raw)
    }

    pub fn raw(self) -> u32 {
        self.0
    }

    pub fn index(self) -> usize {
        self.0 as usize
    }

    pub fn is_empty(self) -> bool {
        self == ZBDD_EMPTY
    }

    pub fn is_base(self) -> bool {
        self == ZBDD_BASE
    }

    pub fn is_terminal(self) -> bool {
        self.0 <= 1
    }
}

impl std::fmt::Display for ZbddRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match *self {
            ZBDD_EMPTY => write!(f, "EMPTY"),
            ZBDD_BASE => write!(f, "BASE"),
            ZbddRef(k) => write!(f, "ZbddRef({})", k),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ZbddNode {
    pub var: usize,
    pub high: ZbddRef,
    pub low: ZbddRef,
}

impl ZbddNode {
    pub fn new(var: usize, high: ZbddRef, low: ZbddRef) -> Self {
        Self { var, high, low }
    }

    pub fn is_sentinel(self) -> bool {
        self.var == usize::MAX
    }
}

pub struct ZbddEngine {
    nodes: Vec<ZbddNode>,
    unique: HashMap<ZbddNode, ZbddRef>,
    union_cache: HashMap<(ZbddRef, ZbddRef), ZbddRef>,
    subtract_cache: HashMap<(ZbddRef, ZbddRef), ZbddRef>,
    minimize_cache: HashMap<ZbddRef, ZbddRef>,
    convert_cache: HashMap<BddRef, ZbddRef>,
    var_probs: Vec<f64>,
}

const ZBDD_SENTINEL: ZbddNode = ZbddNode {
    var: usize::MAX,
    high: ZBDD_EMPTY,
    low: ZBDD_EMPTY,
};

impl ZbddEngine {
    pub fn new() -> Self {
        Self {
            nodes: vec![ZBDD_SENTINEL, ZBDD_SENTINEL],
            unique: HashMap::new(),
            union_cache: HashMap::new(),
            subtract_cache: HashMap::new(),
            minimize_cache: HashMap::new(),
            convert_cache: HashMap::new(),
            var_probs: Vec::new(),
        }
    }

    pub fn is_empty(f: ZbddRef) -> bool {
        f.is_empty()
    }

    pub fn is_base(f: ZbddRef) -> bool {
        f.is_base()
    }

    pub fn is_terminal(f: ZbddRef) -> bool {
        f.is_terminal()
    }

    pub fn node(&self, f: ZbddRef) -> &ZbddNode {
        debug_assert!(
            !f.is_terminal(),
            "ZbddEngine::node called on terminal ref {f}"
        );
        &self.nodes[f.index()]
    }

    pub fn var_of(&self, f: ZbddRef) -> usize {
        if f.is_terminal() { usize::MAX } else { self.node(f).var }
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len().saturating_sub(2)
    }

    pub fn clear_caches(&mut self) {
        self.union_cache.clear();
        self.subtract_cache.clear();
        self.minimize_cache.clear();
        self.convert_cache.clear();
    }

    pub fn enumerate(&self, f: ZbddRef) -> Vec<Vec<usize>> {
        let mut result = Vec::new();
        let mut current = Vec::new();
        self.collect_sets(f, &mut current, &mut result);
        result
    }

    fn collect_sets(&self, f: ZbddRef, current: &mut Vec<usize>, result: &mut Vec<Vec<usize>>) {
        if f.is_empty() {
            return;
        }
        if f.is_base() {
            result.push(current.clone());
            return;
        }
        let node = self.node(f);
        current.push(node.var);
        self.collect_sets(node.high, current, result);
        current.pop();
        self.collect_sets(node.low, current, result);
    }

    pub fn count_by_order(&self, f: ZbddRef) -> HashMap<usize, u64> {
        let mut cache: HashMap<ZbddRef, HashMap<usize, u64>> = HashMap::new();
        self.count_by_order_rec(f, &mut cache)
    }

    fn count_by_order_rec(
        &self,
        f: ZbddRef,
        cache: &mut HashMap<ZbddRef, HashMap<usize, u64>>,
    ) -> HashMap<usize, u64> {
        if let Some(cached) = cache.get(&f) {
            return cached.clone();
        }
        let result = if f.is_empty() {
            HashMap::new()
        } else if f.is_base() {
            let mut m = HashMap::new();
            m.insert(0usize, 1u64);
            m
        } else {
            let node = self.node(f);
            let high = self.count_by_order_rec(node.high, cache);
            let low = self.count_by_order_rec(node.low, cache);
            let mut merged: HashMap<usize, u64> = low;
            for (order, count) in high {
                *merged.entry(order + 1).or_insert(0) += count;
            }
            merged
        };
        cache.insert(f, result.clone());
        result
    }

    pub(crate) fn alloc_node(&mut self, node: ZbddNode) -> ZbddRef {
        let idx = self.nodes.len() as u32;
        self.nodes.push(node);
        ZbddRef(idx)
    }

    pub(crate) fn unique_get(&self, node: &ZbddNode) -> Option<ZbddRef> {
        self.unique.get(node).copied()
    }

    pub(crate) fn unique_insert(&mut self, node: ZbddNode, r: ZbddRef) {
        self.unique.insert(node, r);
    }

    pub(crate) fn union_cache_get(&self, key: (ZbddRef, ZbddRef)) -> Option<ZbddRef> {
        self.union_cache.get(&key).copied()
    }

    pub(crate) fn union_cache_insert(&mut self, key: (ZbddRef, ZbddRef), val: ZbddRef) {
        self.union_cache.insert(key, val);
    }

    pub(crate) fn subtract_cache_get(&self, key: (ZbddRef, ZbddRef)) -> Option<ZbddRef> {
        self.subtract_cache.get(&key).copied()
    }

    pub(crate) fn subtract_cache_insert(&mut self, key: (ZbddRef, ZbddRef), val: ZbddRef) {
        self.subtract_cache.insert(key, val);
    }

    pub(crate) fn convert_cache_get(&self, f: BddRef) -> Option<ZbddRef> {
        self.convert_cache.get(&f).copied()
    }

    pub(crate) fn convert_cache_insert(&mut self, f: BddRef, z: ZbddRef) {
        self.convert_cache.insert(f, z);
    }

    fn make_node(&mut self, var: usize, high: ZbddRef, low: ZbddRef) -> ZbddRef {
        if high.is_empty() {
            return low;
        }
        let key = ZbddNode::new(var, high, low);
        if let Some(r) = self.unique_get(&key) {
            return r;
        }
        let r = self.alloc_node(key);
        self.unique_insert(key, r);
        r
    }

    pub(crate) fn union(&mut self, f: ZbddRef, g: ZbddRef) -> ZbddRef {
        if f.is_empty() { return g; }
        if g.is_empty() { return f; }
        if f == g { return f; }

        let key = if f < g { (f, g) } else { (g, f) };
        if let Some(cached) = self.union_cache_get(key) {
            return cached;
        }

        let f_var = self.var_of(f);
        let g_var = self.var_of(g);

        let result = if f_var == g_var {
            let f_hi = self.node(f).high;
            let f_lo = self.node(f).low;
            let g_hi = self.node(g).high;
            let g_lo = self.node(g).low;
            let hi = self.union(f_hi, g_hi);
            let lo = self.union(f_lo, g_lo);
            self.make_node(f_var, hi, lo)
        } else if f_var < g_var {
            let f_hi = self.node(f).high;
            let f_lo = self.node(f).low;
            let lo = self.union(f_lo, g);
            self.make_node(f_var, f_hi, lo)
        } else {
            let g_hi = self.node(g).high;
            let g_lo = self.node(g).low;
            let lo = self.union(f, g_lo);
            self.make_node(g_var, g_hi, lo)
        };

        self.union_cache_insert(key, result);
        result
    }

    pub(crate) fn multiply(&mut self, var: usize, f: ZbddRef) -> ZbddRef {
        self.make_node(var, f, ZBDD_EMPTY)
    }

    pub(crate) fn nonsuperset(&mut self, f: ZbddRef, g: ZbddRef) -> ZbddRef {
        if g.is_empty() { return f; }
        if g.is_base() { return ZBDD_EMPTY; }
        if f.is_empty() { return ZBDD_EMPTY; }

        let key = (f, g);
        if let Some(cached) = self.subtract_cache_get(key) {
            return cached;
        }

        let f_var = self.var_of(f);
        let g_var = self.var_of(g);

        let result = if f_var == g_var {
            let f_hi = self.node(f).high;
            let f_lo = self.node(f).low;
            let g_hi = self.node(g).high;
            let g_lo = self.node(g).low;
            let g_union = self.union(g_hi, g_lo);
            let hi = self.nonsuperset(f_hi, g_union);
            let lo = self.nonsuperset(f_lo, g_lo);
            self.make_node(f_var, hi, lo)
        } else if f_var < g_var {
            let f_hi = self.node(f).high;
            let f_lo = self.node(f).low;
            let hi = self.nonsuperset(f_hi, g);
            let lo = self.nonsuperset(f_lo, g);
            self.make_node(f_var, hi, lo)
        } else {
            let g_lo = self.node(g).low;
            self.nonsuperset(f, g_lo)
        };

        self.subtract_cache_insert(key, result);
        result
    }

    pub(crate) fn minimize(&mut self, f: ZbddRef) -> ZbddRef {
        if f.is_terminal() { return f; }

        if let Some(cached) = self.minimize_cache.get(&f).copied() {
            return cached;
        }

        let hi = self.node(f).high;
        let lo = self.node(f).low;
        let var = self.node(f).var;

        let lo_min = self.minimize(lo);
        let hi_min = self.minimize(hi);
        let hi_pruned = self.nonsuperset(hi_min, lo_min);
        let result = self.make_node(var, hi_pruned, lo_min);

        self.minimize_cache.insert(f, result);
        result
    }

    fn convert_bdd_inner(&mut self, bdd: &Bdd, f: BddRef) -> ZbddRef {
        if f.is_false() { return ZBDD_EMPTY; }
        if f.is_true() { return ZBDD_BASE; }

        if let Some(cached) = self.convert_cache_get(f) {
            return cached;
        }

        let var = bdd.var_of(f);
        let node = bdd.node(f);
        let (cofactor_hi, cofactor_lo) = if f.is_complement() {
            (node.high.complement(), node.low.complement())
        } else {
            (node.high, node.low)
        };

        let hi_z = self.convert_bdd_inner(bdd, cofactor_hi);
        let lo_z = self.convert_bdd_inner(bdd, cofactor_lo);

        let with_var = self.multiply(var, hi_z);
        let result = self.union(with_var, lo_z);

        self.convert_cache_insert(f, result);
        result
    }

    pub fn build_from_bdd(bdd: &Bdd, root: BddRef, coherent: bool) -> (ZbddEngine, ZbddRef) {
        let mut z = ZbddEngine::new();
        z.var_probs = bdd.var_probs().to_vec();
        let raw = z.convert_bdd_inner(bdd, root);
        let result = if coherent { raw } else { z.minimize(raw) };
        (z, result)
    }

    pub fn build_from_bdd_with_limits(
        bdd: &Bdd,
        root: BddRef,
        coherent: bool,
        limit_order: Option<usize>,
        cut_off: Option<f64>,
    ) -> (ZbddEngine, ZbddRef) {
        let mut z = ZbddEngine::new();
        z.var_probs = bdd.var_probs().to_vec();
        let min_prob = cut_off.unwrap_or(0.0);
        let mut cache: HashMap<(BddRef, Option<usize>, u64), ZbddRef> = HashMap::new();
        let raw = z.convert_bdd_limited(bdd, root, limit_order, 1.0, min_prob, &mut cache);
        let result = if coherent { raw } else { z.minimize(raw) };
        (z, result)
    }

    fn convert_bdd_limited(
        &mut self,
        bdd: &Bdd,
        f: BddRef,
        budget: Option<usize>,
        p_acc: f64,
        min_prob: f64,
        cache: &mut HashMap<(BddRef, Option<usize>, u64), ZbddRef>,
    ) -> ZbddRef {
        if f.is_false() {
            return ZBDD_EMPTY;
        }
        if f.is_true() {
            return if p_acc >= min_prob { ZBDD_BASE } else { ZBDD_EMPTY };
        }
        let key = (f, budget, p_acc.to_bits());
        if let Some(&r) = cache.get(&key) {
            return r;
        }
        let var = bdd.var_of(f);
        let node = bdd.node(f);
        let (cofactor_hi, cofactor_lo) = if f.is_complement() {
            (node.high.complement(), node.low.complement())
        } else {
            (node.high, node.low)
        };
        let p_var = self.var_probs[var];
        let hi_z = if budget == Some(0) {
            ZBDD_EMPTY
        } else {
            let new_budget = budget.map(|b| b - 1);
            self.convert_bdd_limited(bdd, cofactor_hi, new_budget, p_acc * p_var, min_prob, cache)
        };
        let lo_z = self.convert_bdd_limited(bdd, cofactor_lo, budget, p_acc, min_prob, cache);
        let with_var = self.multiply(var, hi_z);
        let result = self.union(with_var, lo_z);
        cache.insert(key, result);
        result
    }

    pub fn stats_by_order(&self, root: ZbddRef) -> HashMap<usize, (u64, f64, f64)> {
        let mut stats: HashMap<usize, (u64, f64, f64)> = HashMap::new();
        self.stats_rec(root, 0, 1.0, &mut stats);
        stats
    }

    fn stats_rec(
        &self,
        f: ZbddRef,
        order: usize,
        p_acc: f64,
        stats: &mut HashMap<usize, (u64, f64, f64)>,
    ) {
        if f.is_empty() {
            return;
        }
        if f.is_base() {
            let e = stats.entry(order).or_insert((0, f64::INFINITY, f64::NEG_INFINITY));
            e.0 += 1;
            if p_acc < e.1 {
                e.1 = p_acc;
            }
            if p_acc > e.2 {
                e.2 = p_acc;
            }
            return;
        }
        let node = self.node(f);
        let p_var = self.var_probs[node.var];
        self.stats_rec(node.high, order + 1, p_acc * p_var, stats);
        self.stats_rec(node.low, order, p_acc, stats);
    }

    pub fn rare_event_probability(&self, root: ZbddRef) -> f64 {
        let mut cache = HashMap::new();
        self.re_inner(root, &mut cache)
    }

    fn re_inner(&self, f: ZbddRef, cache: &mut HashMap<u32, f64>) -> f64 {
        if f.is_empty() { return 0.0; }
        if f.is_base() { return 1.0; }
        let key = f.raw();
        if let Some(&p) = cache.get(&key) { return p; }
        let node = self.node(f);
        let p_var = self.var_probs[node.var];
        let p_hi = self.re_inner(node.high, cache);
        let p_lo = self.re_inner(node.low, cache);
        let p = p_var * p_hi + p_lo;
        cache.insert(key, p);
        p
    }

    pub fn min_cut_upper_bound(&self, root: ZbddRef) -> f64 {
        let sets = self.enumerate(root);
        let cp = sets.iter().fold(1.0_f64, |acc, set| {
            let q: f64 = set.iter().map(|&v| self.var_probs[v]).product();
            acc * (1.0 - q)
        });
        1.0 - cp
    }

    pub fn limit_order(&mut self, f: ZbddRef, max_order: usize) -> ZbddRef {
        let mut cache: HashMap<(ZbddRef, usize), ZbddRef> = HashMap::new();
        self.limit_order_rec(f, max_order, &mut cache)
    }

    fn limit_order_rec(
        &mut self,
        f: ZbddRef,
        budget: usize,
        cache: &mut HashMap<(ZbddRef, usize), ZbddRef>,
    ) -> ZbddRef {
        if f.is_empty() {
            return ZBDD_EMPTY;
        }
        if f.is_base() {
            return ZBDD_BASE;
        }
        let key = (f, budget);
        if let Some(&r) = cache.get(&key) {
            return r;
        }
        let ZbddNode { var, high: hi, low: lo } = *self.node(f);
        let result = if budget == 0 {
            self.limit_order_rec(lo, 0, cache)
        } else {
            let hi_r = self.limit_order_rec(hi, budget - 1, cache);
            let lo_r = self.limit_order_rec(lo, budget, cache);
            self.make_node(var, hi_r, lo_r)
        };
        cache.insert(key, result);
        result
    }

    pub fn prune_below_probability(&mut self, f: ZbddRef, min_prob: f64) -> ZbddRef {
        let mut cache: HashMap<(ZbddRef, u64), ZbddRef> = HashMap::new();
        self.prune_below_rec(f, 1.0, min_prob, &mut cache)
    }

    fn prune_below_rec(
        &mut self,
        f: ZbddRef,
        p_acc: f64,
        min_prob: f64,
        cache: &mut HashMap<(ZbddRef, u64), ZbddRef>,
    ) -> ZbddRef {
        if f.is_empty() {
            return ZBDD_EMPTY;
        }
        if f.is_base() {
            return if p_acc >= min_prob { ZBDD_BASE } else { ZBDD_EMPTY };
        }
        let key = (f, p_acc.to_bits());
        if let Some(&r) = cache.get(&key) {
            return r;
        }
        let ZbddNode { var, high: hi, low: lo } = *self.node(f);
        let p_var = self.var_probs[var];
        let hi_r = self.prune_below_rec(hi, p_acc * p_var, min_prob, cache);
        let lo_r = self.prune_below_rec(lo, p_acc, min_prob, cache);
        let result = self.make_node(var, hi_r, lo_r);
        cache.insert(key, result);
        result
    }

    pub fn min_cut_upper_bound_graph(&self, root: ZbddRef) -> f64 {
        let mut cache: HashMap<(u32, u64), f64> = HashMap::new();
        1.0 - self.mcub_factor(root, 1.0, &mut cache)
    }

    fn mcub_factor(
        &self,
        f: ZbddRef,
        p_acc: f64,
        cache: &mut HashMap<(u32, u64), f64>,
    ) -> f64 {
        if f.is_empty() {
            return 1.0;
        }
        if f.is_base() {
            return 1.0 - p_acc;
        }
        let key = (f.raw(), p_acc.to_bits());
        if let Some(&v) = cache.get(&key) {
            return v;
        }
        let node = self.node(f);
        let p_var = self.var_probs[node.var];
        let hi = self.mcub_factor(node.high, p_acc * p_var, cache);
        let lo = self.mcub_factor(node.low, p_acc, cache);
        let result = hi * lo;
        cache.insert(key, result);
        result
    }
}

impl Default for ZbddEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::bdd_engine::{BDD_FALSE, BDD_TRUE};
    use crate::algorithms::bdd_pdag::{BddConnective, BddPdag};

    fn x0_zbdd() -> (ZbddEngine, ZbddRef) {
        let mut z = ZbddEngine::new();
        let r = z.multiply(0, ZBDD_BASE);
        (z, r)
    }

    fn x1_zbdd() -> (ZbddEngine, ZbddRef) {
        let mut z = ZbddEngine::new();
        let r = z.multiply(1, ZBDD_BASE);
        (z, r)
    }

    #[test]
    fn test_zbdd_empty_is_terminal() {
        assert!(ZBDD_EMPTY.is_terminal());
        assert!(ZBDD_EMPTY.is_empty());
        assert!(!ZBDD_EMPTY.is_base());
    }

    #[test]
    fn test_zbdd_base_is_terminal() {
        assert!(ZBDD_BASE.is_terminal());
        assert!(ZBDD_BASE.is_base());
        assert!(!ZBDD_BASE.is_empty());
    }

    #[test]
    fn test_zbdd_ref_non_terminal() {
        assert!(!ZbddRef(2).is_terminal());
        assert!(!ZbddRef(2).is_empty());
        assert!(!ZbddRef(2).is_base());
    }

    #[test]
    fn test_zbdd_ref_index() {
        assert_eq!(ZbddRef(5).index(), 5);
    }

    #[test]
    fn test_zbddnode_equality() {
        let n1 = ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY);
        let n2 = ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY);
        assert_eq!(n1, n2);
    }

    #[test]
    fn test_zbddnode_different_fields_not_equal() {
        assert_ne!(
            ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY),
            ZbddNode::new(1, ZBDD_BASE, ZBDD_EMPTY)
        );
        assert_ne!(
            ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY),
            ZbddNode::new(0, ZBDD_EMPTY, ZBDD_BASE)
        );
    }

    #[test]
    fn test_zbdd_sentinel_is_sentinel() {
        assert!(ZBDD_SENTINEL.is_sentinel());
        assert!(!ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY).is_sentinel());
    }

    #[test]
    fn test_zbdd_engine_new_empty() {
        let z = ZbddEngine::new();
        assert_eq!(z.node_count(), 0);
    }

    #[test]
    fn test_zbdd_engine_static_terminal_helpers() {
        assert!(ZbddEngine::is_empty(ZBDD_EMPTY));
        assert!(ZbddEngine::is_base(ZBDD_BASE));
        assert!(ZbddEngine::is_terminal(ZBDD_EMPTY));
        assert!(ZbddEngine::is_terminal(ZBDD_BASE));
        assert!(!ZbddEngine::is_terminal(ZbddRef(2)));
    }

    #[test]
    fn test_zbdd_alloc_increments_count() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY));
        assert_eq!(z.node_count(), 1);
        assert!(!r.is_terminal());
    }

    #[test]
    fn test_zbdd_unique_table_roundtrip() {
        let mut z = ZbddEngine::new();
        let node = ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY);
        let r = z.alloc_node(node);
        z.unique_insert(node, r);
        assert_eq!(z.unique_get(&node), Some(r));
        assert_eq!(z.unique_get(&ZbddNode::new(1, ZBDD_BASE, ZBDD_EMPTY)), None);
    }

    #[test]
    fn test_zbdd_union_cache_roundtrip() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY));
        z.union_cache_insert((ZBDD_BASE, ZBDD_EMPTY), r);
        assert_eq!(z.union_cache_get((ZBDD_BASE, ZBDD_EMPTY)), Some(r));
        assert_eq!(z.union_cache_get((ZBDD_EMPTY, ZBDD_BASE)), None);
    }

    #[test]
    fn test_zbdd_subtract_cache_roundtrip() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY));
        z.subtract_cache_insert((r, ZBDD_BASE), ZBDD_EMPTY);
        assert_eq!(z.subtract_cache_get((r, ZBDD_BASE)), Some(ZBDD_EMPTY));
    }

    #[test]
    fn test_zbdd_convert_cache_roundtrip() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY));
        z.convert_cache_insert(BDD_TRUE, r);
        assert_eq!(z.convert_cache_get(BDD_TRUE), Some(r));
        assert_eq!(z.convert_cache_get(BDD_FALSE), None);
    }

    #[test]
    fn test_zbdd_clear_caches() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY));
        z.union_cache_insert((ZBDD_BASE, ZBDD_EMPTY), r);
        z.convert_cache_insert(BDD_TRUE, r);
        z.clear_caches();
        assert!(z.union_cache_get((ZBDD_BASE, ZBDD_EMPTY)).is_none());
        assert!(z.convert_cache_get(BDD_TRUE).is_none());
    }

    #[test]
    fn test_zbdd_var_of_terminal() {
        let z = ZbddEngine::new();
        assert_eq!(z.var_of(ZBDD_EMPTY), usize::MAX);
        assert_eq!(z.var_of(ZBDD_BASE), usize::MAX);
    }

    #[test]
    fn test_zbdd_var_of_node() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(3, ZBDD_BASE, ZBDD_EMPTY));
        assert_eq!(z.var_of(r), 3);
    }

    #[test]
    fn test_make_node_zero_suppression() {
        let mut z = ZbddEngine::new();
        let result = z.make_node(0, ZBDD_EMPTY, ZBDD_BASE);
        assert_eq!(result, ZBDD_BASE);
        assert_eq!(z.node_count(), 0);
    }

    #[test]
    fn test_make_node_basic() {
        let mut z = ZbddEngine::new();
        let r = z.make_node(0, ZBDD_BASE, ZBDD_EMPTY);
        assert!(!r.is_terminal());
        assert_eq!(z.node(r).var, 0);
        assert_eq!(z.node(r).high, ZBDD_BASE);
        assert_eq!(z.node(r).low, ZBDD_EMPTY);
    }

    #[test]
    fn test_make_node_unique_table_dedup() {
        let mut z = ZbddEngine::new();
        let r1 = z.make_node(0, ZBDD_BASE, ZBDD_EMPTY);
        let r2 = z.make_node(0, ZBDD_BASE, ZBDD_EMPTY);
        assert_eq!(r1, r2);
        assert_eq!(z.node_count(), 1);
    }

    #[test]
    fn test_multiply_empty_input() {
        let mut z = ZbddEngine::new();
        assert_eq!(z.multiply(0, ZBDD_EMPTY), ZBDD_EMPTY);
    }

    #[test]
    fn test_multiply_base_input() {
        let mut z = ZbddEngine::new();
        let r = z.multiply(0, ZBDD_BASE);
        let sets = z.enumerate(r);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0], vec![0]);
    }

    #[test]
    fn test_union_empty_identity() {
        let (mut z, x0) = x0_zbdd();
        assert_eq!(z.union(ZBDD_EMPTY, x0), x0);
        assert_eq!(z.union(x0, ZBDD_EMPTY), x0);
    }

    #[test]
    fn test_union_idempotent() {
        let (mut z, x0) = x0_zbdd();
        assert_eq!(z.union(x0, x0), x0);
    }

    #[test]
    fn test_union_two_singletons() {
        let mut z = ZbddEngine::new();
        let x0 = z.multiply(0, ZBDD_BASE);
        let x1 = z.multiply(1, ZBDD_BASE);
        let u = z.union(x0, x1);
        let sets = z.enumerate(u);
        assert_eq!(sets.len(), 2);
        let has_x0 = sets.iter().any(|s| s == &[0]);
        let has_x1 = sets.iter().any(|s| s == &[1]);
        assert!(has_x0);
        assert!(has_x1);
    }

    #[test]
    fn test_nonsuperset_empty_g() {
        let (mut z, x0) = x0_zbdd();
        assert_eq!(z.nonsuperset(x0, ZBDD_EMPTY), x0);
    }

    #[test]
    fn test_nonsuperset_base_g() {
        let (mut z, x0) = x0_zbdd();
        assert_eq!(z.nonsuperset(x0, ZBDD_BASE), ZBDD_EMPTY);
    }

    #[test]
    fn test_nonsuperset_empty_f() {
        let (mut z, x0) = x0_zbdd();
        assert_eq!(z.nonsuperset(ZBDD_EMPTY, x0), ZBDD_EMPTY);
    }

    #[test]
    fn test_nonsuperset_removes_supersets() {
        let mut z = ZbddEngine::new();
        let x0 = z.multiply(0, ZBDD_BASE);
        let x0x1_inner = z.multiply(1, ZBDD_BASE);
        let x0x1 = z.multiply(0, x0x1_inner);
        let both = z.union(x0, x0x1);
        assert_eq!(z.enumerate(both).len(), 2);

        let result = z.nonsuperset(both, x0x1);
        let sets_after = z.enumerate(result);
        assert_eq!(sets_after.len(), 1);
        assert_eq!(sets_after[0], vec![0]);
    }

    #[test]
    fn test_minimize_terminal() {
        let mut z = ZbddEngine::new();
        assert_eq!(z.minimize(ZBDD_EMPTY), ZBDD_EMPTY);
        assert_eq!(z.minimize(ZBDD_BASE), ZBDD_BASE);
    }

    #[test]
    fn test_minimize_already_minimal() {
        let (mut z, x0) = x0_zbdd();
        let result = z.minimize(x0);
        let sets = z.enumerate(result);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0], vec![0]);
    }

    #[test]
    fn test_minimize_removes_nonminimal() {
        let mut z = ZbddEngine::new();
        let x0 = z.multiply(0, ZBDD_BASE);
        let x0x1_inner = z.multiply(1, ZBDD_BASE);
        let x0x1 = z.multiply(0, x0x1_inner);
        let both = z.union(x0, x0x1);

        let result = z.minimize(both);
        let sets = z.enumerate(result);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0], vec![0]);
    }

    #[test]
    fn test_convert_bdd_false() {
        let (zbdd, root) = ZbddEngine::build_from_bdd(&Bdd::new(), BDD_FALSE, true);
        assert_eq!(root, ZBDD_EMPTY);
        assert_eq!(zbdd.node_count(), 0);
    }

    #[test]
    fn test_convert_bdd_true() {
        let (_zbdd, root) = ZbddEngine::build_from_bdd(&Bdd::new(), BDD_TRUE, true);
        assert_eq!(root, ZBDD_BASE);
    }

    #[test]
    fn test_convert_bdd_single_var() {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), 0.1);
        pdag.set_root(e1).unwrap();
        pdag.set_variable_order(vec![e1]);
        let (bdd, bdd_root) = Bdd::build_from_pdag(&pdag).unwrap();
        let (z, root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        let sets = z.enumerate(root);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0], vec![0]);
    }

    #[test]
    fn test_convert_bdd_and_gate() {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), 0.1);
        let e2 = pdag.add_variable("E2".to_string(), 0.2);
        let g = pdag
            .add_gate("G".to_string(), BddConnective::And, vec![e1, e2], None)
            .unwrap();
        pdag.set_root(g).unwrap();
        pdag.compute_ordering_and_modules().unwrap();
        let (bdd, bdd_root) = Bdd::build_from_pdag(&pdag).unwrap();

        let (z, zbdd_root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        let sets = z.enumerate(zbdd_root);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0].len(), 2);
    }

    #[test]
    fn test_convert_bdd_or_gate() {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), 0.1);
        let e2 = pdag.add_variable("E2".to_string(), 0.2);
        let g = pdag
            .add_gate("G".to_string(), BddConnective::Or, vec![e1, e2], None)
            .unwrap();
        pdag.set_root(g).unwrap();
        pdag.compute_ordering_and_modules().unwrap();
        let (bdd, bdd_root) = Bdd::build_from_pdag(&pdag).unwrap();

        let (z, zbdd_root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        let sets = z.enumerate(zbdd_root);
        assert_eq!(sets.len(), 2);
        assert!(sets.iter().all(|s| s.len() == 1));
    }

    #[test]
    fn test_build_from_bdd_coherent_and_gate_end_to_end() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT", "TOP").unwrap();
        let mut top = Gate::new("TOP".to_string(), Formula::And).unwrap();
        top.add_operand("E1".to_string());
        top.add_operand("E2".to_string());
        ft.add_gate(top).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let mut pdag = BddPdag::from_fault_tree(&ft).unwrap();
        pdag.compute_ordering_and_modules().unwrap();
        let (bdd, bdd_root) = Bdd::build_from_pdag(&pdag).unwrap();

        let (z, zbdd_root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        let sets = z.enumerate(zbdd_root);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0].len(), 2);
    }

    #[test]
    fn test_build_from_bdd_coherent_or_gate_end_to_end() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT", "TOP").unwrap();
        let mut top = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top.add_operand("E1".to_string());
        top.add_operand("E2".to_string());
        ft.add_gate(top).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let mut pdag = BddPdag::from_fault_tree(&ft).unwrap();
        pdag.compute_ordering_and_modules().unwrap();
        let (bdd, bdd_root) = Bdd::build_from_pdag(&pdag).unwrap();

        let (z, zbdd_root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        let sets = z.enumerate(zbdd_root);
        assert_eq!(sets.len(), 2);
        assert!(sets.iter().all(|s| s.len() == 1));
    }

    #[test]
    fn test_enumerate_empty() {
        let z = ZbddEngine::new();
        assert!(z.enumerate(ZBDD_EMPTY).is_empty());
    }

    #[test]
    fn test_enumerate_base() {
        let z = ZbddEngine::new();
        let sets = z.enumerate(ZBDD_BASE);
        assert_eq!(sets, vec![Vec::<usize>::new()]);
    }

    fn or_zbdd(p0: f64, p1: f64) -> (ZbddEngine, ZbddRef) {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), p0);
        let e2 = pdag.add_variable("E2".to_string(), p1);
        let g = pdag
            .add_gate("G".to_string(), BddConnective::Or, vec![e1, e2], None)
            .unwrap();
        pdag.set_root(g).unwrap();
        pdag.compute_ordering_and_modules().unwrap();
        let (bdd, bdd_root) = Bdd::build_from_pdag(&pdag).unwrap();
        ZbddEngine::build_from_bdd(&bdd, bdd_root, true)
    }

    fn and_zbdd(p0: f64, p1: f64) -> (ZbddEngine, ZbddRef) {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), p0);
        let e2 = pdag.add_variable("E2".to_string(), p1);
        let g = pdag
            .add_gate("G".to_string(), BddConnective::And, vec![e1, e2], None)
            .unwrap();
        pdag.set_root(g).unwrap();
        pdag.compute_ordering_and_modules().unwrap();
        let (bdd, bdd_root) = Bdd::build_from_pdag(&pdag).unwrap();
        ZbddEngine::build_from_bdd(&bdd, bdd_root, true)
    }

    #[test]
    fn test_rare_event_empty() {
        let z = ZbddEngine::new();
        assert!((z.rare_event_probability(ZBDD_EMPTY)).abs() < 1e-15);
    }

    #[test]
    fn test_rare_event_single_var() {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), 0.1);
        pdag.set_root(e1).unwrap();
        pdag.set_variable_order(vec![e1]);
        let (bdd, bdd_root) = Bdd::build_from_pdag(&pdag).unwrap();
        let (z, root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        assert!((z.rare_event_probability(root) - 0.1).abs() < 1e-12);
    }

    #[test]
    fn test_rare_event_and_gate() {
        let (z, root) = and_zbdd(0.1, 0.2);
        assert!((z.rare_event_probability(root) - 0.02).abs() < 1e-12);
    }

    #[test]
    fn test_rare_event_or_gate() {
        let (z, root) = or_zbdd(0.1, 0.2);
        assert!((z.rare_event_probability(root) - 0.3).abs() < 1e-12);
    }

    #[test]
    fn test_mcub_empty() {
        let z = ZbddEngine::new();
        assert!((z.min_cut_upper_bound(ZBDD_EMPTY)).abs() < 1e-15);
    }

    #[test]
    fn test_mcub_and_gate() {
        let (z, root) = and_zbdd(0.1, 0.2);
        assert!((z.min_cut_upper_bound(root) - 0.02).abs() < 1e-12);
    }

    #[test]
    fn test_mcub_or_gate_matches_exact() {
        let (z, root) = or_zbdd(0.1, 0.2);
        let expected = 1.0 - (1.0 - 0.1) * (1.0 - 0.2);
        assert!((z.min_cut_upper_bound(root) - expected).abs() < 1e-12);
    }

    #[test]
    fn test_rare_event_exceeds_mcub_for_or_gate() {
        let (z, root) = or_zbdd(0.1, 0.2);
        let re = z.rare_event_probability(root);
        let mcub = z.min_cut_upper_bound(root);
        assert!(re > mcub);
    }
}
