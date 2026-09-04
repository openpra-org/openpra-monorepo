use crate::error::{MefError, PraxisError};
use crate::Result;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Element {
    id: String,
    name: Option<String>,
    label: Option<String>,
}

impl Element {
    pub fn new(id: String) -> Result<Self> {
        if id.is_empty() {
            return Err(PraxisError::Logic(
                "The element name cannot be empty".to_string(),
            ));
        }

        if id.contains('.') {
            return Err(PraxisError::Mef(MefError::Validity(
                "The element name is malformed.".to_string(),
            )));
        }

        Ok(Element {
            id,
            name: None,
            label: None,
        })
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn name(&self) -> Option<&str> {
        self.name.as_deref()
    }

    pub fn set_name(&mut self, name: String) {
        self.name = Some(name);
    }

    pub fn label(&self) -> Option<&str> {
        self.label.as_deref()
    }

    pub fn set_label(&mut self, label: Option<String>) {
        self.label = label;
    }

    pub fn with_name(mut self, name: Option<String>) -> Self {
        self.name = name;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_element_new_valid_id() {
        let elem = Element::new("E1".to_string());
        assert!(elem.is_ok());

        let elem = elem.unwrap();
        assert_eq!(elem.id(), "E1");
        assert_eq!(elem.name(), None);
        assert_eq!(elem.label(), None);
    }

    #[test]
    fn test_element_new_valid_id_with_underscore() {
        let elem = Element::new("event_1".to_string()).unwrap();
        assert_eq!(elem.id(), "event_1");
    }

    #[test]
    fn test_element_new_valid_id_with_hyphen() {
        let elem = Element::new("event-1".to_string()).unwrap();
        assert_eq!(elem.id(), "event-1");
    }

    #[test]
    fn test_element_new_empty_id_error() {
        let result = Element::new("".to_string());
        assert!(result.is_err());

        match result.unwrap_err() {
            PraxisError::Logic(msg) => {
                assert_eq!(msg, "The element name cannot be empty");
            }
            _ => panic!("Expected Logic error"),
        }
    }

    #[test]
    fn test_element_new_malformed_id_with_dot() {
        let result = Element::new("E1.E2".to_string());
        assert!(result.is_err());

        match result.unwrap_err() {
            PraxisError::Mef(MefError::Validity(msg)) => {
                assert_eq!(msg, "The element name is malformed.");
            }
            _ => panic!("Expected MEF Validity error"),
        }
    }

    #[test]
    fn test_element_new_malformed_id_with_leading_dot() {
        let result = Element::new(".E1".to_string());
        assert!(result.is_err());

        match result.unwrap_err() {
            PraxisError::Mef(MefError::Validity(_)) => {}
            _ => panic!("Expected MEF Validity error"),
        }
    }

    #[test]
    fn test_element_new_malformed_id_with_trailing_dot() {
        let result = Element::new("E1.".to_string());
        assert!(result.is_err());

        match result.unwrap_err() {
            PraxisError::Mef(MefError::Validity(_)) => {}
            _ => panic!("Expected MEF Validity error"),
        }
    }

    #[test]
    fn test_element_fields() {
        let elem = Element::new("TestElement".to_string()).unwrap();

        assert_eq!(elem.id(), "TestElement");
        assert_eq!(elem.name(), None);
        assert_eq!(elem.label(), None);
    }

    #[test]
    fn test_element_id_getter() {
        let elem = Element::new("E1".to_string()).unwrap();
        assert_eq!(elem.id(), "E1");
    }

    #[test]
    fn test_element_id_returns_correct_value() {
        let elem = Element::new("MyElement123".to_string()).unwrap();
        assert_eq!(elem.id(), "MyElement123");
    }

    #[test]
    fn test_element_id_immutable() {
        let elem = Element::new("E1".to_string()).unwrap();
        let id1 = elem.id();
        let id2 = elem.id();
        assert_eq!(id1, id2);
        assert_eq!(id1, "E1");
    }

    #[test]
    fn test_element_name_initially_none() {
        let elem = Element::new("E1".to_string()).unwrap();
        assert_eq!(elem.name(), None);
    }

    #[test]
    fn test_element_name_getter_after_set() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_name("Event One".to_string());
        assert_eq!(elem.name(), Some("Event One"));
    }

    #[test]
    fn test_element_name_returns_correct_value() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_name("My Event Name".to_string());
        assert_eq!(elem.name(), Some("My Event Name"));
    }

    #[test]
    fn test_element_name_independent_of_id() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_name("Event One".to_string());

        assert_eq!(elem.id(), "E1");
        assert_eq!(elem.name(), Some("Event One"));
        assert_ne!(elem.id(), elem.name().unwrap());
    }

    #[test]
    fn test_element_name_can_be_updated() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_name("First Name".to_string());
        assert_eq!(elem.name(), Some("First Name"));

        elem.set_name("Second Name".to_string());
        assert_eq!(elem.name(), Some("Second Name"));
    }

    #[test]
    fn test_element_name_immutable_getter() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_name("Test".to_string());

        let name1 = elem.name();
        let name2 = elem.name();
        assert_eq!(name1, name2);
    }

    #[test]
    fn test_element_set_name() {
        let mut elem = Element::new("E1".to_string()).unwrap();

        assert_eq!(elem.name(), None);

        elem.set_name("Event 1".to_string());
        assert_eq!(elem.name(), Some("Event 1"));

        elem.set_name("Updated Event".to_string());
        assert_eq!(elem.name(), Some("Updated Event"));

        assert_eq!(elem.id(), "E1");
    }

    #[test]
    fn test_element_label_initially_none() {
        let elem = Element::new("E1".to_string()).unwrap();
        assert_eq!(elem.label(), None);
    }

    #[test]
    fn test_element_label_getter_after_set() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_label(Some("Test Label".to_string()));
        assert_eq!(elem.label(), Some("Test Label"));
    }

    #[test]
    fn test_element_label_returns_correct_value() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_label(Some("My Label Description".to_string()));
        assert_eq!(elem.label(), Some("My Label Description"));
    }

    #[test]
    fn test_element_label_independent_of_id_and_name() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_name("Event One".to_string());
        elem.set_label(Some("Description".to_string()));

        assert_eq!(elem.id(), "E1");
        assert_eq!(elem.name(), Some("Event One"));
        assert_eq!(elem.label(), Some("Description"));
        assert_ne!(elem.id(), elem.label().unwrap());
    }

    #[test]
    fn test_element_label_can_be_updated() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_label(Some("First Label".to_string()));
        assert_eq!(elem.label(), Some("First Label"));

        elem.set_label(Some("Second Label".to_string()));
        assert_eq!(elem.label(), Some("Second Label"));
    }

    #[test]
    fn test_element_label_immutable_getter() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_label(Some("Test Label".to_string()));

        let label1 = elem.label();
        let label2 = elem.label();
        assert_eq!(label1, label2);
    }

    #[test]
    fn test_element_set_label() {
        let mut elem = Element::new("E1".to_string()).unwrap();

        assert_eq!(elem.label(), None);

        elem.set_label(Some("Test Label".to_string()));
        assert_eq!(elem.label(), Some("Test Label"));

        elem.set_label(Some("Updated Label".to_string()));
        assert_eq!(elem.label(), Some("Updated Label"));
    }

    #[test]
    fn test_element_all_fields() {
        let mut elem = Element::new("E1".to_string()).unwrap();
        elem.set_name("Event One".to_string());
        elem.set_label(Some("First event".to_string()));

        assert_eq!(elem.id(), "E1");
        assert_eq!(elem.name(), Some("Event One"));
        assert_eq!(elem.label(), Some("First event"));
    }

    #[test]
    fn test_element_clone() {
        let elem1 = Element::new("E1".to_string()).unwrap();
        let elem2 = elem1.clone();

        assert_eq!(elem1.id(), elem2.id());
        assert_eq!(elem1.name(), elem2.name());
        assert_eq!(elem1.label(), elem2.label());
    }

    #[test]
    fn test_element_equality() {
        let elem1 = Element::new("E1".to_string()).unwrap();
        let elem2 = Element::new("E1".to_string()).unwrap();
        let elem3 = Element::new("E2".to_string()).unwrap();

        assert_eq!(elem1, elem2);
        assert_ne!(elem1, elem3);
    }

    #[test]
    fn test_element_with_name_equality() {
        let mut elem1 = Element::new("E1".to_string()).unwrap();
        let mut elem2 = Element::new("E1".to_string()).unwrap();

        elem1.set_name("Name1".to_string());
        elem2.set_name("Name1".to_string());

        assert_eq!(elem1, elem2);

        elem2.set_name("Name2".to_string());
        assert_ne!(elem1, elem2);
    }

    #[test]
    fn test_element_with_label_equality() {
        let mut elem1 = Element::new("E1".to_string()).unwrap();
        let mut elem2 = Element::new("E1".to_string()).unwrap();

        elem1.set_label(Some("Label1".to_string()));
        elem2.set_label(Some("Label1".to_string()));

        assert_eq!(elem1, elem2);

        elem2.set_label(Some("Label2".to_string()));
        assert_ne!(elem1, elem2);
    }

    #[test]
    fn test_element_debug_format() {
        let elem = Element::new("E1".to_string()).unwrap();
        let debug_str = format!("{:?}", elem);

        assert!(debug_str.contains("Element"));
        assert!(debug_str.contains("E1"));
    }
}
