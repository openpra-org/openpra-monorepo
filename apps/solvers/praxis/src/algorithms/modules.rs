use std::collections::{HashMap, HashSet};

use crate::algorithms::pdag::{NodeIndex, Pdag, PdagNode};
use crate::error::PraxisError;
use crate::Result;

pub struct Decomposition {
    modules: HashSet<NodeIndex>,
    support: HashMap<NodeIndex, Vec<u64>>,
}

impl Decomposition {
    pub fn is_module(&self, gate: NodeIndex) -> bool {
        self.modules.contains(&gate.abs())
    }

    pub fn modules(&self) -> &HashSet<NodeIndex> {
        &self.modules
    }

    pub fn disjoint(&self, a: NodeIndex, b: NodeIndex) -> bool {
        match (self.support.get(&a.abs()), self.support.get(&b.abs())) {
            (Some(sa), Some(sb)) => !intersects(sa, sb),
            _ => true,
        }
    }

    pub fn support_size(&self, node: NodeIndex) -> usize {
        match self.support.get(&node.abs()) {
            Some(s) => s.iter().map(|w| w.count_ones() as usize).sum(),
            None => 0,
        }
    }
}

fn intersects(a: &[u64], b: &[u64]) -> bool {
    for i in 0..a.len().min(b.len()) {
        if a[i] & b[i] != 0 {
            return true;
        }
    }
    false
}

#[derive(Clone, Copy, PartialEq)]
enum State {
    OnStack,
    Done,
}

struct Ctx<'a> {
    pdag: &'a Pdag,
    event_index: &'a HashMap<NodeIndex, usize>,
    words: usize,
    state: HashMap<NodeIndex, State>,
    support: HashMap<NodeIndex, Vec<u64>>,
    topo: Vec<NodeIndex>,
}

pub fn decompose(pdag: &Pdag) -> Result<Decomposition> {
    let root = match pdag.root() {
        Some(r) => r.abs(),
        None => {
            return Ok(Decomposition {
                modules: HashSet::new(),
                support: HashMap::new(),
            })
        }
    };

    let mut event_index: HashMap<NodeIndex, usize> = HashMap::new();
    for node in pdag.nodes().values() {
        if let PdagNode::BasicEvent { index, .. } = node {
            let n = event_index.len();
            event_index.entry(index.abs()).or_insert(n);
        }
    }
    let words = (event_index.len() + 63) / 64;

    let mut ctx = Ctx {
        pdag,
        event_index: &event_index,
        words,
        state: HashMap::new(),
        support: HashMap::new(),
        topo: Vec::new(),
    };
    visit(&mut ctx, root)?;

    let modules = find_modules(&ctx, root);

    Ok(Decomposition {
        modules,
        support: ctx.support,
    })
}

fn visit(ctx: &mut Ctx, node: NodeIndex) -> Result<()> {
    let node = node.abs();
    match ctx.state.get(&node) {
        Some(State::Done) => return Ok(()),
        Some(State::OnStack) => {
            return Err(PraxisError::Logic(format!(
                "cyclic logic detected at node {}",
                node
            )))
        }
        None => {}
    }
    ctx.state.insert(node, State::OnStack);

    let mut supp = vec![0u64; ctx.words];
    let operands: Option<Vec<NodeIndex>> = match ctx.pdag.get_node(node) {
        Some(PdagNode::Gate { operands, .. }) => Some(operands.clone()),
        Some(PdagNode::BasicEvent { index, .. }) => {
            if let Some(&ei) = ctx.event_index.get(&index.abs()) {
                supp[ei / 64] |= 1u64 << (ei % 64);
            }
            None
        }
        _ => None,
    };

    if let Some(ops) = operands {
        for op in ops {
            let child = op.abs();
            if matches!(
                ctx.pdag.get_node(child),
                Some(PdagNode::Constant { .. }) | None
            ) {
                continue;
            }
            visit(ctx, child)?;
            if let Some(cs) = ctx.support.get(&child) {
                for i in 0..ctx.words {
                    supp[i] |= cs[i];
                }
            }
        }
    }

    ctx.support.insert(node, supp);
    ctx.state.insert(node, State::Done);
    ctx.topo.push(node);
    Ok(())
}

fn find_modules(ctx: &Ctx, root: NodeIndex) -> HashSet<NodeIndex> {
    let mut pon: HashMap<NodeIndex, usize> = HashMap::new();
    for (i, &n) in ctx.topo.iter().enumerate() {
        pon.insert(n, i);
    }

    let mut parents: HashMap<NodeIndex, Vec<NodeIndex>> = HashMap::new();
    for &n in &ctx.topo {
        if let Some(PdagNode::Gate { operands, .. }) = ctx.pdag.get_node(n) {
            for op in operands {
                let child = op.abs();
                if ctx.support.contains_key(&child) {
                    parents.entry(child).or_default().push(n);
                }
            }
        }
    }

    let mut idom: HashMap<NodeIndex, NodeIndex> = HashMap::new();
    idom.insert(root, root);
    let order: Vec<NodeIndex> = ctx.topo.iter().rev().copied().collect();
    loop {
        let mut changed = false;
        for &n in &order {
            if n == root {
                continue;
            }
            let mut new_idom: Option<NodeIndex> = None;
            if let Some(ps) = parents.get(&n) {
                for &p in ps {
                    if idom.contains_key(&p) {
                        new_idom = Some(match new_idom {
                            None => p,
                            Some(cur) => intersect(p, cur, &idom, &pon),
                        });
                    }
                }
            }
            if let Some(ni) = new_idom {
                if idom.get(&n) != Some(&ni) {
                    idom.insert(n, ni);
                    changed = true;
                }
            }
        }
        if !changed {
            break;
        }
    }

    let mut dominated: HashMap<NodeIndex, usize> = HashMap::new();
    for &n in &ctx.topo {
        if !ctx.pdag.get_node(n).map_or(false, |x| x.is_basic_event()) {
            continue;
        }
        let mut cur = idom.get(&n).copied();
        while let Some(c) = cur {
            *dominated.entry(c).or_insert(0) += 1;
            if c == root {
                break;
            }
            cur = idom.get(&c).copied();
        }
    }

    let mut modules = HashSet::new();
    for (&node, supp) in &ctx.support {
        if !ctx.pdag.get_node(node).map_or(false, |x| x.is_gate()) {
            continue;
        }
        let size: usize = supp.iter().map(|w| w.count_ones() as usize).sum();
        if dominated.get(&node).copied().unwrap_or(0) == size {
            modules.insert(node);
        }
    }
    modules
}

fn intersect(
    a: NodeIndex,
    b: NodeIndex,
    idom: &HashMap<NodeIndex, NodeIndex>,
    pon: &HashMap<NodeIndex, usize>,
) -> NodeIndex {
    let mut x = a;
    let mut y = b;
    while x != y {
        while pon[&x] < pon[&y] {
            x = idom[&x];
        }
        while pon[&y] < pon[&x] {
            y = idom[&y];
        }
    }
    x
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::parser::parse_fault_tree;

    fn pdag_of(xml: &str) -> Pdag {
        let ft = parse_fault_tree(xml).unwrap();
        Pdag::from_fault_tree(&ft).unwrap()
    }

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

    fn brute_force_modules(pdag: &Pdag) -> HashSet<NodeIndex> {
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

    const DISJOINT: &str = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="TOP">
    <define-gate name="TOP"><and><gate name="G1"/><gate name="G2"/></and></define-gate>
    <define-gate name="G1"><or><basic-event name="A"/><basic-event name="B"/></or></define-gate>
    <define-gate name="G2"><or><basic-event name="C"/><basic-event name="D"/></or></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="A"><float value="0.1"/></define-basic-event>
    <define-basic-event name="B"><float value="0.1"/></define-basic-event>
    <define-basic-event name="C"><float value="0.1"/></define-basic-event>
    <define-basic-event name="D"><float value="0.1"/></define-basic-event>
  </model-data>
</opsa-mef>"#;

    const SHARED: &str = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="TOP">
    <define-gate name="TOP"><and><gate name="G1"/><gate name="G2"/></and></define-gate>
    <define-gate name="G1"><or><basic-event name="A"/><basic-event name="B"/></or></define-gate>
    <define-gate name="G2"><or><basic-event name="B"/><basic-event name="C"/></or></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="A"><float value="0.1"/></define-basic-event>
    <define-basic-event name="B"><float value="0.1"/></define-basic-event>
    <define-basic-event name="C"><float value="0.1"/></define-basic-event>
  </model-data>
</opsa-mef>"#;

    const SHARED_LOCAL: &str = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="TOP">
    <define-gate name="TOP"><and><gate name="P1"/><gate name="P2"/></and></define-gate>
    <define-gate name="P1"><or><gate name="M"/><basic-event name="A"/></or></define-gate>
    <define-gate name="P2"><or><gate name="M"/><basic-event name="B"/></or></define-gate>
    <define-gate name="M"><and><basic-event name="X"/><basic-event name="Y"/></and></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="A"><float value="0.1"/></define-basic-event>
    <define-basic-event name="B"><float value="0.1"/></define-basic-event>
    <define-basic-event name="X"><float value="0.1"/></define-basic-event>
    <define-basic-event name="Y"><float value="0.1"/></define-basic-event>
  </model-data>
</opsa-mef>"#;

    #[test]
    fn disjoint_subtrees_are_modules() {
        let pdag = pdag_of(DISJOINT);
        let d = decompose(&pdag).unwrap();
        let g1 = pdag.get_index("G1").unwrap();
        let g2 = pdag.get_index("G2").unwrap();
        let top = pdag.get_index("TOP").unwrap();
        assert!(d.is_module(g1));
        assert!(d.is_module(g2));
        assert!(d.is_module(top));
        assert!(d.disjoint(g1, g2));
    }

    #[test]
    fn shared_event_breaks_modules() {
        let pdag = pdag_of(SHARED);
        let d = decompose(&pdag).unwrap();
        let g1 = pdag.get_index("G1").unwrap();
        let g2 = pdag.get_index("G2").unwrap();
        let top = pdag.get_index("TOP").unwrap();
        assert!(!d.is_module(g1));
        assert!(!d.is_module(g2));
        assert!(d.is_module(top));
        assert!(!d.disjoint(g1, g2));
    }

    #[test]
    fn shared_but_event_local_is_a_module() {
        let pdag = pdag_of(SHARED_LOCAL);
        let d = decompose(&pdag).unwrap();
        let m = pdag.get_index("M").unwrap();
        let p1 = pdag.get_index("P1").unwrap();
        assert!(d.is_module(m));
        assert!(!d.is_module(p1));
    }

    #[test]
    fn matches_brute_force_definition() {
        for xml in [DISJOINT, SHARED, SHARED_LOCAL] {
            let pdag = pdag_of(xml);
            let d = decompose(&pdag).unwrap();
            let bf = brute_force_modules(&pdag);
            assert_eq!(d.modules(), &bf);
        }
    }
}
