use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::Path;
use std::io::Write;
use std::thread;
use std::time::{Duration, Instant};

use praxis::algorithms::bdd_engine::Bdd;
use praxis::algorithms::bdd_pdag::BddPdag;
use praxis::algorithms::ordering::sloan_on_adj;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::Formula;
use praxis::io::parser::parse_fault_tree;

const RESTARTS: usize = 6;

fn mix(x: u64, s: u64) -> u64 {
    let mut z = x.wrapping_mul(0x9E3779B97F4A7C15).wrapping_add(s);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

fn read_text(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let u: Vec<u16> = bytes[2..]
            .chunks(2)
            .map(|c| u16::from_le_bytes([c[0], *c.get(1).unwrap_or(&0)]))
            .collect();
        Some(String::from_utf16_lossy(&u))
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        let u: Vec<u16> = bytes[2..]
            .chunks(2)
            .map(|c| u16::from_be_bytes([c[0], *c.get(1).unwrap_or(&0)]))
            .collect();
        Some(String::from_utf16_lossy(&u))
    } else {
        Some(String::from_utf8_lossy(&bytes).into_owned())
    }
}

#[derive(Clone)]
struct Factor {
    vars: Vec<usize>,
    table: Vec<f64>,
}

#[derive(Clone)]
enum CVal {
    T,
    F,
    V(usize),
}

struct Builder {
    next_var: usize,
    factors: Vec<Factor>,
}

impl Builder {
    fn fresh(&mut self) -> usize {
        let v = self.next_var;
        self.next_var += 1;
        v
    }
    fn force(&mut self, v: usize, val: bool) {
        self.factors.push(Factor {
            vars: vec![v],
            table: if val { vec![0.0, 1.0] } else { vec![1.0, 0.0] },
        });
    }
    fn equiv(&mut self, out: usize, a: usize) {
        self.factors.push(Factor {
            vars: vec![out, a],
            table: vec![1.0, 0.0, 0.0, 1.0],
        });
    }
    fn not(&mut self, out: usize, a: usize) {
        let mut t = vec![0.0; 4];
        for idx in 0..4 {
            let ob = idx & 1 == 1;
            let ab = (idx >> 1) & 1 == 1;
            t[idx] = if ob == !ab { 1.0 } else { 0.0 };
        }
        self.factors.push(Factor {
            vars: vec![out, a],
            table: t,
        });
    }
    fn bin(&mut self, out: usize, a: usize, b: usize, kind: u8) {
        let mut t = vec![0.0; 8];
        for idx in 0..8 {
            let ob = idx & 1 == 1;
            let ab = (idx >> 1) & 1 == 1;
            let bb = (idx >> 2) & 1 == 1;
            let f = match kind {
                0 => ab && bb,
                1 => ab || bb,
                2 => ab ^ bb,
                _ => ab == bb,
            };
            t[idx] = if ob == f { 1.0 } else { 0.0 };
        }
        self.factors.push(Factor {
            vars: vec![out, a, b],
            table: t,
        });
    }
    fn chain(&mut self, out: usize, ops: &[usize], kind: u8) {
        if ops.is_empty() {
            self.force(out, kind == 0);
            return;
        }
        if ops.len() == 1 {
            self.equiv(out, ops[0]);
            return;
        }
        let mut prev = ops[0];
        for i in 1..ops.len() - 1 {
            let t = self.fresh();
            self.bin(t, prev, ops[i], kind);
            prev = t;
        }
        self.bin(out, prev, ops[ops.len() - 1], kind);
    }
    fn atleast(&mut self, out: usize, ops: &[usize], m: usize) {
        let n = ops.len();
        if m == 0 {
            self.force(out, true);
            return;
        }
        if m > n {
            self.force(out, false);
            return;
        }
        let mut cprev: Vec<CVal> = vec![CVal::F; m + 1];
        cprev[0] = CVal::T;
        for i in 1..=n {
            let oi = ops[i - 1];
            let mut ccur: Vec<CVal> = vec![CVal::F; m + 1];
            ccur[0] = CVal::T;
            for j in 1..=m {
                let downleft = cprev[j - 1].clone();
                let left = cprev[j].clone();
                let aij = match downleft {
                    CVal::F => CVal::F,
                    CVal::T => CVal::V(oi),
                    CVal::V(dv) => {
                        let a = self.fresh();
                        self.bin(a, oi, dv, 0);
                        CVal::V(a)
                    }
                };
                let cij = match (left, aij) {
                    (CVal::T, _) => CVal::T,
                    (_, CVal::T) => CVal::T,
                    (CVal::F, a) => a,
                    (l, CVal::F) => l,
                    (CVal::V(lv), CVal::V(av)) => {
                        let c = self.fresh();
                        self.bin(c, lv, av, 1);
                        CVal::V(c)
                    }
                };
                ccur[j] = cij;
            }
            cprev = ccur;
        }
        match cprev[m].clone() {
            CVal::T => self.force(out, true),
            CVal::F => self.force(out, false),
            CVal::V(v) => self.equiv(out, v),
        }
    }
    fn encode(&mut self, out: usize, f: &Formula, ops: &[usize]) {
        match f {
            Formula::And => self.chain(out, ops, 0),
            Formula::Or => self.chain(out, ops, 1),
            Formula::Xor => self.chain(out, ops, 2),
            Formula::Not => self.not(out, ops[0]),
            Formula::Nand => {
                let inner = self.fresh();
                self.chain(inner, ops, 0);
                self.not(out, inner);
            }
            Formula::Nor => {
                let inner = self.fresh();
                self.chain(inner, ops, 1);
                self.not(out, inner);
            }
            Formula::Iff => {
                if ops.len() == 2 {
                    self.bin(out, ops[0], ops[1], 3);
                } else {
                    let at = self.fresh();
                    self.chain(at, ops, 0);
                    let any = self.fresh();
                    self.chain(any, ops, 1);
                    let none = self.fresh();
                    self.not(none, any);
                    self.bin(out, at, none, 1);
                }
            }
            Formula::AtLeast { min } => self.atleast(out, ops, *min),
        }
    }
}

fn build_model(ft: &FaultTree) -> Option<(Vec<Factor>, usize)> {
    let mut var_of: HashMap<String, usize> = HashMap::new();
    let mut be_keys: Vec<String> = ft.basic_events().keys().cloned().collect();
    be_keys.sort();
    let mut g_keys: Vec<String> = ft.gates().keys().cloned().collect();
    g_keys.sort();
    for be in &be_keys {
        let n = var_of.len();
        var_of.entry(be.clone()).or_insert(n);
    }
    for g in &g_keys {
        let n = var_of.len();
        var_of.entry(g.clone()).or_insert(n);
    }
    let base = var_of.len();
    let mut b = Builder {
        next_var: base,
        factors: Vec::new(),
    };
    for be in &be_keys {
        let v = var_of[be];
        let p = ft.basic_events().get(be).unwrap().probability();
        b.factors.push(Factor {
            vars: vec![v],
            table: vec![1.0 - p, p],
        });
    }
    for gid in &g_keys {
        let out = var_of[gid];
        let gate = ft.gates().get(gid).unwrap();
        let op_vars: Vec<usize> = gate.operands().iter().map(|o| var_of[o]).collect();
        b.encode(out, gate.formula(), &op_vars);
    }
    let top = var_of[ft.top_event()];
    b.force(top, true);
    Some((b.factors, b.next_var))
}

fn next_rng(s: &mut u64) -> u64 {
    *s = s.wrapping_add(0x9E3779B97F4A7C15);
    let mut z = *s;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

fn fill_of(adj: &[HashSet<usize>], v: usize) -> usize {
    let nbrs: Vec<usize> = adj[v].iter().copied().collect();
    let mut f = 0;
    for i in 0..nbrs.len() {
        for j in (i + 1)..nbrs.len() {
            if !adj[nbrs[i]].contains(&nbrs[j]) {
                f += 1;
            }
        }
    }
    f
}

fn one_min_fill(scopes: &[Vec<usize>], n: usize, seed: u64) -> (Vec<usize>, usize) {
    let mut adj: Vec<HashSet<usize>> = vec![HashSet::new(); n];
    for scope in scopes {
        for i in 0..scope.len() {
            for j in (i + 1)..scope.len() {
                adj[scope[i]].insert(scope[j]);
                adj[scope[j]].insert(scope[i]);
            }
        }
    }
    let mut fill: Vec<usize> = (0..n).map(|v| fill_of(&adj, v)).collect();
    let mut alive = vec![true; n];
    let mut order = Vec::with_capacity(n);
    let mut maxbag = 0usize;
    let mut rng = seed | 1;
    for _ in 0..n {
        let mut minf = usize::MAX;
        let mut cands: Vec<usize> = Vec::new();
        for v in 0..n {
            if alive[v] {
                if fill[v] < minf {
                    minf = fill[v];
                    cands.clear();
                    cands.push(v);
                } else if fill[v] == minf {
                    cands.push(v);
                }
            }
        }
        let v = cands[(next_rng(&mut rng) as usize) % cands.len()];
        let nbrs: Vec<usize> = adj[v].iter().copied().collect();
        maxbag = maxbag.max(nbrs.len() + 1);
        for i in 0..nbrs.len() {
            for j in (i + 1)..nbrs.len() {
                adj[nbrs[i]].insert(nbrs[j]);
                adj[nbrs[j]].insert(nbrs[i]);
            }
        }
        for &nb in &nbrs {
            adj[nb].remove(&v);
        }
        adj[v].clear();
        alive[v] = false;
        fill[v] = usize::MAX;
        order.push(v);
        for &nb in &nbrs {
            if alive[nb] {
                fill[nb] = fill_of(&adj, nb);
            }
        }
    }
    (order, maxbag.saturating_sub(1))
}

fn min_fill_restarts(scopes: &[Vec<usize>], n: usize, restarts: usize) -> (Vec<usize>, usize) {
    let mut best: Option<(Vec<usize>, usize)> = None;
    for r in 0..restarts {
        let seed = (r as u64).wrapping_mul(0x9E3779B97F4A7C15).wrapping_add(1);
        let (order, w) = one_min_fill(scopes, n, seed);
        if best.as_ref().map_or(true, |(_, bw)| w < *bw) {
            best = Some((order, w));
        }
    }
    best.unwrap()
}

fn components_of(active: &[usize], factors: &[Factor], assign: &[i8]) -> Vec<Vec<usize>> {
    let n = active.len();
    let mut parent: Vec<usize> = (0..n).collect();
    fn find(p: &mut Vec<usize>, mut x: usize) -> usize {
        while p[x] != x {
            p[x] = p[p[x]];
            x = p[x];
        }
        x
    }
    let mut var_first: HashMap<usize, usize> = HashMap::new();
    for i in 0..n {
        for &v in &factors[active[i]].vars {
            if assign[v] < 0 {
                if let Some(&j) = var_first.get(&v) {
                    let ri = find(&mut parent, i);
                    let rj = find(&mut parent, j);
                    if ri != rj {
                        parent[ri] = rj;
                    }
                } else {
                    var_first.insert(v, i);
                }
            }
        }
    }
    let mut groups: HashMap<usize, Vec<usize>> = HashMap::new();
    for i in 0..n {
        let r = find(&mut parent, i);
        groups.entry(r).or_default().push(active[i]);
    }
    groups.into_values().collect()
}

struct Searcher {
    factors: Vec<Factor>,
    rank: Vec<usize>,
    var_factors: Vec<Vec<usize>>,
    is_constraint: Vec<bool>,
    assign: Vec<i8>,
    cache: HashMap<(u64, u64), f64>,
    calls: usize,
    deadline: Instant,
    aborted: bool,
}

impl Searcher {
    fn value(&self, fi: usize) -> f64 {
        let f = &self.factors[fi];
        let mut idx = 0usize;
        for (i, &v) in f.vars.iter().enumerate() {
            if self.assign[v] == 1 {
                idx |= 1 << i;
            }
        }
        f.table[idx]
    }
    fn fully(&self, fi: usize) -> bool {
        self.factors[fi].vars.iter().all(|&v| self.assign[v] >= 0)
    }
    fn propagate(&mut self, mut queue: Vec<usize>, trail: &mut Vec<usize>) -> bool {
        while let Some(u) = queue.pop() {
            let fl = self.var_factors[u].clone();
            for fi in fl {
                let mut un = usize::MAX;
                let mut cnt = 0;
                for &v in &self.factors[fi].vars {
                    if self.assign[v] < 0 {
                        cnt += 1;
                        un = v;
                        if cnt > 1 {
                            break;
                        }
                    }
                }
                if cnt == 0 {
                    if self.value(fi) == 0.0 {
                        return false;
                    }
                } else if cnt == 1 {
                    let v = un;
                    self.assign[v] = 0;
                    let v0 = self.value(fi);
                    self.assign[v] = 1;
                    let v1 = self.value(fi);
                    if v0 == 0.0 && v1 == 0.0 {
                        self.assign[v] = -1;
                        return false;
                    } else if v1 == 0.0 {
                        self.assign[v] = 0;
                        trail.push(v);
                        queue.push(v);
                    } else if v0 == 0.0 {
                        self.assign[v] = 1;
                        trail.push(v);
                        queue.push(v);
                    } else {
                        self.assign[v] = -1;
                    }
                }
            }
        }
        true
    }
    fn solve(&mut self, active: &[usize]) -> f64 {
        if self.aborted {
            return 0.0;
        }
        let mut h1: u64 = 0x243f6a8885a308d3;
        let mut h2: u64 = 0x13198a2e03707344;
        for &fi in active {
            h1 = h1.wrapping_add(mix(fi as u64, 0xa1));
            h2 = h2.wrapping_add(mix(fi as u64, 0xb2));
            for &v in &self.factors[fi].vars {
                if self.assign[v] >= 0 {
                    let e = ((v as u64) << 1) | (self.assign[v] as u64 & 1);
                    h1 = h1.wrapping_add(mix(e, 0xc3));
                    h2 = h2.wrapping_add(mix(e, 0xd4));
                }
            }
        }
        let key = (h1, h2);
        if let Some(&c) = self.cache.get(&key) {
            return c;
        }
        self.calls += 1;
        if self.calls & 0x3FFF == 0 && Instant::now() >= self.deadline {
            self.aborted = true;
            return 0.0;
        }

        let comps = components_of(active, &self.factors, &self.assign);
        let result = if comps.len() > 1 {
            let mut prod = 1.0;
            for c in &comps {
                prod *= self.solve(c);
            }
            prod
        } else {
            let mut bv = usize::MAX;
            let mut br = 0usize;
            for &fi in active {
                for &v in &self.factors[fi].vars {
                    if self.assign[v] < 0 && (bv == usize::MAX || self.rank[v] > br) {
                        br = self.rank[v];
                        bv = v;
                    }
                }
            }
            let v = bv;
            let mut sum = 0.0;
            for b in 0..2i8 {
                self.assign[v] = b;
                let mut trail: Vec<usize> = vec![v];
                let ok = self.propagate(vec![v], &mut trail);
                if ok {
                    let mut det = 1.0;
                    let mut still: Vec<usize> = Vec::new();
                    for &fi in active {
                        if self.fully(fi) {
                            det *= self.value(fi);
                        } else {
                            still.push(fi);
                        }
                    }
                    if det != 0.0 {
                        let sub = if still.is_empty() { 1.0 } else { self.solve(&still) };
                        sum += det * sub;
                    }
                }
                for &u in &trail {
                    self.assign[u] = -1;
                }
            }
            sum
        };
        self.cache.insert(key, result);
        result
    }
}

fn run_with_rank(
    factors: Vec<Factor>,
    nv: usize,
    rank: Vec<usize>,
    limit: Duration,
) -> Option<(f64, usize)> {
    let is_constraint: Vec<bool> = factors
        .iter()
        .map(|f| f.table.iter().all(|&x| x == 0.0 || x == 1.0))
        .collect();
    let mut var_factors: Vec<Vec<usize>> = vec![Vec::new(); nv];
    for (fi, f) in factors.iter().enumerate() {
        if is_constraint[fi] {
            for &v in &f.vars {
                var_factors[v].push(fi);
            }
        }
    }
    let mut s = Searcher {
        factors,
        rank,
        var_factors,
        is_constraint,
        assign: vec![-1i8; nv],
        cache: HashMap::new(),
        calls: 0,
        deadline: Instant::now() + limit,
        aborted: false,
    };
    let mut trail: Vec<usize> = Vec::new();
    let mut q: Vec<usize> = Vec::new();
    for fi in 0..s.factors.len() {
        if s.is_constraint[fi] && s.factors[fi].vars.len() == 1 {
            let v = s.factors[fi].vars[0];
            if s.assign[v] < 0 {
                let forced = if s.factors[fi].table[1] == 1.0 { 1i8 } else { 0i8 };
                s.assign[v] = forced;
                trail.push(v);
                q.push(v);
            }
        }
    }
    if !s.propagate(q, &mut trail) {
        return Some((0.0, 0));
    }
    let mut det = 1.0;
    let mut active0: Vec<usize> = Vec::new();
    for fi in 0..s.factors.len() {
        if s.fully(fi) {
            det *= s.value(fi);
        } else {
            active0.push(fi);
        }
    }
    let r = if active0.is_empty() {
        det
    } else {
        det * s.solve(&active0)
    };
    if s.aborted {
        None
    } else {
        Some((r, s.cache.len()))
    }
}

fn min_fill_rank(factors: &[Factor], nv: usize) -> (Vec<usize>, usize) {
    let scopes: Vec<Vec<usize>> = factors.iter().map(|f| f.vars.clone()).collect();
    let (order, width) = min_fill_restarts(&scopes, nv, RESTARTS);
    let mut rank = vec![0usize; nv];
    for (step, &v) in order.iter().enumerate() {
        rank[v] = step;
    }
    (rank, width)
}

fn count(ft: &FaultTree) -> Option<(f64, usize, usize, usize)> {
    let (factors, nv) = build_model(ft)?;
    let (rank, width) = min_fill_rank(&factors, nv);
    eprintln!("model vars={} min-fill width={}", nv, width);
    let (r, distinct) = run_with_rank(factors, nv, rank, Duration::from_secs(600))?;
    Some((r, distinct, width, distinct))
}

fn bdd_prob(ft: &FaultTree) -> Option<f64> {
    let mut pdag = BddPdag::from_fault_tree(ft).ok()?;
    pdag.compute_ordering_and_modules().ok()?;
    let (bdd, root) = Bdd::build_from_pdag(&pdag).ok()?;
    Some(bdd.probability(root))
}

fn run(paths: Vec<String>) {
    println!(
        "{:<26} {:>18} {:>18} {:>8} {:>6} {:>12} {:>12}",
        "tree", "search", "bdd", "secs", "width", "calls", "distinct"
    );
    for path in &paths {
        let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
        let ft = match read_text(Path::new(path)).and_then(|x| parse_fault_tree(&x).ok()) {
            Some(f) => f,
            None => {
                println!("{:<26} read/parse error", name);
                continue;
            }
        };
        let small = ft.basic_events().len() < 600;
        let bdd = if small { bdd_prob(&ft) } else { None };
        let t = Instant::now();
        let c = count(&ft);
        let secs = t.elapsed().as_secs_f64();
        match c {
            Some((v, calls, width, distinct)) => {
                let bs = match bdd {
                    Some(b) => {
                        if (v - b).abs() < 1e-9 {
                            format!("{:>18.10e}  MATCH", b)
                        } else {
                            format!("{:>18.10e}  DIFF", b)
                        }
                    }
                    None => format!("{:>18}", "(skipped)"),
                };
                println!(
                    "{:<26} {:>18.10e} {} {:>8.2} {:>6} {:>12} {:>12}",
                    name, v, bs, secs, width, calls, distinct
                );
            }
            None => {
                println!(
                    "{:<26} {:>18} {:>18} {:>8.2} {:>6} {:>12} {:>12}  (declined/cap)",
                    name, "-", "-", secs, "-", "-", "-"
                );
            }
        }
    }
}

fn primal_graph(factors: &[Factor], nv: usize) -> Vec<Vec<usize>> {
    let mut seen: Vec<std::collections::HashSet<usize>> =
        (0..nv).map(|_| std::collections::HashSet::new()).collect();
    for f in factors {
        for a in 0..f.vars.len() {
            for b in (a + 1)..f.vars.len() {
                let (x, y) = (f.vars[a], f.vars[b]);
                if x < nv && y < nv {
                    seen[x].insert(y);
                    seen[y].insert(x);
                }
            }
        }
    }
    seen.into_iter()
        .map(|s| {
            let mut v: Vec<usize> = s.into_iter().collect();
            v.sort();
            v
        })
        .collect()
}

fn graph_rank_from_adj(adj: &[Vec<usize>], nv: usize, core: fn(&[Vec<usize>]) -> Vec<usize>) -> Vec<usize> {
    let order = core(adj);
    let mut rank = vec![0usize; nv];
    for (pos, &v) in order.iter().enumerate() {
        if v < nv {
            rank[v] = pos;
        }
    }
    rank
}

fn run_order_count(paths: Vec<String>) {
    let secs: u64 = env::var("LIMIT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(60);
    let limit = Duration::from_secs(secs);
    println!(
        "=== counter ordering: min-fill vs sloanF (distinct components; {}s time limit per run) ===",
        secs
    );
    println!("(sloanF = Sloan on the factor hypergraph, the same sparse graph min-fill uses)");
    println!("{:<20} {:>6} {:>11} {:>11}", "tree", "events", "minfill", "sloanF");
    let _ = std::io::stdout().flush();
    let mut rows: Vec<[Option<usize>; 2]> = Vec::new();
    for path in &paths {
        let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
        let ft = match read_text(Path::new(path)).and_then(|x| parse_fault_tree(&x).ok()) {
            Some(f) => f,
            None => {
                println!("{:<20} read/parse error", name);
                continue;
            }
        };
        let (factors, nv) = match build_model(&ft) {
            Some(m) => m,
            None => {
                println!("{:<20} model declined", name);
                continue;
            }
        };
        let nbe = ft.basic_events().len();
        let (mf, _w) = min_fill_rank(&factors, nv);
        let adj = primal_graph(&factors, nv);
        let rm = run_with_rank(factors.clone(), nv, mf, limit).map(|x| x.1);
        let rank = graph_rank_from_adj(&adj, nv, sloan_on_adj);
        let rs = run_with_rank(factors, nv, rank, limit).map(|x| x.1);
        let cell = |c: &Option<usize>| match c {
            Some(d) => format!("{:>11}", d),
            None => format!("{:>11}", "timeout"),
        };
        println!("{:<20} {:>6} {} {}", name, nbe, cell(&rm), cell(&rs));
        let _ = std::io::stdout().flush();
        rows.push([rm, rs]);
    }

    let labels = ["minfill", "sloanF"];
    let mut logsum = [0.0f64; 2];
    let mut wins = [0usize; 2];
    let mut solves = [0usize; 2];
    let mut count = 0usize;
    for vals in &rows {
        for i in 0..2 {
            if vals[i].is_some() {
                solves[i] += 1;
            }
        }
        if vals.iter().all(|v| v.is_some()) {
            let v: [usize; 2] = [vals[0].unwrap(), vals[1].unwrap()];
            let minv = *v.iter().min().unwrap();
            for i in 0..2 {
                logsum[i] += (v[i] as f64 / minv as f64).ln();
                if v[i] == minv {
                    wins[i] += 1;
                }
            }
            count += 1;
        }
    }
    println!();
    println!(
        "=== summary over {} trees solved by both (geomean to best, #best) ===",
        count
    );
    for i in 0..2 {
        let gm = if count > 0 {
            (logsum[i] / count as f64).exp()
        } else {
            0.0
        };
        println!(
            "{:<10} geomean {:>8.3}   best {:>3}   solves {:>3}/{}",
            labels[i], gm, wins[i], solves[i], rows.len()
        );
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let order_mode = args.first().map(|s| s.as_str()) == Some("order");
    let rest: Vec<String> = if order_mode {
        args[1..].to_vec()
    } else if args.is_empty() {
        vec![
            "fixtures/aralia/chinese.xml".to_string(),
            "fixtures/aralia/das9201.xml".to_string(),
            "fixtures/aralia/ftr10.xml".to_string(),
            "fixtures/synthetic/100_to_100k_voter/openpsa/ft-100-01-KN.xml".to_string(),
            "fixtures/aralia/edf9203.xml".to_string(),
            "fixtures/aralia/nus9601.xml".to_string(),
        ]
    } else {
        args
    };
    let h = thread::Builder::new()
        .stack_size(1024 * 1024 * 1024)
        .spawn(move || {
            if order_mode {
                run_order_count(rest)
            } else {
                run(rest)
            }
        })
        .expect("spawn");
    h.join().expect("join");
}
