use std::collections::HashMap;

use crate::algorithms::bdd_engine::{Bdd, BddRef};
use crate::algorithms::pdag::NodeIndex;

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub struct TddRef(u32);

pub const TDD_EMPTY: TddRef = TddRef(0);
pub const TDD_BASE: TddRef = TddRef(1);

impl TddRef {
    pub fn is_empty(self) -> bool {
        self.0 == 0
    }
    pub fn is_base(self) -> bool {
        self.0 == 1
    }
    pub fn is_terminal(self) -> bool {
        self.0 <= 1
    }
    fn index(self) -> usize {
        self.0 as usize
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
struct TddNode {
    var: usize,
    pos: TddRef,
    neg: TddRef,
    absent: TddRef,
}

const SENTINEL: TddNode = TddNode {
    var: usize::MAX,
    pos: TDD_EMPTY,
    neg: TDD_EMPTY,
    absent: TDD_EMPTY,
};

pub struct TddEngine {
    nodes: Vec<TddNode>,
    unique: HashMap<TddNode, TddRef>,
    diff_cache: HashMap<(TddRef, TddRef), TddRef>,
}

impl Default for TddEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl TddEngine {
    pub fn new() -> Self {
        TddEngine {
            nodes: vec![SENTINEL, SENTINEL],
            unique: HashMap::new(),
            diff_cache: HashMap::new(),
        }
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len().saturating_sub(2)
    }

    fn node(&self, f: TddRef) -> TddNode {
        self.nodes[f.index()]
    }

    fn var_of(&self, f: TddRef) -> usize {
        if f.is_terminal() {
            usize::MAX
        } else {
            self.nodes[f.index()].var
        }
    }

    fn make(&mut self, var: usize, pos: TddRef, neg: TddRef, absent: TddRef) -> TddRef {
        if pos.is_empty() && neg.is_empty() {
            return absent;
        }
        let key = TddNode {
            var,
            pos,
            neg,
            absent,
        };
        if let Some(&r) = self.unique.get(&key) {
            return r;
        }
        let r = TddRef(self.nodes.len() as u32);
        self.nodes.push(key);
        self.unique.insert(key, r);
        r
    }

    fn difference(&mut self, f: TddRef, g: TddRef) -> TddRef {
        if f.is_empty() {
            return TDD_EMPTY;
        }
        if g.is_empty() {
            return f;
        }
        if f == g {
            return TDD_EMPTY;
        }
        let key = (f, g);
        if let Some(&r) = self.diff_cache.get(&key) {
            return r;
        }
        let fv = self.var_of(f);
        let gv = self.var_of(g);
        let r = if fv == gv {
            let a = self.node(f);
            let b = self.node(g);
            let p = self.difference(a.pos, b.pos);
            let n = self.difference(a.neg, b.neg);
            let ab = self.difference(a.absent, b.absent);
            self.make(fv, p, n, ab)
        } else if fv < gv {
            let a = self.node(f);
            let ab = self.difference(a.absent, g);
            self.make(fv, a.pos, a.neg, ab)
        } else {
            let b = self.node(g);
            self.difference(f, b.absent)
        };
        self.diff_cache.insert(key, r);
        r
    }

    pub fn count(&self, root: TddRef) -> u128 {
        let mut memo = HashMap::new();
        self.count_rec(root, &mut memo)
    }

    pub fn rare_event_probability(&self, root: TddRef, var_prob: &[f64]) -> f64 {
        let mut memo = HashMap::new();
        self.re_rec(root, var_prob, &mut memo)
    }

    fn re_rec(&self, f: TddRef, var_prob: &[f64], memo: &mut HashMap<TddRef, f64>) -> f64 {
        if f.is_empty() {
            return 0.0;
        }
        if f.is_base() {
            return 1.0;
        }
        if let Some(&p) = memo.get(&f) {
            return p;
        }
        let n = self.node(f);
        let p = var_prob[n.var];
        let r = p * self.re_rec(n.pos, var_prob, memo)
            + (1.0 - p) * self.re_rec(n.neg, var_prob, memo)
            + self.re_rec(n.absent, var_prob, memo);
        memo.insert(f, r);
        r
    }

    fn count_rec(&self, f: TddRef, memo: &mut HashMap<TddRef, u128>) -> u128 {
        if f.is_empty() {
            return 0;
        }
        if f.is_base() {
            return 1;
        }
        if let Some(&c) = memo.get(&f) {
            return c;
        }
        let n = self.node(f);
        let r = self.count_rec(n.pos, memo)
            + self.count_rec(n.neg, memo)
            + self.count_rec(n.absent, memo);
        memo.insert(f, r);
        r
    }

    pub fn cubes(&self, root: TddRef, var_event: &[NodeIndex]) -> Vec<Vec<i32>> {
        let mut out = Vec::new();
        let mut cur = Vec::new();
        self.collect(root, var_event, &mut cur, &mut out);
        for c in out.iter_mut() {
            c.sort_by_key(|x| x.abs());
        }
        out
    }

    fn collect(
        &self,
        f: TddRef,
        var_event: &[NodeIndex],
        cur: &mut Vec<i32>,
        out: &mut Vec<Vec<i32>>,
    ) {
        if f.is_empty() {
            return;
        }
        if f.is_base() {
            out.push(cur.clone());
            return;
        }
        let n = self.node(f);
        let ev = var_event[n.var];
        cur.push(ev);
        self.collect(n.pos, var_event, cur, out);
        cur.pop();
        cur.push(-ev);
        self.collect(n.neg, var_event, cur, out);
        cur.pop();
        self.collect(n.absent, var_event, cur, out);
    }

    pub fn extract(
        &self,
        root: TddRef,
        var_event: &[NodeIndex],
        var_prob: &[f64],
        max_order: usize,
        min_prob: f64,
    ) -> Vec<(Vec<i32>, f64)> {
        let mut out = Vec::new();
        let mut cur = Vec::new();
        self.extract_rec(
            root, var_event, var_prob, max_order, min_prob, 1.0, &mut cur, &mut out,
        );
        for (c, _) in out.iter_mut() {
            c.sort_by_key(|x| x.abs());
        }
        out
    }

    #[allow(clippy::too_many_arguments)]
    fn extract_rec(
        &self,
        f: TddRef,
        var_event: &[NodeIndex],
        var_prob: &[f64],
        max_order: usize,
        min_prob: f64,
        prob: f64,
        cur: &mut Vec<i32>,
        out: &mut Vec<(Vec<i32>, f64)>,
    ) {
        if prob < min_prob || f.is_empty() {
            return;
        }
        if f.is_base() {
            out.push((cur.clone(), prob));
            return;
        }
        let n = self.node(f);
        let ev = var_event[n.var];
        let p = var_prob[n.var];
        if cur.len() < max_order {
            cur.push(ev);
            self.extract_rec(
                n.pos,
                var_event,
                var_prob,
                max_order,
                min_prob,
                prob * p,
                cur,
                out,
            );
            cur.pop();
            cur.push(-ev);
            self.extract_rec(
                n.neg,
                var_event,
                var_prob,
                max_order,
                min_prob,
                prob * (1.0 - p),
                cur,
                out,
            );
            cur.pop();
        }
        self.extract_rec(
            n.absent, var_event, var_prob, max_order, min_prob, prob, cur, out,
        );
    }
}

pub fn prime_tdd(fbdd: &mut Bdd, root: BddRef) -> (TddEngine, TddRef) {
    let mut t = TddEngine::new();
    let mut memo: HashMap<i32, TddRef> = HashMap::new();
    let r = tdd_rec(fbdd, root, &mut t, &mut memo);
    (t, r)
}

fn tdd_rec(
    fbdd: &mut Bdd,
    f: BddRef,
    t: &mut TddEngine,
    memo: &mut HashMap<i32, TddRef>,
) -> TddRef {
    if f.is_false() {
        return TDD_EMPTY;
    }
    if f.is_true() {
        return TDD_BASE;
    }
    if let Some(&r) = memo.get(&f.raw()) {
        return r;
    }
    let reg = f.regular();
    let node = *fbdd.node(reg);
    let v = node.var;
    let (f1, f0) = if f.is_complement() {
        (node.high.complement(), node.low.complement())
    } else {
        (node.high, node.low)
    };
    let fc = fbdd.and(f0, f1);
    let pc = tdd_rec(fbdd, fc, t, memo);
    let p1 = tdd_rec(fbdd, f1, t, memo);
    let p0 = tdd_rec(fbdd, f0, t, memo);
    let pos = t.difference(p1, pc);
    let neg = t.difference(p0, pc);
    let result = t.make(v, pos, neg, pc);
    memo.insert(f.raw(), result);
    result
}
