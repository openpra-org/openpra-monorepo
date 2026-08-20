use std::env;
use std::fs;

use praxis::analysis::quantify::{quantify, quantify_bytes, Engine, Settings};
use praxis::io::parser::parse_fault_tree;
use praxis::io::pbf;

fn main() {
    let args: Vec<String> = env::args().collect();
    let file = &args[1];
    let text = fs::read_to_string(file).expect("read");
    let ft = parse_fault_tree(&text).expect("parse");

    let settings = Settings {
        engine: Engine::Bdd,
        ..Default::default()
    };

    let p_direct = quantify(&ft, &settings)
        .expect("direct quantify")
        .probability
        .expect("probability")
        .value;

    let model = pbf::encode_fault_tree(&ft).expect("encode model");
    let result_bytes = quantify_bytes(&model, &settings).expect("quantify_bytes");
    let p_pbf = pbf::decode_result(&result_bytes)
        .expect("decode result")
        .probability
        .expect("probability")
        .value;

    let tag = if p_direct.to_bits() == p_pbf.to_bits() {
        "MATCH"
    } else {
        "DIFF"
    };
    println!(
        "xml={}\tmodel_pbf={}\tp_direct={:.17e}\tp_pbf={:.17e}\t{}",
        text.len(),
        model.len(),
        p_direct,
        p_pbf,
        tag
    );
}
