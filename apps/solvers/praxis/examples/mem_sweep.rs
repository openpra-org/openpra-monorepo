use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use praxis::algorithms::bdd_engine::{Bdd, PersistedBdd};
use praxis::algorithms::modules::decompose;
use praxis::algorithms::pdag::{Pdag, PdagNode};
use praxis::analysis::width::{compute_dfs_metadata_pdag, maximal_modules};
use praxis::core::fault_tree::FaultTree;
use praxis::io::parser::parse_fault_tree;
use praxis::mc::memory::HostMemoryTracker;

const DEFAULT_DIR: &str = "tests/fixtures/benchmarks/Aralia";
const DEFAULT_NODE_BUDGET: usize = 20_000_000;
const DEFAULT_TIME_BUDGET_S: u64 = 60;
const OUT_CSV: &str = "C:/tmp/praxis_bdd_mem_sweep.csv";
const HEADER: &str = "file,events,gates,maximal_modules,largest_module_support,core_after_factor,status,bdd_nodes,live_nodes,dead_pct,compute_cache,build_s,peak_rss_mib,probability";

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

fn count_basic_events(pdag: &Pdag) -> usize {
    pdag.nodes()
        .values()
        .filter(|n| matches!(n, PdagNode::BasicEvent { .. }))
        .count()
}

fn count_gates(pdag: &Pdag) -> usize {
    pdag.nodes()
        .values()
        .filter(|n| matches!(n, PdagNode::Gate { .. }))
        .count()
}

struct ModuleStats {
    events: usize,
    gates: usize,
    maximals: usize,
    largest_module_support: usize,
    core_after_factor: usize,
}

fn module_stats(pdag: &Pdag) -> ModuleStats {
    let events = count_basic_events(pdag);
    let gates = count_gates(pdag);
    let root = pdag.root().map(|r| r.abs());
    let mut maximals = 0usize;
    let mut largest = 0usize;
    let mut in_mods = 0usize;
    if let Ok(meta) = compute_dfs_metadata_pdag(pdag) {
        if let Ok(d) = decompose(pdag) {
            for m in maximal_modules(&meta) {
                if Some(m.abs()) == root {
                    continue;
                }
                let s = d.support_size(m);
                largest = largest.max(s);
                in_mods += s;
                maximals += 1;
            }
        }
    }
    let core_after_factor = events.saturating_sub(in_mods) + maximals;
    ModuleStats {
        events,
        gates,
        maximals,
        largest_module_support: largest,
        core_after_factor,
    }
}

struct BuildRes {
    status: String,
    nodes: usize,
    live: Option<usize>,
    compute_cache: Option<usize>,
    prob: Option<f64>,
    build_s: f64,
    peak_rss_mib: f64,
}

fn build_one(
    pdag: &Pdag,
    ft: &FaultTree,
    node_budget: usize,
    time_budget: Duration,
    compute_cap: usize,
    gc_interval: usize,
) -> BuildRes {
    let meta = match compute_dfs_metadata_pdag(pdag) {
        Ok(m) => m,
        Err(_) => {
            return BuildRes {
                status: "meta_fail".to_string(),
                nodes: 0,
                live: None,
                compute_cache: None,
                prob: None,
                build_s: 0.0,
                peak_rss_mib: 0.0,
            }
        }
    };
    let var_probs = match pdag.level_var_probs(ft, &meta.var_of) {
        Ok(v) => v,
        Err(_) => {
            return BuildRes {
                status: "varprob_fail".to_string(),
                nodes: 0,
                live: None,
                compute_cache: None,
                prob: None,
                build_s: 0.0,
                peak_rss_mib: 0.0,
            }
        }
    };

    let counter = Arc::new(AtomicU64::new(0));
    let abort = Arc::new(AtomicBool::new(false));

    let pdag_c = pdag.clone();
    let var_of = meta.var_of.clone();
    let counter_w = counter.clone();
    let abort_w = abort.clone();

    let worker = thread::Builder::new()
        .stack_size(1024 * 1024 * 1024)
        .spawn(move || {
            let mut bdd = Bdd::new();
            bdd.set_var_probs(var_probs);
            if node_budget != 0 {
                bdd.set_node_budget(node_budget);
            }
            if compute_cap != 0 {
                bdd.set_compute_cap(compute_cap);
            }
            bdd.attach_live_count(counter_w);
            bdd.attach_abort(abort_w);
            let root = if gc_interval != 0 {
                bdd.build_root_gc(&pdag_c, &var_of, gc_interval)
                    .expect("build_root_gc")
            } else {
                bdd.build_root(&pdag_c, &var_of).expect("build_root")
            };
            let nodes = bdd.node_count();
            let unique = bdd.unique_len();
            let compute = bdd.compute_len();
            let reachable = bdd.reachable_count(root);
            let p = bdd.probability(root);
            (nodes, unique, compute, reachable, p)
        })
        .expect("spawn worker");

    let mut tracker = HostMemoryTracker::new_current_process();
    let start = Instant::now();
    let mut last_print = Instant::now();
    while !worker.is_finished() {
        tracker.sample();
        let elapsed = start.elapsed();
        if time_budget.as_secs() != 0 && elapsed > time_budget {
            abort.store(true, Ordering::Relaxed);
        }
        let n = counter.load(Ordering::Relaxed);
        if n > 1_000_000 && last_print.elapsed() >= Duration::from_secs(1) {
            let rss = tracker.peak_rss_mib().unwrap_or(0.0);
            eprintln!(
                "    [t={:.1}s] nodes={} peak_rss={:.0}MiB",
                elapsed.as_secs_f64(),
                n,
                rss
            );
            last_print = Instant::now();
        }
        thread::sleep(Duration::from_millis(200));
    }
    tracker.sample();
    let build_s = start.elapsed().as_secs_f64();
    let peak = tracker.peak_rss_mib().unwrap_or(0.0);

    match worker.join() {
        Ok((nodes, unique, compute, reachable, p)) => {
            let dead = nodes.saturating_sub(reachable);
            let dead_pct = if nodes > 0 {
                100.0 * dead as f64 / nodes as f64
            } else {
                0.0
            };
            eprintln!(
                "    done: nodes={} live={} dead={:.1}% unique={} compute_cache={} prob={:.6e}",
                nodes, reachable, dead_pct, unique, compute, p
            );
            BuildRes {
                status: "ok".to_string(),
                nodes,
                live: Some(reachable),
                compute_cache: Some(compute),
                prob: Some(p),
                build_s,
                peak_rss_mib: peak,
            }
        }
        Err(_) => {
            let n = counter.load(Ordering::Relaxed) as usize;
            let status = if abort.load(Ordering::Relaxed) {
                "timeout"
            } else {
                "node_budget"
            };
            BuildRes {
                status: status.to_string(),
                nodes: n,
                live: None,
                compute_cache: None,
                prob: None,
                build_s,
                peak_rss_mib: peak,
            }
        }
    }
}

fn run_one(file: &str, node_budget: usize, time_budget_s: u64, compute_cap: usize, gc_interval: usize) {
    let path = Path::new(file);
    let fname = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| file.to_string());
    let text = match read_text(path) {
        Some(t) => t,
        None => {
            println!("{},,,,,,read_fail,,,,", fname);
            return;
        }
    };
    let ft = match parse_fault_tree(&text) {
        Ok(f) => f,
        Err(_) => {
            println!("{},,,,,,parse_fail,,,,", fname);
            return;
        }
    };
    let pdag = match Pdag::from_fault_tree(&ft) {
        Ok(p) => p,
        Err(_) => {
            println!("{},,,,,,pdag_fail,,,,", fname);
            return;
        }
    };
    let ms = module_stats(&pdag);
    let res = build_one(
        &pdag,
        &ft,
        node_budget,
        Duration::from_secs(time_budget_s),
        compute_cap,
        gc_interval,
    );
    let prob_s = res
        .prob
        .map(|p| format!("{:.6e}", p))
        .unwrap_or_default();
    let live_s = res.live.map(|v| v.to_string()).unwrap_or_default();
    let dead_s = match res.live {
        Some(live) if res.nodes > 0 => {
            format!("{:.1}", 100.0 * (res.nodes.saturating_sub(live)) as f64 / res.nodes as f64)
        }
        _ => String::new(),
    };
    let compute_s = res
        .compute_cache
        .map(|v| v.to_string())
        .unwrap_or_default();
    println!(
        "{},{},{},{},{},{},{},{},{},{},{},{:.2},{:.0},{}",
        fname,
        ms.events,
        ms.gates,
        ms.maximals,
        ms.largest_module_support,
        ms.core_after_factor,
        res.status,
        res.nodes,
        live_s,
        dead_s,
        compute_s,
        res.build_s,
        res.peak_rss_mib,
        prob_s
    );
}

fn run_persist(file: &str, outpath: &str, gc_interval: usize) {
    let path = Path::new(file);
    let fname = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| file.to_string());
    let text = read_text(path).expect("read");
    let ft = parse_fault_tree(&text).expect("parse");
    let pdag = Pdag::from_fault_tree(&ft).expect("pdag");
    let meta = compute_dfs_metadata_pdag(&pdag).expect("meta");
    let var_probs = pdag.level_var_probs(&ft, &meta.var_of).expect("varprobs");
    let var_of = meta.var_of.clone();
    let out = outpath.to_string();

    let handle = thread::Builder::new()
        .stack_size(1024 * 1024 * 1024)
        .spawn(move || {
            let mut bdd = Bdd::new();
            bdd.set_var_probs(var_probs);
            let root = if gc_interval != 0 {
                bdd.build_root_gc(&pdag, &var_of, gc_interval)
                    .expect("build_root_gc")
            } else {
                bdd.build_root(&pdag, &var_of).expect("build_root")
            };
            let in_mem_prob = bdd.probability(root);
            let live = bdd.reachable_count(root);
            let persisted = bdd.persist(root);
            persisted.save(&out).expect("save");
            (live, in_mem_prob, persisted.node_count())
        })
        .expect("spawn");
    let (live, in_mem_prob, pnodes) = handle.join().expect("join");

    let bytes = fs::metadata(outpath).map(|m| m.len()).unwrap_or(0);
    let reloaded = PersistedBdd::load(outpath).expect("load");
    let disk_prob = reloaded.probability();
    let exact = in_mem_prob.to_bits() == disk_prob.to_bits();
    println!(
        "persist: file={} live={} persisted_nodes={} on_disk_bytes={} bytes_per_node={:.1} in_mem_prob={:.10e} disk_prob={:.10e} match={}",
        fname,
        live,
        pnodes,
        bytes,
        bytes as f64 / pnodes.max(1) as f64,
        in_mem_prob,
        disk_prob,
        if exact { "BIT-EXACT" } else { "DIFF" }
    );
}

fn run_orchestrator(
    dir: &str,
    node_budget: usize,
    time_budget_s: u64,
    compute_cap: usize,
    gc_interval: usize,
) {
    let mut files: Vec<PathBuf> = Vec::new();
    find_xml(Path::new(dir), &mut files);
    if files.is_empty() {
        eprintln!("no .xml files under {}", dir);
        return;
    }
    let exe = env::current_exe().expect("current exe");
    eprintln!(
        "sweep: {} files, node_budget={}, time_budget={}s, compute_cap={}, gc_interval={}, dir={}",
        files.len(),
        node_budget,
        time_budget_s,
        compute_cap,
        gc_interval,
        dir
    );
    println!("{}", HEADER);
    let mut rows: Vec<String> = Vec::new();
    for f in &files {
        let fname = f.file_name().unwrap().to_string_lossy().to_string();
        eprintln!("--- {}", fname);
        let out = Command::new(&exe)
            .arg("--one")
            .arg(f)
            .arg(node_budget.to_string())
            .arg(time_budget_s.to_string())
            .arg(compute_cap.to_string())
            .arg(gc_interval.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .output();
        let line = match out {
            Ok(o) if o.status.success() => {
                String::from_utf8_lossy(&o.stdout).trim().to_string()
            }
            Ok(o) => format!(
                "{},,,,,,DNF_oom_or_crash(exit={:?}),,,,",
                fname,
                o.status.code()
            ),
            Err(e) => format!("{},,,,,,DNF_spawn_err({}),,,,", fname, e),
        };
        println!("{}", line);
        rows.push(line);
    }

    let mut csv = String::new();
    csv.push_str(HEADER);
    csv.push('\n');
    for r in &rows {
        csv.push_str(r);
        csv.push('\n');
    }
    if let Err(e) = fs::write(OUT_CSV, &csv) {
        eprintln!("failed to write {}: {}", OUT_CSV, e);
    } else {
        eprintln!("csv -> {}", OUT_CSV);
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.first().map(|s| s == "--persist").unwrap_or(false) {
        let file = args.get(1).cloned().expect("--persist needs a file");
        let out = args.get(2).cloned().expect("--persist needs an output path");
        let gc_interval = args.get(3).and_then(|s| s.parse::<usize>().ok()).unwrap_or(500000);
        run_persist(&file, &out, gc_interval);
        return;
    }

    if args.first().map(|s| s == "--one").unwrap_or(false) {
        let file = args.get(1).cloned().expect("--one needs a file");
        let node_budget = args
            .get(2)
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(DEFAULT_NODE_BUDGET);
        let time_budget_s = args
            .get(3)
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_TIME_BUDGET_S);
        let compute_cap = args.get(4).and_then(|s| s.parse::<usize>().ok()).unwrap_or(0);
        let gc_interval = args.get(5).and_then(|s| s.parse::<usize>().ok()).unwrap_or(0);
        run_one(&file, node_budget, time_budget_s, compute_cap, gc_interval);
        return;
    }

    let dir = args.first().cloned().unwrap_or_else(|| DEFAULT_DIR.to_string());
    let node_budget = args
        .get(1)
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(DEFAULT_NODE_BUDGET);
    let time_budget_s = args
        .get(2)
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(DEFAULT_TIME_BUDGET_S);
    let compute_cap = args.get(3).and_then(|s| s.parse::<usize>().ok()).unwrap_or(0);
    let gc_interval = args.get(4).and_then(|s| s.parse::<usize>().ok()).unwrap_or(0);
    run_orchestrator(&dir, node_budget, time_budget_s, compute_cap, gc_interval);
}
