use std::env;
use std::fs;
use std::thread;

use praxis::algorithms::build::{build_bdd, BuildOptions};
use praxis::io::parser::parse_fault_tree;

fn main() {
    let args: Vec<String> = env::args().collect();
    let path = args[1].clone();
    thread::Builder::new()
        .stack_size(2 << 30)
        .spawn(move || {
            let xml = fs::read_to_string(&path).expect("read xml");
            let ft = parse_fault_tree(&xml).expect("parse");
            let built = build_bdd(&ft, BuildOptions::default()).expect("build_bdd");
            let p = built.bdd.probability(built.root);
            println!(
                "BDD_EXACT prob={:.12e}  nodes={}",
                p,
                built.bdd.node_count()
            );
        })
        .expect("spawn")
        .join()
        .expect("join");
}
