use std::collections::{HashMap, HashSet, VecDeque};

use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::core::fault_tree::FaultTree;
use crate::Result;

#[derive(Debug, Clone)]
pub struct SignedCutSet {
    pub literals: Vec<NodeIndex>,
}

impl SignedCutSet {
    pub fn order(&self) -> usize {
        self.literals.len()
    }
}

enum Expansion {
    Conjunction(Vec<NodeIndex>),
    Disjunction(Vec<NodeIndex>),
    AtLeast(usize, Vec<NodeIndex>),
    Unsupported,
}

pub struct NonCoherentMocus {
    pdag: Pdag,
    prob: HashMap<NodeIndex, f64>,
    max_order: Option<usize>,
    cut_off: Option<f64>,
    bound: HashMap<NodeIndex, f64>,
    cut_sets: Vec<Vec<NodeIndex>>,
}

/// Expand XOR and IFF gates into AND/OR/complement structure in place, so the
/// consensus cut-set engine (which has no XOR/IFF expansion of its own) sees a
/// graph built only from connectives it handles natively. Every other connective
/// (AND, OR, NAND, NOR, NOT, NULL, ATLEAST) is consumed directly by
/// `gate_expansion`, so only XOR and IFF are rewritten here. Function-preserving.
fn normalize_xor_iff(pdag: &mut Pdag) -> Result<()> {
    let mut synth: usize = 0;
    let targets: Vec<NodeIndex> = pdag
        .nodes()
        .iter()
        .filter_map(|(&idx, node)| match node {
            PdagNode::Gate {
                connective: Connective::Xor,
                ..
            }
            | PdagNode::Gate {
                connective: Connective::Iff,
                ..
            } => Some(idx),
            _ => None,
        })
        .collect();

    for index in targets {
        let (conn, operands) = match pdag.get_node(index) {
            Some(PdagNode::Gate {
                connective,
                operands,
                ..
            }) => (*connective, operands.clone()),
            _ => continue,
        };
        match conn {
            Connective::Xor => normalize_xor_gate(pdag, index, &operands, &mut synth)?,
            Connective::Iff => normalize_iff_gate(pdag, index, &operands, &mut synth)?,
            _ => {}
        }
    }
    Ok(())
}

fn new_synth_gate(
    pdag: &mut Pdag,
    synth: &mut usize,
    connective: Connective,
    operands: Vec<NodeIndex>,
) -> Result<NodeIndex> {
    *synth += 1;
    let id = format!("_ncpp{}", *synth);
    pdag.add_gate(id, connective, operands, None)
}

fn build_xor(pdag: &mut Pdag, synth: &mut usize, operands: &[NodeIndex]) -> Result<NodeIndex> {
    if operands.len() == 1 {
        return Ok(operands[0]);
    }
    let a = operands[0];
    let rest = build_xor(pdag, synth, &operands[1..])?;
    let and1 = new_synth_gate(pdag, synth, Connective::And, vec![a, -rest])?;
    let and2 = new_synth_gate(pdag, synth, Connective::And, vec![-a, rest])?;
    new_synth_gate(pdag, synth, Connective::Or, vec![and1, and2])
}

fn normalize_xor_gate(
    pdag: &mut Pdag,
    index: NodeIndex,
    operands: &[NodeIndex],
    synth: &mut usize,
) -> Result<()> {
    if operands.is_empty() {
        return Ok(());
    }
    if operands.len() == 1 {
        pdag.update_gate_connective(index, Connective::Null)?;
        return Ok(());
    }
    let a = operands[0];
    let rest = build_xor(pdag, synth, &operands[1..])?;
    let and1 = new_synth_gate(pdag, synth, Connective::And, vec![a, -rest])?;
    let and2 = new_synth_gate(pdag, synth, Connective::And, vec![-a, rest])?;
    pdag.update_gate_connective(index, Connective::Or)?;
    pdag.update_gate_operands(index, vec![and1, and2])?;
    Ok(())
}

fn normalize_iff_gate(
    pdag: &mut Pdag,
    index: NodeIndex,
    operands: &[NodeIndex],
    synth: &mut usize,
) -> Result<()> {
    if operands.is_empty() {
        return Ok(());
    }
    if operands.len() == 1 {
        let a = operands[0];
        pdag.update_gate_connective(index, Connective::Or)?;
        pdag.update_gate_operands(index, vec![a, -a])?;
        return Ok(());
    }
    let pos = operands.to_vec();
    let neg: Vec<NodeIndex> = operands.iter().map(|&o| -o).collect();
    let all_pos = new_synth_gate(pdag, synth, Connective::And, pos)?;
    let all_neg = new_synth_gate(pdag, synth, Connective::And, neg)?;
    pdag.update_gate_connective(index, Connective::Or)?;
    pdag.update_gate_operands(index, vec![all_pos, all_neg])?;
    Ok(())
}

fn flip(ops: &[NodeIndex]) -> Vec<NodeIndex> {
    ops.iter().map(|&o| -o).collect()
}

fn gate_expansion(conn: Connective, neg: bool, ops: &[NodeIndex], min: Option<usize>) -> Expansion {
    match conn {
        Connective::And => {
            if neg {
                Expansion::Disjunction(flip(ops))
            } else {
                Expansion::Conjunction(ops.to_vec())
            }
        }
        Connective::Or => {
            if neg {
                Expansion::Conjunction(flip(ops))
            } else {
                Expansion::Disjunction(ops.to_vec())
            }
        }
        Connective::Nand => {
            if neg {
                Expansion::Conjunction(ops.to_vec())
            } else {
                Expansion::Disjunction(flip(ops))
            }
        }
        Connective::Nor => {
            if neg {
                Expansion::Disjunction(ops.to_vec())
            } else {
                Expansion::Conjunction(flip(ops))
            }
        }
        Connective::Not => {
            let op = ops.first().copied().unwrap_or(0);
            let lit = if neg { op } else { -op };
            Expansion::Conjunction(vec![lit])
        }
        Connective::Null => {
            let op = ops.first().copied().unwrap_or(0);
            let lit = if neg { -op } else { op };
            Expansion::Conjunction(vec![lit])
        }
        Connective::AtLeast => {
            let k = min.unwrap_or(1);
            if neg {
                let n = ops.len();
                let nk = n.saturating_sub(k).saturating_add(1);
                Expansion::AtLeast(nk, flip(ops))
            } else {
                Expansion::AtLeast(k, ops.to_vec())
            }
        }
        Connective::Xor | Connective::Iff => Expansion::Unsupported,
    }
}

fn consensus(a: &[NodeIndex], b: &[NodeIndex]) -> Option<Vec<NodeIndex>> {
    let set_a: HashSet<NodeIndex> = a.iter().copied().collect();
    let mut pivot: Option<NodeIndex> = None;
    for &lit in b {
        if set_a.contains(&(-lit)) {
            if pivot.is_some() {
                return None;
            }
            pivot = Some(lit.abs());
        }
    }
    let v = pivot?;
    let mut out: Vec<NodeIndex> = a
        .iter()
        .chain(b.iter())
        .copied()
        .filter(|&l| l.abs() != v)
        .collect();
    out.sort();
    out.dedup();
    let mut seen: HashSet<NodeIndex> = HashSet::new();
    for &l in &out {
        if seen.contains(&(-l)) {
            return None;
        }
        seen.insert(l);
    }
    Some(out)
}

fn combinations(items: &[NodeIndex], k: usize) -> Vec<Vec<NodeIndex>> {
    let mut out = Vec::new();
    let mut current = Vec::new();
    fn rec(items: &[NodeIndex], start: usize, k: usize, current: &mut Vec<NodeIndex>, out: &mut Vec<Vec<NodeIndex>>) {
        if current.len() == k {
            out.push(current.clone());
            return;
        }
        for i in start..items.len() {
            current.push(items[i]);
            rec(items, i + 1, k, current, out);
            current.pop();
        }
    }
    rec(items, 0, k, &mut current, &mut out);
    out
}

impl NonCoherentMocus {
    pub fn new(pdag: &Pdag, fault_tree: &FaultTree) -> Result<Self> {
        let mut owned = pdag.clone();
        normalize_xor_iff(&mut owned)?;
        let mut prob = HashMap::new();
        for (&idx, node) in owned.nodes() {
            if let PdagNode::BasicEvent { id, .. } = node {
                let p = fault_tree
                    .get_basic_event(id)
                    .map(|b| b.probability())
                    .unwrap_or(0.0);
                prob.insert(idx, p);
            }
        }
        Ok(Self {
            pdag: owned,
            prob,
            max_order: None,
            cut_off: None,
            bound: HashMap::new(),
            cut_sets: Vec::new(),
        })
    }

    pub fn with_max_order(mut self, max_order: usize) -> Self {
        self.max_order = Some(max_order);
        self
    }

    pub fn with_cut_off(mut self, cut_off: f64) -> Self {
        self.cut_off = Some(cut_off);
        self
    }

    fn is_gate(&self, r: NodeIndex) -> bool {
        matches!(self.pdag.get_node(r.abs()), Some(PdagNode::Gate { .. }))
    }

    fn is_basic(&self, r: NodeIndex) -> bool {
        matches!(self.pdag.get_node(r.abs()), Some(PdagNode::BasicEvent { .. }))
    }

    fn literal_count(&self, set: &[NodeIndex]) -> usize {
        set.iter().filter(|&&r| self.is_basic(r)).count()
    }

    fn canonicalize(&self, set: &[NodeIndex]) -> Option<Vec<NodeIndex>> {
        let mut out: Vec<NodeIndex> = Vec::with_capacity(set.len());
        for &r in set {
            match self.pdag.get_node(r.abs()) {
                Some(PdagNode::Constant { value, .. }) => {
                    let v = if r < 0 { !value } else { *value };
                    if v {
                        continue;
                    } else {
                        return None;
                    }
                }
                _ => out.push(r),
            }
        }
        out.sort();
        out.dedup();
        let mut seen: HashSet<NodeIndex> = HashSet::new();
        for &r in &out {
            if seen.contains(&(-r)) {
                return None;
            }
            seen.insert(r);
        }
        Some(out)
    }

    fn expand(&self, set: &[NodeIndex]) -> Option<Vec<Vec<NodeIndex>>> {
        let pos = set.iter().position(|&r| self.is_gate(r))?;
        let g = set[pos];
        let rest: Vec<NodeIndex> = set
            .iter()
            .enumerate()
            .filter(|(i, _)| *i != pos)
            .map(|(_, &r)| r)
            .collect();
        let (conn, ops, min) = match self.pdag.get_node(g.abs()) {
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => (*connective, operands.clone(), *min_number),
            _ => return Some(Vec::new()),
        };
        match gate_expansion(conn, g < 0, &ops, min) {
            Expansion::Conjunction(add) => {
                let mut child = rest;
                child.extend(add);
                Some(vec![child])
            }
            Expansion::Disjunction(refs) => {
                let children = refs
                    .into_iter()
                    .map(|r| {
                        let mut child = rest.clone();
                        child.push(r);
                        child
                    })
                    .collect();
                Some(children)
            }
            Expansion::AtLeast(k, refs) => {
                if k == 0 {
                    return Some(vec![rest]);
                }
                if k > refs.len() {
                    return Some(Vec::new());
                }
                let children = combinations(&refs, k)
                    .into_iter()
                    .map(|combo| {
                        let mut child = rest.clone();
                        child.extend(combo);
                        child
                    })
                    .collect();
                Some(children)
            }
            Expansion::Unsupported => None,
        }
    }

    fn node_bound(&mut self, r: NodeIndex) -> f64 {
        if let Some(&v) = self.bound.get(&r) {
            return v;
        }
        let value = match self.pdag.get_node(r.abs()).cloned() {
            Some(PdagNode::BasicEvent { .. }) => {
                let p = self.prob.get(&r.abs()).copied().unwrap_or(0.0);
                if r < 0 {
                    1.0 - p
                } else {
                    p
                }
            }
            Some(PdagNode::Constant { value, .. }) => {
                let v = if r < 0 { !value } else { value };
                if v {
                    1.0
                } else {
                    0.0
                }
            }
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => match gate_expansion(connective, r < 0, &operands, min_number) {
                Expansion::Conjunction(add) => {
                    add.iter().map(|&o| self.node_bound(o)).product()
                }
                Expansion::Disjunction(refs) => {
                    let complement: f64 = refs.iter().map(|&o| 1.0 - self.node_bound(o)).product();
                    1.0 - complement
                }
                Expansion::AtLeast(k, refs) => {
                    let mut bounds: Vec<f64> = refs.iter().map(|&o| self.node_bound(o)).collect();
                    bounds.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
                    bounds.iter().take(k).product()
                }
                Expansion::Unsupported => 1.0,
            },
            None => 1.0,
        };
        self.bound.insert(r, value);
        value
    }

    fn set_bound(&mut self, set: &[NodeIndex]) -> f64 {
        let mut product = 1.0;
        for &r in set {
            product *= self.node_bound(r);
        }
        product
    }

    fn is_subset(a: &[NodeIndex], b: &[NodeIndex]) -> bool {
        let mut i = 0;
        for &x in a {
            while i < b.len() && b[i] < x {
                i += 1;
            }
            if i >= b.len() || b[i] != x {
                return false;
            }
        }
        true
    }

    fn try_add(&mut self, candidate: Vec<NodeIndex>) {
        if self.cut_sets.iter().any(|known| Self::is_subset(known, &candidate)) {
            return;
        }
        self.cut_sets.retain(|known| !Self::is_subset(&candidate, known));
        self.cut_sets.push(candidate);
    }

    pub fn analyze(&mut self) -> Vec<SignedCutSet> {
        self.cut_sets.clear();
        let Some(root) = self.pdag.root() else {
            return Vec::new();
        };
        let eff_root = if self.pdag.complement() { -root } else { root };

        let mut queue: VecDeque<Vec<NodeIndex>> = VecDeque::new();
        let mut seen: HashSet<Vec<NodeIndex>> = HashSet::new();
        if let Some(start) = self.canonicalize(&[eff_root]) {
            seen.insert(start.clone());
            queue.push_back(start);
        }

        while let Some(set) = queue.pop_front() {
            let Some(set) = self.canonicalize(&set) else {
                continue;
            };
            if let Some(max) = self.max_order {
                if self.literal_count(&set) > max {
                    continue;
                }
            }
            if self.cut_sets.iter().any(|known| Self::is_subset(known, &set)) {
                continue;
            }
            if let Some(cut_off) = self.cut_off {
                if self.set_bound(&set) < cut_off {
                    continue;
                }
            }
            if set.iter().all(|&r| self.is_basic(r)) {
                self.try_add(set);
                continue;
            }
            if let Some(children) = self.expand(&set) {
                for child in children {
                    if let Some(child) = self.canonicalize(&child) {
                        if seen.insert(child.clone()) {
                            queue.push_back(child);
                        }
                    }
                }
            }
        }

        self.cut_sets
            .iter()
            .map(|c| SignedCutSet { literals: c.clone() })
            .collect()
    }

    pub fn cut_set_probability(&self, cut_set: &SignedCutSet) -> f64 {
        let mut product = 1.0;
        for &r in &cut_set.literals {
            let p = self.prob.get(&r.abs()).copied().unwrap_or(0.0);
            product *= if r < 0 { 1.0 - p } else { p };
        }
        product
    }

    fn cube_within_limits(&self, cube: &[NodeIndex]) -> bool {
        if let Some(max) = self.max_order {
            if cube.len() > max {
                return false;
            }
        }
        if let Some(cut_off) = self.cut_off {
            let mut p = 1.0;
            for &r in cube {
                let pe = self.prob.get(&r.abs()).copied().unwrap_or(0.0);
                p *= if r < 0 { 1.0 - pe } else { pe };
            }
            if p < cut_off {
                return false;
            }
        }
        true
    }

    fn add_prime(
        primes: &mut Vec<Vec<NodeIndex>>,
        queue: &mut VecDeque<Vec<NodeIndex>>,
        cube: Vec<NodeIndex>,
    ) {
        if primes.iter().any(|p| Self::is_subset(p, &cube)) {
            return;
        }
        primes.retain(|p| !Self::is_subset(&cube, p));
        primes.push(cube.clone());
        queue.push_back(cube);
    }

    fn consensus_complete(&self, initial: Vec<Vec<NodeIndex>>) -> Vec<Vec<NodeIndex>> {
        let mut primes: Vec<Vec<NodeIndex>> = Vec::new();
        let mut queue: VecDeque<Vec<NodeIndex>> = VecDeque::new();
        for cube in initial {
            Self::add_prime(&mut primes, &mut queue, cube);
        }
        while let Some(c) = queue.pop_front() {
            let mut produced: Vec<Vec<NodeIndex>> = Vec::new();
            for other in primes.iter() {
                if let Some(cons) = consensus(&c, other) {
                    if self.cube_within_limits(&cons) {
                        produced.push(cons);
                    }
                }
            }
            for cube in produced {
                Self::add_prime(&mut primes, &mut queue, cube);
            }
        }
        primes
    }

    pub fn analyze_primes(&mut self) -> Vec<SignedCutSet> {
        let saved_order = self.max_order.take();
        let saved_cut_off = self.cut_off.take();
        let cover = self.analyze();
        let cubes: Vec<Vec<NodeIndex>> = cover.into_iter().map(|c| c.literals).collect();
        let primes = self.consensus_complete(cubes);
        self.max_order = saved_order;
        self.cut_off = saved_cut_off;
        primes
            .into_iter()
            .filter(|cube| self.cube_within_limits(cube))
            .map(|literals| SignedCutSet { literals })
            .collect()
    }

    pub fn literal_name(&self, lit: NodeIndex) -> String {
        let id = self
            .pdag
            .get_node(lit.abs())
            .and_then(|n| n.id())
            .unwrap_or("?")
            .to_string();
        if lit < 0 {
            format!("~{}", id)
        } else {
            id
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::event::BasicEvent;

    fn eval(pdag: &Pdag, idx: NodeIndex, assign: &HashMap<NodeIndex, bool>) -> bool {
        let node = pdag.get_node(idx.abs()).unwrap();
        let v = match node {
            PdagNode::BasicEvent { index, .. } => *assign.get(index).unwrap_or(&false),
            PdagNode::Constant { value, .. } => *value,
            PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            } => {
                let vals: Vec<bool> = operands.iter().map(|&o| eval(pdag, o, assign)).collect();
                match connective {
                    Connective::And => vals.iter().all(|&x| x),
                    Connective::Or => vals.iter().any(|&x| x),
                    Connective::Not => !vals[0],
                    Connective::Nand => !vals.iter().all(|&x| x),
                    Connective::Nor => !vals.iter().any(|&x| x),
                    Connective::Xor => vals.iter().fold(false, |a, &b| a ^ b),
                    Connective::Iff => vals.iter().all(|&x| x == vals[0]),
                    Connective::AtLeast => {
                        vals.iter().filter(|&&x| x).count() >= min_number.unwrap_or(1)
                    }
                    Connective::Null => vals[0],
                }
            }
        };
        if idx < 0 {
            !v
        } else {
            v
        }
    }

    fn ft_with(events: &[(&str, f64)]) -> FaultTree {
        let mut ft = FaultTree::new("FT".to_string(), "top".to_string()).unwrap();
        for (e, p) in events {
            ft.add_basic_event(BasicEvent::new(e.to_string(), *p).unwrap())
                .unwrap();
        }
        ft
    }

    fn satisfied(cs: &SignedCutSet, assign: &HashMap<NodeIndex, bool>) -> bool {
        cs.literals.iter().all(|&lit| {
            let v = *assign.get(&lit.abs()).unwrap_or(&false);
            if lit < 0 {
                !v
            } else {
                v
            }
        })
    }

    fn check_cover(pdag: &Pdag, ft: &FaultTree, events: &[NodeIndex]) -> Vec<SignedCutSet> {
        let cuts = NonCoherentMocus::new(pdag, ft).unwrap().analyze();
        for cs in &cuts {
            let mut seen: HashSet<NodeIndex> = HashSet::new();
            for &l in &cs.literals {
                assert!(!seen.contains(&(-l)), "mutual exclusivity violated: {:?}", cs.literals);
                seen.insert(l);
            }
        }
        let n = events.len();
        let root = pdag.root().unwrap();
        let eff = if pdag.complement() { -root } else { root };
        for mask in 0u32..(1u32 << n) {
            let mut assign = HashMap::new();
            for (i, &e) in events.iter().enumerate() {
                assign.insert(e, (mask >> i) & 1 == 1);
            }
            let f = eval(pdag, eff, &assign);
            let covered = cuts.iter().any(|cs| satisfied(cs, &assign));
            assert_eq!(f, covered, "cover mismatch at assignment mask {}", mask);
        }
        cuts
    }

    #[test]
    fn consensus_cover_is_correct_and_contradiction_free() {
        let mut p = Pdag::new();
        let a = p.add_basic_event("a".to_string());
        let b = p.add_basic_event("b".to_string());
        let c = p.add_basic_event("c".to_string());
        let g1 = p.add_gate("g1".to_string(), Connective::And, vec![a, b], None).unwrap();
        let g2 = p.add_gate("g2".to_string(), Connective::And, vec![-a, c], None).unwrap();
        let top = p.add_gate("top".to_string(), Connective::Or, vec![g1, g2], None).unwrap();
        p.set_root(top).unwrap();
        let ft = ft_with(&[("a", 0.1), ("b", 0.2), ("c", 0.3)]);
        let cuts = check_cover(&p, &ft, &[a, b, c]);
        assert!(!cuts.is_empty());
    }

    #[test]
    fn contradiction_branch_is_dropped() {
        let mut p = Pdag::new();
        let a = p.add_basic_event("a".to_string());
        let b = p.add_basic_event("b".to_string());
        let g1 = p.add_gate("g1".to_string(), Connective::And, vec![a, -a], None).unwrap();
        let top = p.add_gate("top".to_string(), Connective::Or, vec![g1, b], None).unwrap();
        p.set_root(top).unwrap();
        let ft = ft_with(&[("a", 0.1), ("b", 0.2)]);
        let cuts = check_cover(&p, &ft, &[a, b]);
        assert_eq!(cuts.len(), 1);
        assert_eq!(cuts[0].literals, vec![b]);
    }

    #[test]
    fn success_branch_cover() {
        let mut p = Pdag::new();
        let a = p.add_basic_event("a".to_string());
        let b = p.add_basic_event("b".to_string());
        let c = p.add_basic_event("c".to_string());
        let g1 = p.add_gate("g1".to_string(), Connective::And, vec![a, b], None).unwrap();
        let inner = p.add_gate("inner".to_string(), Connective::Or, vec![g1, c], None).unwrap();
        let top = p.add_gate("top".to_string(), Connective::Not, vec![inner], None).unwrap();
        p.set_root(top).unwrap();
        let ft = ft_with(&[("a", 0.1), ("b", 0.2), ("c", 0.3)]);
        check_cover(&p, &ft, &[a, b, c]);
    }

    #[test]
    fn consensus_completion_finds_the_consensus_prime() {
        let mut p = Pdag::new();
        let a = p.add_basic_event("a".to_string());
        let b = p.add_basic_event("b".to_string());
        let c = p.add_basic_event("c".to_string());
        let g1 = p.add_gate("g1".to_string(), Connective::And, vec![a, b], None).unwrap();
        let g2 = p.add_gate("g2".to_string(), Connective::And, vec![-a, c], None).unwrap();
        let top = p.add_gate("top".to_string(), Connective::Or, vec![g1, g2], None).unwrap();
        p.set_root(top).unwrap();
        let ft = ft_with(&[("a", 0.1), ("b", 0.2), ("c", 0.3)]);

        let cover = NonCoherentMocus::new(&p, &ft).unwrap().analyze();
        assert_eq!(cover.len(), 2, "structural cover misses the consensus");

        let primes = NonCoherentMocus::new(&p, &ft).unwrap().analyze_primes();
        let as_sets: Vec<Vec<NodeIndex>> = primes
            .iter()
            .map(|c| {
                let mut v = c.literals.clone();
                v.sort();
                v
            })
            .collect();
        assert_eq!(primes.len(), 3, "consensus completion must yield 3 prime implicants");
        let mut bc = vec![b, c];
        bc.sort();
        assert!(as_sets.contains(&bc), "consensus prime b&c must be present");
    }

    #[test]
    fn order_limit_keeps_in_limit_prime_from_higher_order_parents() {
        let mut p = Pdag::new();
        let a = p.add_basic_event("a".to_string());
        let b = p.add_basic_event("b".to_string());
        let c = p.add_basic_event("c".to_string());
        let d = p.add_basic_event("d".to_string());
        let g1 = p
            .add_gate("g1".to_string(), Connective::And, vec![a, b, c, d], None)
            .unwrap();
        let g2 = p
            .add_gate("g2".to_string(), Connective::And, vec![-a, b, c, d], None)
            .unwrap();
        let top = p
            .add_gate("top".to_string(), Connective::Or, vec![g1, g2], None)
            .unwrap();
        p.set_root(top).unwrap();
        let ft = ft_with(&[("a", 0.1), ("b", 0.2), ("c", 0.3), ("d", 0.4)]);

        let mut bcd = vec![b, c, d];
        bcd.sort();

        let full = NonCoherentMocus::new(&p, &ft).unwrap().analyze_primes();
        assert_eq!(full.len(), 1, "unbounded primes must be exactly {{b,c,d}}");
        let mut got = full[0].literals.clone();
        got.sort();
        assert_eq!(got, bcd);

        let limited = NonCoherentMocus::new(&p, &ft).unwrap()
            .with_max_order(3)
            .analyze_primes();
        assert_eq!(
            limited.len(),
            1,
            "order-3 limit dropped the in-limit prime b&c&d (parents are order 4)"
        );
        let mut got2 = limited[0].literals.clone();
        got2.sort();
        assert_eq!(got2, bcd);
    }

    #[test]
    fn stress_full_prime_implicants_match_qm_oracle() {
        let names = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
        let n = names.len();
        let mut p = Pdag::new();
        let ev: Vec<NodeIndex> = names.iter().map(|nm| p.add_basic_event(nm.to_string())).collect();
        let (a, b, c, d, e, f, g, h, i, j, k, l) = (
            ev[0], ev[1], ev[2], ev[3], ev[4], ev[5], ev[6], ev[7], ev[8], ev[9], ev[10], ev[11],
        );
        let g1 = p.add_gate("g1".into(), Connective::And, vec![a, b], None).unwrap();
        let g2 = p.add_gate("g2".into(), Connective::And, vec![-a, c], None).unwrap();
        let g3 = p.add_gate("g3".into(), Connective::And, vec![-c, d], None).unwrap();
        let g4 = p.add_gate("g4".into(), Connective::And, vec![-d, e], None).unwrap();
        let g5 = p.add_gate("g5".into(), Connective::And, vec![-e, f], None).unwrap();
        let g6 = p.add_gate("g6".into(), Connective::Xor, vec![g, h, i], None).unwrap();
        let g7 = p.add_gate("g7".into(), Connective::Iff, vec![j, k], None).unwrap();
        let g8 = p.add_gate("g8".into(), Connective::AtLeast, vec![a, f, l], Some(2)).unwrap();
        let g9 = p.add_gate("g9".into(), Connective::And, vec![c, -c, g], None).unwrap();
        let g10 = p.add_gate("g10".into(), Connective::And, vec![a, b, g, j], None).unwrap();
        let top = p
            .add_gate(
                "top".into(),
                Connective::Or,
                vec![g1, g2, g3, g4, g5, g6, g7, g8, g9, g10],
                None,
            )
            .unwrap();
        p.set_root(top).unwrap();

        let mut onset: Vec<u32> = Vec::new();
        for m in 0u32..(1u32 << n) {
            let mut assign: HashMap<NodeIndex, bool> = HashMap::new();
            for (idx, &x) in ev.iter().enumerate() {
                assign.insert(x, (m >> idx) & 1 == 1);
            }
            if eval(&p, top, &assign) {
                onset.push(m);
            }
        }
        let full: u32 = (1u32 << n) - 1;
        let mut current: HashSet<(u32, u32)> = onset.iter().map(|&m| (full, m)).collect();
        let mut prime_cubes: HashSet<(u32, u32)> = HashSet::new();
        while !current.is_empty() {
            let cubes: Vec<(u32, u32)> = current.iter().copied().collect();
            let mut used = vec![false; cubes.len()];
            let mut next: HashSet<(u32, u32)> = HashSet::new();
            for x in 0..cubes.len() {
                for y in (x + 1)..cubes.len() {
                    let (mi, vi) = cubes[x];
                    let (mj, vj) = cubes[y];
                    if mi != mj {
                        continue;
                    }
                    let diff = (vi ^ vj) & mi;
                    if diff != 0 && diff & diff.wrapping_sub(1) == 0 {
                        let nm = mi & !diff;
                        next.insert((nm, vi & nm));
                        used[x] = true;
                        used[y] = true;
                    }
                }
            }
            for (idx, cb) in cubes.iter().enumerate() {
                if !used[idx] {
                    prime_cubes.insert(*cb);
                }
            }
            current = next;
        }
        let mut oracle: Vec<String> = prime_cubes
            .iter()
            .map(|&(mask, val)| {
                let mut lits: Vec<String> = Vec::new();
                for idx in 0..n {
                    if (mask >> idx) & 1 == 1 {
                        lits.push(if (val >> idx) & 1 == 1 {
                            names[idx].to_string()
                        } else {
                            format!("~{}", names[idx])
                        });
                    }
                }
                lits.join("&")
            })
            .collect();
        oracle.sort();

        let mut ft = FaultTree::new("FT".to_string(), "top".to_string()).unwrap();
        for nm in &names {
            ft.add_basic_event(BasicEvent::new(nm.to_string(), 0.5).unwrap()).unwrap();
        }
        let primes = NonCoherentMocus::new(&p, &ft).unwrap().analyze_primes();
        let mut engine: Vec<String> = primes
            .iter()
            .map(|cs| {
                let mut lits: Vec<(String, String)> = cs
                    .literals
                    .iter()
                    .map(|&lit| {
                        let id = p.get_node(lit.abs()).and_then(|nd| nd.id()).unwrap_or("?").to_string();
                        let s = if lit < 0 {
                            format!("~{}", id)
                        } else {
                            id.clone()
                        };
                        (id, s)
                    })
                    .collect();
                lits.sort_by(|x, y| x.0.cmp(&y.0));
                lits.into_iter().map(|x| x.1).collect::<Vec<_>>().join("&")
            })
            .collect();
        engine.sort();

        assert_eq!(
            engine, oracle,
            "preprocessed consensus engine must equal the QM oracle on the stress function"
        );
    }

    #[test]
    fn cut_off_keeps_only_dominant_cover() {
        let mut p = Pdag::new();
        let a = p.add_basic_event("a".to_string());
        let b = p.add_basic_event("b".to_string());
        let g1 = p.add_gate("g1".to_string(), Connective::And, vec![a, -b], None).unwrap();
        let top = p.add_gate("top".to_string(), Connective::Or, vec![g1, b], None).unwrap();
        p.set_root(top).unwrap();
        let ft = ft_with(&[("a", 0.5), ("b", 1e-3)]);
        let full = NonCoherentMocus::new(&p, &ft).unwrap().analyze();
        let truncated = NonCoherentMocus::new(&p, &ft).unwrap().with_cut_off(1e-2).analyze();
        assert!(truncated.len() < full.len());
        for cs in &truncated {
            assert!(NonCoherentMocus::new(&p, &ft).unwrap().cut_set_probability(cs) >= 1e-2);
        }
    }
}
