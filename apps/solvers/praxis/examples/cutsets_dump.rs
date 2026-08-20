use std::env;
use std::fs;
use std::thread;

use praxis::algorithms::direct_zbdd::build_zbdd_delterm_named;
use praxis::algorithms::pdag::Pdag;
use praxis::io::parser::parse_fault_tree;

fn main() {
    let args: Vec<String> = env::args().collect();
    let cutoff: f64 = args
        .iter()
        .skip(2)
        .find_map(|s| s.parse::<f64>().ok())
        .unwrap_or(1e-12);
    let order: Option<usize> = args
        .iter()
        .skip(2)
        .find_map(|s| s.strip_prefix("order=").and_then(|n| n.parse().ok()));

    let ft = if args[1].ends_with(".pbf") {
        let bytes = fs::read(&args[1]).expect("read pbf");
        praxis::io::pbf::decode_fault_tree(&bytes).expect("decode")
    } else {
        parse_fault_tree(&fs::read_to_string(&args[1]).expect("read")).expect("parse")
    };

    let child = thread::Builder::new()
        .stack_size(2 * 1024 * 1024 * 1024)
        .spawn(move || {
            let pdag = Pdag::from_fault_tree(&ft).expect("pdag");
            let cuts =
                build_zbdd_delterm_named(&pdag, &ft, Some(cutoff), None, None).expect("delterm");
            let mut printed = 0;
            for cs in &cuts {
                if let Some(o) = order {
                    if cs.len() != o {
                        continue;
                    }
                }
                println!("{}", cs.join(" "));
                printed += 1;
            }
            eprintln!("total={} printed={}", cuts.len(), printed);
        })
        .expect("spawn");
    child.join().expect("join");
}
