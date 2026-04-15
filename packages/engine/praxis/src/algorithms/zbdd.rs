use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};

use crate::algorithms::mocus::CutSet;
use crate::core::fault_tree::FaultTree;
use crate::core::gate::Formula;
use crate::error::{PraxisError, Result};

pub const EMPTY: NodeIndex = 0;
pub const BASE: NodeIndex = 1;
pub type NodeIndex = usize;


#[derive(Debug, Clone)]
pub struct ZbddNode {
    pub variable: usize,
    pub high: NodeIndex,
    pub low: NodeIndex,
    pub minimal: bool,
    pub max_set_order: usize,
}

impl ZbddNode {
    fn new(variable: usize, high: NodeIndex, low: NodeIndex) -> Self {
        ZbddNode {
            variable,
            high,
            low,
            minimal: false,
            max_set_order: 0,
        }
    }
}

impl Hash for ZbddNode {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.variable.hash(state);
        self.high.hash(state);
        self.low.hash(state);
    }
}

impl PartialEq for ZbddNode {
    fn eq(&self, other: &Self) -> bool {
        self.variable == other.variable
            && self.high == other.high
            && self.low == other.low
    }
}

impl Eq for ZbddNode {}

#[derive(Debug, Clone)]
pub struct ZbddStats {
    pub num_nodes: usize,
    pub num_variables: usize,
    pub num_products: usize,
    pub max_product_size: usize,
}

pub struct Zbdd {
    nodes: Vec<ZbddNode>,
    unique_table: HashMap<(usize, NodeIndex, NodeIndex), NodeIndex>,
    union_cache: HashMap<(NodeIndex, NodeIndex), NodeIndex>,
    product_cache: HashMap<(NodeIndex, NodeIndex), NodeIndex>,
    minimize_cache: HashMap<NodeIndex, NodeIndex>,
    subsume_cache: HashMap<(NodeIndex, NodeIndex), NodeIndex>,
    pub variable_names: HashMap<usize, String>,
    variable_index: HashMap<String, usize>,
}

impl Zbdd {
    pub fn new() -> Self {
        let mut zbdd = Zbdd {
            nodes: Vec::new(),
            unique_table: HashMap::new(),
            union_cache: HashMap::new(),
            product_cache: HashMap::new(),
            minimize_cache: HashMap::new(),
            subsume_cache: HashMap::new(),
            variable_names: HashMap::new(),
            variable_index: HashMap::new(),
        };

        zbdd.nodes.push(ZbddNode::new(usize::MAX, EMPTY, EMPTY));
        zbdd.nodes.push(ZbddNode::new(usize::MAX, BASE, BASE));
        zbdd
    }

    pub fn make_node(&mut self, var: usize, high: NodeIndex, low: NodeIndex) -> NodeIndex {
        if high == EMPTY {
            return low;
        }

        let key = (var, high, low);
        if let Some(&existing) = self.unique_table.get(&key) {
            return existing;
        }

        let index = self.nodes.len();
        let mut node = ZbddNode::new(var, high, low);
        let high_order = self.max_order(high) + 1;
        let low_order = self.max_order(low);

        node.max_set_order = high_order.max(low_order);
        self.nodes.push(node);
        self.unique_table.insert(key, index);
        index
    }

    fn max_order(&self, idx: NodeIndex) -> usize {
        if idx < 2 {
            if idx == BASE { 1 } else { 0 }
        } else {
            self.nodes[idx].max_set_order
        }
    }

    pub fn union(&mut self, f: NodeIndex, g: NodeIndex) -> NodeIndex {
        if f == EMPTY { return g; }
        if g == EMPTY { return f; }
        if f == g    { return f; }
        if f == BASE && g == BASE { return BASE; }

        let key = if f < g { (f, g) } else { (g, f) };
        if let Some(&cached) = self.union_cache.get(&key) {
            return cached;
        }

        let (f_var, f_high, f_low) = self.node_data(f);
        let (g_var, g_high, g_low) = self.node_data(g);

        let result = if f_var == g_var {
            let high = self.union(f_high, g_high);
            let low  = self.union(f_low,  g_low);
            self.make_node(f_var, high, low)
        } else if f_var < g_var {
            let low = self.union(f_low, g);
            self.make_node(f_var, f_high, low)
        } else {
            let low = self.union(f, g_low);
            self.make_node(g_var, g_high, low)
        };

        self.union_cache.insert(key, result);
        result
    }

    pub fn product(&mut self, f: NodeIndex, g: NodeIndex) -> NodeIndex {
        if f == EMPTY || g == EMPTY { return EMPTY; }
        if f == BASE  { return g; }
        if g == BASE  { return f; }
        if f == g     { return f; }

        let key = if f < g { (f, g) } else { (g, f) };
        if let Some(&cached) = self.product_cache.get(&key) {
            return cached;
        }

        let (f_var, f_high, f_low) = self.node_data(f);
        let (g_var, g_high, g_low) = self.node_data(g);

        let result = if f_var == g_var {
            let g_union = self.union(g_high, g_low);
            let left    = self.product(f_high, g_union);
            let right   = self.product(f_low,  g_high);
            let high    = self.union(left, right);
            let low     = self.product(f_low, g_low);
            let node    = self.make_node(f_var, high, low);
            self.minimize(node)
        } else if f_var < g_var {
            let high = self.product(f_high, g);
            let low  = self.product(f_low,  g);
            let node = self.make_node(f_var, high, low);
            self.minimize(node)
        } else {
            let high = self.product(f, g_high);
            let low  = self.product(f, g_low);
            let node = self.make_node(g_var, high, low);
            self.minimize(node)
        };

        self.product_cache.insert(key, result);
        result
    }

    pub fn minimize(&mut self, root: NodeIndex) -> NodeIndex {
        if root < 2 { return root; }
        if self.nodes[root].minimal { return root; }

        if let Some(&cached) = self.minimize_cache.get(&root) {
            return cached;
        }

        let (var, high, low) = self.node_data(root);

        let min_high = self.minimize(high);
        let min_low  = self.minimize(low);

        let sub_high = self.subsume(min_high, min_low);

        let result = if sub_high == EMPTY {
            min_low
        } else {
            let node = self.make_node(var, sub_high, min_low);
            if node >= 2 { self.nodes[node].minimal = true; }
            node
        };

        self.minimize_cache.insert(root, result);
        result
    }

    fn subsume(&mut self, high: NodeIndex, low: NodeIndex) -> NodeIndex {
        if low == BASE  { return EMPTY; }
        if low == EMPTY { return high; }
        if high == EMPTY || high == BASE { return high; }
        if high == low  { return EMPTY; }

        let key = (high, low);
        if let Some(&cached) = self.subsume_cache.get(&key) {
            return cached;
        }

        let (h_var, h_high, h_low) = self.node_data(high);
        let (l_var, l_high, l_low) = self.node_data(low);

        let result = if h_var > l_var {
            self.subsume(high, l_low)
        } else if h_var == l_var {
            let sub_high = self.subsume(h_high, l_high);
            let sub_high = self.subsume(sub_high, l_low);
            let sub_low  = self.subsume(h_low, l_low);
            if sub_high == EMPTY {
                sub_low
            } else {
                self.make_node(h_var, sub_high, sub_low)
            }
        } else {
            let sub_high = self.subsume(h_high, low);
            let sub_low  = self.subsume(h_low,  low);
            if sub_high == EMPTY {
                sub_low
            } else {
                self.make_node(h_var, sub_high, sub_low)
            }
        };

        self.subsume_cache.insert(key, result);
        result
    }

    pub fn from_fault_tree(fault_tree: &FaultTree) -> Result<(Zbdd, NodeIndex)> {
        let mut zbdd = Zbdd::new();

        let mut sorted_events: Vec<&str> = fault_tree
            .basic_events()
            .keys()
            .map(|s| s.as_str())
            .collect();
        sorted_events.sort();
        for (idx, event_id) in sorted_events.into_iter().enumerate() {
            zbdd.variable_names.insert(idx, event_id.to_string());
            zbdd.variable_index.insert(event_id.to_string(), idx);
        }

        let top_event = fault_tree.top_event();
        if top_event.is_empty() {
            return Err(PraxisError::Logic("Fault tree has no top event".into()));
        }

        let mut gate_cache: HashMap<String, NodeIndex> = HashMap::new();
        let root = zbdd.convert_gate(fault_tree, top_event, &mut gate_cache)?;
        let root = zbdd.minimize(root);
        zbdd.clear_op_caches();
        Ok((zbdd, root))
    }

    fn convert_gate(
        &mut self,
        fault_tree: &FaultTree,
        element_id: &str,
        cache: &mut HashMap<String, NodeIndex>,
    ) -> Result<NodeIndex> {
        if let Some(&cached) = cache.get(element_id) {
            return Ok(cached);
        }

        if let Some(&var_idx) = self.variable_index.get(element_id) {
            let node = self.make_node(var_idx, BASE, EMPTY);
            cache.insert(element_id.to_string(), node);
            return Ok(node);
        }

        if let Some(house) = fault_tree.get_house_event(element_id) {
            let node = if house.state() { BASE } else { EMPTY };
            cache.insert(element_id.to_string(), node);
            return Ok(node);
        }

        let gate = fault_tree
            .get_gate(element_id)
            .ok_or_else(|| PraxisError::Logic(format!("Element not found: {element_id}")))?;

        let formula  = gate.formula().clone();
        let operands = gate.operands().to_vec();

        let result = match formula {
            Formula::Or => {
                let mut acc = EMPTY;
                for op_id in &operands {
                    let op = self.convert_gate(fault_tree, op_id, cache)?;
                    acc = self.union(acc, op);
                }
                acc
            }
            Formula::And => {
                let mut acc = BASE;
                for op_id in &operands {
                    let op = self.convert_gate(fault_tree, op_id, cache)?;
                    acc = self.product(acc, op);
                }
                acc
            }
            Formula::AtLeast { min } => {
                let k = min;
                let n = operands.len();
                if k == 0 { return Ok(BASE); }
                if k > n  { return Ok(EMPTY); }

                let mut op_nodes: Vec<NodeIndex> = Vec::with_capacity(n);
                for op_id in &operands {
                    op_nodes.push(self.convert_gate(fault_tree, op_id, cache)?);
                }
                let mut result = EMPTY;
                let combos = Self::combinations(&op_nodes, k);
                for combo in combos {
                    let mut term = BASE;
                    for &op in &combo {
                        term = self.product(term, op);
                    }
                    result = self.union(result, term);
                }
                result
            }
            _ => {
                return Err(PraxisError::Logic(format!(
                    "Unsupported gate type for ZBDD coherent analysis: {formula:?}"
                )))
            }
        };

        let result = self.minimize(result);
        cache.insert(element_id.to_string(), result);
        Ok(result)
    }

    fn combinations<T: Copy>(items: &[T], k: usize) -> Vec<Vec<T>> {
        if k == 0 { return vec![vec![]]; }
        if k > items.len() { return vec![]; }
        let mut result = Vec::new();
        Self::combo_recurse(items, k, 0, &mut Vec::new(), &mut result);
        result
    }

    fn combo_recurse<T: Copy>(
        items: &[T],
        k: usize,
        start: usize,
        current: &mut Vec<T>,
        result: &mut Vec<Vec<T>>,
    ) {
        if current.len() == k {
            result.push(current.clone());
            return;
        }
        let remaining = k - current.len();
        for i in start..=items.len().saturating_sub(remaining) {
            current.push(items[i]);
            Self::combo_recurse(items, k, i + 1, current, result);
            current.pop();
        }
    }

    pub fn get_cut_sets(&self, root: NodeIndex, max_order: Option<usize>) -> Vec<CutSet> {
        let mut products: Vec<Vec<usize>> = Vec::new();
        let mut path: Vec<usize> = Vec::new();
        self.collect_products(root, &mut path, max_order, &mut products);

        products
            .into_iter()
            .filter_map(|vars| {
                let names: Vec<String> = vars
                    .iter()
                    .filter_map(|v| self.variable_names.get(v).cloned())
                    .collect();
                if names.is_empty() { None } else { Some(CutSet::new(names)) }
            })
            .collect()
    }

    fn collect_products(
        &self,
        node: NodeIndex,
        path: &mut Vec<usize>,
        max_order: Option<usize>,
        out: &mut Vec<Vec<usize>>,
    ) {
        if node == EMPTY { return; }
        if node == BASE  { out.push(path.clone()); return; }

        if let Some(max) = max_order {
            if path.len() >= max && self.nodes[node].max_set_order > max {
                return;
            }
        }

        let var  = self.nodes[node].variable;
        let high = self.nodes[node].high;
        let low  = self.nodes[node].low;

        if max_order.map_or(true, |m| path.len() < m) {
            path.push(var);
            self.collect_products(high, path, max_order, out);
            path.pop();
        }

        self.collect_products(low, path, max_order, out);
    }

    pub fn clear_op_caches(&mut self) {
        self.union_cache.clear();
        self.product_cache.clear();
        self.minimize_cache.clear();
        self.subsume_cache.clear();
    }

    #[inline]
    fn node_data(&self, idx: NodeIndex) -> (usize, NodeIndex, NodeIndex) {
        let n = &self.nodes[idx];
        (n.variable, n.high, n.low)
    }

    pub fn count_products(&self, root: NodeIndex) -> usize {
        let mut cache: HashMap<NodeIndex, usize> = HashMap::new();
        self.count_products_cached(root, &mut cache)
    }

    fn count_products_cached(&self, node: NodeIndex, cache: &mut HashMap<NodeIndex, usize>) -> usize {
        if node == EMPTY { return 0; }
        if node == BASE  { return 1; }
        if let Some(&n) = cache.get(&node) { return n; }
        let h = self.count_products_cached(self.nodes[node].high, cache);
        let l = self.count_products_cached(self.nodes[node].low,  cache);
        let total = h + l;
        cache.insert(node, total);
        total
    }

    pub fn stats(&self, root: NodeIndex) -> ZbddStats {
        let mut visited = HashSet::new();
        self.count_nodes_visited(root, &mut visited);
        ZbddStats {
            num_nodes: visited.len(),
            num_variables: self.variable_names.len(),
            num_products: self.count_products(root),
            max_product_size: if root < 2 { 0 } else { self.nodes[root].max_set_order },
        }
    }

    fn count_nodes_visited(&self, node: NodeIndex, visited: &mut HashSet<NodeIndex>) {
        if node < 2 || visited.contains(&node) { return; }
        visited.insert(node);
        self.count_nodes_visited(self.nodes[node].high, visited);
        self.count_nodes_visited(self.nodes[node].low,  visited);
    }
}

impl Default for Zbdd {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::io::parser::parse_fault_tree;

    fn make_ft(top: &str, formula: Formula, operands: &[&str], probs: &[(&str, f64)]) -> FaultTree {
        let mut ft = FaultTree::new("FT", top).unwrap();
        let mut g = Gate::new(top.to_string(), formula).unwrap();
        for op in operands { g.add_operand(op.to_string()); }
        ft.add_gate(g).unwrap();
        for (id, p) in probs {
            ft.add_basic_event(BasicEvent::new(id.to_string(), *p).unwrap()).unwrap();
        }
        ft
    }

    #[test]
    fn test_and_gate() {
        let ft = make_ft("TOP", Formula::And, &["E1","E2"],
                         &[("E1", 0.01), ("E2", 0.02)]);
        let (zbdd, root) = Zbdd::from_fault_tree(&ft).unwrap();
        let cs = zbdd.get_cut_sets(root, None);
        assert_eq!(cs.len(), 1);
        assert_eq!(cs[0].order(), 2);
        assert!(cs[0].events.contains("E1") && cs[0].events.contains("E2"));
    }

    #[test]
    fn test_or_gate() {
        let ft = make_ft("TOP", Formula::Or, &["E1","E2"],
                         &[("E1", 0.01), ("E2", 0.02)]);
        let (zbdd, root) = Zbdd::from_fault_tree(&ft).unwrap();
        let cs = zbdd.get_cut_sets(root, None);
        assert_eq!(cs.len(), 2);
        assert!(cs.iter().any(|c| c.order()==1 && c.events.contains("E1")));
        assert!(cs.iter().any(|c| c.order()==1 && c.events.contains("E2")));
    }

    #[test]
    fn test_complex_tree() {
        let mut ft = FaultTree::new("FT", "TOP").unwrap();
        let mut top = Gate::new("TOP".into(), Formula::Or).unwrap();
        top.add_operand("G1".into()); top.add_operand("E3".into());
        ft.add_gate(top).unwrap();
        let mut g1 = Gate::new("G1".into(), Formula::And).unwrap();
        g1.add_operand("E1".into()); g1.add_operand("E2".into());
        ft.add_gate(g1).unwrap();
        for (id, p) in &[("E1",0.01),("E2",0.02),("E3",0.03)] {
            ft.add_basic_event(BasicEvent::new(id.to_string(), *p).unwrap()).unwrap();
        }
        let (zbdd, root) = Zbdd::from_fault_tree(&ft).unwrap();
        let cs = zbdd.get_cut_sets(root, None);
        assert_eq!(cs.len(), 2);
        assert!(cs.iter().any(|c| c.order()==2 && c.events.contains("E1") && c.events.contains("E2")));
        assert!(cs.iter().any(|c| c.order()==1 && c.events.contains("E3")));
    }

    #[test]
    fn test_atleast_gate() {
        let ft = make_ft("TOP", Formula::AtLeast { min: 2 }, &["E1","E2","E3"],
                         &[("E1",0.1),("E2",0.2),("E3",0.3)]);
        let (zbdd, root) = Zbdd::from_fault_tree(&ft).unwrap();
        let cs = zbdd.get_cut_sets(root, None);
        assert_eq!(cs.len(), 3);
        assert!(cs.iter().all(|c| c.order() == 2));
    }

    #[test]
    fn test_shared_event_and_of_ors() {
        let mut zbdd = Zbdd::new();
        for (i, name) in ["A","B","C"].iter().enumerate() {
            zbdd.variable_names.insert(i, name.to_string());
            zbdd.variable_index.insert(name.to_string(), i);
        }
        let a = zbdd.make_node(0, BASE, EMPTY);
        let b = zbdd.make_node(1, BASE, EMPTY);
        let c = zbdd.make_node(2, BASE, EMPTY);
        let g1 = {
            let u = zbdd.union(a, b);
            zbdd.minimize(u)
        };
        let g2 = {
            let u = zbdd.union(a, c);
            zbdd.minimize(u)
        };
        let result = zbdd.product(g1, g2);
        let cs = zbdd.get_cut_sets(result, None);
        assert_eq!(cs.len(), 2, "Expected MCS: {{A}}, {{B,C}} but got {}", cs.len());
    }

    #[test]
    fn test_chinese_benchmark_392_mcs() {
        let xml = include_str!("../../tests/fixtures/benchmarks/Aralia/chinese.xml");
        let ft = parse_fault_tree(xml).expect("parse chinese.xml");
        let (zbdd, root) = Zbdd::from_fault_tree(&ft).unwrap();
        let cs = zbdd.get_cut_sets(root, None);
        assert_eq!(cs.len(), 392, "chinese.xml must produce exactly 392 minimal cut sets, got {}", cs.len());
    }

    #[test]
    fn test_minimize_removes_supersets() {
        let mut zbdd = Zbdd::new();
        zbdd.variable_names.insert(0, "E1".into());
        zbdd.variable_names.insert(1, "E2".into());
        zbdd.variable_index.insert("E1".into(), 0);
        zbdd.variable_index.insert("E2".into(), 1);

        let e1 = zbdd.make_node(0, BASE, EMPTY);
        let e2 = zbdd.make_node(1, BASE, EMPTY);
        let e1_e2 = zbdd.product(e1, e2);
        let u = {
            let raw = zbdd.union(e1, e1_e2);
            raw
        };
        
        let m = zbdd.minimize(u);
        let cs = zbdd.get_cut_sets(m, None);
        assert_eq!(cs.len(), 1, "Minimize must remove the superset {{E1,E2}}");
        assert!(cs[0].events.contains("E1"));
    }

}
