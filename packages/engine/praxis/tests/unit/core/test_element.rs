use praxis::core::element::Element;
use praxis::error::{PraxisError, MefError};

#[cfg(test)]
mod element_new_tests {
    use super::*;

    #[test]
    fn test_element_new_valid_name() {
        let elem = Element::new("E1".to_string());
        assert!(elem.is_ok());
        
        let elem = elem.unwrap();
        assert_eq!(elem.id(), "E1");
        assert_eq!(elem.name(), None);
        assert_eq!(elem.label(), None);
    }

    #[test]
    fn test_element_new_valid_name_with_underscore() {
        let elem = Element::new("event_1".to_string()).unwrap();
        assert_eq!(elem.id(), "event_1");
    }

    #[test]
    fn test_element_new_valid_name_with_hyphen() {
        let elem = Element::new("event-1".to_string()).unwrap();
        assert_eq!(elem.id(), "event-1");
    }

    #[test]
    fn test_element_new_empty_name_error() {
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
    fn test_element_new_malformed_name_with_dot() {
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
    fn test_element_new_malformed_name_with_leading_dot() {
        let result = Element::new(".E1".to_string());
        assert!(result.is_err());
        
        match result.unwrap_err() {
            PraxisError::Mef(MefError::Validity(_)) => {}
            _ => panic!("Expected MEF Validity error"),
        }
    }

    #[test]
    fn test_element_new_malformed_name_with_trailing_dot() {
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
    fn test_element_set_label() {
        let mut elem = Element::new("E1".to_string()).unwrap();

        assert_eq!(elem.label(), None);
        
        elem.set_label(Some("Test Label".to_string()));
        assert_eq!(elem.label(), Some("Test Label"));
        
        elem.set_label(Some("Updated Label".to_string()));
        assert_eq!(elem.label(), Some("Updated Label"));
    }

    #[test]
    fn test_element_clone() {
        let elem1 = Element::new("E1".to_string()).unwrap();
        let elem2 = elem1.clone();
        
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
