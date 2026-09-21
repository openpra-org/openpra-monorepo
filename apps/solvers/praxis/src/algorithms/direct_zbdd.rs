use std::collections::{BTreeMap, HashMap, HashSet};

use tracing::{debug, trace};

use crate::algorithms::build::{
    select_variable_order as select_configured_variable_order, VariableOrder,
};
use crate::algorithms::modules::{decompose, Decomposition};
use crate::algorithms::noncoherent_mocus::{
    combinations, gate_expansion, normalize_xor_iff, Expansion,
};
use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::algorithms::zbdd_engine::{ZbddEngine, ZbddRef, ZBDD_BASE, ZBDD_EMPTY};
use crate::core::fault_tree::FaultTree;
use crate::error::PraxisError;
use crate::Result;

enum NodeKind {
    Basic(usize),
    Constant(bool),
    Gate(Connective, Vec<NodeIndex>, Option<usize>),
    Missing,
}

fn has_negative_basic_literal(pdag: &Pdag) -> bool {
    let Some(root) = pdag.root() else {
        return false;
    };
    let effective_root = if pdag.complement() { -root } else { root };
    let mut pending = vec![effective_root];
    let mut visited = HashSet::new();

    while let Some(node) = pending.pop() {
        if !visited.insert(node) {
            continue;
        }
        match pdag.get_node(node.abs()) {
            Some(PdagNode::BasicEvent { .. }) => {
                if node < 0 {
                    return true;
                }
            }
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => match gate_expansion(*connective, node < 0, operands, *min_number) {
                Expansion::Conjunction(refs)
                | Expansion::Disjunction(refs)
                | Expansion::AtLeast(_, refs) => pending.extend(refs),
                Expansion::Unsupported => return true,
            },
            Some(PdagNode::Constant { .. }) | None => {}
        }
    }
    false
}

fn select_variable_order(pdag: &Pdag) -> Result<Vec<NodeIndex>> {
    let which = std::env::var("PRAXIS_ORDER").unwrap_or_default();
    let method = match which.as_str() {
        "force" => VariableOrder::Force,
        "sloan" => VariableOrder::Sloan,
        "dfs_scram" | "dfs-scram" => VariableOrder::DfsScram,
        "dfs_plain" | "dfs-plain" => VariableOrder::DfsPlain,
        "rev" | "reverse" => VariableOrder::Reverse,
        "sift" => VariableOrder::Sift,
        "gsift" => VariableOrder::Gsift,
        "ils" => VariableOrder::Ils,
        _ => VariableOrder::Dfs,
    };
    let seconds = std::env::var("PRAXIS_REORDER_BUDGET")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(60);
    select_configured_variable_order(pdag, method, std::time::Duration::from_secs(seconds))
}

fn is_commutative(conn: Connective) -> bool {
    matches!(
        conn,
        Connective::And
            | Connective::Or
            | Connective::Nand
            | Connective::Nor
            | Connective::Xor
            | Connective::Iff
            | Connective::AtLeast
    )
}

fn structural_canon(pdag: &Pdag) -> HashMap<NodeIndex, NodeIndex> {
    let mut canon: HashMap<NodeIndex, NodeIndex> = HashMap::new();
    let root = match pdag.root() {
        Some(r) => r.abs(),
        None => return canon,
    };
    let mut order: Vec<NodeIndex> = Vec::new();
    let mut done: HashSet<NodeIndex> = HashSet::new();
    let mut stack: Vec<(NodeIndex, bool)> = vec![(root, false)];
    while let Some((n, kids_done)) = stack.pop() {
        if done.contains(&n) {
            continue;
        }
        if kids_done {
            done.insert(n);
            order.push(n);
        } else {
            stack.push((n, true));
            if let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(n) {
                for &op in operands {
                    let a = op.abs();
                    if !done.contains(&a) {
                        stack.push((a, false));
                    }
                }
            }
        }
    }
    let mut sig_map: HashMap<(Connective, Option<usize>, Vec<NodeIndex>), NodeIndex> =
        HashMap::new();
    for &n in &order {
        match pdag.get_node(n) {
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => {
                let conn = *connective;
                let mut cops: Vec<NodeIndex> = operands
                    .iter()
                    .map(|&op| {
                        let a = op.abs();
                        let c = canon.get(&a).copied().unwrap_or(a);
                        if op < 0 {
                            -c
                        } else {
                            c
                        }
                    })
                    .collect();
                if is_commutative(conn) {
                    cops.sort_unstable();
                }
                let sig = (conn, *min_number, cops);
                match sig_map.get(&sig) {
                    Some(&rep) => {
                        canon.insert(n, rep);
                    }
                    None => {
                        sig_map.insert(sig, n);
                        canon.insert(n, n);
                    }
                }
            }
            _ => {
                canon.insert(n, n);
            }
        }
    }
    canon
}

struct Builder {
    pdag: Pdag,
    level: HashMap<NodeIndex, usize>,
    var_probs: Vec<f64>,
    zbdd: ZbddEngine,
    cache: HashMap<NodeIndex, ZbddRef>,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    allowed_levels: Option<HashSet<usize>>,
    exclusions: HashMap<usize, Vec<Vec<usize>>>,
    mutex_node: Option<NodeIndex>,
    progress: u64,
    explored: u64,
    budget_cache: HashMap<(NodeIndex, i32, bool), ZbddRef>,
    maxcs_memo: HashMap<NodeIndex, f64>,
    decomposition: Option<Decomposition>,
    initiators: HashSet<usize>,
    has_xor: bool,
    has_negative_literals: bool,
    canon: HashMap<NodeIndex, NodeIndex>,
    gc_cache: usize,
}

impl Builder {
    fn new(
        pdag: &Pdag,
        fault_tree: &FaultTree,
        cut_off: Option<f64>,
        limit_order: Option<usize>,
    ) -> Result<Self> {
        Self::new_with_probability_source(pdag, cut_off, limit_order, true, None, None, |id| {
            match fault_tree.get_basic_event(id) {
                Some(be) => (be.probability(), be.is_initiator()),
                None => (0.0, false),
            }
        })
    }

    fn new_with_order(
        pdag: &Pdag,
        fault_tree: &FaultTree,
        cut_off: Option<f64>,
        limit_order: Option<usize>,
        variable_order: VariableOrder,
        reorder_budget: std::time::Duration,
    ) -> Result<Self> {
        Self::new_with_probability_source(
            pdag,
            cut_off,
            limit_order,
            true,
            None,
            Some((variable_order, reorder_budget)),
            |id| match fault_tree.get_basic_event(id) {
                Some(be) => (be.probability(), be.is_initiator()),
                None => (0.0, false),
            },
        )
    }

    fn new_with_probability_map(
        pdag: &Pdag,
        probabilities: &HashMap<String, f64>,
        cut_off: Option<f64>,
        limit_order: Option<usize>,
    ) -> Result<Self> {
        // Event-tree sequence analysis evaluates the original sequence root and
        // each original success root separately after construction. Rewriting
        // their synthetic OR scope can absorb a variable that is still needed
        // by one of those component roots, leaving it outside the DFS variable
        // order. Keep those component graphs stable.
        Self::new_with_probability_source(pdag, cut_off, limit_order, false, None, None, |id| {
            (probabilities.get(id).copied().unwrap_or(0.0), false)
        })
    }

    fn new_with_probability_source<F>(
        pdag: &Pdag,
        cut_off: Option<f64>,
        limit_order: Option<usize>,
        propagate: bool,
        order_override: Option<Vec<NodeIndex>>,
        order_method: Option<(VariableOrder, std::time::Duration)>,
        mut probability_of: F,
    ) -> Result<Self>
    where
        F: FnMut(&str) -> (f64, bool),
    {
        let has_xor = pdag.nodes().values().any(|n| {
            matches!(
                n,
                PdagNode::Gate {
                    connective: Connective::Xor,
                    ..
                } | PdagNode::Gate {
                    connective: Connective::Iff,
                    ..
                }
            )
        });
        let mut owned = pdag.clone();
        normalize_xor_iff(&mut owned)?;
        if propagate && std::env::var("PRAXIS_NOSIMP").is_err() {
            crate::algorithms::simplify::propagate_constants(&mut owned)?;
        }

        let has_negative_literals = has_negative_basic_literal(&owned);

        let order = match order_override {
            Some(order) => order,
            None => match order_method {
                Some((method, budget)) => select_configured_variable_order(&owned, method, budget)?,
                None => select_variable_order(&owned)?,
            },
        };

        let mut level = HashMap::new();
        let mut var_probs: Vec<f64> = Vec::with_capacity(order.len() * 2);
        let mut initiators: HashSet<usize> = HashSet::new();
        for (l, &raw) in order.iter().enumerate() {
            let e = raw.abs();
            level.insert(e, l);
            let p = match owned.get_node(e) {
                Some(PdagNode::BasicEvent { id, .. }) => {
                    let (probability, is_initiator) = probability_of(id);
                    if is_initiator {
                        initiators.insert(l);
                    }
                    probability
                }
                _ => 0.0,
            };
            var_probs.push(p);
            var_probs.push(1.0 - p);
        }

        let canon = if std::env::var("PRAXIS_CSE").is_ok() {
            structural_canon(&owned)
        } else {
            HashMap::new()
        };

        let mut zbdd = ZbddEngine::new();
        zbdd.set_var_probs(var_probs.clone());

        Ok(Builder {
            pdag: owned,
            level,
            var_probs,
            zbdd,
            cache: HashMap::new(),
            cut_off,
            limit_order,
            allowed_levels: None,
            exclusions: HashMap::new(),
            mutex_node: None,
            progress: 0,
            explored: 0,
            budget_cache: HashMap::new(),
            maxcs_memo: HashMap::new(),
            decomposition: None,
            initiators,
            has_xor,
            has_negative_literals,
            canon,
            gc_cache: std::env::var("PRAXIS_GC_CACHE")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
        })
    }

    fn event_names(&self) -> Vec<Option<String>> {
        let mut names = vec![None; self.var_probs.len()];
        for (&idx, &level) in &self.level {
            let Some(id) = self.pdag.get_node(idx).and_then(|node| node.id()) else {
                continue;
            };
            names[2 * level] = Some(id.to_string());
            names[2 * level + 1] = Some(format!("~{}", id));
        }
        names
    }

    fn setup_mutex(&mut self, name: &str) -> Result<()> {
        let Some(node) = self.pdag.get_index(name) else {
            tracing::warn!(target: "praxis::direct_zbdd", gate = name, "mutex gate not found, delete-term disabled");
            return Ok(());
        };
        let family = self.cut_sets(node)?;
        let combos = self.zbdd.enumerate(family);
        let combinations = combos.len();
        for combo in combos {
            for &v in &combo {
                let others: Vec<usize> = combo.iter().copied().filter(|&x| x != v).collect();
                self.exclusions.entry(v).or_default().push(others);
            }
        }
        self.mutex_node = Some(node);
        self.cache.clear();
        tracing::info!(
            target: "praxis::direct_zbdd",
            gate = name,
            node,
            combinations,
            excluded_literals = self.exclusions.len(),
            "delete-term mutex configured"
        );
        Ok(())
    }

    fn forbidden(&self, var: usize, chosen: &[usize]) -> bool {
        match self.exclusions.get(&var) {
            Some(combos) => combos
                .iter()
                .any(|others| others.iter().all(|o| chosen.contains(o))),
            None => false,
        }
    }

    fn truncate(&mut self, f: ZbddRef) -> ZbddRef {
        let mut f = f;
        if let Some(c) = self.cut_off {
            f = self.zbdd.prune_below_probability(f, c);
        }
        if let Some(k) = self.limit_order {
            f = self.zbdd.limit_order(f, k);
        }
        f
    }

    fn join_truncated(&mut self, left: ZbddRef, right: ZbddRef) -> ZbddRef {
        match (self.limit_order, self.cut_off) {
            (Some(max_order), Some(cut_off)) => self
                .zbdd
                .join_budgeted_limited(left, right, cut_off, max_order),
            (Some(max_order), None) => self.zbdd.join_limited(left, right, max_order),
            (None, Some(cut_off)) => self.zbdd.join_budgeted(left, right, cut_off),
            (None, None) => self.zbdd.join(left, right),
        }
    }

    fn at_least_family(&mut self, k: usize, refs: &[NodeIndex]) -> Result<ZbddRef> {
        if k == 0 {
            return Ok(ZBDD_BASE);
        }
        if k > refs.len() {
            return Ok(ZBDD_EMPTY);
        }

        // Dynamic programming avoids explicitly constructing all n-choose-k
        // operand combinations. Each bucket represents products selecting
        // exactly that many child formulas.
        let mut buckets = vec![ZBDD_EMPTY; k + 1];
        buckets[0] = ZBDD_BASE;
        for (index, &operand) in refs.iter().enumerate() {
            let child = self.cut_sets(operand)?;
            let upper = k.min(index + 1);
            for selected in (1..=upper).rev() {
                let product = self.join_truncated(buckets[selected - 1], child);
                let merged = self.zbdd.union(buckets[selected], product);
                let minimal = self.zbdd.minimize(merged);
                buckets[selected] = self.truncate(minimal);
            }
        }
        Ok(buckets[k])
    }

    fn truncate_budgeted(&mut self, f: ZbddRef, min_probability: f64) -> ZbddRef {
        let mut f = self.zbdd.prune_below_probability(f, min_probability);
        if let Some(max_order) = self.limit_order {
            f = self.zbdd.limit_order(f, max_order);
        }
        f
    }

    fn order_probability_floor(&self, max_order: usize) -> Option<f64> {
        let mut probabilities: Vec<f64> = if self.has_negative_literals {
            self.var_probs.clone()
        } else {
            self.var_probs.iter().step_by(2).copied().collect()
        };
        if probabilities
            .iter()
            .any(|p| !p.is_finite() || *p < 0.0 || *p > 1.0)
        {
            return None;
        }
        probabilities.sort_by(f64::total_cmp);

        let mut floor = 1.0;
        for probability in probabilities.into_iter().take(max_order) {
            floor *= probability;
            if floor == 0.0 {
                return Some(0.0);
            }
            // Keep the derived threshold conservatively below the mathematical
            // product so a cut set exactly on the boundary cannot be lost to
            // floating-point rounding.
            floor = floor.next_down();
        }
        Some(floor)
    }

    fn kind(&self, r: NodeIndex) -> NodeKind {
        match self.pdag.get_node(r.abs()) {
            Some(PdagNode::BasicEvent { .. }) => {
                let l = self.level[&r.abs()];
                NodeKind::Basic(l)
            }
            Some(PdagNode::Constant { value, .. }) => NodeKind::Constant(*value),
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => NodeKind::Gate(*connective, operands.clone(), *min_number),
            None => NodeKind::Missing,
        }
    }

    fn var_prob(&self, var: usize) -> f64 {
        self.var_probs.get(var).copied().unwrap_or(0.0)
    }

    fn as_delete_target(&self, ci: NodeIndex) -> Option<NodeIndex> {
        if ci > 0 {
            if let Some(PdagNode::Gate {
                connective: Connective::Not,
                operands,
                ..
            }) = self.pdag.get_node(ci)
            {
                let t = *operands.first()?;
                if t > 0 {
                    if let Some(PdagNode::Gate { .. }) = self.pdag.get_node(t) {
                        return Some(t);
                    }
                }
            }
            None
        } else if let Some(PdagNode::Gate { .. }) = self.pdag.get_node(ci.abs()) {
            Some(ci.abs())
        } else {
            None
        }
    }

    fn delete_covered(&mut self, acc: ZbddRef, dmcs: ZbddRef) -> ZbddRef {
        self.zbdd.nonsuperset(acc, dmcs)
    }

    fn cut_sets(&mut self, r: NodeIndex) -> Result<ZbddRef> {
        if let Some(&z) = self.cache.get(&r) {
            return Ok(z);
        }
        trace!(target: "praxis::direct_zbdd", op = "cut_sets", node = r, "enter gate");
        let neg = r < 0;
        let result = match self.kind(r) {
            NodeKind::Basic(l) => {
                if self
                    .allowed_levels
                    .as_ref()
                    .is_some_and(|allowed| !allowed.contains(&l))
                {
                    // SAPHIRE's sequence cut-set matching sets every event
                    // absent from the failed-system cut sets to house FALSE
                    // before solving the succeeded-system tree. A complemented
                    // excluded event therefore becomes TRUE.
                    return Ok(if neg { ZBDD_BASE } else { ZBDD_EMPTY });
                }
                let var = if neg { 2 * l + 1 } else { 2 * l };
                self.zbdd.multiply(var, ZBDD_BASE)
            }
            NodeKind::Constant(value) => {
                if value ^ neg {
                    ZBDD_BASE
                } else {
                    ZBDD_EMPTY
                }
            }
            NodeKind::Gate(conn, ops, min) => match gate_expansion(conn, neg, &ops, min) {
                Expansion::Conjunction(refs) => {
                    let mut acc = ZBDD_BASE;
                    for op in refs {
                        let c = self.cut_sets(op)?;
                        acc = self.join_truncated(acc, c);
                        acc = self.zbdd.purify(acc);
                        acc = self.truncate(acc);
                    }
                    self.zbdd.minimize(acc)
                }
                Expansion::Disjunction(refs) => {
                    let mut acc = ZBDD_EMPTY;
                    for op in refs {
                        let c = self.cut_sets(op)?;
                        acc = self.zbdd.union(acc, c);
                    }
                    let acc = self.zbdd.minimize(acc);
                    self.truncate(acc)
                }
                Expansion::AtLeast(k, refs) => self.at_least_family(k, &refs)?,
                Expansion::Unsupported => {
                    return Err(PraxisError::Logic(
                        "direct ZBDD: XOR/IFF must be normalized before building".to_string(),
                    ));
                }
            },
            NodeKind::Missing => ZBDD_EMPTY,
        };
        debug!(
            target: "praxis::direct_zbdd",
            node = r,
            family = result.raw(),
            total_nodes = self.zbdd.node_count(),
            "gate cut-set family built"
        );
        self.cache.insert(r, result);
        Ok(result)
    }

    fn build(&mut self) -> Result<ZbddRef> {
        if !self.has_negative_literals && (self.limit_order.is_some() || self.cut_off.is_some()) {
            return self.build_direct_budgeted();
        }
        let root = self
            .pdag
            .root()
            .ok_or_else(|| PraxisError::Logic("direct ZBDD: PDAG has no root".to_string()))?;
        let eff = if self.pdag.complement() { -root } else { root };
        debug!(target: "praxis::direct_zbdd", root = eff, cut_off = ?self.cut_off, "bottom-up build start");
        // In coherent logic, order and probability can only increase as a
        // product grows, so limits are safe during every ZBDD operation. In
        // non-coherent logic, consensus can remove a complementary literal and
        // lower both order and probability. Build that family without limits,
        // complete the consensus closure, and apply the requested limits last.
        let saved_cut_off = self.cut_off;
        let saved_limit_order = self.limit_order;
        if self.has_negative_literals {
            self.cut_off = None;
            self.limit_order = None;
        } else if self.cut_off.is_none() {
            // A product containing at most k literals cannot be less probable
            // than the product of the k smallest literal probabilities. Use
            // that safe floor internally to prune intermediate families while
            // preserving every product allowed by the order limit.
            self.cut_off = self
                .limit_order
                .and_then(|max_order| self.order_probability_floor(max_order))
                .filter(|floor| *floor > 0.0);
        }
        let mut r = self.cut_sets(eff)?;
        if self.has_negative_literals {
            r = self.consensus_closure(r);
            self.cut_off = saved_cut_off;
            self.limit_order = saved_limit_order;
            r = self.truncate(r);
        } else {
            self.cut_off = saved_cut_off;
        }
        r = self.finish_root(r);
        debug!(target: "praxis::direct_zbdd", root_family = r.raw(), total_nodes = self.zbdd.node_count(), "bottom-up build done");
        Ok(r)
    }

    fn build_direct_budgeted(&mut self) -> Result<ZbddRef> {
        let root = self
            .pdag
            .root()
            .ok_or_else(|| PraxisError::Logic("direct ZBDD: PDAG has no root".to_string()))?;
        let effective_root = if self.pdag.complement() { -root } else { root };
        let order_floor = self
            .limit_order
            .and_then(|max_order| self.order_probability_floor(max_order));
        let requested_budget = match (self.cut_off, order_floor) {
            (Some(cut_off), Some(floor)) => cut_off.max(floor),
            (Some(cut_off), None) => cut_off,
            (None, Some(floor)) if floor > 0.0 => floor,
            _ => 1e-300,
        };
        let budget = requested_budget.max(1e-300);
        self.decomposition = Some(decompose(&self.pdag)?);
        debug!(target: "praxis::direct_zbdd", root = effective_root, budget, limit_order = ?self.limit_order, "budgeted direct build start");
        let mut result = self.cut_sets_b(effective_root, budget, false)?;
        result = self.truncate_budgeted(result, budget);
        result = self.finish_root(result);
        debug!(target: "praxis::direct_zbdd", root_family = result.raw(), total_nodes = self.zbdd.node_count(), "budgeted direct build done");
        Ok(result)
    }

    fn consensus_closure(&mut self, mut root: ZbddRef) -> ZbddRef {
        root = self.zbdd.purify(root);
        root = self.zbdd.minimize(root);

        loop {
            let before = root;
            let support = self.zbdd.support_variables(root);
            let mut levels: Vec<usize> = support
                .iter()
                .filter(|&&variable| variable % 2 == 0 && support.contains(&(variable + 1)))
                .map(|&variable| variable / 2)
                .collect();
            levels.sort_unstable();
            levels.dedup();

            for level in levels {
                let positive = self.zbdd.include_cofactor(root, 2 * level);
                let negative = self.zbdd.include_cofactor(root, 2 * level + 1);
                if positive == ZBDD_EMPTY || negative == ZBDD_EMPTY {
                    continue;
                }
                let consensus = self.zbdd.join(positive, negative);
                let consensus = self.zbdd.purify(consensus);
                let consensus = self.zbdd.minimize(consensus);
                let combined = self.zbdd.union(root, consensus);
                root = self.zbdd.minimize(combined);
            }

            if root == before {
                break;
            }
        }
        root
    }

    fn finish_root(&mut self, mut root: ZbddRef) -> ZbddRef {
        if self.initiators.len() >= 2 {
            let mut levels: Vec<usize> = self.initiators.iter().copied().collect();
            levels.sort_unstable();
            let mut pairs = ZBDD_EMPTY;
            for i in 0..levels.len() {
                for j in (i + 1)..levels.len() {
                    let inner = self.zbdd.multiply(2 * levels[j], ZBDD_BASE);
                    let pair = self.zbdd.multiply(2 * levels[i], inner);
                    pairs = self.zbdd.union(pairs, pair);
                }
            }
            root = self.zbdd.nonsuperset(root, pairs);
        }
        if std::env::var("PRAXIS_NOTRIM").is_err() {
            let flags: HashSet<usize> = (0..self.var_probs.len())
                .filter(|&variable| variable % 2 == 0 && self.var_probs[variable] >= 1.0)
                .collect();
            if !flags.is_empty() {
                let mut cache = HashMap::new();
                root = self.zbdd.project_out_set(root, &flags, &mut cache);
            }
        }
        self.zbdd.minimize(root)
    }

    fn singleton(&mut self, chosen: &[usize]) -> ZbddRef {
        let mut sorted: Vec<usize> = chosen.to_vec();
        sorted.sort_unstable();
        let mut acc = ZBDD_BASE;
        for &v in sorted.iter().rev() {
            acc = self.zbdd.multiply(v, acc);
        }
        acc
    }

    fn gen(
        &mut self,
        obligations: &[NodeIndex],
        chosen: &mut Vec<usize>,
        prefix: f64,
    ) -> Result<ZbddRef> {
        self.explored += 1;
        if self.explored.is_multiple_of(50_000_000) {
            tracing::info!(
                target: "praxis::direct_zbdd",
                explored = self.explored,
                cut_sets = self.progress,
                nodes = self.zbdd.node_count(),
                "top-down exploring"
            );
        }
        if let Some(c) = self.cut_off {
            if prefix < c {
                return Ok(ZBDD_EMPTY);
            }
        }
        let (first, rest) = match obligations.split_first() {
            Some(parts) => parts,
            None => {
                self.progress += 1;
                if self.progress.is_multiple_of(10_000) {
                    tracing::info!(
                        target: "praxis::direct_zbdd",
                        cut_sets = self.progress,
                        nodes = self.zbdd.node_count(),
                        order = chosen.len(),
                        prob = prefix,
                        "top-down cut sets"
                    );
                }
                trace!(
                    target: "praxis::direct_zbdd",
                    op = "cut_set",
                    literals = ?chosen,
                    prob = prefix,
                    "complete cut set"
                );
                return Ok(self.singleton(chosen));
            }
        };
        let r = *first;
        let neg = r < 0;
        if let Some(m) = self.mutex_node {
            if r.abs() == m {
                return if neg {
                    self.gen(rest, chosen, prefix)
                } else {
                    Ok(ZBDD_EMPTY)
                };
            }
        }
        match self.kind(r) {
            NodeKind::Basic(l) => {
                let var = if neg { 2 * l + 1 } else { 2 * l };
                if chosen.contains(&(var ^ 1)) {
                    return Ok(ZBDD_EMPTY);
                }
                if chosen.contains(&var) {
                    return self.gen(rest, chosen, prefix);
                }
                if self.forbidden(var, chosen) {
                    return Ok(ZBDD_EMPTY);
                }
                let np = prefix * self.var_prob(var);
                if let Some(c) = self.cut_off {
                    if np < c {
                        return Ok(ZBDD_EMPTY);
                    }
                }
                if let Some(lim) = self.limit_order {
                    if chosen.len() + 1 > lim {
                        return Ok(ZBDD_EMPTY);
                    }
                }
                chosen.push(var);
                let res = self.gen(rest, chosen, np);
                chosen.pop();
                res
            }
            NodeKind::Constant(value) => {
                if value ^ neg {
                    self.gen(rest, chosen, prefix)
                } else {
                    Ok(ZBDD_EMPTY)
                }
            }
            NodeKind::Gate(conn, ops, min) => match gate_expansion(conn, neg, &ops, min) {
                Expansion::Conjunction(refs) => {
                    let mut obl = refs;
                    obl.extend_from_slice(rest);
                    self.gen(&obl, chosen, prefix)
                }
                Expansion::Disjunction(refs) => {
                    let mut acc = ZBDD_EMPTY;
                    for op in refs {
                        let mut obl = vec![op];
                        obl.extend_from_slice(rest);
                        let branch = self.gen(&obl, chosen, prefix)?;
                        acc = self.zbdd.union(acc, branch);
                    }
                    Ok(self.zbdd.minimize(acc))
                }
                Expansion::AtLeast(k, refs) => {
                    if k == 0 {
                        return self.gen(rest, chosen, prefix);
                    }
                    if k > refs.len() {
                        return Ok(ZBDD_EMPTY);
                    }
                    let mut acc = ZBDD_EMPTY;
                    for combo in combinations(&refs, k) {
                        let mut obl = combo;
                        obl.extend_from_slice(rest);
                        let branch = self.gen(&obl, chosen, prefix)?;
                        acc = self.zbdd.union(acc, branch);
                    }
                    Ok(self.zbdd.minimize(acc))
                }
                Expansion::Unsupported => Err(PraxisError::Logic(
                    "direct ZBDD: XOR/IFF must be normalized before building".to_string(),
                )),
            },
            NodeKind::Missing => Ok(ZBDD_EMPTY),
        }
    }

    fn build_topdown(&mut self) -> Result<ZbddRef> {
        let root = self
            .pdag
            .root()
            .ok_or_else(|| PraxisError::Logic("direct ZBDD: PDAG has no root".to_string()))?;
        let eff = if self.pdag.complement() { -root } else { root };
        debug!(target: "praxis::direct_zbdd", root = eff, cut_off = ?self.cut_off, "top-down build start");
        let mut chosen = Vec::new();
        let r = self.gen(&[eff], &mut chosen, 1.0)?;
        debug!(target: "praxis::direct_zbdd", root_family = r.raw(), total_nodes = self.zbdd.node_count(), "top-down build done");
        Ok(r)
    }

    fn maxcs(&mut self, r: NodeIndex) -> f64 {
        if let Some(&m) = self.maxcs_memo.get(&r) {
            return m;
        }
        let neg = r < 0;
        let m = match self.kind(r) {
            NodeKind::Basic(l) => {
                if neg {
                    self.var_prob(2 * l + 1)
                } else {
                    self.var_prob(2 * l)
                }
            }
            NodeKind::Constant(value) => {
                if value ^ neg {
                    1.0
                } else {
                    0.0
                }
            }
            NodeKind::Gate(conn, ops, min) => match gate_expansion(conn, neg, &ops, min) {
                Expansion::Conjunction(refs) => refs
                    .iter()
                    .map(|&c| self.maxcs(c))
                    .fold(f64::INFINITY, f64::min),
                Expansion::Disjunction(refs) => {
                    refs.iter().map(|&c| self.maxcs(c)).fold(0.0_f64, f64::max)
                }
                Expansion::AtLeast(k, refs) => {
                    let mut ms: Vec<f64> = refs.iter().map(|&c| self.maxcs(c)).collect();
                    ms.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
                    ms.get(k.saturating_sub(1)).copied().unwrap_or(0.0)
                }
                Expansion::Unsupported => 0.0,
            },
            NodeKind::Missing => 0.0,
        };
        self.maxcs_memo.insert(r, m);
        m
    }

    fn canon_ref(&self, r: NodeIndex) -> NodeIndex {
        if self.canon.is_empty() {
            return r;
        }
        let c = self.canon.get(&r.abs()).copied().unwrap_or_else(|| r.abs());
        if r < 0 {
            -c
        } else {
            c
        }
    }

    fn cut_sets_b(
        &mut self,
        r: NodeIndex,
        budget: f64,
        apply_delete_terms: bool,
    ) -> Result<ZbddRef> {
        self.explored += 1;
        if self.explored.is_multiple_of(50_000_000) {
            tracing::info!(
                target: "praxis::direct_zbdd",
                explored = self.explored,
                nodes = self.zbdd.node_count(),
                buckets = self.budget_cache.len(),
                "budgeted delterm exploring"
            );
        }
        if self.gc_cache > 0
            && self.explored.is_multiple_of(1024)
            && self.zbdd.op_cache_len() > self.gc_cache
        {
            self.zbdd.clear_op_caches();
        }
        let b = budget_bucket(budget);
        let ck = self.canon_ref(r);
        if let Some(&z) = self.budget_cache.get(&(ck, b, apply_delete_terms)) {
            return Ok(self.truncate_budgeted(z, budget));
        }
        let build_budget = 10f64.powi(b);
        let raw_family = self.compute_b(r, build_budget, apply_delete_terms)?;
        let family = self.truncate_budgeted(raw_family, build_budget);
        self.budget_cache
            .insert((ck, b, apply_delete_terms), family);
        Ok(self.truncate_budgeted(family, budget))
    }

    fn compute_b(
        &mut self,
        r: NodeIndex,
        budget: f64,
        apply_delete_terms: bool,
    ) -> Result<ZbddRef> {
        let neg = r < 0;
        if let Some(m) = self.mutex_node {
            if r.abs() == m {
                return Ok(ZBDD_EMPTY);
            }
        }
        if apply_delete_terms && r > 0 {
            if let Some(PdagNode::Gate {
                connective: Connective::Not,
                operands,
                ..
            }) = self.pdag.get_node(r)
            {
                if let Some(&t) = operands.first() {
                    if t > 0 && matches!(self.pdag.get_node(t), Some(PdagNode::Gate { .. })) {
                        return Ok(ZBDD_BASE);
                    }
                }
            }
        }
        let result = match self.kind(r) {
            NodeKind::Basic(l) => {
                let var = if neg { 2 * l + 1 } else { 2 * l };
                if self.var_prob(var) >= budget {
                    self.zbdd.multiply(var, ZBDD_BASE)
                } else {
                    ZBDD_EMPTY
                }
            }
            NodeKind::Constant(value) => {
                if value ^ neg {
                    ZBDD_BASE
                } else {
                    ZBDD_EMPTY
                }
            }
            NodeKind::Gate(conn, ops, min) => {
                let expansion = gate_expansion(conn, neg, &ops, min);
                match expansion {
                    Expansion::Conjunction(refs) => {
                        self.and_build_b(&refs, budget, apply_delete_terms)?
                    }
                    Expansion::Disjunction(refs) => {
                        let mut acc = ZBDD_EMPTY;
                        for op in refs {
                            let c = self.cut_sets_b(op, budget, apply_delete_terms)?;
                            acc = self.zbdd.union(acc, c);
                            acc = self.truncate_budgeted(acc, budget);
                        }
                        let acc = self.zbdd.minimize(acc);
                        self.truncate_budgeted(acc, budget)
                    }
                    Expansion::AtLeast(k, refs) => {
                        if k == 0 {
                            ZBDD_BASE
                        } else if k > refs.len() {
                            ZBDD_EMPTY
                        } else {
                            let mut acc = ZBDD_EMPTY;
                            for combo in combinations(&refs, k) {
                                let prod = self.and_build_b(&combo, budget, apply_delete_terms)?;
                                acc = self.zbdd.union(acc, prod);
                                acc = self.truncate_budgeted(acc, budget);
                            }
                            let acc = self.zbdd.minimize(acc);
                            self.truncate_budgeted(acc, budget)
                        }
                    }
                    Expansion::Unsupported => {
                        return Err(PraxisError::Logic(
                            "direct ZBDD: XOR/IFF must be normalized before building".to_string(),
                        ));
                    }
                }
            }
            NodeKind::Missing => ZBDD_EMPTY,
        };
        Ok(result)
    }

    fn and_build_b(
        &mut self,
        refs: &[NodeIndex],
        budget: f64,
        apply_delete_terms: bool,
    ) -> Result<ZbddRef> {
        let mut pos: Vec<NodeIndex> = Vec::new();
        let mut deletes: Vec<NodeIndex> = Vec::new();
        for &c in refs {
            if apply_delete_terms {
                match self.as_delete_target(c) {
                    Some(t) => deletes.push(t),
                    None => pos.push(c),
                }
            } else {
                pos.push(c);
            }
        }

        let mut order: Vec<(f64, NodeIndex)> = pos.iter().map(|&c| (self.maxcs(c), c)).collect();
        order.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        let n = order.len();

        let mut budgets = vec![budget; n];
        if let Some(dec) = &self.decomposition {
            for i in 0..n {
                let ci = order[i].1;
                let mut others = f64::INFINITY;
                for (j, oj) in order.iter().enumerate() {
                    if j != i && oj.0 > 0.0 && dec.disjoint(oj.1, ci) {
                        others = others.min(oj.0);
                    }
                }
                if others.is_finite() {
                    budgets[i] = budget / others;
                }
            }
        }

        let mut acc = ZBDD_BASE;
        for i in 0..n {
            let c = self.cut_sets_b(order[i].1, budgets[i], apply_delete_terms)?;
            acc = match self.limit_order {
                Some(max_order) => self.zbdd.join_budgeted_limited(acc, c, budget, max_order),
                None => self.zbdd.join_budgeted(acc, c, budget),
            };
            acc = self.truncate_budgeted(acc, budget);
            acc = self.zbdd.purify(acc);
            acc = self.zbdd.minimize(acc);
            acc = self.truncate_budgeted(acc, budget);
            if acc == ZBDD_EMPTY {
                return Ok(ZBDD_EMPTY);
            }
        }

        for t in deletes {
            if acc == ZBDD_EMPTY {
                break;
            }
            let dmcs = self.cut_sets_b(t, budget, apply_delete_terms)?;
            acc = self.delete_covered(acc, dmcs);
        }
        Ok(acc)
    }

    fn build_delterm(&mut self) -> Result<ZbddRef> {
        let root = self
            .pdag
            .root()
            .ok_or_else(|| PraxisError::Logic("direct ZBDD: PDAG has no root".to_string()))?;
        let eff = if self.pdag.complement() { -root } else { root };
        // For an order-only solve, derive a safe probability floor from the
        // smallest literal probabilities. Every product of at most k literals
        // is at least this probable, so using the floor cannot remove an
        // in-order cut set and lets the probability-aware builder prune the
        // large out-of-order search space early. The explicit order filter is
        // still applied throughout construction.
        let order_floor = self
            .limit_order
            .and_then(|max_order| self.order_probability_floor(max_order));
        let requested_budget = match (self.cut_off, order_floor) {
            (Some(cut_off), Some(floor)) => cut_off.max(floor),
            (Some(cut_off), None) => cut_off,
            (None, Some(floor)) if floor > 0.0 => floor,
            _ => 1e-300,
        };
        let budget = if requested_budget > 0.0 {
            requested_budget
        } else {
            1e-300
        };
        let dec = decompose(&self.pdag)?;
        self.decomposition = Some(dec);
        let r = self.cut_sets_b(eff, budget, true)?;
        let r = self.filter_valid_cut_sets(r, eff)?;
        Ok(self.truncate_budgeted(r, budget))
    }

    fn eval3(
        pdag: &Pdag,
        idx: NodeIndex,
        true_set: &HashSet<NodeIndex>,
        false_set: &HashSet<NodeIndex>,
        default: i8,
        cache: &mut HashMap<NodeIndex, i8>,
    ) -> i8 {
        let node = idx.abs();
        let value = if let Some(&c) = cache.get(&node) {
            c
        } else {
            let r = match pdag.get_node(node) {
                Some(PdagNode::BasicEvent { .. }) => {
                    if true_set.contains(&node) {
                        1
                    } else if false_set.contains(&node) {
                        -1
                    } else {
                        default
                    }
                }
                Some(PdagNode::Constant { value, .. }) => {
                    if *value {
                        1
                    } else {
                        -1
                    }
                }
                Some(PdagNode::Gate {
                    connective,
                    operands,
                    min_number,
                    ..
                }) => {
                    let operands = operands.clone();
                    let conn = *connective;
                    let k = min_number.unwrap_or(1);
                    match conn {
                        Connective::And | Connective::Nand => {
                            let mut r = 1i8;
                            let mut has_x = false;
                            for &o in &operands {
                                let v = Self::eval3(pdag, o, true_set, false_set, default, cache);
                                if v == -1 {
                                    r = -1;
                                    break;
                                }
                                if v == 0 {
                                    has_x = true;
                                }
                            }
                            let a = if r == -1 {
                                -1
                            } else if has_x {
                                0
                            } else {
                                1
                            };
                            if conn == Connective::Nand {
                                -a
                            } else {
                                a
                            }
                        }
                        Connective::Or | Connective::Nor => {
                            let mut r = -1i8;
                            let mut has_x = false;
                            for &o in &operands {
                                let v = Self::eval3(pdag, o, true_set, false_set, default, cache);
                                if v == 1 {
                                    r = 1;
                                    break;
                                }
                                if v == 0 {
                                    has_x = true;
                                }
                            }
                            let a = if r == 1 {
                                1
                            } else if has_x {
                                0
                            } else {
                                -1
                            };
                            if conn == Connective::Nor {
                                -a
                            } else {
                                a
                            }
                        }
                        Connective::Not => operands
                            .first()
                            .map(|&o| -Self::eval3(pdag, o, true_set, false_set, default, cache))
                            .unwrap_or(-1),
                        Connective::Null => operands
                            .first()
                            .map(|&o| Self::eval3(pdag, o, true_set, false_set, default, cache))
                            .unwrap_or(-1),
                        Connective::AtLeast => {
                            let vals: Vec<i8> = operands
                                .iter()
                                .map(|&o| Self::eval3(pdag, o, true_set, false_set, default, cache))
                                .collect();
                            let t = vals.iter().filter(|&&x| x == 1).count();
                            let x = vals.iter().filter(|&&x| x == 0).count();
                            if t >= k {
                                1
                            } else if t + x < k {
                                -1
                            } else {
                                0
                            }
                        }
                        Connective::Xor => {
                            let vals: Vec<i8> = operands
                                .iter()
                                .map(|&o| Self::eval3(pdag, o, true_set, false_set, default, cache))
                                .collect();
                            if vals.contains(&0) {
                                0
                            } else if vals.iter().filter(|&&x| x == 1).count() % 2 == 1 {
                                1
                            } else {
                                -1
                            }
                        }
                        Connective::Iff => {
                            let vals: Vec<i8> = operands
                                .iter()
                                .map(|&o| Self::eval3(pdag, o, true_set, false_set, default, cache))
                                .collect();
                            if vals.contains(&0) {
                                0
                            } else if vals.iter().all(|&x| x == vals[0]) {
                                1
                            } else {
                                -1
                            }
                        }
                    }
                }
                None => -1,
            };
            cache.insert(node, r);
            trace!(target: "praxis::direct_zbdd", node = node, value = r, "eval3: ternary value (1=true, -1=false, 0=unknown)");
            r
        };
        if idx < 0 {
            -value
        } else {
            value
        }
    }

    fn finish_named(&mut self, root: ZbddRef) -> Result<Vec<Vec<String>>> {
        let mut inv: HashMap<usize, NodeIndex> = HashMap::new();
        for (&idx, &lvl) in &self.level {
            inv.insert(lvl, idx);
        }
        let root = self.finish_root(root);
        let mut out: Vec<Vec<String>> = Vec::new();
        for cs in self.zbdd.enumerate(root) {
            let mut names: Vec<String> = Vec::new();
            for v in cs {
                let lvl = v / 2;
                let neg = v % 2 == 1;
                let name = inv
                    .get(&lvl)
                    .and_then(|idx| self.pdag.get_node(*idx))
                    .and_then(|n| n.id())
                    .unwrap_or("?")
                    .to_string();
                names.push(if neg { format!("~{}", name) } else { name });
            }
            names.sort();
            names.dedup();
            out.push(names);
        }
        out.sort();
        out.dedup();
        Ok(out)
    }

    fn filter_valid_cut_sets(&mut self, root: ZbddRef, eff: NodeIndex) -> Result<ZbddRef> {
        let default = if self.has_xor { 0 } else { -1 };
        let mut inv: HashMap<usize, NodeIndex> = HashMap::new();
        for (&idx, &lvl) in &self.level {
            inv.insert(lvl, idx);
        }
        let cut_sets = self.zbdd.enumerate(root);
        let pdag = &self.pdag;
        let inv_ref = &inv;
        let workers = std::thread::available_parallelism()
            .map(|x| x.get())
            .unwrap_or(4)
            .min(16);
        let chunk = cut_sets.len().div_ceil(workers).max(1);
        let parts: Vec<Vec<Vec<usize>>> = std::thread::scope(|s| {
            let handles: Vec<_> = cut_sets
                .chunks(chunk)
                .map(|slice| {
                    std::thread::Builder::new()
                        .stack_size(128 * 1024 * 1024)
                        .spawn_scoped(s, move || {
                            let mut lv: Vec<Vec<usize>> = Vec::new();
                            for cs in slice {
                                let mut true_set: HashSet<NodeIndex> = HashSet::new();
                                let mut false_set: HashSet<NodeIndex> = HashSet::new();
                                for &v in cs {
                                    if let Some(&idx) = inv_ref.get(&(v / 2)) {
                                        if v % 2 == 0 {
                                            true_set.insert(idx);
                                        } else {
                                            false_set.insert(idx);
                                        }
                                    }
                                }
                                let mut cache: HashMap<NodeIndex, i8> = HashMap::new();
                                let verdict = Self::eval3(
                                    pdag, eff, &true_set, &false_set, default, &mut cache,
                                );
                                if verdict != -1 {
                                    lv.push(cs.clone());
                                }
                            }
                            lv
                        })
                        .expect("spawn filter worker")
                })
                .collect();
            handles
                .into_iter()
                .map(|h| h.join().expect("filter worker join"))
                .collect()
        });
        let mut valid: Vec<Vec<usize>> = Vec::new();
        for lv in parts {
            valid.extend(lv);
        }
        let mut out = ZBDD_EMPTY;
        for cs in &valid {
            let mut vars = cs.clone();
            vars.sort_by_key(|v| std::cmp::Reverse(*v / 2));
            let mut prod = ZBDD_BASE;
            for &v in &vars {
                prod = self.zbdd.multiply(v, prod);
            }
            out = self.zbdd.union(out, prod);
        }
        Ok(out)
    }
}

fn budget_bucket(budget: f64) -> i32 {
    if budget.is_nan() || budget <= 0.0 {
        return 1;
    }
    if budget >= 1.0 {
        return 0;
    }
    budget.log10().floor() as i32
}

/// Build one event-tree sequence directly from its shared PDAG. The sequence
/// failure root and all succeeded-system delete roots are evaluated in the same
/// ZBDD manager so delete-term subtraction can share one variable order.
pub fn build_sequence_zbdd_from_pdag(
    pdag: &Pdag,
    event_probabilities: &HashMap<String, f64>,
    sequence_root: NodeIndex,
    success_roots: &[NodeIndex],
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    scale: f64,
) -> Result<(ZbddEngine, ZbddRef, Vec<Option<String>>)> {
    let mut scoped = pdag.clone();
    let success_scope = match success_roots {
        [] => None,
        [root] => Some(*root),
        roots => Some(scoped.add_gate(
            "__EVENT_TREE_SUCCESS_SCOPE__".to_string(),
            Connective::Or,
            roots.to_vec(),
            None,
        )?),
    };
    if let Some(success_scope) = success_scope {
        let scope = scoped.add_gate(
            "__EVENT_TREE_SEQUENCE_SCOPE__".to_string(),
            Connective::Or,
            vec![sequence_root, success_scope],
            None,
        )?;
        scoped.set_root(scope)?;
    } else {
        scoped.set_root(sequence_root)?;
    }

    let mut builder =
        Builder::new_with_probability_map(&scoped, event_probabilities, cut_off, limit_order)?;
    // Keep the analyst's frequency cut-off unchanged. Every truncation check
    // compares scale * conditional_probability directly against that cut-off.
    builder.zbdd.set_scale(scale);

    let mut root = builder.cut_sets(sequence_root)?;
    if let Some(success_scope) = success_scope.filter(|_| !root.is_empty()) {
        // Match SAPHIRE's two-pass sequence algorithm. First solve the failed
        // systems. Then restrict the combined succeeded-system tree to events
        // that occur anywhere in the retained failed-system cut sets. Success
        // cut sets are used only as logical delete patterns, so probability
        // truncation must not be applied to them. An order above the largest
        // failed cut set cannot match and is safely excluded.
        let allowed_levels: HashSet<usize> = builder
            .zbdd
            .support_variables(root)
            .into_iter()
            .map(|variable| variable / 2)
            .collect();
        let success_order_limit = builder.zbdd.count_by_order(root).keys().copied().max();
        let saved_cut_off = builder.cut_off.take();
        let saved_limit_order = builder.limit_order.take();
        builder.limit_order = success_order_limit;
        builder.allowed_levels = Some(allowed_levels);
        builder.cache.clear();
        let delete_result = builder.cut_sets(success_scope);
        builder.allowed_levels = None;
        builder.cut_off = saved_cut_off;
        builder.limit_order = saved_limit_order;
        builder.cache.clear();
        let delete = delete_result?;
        root = builder.zbdd.nonsuperset(root, delete);
    }
    root = builder.zbdd.minimize(root);
    root = builder.truncate(root);
    let event_names = builder.event_names();
    Ok((builder.zbdd, root, event_names))
}

/// Solve every sequence in one ZBDD manager with one variable order, then
/// union and minimize the roots for each named end state.
pub struct EndStateSequence {
    pub end_state: String,
    pub failure_root: Option<NodeIndex>,
    pub success_roots: Vec<NodeIndex>,
}

pub fn build_end_state_zbdd_from_pdag(
    pdag: &Pdag,
    event_probabilities: &HashMap<String, f64>,
    sequences: &[EndStateSequence],
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    scale: f64,
) -> Result<(
    ZbddEngine,
    BTreeMap<String, (String, ZbddRef)>,
    Vec<Option<String>>,
)> {
    build_end_state_zbdd_from_pdag_internal(
        pdag,
        event_probabilities,
        sequences,
        cut_off,
        limit_order,
        scale,
        None,
    )
}

pub fn build_end_state_zbdd_from_pdag_with_order(
    pdag: &Pdag,
    event_probabilities: &HashMap<String, f64>,
    sequences: &[EndStateSequence],
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    scale: f64,
    variable_order: VariableOrder,
    reorder_budget: std::time::Duration,
) -> Result<(
    ZbddEngine,
    BTreeMap<String, (String, ZbddRef)>,
    Vec<Option<String>>,
)> {
    build_end_state_zbdd_from_pdag_internal(
        pdag,
        event_probabilities,
        sequences,
        cut_off,
        limit_order,
        scale,
        Some((variable_order, reorder_budget)),
    )
}

fn build_end_state_zbdd_from_pdag_internal(
    pdag: &Pdag,
    event_probabilities: &HashMap<String, f64>,
    sequences: &[EndStateSequence],
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    scale: f64,
    ordering: Option<(VariableOrder, std::time::Duration)>,
) -> Result<(
    ZbddEngine,
    BTreeMap<String, (String, ZbddRef)>,
    Vec<Option<String>>,
)> {
    let mut scoped = pdag.clone();
    let mut jobs = Vec::with_capacity(sequences.len());
    let mut all_roots = Vec::new();
    for sequence in sequences {
        if sequence.end_state.trim().is_empty() {
            return Err(PraxisError::Logic(
                "end-state name must not be empty".into(),
            ));
        }
        let success_scope = match (sequence.failure_root, sequence.success_roots.as_slice()) {
            (None, _) | (_, []) => None,
            (_, [root]) => Some(*root),
            (_, roots) => Some(scoped.add_gate(
                format!("__SHARED_SUCCESS_SCOPE_{}__", jobs.len()),
                Connective::Or,
                roots.to_vec(),
                None,
            )?),
        };
        if let Some(root) = sequence.failure_root {
            all_roots.push(root);
        }
        if let Some(root) = success_scope {
            all_roots.push(root);
        }
        jobs.push((
            sequence.end_state.trim().to_string(),
            sequence.failure_root,
            success_scope,
        ));
    }
    if jobs.is_empty() {
        return Ok((ZbddEngine::new(), BTreeMap::new(), Vec::new()));
    }
    if all_roots.is_empty() {
        let mut groups = BTreeMap::new();
        for (name, _, _) in jobs {
            groups
                .entry(name.to_ascii_lowercase())
                .or_insert((name, ZBDD_BASE));
        }
        return Ok((ZbddEngine::new(), groups, Vec::new()));
    }
    if !all_roots.is_empty() {
        let scope_root = scoped.add_gate(
            "__SHARED_END_STATE_SCOPE__".to_string(),
            Connective::Or,
            all_roots,
            None,
        )?;
        scoped.set_root(scope_root)?;
    }

    // The global scope drives the same order heuristic as the ordinary solver.
    // Add any basic events lost to OR absorption so every sequence can still
    // address the same complete event universe.
    let mut order = match ordering {
        Some((method, budget)) => select_configured_variable_order(&scoped, method, budget)?,
        None => select_variable_order(&scoped)?,
    };
    let mut seen: HashSet<NodeIndex> = order.iter().copied().collect();
    let mut remaining: Vec<(String, NodeIndex)> = scoped
        .nodes()
        .iter()
        .filter_map(|(&index, node)| match node {
            PdagNode::BasicEvent { id, .. } if !seen.contains(&index) => Some((id.clone(), index)),
            _ => None,
        })
        .collect();
    remaining.sort();
    for (_, index) in remaining {
        if seen.insert(index) {
            order.push(index);
        }
    }
    let mut builder = Builder::new_with_probability_source(
        &scoped,
        cut_off,
        limit_order,
        false,
        Some(order),
        None,
        |id| (event_probabilities.get(id).copied().unwrap_or(0.0), false),
    )?;
    builder.zbdd.set_scale(scale);
    let mut groups: BTreeMap<String, (String, ZbddRef)> = BTreeMap::new();
    for (end_state, failure_root, success_scope) in jobs {
        let mut root = match failure_root {
            Some(failure_root) => builder.cut_sets(failure_root)?,
            None => ZBDD_BASE,
        };
        if let Some(success_scope) = success_scope.filter(|_| !root.is_empty()) {
            let allowed_levels: HashSet<usize> = builder
                .zbdd
                .support_variables(root)
                .into_iter()
                .map(|variable| variable / 2)
                .collect();
            let success_order_limit = builder.zbdd.count_by_order(root).keys().copied().max();
            let saved_cut_off = builder.cut_off.take();
            let saved_limit_order = builder.limit_order.take();
            builder.limit_order = success_order_limit;
            builder.allowed_levels = Some(allowed_levels);
            builder.cache.clear();
            let delete_result = builder.cut_sets(success_scope);
            builder.allowed_levels = None;
            builder.cut_off = saved_cut_off;
            builder.limit_order = saved_limit_order;
            builder.cache.clear();
            let delete = delete_result?;
            root = builder.zbdd.nonsuperset(root, delete);
        }
        root = builder.zbdd.minimize(root);
        root = builder.truncate(root);
        let key = end_state.to_ascii_lowercase();
        let previous = groups
            .get(&key)
            .map(|(_, root)| *root)
            .unwrap_or(ZBDD_EMPTY);
        let joined = builder.zbdd.union(previous, root);
        let minimal = builder.zbdd.minimize(joined);
        builder.zbdd.deref(root);
        builder.zbdd.deref(joined);
        if !previous.is_empty() {
            builder.zbdd.deref(previous);
        }
        groups
            .entry(key)
            .and_modify(|(_, group_root)| *group_root = minimal)
            .or_insert((end_state, minimal));
    }
    let names = builder.event_names();
    Ok((builder.zbdd, groups, names))
}

/// Diagnostic form of the event-tree sequence builder. It exposes the retained
/// failed-system family, the successful-system delete patterns, and the final
/// family in the same ZBDD manager for set-by-set comparison.
pub fn diagnose_sequence_zbdd_from_pdag(
    pdag: &Pdag,
    event_probabilities: &HashMap<String, f64>,
    sequence_root: NodeIndex,
    success_roots: &[NodeIndex],
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    scale: f64,
) -> Result<(ZbddEngine, ZbddRef, ZbddRef, ZbddRef, Vec<Option<String>>)> {
    let mut scoped = pdag.clone();
    let success_scope = match success_roots {
        [] => None,
        [root] => Some(*root),
        roots => Some(scoped.add_gate(
            "__EVENT_TREE_SUCCESS_SCOPE__".to_string(),
            Connective::Or,
            roots.to_vec(),
            None,
        )?),
    };
    if let Some(success_scope) = success_scope {
        let scope = scoped.add_gate(
            "__EVENT_TREE_SEQUENCE_SCOPE__".to_string(),
            Connective::Or,
            vec![sequence_root, success_scope],
            None,
        )?;
        scoped.set_root(scope)?;
    } else {
        scoped.set_root(sequence_root)?;
    }

    let mut builder =
        Builder::new_with_probability_map(&scoped, event_probabilities, cut_off, limit_order)?;
    // Keep the analyst's frequency cut-off unchanged. Every truncation check
    // compares scale * conditional_probability directly against that cut-off.
    builder.zbdd.set_scale(scale);

    let failure = builder.cut_sets(sequence_root)?;
    let mut delete = ZBDD_EMPTY;
    let mut final_root = failure;
    if let Some(success_scope) = success_scope.filter(|_| !failure.is_empty()) {
        let allowed_levels: HashSet<usize> = builder
            .zbdd
            .support_variables(failure)
            .into_iter()
            .map(|variable| variable / 2)
            .collect();
        let success_order_limit = builder.zbdd.count_by_order(failure).keys().copied().max();
        let saved_cut_off = builder.cut_off.take();
        let saved_limit_order = builder.limit_order.take();
        builder.limit_order = success_order_limit;
        builder.allowed_levels = Some(allowed_levels);
        builder.cache.clear();
        delete = builder.cut_sets(success_scope)?;
        builder.allowed_levels = None;
        builder.cut_off = saved_cut_off;
        builder.limit_order = saved_limit_order;
        builder.cache.clear();
        final_root = builder.zbdd.nonsuperset(failure, delete);
    }
    final_root = builder.zbdd.minimize(final_root);
    final_root = builder.truncate(final_root);
    let event_names = builder.event_names();
    Ok((builder.zbdd, failure, delete, final_root, event_names))
}

pub fn build_zbdd_from_pdag(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
) -> Result<(ZbddEngine, ZbddRef)> {
    let (zbdd, root, _) = build_zbdd_direct_from_pdag(pdag, fault_tree, cut_off, limit_order)?;
    Ok((zbdd, root))
}

/// Build the minimal cut-set family directly from the fault-tree PDAG. No BDD
/// is constructed and no delete-term subtraction is performed.
pub fn build_zbdd_direct_from_pdag(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
) -> Result<(ZbddEngine, ZbddRef, Vec<Option<String>>)> {
    let mut builder = Builder::new(pdag, fault_tree, cut_off, limit_order)?;
    let root = builder.build()?;
    let event_names = builder.event_names();
    Ok((builder.zbdd, root, event_names))
}

pub fn build_zbdd_direct_from_pdag_with_order(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    variable_order: VariableOrder,
    reorder_budget: std::time::Duration,
) -> Result<(ZbddEngine, ZbddRef, Vec<Option<String>>)> {
    let mut builder = Builder::new_with_order(
        pdag,
        fault_tree,
        cut_off,
        limit_order,
        variable_order,
        reorder_budget,
    )?;
    let root = builder.build()?;
    let event_names = builder.event_names();
    Ok((builder.zbdd, root, event_names))
}

pub fn enumerate_named_cut_sets(
    zbdd: &ZbddEngine,
    root: ZbddRef,
    event_names: &[Option<String>],
) -> Vec<Vec<String>> {
    let mut output = Vec::new();
    zbdd.for_each_set(root, |set| {
        let mut names: Vec<String> = set
            .iter()
            .filter_map(|&variable| event_names.get(variable).and_then(Clone::clone))
            .collect();
        names.sort();
        names.dedup();
        output.push(names);
    });
    output.sort();
    output.dedup();
    output
}

pub fn build_zbdd_topdown(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    mutex_gate: Option<&str>,
) -> Result<(ZbddEngine, ZbddRef)> {
    let mut builder = Builder::new(pdag, fault_tree, cut_off, limit_order)?;
    if let Some(name) = mutex_gate {
        builder.setup_mutex(name)?;
    }
    let root = builder.build_topdown()?;
    Ok((builder.zbdd, root))
}

pub fn build_zbdd_delterm(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    mutex_gate: Option<&str>,
) -> Result<(ZbddEngine, ZbddRef)> {
    let mut builder = Builder::new(pdag, fault_tree, cut_off, limit_order)?;
    if let Some(name) = mutex_gate {
        builder.setup_mutex(name)?;
    }
    let root = builder.build_delterm()?;
    Ok((builder.zbdd, root))
}

pub fn build_zbdd_delterm_named(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    mutex_gate: Option<&str>,
) -> Result<Vec<Vec<String>>> {
    let mut builder = Builder::new(pdag, fault_tree, cut_off, limit_order)?;
    if let Some(name) = mutex_gate {
        builder.setup_mutex(name)?;
    }

    let root = builder.build_delterm()?;
    builder.finish_named(root)
}

pub fn build_zbdd_delterm_named_with_order(
    pdag: &Pdag,
    fault_tree: &FaultTree,
    cut_off: Option<f64>,
    limit_order: Option<usize>,
    mutex_gate: Option<&str>,
    variable_order: VariableOrder,
    reorder_budget: std::time::Duration,
) -> Result<Vec<Vec<String>>> {
    let mut builder = Builder::new_with_order(
        pdag,
        fault_tree,
        cut_off,
        limit_order,
        variable_order,
        reorder_budget,
    )?;
    if let Some(name) = mutex_gate {
        builder.setup_mutex(name)?;
    }

    let root = builder.build_delterm()?;
    builder.finish_named(root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::parser::parse_fault_tree;

    const MUTEX_MODEL: &str = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="TOP">
    <define-gate name="TOP"><or><gate name="s1"/><gate name="s2"/><gate name="MUTEX"/></or></define-gate>
    <define-gate name="s1"><and><basic-event name="A"/><basic-event name="B"/></and></define-gate>
    <define-gate name="s2"><and><basic-event name="A"/><basic-event name="C"/></and></define-gate>
    <define-gate name="MUTEX"><and><basic-event name="A"/><basic-event name="C"/></and></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="A"><float value="0.1"/></define-basic-event>
    <define-basic-event name="B"><float value="0.1"/></define-basic-event>
    <define-basic-event name="C"><float value="0.1"/></define-basic-event>
  </model-data>
</opsa-mef>"#;

    const ORDER_LIMIT_MODEL: &str = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="TOP">
    <define-gate name="TOP"><or><basic-event name="A"/><gate name="BC"/></or></define-gate>
    <define-gate name="BC"><and><basic-event name="B"/><basic-event name="C"/></and></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="A"><float value="1e-20"/></define-basic-event>
    <define-basic-event name="B"><float value="0.1"/></define-basic-event>
    <define-basic-event name="C"><float value="0.1"/></define-basic-event>
  </model-data>
</opsa-mef>"#;

    const CONSENSUS_MODEL: &str = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="TOP">
    <define-gate name="TOP"><or><gate name="AX"/><gate name="ANX"/></or></define-gate>
    <define-gate name="AX"><and><basic-event name="A"/><basic-event name="X"/></and></define-gate>
    <define-gate name="ANX"><and><basic-event name="A"/><gate name="NOT-X"/></and></define-gate>
    <define-gate name="NOT-X"><not><basic-event name="X"/></not></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="A"><float value="0.1"/></define-basic-event>
    <define-basic-event name="X"><float value="0.2"/></define-basic-event>
  </model-data>
</opsa-mef>"#;

    fn topdown_cut_sets(mutex: Option<&str>) -> u64 {
        let ft = parse_fault_tree(MUTEX_MODEL).unwrap();
        let pdag = Pdag::from_fault_tree(&ft).unwrap();
        let (zbdd, root) = build_zbdd_topdown(&pdag, &ft, Some(1e-12), None, mutex).unwrap();
        zbdd.count_by_order(root).values().sum()
    }

    #[test]
    fn delete_term_drops_mutually_exclusive_cut_sets() {
        assert_eq!(topdown_cut_sets(None), 2);
        assert_eq!(topdown_cut_sets(Some("MUTEX")), 1);
    }

    #[test]
    fn delete_term_applies_order_limit_during_budgeted_build() {
        let ft = parse_fault_tree(MUTEX_MODEL).unwrap();
        let pdag = Pdag::from_fault_tree(&ft).unwrap();
        let (zbdd, root) = build_zbdd_delterm(&pdag, &ft, None, Some(1), None).unwrap();

        assert!(root.is_empty());
        assert!(zbdd.count_by_order(root).is_empty());
    }

    #[test]
    fn delete_term_order_limit_keeps_rare_in_order_cut_set() {
        let ft = parse_fault_tree(ORDER_LIMIT_MODEL).unwrap();
        let pdag = Pdag::from_fault_tree(&ft).unwrap();
        let sets = build_zbdd_delterm_named(&pdag, &ft, None, Some(1), None).unwrap();

        assert_eq!(sets, vec![vec!["A".to_string()]]);
    }

    #[test]
    fn direct_zbdd_applies_order_limit_during_construction() {
        let ft = parse_fault_tree(ORDER_LIMIT_MODEL).unwrap();
        let pdag = Pdag::from_fault_tree(&ft).unwrap();
        let (zbdd, root, names) = build_zbdd_direct_from_pdag(&pdag, &ft, None, Some(1)).unwrap();

        assert_eq!(
            enumerate_named_cut_sets(&zbdd, root, &names),
            vec![vec!["A".to_string()]]
        );
    }

    #[test]
    fn direct_zbdd_consensus_eliminates_complementary_selector() {
        let ft = parse_fault_tree(CONSENSUS_MODEL).unwrap();
        let pdag = Pdag::from_fault_tree(&ft).unwrap();
        let (zbdd, root, names) = build_zbdd_direct_from_pdag(&pdag, &ft, None, Some(1)).unwrap();

        assert_eq!(
            enumerate_named_cut_sets(&zbdd, root, &names),
            vec![vec!["A".to_string()]]
        );
    }

    #[test]
    fn event_tree_sequence_builds_directly_and_applies_delete_terms() {
        let mut pdag = Pdag::new();
        let a = pdag.add_basic_event("A".to_string());
        let b = pdag.add_basic_event("B".to_string());
        let c = pdag.add_basic_event("C".to_string());
        let bc = pdag
            .add_gate("BC".to_string(), Connective::And, vec![b, c], None)
            .unwrap();
        let sequence = pdag
            .add_gate("SEQ".to_string(), Connective::Or, vec![a, bc], None)
            .unwrap();
        pdag.set_root(sequence).unwrap();

        let probabilities = HashMap::from([
            ("A".to_string(), 0.1),
            ("B".to_string(), 0.2),
            ("C".to_string(), 0.3),
        ]);
        let (zbdd, root, names) =
            build_sequence_zbdd_from_pdag(&pdag, &probabilities, sequence, &[b], None, None, 1.0)
                .unwrap();

        let mut sets: Vec<Vec<String>> = zbdd
            .enumerate(root)
            .iter()
            .map(|set| {
                let mut result: Vec<String> = set
                    .iter()
                    .filter_map(|&var| names.get(var).and_then(Clone::clone))
                    .collect();
                result.sort();
                result
            })
            .collect();
        sets.sort();
        assert_eq!(sets, vec![vec!["A".to_string()]]);
    }

    #[test]
    fn event_tree_sequence_scales_frequency_cutoff() {
        let mut pdag = Pdag::new();
        let a = pdag.add_basic_event("A".to_string());
        let b = pdag.add_basic_event("B".to_string());
        let sequence = pdag
            .add_gate("SEQ".to_string(), Connective::Or, vec![a, b], None)
            .unwrap();
        pdag.set_root(sequence).unwrap();
        let probabilities = HashMap::from([("A".to_string(), 0.1), ("B".to_string(), 0.01)]);

        let (zbdd, root, _) = build_sequence_zbdd_from_pdag(
            &pdag,
            &probabilities,
            sequence,
            &[],
            Some(0.5),
            None,
            10.0,
        )
        .unwrap();
        assert_eq!(zbdd.count_by_order(root).values().sum::<u64>(), 1);
    }

    #[test]
    fn event_tree_sequence_keeps_internal_probability_one_flag_semantics() {
        let mut pdag = Pdag::new();
        let flag = pdag.add_basic_event("FLAG".to_string());
        let a = pdag.add_basic_event("A".to_string());
        let b = pdag.add_basic_event("B".to_string());
        let not_flag = pdag
            .add_gate("NOT-FLAG".to_string(), Connective::Not, vec![flag], None)
            .unwrap();
        let flagged = pdag
            .add_gate("FLAGGED".to_string(), Connective::And, vec![flag, a], None)
            .unwrap();
        let unflagged = pdag
            .add_gate(
                "UNFLAGGED".to_string(),
                Connective::And,
                vec![not_flag, b],
                None,
            )
            .unwrap();
        let root = pdag
            .add_gate(
                "TOP".to_string(),
                Connective::Or,
                vec![flagged, unflagged],
                None,
            )
            .unwrap();
        pdag.set_root(root).unwrap();

        let probabilities = HashMap::from([
            ("FLAG".to_string(), 1.0),
            ("A".to_string(), 0.1),
            ("B".to_string(), 0.2),
        ]);
        let (zbdd, root, names) =
            build_sequence_zbdd_from_pdag(&pdag, &probabilities, root, &[], Some(1e-12), None, 1.0)
                .unwrap();
        let sets: Vec<Vec<String>> = zbdd
            .enumerate(root)
            .iter()
            .map(|set| {
                let mut result: Vec<String> = set
                    .iter()
                    .filter_map(|&var| names.get(var).and_then(Clone::clone))
                    .collect();
                result.sort();
                result
            })
            .collect();
        assert_eq!(sets, vec![vec!["A".to_string(), "FLAG".to_string()]]);
    }

    #[test]
    fn event_tree_sequence_preserves_variables_absorbed_by_the_scope_root() {
        let mut pdag = Pdag::new();
        let a = pdag.add_basic_event("A".to_string());
        let b = pdag.add_basic_event("B".to_string());
        let success = pdag
            .add_gate("SUCCESS".to_string(), Connective::And, vec![a, b], None)
            .unwrap();
        pdag.set_root(a).unwrap();
        let probabilities = HashMap::from([("A".to_string(), 0.1), ("B".to_string(), 0.2)]);

        // The synthetic scope is A OR (A AND B), which constant propagation
        // can reduce to A. B must nevertheless remain available when the
        // original SUCCESS root is built for delete-term subtraction.
        let (zbdd, root, names) =
            build_sequence_zbdd_from_pdag(&pdag, &probabilities, a, &[success], None, None, 1.0)
                .unwrap();

        let sets: Vec<Vec<String>> = zbdd
            .enumerate(root)
            .iter()
            .map(|set| {
                set.iter()
                    .filter_map(|&var| names.get(var).and_then(Clone::clone))
                    .collect()
            })
            .collect();
        assert_eq!(sets, vec![vec!["A".to_string()]]);
    }

    #[test]
    fn end_state_shared_manager_deduplicates_and_removes_cross_sequence_supersets() {
        let mut pdag = Pdag::new();
        let a = pdag.add_basic_event("A".into());
        let b = pdag.add_basic_event("B".into());
        let c = pdag.add_basic_event("C".into());
        let d = pdag.add_basic_event("D".into());
        let ab = pdag
            .add_gate("AB".into(), Connective::And, vec![a, b], None)
            .unwrap();
        let abc = pdag
            .add_gate("ABC".into(), Connective::And, vec![a, b, c], None)
            .unwrap();
        let first = pdag
            .add_gate("FIRST".into(), Connective::Or, vec![ab, c], None)
            .unwrap();
        let second = pdag
            .add_gate("SECOND".into(), Connective::Or, vec![b, abc, d], None)
            .unwrap();
        pdag.set_root(first).unwrap();
        let jobs = vec![
            EndStateSequence {
                end_state: "FAILED".into(),
                failure_root: Some(first),
                success_roots: vec![],
            },
            EndStateSequence {
                end_state: "failed".into(),
                failure_root: Some(second),
                success_roots: vec![],
            },
            EndStateSequence {
                end_state: "OTHER".into(),
                failure_root: Some(first),
                success_roots: vec![],
            },
        ];
        let probabilities = HashMap::from([
            ("A".into(), 0.1),
            ("B".into(), 0.1),
            ("C".into(), 0.1),
            ("D".into(), 0.1),
        ]);
        let (engine, groups, names) =
            build_end_state_zbdd_from_pdag(&pdag, &probabilities, &jobs, None, None, 1.0).unwrap();
        assert_eq!(groups.len(), 2);
        let named = |root| {
            let mut products: Vec<Vec<String>> = engine
                .enumerate(root)
                .into_iter()
                .map(|set| {
                    let mut product: Vec<String> = set
                        .into_iter()
                        .map(|variable| names[variable].clone().unwrap())
                        .collect();
                    product.sort();
                    product
                })
                .collect();
            products.sort();
            products
        };
        assert_eq!(
            named(groups["failed"].1),
            vec![vec!["B"], vec!["C"], vec!["D"]]
        );
        assert_eq!(named(groups["other"].1), vec![vec!["A", "B"], vec!["C"]]);
        assert_eq!(groups["failed"].0, "FAILED");
    }

    #[test]
    fn end_state_shared_manager_handles_unconditional_sequences() {
        let mut pdag = Pdag::new();
        let a = pdag.add_basic_event("A".into());
        pdag.set_root(a).unwrap();
        let jobs = vec![EndStateSequence {
            end_state: "ALL".into(),
            failure_root: None,
            success_roots: vec![a],
        }];
        let (engine, groups, names) =
            build_end_state_zbdd_from_pdag(&pdag, &HashMap::new(), &jobs, None, None, 1.0).unwrap();
        assert!(names.is_empty());
        assert_eq!(engine.enumerate(groups["all"].1), vec![Vec::<usize>::new()]);
    }

    #[test]
    fn end_state_shared_manager_applies_frequency_and_order_limits() {
        let mut pdag = Pdag::new();
        let a = pdag.add_basic_event("A".into());
        let b = pdag.add_basic_event("B".into());
        let c = pdag.add_basic_event("C".into());
        let bc = pdag
            .add_gate("BC".into(), Connective::And, vec![b, c], None)
            .unwrap();
        let first = pdag
            .add_gate("FIRST".into(), Connective::Or, vec![a, bc], None)
            .unwrap();
        let second = pdag
            .add_gate("SECOND".into(), Connective::And, vec![a, c], None)
            .unwrap();
        pdag.set_root(first).unwrap();
        let jobs = vec![
            EndStateSequence {
                end_state: "FAIL".into(),
                failure_root: Some(first),
                success_roots: vec![],
            },
            EndStateSequence {
                end_state: "FAIL".into(),
                failure_root: Some(second),
                success_roots: vec![],
            },
        ];
        let probabilities =
            HashMap::from([("A".into(), 0.2), ("B".into(), 0.5), ("C".into(), 0.5)]);
        // At IE frequency 2, A has frequency 0.4, BC has 0.5, and AC has 0.2.
        // The cutoff removes AC; the order-one limit removes BC.
        let (engine, groups, names) =
            build_end_state_zbdd_from_pdag(&pdag, &probabilities, &jobs, Some(0.3), Some(1), 2.0)
                .unwrap();
        let products = engine.enumerate(groups["fail"].1);
        assert_eq!(products.len(), 1);
        assert_eq!(
            products[0]
                .iter()
                .map(|&variable| names[variable].as_deref().unwrap())
                .collect::<Vec<_>>(),
            vec!["A"]
        );
    }

    #[test]
    #[ignore = "bounded symbolic scale benchmark"]
    fn end_state_shared_manager_many_large_sequences() {
        let sequence_count = std::env::var("PRAXIS_SCALE_SEQUENCES")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(100);
        let event_count = std::env::var("PRAXIS_SCALE_EVENTS")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(34);
        let shifted = std::env::var("PRAXIS_SCALE_SHIFTED").is_ok_and(|value| value == "1");
        let choose = event_count / 2;
        let mut pdag = Pdag::new();
        let mut probabilities = HashMap::new();
        let core_events: Vec<_> = (0..if shifted {
            event_count * 2
        } else {
            event_count
        })
            .map(|number| {
                let name = format!("CORE-{number:02}");
                probabilities.insert(name.clone(), 0.5);
                pdag.add_basic_event(name)
            })
            .collect();
        let core = pdag
            .add_gate(
                "CORE".into(),
                Connective::AtLeast,
                core_events[..event_count].to_vec(),
                Some(choose),
            )
            .unwrap();
        pdag.set_root(core).unwrap();
        let mut sequences = Vec::new();
        for number in 0..sequence_count {
            let sequence_core = if shifted {
                let start = number % (event_count + 1);
                pdag.add_gate(
                    format!("CORE-SHIFT-{number:03}"),
                    Connective::AtLeast,
                    core_events[start..start + event_count].to_vec(),
                    Some(choose),
                )
                .unwrap()
            } else {
                core
            };
            let name = format!("UNIQUE-{number:03}");
            probabilities.insert(name.clone(), 0.5);
            let unique = pdag.add_basic_event(name);
            let failure = pdag
                .add_gate(
                    format!("SEQUENCE-{number:03}"),
                    Connective::And,
                    vec![sequence_core, unique],
                    None,
                )
                .unwrap();
            sequences.push(EndStateSequence {
                end_state: "FAILED".into(),
                failure_root: Some(failure),
                success_roots: Vec::new(),
            });
        }
        let started = std::time::Instant::now();
        let (engine, groups, _) =
            build_end_state_zbdd_from_pdag(&pdag, &probabilities, &sequences, None, None, 1.0)
                .unwrap();
        let root = groups.get("failed").unwrap().1;
        let actual: u64 = engine.count_by_order(root).values().sum();
        let reachable = engine.reachable_count(root);
        let allocated = engine.node_count();
        let combinations = (1..=choose).fold(1u128, |value, index| {
            value * (event_count + 1 - index) as u128 / index as u128
        });
        let expected = (combinations * sequence_count as u128) as u64;
        println!(
            concat!(
                "synthetic scale: {} sequences, shifted={}, C({}, {})={} per sequence, ",
                "total={}, reachable nodes={}, allocated nodes={}, elapsed={:.2}s"
            ),
            sequence_count,
            shifted,
            event_count,
            choose,
            combinations,
            actual,
            reachable,
            allocated,
            started.elapsed().as_secs_f64()
        );
        assert_eq!(actual, expected);
    }
}
