use std::env;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering as AtOrd};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use praxis::algorithms::direct_zbdd::build_zbdd_delterm;
use praxis::algorithms::pdag::Pdag;
use praxis::io::pbf::decode_fault_tree;
use praxis::mc::memory::HostMemoryTracker;

fn main() {
    let args: Vec<String> = env::args().collect();
    let path = args
        .get(1)
        .expect("usage: order_bench <model.pbf> <cutoff>")
        .clone();
    let cutoff: f64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(1e-7);
    let order_name = env::var("PRAXIS_ORDER").unwrap_or_else(|_| "default".into());

    let bytes = fs::read(&path).expect("read pbf");
    let ft = decode_fault_tree(&bytes).expect("decode");
    let pdag = Pdag::from_fault_tree(&ft).expect("pdag");

    let done = Arc::new(AtomicBool::new(false));
    let done_w = done.clone();
    let worker = thread::Builder::new()
        .stack_size(2 << 30)
        .spawn(move || {
            let t = Instant::now();
            let (eng, root) =
                build_zbdd_delterm(&pdag, &ft, Some(cutoff), None, None).expect("build");
            let dt = t.elapsed().as_secs_f64();
            let nodes = eng.node_count();
            let live = eng.reachable_count(root);
            let unique = eng.unique_len();
            let caches = eng.op_cache_len();
            let rea = eng.rare_event_probability(root);
            done_w.store(true, AtOrd::Relaxed);
            (nodes, live, unique, caches, dt, rea)
        })
        .expect("spawn");

    let mut tracker = HostMemoryTracker::new_current_process();
    while !done.load(AtOrd::Relaxed) {
        tracker.sample();
        thread::sleep(Duration::from_millis(100));
    }
    tracker.sample();
    let (nodes, live, unique, caches, dt, rea) = worker.join().expect("join");
    let peak = tracker.peak_rss_mib().unwrap_or(0.0);
    let dead_pct = if nodes > 0 {
        100.0 * (nodes.saturating_sub(live)) as f64 / nodes as f64
    } else {
        0.0
    };
    println!(
        "order={:<10} cutoff={:.0e} total={:>12} live={:>10} dead={:>5.1}% unique={:>12} opcache={:>12} time={:>7.1}s peak_rss={:>8.0}MiB rea={:.6e}",
        order_name, cutoff, nodes, live, dead_pct, unique, caches, dt, peak, rea
    );
}
