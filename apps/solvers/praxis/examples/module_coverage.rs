use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::thread;

use praxis::algorithms::modules::decompose;
use praxis::algorithms::pdag::{NodeIndex, Pdag, PdagNode};
use praxis::io::parser::parse_fault_tree;

fn subtree_events(
    pdag: &Pdag,
    g: NodeIndex,
    memo: &mut HashMap<NodeIndex, HashSet<NodeIndex>>,
) -> HashSet<NodeIndex> {
    let key = g.abs();
    if let Some(s) = memo.get(&key) {
        return s.clone();
    }
    let mut out = HashSet::new();
    match pdag.get_node(key) {
        Some(PdagNode::BasicEvent { index, .. }) => {
            out.insert(index.abs());
        }
        Some(PdagNode::Gate { operands, .. }) => {
            for op in operands.clone() {
                let s = subtree_events(pdag, op, memo);
                out.extend(s);
            }
        }
        _ => {}
    }
    memo.insert(key, out.clone());
    out
}

fn run(path: String) {
    let ft = if path.ends_with(".pbf") {
        let bytes = fs::read(&path).expect("read pbf");
        praxis::io::pbf::decode_fault_tree(&bytes).expect("decode")
    } else {
        parse_fault_tree(&fs::read_to_string(&path).expect("read")).expect("parse")
    };
    let pdag = Pdag::from_fault_tree(&ft).expect("pdag");
    let total_events = pdag
        .nodes()
        .values()
        .filter(|n| matches!(n, PdagNode::BasicEvent { .. }))
        .count();
    let root = pdag.root().expect("root").abs();
    let d = decompose(&pdag).expect("decompose");

    let mut memo: HashMap<NodeIndex, HashSet<NodeIndex>> = HashMap::new();
    let mut mods: Vec<HashSet<NodeIndex>> = Vec::new();
    for &m in d.modules() {
        if m == root {
            continue;
        }
        let s = subtree_events(&pdag, m, &mut memo);
        if !s.is_empty() {
            mods.push(s);
        }
    }
    mods.sort_by(|a, b| b.len().cmp(&a.len()));

    let mut maximal: Vec<&HashSet<NodeIndex>> = Vec::new();
    for cur in &mods {
        if !maximal.iter().any(|big| cur.is_subset(big)) {
            maximal.push(cur);
        }
    }
    let mut covered: HashSet<NodeIndex> = HashSet::new();
    for m in &maximal {
        covered.extend(m.iter().copied());
    }
    let loose = total_events.saturating_sub(covered.len());
    let effective = loose + maximal.len();
    let pct = |x: usize| 100.0 * x as f64 / total_events.max(1) as f64;

    println!("model              = {}", path);
    println!("total basic events = {}", total_events);
    println!("non-root modules   = {}", mods.len());
    println!("maximal modules    = {}", maximal.len());
    println!(
        "events in maximal  = {} ({:.1}%)",
        covered.len(),
        pct(covered.len())
    );
    println!("loose events       = {} ({:.1}%)", loose, pct(loose));
    println!(
        "collapsed main vars= {} (loose {} + {} proxies) vs {} events => {:.1}% smaller main solve",
        effective,
        loose,
        maximal.len(),
        total_events,
        100.0 * (1.0 - effective as f64 / total_events.max(1) as f64)
    );
    println!("largest maximal module supports:");
    for m in maximal.iter().take(20) {
        println!("   {} events", m.len());
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let path = args
        .get(1)
        .expect("usage: module_coverage <model.pbf|.xml>")
        .clone();
    thread::Builder::new()
        .stack_size(2 << 30)
        .spawn(move || run(path))
        .expect("spawn")
        .join()
        .expect("join");
}
