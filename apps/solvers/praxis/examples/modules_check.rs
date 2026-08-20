use std::collections::HashSet;
use std::env;
use std::fs;
use std::time::Instant;

use praxis::algorithms::modules::decompose;
use praxis::algorithms::pdag::{NodeIndex, Pdag, PdagNode};
use praxis::io::parser::parse_fault_tree;

fn subtree_events(pdag: &Pdag, g: NodeIndex, out: &mut HashSet<NodeIndex>) {
    match pdag.get_node(g.abs()) {
        Some(PdagNode::BasicEvent { index, .. }) => {
            out.insert(index.abs());
        }
        Some(PdagNode::Gate { operands, .. }) => {
            for op in operands.clone() {
                subtree_events(pdag, op, out);
            }
        }
        _ => {}
    }
}

fn events_avoiding(
    pdag: &Pdag,
    node: NodeIndex,
    avoid: NodeIndex,
    seen: &mut HashSet<NodeIndex>,
    out: &mut HashSet<NodeIndex>,
) {
    let node = node.abs();
    if node == avoid.abs() || !seen.insert(node) {
        return;
    }
    match pdag.get_node(node) {
        Some(PdagNode::BasicEvent { index, .. }) => {
            out.insert(index.abs());
        }
        Some(PdagNode::Gate { operands, .. }) => {
            for op in operands.clone() {
                events_avoiding(pdag, op, avoid, seen, out);
            }
        }
        _ => {}
    }
}

fn brute_force(pdag: &Pdag) -> HashSet<NodeIndex> {
    let root = pdag.root().unwrap();
    let mut result = HashSet::new();
    let gates: Vec<NodeIndex> = pdag
        .nodes()
        .values()
        .filter_map(|n| match n {
            PdagNode::Gate { index, .. } => Some(index.abs()),
            _ => None,
        })
        .collect();
    for g in gates {
        let mut dg = HashSet::new();
        subtree_events(pdag, g, &mut dg);
        let mut ug = HashSet::new();
        let mut seen = HashSet::new();
        events_avoiding(pdag, root, g, &mut seen, &mut ug);
        if dg.is_disjoint(&ug) {
            result.insert(g);
        }
    }
    result
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let validate = args.iter().any(|s| s == "validate");
    let ft = if args[1].ends_with(".pbf") {
        let bytes = fs::read(&args[1]).expect("read pbf");
        praxis::io::pbf::decode_fault_tree(&bytes).expect("decode")
    } else {
        parse_fault_tree(&fs::read_to_string(&args[1]).expect("read")).expect("parse")
    };
    let pdag = Pdag::from_fault_tree(&ft).expect("pdag");
    let gates = pdag
        .nodes()
        .values()
        .filter(|n| matches!(n, PdagNode::Gate { .. }))
        .count();

    let t = Instant::now();
    let d = decompose(&pdag).expect("decompose");
    let dt = t.elapsed().as_secs_f64();
    let mods = d.modules().len();
    println!(
        "gates={}  modules={} ({:.1}%)  decompose={:.3}s",
        gates,
        mods,
        100.0 * mods as f64 / gates.max(1) as f64,
        dt
    );

    if validate {
        let bf = brute_force(&pdag);
        let fast: HashSet<NodeIndex> = d.modules().iter().copied().collect();
        let ok = fast == bf;
        println!(
            "brute_force modules={}  MATCH={}",
            bf.len(),
            if ok { "OK" } else { "MISMATCH" }
        );
    }
}
