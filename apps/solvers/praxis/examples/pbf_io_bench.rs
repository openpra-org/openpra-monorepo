use std::env;
use std::fs;
use std::hint::black_box;
use std::time::Instant;

use praxis::io::parser::parse_fault_tree;
use praxis::io::pbf;

fn bench<T>(iters: usize, mut f: impl FnMut() -> T) -> f64 {
    let start = Instant::now();
    for _ in 0..iters {
        black_box(f());
    }
    start.elapsed().as_nanos() as f64 / iters as f64 / 1000.0
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let file = &args[1];
    let xml = fs::read_to_string(file).expect("read");
    let ft = parse_fault_tree(&xml).expect("parse");
    let pbf_bytes = pbf::encode_fault_tree(&ft).expect("encode");

    let probe = Instant::now();
    let _ = parse_fault_tree(black_box(&xml)).expect("parse");
    let one_ns = probe.elapsed().as_nanos().max(1);
    let iters = ((100_000_000u128 / one_ns).max(50).min(20_000)) as usize;

    for _ in 0..10 {
        black_box(parse_fault_tree(black_box(&xml)).expect("parse"));
        black_box(pbf::decode_fault_tree(black_box(&pbf_bytes)).expect("decode"));
        black_box(pbf::encode_fault_tree(black_box(&ft)).expect("encode"));
    }

    let parse_us = bench(iters, || parse_fault_tree(black_box(&xml)).expect("parse"));
    let decode_us = bench(iters, || {
        pbf::decode_fault_tree(black_box(&pbf_bytes)).expect("decode")
    });
    let encode_us = bench(iters, || {
        pbf::encode_fault_tree(black_box(&ft)).expect("encode")
    });

    println!(
        "{}\t{}\t{:.2}\t{:.2}\t{:.2}",
        xml.len(),
        pbf_bytes.len(),
        parse_us,
        decode_us,
        encode_us
    );
}
