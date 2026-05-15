/// Parameter expression for named reusable values
///
/// A parameter represents a named value that can be referenced by ID
/// throughout the model. Parameters can hold expressions but for MVP
/// we focus on constant values.
use crate::core::element::Element;
use crate::Result;

/// Parameter holding a named value that can be referenced by other expressions
///
/// Parameters provide reusable values that can be defined once and referenced
/// multiple times throughout a model, enabling consistency and easy updates.
#[derive(Debug, Clone, PartialEq)]
pub struct Parameter {
    element: Element,
    value: f64,
}

impl Parameter {
    /// Create a new parameter with given name and value
    ///
    /// # Arguments
    /// * `name` - Unique identifier for this parameter
    /// * `value` - The numerical value for this parameter
    ///
    /// # Returns
    /// * `Ok(Parameter)` - Successfully created parameter
    /// * `Err(PraxisError::Mef(MefError::Validity))` - Invalid name format
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::parameter::Parameter;
    ///
    /// let p = Parameter::new("lambda", 0.001).unwrap();
    /// assert_eq!(p.name(), "lambda");
    /// assert_eq!(p.value(), 0.001);
    /// ```
    pub fn new(name: impl Into<String>, value: f64) -> Result<Self> {
        Ok(Parameter {
            element: Element::new(name.into())?,
            value,
        })
    }

    /// Get reference to the parameter's element
    pub fn element(&self) -> &Element {
        &self.element
    }

    /// Get mutable reference to the parameter's element
    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    /// Get the parameter's name (ID)
    pub fn name(&self) -> &str {
        self.element.id()
    }

    /// Get the value of this parameter
    ///
    /// # Returns
    /// The numerical value stored in this parameter
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::parameter::Parameter;
    ///
    /// let p = Parameter::new("failure_rate", 0.01).unwrap();
    /// assert_eq!(p.value(), 0.01);
    /// ```
    pub fn value(&self) -> f64 {
        self.value
    }

    /// Set a new value for this parameter
    ///
    /// # Arguments
    /// * `value` - The new value to assign
    pub fn set_value(&mut self, value: f64) {
        self.value = value;
    }

    /// Check if this parameter's value represents a probability (in range [0, 1])
    pub fn is_probability(&self) -> bool {
        self.value >= 0.0 && self.value <= 1.0
    }

    /// Check if this parameter's value is non-negative
    pub fn is_non_negative(&self) -> bool {
        self.value >= 0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // T075-T077: Parameter::new() tests
    #[test]
    fn test_parameter_new_basic() {
        let p = Parameter::new("lambda", 0.001).unwrap();
        assert_eq!(p.name(), "lambda");
        assert_eq!(p.value(), 0.001);
    }

    #[test]
    fn test_parameter_new_with_zero() {
        let p = Parameter::new("zero_param", 0.0).unwrap();
        assert_eq!(p.name(), "zero_param");
        assert_eq!(p.value(), 0.0);
    }

    #[test]
    fn test_parameter_new_with_probability() {
        let p = Parameter::new("prob", 0.5).unwrap();
        assert_eq!(p.name(), "prob");
        assert_eq!(p.value(), 0.5);
    }

    #[test]
    fn test_parameter_new_invalid_name() {
        let result = Parameter::new("", 1.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_parameter_new_complex_name() {
        let p = Parameter::new("System_Failure_Rate_2024", 0.00123).unwrap();
        assert_eq!(p.name(), "System_Failure_Rate_2024");
        assert_eq!(p.value(), 0.00123);
    }

    #[test]
    fn test_parameter_new_negative_value() {
        let p = Parameter::new("temp", -273.15).unwrap();
        assert_eq!(p.value(), -273.15);
    }

    #[test]
    fn test_parameter_new_large_value() {
        let p = Parameter::new("population", 8000000000.0).unwrap();
        assert_eq!(p.value(), 8000000000.0);
    }

    // T078-T080: Parameter::value() tests
    #[test]
    fn test_parameter_value_retrieval() {
        let p = Parameter::new("alpha", 0.05).unwrap();
        assert_eq!(p.value(), 0.05);
    }

    #[test]
    fn test_parameter_value_multiple_calls() {
        let p = Parameter::new("beta", 0.95).unwrap();
        assert_eq!(p.value(), 0.95);
        assert_eq!(p.value(), 0.95);
        assert_eq!(p.value(), 0.95);
    }

    #[test]
    fn test_parameter_value_precision() {
        let p = Parameter::new("precise", 0.123456789012345).unwrap();
        assert_eq!(p.value(), 0.123456789012345);
    }

    #[test]
    fn test_parameter_value_immutable_access() {
        let p = Parameter::new("immutable", 42.0).unwrap();
        let v1 = p.value();
        let v2 = p.value();
        assert_eq!(v1, v2);
    }

    #[test]
    fn test_parameter_set_value() {
        let mut p = Parameter::new("mutable", 10.0).unwrap();
        assert_eq!(p.value(), 10.0);

        p.set_value(20.0);
        assert_eq!(p.value(), 20.0);

        p.set_value(30.0);
        assert_eq!(p.value(), 30.0);
    }

    #[test]
    fn test_parameter_element_access() {
        let mut p = Parameter::new("test_param", 1.0).unwrap();
        assert_eq!(p.element().id(), "test_param");

        p.element_mut()
            .set_label(Some("Test parameter for system".to_string()));
        assert_eq!(p.element().label(), Some("Test parameter for system"));
    }

    #[test]
    fn test_parameter_is_probability_valid() {
        let p1 = Parameter::new("p1", 0.0).unwrap();
        let p2 = Parameter::new("p2", 0.5).unwrap();
        let p3 = Parameter::new("p3", 1.0).unwrap();

        assert!(p1.is_probability());
        assert!(p2.is_probability());
        assert!(p3.is_probability());
    }

    #[test]
    fn test_parameter_is_probability_invalid() {
        let p1 = Parameter::new("p1", -0.1).unwrap();
        let p2 = Parameter::new("p2", 1.5).unwrap();

        assert!(!p1.is_probability());
        assert!(!p2.is_probability());
    }

    #[test]
    fn test_parameter_is_non_negative() {
        let p1 = Parameter::new("p1", 0.0).unwrap();
        let p2 = Parameter::new("p2", 100.0).unwrap();

        assert!(p1.is_non_negative());
        assert!(p2.is_non_negative());

        let p3 = Parameter::new("p3", -1.0).unwrap();
        assert!(!p3.is_non_negative());
    }

    #[test]
    fn test_parameter_clone() {
        let p1 = Parameter::new("original", 0.5).unwrap();
        let p2 = p1.clone();

        assert_eq!(p1.name(), p2.name());
        assert_eq!(p1.value(), p2.value());
        assert_eq!(p1, p2);
    }

    #[test]
    fn test_parameter_equality() {
        let p1 = Parameter::new("param", 0.5).unwrap();
        let p2 = Parameter::new("param", 0.5).unwrap();
        let p3 = Parameter::new("param", 0.6).unwrap();
        let p4 = Parameter::new("other", 0.5).unwrap();

        assert_eq!(p1, p2);
        assert_ne!(p1, p3); // Different value
        assert_ne!(p1, p4); // Different name
    }

    #[test]
    fn test_parameter_debug_format() {
        let p = Parameter::new("debug_param", 0.123).unwrap();
        let debug_str = format!("{:?}", p);
        assert!(debug_str.contains("debug_param") || debug_str.contains("0.123"));
    }

    #[test]
    fn test_parameter_different_names() {
        let p1 = Parameter::new("alpha", 1.0).unwrap();
        let p2 = Parameter::new("beta", 1.0).unwrap();
        let p3 = Parameter::new("gamma", 1.0).unwrap();

        assert_ne!(p1.name(), p2.name());
        assert_ne!(p2.name(), p3.name());
        assert_ne!(p1.name(), p3.name());
    }

    #[test]
    fn test_parameter_reference_semantics() {
        let mut p = Parameter::new("ref_test", 100.0).unwrap();
        let name_ref = p.name();
        assert_eq!(name_ref, "ref_test");

        p.set_value(200.0);
        assert_eq!(p.value(), 200.0);
        assert_eq!(p.name(), "ref_test"); // Name unchanged
    }
}
