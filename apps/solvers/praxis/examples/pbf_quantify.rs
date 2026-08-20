use std::env;
use std::fs;
use std::time::{Duration, Instant};

use praxis::algorithms::build::{build_bdd, BuildOptions};
use praxis::algorithms::reorder::ReorderMethod;
use praxis::io::pbf;

fn main() {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let args: Vec<String> = env::args().collect();
    let model = fs::read(&args[1]).expect("read pbf model");
    eprintln!("model: {} bytes", model.len());
    let ft = pbf::decode_fault_tree(&model).expect("decode model");

    let reorder = match args.get(2).map(|s| s.as_str()) {
        Some("sift") => Some(ReorderMethod::Sift),
        Some("gsift") => Some(ReorderMethod::Gsift),
        Some("ils") => Some(ReorderMethod::Ils),
        _ => None,
    };
    let budget = args.get(3).and_then(|s| s.parse::<u64>().ok()).unwrap_or(120);
    let opts = BuildOptions {
        reorder,
        reorder_budget: Duration::from_secs(budget),
        ..BuildOptions::default()
    };

    let started = Instant::now();
    let built = build_bdd(&ft, opts).expect("build_bdd");
    let probability = built.bdd.probability(built.root);
    println!(
        "PRAXIS exact BDD probability = {:.12e}   reorder={:?}   bdd_nodes={}   total={:.2}s",
        probability,
        reorder,
        built.bdd.node_count(),
        started.elapsed().as_secs_f64()
    );
}
