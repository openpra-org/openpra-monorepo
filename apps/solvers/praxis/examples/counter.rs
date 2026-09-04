use std::collections::HashMap;
use std::collections::HashSet;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use praxis::algorithms::bdd_engine::Bdd;
use praxis::algorithms::pdag::Pdag;
use praxis::analysis::width::compute_dfs_metadata_pdag;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::Formula;
use praxis::io::parser::parse_fault_tree;

const WIDTH_CAP: usize = 24;
const VAR_LIMIT: usize = 2500;
const CUTOFF: f64 = 30.0;
const WORKERS: usize = 4;

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
    Factor {
        vars: new_vars,
        table,
    }
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
        let mut table = vec![0.0; 4];
        for idx in 0..4 {
            let ob = idx & 1 == 1;
            let ab = (idx >> 1) & 1 == 1;
            table[idx] = if ob == !ab { 1.0 } else { 0.0 };
        }
        self.factors.push(Factor {
            vars: vec![out, a],
            table,
        });
    }

    fn bin(&mut self, out: usize, a: usize, b: usize, kind: u8) {
        let mut table = vec![0.0; 8];
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
            table[idx] = if ob == f { 1.0 } else { 0.0 };
        }
        self.factors.push(Factor {
            vars: vec![out, a, b],
            table,
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

    fn encode(&mut self, out: usize, formula: &Formula, ops: &[usize]) {
        match formula {
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

fn min_fill_order(
    scopes: &[Vec<usize>],
    num_vars: usize,
    cap: usize,
) -> Option<(Vec<usize>, usize)> {
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
    let base = var_of.len();
    let mut b = Builder {
        next_var: base,
        factors: Vec::new(),
    };
    for (be, ev) in ft.basic_events() {
        let v = var_of[be];
        let p = ev.probability();
        b.factors.push(Factor {
            vars: vec![v],
            table: vec![1.0 - p, p],
        });
    }
    for (gid, gate) in ft.gates() {
        let out = var_of[gid];
        let op_vars: Vec<usize> = gate.operands().iter().map(|o| var_of[o]).collect();
        b.encode(out, gate.formula(), &op_vars);
        if b.next_var > VAR_LIMIT {
            return None;
        }
    }
    let top = var_of[ft.top_event()];
    b.force(top, true);
    let num_vars = b.next_var;
    if num_vars > VAR_LIMIT {
        return None;
    }
    let scopes: Vec<Vec<usize>> = b.factors.iter().map(|f| f.vars.clone()).collect();
    let (order, width) = min_fill_order(&scopes, num_vars, cap)?;

    let mut bucket_of: HashMap<usize, Vec<usize>> = HashMap::new();
    for (fi, f) in b.factors.iter().enumerate() {
        if let Some(first) = order.iter().position(|&v| f.vars.contains(&v)) {
            bucket_of.entry(order[first]).or_default().push(fi);
        }
    }
    let mut live: Vec<Option<Factor>> = b.factors.into_iter().map(Some).collect();
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
        extra.push(sum_out(&prod, v));
    }
    let mut result = 1.0;
    for f in &extra {
        result *= f.table[0];
    }
    Some((result, width))
}

fn bdd_prob(ft: &FaultTree) -> Option<f64> {
    let pdag = Pdag::from_fault_tree(ft).ok()?;
    let meta = compute_dfs_metadata_pdag(&pdag).ok()?;
    let var_probs = pdag.level_var_probs(ft, &meta.var_of).ok()?;
    let (bdd, root) = Bdd::from_pdag_with_order_and_probs(&pdag, &meta.var_of, var_probs).ok()?;
    Some(bdd.probability(root))
}

fn one(path: &str) {
    let mut out = std::io::stdout();
    let ft = match read_text(Path::new(path)).and_then(|x| parse_fault_tree(&x).ok()) {
        Some(f) => f,
        None => {
            println!("WMC NA - BDD NA");
            return;
        }
    };
    let t = Instant::now();
    match wmc(&ft, WIDTH_CAP) {
        Some((v, w)) => {
            let _ = writeln!(out, "WMC {:.12e} {} {:.3}", v, w, t.elapsed().as_secs_f64());
        }
        None => {
            let _ = writeln!(out, "WMC NA - {:.3}", t.elapsed().as_secs_f64());
        }
    }
    let _ = out.flush();
    let t2 = Instant::now();
    match bdd_prob(&ft) {
        Some(v) => {
            let _ = writeln!(out, "BDD {:.12e} {:.3}", v, t2.elapsed().as_secs_f64());
        }
        None => {
            let _ = writeln!(out, "BDD NA {:.3}", t2.elapsed().as_secs_f64());
        }
    }
    let _ = out.flush();
}

fn find_xml(root: &Path, out: &mut Vec<PathBuf>) {
    if root.is_file() {
        if root.extension().map_or(false, |x| x == "xml") {
            out.push(root.to_path_buf());
        }
        return;
    }
    if let Ok(rd) = fs::read_dir(root) {
        let mut entries: Vec<PathBuf> = rd.flatten().map(|e| e.path()).collect();
        entries.sort();
        for p in entries {
            if p.is_dir() {
                find_xml(&p, out);
            } else if p.extension().map_or(false, |x| x == "xml") {
                out.push(p);
            }
        }
    }
}

#[derive(Debug)]
struct Res {
    file: String,
    wmc: Option<f64>,
    width: Option<usize>,
    wmc_secs: f64,
    bdd: Option<f64>,
    bdd_secs: f64,
    timeout: bool,
}

fn run_one_subprocess(exe: &Path, path: &str) -> Res {
    let mut r = Res {
        file: path.to_string(),
        wmc: None,
        width: None,
        wmc_secs: 0.0,
        bdd: None,
        bdd_secs: 0.0,
        timeout: false,
    };
    let child = Command::new(exe)
        .args(["one", path])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn();
    let mut child = match child {
        Ok(c) => c,
        Err(_) => return r,
    };
    let t = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                let mut s = String::new();
                if let Some(mut so) = child.stdout.take() {
                    let _ = so.read_to_string(&mut s);
                }
                parse_one(&s, &mut r);
                return r;
            }
            Ok(None) => {
                if t.elapsed().as_secs_f64() >= CUTOFF {
                    let _ = child.kill();
                    let mut s = String::new();
                    if let Some(mut so) = child.stdout.take() {
                        let _ = so.read_to_string(&mut s);
                    }
                    let _ = child.wait();
                    parse_one(&s, &mut r);
                    r.timeout = true;
                    return r;
                }
                thread::sleep(Duration::from_millis(20));
            }
            Err(_) => return r,
        }
    }
}

fn parse_one(s: &str, r: &mut Res) {
    for line in s.lines() {
        let p: Vec<&str> = line.split_whitespace().collect();
        if p.first() == Some(&"WMC") {
            r.wmc = p.get(1).and_then(|x| x.parse::<f64>().ok());
            r.width = p.get(2).and_then(|x| x.parse::<usize>().ok());
            r.wmc_secs = p.get(3).and_then(|x| x.parse::<f64>().ok()).unwrap_or(0.0);
        } else if p.first() == Some(&"BDD") {
            r.bdd = p.get(1).and_then(|x| x.parse::<f64>().ok());
            r.bdd_secs = p.get(2).and_then(|x| x.parse::<f64>().ok()).unwrap_or(0.0);
        }
    }
}

fn corpus(paths: Vec<String>) {
    let exe = env::current_exe().expect("exe");
    let mut files: Vec<PathBuf> = Vec::new();
    for p in &paths {
        find_xml(Path::new(p), &mut files);
    }
    eprintln!("trees: {}", files.len());
    let files: Vec<String> = files
        .iter()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .collect();

    let files = Arc::new(files);
    let cursor = Arc::new(AtomicUsize::new(0));
    let done = Arc::new(AtomicUsize::new(0));
    let results: Arc<Mutex<Vec<Res>>> = Arc::new(Mutex::new(Vec::new()));
    let total = files.len();

    let mut handles = Vec::new();
    for _ in 0..WORKERS {
        let files = Arc::clone(&files);
        let cursor = Arc::clone(&cursor);
        let done = Arc::clone(&done);
        let results = Arc::clone(&results);
        let exe = exe.clone();
        handles.push(thread::spawn(move || loop {
            let i = cursor.fetch_add(1, Ordering::SeqCst);
            if i >= files.len() {
                break;
            }
            let r = run_one_subprocess(&exe, &files[i]);
            results.lock().unwrap().push(r);
            let d = done.fetch_add(1, Ordering::SeqCst) + 1;
            if d % 50 == 0 {
                eprintln!("{}/{}", d, total);
            }
        }));
    }
    for h in handles {
        let _ = h.join();
    }

    let results = Arc::try_unwrap(results).unwrap().into_inner().unwrap();
    let mut both = 0;
    let mut matched = 0;
    let mut mism: Vec<&Res> = Vec::new();
    let mut wmc_only: Vec<&Res> = Vec::new();
    let mut bdd_only = 0;
    let mut neither = 0;
    let mut wmc_solved = 0;
    let mut bdd_solved = 0;
    let mut max_w = 0usize;
    for r in &results {
        if r.wmc.is_some() {
            wmc_solved += 1;
            max_w = max_w.max(r.width.unwrap_or(0));
        }
        if r.bdd.is_some() {
            bdd_solved += 1;
        }
        match (r.wmc, r.bdd) {
            (Some(w), Some(b)) => {
                both += 1;
                if (w - b).abs() < 1e-9 {
                    matched += 1;
                } else {
                    mism.push(r);
                }
            }
            (Some(_), None) => wmc_only.push(r),
            (None, Some(_)) => bdd_only += 1,
            (None, None) => neither += 1,
        }
    }

    println!(
        "=== counter (binarized WMC) vs BDD over {} trees ===",
        total
    );
    println!("wmc solved:        {}", wmc_solved);
    println!("bdd solved:        {}", bdd_solved);
    println!(
        "both solved:       {}  (match {}, MISMATCH {})",
        both,
        matched,
        mism.len()
    );
    println!("wmc-only (BDD failed/timeout): {}", wmc_only.len());
    println!("bdd-only:          {}", bdd_only);
    println!("neither:           {}", neither);
    println!("max width solved by wmc: {}", max_w);
    if !mism.is_empty() {
        println!("--- MISMATCHES ---");
        for r in mism.iter().take(20) {
            println!(
                "  {}  wmc={:.6e} bdd={:.6e}",
                short(&r.file),
                r.wmc.unwrap(),
                r.bdd.unwrap()
            );
        }
    }
    if !wmc_only.is_empty() {
        println!("--- WMC-ONLY WINS (BDD did not return) ---");
        let mut ws: Vec<&&Res> = wmc_only.iter().collect();
        ws.sort_by_key(|r| std::cmp::Reverse(r.width.unwrap_or(0)));
        for r in ws.iter().take(20) {
            let to = if r.timeout { " (bdd timeout)" } else { "" };
            println!(
                "  {}  wmc={:.6e} width={} {:.2}s{}",
                short(&r.file),
                r.wmc.unwrap(),
                r.width.unwrap_or(0),
                r.wmc_secs,
                to
            );
        }
    }
}

fn short(p: &str) -> String {
    let parts: Vec<&str> = p.split('/').collect();
    let n = parts.len();
    if n >= 2 {
        format!("{}/{}", parts[n - 2], parts[n - 1])
    } else {
        p.to_string()
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() >= 3 && args[1] == "one" {
        let path = args[2].clone();
        let h = thread::Builder::new()
            .stack_size(1024 * 1024 * 1024)
            .spawn(move || one(&path))
            .expect("spawn");
        h.join().expect("join");
        return;
    }
    let paths = if args.len() > 1 {
        args[1..].to_vec()
    } else {
        vec![
            "fixtures/aralia".to_string(),
            "fixtures/synthetic".to_string(),
        ]
    };
    let h = thread::Builder::new()
        .stack_size(1024 * 1024 * 1024)
        .spawn(move || corpus(paths))
        .expect("spawn");
    h.join().expect("join");
}
