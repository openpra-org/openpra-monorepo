use std::collections::{HashSet, VecDeque};
use std::env;
use std::fs;

use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::Formula;
use praxis::io::parser::parse_fault_tree;

fn main() {
    let args: Vec<String> = env::args().collect();
    let model = &args[1];
    let out = &args[2];
    let max_depth: usize = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(3);
    let max_nodes: usize = args.get(4).and_then(|s| s.parse().ok()).unwrap_or(400);

    let ft = if model.ends_with(".pbf") {
        let bytes = fs::read(model).expect("read pbf");
        praxis::io::pbf::decode_fault_tree(&bytes).expect("decode pbf")
    } else {
        let xml = fs::read_to_string(model).expect("read xml");
        parse_fault_tree(&xml).expect("parse")
    };

    let top = ft.top_event().to_string();

    let mut expand: HashSet<String> = HashSet::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut q: VecDeque<(String, usize)> = VecDeque::new();
    q.push_back((top.clone(), 0));
    seen.insert(top.clone());
    while let Some((id, d)) = q.pop_front() {
        if expand.len() >= max_nodes {
            break;
        }
        let Some(gate) = ft.gates().get(&id) else {
            continue;
        };
        if d >= max_depth {
            continue;
        }
        expand.insert(id.clone());
        for op in gate.operands() {
            if seen.insert(op.clone()) {
                q.push_back((op.clone(), d + 1));
            }
        }
    }

    let mut dot = String::new();
    dot.push_str("digraph ENT_top {\n");
    dot.push_str("  rankdir=TB;\n  splines=polyline;\n  nodesep=0.4;\n  ranksep=0.8;\n");
    dot.push_str("  node [fontname=\"Helvetica\", fontsize=10];\n");

    for id in &expand {
        let gate = ft.gates().get(id).unwrap();
        let shape = gate_shape(gate.formula());
        dot.push_str(&format!("  \"{}\" [{}];\n", id, shape));
        for op in gate.operands() {
            dot.push_str(&format!("  \"{}\" -> \"{}\";\n", id, op));
        }
    }

    let mut drawn: HashSet<String> = expand.clone();
    for id in &expand {
        let gate = ft.gates().get(id).unwrap();
        for op in gate.operands() {
            if drawn.contains(op) {
                continue;
            }
            drawn.insert(op.clone());
            if let Some(g) = ft.gates().get(op) {
                let sub = subtree_size(&ft, op);
                dot.push_str(&format!(
                    "  \"{}\" [shape=box3d, style=filled, fillcolor=lightgrey, label=\"{}\\n[{} subtree gates]\"];\n",
                    op, gate_kind(g.formula()), sub
                ));
            } else if ft.basic_events().contains_key(op) {
                dot.push_str(&format!("  \"{}\" [shape=circle, label=\"{}\"];\n", op, op));
            } else {
                dot.push_str(&format!(
                    "  \"{}\" [shape=ellipse, style=dashed, color=orange, label=\"{}\"];\n",
                    op, op
                ));
            }
        }
    }

    dot.push_str("}\n");
    fs::write(out, &dot).expect("write dot");
    println!(
        "top={}  expanded_gates={}  total_nodes_drawn={}  depth<={}",
        top,
        expand.len(),
        drawn.len(),
        max_depth
    );
}

fn gate_kind(f: &Formula) -> &'static str {
    match f {
        Formula::And => "AND",
        Formula::Or => "OR",
        Formula::Not => "NOT",
        Formula::AtLeast { .. } => "ATLEAST",
        Formula::Xor => "XOR",
        Formula::Nand => "NAND",
        Formula::Nor => "NOR",
        Formula::Iff => "IFF",
    }
}

fn gate_shape(f: &Formula) -> String {
    match f {
        Formula::And => "shape=triangle, label=\"AND\"".to_string(),
        Formula::Or => "shape=invtriangle, label=\"OR\"".to_string(),
        Formula::Not => "shape=diamond, label=\"NOT\"".to_string(),
        Formula::AtLeast { min } => format!("shape=hexagon, label=\">={}\"", min),
        Formula::Xor => "shape=diamond, style=dashed, label=\"XOR\"".to_string(),
        Formula::Nand => "shape=triangle, style=dashed, label=\"NAND\"".to_string(),
        Formula::Nor => "shape=invtriangle, style=dashed, label=\"NOR\"".to_string(),
        Formula::Iff => "shape=diamond, style=dotted, label=\"IFF\"".to_string(),
    }
}

fn subtree_size(ft: &FaultTree, id: &str) -> usize {
    let mut seen = HashSet::new();
    let mut stack = vec![id.to_string()];
    let mut gates = 0;
    while let Some(n) = stack.pop() {
        if !seen.insert(n.clone()) {
            continue;
        }
        if let Some(g) = ft.gates().get(&n) {
            gates += 1;
            for op in g.operands() {
                stack.push(op.clone());
            }
        }
    }
    gates
}
