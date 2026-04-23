// Cycle detection for fault tree validation
// Simplified version based on mcSCRAM/src/cycle.h and mcSCRAM/src/cycle.cc

use crate::core::fault_tree::FaultTree;
#[cfg(test)]
use crate::core::gate::Gate;
use crate::error::PraxisError;
use std::collections::HashSet;

/// Detects cycles in a fault tree structure.
///
/// Cycles occur when a gate references itself either directly or indirectly
/// through a chain of other gates. This is invalid in fault tree analysis
/// as it creates infinite loops in probability calculations.
pub struct CycleDetector<'a> {
    fault_tree: &'a FaultTree,
    visited: HashSet<String>,
    recursion_stack: Vec<String>,
}

impl<'a> CycleDetector<'a> {
    /// Creates a new cycle detector for a fault tree.
    ///
    /// # Example
    /// ```
    /// use praxis::algorithms::cycle::CycleDetector;
    /// use praxis::core::fault_tree::FaultTree;
    /// use praxis::core::gate::{Gate, Formula};
    ///
    /// let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
    /// let gate = Gate::new("G1".to_string(), Formula::And).unwrap();
    /// ft.add_gate(gate).unwrap();
    ///
    /// let detector = CycleDetector::new(&ft);
    /// ```
    pub fn new(fault_tree: &'a FaultTree) -> Self {
        Self {
            fault_tree,
            visited: HashSet::new(),
            recursion_stack: Vec::new(),
        }
    }

    /// Detects if there are any cycles in the fault tree.
    ///
    /// # Returns
    /// - `Ok(())` if no cycles are detected
    /// - `Err(PraxisError::Mef(MefError::Cycle))` if a cycle is found
    ///
    /// # Example
    /// ```
    /// use praxis::algorithms::cycle::CycleDetector;
    /// use praxis::core::fault_tree::FaultTree;
    /// use praxis::core::gate::{Gate, Formula};
    /// use praxis::core::event::BasicEvent;
    ///
    /// // Valid tree (no cycle)
    /// let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
    /// let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
    /// gate.add_operand("E1".to_string());
    /// ft.add_gate(gate).unwrap();
    /// let event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    /// ft.add_basic_event(event).unwrap();
    ///
    /// let mut detector = CycleDetector::new(&ft);
    /// assert!(detector.detect().is_ok());
    /// ```
    pub fn detect(&mut self) -> Result<(), PraxisError> {
        // Start from the top event
        self.detect_from_gate(self.fault_tree.top_event())
    }

    /// Recursively checks for cycles starting from a specific gate.
    fn detect_from_gate(&mut self, gate_id: &str) -> Result<(), PraxisError> {
        // If we've seen this gate in the current path, we have a cycle
        if self.recursion_stack.contains(&gate_id.to_string()) {
            // Build the cycle path for error reporting
            let cycle_start = self
                .recursion_stack
                .iter()
                .position(|id| id == gate_id)
                .unwrap();
            let cycle_path = self.recursion_stack[cycle_start..]
                .iter()
                .chain(std::iter::once(&gate_id.to_string()))
                .cloned()
                .collect::<Vec<_>>()
                .join(" -> ");

            return Err(PraxisError::Mef(crate::error::MefError::Cycle {
                cycle_path,
            }));
        }

        // If we've already fully processed this gate in a different path, skip it
        if self.visited.contains(gate_id) {
            return Ok(());
        }

        // Get the gate from the fault tree
        let gate = match self.fault_tree.gates().get(gate_id) {
            Some(g) => g,
            None => return Ok(()), // Not a gate (might be a basic event)
        };

        // Add to recursion stack
        self.recursion_stack.push(gate_id.to_string());

        // Check all arguments
        for arg_id in gate.operands() {
            self.detect_from_gate(arg_id)?;
        }

        // Remove from recursion stack and mark as visited
        self.recursion_stack.pop();
        self.visited.insert(gate_id.to_string());

        Ok(())
    }

    /// Returns the path of the detected cycle, if any.
    ///
    /// This is useful for diagnostic purposes after calling `detect()`.
    pub fn get_cycle_path(&self) -> Option<String> {
        if !self.recursion_stack.is_empty() {
            Some(self.recursion_stack.join(" -> "))
        } else {
            None
        }
    }
}

/// Validates that a fault tree has no cycles.
///
/// This is a convenience function that creates a detector and runs it.
///
/// # Example
/// ```
/// use praxis::algorithms::cycle::validate_fault_tree;
/// use praxis::core::fault_tree::FaultTree;
/// use praxis::core::gate::{Gate, Formula};
/// use praxis::core::event::BasicEvent;
///
/// let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
/// let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
/// gate.add_operand("E1".to_string());
/// ft.add_gate(gate).unwrap();
/// let event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
/// ft.add_basic_event(event).unwrap();
///
/// assert!(validate_fault_tree(&ft).is_ok());
/// ```
pub fn validate_fault_tree(fault_tree: &FaultTree) -> Result<(), PraxisError> {
    let mut detector = CycleDetector::new(fault_tree);
    detector.detect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::event::BasicEvent;
    use crate::core::gate::Formula;

    #[test]
    fn test_no_cycle_simple_tree() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut detector = CycleDetector::new(&ft);
        assert!(detector.detect().is_ok());
    }

    #[test]
    fn test_no_cycle_multi_level() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();

        // Top gate
        let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1.add_operand("G2".to_string());
        g1.add_operand("G3".to_string());
        ft.add_gate(g1).unwrap();

        // Second level gates
        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("E1".to_string());
        g2.add_operand("E2".to_string());
        ft.add_gate(g2).unwrap();

        let mut g3 = Gate::new("G3".to_string(), Formula::And).unwrap();
        g3.add_operand("E3".to_string());
        g3.add_operand("E4".to_string());
        ft.add_gate(g3).unwrap();

        // Events
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E4".to_string(), 0.04).unwrap())
            .unwrap();

        let mut detector = CycleDetector::new(&ft);
        assert!(detector.detect().is_ok());
    }

    #[test]
    fn test_direct_self_reference() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();

        // Gate that references itself
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("G1".to_string());
        gate.add_operand("E1".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let mut detector = CycleDetector::new(&ft);
        let result = detector.detect();
        assert!(result.is_err());
        if let Err(PraxisError::Mef(crate::error::MefError::Cycle { cycle_path })) = result {
            assert!(cycle_path.contains("G1"));
        } else {
            panic!("Expected Cycle error");
        }
    }

    #[test]
    fn test_indirect_cycle() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();

        // G1 -> G2 -> G3 -> G1 (cycle)
        let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1.add_operand("G2".to_string());
        ft.add_gate(g1).unwrap();

        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("G3".to_string());
        ft.add_gate(g2).unwrap();

        let mut g3 = Gate::new("G3".to_string(), Formula::Or).unwrap();
        g3.add_operand("G1".to_string()); // Creates cycle
        g3.add_operand("E1".to_string());
        ft.add_gate(g3).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let mut detector = CycleDetector::new(&ft);
        let result = detector.detect();
        assert!(result.is_err());
        if let Err(PraxisError::Mef(crate::error::MefError::Cycle { cycle_path })) = result {
            assert!(cycle_path.contains("G1"));
            assert!(cycle_path.contains("G2"));
            assert!(cycle_path.contains("G3"));
        } else {
            panic!("Expected Cycle error");
        }
    }

    #[test]
    fn test_shared_subtree_no_cycle() {
        // Diamond pattern: G1 -> G2, G3; both G2 and G3 -> E1
        // This is NOT a cycle, just shared nodes
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();

        let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1.add_operand("G2".to_string());
        g1.add_operand("G3".to_string());
        ft.add_gate(g1).unwrap();

        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("E1".to_string());
        ft.add_gate(g2).unwrap();

        let mut g3 = Gate::new("G3".to_string(), Formula::And).unwrap();
        g3.add_operand("E1".to_string()); // Shared event, not a cycle
        ft.add_gate(g3).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let mut detector = CycleDetector::new(&ft);
        assert!(detector.detect().is_ok());
    }

    #[test]
    fn test_validate_fault_tree() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        assert!(validate_fault_tree(&ft).is_ok());
    }

    #[test]
    fn test_cycle_with_longer_path() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();

        // Create longer cycle: G1 -> G2 -> G3 -> G4 -> G2
        let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1.add_operand("G2".to_string());
        ft.add_gate(g1).unwrap();

        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("G3".to_string());
        ft.add_gate(g2).unwrap();

        let mut g3 = Gate::new("G3".to_string(), Formula::Or).unwrap();
        g3.add_operand("G4".to_string());
        ft.add_gate(g3).unwrap();

        let mut g4 = Gate::new("G4".to_string(), Formula::And).unwrap();
        g4.add_operand("G2".to_string()); // Cycle back to G2
        g4.add_operand("E1".to_string());
        ft.add_gate(g4).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let mut detector = CycleDetector::new(&ft);
        let result = detector.detect();
        assert!(result.is_err());
    }
}
