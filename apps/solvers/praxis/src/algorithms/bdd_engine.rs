use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tracing::trace;

use crate::algorithms::pdag::{Connective as PdagConnective, NodeIndex as PdagIndex, Pdag, PdagNode};
use crate::error::{PraxisError, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct BddRef(i32);

pub const BDD_TRUE: BddRef = BddRef(1);
pub const BDD_FALSE: BddRef = BddRef(-1);
pub const BDD_NULL: BddRef = BddRef(0);

impl BddRef {
    pub fn new(raw: i32) -> Self {
        Self(raw)
    }

    pub fn raw(self) -> i32 {
        self.0
    }

    pub fn index(self) -> usize {
        self.0.unsigned_abs() as usize
    }

    pub fn is_complement(self) -> bool {
        self.0 < 0
    }

    pub fn complement(self) -> Self {
        BddRef(-self.0)
    }

    pub fn regular(self) -> Self {
        BddRef(self.0.abs())
    }

    pub fn is_terminal(self) -> bool {
        self.0.abs() == 1
    }

    pub fn is_true(self) -> bool {
        self == BDD_TRUE
    }

    pub fn is_false(self) -> bool {
        self == BDD_FALSE
    }

    pub fn is_null(self) -> bool {
        self == BDD_NULL
    }
}

impl std::fmt::Display for BddRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match *self {
            BDD_TRUE => write!(f, "TRUE"),
            BDD_FALSE => write!(f, "FALSE"),
            BDD_NULL => write!(f, "NULL"),
            BddRef(k) if k > 0 => write!(f, "BddRef({})", k),
            BddRef(k) => write!(f, "~BddRef({})", -k),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct BddNode {
    pub var: usize,
    pub high: BddRef,
    pub low: BddRef,
}

impl BddNode {
    pub fn new(var: usize, high: BddRef, low: BddRef) -> Self {
        Self { var, high, low }
    }

    pub fn is_sentinel(self) -> bool {
        self.var == usize::MAX
    }
}

pub struct Bdd {
    nodes: Vec<BddNode>,
    unique: HashMap<BddNode, BddRef>,
    compute: HashMap<(BddRef, BddRef, BddRef), BddRef>,
    prob_cache: HashMap<BddRef, f64>,
    var_probs: Vec<f64>,
    frozen: bool,
    node_budget: usize,
    compute_cap: usize,
    free: Vec<i32>,
    live_count: Option<Arc<AtomicU64>>,
    abort: Option<Arc<AtomicBool>>,
}

const SENTINEL: BddNode = BddNode {
    var: usize::MAX,
    high: BDD_TRUE,
    low: BDD_FALSE,
};

impl Bdd {
    pub fn new() -> Self {
        Self {
            nodes: vec![SENTINEL, SENTINEL],
            unique: HashMap::new(),
            compute: HashMap::new(),
            prob_cache: HashMap::new(),
            var_probs: Vec::new(),
            frozen: false,
            node_budget: 0,
            compute_cap: 0,
            free: Vec::new(),
            live_count: None,
            abort: None,
        }
    }

    pub fn is_terminal(f: BddRef) -> bool {
        f.is_terminal()
    }

    pub fn is_true(f: BddRef) -> bool {
        f.is_true()
    }

    pub fn is_false(f: BddRef) -> bool {
        f.is_false()
    }

    pub fn node(&self, f: BddRef) -> &BddNode {
        debug_assert!(
            !f.is_terminal() && !f.is_null(),
            "Bdd::node called on terminal or null ref {f}"
        );
        &self.nodes[f.index()]
    }

    pub fn var_of(&self, f: BddRef) -> usize {
        if f.is_terminal() {
            usize::MAX
        } else {
            self.node(f).var
        }
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len().saturating_sub(2)
    }

    pub fn variable_count(&self) -> usize {
        self.nodes
            .iter()
            .filter(|node| !node.is_sentinel())
            .map(|node| node.var)
            .max()
            .map(|variable| variable + 1)
            .unwrap_or_else(|| self.var_probs.len())
            .max(self.var_probs.len())
    }

    pub fn set_var_probs(&mut self, probs: Vec<f64>) {
        self.var_probs = probs;
    }

    pub fn var_prob(&self, var: usize) -> f64 {
        self.var_probs[var]
    }

    pub fn has_var_probs(&self) -> bool {
        !self.var_probs.is_empty()
    }

    pub fn var_probs(&self) -> &[f64] {
        &self.var_probs
    }

    pub fn freeze(&mut self) {
        self.unique = HashMap::new();
        self.compute = HashMap::new();
        self.frozen = true;
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen
    }

    pub fn clear_prob_cache(&mut self) {
        self.prob_cache = HashMap::new();
    }

    pub(crate) fn compute_get(&self, key: (BddRef, BddRef, BddRef)) -> Option<BddRef> {
        self.compute.get(&key).copied()
    }

    pub(crate) fn compute_insert(&mut self, key: (BddRef, BddRef, BddRef), val: BddRef) {
        if self.compute_cap != 0 && self.compute.len() >= self.compute_cap {
            self.compute.clear();
        }
        self.compute.insert(key, val);
    }

    pub fn set_compute_cap(&mut self, cap: usize) {
        self.compute_cap = cap;
    }

    pub(crate) fn unique_get(&self, node: &BddNode) -> Option<BddRef> {
        self.unique.get(node).copied()
    }

    pub(crate) fn unique_insert(&mut self, node: BddNode, r: BddRef) {
        self.unique.insert(node, r);
    }

    pub(crate) fn alloc_node(&mut self, node: BddNode) -> BddRef {
        let idx = if let Some(slot) = self.free.pop() {
            self.nodes[slot as usize] = node;
            slot
        } else {
            let i = self.nodes.len() as i32;
            self.nodes.push(node);
            i
        };
        if self.live_count.is_some() || self.node_budget != 0 || self.abort.is_some() {
            let live = self.nodes.len() - 2 - self.free.len();
            if let Some(c) = &self.live_count {
                c.store(live as u64, Ordering::Relaxed);
            }
            if self.node_budget != 0 && live >= self.node_budget {
                panic!("praxis-bdd-abort:{}", live);
            }
            if live & 0xFFF == 0 {
                if let Some(a) = &self.abort {
                    if a.load(Ordering::Relaxed) {
                        panic!("praxis-bdd-abort:{}", live);
                    }
                }
            }
        }
        BddRef(idx)
    }

    pub fn live_nodes(&self) -> usize {
        self.nodes.len().saturating_sub(2).saturating_sub(self.free.len())
    }

    fn gc(&mut self, roots: &[BddRef]) -> usize {
        let n = self.nodes.len();
        let mut marked = vec![false; n];
        let mut stack: Vec<usize> = Vec::new();
        for &r in roots {
            let idx = r.index();
            if idx >= 2 && idx < n && !marked[idx] {
                marked[idx] = true;
                stack.push(idx);
            }
        }
        while let Some(i) = stack.pop() {
            let node = self.nodes[i];
            for child in [node.high, node.low] {
                let ci = child.index();
                if ci >= 2 && ci < n && !marked[ci] {
                    marked[ci] = true;
                    stack.push(ci);
                }
            }
        }
        let mut freed = 0;
        for i in 2..n {
            if !marked[i] && !self.nodes[i].is_sentinel() {
                let key = self.nodes[i];
                self.unique.remove(&key);
                self.nodes[i] = SENTINEL;
                self.free.push(i as i32);
                freed += 1;
            }
        }
        self.compute.clear();
        freed
    }

    fn maybe_infold_gc(
        &mut self,
        memo: &HashMap<PdagIndex, BddRef>,
        acc: BddRef,
        remaining: &[BddRef],
        gc_interval: usize,
        threshold: &mut usize,
    ) {
        if gc_interval == 0 || self.live_nodes() < *threshold {
            return;
        }
        let mut roots: Vec<BddRef> = memo.values().copied().collect();
        roots.push(acc);
        roots.extend_from_slice(remaining);
        let live_before = self.live_nodes();
        let freed = self.gc(&roots);
        let live_after = self.live_nodes();
        *threshold = live_after.saturating_mul(2).max(gc_interval);
        if self.live_count.is_some() {
            eprintln!(
                "    [gc-infold] live {} -> {} (freed {}), next at {}",
                live_before, live_after, freed, threshold
            );
        }
    }

    pub fn build_root_gc(
        &mut self,
        pdag: &Pdag,
        var_of: &std::collections::HashMap<PdagIndex, usize>,
        gc_interval: usize,
    ) -> Result<BddRef> {
        let order = pdag.topological_sort()?;
        let root = match pdag.root() {
            Some(r) => r,
            None => return Ok(BDD_TRUE),
        };
        let root_abs = root.abs();

        let mut pending: HashMap<PdagIndex, usize> = HashMap::new();
        for node in pdag.nodes().values() {
            if let PdagNode::Gate { operands, .. } = node {
                for &op in operands {
                    *pending.entry(op.abs()).or_insert(0) += 1;
                }
            }
        }

        let mut memo: HashMap<PdagIndex, BddRef> = HashMap::new();
        let mut threshold = gc_interval;

        for &idx in &order {
            let a = idx.abs();
            let r = match pdag.get_node(a) {
                Some(PdagNode::BasicEvent { .. }) => {
                    let v = *var_of.get(&a).ok_or_else(|| {
                        PraxisError::Logic(format!("BDD gc build: variable {} unmapped", a))
                    })?;
                    self.make_node(v, BDD_TRUE, BDD_FALSE)
                }
                Some(PdagNode::Constant { value, .. }) => {
                    if *value {
                        BDD_TRUE
                    } else {
                        BDD_FALSE
                    }
                }
                Some(PdagNode::Gate {
                    connective,
                    operands,
                    min_number,
                    ..
                }) => {
                    let conn = *connective;
                    let min = *min_number;
                    let ops = operands.clone();
                    let mut children = Vec::with_capacity(ops.len());
                    for &op in &ops {
                        let c = *memo.get(&op.abs()).ok_or_else(|| {
                            PraxisError::Logic(format!("BDD gc build: operand {} not built", op.abs()))
                        })?;
                        children.push(if op < 0 { c.complement() } else { c });
                        if let Some(p) = pending.get_mut(&op.abs()) {
                            *p = p.saturating_sub(1);
                        }
                    }
                    let res = match conn {
                        PdagConnective::And | PdagConnective::Nand => {
                            let mut acc = BDD_TRUE;
                            for i in 0..children.len() {
                                acc = self.and(acc, children[i]);
                                self.maybe_infold_gc(
                                    &memo,
                                    acc,
                                    &children[i + 1..],
                                    gc_interval,
                                    &mut threshold,
                                );
                            }
                            if conn == PdagConnective::Nand {
                                acc.complement()
                            } else {
                                acc
                            }
                        }
                        PdagConnective::Or | PdagConnective::Nor => {
                            let mut acc = BDD_FALSE;
                            for i in 0..children.len() {
                                acc = self.or(acc, children[i]);
                                self.maybe_infold_gc(
                                    &memo,
                                    acc,
                                    &children[i + 1..],
                                    gc_interval,
                                    &mut threshold,
                                );
                            }
                            if conn == PdagConnective::Nor {
                                acc.complement()
                            } else {
                                acc
                            }
                        }
                        _ => self.combine_pdag(conn, &children, min),
                    };
                    for &op in &ops {
                        let oa = op.abs();
                        if oa != root_abs && pending.get(&oa).copied() == Some(0) {
                            memo.remove(&oa);
                        }
                    }
                    res
                }
                None => {
                    return Err(PraxisError::Logic(format!(
                        "BDD gc build: node {} not found",
                        a
                    )))
                }
            };
            memo.insert(a, r);

            if gc_interval != 0 && self.live_nodes() >= threshold {
                let roots: Vec<BddRef> = memo.values().copied().collect();
                let live_before = self.live_nodes();
                let freed = self.gc(&roots);
                let live_after = self.live_nodes();
                threshold = live_after.saturating_mul(2).max(gc_interval);
                if self.live_count.is_some() {
                    eprintln!(
                        "    [gc] live {} -> {} (freed {}), next at {}",
                        live_before, live_after, freed, threshold
                    );
                }
            }
        }

        let mut r = *memo.get(&root_abs).ok_or_else(|| {
            PraxisError::Logic("BDD gc build: root not built".to_string())
        })?;
        if root < 0 {
            r = r.complement();
        }
        if pdag.complement() {
            r = r.complement();
        }
        Ok(r)
    }

    pub fn set_node_budget(&mut self, budget: usize) {
        self.node_budget = budget;
    }

    pub fn attach_live_count(&mut self, counter: Arc<AtomicU64>) {
        self.live_count = Some(counter);
    }

    pub fn attach_abort(&mut self, flag: Arc<AtomicBool>) {
        self.abort = Some(flag);
    }

    pub fn unique_len(&self) -> usize {
        self.unique.len()
    }

    pub fn compute_len(&self) -> usize {
        self.compute.len()
    }

    pub fn reachable_count(&self, root: BddRef) -> usize {
        let mut seen: std::collections::HashSet<i32> = std::collections::HashSet::new();
        let mut stack = vec![root.regular()];
        while let Some(f) = stack.pop() {
            if f.is_terminal() || f.is_null() {
                continue;
            }
            let r = f.regular();
            if !seen.insert(r.raw()) {
                continue;
            }
            let node = self.node(r);
            stack.push(node.high.regular());
            stack.push(node.low.regular());
        }
        seen.len()
    }

    pub fn build_root(
        &mut self,
        pdag: &Pdag,
        var_of: &std::collections::HashMap<PdagIndex, usize>,
    ) -> Result<BddRef> {
        self.build_pdag_root(pdag, var_of)
    }

    #[cfg(test)]
    pub(crate) fn prob_cache_get(&self, f: BddRef) -> Option<f64> {
        self.prob_cache.get(&f.regular()).copied()
    }

    #[cfg(test)]
    pub(crate) fn prob_cache_insert(&mut self, f: BddRef, p: f64) {
        self.prob_cache.insert(f.regular(), p);
    }

    fn make_node(&mut self, var: usize, high: BddRef, low: BddRef) -> BddRef {
        if high == low {
            return high;
        }

        let (canon_high, canon_low, negate) = if high.is_complement() {
            (high.complement(), low.complement(), true)
        } else {
            (high, low, false)
        };
        let key = BddNode::new(var, canon_high, canon_low);
        if let Some(r) = self.unique_get(&key) {
            return if negate { r.complement() } else { r };
        }
        let r = self.alloc_node(key);
        self.unique_insert(key, r);
        trace!(
            target: "praxis::bdd",
            op = "make_node",
            var,
            high = canon_high.raw(),
            low = canon_low.raw(),
            node = r.raw(),
            total = self.node_count(),
            "bdd node populated"
        );
        if negate { r.complement() } else { r }
    }

    fn top_var(&self, f: BddRef, g: BddRef, h: BddRef) -> usize {
        self.var_of(f).min(self.var_of(g)).min(self.var_of(h))
    }

    fn ite_cofactor(&self, f: BddRef, var: usize, positive: bool) -> BddRef {
        let reg = f.regular();
        if reg.is_terminal() {
            return f;
        }
        let node = self.node(reg);
        if node.var != var {
            return f;
        }
        let edge = if positive { node.high } else { node.low };

        if f.is_complement() { edge.complement() } else { edge }
    }

    pub(crate) fn ite(&mut self, f: BddRef, g: BddRef, h: BddRef) -> BddRef {
        if f.is_true() {
            return g;
        }
        if f.is_false() {
            return h;
        }

        let mut nf = f;
        let mut ng = g;
        let mut nh = h;
        let mut negate = false;

        if nf.is_complement() {
            nf = nf.complement();
            std::mem::swap(&mut ng, &mut nh);
        }

        if ng.is_complement() {
            negate = !negate;
            ng = ng.complement();
            nh = nh.complement();
        }

        if ng == nh {
            return if negate { ng.complement() } else { ng };
        }
        if ng.is_true() && nh.is_false() {
            return if negate { nf.complement() } else { nf };
        }

        let key = (nf, ng, nh);
        if let Some(cached) = self.compute_get(key) {
            return if negate { cached.complement() } else { cached };
        }

        let top = self.top_var(nf, ng, nh);

        let f1 = self.ite_cofactor(nf, top, true);
        let g1 = self.ite_cofactor(ng, top, true);
        let h1 = self.ite_cofactor(nh, top, true);
        let f0 = self.ite_cofactor(nf, top, false);
        let g0 = self.ite_cofactor(ng, top, false);
        let h0 = self.ite_cofactor(nh, top, false);

        let t = self.ite(f1, g1, h1);
        let e = self.ite(f0, g0, h0);

        let result = self.make_node(top, t, e);
        self.compute_insert(key, result);

        trace!(
            target: "praxis::bdd",
            op = "ite",
            f = nf.raw(),
            g = ng.raw(),
            h = nh.raw(),
            top,
            result = result.raw(),
            "bdd ite"
        );
        if negate { result.complement() } else { result }
    }

    pub(crate) fn and(&mut self, f: BddRef, g: BddRef) -> BddRef {
        self.ite(f, g, BDD_FALSE)
    }

    pub(crate) fn or(&mut self, f: BddRef, g: BddRef) -> BddRef {
        self.ite(f, BDD_TRUE, g)
    }

    fn pdag_var_order(pdags: &[&Pdag]) -> std::collections::HashMap<PdagIndex, usize> {
        let mut events: Vec<PdagIndex> = pdags
            .iter()
            .flat_map(|p| p.nodes().values())
            .filter_map(|n| match n {
                PdagNode::BasicEvent { index, .. } => Some(*index),
                _ => None,
            })
            .collect();
        events.sort();
        events.dedup();
        let mut var_of = std::collections::HashMap::new();
        for (i, &e) in events.iter().enumerate() {
            var_of.insert(e, i);
        }
        var_of
    }

    fn build_pdag_root(
        &mut self,
        pdag: &Pdag,
        var_of: &std::collections::HashMap<PdagIndex, usize>,
    ) -> Result<BddRef> {
        let root = match pdag.root() {
            Some(r) => r,
            None => return Ok(BDD_TRUE),
        };
        let mut memo: HashMap<PdagIndex, BddRef> = HashMap::new();
        let mut r = self.build_pdag_node(pdag, root.abs(), var_of, &mut memo)?;
        if root < 0 {
            r = r.complement();
        }
        if pdag.complement() {
            r = r.complement();
        }
        Ok(r)
    }

    pub fn from_pdag(pdag: &Pdag) -> Result<(Bdd, BddRef)> {
        let var_of = Self::pdag_var_order(&[pdag]);
        Self::from_pdag_with_order(pdag, &var_of)
    }

    pub fn from_pdag_with_order(
        pdag: &Pdag,
        var_of: &std::collections::HashMap<PdagIndex, usize>,
    ) -> Result<(Bdd, BddRef)> {
        let mut bdd = Bdd::new();
        let root = bdd.build_pdag_root(pdag, var_of)?;
        Ok((bdd, root))
    }

    pub fn from_pdag_with_order_and_probs(
        pdag: &Pdag,
        var_of: &std::collections::HashMap<PdagIndex, usize>,
        var_probs: Vec<f64>,
    ) -> Result<(Bdd, BddRef)> {
        let mut bdd = Bdd::new();
        bdd.set_var_probs(var_probs);
        let root = bdd.build_pdag_root(pdag, var_of)?;
        Ok((bdd, root))
    }

    /// Build the function of one PDAG node into this manager. Several nodes can
    /// be built into the same manager under one variable order, which is what
    /// lets their ZBDDs be combined afterwards.
    pub fn build_pdag_index(
        &mut self,
        pdag: &Pdag,
        idx: PdagIndex,
        var_of: &std::collections::HashMap<PdagIndex, usize>,
    ) -> Result<BddRef> {
        let mut memo: HashMap<PdagIndex, BddRef> = HashMap::new();
        let r = self.build_pdag_node(pdag, idx.abs(), var_of, &mut memo)?;
        Ok(if idx < 0 { r.complement() } else { r })
    }

    pub fn equivalent(a: &Pdag, b: &Pdag) -> Result<bool> {
        let var_of = Self::pdag_var_order(&[a, b]);
        let mut bdd = Bdd::new();
        let ra = bdd.build_pdag_root(a, &var_of)?;
        let rb = bdd.build_pdag_root(b, &var_of)?;
        Ok(ra == rb)
    }

    fn build_pdag_node(
        &mut self,
        pdag: &Pdag,
        idx: PdagIndex,
        var_of: &std::collections::HashMap<PdagIndex, usize>,
        memo: &mut HashMap<PdagIndex, BddRef>,
    ) -> Result<BddRef> {
        let a = idx.abs();
        if let Some(&r) = memo.get(&a) {
            return Ok(r);
        }
        let r = match pdag.get_node(a) {
            Some(PdagNode::BasicEvent { .. }) => {
                let v = *var_of.get(&a).ok_or_else(|| {
                    PraxisError::Logic(format!("BDD from_pdag: variable {} unmapped", a))
                })?;
                self.make_node(v, BDD_TRUE, BDD_FALSE)
            }
            Some(PdagNode::Constant { value, .. }) => {
                if *value {
                    BDD_TRUE
                } else {
                    BDD_FALSE
                }
            }
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => {
                let conn = *connective;
                let min = *min_number;
                let ops = operands.clone();
                let mut children = Vec::with_capacity(ops.len());
                for &op in &ops {
                    let c = self.build_pdag_node(pdag, op.abs(), var_of, memo)?;
                    children.push(if op < 0 { c.complement() } else { c });
                }
                self.combine_pdag(conn, &children, min)
            }
            None => {
                return Err(PraxisError::Logic(format!(
                    "BDD from_pdag: node {} not found",
                    a
                )))
            }
        };
        memo.insert(a, r);
        Ok(r)
    }

    fn combine_pdag(&mut self, conn: PdagConnective, children: &[BddRef], min: Option<usize>) -> BddRef {
        match conn {
            PdagConnective::And => {
                let mut acc = BDD_TRUE;
                for &c in children {
                    acc = self.and(acc, c);
                }
                acc
            }
            PdagConnective::Or => {
                let mut acc = BDD_FALSE;
                for &c in children {
                    acc = self.or(acc, c);
                }
                acc
            }
            PdagConnective::Null => children.first().copied().unwrap_or(BDD_TRUE),
            PdagConnective::Not => children
                .first()
                .copied()
                .map(|c| c.complement())
                .unwrap_or(BDD_FALSE),
            PdagConnective::Nand => {
                let mut acc = BDD_TRUE;
                for &c in children {
                    acc = self.and(acc, c);
                }
                acc.complement()
            }
            PdagConnective::Nor => {
                let mut acc = BDD_FALSE;
                for &c in children {
                    acc = self.or(acc, c);
                }
                acc.complement()
            }
            PdagConnective::Xor => {
                let mut acc = BDD_FALSE;
                for &c in children {
                    acc = self.ite(acc, c.complement(), c);
                }
                acc
            }
            PdagConnective::Iff => {
                let mut all_true = BDD_TRUE;
                let mut all_false = BDD_TRUE;
                for &c in children {
                    all_true = self.and(all_true, c);
                    all_false = self.and(all_false, c.complement());
                }
                self.or(all_true, all_false)
            }
            PdagConnective::AtLeast => self.atleast_pdag(children, min.unwrap_or(1)),
        }
    }

    fn atleast_pdag(&mut self, children: &[BddRef], k: usize) -> BddRef {
        if k == 0 {
            return BDD_TRUE;
        }
        if k > children.len() {
            return BDD_FALSE;
        }
        let x = children[0];
        let rest = &children[1..];
        let t = self.atleast_pdag(rest, k - 1);
        let e = self.atleast_pdag(rest, k);
        self.ite(x, t, e)
    }

    pub fn persist(&self, root: BddRef) -> PersistedBdd {
        let mut dense: HashMap<i32, i32> = HashMap::new();
        let mut vars: Vec<u32> = Vec::new();
        let mut highs: Vec<i32> = Vec::new();
        let mut lows: Vec<i32> = Vec::new();
        let root_ref = self.persist_assign(root, &mut dense, &mut vars, &mut highs, &mut lows);
        PersistedBdd {
            var_probs: self.var_probs.clone(),
            vars,
            highs,
            lows,
            root: root_ref,
        }
    }

    fn persist_assign(
        &self,
        f: BddRef,
        dense: &mut HashMap<i32, i32>,
        vars: &mut Vec<u32>,
        highs: &mut Vec<i32>,
        lows: &mut Vec<i32>,
    ) -> i32 {
        if f.is_true() {
            return 1;
        }
        if f.is_false() {
            return -1;
        }
        let reg = f.regular();
        let idx = reg.raw();
        let sign = if f.is_complement() { -1 } else { 1 };
        if let Some(&d) = dense.get(&idx) {
            return sign * d;
        }
        let node = *self.node(reg);
        let h = self.persist_assign(node.high, dense, vars, highs, lows);
        let l = self.persist_assign(node.low, dense, vars, highs, lows);
        let d = vars.len() as i32 + 2;
        vars.push(node.var as u32);
        highs.push(h);
        lows.push(l);
        dense.insert(idx, d);
        sign * d
    }

    pub fn probability(&self, root: BddRef) -> f64 {
        let mut cache = HashMap::new();
        self.prob_inner(root, &mut cache)
    }

    fn prob_inner(&self, f: BddRef, cache: &mut HashMap<i32, f64>) -> f64 {
        if f.is_true() { return 1.0; }
        if f.is_false() { return 0.0; }
        let key = f.raw();
        if let Some(&p) = cache.get(&key) {
            return p;
        }
        let node = self.node(f.regular());
        let p_var = self.var_probs[node.var];
        let is_neg = f.is_complement();
        let p_hi = self.prob_inner(if is_neg { node.high.complement() } else { node.high }, cache);
        let p_lo = self.prob_inner(if is_neg { node.low.complement() } else { node.low }, cache);
        let p = p_var * p_hi + (1.0 - p_var) * p_lo;
        cache.insert(key, p);
        p
    }

    pub fn probability_with_limits(
        &self,
        root: BddRef,
        limit_order: Option<usize>,
        cut_off: Option<f64>,
    ) -> f64 {
        let mut cache = HashMap::new();
        self.prob_inner_limits(root, 0, 1.0, limit_order, cut_off, &mut cache)
    }

    fn prob_inner_limits(
        &self,
        f: BddRef,
        depth: usize,
        p_acc: f64,
        limit_order: Option<usize>,
        cut_off: Option<f64>,
        cache: &mut HashMap<(i32, usize, u64), f64>,
    ) -> f64 {
        if f.is_true() { return 1.0; }
        if f.is_false() { return 0.0; }
        let depth_key = if limit_order.is_some() { depth } else { 0 };
        let p_key    = if cut_off.is_some() { p_acc.to_bits() } else { 0 };
        let key = (f.raw(), depth_key, p_key);
        if let Some(&p) = cache.get(&key) { return p; }
        let node = self.node(f.regular());
        let p_var = self.var_probs[node.var];
        let is_neg = f.is_complement();
        let (hi_child, lo_child) = if is_neg {
            (node.high.complement(), node.low.complement())
        } else {
            (node.high, node.low)
        };
        let pruned_by_order  = limit_order.is_some_and(|n| depth >= n);
        let pruned_by_cutoff = cut_off.is_some_and(|c| p_acc * p_var < c);
        let p_hi = if pruned_by_order || pruned_by_cutoff {
            0.0
        } else {
            self.prob_inner_limits(hi_child, depth + 1, p_acc * p_var, limit_order, cut_off, cache)
        };
        let p_lo = self.prob_inner_limits(lo_child, depth, p_acc, limit_order, cut_off, cache);
        let p = p_var * p_hi + (1.0 - p_var) * p_lo;
        cache.insert(key, p);
        p
    }
}

impl Default for Bdd {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedBdd {
    pub var_probs: Vec<f64>,
    pub vars: Vec<u32>,
    pub highs: Vec<i32>,
    pub lows: Vec<i32>,
    pub root: i32,
}

impl PersistedBdd {
    pub fn node_count(&self) -> usize {
        self.vars.len()
    }

    pub fn save(&self, path: &str) -> Result<()> {
        let bytes = bincode::serialize(self)
            .map_err(|e| PraxisError::Logic(format!("persist serialize: {}", e)))?;
        std::fs::write(path, bytes)
            .map_err(|e| PraxisError::Logic(format!("persist write: {}", e)))?;
        Ok(())
    }

    pub fn load(path: &str) -> Result<PersistedBdd> {
        let bytes = std::fs::read(path)
            .map_err(|e| PraxisError::Logic(format!("persist read: {}", e)))?;
        bincode::deserialize(&bytes)
            .map_err(|e| PraxisError::Logic(format!("persist deserialize: {}", e)))
    }

    pub fn probability(&self) -> f64 {
        let mut memo: HashMap<i32, f64> = HashMap::new();
        self.prob(self.root, &mut memo)
    }

    fn prob(&self, r: i32, memo: &mut HashMap<i32, f64>) -> f64 {
        if r == 1 {
            return 1.0;
        }
        if r == -1 {
            return 0.0;
        }
        if let Some(&p) = memo.get(&r) {
            return p;
        }
        let idx = (r.unsigned_abs() as usize) - 2;
        let var = self.vars[idx] as usize;
        let p_var = self.var_probs[var];
        let (h, l) = if r < 0 {
            (-self.highs[idx], -self.lows[idx])
        } else {
            (self.highs[idx], self.lows[idx])
        };
        let p_hi = self.prob(h, memo);
        let p_lo = self.prob(l, memo);
        let p = p_var * p_hi + (1.0 - p_var) * p_lo;
        memo.insert(r, p);
        p
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::width::compute_dfs_metadata_pdag;
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};

    #[test]
    fn test_bdd_true_is_terminal() {
        assert!(BDD_TRUE.is_terminal());
        assert!(BDD_TRUE.is_true());
        assert!(!BDD_TRUE.is_false());
        assert!(!BDD_TRUE.is_complement());
    }

    #[test]
    fn test_bdd_false_is_terminal() {
        assert!(BDD_FALSE.is_terminal());
        assert!(BDD_FALSE.is_false());
        assert!(!BDD_FALSE.is_true());
        assert!(BDD_FALSE.is_complement());
    }

    #[test]
    fn test_bdd_null() {
        assert!(BDD_NULL.is_null());
        assert!(!BDD_NULL.is_terminal());
    }

    #[test]
    fn test_complement_roundtrip() {
        let r = BddRef(5);
        assert_eq!(r.complement().complement(), r);
    }

    #[test]
    fn test_true_complement_is_false() {
        assert_eq!(BDD_TRUE.complement(), BDD_FALSE);
        assert_eq!(BDD_FALSE.complement(), BDD_TRUE);
    }

    #[test]
    fn test_regular_strips_complement() {
        let r = BddRef(-7);
        assert_eq!(r.regular(), BddRef(7));
        assert!(!r.regular().is_complement());
    }

    #[test]
    fn test_index_positive_ref() {
        assert_eq!(BddRef(4).index(), 4);
    }

    #[test]
    fn test_index_complement_ref() {
        assert_eq!(BddRef(-4).index(), 4);
    }

    #[test]
    fn test_bddref_complement_sign() {
        assert!(!BddRef(3).is_complement());
        assert!(BddRef(-3).is_complement());
    }

    #[test]
    fn test_bddnode_equality_for_unique_table() {
        let n1 = BddNode::new(0, BDD_TRUE, BDD_FALSE);
        let n2 = BddNode::new(0, BDD_TRUE, BDD_FALSE);
        assert_eq!(n1, n2);
    }

    #[test]
    fn test_bddnode_different_fields_not_equal() {
        assert_ne!(
            BddNode::new(0, BDD_TRUE, BDD_FALSE),
            BddNode::new(1, BDD_TRUE, BDD_FALSE)
        );
        assert_ne!(
            BddNode::new(0, BDD_TRUE, BDD_FALSE),
            BddNode::new(0, BDD_FALSE, BDD_TRUE)
        );
    }

    #[test]
    fn test_bddnode_sentinel_is_sentinel() {
        assert!(SENTINEL.is_sentinel());
        assert!(!BddNode::new(0, BDD_TRUE, BDD_FALSE).is_sentinel());
    }

    #[test]
    fn test_bdd_new_empty() {
        let bdd = Bdd::new();
        assert_eq!(bdd.node_count(), 0);
        assert!(!bdd.is_frozen());
        assert!(!bdd.has_var_probs());
    }

    #[test]
    fn test_bdd_freeze_clears_tables() {
        let mut bdd = Bdd::new();
        bdd.compute_insert((BDD_TRUE, BDD_FALSE, BDD_TRUE), BDD_FALSE);
        bdd.freeze();
        assert!(bdd.is_frozen());
        assert!(bdd.compute_get((BDD_TRUE, BDD_FALSE, BDD_TRUE)).is_none());
    }

    #[test]
    fn test_bdd_var_probs() {
        let mut bdd = Bdd::new();
        bdd.set_var_probs(vec![0.1, 0.2, 0.3]);
        assert!(bdd.has_var_probs());
        assert!((bdd.var_prob(0) - 0.1).abs() < 1e-15);
        assert!((bdd.var_prob(2) - 0.3).abs() < 1e-15);
    }

    #[test]
    fn test_bdd_alloc_node_increments_count() {
        let mut bdd = Bdd::new();
        let r = bdd.alloc_node(BddNode::new(0, BDD_TRUE, BDD_FALSE));
        assert_eq!(bdd.node_count(), 1);
        assert!(!r.is_terminal());
        assert!(!r.is_complement());
    }

    #[test]
    fn test_bdd_prob_cache_roundtrip() {
        let mut bdd = Bdd::new();
        let r = bdd.alloc_node(BddNode::new(0, BDD_TRUE, BDD_FALSE));
        bdd.prob_cache_insert(r, 0.42);
        assert!((bdd.prob_cache_get(r).unwrap() - 0.42).abs() < 1e-15);

        assert!((bdd.prob_cache_get(r.complement()).unwrap() - 0.42).abs() < 1e-15);
    }

    #[test]
    fn test_is_terminal_static_methods() {
        assert!(Bdd::is_terminal(BDD_TRUE));
        assert!(Bdd::is_terminal(BDD_FALSE));
        assert!(Bdd::is_true(BDD_TRUE));
        assert!(Bdd::is_false(BDD_FALSE));
        assert!(!Bdd::is_terminal(BddRef(2)));
    }

    #[test]
    fn test_make_node_reduction_rule() {
        let mut bdd = Bdd::new();

        assert_eq!(bdd.make_node(0, BDD_TRUE, BDD_TRUE), BDD_TRUE);
        assert_eq!(bdd.node_count(), 0);
    }

    #[test]
    fn test_make_node_basic() {
        let mut bdd = Bdd::new();
        let r = bdd.make_node(0, BDD_TRUE, BDD_FALSE);
        assert!(!r.is_terminal());
        assert!(!r.is_complement());
        assert_eq!(bdd.node(r).var, 0);
        assert_eq!(bdd.node(r).high, BDD_TRUE);
        assert_eq!(bdd.node(r).low, BDD_FALSE);
    }

    #[test]
    fn test_make_node_canonical_complement_high() {
        let mut bdd = Bdd::new();

        let pos = bdd.make_node(0, BDD_TRUE, BDD_FALSE);
        let neg = bdd.make_node(0, BDD_FALSE, BDD_TRUE);
        assert_eq!(neg, pos.complement());
        assert_eq!(bdd.node_count(), 1);
    }

    #[test]
    fn test_make_node_unique_table_dedup() {
        let mut bdd = Bdd::new();
        let r1 = bdd.make_node(0, BDD_TRUE, BDD_FALSE);
        let r2 = bdd.make_node(0, BDD_TRUE, BDD_FALSE);
        assert_eq!(r1, r2);
        assert_eq!(bdd.node_count(), 1);
    }

    fn two_var_bdd() -> (Bdd, BddRef, BddRef) {
        let mut bdd = Bdd::new();
        let x0 = bdd.make_node(0, BDD_TRUE, BDD_FALSE);
        let x1 = bdd.make_node(1, BDD_TRUE, BDD_FALSE);
        (bdd, x0, x1)
    }

    #[test]
    fn test_ite_f_true() {
        let (mut bdd, x0, x1) = two_var_bdd();
        assert_eq!(bdd.ite(BDD_TRUE, x0, x1), x0);
    }

    #[test]
    fn test_ite_f_false() {
        let (mut bdd, x0, x1) = two_var_bdd();
        assert_eq!(bdd.ite(BDD_FALSE, x0, x1), x1);
    }

    #[test]
    fn test_ite_g_equals_h() {
        let (mut bdd, x0, x1) = two_var_bdd();
        assert_eq!(bdd.ite(x0, x1, x1), x1);
    }

    #[test]
    fn test_ite_g_true_h_false_returns_f() {
        let (mut bdd, x0, _) = two_var_bdd();
        assert_eq!(bdd.ite(x0, BDD_TRUE, BDD_FALSE), x0);
    }

    #[test]
    fn test_ite_g_false_h_true_returns_not_f() {
        let (mut bdd, x0, _) = two_var_bdd();
        assert_eq!(bdd.ite(x0, BDD_FALSE, BDD_TRUE), x0.complement());
    }

    #[test]
    fn test_ite_complement_f_swaps_branches() {

        let (mut bdd, x0, x1) = two_var_bdd();
        let a = bdd.ite(x0.complement(), x1, BDD_FALSE);
        let b = bdd.ite(x0, BDD_FALSE, x1);
        assert_eq!(a, b);
    }

    #[test]
    fn test_and_two_vars_structure() {

        let (mut bdd, x0, x1) = two_var_bdd();
        let and_ref = bdd.and(x0, x1);
        assert!(!and_ref.is_terminal());
        let root = bdd.node(and_ref.regular());
        assert_eq!(root.var, 0);
        assert!(root.low.is_false());
        let hi = bdd.node(root.high);
        assert_eq!(hi.var, 1);
        assert!(hi.high.is_true());
        assert!(hi.low.is_false());
    }

    #[test]
    fn test_or_two_vars_structure() {

        let (mut bdd, x0, x1) = two_var_bdd();
        let or_ref = bdd.or(x0, x1);
        let root = bdd.node(or_ref.regular());
        assert_eq!(root.var, 0);
        assert!(root.high.is_true());
        let lo = bdd.node(root.low.regular());
        assert_eq!(lo.var, 1);
    }

    #[test]
    fn test_ite_compute_cache_prevents_reallocation() {
        let (mut bdd, x0, x1) = two_var_bdd();
        let _ = bdd.and(x0, x1);
        let before = bdd.node_count();
        let _ = bdd.and(x0, x1);
        assert_eq!(bdd.node_count(), before);
    }

    fn build_bdd(ft: &FaultTree) -> (Bdd, BddRef) {
        let pdag = Pdag::from_fault_tree(ft).unwrap();
        let meta = compute_dfs_metadata_pdag(&pdag).unwrap();
        let var_probs = pdag.level_var_probs(ft, &meta.var_of).unwrap();
        Bdd::from_pdag_with_order_and_probs(&pdag, &meta.var_of, var_probs).unwrap()
    }

    fn two_var_ft(connective: Formula) -> FaultTree {
        let mut ft = FaultTree::new("FT", "G").unwrap();
        let mut g = Gate::new("G".to_string(), connective).unwrap();
        g.add_operand("E1".to_string());
        g.add_operand("E2".to_string());
        ft.add_gate(g).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();
        ft
    }

    fn and_ft() -> FaultTree {
        two_var_ft(Formula::And)
    }

    fn or_ft() -> FaultTree {
        two_var_ft(Formula::Or)
    }

    fn single_var_ft() -> FaultTree {
        let mut ft = FaultTree::new("FT", "G").unwrap();
        let mut g = Gate::new("G".to_string(), Formula::Or).unwrap();
        g.add_operand("E1".to_string());
        ft.add_gate(g).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft
    }

    #[test]
    fn test_build_and_pdag_structure() {
        let (bdd, root) = build_bdd(&and_ft());
        assert!(!root.is_terminal());
        let node = bdd.node(root.regular());
        assert_eq!(node.var, 0);
        assert!(node.low.is_false());
        let hi = bdd.node(node.high);
        assert_eq!(hi.var, 1);
        assert!(hi.high.is_true());
        assert!(hi.low.is_false());
    }

    #[test]
    fn test_build_or_pdag_structure() {
        let (bdd, root) = build_bdd(&or_ft());
        let node = bdd.node(root.regular());
        assert_eq!(node.var, 0);
        assert!(node.high.is_true());
        let lo = bdd.node(node.low.regular());
        assert_eq!(lo.var, 1);
    }

    #[test]
    fn test_build_from_pdag_var_probs_loaded() {
        let (bdd, _) = build_bdd(&and_ft());
        assert!(bdd.has_var_probs());
        assert!((bdd.var_prob(0) - 0.1).abs() < 1e-12);
        assert!((bdd.var_prob(1) - 0.2).abs() < 1e-12);
    }

    #[test]
    fn test_build_from_pdag_not_gate() {
        let mut ft = FaultTree::new("FT", "NOT_E1").unwrap();
        let mut g = Gate::new("NOT_E1".to_string(), Formula::Not).unwrap();
        g.add_operand("E1".to_string());
        ft.add_gate(g).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        let (bdd, root) = build_bdd(&ft);
        assert!(root.is_complement());
        assert_eq!(bdd.node(root.regular()).var, 0);
    }

    #[test]
    fn test_build_from_fault_tree() {
        let mut ft = FaultTree::new("FT", "TOP").unwrap();
        let mut top = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top.add_operand("E1".to_string());
        top.add_operand("E2".to_string());
        ft.add_gate(top).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.05).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.03).unwrap())
            .unwrap();

        let (bdd, root) = build_bdd(&ft);
        assert!(!root.is_terminal());
        assert!(bdd.has_var_probs());
    }

    #[test]
    fn test_probability_true() {
        let bdd = Bdd::new();
        assert!((bdd.probability(BDD_TRUE) - 1.0).abs() < 1e-15);
    }

    #[test]
    fn test_probability_false() {
        let bdd = Bdd::new();
        assert!(bdd.probability(BDD_FALSE).abs() < 1e-15);
    }

    #[test]
    fn test_probability_single_var() {
        let (bdd, root) = build_bdd(&single_var_ft());
        assert!((bdd.probability(root) - 0.1).abs() < 1e-12);
    }

    #[test]
    fn test_probability_complement() {
        let (bdd, root) = build_bdd(&single_var_ft());
        assert!((bdd.probability(root.complement()) - 0.9).abs() < 1e-12);
    }

    #[test]
    fn test_probability_and_gate() {
        let (bdd, root) = build_bdd(&and_ft());
        assert!((bdd.probability(root) - 0.02).abs() < 1e-12);
    }

    #[test]
    fn test_probability_or_gate() {
        let (bdd, root) = build_bdd(&or_ft());
        let expected = 0.1 + 0.2 - 0.1 * 0.2;
        assert!((bdd.probability(root) - expected).abs() < 1e-12);
    }

    fn audit_fault_tree() -> FaultTree {
        let mut ft = FaultTree::new("FT", "TOP").unwrap();
        let mut top = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top.add_operand("G1".to_string());
        top.add_operand("C".to_string());
        ft.add_gate(top).unwrap();
        let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        g1.add_operand("A".to_string());
        g1.add_operand("B".to_string());
        ft.add_gate(g1).unwrap();
        ft.add_basic_event(BasicEvent::new("A".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("B".to_string(), 0.2).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("C".to_string(), 0.05).unwrap())
            .unwrap();
        ft
    }

    #[test]
    fn pdag_bdd_probability_and_levels_keyed_by_id() {
        let ft = audit_fault_tree();

        let pdag = Pdag::from_fault_tree(&ft).unwrap();
        let meta = compute_dfs_metadata_pdag(&pdag).unwrap();
        let var_probs = pdag.level_var_probs(&ft, &meta.var_of).unwrap();
        let (bdd, root) =
            Bdd::from_pdag_with_order_and_probs(&pdag, &meta.var_of, var_probs).unwrap();
        let p = bdd.probability(root);

        let expected = 1.0 - (1.0 - 0.1 * 0.2) * (1.0 - 0.05);
        assert!(
            (p - expected).abs() < 1e-12,
            "pdag BDD probability {} differs from analytic {}",
            p,
            expected
        );

        for (id, expected) in [("A", 0.1), ("B", 0.2), ("C", 0.05)] {
            let index = pdag.get_index(id).unwrap();
            let level = *meta.var_of.get(&index).unwrap();
            assert!(
                (bdd.var_prob(level) - expected).abs() < 1e-15,
                "var_prob at level {} for event {} was {}, expected {}",
                level,
                id,
                bdd.var_prob(level),
                expected
            );
        }
    }
}
