use std::env;
use std::fs;
use std::time::Instant;

use praxis::analysis::quantify::{quantify, Approximation, Engine, Settings};
use praxis::io::pbf;

fn main() {
    let args: Vec<String> = env::args().collect();
    let model = fs::read(&args[1]).expect("read pbf model");
    eprintln!("model: {} bytes", model.len());
    let ft = pbf::decode_fault_tree(&model).expect("decode model");

    let engine = match args[2].as_str() {
        "mocus" => Engine::Mocus,
        "mocuspi" => Engine::MocusPi,
        "mc" => Engine::MonteCarlo,
        "bdd" => Engine::Bdd,
        "zbdd" => Engine::Zbdd,
        other => panic!("unknown engine {other}"),
    };

    let mut order: Option<usize> = None;
    let mut cutoff: Option<f64> = None;
    let mut trials: usize = 10000;
    for a in &args[3..] {
        if let Some(v) = a.strip_prefix("order=") {
            order = Some(v.parse().expect("order"));
        } else if let Some(v) = a.strip_prefix("cutoff=") {
            cutoff = Some(v.parse().expect("cutoff"));
        } else if let Some(v) = a.strip_prefix("trials=") {
            trials = v.parse().expect("trials");
        }
    }

    let settings = Settings {
        engine,
        approximation: Some(Approximation::RareEvent),
        limit_order: order,
        cut_off: cutoff,
        num_trials: trials,
        ..Default::default()
    };

    let started = Instant::now();
    let result = quantify(&ft, &settings).expect("quantify");
    let secs = started.elapsed().as_secs_f64();

    if let Some(cs) = result.cut_sets {
        let per: Vec<f64> = cs.list.iter().map(|c| c.probability).collect();
        let rare: f64 = per.iter().sum();
        let mcub: f64 = 1.0 - per.iter().map(|p| 1.0 - p).product::<f64>();
        println!(
            "{:?} order={:?} cutoff={:?}: cut_sets={} rare={:.6e} mcub={:.6e} time={:.2}s",
            engine, order, cutoff, cs.products, rare, mcub, secs
        );
    } else if let Some(p) = result.probability {
        println!(
            "{:?} trials={}: probability={:.6e} ({:?}) time={:.2}s",
            engine, trials, p.value, p.approximation, secs
        );
    }
}
