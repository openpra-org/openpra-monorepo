use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap, HashSet};
use std::hash::{Hash, Hasher};

use crate::algorithms::mocus::CutSet;
use crate::core::fault_tree::FaultTree;
use crate::core::gate::{Formula, Gate};
use crate::error::{PraxisError, Result};

pub type NodeIndex = usize;
pub const EMPTY: NodeIndex = 0;
pub const BASE: NodeIndex = 1;

#[derive(Debug, Clone)]
pub struct ZbddNode {
    variable: usize,
    high: NodeIndex,
    low: NodeIndex,
    hash: u64,

    #[allow(dead_code)]
    minimal: bool,
    max_set_order: usize,
}

impl ZbddNode {
    fn new(variable: usize, high: NodeIndex, low: NodeIndex) -> Self {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        variable.hash(&mut hasher);
        high.hash(&mut hasher);
        low.hash(&mut hasher);
        let hash = hasher.finish();

        ZbddNode {
            variable,
            high,
            low,
            hash,
            minimal: false,
            max_set_order: 0,
        }
    }
}

impl Hash for ZbddNode {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.hash.hash(state);
    }
}

impl PartialEq for ZbddNode {
    fn eq(&self, other: &Self) -> bool {
        self.variable == other.variable && self.high == other.high && self.low == other.low
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
    intersection_cache: HashMap<(NodeIndex, NodeIndex), NodeIndex>,
    variable_nodes: HashMap<usize, NodeIndex>,
    variable_names: HashMap<usize, String>,
}

#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
struct F64Ord(f64);

impl Eq for F64Ord {}

impl Ord for F64Ord {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.total_cmp(&other.0)
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct PrunedCandidate {
    prob: F64Ord,
    vars: Vec<usize>,
}

impl Ord for PrunedCandidate {
    fn cmp(&self, other: &Self) -> Ordering {
        self.prob
            .cmp(&other.prob)
            .then_with(|| other.vars.len().cmp(&self.vars.len()))
            .then_with(|| self.vars.cmp(&other.vars))
    }
}

impl PartialOrd for PrunedCandidate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Zbdd {
    pub fn new() -> Self {
        let mut zbdd = Zbdd {
            nodes: Vec::new(),
            unique_table: HashMap::new(),
            union_cache: HashMap::new(),
            intersection_cache: HashMap::new(),
            variable_nodes: HashMap::new(),
            variable_names: HashMap::new(),
        };

        zbdd.nodes.push(ZbddNode::new(0, EMPTY, EMPTY));
        zbdd.nodes.push(ZbddNode::new(1, BASE, BASE));
        zbdd
    }

    pub fn variable(&mut self, var: usize) -> NodeIndex {
        if let Some(&node) = self.variable_nodes.get(&var) {
            return node;
        }

        let node = self.make_node(var, BASE, EMPTY);
        self.variable_nodes.insert(var, node);
        node
    }

    fn make_node(&mut self, var: usize, high: NodeIndex, low: NodeIndex) -> NodeIndex {
        if high == EMPTY {
            return low;
        }

        if high == low {
            return low;
        }

        let key = (var, high, low);
        if let Some(&existing) = self.unique_table.get(&key) {
            return existing;
        }

        let index = self.nodes.len();
        let mut node = ZbddNode::new(var, high, low);

        let high_order = if high < 2 {
            if high == BASE {
                1
            } else {
                0
            }
        } else {
            self.nodes[high].max_set_order + 1
        };

        let low_order = if low < 2 {
            0
        } else {
            self.nodes[low].max_set_order
        };

        node.max_set_order = high_order.max(low_order);

        self.nodes.push(node);
        self.unique_table.insert(key, index);

        index
    }

    pub fn union(&mut self, f: NodeIndex, g: NodeIndex) -> NodeIndex {
        if f == EMPTY {
            return g;
        }
        if g == EMPTY {
            return f;
        }
        if f == g {
            return f;
        }

        let cache_key = if f < g { (f, g) } else { (g, f) };
        if let Some(&result) = self.union_cache.get(&cache_key) {
            return result;
        }

        let f_var = self.nodes[f].variable;
        let g_var = self.nodes[g].variable;
        let f_high = self.nodes[f].high;
        let f_low = self.nodes[f].low;
        let g_high = self.nodes[g].high;
        let g_low = self.nodes[g].low;

        let result = if f_var == g_var {
            let high = self.union(f_high, g_high);
            let low = self.union(f_low, g_low);
            self.make_node(f_var, high, low)
        } else if f_var < g_var {
            let high = f_high;
            let low = self.union(f_low, g);
            self.make_node(f_var, high, low)
        } else {
            let high = g_high;
            let low = self.union(f, g_low);
            self.make_node(g_var, high, low)
        };

        self.union_cache.insert(cache_key, result);
        result
    }

    pub fn intersection(&mut self, f: NodeIndex, g: NodeIndex) -> NodeIndex {
        if f == EMPTY || g == EMPTY {
            return EMPTY;
        }
        if f == BASE {
            return g;
        }
        if g == BASE {
            return f;
        }
        if f == g {
            return f;
        }

        let cache_key = if f < g { (f, g) } else { (g, f) };
        if let Some(&result) = self.intersection_cache.get(&cache_key) {
            return result;
        }

        let f_var = self.nodes[f].variable;
        let g_var = self.nodes[g].variable;
        let f_high = self.nodes[f].high;
        let f_low = self.nodes[f].low;
        let g_high = self.nodes[g].high;
        let g_low = self.nodes[g].low;

        let result = if f_var == g_var {
            let gh_gl_union = self.union(g_high, g_low);
            let fh_union = self.intersection(f_high, gh_gl_union);
            let fl_gh = self.intersection(f_low, g_high);
            let high = self.union(fh_union, fl_gh);
            let low = self.intersection(f_low, g_low);
            self.make_node(f_var, high, low)
        } else if f_var < g_var {
            let high = self.intersection(f_high, g);
            let low = self.intersection(f_low, g);
            self.make_node(f_var, high, low)
        } else {
            let high = self.intersection(f, g_high);
            let low = self.intersection(f, g_low);
            self.make_node(g_var, high, low)
        };

        self.intersection_cache.insert(cache_key, result);
        result
    }

    pub fn enumerate_products(&self, root: NodeIndex) -> Vec<Vec<usize>> {
        let mut result = Vec::new();
        let mut current_product = Vec::new();
        self.collect_products(root, &mut current_product, &mut result);
        result
    }

    pub fn enumerate_products_pruned(
        &self,
        root: NodeIndex,
        max_order: Option<usize>,
        tau: f64,
        prob_by_event_id: &HashMap<String, f64>,
        max_sets: usize,
    ) -> Vec<Vec<usize>> {
        let max_sets = max_sets.max(1);
        let tau = if tau.is_finite() { tau.max(0.0) } else { 0.0 };
        let mut kept: BinaryHeap<std::cmp::Reverse<PrunedCandidate>> = BinaryHeap::new();
        let mut current: Vec<usize> = Vec::new();

        self.collect_products_pruned(
            root,
            &mut current,
            1.0,
            max_order,
            tau,
            prob_by_event_id,
            max_sets,
            &mut kept,
        );

        let mut out: Vec<PrunedCandidate> = kept.into_iter().map(|r| r.0).collect();
        out.sort_by(|a, b| b.prob.cmp(&a.prob));
        out.into_iter().map(|c| c.vars).collect()
    }

    fn collect_products_pruned(
        &self,
        node: NodeIndex,
        current: &mut Vec<usize>,
        current_prob: f64,
        max_order: Option<usize>,
        tau: f64,
        prob_by_event_id: &HashMap<String, f64>,
        max_sets: usize,
        kept: &mut BinaryHeap<std::cmp::Reverse<PrunedCandidate>>,
    ) {
        if node == EMPTY {
            return;
        }

        if let Some(max) = max_order {
            if current.len() > max {
                return;
            }
        }

        let min_kept = if kept.len() >= max_sets {
            kept.peek().map(|v| v.0.prob.0).unwrap_or(0.0)
        } else {
            0.0
        };
        let threshold = tau.max(min_kept);

        if current_prob < threshold {
            return;
        }

        if node == BASE {
            if current.is_empty() {
                return;
            }

            let prob = current_prob.clamp(0.0, 1.0);
            if prob < threshold {
                return;
            }

            let candidate = PrunedCandidate {
                prob: F64Ord(prob),
                vars: current.clone(),
            };
            kept.push(std::cmp::Reverse(candidate));
            if kept.len() > max_sets {
                kept.pop();
            }
            return;
        }

        let zbdd_node = &self.nodes[node];

        self.collect_products_pruned(
            zbdd_node.low,
            current,
            current_prob,
            max_order,
            tau,
            prob_by_event_id,
            max_sets,
            kept,
        );

        if let Some(max) = max_order {
            if current.len() >= max {
                return;
            }
        }

        let var = zbdd_node.variable;
        let p_var = self
            .variable_names
            .get(&var)
            .and_then(|id| prob_by_event_id.get(id))
            .copied()
            .unwrap_or(0.0)
            .clamp(0.0, 1.0);
        let next_prob = current_prob * p_var;

        current.push(var);
        self.collect_products_pruned(
            zbdd_node.high,
            current,
            next_prob,
            max_order,
            tau,
            prob_by_event_id,
            max_sets,
            kept,
        );
        current.pop();
    }

    fn collect_products(
        &self,
        node: NodeIndex,
        current: &mut Vec<usize>,
        result: &mut Vec<Vec<usize>>,
    ) {
        if node == EMPTY {
            return;
        }
        if node == BASE {
            result.push(current.clone());
            return;
        }

        let zbdd_node = &self.nodes[node];

        current.push(zbdd_node.variable);
        self.collect_products(zbdd_node.high, current, result);
        current.pop();

        self.collect_products(zbdd_node.low, current, result);
    }

    pub fn get_cut_sets(&self, root: NodeIndex, max_order: Option<usize>) -> Vec<CutSet> {
        let products = self.enumerate_products(root);

        products
            .into_iter()
            .filter_map(|product| {
                if let Some(max) = max_order {
                    if product.len() > max {
                        return None;
                    }
                }

                let event_names: Vec<String> = product
                    .iter()
                    .filter_map(|&var_idx| self.variable_names.get(&var_idx).cloned())
                    .collect();

                if event_names.is_empty() {
                    None
                } else {
                    Some(CutSet::new(event_names))
                }
            })
            .collect()
    }

    pub fn get_cut_sets_pruned(
        &self,
        root: NodeIndex,
        max_order: Option<usize>,
        tau: f64,
        prob_by_event_id: &HashMap<String, f64>,
        max_sets: usize,
    ) -> Vec<CutSet> {
        let products = self.enumerate_products_pruned(root, max_order, tau, prob_by_event_id, max_sets);

        let mut out: Vec<CutSet> = Vec::new();
        let mut seen: HashSet<String> = HashSet::new();

        for product in products {
            if product.is_empty() {
                continue;
            }

            let mut members: Vec<String> = product
                .iter()
                .filter_map(|var_idx| self.variable_names.get(var_idx).cloned())
                .collect();

            if members.is_empty() {
                continue;
            }

            members.sort();
            let key = members.join("\u{1f}");
            if !seen.insert(key) {
                continue;
            }

            out.push(CutSet::new(members));
        }

        Self::filter_minimal_cut_sets(out)
    }

    fn filter_minimal_cut_sets(mut sets: Vec<CutSet>) -> Vec<CutSet> {
        sets.sort_by(|a, b| a.order().cmp(&b.order()));
        let mut kept: Vec<CutSet> = Vec::new();

        'outer: for cs in sets {
            for k in &kept {
                if k.events.is_subset(&cs.events) {
                    continue 'outer;
                }
            }
            kept.push(cs);
        }

        kept
    }

    pub fn count_products(&self, node: NodeIndex) -> usize {
        let mut cache: HashMap<NodeIndex, usize> = HashMap::new();
        self.count_products_cached(node, &mut cache)
    }

    fn count_products_cached(
        &self,
        node: NodeIndex,
        cache: &mut HashMap<NodeIndex, usize>,
    ) -> usize {
        if node == EMPTY {
            return 0;
        }
        if node == BASE {
            return 1;
        }

        if let Some(&count) = cache.get(&node) {
            return count;
        }

        let zbdd_node = &self.nodes[node];
        let high_count = self.count_products_cached(zbdd_node.high, cache);
        let low_count = self.count_products_cached(zbdd_node.low, cache);
        let total = high_count + low_count;

        cache.insert(node, total);
        total
    }

    pub fn from_gate(&mut self, gate: &Gate) -> Result<NodeIndex> {
        let formula = gate.formula();

        match formula {
            Formula::And => {
                let operands = gate.operands();
                if operands.is_empty() {
                    return Ok(BASE);
                }

                let mut result = BASE;
                for op_id in operands {
                    let var_node = self.variable_from_id(op_id)?;
                    result = self.intersection(result, var_node);
                }
                Ok(result)
            }
            Formula::Or => {
                let operands = gate.operands();
                if operands.is_empty() {
                    return Ok(EMPTY);
                }

                let mut result = EMPTY;
                for op_id in operands {
                    let var_node = self.variable_from_id(op_id)?;
                    result = self.union(result, var_node);
                }
                Ok(result)
            }
            Formula::Not => Err(PraxisError::Logic(
                "ZBDD does not support NOT gates (non-coherent systems)".to_string(),
            )),
            Formula::AtLeast { min } => {
                let operands = gate.operands();
                let n = operands.len();
                let k = *min;

                if k == 0 {
                    return Ok(BASE);
                }
                if k > n {
                    return Ok(EMPTY);
                }

                let var_nodes: Result<Vec<_>> = operands
                    .iter()
                    .map(|id| self.variable_from_id(id))
                    .collect();
                let var_nodes = var_nodes?;

                let mut result = EMPTY;
                self.generate_atleast_combinations(&var_nodes, k, 0, BASE, &mut result);
                Ok(result)
            }
            _ => Err(PraxisError::Logic(format!(
                "Unsupported gate type for ZBDD: {:?}",
                formula
            ))),
        }
    }

    fn variable_from_id(&mut self, id: &str) -> Result<NodeIndex> {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        id.hash(&mut hasher);
        let var_index = (hasher.finish() as usize) % 100000;
        Ok(self.variable(var_index))
    }

    fn generate_atleast_combinations(
        &mut self,
        nodes: &[NodeIndex],
        k: usize,
        start: usize,
        current: NodeIndex,
        result: &mut NodeIndex,
    ) {
        if k == 0 {
            *result = self.union(*result, current);
            return;
        }
        if start + k > nodes.len() {
            return;
        }

        for i in start..=nodes.len() - k {
            let next = self.intersection(current, nodes[i]);
            self.generate_atleast_combinations(nodes, k - 1, i + 1, next, result);
        }
    }

    pub fn from_fault_tree(&mut self, fault_tree: &FaultTree) -> Result<NodeIndex> {
        let mut var_map: HashMap<String, usize> = HashMap::new();

        for (next_var, event) in fault_tree.basic_events().values().enumerate() {
            let event_id = event.element().id().to_string();
            var_map.insert(event_id.clone(), next_var);
            self.variable_names.insert(next_var, event_id);
        }

        let mut gate_cache: HashMap<String, NodeIndex> = HashMap::new();

        let top_event = fault_tree.top_event();
        if top_event.is_empty() {
            return Err(PraxisError::Logic(
                "Fault tree has no top event".to_string(),
            ));
        }

        self.convert_gate_recursive(fault_tree, top_event, &var_map, &mut gate_cache)
    }

    fn convert_gate_recursive(
        &mut self,
        fault_tree: &FaultTree,
        element_id: &str,
        var_map: &HashMap<String, usize>,
        gate_cache: &mut HashMap<String, NodeIndex>,
    ) -> Result<NodeIndex> {
        if let Some(&cached) = gate_cache.get(element_id) {
            return Ok(cached);
        }

        if let Some(&var_index) = var_map.get(element_id) {
            let node = self.variable(var_index);
            return Ok(node);
        }

        let gate = fault_tree
            .get_gate(element_id)
            .ok_or_else(|| PraxisError::Logic(format!("Element not found: {}", element_id)))?;

        let formula = gate.formula();
        let operands = gate.operands();

        let result = match formula {
            Formula::And => {
                let mut and_result = BASE;
                for op_id in operands {
                    let op_node =
                        self.convert_gate_recursive(fault_tree, op_id, var_map, gate_cache)?;
                    and_result = self.intersection(and_result, op_node);
                }
                and_result
            }
            Formula::Or => {
                let mut or_result = EMPTY;
                for op_id in operands {
                    let op_node =
                        self.convert_gate_recursive(fault_tree, op_id, var_map, gate_cache)?;
                    or_result = self.union(or_result, op_node);
                }
                or_result
            }
            Formula::AtLeast { min } => {
                let k = *min;
                let n = operands.len();

                if k == 0 {
                    BASE
                } else if k > n {
                    EMPTY
                } else {
                    let op_nodes: Result<Vec<_>> = operands
                        .iter()
                        .map(|id| self.convert_gate_recursive(fault_tree, id, var_map, gate_cache))
                        .collect();
                    let op_nodes = op_nodes?;

                    let mut atleast_result = EMPTY;
                    self.generate_atleast_combinations(&op_nodes, k, 0, BASE, &mut atleast_result);
                    atleast_result
                }
            }
            _ => {
                return Err(PraxisError::Logic(format!(
                    "Unsupported gate type for ZBDD: {:?}",
                    formula
                )))
            }
        };

        gate_cache.insert(element_id.to_string(), result);
        Ok(result)
    }

    pub fn stats(&self, root: NodeIndex) -> ZbddStats {
        let num_variables = self.variable_nodes.len();
        let num_products = self.count_products(root);

        let max_product_size = if root < 2 {
            0
        } else {
            self.nodes[root].max_set_order
        };

        let mut visited = HashSet::new();
        self.count_nodes(root, &mut visited);
        let num_nodes = visited.len();

        ZbddStats {
            num_nodes,
            num_variables,
            num_products,
            max_product_size,
        }
    }

    fn count_nodes(&self, node: NodeIndex, visited: &mut HashSet<NodeIndex>) {
        if node < 2 || visited.contains(&node) {
            return;
        }
        visited.insert(node);
        let zbdd_node = &self.nodes[node];
        self.count_nodes(zbdd_node.high, visited);
        self.count_nodes(zbdd_node.low, visited);
    }

    pub fn clear_caches(&mut self) {
        self.union_cache.clear();
        self.intersection_cache.clear();
    }
}

impl Default for Zbdd {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zbdd_empty_and_base() {
        let zbdd = Zbdd::new();
        assert_eq!(zbdd.nodes.len(), 2);
        assert_eq!(EMPTY, 0);
        assert_eq!(BASE, 1);
    }

    #[test]
    fn test_zbdd_variable() {
        let mut zbdd = Zbdd::new();
        let x1 = zbdd.variable(0);
        assert!(x1 >= 2);

        let node = &zbdd.nodes[x1];
        assert_eq!(node.variable, 0);
        assert_eq!(node.high, BASE);
        assert_eq!(node.low, EMPTY);
    }

    #[test]
    fn test_zbdd_zero_suppression() {
        let mut zbdd = Zbdd::new();

        let result = zbdd.make_node(0, EMPTY, BASE);
        assert_eq!(result, BASE);
    }

    #[test]
    fn test_zbdd_union() {
        let mut zbdd = Zbdd::new();

        let x1 = zbdd.variable(0);
        let x2 = zbdd.variable(1);

        let result = zbdd.union(x1, x2);
        let products = zbdd.enumerate_products(result);
        assert_eq!(products.len(), 2);
    }

    #[test]
    fn test_zbdd_intersection() {
        let mut zbdd = Zbdd::new();

        let x1 = zbdd.variable(0);
        let x2 = zbdd.variable(1);

        let result = zbdd.intersection(x1, x2);
        let products = zbdd.enumerate_products(result);
        assert_eq!(products.len(), 1);
        assert_eq!(products[0].len(), 2);
        assert!(products[0].contains(&0));
        assert!(products[0].contains(&1));
    }

    #[test]
    fn test_zbdd_enumerate_products() {
        let mut zbdd = Zbdd::new();

        let x1 = zbdd.variable(0);
        let x2 = zbdd.variable(1);
        let union = zbdd.union(x1, x2);

        let products = zbdd.enumerate_products(union);
        assert_eq!(products.len(), 2);
    }

    #[test]
    fn test_zbdd_count_products() {
        let mut zbdd = Zbdd::new();

        assert_eq!(zbdd.count_products(EMPTY), 0);
        assert_eq!(zbdd.count_products(BASE), 1);

        let x1 = zbdd.variable(0);
        assert_eq!(zbdd.count_products(x1), 1);

        let x2 = zbdd.variable(1);
        let union = zbdd.union(x1, x2);
        assert_eq!(zbdd.count_products(union), 2);
    }

    #[test]
    fn test_zbdd_stats() {
        let mut zbdd = Zbdd::new();

        let x1 = zbdd.variable(0);
        let x2 = zbdd.variable(1);
        let union = zbdd.union(x1, x2);

        let stats = zbdd.stats(union);
        assert_eq!(stats.num_variables, 2);
        assert_eq!(stats.num_products, 2);
        assert!(stats.num_nodes >= 2);
    }

    #[test]
    fn test_get_cut_sets_and_gate() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1", "TOP").unwrap();

        let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
        top_gate.add_operand("E1".to_string());
        top_gate.add_operand("E2".to_string());
        ft.add_gate(top_gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut zbdd = Zbdd::new();
        let root = zbdd.from_fault_tree(&ft).unwrap();

        let cut_sets = zbdd.get_cut_sets(root, None);

        assert_eq!(cut_sets.len(), 1);
        assert_eq!(cut_sets[0].order(), 2);
        assert!(cut_sets[0].events.contains("E1"));
        assert!(cut_sets[0].events.contains("E2"));
    }

    #[test]
    fn test_get_cut_sets_or_gate() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1", "TOP").unwrap();

        let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top_gate.add_operand("E1".to_string());
        top_gate.add_operand("E2".to_string());
        ft.add_gate(top_gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut zbdd = Zbdd::new();
        let root = zbdd.from_fault_tree(&ft).unwrap();

        let cut_sets = zbdd.get_cut_sets(root, None);

        assert_eq!(cut_sets.len(), 2);

        let has_e1_only = cut_sets
            .iter()
            .any(|cs| cs.order() == 1 && cs.events.contains("E1"));
        let has_e2_only = cut_sets
            .iter()
            .any(|cs| cs.order() == 1 && cs.events.contains("E2"));

        assert!(has_e1_only, "Should have cut set {{E1}}");
        assert!(has_e2_only, "Should have cut set {{E2}}");
    }

    #[test]
    fn test_get_cut_sets_complex() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1", "TOP").unwrap();

        let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top_gate.add_operand("G1".to_string());
        top_gate.add_operand("E3".to_string());
        ft.add_gate(top_gate).unwrap();

        let mut g1_gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        g1_gate.add_operand("E1".to_string());
        g1_gate.add_operand("E2".to_string());
        ft.add_gate(g1_gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();

        let mut zbdd = Zbdd::new();
        let root = zbdd.from_fault_tree(&ft).unwrap();

        let cut_sets = zbdd.get_cut_sets(root, None);

        assert_eq!(cut_sets.len(), 2);

        let has_e1_e2 = cut_sets
            .iter()
            .any(|cs| cs.order() == 2 && cs.events.contains("E1") && cs.events.contains("E2"));

        let has_e3 = cut_sets
            .iter()
            .any(|cs| cs.order() == 1 && cs.events.contains("E3"));

        assert!(has_e1_e2, "Should have cut set {{E1, E2}}");
        assert!(has_e3, "Should have cut set {{E3}}");
    }

    #[test]
    fn test_get_cut_sets_with_order_filter() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1", "TOP").unwrap();

        let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top_gate.add_operand("G1".to_string());
        top_gate.add_operand("E3".to_string());
        ft.add_gate(top_gate).unwrap();

        let mut g1_gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        g1_gate.add_operand("E1".to_string());
        g1_gate.add_operand("E2".to_string());
        ft.add_gate(g1_gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();

        let mut zbdd = Zbdd::new();
        let root = zbdd.from_fault_tree(&ft).unwrap();

        let all_cut_sets = zbdd.get_cut_sets(root, None);
        assert_eq!(all_cut_sets.len(), 2);

        let order1_cut_sets = zbdd.get_cut_sets(root, Some(1));
        assert_eq!(order1_cut_sets.len(), 1);
        assert_eq!(order1_cut_sets[0].order(), 1);
        assert!(order1_cut_sets[0].events.contains("E3"));

        let order2_cut_sets = zbdd.get_cut_sets(root, Some(2));
        assert_eq!(order2_cut_sets.len(), 2);

        let order5_cut_sets = zbdd.get_cut_sets(root, Some(5));
        assert_eq!(order5_cut_sets.len(), 2);
    }
}
