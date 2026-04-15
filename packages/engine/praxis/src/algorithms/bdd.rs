use crate::algorithms::mocus::CutSet;
use crate::core::fault_tree::FaultTree;
use crate::core::gate::{Formula, Gate};
use crate::error::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::hash::{Hash, Hasher};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct NodeIndex(usize);

impl NodeIndex {
    pub const FALSE: NodeIndex = NodeIndex(0);
    pub const TRUE: NodeIndex = NodeIndex(1);
    pub fn is_terminal(self) -> bool {
        self.0 <= 1
    }

    pub fn raw(self) -> usize {
        self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BddNode {
    variable: usize,
    low: NodeIndex,
    high: NodeIndex,
}

impl Hash for BddNode {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.variable.hash(state);
        self.low.hash(state);
        self.high.hash(state);
    }
}

impl BddNode {
    fn new(variable: usize, low: NodeIndex, high: NodeIndex) -> Self {
        BddNode {
            variable,
            low,
            high,
        }
    }
}

pub struct Bdd {
    nodes: Vec<BddNode>,
    unique_table: HashMap<BddNode, NodeIndex>,
    ite_cache: HashMap<(NodeIndex, NodeIndex, NodeIndex), NodeIndex>,
    variable_probs: HashMap<usize, f64>,
    prob_cache: HashMap<NodeIndex, f64>,
    variable_names: HashMap<usize, String>,
}

impl Bdd {
    pub fn new() -> Self {
        Bdd {
            nodes: Vec::new(),
            unique_table: HashMap::new(),
            ite_cache: HashMap::new(),
            variable_probs: HashMap::new(),
            prob_cache: HashMap::new(),
            variable_names: HashMap::new(),
        }
    }

    pub fn variable(&mut self, var: usize, prob: f64) -> NodeIndex {
        self.variable_probs.insert(var, prob);
        self.make_node(var, NodeIndex::FALSE, NodeIndex::TRUE)
    }

    fn make_node(&mut self, var: usize, low: NodeIndex, high: NodeIndex) -> NodeIndex {
        if low == high {
            return low;
        }

        let node = BddNode::new(var, low, high);

        if let Some(&existing_idx) = self.unique_table.get(&node) {
            return existing_idx;
        }

        let index = NodeIndex(self.nodes.len() + 2);
        self.nodes.push(node.clone());
        self.unique_table.insert(node, index);
        index
    }

    fn get_node(&self, idx: NodeIndex) -> Option<&BddNode> {
        if idx.is_terminal() {
            None
        } else {
            self.nodes.get(idx.0 - 2)
        }
    }

    pub fn ite(&mut self, f: NodeIndex, g: NodeIndex, h: NodeIndex) -> NodeIndex {
        if f == NodeIndex::TRUE {
            return g;
        }
        if f == NodeIndex::FALSE {
            return h;
        }
        if g == h {
            return g;
        }
        if g == NodeIndex::TRUE && h == NodeIndex::FALSE {
            return f;
        }

        let cache_key = (f, g, h);
        if let Some(&result) = self.ite_cache.get(&cache_key) {
            return result;
        }

        let f_var = self.get_node(f).map(|n| n.variable);
        let g_var = self.get_node(g).map(|n| n.variable);
        let h_var = self.get_node(h).map(|n| n.variable);

        let top_var = [f_var, g_var, h_var]
            .iter()
            .filter_map(|&v| v)
            .min()
            .expect("At least one node must be non-terminal");

        let (f0, f1) = self.cofactors(f, top_var);
        let (g0, g1) = self.cofactors(g, top_var);
        let (h0, h1) = self.cofactors(h, top_var);

        let low = self.ite(f0, g0, h0);
        let high = self.ite(f1, g1, h1);

        let result = self.make_node(top_var, low, high);

        self.ite_cache.insert(cache_key, result);

        result
    }

    fn cofactors(&self, node: NodeIndex, var: usize) -> (NodeIndex, NodeIndex) {
        if let Some(n) = self.get_node(node) {
            if n.variable == var {
                (n.low, n.high)
            } else {
                (node, node)
            }
        } else {
            (node, node)
        }
    }

    pub fn and(&mut self, f: NodeIndex, g: NodeIndex) -> NodeIndex {
        self.ite(f, g, NodeIndex::FALSE)
    }

    pub fn or(&mut self, f: NodeIndex, g: NodeIndex) -> NodeIndex {
        self.ite(f, NodeIndex::TRUE, g)
    }

    pub fn not(&mut self, f: NodeIndex) -> NodeIndex {
        self.ite(f, NodeIndex::FALSE, NodeIndex::TRUE)
    }

    pub fn xor(&mut self, f: NodeIndex, g: NodeIndex) -> NodeIndex {
        let not_g = self.not(g);
        let g_copy = g;
        self.ite(f, not_g, g_copy)
    }

    pub fn iff(&mut self, f: NodeIndex, g: NodeIndex) -> NodeIndex {
        let not_f = self.not(f);
        let not_g = self.not(g);
        let both_true = self.and(f, g);
        let both_false = self.and(not_f, not_g);
        self.or(both_true, both_false)
    }

    pub fn nand(&mut self, f: NodeIndex, g: NodeIndex) -> NodeIndex {
        let and_result = self.and(f, g);
        self.not(and_result)
    }

    pub fn nor(&mut self, f: NodeIndex, g: NodeIndex) -> NodeIndex {
        let or_result = self.or(f, g);
        self.not(or_result)
    }

    pub fn atleast(&mut self, nodes: &[NodeIndex], k: usize) -> NodeIndex {
        if k == 0 {
            return NodeIndex::TRUE;
        }
        if k > nodes.len() {
            return NodeIndex::FALSE;
        }
        if nodes.is_empty() {
            return NodeIndex::FALSE;
        }

        if k == 1 {
            return nodes
                .iter()
                .copied()
                .reduce(|acc, n| self.or(acc, n))
                .unwrap();
        }
        if k == nodes.len() {
            return nodes
                .iter()
                .copied()
                .reduce(|acc, n| self.and(acc, n))
                .unwrap();
        }

        let first = nodes[0];
        let rest = &nodes[1..];

        let with_first = self.atleast(rest, k - 1);
        let without_first = self.atleast(rest, k);

        self.ite(first, with_first, without_first)
    }

    pub fn probability(&mut self, node: NodeIndex) -> f64 {
        if let Some(&cached) = self.prob_cache.get(&node) {
            return cached;
        }

        let prob = if node == NodeIndex::TRUE {
            1.0
        } else if node == NodeIndex::FALSE {
            0.0
        } else if let Some(n) = self.get_node(node) {
            let variable = n.variable;
            let low = n.low;
            let high = n.high;

            let var_prob = self.variable_probs.get(&variable).copied().unwrap_or(0.5);
            let low_prob = self.probability(low);
            let high_prob = self.probability(high);

            var_prob * high_prob + (1.0 - var_prob) * low_prob
        } else {
            0.0
        };

        self.prob_cache.insert(node, prob);

        prob
    }

    pub fn extract_cut_sets(&self, root: NodeIndex) -> Vec<CutSet> {
        let mut cut_sets = Vec::new();
        let mut current_path: Vec<usize> = Vec::new();
        self.extract_paths_to_true(root, &mut current_path, &mut cut_sets);

        self.filter_minimal_cut_sets(cut_sets)
    }

    pub fn extract_prime_implicants(&mut self, root: NodeIndex) -> Vec<CutSet> {
        let complement = self.not(root);
        let mut prime_implicants = Vec::new();
        let mut current_path: Vec<usize> = Vec::new();
        self.extract_paths_to_true_with_negation(
            complement,
            &mut current_path,
            &mut prime_implicants,
        );

        self.filter_minimal_cut_sets(prime_implicants)
    }

    fn extract_paths_to_true_with_negation(
        &self,
        node: NodeIndex,
        current_path: &mut Vec<usize>,
        prime_implicants: &mut Vec<CutSet>,
    ) {
        if node == NodeIndex::TRUE {
            let event_names: Vec<String> = current_path
                .iter()
                .filter_map(|&var_idx| self.variable_names.get(&var_idx).cloned())
                .collect();

            if !event_names.is_empty() || current_path.is_empty() {
                prime_implicants.push(CutSet::new(event_names));
            }
            return;
        }

        if node == NodeIndex::FALSE {
            return;
        }

        if let Some(n) = self.get_node(node) {
            let variable = n.variable;
            let low = n.low;
            let high = n.high;

            current_path.push(variable);
            self.extract_paths_to_true_with_negation(low, current_path, prime_implicants);
            current_path.pop();

            self.extract_paths_to_true_with_negation(high, current_path, prime_implicants);
        }
    }

    fn filter_minimal_cut_sets(&self, cut_sets: Vec<CutSet>) -> Vec<CutSet> {
        let mut minimal = Vec::new();

        for candidate in &cut_sets {
            let is_minimal = cut_sets.iter().all(|other| {
                if other == candidate {
                    return true;
                }
                !(other.events.is_subset(&candidate.events)
                    && other.events.len() < candidate.events.len())
            });

            if is_minimal {
                minimal.push(candidate.clone());
            }
        }

        minimal
    }

    fn extract_paths_to_true(
        &self,
        node: NodeIndex,
        current_path: &mut Vec<usize>,
        cut_sets: &mut Vec<CutSet>,
    ) {
        if node == NodeIndex::TRUE {
            let event_names: Vec<String> = current_path
                .iter()
                .filter_map(|&var_idx| self.variable_names.get(&var_idx).cloned())
                .collect();

            if !event_names.is_empty() {
                cut_sets.push(CutSet::new(event_names));
            }
            return;
        }

        if node == NodeIndex::FALSE {
            return;
        }

        if let Some(n) = self.get_node(node) {
            let variable = n.variable;
            let low = n.low;
            let high = n.high;

            current_path.push(variable);
            self.extract_paths_to_true(high, current_path, cut_sets);
            current_path.pop();

            self.extract_paths_to_true(low, current_path, cut_sets);
        }
    }

    pub fn from_gate(
        &mut self,
        gate: &Gate,
        gate_cache: &mut HashMap<String, NodeIndex>,
    ) -> NodeIndex {
        if let Some(&cached) = gate_cache.get(gate.element().id()) {
            return cached;
        }

        let operand_indices: Vec<NodeIndex> = gate
            .operands()
            .iter()
            .filter_map(|op_id| gate_cache.get(op_id).copied())
            .collect();

        if operand_indices.is_empty() {
            return NodeIndex::FALSE;
        }

        let result = match gate.formula() {
            Formula::And => operand_indices
                .iter()
                .copied()
                .reduce(|acc, n| self.and(acc, n))
                .unwrap_or(NodeIndex::TRUE),

            Formula::Or => operand_indices
                .iter()
                .copied()
                .reduce(|acc, n| self.or(acc, n))
                .unwrap_or(NodeIndex::FALSE),

            Formula::Not => {
                if operand_indices.len() == 1 {
                    self.not(operand_indices[0])
                } else {
                    NodeIndex::FALSE
                }
            }

            Formula::Xor => operand_indices
                .iter()
                .copied()
                .reduce(|acc, n| self.xor(acc, n))
                .unwrap_or(NodeIndex::FALSE),

            Formula::Iff => {
                if operand_indices.len() >= 2 {
                    operand_indices
                        .iter()
                        .copied()
                        .reduce(|acc, n| self.iff(acc, n))
                        .unwrap()
                } else {
                    NodeIndex::TRUE
                }
            }

            Formula::Nand => operand_indices
                .iter()
                .copied()
                .reduce(|acc, n| self.nand(acc, n))
                .unwrap_or(NodeIndex::FALSE),

            Formula::Nor => operand_indices
                .iter()
                .copied()
                .reduce(|acc, n| self.nor(acc, n))
                .unwrap_or(NodeIndex::TRUE),

            Formula::AtLeast { min } => self.atleast(&operand_indices, *min),
        };

        gate_cache.insert(gate.element().id().to_string(), result);

        result
    }

    pub fn from_fault_tree(&mut self, fault_tree: &FaultTree) -> Result<NodeIndex> {
        let topo = Self::topological_order(fault_tree);

        let var_order = Self::order_variables(fault_tree, &topo);

        let mut gate_cache: HashMap<String, NodeIndex> = HashMap::new();

        for (event_id, var_idx) in &var_order {
            let event = fault_tree.basic_events().get(event_id).unwrap();
            let node = self.variable(*var_idx, event.probability());
            self.variable_names.insert(*var_idx, event_id.clone());
            gate_cache.insert(event_id.clone(), node);
        }

        for (event_id, event) in fault_tree.house_events() {
            let node = if event.state() { NodeIndex::TRUE } else { NodeIndex::FALSE };
            gate_cache.insert(event_id.clone(), node);
        }

        for gate_id in &topo {
            let gate = match fault_tree.gates().get(gate_id) {
                Some(g) => g,
                None => continue,
            };
            self.from_gate(gate, &mut gate_cache);
            self.ite_cache.clear();
        }

        let top_gate_id = fault_tree.top_event();
        if top_gate_id.is_empty() {
            return Err(crate::error::PraxisError::Logic("Fault tree has no top event".into()));
        }
        gate_cache.get(top_gate_id).copied().ok_or_else(|| {
            crate::error::PraxisError::Logic(format!("Failed to convert top event '{}'", top_gate_id))
        })
    }

    fn topological_order(fault_tree: &FaultTree) -> Vec<String> {
        let gates = fault_tree.gates();
        let mut order: Vec<String> = Vec::with_capacity(gates.len());
        let mut visited: HashMap<&str, bool> = HashMap::new();

        fn visit<'a>(
            id: &'a str,
            gates: &'a HashMap<String, Gate>,
            visited: &mut HashMap<&'a str, bool>,
            order: &mut Vec<String>,
        ) {
            if visited.contains_key(id) {
                return;
            }
            visited.insert(id, true);
            if let Some(gate) = gates.get(id) {
                for op in gate.operands() {
                    visit(op.as_str(), gates, visited, order);
                }
            }
            if gates.contains_key(id) {
                order.push(id.to_string());
            }
        }

        let top = fault_tree.top_event().to_string();
        visit(&top, gates, &mut visited, &mut order);

        for gate_id in gates.keys() {
            visit(gate_id.as_str(), gates, &mut visited, &mut order);
        }

        order
    }

    fn order_variables(fault_tree: &FaultTree, topo: &[String]) -> Vec<(String, usize)> {
        let mut ref_count: HashMap<&str, usize> = HashMap::new();
        for gate in fault_tree.gates().values() {
            for op in gate.operands() {
                if fault_tree.basic_events().contains_key(op.as_str()) {
                    *ref_count.entry(op.as_str()).or_default() += 1;
                }
            }
        }

        let mut events_by_depth: Vec<(&str, usize)> = fault_tree
            .basic_events()
            .keys()
            .map(|id| {
                let depth = topo.iter().position(|g| {
                    fault_tree.gates().get(g).map_or(false, |gate| gate.operands().contains(id))
                }).unwrap_or(usize::MAX);
                let refs = ref_count.get(id.as_str()).copied().unwrap_or(0);
                (id.as_str(), depth.wrapping_mul(1000).wrapping_sub(refs))
            })
            .collect();

        events_by_depth.sort_by_key(|&(_, score)| score);

        events_by_depth
            .into_iter()
            .enumerate()
            .map(|(idx, (id, _))| (id.to_string(), idx))
            .collect()
    }

    pub fn node_data(&self, idx: NodeIndex) -> Option<(usize, NodeIndex, NodeIndex)> {
        self.get_node(idx).map(|n| (n.variable, n.low, n.high))
    }

    pub fn variable_names(&self) -> &HashMap<usize, String> {
        &self.variable_names
    }

    pub fn stats(&self) -> BddStats {
        BddStats {
            num_nodes: self.nodes.len() + 2,
            num_variables: self.variable_probs.len(),
            unique_table_size: self.unique_table.len(),
            ite_cache_size: self.ite_cache.len(),
        }
    }

    pub fn clear_caches(&mut self) {
        self.ite_cache.clear();
        self.prob_cache.clear();
    }
}

impl Default for Bdd {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BddStats {
    pub num_nodes: usize,
    pub num_variables: usize,
    pub unique_table_size: usize,
    pub ite_cache_size: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bdd_constants() {
        let mut bdd = Bdd::new();
        assert_eq!(bdd.probability(NodeIndex::TRUE), 1.0);
        assert_eq!(bdd.probability(NodeIndex::FALSE), 0.0);
    }

    #[test]
    fn test_bdd_variable() {
        let mut bdd = Bdd::new();

        let x = bdd.variable(0, 0.3);
        assert!(!x.is_terminal());
        assert_eq!(bdd.probability(x), 0.3);
    }

    #[test]
    fn test_bdd_not() {
        let mut bdd = Bdd::new();

        let x = bdd.variable(0, 0.3);
        let not_x = bdd.not(x);

        assert_eq!(bdd.probability(not_x), 0.7);
    }

    #[test]
    fn test_bdd_and() {
        let mut bdd = Bdd::new();
        let x1 = bdd.variable(0, 0.1);
        let x2 = bdd.variable(1, 0.2);
        let and_result = bdd.and(x1, x2);
        assert!((bdd.probability(and_result) - 0.02).abs() < 1e-10);
    }

    #[test]
    fn test_bdd_or() {
        let mut bdd = Bdd::new();
        let x1 = bdd.variable(0, 0.1);
        let x2 = bdd.variable(1, 0.2);
        let or_result = bdd.or(x1, x2);
        assert!((bdd.probability(or_result) - 0.28).abs() < 1e-10);
    }

    #[test]
    fn test_bdd_xor() {
        let mut bdd = Bdd::new();
        let x1 = bdd.variable(0, 0.5);
        let x2 = bdd.variable(1, 0.5);
        let xor_result = bdd.xor(x1, x2);
        assert!((bdd.probability(xor_result) - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_bdd_reduction() {
        let mut bdd = Bdd::new();
        let x = bdd.variable(0, 0.5);
        let redundant = bdd.or(x, x);
        assert_eq!(redundant, x);

        let redundant2 = bdd.and(x, x);
        assert_eq!(redundant2, x);
    }

    #[test]
    fn test_bdd_atleast() {
        let mut bdd = Bdd::new();
        let x1 = bdd.variable(0, 0.5);
        let x2 = bdd.variable(1, 0.5);
        let x3 = bdd.variable(2, 0.5);

        let atleast2 = bdd.atleast(&[x1, x2, x3], 2);
        assert!((bdd.probability(atleast2) - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_bdd_stats() {
        let mut bdd = Bdd::new();

        let _x1 = bdd.variable(0, 0.1);
        let _x2 = bdd.variable(1, 0.2);

        let stats = bdd.stats();
        assert_eq!(stats.num_variables, 2);
        assert!(stats.num_nodes >= 2);
    }

    #[test]
    fn test_extract_cut_sets_and_gate() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1".to_string(), "TOP".to_string()).unwrap();

        let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
        top_gate.add_operand("E1".to_string());
        top_gate.add_operand("E2".to_string());
        ft.add_gate(top_gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut bdd = Bdd::new();
        let root = bdd.from_fault_tree(&ft).unwrap();

        let cut_sets = bdd.extract_cut_sets(root);

        assert_eq!(cut_sets.len(), 1);
        assert_eq!(cut_sets[0].order(), 2);
        assert!(cut_sets[0].events.contains("E1"));
        assert!(cut_sets[0].events.contains("E2"));
    }

    #[test]
    fn test_extract_cut_sets_or_gate() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1".to_string(), "TOP".to_string()).unwrap();

        let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top_gate.add_operand("E1".to_string());
        top_gate.add_operand("E2".to_string());
        ft.add_gate(top_gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut bdd = Bdd::new();
        let root = bdd.from_fault_tree(&ft).unwrap();

        let cut_sets = bdd.extract_cut_sets(root);

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
    fn test_extract_cut_sets_complex() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1".to_string(), "TOP".to_string()).unwrap();

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

        let mut bdd = Bdd::new();
        let root = bdd.from_fault_tree(&ft).unwrap();

        let cut_sets = bdd.extract_cut_sets(root);

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
    fn test_extract_prime_implicants_or_gate() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1".to_string(), "TOP".to_string()).unwrap();

        let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top_gate.add_operand("E1".to_string());
        top_gate.add_operand("E2".to_string());
        ft.add_gate(top_gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut bdd = Bdd::new();
        let root = bdd.from_fault_tree(&ft).unwrap();

        let prime_implicants = bdd.extract_prime_implicants(root);

        assert_eq!(prime_implicants.len(), 1, "Expected 1 prime implicant");
        assert_eq!(prime_implicants[0].order(), 2);
        assert!(prime_implicants[0].events.contains("E1"));
        assert!(prime_implicants[0].events.contains("E2"));
    }

    #[test]
    fn test_extract_prime_implicants_and_gate() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1".to_string(), "TOP".to_string()).unwrap();

        let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
        top_gate.add_operand("E1".to_string());
        top_gate.add_operand("E2".to_string());
        ft.add_gate(top_gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut bdd = Bdd::new();
        let root = bdd.from_fault_tree(&ft).unwrap();

        let prime_implicants = bdd.extract_prime_implicants(root);

        assert_eq!(prime_implicants.len(), 2);

        let has_e1_only = prime_implicants
            .iter()
            .any(|pi| pi.order() == 1 && pi.events.contains("E1"));
        let has_e2_only = prime_implicants
            .iter()
            .any(|pi| pi.order() == 1 && pi.events.contains("E2"));

        assert!(has_e1_only, "Should have prime implicant {{E1}}");
        assert!(has_e2_only, "Should have prime implicant {{E2}}");
    }

    #[test]
    fn test_extract_prime_implicants_complex() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1".to_string(), "TOP".to_string()).unwrap();

        let mut top_gate = Gate::new("TOP".to_string(), Formula::And).unwrap();
        top_gate.add_operand("G1".to_string());
        top_gate.add_operand("E3".to_string());
        ft.add_gate(top_gate).unwrap();

        let mut g1_gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1_gate.add_operand("E1".to_string());
        g1_gate.add_operand("E2".to_string());
        ft.add_gate(g1_gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();

        let mut bdd = Bdd::new();
        let root = bdd.from_fault_tree(&ft).unwrap();

        let prime_implicants = bdd.extract_prime_implicants(root);

        assert_eq!(prime_implicants.len(), 2);

        let has_e1_e2 = prime_implicants
            .iter()
            .any(|pi| pi.order() == 2 && pi.events.contains("E1") && pi.events.contains("E2"));

        let has_e3 = prime_implicants
            .iter()
            .any(|pi| pi.order() == 1 && pi.events.contains("E3"));

        assert!(has_e1_e2, "Should have prime implicant {{E1, E2}}");
        assert!(has_e3, "Should have prime implicant {{E3}}");
    }

    #[test]
    fn test_prime_implicants_duality() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("FT1".to_string(), "TOP".to_string()).unwrap();

        let mut top_gate = Gate::new("TOP".to_string(), Formula::AtLeast { min: 2 }).unwrap();
        top_gate.add_operand("E1".to_string());
        top_gate.add_operand("E2".to_string());
        top_gate.add_operand("E3".to_string());
        ft.add_gate(top_gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();

        let mut bdd = Bdd::new();
        let root = bdd.from_fault_tree(&ft).unwrap();

        let cut_sets = bdd.extract_cut_sets(root);
        let prime_implicants = bdd.extract_prime_implicants(root);

        assert_eq!(cut_sets.len(), 3);
        assert!(cut_sets.iter().all(|cs| cs.order() == 2));

        assert_eq!(prime_implicants.len(), 3);
        assert!(prime_implicants.iter().all(|pi| pi.order() == 2));
    }

    #[test]
    fn test_bdd_baobab1_faster_than_zbdd() {
        use crate::algorithms::zbdd::Zbdd;
        use crate::io::parser::parse_fault_tree;
        use std::time::Instant;

        let xml = include_str!("../../tests/fixtures/benchmarks/Aralia/baobab1.xml");
        let ft = parse_fault_tree(xml).expect("parse baobab1.xml");

        let t0 = Instant::now();
        let mut bdd = Bdd::new();
        let root = bdd.from_fault_tree(&ft).unwrap();
        let _prob = bdd.probability(root);
        let bdd_time = t0.elapsed();

        let t1 = Instant::now();
        let (zbdd, zroot) = Zbdd::from_fault_tree(&ft).unwrap();
        let _mcs = zbdd.get_cut_sets(zroot, None);
        let zbdd_time = t1.elapsed();

        assert!(
            bdd_time < zbdd_time,
            "BDD ({:?}) should be faster than ZBDD ({:?}) for baobab1 probability-only query",
            bdd_time,
            zbdd_time,
        );
    }
}
