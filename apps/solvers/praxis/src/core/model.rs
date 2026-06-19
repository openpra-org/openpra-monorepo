use std::collections::HashMap;

use crate::core::element::Element;
use crate::core::event::BasicEvent;
use crate::core::fault_tree::FaultTree;
use crate::{MefError, PraxisError, Result};

#[derive(Debug, Clone)]
pub struct Model {
    element: Element,
    fault_trees: HashMap<String, FaultTree>,
    basic_events: HashMap<String, BasicEvent>,
}

impl Model {

    pub fn new(name: impl Into<String>) -> Result<Self> {
        let name_str = name.into();
        let id = if name_str.is_empty() {
            "__unnamed-model__".to_string()
        } else {
            name_str.clone()
        };

        Ok(Model {
            element: Element::new(id)?.with_name(if name_str.is_empty() {
                None
            } else {
                Some(name_str)
            }),
            fault_trees: HashMap::new(),
            basic_events: HashMap::new(),
        })
    }

    pub fn element(&self) -> &Element {
        &self.element
    }

    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    pub fn name(&self) -> &str {
        self.element.name().unwrap_or("")
    }

    pub fn is_unnamed(&self) -> bool {
        self.element.id() == "__unnamed-model__"
    }

    pub fn add_fault_tree(&mut self, fault_tree: FaultTree) -> Result<()> {
        let id = fault_tree.element().id().to_string();
        if self.fault_trees.contains_key(&id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: id.clone(),
                element_type: "fault tree".to_string(),
                container_id: Some(self.element().id().to_string()),
            }));
        }
        self.fault_trees.insert(id, fault_tree);
        Ok(())
    }

    pub fn get_fault_tree(&self, id: &str) -> Option<&FaultTree> {
        self.fault_trees.get(id)
    }

    pub fn get_fault_tree_mut(&mut self, id: &str) -> Option<&mut FaultTree> {
        self.fault_trees.get_mut(id)
    }

    pub fn fault_trees(&self) -> &HashMap<String, FaultTree> {
        &self.fault_trees
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_new_unnamed() {
        let model = Model::new("").unwrap();
        assert_eq!(model.element().id(), "__unnamed-model__");
        assert_eq!(model.name(), "");
        assert!(model.is_unnamed());
        assert!(model.fault_trees().is_empty());
        assert!(model.basic_events().is_empty());
    }

    #[test]
    fn test_model_new_named() {
        let model = Model::new("TestModel").unwrap();
        assert_eq!(model.element().id(), "TestModel");
        assert_eq!(model.name(), "TestModel");
        assert!(!model.is_unnamed());
        assert!(model.fault_trees().is_empty());
        assert!(model.basic_events().is_empty());
    }

    #[test]
    fn test_model_new_with_complex_name() {
        let model = Model::new("Complex_Model-123").unwrap();
        assert_eq!(model.element().id(), "Complex_Model-123");
        assert_eq!(model.name(), "Complex_Model-123");
    }

    #[test]
    fn test_model_element_access() {
        let mut model = Model::new("TestModel").unwrap();
        assert_eq!(model.element().id(), "TestModel");

        model
            .element_mut()
            .set_label(Some("Test Label".to_string()));
        assert_eq!(model.element().label(), Some("Test Label"));
    }

    #[test]
    fn test_add_fault_tree_success() {
        let mut model = Model::new("TestModel").unwrap();
        let ft = FaultTree::new("FT1", "TopGate").unwrap();

        assert!(model.add_fault_tree(ft).is_ok());
        assert_eq!(model.fault_trees().len(), 1);
        assert!(model.get_fault_tree("FT1").is_some());
    }

    #[test]
    fn test_add_fault_tree_duplicate() {
        let mut model = Model::new("TestModel").unwrap();
        let ft1 = FaultTree::new("FT1", "TopGate1").unwrap();
        let ft2 = FaultTree::new("FT1", "TopGate2").unwrap();

        model.add_fault_tree(ft1).unwrap();
        let result = model.add_fault_tree(ft2);

        assert!(result.is_err());
        match result.unwrap_err() {
            PraxisError::Mef(MefError::DuplicateElement {
                element_id,
                element_type,
                ..
            }) => {
                assert_eq!(element_type, "fault tree");
                assert_eq!(element_id, "FT1");
            }
            _ => panic!("Expected DuplicateElement error"),
        }
    }

    #[test]
    fn test_add_multiple_fault_trees() {
        let mut model = Model::new("TestModel").unwrap();
        let ft1 = FaultTree::new("FT1", "TopGate1").unwrap();
        let ft2 = FaultTree::new("FT2", "TopGate2").unwrap();
        let ft3 = FaultTree::new("FT3", "TopGate3").unwrap();

        model.add_fault_tree(ft1).unwrap();
        model.add_fault_tree(ft2).unwrap();
        model.add_fault_tree(ft3).unwrap();

        assert_eq!(model.fault_trees().len(), 3);
    }

    #[test]
    fn test_get_fault_tree_exists() {
        let mut model = Model::new("TestModel").unwrap();
        let ft = FaultTree::new("FT1", "TopGate").unwrap();
        model.add_fault_tree(ft).unwrap();

        let retrieved = model.get_fault_tree("FT1");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().element().id(), "FT1");
        assert_eq!(retrieved.unwrap().top_event(), "TopGate");
    }

    #[test]
    fn test_get_fault_tree_not_exists() {
        let model = Model::new("TestModel").unwrap();
        assert!(model.get_fault_tree("FT1").is_none());
    }

    #[test]
    fn test_get_fault_tree_multiple() {
        let mut model = Model::new("TestModel").unwrap();
        model
            .add_fault_tree(FaultTree::new("FT1", "Top1").unwrap())
            .unwrap();
        model
            .add_fault_tree(FaultTree::new("FT2", "Top2").unwrap())
            .unwrap();

        assert!(model.get_fault_tree("FT1").is_some());
        assert!(model.get_fault_tree("FT2").is_some());
        assert!(model.get_fault_tree("FT3").is_none());
    }

    #[test]
    fn test_get_fault_tree_mut() {
        let mut model = Model::new("TestModel").unwrap();
        let ft = FaultTree::new("FT1", "TopGate").unwrap();
        model.add_fault_tree(ft).unwrap();

        let ft_mut = model.get_fault_tree_mut("FT1").unwrap();
        ft_mut.element_mut().set_label(Some("Modified".to_string()));

        assert_eq!(
            model.get_fault_tree("FT1").unwrap().element().label(),
            Some("Modified")
        );
    }

    #[test]
    fn test_add_basic_event_success() {
        let mut model = Model::new("TestModel").unwrap();
        let event = BasicEvent::new("E1".to_string(), 0.01).unwrap();

        assert!(model.add_basic_event(event).is_ok());
        assert_eq!(model.basic_events().len(), 1);
        assert!(model.get_basic_event("E1").is_some());
    }

    #[test]
    fn test_add_basic_event_duplicate() {
        let mut model = Model::new("TestModel").unwrap();
        let event1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        let event2 = BasicEvent::new("E1".to_string(), 0.02).unwrap();

        model.add_basic_event(event1).unwrap();
        let result = model.add_basic_event(event2);

        assert!(result.is_err());
        match result.unwrap_err() {
            PraxisError::Mef(MefError::DuplicateElement {
                element_id,
                element_type,
                ..
            }) => {
                assert_eq!(element_type, "basic event");
                assert_eq!(element_id, "E1");
            }
            _ => panic!("Expected DuplicateElement error"),
        }
    }

    #[test]
    fn test_add_multiple_basic_events() {
        let mut model = Model::new("TestModel").unwrap();
        let e1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        let e2 = BasicEvent::new("E2".to_string(), 0.02).unwrap();
        let e3 = BasicEvent::new("E3".to_string(), 0.03).unwrap();

        model.add_basic_event(e1).unwrap();
        model.add_basic_event(e2).unwrap();
        model.add_basic_event(e3).unwrap();

        assert_eq!(model.basic_events().len(), 3);
    }

    #[test]
    fn test_add_basic_event_with_zero_probability() {
        let mut model = Model::new("TestModel").unwrap();
        let event = BasicEvent::new("E1".to_string(), 0.0).unwrap();

        assert!(model.add_basic_event(event).is_ok());
        assert_eq!(model.get_basic_event("E1").unwrap().probability(), 0.0);
    }

    #[test]
    fn test_add_basic_event_with_one_probability() {
        let mut model = Model::new("TestModel").unwrap();
        let event = BasicEvent::new("E1".to_string(), 1.0).unwrap();

        assert!(model.add_basic_event(event).is_ok());
        assert_eq!(model.get_basic_event("E1").unwrap().probability(), 1.0);
    }

    #[test]
    fn test_get_basic_event_exists() {
        let mut model = Model::new("TestModel").unwrap();
        let event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        model.add_basic_event(event).unwrap();

        let retrieved = model.get_basic_event("E1");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().element().id(), "E1");
        assert_eq!(retrieved.unwrap().probability(), 0.01);
    }

    #[test]
    fn test_get_basic_event_not_exists() {
        let model = Model::new("TestModel").unwrap();
        assert!(model.get_basic_event("E1").is_none());
    }

    #[test]
    fn test_get_basic_event_multiple() {
        let mut model = Model::new("TestModel").unwrap();
        model
            .add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        model
            .add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        assert!(model.get_basic_event("E1").is_some());
        assert!(model.get_basic_event("E2").is_some());
        assert!(model.get_basic_event("E3").is_none());
    }

    #[test]
    fn test_get_basic_event_mut() {
        let mut model = Model::new("TestModel").unwrap();
        let event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        model.add_basic_event(event).unwrap();

        let event_mut = model.get_basic_event_mut("E1").unwrap();
        event_mut.set_probability(0.05).unwrap();

        assert_eq!(model.get_basic_event("E1").unwrap().probability(), 0.05);
    }

    #[test]
    fn test_model_with_mixed_elements() {
        let mut model = Model::new("ComplexModel").unwrap();

        model
            .add_fault_tree(FaultTree::new("FT1", "Top1").unwrap())
            .unwrap();
        model
            .add_fault_tree(FaultTree::new("FT2", "Top2").unwrap())
            .unwrap();

        model
            .add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        model
            .add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        model
            .add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();

        assert_eq!(model.fault_trees().len(), 2);
        assert_eq!(model.basic_events().len(), 3);
        assert_eq!(model.name(), "ComplexModel");
    }

    #[test]
    fn test_model_clone() {
        let mut model = Model::new("TestModel").unwrap();
        model
            .add_fault_tree(FaultTree::new("FT1", "Top").unwrap())
            .unwrap();
        model
            .add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let cloned = model.clone();
        assert_eq!(cloned.name(), model.name());
        assert_eq!(cloned.fault_trees().len(), model.fault_trees().len());
        assert_eq!(cloned.basic_events().len(), model.basic_events().len());
    }
}
