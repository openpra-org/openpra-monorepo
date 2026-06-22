use std::collections::HashMap;

use crate::algorithms::bdd_engine::{Bdd, BddRef};
use crate::algorithms::pdag::NodeIndex;
use crate::algorithms::zbdd_engine::{ZbddEngine, ZbddRef, ZBDD_BASE, ZBDD_EMPTY};

pub fn prime_zbdd(fbdd: &mut Bdd, root: BddRef) -> (ZbddEngine, ZbddRef) {
    let mut z = ZbddEngine::new();
    let mut memo: HashMap<i32, ZbddRef> = HashMap::new();
    let r = zrec(fbdd, root, &mut z, &mut memo);
    (z, r)
}

fn zrec(
    fbdd: &mut Bdd,
    f: BddRef,
    z: &mut ZbddEngine,
    memo: &mut HashMap<i32, ZbddRef>,
) -> ZbddRef {
    if f.is_false() {
        return ZBDD_EMPTY;
    }
    if f.is_true() {
        return ZBDD_BASE;
    }
    if let Some(&r) = memo.get(&f.raw()) {
        return r;
    }
    let reg = f.regular();
    let node = *fbdd.node(reg);
    let v = node.var;
    let (f1, f0) = if f.is_complement() {
        (node.high.complement(), node.low.complement())
    } else {
        (node.high, node.low)
    };
    let fc = fbdd.and(f0, f1);
    let pc = zrec(fbdd, fc, z, memo);
    let p1 = zrec(fbdd, f1, z, memo);
    let p0 = zrec(fbdd, f0, z, memo);
    let pos = z.difference(p1, pc);
    let neg = z.difference(p0, pc);
    let pos_lit = z.multiply(2 * v, pos);
    let neg_lit = z.multiply(2 * v + 1, neg);
    let signs = z.union(pos_lit, neg_lit);
    let result = z.union(signs, pc);
    memo.insert(f.raw(), result);
    result
}

fn count_rec(z: &ZbddEngine, f: ZbddRef, memo: &mut HashMap<ZbddRef, u128>) -> u128 {
    if f.is_empty() {
        return 0;
    }
    if f.is_base() {
        return 1;
    }
    if let Some(&c) = memo.get(&f) {
        return c;
    }
    let node = z.node(f);
    let r = count_rec(z, node.high, memo) + count_rec(z, node.low, memo);
    memo.insert(f, r);
    r
}

pub fn count(z: &ZbddEngine, root: ZbddRef) -> u128 {
    let mut memo = HashMap::new();
    count_rec(z, root, &mut memo)
}

pub fn cubes(z: &ZbddEngine, root: ZbddRef, var_event: &[NodeIndex]) -> Vec<Vec<i32>> {
    z.enumerate(root)
        .into_iter()
        .map(|set| {
            let mut cube: Vec<i32> = set
                .iter()
                .map(|&j| {
                    let v = j / 2;
                    if j % 2 == 0 {
                        var_event[v]
                    } else {
                        -var_event[v]
                    }
                })
                .collect();
            cube.sort_by_key(|x| x.abs());
            cube
        })
        .collect()
}

pub fn extract(
    z: &ZbddEngine,
    root: ZbddRef,
    var_event: &[NodeIndex],
    var_prob: &[f64],
    max_order: usize,
    min_prob: f64,
) -> Vec<(Vec<i32>, f64)> {
    let mut out = Vec::new();
    let mut cur = Vec::new();
    extract_rec(z, root, var_event, var_prob, max_order, min_prob, 1.0, &mut cur, &mut out);
    for (c, _) in out.iter_mut() {
        c.sort_by_key(|x| x.abs());
    }
    out
}

#[allow(clippy::too_many_arguments)]
fn extract_rec(
    z: &ZbddEngine,
    f: ZbddRef,
    var_event: &[NodeIndex],
    var_prob: &[f64],
    max_order: usize,
    min_prob: f64,
    prob: f64,
    cur: &mut Vec<i32>,
    out: &mut Vec<(Vec<i32>, f64)>,
) {
    if prob < min_prob || f.is_empty() {
        return;
    }
    if f.is_base() {
        out.push((cur.clone(), prob));
        return;
    }
    let node = *z.node(f);
    let v = node.var / 2;
    let (lit, p) = if node.var % 2 == 0 {
        (var_event[v], var_prob[v])
    } else {
        (-var_event[v], 1.0 - var_prob[v])
    };
    if cur.len() < max_order {
        cur.push(lit);
        extract_rec(z, node.high, var_event, var_prob, max_order, min_prob, prob * p, cur, out);
        cur.pop();
    }
    extract_rec(z, node.low, var_event, var_prob, max_order, min_prob, prob, cur, out);
}
