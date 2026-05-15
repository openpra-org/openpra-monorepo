use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::core::fault_tree::FaultTree;
use crate::core::gate::Formula;
use crate::error::{PraxisError, Result};

pub type NodeIndex = i32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Connective {
    And,
    Or,
    Not,
    AtLeast,
    Xor,
    Nand,
    Nor,
    Iff,
    Null,
}

impl Connective {
    pub fn from_formula(formula: &Formula) -> Self {
        match formula {
            Formula::And => Connective::And,
            Formula::Or => Connective::Or,
            Formula::Not => Connective::Not,
            Formula::AtLeast { .. } => Connective::AtLeast,
            Formula::Xor => Connective::Xor,
            Formula::Nand => Connective::Nand,
            Formula::Nor => Connective::Nor,
            Formula::Iff => Connective::Iff,
        }
    }

    pub fn is_coherent(&self) -> bool {
        matches!(self, Connective::And | Connective::Or | Connective::AtLeast)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PdagNode {
    BasicEvent { id: String, index: NodeIndex },
    Gate {
        id: String,
        index: NodeIndex,
        connective: Connective,
        operands: Vec<NodeIndex>,
        min_number: Option<usize>,
    },
    Constant { index: NodeIndex, value: bool },
}

impl PdagNode {
    pub fn index(&self) -> NodeIndex {
        match self {
            PdagNode::BasicEvent { index, .. } => *index,
            PdagNode::Gate { index, .. } => *index,
            PdagNode::Constant { index, .. } => *index,
        }
    }

    pub fn id(&self) -> Option<&str> {
        match self {
            PdagNode::BasicEvent { id, .. } => Some(id),
            PdagNode::Gate { id, .. } => Some(id),
            PdagNode::Constant { .. } => None,
        }
    }

    pub fn is_basic_event(&self) -> bool {
        matches!(self, PdagNode::BasicEvent { .. })
    }

    pub fn is_gate(&self) -> bool {
        matches!(self, PdagNode::Gate { .. })
    }

    pub fn is_constant(&self) -> bool {
        matches!(self, PdagNode::Constant { .. })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdagStats {
    pub num_nodes: usize,
    pub num_gates: usize,
    pub num_basic_events: usize,
    pub num_constants: usize,
    pub max_depth: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pdag {
    nodes: HashMap<NodeIndex, PdagNode>,
    id_to_index: HashMap<String, NodeIndex>,
    next_index: NodeIndex,
    root_index: Option<NodeIndex>,
    parents: HashMap<NodeIndex, HashSet<NodeIndex>>,
}

impl Pdag {
    pub fn new() -> Self {
        Pdag {
            nodes: HashMap::new(),
            id_to_index: HashMap::new(),
            next_index: 1,
            root_index: None,
            parents: HashMap::new(),
        }
    }

    fn allocate_index(&mut self) -> NodeIndex {
        let index = self.next_index;
        self.next_index += 1;
        index
    }

    pub fn add_basic_event(&mut self, id: String) -> NodeIndex {
        if let Some(&index) = self.id_to_index.get(&id) {
            return index;
        }

        let index = self.allocate_index();
        let node = PdagNode::BasicEvent {
            id: id.clone(),
            index,
        };

        self.nodes.insert(index, node);
        self.id_to_index.insert(id, index);
        index
    }

    pub fn add_gate(
        &mut self,
        id: String,
        connective: Connective,
        operands: Vec<NodeIndex>,
        min_number: Option<usize>,
    ) -> Result<NodeIndex> {
        if let Some(&index) = self.id_to_index.get(&id) {
            return Ok(index);
        }

        for &op in &operands {
            let abs_index = op.abs();
            if !self.nodes.contains_key(&abs_index) {
                return Err(PraxisError::Logic(format!(
                    "Operand with index {} not found",
                    abs_index
                )));
            }
        }

        let index = self.allocate_index();
        let node = PdagNode::Gate {
            id: id.clone(),
            index,
            connective,
            operands: operands.clone(),
            min_number,
        };

        self.nodes.insert(index, node);
        self.id_to_index.insert(id, index);

        for &op_index in &operands {
            let abs_index = op_index.abs();
            self.parents.entry(abs_index).or_default().insert(index);
        }

        Ok(index)
    }

    pub fn add_constant(&mut self, value: bool) -> NodeIndex {
        let index = self.allocate_index();
        let node = PdagNode::Constant { index, value };
        self.nodes.insert(index, node);
        index
    }

    pub fn get_node(&self, index: NodeIndex) -> Option<&PdagNode> {
        self.nodes.get(&index.abs())
    }

    pub fn get_index(&self, id: &str) -> Option<NodeIndex> {
        self.id_to_index.get(id).copied()
    }

    pub fn set_root(&mut self, index: NodeIndex) -> Result<()> {
        if !self.nodes.contains_key(&index.abs()) {
            return Err(PraxisError::Logic(format!(
                "Root node with index {} not found",
                index
            )));
        }
        self.root_index = Some(index);
        Ok(())
    }

    pub fn root(&self) -> Option<NodeIndex> {
        self.root_index
    }

    pub fn is_coherent(&self) -> bool {
        self.nodes.values().all(|node| {
            if let PdagNode::Gate { connective, .. } = node {
                connective.is_coherent()
            } else {
                true
            }
        })
    }

    pub fn topological_sort(&self) -> Result<Vec<NodeIndex>> {
        let mut result = Vec::new();
        let mut visited = HashSet::new();
        let mut in_progress = HashSet::new();

        if let Some(root) = self.root_index {
            self.visit_dfs(root, &mut visited, &mut in_progress, &mut result)?;
        }

        let all_indices: Vec<NodeIndex> = self.nodes.keys().copied().collect();
        for &index in &all_indices {
            if !visited.contains(&index) {
                self.visit_dfs(index, &mut visited, &mut in_progress, &mut result)?;
            }
        }

        Ok(result)
    }

    fn visit_dfs(
        &self,
        node: NodeIndex,
        visited: &mut HashSet<NodeIndex>,
        in_progress: &mut HashSet<NodeIndex>,
        result: &mut Vec<NodeIndex>,
    ) -> Result<()> {
        if visited.contains(&node) {
            return Ok(());
        }
        if in_progress.contains(&node) {
            return Err(PraxisError::Logic("Cycle detected in PDAG".to_string()));
        }

        in_progress.insert(node);

        if let Some(PdagNode::Gate { operands, .. }) = self.get_node(node) {
            for &op in operands {
                let abs_op = op.abs();
                self.visit_dfs(abs_op, visited, in_progress, result)?;
            }
        }

        in_progress.remove(&node);
        visited.insert(node);
        result.push(node);

        Ok(())
    }

    pub fn from_fault_tree(fault_tree: &FaultTree) -> Result<Self> {
        let mut pdag = Pdag::new();

        for event in fault_tree.basic_events().values() {
            let event_id = event.element().id().to_string();
            pdag.add_basic_event(event_id);
        }

        let mut gate_cache: HashMap<String, NodeIndex> = HashMap::new();

        let top_event = fault_tree.top_event();
        if top_event.is_empty() {
            return Err(PraxisError::Logic(
                "Fault tree has no top event".to_string(),
            ));
        }

        let root_index = pdag.build_from_element(fault_tree, top_event, &mut gate_cache)?;
        pdag.set_root(root_index)?;

        Ok(pdag)
    }

    fn build_from_element(
        &mut self,
        fault_tree: &FaultTree,
        element_id: &str,
        gate_cache: &mut HashMap<String, NodeIndex>,
    ) -> Result<NodeIndex> {
        if let Some(&cached_index) = gate_cache.get(element_id) {
            return Ok(cached_index);
        }

        if let Some(&index) = self.id_to_index.get(element_id) {
            return Ok(index);
        }

        let gate = fault_tree
            .get_gate(element_id)
            .ok_or_else(|| PraxisError::Logic(format!("Element not found: {}", element_id)))?;

        let formula = gate.formula();
        let connective = Connective::from_formula(formula);

        let mut operand_indices = Vec::new();
        for op_id in gate.operands() {
            let op_index = self.build_from_element(fault_tree, op_id, gate_cache)?;
            operand_indices.push(op_index);
        }

        let min_number = match formula {
            Formula::AtLeast { min } => Some(*min),
            _ => None,
        };

        let gate_index = self.add_gate(
            element_id.to_string(),
            connective,
            operand_indices,
            min_number,
        )?;

        gate_cache.insert(element_id.to_string(), gate_index);
        Ok(gate_index)
    }

    pub fn stats(&self) -> PdagStats {
        let mut num_gates = 0;
        let mut num_basic_events = 0;
        let mut num_constants = 0;

        for node in self.nodes.values() {
            match node {
                PdagNode::Gate { .. } => num_gates += 1,
                PdagNode::BasicEvent { .. } => num_basic_events += 1,
                PdagNode::Constant { .. } => num_constants += 1,
            }
        }

        let max_depth = if let Some(root) = self.root_index {
            self.calculate_depth(root, &mut HashMap::new())
        } else {
            0
        };

        PdagStats {
            num_nodes: self.nodes.len(),
            num_gates,
            num_basic_events,
            num_constants,
            max_depth,
        }
    }

    fn calculate_depth(&self, node: NodeIndex, cache: &mut HashMap<NodeIndex, usize>) -> usize {
        let abs_node = node.abs();

        if let Some(&depth) = cache.get(&abs_node) {
            return depth;
        }

        let depth = match self.get_node(abs_node) {
            Some(PdagNode::BasicEvent { .. }) | Some(PdagNode::Constant { .. }) => 0,
            Some(PdagNode::Gate { operands, .. }) => {
                let max_child_depth = operands
                    .iter()
                    .map(|&op| self.calculate_depth(op, cache))
                    .max()
                    .unwrap_or(0);
                max_child_depth + 1
            }
            None => 0,
        };

        cache.insert(abs_node, depth);
        depth
    }

    pub fn nodes(&self) -> &HashMap<NodeIndex, PdagNode> {
        &self.nodes
    }

    pub fn num_nodes(&self) -> usize {
        self.nodes.len()
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn parents(&self) -> &HashMap<NodeIndex, HashSet<NodeIndex>> {
        &self.parents
    }

    pub fn update_gate_operands(
        &mut self,
        index: NodeIndex,
        new_operands: Vec<NodeIndex>,
    ) -> Result<()> {
        if let Some(node) = self.nodes.get_mut(&index) {
            if let PdagNode::Gate { operands, .. } = node {
                for &old_op in operands.iter() {
                    if let Some(parent_set) = self.parents.get_mut(&old_op.abs()) {
                        parent_set.remove(&index);
                    }
                }

                *operands = new_operands.clone();

                for &new_op in &new_operands {
                    self.parents.entry(new_op.abs()).or_default().insert(index);
                }
                Ok(())
            } else {
                Err(PraxisError::Logic(format!("Node {} is not a gate", index)))
            }
        } else {
            Err(PraxisError::Logic(format!("Node {} not found", index)))
        }
    }

    pub fn update_gate_connective(
        &mut self,
        index: NodeIndex,
        connective: Connective,
    ) -> Result<()> {
        if let Some(node) = self.nodes.get_mut(&index) {
            if let PdagNode::Gate {
                connective: ref mut conn,
                ..
            } = node
            {
                *conn = connective;
                Ok(())
            } else {
                Err(PraxisError::Logic(format!("Node {} is not a gate", index)))
            }
        } else {
            Err(PraxisError::Logic(format!("Node {} not found", index)))
        }
    }
}

impl Default for Pdag {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pdag_basic_event() {
        let mut pdag = Pdag::new();
        let index = pdag.add_basic_event("E1".to_string());
        assert_eq!(index, 1);

        let node = pdag.get_node(index).unwrap();
        assert!(node.is_basic_event());
        assert_eq!(node.id(), Some("E1"));
    }

    #[test]
    fn test_pdag_gate() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());

        let gate = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();

        let node = pdag.get_node(gate).unwrap();
        assert!(node.is_gate());
        assert_eq!(node.id(), Some("G1"));
    }

    #[test]
    fn test_pdag_parent_tracking() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());

        let gate = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();

        let e1_parents = pdag.parents().get(&e1).cloned().unwrap_or_default();
        assert_eq!(e1_parents.len(), 1);
        assert!(e1_parents.contains(&gate));
    }

    #[test]
    fn test_pdag_complement() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let not_e1 = -e1;

        let gate = pdag
            .add_gate("G1".to_string(), Connective::Not, vec![not_e1], None)
            .unwrap();

        let node = pdag.get_node(gate).unwrap();
        assert!(node.is_gate());
    }

    #[test]
    fn test_pdag_topological_sort() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());

        let g1 = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();
        pdag.set_root(g1).unwrap();
        let sorted = pdag.topological_sort().unwrap();

        assert_eq!(sorted.len(), 3);

        let e1_pos = sorted.iter().position(|&x| x == e1).unwrap();
        let e2_pos = sorted.iter().position(|&x| x == e2).unwrap();
        let g1_pos = sorted.iter().position(|&x| x == g1).unwrap();

        assert!(e1_pos < g1_pos);
        assert!(e2_pos < g1_pos);
    }

    #[test]
    fn test_pdag_stats() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());

        let g1 = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();
        pdag.set_root(g1).unwrap();
        let stats = pdag.stats();
        assert_eq!(stats.num_nodes, 3);
        assert_eq!(stats.num_gates, 1);
        assert_eq!(stats.num_basic_events, 2);
        assert_eq!(stats.max_depth, 1);
    }

    #[test]
    fn test_pdag_coherence() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());

        pdag.add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();

        assert!(pdag.is_coherent());

        pdag.add_gate("G2".to_string(), Connective::Not, vec![e1], None)
            .unwrap();

        assert!(!pdag.is_coherent());
    }
}
