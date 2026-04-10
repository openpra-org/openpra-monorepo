mod tests {
    use praxis::{MefError, PraxisError, XmlError};

    #[test]
    fn test_io_error() {
        let err = PraxisError::Io("File not found".to_string());
        assert_eq!(err.to_string(), "I/O Error: File not found");
    }

    #[test]
    fn test_dynamic_library_error() {
        let err = PraxisError::DynamicLibrary("Failed to load library".to_string());
        assert_eq!(
            err.to_string(),
            "Dynamic Library Error: Failed to load library"
        );
    }

    #[test]
    fn test_logic_error() {
        let err = PraxisError::Logic("Precondition failed".to_string());
        assert_eq!(err.to_string(), "Logic Error: Precondition failed");
    }

    #[test]
    fn test_illegal_operation() {
        let err = PraxisError::IllegalOperation("Operation not allowed".to_string());
        assert_eq!(err.to_string(), "Illegal Operation: Operation not allowed");
    }

    #[test]
    fn test_settings_error() {
        let err = PraxisError::Settings("Invalid configuration".to_string());
        assert_eq!(err.to_string(), "Settings Error: Invalid configuration");
    }

    #[test]
    fn test_version_error() {
        let err = PraxisError::Version("Minimum version not satisfied".to_string());
        assert_eq!(
            err.to_string(),
            "Version Error: Minimum version not satisfied"
        );
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "test");
        let praxis_err: PraxisError = io_err.into();
        assert!(praxis_err.to_string().contains("I/O Error"));
    }

    #[test]
    fn test_mef_validity_error() {
        let err = MefError::Validity("Invalid model structure".to_string());
        assert_eq!(err.to_string(), "Validity Error: Invalid model structure");
    }

    #[test]
    fn test_duplicate_element_without_container() {
        let err = MefError::DuplicateElement {
            element_id: "E1".to_string(),
            element_type: "BasicEvent".to_string(),
            container_id: None,
        };
        assert_eq!(
            err.to_string(),
            "Duplicate Element Error: BasicEvent 'E1' already exists"
        );
    }

    #[test]
    fn test_duplicate_element_with_container() {
        let err = MefError::DuplicateElement {
            element_id: "E1".to_string(),
            element_type: "BasicEvent".to_string(),
            container_id: Some("FaultTree1".to_string()),
        };
        assert_eq!(
            err.to_string(),
            "Duplicate Element Error: BasicEvent 'E1' already exists in container 'FaultTree1'"
        );
    }

    #[test]
    fn test_undefined_element() {
        let err = MefError::UndefinedElement {
            reference: "E2".to_string(),
            element_type: "BasicEvent".to_string(),
        };
        assert_eq!(
            err.to_string(),
            "Undefined Element Error: BasicEvent 'E2' not found"
        );
    }

    #[test]
    fn test_cycle_error() {
        let err = MefError::Cycle {
            cycle_path: "G1 -> G2 -> G3 -> G1".to_string(),
        };
        assert_eq!(err.to_string(), "Cycle Error: G1 -> G2 -> G3 -> G1");
    }

    #[test]
    fn test_domain_error_minimal() {
        let err = MefError::Domain {
            message: "Value out of range".to_string(),
            value: None,
            attribute: None,
        };
        assert_eq!(err.to_string(), "Domain Error: Value out of range");
    }

    #[test]
    fn test_domain_error_with_value() {
        let err = MefError::Domain {
            message: "Probability must be between 0 and 1".to_string(),
            value: Some("1.5".to_string()),
            attribute: None,
        };
        assert_eq!(
            err.to_string(),
            "Domain Error: Probability must be between 0 and 1 (value: 1.5)"
        );
    }

    #[test]
    fn test_domain_error_with_value_and_attribute() {
        let err = MefError::Domain {
            message: "Probability must be between 0 and 1".to_string(),
            value: Some("1.5".to_string()),
            attribute: Some("prob".to_string()),
        };
        assert_eq!(
            err.to_string(),
            "Domain Error: Probability must be between 0 and 1 (value: 1.5) (attribute: prob)"
        );
    }

    #[test]
    fn test_mef_error_in_praxis_error() {
        let mef_err = MefError::Validity("Test".to_string());
        let err = PraxisError::Mef(mef_err);
        assert_eq!(err.to_string(), "MEF Error: Validity Error: Test");
    }

    #[test]
    fn test_xml_parse_error_without_element() {
        let err = XmlError::Parse {
            message: "Unexpected end of file".to_string(),
            element: None,
        };
        assert_eq!(err.to_string(), "XML Parse Error: Unexpected end of file");
    }

    #[test]
    fn test_xml_parse_error_with_element() {
        let err = XmlError::Parse {
            message: "Invalid attribute".to_string(),
            element: Some("define-gate".to_string()),
        };
        assert_eq!(
            err.to_string(),
            "XML Parse Error in element 'define-gate': Invalid attribute"
        );
    }

    #[test]
    fn test_xinclude_error() {
        let err = XmlError::XInclude("Failed to resolve include".to_string());
        assert_eq!(err.to_string(), "XInclude Error: Failed to resolve include");
    }

    #[test]
    fn test_xml_validity_error_minimal() {
        let err = XmlError::Validity {
            message: "Missing required element".to_string(),
            element: None,
            attribute: None,
        };
        assert_eq!(
            err.to_string(),
            "XML Validity Error: Missing required element"
        );
    }

    #[test]
    fn test_xml_validity_error_with_element() {
        let err = XmlError::Validity {
            message: "Missing required attribute".to_string(),
            element: Some("basic-event".to_string()),
            attribute: None,
        };
        assert_eq!(
            err.to_string(),
            "XML Validity Error: Missing required attribute (element: basic-event)"
        );
    }

    #[test]
    fn test_xml_validity_error_with_element_and_attribute() {
        let err = XmlError::Validity {
            message: "Invalid value".to_string(),
            element: Some("basic-event".to_string()),
            attribute: Some("name".to_string()),
        };
        assert_eq!(
            err.to_string(),
            "XML Validity Error: Invalid value (element: basic-event) (attribute: name)"
        );
    }

    #[test]
    fn test_xml_error_in_praxis_error() {
        let xml_err = XmlError::Parse {
            message: "Test".to_string(),
            element: None,
        };
        let err = PraxisError::Xml(xml_err);
        assert_eq!(err.to_string(), "XML Error: XML Parse Error: Test");
    }

    #[test]
    fn test_praxis_error_is_error_trait() {
        let err = PraxisError::Logic("test".to_string());
        let _: &dyn std::error::Error = &err;
    }

    #[test]
    fn test_mef_error_is_error_trait() {
        let err = MefError::Validity("test".to_string());
        let _: &dyn std::error::Error = &err;
    }

    #[test]
    fn test_xml_error_is_error_trait() {
        let err = XmlError::XInclude("test".to_string());
        let _: &dyn std::error::Error = &err;
    }

    #[test]
    fn test_error_equality() {
        let err1 = PraxisError::Logic("test".to_string());
        let err2 = PraxisError::Logic("test".to_string());
        let err3 = PraxisError::Logic("different".to_string());

        assert_eq!(err1, err2);
        assert_ne!(err1, err3);
    }

    #[test]
    fn test_error_clone() {
        let err1 = PraxisError::Mef(MefError::Cycle {
            cycle_path: "G1 -> G2".to_string(),
        });
        let err2 = err1.clone();

        assert_eq!(err1, err2);
    }
}
