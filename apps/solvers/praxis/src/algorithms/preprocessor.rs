use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::Result;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NormalizationType {

    None,

    Xor,

    AtLeast,

    All,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PreprocessorStats {

    pub constants_eliminated: usize,

    pub null_gates_removed: usize,

    pub gates_normalized: usize,

    pub complements_propagated: usize,

    pub modules_detected: usize,

    pub original_nodes: usize,

    pub final_nodes: usize,
}

impl PreprocessorStats {

    pub fn reduction_percentage(&self) -> f64 {
        if self.original_nodes == 0 {
            return 0.0;
        }
        ((self.original_nodes - self.final_nodes) as f64 / self.original_nodes as f64) * 100.0
    }
}

pub struct Preprocessor {
    pdag: Pdag,
    stats: PreprocessorStats,
    next_synth: usize,
}

impl Preprocessor {

    pub fn new(pdag: Pdag) -> Self {
        let original_nodes = pdag.node_count();
        Preprocessor {
            pdag,
            stats: PreprocessorStats {
                constants_eliminated: 0,
                null_gates_removed: 0,
                gates_normalized: 0,
                complements_propagated: 0,
                modules_detected: 0,
                original_nodes,
                final_nodes: original_nodes,
            },
            next_synth: 0,
        }
    }

    fn new_gate(&mut self, connective: Connective, operands: Vec<NodeIndex>) -> Result<NodeIndex> {
        self.next_synth += 1;
        let id = format!("_pp{}", self.next_synth);
        self.pdag.add_gate(id, connective, operands, None)
    }

    pub fn run(&mut self) -> Result<()> {
        self.normalize_gates(NormalizationType::All)?;
        loop {
            let folded = self.propagate_constants()?;
            let spliced = self.remove_null_gates()?;
            if !folded && !spliced {
                break;
            }
        }
        self.coalesce_gates()?;
        self.detect_modules()?;
        self.stats.final_nodes = self.pdag.node_count();
        Ok(())
    }

    fn const_value_of(&self, op: NodeIndex) -> Option<bool> {
        match self.pdag.get_node(op) {
            Some(PdagNode::Constant { value, .. }) => Some(if op < 0 { !*value } else { *value }),
            _ => None,
        }
    }

    fn make_constant(&mut self, index: NodeIndex, value: bool) -> Result<()> {
        let cidx = self.pdag.add_constant(value);
        let parent_list: Vec<NodeIndex> = self
            .pdag
            .parents()
            .get(&index.abs())
            .map(|set| set.iter().copied().collect())
            .unwrap_or_default();
        for parent in parent_list {
            if let Some(PdagNode::Gate { operands, .. }) = self.pdag.get_node(parent).cloned() {
                let new_operands: Vec<NodeIndex> = operands
                    .iter()
                    .map(|&op| {
                        if op == index {
                            cidx
                        } else if op == -index {
                            -cidx
                        } else {
                            op
                        }
                    })
                    .collect();
                self.pdag.update_gate_operands(parent, new_operands)?;
            }
        }
        if let Some(root) = self.pdag.root() {
            if root.abs() == index.abs() {
                let signed = if root < 0 { -cidx } else { cidx };
                self.pdag.set_root(signed)?;
            }
        }
        self.pdag.remove_node(index)?;
        self.stats.constants_eliminated += 1;
        Ok(())
    }

    fn propagate_constants(&mut self) -> Result<bool> {
        let mut changed = false;
        let indices: Vec<NodeIndex> = self.pdag.nodes().keys().copied().collect();
        for index in indices {
            let (conn, ops) = match self.pdag.get_node(index) {
                Some(PdagNode::Gate {
                    connective,
                    operands,
                    ..
                }) => (*connective, operands.clone()),
                _ => continue,
            };
            match conn {
                Connective::And => {
                    if ops.iter().any(|&op| self.const_value_of(op) == Some(false)) {
                        self.make_constant(index, false)?;
                        changed = true;
                        continue;
                    }
                    let kept: Vec<NodeIndex> = ops
                        .iter()
                        .copied()
                        .filter(|&op| self.const_value_of(op) != Some(true))
                        .collect();
                    if kept.len() != ops.len() {
                        self.collapse_gate(index, Connective::And, kept, true)?;
                        changed = true;
                    }
                }
                Connective::Or => {
                    if ops.iter().any(|&op| self.const_value_of(op) == Some(true)) {
                        self.make_constant(index, true)?;
                        changed = true;
                        continue;
                    }
                    let kept: Vec<NodeIndex> = ops
                        .iter()
                        .copied()
                        .filter(|&op| self.const_value_of(op) != Some(false))
                        .collect();
                    if kept.len() != ops.len() {
                        self.collapse_gate(index, Connective::Or, kept, false)?;
                        changed = true;
                    }
                }
                Connective::Null => {
                    if let Some(&op) = ops.first() {
                        if let Some(v) = self.const_value_of(op) {
                            self.make_constant(index, v)?;
                            changed = true;
                        }
                    }
                }
                _ => {}
            }
        }
        Ok(changed)
    }

    fn collapse_gate(
        &mut self,
        index: NodeIndex,
        connective: Connective,
        kept: Vec<NodeIndex>,
        empty_value: bool,
    ) -> Result<()> {
        if kept.is_empty() {
            self.make_constant(index, empty_value)?;
        } else if kept.len() == 1 {
            self.pdag.update_gate_connective(index, Connective::Null)?;
            self.pdag.update_gate_operands(index, kept)?;
        } else {
            self.pdag.update_gate_connective(index, connective)?;
            self.pdag.update_gate_operands(index, kept)?;
        }
        Ok(())
    }

    fn remove_null_gates(&mut self) -> Result<bool> {
        let mut changed = false;
        let indices: Vec<NodeIndex> = self.pdag.nodes().keys().copied().collect();
        for index in indices {
            let inner = match self.pdag.get_node(index) {
                Some(PdagNode::Gate {
                    connective: Connective::Null,
                    operands,
                    ..
                }) if operands.len() == 1 => operands[0],
                _ => continue,
            };
            let parent_list: Vec<NodeIndex> = self
                .pdag
                .parents()
                .get(&index.abs())
                .map(|set| set.iter().copied().collect())
                .unwrap_or_default();
            for parent in parent_list {
                if let Some(PdagNode::Gate { operands, .. }) = self.pdag.get_node(parent).cloned() {
                    let new_operands: Vec<NodeIndex> = operands
                        .iter()
                        .map(|&op| {
                            if op == index {
                                inner
                            } else if op == -index {
                                -inner
                            } else {
                                op
                            }
                        })
                        .collect();
                    self.pdag.update_gate_operands(parent, new_operands)?;
                }
            }
            if let Some(root) = self.pdag.root() {
                if root.abs() == index.abs() {
                    let signed = if root < 0 { -inner } else { inner };
                    self.pdag.set_root(signed)?;
                }
            }
            self.pdag.remove_node(index)?;
            self.stats.null_gates_removed += 1;
            changed = true;
        }
        Ok(changed)
    }

    fn replace_operand(
        &mut self,
        gate_index: NodeIndex,
        old_op: NodeIndex,
        new_op: NodeIndex,
    ) -> Result<()> {
        if let Some(PdagNode::Gate { operands, .. }) = self.pdag.nodes().get(&gate_index).cloned() {
            let new_operands: Vec<NodeIndex> = operands
                .iter()
                .map(|&op| if op == old_op { new_op } else { op })
                .collect();
            self.pdag.update_gate_operands(gate_index, new_operands)?;
        }
        Ok(())
    }

    fn normalize_gates(&mut self, norm_type: NormalizationType) -> Result<()> {
        let to_normalize: Vec<NodeIndex> = self
            .pdag
            .nodes()
            .keys()
            .filter(|&&idx| {
                if let Some(PdagNode::Gate { connective, .. }) = self.pdag.nodes().get(&idx) {
                    matches!(
                        connective,
                        Connective::Not
                            | Connective::Nand
                            | Connective::Nor
                            | Connective::Xor
                            | Connective::Iff
                            | Connective::AtLeast
                    )
                } else {
                    false
                }
            })
            .copied()
            .collect();

        for index in to_normalize {
            if let Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) = self.pdag.nodes().get(&index).cloned()
            {
                match connective {
                    Connective::Not => {
                        self.normalize_not_gate(index, &operands)?;
                    }
                    Connective::Nand => {
                        self.normalize_nand_gate(index, &operands)?;
                    }
                    Connective::Nor => {
                        self.normalize_nor_gate(index, &operands)?;
                    }
                    Connective::Xor
                        if norm_type == NormalizationType::Xor
                            || norm_type == NormalizationType::All =>
                    {
                        self.normalize_xor_gate(index, &operands)?;
                    }
                    Connective::Iff if norm_type == NormalizationType::All => {
                        self.normalize_iff_gate(index, &operands)?;
                    }
                    Connective::AtLeast
                        if norm_type == NormalizationType::AtLeast
                            || norm_type == NormalizationType::All =>
                    {
                        if let Some(k) = min_number {
                            self.normalize_atleast_gate(index, &operands, k)?;
                        }
                    }
                    _ => {}
                }
                self.stats.gates_normalized += 1;
            }
        }
        Ok(())
    }

    fn normalize_not_gate(&mut self, index: NodeIndex, operands: &[NodeIndex]) -> Result<()> {
        if operands.len() == 1 {

            let negated_op = -operands[0];
            self.pdag.update_gate_operands(index, vec![negated_op])?;
            self.pdag.update_gate_connective(index, Connective::Null)?;
        }
        Ok(())
    }

    fn normalize_nand_gate(&mut self, index: NodeIndex, _operands: &[NodeIndex]) -> Result<()> {
        self.pdag.negate_references(index)?;
        self.pdag.update_gate_connective(index, Connective::And)?;
        Ok(())
    }

    fn normalize_nor_gate(&mut self, index: NodeIndex, _operands: &[NodeIndex]) -> Result<()> {
        self.pdag.negate_references(index)?;
        self.pdag.update_gate_connective(index, Connective::Or)?;
        Ok(())
    }

    fn build_xor(&mut self, operands: &[NodeIndex]) -> Result<NodeIndex> {
        if operands.len() == 1 {
            return Ok(operands[0]);
        }
        let a = operands[0];
        let rest = self.build_xor(&operands[1..])?;
        let and1 = self.new_gate(Connective::And, vec![a, -rest])?;
        let and2 = self.new_gate(Connective::And, vec![-a, rest])?;
        self.new_gate(Connective::Or, vec![and1, and2])
    }

    fn normalize_xor_gate(&mut self, index: NodeIndex, operands: &[NodeIndex]) -> Result<()> {
        if operands.is_empty() {
            return Ok(());
        }
        if operands.len() == 1 {
            self.pdag.update_gate_connective(index, Connective::Null)?;
            return Ok(());
        }
        let a = operands[0];
        let rest = self.build_xor(&operands[1..])?;
        let and1 = self.new_gate(Connective::And, vec![a, -rest])?;
        let and2 = self.new_gate(Connective::And, vec![-a, rest])?;
        self.pdag.update_gate_connective(index, Connective::Or)?;
        self.pdag.update_gate_operands(index, vec![and1, and2])?;
        Ok(())
    }

    fn normalize_iff_gate(&mut self, index: NodeIndex, operands: &[NodeIndex]) -> Result<()> {
        if operands.is_empty() {
            return Ok(());
        }
        if operands.len() == 1 {
            let a = operands[0];
            self.pdag.update_gate_connective(index, Connective::Or)?;
            self.pdag.update_gate_operands(index, vec![a, -a])?;
            return Ok(());
        }
        let pos = operands.to_vec();
        let neg: Vec<NodeIndex> = operands.iter().map(|&o| -o).collect();
        let all_pos = self.new_gate(Connective::And, pos)?;
        let all_neg = self.new_gate(Connective::And, neg)?;
        self.pdag.update_gate_connective(index, Connective::Or)?;
        self.pdag
            .update_gate_operands(index, vec![all_pos, all_neg])?;
        Ok(())
    }

    fn build_atleast(&mut self, operands: &[NodeIndex], k: usize) -> Result<NodeIndex> {
        if k == 0 {
            return Ok(self.pdag.add_constant(true));
        }
        if k > operands.len() {
            return Ok(self.pdag.add_constant(false));
        }
        if k == 1 {
            return self.new_gate(Connective::Or, operands.to_vec());
        }
        if k == operands.len() {
            return self.new_gate(Connective::And, operands.to_vec());
        }
        let x = operands[0];
        let then_branch = self.build_atleast(&operands[1..], k - 1)?;
        let else_branch = self.build_atleast(&operands[1..], k)?;
        let and = self.new_gate(Connective::And, vec![x, then_branch])?;
        self.new_gate(Connective::Or, vec![and, else_branch])
    }

    fn normalize_atleast_gate(
        &mut self,
        index: NodeIndex,
        operands: &[NodeIndex],
        k: usize,
    ) -> Result<()> {
        let n = operands.len();

        if k == 0 {
            if n >= 1 {
                self.pdag.update_gate_connective(index, Connective::Or)?;
                self.pdag
                    .update_gate_operands(index, vec![operands[0], -operands[0]])?;
            }
            return Ok(());
        }

        if k > n {
            if n >= 1 {
                self.pdag.update_gate_connective(index, Connective::And)?;
                self.pdag
                    .update_gate_operands(index, vec![operands[0], -operands[0]])?;
            }
            return Ok(());
        }

        if k == 1 {
            self.pdag.update_gate_connective(index, Connective::Or)?;
            return Ok(());
        }

        if k == n {
            self.pdag.update_gate_connective(index, Connective::And)?;
            return Ok(());
        }

        let x = operands[0];
        let then_branch = self.build_atleast(&operands[1..], k - 1)?;
        let else_branch = self.build_atleast(&operands[1..], k)?;
        let and = self.new_gate(Connective::And, vec![x, then_branch])?;
        self.pdag.update_gate_connective(index, Connective::Or)?;
        self.pdag
            .update_gate_operands(index, vec![and, else_branch])?;
        Ok(())
    }

    fn detect_modules(&mut self) -> Result<()> {

        let mut usage_count: HashMap<NodeIndex, usize> = HashMap::new();

        for node in self.pdag.nodes().values() {
            if let PdagNode::Gate { operands, .. } = node {
                for &op in operands {
                    *usage_count.entry(op.abs()).or_insert(0) += 1;
                }
            }
        }

        for (_idx, count) in usage_count.iter() {
            if *count == 1 {
                self.stats.modules_detected += 1;
            }
        }

        Ok(())
    }

    fn coalesce_gates(&mut self) -> Result<()> {

        let mut gate_signatures: HashMap<(Connective, Vec<NodeIndex>), NodeIndex> = HashMap::new();
        let mut to_merge: Vec<(NodeIndex, NodeIndex)> = Vec::new();

        for (&index, node) in self.pdag.nodes().iter() {
            if let PdagNode::Gate {
                connective,
                operands,
                ..
            } = node
            {
                let mut sorted_ops = operands.clone();
                sorted_ops.sort();
                let signature = (*connective, sorted_ops);

                if let Some(&existing_idx) = gate_signatures.get(&signature) {

                    to_merge.push((index, existing_idx));
                } else {
                    gate_signatures.insert(signature, index);
                }
            }
        }

        for (duplicate, original) in to_merge {
            if let Some(parents) = self.pdag.parents().get(&duplicate).cloned() {
                for parent_idx in parents {
                    self.replace_operand(parent_idx, duplicate, original)?;
                }
            }
        }

        Ok(())
    }

    pub fn stats(&self) -> &PreprocessorStats {
        &self.stats
    }

    pub fn into_pdag(self) -> Pdag {
        self.pdag
    }

    pub fn pdag(&self) -> &Pdag {
        &self.pdag
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preprocessor_new() {
        let pdag = Pdag::new();
        let preprocessor = Preprocessor::new(pdag);
        assert_eq!(preprocessor.stats().original_nodes, 0);
    }

    #[test]
    fn test_constant_propagation_and_false() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let false_const = pdag.add_constant(false);
        let _and_gate = pdag
            .add_gate(
                "G1".to_string(),
                Connective::And,
                vec![e1, false_const],
                None,
            )
            .unwrap();

        let mut preprocessor = Preprocessor::new(pdag);
        preprocessor.propagate_constants().unwrap();

        assert!(preprocessor.stats().constants_eliminated > 0);
    }

    #[test]
    fn test_constant_propagation_or_true() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let true_const = pdag.add_constant(true);
        let _or_gate = pdag
            .add_gate("G1".to_string(), Connective::Or, vec![e1, true_const], None)
            .unwrap();

        let mut preprocessor = Preprocessor::new(pdag);
        preprocessor.propagate_constants().unwrap();

        assert!(preprocessor.stats().constants_eliminated > 0);
    }

    #[test]
    fn test_null_gate_removal() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let _null_gate = pdag
            .add_gate("G1".to_string(), Connective::Null, vec![e1], None)
            .unwrap();

        let mut preprocessor = Preprocessor::new(pdag);
        preprocessor.remove_null_gates().unwrap();

        assert!(preprocessor.stats().null_gates_removed > 0);
    }

    #[test]
    fn test_normalize_not_gate() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let _not_gate = pdag
            .add_gate("G1".to_string(), Connective::Not, vec![e1], None)
            .unwrap();

        let mut preprocessor = Preprocessor::new(pdag);
        preprocessor
            .normalize_gates(NormalizationType::All)
            .unwrap();

        assert!(preprocessor.stats().gates_normalized > 0);
    }

    #[test]
    fn test_normalize_atleast_to_or() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let e3 = pdag.add_basic_event("E3".to_string());

        let atleast_gate = pdag
            .add_gate(
                "G1".to_string(),
                Connective::AtLeast,
                vec![e1, e2, e3],
                Some(1),
            )
            .unwrap();

        let mut preprocessor = Preprocessor::new(pdag);
        preprocessor
            .normalize_gates(NormalizationType::All)
            .unwrap();

        if let Some(PdagNode::Gate { connective, .. }) =
            preprocessor.pdag().nodes().get(&atleast_gate)
        {
            assert_eq!(*connective, Connective::Or);
        }
    }

    #[test]
    fn test_normalize_atleast_to_and() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let e3 = pdag.add_basic_event("E3".to_string());

        let atleast_gate = pdag
            .add_gate(
                "G1".to_string(),
                Connective::AtLeast,
                vec![e1, e2, e3],
                Some(3),
            )
            .unwrap();

        let mut preprocessor = Preprocessor::new(pdag);
        preprocessor
            .normalize_gates(NormalizationType::All)
            .unwrap();

        if let Some(PdagNode::Gate { connective, .. }) =
            preprocessor.pdag().nodes().get(&atleast_gate)
        {
            assert_eq!(*connective, Connective::And);
        }
    }

    #[test]
    fn test_module_detection() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let _g1 = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();

        let mut preprocessor = Preprocessor::new(pdag);
        preprocessor.detect_modules().unwrap();

        assert!(preprocessor.stats().modules_detected > 0);
    }

    #[test]
    fn test_full_preprocessing_pipeline() {
        let mut pdag = Pdag::new();
        let e1 = pdag.add_basic_event("E1".to_string());
        let e2 = pdag.add_basic_event("E2".to_string());
        let _and_gate = pdag
            .add_gate("G1".to_string(), Connective::And, vec![e1, e2], None)
            .unwrap();

        let original_count = pdag.node_count();
        let mut preprocessor = Preprocessor::new(pdag);
        preprocessor.run().unwrap();

        let stats = preprocessor.stats();
        assert_eq!(stats.original_nodes, original_count);
    }
}
