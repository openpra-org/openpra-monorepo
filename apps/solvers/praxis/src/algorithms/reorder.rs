use std::collections::HashMap;
use std::time::{Duration, Instant};

use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::analysis::width::compute_dfs_metadata_pdag;

const TRUE: i32 = 1;
const FALSE: i32 = -1;

#[derive(Clone, Copy)]
pub(crate) enum RConn {
    And,
    Or,
    Not,
    Nand,
    Nor,
    Xor,
    Iff,
    AtLeast,
    Null,
}

pub(crate) enum RKind<'a> {
    Variable,
    Constant(bool),
    Gate {
        conn: RConn,
        operands: &'a [NodeIndex],
        min: Option<usize>,
    },
}

pub(crate) trait ReorderSource {
    fn r_variable_order(&self) -> Vec<NodeIndex>;
    fn r_root(&self) -> Option<NodeIndex>;
    fn r_global_complement(&self) -> bool;
    fn r_kind(&self, idx: NodeIndex) -> Option<RKind<'_>>;
}

fn rconn_from_pdag(c: Connective) -> RConn {
    match c {
        Connective::And => RConn::And,
        Connective::Or => RConn::Or,
        Connective::Not => RConn::Not,
        Connective::Nand => RConn::Nand,
        Connective::Nor => RConn::Nor,
        Connective::Xor => RConn::Xor,
        Connective::Iff => RConn::Iff,
        Connective::AtLeast => RConn::AtLeast,
        Connective::Null => RConn::Null,
    }
}

impl ReorderSource for Pdag {
    fn r_variable_order(&self) -> Vec<NodeIndex> {
        compute_dfs_metadata_pdag(self)
            .map(|m| m.variable_order)
            .unwrap_or_default()
    }

    fn r_root(&self) -> Option<NodeIndex> {
        self.root()
    }

    fn r_global_complement(&self) -> bool {
        self.complement()
    }

    fn r_kind(&self, idx: NodeIndex) -> Option<RKind<'_>> {
        match self.get_node(idx.abs())? {
            PdagNode::BasicEvent { .. } => Some(RKind::Variable),
            PdagNode::Constant { value, .. } => Some(RKind::Constant(*value)),
            PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            } => Some(RKind::Gate {
                conn: rconn_from_pdag(*connective),
                operands,
                min: *min_number,
            }),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReorderMethod {
    Sift,
    Gsift,
    Ils,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
struct Node {
    var: usize,
    high: i32,
    low: i32,
}

struct RBdd {
    nodes: Vec<Node>,
    unique: Vec<HashMap<(i32, i32), i32>>,
    var_at_level: Vec<usize>,
    level_of: Vec<usize>,
    deadline: Instant,
    aborted: bool,
    ticks: usize,
}

fn comp(r: i32) -> i32 {
    -r
}

fn is_terminal(r: i32) -> bool {
    r.abs() == 1
}

fn splitmix(s: &mut u64) -> u64 {
    *s = s.wrapping_add(0x9E3779B97F4A7C15);
    let mut z = *s;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

impl RBdd {
    fn new(nvars: usize, deadline: Instant) -> Self {
        let sentinel = Node {
            var: usize::MAX,
            high: TRUE,
            low: FALSE,
        };
        RBdd {
            nodes: vec![sentinel, sentinel],
            unique: (0..nvars).map(|_| HashMap::new()).collect(),
            var_at_level: (0..nvars).collect(),
            level_of: (0..nvars).collect(),
            deadline,
            aborted: false,
            ticks: 0,
        }
    }

    fn node(&self, r: i32) -> Node {
        self.nodes[r.unsigned_abs() as usize]
    }

    fn make(&mut self, var: usize, high: i32, low: i32) -> i32 {
        self.ticks += 1;
        if self.ticks & 0xFFFF == 0 && Instant::now() >= self.deadline {
            self.aborted = true;
        }
        if self.aborted {
            return FALSE;
        }
        if high == low {
            return high;
        }
        let (ch, cl, negate) = if high < 0 {
            (comp(high), comp(low), true)
        } else {
            (high, low, false)
        };
        let key = (ch, cl);
        if let Some(&r) = self.unique[var].get(&key) {
            return if negate { comp(r) } else { r };
        }
        let idx = self.nodes.len() as i32;
        self.nodes.push(Node {
            var,
            high: ch,
            low: cl,
        });
        self.unique[var].insert(key, idx);
        if negate {
            comp(idx)
        } else {
            idx
        }
    }

    fn cofactor(&self, r: i32, var: usize, hi: bool) -> i32 {
        if is_terminal(r) {
            return r;
        }
        let n = self.node(r);
        if n.var != var {
            return r;
        }
        let edge = if hi { n.high } else { n.low };
        if r < 0 {
            comp(edge)
        } else {
            edge
        }
    }

    fn ite(&mut self, f: i32, g: i32, h: i32, memo: &mut HashMap<(i32, i32, i32), i32>) -> i32 {
        if f == TRUE {
            return g;
        }
        if f == FALSE {
            return h;
        }
        if g == h {
            return g;
        }
        if g == TRUE && h == FALSE {
            return f;
        }
        if let Some(&r) = memo.get(&(f, g, h)) {
            return r;
        }
        let topv = [f, g, h]
            .iter()
            .filter(|&&x| !is_terminal(x))
            .map(|&x| self.node(x).var)
            .min_by_key(|&v| self.level_of[v])
            .unwrap();
        let f1 = self.cofactor(f, topv, true);
        let g1 = self.cofactor(g, topv, true);
        let h1 = self.cofactor(h, topv, true);
        let f0 = self.cofactor(f, topv, false);
        let g0 = self.cofactor(g, topv, false);
        let h0 = self.cofactor(h, topv, false);
        let t = self.ite(f1, g1, h1, memo);
        let e = self.ite(f0, g0, h0, memo);
        let r = self.make(topv, t, e);
        memo.insert((f, g, h), r);
        r
    }

    fn and(&mut self, f: i32, g: i32, memo: &mut HashMap<(i32, i32, i32), i32>) -> i32 {
        self.ite(f, g, FALSE, memo)
    }

    fn or(&mut self, f: i32, g: i32, memo: &mut HashMap<(i32, i32, i32), i32>) -> i32 {
        self.ite(f, TRUE, g, memo)
    }

    fn reachable_count(&self, root: i32) -> usize {
        let mut seen = vec![false; self.nodes.len()];
        let mut stack = vec![root];
        let mut count = 0;
        while let Some(r) = stack.pop() {
            if is_terminal(r) {
                continue;
            }
            let i = r.unsigned_abs() as usize;
            if seen[i] {
                continue;
            }
            seen[i] = true;
            count += 1;
            let n = self.nodes[i];
            stack.push(n.high);
            stack.push(n.low);
        }
        count
    }

    fn swap(&mut self, level: usize) {
        let x = self.var_at_level[level];
        let y = self.var_at_level[level + 1];
        let xlist: Vec<i32> = self.unique[x].values().copied().collect();
        self.unique[x].clear();
        let mut restructure: Vec<i32> = Vec::new();
        for i in xlist {
            let f = self.nodes[i as usize];
            let dep = (!is_terminal(f.high) && self.nodes[f.high.unsigned_abs() as usize].var == y)
                || (!is_terminal(f.low) && self.nodes[f.low.unsigned_abs() as usize].var == y);
            if dep {
                restructure.push(i);
            } else {
                self.unique[x].insert((f.high, f.low), i);
            }
        }
        for i in restructure {
            let f = self.nodes[i as usize];
            let f1 = f.high;
            let f0 = f.low;
            let f11 = self.cofactor(f1, y, true);
            let f10 = self.cofactor(f1, y, false);
            let f01 = self.cofactor(f0, y, true);
            let f00 = self.cofactor(f0, y, false);
            let nt = self.make(x, f11, f01);
            let ne = self.make(x, f10, f00);
            self.nodes[i as usize] = Node {
                var: y,
                high: nt,
                low: ne,
            };
            self.unique[y].insert((nt, ne), i);
        }
        self.var_at_level.swap(level, level + 1);
        self.level_of[x] = level + 1;
        self.level_of[y] = level;
    }

    fn gc(&mut self, root: i32) -> i32 {
        let mut remap: HashMap<i32, i32> = HashMap::new();
        let mut new_nodes = vec![self.nodes[0], self.nodes[1]];
        let mut new_unique: Vec<HashMap<(i32, i32), i32>> =
            (0..self.unique.len()).map(|_| HashMap::new()).collect();
        let new_root = self.gc_copy(root, &mut remap, &mut new_nodes, &mut new_unique);
        self.nodes = new_nodes;
        self.unique = new_unique;
        new_root
    }

    fn gc_copy(
        &self,
        r: i32,
        remap: &mut HashMap<i32, i32>,
        new_nodes: &mut Vec<Node>,
        new_unique: &mut [HashMap<(i32, i32), i32>],
    ) -> i32 {
        if is_terminal(r) {
            return r;
        }
        let idx = r.unsigned_abs() as i32;
        if let Some(&ni) = remap.get(&idx) {
            return if r < 0 { comp(ni) } else { ni };
        }
        let n = self.nodes[idx as usize];
        let nh = self.gc_copy(n.high, remap, new_nodes, new_unique);
        let nl = self.gc_copy(n.low, remap, new_nodes, new_unique);
        let ni = new_nodes.len() as i32;
        new_nodes.push(Node {
            var: n.var,
            high: nh,
            low: nl,
        });
        new_unique[n.var].insert((nh, nl), ni);
        remap.insert(idx, ni);
        if r < 0 {
            comp(ni)
        } else {
            ni
        }
    }
}

fn build_pdag<S: ReorderSource>(rb: &mut RBdd, source: &S, var_of: &HashMap<NodeIndex, usize>) -> i32 {
    let root = match source.r_root() {
        Some(r) => r,
        None => return TRUE,
    };
    let mut memo: HashMap<NodeIndex, i32> = HashMap::new();
    let mut imemo: HashMap<(i32, i32, i32), i32> = HashMap::new();
    let r = build_node(rb, source, root.abs(), var_of, &mut memo, &mut imemo);
    let out = if root < 0 { comp(r) } else { r };
    if source.r_global_complement() {
        comp(out)
    } else {
        out
    }
}

fn build_node<S: ReorderSource>(
    rb: &mut RBdd,
    source: &S,
    idx: NodeIndex,
    var_of: &HashMap<NodeIndex, usize>,
    memo: &mut HashMap<NodeIndex, i32>,
    imemo: &mut HashMap<(i32, i32, i32), i32>,
) -> i32 {
    let a = idx.abs();
    if let Some(&r) = memo.get(&a) {
        return r;
    }
    let r = match source.r_kind(a) {
        Some(RKind::Variable) => rb.make(var_of[&a], TRUE, FALSE),
        Some(RKind::Constant(value)) => {
            if value {
                TRUE
            } else {
                FALSE
            }
        }
        Some(RKind::Gate { conn, operands, min }) => {
            let ops = operands.to_vec();
            let mut kids = Vec::with_capacity(ops.len());
            for op in &ops {
                let c = build_node(rb, source, op.abs(), var_of, memo, imemo);
                kids.push(if *op < 0 { comp(c) } else { c });
            }
            combine(rb, conn, &kids, min, imemo)
        }
        None => FALSE,
    };
    memo.insert(a, r);
    r
}

fn combine(
    rb: &mut RBdd,
    conn: RConn,
    kids: &[i32],
    min: Option<usize>,
    imemo: &mut HashMap<(i32, i32, i32), i32>,
) -> i32 {
    match conn {
        RConn::And => {
            let mut acc = TRUE;
            for &c in kids {
                acc = rb.and(acc, c, imemo);
            }
            acc
        }
        RConn::Or => {
            let mut acc = FALSE;
            for &c in kids {
                acc = rb.or(acc, c, imemo);
            }
            acc
        }
        RConn::Not => kids.first().map(|&c| comp(c)).unwrap_or(FALSE),
        RConn::Nand => {
            let mut acc = TRUE;
            for &c in kids {
                acc = rb.and(acc, c, imemo);
            }
            comp(acc)
        }
        RConn::Nor => {
            let mut acc = FALSE;
            for &c in kids {
                acc = rb.or(acc, c, imemo);
            }
            comp(acc)
        }
        RConn::Xor => {
            let mut acc = FALSE;
            for &c in kids {
                acc = rb.ite(acc, comp(c), c, imemo);
            }
            acc
        }
        RConn::Iff => {
            let mut at = TRUE;
            let mut af = TRUE;
            for &c in kids {
                at = rb.and(at, c, imemo);
                af = rb.and(af, comp(c), imemo);
            }
            rb.or(at, af, imemo)
        }
        RConn::AtLeast => atleast(rb, kids, min.unwrap_or(1), imemo),
        RConn::Null => kids.first().copied().unwrap_or(TRUE),
    }
}

fn atleast(rb: &mut RBdd, kids: &[i32], k: usize, imemo: &mut HashMap<(i32, i32, i32), i32>) -> i32 {
    if k == 0 {
        return TRUE;
    }
    if k > kids.len() {
        return FALSE;
    }
    let x = kids[0];
    let rest = &kids[1..];
    let t = atleast(rb, rest, k - 1, imemo);
    let e = atleast(rb, rest, k, imemo);
    rb.ite(x, t, e, imemo)
}

fn sift_swap(rb: &mut RBdd, mut root: i32, deadline: Instant) -> i32 {
    let n = rb.var_at_level.len();
    for v in 0..n {
        if Instant::now() >= deadline {
            break;
        }
        let mut lev = rb.level_of[v];
        let mut best_size = rb.reachable_count(root);
        let mut best_lev = lev;
        while lev + 1 < n {
            rb.swap(lev);
            lev += 1;
            let s = rb.reachable_count(root);
            if s < best_size {
                best_size = s;
                best_lev = lev;
            }
        }
        while lev > 0 {
            rb.swap(lev - 1);
            lev -= 1;
            let s = rb.reachable_count(root);
            if s < best_size {
                best_size = s;
                best_lev = lev;
            }
        }
        while lev < best_lev {
            rb.swap(lev);
            lev += 1;
        }
        root = rb.gc(root);
    }
    root
}

fn move_var(rb: &mut RBdd, from: usize, to: usize) {
    if from < to {
        for l in from..to {
            rb.swap(l);
        }
    } else {
        for l in (to..from).rev() {
            rb.swap(l);
        }
    }
}

fn detect_groups(rb: &mut RBdd, root: i32) -> Vec<Vec<usize>> {
    let n = rb.var_at_level.len();
    if n == 0 {
        return Vec::new();
    }
    let base = rb.reachable_count(root);
    let mut groups: Vec<Vec<usize>> = Vec::new();
    let mut cur = vec![rb.var_at_level[0]];
    for l in 0..n.saturating_sub(1) {
        rb.swap(l);
        let s = rb.reachable_count(root);
        rb.swap(l);
        if s == base {
            cur.push(rb.var_at_level[l + 1]);
        } else {
            groups.push(cur.clone());
            cur = vec![rb.var_at_level[l + 1]];
        }
    }
    groups.push(cur);
    groups
}

fn sift_group(rb: &mut RBdd, root: i32, a: usize, b: usize) -> i32 {
    let n = rb.var_at_level.len();
    let mut best_size = rb.reachable_count(root);
    let mut top = a;
    let mut bot = b;
    let mut best_pos = top;
    while bot + 1 < n {
        move_var(rb, bot + 1, top);
        top += 1;
        bot += 1;
        let s = rb.reachable_count(root);
        if s < best_size {
            best_size = s;
            best_pos = top;
        }
    }
    while top > 0 {
        move_var(rb, top - 1, bot);
        top -= 1;
        bot -= 1;
        let s = rb.reachable_count(root);
        if s < best_size {
            best_size = s;
            best_pos = top;
        }
    }
    while top < best_pos {
        move_var(rb, bot + 1, top);
        top += 1;
        bot += 1;
    }
    rb.gc(root)
}

fn gsift_swap(rb: &mut RBdd, root: i32, deadline: Instant) -> i32 {
    let half = Instant::now() + (deadline - Instant::now()) / 2;
    let mut root = sift_swap(rb, root, half);
    if Instant::now() >= deadline {
        return root;
    }
    let groups = detect_groups(rb, root);
    root = rb.gc(root);
    for grp in &groups {
        if Instant::now() >= deadline {
            break;
        }
        if grp.len() < 2 {
            continue;
        }
        let a = grp.iter().map(|&v| rb.level_of[v]).min().unwrap();
        let b = grp.iter().map(|&v| rb.level_of[v]).max().unwrap();
        if b - a + 1 != grp.len() {
            continue;
        }
        root = sift_group(rb, root, a, b);
    }
    root
}

fn restore_order(rb: &mut RBdd, target: &[usize]) {
    for l in 0..target.len() {
        let v = target[l];
        let cur = rb.level_of[v];
        if cur != l {
            move_var(rb, cur, l);
        }
    }
}

fn ils_swap(rb: &mut RBdd, mut root: i32, deadline: Instant) {
    let n = rb.var_at_level.len();
    if n < 2 {
        return;
    }
    root = sift_swap(rb, root, deadline);
    let mut best_size = rb.reachable_count(root);
    let mut best_order = rb.var_at_level.clone();
    let mut rng = 0x9e3779b97f4a7c15u64;
    let k = (n / 4).max(2);
    while Instant::now() < deadline {
        for _ in 0..k {
            let l = (splitmix(&mut rng) as usize) % (n - 1);
            rb.swap(l);
        }
        root = rb.gc(root);
        root = sift_swap(rb, root, deadline);
        if rb.aborted {
            break;
        }
        let sz = rb.reachable_count(root);
        if sz < best_size {
            best_size = sz;
            best_order = rb.var_at_level.clone();
        } else {
            restore_order(rb, &best_order);
            root = rb.gc(root);
        }
    }
}

pub(crate) fn best_order<S: ReorderSource>(
    source: &S,
    method: ReorderMethod,
    budget: Duration,
) -> Vec<NodeIndex> {
    let seed = source.r_variable_order();
    let n = seed.len();
    if n < 2 {
        return seed;
    }
    let deadline = Instant::now() + budget;
    let mut var_of: HashMap<NodeIndex, usize> = HashMap::new();
    for (pos, &idx) in seed.iter().enumerate() {
        var_of.insert(idx.abs(), pos);
    }
    let mut rb = RBdd::new(n, deadline);
    let root = build_pdag(&mut rb, source, &var_of);
    if rb.aborted {
        return seed;
    }
    match method {
        ReorderMethod::Sift => {
            sift_swap(&mut rb, root, deadline);
        }
        ReorderMethod::Gsift => {
            gsift_swap(&mut rb, root, deadline);
        }
        ReorderMethod::Ils => {
            ils_swap(&mut rb, root, deadline);
        }
    }
    rb.var_at_level.iter().map(|&pos| seed[pos]).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::bdd_engine::Bdd;
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};

    fn sample_ft() -> FaultTree {
        let mut ft = FaultTree::new("FT", "top").unwrap();
        let mut top = Gate::new("top".to_string(), Formula::Or).unwrap();
        for g in ["g1", "g2", "g3"] {
            top.add_operand(g.to_string());
        }
        ft.add_gate(top).unwrap();
        for (g, x, y) in [("g1", "a", "b"), ("g2", "c", "d"), ("g3", "e", "f")] {
            let mut gate = Gate::new(g.to_string(), Formula::And).unwrap();
            gate.add_operand(x.to_string());
            gate.add_operand(y.to_string());
            ft.add_gate(gate).unwrap();
        }
        for (e, p) in [
            ("a", 0.1),
            ("b", 0.2),
            ("c", 0.3),
            ("d", 0.15),
            ("e", 0.25),
            ("f", 0.05),
        ] {
            ft.add_basic_event(BasicEvent::new(e.to_string(), p).unwrap())
                .unwrap();
        }
        ft
    }

    fn prob_with_order(pdag: &Pdag, ft: &FaultTree, order: &[NodeIndex]) -> f64 {
        let mut var_of: HashMap<NodeIndex, usize> = HashMap::new();
        for (pos, &idx) in order.iter().enumerate() {
            var_of.insert(idx.abs(), pos);
        }
        let var_probs = pdag.level_var_probs(ft, &var_of).unwrap();
        let (bdd, root) =
            Bdd::from_pdag_with_order_and_probs(pdag, &var_of, var_probs).unwrap();
        bdd.probability(root)
    }

    fn is_permutation(seed: &[NodeIndex], got: &[NodeIndex]) -> bool {
        let mut a = seed.to_vec();
        let mut b = got.to_vec();
        a.sort();
        b.sort();
        a == b
    }

    #[test]
    fn best_order_permutes_and_preserves_function() {
        for method in [ReorderMethod::Sift, ReorderMethod::Gsift, ReorderMethod::Ils] {
            let ft = sample_ft();
            let pdag = Pdag::from_fault_tree(&ft).unwrap();
            let seed = compute_dfs_metadata_pdag(&pdag).unwrap().variable_order;
            let p0 = prob_with_order(&pdag, &ft, &seed);

            let order = best_order(&pdag, method, Duration::from_millis(150));
            assert!(is_permutation(&seed, &order), "{:?} not a permutation", method);

            let p1 = prob_with_order(&pdag, &ft, &order);
            assert!(
                (p0 - p1).abs() < 1e-12,
                "{:?} changed probability: {} vs {}",
                method,
                p0,
                p1
            );
        }
    }

    #[test]
    fn best_order_trivial_when_few_variables() {
        let mut p = Pdag::new();
        let a = p.add_basic_event("a".to_string());
        p.set_root(a).unwrap();
        let seed = compute_dfs_metadata_pdag(&p).unwrap().variable_order;
        let order = best_order(&p, ReorderMethod::Sift, Duration::from_millis(50));
        assert_eq!(order, seed);
    }
}
