use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::{Duration, Instant};

use praxis::algorithms::bdd_engine::{Bdd, BddRef};
use praxis::algorithms::ordering::force_order;
use praxis::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use praxis::algorithms::preprocessor::Preprocessor;
use praxis::io::parser::parse_fault_tree;

const TRUE: i32 = 1;
const FALSE: i32 = -1;

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

    fn ite(
        &mut self,
        f: i32,
        g: i32,
        h: i32,
        memo: &mut HashMap<(i32, i32, i32), i32>,
    ) -> i32 {
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

    fn prob(&self, root: i32, var_p: &[f64]) -> f64 {
        let mut cache: HashMap<i32, f64> = HashMap::new();
        self.prob_rec(root, var_p, &mut cache)
    }

    fn prob_rec(&self, r: i32, var_p: &[f64], cache: &mut HashMap<i32, f64>) -> f64 {
        if r == TRUE {
            return 1.0;
        }
        if r == FALSE {
            return 0.0;
        }
        if let Some(&p) = cache.get(&r) {
            return p;
        }
        let n = self.node(r.abs());
        let pv = var_p[n.var];
        let ph = self.prob_rec(n.high, var_p, cache);
        let pl = self.prob_rec(n.low, var_p, cache);
        let mut p = pv * ph + (1.0 - pv) * pl;
        if r < 0 {
            p = 1.0 - p;
        }
        cache.insert(r, p);
        p
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

fn build_pdag(rb: &mut RBdd, pdag: &Pdag, var_of: &HashMap<NodeIndex, usize>) -> i32 {
    let root = match pdag.root() {
        Some(r) => r,
        None => return TRUE,
    };
    let mut memo: HashMap<NodeIndex, i32> = HashMap::new();
    let mut imemo: HashMap<(i32, i32, i32), i32> = HashMap::new();
    let mut r = build_node(rb, pdag, root.abs(), var_of, &mut memo, &mut imemo);
    if root < 0 {
        r = comp(r);
    }
    if pdag.complement() {
        r = comp(r);
    }
    r
}

fn build_node(
    rb: &mut RBdd,
    pdag: &Pdag,
    idx: NodeIndex,
    var_of: &HashMap<NodeIndex, usize>,
    memo: &mut HashMap<NodeIndex, i32>,
    imemo: &mut HashMap<(i32, i32, i32), i32>,
) -> i32 {
    let a = idx.abs();
    if let Some(&r) = memo.get(&a) {
        return r;
    }
    let r = match pdag.get_node(a) {
        Some(PdagNode::BasicEvent { .. }) => rb.make(var_of[&a], TRUE, FALSE),
        Some(PdagNode::Constant { value, .. }) => {
            if *value {
                TRUE
            } else {
                FALSE
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
            let mut kids = Vec::with_capacity(ops.len());
            for op in &ops {
                let c = build_node(rb, pdag, op.abs(), var_of, memo, imemo);
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
    conn: Connective,
    kids: &[i32],
    min: Option<usize>,
    imemo: &mut HashMap<(i32, i32, i32), i32>,
) -> i32 {
    match conn {
        Connective::And => {
            let mut acc = TRUE;
            for &c in kids {
                acc = rb.and(acc, c, imemo);
            }
            acc
        }
        Connective::Or => {
            let mut acc = FALSE;
            for &c in kids {
                acc = rb.or(acc, c, imemo);
            }
            acc
        }
        Connective::Null => kids.first().copied().unwrap_or(TRUE),
        Connective::Not => kids.first().map(|&c| comp(c)).unwrap_or(FALSE),
        Connective::Nand => {
            let mut acc = TRUE;
            for &c in kids {
                acc = rb.and(acc, c, imemo);
            }
            comp(acc)
        }
        Connective::Nor => {
            let mut acc = FALSE;
            for &c in kids {
                acc = rb.or(acc, c, imemo);
            }
            comp(acc)
        }
        Connective::Xor => {
            let mut acc = FALSE;
            for &c in kids {
                acc = rb.ite(acc, comp(c), c, imemo);
            }
            acc
        }
        Connective::Iff => {
            let mut at = TRUE;
            let mut af = TRUE;
            for &c in kids {
                at = rb.and(at, c, imemo);
                af = rb.and(af, comp(c), imemo);
            }
            rb.or(at, af, imemo)
        }
        Connective::AtLeast => atleast(rb, kids, min.unwrap_or(1), imemo),
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

fn prod_reachable(bdd: &Bdd, root: BddRef) -> usize {
    use std::collections::HashSet;
    let mut seen: HashSet<i32> = HashSet::new();
    let mut stack = vec![root];
    while let Some(r) = stack.pop() {
        if r.is_terminal() {
            continue;
        }
        let reg = r.regular();
        if !seen.insert(reg.raw()) {
            continue;
        }
        let n = bdd.node(reg);
        stack.push(n.high);
        stack.push(n.low);
    }
    seen.len()
}

fn load_pre(path: &str) -> Option<Pdag> {
    let text = fs::read_to_string(Path::new(path)).ok()?;
    let ft = parse_fault_tree(&text).ok()?;
    let pdag = Pdag::from_fault_tree(&ft).ok()?;
    let mut pp = Preprocessor::new(pdag);
    pp.run().ok()?;
    Some(pp.into_pdag())
}

fn basic_events(pdag: &Pdag) -> Vec<NodeIndex> {
    let mut v: Vec<NodeIndex> = pdag
        .nodes()
        .values()
        .filter_map(|n| match n {
            PdagNode::BasicEvent { index, .. } => Some(*index),
            _ => None,
        })
        .collect();
    v.sort();
    v
}

fn fitness(pre: &Pdag, perm: &[NodeIndex], deadline: Instant) -> usize {
    let mut var_of: HashMap<NodeIndex, usize> = HashMap::new();
    for (i, &e) in perm.iter().enumerate() {
        var_of.insert(e, i);
    }
    let mut rb = RBdd::new(perm.len(), deadline);
    let root = build_pdag(&mut rb, pre, &var_of);
    if rb.aborted {
        usize::MAX
    } else {
        rb.reachable_count(root)
    }
}

fn splitmix(s: &mut u64) -> u64 {
    *s = s.wrapping_add(0x9E3779B97F4A7C15);
    let mut z = *s;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

fn sift_swap(rb: &mut RBdd, mut root: i32, deadline: Instant) -> (i32, usize) {
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
    let size = rb.reachable_count(root);
    (root, size)
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

fn gsift_swap(rb: &mut RBdd, root: i32, deadline: Instant) -> usize {
    let half = Instant::now() + (deadline - Instant::now()) / 2;
    let (mut root, _) = sift_swap(rb, root, half);
    if Instant::now() >= deadline {
        return rb.reachable_count(root);
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
    rb.reachable_count(root)
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

fn ils_swap(rb: &mut RBdd, mut root: i32, deadline: Instant) -> usize {
    let n = rb.var_at_level.len();
    if n < 2 {
        return rb.reachable_count(root);
    }
    let (r, mut best_size) = sift_swap(rb, root, deadline);
    root = r;
    let mut best_order = rb.var_at_level.clone();
    let mut rng = 0x9e3779b97f4a7c15u64;
    let k = (n / 4).max(2);
    while Instant::now() < deadline {
        for _ in 0..k {
            let l = (splitmix(&mut rng) as usize) % (n - 1);
            rb.swap(l);
        }
        root = rb.gc(root);
        let (r, sz) = sift_swap(rb, root, deadline);
        root = r;
        if rb.aborted {
            break;
        }
        if sz < best_size {
            best_size = sz;
            best_order = rb.var_at_level.clone();
        } else {
            restore_order(rb, &best_order);
            root = rb.gc(root);
        }
    }
    best_size
}

fn run_siftswap(paths: &[String]) {
    let secs: u64 = env::var("LIMIT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(60);
    println!(
        "=== swap-based reorder methods (in-place; seed = FORCE; {}s limit per method per tree) ===",
        secs
    );
    println!(
        "{:<16} {:>6} {:>8} {:>8} {:>8} {:>8}",
        "tree", "events", "force", "sift", "gsift", "ils"
    );
    let _ = std::io::stdout().flush();
    let far = || Instant::now() + Duration::from_secs(3600);
    let mut rows: Vec<[usize; 3]> = Vec::new();
    for path in paths {
        let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
        let pre = match load_pre(path) {
            Some(p) => p,
            None => {
                println!("{:<16} load error", name);
                continue;
            }
        };
        let events = basic_events(&pre);
        let n = events.len();
        if n < 2 {
            println!("{:<16} {:>6}  (too small)", name, n);
            continue;
        }
        let order = force_order(&pre);
        let mut var_of: HashMap<NodeIndex, usize> = HashMap::new();
        for &e in &events {
            var_of.insert(e, order[&e]);
        }
        let mut rb = RBdd::new(n, far());
        let root = build_pdag(&mut rb, &pre, &var_of);
        let force_size = rb.reachable_count(root);
        let (_root, sifted) =
            sift_swap(&mut rb, root, Instant::now() + Duration::from_secs(secs));
        let mut rb2 = RBdd::new(n, far());
        let root2 = build_pdag(&mut rb2, &pre, &var_of);
        let gsift = gsift_swap(&mut rb2, root2, Instant::now() + Duration::from_secs(secs));
        let mut rb3 = RBdd::new(n, far());
        let root3 = build_pdag(&mut rb3, &pre, &var_of);
        let dl3 = Instant::now() + Duration::from_secs(secs);
        rb3.deadline = dl3;
        let ils = ils_swap(&mut rb3, root3, dl3);
        println!(
            "{:<16} {:>6} {:>8} {:>8} {:>8} {:>8}",
            name, n, force_size, sifted, gsift, ils
        );
        let _ = std::io::stdout().flush();
        rows.push([sifted, gsift, ils]);
    }

    let labels = ["sift", "gsift", "ils"];
    let mut logsum = [0.0f64; 3];
    let mut wins = [0usize; 3];
    let mut ties = [0usize; 3];
    let mut losses = [0usize; 3];
    for v in &rows {
        let minv = *v.iter().min().unwrap();
        let nmin = v.iter().filter(|&&x| x == minv).count();
        for i in 0..3 {
            logsum[i] += (v[i] as f64 / minv as f64).ln();
            if v[i] == minv {
                if nmin == 1 {
                    wins[i] += 1;
                } else {
                    ties[i] += 1;
                }
            } else {
                losses[i] += 1;
            }
        }
    }
    let count = rows.len().max(1);
    println!();
    println!(
        "=== summary over {} trees (geomean normalized to per-tree best) ===",
        rows.len()
    );
    println!("{:<8} {:>10} {:>6} {:>6} {:>6}", "method", "geomean", "win", "tie", "loss");
    for i in 0..3 {
        println!(
            "{:<8} {:>10.3} {:>6} {:>6} {:>6}",
            labels[i],
            (logsum[i] / count as f64).exp(),
            wins[i],
            ties[i],
            losses[i]
        );
    }
}

fn run_swapcheck(paths: &[String]) {
    println!("=== swap validation: function-invariance + cross-check vs direct build ===");
    println!(
        "{:<20} {:>8} {:>10} {:>22}",
        "tree", "events", "invariance", "cross-check (swapped=direct)"
    );
    let far = || Instant::now() + Duration::from_secs(3600);
    for path in paths {
        let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
        let pre = match load_pre(path) {
            Some(p) => p,
            None => {
                println!("{:<20} load error", name);
                continue;
            }
        };
        let events = basic_events(&pre);
        let n = events.len();
        if n < 2 {
            println!("{:<20} {:>8}  (too small)", name, n);
            continue;
        }
        let order = force_order(&pre);
        let mut var_of: HashMap<NodeIndex, usize> = HashMap::new();
        for &e in &events {
            var_of.insert(e, order[&e]);
        }
        let mut rb = RBdd::new(n, far());
        let root = build_pdag(&mut rb, &pre, &var_of);
        let base_prob = rb.prob(root, &vec![0.3; n]);
        let mut rng = 0x9e3779b97f4a7c15u64;
        let mut invar_ok = true;
        for _ in 0..(8 * n) {
            let l = (splitmix(&mut rng) as usize) % (n - 1);
            rb.swap(l);
            let p = rb.prob(root, &vec![0.3; n]);
            if (p - base_prob).abs() > 1e-9 {
                invar_ok = false;
                break;
            }
        }
        let root = rb.gc(root);
        let reach = rb.reachable_count(root);
        let mut cur: Vec<NodeIndex> = events.clone();
        cur.sort_by_key(|e| rb.level_of[var_of[e]]);
        let direct = fitness(&pre, &cur, far());
        let cross = if reach == direct {
            format!("ok ({}={})", reach, direct)
        } else {
            format!("FAIL ({}!={})", reach, direct)
        };
        println!(
            "{:<20} {:>8} {:>10} {:>22}",
            name,
            n,
            if invar_ok { "ok" } else { "FAIL" },
            cross
        );
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.first().map(|s| s.as_str()) == Some("swapcheck") {
        run_swapcheck(&args[1..]);
        return;
    }
    if args.first().map(|s| s.as_str()) == Some("siftswap") {
        run_siftswap(&args[1..]);
        return;
    }
    println!("=== RBdd validation vs production Bdd::from_pdag_with_order (reachable nodes) ===");
    println!(
        "{:<20} {:>8} {:>10} {:>10} {:>8}",
        "tree", "events", "prod", "rbdd", "match"
    );
    for path in &args {
        let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
        let pre = match load_pre(path) {
            Some(p) => p,
            None => {
                println!("{:<20} load error", name);
                continue;
            }
        };
        let events = basic_events(&pre);
        let n = events.len();
        if n == 0 {
            println!("{:<20} {:>8}  (no events)", name, n);
            continue;
        }
        let order = force_order(&pre);
        let mut var_of: HashMap<NodeIndex, usize> = HashMap::new();
        for &e in &events {
            var_of.insert(e, order[&e]);
        }
        let (mut prod, prod_root) = match Bdd::from_pdag_with_order(&pre, &var_of) {
            Ok(x) => x,
            Err(_) => {
                println!("{:<20} {:>8}  prod blowup", name, n);
                continue;
            }
        };
        prod.set_var_probs(vec![0.3; n]);
        let prod_nodes = prod_reachable(&prod, prod_root);
        let prod_prob = prod.probability(prod_root);
        let mut rb = RBdd::new(n, Instant::now() + Duration::from_secs(120));
        let rroot = build_pdag(&mut rb, &pre, &var_of);
        let rb_nodes = rb.reachable_count(rroot);
        let rb_prob = rb.prob(rroot, &vec![0.3; n]);
        let nodes_ok = prod_nodes == rb_nodes;
        let prob_ok = (prod_prob - rb_prob).abs() < 1e-9;
        let verdict = if nodes_ok && prob_ok { "ok" } else { "FAIL" };
        println!(
            "{:<20} {:>8} {:>10} {:>10} {:>8}",
            name, n, prod_nodes, rb_nodes, verdict
        );
    }
}
