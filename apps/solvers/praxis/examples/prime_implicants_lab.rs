use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::time::Instant;

use praxis::algorithms::bdd_engine::{Bdd, BddRef};
use praxis::algorithms::ordering::{basic_events, force_order};
use praxis::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use praxis::algorithms::preprocessor::Preprocessor;
use praxis::analysis::labelled_zbdd;
use praxis::analysis::ternary_dd;
use praxis::io::parser::parse_fault_tree;

fn load_pre(path: &str) -> Option<Pdag> {
    let text = fs::read_to_string(Path::new(path)).ok()?;
    let ft = parse_fault_tree(&text).ok()?;
    let pdag = Pdag::from_fault_tree(&ft).ok()?;
    let mut pp = Preprocessor::new(pdag);
    pp.run().ok()?;
    Some(pp.into_pdag())
}

fn reachable_count(bdd: &Bdd, f: BddRef) -> usize {
    fn go(bdd: &Bdd, f: BddRef, seen: &mut HashSet<i32>) {
        if f.is_terminal() {
            return;
        }
        let r = f.regular();
        if !seen.insert(r.raw()) {
            return;
        }
        let node = bdd.node(r);
        go(bdd, node.high, seen);
        go(bdd, node.low, seen);
    }
    let mut seen = HashSet::new();
    go(bdd, f, &mut seen);
    seen.len()
}

fn implies(bdd: &Bdd, f: BddRef, assign: &HashMap<usize, bool>, memo: &mut HashMap<i32, bool>) -> bool {
    if f.is_true() {
        return true;
    }
    if f.is_false() {
        return false;
    }
    if let Some(&r) = memo.get(&f.raw()) {
        return r;
    }
    let reg = f.regular();
    let node = *bdd.node(reg);
    let (hi, lo) = if f.is_complement() {
        (node.high.complement(), node.low.complement())
    } else {
        (node.high, node.low)
    };
    let r = match assign.get(&node.var) {
        Some(&true) => implies(bdd, hi, assign, memo),
        Some(&false) => implies(bdd, lo, assign, memo),
        None => implies(bdd, hi, assign, memo) && implies(bdd, lo, assign, memo),
    };
    memo.insert(f.raw(), r);
    r
}

fn is_prime(bdd: &Bdd, f: BddRef, cube: &[i32], var_of: &HashMap<i32, usize>) -> bool {
    let mut full = HashMap::new();
    for &lit in cube {
        full.insert(var_of[&lit.abs()], lit > 0);
    }
    if !implies(bdd, f, &full, &mut HashMap::new()) {
        return false;
    }
    for &lit in cube {
        let mut reduced = full.clone();
        reduced.remove(&var_of[&lit.abs()]);
        if implies(bdd, f, &reduced, &mut HashMap::new()) {
            return false;
        }
    }
    true
}

fn build_natural(pdag: &Pdag) -> Option<(usize, usize, &'static str)> {
    let events = basic_events(pdag);
    let n = events.len();
    let mut var_of = HashMap::new();
    for (i, &e) in events.iter().enumerate() {
        var_of.insert(e, i);
    }
    let (bdd, root) = Bdd::from_pdag_with_order(pdag, &var_of).ok()?;
    let reach = reachable_count(&bdd, root);
    let kind = if root.is_true() {
        "constant TRUE"
    } else if root.is_false() {
        "constant FALSE"
    } else {
        "non-trivial"
    };
    Some((n, reach, kind))
}

fn run_diag(path: &str) {
    let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
    let text = match fs::read_to_string(Path::new(path)) {
        Ok(t) => t,
        Err(_) => {
            println!("{} read error", name);
            return;
        }
    };
    let ft = match parse_fault_tree(&text) {
        Ok(f) => f,
        Err(e) => {
            println!("{} parse error: {:?}", name, e);
            return;
        }
    };
    let raw = match Pdag::from_fault_tree(&ft) {
        Ok(p) => p,
        Err(e) => {
            println!("{} pdag error: {:?}", name, e);
            return;
        }
    };
    match build_natural(&raw) {
        Some((n, r, k)) => println!("{:<14} RAW (no preprocess):  vars={} reach={} root={}", name, n, r, k),
        None => println!("{:<14} RAW build failed", name),
    }
    let mut pp = Preprocessor::new(raw);
    if pp.run().is_err() {
        println!("{:<14} preprocess error", name);
        return;
    }
    let pre = pp.into_pdag();
    match build_natural(&pre) {
        Some((n, r, k)) => println!("{:<14} PREPROCESSED:        vars={} reach={} root={}", name, n, r, k),
        None => println!("{:<14} PREPROCESSED build failed", name),
    }
}

fn run_verify(neg: bool, path: &str) {
    let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
    let pre = match load_pre(path) {
        Some(p) => p,
        None => {
            println!("{:<14} load error", name);
            return;
        }
    };
    let events = basic_events(&pre);
    let n = events.len();
    let order = force_order(&pre);
    let mut var_of = HashMap::new();
    for &e in &events {
        var_of.insert(e, order[&e]);
    }
    let (mut bdd, root0) = match Bdd::from_pdag_with_order(&pre, &var_of) {
        Ok(x) => x,
        Err(_) => {
            println!("{:<14} bdd blowup", name);
            return;
        }
    };
    let root = if neg { root0.complement() } else { root0 };
    let reach = reachable_count(&bdd, root);
    let mut var_event = vec![0i32; n];
    let mut names = vec![String::new(); n];
    for &e in &events {
        var_event[var_of[&e]] = e;
        if let Some(PdagNode::BasicEvent { id, .. }) = pre.get_node(e) {
            names[var_of[&e]] = id.clone();
        }
    }
    let (teng, troot) = ternary_dd::prime_tdd(&mut bdd, root);
    let exp = teng.cubes(troot, &var_event);
    let tcnt = teng.count(troot);
    let (zeng, zroot) = labelled_zbdd::prime_zbdd(&mut bdd, root);
    let zcnt = labelled_zbdd::count(&zeng, zroot);
    let agree = tcnt == zcnt;
    println!(
        "{:<14} vars={} neg={} reachable_nodes={} tdd={} zbdd={} agree={}",
        name, n, neg as u8, reach, tcnt, zcnt, agree
    );
    let mut all_prime = true;
    for cube in &exp {
        if !is_prime(&bdd, root, cube, &var_of) {
            all_prime = false;
            break;
        }
    }
    println!("  every TDD cube verified prime-implicant on BDD: {}", all_prime);
    let mut shown = 0;
    for cube in &exp {
        if shown >= 6 {
            println!("    ... ({} total)", exp.len());
            break;
        }
        let mut lits: Vec<(usize, String)> = cube
            .iter()
            .map(|&lit| {
                let p = var_of[&lit.abs()];
                let s = if lit > 0 {
                    names[p].clone()
                } else {
                    format!("~{}", names[p])
                };
                (p, s)
            })
            .collect();
        lits.sort_by_key(|x| x.0);
        let txt = if lits.is_empty() {
            "TRUE".to_string()
        } else {
            lits.into_iter().map(|x| x.1).collect::<Vec<_>>().join("&")
        };
        println!("    {}", txt);
        shown += 1;
    }
}

fn run_timed(neg: bool, path: &str) {
    let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
    let pre = match load_pre(path) {
        Some(p) => p,
        None => {
            println!("{:<14} load error", name);
            return;
        }
    };
    let events = basic_events(&pre);
    let n = events.len();
    let order = force_order(&pre);
    let mut var_of = HashMap::new();
    for &e in &events {
        var_of.insert(e, order[&e]);
    }
    let mut var_event = vec![0i32; n];
    for &e in &events {
        var_event[var_of[&e]] = e;
    }
    let build = |var_of: &HashMap<NodeIndex, usize>| -> Option<(Bdd, BddRef)> {
        let (b, r0) = Bdd::from_pdag_with_order(&pre, var_of).ok()?;
        Some((b, if neg { r0.complement() } else { r0 }))
    };
    let t = Instant::now();
    let first = build(&var_of);
    let bdd_s = t.elapsed().as_secs_f64();
    if first.is_none() {
        println!("{:<14} vars={} bdd blowup", name, n);
        return;
    }

    let (mut b, r) = build(&var_of).unwrap();
    let t = Instant::now();
    let (zeng, zroot) = labelled_zbdd::prime_zbdd(&mut b, r);
    let zbdd_s = t.elapsed().as_secs_f64();
    let primes = labelled_zbdd::count(&zeng, zroot);

    let (mut b, r) = build(&var_of).unwrap();
    let t = Instant::now();
    let _ = ternary_dd::prime_tdd(&mut b, r);
    let tdd_s = t.elapsed().as_secs_f64();

    println!(
        "{:<13} vars={:<4} neg={} primes={:<14} bdd={:.3} zbdd={:.3} tdd={:.3}",
        name, n, neg as u8, primes, bdd_s, zbdd_s, tdd_s
    );
}

fn cube_to_names(cube: &[i32], names: &[String], var_of: &HashMap<NodeIndex, usize>) -> String {
    if cube.is_empty() {
        return "TRUE".to_string();
    }
    let mut lits: Vec<(usize, String)> = cube
        .iter()
        .map(|&lit| {
            let p = var_of[&lit.abs()];
            let s = if lit > 0 {
                names[p].clone()
            } else {
                format!("~{}", names[p])
            };
            (p, s)
        })
        .collect();
    lits.sort_by_key(|x| x.0);
    lits.into_iter().map(|x| x.1).collect::<Vec<_>>().join("&")
}

fn run_extract(path: &str) {
    let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
    let max_order: usize = std::env::var("ORDER")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(usize::MAX);
    let min_prob: f64 = std::env::var("MINPROB")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);
    let text = match fs::read_to_string(Path::new(path)) {
        Ok(t) => t,
        Err(_) => {
            println!("{} read error", name);
            return;
        }
    };
    let ft = match parse_fault_tree(&text) {
        Ok(f) => f,
        Err(_) => {
            println!("{} parse error", name);
            return;
        }
    };
    let pdag = match Pdag::from_fault_tree(&ft) {
        Ok(p) => p,
        Err(_) => {
            println!("{} pdag error", name);
            return;
        }
    };
    let mut pp = Preprocessor::new(pdag);
    if pp.run().is_err() {
        println!("{} preprocess error", name);
        return;
    }
    let pre = pp.into_pdag();
    let events = basic_events(&pre);
    let n = events.len();
    let order = force_order(&pre);
    let mut var_of = HashMap::new();
    let mut var_event = vec![0i32; n];
    let mut names = vec![String::new(); n];
    let mut var_prob = vec![0.01f64; n];
    for &e in &events {
        let pos = order[&e];
        var_of.insert(e, pos);
        var_event[pos] = e;
        if let Some(PdagNode::BasicEvent { id, .. }) = pre.get_node(e) {
            names[pos] = id.clone();
            if let Some(be) = ft.basic_events().get(id) {
                var_prob[pos] = be.probability();
            }
        }
    }
    let (mut bdd, root) = match Bdd::from_pdag_with_order(&pre, &var_of) {
        Ok(x) => x,
        Err(_) => {
            println!("{} bdd blowup", name);
            return;
        }
    };
    let (teng, troot) = ternary_dd::prime_tdd(&mut bdd, root);
    let total = teng.count(troot);
    let mut ext = teng.extract(troot, &var_event, &var_prob, max_order, min_prob);
    ext.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    let (mut zeng, zroot) = labelled_zbdd::prime_zbdd(&mut bdd, root);
    let zext = labelled_zbdd::extract(&zeng, zroot, &var_event, &var_prob, max_order, min_prob);
    let order_str = if max_order == usize::MAX {
        "inf".to_string()
    } else {
        max_order.to_string()
    };
    let dist = zeng.count_by_order(zroot);
    let mut orders: Vec<usize> = dist.keys().copied().collect();
    orders.sort();
    let hist: Vec<String> = orders
        .iter()
        .map(|o| format!("ord{}={}", o, dist[o]))
        .collect();
    println!(
        "{:<13} vars={} total_primes={} order_dist[{}]",
        name,
        n,
        total,
        hist.join(" ")
    );
    println!(
        "    filter(order<={}, p>={:.1e}) -> extracted={} (tdd==zbdd:{})",
        order_str,
        min_prob,
        ext.len(),
        ext.len() == zext.len()
    );
    bdd.set_var_probs(var_prob.clone());
    let exact = bdd.probability(root);
    let mut lit_probs = vec![0.0f64; 2 * n];
    for v in 0..n {
        lit_probs[2 * v] = var_prob[v];
        lit_probs[2 * v + 1] = 1.0 - var_prob[v];
    }
    zeng.set_var_probs(lit_probs);
    let rare_event = zeng.rare_event_probability(zroot);
    let log_keep: f64 = ext.iter().map(|(_, p)| (-(*p)).ln_1p()).sum();
    let mcub_extracted = -log_keep.exp_m1();
    println!(
        "    probability:  exact(BDD)={:.6e}  rare-event(all primes)={:.6e}  MCUB(extracted)={:.6e}",
        exact, rare_event, mcub_extracted
    );
    for (cube, prob) in ext.iter().take(12) {
        println!("    p={:.3e}  {}", prob, cube_to_names(cube, &names, &var_of));
    }
    if ext.len() > 12 {
        println!("    ... ({} total extracted)", ext.len());
    }
}

fn run_corpus(neg: bool, path: &str) {
    let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
    let t = Instant::now();
    let pre = match load_pre(path) {
        Some(p) => p,
        None => {
            println!("{:<14} load/preprocess error", name);
            return;
        }
    };
    let events = basic_events(&pre);
    let n = events.len();
    if n == 0 {
        println!("{:<14} no events", name);
        return;
    }
    let order = force_order(&pre);
    let mut var_of = HashMap::new();
    for &e in &events {
        var_of.insert(e, order[&e]);
    }
    let (mut bdd, root0) = match Bdd::from_pdag_with_order(&pre, &var_of) {
        Ok(x) => x,
        Err(_) => {
            println!("{:<14} vars={} bdd blowup", name, n);
            return;
        }
    };
    let root = if neg { root0.complement() } else { root0 };
    let fnodes = bdd.node_count();
    let mut var_event = vec![0i32; n];
    for &e in &events {
        var_event[var_of[&e]] = e;
    }
    let (zeng, zroot) = labelled_zbdd::prime_zbdd(&mut bdd, root);
    let zcnt = labelled_zbdd::count(&zeng, zroot);
    let (teng, troot) = ternary_dd::prime_tdd(&mut bdd, root);
    let tcnt = teng.count(troot);
    let agree = if zcnt == tcnt { "agree" } else { "DISAGREE" };
    let secs = t.elapsed().as_secs_f64();
    println!(
        "{:<14} vars={} neg={} primes={} fbdd={} zbdd_n={} tdd_n={} {} secs={:.2}",
        name,
        n,
        neg as u8,
        zcnt,
        fnodes,
        zeng.node_count(),
        teng.node_count(),
        agree,
        secs
    );
}

fn eval(bdd: &Bdd, f: BddRef, assign: u64) -> bool {
    if f.is_true() {
        return true;
    }
    if f.is_false() {
        return false;
    }
    let reg = f.regular();
    let node = bdd.node(reg);
    let bit = (assign >> node.var) & 1 == 1;
    let child = if bit { node.high } else { node.low };
    let res = eval(bdd, child, assign);
    if f.is_complement() {
        !res
    } else {
        res
    }
}

fn qm_primes(bdd: &Bdd, root: BddRef, n: usize) -> Vec<(u64, u64)> {
    let full = if n == 0 { 0 } else { (1u64 << n) - 1 };
    let mut current: HashSet<(u64, u64)> = HashSet::new();
    for a in 0u64..(1u64 << n) {
        if eval(bdd, root, a) {
            current.insert((full, a & full));
        }
    }
    let mut primes: HashSet<(u64, u64)> = HashSet::new();
    while !current.is_empty() {
        let cubes: Vec<(u64, u64)> = current.iter().copied().collect();
        let mut used = vec![false; cubes.len()];
        let mut next: HashSet<(u64, u64)> = HashSet::new();
        for i in 0..cubes.len() {
            for j in (i + 1)..cubes.len() {
                let (mi, vi) = cubes[i];
                let (mj, vj) = cubes[j];
                if mi != mj {
                    continue;
                }
                let diff = (vi ^ vj) & mi;
                if diff != 0 && diff & diff.wrapping_sub(1) == 0 {
                    let nm = mi & !diff;
                    next.insert((nm, vi & nm));
                    used[i] = true;
                    used[j] = true;
                }
            }
        }
        for (k, c) in cubes.iter().enumerate() {
            if !used[k] {
                primes.insert(*c);
            }
        }
        current = next;
    }
    primes.into_iter().collect()
}

fn oracle_strs(bdd: &Bdd, root: BddRef, n: usize, names: &[String]) -> Vec<String> {
    let mut out: Vec<String> = qm_primes(bdd, root, n)
        .iter()
        .map(|&(mask, val)| {
            let mut lits: Vec<String> = Vec::new();
            for i in 0..n {
                if (mask >> i) & 1 == 1 {
                    if (val >> i) & 1 == 1 {
                        lits.push(names[i].clone());
                    } else {
                        lits.push(format!("~{}", names[i]));
                    }
                }
            }
            if lits.is_empty() {
                "TRUE".to_string()
            } else {
                lits.join("&")
            }
        })
        .collect();
    out.sort();
    out
}

fn meta_strs(cubes: &HashSet<Vec<i32>>, names: &[String], pos_of: &HashMap<i32, usize>) -> Vec<String> {
    let mut out: Vec<String> = cubes
        .iter()
        .map(|cube| {
            if cube.is_empty() {
                return "TRUE".to_string();
            }
            let mut lits: Vec<(usize, String)> = cube
                .iter()
                .map(|&lit| {
                    let p = pos_of[&lit.abs()];
                    let s = if lit > 0 {
                        names[p].clone()
                    } else {
                        format!("~{}", names[p])
                    };
                    (p, s)
                })
                .collect();
            lits.sort_by_key(|x| x.0);
            lits.into_iter().map(|x| x.1).collect::<Vec<_>>().join("&")
        })
        .collect();
    out.sort();
    out
}

fn analyze(pdag: &Pdag, label: &str) -> Vec<String> {
    let events = basic_events(pdag);
    let n = events.len();
    let mut var_of = HashMap::new();
    let mut pos_of = HashMap::new();
    for (i, &e) in events.iter().enumerate() {
        var_of.insert(e, i);
        pos_of.insert(e, i);
    }
    let (mut bdd, root) = Bdd::from_pdag_with_order(pdag, &var_of).expect("bdd build");
    let mut names = vec![String::new(); n];
    for (i, &e) in events.iter().enumerate() {
        if let Some(PdagNode::BasicEvent { id, .. }) = pdag.get_node(e) {
            names[i] = id.clone();
        }
    }
    let oracle = oracle_strs(&bdd, root, n, &names);
    let (zeng, zroot) = labelled_zbdd::prime_zbdd(&mut bdd, root);
    let zcnt = labelled_zbdd::count(&zeng, zroot) as usize;
    let zcube_set: HashSet<Vec<i32>> = labelled_zbdd::cubes(&zeng, zroot, &events).into_iter().collect();
    let zbdd = meta_strs(&zcube_set, &names, &pos_of);
    let (teng, troot) = ternary_dd::prime_tdd(&mut bdd, root);
    let tcnt = teng.count(troot) as usize;
    let tcube_set: HashSet<Vec<i32>> = teng.cubes(troot, &events).into_iter().collect();
    let tdd = meta_strs(&tcube_set, &names, &pos_of);
    let v_zbdd = if oracle == zbdd && zcnt == oracle.len() { "ok" } else { "FAIL" };
    let v_tdd = if oracle == tdd && tcnt == oracle.len() { "ok" } else { "FAIL" };
    println!(
        "{:<24} vars={} oracle={} zbdd[{}]={}n tdd[{}]={}n",
        label,
        n,
        oracle.len(),
        v_zbdd,
        zeng.node_count(),
        v_tdd,
        teng.node_count()
    );
    if v_zbdd == "FAIL" || v_tdd == "FAIL" {
        let os: HashSet<&String> = oracle.iter().collect();
        let zs: HashSet<&String> = zbdd.iter().collect();
        println!("    oracle-only: {:?}", os.difference(&zs).collect::<Vec<_>>());
    }
    for s in &oracle {
        println!("    {}", s);
    }
    oracle
}

fn check(label: &str, got: &[String], expected: &[&str]) {
    let g: HashSet<&str> = got.iter().map(|s| s.as_str()).collect();
    let e: HashSet<&str> = expected.iter().copied().collect();
    if g == e {
        println!("  [expected OK] {}", label);
    } else {
        println!("  [expected FAIL] {} got {:?} want {:?}", label, g, e);
    }
}

fn ev(p: &mut Pdag, name: &str) -> NodeIndex {
    p.add_basic_event(name.to_string())
}

fn gate(p: &mut Pdag, name: &str, c: Connective, ops: Vec<NodeIndex>) -> NodeIndex {
    p.add_gate(name.to_string(), c, ops, None).unwrap()
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(|s| s.as_str()) == Some("corpus") {
        let neg = args.get(1).map(|s| s.as_str()) == Some("neg");
        let files = if neg { &args[2..] } else { &args[1..] };
        for f in files {
            run_corpus(neg, f);
        }
        return;
    }
    if args.first().map(|s| s.as_str()) == Some("timed") {
        let neg = args.get(1).map(|s| s.as_str()) == Some("neg");
        let files = if neg { &args[2..] } else { &args[1..] };
        for f in files {
            run_timed(neg, f);
        }
        return;
    }
    if args.first().map(|s| s.as_str()) == Some("extract") {
        for f in &args[1..] {
            run_extract(f);
        }
        return;
    }
    if args.first().map(|s| s.as_str()) == Some("diag") {
        for f in &args[1..] {
            run_diag(f);
        }
        return;
    }
    if args.first().map(|s| s.as_str()) == Some("verify") {
        let neg = args.get(1).map(|s| s.as_str()) == Some("neg");
        let files = if neg { &args[2..] } else { &args[1..] };
        for f in files {
            run_verify(neg, f);
        }
        return;
    }
    println!("=== prime implicants: meta-products vs Quine-McCluskey oracle ===\n");

    let mut p = Pdag::new();
    let a = ev(&mut p, "a");
    let b = ev(&mut p, "b");
    let c = ev(&mut p, "c");
    let g1 = gate(&mut p, "g1", Connective::And, vec![a, b]);
    let g2 = gate(&mut p, "g2", Connective::And, vec![-a, c]);
    let top = gate(&mut p, "top", Connective::Or, vec![g1, g2]);
    p.set_root(top).unwrap();
    let got = analyze(&p, "consensus (a&b)|(~a&c)");
    check("consensus has b&c", &got, &["a&b", "~a&c", "b&c"]);

    let mut p = Pdag::new();
    let a = ev(&mut p, "a");
    let b = ev(&mut p, "b");
    let top = gate(&mut p, "top", Connective::Or, vec![a, b]);
    p.set_root(top).unwrap();
    let got = analyze(&p, "a|b");
    check("a|b", &got, &["a", "b"]);

    let mut p = Pdag::new();
    let a = ev(&mut p, "a");
    let b = ev(&mut p, "b");
    let c = ev(&mut p, "c");
    let g1 = gate(&mut p, "g1", Connective::And, vec![a, b]);
    let f = gate(&mut p, "f", Connective::Or, vec![g1, c]);
    let neg = gate(&mut p, "neg", Connective::Not, vec![f]);
    p.set_root(neg).unwrap();
    let got = analyze(&p, "~((a&b)|c) success branch");
    check("success branch", &got, &["~a&~c", "~b&~c"]);

    // a richer non-coherent mix: (a&b) | (~b&c&d) | (~a&d)
    let mut p = Pdag::new();
    let a = ev(&mut p, "a");
    let b = ev(&mut p, "b");
    let c = ev(&mut p, "c");
    let d = ev(&mut p, "d");
    let g1 = gate(&mut p, "g1", Connective::And, vec![a, b]);
    let g2 = gate(&mut p, "g2", Connective::And, vec![-b, c, d]);
    let g3 = gate(&mut p, "g3", Connective::And, vec![-a, d]);
    let top = gate(&mut p, "top", Connective::Or, vec![g1, g2, g3]);
    p.set_root(top).unwrap();
    analyze(&p, "(a&b)|(~b&c&d)|(~a&d)");
}
