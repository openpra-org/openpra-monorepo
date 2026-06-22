use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::Path;
use std::time::Instant;

use praxis::algorithms::bdd_engine::Bdd;
use praxis::algorithms::ordering::{dfs_order, force_order};
use praxis::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use praxis::algorithms::preprocessor::Preprocessor;
use praxis::io::parser::parse_fault_tree;

fn splitmix(s: &mut u64) -> u64 {
    *s = s.wrapping_add(0x9E3779B97F4A7C15);
    let mut z = *s;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

fn max_index(pdag: &Pdag) -> usize {
    pdag.nodes()
        .keys()
        .map(|&k| k.unsigned_abs() as usize)
        .max()
        .unwrap_or(0)
}

fn eval_fast(pdag: &Pdag, idx: NodeIndex, assign: &[bool], memo: &mut [i8]) -> bool {
    let a = idx.unsigned_abs() as usize;
    if memo[a] >= 0 {
        return memo[a] == 1;
    }
    let v = match pdag.get_node(idx) {
        Some(PdagNode::BasicEvent { .. }) => assign[a],
        Some(PdagNode::Constant { value, .. }) => *value,
        Some(PdagNode::Gate {
            connective,
            operands,
            min_number,
            ..
        }) => {
            let conn = *connective;
            let min = *min_number;
            let ops = operands.clone();
            let vals: Vec<bool> = ops
                .iter()
                .map(|&op| {
                    let ov = eval_fast(pdag, op, assign, memo);
                    if op < 0 {
                        !ov
                    } else {
                        ov
                    }
                })
                .collect();
            eval_connective(conn, &vals, min)
        }
        None => false,
    };
    memo[a] = v as i8;
    v
}

fn eval_connective(conn: Connective, vals: &[bool], min: Option<usize>) -> bool {
    let trues = vals.iter().filter(|&&x| x).count();
    match conn {
        Connective::And => vals.iter().all(|&x| x),
        Connective::Or => vals.iter().any(|&x| x),
        Connective::Not => !vals.first().copied().unwrap_or(false),
        Connective::Nand => !vals.iter().all(|&x| x),
        Connective::Nor => !vals.iter().any(|&x| x),
        Connective::Xor => trues % 2 == 1,
        Connective::Iff => trues == 0 || trues == vals.len(),
        Connective::AtLeast => trues >= min.unwrap_or(1),
        Connective::Null => vals.first().copied().unwrap_or(false),
    }
}

fn eval_root_fast(pdag: &Pdag, assign: &[bool], memo: &mut [i8]) -> bool {
    for m in memo.iter_mut() {
        *m = -1;
    }
    let root = match pdag.root() {
        Some(r) => r,
        None => return false,
    };
    let mut v = eval_fast(pdag, root, assign, memo);
    if root < 0 {
        v = !v;
    }
    if pdag.complement() {
        v = !v;
    }
    v
}

fn basic_events(pdag: &Pdag) -> Vec<NodeIndex> {
    let mut v: Vec<NodeIndex> = pdag
        .nodes()
        .values()
        .filter_map(|n| match n {
            PdagNode::BasicEvent { index, .. } => Some(*index),
            _ => None,
        })
        .collect();
    v.sort();
    v
}

fn functions_equal(a: &Pdag, b: &Pdag) -> (bool, bool) {
    let bes = basic_events(a);
    let n = bes.len();
    let sz = max_index(a).max(max_index(b)) + 1;
    let mut assign = vec![false; sz];
    let mut memo = vec![-1i8; sz];
    if n <= 20 {
        for mask in 0u32..(1u32 << n) {
            for (i, &b_idx) in bes.iter().enumerate() {
                assign[b_idx as usize] = (mask >> i) & 1 == 1;
            }
            if eval_root_fast(a, &assign, &mut memo) != eval_root_fast(b, &assign, &mut memo) {
                return (false, true);
            }
        }
        (true, true)
    } else {
        let mut s = 0x243f6a8885a308d3u64;
        for _ in 0..50000 {
            for &b_idx in &bes {
                assign[b_idx as usize] = splitmix(&mut s) & 1 == 1;
            }
            if eval_root_fast(a, &assign, &mut memo) != eval_root_fast(b, &assign, &mut memo) {
                return (false, false);
            }
        }
        (true, false)
    }
}

fn complex_remaining(pdag: &Pdag) -> usize {
    pdag.nodes()
        .values()
        .filter(|n| match n {
            PdagNode::Gate { connective, .. } => !matches!(
                connective,
                Connective::And | Connective::Or | Connective::Null
            ),
            _ => false,
        })
        .count()
}

fn run_case(name: &str, original: Pdag) {
    let before = original.node_count();
    let mut pp = Preprocessor::new(original.clone());
    if pp.run().is_err() {
        println!("{:<22} preprocess ERROR", name);
        return;
    }
    let pre = pp.into_pdag();
    let after = pre.node_count();
    let nbe = basic_events(&pre).len();
    let (verdict, bdd_nodes) = if nbe <= 64 {
        let eq = Bdd::equivalent(&original, &pre);
        let nodes = Bdd::from_pdag(&pre).map(|(b, _)| b.node_count()).unwrap_or(0);
        let v = match eq {
            Ok(true) => "MATCH",
            Ok(false) => "DIFF",
            Err(_) => "ERR",
        };
        (v, nodes)
    } else {
        let (equal, _) = functions_equal(&original, &pre);
        (if equal { "MATCH~" } else { "DIFF~" }, 0)
    };
    let complex = complex_remaining(&pre);
    let norm = if complex == 0 { "normalized" } else { "COMPLEX" };
    println!(
        "{:<22} nodes {:>4} -> {:>4}  bdd {:>6}  function {:<7} {}",
        name, before, after, bdd_nodes, verdict, norm
    );
}

fn be(p: &mut Pdag, id: &str) -> NodeIndex {
    p.add_basic_event(id.to_string())
}

fn gate(p: &mut Pdag, id: &str, c: Connective, ops: Vec<NodeIndex>, min: Option<usize>) -> NodeIndex {
    p.add_gate(id.to_string(), c, ops, min).unwrap()
}

fn tree_and() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let g = gate(&mut p, "G", Connective::And, vec![a, b], None);
    p.set_root(g).unwrap();
    p
}

fn tree_or() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let g = gate(&mut p, "G", Connective::Or, vec![a, b], None);
    p.set_root(g).unwrap();
    p
}

fn tree_not() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let g = gate(&mut p, "G", Connective::Not, vec![a], None);
    p.set_root(g).unwrap();
    p
}

fn tree_nand() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let g = gate(&mut p, "G", Connective::Nand, vec![a, b], None);
    p.set_root(g).unwrap();
    p
}

fn tree_nor() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let g = gate(&mut p, "G", Connective::Nor, vec![a, b], None);
    p.set_root(g).unwrap();
    p
}

fn tree_xor2() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let g = gate(&mut p, "G", Connective::Xor, vec![a, b], None);
    p.set_root(g).unwrap();
    p
}

fn tree_xor3() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let c = be(&mut p, "c");
    let g = gate(&mut p, "G", Connective::Xor, vec![a, b, c], None);
    p.set_root(g).unwrap();
    p
}

fn tree_iff2() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let g = gate(&mut p, "G", Connective::Iff, vec![a, b], None);
    p.set_root(g).unwrap();
    p
}

fn tree_atleast(name_n: usize, k: usize) -> Pdag {
    let mut p = Pdag::new();
    let mut ops = Vec::new();
    for i in 0..name_n {
        ops.push(be(&mut p, &format!("e{}", i)));
    }
    let g = gate(&mut p, "G", Connective::AtLeast, ops, Some(k));
    p.set_root(g).unwrap();
    p
}

fn tree_nested_nand() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let c = be(&mut p, "c");
    let nd = gate(&mut p, "ND", Connective::Nand, vec![a, b], None);
    let g = gate(&mut p, "TOP", Connective::Or, vec![nd, c], None);
    p.set_root(g).unwrap();
    p
}

fn tree_consensus() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let c = be(&mut p, "c");
    let g1 = gate(&mut p, "G1", Connective::And, vec![a, b], None);
    let g2 = gate(&mut p, "G2", Connective::And, vec![-a, c], None);
    let g = gate(&mut p, "TOP", Connective::Or, vec![g1, g2], None);
    p.set_root(g).unwrap();
    p
}

fn tree_shared_both_polarities() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let c = be(&mut p, "c");
    let sh = gate(&mut p, "SH", Connective::Or, vec![a, b], None);
    let x = gate(&mut p, "X", Connective::Or, vec![-sh, c], None);
    let g = gate(&mut p, "TOP", Connective::And, vec![sh, x], None);
    p.set_root(g).unwrap();
    p
}

fn tree_and_false() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let f = p.add_constant(false);
    let g = gate(&mut p, "G", Connective::And, vec![a, f], None);
    p.set_root(g).unwrap();
    p
}

fn tree_or_true() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let t = p.add_constant(true);
    let g = gate(&mut p, "G", Connective::Or, vec![a, t], None);
    p.set_root(g).unwrap();
    p
}

fn tree_and_true() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let t = p.add_constant(true);
    let g = gate(&mut p, "G", Connective::And, vec![a, t], None);
    p.set_root(g).unwrap();
    p
}

fn tree_or_false() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let f = p.add_constant(false);
    let g = gate(&mut p, "G", Connective::Or, vec![a, f], None);
    p.set_root(g).unwrap();
    p
}

fn tree_nested_const() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let b = be(&mut p, "b");
    let f = p.add_constant(false);
    let inner = gate(&mut p, "IN", Connective::And, vec![a, f], None);
    let g = gate(&mut p, "TOP", Connective::Or, vec![inner, b], None);
    p.set_root(g).unwrap();
    p
}

fn tree_null() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let g = gate(&mut p, "G", Connective::Null, vec![a], None);
    p.set_root(g).unwrap();
    p
}

fn tree_null_chain() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let n1 = gate(&mut p, "N1", Connective::Null, vec![a], None);
    let n2 = gate(&mut p, "N2", Connective::Null, vec![n1], None);
    let g = gate(&mut p, "TOP", Connective::Or, vec![n2, -a], None);
    p.set_root(g).unwrap();
    p
}

fn tree_neg_true_const() -> Pdag {
    let mut p = Pdag::new();
    let a = be(&mut p, "a");
    let t = p.add_constant(true);
    let g = gate(&mut p, "G", Connective::And, vec![a, -t], None);
    p.set_root(g).unwrap();
    p
}

fn run_synthetic() {
    println!("=== synthetic trees (current preprocessor) ===");
    run_case("and2", tree_and());
    run_case("or2", tree_or());
    run_case("not", tree_not());
    run_case("nand2", tree_nand());
    run_case("nor2", tree_nor());
    run_case("xor2", tree_xor2());
    run_case("xor3", tree_xor3());
    run_case("iff2", tree_iff2());
    run_case("atleast_2of3", tree_atleast(3, 2));
    run_case("atleast_2of5", tree_atleast(5, 2));
    run_case("atleast_2of15", tree_atleast(15, 2));
    run_case("nested_nand", tree_nested_nand());
    run_case("consensus_ab_a'c", tree_consensus());
    run_case("shared_both_pol", tree_shared_both_polarities());
    run_case("and_false", tree_and_false());
    run_case("or_true", tree_or_true());
    run_case("and_true", tree_and_true());
    run_case("or_false", tree_or_false());
    run_case("nested_const", tree_nested_const());
    run_case("null_pass", tree_null());
    run_case("null_chain", tree_null_chain());
    run_case("neg_true_const", tree_neg_true_const());
}

fn bdd_build(pre: &Pdag, order: &HashMap<NodeIndex, usize>) -> Option<(usize, u128)> {
    let t = Instant::now();
    match Bdd::from_pdag_with_order(pre, order) {
        Ok((b, _)) => Some((b.node_count(), t.elapsed().as_millis())),
        Err(_) => None,
    }
}

fn fmt_cell(r: Option<(usize, u128)>) -> String {
    match r {
        Some((n, ms)) => format!("{:>9}({:>4}ms)", n, ms),
        None => format!("{:>15}", "blowup"),
    }
}

fn run_order_bench(paths: &[String]) {
    println!("=== variable ordering ablation (preprocessed; BDD nodes(build ms)) ===");
    println!(
        "{:<20} {:>6}  {:>15} {:>15} {:>15}",
        "tree", "events", "dflm", "scram", "force"
    );
    let mut rows: Vec<[Option<usize>; 3]> = Vec::new();
    for path in paths {
        let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
        let pre = match fs::read_to_string(Path::new(path))
            .ok()
            .and_then(|t| parse_fault_tree(&t).ok())
            .and_then(|ft| Pdag::from_fault_tree(&ft).ok())
        {
            Some(pdag) => {
                let mut pp = Preprocessor::new(pdag);
                if pp.run().is_err() {
                    println!("{:<20} preprocess error", name);
                    continue;
                }
                pp.into_pdag()
            }
            None => {
                println!("{:<20} load error", name);
                continue;
            }
        };
        let nbe = basic_events(&pre).len();
        if nbe > 800 {
            println!("{:<20} {:>6}  (too many events, skipped)", name, nbe);
            continue;
        }
        let d = bdd_build(&pre, &dfs_order(&pre, false));
        let s = bdd_build(&pre, &dfs_order(&pre, true));
        let f = bdd_build(&pre, &force_order(&pre));
        println!(
            "{:<20} {:>6}  {} {} {}",
            name,
            nbe,
            fmt_cell(d),
            fmt_cell(s),
            fmt_cell(f)
        );
        rows.push([d.map(|x| x.0), s.map(|x| x.0), f.map(|x| x.0)]);
    }

    let labels = ["dflm", "scram", "force"];
    let mut logsum = [0.0f64; 3];
    let mut wins = [0usize; 3];
    let mut ties = [0usize; 3];
    let mut losses = [0usize; 3];
    let mut count = 0usize;
    for vals in &rows {
        if vals.iter().all(|v| v.is_some()) {
            let v = [vals[0].unwrap(), vals[1].unwrap(), vals[2].unwrap()];
            let minv = *v.iter().min().unwrap();
            let n_at_min = v.iter().filter(|&&x| x == minv).count();
            for i in 0..3 {
                logsum[i] += (v[i] as f64 / minv as f64).ln();
                if v[i] == minv {
                    if n_at_min == 1 {
                        wins[i] += 1;
                    } else {
                        ties[i] += 1;
                    }
                } else {
                    losses[i] += 1;
                }
            }
            count += 1;
        }
    }
    println!();
    println!(
        "=== summary over {} trees solved by all three (geomean normalized to per-tree best) ===",
        count
    );
    println!("{:<8} {:>10} {:>6} {:>6} {:>6}", "order", "geomean", "win", "tie", "loss");
    for i in 0..3 {
        let gm = if count > 0 {
            (logsum[i] / count as f64).exp()
        } else {
            0.0
        };
        println!(
            "{:<8} {:>10.3} {:>6} {:>6} {:>6}",
            labels[i], gm, wins[i], ties[i], losses[i]
        );
    }
    println!(
        "trees attempted (events<=800): {}, solved by all three: {}",
        rows.len(),
        count
    );
}

fn run_corpus(paths: &[String]) {
    println!("=== corpus fixtures (current preprocessor) ===");
    for path in paths {
        let name = path.rsplit(['/', '\\']).next().unwrap_or(path).to_string();
        let text = match fs::read_to_string(Path::new(path)) {
            Ok(t) => t,
            Err(_) => {
                println!("{:<22} read error", name);
                continue;
            }
        };
        let ft = match parse_fault_tree(&text) {
            Ok(f) => f,
            Err(_) => {
                println!("{:<22} parse error", name);
                continue;
            }
        };
        let pdag = match Pdag::from_fault_tree(&ft) {
            Ok(p) => p,
            Err(_) => {
                println!("{:<22} pdag error", name);
                continue;
            }
        };
        run_case(&name, pdag);
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.first().map(|s| s.as_str()) == Some("order") {
        run_order_bench(&args[1..]);
        return;
    }
    run_synthetic();
    if !args.is_empty() {
        run_corpus(&args);
    }
}
