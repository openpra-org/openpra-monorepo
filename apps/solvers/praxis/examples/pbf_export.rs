use std::env;
use std::fs;

use praxis::io::parser::parse_fault_tree;
use praxis::io::pbf;

fn main() {
    let args: Vec<String> = env::args().collect();
    let xml = fs::read_to_string(&args[1]).expect("read xml");
    let ft = parse_fault_tree(&xml).expect("parse");
    let bytes = pbf::encode_fault_tree(&ft).expect("encode");
    fs::write(&args[2], &bytes).expect("write pbf");
    eprintln!("{} -> {} ({} bytes)", args[1], args[2], bytes.len());
}
