use std::collections::{HashMap, HashSet, VecDeque};

use crate::algorithms::pdag::{NodeIndex, Pdag, PdagNode};

pub fn basic_events(pdag: &Pdag) -> Vec<NodeIndex> {
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

fn scram_key(pdag: &Pdag, op: NodeIndex) -> (u8, i64, NodeIndex) {
    let a = op.abs();
    let is_var = matches!(pdag.get_node(a), Some(PdagNode::BasicEvent { .. }));
    let kind = if is_var { 1u8 } else { 0u8 };
    let pc = pdag.parents().get(&a).map(|s| s.len()).unwrap_or(0) as i64;
    (kind, -pc, a)
}

fn dfs(
    pdag: &Pdag,
    idx: NodeIndex,
    scram: bool,
    pos: &mut HashMap<NodeIndex, usize>,
    visited: &mut HashSet<NodeIndex>,
    counter: &mut usize,
) {
    let a = idx.abs();
    if !visited.insert(a) {
        return;
    }
    match pdag.get_node(a) {
        Some(PdagNode::BasicEvent { .. }) => {
            if let std::collections::hash_map::Entry::Vacant(e) = pos.entry(a) {
                e.insert(*counter);
                *counter += 1;
            }
        }
        Some(PdagNode::Gate { operands, .. }) => {
            let mut ops = operands.clone();
            if scram {
                ops.sort_by_key(|&op| scram_key(pdag, op));
            }
            for op in ops {
                dfs(pdag, op, scram, pos, visited, counter);
            }
        }
        _ => {}
    }
}

pub fn dfs_order(pdag: &Pdag, scram: bool) -> HashMap<NodeIndex, usize> {
    let mut pos = HashMap::new();
    let mut visited = HashSet::new();
    let mut counter = 0;
    if let Some(root) = pdag.root() {
        dfs(
            pdag,
            root.abs(),
            scram,
            &mut pos,
            &mut visited,
            &mut counter,
        );
    }
    for &be in &basic_events(pdag) {
        if let std::collections::hash_map::Entry::Vacant(e) = pos.entry(be) {
            e.insert(counter);
            counter += 1;
        }
    }
    pos
}

fn cone(
    pdag: &Pdag,
    idx: NodeIndex,
    memo: &mut HashMap<NodeIndex, Vec<NodeIndex>>,
) -> Vec<NodeIndex> {
    let a = idx.abs();
    if let Some(c) = memo.get(&a) {
        return c.clone();
    }
    let c = match pdag.get_node(a) {
        Some(PdagNode::BasicEvent { .. }) => vec![a],
        Some(PdagNode::Gate { operands, .. }) => {
            let ops = operands.clone();
            let mut set: HashSet<NodeIndex> = HashSet::new();
            for op in ops {
                for e in cone(pdag, op.abs(), memo) {
                    set.insert(e);
                }
            }
            let mut v: Vec<NodeIndex> = set.into_iter().collect();
            v.sort();
            v
        }
        _ => vec![],
    };
    memo.insert(a, c.clone());
    c
}

pub fn force_order(pdag: &Pdag) -> HashMap<NodeIndex, usize> {
    let events = basic_events(pdag);
    let n = events.len();
    if n == 0 {
        return HashMap::new();
    }
    let mut id: HashMap<NodeIndex, usize> = HashMap::new();
    for (i, &e) in events.iter().enumerate() {
        id.insert(e, i);
    }
    let mut memo = HashMap::new();
    let mut edges: Vec<Vec<usize>> = Vec::new();
    for (&idx, node) in pdag.nodes() {
        if matches!(node, PdagNode::Gate { .. }) {
            let c = cone(pdag, idx, &mut memo);
            if c.len() >= 2 {
                edges.push(c.iter().map(|e| id[e]).collect());
            }
        }
    }
    let mut pos: Vec<f64> = vec![0.0; n];
    for (&e, &p) in &dfs_order(pdag, false) {
        if let Some(&i) = id.get(&e) {
            pos[i] = p as f64;
        }
    }
    let mut inc: Vec<Vec<usize>> = vec![Vec::new(); n];
    for (ei, e) in edges.iter().enumerate() {
        for &v in e {
            inc[v].push(ei);
        }
    }
    for _ in 0..30 {
        let mut cog = vec![0.0f64; edges.len()];
        for (ei, e) in edges.iter().enumerate() {
            let s: f64 = e.iter().map(|&v| pos[v]).sum();
            cog[ei] = s / e.len() as f64;
        }
        let mut np = pos.clone();
        for (v, slot) in np.iter_mut().enumerate() {
            if inc[v].is_empty() {
                continue;
            }
            let s: f64 = inc[v].iter().map(|&ei| cog[ei]).sum();
            *slot = s / inc[v].len() as f64;
        }
        let mut order: Vec<usize> = (0..n).collect();
        order.sort_by(|&x, &y| np[x].partial_cmp(&np[y]).unwrap().then(x.cmp(&y)));
        for (rank, &v) in order.iter().enumerate() {
            pos[v] = rank as f64;
        }
    }
    let mut out = HashMap::new();
    for (&e, &i) in &id {
        out.insert(e, pos[i] as usize);
    }
    out
}

fn bfs_dist(adj: &[Vec<usize>], src: usize) -> Vec<i64> {
    let n = adj.len();
    let mut d = vec![-1i64; n];
    let mut q = VecDeque::new();
    d[src] = 0;
    q.push_back(src);
    while let Some(u) = q.pop_front() {
        for &v in &adj[u] {
            if d[v] < 0 {
                d[v] = d[u] + 1;
                q.push_back(v);
            }
        }
    }
    for v in d.iter_mut() {
        if *v < 0 {
            *v = 0;
        }
    }
    d
}

pub fn sloan_on_adj(adj: &[Vec<usize>]) -> Vec<usize> {
    let n = adj.len();
    if n == 0 {
        return Vec::new();
    }
    let deg: Vec<usize> = adj.iter().map(|a| a.len()).collect();
    let start = (0..n).min_by_key(|&i| (deg[i], i)).unwrap();
    let dstart = bfs_dist(adj, start);
    let end = (0..n).max_by_key(|&i| (dstart[i], i)).unwrap();
    let dend = bfs_dist(adj, end);
    let w1 = 1i64;
    let w2 = 2i64;
    let mut status = vec![0u8; n];
    let mut prio: Vec<i64> = (0..n)
        .map(|i| w1 * dend[i] - w2 * (deg[i] as i64 + 1))
        .collect();
    let mut placed = vec![false; n];
    let mut order = Vec::with_capacity(n);
    status[start] = 1;
    for _ in 0..n {
        let mut best: Option<usize> = None;
        let mut bp = i64::MIN;
        for i in 0..n {
            if !placed[i] && (status[i] == 1 || status[i] == 2) && prio[i] > bp {
                bp = prio[i];
                best = Some(i);
            }
        }
        let u = match best {
            Some(u) => u,
            None => match (0..n).find(|&i| !placed[i]) {
                Some(i) => i,
                None => break,
            },
        };
        let was_pre = status[u] == 1;
        placed[u] = true;
        status[u] = 3;
        order.push(u);
        if was_pre {
            for &v in &adj[u] {
                prio[v] += w2;
                if status[v] == 0 {
                    status[v] = 1;
                }
            }
        }
        for v in adj[u].clone() {
            if status[v] == 1 {
                status[v] = 2;
                for &w in &adj[v] {
                    prio[w] += w2;
                    if status[w] == 0 {
                        status[w] = 1;
                    }
                }
            }
        }
    }
    order
}

pub fn factor_graph(pdag: &Pdag) -> (Vec<NodeIndex>, Vec<Vec<usize>>, Vec<bool>) {
    let mut ids: Vec<NodeIndex> = pdag.nodes().keys().copied().collect();
    ids.sort();
    let mut idx_of: HashMap<NodeIndex, usize> = HashMap::new();
    for (i, &id) in ids.iter().enumerate() {
        idx_of.insert(id, i);
    }
    let m = ids.len();
    let mut adj: Vec<HashSet<usize>> = (0..m).map(|_| HashSet::new()).collect();
    let mut is_event = vec![false; m];
    for (i, &id) in ids.iter().enumerate() {
        let ops: Option<Vec<NodeIndex>> = match pdag.get_node(id) {
            Some(PdagNode::BasicEvent { .. }) => {
                is_event[i] = true;
                None
            }
            Some(PdagNode::Gate { operands, .. }) => Some(operands.clone()),
            _ => None,
        };
        if let Some(operands) = ops {
            let mut members = vec![i];
            for &op in &operands {
                if let Some(&j) = idx_of.get(&op.abs()) {
                    members.push(j);
                }
            }
            for a in 0..members.len() {
                for b in (a + 1)..members.len() {
                    let (x, y) = (members[a], members[b]);
                    adj[x].insert(y);
                    adj[y].insert(x);
                }
            }
        }
    }
    let adj: Vec<Vec<usize>> = adj
        .into_iter()
        .map(|s| {
            let mut v: Vec<usize> = s.into_iter().collect();
            v.sort();
            v
        })
        .collect();
    (ids, adj, is_event)
}

fn fac_order(pdag: &Pdag, core: fn(&[Vec<usize>]) -> Vec<usize>) -> HashMap<NodeIndex, usize> {
    let (ids, adj, is_event) = factor_graph(pdag);
    let order = core(&adj);
    let mut out = HashMap::new();
    let mut pos = 0usize;
    for &v in &order {
        if is_event[v] {
            out.insert(ids[v], pos);
            pos += 1;
        }
    }
    out
}

pub fn sloan_fac_order(pdag: &Pdag) -> HashMap<NodeIndex, usize> {
    fac_order(pdag, sloan_on_adj)
}
