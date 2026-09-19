use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};
use std::env;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use praxis::algorithms::ordering::{force_order, sloan_fac_order};
use praxis::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use praxis::analysis::width::compute_dfs_metadata_pdag;
use praxis::io::parser::parse_fault_tree;
use praxis::mc::memory::HostMemoryTracker;
use std::cell::RefCell;
use std::time::Instant;
use sysinfo::System;

#[derive(Default)]
struct Prof {
    inram_combines: u64,
    ext_combines: u64,
    max_unreduced: u64,
    max_reduced: u64,
    sum_unreduced: u64,
    sum_reduced: u64,
    apply_ns: u128,
    reduce_ns: u128,
    sort_ns: u128,
    fold_spills: u64,
}
thread_local! {
    static PROF: RefCell<Prof> = RefCell::new(Prof::default());
}
fn prof<R, F: FnOnce(&mut Prof) -> R>(f: F) -> R {
    PROF.with(|p| f(&mut p.borrow_mut()))
}
fn prof_summary(tag: &str) {
    PROF.with(|p| {
        let p = p.borrow();
        eprintln!(
            "[PROF {}] inram_combines={} ext_combines={} | unreduced max={} sum={} | reduced max={} sum={} | apply={:.1}s reduce={:.1}s sort={:.1}s | fold_spills={}",
            tag,
            p.inram_combines,
            p.ext_combines,
            p.max_unreduced,
            p.sum_unreduced,
            p.max_reduced,
            p.sum_reduced,
            p.apply_ns as f64 / 1e9,
            p.reduce_ns as f64 / 1e9,
            p.sort_ns as f64 / 1e9,
            p.fold_spills,
        );
    });
}
fn file_nodes(p: &str) -> u64 {
    fs::metadata(p).map(|m| m.len() / 32).unwrap_or(0)
}
fn dir_bytes(tmp: &str) -> u64 {
    fs::read_dir(tmp)
        .map(|rd| {
            rd.flatten()
                .filter_map(|e| e.metadata().ok().map(|m| m.len()))
                .sum()
        })
        .unwrap_or(0)
}

const T: i64 = 1;
const F: i64 = -1;

fn read_text(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let u: Vec<u16> = bytes[2..]
            .chunks(2)
            .map(|c| u16::from_le_bytes([c[0], *c.get(1).unwrap_or(&0)]))
            .collect();
        Some(String::from_utf16_lossy(&u))
    } else {
        Some(String::from_utf8_lossy(&bytes).into_owned())
    }
}

struct Plain {
    nodes: Vec<(u32, i64, i64)>,
    unique: HashMap<(u32, i64, i64), i64>,
    cache: HashMap<(i64, i64, i64), i64>,
    free: Vec<i64>,
    limit: usize,
    over: bool,
}

impl Plain {
    fn new() -> Self {
        Self::with_limit(0)
    }
    fn with_limit(limit: usize) -> Self {
        Self {
            nodes: vec![(u32::MAX, 0, 0), (u32::MAX, 0, 0)],
            unique: HashMap::new(),
            cache: HashMap::new(),
            free: Vec::new(),
            limit,
            over: false,
        }
    }
    fn var_of(&self, r: i64) -> u32 {
        let a = r.unsigned_abs();
        if a <= 1 {
            u32::MAX
        } else {
            self.nodes[a as usize].0
        }
    }
    fn mk(&mut self, var: u32, lo: i64, hi: i64) -> i64 {
        if lo == hi {
            return lo;
        }
        let (clo, chi, negate) = if hi < 0 {
            (-lo, -hi, true)
        } else {
            (lo, hi, false)
        };
        if let Some(&id) = self.unique.get(&(var, clo, chi)) {
            return if negate { -id } else { id };
        }
        let id = if let Some(slot) = self.free.pop() {
            self.nodes[slot as usize] = (var, clo, chi);
            slot
        } else {
            let i = self.nodes.len() as i64;
            self.nodes.push((var, clo, chi));
            i
        };
        self.unique.insert((var, clo, chi), id);
        if self.limit != 0 && self.footprint() > self.limit {
            self.over = true;
        }
        if negate {
            -id
        } else {
            id
        }
    }
    fn gc(&mut self, root: i64) {
        let n = self.nodes.len();
        let mut marked = vec![false; n];
        let mut stack: Vec<usize> = Vec::new();
        let ra = root.unsigned_abs() as usize;
        if ra >= 2 {
            stack.push(ra);
        }
        while let Some(xi) = stack.pop() {
            if xi < 2 || marked[xi] {
                continue;
            }
            marked[xi] = true;
            let (_, lo, hi) = self.nodes[xi];
            let la = lo.unsigned_abs() as usize;
            let ha = hi.unsigned_abs() as usize;
            if la >= 2 {
                stack.push(la);
            }
            if ha >= 2 {
                stack.push(ha);
            }
        }
        for i in 2..n {
            if !marked[i] && self.nodes[i].0 != u32::MAX {
                let node = self.nodes[i];
                self.unique.remove(&node);
                self.nodes[i] = (u32::MAX, 0, 0);
                self.free.push(i as i64);
            }
        }
        self.cache = HashMap::new();
        self.over = false;
    }
    fn footprint(&self) -> usize {
        use std::mem::size_of;
        let live = (self.nodes.len() - 2).saturating_sub(self.free.len());
        live * (size_of::<(u32, i64, i64)>() + size_of::<((u32, i64, i64), i64)>() + 1)
            + self.cache.len() * (size_of::<((i64, i64, i64), i64)>() + 1)
    }
    fn cofactor(&self, f: i64, var: u32, hi_branch: bool) -> i64 {
        let a = f.unsigned_abs();
        if a <= 1 {
            return f;
        }
        let (nv, lo, hi) = self.nodes[a as usize];
        if nv != var {
            return f;
        }
        let edge = if hi_branch { hi } else { lo };
        if f < 0 {
            -edge
        } else {
            edge
        }
    }
    fn ite(&mut self, f: i64, g: i64, h: i64) -> i64 {
        if self.over {
            return F;
        }
        if f == T {
            return g;
        }
        if f == F {
            return h;
        }
        let mut nf = f;
        let mut ng = g;
        let mut nh = h;
        let mut negate = false;
        if nf < 0 {
            nf = -nf;
            std::mem::swap(&mut ng, &mut nh);
        }
        if ng < 0 {
            negate = !negate;
            ng = -ng;
            nh = -nh;
        }
        if ng == nh {
            return if negate { -ng } else { ng };
        }
        if ng == T && nh == F {
            return if negate { -nf } else { nf };
        }
        let key = (nf, ng, nh);
        if let Some(&c) = self.cache.get(&key) {
            return if negate { -c } else { c };
        }
        let top = self.var_of(nf).min(self.var_of(ng)).min(self.var_of(nh));
        let f1 = self.cofactor(nf, top, true);
        let g1 = self.cofactor(ng, top, true);
        let h1 = self.cofactor(nh, top, true);
        let f0 = self.cofactor(nf, top, false);
        let g0 = self.cofactor(ng, top, false);
        let h0 = self.cofactor(nh, top, false);
        let t = self.ite(f1, g1, h1);
        let e = self.ite(f0, g0, h0);
        let r = self.mk(top, e, t);
        self.cache.insert(key, r);
        if negate {
            -r
        } else {
            r
        }
    }
    fn not(&self, f: i64) -> i64 {
        -f
    }
    fn and(&mut self, f: i64, g: i64) -> i64 {
        self.ite(f, g, F)
    }
    fn or(&mut self, f: i64, g: i64) -> i64 {
        self.ite(f, T, g)
    }
    fn atleast(&mut self, ch: &[i64], k: usize) -> i64 {
        if k == 0 {
            return T;
        }
        if k > ch.len() {
            return F;
        }
        let x = ch[0];
        let t = self.atleast(&ch[1..], k - 1);
        let e = self.atleast(&ch[1..], k);
        self.ite(x, t, e)
    }
}

fn build(
    plain: &mut Plain,
    pdag: &Pdag,
    idx: NodeIndex,
    var_of: &HashMap<NodeIndex, usize>,
    memo: &mut HashMap<NodeIndex, i64>,
) -> i64 {
    let a = idx.abs();
    if let Some(&r) = memo.get(&a) {
        return r;
    }
    let r = match pdag.get_node(a) {
        Some(PdagNode::BasicEvent { .. }) => {
            let v = var_of[&a] as u32;
            plain.mk(v, F, T)
        }
        Some(PdagNode::Constant { value, .. }) => {
            if *value {
                T
            } else {
                F
            }
        }
        Some(PdagNode::Gate {
            connective,
            operands,
            min_number,
            ..
        }) => {
            let conn = *connective;
            let min = *min_number;
            let ops = operands.clone();
            let mut ch = Vec::with_capacity(ops.len());
            for op in ops {
                let mut c = build(plain, pdag, op.abs(), var_of, memo);
                if op < 0 {
                    c = plain.not(c);
                }
                ch.push(c);
            }
            match conn {
                Connective::And => {
                    let mut acc = T;
                    for c in ch {
                        acc = plain.and(acc, c);
                    }
                    acc
                }
                Connective::Or => {
                    let mut acc = F;
                    for c in ch {
                        acc = plain.or(acc, c);
                    }
                    acc
                }
                Connective::Nand => {
                    let mut acc = T;
                    for c in ch {
                        acc = plain.and(acc, c);
                    }
                    plain.not(acc)
                }
                Connective::Nor => {
                    let mut acc = F;
                    for c in ch {
                        acc = plain.or(acc, c);
                    }
                    plain.not(acc)
                }
                Connective::Not => plain.not(ch[0]),
                Connective::Null => ch.first().copied().unwrap_or(T),
                Connective::Xor => {
                    let mut acc = F;
                    for c in ch {
                        let nc = plain.not(c);
                        acc = plain.ite(acc, nc, c);
                    }
                    acc
                }
                Connective::Iff => {
                    let mut allt = T;
                    let mut allf = T;
                    for c in ch {
                        allt = plain.and(allt, c);
                        let nc = plain.not(c);
                        allf = plain.and(allf, nc);
                    }
                    plain.or(allt, allf)
                }
                Connective::AtLeast => plain.atleast(&ch, min.unwrap_or(1)),
            }
        }
        None => panic!("node {} not found", a),
    };
    memo.insert(a, r);
    r
}

fn plain_prob(nodes: &[(u32, i64, i64)], root: i64, vp: &[f64]) -> f64 {
    fn go(nodes: &[(u32, i64, i64)], r: i64, vp: &[f64], memo: &mut HashMap<i64, f64>) -> f64 {
        if r == T {
            return 1.0;
        }
        if r == F {
            return 0.0;
        }
        let a = r.unsigned_abs() as i64;
        if let Some(&p) = memo.get(&a) {
            return if r < 0 { 1.0 - p } else { p };
        }
        let (var, lo, hi) = nodes[a as usize];
        let pv = vp[var as usize];
        let p = pv * go(nodes, hi, vp, memo) + (1.0 - pv) * go(nodes, lo, vp, memo);
        memo.insert(a, p);
        if r < 0 {
            1.0 - p
        } else {
            p
        }
    }
    go(nodes, root, vp, &mut HashMap::new())
}

fn read_rec(reader: &mut impl Read, len: usize, buf: &mut [u8]) -> Option<Vec<u64>> {
    match reader.read_exact(buf) {
        Ok(()) => {
            let mut out = Vec::with_capacity(len);
            for i in 0..len {
                let mut w = [0u8; 8];
                w.copy_from_slice(&buf[i * 8..i * 8 + 8]);
                out.push(u64::from_le_bytes(w));
            }
            Some(out)
        }
        Err(_) => None,
    }
}

fn write_rec(writer: &mut impl Write, rec: &[u64]) {
    for &w in rec {
        writer.write_all(&w.to_le_bytes()).unwrap();
    }
}

fn words_to_bytes(src: &[u64], dst: &mut [u8]) {
    for (j, &word) in src.iter().enumerate() {
        dst[j * 8..j * 8 + 8].copy_from_slice(&word.to_le_bytes());
    }
}

fn read_into(reader: &mut impl Read, dst: &mut [u64], bytebuf: &mut [u8]) -> bool {
    match reader.read_exact(bytebuf) {
        Ok(()) => {
            for (i, c) in bytebuf.chunks_exact(8).enumerate() {
                dst[i] = u64::from_le_bytes(c.try_into().unwrap());
            }
            true
        }
        Err(_) => false,
    }
}

fn external_sort<K: Fn(&[u64]) -> u128>(
    in_path: &str,
    out_path: &str,
    len: usize,
    budget_records: usize,
    key: K,
    tmp: &str,
) {
    let rec_bytes = len * 8;
    let chunk_bytes = budget_records.max(1) * rec_bytes;
    let mut file = File::open(in_path).unwrap();
    let mut bytebuf = vec![0u8; chunk_bytes];
    let mut outbuf = vec![0u8; chunk_bytes];
    let mut flat: Vec<u64> = Vec::with_capacity(budget_records.max(1) * len);
    let mut runs: Vec<String> = Vec::new();
    loop {
        let mut filled = 0;
        while filled < chunk_bytes {
            match file.read(&mut bytebuf[filled..]) {
                Ok(0) => break,
                Ok(n) => filled += n,
                Err(_) => break,
            }
        }
        if filled == 0 {
            break;
        }
        let count = filled / rec_bytes;
        flat.clear();
        for c in bytebuf[..count * rec_bytes].chunks_exact(8) {
            flat.push(u64::from_le_bytes(c.try_into().unwrap()));
        }
        let keys: Vec<u128> = (0..count)
            .map(|r| key(&flat[r * len..r * len + len]))
            .collect();
        let mut idx: Vec<u32> = (0..count as u32).collect();
        idx.sort_unstable_by(|&a, &b| keys[a as usize].cmp(&keys[b as usize]));
        for (pos, &i) in idx.iter().enumerate() {
            let src = &flat[i as usize * len..i as usize * len + len];
            words_to_bytes(
                src,
                &mut outbuf[pos * rec_bytes..pos * rec_bytes + rec_bytes],
            );
        }
        let run_path = format!("{}/run_{}.bin", tmp, runs.len());
        File::create(&run_path)
            .unwrap()
            .write_all(&outbuf[..count * rec_bytes])
            .unwrap();
        runs.push(run_path);
        if filled < chunk_bytes {
            break;
        }
    }

    let mut readers: Vec<BufReader<File>> = runs
        .iter()
        .map(|p| BufReader::new(File::open(p).unwrap()))
        .collect();
    let mut heads = vec![0u64; readers.len() * len];
    let mut rbuf = vec![0u8; rec_bytes];
    let mut heap: BinaryHeap<Reverse<(u128, usize)>> = BinaryHeap::new();
    for i in 0..readers.len() {
        if read_into(
            &mut readers[i],
            &mut heads[i * len..i * len + len],
            &mut rbuf,
        ) {
            let k = key(&heads[i * len..i * len + len]);
            heap.push(Reverse((k, i)));
        }
    }
    let mut w = BufWriter::new(File::create(out_path).unwrap());
    let mut ob = vec![0u8; rec_bytes];
    while let Some(Reverse((_, i))) = heap.pop() {
        words_to_bytes(&heads[i * len..i * len + len], &mut ob);
        w.write_all(&ob).unwrap();
        if read_into(
            &mut readers[i],
            &mut heads[i * len..i * len + len],
            &mut rbuf,
        ) {
            let k = key(&heads[i * len..i * len + len]);
            heap.push(Reverse((k, i)));
        }
    }
    w.flush().unwrap();
    drop(readers);
    for p in runs {
        let _ = fs::remove_file(p);
    }
}

struct RecReader {
    reader: BufReader<File>,
    len: usize,
    buf: Vec<u8>,
}
impl RecReader {
    fn open(path: &str, len: usize) -> Self {
        Self {
            reader: BufReader::new(File::open(path).unwrap()),
            len,
            buf: vec![0u8; len * 8],
        }
    }
    fn next(&mut self) -> Option<Vec<u64>> {
        read_rec(&mut self.reader, self.len, &mut self.buf)
    }
}

fn ooc_reduce(
    unreduced: &str,
    root_old: u64,
    num_vars: usize,
    budget_records: usize,
    reduced_out: &str,
    tmp: &str,
) -> (usize, u64) {
    let v = num_vars as u64;
    let sorted = format!("{}/u_sorted.bin", tmp);
    external_sort(
        unreduced,
        &sorted,
        4,
        budget_records,
        |r| ((v - r[0]) as u128) << 64 | (r[1] as u128),
        tmp,
    );

    let mut trans = format!("{}/trans_0.bin", tmp);
    File::create(&trans).unwrap();
    let mut reduced_w = BufWriter::new(File::create(reduced_out).unwrap());
    let mut reduced_count = 0usize;
    let mut root_canon = u64::MAX;
    let mut gen = 1u64;

    let lvl_path = format!("{}/level.bin", tmp);
    let mut reader = RecReader::open(&sorted, 4);
    let mut cur_var: Option<u32> = None;
    let mut lvl_w = BufWriter::new(File::create(&lvl_path).unwrap());
    loop {
        let rec = reader.next();
        let var = rec.as_ref().map(|r| r[0] as u32);
        if cur_var.is_some() && var != cur_var {
            lvl_w.flush().unwrap();
            drop(lvl_w);
            let new_trans = format!("{}/trans_{}.bin", tmp, gen);
            gen += 1;
            process_level_ext(
                cur_var.unwrap(),
                &lvl_path,
                &trans,
                &new_trans,
                budget_records,
                tmp,
                &mut reduced_w,
                &mut reduced_count,
                root_old,
                &mut root_canon,
            );
            let _ = fs::remove_file(&trans);
            trans = new_trans;
            lvl_w = BufWriter::new(File::create(&lvl_path).unwrap());
        }
        match rec {
            Some(r) => {
                cur_var = Some(r[0] as u32);
                write_rec(&mut lvl_w, &r);
            }
            None => break,
        }
    }
    drop(lvl_w);
    reduced_w.flush().unwrap();
    let _ = fs::remove_file(&sorted);
    let _ = fs::remove_file(&trans);
    let _ = fs::remove_file(&lvl_path);
    (reduced_count, root_canon)
}

#[allow(clippy::too_many_arguments)]
fn process_level_ext(
    var: u32,
    lvl_path: &str,
    trans_path: &str,
    new_trans_path: &str,
    budget: usize,
    tmp: &str,
    reduced_w: &mut BufWriter<File>,
    reduced_count: &mut usize,
    root_old: u64,
    root_canon: &mut u64,
) {
    let mut local_counter = 0u64;
    let req_path = format!("{}/req.bin", tmp);
    let edges_path = format!("{}/edges.bin", tmp);
    {
        let mut lvl = RecReader::open(lvl_path, 4);
        let mut reqw = BufWriter::new(File::create(&req_path).unwrap());
        let mut edgesw = BufWriter::new(File::create(&edges_path).unwrap());
        while let Some(r) = lvl.next() {
            let (id, lo, hi) = (r[1], r[2], r[3]);
            if lo < 2 {
                write_rec(&mut edgesw, &[id, 0, lo]);
            } else {
                write_rec(&mut reqw, &[lo, id, 0]);
            }
            if hi < 2 {
                write_rec(&mut edgesw, &[id, 1, hi]);
            } else {
                write_rec(&mut reqw, &[hi, id, 1]);
            }
        }
        reqw.flush().unwrap();
        drop(reqw);
        let req_sorted = format!("{}/req_sorted.bin", tmp);
        external_sort(&req_path, &req_sorted, 3, budget, |r| r[0] as u128, tmp);
        let mut reqr = RecReader::open(&req_sorted, 3);
        let mut tr = RecReader::open(trans_path, 2);
        let mut cur = tr.next();
        while let Some(q) = reqr.next() {
            let child = q[0];
            loop {
                let adv = matches!(&cur, Some(c) if c[0] < child);
                if adv {
                    cur = tr.next();
                } else {
                    break;
                }
            }
            let canon = match &cur {
                Some(c) if c[0] == child => c[1],
                _ => panic!("forwarding merge: missing canon for old_id {}", child),
            };
            write_rec(&mut edgesw, &[q[1], q[2], canon]);
        }
        edgesw.flush().unwrap();
        drop(reqr);
        let _ = fs::remove_file(&req_sorted);
    }
    let _ = fs::remove_file(&req_path);

    let edges_sorted = format!("{}/edges_sorted.bin", tmp);
    external_sort(
        &edges_path,
        &edges_sorted,
        3,
        budget,
        |r| ((r[0] as u128) << 1) | (r[1] as u128),
        tmp,
    );
    let translated = format!("{}/translated.bin", tmp);
    {
        let mut er = RecReader::open(&edges_sorted, 3);
        let mut tw = BufWriter::new(File::create(&translated).unwrap());
        while let Some(e0) = er.next() {
            let e1 = er.next().expect("edge pair");
            debug_assert!(e0[0] == e1[0] && e0[1] == 0 && e1[1] == 1);
            write_rec(&mut tw, &[e0[2], e1[2], e0[0]]);
        }
        tw.flush().unwrap();
    }
    let _ = fs::remove_file(&edges_path);
    let _ = fs::remove_file(&edges_sorted);

    let trans_sorted = format!("{}/translated_sorted.bin", tmp);
    external_sort(
        &translated,
        &trans_sorted,
        3,
        budget,
        |r| ((r[0] as u128) << 64) | (r[1] as u128),
        tmp,
    );
    let ntrans_part = format!("{}/ntrans_part.bin", tmp);
    {
        let mut tsr = RecReader::open(&trans_sorted, 3);
        let mut ntw = BufWriter::new(File::create(&ntrans_part).unwrap());
        let mut prev: Option<(u64, u64, u64)> = None;
        while let Some(r) = tsr.next() {
            let (lo, hi, id) = (r[0], r[1], r[2]);
            let val = if lo == hi {
                lo
            } else {
                match prev {
                    Some((plo, phi, c)) if plo == lo && phi == hi => c,
                    _ => {
                        let c = ((var as u64) << 40) | (local_counter + 2);
                        local_counter += 1;
                        write_rec(reduced_w, &[var as u64, c, lo, hi]);
                        *reduced_count += 1;
                        prev = Some((lo, hi, c));
                        c
                    }
                }
            };
            if id == root_old {
                *root_canon = val;
            }
            write_rec(&mut ntw, &[id, val]);
        }
        ntw.flush().unwrap();
    }
    let _ = fs::remove_file(&translated);
    let _ = fs::remove_file(&trans_sorted);

    let ntrans_sorted = format!("{}/ntrans_sorted.bin", tmp);
    external_sort(
        &ntrans_part,
        &ntrans_sorted,
        2,
        budget,
        |r| r[0] as u128,
        tmp,
    );
    {
        let mut nr = RecReader::open(&ntrans_sorted, 2);
        let mut orr = RecReader::open(trans_path, 2);
        let mut w = BufWriter::new(File::create(new_trans_path).unwrap());
        let mut a = nr.next();
        let mut b = orr.next();
        loop {
            let pick = match (&a, &b) {
                (Some(av), Some(bv)) => {
                    if av[0] <= bv[0] {
                        0
                    } else {
                        1
                    }
                }
                (Some(_), None) => 0,
                (None, Some(_)) => 1,
                (None, None) => 2,
            };
            match pick {
                0 => {
                    write_rec(&mut w, a.as_ref().unwrap());
                    a = nr.next();
                }
                1 => {
                    write_rec(&mut w, b.as_ref().unwrap());
                    b = orr.next();
                }
                _ => break,
            }
        }
        w.flush().unwrap();
    }
    let _ = fs::remove_file(&ntrans_part);
    let _ = fs::remove_file(&ntrans_sorted);
}

fn load_reduced(path: &str) -> HashMap<u64, (u32, u64, u64)> {
    let mut m = HashMap::new();
    let mut rr = RecReader::open(path, 4);
    while let Some(r) = rr.next() {
        m.insert(r[1], (r[0] as u32, r[2], r[3]));
    }
    m
}

fn reduced_prob(map: &HashMap<u64, (u32, u64, u64)>, root: u64, vp: &[f64]) -> f64 {
    fn go(
        map: &HashMap<u64, (u32, u64, u64)>,
        r: u64,
        vp: &[f64],
        memo: &mut HashMap<u64, f64>,
    ) -> f64 {
        if r == 1 {
            return 1.0;
        }
        if r == 0 {
            return 0.0;
        }
        if let Some(&p) = memo.get(&r) {
            return p;
        }
        let (var, lo, hi) = map[&r];
        let pv = vp[var as usize];
        let p = pv * go(map, hi, vp, memo) + (1.0 - pv) * go(map, lo, vp, memo);
        memo.insert(r, p);
        p
    }
    go(map, root, vp, &mut HashMap::new())
}

fn var_ref(r: u64, v: u64) -> u64 {
    if r < 2 {
        v
    } else {
        r >> 40
    }
}

#[allow(clippy::too_many_arguments)]
fn emit_edge(
    s: u64,
    t: u64,
    parent: u64,
    edge: u64,
    op: u8,
    v: u64,
    sentinel: u64,
    tmp: &str,
    buckets: &mut Vec<Option<BufWriter<File>>>,
    res_w: &mut BufWriter<File>,
    product_root: &mut u64,
) {
    let term = if op == 0 {
        if s == 0 || t == 0 {
            Some(0)
        } else if s == 1 && t == 1 {
            Some(1)
        } else {
            None
        }
    } else if s == 1 || t == 1 {
        Some(1)
    } else if s == 0 && t == 0 {
        Some(0)
    } else {
        None
    };
    if let Some(x) = term {
        if parent == sentinel {
            *product_root = x;
        } else {
            write_rec(res_w, &[parent, edge, x]);
        }
        return;
    }
    let lvl = var_ref(s, v).min(var_ref(t, v));
    if buckets[lvl as usize].is_none() {
        let p = format!("{}/areq_{}.bin", tmp, lvl);
        buckets[lvl as usize] = Some(BufWriter::new(File::create(&p).unwrap()));
    }
    write_rec(
        buckets[lvl as usize].as_mut().unwrap(),
        &[s, t, parent, edge],
    );
}

fn ooc_apply(
    f_path: &str,
    g_path: &str,
    root_f: u64,
    root_g: u64,
    op: u8,
    v: u64,
    budget: usize,
    out_path: &str,
    tmp: &str,
) -> u64 {
    let sentinel = u64::MAX;
    let mut product_root = sentinel;
    let mut buckets: Vec<Option<BufWriter<File>>> = (0..v).map(|_| None).collect();
    let nodes_path = format!("{}/aprod_nodes.bin", tmp);
    let res_path = format!("{}/aprod_res.bin", tmp);
    let mut nodes_w = BufWriter::new(File::create(&nodes_path).unwrap());
    let mut res_w = BufWriter::new(File::create(&res_path).unwrap());

    emit_edge(
        root_f,
        root_g,
        sentinel,
        0,
        op,
        v,
        sentinel,
        tmp,
        &mut buckets,
        &mut res_w,
        &mut product_root,
    );

    let mut fr = RecReader::open(f_path, 4);
    let mut gr = RecReader::open(g_path, 4);
    let mut f_cur = fr.next();
    let mut g_cur = gr.next();

    for l in 0..v {
        let mut map_f: HashMap<u64, (u64, u64)> = HashMap::new();
        while matches!(&f_cur, Some(r) if r[0] <= l) {
            let r = f_cur.unwrap();
            if r[0] == l {
                map_f.insert(r[1], (r[2], r[3]));
            }
            f_cur = fr.next();
        }
        let mut map_g: HashMap<u64, (u64, u64)> = HashMap::new();
        while matches!(&g_cur, Some(r) if r[0] <= l) {
            let r = g_cur.unwrap();
            if r[0] == l {
                map_g.insert(r[1], (r[2], r[3]));
            }
            g_cur = gr.next();
        }

        if let Some(w) = buckets[l as usize].take() {
            let mut w = w;
            w.flush().unwrap();
        }
        let bp = format!("{}/areq_{}.bin", tmp, l);
        if !Path::new(&bp).exists() {
            continue;
        }
        let sorted_bp = format!("{}/areq_sorted.bin", tmp);
        external_sort(
            &bp,
            &sorted_bp,
            4,
            budget,
            |r| ((r[0] as u128) << 64) | (r[1] as u128),
            tmp,
        );
        let mut rr = RecReader::open(&sorted_bp, 4);
        let mut counter_l = 0u64;
        let mut cur = rr.next();
        while let Some(req) = cur.clone() {
            let (s, t) = (req[0], req[1]);
            let p = (l << 40) | (counter_l + 2);
            counter_l += 1;
            write_rec(&mut nodes_w, &[p, l]);
            let (s0, s1) = if var_ref(s, v) == l {
                map_f[&s]
            } else {
                (s, s)
            };
            let (t0, t1) = if var_ref(t, v) == l {
                map_g[&t]
            } else {
                (t, t)
            };
            emit_edge(
                s0,
                t0,
                p,
                0,
                op,
                v,
                sentinel,
                tmp,
                &mut buckets,
                &mut res_w,
                &mut product_root,
            );
            emit_edge(
                s1,
                t1,
                p,
                1,
                op,
                v,
                sentinel,
                tmp,
                &mut buckets,
                &mut res_w,
                &mut product_root,
            );
            while matches!(&cur, Some(r) if r[0] == s && r[1] == t) {
                let r = cur.unwrap();
                let parent = r[2];
                let edge = r[3];
                if parent == sentinel {
                    product_root = p;
                } else {
                    write_rec(&mut res_w, &[parent, edge, p]);
                }
                cur = rr.next();
            }
        }
        drop(rr);
        let _ = fs::remove_file(&sorted_bp);
        let _ = fs::remove_file(&bp);
    }
    nodes_w.flush().unwrap();
    res_w.flush().unwrap();

    let nodes_sorted = format!("{}/aprod_nodes_sorted.bin", tmp);
    external_sort(&nodes_path, &nodes_sorted, 2, budget, |r| r[0] as u128, tmp);
    let res_sorted = format!("{}/aprod_res_sorted.bin", tmp);
    external_sort(
        &res_path,
        &res_sorted,
        3,
        budget,
        |r| ((r[0] as u128) << 1) | (r[1] as u128),
        tmp,
    );

    let mut nr = RecReader::open(&nodes_sorted, 2);
    let mut er = RecReader::open(&res_sorted, 3);
    let mut w = BufWriter::new(File::create(out_path).unwrap());
    let mut e_cur = er.next();
    while let Some(node) = nr.next() {
        let id = node[0];
        let var = node[1];
        let mut lo = u64::MAX;
        let mut hi = u64::MAX;
        for _ in 0..2 {
            let e = e_cur.clone().expect("missing product edge");
            debug_assert_eq!(e[0], id);
            if e[1] == 0 {
                lo = e[2];
            } else {
                hi = e[2];
            }
            e_cur = er.next();
        }
        write_rec(&mut w, &[var, id, lo, hi]);
    }
    w.flush().unwrap();
    drop(nr);
    drop(er);
    for p in [nodes_path, res_path, nodes_sorted, res_sorted] {
        let _ = fs::remove_file(p);
    }
    product_root
}

fn complement_diagram(in_path: &str, out_path: &str) {
    let swap = |r: u64| {
        if r == 0 {
            1
        } else if r == 1 {
            0
        } else {
            r
        }
    };
    let mut rr = RecReader::open(in_path, 4);
    let mut w = BufWriter::new(File::create(out_path).unwrap());
    while let Some(r) = rr.next() {
        write_rec(&mut w, &[r[0], r[1], swap(r[2]), swap(r[3])]);
    }
    w.flush().unwrap();
}

fn basic_event_diagram(var: u64, out_path: &str) -> u64 {
    let id = (var << 40) | 2;
    let mut w = BufWriter::new(File::create(out_path).unwrap());
    write_rec(&mut w, &[var, id, 0, 1]);
    w.flush().unwrap();
    id
}

fn sort_diagram_asc(in_path: &str, out_path: &str, budget: usize, tmp: &str) {
    external_sort(in_path, out_path, 4, budget, |r| r[1] as u128, tmp);
}

struct Bctx<'a> {
    v: u64,
    budget: usize,
    node_limit: usize,
    tmp: &'a str,
}

enum Diag {
    Mem(Vec<[u64; 4]>, u64),
    Disk(String, u64),
}

impl Diag {
    fn root(&self) -> u64 {
        match self {
            Diag::Mem(_, r) => *r,
            Diag::Disk(_, r) => *r,
        }
    }
}

fn newpath(ctx: &Bctx, fid: &mut u64, tag: &str) -> String {
    let p = format!("{}/{}_{}.bin", ctx.tmp, tag, *fid);
    *fid += 1;
    p
}

fn empty_diag(ctx: &Bctx, fid: &mut u64) -> String {
    let p = newpath(ctx, fid, "e");
    File::create(&p).unwrap();
    p
}

fn copy_diag(ctx: &Bctx, fid: &mut u64, src: &str) -> String {
    let p = newpath(ctx, fid, "cp");
    let mut rr = RecReader::open(src, 4);
    let mut w = BufWriter::new(File::create(&p).unwrap());
    while let Some(r) = rr.next() {
        write_rec(&mut w, &r);
    }
    w.flush().unwrap();
    p
}

fn combine(
    ctx: &Bctx,
    fid: &mut u64,
    f_path: &str,
    f_root: u64,
    g_path: &str,
    g_root: u64,
    op: u8,
) -> (String, u64) {
    let prod = newpath(ctx, fid, "p");
    let fn_ = file_nodes(f_path);
    let gn = file_nodes(g_path);
    let t = Instant::now();
    let proot = ooc_apply(
        f_path, g_path, f_root, g_root, op, ctx.v, ctx.budget, &prod, ctx.tmp,
    );
    let apply_ns = t.elapsed().as_nanos();
    if proot < 2 {
        let _ = fs::remove_file(&prod);
        prof(|p| {
            p.ext_combines += 1;
            p.apply_ns += apply_ns;
        });
        return (empty_diag(ctx, fid), proot);
    }
    let prod_nodes = file_nodes(&prod);
    let red = newpath(ctx, fid, "r");
    let t2 = Instant::now();
    let (_, rroot) = ooc_reduce(&prod, proot, ctx.v as usize, ctx.budget, &red, ctx.tmp);
    let reduce_ns = t2.elapsed().as_nanos();
    let _ = fs::remove_file(&prod);
    let red_nodes = file_nodes(&red);
    let mut sort_ns = 0u128;
    let result = if rroot < 2 {
        let _ = fs::remove_file(&red);
        (empty_diag(ctx, fid), rroot)
    } else {
        let sorted = newpath(ctx, fid, "s");
        let t3 = Instant::now();
        sort_diagram_asc(&red, &sorted, ctx.budget, ctx.tmp);
        sort_ns = t3.elapsed().as_nanos();
        let _ = fs::remove_file(&red);
        (sorted, rroot)
    };
    let n = prof(|p| {
        p.ext_combines += 1;
        p.max_unreduced = p.max_unreduced.max(prod_nodes);
        p.max_reduced = p.max_reduced.max(red_nodes);
        p.sum_unreduced += prod_nodes;
        p.sum_reduced += red_nodes;
        p.apply_ns += apply_ns;
        p.reduce_ns += reduce_ns;
        p.sort_ns += sort_ns;
        p.ext_combines
    });
    let dgb = dir_bytes(ctx.tmp) as f64 / 1e9;
    if prod_nodes > 1_000_000 || n % 50 == 0 {
        eprintln!(
            "[combine#{}] f={} g={} prod={} reduced={} temp_live={:.2}GB  apply={:.2}s reduce={:.2}s sort={:.2}s",
            n,
            fn_,
            gn,
            prod_nodes,
            red_nodes,
            dgb,
            apply_ns as f64 / 1e9,
            reduce_ns as f64 / 1e9,
            sort_ns as f64 / 1e9
        );
    }
    result
}

#[allow(clippy::too_many_arguments)]
fn ite_ooc(
    ctx: &Bctx,
    fid: &mut u64,
    f_path: &str,
    f_root: u64,
    g_path: &str,
    g_root: u64,
    h_path: &str,
    h_root: u64,
) -> (String, u64) {
    if f_root == 1 {
        return (copy_diag(ctx, fid, g_path), g_root);
    }
    if f_root == 0 {
        return (copy_diag(ctx, fid, h_path), h_root);
    }
    let (a_path, a_root) = combine(ctx, fid, f_path, f_root, g_path, g_root, 0);
    let nf = newpath(ctx, fid, "nf");
    complement_diagram(f_path, &nf);
    let (b_path, b_root) = combine(ctx, fid, &nf, f_root, h_path, h_root, 0);
    let _ = fs::remove_file(&nf);
    let (r_path, r_root) = combine(ctx, fid, &a_path, a_root, &b_path, b_root, 1);
    let _ = fs::remove_file(&a_path);
    let _ = fs::remove_file(&b_path);
    (r_path, r_root)
}

fn atleast_ooc(
    ctx: &Bctx,
    fid: &mut u64,
    children: &[(String, u64)],
    start: usize,
    k: usize,
    memo: &mut HashMap<(usize, usize), (String, u64)>,
) -> (String, u64) {
    let n = children.len();
    if k == 0 {
        return (empty_diag(ctx, fid), 1);
    }
    if k > n - start {
        return (empty_diag(ctx, fid), 0);
    }
    if let Some((p, r)) = memo.get(&(start, k)) {
        return (copy_diag(ctx, fid, p), *r);
    }
    let (cp, cr) = children[start].clone();
    let (tp, tr) = atleast_ooc(ctx, fid, children, start + 1, k - 1, memo);
    let (ep, er) = atleast_ooc(ctx, fid, children, start + 1, k, memo);
    let (rp, rr) = ite_ooc(ctx, fid, &cp, cr, &tp, tr, &ep, er);
    let _ = fs::remove_file(&tp);
    let _ = fs::remove_file(&ep);
    memo.insert((start, k), (rp.clone(), rr));
    (copy_diag(ctx, fid, &rp), rr)
}

fn materialize(
    ctx: &Bctx,
    fid: &mut u64,
    memo: &HashMap<NodeIndex, (String, u64)>,
    op: NodeIndex,
    owned: &mut Vec<String>,
) -> (String, u64) {
    let (opath, oroot) = memo[&op.abs()].clone();
    if op < 0 {
        let cp = newpath(ctx, fid, "mc");
        complement_diagram(&opath, &cp);
        owned.push(cp.clone());
        (cp, oroot)
    } else {
        (opath, oroot)
    }
}

fn write_mem(ctx: &Bctx, fid: &mut u64, nodes: &[[u64; 4]]) -> String {
    let p = newpath(ctx, fid, "m");
    let mut w = BufWriter::new(File::create(&p).unwrap());
    for n in nodes {
        write_rec(&mut w, n);
    }
    w.flush().unwrap();
    p
}

fn load_mem(path: &str) -> Vec<[u64; 4]> {
    let mut out = Vec::new();
    let mut rr = RecReader::open(path, 4);
    while let Some(r) = rr.next() {
        out.push([r[0], r[1], r[2], r[3]]);
    }
    out
}

fn diag_to_disk(ctx: &Bctx, fid: &mut u64, d: &Diag) -> (String, u64, bool) {
    match d {
        Diag::Disk(p, r) => (p.clone(), *r, false),
        Diag::Mem(nodes, r) => (write_mem(ctx, fid, nodes), *r, true),
    }
}

fn clone_diag(ctx: &Bctx, fid: &mut u64, d: &Diag) -> Diag {
    match d {
        Diag::Mem(n, r) => Diag::Mem(n.clone(), *r),
        Diag::Disk(p, r) => {
            let out = newpath(ctx, fid, "cp");
            let mut rr = RecReader::open(p, 4);
            let mut w = BufWriter::new(File::create(&out).unwrap());
            while let Some(rec) = rr.next() {
                write_rec(&mut w, &rec);
            }
            w.flush().unwrap();
            Diag::Disk(out, *r)
        }
    }
}

fn drop_diag(d: Diag) {
    if let Diag::Disk(p, _) = d {
        let _ = fs::remove_file(p);
    }
}

fn complement_diag(ctx: &Bctx, fid: &mut u64, d: &Diag) -> Diag {
    let swap = |r: u64| {
        if r == 0 {
            1
        } else if r == 1 {
            0
        } else {
            r
        }
    };
    match d {
        Diag::Mem(nodes, r) => Diag::Mem(
            nodes
                .iter()
                .map(|n| [n[0], n[1], swap(n[2]), swap(n[3])])
                .collect(),
            *r,
        ),
        Diag::Disk(p, r) => {
            let out = newpath(ctx, fid, "nc");
            complement_diagram(p, &out);
            Diag::Disk(out, *r)
        }
    }
}

fn load_into_plain(plain: &mut Plain, nodes: &[[u64; 4]], root: u64) -> i64 {
    let mut map: HashMap<u64, i64> = HashMap::new();
    for n in nodes.iter().rev() {
        let (var, id, lo, hi) = (n[0] as u32, n[1], n[2], n[3]);
        let plo = if lo == 0 {
            F
        } else if lo == 1 {
            T
        } else {
            map[&lo]
        };
        let phi = if hi == 0 {
            F
        } else if hi == 1 {
            T
        } else {
            map[&hi]
        };
        let pid = plain.mk(var, plo, phi);
        map.insert(id, pid);
        if plain.over {
            return F;
        }
    }
    if root == 0 {
        F
    } else if root == 1 {
        T
    } else {
        map[&root]
    }
}

fn extract_diag(plain: &Plain, root: i64) -> (Vec<[u64; 4]>, u64) {
    fn assign(
        plain: &Plain,
        r: i64,
        newid: &mut HashMap<i64, u64>,
        per_var: &mut HashMap<u32, u64>,
        out: &mut Vec<[u64; 4]>,
    ) -> u64 {
        if r == T {
            return 1;
        }
        if r == F {
            return 0;
        }
        if let Some(&n) = newid.get(&r) {
            return n;
        }
        let a = r.unsigned_abs() as usize;
        let (var, lo, hi) = plain.nodes[a];
        let (clo, chi) = if r < 0 { (-lo, -hi) } else { (lo, hi) };
        let nl = assign(plain, clo, newid, per_var, out);
        let nh = assign(plain, chi, newid, per_var, out);
        let seq = per_var.entry(var).or_insert(0);
        let id = ((var as u64) << 40) | (*seq + 2);
        *seq += 1;
        out.push([var as u64, id, nl, nh]);
        newid.insert(r, id);
        id
    }
    if root == T {
        return (Vec::new(), 1);
    }
    if root == F {
        return (Vec::new(), 0);
    }
    let mut newid = HashMap::new();
    let mut per_var = HashMap::new();
    let mut out = Vec::new();
    let rr = assign(plain, root, &mut newid, &mut per_var, &mut out);
    out.sort_by_key(|e| e[1]);
    (out, rr)
}

fn in_mem_combine(
    ctx: &Bctx,
    f: &[[u64; 4]],
    f_root: u64,
    g: &[[u64; 4]],
    g_root: u64,
    op: u8,
) -> Option<(Vec<[u64; 4]>, u64)> {
    let mut plain = Plain::with_limit(ctx.node_limit);
    let fr = load_into_plain(&mut plain, f, f_root);
    if plain.over {
        return None;
    }
    let gr = load_into_plain(&mut plain, g, g_root);
    if plain.over {
        return None;
    }
    let r = if op == 0 {
        plain.and(fr, gr)
    } else {
        plain.or(fr, gr)
    };
    if plain.over {
        return None;
    }
    Some(extract_diag(&plain, r))
}

fn combine_diag(ctx: &Bctx, fid: &mut u64, f: &Diag, g: &Diag, op: u8) -> Diag {
    if let (Diag::Mem(fnodes, fr), Diag::Mem(gnodes, gr)) = (f, g) {
        if let Some((nodes, root)) = in_mem_combine(ctx, fnodes, *fr, gnodes, *gr, op) {
            prof(|p| p.inram_combines += 1);
            return Diag::Mem(nodes, root);
        }
    }
    let (fp, fr, fo) = diag_to_disk(ctx, fid, f);
    let (gp, gr, go) = diag_to_disk(ctx, fid, g);
    let (sp, srt) = combine(ctx, fid, &fp, fr, &gp, gr, op);
    if fo {
        let _ = fs::remove_file(&fp);
    }
    if go {
        let _ = fs::remove_file(&gp);
    }
    if srt < 2 {
        let _ = fs::remove_file(&sp);
        return Diag::Mem(Vec::new(), srt);
    }
    Diag::Disk(sp, srt)
}

fn fold_inmem(ctx: &Bctx, fid: &mut u64, operands: &[(&Diag, bool)], op: u8) -> Diag {
    let mut plain = Plain::with_limit(ctx.node_limit);
    let mut acc = if op == 0 { T } else { F };
    let mut i = 0;
    while i < operands.len() {
        let (d, signed) = operands[i];
        if let Diag::Mem(nodes, root) = d {
            let snap = acc;
            let r0 = load_into_plain(&mut plain, nodes, *root);
            if plain.over {
                acc = snap;
                break;
            }
            let r = if signed { plain.not(r0) } else { r0 };
            let nacc = if op == 0 {
                plain.and(acc, r)
            } else {
                plain.or(acc, r)
            };
            if plain.over {
                acc = snap;
                break;
            }
            acc = nacc;
            i += 1;
            if plain.footprint() > ctx.node_limit / 2 {
                plain.gc(acc);
            }
        } else {
            break;
        }
    }
    let (n, r) = extract_diag(&plain, acc);
    let inram_done = i;
    let live_now = (plain.nodes.len() - 2).saturating_sub(plain.free.len());
    let mut result = Diag::Mem(n, r);
    drop(plain);
    if i < operands.len() {
        prof(|p| p.fold_spills += 1);
        eprintln!(
            "[fold spill] op={} total_operands={} folded_in_ram={} acc_live_nodes={} acc_result_nodes={} remaining={}",
            op,
            operands.len(),
            inram_done,
            live_now,
            match &result { Diag::Mem(nn, _) => nn.len(), Diag::Disk(p, _) => file_nodes(p) as usize },
            operands.len() - i
        );
    }
    while i < operands.len() {
        let (d, signed) = operands[i];
        let comp: Option<Diag> = if signed {
            Some(complement_diag(ctx, fid, d))
        } else {
            None
        };
        let operand: &Diag = comp.as_ref().unwrap_or(d);
        let next = combine_diag(ctx, fid, &result, operand, op);
        drop_diag(result);
        if let Some(c) = comp {
            drop_diag(c);
        }
        result = next;
        i += 1;
    }
    result
}

fn ite_diag(ctx: &Bctx, fid: &mut u64, f: &Diag, g: &Diag, h: &Diag) -> Diag {
    match f.root() {
        1 => return clone_diag(ctx, fid, g),
        0 => return clone_diag(ctx, fid, h),
        _ => {}
    }
    let a = combine_diag(ctx, fid, f, g, 0);
    let nf = complement_diag(ctx, fid, f);
    let b = combine_diag(ctx, fid, &nf, h, 0);
    drop_diag(nf);
    let r = combine_diag(ctx, fid, &a, &b, 1);
    drop_diag(a);
    drop_diag(b);
    r
}

fn atleast_diag(
    ctx: &Bctx,
    fid: &mut u64,
    children: &[Diag],
    start: usize,
    k: usize,
    memo: &mut HashMap<(usize, usize), Diag>,
) -> Diag {
    let n = children.len();
    if k == 0 {
        return Diag::Mem(Vec::new(), 1);
    }
    if k > n - start {
        return Diag::Mem(Vec::new(), 0);
    }
    if let Some(d) = memo.get(&(start, k)) {
        return clone_diag(ctx, fid, d);
    }
    let t = atleast_diag(ctx, fid, children, start + 1, k - 1, memo);
    let e = atleast_diag(ctx, fid, children, start + 1, k, memo);
    let r = ite_diag(ctx, fid, &children[start], &t, &e);
    drop_diag(t);
    drop_diag(e);
    memo.insert((start, k), clone_diag(ctx, fid, &r));
    r
}

fn ooc_build_tree(
    pdag: &Pdag,
    var_of: &HashMap<NodeIndex, usize>,
    v: u64,
    budget: usize,
    node_limit: usize,
    tmp: &str,
) -> Diag {
    let ctx = Bctx {
        v,
        budget,
        node_limit,
        tmp,
    };
    let order = pdag.topological_sort().unwrap();
    let root_abs = pdag.root().unwrap().abs();
    let mut pending: HashMap<NodeIndex, usize> = HashMap::new();
    for n in pdag.nodes().values() {
        if let PdagNode::Gate { operands, .. } = n {
            for &op in operands {
                *pending.entry(op.abs()).or_insert(0) += 1;
            }
        }
    }
    let mut memo: HashMap<NodeIndex, Diag> = HashMap::new();
    let mut fid = 0u64;

    for &idx in &order {
        let a = idx.abs();
        let gt = Instant::now();
        let result: Diag = match pdag.get_node(a) {
            Some(PdagNode::BasicEvent { .. }) => {
                let var = var_of[&a] as u64;
                let id = (var << 40) | 2;
                Diag::Mem(vec![[var, id, 0, 1]], id)
            }
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => {
                let conn = *connective;
                let kmin = min_number.unwrap_or(1);
                let ops = operands.clone();
                match conn {
                    Connective::Not => {
                        if ops[0] < 0 {
                            clone_diag(&ctx, &mut fid, &memo[&ops[0].abs()])
                        } else {
                            complement_diag(&ctx, &mut fid, &memo[&ops[0].abs()])
                        }
                    }
                    Connective::Null => {
                        if ops[0] < 0 {
                            complement_diag(&ctx, &mut fid, &memo[&ops[0].abs()])
                        } else {
                            clone_diag(&ctx, &mut fid, &memo[&ops[0].abs()])
                        }
                    }
                    Connective::And | Connective::Or | Connective::Nand | Connective::Nor => {
                        let base = if matches!(conn, Connective::And | Connective::Nand) {
                            0u8
                        } else {
                            1u8
                        };
                        let operands: Vec<(&Diag, bool)> =
                            ops.iter().map(|&op| (&memo[&op.abs()], op < 0)).collect();
                        let mut acc = fold_inmem(&ctx, &mut fid, &operands, base);
                        drop(operands);
                        if matches!(conn, Connective::Nand | Connective::Nor) {
                            let c = complement_diag(&ctx, &mut fid, &acc);
                            drop_diag(acc);
                            acc = c;
                        }
                        acc
                    }
                    Connective::Xor => {
                        let mut acc = Diag::Mem(Vec::new(), 0);
                        for &op in &ops {
                            let comp: Option<Diag> = if op < 0 {
                                Some(complement_diag(&ctx, &mut fid, &memo[&op.abs()]))
                            } else {
                                None
                            };
                            let c: &Diag = comp.as_ref().unwrap_or(&memo[&op.abs()]);
                            let nc = complement_diag(&ctx, &mut fid, c);
                            let next = ite_diag(&ctx, &mut fid, &acc, &nc, c);
                            drop_diag(acc);
                            drop_diag(nc);
                            if let Some(cc) = comp {
                                drop_diag(cc);
                            }
                            acc = next;
                        }
                        acc
                    }
                    Connective::Iff => {
                        let mut allt = Diag::Mem(Vec::new(), 1);
                        let mut allf = Diag::Mem(Vec::new(), 1);
                        for &op in &ops {
                            let comp: Option<Diag> = if op < 0 {
                                Some(complement_diag(&ctx, &mut fid, &memo[&op.abs()]))
                            } else {
                                None
                            };
                            let c: &Diag = comp.as_ref().unwrap_or(&memo[&op.abs()]);
                            let nc = complement_diag(&ctx, &mut fid, c);
                            let nt = combine_diag(&ctx, &mut fid, &allt, c, 0);
                            let nfd = combine_diag(&ctx, &mut fid, &allf, &nc, 0);
                            drop_diag(allt);
                            drop_diag(allf);
                            drop_diag(nc);
                            if let Some(cc) = comp {
                                drop_diag(cc);
                            }
                            allt = nt;
                            allf = nfd;
                        }
                        let r = combine_diag(&ctx, &mut fid, &allt, &allf, 1);
                        drop_diag(allt);
                        drop_diag(allf);
                        r
                    }
                    Connective::AtLeast => {
                        let children: Vec<Diag> = ops
                            .iter()
                            .map(|&op| {
                                if op < 0 {
                                    complement_diag(&ctx, &mut fid, &memo[&op.abs()])
                                } else {
                                    clone_diag(&ctx, &mut fid, &memo[&op.abs()])
                                }
                            })
                            .collect();
                        let mut amemo: HashMap<(usize, usize), Diag> = HashMap::new();
                        let r = atleast_diag(&ctx, &mut fid, &children, 0, kmin, &mut amemo);
                        for (_, d) in amemo {
                            drop_diag(d);
                        }
                        for d in children {
                            drop_diag(d);
                        }
                        r
                    }
                }
            }
            _ => panic!("unsupported node in ooc build"),
        };
        let gms = gt.elapsed().as_millis();
        if gms > 50 || matches!(&result, Diag::Disk(..)) {
            let (conn, nops) = match pdag.get_node(a) {
                Some(PdagNode::Gate {
                    connective,
                    operands,
                    min_number,
                    ..
                }) => (
                    format!(
                        "{:?}{}",
                        connective,
                        min_number.map(|k| format!("(k={})", k)).unwrap_or_default()
                    ),
                    operands.len(),
                ),
                _ => ("?".to_string(), 0),
            };
            let rk = match &result {
                Diag::Mem(n, _) => format!("mem({})", n.len()),
                Diag::Disk(p, _) => format!("disk({})", file_nodes(p)),
            };
            eprintln!("[gate idx={} {} ops={}] -> {} {}ms", a, conn, nops, rk, gms);
        }
        memo.insert(a, result);

        if let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(a) {
            for &op in operands {
                let oa = op.abs();
                if let Some(p) = pending.get_mut(&oa) {
                    *p -= 1;
                    if *p == 0 && oa != root_abs {
                        if let Some(d) = memo.remove(&oa) {
                            drop_diag(d);
                        }
                    }
                }
            }
        }
    }
    memo.remove(&root_abs).unwrap()
}

fn resolve_budgets(arg_mb: usize) -> (usize, usize) {
    let total = if arg_mb > 0 {
        arg_mb * 1024 * 1024
    } else {
        let mut sys = System::new();
        sys.refresh_memory();
        sys.total_memory() as usize
    };
    let sort_records = ((total / 32) / 32).max(1);
    let inmem_bytes = total / 4;
    (sort_records, inmem_bytes)
}

fn run_build(file: &str, budget_mb: usize, tmp: &str) {
    let text = read_text(Path::new(file)).expect("read");
    let ft = parse_fault_tree(&text).expect("parse");
    let pdag = Pdag::from_fault_tree(&ft).expect("pdag");
    for n in pdag.nodes().values() {
        if let PdagNode::Constant { .. } = n {
            println!("OOC build probe does not handle constant nodes; {}", file);
            return;
        }
    }
    let order_method = std::env::var("PRAXIS_ORDER").unwrap_or_else(|_| "force".to_string());
    let var_of = match order_method.as_str() {
        "dfs" => compute_dfs_metadata_pdag(&pdag).expect("meta").var_of,
        "sloan" => sloan_fac_order(&pdag),
        _ => force_order(&pdag),
    };
    eprintln!("[order] method={}", order_method);
    let vp = pdag.level_var_probs(&ft, &var_of).expect("varprobs");
    let v = vp.len() as u64;

    let (budget, node_limit) = resolve_budgets(budget_mb);

    let rp = pdag.root().expect("root");
    let mut plain = Plain::with_limit(node_limit);
    let mut memo = HashMap::new();
    let mut root = build(&mut plain, &pdag, rp.abs(), &var_of, &mut memo);
    if rp < 0 {
        root = plain.not(root);
    }
    if pdag.complement() {
        root = plain.not(root);
    }
    let truth: Option<f64> = if plain.over {
        None
    } else {
        Some(plain_prob(&plain.nodes, root, &vp))
    };
    drop(memo);
    drop(plain);

    let stop = Arc::new(AtomicBool::new(false));
    let peak = Arc::new(AtomicU64::new(0));
    let stop_m = stop.clone();
    let peak_m = peak.clone();
    let mon = thread::spawn(move || {
        let mut tr = HostMemoryTracker::new_current_process();
        while !stop_m.load(Ordering::Relaxed) {
            if let Some(s) = tr.sample() {
                peak_m.fetch_max(s.rss_bytes, Ordering::Relaxed);
            }
            thread::sleep(Duration::from_millis(50));
        }
    });

    let result = ooc_build_tree(&pdag, &var_of, v, budget, node_limit, tmp);

    stop.store(true, Ordering::Relaxed);
    mon.join().ok();
    let peak_mib = peak.load(Ordering::Relaxed) as f64 / (1024.0 * 1024.0);
    prof_summary("final");

    let (map, froot) = match &result {
        Diag::Mem(nodes, r) => {
            let mut m = HashMap::new();
            for n in nodes {
                m.insert(n[1], (n[0] as u32, n[2], n[3]));
            }
            (m, *r)
        }
        Diag::Disk(p, r) => (load_reduced(p), *r),
    };
    let mut ooc = reduced_prob(&map, froot, &vp);
    let parity = (rp < 0) ^ pdag.complement();
    if parity {
        ooc = 1.0 - ooc;
    }

    println!(
        "file={}  vars={}  reduced_nodes={}  peak_RSS={:.0}MiB",
        file,
        v,
        map.len(),
        peak_mib
    );
    match truth {
        Some(t) => println!(
            "in_mem_prob={:.12e}  ooc_build_prob={:.12e}  match={}",
            t,
            ooc,
            if t.to_bits() == ooc.to_bits() {
                "BIT-EXACT"
            } else {
                "DIFF"
            }
        ),
        None => println!(
            "ooc_build_prob={:.12e}  (in-memory ground truth exceeded budget; out-of-core value reported)",
            ooc
        ),
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let file = args
        .first()
        .filter(|s| !s.starts_with("--"))
        .cloned()
        .or_else(|| args.get(1).cloned())
        .unwrap_or_else(|| "tests/fixtures/benchmarks/Aralia/baobab1.xml".to_string());
    let budget_mb: usize = args
        .iter()
        .skip(1)
        .find_map(|s| s.parse::<usize>().ok())
        .unwrap_or(0);
    let tmp = "C:/tmp/ooc";
    fs::create_dir_all(tmp).unwrap();
    run_build(&file, budget_mb, tmp);
}
