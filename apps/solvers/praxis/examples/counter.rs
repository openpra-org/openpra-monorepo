use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::thread;
use std::time::Instant;

use praxis::algorithms::bdd_engine::Bdd;
use praxis::algorithms::bdd_pdag::BddPdag;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::Formula;
use praxis::io::parser::parse_fault_tree;

const WIDTH_CAP: usize = 24;
const FANIN_LIMIT: usize = 16;
const VAR_LIMIT: usize = 4000;

struct Factor {
    vars: Vec<usize>,
    table: Vec<f64>,
}

fn multiply(a: &Factor, b: &Factor) -> Factor {
    let mut vars: Vec<usize> = a.vars.iter().chain(b.vars.iter()).copied().collect();
    vars.sort_unstable();
    vars.dedup();
    let n = vars.len();
    let pos: HashMap<usize, usize> = vars.iter().enumerate().map(|(i, &v)| (v, i)).collect();
    let amap: Vec<usize> = a.vars.iter().map(|v| pos[v]).collect();
    let bmap: Vec<usize> = b.vars.iter().map(|v| pos[v]).collect();
    let mut table = vec![0.0; 1usize << n];
    for idx in 0..(1usize << n) {
        let mut ai = 0usize;
        for (j, &p) in amap.iter().enumerate() {
            if (idx >> p) & 1 == 1 {
                ai |= 1 << j;
            }
        }
        let mut bi = 0usize;
        for (j, &p) in bmap.iter().enumerate() {
            if (idx >> p) & 1 == 1 {
                bi |= 1 << j;
            }
        }
        table[idx] = a.table[ai] * b.table[bi];
    }
    Factor { vars, table }
}

fn sum_out(f: &Factor, v: usize) -> Factor {
    let pos = f.vars.iter().position(|&x| x == v).unwrap();
    let mut new_vars = f.vars.clone();
    new_vars.remove(pos);
    let n = f.vars.len();
    let mut table = vec![0.0; 1usize << (n - 1)];
    for idx in 0..(1usize << n) {
        let low = idx & ((1usize << pos) - 1);
        let high = (idx >> (pos + 1)) << pos;
        table[low | high] += f.table[idx];
    }
    Factor { vars: new_vars, table }
}

fn gate_holds(formula: &Formula, op_vals: &[bool]) -> bool {
    match formula {
        Formula::And => op_vals.iter().all(|&b| b),
        Formula::Or => op_vals.iter().any(|&b| b),
        Formula::AtLeast { min } => op_vals.iter().filter(|&&b| b).count() >= *min,
        Formula::Nand => !op_vals.iter().all(|&b| b),
        Formula::Nor => !op_vals.iter().any(|&b| b),
        Formula::Not => !op_vals[0],
        Formula::Xor => op_vals.iter().filter(|&&b| b).count() % 2 == 1,
        Formula::Iff => op_vals.iter().all(|&b| b) || op_vals.iter().all(|&b| !b),
    }
}

fn min_fill_order(scopes: &[Vec<usize>], num_vars: usize, cap: usize) -> Option<(Vec<usize>, usize)> {
    let mut adj: Vec<HashSet<usize>> = vec![HashSet::new(); num_vars];
    for scope in scopes {
        for i in 0..scope.len() {
            for j in (i + 1)..scope.len() {
                adj[scope[i]].insert(scope[j]);
                adj[scope[j]].insert(scope[i]);
            }
        }
    }
    let mut alive = vec![true; num_vars];
    let mut order = Vec::with_capacity(num_vars);
    let mut max_bag = 0usize;
    for _ in 0..num_vars {
        let mut best: Option<(usize, usize, usize)> = None;
        for v in 0..num_vars {
            if !alive[v] {
                continue;
            }
            let nbrs: Vec<usize> = adj[v].iter().copied().collect();
            let mut fill = 0usize;
            for i in 0..nbrs.len() {
                for j in (i + 1)..nbrs.len() {
                    if !adj[nbrs[i]].contains(&nbrs[j]) {
                        fill += 1;
                    }
                }
            }
            let cand = (fill, nbrs.len(), v);
            best = Some(match best {
                None => cand,
                Some(cur) => {
                    if cand < cur {
                        cand
                    } else {
                        cur
                    }
                }
            });
        }
        let v = best.expect("alive vertex").2;
        let nbrs: Vec<usize> = adj[v].iter().copied().collect();
        if nbrs.len() > cap {
            return None;
        }
        max_bag = max_bag.max(nbrs.len() + 1);
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
        order.push(v);
    }
    Some((order, max_bag.saturating_sub(1)))
}

fn wmc(ft: &FaultTree, cap: usize) -> Option<(f64, usize)> {
    let mut var_of: HashMap<String, usize> = HashMap::new();
    for be in ft.basic_events().keys() {
        let n = var_of.len();
        var_of.entry(be.clone()).or_insert(n);
    }
    for g in ft.gates().keys() {
        let n = var_of.len();
        var_of.entry(g.clone()).or_insert(n);
    }
    let num_vars = var_of.len();
    if num_vars > VAR_LIMIT {
        return None;
    }

    let mut factors: Vec<Factor> = Vec::new();
    let mut scopes: Vec<Vec<usize>> = Vec::new();
    for (be, ev) in ft.basic_events() {
        let v = var_of[be];
        let p = ev.probability();
        factors.push(Factor {
            vars: vec![v],
            table: vec![1.0 - p, p],
        });
        scopes.push(vec![v]);
    }
    for (gid, gate) in ft.gates() {
        if gate.operands().len() + 1 > FANIN_LIMIT {
            return None;
        }
        let gv = var_of[gid];
        let op_vars: Vec<usize> = gate.operands().iter().map(|o| var_of[o]).collect();
        let mut scope: Vec<usize> = std::iter::once(gv).chain(op_vars.iter().copied()).collect();
        scope.sort_unstable();
        scope.dedup();
        let posn: HashMap<usize, usize> = scope.iter().enumerate().map(|(i, &v)| (v, i)).collect();
        let n = scope.len();
        let mut table = vec![0.0; 1usize << n];
        for idx in 0..(1usize << n) {
            let gate_bit = (idx >> posn[&gv]) & 1 == 1;
            let op_vals: Vec<bool> = op_vars.iter().map(|ov| (idx >> posn[ov]) & 1 == 1).collect();
            table[idx] = if gate_bit == gate_holds(gate.formula(), &op_vals) {
                1.0
            } else {
                0.0
            };
        }
        scopes.push(scope.clone());
        factors.push(Factor { vars: scope, table });
    }
    let top = var_of[ft.top_event()];
    factors.push(Factor {
        vars: vec![top],
        table: vec![0.0, 1.0],
    });

    let (order, width) = min_fill_order(&scopes, num_vars, cap)?;

    let mut bucket_of: HashMap<usize, Vec<usize>> = HashMap::new();
    for (fi, f) in factors.iter().enumerate() {
        if let Some(first) = order.iter().position(|&v| f.vars.contains(&v)) {
            bucket_of.entry(order[first]).or_default().push(fi);
        }
    }
    let mut live: Vec<Option<Factor>> = factors.into_iter().map(Some).collect();
    let mut extra: Vec<Factor> = Vec::new();
    for &v in &order {
        let mut bucket: Vec<Factor> = Vec::new();
        if let Some(ids) = bucket_of.remove(&v) {
            for fi in ids {
                if let Some(f) = live[fi].take() {
                    bucket.push(f);
                }
            }
        }
        let mut i = 0;
        while i < extra.len() {
            if extra[i].vars.contains(&v) {
                bucket.push(extra.swap_remove(i));
            } else {
                i += 1;
            }
        }
        if bucket.is_empty() {
            continue;
        }
        let mut prod = bucket.pop().unwrap();
        for f in &bucket {
            prod = multiply(&prod, f);
        }
        let summed = sum_out(&prod, v);
        extra.push(summed);
    }
    let mut result = 1.0;
    for f in &extra {
        result *= f.table[0];
    }
    Some((result, width))
}

fn bdd_prob(ft: &FaultTree) -> Option<f64> {
    let mut pdag = BddPdag::from_fault_tree(ft).ok()?;
    pdag.compute_ordering_and_modules().ok()?;
    let (bdd, root) = Bdd::build_from_pdag(&pdag).ok()?;
    Some(bdd.probability(root))
}

fn run(paths: Vec<String>) {
    println!(
        "{:<28} {:>18} {:>18} {:>10} {:>9} {:>6}",
        "tree", "counter(wmc)", "bdd", "absdiff", "secs", "width"
    );
    for path in &paths {
        let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
        let xml = match fs::read_to_string(path) {
            Ok(x) => x,
            Err(_) => {
                println!("{:<28} read error", name);
                continue;
            }
        };
        let ft = match parse_fault_tree(&xml) {
            Ok(f) => f,
            Err(_) => {
                println!("{:<28} parse error", name);
                continue;
            }
        };
        let bdd = bdd_prob(&ft);
        let t = Instant::now();
        let w = wmc(&ft, WIDTH_CAP);
        let secs = t.elapsed().as_secs_f64();
        match (w, bdd) {
            (Some((cval, width)), Some(b)) => {
                let d = (cval - b).abs();
                let tagm = if d < 1e-9 { "MATCH" } else { "DIFF" };
                println!(
                    "{:<28} {:>18.10e} {:>18.10e} {:>10.1e} {:>9.3} {:>6}  {}",
                    name, cval, b, d, secs, width, tagm
                );
            }
            (Some((cval, width)), None) => {
                println!(
                    "{:<28} {:>18.10e} {:>18} {:>10} {:>9.3} {:>6}  (bdd n/a)",
                    name, cval, "-", "-", secs, width
                );
            }
            (None, Some(b)) => {
                println!(
                    "{:<28} {:>18} {:>18.10e} {:>10} {:>9.3} {:>6}  (wmc declined)",
                    name, "too-wide/fanin", b, "-", secs, "-"
                );
            }
            (None, None) => {
                println!("{:<28} both declined", name);
            }
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let paths = if args.is_empty() {
        vec![
            "C:/tmp/tiny.xml".to_string(),
            "fixtures/aralia/chinese.xml".to_string(),
            "fixtures/aralia/das9201.xml".to_string(),
            "fixtures/aralia/das9202.xml".to_string(),
            "fixtures/aralia/ftr10.xml".to_string(),
            "fixtures/aralia/isp9602.xml".to_string(),
            "fixtures/aralia/edf9203.xml".to_string(),
        ]
    } else {
        args
    };
    let handle = thread::Builder::new()
        .stack_size(1024 * 1024 * 1024)
        .spawn(move || run(paths))
        .expect("spawn");
    handle.join().expect("join");
}
