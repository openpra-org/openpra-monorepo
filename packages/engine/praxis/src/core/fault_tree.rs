use std::collections::HashMap;

use crate::core::ccf::CcfGroup;
use crate::core::element::Element;
use crate::core::event::{BasicEvent, HouseEvent};
use crate::core::gate::Gate;
use crate::{MefError, PraxisError, Result};

#[derive(Debug, Clone, PartialEq)]
pub struct FaultTree {
    element: Element,
    top_event: String,
    gates: HashMap<String, Gate>,
    basic_events: HashMap<String, BasicEvent>,
    house_events: HashMap<String, HouseEvent>,
    ccf_groups: HashMap<String, CcfGroup>,
}

impl FaultTree {
    pub fn new(id: impl Into<String>, top_event: impl Into<String>) -> Result<Self> {
        Ok(FaultTree {
            element: Element::new(id.into())?,
            top_event: top_event.into(),
            gates: HashMap::new(),
            basic_events: HashMap::new(),
            house_events: HashMap::new(),
            ccf_groups: HashMap::new(),
        })
    }

    pub fn element(&self) -> &Element {
        &self.element
    }

    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    pub fn top_event(&self) -> &str {
        &self.top_event
    }

    pub fn add_gate(&mut self, gate: Gate) -> Result<()> {
        let id = gate.element().id().to_string();
        if self.gates.contains_key(&id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: id.clone(),
                element_type: "gate".to_string(),
                container_id: Some(self.element().id().to_string()),
            }));
        }
        self.gates.insert(id, gate);
        Ok(())
    }

    pub fn get_gate(&self, id: &str) -> Option<&Gate> {
        self.gates.get(id)
    }

    pub fn get_gate_mut(&mut self, id: &str) -> Option<&mut Gate> {
        self.gates.get_mut(id)
    }

    pub fn gates(&self) -> &HashMap<String, Gate> {
        &self.gates
    }

    pub fn add_basic_event(&mut self, basic_event: BasicEvent) -> Result<()> {
        let id = basic_event.element().id().to_string();
        if self.basic_events.contains_key(&id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: id.clone(),
                element_type: "basic event".to_string(),
                container_id: Some(self.element().id().to_string()),
            }));
        }
        self.basic_events.insert(id, basic_event);
        Ok(())
    }

    pub fn get_basic_event(&self, id: &str) -> Option<&BasicEvent> {
        self.basic_events.get(id)
    }

    pub fn get_basic_event_mut(&mut self, id: &str) -> Option<&mut BasicEvent> {
        self.basic_events.get_mut(id)
    }

    pub fn basic_events(&self) -> &HashMap<String, BasicEvent> {
        &self.basic_events
    }

    pub fn add_house_event(&mut self, house_event: HouseEvent) -> Result<()> {
        let id = house_event.element().id().to_string();
        if self.house_events.contains_key(&id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: id.clone(),
                element_type: "house event".to_string(),
                container_id: Some(self.element().id().to_string()),
            }));
        }
        self.house_events.insert(id, house_event);
        Ok(())
    }

    pub fn get_house_event(&self, id: &str) -> Option<&HouseEvent> {
        self.house_events.get(id)
    }

    pub fn get_house_event_mut(&mut self, id: &str) -> Option<&mut HouseEvent> {
        self.house_events.get_mut(id)
    }

    pub fn house_events(&self) -> &HashMap<String, HouseEvent> {
        &self.house_events
    }

    pub fn add_ccf_group(&mut self, ccf_group: CcfGroup) -> Result<()> {
        let id = ccf_group.element().id().to_string();
        if self.ccf_groups.contains_key(&id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: id.clone(),
                element_type: "CCF group".to_string(),
                container_id: Some(self.element().id().to_string()),
            }));
        }
        self.ccf_groups.insert(id, ccf_group);
        Ok(())
    }

    pub fn get_ccf_group(&self, id: &str) -> Option<&CcfGroup> {
        self.ccf_groups.get(id)
    }

    pub fn get_ccf_group_mut(&mut self, id: &str) -> Option<&mut CcfGroup> {
        self.ccf_groups.get_mut(id)
    }

    pub fn ccf_groups(&self) -> &HashMap<String, CcfGroup> {
        &self.ccf_groups
    }

    pub fn expand_ccf_groups(&mut self, base_probabilities: &HashMap<String, f64>) -> Result<()> {
        let mut expanded_events = Vec::new();

        // Expand all CCF groups
        for (id, ccf_group) in &self.ccf_groups {
            let base_prob = base_probabilities.get(id).ok_or_else(|| {
                PraxisError::Logic(format!("Missing base probability for CCF group '{}'", id))
            })?;

            let events = ccf_group.expand(*base_prob)?;
            expanded_events.extend(events);
        }

        // Add expanded events to the fault tree
        for ccf_event in expanded_events {
            let basic_event = BasicEvent::new(ccf_event.id, ccf_event.probability)?;
            self.add_basic_event(basic_event)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::ccf::CcfModel;
    use crate::core::gate::Formula;

    // T060-T062: FaultTree::new() tests
    #[test]
    fn test_fault_tree_new_basic() {
        let ft = FaultTree::new("FT1", "TopGate").unwrap();
        assert_eq!(ft.element().id(), "FT1");
        assert_eq!(ft.top_event(), "TopGate");
        assert!(ft.gates().is_empty());
        assert!(ft.basic_events().is_empty());
        assert!(ft.house_events().is_empty());
        assert!(ft.ccf_groups().is_empty());
    }

    #[test]
    fn test_fault_tree_new_with_complex_id() {
        let ft = FaultTree::new("Complex-FT_123", "Top-Event-1").unwrap();
        assert_eq!(ft.element().id(), "Complex-FT_123");
        assert_eq!(ft.top_event(), "Top-Event-1");
    }

    #[test]
    fn test_fault_tree_new_invalid_id() {
        let result = FaultTree::new("", "TopGate");
        assert!(result.is_err());
    }

    #[test]
    fn test_fault_tree_element_access() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        assert_eq!(ft.element().id(), "FT1");
        assert_eq!(ft.element().name(), None);

        ft.element_mut().set_name("Test Fault Tree".to_string());
        assert_eq!(ft.element().name(), Some("Test Fault Tree"));
    }

    #[test]
    fn test_fault_tree_element_with_label() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        ft.element_mut()
            .set_label(Some("Primary fault tree for reactor system".to_string()));
        assert_eq!(
            ft.element().label(),
            Some("Primary fault tree for reactor system")
        );
    }

    // T063-T065: FaultTree::add_gate() tests
    #[test]
    fn test_add_gate_success() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();

        assert!(ft.add_gate(gate).is_ok());
        assert_eq!(ft.gates().len(), 1);
        assert!(ft.get_gate("TopGate").is_some());
    }

    #[test]
    fn test_add_gate_duplicate() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let gate1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        let gate2 = Gate::new("G1".to_string(), Formula::Or).unwrap();

        ft.add_gate(gate1).unwrap();
        let result = ft.add_gate(gate2);

        assert!(result.is_err());
        match result.unwrap_err() {
            PraxisError::Mef(MefError::DuplicateElement {
                element_id,
                element_type,
                container_id,
            }) => {
                assert_eq!(element_id, "G1");
                assert_eq!(element_type, "gate");
                assert_eq!(container_id, Some("FT1".to_string()));
            }
            _ => panic!("Expected DuplicateElement error"),
        }
    }

    #[test]
    fn test_add_multiple_gates() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        let g2 = Gate::new("G2".to_string(), Formula::Or).unwrap();
        let g3 = Gate::new("G3".to_string(), Formula::Not).unwrap();

        ft.add_gate(g1).unwrap();
        ft.add_gate(g2).unwrap();
        ft.add_gate(g3).unwrap();

        assert_eq!(ft.gates().len(), 3);
        assert!(ft.get_gate("G1").is_some());
        assert!(ft.get_gate("G2").is_some());
        assert!(ft.get_gate("G3").is_some());
    }

    #[test]
    fn test_get_gate_not_exists() {
        let ft = FaultTree::new("FT1", "TopGate").unwrap();
        assert!(ft.get_gate("NonExistent").is_none());
    }

    #[test]
    fn test_get_gate_mut() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        ft.add_gate(gate).unwrap();

        let gate_mut = ft.get_gate_mut("G1").unwrap();
        gate_mut.add_operand("E1".to_string());

        assert_eq!(ft.get_gate("G1").unwrap().operands().len(), 1);
    }

    #[test]
    fn test_add_gate_with_operands() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let mut gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());

        ft.add_gate(gate).unwrap();

        let retrieved = ft.get_gate("TopGate").unwrap();
        assert_eq!(retrieved.operands().len(), 2);
        assert_eq!(retrieved.operands()[0], "E1");
        assert_eq!(retrieved.operands()[1], "E2");
    }

    // T066-T068: FaultTree::top_event() tests
    #[test]
    fn test_top_event_access() {
        let ft = FaultTree::new("FT1", "TopGate").unwrap();
        assert_eq!(ft.top_event(), "TopGate");
    }

    #[test]
    fn test_top_event_immutable() {
        let ft = FaultTree::new("FT1", "TopGate").unwrap();
        let top = ft.top_event();
        assert_eq!(top, "TopGate");

        // Verify it's a reference to internal data
        assert_eq!(top.len(), 7);
    }

    #[test]
    fn test_top_event_different_values() {
        let ft1 = FaultTree::new("FT1", "SystemFailure").unwrap();
        let ft2 = FaultTree::new("FT2", "ComponentFailure").unwrap();

        assert_eq!(ft1.top_event(), "SystemFailure");
        assert_eq!(ft2.top_event(), "ComponentFailure");
        assert_ne!(ft1.top_event(), ft2.top_event());
    }

    // Additional integration tests
    #[test]
    fn test_add_basic_event_success() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let event = BasicEvent::new("E1".to_string(), 0.01).unwrap();

        ft.add_basic_event(event).unwrap();
        assert_eq!(ft.basic_events().len(), 1);
        assert!(ft.get_basic_event("E1").is_some());
    }

    #[test]
    fn test_add_basic_event_duplicate() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let event1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        let event2 = BasicEvent::new("E1".to_string(), 0.02).unwrap();

        ft.add_basic_event(event1).unwrap();
        let result = ft.add_basic_event(event2);

        assert!(result.is_err());
    }

    #[test]
    fn test_add_house_event_success() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let event = HouseEvent::new("H1".to_string(), true).unwrap();

        ft.add_house_event(event).unwrap();
        assert_eq!(ft.house_events().len(), 1);
        assert!(ft.get_house_event("H1").is_some());
    }

    #[test]
    fn test_fault_tree_with_all_elements() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();

        // Add gates
        ft.add_gate(Gate::new("TopGate".to_string(), Formula::And).unwrap())
            .unwrap();
        ft.add_gate(Gate::new("G1".to_string(), Formula::Or).unwrap())
            .unwrap();

        // Add basic events
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();

        // Add house event
        ft.add_house_event(HouseEvent::new("H1".to_string(), false).unwrap())
            .unwrap();

        assert_eq!(ft.gates().len(), 2);
        assert_eq!(ft.basic_events().len(), 3);
        assert_eq!(ft.house_events().len(), 1);
    }

    #[test]
    fn test_fault_tree_clone() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        ft.add_gate(Gate::new("G1".to_string(), Formula::And).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let cloned = ft.clone();
        assert_eq!(cloned.element().id(), ft.element().id());
        assert_eq!(cloned.top_event(), ft.top_event());
        assert_eq!(cloned.gates().len(), ft.gates().len());
        assert_eq!(cloned.basic_events().len(), ft.basic_events().len());
    }

    // CCF Integration Tests

    #[test]
    fn test_add_ccf_group_success() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let ccf = CcfGroup::new(
            "Pumps",
            vec!["P1".to_string(), "P2".to_string()],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();

        ft.add_ccf_group(ccf).unwrap();
        assert_eq!(ft.ccf_groups().len(), 1);
        assert!(ft.get_ccf_group("Pumps").is_some());
    }

    #[test]
    fn test_add_ccf_group_duplicate() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let ccf1 = CcfGroup::new(
            "Pumps",
            vec!["P1".to_string(), "P2".to_string()],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();
        let ccf2 = CcfGroup::new(
            "Pumps",
            vec!["P3".to_string(), "P4".to_string()],
            CcfModel::BetaFactor(0.3),
        )
        .unwrap();

        ft.add_ccf_group(ccf1).unwrap();
        let result = ft.add_ccf_group(ccf2);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_ccf_group() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let ccf = CcfGroup::new(
            "Valves",
            vec!["V1".to_string(), "V2".to_string()],
            CcfModel::AlphaFactor(vec![0.7, 0.3]),
        )
        .unwrap();

        ft.add_ccf_group(ccf).unwrap();

        let retrieved = ft.get_ccf_group("Valves");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().element().id(), "Valves");
        assert!(ft.get_ccf_group("NonExistent").is_none());
    }

    #[test]
    fn test_expand_ccf_groups_beta_factor() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let ccf = CcfGroup::new(
            "Pumps",
            vec!["P1".to_string(), "P2".to_string()],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();

        ft.add_ccf_group(ccf).unwrap();

        let mut base_probs = HashMap::new();
        base_probs.insert("Pumps".to_string(), 0.1);

        ft.expand_ccf_groups(&base_probs).unwrap();

        // Beta-Factor with 2 members creates 3 events
        assert_eq!(ft.basic_events().len(), 3);

        // Check independent events
        let indep1 = ft.get_basic_event("Pumps-indep-1");
        assert!(indep1.is_some());
        assert!((indep1.unwrap().probability() - 0.08).abs() < 1e-9);

        let indep2 = ft.get_basic_event("Pumps-indep-2");
        assert!(indep2.is_some());
        assert!((indep2.unwrap().probability() - 0.08).abs() < 1e-9);

        // Check common event
        let common = ft.get_basic_event("Pumps-common");
        assert!(common.is_some());
        assert!((common.unwrap().probability() - 0.02).abs() < 1e-9);
    }

    #[test]
    fn test_expand_ccf_groups_alpha_factor() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let ccf = CcfGroup::new(
            "Valves",
            vec!["V1".to_string(), "V2".to_string()],
            CcfModel::AlphaFactor(vec![0.6, 0.4]),
        )
        .unwrap();

        ft.add_ccf_group(ccf).unwrap();

        let mut base_probs = HashMap::new();
        base_probs.insert("Valves".to_string(), 0.05);

        ft.expand_ccf_groups(&base_probs).unwrap();

        // Alpha-Factor with 2 members creates 3 events
        assert_eq!(ft.basic_events().len(), 3);

        // Check k=1 events: 0.6 * 0.05 / 2 = 0.015
        let alpha1_1 = ft.get_basic_event("Valves-alpha-1-1");
        assert!(alpha1_1.is_some());
        assert!((alpha1_1.unwrap().probability() - 0.015).abs() < 1e-9);

        // Check k=2 event: 0.4 * 0.05 / 1 = 0.02
        let alpha2_1 = ft.get_basic_event("Valves-alpha-2-1");
        assert!(alpha2_1.is_some());
        assert!((alpha2_1.unwrap().probability() - 0.02).abs() < 1e-9);
    }

    #[test]
    fn test_expand_ccf_groups_mgl() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let ccf = CcfGroup::new(
            "Motors",
            vec!["M1".to_string(), "M2".to_string()],
            CcfModel::Mgl(vec![0.06, 0.04]),
        )
        .unwrap();

        ft.add_ccf_group(ccf).unwrap();

        let mut base_probs = HashMap::new();
        base_probs.insert("Motors".to_string(), 0.1); // Not used by MGL

        ft.expand_ccf_groups(&base_probs).unwrap();

        // MGL with 2 members creates 3 events
        assert_eq!(ft.basic_events().len(), 3);

        // Check k=1 events: Q₁ / 2 = 0.06 / 2 = 0.03
        let mgl1_1 = ft.get_basic_event("Motors-mgl-1-1");
        assert!(mgl1_1.is_some());
        assert!((mgl1_1.unwrap().probability() - 0.03).abs() < 1e-9);

        // Check k=2 event: Q₂ / 1 = 0.04
        let mgl2_1 = ft.get_basic_event("Motors-mgl-2-1");
        assert!(mgl2_1.is_some());
        assert!((mgl2_1.unwrap().probability() - 0.04).abs() < 1e-9);
    }

    #[test]
    fn test_expand_multiple_ccf_groups() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();

        // Add two CCF groups
        let ccf1 = CcfGroup::new(
            "Pumps",
            vec!["P1".to_string(), "P2".to_string()],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();

        let ccf2 = CcfGroup::new(
            "Valves",
            vec!["V1".to_string(), "V2".to_string()],
            CcfModel::BetaFactor(0.15),
        )
        .unwrap();

        ft.add_ccf_group(ccf1).unwrap();
        ft.add_ccf_group(ccf2).unwrap();

        let mut base_probs = HashMap::new();
        base_probs.insert("Pumps".to_string(), 0.1);
        base_probs.insert("Valves".to_string(), 0.08);

        ft.expand_ccf_groups(&base_probs).unwrap();

        // Both groups expanded: 3 + 3 = 6 events
        assert_eq!(ft.basic_events().len(), 6);

        // Check pump events
        assert!(ft.get_basic_event("Pumps-indep-1").is_some());
        assert!(ft.get_basic_event("Pumps-common").is_some());

        // Check valve events
        assert!(ft.get_basic_event("Valves-indep-1").is_some());
        assert!(ft.get_basic_event("Valves-common").is_some());
    }

    #[test]
    fn test_expand_ccf_groups_missing_base_prob() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let ccf = CcfGroup::new(
            "Pumps",
            vec!["P1".to_string(), "P2".to_string()],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();

        ft.add_ccf_group(ccf).unwrap();

        let base_probs = HashMap::new(); // Empty - missing "Pumps"

        let result = ft.expand_ccf_groups(&base_probs);
        assert!(result.is_err());
    }

    #[test]
    fn test_expand_ccf_groups_with_existing_events() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();

        // Add a regular basic event first
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        // Add CCF group
        let ccf = CcfGroup::new(
            "Pumps",
            vec!["P1".to_string(), "P2".to_string()],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();

        ft.add_ccf_group(ccf).unwrap();

        let mut base_probs = HashMap::new();
        base_probs.insert("Pumps".to_string(), 0.1);

        ft.expand_ccf_groups(&base_probs).unwrap();

        // 1 original + 3 from CCF = 4 events
        assert_eq!(ft.basic_events().len(), 4);
        assert!(ft.get_basic_event("E1").is_some());
        assert!(ft.get_basic_event("Pumps-indep-1").is_some());
    }

    #[test]
    fn test_ccf_groups_accessor() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();

        let ccf1 = CcfGroup::new(
            "Group1",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();

        let ccf2 = CcfGroup::new(
            "Group2",
            vec!["E3".to_string(), "E4".to_string()],
            CcfModel::BetaFactor(0.3),
        )
        .unwrap();

        ft.add_ccf_group(ccf1).unwrap();
        ft.add_ccf_group(ccf2).unwrap();

        let groups = ft.ccf_groups();
        assert_eq!(groups.len(), 2);
        assert!(groups.contains_key("Group1"));
        assert!(groups.contains_key("Group2"));
    }

    #[test]
    fn test_ccf_group_mut() {
        let mut ft = FaultTree::new("FT1", "TopGate").unwrap();
        let ccf = CcfGroup::new(
            "Pumps",
            vec!["P1".to_string(), "P2".to_string()],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();

        ft.add_ccf_group(ccf).unwrap();

        // Get mutable reference and verify it exists
        let ccf_mut = ft.get_ccf_group_mut("Pumps");
        assert!(ccf_mut.is_some());

        // Verify immutable access still works
        assert!(ft.get_ccf_group("Pumps").is_some());
    }
}
