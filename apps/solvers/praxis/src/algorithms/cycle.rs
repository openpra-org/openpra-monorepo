use crate::core::fault_tree::FaultTree;
#[cfg(test)]
use crate::core::gate::Gate;
use crate::error::PraxisError;
use std::collections::HashSet;

pub struct CycleDetector<'a> {
    fault_tree: &'a FaultTree,
    visited: HashSet<String>,
    recursion_stack: Vec<String>,
}

impl<'a> CycleDetector<'a> {

    pub fn new(fault_tree: &'a FaultTree) -> Self {
        Self {
            fault_tree,
            visited: HashSet::new(),
            recursion_stack: Vec::new(),
        }
    }

    pub fn detect(&mut self) -> Result<(), PraxisError> {

        self.detect_from_gate(self.fault_tree.top_event())
    }

    fn detect_from_gate(&mut self, gate_id: &str) -> Result<(), PraxisError> {

        if self.recursion_stack.contains(&gate_id.to_string()) {

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

        if self.visited.contains(gate_id) {
            return Ok(());
        }

        let gate = match self.fault_tree.gates().get(gate_id) {
            Some(g) => g,
            None => return Ok(()),
        };

        self.recursion_stack.push(gate_id.to_string());

        for arg_id in gate.operands() {
            self.detect_from_gate(arg_id)?;
        }

        self.recursion_stack.pop();
        self.visited.insert(gate_id.to_string());

        Ok(())
    }

    pub fn get_cycle_path(&self) -> Option<String> {
        if !self.recursion_stack.is_empty() {
            Some(self.recursion_stack.join(" -> "))
        } else {
            None
        }
    }
}

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

        let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1.add_operand("G2".to_string());
        g1.add_operand("G3".to_string());
        ft.add_gate(g1).unwrap();

        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("E1".to_string());
        g2.add_operand("E2".to_string());
        ft.add_gate(g2).unwrap();

        let mut g3 = Gate::new("G3".to_string(), Formula::And).unwrap();
        g3.add_operand("E3".to_string());
        g3.add_operand("E4".to_string());
        ft.add_gate(g3).unwrap();

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

        let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1.add_operand("G2".to_string());
        ft.add_gate(g1).unwrap();

        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("G3".to_string());
        ft.add_gate(g2).unwrap();

        let mut g3 = Gate::new("G3".to_string(), Formula::Or).unwrap();
        g3.add_operand("G1".to_string());
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

        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();

        let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1.add_operand("G2".to_string());
        g1.add_operand("G3".to_string());
        ft.add_gate(g1).unwrap();

        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("E1".to_string());
        ft.add_gate(g2).unwrap();

        let mut g3 = Gate::new("G3".to_string(), Formula::And).unwrap();
        g3.add_operand("E1".to_string());
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
        g4.add_operand("G2".to_string());
        g4.add_operand("E1".to_string());
        ft.add_gate(g4).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let mut detector = CycleDetector::new(&ft);
        let result = detector.detect();
        assert!(result.is_err());
    }
}
