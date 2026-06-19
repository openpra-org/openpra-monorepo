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
        }
    }

    pub fn run(&mut self) -> Result<()> {
        self.run_phase_one()?;
        self.run_phase_two()?;
        self.run_phase_three()?;
        self.run_phase_four()?;
        self.run_phase_five()?;

        self.stats.final_nodes = self.pdag.node_count();
        Ok(())
    }

    fn run_phase_one(&mut self) -> Result<()> {
        self.propagate_constants()?;
        self.remove_null_gates()?;
        Ok(())
    }

    fn run_phase_two(&mut self) -> Result<()> {
        self.detect_modules()?;
        self.coalesce_gates()?;
        Ok(())
    }

    fn run_phase_three(&mut self) -> Result<()> {
        self.normalize_gates(NormalizationType::All)?;
        Ok(())
    }

    fn run_phase_four(&mut self) -> Result<()> {
        self.propagate_complements()?;
        Ok(())
    }

    fn run_phase_five(&mut self) -> Result<()> {
        self.remove_null_gates()?;
        self.stats.final_nodes = self.pdag.node_count();
        Ok(())
    }

    fn propagate_constants(&mut self) -> Result<()> {

        let mut count = 0;

        for node in self.pdag.nodes().values() {
            if let PdagNode::Gate {
                connective: _,
                operands,
                ..
            } = node
            {
                for &op_idx in operands {
                    if let Some(PdagNode::Constant { .. }) = self.pdag.nodes().get(&op_idx.abs()) {
                        count += 1;
                        break;
                    }
                }
            }
        }

        self.stats.constants_eliminated = count;
        Ok(())
    }

    fn replace_with_constant(&mut self, index: NodeIndex, value: bool) -> Result<()> {

        let constant_index = self.pdag.add_constant(value);

        if let Some(parents) = self.pdag.parents().get(&index).cloned() {
            for parent_idx in parents {
                if let Some(PdagNode::Gate { operands, .. }) =
                    self.pdag.nodes().get(&parent_idx).cloned()
                {
                    let new_operands: Vec<NodeIndex> = operands
                        .iter()
                        .map(|&op| if op == index { constant_index } else { op })
                        .collect();
                    self.pdag.update_gate_operands(parent_idx, new_operands)?;
                }
            }
        }

        Ok(())
    }

    fn remove_null_gates(&mut self) -> Result<()> {

        let mut count = 0;

        for node in self.pdag.nodes().values() {
            if let PdagNode::Gate {
                connective: Connective::Null,
                ..
            } = node
            {
                count += 1;
            }
        }

        self.stats.null_gates_removed = count;
        Ok(())
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

        self.pdag.update_gate_connective(index, Connective::And)?;

        Ok(())
    }

    fn normalize_nor_gate(&mut self, index: NodeIndex, _operands: &[NodeIndex]) -> Result<()> {

        self.pdag.update_gate_connective(index, Connective::Or)?;

        Ok(())
    }

    fn normalize_xor_gate(&mut self, index: NodeIndex, operands: &[NodeIndex]) -> Result<()> {
        if operands.len() != 2 {
            return Ok(());
        }

        let a = operands[0];
        let b = operands[1];

        let and1_ops = vec![a, -b];
        let and1_index = self.pdag.add_gate(
            format!("XOR_AND1_{}", index),
            Connective::And,
            and1_ops,
            None,
        )?;

        let and2_ops = vec![-a, b];
        let and2_index = self.pdag.add_gate(
            format!("XOR_AND2_{}", index),
            Connective::And,
            and2_ops,
            None,
        )?;

        self.pdag.update_gate_connective(index, Connective::Or)?;
        self.pdag
            .update_gate_operands(index, vec![and1_index, and2_index])?;

        Ok(())
    }

    fn normalize_atleast_gate(
        &mut self,
        index: NodeIndex,
        operands: &[NodeIndex],
        k: usize,
    ) -> Result<()> {
        let n = operands.len();

        if k == 0 {

            self.replace_with_constant(index, true)?;
            return Ok(());
        }

        if k > n {

            self.replace_with_constant(index, false)?;
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

        if n <= 10 {
            let combinations = self.generate_combinations(operands, k);
            let mut and_gates = Vec::new();

            for (i, combo) in combinations.iter().enumerate() {
                let and_index = self.pdag.add_gate(
                    format!("AtLeast_AND_{}_{}", index, i),
                    Connective::And,
                    combo.clone(),
                    None,
                )?;
                and_gates.push(and_index);
            }

            self.pdag.update_gate_connective(index, Connective::Or)?;
            self.pdag.update_gate_operands(index, and_gates)?;
        }

        Ok(())
    }

    fn generate_combinations(&self, operands: &[NodeIndex], k: usize) -> Vec<Vec<NodeIndex>> {
        let mut result = Vec::new();
        let n = operands.len();

        if k == 0 {
            result.push(Vec::new());
            return result;
        }

        if k > n {
            return result;
        }

        self.generate_combinations_helper(operands, k, 0, &mut Vec::new(), &mut result);
        result
    }

    fn generate_combinations_helper(
        &self,
        operands: &[NodeIndex],
        k: usize,
        start: usize,
        current: &mut Vec<NodeIndex>,
        result: &mut Vec<Vec<NodeIndex>>,
    ) {
        if current.len() == k {
            result.push(current.clone());
            return;
        }

        for i in start..operands.len() {
            current.push(operands[i]);
            self.generate_combinations_helper(operands, k, i + 1, current, result);
            current.pop();
        }
    }

    fn propagate_complements(&mut self) -> Result<()> {
        let nodes: Vec<NodeIndex> = self.pdag.nodes().keys().copied().collect();

        for index in nodes {
            if index < 0 {

                let positive_idx = index.abs();

                if let Some(PdagNode::Gate {
                    connective,
                    operands,
                    ..
                }) = self.pdag.nodes().get(&positive_idx).cloned()
                {
                    match connective {
                        Connective::And => {

                            let negated_ops: Vec<NodeIndex> =
                                operands.iter().map(|&op| -op).collect();
                            self.pdag
                                .update_gate_connective(positive_idx, Connective::Or)?;
                            self.pdag.update_gate_operands(positive_idx, negated_ops)?;
                            self.stats.complements_propagated += 1;
                        }
                        Connective::Or => {

                            let negated_ops: Vec<NodeIndex> =
                                operands.iter().map(|&op| -op).collect();
                            self.pdag
                                .update_gate_connective(positive_idx, Connective::And)?;
                            self.pdag.update_gate_operands(positive_idx, negated_ops)?;
                            self.stats.complements_propagated += 1;
                        }
                        _ => {}
                    }
                }
            }
        }

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
    fn test_generate_combinations() {
        let pdag = Pdag::new();
        let preprocessor = Preprocessor::new(pdag);

        let operands = vec![1, 2, 3];
        let combos = preprocessor.generate_combinations(&operands, 2);

        assert_eq!(combos.len(), 3);
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
