use std::collections::{HashMap, HashSet};
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
use praxis::algorithms::bdd_pdag::{BddPdag, BddPdagNode, NodeIdx};
use praxis::algorithms::mocus::Mocus;
use praxis::analysis::width::{
    build_incidence_graph_full, compute_dfs_metadata, greedy_vertex_separation_pathwidth,
    maximal_modules, min_fill_treewidth, IncidenceGraph,
};
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::mc::DpMonteCarloAnalysis;
use praxis::io::parser::parse_fault_tree;

const WIDTH_CAP: usize = 4000;
const RARE: f64 = 1e-3;
const CUTOFF: f64 = 10.0;
const MC_TRIALS: usize = 2000;
const MC_SEED: u64 = 12345;
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

fn extract_subtree(ft: &FaultTree, root: &str) -> Option<FaultTree> {
    ft.get_gate(root)?;
    let mut sub = FaultTree::new("core", root).ok()?;
    let mut seen: HashSet<String> = HashSet::new();
    let mut bes: HashSet<String> = HashSet::new();
    let mut gate_ids: Vec<String> = Vec::new();
    let mut stack = vec![root.to_string()];
    seen.insert(root.to_string());
    while let Some(gid) = stack.pop() {
        gate_ids.push(gid.clone());
        let g = ft.get_gate(&gid)?;
        for op in g.operands() {
            if ft.basic_events().contains_key(op) {
                bes.insert(op.clone());
            } else if ft.gates().contains_key(op) && seen.insert(op.clone()) {
                stack.push(op.clone());
            }
        }
    }
    for gid in &gate_ids {
        let g = ft.get_gate(gid)?;
        let mut ng = Gate::new(gid.clone(), g.formula().clone()).ok()?;
        for op in g.operands() {
            ng.add_operand(op.clone());
        }
        sub.add_gate(ng).ok()?;
    }
    for be in &bes {
        let p = ft.get_basic_event(be)?.probability();
        sub.add_basic_event(BasicEvent::new(be.clone(), p).ok()?).ok()?;
    }
    Some(sub)
}

fn arm_bdd(ft: &FaultTree) -> Option<f64> {
    let mut pdag = BddPdag::from_fault_tree(ft).ok()?;
    pdag.compute_ordering_and_modules().ok()?;
    let (bdd, root) = Bdd::build_from_pdag(&pdag).ok()?;
    Some(bdd.probability(root))
}

fn arm_mocus(ft: &FaultTree) -> Option<f64> {
    let mut m = Mocus::new(ft);
    let cut_sets = m.analyze().ok()?;
    let p: f64 = cut_sets
        .iter()
        .map(|cs| {
            cs.events
                .iter()
                .map(|e| ft.get_basic_event(e).map(|b| b.probability()).unwrap_or(0.0))
                .product::<f64>()
        })
        .sum::<f64>();
    Some(p.min(1.0))
}

fn arm_mc(ft: &FaultTree) -> Option<(f64, f64, f64)> {
    let a = DpMonteCarloAnalysis::new(ft, Some(MC_SEED), MC_TRIALS).ok()?;
    let r = a.run_cpu().ok()?;
    Some((
        r.probability_estimate,
        r.confidence_interval_lower,
        r.confidence_interval_upper,
    ))
}

fn run_arm_main(arm: &str, path: &str, root: &str) {
    let text = match read_text(Path::new(path)) {
        Some(t) => t,
        None => {
            println!("ERR");
            return;
        }
    };
    let ft = match parse_fault_tree(&text) {
        Ok(f) => f,
        Err(_) => {
            println!("ERR");
            return;
        }
    };
    let sub = match extract_subtree(&ft, root) {
        Some(s) => s,
        None => {
            println!("ERR");
            return;
        }
    };
    match arm {
        "bdd" => match arm_bdd(&sub) {
            Some(v) => println!("OK {:.17e}", v),
            None => println!("UNSUPPORTED"),
        },
        "mocus" => match arm_mocus(&sub) {
            Some(v) => println!("OK {:.17e}", v),
            None => println!("UNSUPPORTED"),
        },
        "mc" => match arm_mc(&sub) {
            Some((v, lo, hi)) => println!("OK {:.17e} {:.17e} {:.17e}", v, lo, hi),
            None => println!("UNSUPPORTED"),
        },
        _ => println!("ERR"),
    }
}

struct Feats {
    num_vars: usize,
    num_gates: usize,
    nv: usize,
    ne: usize,
    tw: Option<usize>,
    pw: Option<usize>,
    mean_fanout: f64,
    max_fanout: usize,
    frac_shared: f64,
    pmin: f64,
    pmed: f64,
    pmax: f64,
    frac_rare: f64,
    f_and: f64,
    f_or: f64,
    f_atl: f64,
    f_xor: f64,
}

fn parent_counts(pdag: &BddPdag, root: NodeIdx) -> HashMap<NodeIdx, usize> {
    let mut pc: HashMap<NodeIdx, usize> = HashMap::new();
    let mut seen: HashSet<NodeIdx> = HashSet::new();
    let mut stack = vec![root.abs()];
    while let Some(n) = stack.pop() {
        if !seen.insert(n) {
            continue;
        }
        if let Some(BddPdagNode::Gate { operands, .. }) = pdag.node(n) {
            for &op in operands {
                *pc.entry(op.abs()).or_insert(0) += 1;
                stack.push(op.abs());
            }
        }
    }
    pc
}

fn compute_feats(
    pdag: &BddPdag,
    ft: &FaultTree,
    graph: &IncidenceGraph,
    pc: &HashMap<NodeIdx, usize>,
) -> Feats {
    let verts: Vec<NodeIdx> = graph.vertices().collect();
    let nv = graph.num_vertices();
    let ne = graph.num_edges();
    let mut probs: Vec<f64> = Vec::new();
    let mut fanouts: Vec<usize> = Vec::new();
    let (mut num_vars, mut num_gates, mut shared) = (0usize, 0usize, 0usize);
    let (mut and, mut or, mut atl, mut xor, mut typed) = (0usize, 0usize, 0usize, 0usize, 0usize);
    for &v in &verts {
        match pdag.node(v) {
            Some(BddPdagNode::Variable { .. }) => {
                num_vars += 1;
                if let Some(p) = pdag.probability_of(v) {
                    probs.push(p);
                }
                let fo = pc.get(&v).copied().unwrap_or(0);
                fanouts.push(fo);
                if fo > 1 {
                    shared += 1;
                }
            }
            Some(BddPdagNode::Gate { .. }) => {
                num_gates += 1;
                if let Some(g) = pdag.node(v).and_then(|n| n.id()).and_then(|name| ft.get_gate(name)) {
                    typed += 1;
                    match g.formula() {
                        Formula::And | Formula::Nand => and += 1,
                        Formula::Or | Formula::Nor => or += 1,
                        Formula::AtLeast { .. } => atl += 1,
                        Formula::Xor | Formula::Iff => xor += 1,
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
    probs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let (pmin, pmed, pmax, frac_rare) = if probs.is_empty() {
        (f64::NAN, f64::NAN, f64::NAN, f64::NAN)
    } else {
        let fr = probs.iter().filter(|&&p| p < RARE).count() as f64 / probs.len() as f64;
        (probs[0], probs[probs.len() / 2], *probs.last().unwrap(), fr)
    };
    let mean_fanout = if fanouts.is_empty() {
        0.0
    } else {
        fanouts.iter().sum::<usize>() as f64 / fanouts.len() as f64
    };
    let max_fanout = fanouts.iter().copied().max().unwrap_or(0);
    let frac_shared = if num_vars == 0 {
        0.0
    } else {
        shared as f64 / num_vars as f64
    };
    let gt = if typed == 0 { 1.0 } else { typed as f64 };
    let (tw, pw) = if nv > 0 && nv <= WIDTH_CAP {
        (
            Some(min_fill_treewidth(graph).upper_bound),
            Some(greedy_vertex_separation_pathwidth(graph).upper_bound),
        )
    } else {
        (None, None)
    };
    Feats {
        num_vars,
        num_gates,
        nv,
        ne,
        tw,
        pw,
        mean_fanout,
        max_fanout,
        frac_shared,
        pmin,
        pmed,
        pmax,
        frac_rare,
        f_and: and as f64 / gt,
        f_or: or as f64 / gt,
        f_atl: atl as f64 / gt,
        f_xor: xor as f64 / gt,
    }
}

struct Task {
    file: String,
    core_root: String,
    f: Feats,
}

fn find_xml(root: &Path, out: &mut Vec<PathBuf>) {
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

fn decompose(path: &Path, tasks: &mut Vec<Task>) {
    let text = match read_text(path) {
        Some(t) => t,
        None => return,
    };
    let ft = match parse_fault_tree(&text) {
        Ok(f) => f,
        Err(_) => return,
    };
    let mut pdag = match BddPdag::from_fault_tree(&ft) {
        Ok(p) => p,
        Err(_) => return,
    };
    if pdag.compute_ordering_and_modules().is_err() {
        return;
    }
    let root = match pdag.root() {
        Some(r) => r,
        None => return,
    };
    let meta = match compute_dfs_metadata(&pdag) {
        Ok(m) => m,
        Err(_) => return,
    };
    let pc = parent_counts(&pdag, root);
    for &m in &maximal_modules(&meta) {
        let name = match pdag.node(m).and_then(|n| n.id()) {
            Some(n) if ft.get_gate(n).is_some() => n.to_string(),
            _ => continue,
        };
        let g = build_incidence_graph_full(&pdag, m);
        let f = compute_feats(&pdag, &ft, &g, &pc);
        tasks.push(Task {
            file: path.to_string_lossy().replace('\\', "/"),
            core_root: name,
            f,
        });
    }
}

struct ArmOutcome {
    status: String,
    secs: f64,
    val: Option<f64>,
    lo: Option<f64>,
    hi: Option<f64>,
}

fn run_arm_subprocess(exe: &Path, arm: &str, file: &str, root: &str) -> ArmOutcome {
    let t = Instant::now();
    let child = Command::new(exe)
        .args(["run-arm", arm, file, root])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn();
    let mut child = match child {
        Ok(c) => c,
        Err(_) => {
            return ArmOutcome {
                status: "failed".into(),
                secs: 0.0,
                val: None,
                lo: None,
                hi: None,
            }
        }
    };
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let secs = t.elapsed().as_secs_f64();
                let mut out = String::new();
                if let Some(mut so) = child.stdout.take() {
                    let _ = so.read_to_string(&mut out);
                }
                if !status.success() {
                    return ArmOutcome { status: "failed".into(), secs, val: None, lo: None, hi: None };
                }
                let out = out.trim();
                if let Some(rest) = out.strip_prefix("OK ") {
                    let p: Vec<&str> = rest.split_whitespace().collect();
                    let val = p.get(0).and_then(|s| s.parse::<f64>().ok());
                    let (lo, hi) = if p.len() >= 3 {
                        (p[1].parse::<f64>().ok(), p[2].parse::<f64>().ok())
                    } else {
                        (None, None)
                    };
                    return ArmOutcome { status: "ok".into(), secs, val, lo, hi };
                } else if out.contains("UNSUPPORTED") {
                    return ArmOutcome { status: "unsupported".into(), secs, val: None, lo: None, hi: None };
                } else {
                    return ArmOutcome { status: "failed".into(), secs, val: None, lo: None, hi: None };
                }
            }
            Ok(None) => {
                if t.elapsed().as_secs_f64() >= CUTOFF {
                    let _ = child.kill();
                    let _ = child.wait();
                    return ArmOutcome { status: "timeout".into(), secs: CUTOFF, val: None, lo: None, hi: None };
                }
                thread::sleep(Duration::from_millis(20));
            }
            Err(_) => {
                return ArmOutcome {
                    status: "failed".into(),
                    secs: t.elapsed().as_secs_f64(),
                    val: None,
                    lo: None,
                    hi: None,
                }
            }
        }
    }
}

fn fu(o: Option<usize>) -> String {
    o.map(|x| x.to_string()).unwrap_or_default()
}
fn ff(x: f64) -> String {
    if x.is_nan() {
        String::new()
    } else {
        format!("{:.6}", x)
    }
}
fn fv(o: Option<f64>) -> String {
    match o {
        Some(x) if !x.is_nan() => format!("{:.10e}", x),
        _ => String::new(),
    }
}

fn orchestrate(dirs: Vec<String>) {
    let exe = env::current_exe().expect("current exe");

    let mut files: Vec<PathBuf> = Vec::new();
    for d in &dirs {
        find_xml(Path::new(d), &mut files);
    }
    eprintln!("phase 1: decomposing {} trees ...", files.len());
    let mut tasks: Vec<Task> = Vec::new();
    for p in &files {
        decompose(p, &mut tasks);
    }
    eprintln!("phase 1 done: {} module cores to label", tasks.len());

    let out = "C:/tmp/praxis_labeled.csv";
    let mut header = String::new();
    header.push_str("file,core_root,num_vars,num_gates,num_vertices,num_edges,treewidth,pathwidth,mean_fanout,max_fanout,frac_shared,prob_min,prob_median,prob_max,frac_rare,frac_and,frac_or,frac_atleast,frac_xor,");
    header.push_str("bdd_status,bdd_secs,bdd_val,mocus_status,mocus_secs,mocus_val,mc_status,mc_secs,mc_val,mc_ci_lo,mc_ci_hi,exact_val,best_arm\n");
    let file = Arc::new(Mutex::new(fs::File::create(out).expect("create csv")));
    file.lock().unwrap().write_all(header.as_bytes()).unwrap();

    let tasks = Arc::new(tasks);
    let cursor = Arc::new(AtomicUsize::new(0));
    let done = Arc::new(AtomicUsize::new(0));
    let total = tasks.len();

    let mut handles = Vec::new();
    for _ in 0..WORKERS {
        let tasks = Arc::clone(&tasks);
        let cursor = Arc::clone(&cursor);
        let done = Arc::clone(&done);
        let file = Arc::clone(&file);
        let exe = exe.clone();
        handles.push(thread::spawn(move || loop {
            let i = cursor.fetch_add(1, Ordering::SeqCst);
            if i >= tasks.len() {
                break;
            }
            let t = &tasks[i];
            let bdd = run_arm_subprocess(&exe, "bdd", &t.file, &t.core_root);
            let mocus = run_arm_subprocess(&exe, "mocus", &t.file, &t.core_root);
            let mc = run_arm_subprocess(&exe, "mc", &t.file, &t.core_root);

            let exact = if bdd.status == "ok" { bdd.val } else { None };
            let best = if bdd.status == "ok" {
                "bdd"
            } else if mc.status == "ok" {
                "mc"
            } else if mocus.status == "ok" {
                "mocus"
            } else {
                "none"
            };

            let f = &t.f;
            let row = format!(
                "{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{:.3},{},{},{:.3},{},{},{:.3},{},{},{},{},{}\n",
                t.file, t.core_root, f.num_vars, f.num_gates, f.nv, f.ne,
                fu(f.tw), fu(f.pw), ff(f.mean_fanout), f.max_fanout, ff(f.frac_shared),
                ff(f.pmin), ff(f.pmed), ff(f.pmax), ff(f.frac_rare),
                ff(f.f_and), ff(f.f_or), ff(f.f_atl), ff(f.f_xor),
                bdd.status, bdd.secs, fv(bdd.val),
                mocus.status, mocus.secs, fv(mocus.val),
                mc.status, mc.secs, fv(mc.val), fv(mc.lo), fv(mc.hi),
                fv(exact), best
            );
            {
                let mut fh = file.lock().unwrap();
                let _ = fh.write_all(row.as_bytes());
            }
            let d = done.fetch_add(1, Ordering::SeqCst) + 1;
            if d % 25 == 0 {
                eprintln!("labeled {}/{}", d, total);
            }
        }));
    }
    for h in handles {
        let _ = h.join();
    }
    eprintln!("phase 2 done. csv -> {}", out);
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() >= 5 && args[1] == "run-arm" {
        let (arm, path, root) = (args[2].clone(), args[3].clone(), args[4].clone());
        let h = thread::Builder::new()
            .stack_size(1024 * 1024 * 1024)
            .spawn(move || run_arm_main(&arm, &path, &root))
            .expect("spawn");
        h.join().expect("join");
        return;
    }
    let dirs = if args.len() > 1 {
        args[1..].to_vec()
    } else {
        vec!["fixtures/aralia".to_string(), "fixtures/synthetic".to_string()]
    };
    let h = thread::Builder::new()
        .stack_size(1024 * 1024 * 1024)
        .spawn(move || orchestrate(dirs))
        .expect("spawn");
    h.join().expect("join");
}
