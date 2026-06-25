use std::env;
use std::fs;

use praxis::analysis::visualize::generate_dot_from_fault_tree;
use praxis::io::parser::parse_fault_tree;

fn main() {
    let args: Vec<String> = env::args().collect();
    let model = &args[1];
    let out = &args[2];

    let ft = if model.ends_with(".pbf") {
        let bytes = fs::read(model).expect("read pbf");
        praxis::io::pbf::decode_fault_tree(&bytes).expect("decode pbf")
    } else {
        let xml = fs::read_to_string(model).expect("read xml");
        parse_fault_tree(&xml).expect("parse")
    };

    let gates = ft.gates().len();
    let basics = ft.basic_events().len();
    let houses = ft.house_events().len();
    let edges: usize = ft.gates().values().map(|g| g.operands().len()).sum();

    let dot = generate_dot_from_fault_tree(&ft);
    fs::write(out, &dot).expect("write dot");

    println!(
        "gates={}  basic_events={}  house_events={}  edges={}  dot_bytes={}",
        gates,
        basics,
        houses,
        edges,
        dot.len()
    );
}
