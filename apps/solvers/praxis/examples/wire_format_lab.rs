use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::Path;
use std::time::Instant;

use praxis::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use praxis::io::parser::parse_fault_tree;
use praxis::io::pbf::{self, Node, Structure};

fn op_byte(c: Connective) -> u8 {
    match c {
        Connective::And => 0,
        Connective::Or => 1,
        Connective::Not => 2,
        Connective::AtLeast => 3,
        Connective::Xor => 4,
        Connective::Nand => 5,
        Connective::Nor => 6,
        Connective::Iff => 7,
        Connective::Null => 8,
    }
}

fn combine(c: Connective, vals: &[bool], min: Option<usize>) -> bool {
    match c {
        Connective::And => vals.iter().all(|&x| x),
        Connective::Or => vals.iter().any(|&x| x),
        Connective::Not => !vals[0],
        Connective::Nand => !vals.iter().all(|&x| x),
        Connective::Nor => !vals.iter().any(|&x| x),
        Connective::Xor => vals.iter().fold(false, |a, &b| a ^ b),
        Connective::Iff => vals.iter().all(|&x| x == vals[0]),
        Connective::AtLeast => vals.iter().filter(|&&x| x).count() >= min.unwrap_or(1),
        Connective::Null => vals.first().copied().unwrap_or(false),
    }
}

fn eval_structure(s: &Structure, assign: &[bool]) -> bool {
    let mut val = vec![false; s.nodes.len()];
    for (i, node) in s.nodes.iter().enumerate() {
        val[i] = match node {
            Node::BasicEvent { .. } => assign[i],
            Node::Constant { value } => *value,
            Node::Gate { op, k, operands } => {
                let vals: Vec<bool> = operands
                    .iter()
                    .map(|r| val[r.position] ^ r.complement)
                    .collect();
                combine(*op, &vals, *k)
            }
        };
    }
    val[s.root.position] ^ s.root.complement ^ s.global_complement
}

fn eval_pdag(
    pdag: &Pdag,
    node: NodeIndex,
    pos: &HashMap<NodeIndex, usize>,
    assign: &[bool],
    memo: &mut HashMap<NodeIndex, bool>,
) -> bool {
    let a = node.abs();
    let v = if let Some(&m) = memo.get(&a) {
        m
    } else {
        let r = match pdag.get_node(a).unwrap() {
            PdagNode::BasicEvent { .. } => assign[pos[&a]],
            PdagNode::Constant { value, .. } => *value,
            PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            } => {
                let vals: Vec<bool> = operands
                    .iter()
                    .map(|&o| eval_pdag(pdag, o, pos, assign, memo))
                    .collect();
                combine(*connective, &vals, *min_number)
            }
        };
        memo.insert(a, r);
        r
    };
    v ^ (node < 0)
}

fn encode_naive(s: &Structure) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(b"NBF1");
    out.push(1);
    out.push(u8::from(s.global_complement));
    out.extend_from_slice(&(s.pool.len() as u32).to_le_bytes());
    for &v in &s.pool {
        out.extend_from_slice(&v.to_bits().to_le_bytes());
    }
    out.extend_from_slice(&(s.nodes.len() as u32).to_le_bytes());
    for (i, node) in s.nodes.iter().enumerate() {
        match node {
            Node::BasicEvent { value } => {
                out.push(0);
                out.extend_from_slice(&(*value as u32).to_le_bytes());
            }
            Node::Constant { value } => {
                out.push(2);
                out.push(u8::from(*value));
            }
            Node::Gate { op, k, operands } => {
                out.push(1);
                out.push(op_byte(*op));
                out.extend_from_slice(&(k.unwrap_or(0) as u32).to_le_bytes());
                out.extend_from_slice(&(operands.len() as u32).to_le_bytes());
                for r in operands {
                    let raw = (((i - r.position) as u32) << 1) | u32::from(r.complement);
                    out.extend_from_slice(&raw.to_le_bytes());
                }
            }
        }
    }
    let raw = ((s.root.position as u32) << 1) | u32::from(s.root.complement);
    out.extend_from_slice(&raw.to_le_bytes());
    out
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let dir = &args[1];
    let outdir = &args[2];
    fs::create_dir_all(outdir).expect("outdir");

    let mut files: Vec<_> = fs::read_dir(dir)
        .expect("read dir")
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().map(|x| x == "xml").unwrap_or(false))
        .collect();
    files.sort();

    println!(
        "{:<10} {:>9} {:>8} {:>8} {:>7} {:>9} {:>9} {:>5} {:>4}",
        "tree", "xml", "nbf", "pbf", "pbf/xml", "enc_us", "dec_us", "rt", "fn"
    );
    let (mut txml, mut tnbf, mut tpbf) = (0u64, 0u64, 0u64);
    for path in &files {
        let name = path.file_stem().unwrap().to_string_lossy().to_string();
        let Ok(text) = fs::read_to_string(path) else {
            continue;
        };
        let xml_bytes = text.len() as u64;
        let Ok(ft) = parse_fault_tree(&text) else {
            println!("{:<10} {:>9} parse-fail", name, xml_bytes);
            continue;
        };
        let Ok(pdag) = Pdag::from_fault_tree(&ft) else {
            println!("{:<10} {:>9} pdag-fail", name, xml_bytes);
            continue;
        };

        let s = pbf::structure_from_pdag(&pdag, |id| {
            ft.get_basic_event(id)
                .map(|b| b.probability())
                .unwrap_or(0.0)
        })
        .expect("structure");

        let t0 = Instant::now();
        let bytes = pbf::encode(&s);
        let enc_us = t0.elapsed().as_micros();

        let t1 = Instant::now();
        let decoded = pbf::decode(&bytes).expect("decode");
        let dec_us = t1.elapsed().as_micros();

        let rt = s == decoded;
        let nbf = encode_naive(&s);

        let order = pdag.topological_sort().unwrap();
        let mut pos: HashMap<NodeIndex, usize> = HashMap::new();
        for (i, &n) in order.iter().enumerate() {
            pos.insert(n, i);
        }
        let n = decoded.nodes.len();
        let root = pdag.root().unwrap();
        let mut rng: u64 = (0x9E3779B97F4A7C15 ^ xml_bytes.wrapping_mul(2654435761)) | 1;
        let mut fn_ok = true;
        for t in 0..(4096usize + 2) {
            let assign: Vec<bool> = if t == 4096 {
                vec![false; n]
            } else if t == 4097 {
                vec![true; n]
            } else {
                (0..n)
                    .map(|_| {
                        rng ^= rng << 13;
                        rng ^= rng >> 7;
                        rng ^= rng << 17;
                        rng & 1 == 1
                    })
                    .collect()
            };
            let mut memo = HashMap::new();
            let a = eval_pdag(&pdag, root, &pos, &assign, &mut memo) ^ pdag.complement();
            if a != eval_structure(&decoded, &assign) {
                fn_ok = false;
                break;
            }
        }

        println!(
            "{:<10} {:>9} {:>8} {:>8} {:>7.3} {:>9} {:>9} {:>5} {:>4}",
            name,
            xml_bytes,
            nbf.len(),
            bytes.len(),
            bytes.len() as f64 / xml_bytes as f64,
            enc_us,
            dec_us,
            if rt { "ok" } else { "BAD" },
            if fn_ok { "ok" } else { "BAD" }
        );

        fs::write(Path::new(outdir).join(format!("{name}.pbf")), &bytes).expect("write");
        txml += xml_bytes;
        tnbf += nbf.len() as u64;
        tpbf += bytes.len() as u64;
    }
    println!(
        "{:<10} {:>9} {:>8} {:>8} {:>7.3}",
        "TOTAL",
        txml,
        tnbf,
        tpbf,
        tpbf as f64 / txml as f64
    );
}
