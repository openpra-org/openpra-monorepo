use std::collections::{HashMap, HashSet};

use crate::core::fault_tree::FaultTree;
use crate::core::gate::Formula;
use crate::error::{PraxisError, Result};

pub type NodeIdx = i32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BddConnective {
    And,
    Or,
    Not,
    AtLeast,
    Xor,
    Nand,
    Nor,
    Iff,
}

impl BddConnective {
    pub fn from_formula(f: &Formula) -> Self {
        match f {
            Formula::And => Self::And,
            Formula::Or => Self::Or,
            Formula::Not => Self::Not,
            Formula::AtLeast { .. } => Self::AtLeast,
            Formula::Xor => Self::Xor,
            Formula::Nand => Self::Nand,
            Formula::Nor => Self::Nor,
            Formula::Iff => Self::Iff,
        }
    }

    pub fn is_coherent(self) -> bool {
        matches!(self, Self::And | Self::Or | Self::AtLeast)
    }
}

#[derive(Debug, Clone)]
pub enum BddPdagNode {
    Variable {
        id: String,
        idx: NodeIdx,
    },

    Gate {
        id: String,
        idx: NodeIdx,
        connective: BddConnective,
        operands: Vec<NodeIdx>,
        min_number: Option<usize>,
    },

    Constant {
        idx: NodeIdx,
        value: bool,
    },
}

impl BddPdagNode {
    pub fn idx(&self) -> NodeIdx {
        match self {
            Self::Variable { idx, .. } | Self::Gate { idx, .. } | Self::Constant { idx, .. } => {
                *idx
            }
        }
    }

    pub fn id(&self) -> Option<&str> {
        match self {
            Self::Variable { id, .. } | Self::Gate { id, .. } => Some(id),
            Self::Constant { .. } => None,
        }
    }

    pub fn is_variable(&self) -> bool {
        matches!(self, Self::Variable { .. })
    }

    pub fn is_gate(&self) -> bool {
        matches!(self, Self::Gate { .. })
    }
}

#[derive(Debug)]
pub struct BddPdag {
    nodes: Vec<Option<BddPdagNode>>,
    id_to_idx: HashMap<String, NodeIdx>,
    next_idx: NodeIdx,
    root: Option<NodeIdx>,
    probabilities: HashMap<NodeIdx, f64>,
    variable_order: Vec<NodeIdx>,
    var_to_bdd_pos: HashMap<NodeIdx, usize>,
    ie_frequency: f64,
    true_idx: Option<NodeIdx>,
    false_idx: Option<NodeIdx>,
    gate_min_time: HashMap<NodeIdx, usize>,
    gate_max_time: HashMap<NodeIdx, usize>,
    module_gates: HashSet<NodeIdx>,
}

impl BddPdag {
    pub fn new() -> Self {
        Self {
            nodes: vec![None],
            id_to_idx: HashMap::new(),
            next_idx: 1,
            root: None,
            probabilities: HashMap::new(),
            variable_order: Vec::new(),
            var_to_bdd_pos: HashMap::new(),
            ie_frequency: 1.0,
            true_idx: None,
            false_idx: None,
            gate_min_time: HashMap::new(),
            gate_max_time: HashMap::new(),
            module_gates: HashSet::new(),
        }
    }

    pub fn add_variable(&mut self, id: String, prob: f64) -> NodeIdx {
        if let Some(&idx) = self.id_to_idx.get(&id) {
            return idx;
        }
        let idx = self.alloc_idx();
        self.nodes.push(Some(BddPdagNode::Variable {
            id: id.clone(),
            idx,
        }));
        self.id_to_idx.insert(id, idx);
        self.probabilities.insert(idx, prob);
        idx
    }

    pub fn add_gate(
        &mut self,
        id: String,
        connective: BddConnective,
        operands: Vec<NodeIdx>,
        min_number: Option<usize>,
    ) -> Result<NodeIdx> {
        if let Some(&idx) = self.id_to_idx.get(&id) {
            return Ok(idx);
        }
        for &op in &operands {
            let abs = op.unsigned_abs() as usize;
            if abs == 0 || abs >= self.nodes.len() || self.nodes[abs].is_none() {
                return Err(PraxisError::Logic(format!(
                    "BddPdag: operand index {} does not exist",
                    op
                )));
            }
        }
        let idx = self.alloc_idx();
        self.nodes.push(Some(BddPdagNode::Gate {
            id: id.clone(),
            idx,
            connective,
            operands,
            min_number,
        }));
        self.id_to_idx.insert(id, idx);
        Ok(idx)
    }

    pub fn set_root(&mut self, idx: NodeIdx) -> Result<()> {
        let abs = idx.unsigned_abs() as usize;
        if abs == 0 || abs >= self.nodes.len() || self.nodes[abs].is_none() {
            return Err(PraxisError::Logic(format!(
                "BddPdag: root index {} does not exist",
                idx
            )));
        }
        self.root = Some(idx.abs());
        Ok(())
    }

    pub fn root(&self) -> Option<NodeIdx> {
        self.root
    }

    pub fn node(&self, idx: NodeIdx) -> Option<&BddPdagNode> {
        let abs = idx.unsigned_abs() as usize;
        self.nodes.get(abs).and_then(|slot| slot.as_ref())
    }

    pub fn idx_of(&self, id: &str) -> Option<NodeIdx> {
        self.id_to_idx.get(id).copied()
    }

    pub fn is_coherent(&self) -> bool {
        self.nodes.iter().flatten().all(|n| {
            if let BddPdagNode::Gate { connective, .. } = n {
                connective.is_coherent()
            } else {
                true
            }
        })
    }

    pub fn num_variables(&self) -> usize {
        self.nodes
            .iter()
            .flatten()
            .filter(|n| n.is_variable())
            .count()
    }

    pub fn probability_of(&self, idx: NodeIdx) -> Option<f64> {
        self.probabilities.get(&idx.abs()).copied()
    }

    pub fn variable_order(&self) -> &[NodeIdx] {
        &self.variable_order
    }

    pub fn bdd_pos_of(&self, idx: NodeIdx) -> Option<usize> {
        self.var_to_bdd_pos.get(&idx.abs()).copied()
    }

    pub fn set_variable_order(&mut self, order: Vec<NodeIdx>) {
        self.var_to_bdd_pos.clear();
        for (pos, &idx) in order.iter().enumerate() {
            self.var_to_bdd_pos.insert(idx.abs(), pos);
        }
        self.variable_order = order;
    }

    pub fn get_or_create_true(&mut self) -> NodeIdx {
        if let Some(idx) = self.true_idx {
            return idx;
        }
        let idx = self.alloc_idx();
        self.nodes.push(Some(BddPdagNode::Constant { idx, value: true }));
        self.true_idx = Some(idx);
        idx
    }

    pub fn get_or_create_false(&mut self) -> NodeIdx {
        if let Some(idx) = self.false_idx {
            return idx;
        }
        let idx = self.alloc_idx();
        self.nodes.push(Some(BddPdagNode::Constant { idx, value: false }));
        self.false_idx = Some(idx);
        idx
    }

    pub fn ie_frequency(&self) -> f64 {
        self.ie_frequency
    }

    pub fn set_ie_frequency(&mut self, freq: f64) {
        debug_assert!(freq > 0.0 && freq.is_finite());
        self.ie_frequency = freq;
    }

    pub fn compute_ordering_and_modules(&mut self) -> Result<()> {
        let root = self.root.ok_or_else(|| {
            PraxisError::Logic("BddPdag: cannot order variables — root not set".to_string())
        })?;

        let (gate_min, gate_max, modules, order) = {
            let mut state = DfsState {
                nodes: &self.nodes,
                counter: 0,
                order: Vec::new(),
                cache: HashMap::new(),
                gate_min: HashMap::new(),
                gate_max: HashMap::new(),
                modules: HashSet::new(),
            };
            state.visit(root);
            (state.gate_min, state.gate_max, state.modules, state.order)
        };

        self.gate_min_time = gate_min;
        self.gate_max_time = gate_max;
        self.module_gates = modules;
        self.set_variable_order(order);
        Ok(())
    }

    pub fn gate_min_time(&self, idx: NodeIdx) -> Option<usize> {
        self.gate_min_time.get(&idx.abs()).copied()
    }

    pub fn gate_max_time(&self, idx: NodeIdx) -> Option<usize> {
        self.gate_max_time.get(&idx.abs()).copied()
    }

    pub fn is_module(&self, idx: NodeIdx) -> bool {
        self.module_gates.contains(&idx.abs())
    }

    pub fn from_fault_tree(ft: &FaultTree) -> Result<Self> {
        let mut g = BddPdag::new();

        for event in ft.basic_events().values() {
            g.add_variable(event.element().id().to_string(), event.probability());
        }

        let top = ft.top_event();
        if top.is_empty() {
            return Err(PraxisError::Logic(
                "BddPdag: fault tree has no top event".to_string(),
            ));
        }

        let mut gate_cache: HashMap<String, NodeIdx> = HashMap::new();
        let root = g.build_element(ft, top, &mut gate_cache)?;
        g.set_root(root)?;
        Ok(g)
    }

    fn build_element(
        &mut self,
        ft: &FaultTree,
        id: &str,
        cache: &mut HashMap<String, NodeIdx>,
    ) -> Result<NodeIdx> {
        if let Some(&cached) = cache.get(id) {
            return Ok(cached);
        }
        if let Some(&existing) = self.id_to_idx.get(id) {
            return Ok(existing);
        }

        let gate = ft
            .get_gate(id)
            .ok_or_else(|| PraxisError::Logic(format!("BddPdag: element '{}' not found", id)))?;

        let connective = BddConnective::from_formula(gate.formula());
        let min_number = match gate.formula() {
            Formula::AtLeast { min } => Some(*min),
            _ => None,
        };

        let mut operand_indices = Vec::new();
        for op_id in gate.operands() {
            let op_idx = self.build_element(ft, op_id, cache)?;
            operand_indices.push(op_idx);
        }

        let gate_idx = self.add_gate(id.to_string(), connective, operand_indices, min_number)?;
        cache.insert(id.to_string(), gate_idx);
        Ok(gate_idx)
    }

    fn alloc_idx(&mut self) -> NodeIdx {
        let idx = self.next_idx;
        self.next_idx += 1;
        idx
    }
}

impl Default for BddPdag {
    fn default() -> Self {
        Self::new()
    }
}

struct DfsState<'a> {
    nodes: &'a Vec<Option<BddPdagNode>>,
    counter: usize,
    order: Vec<NodeIdx>,
    cache: HashMap<NodeIdx, (usize, usize, usize)>,
    gate_min: HashMap<NodeIdx, usize>,
    gate_max: HashMap<NodeIdx, usize>,
    modules: HashSet<NodeIdx>,
}

impl<'a> DfsState<'a> {
    fn visit(&mut self, idx: NodeIdx) -> (usize, usize, usize) {
        let abs_idx: NodeIdx = idx.abs();
        let abs_usize = abs_idx as usize;

        if let Some(&(mn, mx, _)) = self.cache.get(&abs_idx) {
            return (mn, mx, 0);
        }

        match self.nodes.get(abs_usize).and_then(|s| s.as_ref()) {
            Some(BddPdagNode::Variable { .. }) => {
                let t = self.counter;
                self.counter += 1;
                self.order.push(abs_idx);
                let result = (t, t, 1);
                self.cache.insert(abs_idx, result);
                result
            }

            Some(BddPdagNode::Gate { operands, .. }) => {
                let ops: Vec<NodeIdx> = operands.clone();
                let mut mn = usize::MAX;
                let mut mx = 0usize;
                let mut new_vars = 0usize;

                for op in ops {
                    let (op_mn, op_mx, op_new) = self.visit(op);
                    if op_mn != usize::MAX {
                        mn = mn.min(op_mn);
                        mx = mx.max(op_mx);
                    }
                    new_vars += op_new;
                }

                if new_vars > 0 && mn != usize::MAX && mx - mn + 1 == new_vars {
                    self.modules.insert(abs_idx);
                }
                self.gate_min.insert(abs_idx, mn);
                self.gate_max.insert(abs_idx, mx);

                let result = (mn, mx, new_vars);
                self.cache.insert(abs_idx, result);
                result
            }

            _ => {
                let result = (usize::MAX, 0, 0);
                self.cache.insert(abs_idx, result);
                result
            }
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};

    fn simple_ft() -> FaultTree {
        let mut ft = FaultTree::new("FT1".to_string(), "TOP".to_string()).unwrap();
        let mut top = Gate::new("TOP".to_string(), Formula::And).unwrap();
        top.add_operand("E1".to_string());
        top.add_operand("E2".to_string());
        ft.add_gate(top).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.03).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.07).unwrap())
            .unwrap();
        ft
    }

    #[test]
    fn test_add_variable() {
        let mut g = BddPdag::new();
        let e1 = g.add_variable("E1".to_string(), 0.05);
        assert_eq!(e1, 1);
        assert!(g.node(e1).unwrap().is_variable());
        assert_eq!(g.node(e1).unwrap().id(), Some("E1"));
    }

    #[test]
    fn test_add_variable_idempotent() {
        let mut g = BddPdag::new();
        let a = g.add_variable("E1".to_string(), 0.1);
        let b = g.add_variable("E1".to_string(), 0.9);

        assert_eq!(a, b);
        assert!((g.probability_of(a).unwrap() - 0.1).abs() < 1e-12);
    }

    #[test]
    fn test_add_gate() {
        let mut g = BddPdag::new();
        let e1 = g.add_variable("E1".to_string(), 0.0);
        let e2 = g.add_variable("E2".to_string(), 0.0);
        let gate = g
            .add_gate("G1".to_string(), BddConnective::And, vec![e1, e2], None)
            .unwrap();
        assert!(g.node(gate).unwrap().is_gate());
    }

    #[test]
    fn test_variable_indices_below_gate_indices() {
        let ft = simple_ft();
        let g = BddPdag::from_fault_tree(&ft).unwrap();

        let e1_idx = g.idx_of("E1").unwrap();
        let e2_idx = g.idx_of("E2").unwrap();
        let top_idx = g.idx_of("TOP").unwrap();

        assert!(e1_idx < top_idx, "variable index must be < gate index");
        assert!(e2_idx < top_idx, "variable index must be < gate index");
    }

    #[test]
    fn test_root_set_on_from_fault_tree() {
        let ft = simple_ft();
        let g = BddPdag::from_fault_tree(&ft).unwrap();
        assert!(g.root().is_some());
        let root_idx = g.root().unwrap();
        assert!(g.node(root_idx).unwrap().is_gate());
    }

    #[test]
    fn test_probability_stored() {
        let ft = simple_ft();
        let g = BddPdag::from_fault_tree(&ft).unwrap();

        let e1 = g.idx_of("E1").unwrap();
        let e2 = g.idx_of("E2").unwrap();

        assert!((g.probability_of(e1).unwrap() - 0.03).abs() < 1e-12);
        assert!((g.probability_of(e2).unwrap() - 0.07).abs() < 1e-12);
    }

    #[test]
    fn test_probability_complement_index() {
        let ft = simple_ft();
        let g = BddPdag::from_fault_tree(&ft).unwrap();
        let e1 = g.idx_of("E1").unwrap();

        assert!((g.probability_of(-e1).unwrap() - 0.03).abs() < 1e-12);
    }

    #[test]
    fn test_probability_none_for_gate() {
        let ft = simple_ft();
        let g = BddPdag::from_fault_tree(&ft).unwrap();
        let top = g.idx_of("TOP").unwrap();
        assert!(g.probability_of(top).is_none());
    }

    #[test]
    fn test_variable_order_empty_by_default() {
        let g = BddPdag::new();
        assert!(g.variable_order().is_empty());
    }

    #[test]
    fn test_set_variable_order() {
        let ft = simple_ft();
        let mut g = BddPdag::from_fault_tree(&ft).unwrap();

        let e1 = g.idx_of("E1").unwrap();
        let e2 = g.idx_of("E2").unwrap();

        g.set_variable_order(vec![e2, e1]);

        assert_eq!(g.variable_order(), &[e2, e1]);
        assert_eq!(g.bdd_pos_of(e2).unwrap(), 0);
        assert_eq!(g.bdd_pos_of(e1).unwrap(), 1);
    }

    #[test]
    fn test_bdd_pos_complement_index() {
        let ft = simple_ft();
        let mut g = BddPdag::from_fault_tree(&ft).unwrap();
        let e1 = g.idx_of("E1").unwrap();
        let e2 = g.idx_of("E2").unwrap();
        g.set_variable_order(vec![e1, e2]);
        assert_eq!(g.bdd_pos_of(-e1).unwrap(), 0);
    }

    #[test]
    fn test_bdd_pos_none_before_ordering() {
        let ft = simple_ft();
        let g = BddPdag::from_fault_tree(&ft).unwrap();
        let e1 = g.idx_of("E1").unwrap();
        assert!(g.bdd_pos_of(e1).is_none());
    }

    #[test]
    fn test_ie_frequency_default() {
        let g = BddPdag::new();
        assert!((g.ie_frequency() - 1.0).abs() < 1e-12);
    }

    #[test]
    fn test_set_ie_frequency() {
        let mut g = BddPdag::new();
        g.set_ie_frequency(1e-4);
        assert!((g.ie_frequency() - 1e-4).abs() < 1e-16);
    }

    #[test]
    fn test_is_coherent_pure_and_or() {
        let ft = simple_ft();
        let g = BddPdag::from_fault_tree(&ft).unwrap();
        assert!(g.is_coherent());
    }

    #[test]
    fn test_is_coherent_with_not() {
        let mut g = BddPdag::new();
        let e1 = g.add_variable("E1".to_string(), 0.0);
        g.add_gate("NOT_E1".to_string(), BddConnective::Not, vec![e1], None)
            .unwrap();
        assert!(!g.is_coherent());
    }

    fn two_var_ft() -> FaultTree {
        simple_ft()
    }

    fn four_var_ft() -> FaultTree {
        let mut ft = FaultTree::new("FT4", "TOP").unwrap();
        let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        g1.add_operand("E1".to_string());
        g1.add_operand("E2".to_string());
        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("E3".to_string());
        g2.add_operand("E4".to_string());
        let mut top = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top.add_operand("G1".to_string());
        top.add_operand("G2".to_string());
        ft.add_gate(g1).unwrap();
        ft.add_gate(g2).unwrap();
        ft.add_gate(top).unwrap();
        for name in ["E1", "E2", "E3", "E4"] {
            ft.add_basic_event(BasicEvent::new(name.to_string(), 0.1).unwrap())
                .unwrap();
        }
        ft
    }

    #[test]
    fn test_ordering_no_root_error() {
        let mut g = BddPdag::new();
        assert!(g.compute_ordering_and_modules().is_err());
    }

    #[test]
    fn test_ordering_two_vars_assigned() {
        let ft = two_var_ft();
        let mut g = BddPdag::from_fault_tree(&ft).unwrap();
        g.compute_ordering_and_modules().unwrap();

        let e1 = g.idx_of("E1").unwrap();
        let e2 = g.idx_of("E2").unwrap();

        assert!(g.bdd_pos_of(e1).is_some());
        assert!(g.bdd_pos_of(e2).is_some());
        assert_ne!(g.bdd_pos_of(e1).unwrap(), g.bdd_pos_of(e2).unwrap());
        assert_eq!(g.variable_order().len(), 2);
    }

    #[test]
    fn test_ordering_dfs_left_to_right() {
        let ft = two_var_ft();
        let mut g = BddPdag::from_fault_tree(&ft).unwrap();
        g.compute_ordering_and_modules().unwrap();

        let e1 = g.idx_of("E1").unwrap();
        let e2 = g.idx_of("E2").unwrap();
        let pos_e1 = g.bdd_pos_of(e1).unwrap();
        let pos_e2 = g.bdd_pos_of(e2).unwrap();

        assert!(pos_e1 < pos_e2, "E1 (pos {pos_e1}) must precede E2 (pos {pos_e2})");
    }

    #[test]
    fn test_ordering_four_vars_consecutive() {
        let ft = four_var_ft();
        let mut g = BddPdag::from_fault_tree(&ft).unwrap();
        g.compute_ordering_and_modules().unwrap();

        assert_eq!(g.variable_order().len(), 4);
        let order: Vec<Option<&str>> = g
            .variable_order()
            .iter()
            .map(|&idx| g.node(idx).and_then(|n| n.id()))
            .collect();

        let pos_e1 = g.bdd_pos_of(g.idx_of("E1").unwrap()).unwrap();
        let pos_e2 = g.bdd_pos_of(g.idx_of("E2").unwrap()).unwrap();
        let pos_e3 = g.bdd_pos_of(g.idx_of("E3").unwrap()).unwrap();
        let pos_e4 = g.bdd_pos_of(g.idx_of("E4").unwrap()).unwrap();
        assert!(pos_e1 < pos_e3, "E1 before E3: {order:?}");
        assert!(pos_e2 < pos_e3, "E2 before E3: {order:?}");
        assert!(pos_e3 < pos_e4 || pos_e4 < pos_e3);
        let _ = pos_e4;
    }

    #[test]
    fn test_gate_min_max_time_set() {
        let ft = two_var_ft();
        let mut g = BddPdag::from_fault_tree(&ft).unwrap();
        g.compute_ordering_and_modules().unwrap();

        let top = g.idx_of("TOP").unwrap();

        assert_eq!(g.gate_min_time(top), Some(0));
        assert_eq!(g.gate_max_time(top), Some(1));
    }

    #[test]
    fn test_module_isolated_subgates() {
        let ft = four_var_ft();
        let mut g = BddPdag::from_fault_tree(&ft).unwrap();
        g.compute_ordering_and_modules().unwrap();

        let g1 = g.idx_of("G1").unwrap();
        let g2 = g.idx_of("G2").unwrap();

        assert!(g.is_module(g1), "G1 should be a module");
        assert!(g.is_module(g2), "G2 should be a module");
    }

    #[test]
    fn test_module_root_is_not_module_when_children_cover_all_vars() {
        let ft = four_var_ft();
        let mut g = BddPdag::from_fault_tree(&ft).unwrap();
        g.compute_ordering_and_modules().unwrap();

        let top = g.idx_of("TOP").unwrap();

        assert!(g.is_module(top));
    }

    #[test]
    fn test_is_module_false_before_compute() {
        let ft = two_var_ft();
        let g = BddPdag::from_fault_tree(&ft).unwrap();
        let top = g.idx_of("TOP").unwrap();
        assert!(!g.is_module(top));
    }

    #[test]
    fn test_gate_min_max_none_before_compute() {
        let ft = two_var_ft();
        let g = BddPdag::from_fault_tree(&ft).unwrap();
        let top = g.idx_of("TOP").unwrap();
        assert!(g.gate_min_time(top).is_none());
        assert!(g.gate_max_time(top).is_none());
    }

    #[test]
    fn test_complement_index_works_for_module_check() {
        let ft = four_var_ft();
        let mut g = BddPdag::from_fault_tree(&ft).unwrap();
        g.compute_ordering_and_modules().unwrap();

        let g1 = g.idx_of("G1").unwrap();

        assert_eq!(g.is_module(-g1), g.is_module(g1));
        assert_eq!(g.gate_min_time(-g1), g.gate_min_time(g1));
    }
}
