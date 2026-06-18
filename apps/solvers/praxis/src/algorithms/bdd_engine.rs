use std::collections::HashMap;

use crate::algorithms::bdd_pdag::{BddConnective, BddPdag, BddPdagNode, NodeIdx};
use crate::error::{PraxisError, Result};

// ---------------------------------------------------------------------------
// BddRef — signed complement-edge reference
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// BddNode — internal non-terminal node
// ---------------------------------------------------------------------------

/// `high` is always non-complement (canonical form enforced by make_node).
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

// ---------------------------------------------------------------------------
// Bdd — the engine
// ---------------------------------------------------------------------------

pub struct Bdd {
    nodes: Vec<BddNode>,
    unique: HashMap<BddNode, BddRef>,
    compute: HashMap<(BddRef, BddRef, BddRef), BddRef>,
    prob_cache: HashMap<BddRef, f64>,
    var_probs: Vec<f64>,
    frozen: bool,
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
        }
    }

    // -----------------------------------------------------------------------
    // Terminal helpers (static)
    // -----------------------------------------------------------------------

    pub fn is_terminal(f: BddRef) -> bool {
        f.is_terminal()
    }

    pub fn is_true(f: BddRef) -> bool {
        f.is_true()
    }

    pub fn is_false(f: BddRef) -> bool {
        f.is_false()
    }

    // -----------------------------------------------------------------------
    // Node access
    // -----------------------------------------------------------------------

    /// Returns the BddNode at f's index.  Panics on terminal or null refs.
    pub fn node(&self, f: BddRef) -> &BddNode {
        debug_assert!(
            !f.is_terminal() && !f.is_null(),
            "Bdd::node called on terminal or null ref {f}"
        );
        &self.nodes[f.index()]
    }

    /// BDD variable position of f.  Returns usize::MAX for terminals.
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

    // -----------------------------------------------------------------------
    // Variable probabilities
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Memory management
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Internal table access
    // -----------------------------------------------------------------------

    pub(crate) fn compute_get(&self, key: (BddRef, BddRef, BddRef)) -> Option<BddRef> {
        self.compute.get(&key).copied()
    }

    pub(crate) fn compute_insert(&mut self, key: (BddRef, BddRef, BddRef), val: BddRef) {
        self.compute.insert(key, val);
    }

    pub(crate) fn unique_get(&self, node: &BddNode) -> Option<BddRef> {
        self.unique.get(node).copied()
    }

    pub(crate) fn unique_insert(&mut self, node: BddNode, r: BddRef) {
        self.unique.insert(node, r);
    }

    pub(crate) fn alloc_node(&mut self, node: BddNode) -> BddRef {
        let idx = self.nodes.len() as i32;
        self.nodes.push(node);
        BddRef(idx)
    }

    #[cfg(test)]
    pub(crate) fn prob_cache_get(&self, f: BddRef) -> Option<f64> {
        self.prob_cache.get(&f.regular()).copied()
    }

    #[cfg(test)]
    pub(crate) fn prob_cache_insert(&mut self, f: BddRef, p: f64) {
        self.prob_cache.insert(f.regular(), p);
    }

    // -----------------------------------------------------------------------
    // Phase 5: core BDD algorithms
    // -----------------------------------------------------------------------

    /// Get-or-create a BDD node with canonical high-non-complement invariant.
    fn make_node(&mut self, var: usize, high: BddRef, low: BddRef) -> BddRef {
        if high == low {
            return high;
        }
        // If high is complement, flip both edges and return complement of result.
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
        if negate { r.complement() } else { r }
    }

    fn top_var(&self, f: BddRef, g: BddRef, h: BddRef) -> usize {
        self.var_of(f).min(self.var_of(g)).min(self.var_of(h))
    }

    /// Cofactor of f at BDD variable position `var` during ITE Shannon expansion.
    ///
    /// Invariant (enforced by callers): `var` == top_var, so f.var >= var always.
    fn ite_cofactor(&self, f: BddRef, var: usize, positive: bool) -> BddRef {
        let reg = f.regular();
        if reg.is_terminal() {
            return f;
        }
        let node = self.node(reg);
        if node.var != var {
            return f; // f's root is below `var`; f doesn't mention var
        }
        let edge = if positive { node.high } else { node.low };
        // Propagate complement: cofactor(!f) = !cofactor(f).
        if f.is_complement() { edge.complement() } else { edge }
    }

    /// If-Then-Else: computes f*g + !f*h.
    ///
    /// Normalizes the triple before the compute-table lookup (matches SCRAM/CUDD):
    ///   1. f non-complement  — if complement, swap g/h and regularize f
    ///   2. g non-complement  — if complement, negate whole result
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

        // Rule 1: ITE(!f, g, h) = ITE(f, h, g)
        if nf.is_complement() {
            nf = nf.complement();
            std::mem::swap(&mut ng, &mut nh);
        }
        // Rule 2: ITE(f, !g, h) = !ITE(f, g, !h)
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

        if negate { result.complement() } else { result }
    }

    pub(crate) fn and(&mut self, f: BddRef, g: BddRef) -> BddRef {
        self.ite(f, g, BDD_FALSE)
    }

    pub(crate) fn or(&mut self, f: BddRef, g: BddRef) -> BddRef {
        self.ite(f, BDD_TRUE, g)
    }

    // -----------------------------------------------------------------------
    // Phase 5: PDAG → BDD construction
    // -----------------------------------------------------------------------

    /// Build a BDD from an already-ordered BddPdag.
    ///
    /// `compute_ordering_and_modules()` must have been called on `pdag` first.
    pub fn build_from_pdag(pdag: &BddPdag) -> Result<(Bdd, BddRef)> {
        let root_idx = pdag.root().ok_or_else(|| {
            PraxisError::Logic("BDD construction: PDAG has no root".to_string())
        })?;

        if pdag.num_variables() > 0 && pdag.variable_order().is_empty() {
            return Err(PraxisError::Logic(
                "BDD construction: variable ordering not set — call compute_ordering_and_modules() first"
                    .to_string(),
            ));
        }

        let var_probs: Vec<f64> = pdag
            .variable_order()
            .iter()
            .map(|&idx| pdag.probability_of(idx).unwrap_or(0.0))
            .collect();

        let mut bdd = Bdd::new();
        bdd.set_var_probs(var_probs);

        let mut cache: HashMap<NodeIdx, BddRef> = HashMap::new();
        let root_ref = build_node_recursive(&mut bdd, pdag, root_idx, &mut cache)?;

        Ok((bdd, root_ref))
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

// ---------------------------------------------------------------------------
// PDAG traversal helpers
// ---------------------------------------------------------------------------

fn build_node_recursive(
    bdd: &mut Bdd,
    pdag: &BddPdag,
    idx: NodeIdx,
    cache: &mut HashMap<NodeIdx, BddRef>,
) -> Result<BddRef> {
    let abs_idx = idx.abs();

    if let Some(&cached) = cache.get(&abs_idx) {
        return Ok(if idx < 0 { cached.complement() } else { cached });
    }

    let node_result = match pdag.node(abs_idx) {
        Some(BddPdagNode::Constant { value, .. }) => {
            if *value { BDD_TRUE } else { BDD_FALSE }
        }

        Some(BddPdagNode::Variable { .. }) => {
            let var = pdag.bdd_pos_of(abs_idx).ok_or_else(|| {
                PraxisError::Logic(format!(
                    "BDD construction: no variable ordering for PDAG node {}",
                    abs_idx
                ))
            })?;
            bdd.make_node(var, BDD_TRUE, BDD_FALSE)
        }

        Some(BddPdagNode::Gate { connective, operands, min_number, .. }) => {
            let conn = *connective;
            let ops: Vec<NodeIdx> = operands.clone();
            let min_n = *min_number;

            match conn {
                BddConnective::And => {
                    let mut acc = BDD_TRUE;
                    for op in ops {
                        let op_ref = build_node_recursive(bdd, pdag, op, cache)?;
                        acc = bdd.and(acc, op_ref);
                    }
                    acc
                }
                BddConnective::Or => {
                    let mut acc = BDD_FALSE;
                    for op in ops {
                        let op_ref = build_node_recursive(bdd, pdag, op, cache)?;
                        acc = bdd.or(acc, op_ref);
                    }
                    acc
                }
                BddConnective::Not => {
                    if ops.len() != 1 {
                        return Err(PraxisError::Logic(
                            "BDD construction: NOT gate must have exactly 1 operand".to_string(),
                        ));
                    }
                    let op_ref = build_node_recursive(bdd, pdag, ops[0], cache)?;
                    op_ref.complement()
                }
                BddConnective::AtLeast => {
                    let k = min_n.unwrap_or(1);
                    build_atleast(bdd, pdag, &ops, k, cache)?
                }
                other => {
                    return Err(PraxisError::Logic(format!(
                        "BDD construction: unsupported gate connective {:?}",
                        other
                    )));
                }
            }
        }

        None => {
            return Err(PraxisError::Logic(format!(
                "BDD construction: PDAG node {} not found",
                abs_idx
            )));
        }
    };

    cache.insert(abs_idx, node_result);
    Ok(if idx < 0 { node_result.complement() } else { node_result })
}

/// Encode AtLeast(k, ops) via Shannon expansion.
fn build_atleast(
    bdd: &mut Bdd,
    pdag: &BddPdag,
    ops: &[NodeIdx],
    k: usize,
    cache: &mut HashMap<NodeIdx, BddRef>,
) -> Result<BddRef> {
    if k == 0 {
        return Ok(BDD_TRUE);
    }
    if k > ops.len() {
        return Ok(BDD_FALSE);
    }
    if k == ops.len() {
        let mut acc = BDD_TRUE;
        for &op in ops {
            let op_ref = build_node_recursive(bdd, pdag, op, cache)?;
            acc = bdd.and(acc, op_ref);
        }
        return Ok(acc);
    }

    let first = build_node_recursive(bdd, pdag, ops[0], cache)?;
    let rest = &ops[1..];
    let t = build_atleast(bdd, pdag, rest, k - 1, cache)?;
    let e = build_atleast(bdd, pdag, rest, k, cache)?;
    Ok(bdd.ite(first, t, e))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::bdd_pdag::{BddConnective, BddPdag};
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};

    // -----------------------------------------------------------------------
    // Phase 4: BddRef / BddNode / Bdd basics
    // -----------------------------------------------------------------------

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
        // complement ref maps to same cache slot
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

    // -----------------------------------------------------------------------
    // Phase 5: make_node
    // -----------------------------------------------------------------------

    #[test]
    fn test_make_node_reduction_rule() {
        let mut bdd = Bdd::new();
        // make_node(v, f, f) == f without allocating a node
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
        // make_node(v, FALSE, TRUE) must equal complement of make_node(v, TRUE, FALSE)
        // and share the same underlying node slot.
        let pos = bdd.make_node(0, BDD_TRUE, BDD_FALSE);
        let neg = bdd.make_node(0, BDD_FALSE, BDD_TRUE);
        assert_eq!(neg, pos.complement());
        assert_eq!(bdd.node_count(), 1); // only one physical node
    }

    #[test]
    fn test_make_node_unique_table_dedup() {
        let mut bdd = Bdd::new();
        let r1 = bdd.make_node(0, BDD_TRUE, BDD_FALSE);
        let r2 = bdd.make_node(0, BDD_TRUE, BDD_FALSE);
        assert_eq!(r1, r2);
        assert_eq!(bdd.node_count(), 1);
    }

    // -----------------------------------------------------------------------
    // Phase 5: ITE
    // -----------------------------------------------------------------------

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
        // ITE(!f, g, h) = ITE(f, h, g)  i.e., the two calls produce equal BDDs.
        let (mut bdd, x0, x1) = two_var_bdd();
        let a = bdd.ite(x0.complement(), x1, BDD_FALSE);
        let b = bdd.ite(x0, BDD_FALSE, x1);
        assert_eq!(a, b);
    }

    #[test]
    fn test_and_two_vars_structure() {
        // AND(x0, x1): root var=0, low=FALSE, high=x1 node (var=1, high=T, low=F)
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
        // OR(x0, x1): root var=0, high=TRUE, low=x1 node
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

    // -----------------------------------------------------------------------
    // Phase 5: build_from_pdag
    // -----------------------------------------------------------------------

    fn and_pdag() -> BddPdag {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), 0.1);
        let e2 = pdag.add_variable("E2".to_string(), 0.2);
        let g = pdag
            .add_gate("G".to_string(), BddConnective::And, vec![e1, e2], None)
            .unwrap();
        pdag.set_root(g).unwrap();
        pdag.compute_ordering_and_modules().unwrap();
        pdag
    }

    fn or_pdag() -> BddPdag {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), 0.1);
        let e2 = pdag.add_variable("E2".to_string(), 0.2);
        let g = pdag
            .add_gate("G".to_string(), BddConnective::Or, vec![e1, e2], None)
            .unwrap();
        pdag.set_root(g).unwrap();
        pdag.compute_ordering_and_modules().unwrap();
        pdag
    }

    #[test]
    fn test_build_and_pdag_structure() {
        let (bdd, root) = Bdd::build_from_pdag(&and_pdag()).unwrap();
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
        let (bdd, root) = Bdd::build_from_pdag(&or_pdag()).unwrap();
        let node = bdd.node(root.regular());
        assert_eq!(node.var, 0);
        assert!(node.high.is_true());
        let lo = bdd.node(node.low.regular());
        assert_eq!(lo.var, 1);
    }

    #[test]
    fn test_build_from_pdag_var_probs_loaded() {
        let (bdd, _) = Bdd::build_from_pdag(&and_pdag()).unwrap();
        assert!(bdd.has_var_probs());
        assert!((bdd.var_prob(0) - 0.1).abs() < 1e-12);
        assert!((bdd.var_prob(1) - 0.2).abs() < 1e-12);
    }

    #[test]
    fn test_build_from_pdag_no_root_error() {
        assert!(Bdd::build_from_pdag(&BddPdag::new()).is_err());
    }

    #[test]
    fn test_build_from_pdag_no_ordering_error() {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), 0.1);
        let e2 = pdag.add_variable("E2".to_string(), 0.2);
        let g = pdag
            .add_gate("G".to_string(), BddConnective::And, vec![e1, e2], None)
            .unwrap();
        pdag.set_root(g).unwrap();
        // omit compute_ordering_and_modules
        assert!(Bdd::build_from_pdag(&pdag).is_err());
    }

    #[test]
    fn test_build_from_pdag_not_gate() {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), 0.1);
        let not_e1 = pdag
            .add_gate("NOT_E1".to_string(), BddConnective::Not, vec![e1], None)
            .unwrap();
        pdag.set_root(not_e1).unwrap();
        pdag.set_variable_order(vec![e1]);
        let (bdd, root) = Bdd::build_from_pdag(&pdag).unwrap();
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

        let mut pdag = BddPdag::from_fault_tree(&ft).unwrap();
        pdag.compute_ordering_and_modules().unwrap();

        let (bdd, root) = Bdd::build_from_pdag(&pdag).unwrap();
        assert!(!root.is_terminal());
        assert!(bdd.has_var_probs());
    }

    // -----------------------------------------------------------------------
    // Phase 8: probability
    // -----------------------------------------------------------------------

    fn single_var_pdag() -> BddPdag {
        let mut pdag = BddPdag::new();
        let e1 = pdag.add_variable("E1".to_string(), 0.1);
        pdag.set_root(e1).unwrap();
        pdag.set_variable_order(vec![e1]);
        pdag
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
        let (bdd, root) = Bdd::build_from_pdag(&single_var_pdag()).unwrap();
        assert!((bdd.probability(root) - 0.1).abs() < 1e-12);
    }

    #[test]
    fn test_probability_complement() {
        let (bdd, root) = Bdd::build_from_pdag(&single_var_pdag()).unwrap();
        assert!((bdd.probability(root.complement()) - 0.9).abs() < 1e-12);
    }

    #[test]
    fn test_probability_and_gate() {
        let (bdd, root) = Bdd::build_from_pdag(&and_pdag()).unwrap();
        assert!((bdd.probability(root) - 0.02).abs() < 1e-12);
    }

    #[test]
    fn test_probability_or_gate() {
        let (bdd, root) = Bdd::build_from_pdag(&or_pdag()).unwrap();
        let expected = 0.1 + 0.2 - 0.1 * 0.2;
        assert!((bdd.probability(root) - expected).abs() < 1e-12);
    }
}
