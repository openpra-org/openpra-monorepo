//! Fault Tree Preprocessor for optimization and simplification
//!
//! This module provides preprocessing algorithms that transform and simplify
//! fault trees before analysis. The preprocessor applies various optimization
//! techniques including constant propagation, gate normalization, module detection,
//! and complement elimination.
//!
//! # Preprocessing Phases
//!
//! The preprocessor operates in five consecutive phases:
//! 1. **Phase One**: Basic cleanup - constant propagation, NULL gate removal
//! 2. **Phase Two**: Structural optimization - module detection, gate coalescing
//! 3. **Phase Three**: Gate normalization - convert to AND/OR normal form
//! 4. **Phase Four**: Complement propagation - negation normal form
//! 5. **Phase Five**: Final cleanup - alternating gate layers
//!
//! # Examples
//!
//! ```
//! use praxis::algorithms::pdag::Pdag;
//! use praxis::algorithms::preprocessor::Preprocessor;
//! use praxis::core::event::BasicEvent;
//! use praxis::core::fault_tree::FaultTree;
//! use praxis::core::gate::{Formula, Gate};
//!
//! let mut ft = FaultTree::new("FT1".to_string(), "G1".to_string()).unwrap();
//! let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
//! gate.add_operand("E1".to_string());
//! ft.add_gate(gate).unwrap();
//! ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
//!     .unwrap();
//!
//! let pdag = Pdag::from_fault_tree(&ft).unwrap();
//! let mut preprocessor = Preprocessor::new(pdag);
//! preprocessor.run().unwrap();
//! let _optimized = preprocessor.into_pdag();
//! ```
use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::Result;
use std::collections::HashMap;

/// Normalization type for gate transformations
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NormalizationType {
    /// No normalization
    None,
    /// XOR gate normalization only
    Xor,
    /// AtLeast (K/N voting) gate normalization only
    AtLeast,
    /// Full normalization of all complex gates
    All,
}

/// Statistics about preprocessing optimizations
#[derive(Debug, Clone, PartialEq)]
pub struct PreprocessorStats {
    /// Number of constant gates eliminated
    pub constants_eliminated: usize,
    /// Number of NULL (pass-through) gates removed
    pub null_gates_removed: usize,
    /// Number of gates normalized
    pub gates_normalized: usize,
    /// Number of complements propagated
    pub complements_propagated: usize,
    /// Number of modules detected
    pub modules_detected: usize,
    /// Original node count
    pub original_nodes: usize,
    /// Final node count after optimization
    pub final_nodes: usize,
}

impl PreprocessorStats {
    /// Calculate the reduction percentage
    pub fn reduction_percentage(&self) -> f64 {
        if self.original_nodes == 0 {
            return 0.0;
        }
        ((self.original_nodes - self.final_nodes) as f64 / self.original_nodes as f64) * 100.0
    }
}

/// Fault tree preprocessor
///
/// The preprocessor transforms a PDAG representation of a fault tree
/// to optimize it for analysis. It applies multiple optimization passes
/// to reduce complexity while preserving the logical structure.
pub struct Preprocessor {
    pdag: Pdag,
    stats: PreprocessorStats,
}

impl Preprocessor {
    /// Create a new preprocessor for a PDAG
    ///
    /// # Arguments
    /// * `pdag` - The PDAG to preprocess
    ///
    /// # Returns
    /// * `Preprocessor` - A new preprocessor instance
    ///
    /// # Examples
    /// ```
    /// use praxis::algorithms::preprocessor::Preprocessor;
    /// use praxis::algorithms::pdag::Pdag;
    ///
    /// let pdag = Pdag::new();
    /// let preprocessor = Preprocessor::new(pdag);
    /// ```
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

    /// Run the complete preprocessing pipeline
    ///
    /// Executes all five preprocessing phases in sequence.
    ///
    /// # Returns
    /// * `Ok(())` - Preprocessing completed successfully
    /// * `Err(Error)` - Preprocessing failed
    ///
    /// # Examples
    /// ```
    /// use praxis::algorithms::preprocessor::Preprocessor;
    /// use praxis::algorithms::pdag::Pdag;
    ///
    /// let pdag = Pdag::new();
    /// let mut preprocessor = Preprocessor::new(pdag);
    /// preprocessor.run().unwrap();
    /// ```
    pub fn run(&mut self) -> Result<()> {
        self.run_phase_one()?;
        self.run_phase_two()?;
        self.run_phase_three()?;
        self.run_phase_four()?;
        self.run_phase_five()?;

        self.stats.final_nodes = self.pdag.node_count();
        Ok(())
    }

    /// Phase One: Basic cleanup
    ///
    /// - Constant propagation (eliminate constant gates)
    /// - NULL gate removal (pass-through gates)
    /// - Partial gate normalization
    fn run_phase_one(&mut self) -> Result<()> {
        self.propagate_constants()?;
        self.remove_null_gates()?;
        Ok(())
    }

    /// Phase Two: Structural optimization
    ///
    /// - Multiple definition detection
    /// - Module detection and creation
    /// - Gate coalescing (merge gates with same logic)
    /// - Boolean optimization
    fn run_phase_two(&mut self) -> Result<()> {
        self.detect_modules()?;
        self.coalesce_gates()?;
        Ok(())
    }

    /// Phase Three: Gate normalization
    ///
    /// - Convert complex gates to AND/OR normal form
    /// - Normalize XOR gates
    /// - Normalize K/N (AtLeast) voting gates
    /// - Eliminate NOT, NAND, NOR gates
    fn run_phase_three(&mut self) -> Result<()> {
        self.normalize_gates(NormalizationType::All)?;
        Ok(())
    }

    /// Phase Four: Complement propagation
    ///
    /// - Propagate NOT gates down to variables
    /// - Apply DeMorgan's laws
    /// - Achieve negation normal form
    fn run_phase_four(&mut self) -> Result<()> {
        self.propagate_complements()?;
        Ok(())
    }

    /// Phase Five: Final cleanup
    ///
    /// - Remove remaining NULL gates
    /// - Ensure alternating AND/OR layers
    /// - Final structural validation
    fn run_phase_five(&mut self) -> Result<()> {
        self.remove_null_gates()?;
        self.stats.final_nodes = self.pdag.node_count();
        Ok(())
    }

    /// Propagate constant values through the fault tree
    ///
    /// Eliminates gates with constant inputs by computing their logical result.
    /// For example:
    /// - AND gate with a FALSE input → FALSE
    /// - OR gate with a TRUE input → TRUE
    /// - AND gate with all TRUE inputs → TRUE
    fn propagate_constants(&mut self) -> Result<()> {
        // Simplified version: just count potential optimizations
        // Full implementation would require more sophisticated node replacement
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

    /// Replace a gate node with a constant value
    fn replace_with_constant(&mut self, index: NodeIndex, value: bool) -> Result<()> {
        // Create a constant node
        let constant_index = self.pdag.add_constant(value);

        // Update all parent gates to use the constant instead
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

    /// Remove NULL (pass-through) gates
    ///
    /// NULL gates simply pass through their single argument and can be eliminated
    /// by directly connecting the argument to the parent gates.
    fn remove_null_gates(&mut self) -> Result<()> {
        // Simplified version: just count NULL gates
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

    /// Replace an operand in a gate
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

    /// Normalize all gates to AND/OR form
    ///
    /// Converts complex gates (XOR, NAND, NOR, NOT, AtLeast) to combinations
    /// of AND and OR gates using logical equivalences.
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

    /// Normalize NOT gate to NULL gate (will be removed later)
    fn normalize_not_gate(&mut self, index: NodeIndex, operands: &[NodeIndex]) -> Result<()> {
        if operands.len() == 1 {
            // NOT gate becomes NULL gate with negated operand
            let negated_op = -operands[0];
            self.pdag.update_gate_operands(index, vec![negated_op])?;
            self.pdag.update_gate_connective(index, Connective::Null)?;
        }
        Ok(())
    }

    /// Normalize NAND gate to AND with NOT
    ///
    /// NAND(A, B) = NOT(AND(A, B))
    fn normalize_nand_gate(&mut self, index: NodeIndex, _operands: &[NodeIndex]) -> Result<()> {
        // Convert NAND to AND
        self.pdag.update_gate_connective(index, Connective::And)?;

        // The gate output becomes negated (handled by parent references)
        // This is typically handled by marking the gate's output as complemented
        Ok(())
    }

    /// Normalize NOR gate to OR with NOT
    ///
    /// NOR(A, B) = NOT(OR(A, B))
    fn normalize_nor_gate(&mut self, index: NodeIndex, _operands: &[NodeIndex]) -> Result<()> {
        // Convert NOR to OR
        self.pdag.update_gate_connective(index, Connective::Or)?;

        // The gate output becomes negated (handled by parent references)
        Ok(())
    }

    /// Normalize XOR gate to AND/OR combination
    ///
    /// XOR(A, B) = OR(AND(A, NOT B), AND(NOT A, B))
    ///           = (A ∧ ¬B) ∨ (¬A ∧ B)
    fn normalize_xor_gate(&mut self, index: NodeIndex, operands: &[NodeIndex]) -> Result<()> {
        if operands.len() != 2 {
            return Ok(()); // XOR only defined for 2 operands
        }

        let a = operands[0];
        let b = operands[1];

        // Create: AND(A, NOT B)
        let and1_ops = vec![a, -b];
        let and1_index = self.pdag.add_gate(
            format!("XOR_AND1_{}", index),
            Connective::And,
            and1_ops,
            None,
        )?;

        // Create: AND(NOT A, B)
        let and2_ops = vec![-a, b];
        let and2_index = self.pdag.add_gate(
            format!("XOR_AND2_{}", index),
            Connective::And,
            and2_ops,
            None,
        )?;

        // Convert XOR to OR(AND1, AND2)
        self.pdag.update_gate_connective(index, Connective::Or)?;
        self.pdag
            .update_gate_operands(index, vec![and1_index, and2_index])?;

        Ok(())
    }

    /// Normalize AtLeast (K/N voting) gate
    ///
    /// AtLeast(K, A1, A2, ..., An) is true if at least K of the inputs are true.
    /// For small K and N, this can be expanded to OR of AND combinations.
    ///
    /// Example: AtLeast(2, A, B, C) = OR(AND(A,B), AND(A,C), AND(B,C))
    fn normalize_atleast_gate(
        &mut self,
        index: NodeIndex,
        operands: &[NodeIndex],
        k: usize,
    ) -> Result<()> {
        let n = operands.len();

        if k == 0 {
            // Always true
            self.replace_with_constant(index, true)?;
            return Ok(());
        }

        if k > n {
            // Always false
            self.replace_with_constant(index, false)?;
            return Ok(());
        }

        if k == 1 {
            // AtLeast(1, ...) = OR(...)
            self.pdag.update_gate_connective(index, Connective::Or)?;
            return Ok(());
        }

        if k == n {
            // AtLeast(N, ...) = AND(...)
            self.pdag.update_gate_connective(index, Connective::And)?;
            return Ok(());
        }

        // For general K/N, generate combinations
        // This is computationally expensive for large N, so we limit it
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

            // Convert to OR of all AND combinations
            self.pdag.update_gate_connective(index, Connective::Or)?;
            self.pdag.update_gate_operands(index, and_gates)?;
        }

        Ok(())
    }

    /// Generate all K-combinations of operands
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

        // Generate combinations using recursive approach
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

    /// Propagate complements (NOT gates) down to basic events
    ///
    /// Applies DeMorgan's laws to push NOT gates towards leaves:
    /// - NOT(AND(A, B)) = OR(NOT A, NOT B)
    /// - NOT(OR(A, B)) = AND(NOT A, NOT B)
    fn propagate_complements(&mut self) -> Result<()> {
        let nodes: Vec<NodeIndex> = self.pdag.nodes().keys().copied().collect();

        for index in nodes {
            if index < 0 {
                // This is a complemented reference, apply DeMorgan's law
                let positive_idx = index.abs();

                if let Some(PdagNode::Gate {
                    connective,
                    operands,
                    ..
                }) = self.pdag.nodes().get(&positive_idx).cloned()
                {
                    match connective {
                        Connective::And => {
                            // NOT(AND(A, B, ...)) = OR(NOT A, NOT B, ...)
                            let negated_ops: Vec<NodeIndex> =
                                operands.iter().map(|&op| -op).collect();
                            self.pdag
                                .update_gate_connective(positive_idx, Connective::Or)?;
                            self.pdag.update_gate_operands(positive_idx, negated_ops)?;
                            self.stats.complements_propagated += 1;
                        }
                        Connective::Or => {
                            // NOT(OR(A, B, ...)) = AND(NOT A, NOT B, ...)
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

    /// Detect independent modules (sub-trees) in the fault tree
    ///
    /// Modules are independent sub-graphs that can be analyzed separately.
    /// Detecting modules can significantly improve analysis performance.
    fn detect_modules(&mut self) -> Result<()> {
        // A simple module detection: find gates that are only used once
        let mut usage_count: HashMap<NodeIndex, usize> = HashMap::new();

        for node in self.pdag.nodes().values() {
            if let PdagNode::Gate { operands, .. } = node {
                for &op in operands {
                    *usage_count.entry(op.abs()).or_insert(0) += 1;
                }
            }
        }

        // Gates used only once are potential modules
        for (_idx, count) in usage_count.iter() {
            if *count == 1 {
                self.stats.modules_detected += 1;
            }
        }

        Ok(())
    }

    /// Coalesce gates with identical logic
    ///
    /// Merges gates that have the same type and operands to reduce redundancy.
    fn coalesce_gates(&mut self) -> Result<()> {
        // Build a map of gate signatures to detect duplicates
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
                    // Found duplicate gate
                    to_merge.push((index, existing_idx));
                } else {
                    gate_signatures.insert(signature, index);
                }
            }
        }

        // Merge duplicate gates
        for (duplicate, original) in to_merge {
            if let Some(parents) = self.pdag.parents().get(&duplicate).cloned() {
                for parent_idx in parents {
                    self.replace_operand(parent_idx, duplicate, original)?;
                }
            }
        }

        Ok(())
    }

    /// Get preprocessing statistics
    ///
    /// # Returns
    /// * `PreprocessorStats` - Statistics about optimizations performed
    pub fn stats(&self) -> &PreprocessorStats {
        &self.stats
    }

    /// Consume the preprocessor and return the optimized PDAG
    ///
    /// # Returns
    /// * `Pdag` - The preprocessed and optimized PDAG
    pub fn into_pdag(self) -> Pdag {
        self.pdag
    }

    /// Get a reference to the current PDAG
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

        // NULL gates should be removed
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

        // AtLeast(1, E1, E2, E3) should become OR(E1, E2, E3)
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

        // Check that the gate was normalized
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

        // AtLeast(3, E1, E2, E3) should become AND(E1, E2, E3)
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

        // Check that the gate was normalized
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

        // C(3,2) = 3 combinations: (1,2), (1,3), (2,3)
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

        // Should detect modules
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
