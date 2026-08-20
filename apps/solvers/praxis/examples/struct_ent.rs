use std::collections::HashMap;
use std::env;
use std::fs;

use praxis::core::gate::Formula;
use praxis::io::parser::parse_fault_tree;

fn main() {
    let args: Vec<String> = env::args().collect();
    let model = &args[1];

    let ft = if model.ends_with(".pbf") {
        let bytes = fs::read(model).expect("read pbf");
        praxis::io::pbf::decode_fault_tree(&bytes).expect("decode pbf")
    } else {
        let xml = fs::read_to_string(model).expect("read xml");
        parse_fault_tree(&xml).expect("parse")
    };

    let top = ft.top_event().to_string();

    let mut indeg: HashMap<String, usize> = HashMap::new();
    let mut conn: HashMap<&str, usize> = HashMap::new();
    let mut operand_counts: Vec<usize> = Vec::new();
    for gate in ft.gates().values() {
        let key = match gate.formula() {
            Formula::And => "AND",
            Formula::Or => "OR",
            Formula::Not => "NOT",
            Formula::AtLeast { .. } => "ATLEAST",
            Formula::Xor => "XOR",
            Formula::Nand => "NAND",
            Formula::Nor => "NOR",
            Formula::Iff => "IFF",
        };
        *conn.entry(key).or_insert(0) += 1;
        operand_counts.push(gate.operands().len());
        for op in gate.operands() {
            *indeg.entry(op.clone()).or_insert(0) += 1;
        }
    }

    let gates = ft.gates().len();
    let basics = ft.basic_events().len();

    let shared_gates = ft
        .gates()
        .keys()
        .filter(|id| indeg.get(*id).copied().unwrap_or(0) > 1)
        .count();
    let shared_basics = ft
        .basic_events()
        .keys()
        .filter(|id| indeg.get(*id).copied().unwrap_or(0) > 1)
        .count();
    let max_share = indeg.iter().max_by_key(|(_, &c)| c);

    let mut buckets = [0usize; 5];
    for &n in &operand_counts {
        let b = match n {
            0 | 1 => 0,
            2 => 1,
            3..=5 => 2,
            6..=20 => 3,
            _ => 4,
        };
        buckets[b] += 1;
    }

    let mut depth_memo: HashMap<String, usize> = HashMap::new();
    let d = depth(&ft, &top, &mut depth_memo, &mut Vec::new());

    println!("top_event       = {}", top);
    println!("gates           = {}", gates);
    println!("basic_events    = {}", basics);
    println!("connectives     = {:?}", conn);
    println!(
        "fanout buckets  = [1:{}  2:{}  3-5:{}  6-20:{}  21+:{}]",
        buckets[0], buckets[1], buckets[2], buckets[3], buckets[4]
    );
    println!(
        "shared gates    = {} / {} ({:.1}%)",
        shared_gates,
        gates,
        100.0 * shared_gates as f64 / gates as f64
    );
    println!(
        "shared basics   = {} / {} ({:.1}%)",
        shared_basics,
        basics,
        100.0 * shared_basics as f64 / basics as f64
    );
    if let Some((id, c)) = max_share {
        println!("most-shared node= {} referenced by {} parents", id, c);
    }
    println!("max depth       = {}", d);
}

fn depth(
    ft: &praxis::core::fault_tree::FaultTree,
    id: &str,
    memo: &mut HashMap<String, usize>,
    stack: &mut Vec<String>,
) -> usize {
    if let Some(&d) = memo.get(id) {
        return d;
    }
    if stack.contains(&id.to_string()) {
        return 0;
    }
    let d = if let Some(gate) = ft.gates().get(id) {
        stack.push(id.to_string());
        let mut best = 0;
        for op in gate.operands() {
            best = best.max(depth(ft, op, memo, stack));
        }
        stack.pop();
        best + 1
    } else {
        0
    };
    memo.insert(id.to_string(), d);
    d
}
