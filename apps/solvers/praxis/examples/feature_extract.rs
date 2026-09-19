use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use praxis::algorithms::pdag::{NodeIndex, Pdag, PdagNode};
use praxis::analysis::width::{
    build_incidence_graph_full, build_incidence_graph_skeleton, compute_dfs_metadata_pdag,
    greedy_vertex_separation_pathwidth, maximal_modules, min_fill_treewidth, IncidenceGraph,
};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::Formula;
use praxis::io::parser::parse_fault_tree;

const WIDTH_CAP: usize = 4000;
const RARE: f64 = 1e-3;

fn read_text(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let u: Vec<u16> = bytes[2..]
            .chunks(2)
            .map(|c| u16::from_le_bytes([c[0], *c.get(1).unwrap_or(&0)]))
            .collect();
        Some(String::from_utf16_lossy(&u))
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        let u: Vec<u16> = bytes[2..]
            .chunks(2)
            .map(|c| u16::from_be_bytes([c[0], *c.get(1).unwrap_or(&0)]))
            .collect();
        Some(String::from_utf16_lossy(&u))
    } else {
        Some(String::from_utf8_lossy(&bytes).into_owned())
    }
}

fn find_xml(root: &Path, out: &mut Vec<PathBuf>) {
    if let Ok(rd) = fs::read_dir(root) {
        let mut entries: Vec<PathBuf> = rd.flatten().map(|e| e.path()).collect();
        entries.sort();
        for p in entries {
            if p.is_dir() {
                find_xml(&p, out);
            } else if p.extension().map_or(false, |x| x == "xml") {
                out.push(p);
            }
        }
    }
}

struct Feats {
    num_vars: usize,
    num_gates: usize,
    nv: usize,
    ne: usize,
    tw: Option<usize>,
    pw: Option<usize>,
    mean_fanout: f64,
    max_fanout: usize,
    frac_shared: f64,
    pmin: f64,
    pmed: f64,
    pmax: f64,
    frac_rare: f64,
    f_and: f64,
    f_or: f64,
    f_atl: f64,
    f_xor: f64,
}

struct Row {
    file: String,
    kind: String,
    root: String,
    f: Feats,
}

fn parent_counts(pdag: &Pdag, root: NodeIndex) -> HashMap<NodeIndex, usize> {
    let mut pc: HashMap<NodeIndex, usize> = HashMap::new();
    let mut seen: HashSet<NodeIndex> = HashSet::new();
    let mut stack = vec![root.abs()];
    while let Some(n) = stack.pop() {
        if !seen.insert(n) {
            continue;
        }
        if let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(n) {
            for &op in operands {
                *pc.entry(op.abs()).or_insert(0) += 1;
                stack.push(op.abs());
            }
        }
    }
    pc
}

fn compute_feats(
    pdag: &Pdag,
    ft: &FaultTree,
    graph: &IncidenceGraph,
    pc: &HashMap<NodeIndex, usize>,
) -> Feats {
    let verts: Vec<NodeIndex> = graph.vertices().collect();
    let nv = graph.num_vertices();
    let ne = graph.num_edges();

    let mut probs: Vec<f64> = Vec::new();
    let mut fanouts: Vec<usize> = Vec::new();
    let mut num_vars = 0usize;
    let mut num_gates = 0usize;
    let mut shared = 0usize;
    let (mut and, mut or, mut atl, mut xor, mut typed) = (0usize, 0usize, 0usize, 0usize, 0usize);

    for &v in &verts {
        match pdag.get_node(v) {
            Some(PdagNode::BasicEvent { id, .. }) => {
                num_vars += 1;
                if let Some(be) = ft.get_basic_event(id) {
                    probs.push(be.probability());
                }
                let fo = pc.get(&v).copied().unwrap_or(0);
                fanouts.push(fo);
                if fo > 1 {
                    shared += 1;
                }
            }
            Some(PdagNode::Gate { .. }) => {
                num_gates += 1;
                if let Some(g) = pdag
                    .get_node(v)
                    .and_then(|n| n.id())
                    .and_then(|name| ft.get_gate(name))
                {
                    typed += 1;
                    match g.formula() {
                        Formula::And | Formula::Nand => and += 1,
                        Formula::Or | Formula::Nor => or += 1,
                        Formula::AtLeast { .. } => atl += 1,
                        Formula::Xor | Formula::Iff => xor += 1,
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }

    probs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let (pmin, pmed, pmax, frac_rare) = if probs.is_empty() {
        (f64::NAN, f64::NAN, f64::NAN, f64::NAN)
    } else {
        let pmin = probs[0];
        let pmax = *probs.last().unwrap();
        let pmed = probs[probs.len() / 2];
        let fr = probs.iter().filter(|&&p| p < RARE).count() as f64 / probs.len() as f64;
        (pmin, pmed, pmax, fr)
    };
    let mean_fanout = if fanouts.is_empty() {
        0.0
    } else {
        fanouts.iter().sum::<usize>() as f64 / fanouts.len() as f64
    };
    let max_fanout = fanouts.iter().copied().max().unwrap_or(0);
    let frac_shared = if num_vars == 0 {
        0.0
    } else {
        shared as f64 / num_vars as f64
    };
    let gt = if typed == 0 { 1.0 } else { typed as f64 };

    let (tw, pw) = if nv > 0 && nv <= WIDTH_CAP {
        (
            Some(min_fill_treewidth(graph).upper_bound),
            Some(greedy_vertex_separation_pathwidth(graph).upper_bound),
        )
    } else {
        (None, None)
    };

    Feats {
        num_vars,
        num_gates,
        nv,
        ne,
        tw,
        pw,
        mean_fanout,
        max_fanout,
        frac_shared,
        pmin,
        pmed,
        pmax,
        frac_rare,
        f_and: and as f64 / gt,
        f_or: or as f64 / gt,
        f_atl: atl as f64 / gt,
        f_xor: xor as f64 / gt,
    }
}

#[derive(Default)]
struct Stats {
    found: usize,
    read_fail: usize,
    parse_fail: usize,
    pdag_fail: usize,
    pdag_ok: usize,
    cores: usize,
    width_done: usize,
    width_skipped: usize,
}

fn process(path: &Path, rows: &mut Vec<Row>, st: &mut Stats) {
    let fname = path.file_name().unwrap().to_string_lossy().to_string();
    let text = match read_text(path) {
        Some(t) => t,
        None => {
            st.read_fail += 1;
            return;
        }
    };
    let ft = match parse_fault_tree(&text) {
        Ok(f) => f,
        Err(_) => {
            st.parse_fail += 1;
            return;
        }
    };
    let pdag = match Pdag::from_fault_tree(&ft) {
        Ok(p) => p,
        Err(_) => {
            st.pdag_fail += 1;
            return;
        }
    };
    let root = match pdag.root() {
        Some(r) => r,
        None => {
            st.pdag_fail += 1;
            return;
        }
    };
    let meta = match compute_dfs_metadata_pdag(&pdag) {
        Ok(m) => m,
        Err(_) => {
            st.pdag_fail += 1;
            return;
        }
    };
    st.pdag_ok += 1;

    let pc = parent_counts(&pdag, root);
    let maximals = maximal_modules(&meta);
    let maximals_set: HashSet<NodeIndex> = maximals.iter().map(|m| m.abs()).collect();

    if !maximals_set.contains(&root.abs()) {
        let g = build_incidence_graph_skeleton(&pdag, root, &maximals_set);
        let f = compute_feats(&pdag, &ft, &g, &pc);
        st.cores += 1;
        if f.tw.is_some() {
            st.width_done += 1;
        } else {
            st.width_skipped += 1;
        }
        rows.push(Row {
            file: fname.clone(),
            kind: "skeleton".to_string(),
            root: ft.top_event().to_string(),
            f,
        });
    }
    for &m in &maximals {
        let g = build_incidence_graph_full(&pdag, m);
        let f = compute_feats(&pdag, &ft, &g, &pc);
        let name = pdag
            .get_node(m)
            .and_then(|n| n.id())
            .unwrap_or("?")
            .to_string();
        st.cores += 1;
        if f.tw.is_some() {
            st.width_done += 1;
        } else {
            st.width_skipped += 1;
        }
        rows.push(Row {
            file: fname.clone(),
            kind: "module".to_string(),
            root: name,
            f,
        });
    }
}

fn fu(o: Option<usize>) -> String {
    o.map(|x| x.to_string()).unwrap_or_default()
}
fn ff(x: f64) -> String {
    if x.is_nan() {
        String::new()
    } else {
        format!("{:.6}", x)
    }
}

fn run(dirs: Vec<String>) {
    let mut files: Vec<PathBuf> = Vec::new();
    for d in &dirs {
        find_xml(Path::new(d), &mut files);
    }
    let mut rows: Vec<Row> = Vec::new();
    let mut st = Stats::default();
    st.found = files.len();
    for p in &files {
        process(p, &mut rows, &mut st);
    }

    let mut csv = String::new();
    csv.push_str("file,core_kind,core_root,num_vars,num_gates,num_vertices,num_edges,treewidth,pathwidth,mean_fanout,max_fanout,frac_shared,prob_min,prob_median,prob_max,frac_rare,frac_and,frac_or,frac_atleast,frac_xor\n");
    for r in &rows {
        let f = &r.f;
        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}\n",
            r.file,
            r.kind,
            r.root,
            f.num_vars,
            f.num_gates,
            f.nv,
            f.ne,
            fu(f.tw),
            fu(f.pw),
            ff(f.mean_fanout),
            f.max_fanout,
            ff(f.frac_shared),
            ff(f.pmin),
            ff(f.pmed),
            ff(f.pmax),
            ff(f.frac_rare),
            ff(f.f_and),
            ff(f.f_or),
            ff(f.f_atl),
            ff(f.f_xor)
        ));
    }
    let out = "C:/tmp/praxis_features.csv";
    fs::write(out, &csv).expect("write csv");

    println!("=== feature extraction summary ===");
    println!("xml found:        {}", st.found);
    println!("parsed + pdag ok: {}", st.pdag_ok);
    println!("read/parse fails: {}", st.read_fail + st.parse_fail);
    println!(
        "pdag fails:       {}  (e.g. XOR-using -all voters)",
        st.pdag_fail
    );
    println!("cores extracted:  {}", st.cores);
    println!("  width computed: {}", st.width_done);
    println!(
        "  width skipped:  {}  (core > {} vertices, this pass)",
        st.width_skipped, WIDTH_CAP
    );
    println!("csv -> {}", out);

    let mut nus: Vec<&Row> = rows.iter().filter(|r| r.file == "nus9601.xml").collect();
    nus.sort_by_key(|r| std::cmp::Reverse(r.f.tw.unwrap_or(0)));
    println!("\n=== SANITY: nus9601 ===");
    if let Some(h) = nus.first() {
        println!(
            "hardest core: kind={} root={} vars={} treewidth={} pathwidth={}",
            h.kind,
            h.root,
            h.f.num_vars,
            fu(h.f.tw),
            fu(h.f.pw)
        );
        println!("expected from prior research: treewidth ~40-56, pathwidth ~114-221");
    } else {
        println!("no nus9601 rows found");
    }

    let mut bytw: Vec<&Row> = rows.iter().filter(|r| r.f.tw.is_some()).collect();
    bytw.sort_by_key(|r| std::cmp::Reverse(r.f.tw.unwrap_or(0)));
    println!("\n=== top 8 cores by treewidth (corpus) ===");
    println!(
        "{:<28} {:<9} {:>6} {:>4} {:>4}",
        "file", "kind", "vars", "tw", "pw"
    );
    for r in bytw.iter().take(8) {
        println!(
            "{:<28} {:<9} {:>6} {:>4} {:>4}",
            r.file,
            r.kind,
            r.f.num_vars,
            fu(r.f.tw),
            fu(r.f.pw)
        );
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let dirs = if args.is_empty() {
        vec![
            "fixtures/aralia".to_string(),
            "fixtures/synthetic".to_string(),
        ]
    } else {
        args
    };
    let handle = std::thread::Builder::new()
        .stack_size(1024 * 1024 * 1024)
        .spawn(move || run(dirs))
        .expect("spawn");
    handle.join().expect("join");
}
