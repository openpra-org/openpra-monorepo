use std::env;
use std::fs;
use std::thread;
use std::time::Instant;

use praxis::algorithms::direct_zbdd::{
    build_zbdd_delterm, build_zbdd_from_pdag, build_zbdd_topdown,
};
use praxis::algorithms::pdag::Pdag;
use praxis::analysis::quantify::{quantify, Approximation, Engine, Settings};
use praxis::core::fault_tree::FaultTree;
use praxis::io::parser::parse_fault_tree;

fn main() {
    praxis::init_tracing(0);
    let args: Vec<String> = env::args().collect();
    let cutoff: f64 = args
        .iter()
        .skip(2)
        .find_map(|s| s.parse::<f64>().ok())
        .unwrap_or(1e-12);
    let compare = args.iter().skip(2).any(|s| s == "compare");
    let topdown = args.iter().skip(2).any(|s| s == "td");
    let delterm = args.iter().skip(2).any(|s| s == "delterm");
    let engine = args.iter().skip(2).any(|s| s == "q");
    let mutex = args
        .iter()
        .skip(2)
        .find_map(|s| s.strip_prefix("mutex=").map(|n| n.to_string()));

    let ft = if args[1].ends_with(".pbf") {
        let bytes = fs::read(&args[1]).expect("read pbf");
        praxis::io::pbf::decode_fault_tree(&bytes).expect("decode pbf")
    } else {
        let xml = fs::read_to_string(&args[1]).expect("read xml");
        parse_fault_tree(&xml).expect("parse")
    };

    run(ft, cutoff, compare, topdown, delterm, engine, mutex);
}

fn run(
    ft: FaultTree,
    cutoff: f64,
    compare: bool,
    topdown: bool,
    delterm: bool,
    engine: bool,
    mutex: Option<String>,
) {
    let child = thread::Builder::new()
        .stack_size(2 * 1024 * 1024 * 1024)
        .spawn(move || {
            if engine {
                let settings = Settings {
                    engine: Engine::ZbddDelterm,
                    cut_off: Some(cutoff),
                    approximation: Some(Approximation::RareEvent),
                    ..Default::default()
                };
                let t = Instant::now();
                let q = quantify(&ft, &settings).expect("quantify delterm");
                let dt = t.elapsed().as_secs_f64();
                let rare = q.probability.expect("prob").value;
                let count = q.cut_sets.expect("cut sets").products;
                println!(
                    "q-delterm rare={:.6e}  cut_sets={}  time={:.2}s",
                    rare, count, dt
                );
                return;
            }

            let pdag = Pdag::from_fault_tree(&ft).expect("pdag");
            let t = Instant::now();
            let (dz, droot) = if delterm {
                build_zbdd_delterm(&pdag, &ft, Some(cutoff), None, mutex.as_deref())
                    .expect("delterm zbdd")
            } else if topdown {
                build_zbdd_topdown(&pdag, &ft, Some(cutoff), None, mutex.as_deref())
                    .expect("topdown zbdd")
            } else {
                build_zbdd_from_pdag(&pdag, &ft, Some(cutoff), None).expect("direct zbdd")
            };
            let d_rare = dz.rare_event_probability(droot);
            let d_mcub = dz.min_cut_upper_bound(droot);
            let d_count: u64 = dz.count_by_order(droot).values().sum();
            let dt = t.elapsed().as_secs_f64();
            let label = if delterm {
                "delterm"
            } else if topdown {
                "topdown"
            } else {
                "direct"
            };
            println!(
                "{:8} rare={:.6e}  mcub={:.6e}  cut_sets={}  nodes={}  time={:.2}s",
                label,
                d_rare,
                d_mcub,
                d_count,
                dz.node_count(),
                dt
            );

            if compare {
                let settings = Settings {
                    engine: Engine::Zbdd,
                    cut_off: Some(cutoff),
                    approximation: Some(Approximation::RareEvent),
                    ..Default::default()
                };
                let cur = quantify(&ft, &settings).expect("current zbdd");
                let cur_rare = cur.probability.expect("prob").value;
                let cur_count = cur.cut_sets.expect("cut sets").products as u64;
                let denom = cur_rare.abs().max(1e-300);

                let d_rare_cmp = d_rare.min(1.0);
                let rare_ok = (d_rare_cmp - cur_rare).abs() / denom < 1e-9;
                let count_ok = d_count == cur_count;
                println!("current  rare={:.6e}  cut_sets={}", cur_rare, cur_count);
                println!(
                    "MATCH    rare={}  count={}  ({})",
                    rare_ok,
                    count_ok,
                    if rare_ok && count_ok {
                        "OK"
                    } else {
                        "MISMATCH"
                    }
                );
            }
        })
        .expect("spawn");
    child.join().expect("join");
}
