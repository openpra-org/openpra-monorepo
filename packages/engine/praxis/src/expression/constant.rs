/// Constant expression for fixed probability values
///
/// A constant expression represents a fixed numerical value that does not
/// change during analysis. This is the simplest expression type.
use crate::Result;

/// Constant expression holding a fixed numerical value
///
/// This is used to represent fixed probabilities for basic events,
/// constant values in formulas, and other unchanging numerical data.
#[derive(Debug, Clone, PartialEq)]
pub struct Constant {
    value: f64,
}

impl Constant {
    /// Constant value representing 0 or False
    pub const ZERO: f64 = 0.0;

    /// Constant value representing 1 or True
    pub const ONE: f64 = 1.0;

    /// Constant value representing PI
    pub const PI: f64 = std::f64::consts::PI;

    /// Create a new constant expression with the given value
    ///
    /// # Arguments
    /// * `value` - The numerical value for this constant
    ///
    /// # Returns
    /// * `Ok(Constant)` - Successfully created constant
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::constant::Constant;
    ///
    /// let c = Constant::new(0.5).unwrap();
    /// assert_eq!(c.value(), 0.5);
    /// ```
    pub fn new(value: f64) -> Result<Self> {
        Ok(Constant { value })
    }

    /// Get the value of this constant expression
    ///
    /// # Returns
    /// The numerical value stored in this constant
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::constant::Constant;
    ///
    /// let c = Constant::new(0.123).unwrap();
    /// assert_eq!(c.value(), 0.123);
    /// ```
    pub fn value(&self) -> f64 {
        self.value
    }

    /// Check if this constant represents a probability (in range [0, 1])
    pub fn is_probability(&self) -> bool {
        self.value >= 0.0 && self.value <= 1.0
    }

    /// Check if this constant is non-negative
    pub fn is_non_negative(&self) -> bool {
        self.value >= 0.0
    }

    /// Check if this constant is positive (greater than 0)
    pub fn is_positive(&self) -> bool {
        self.value > 0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // T069-T071: Constant::new() tests
    #[test]
    fn test_constant_new_zero() {
        let c = Constant::new(0.0).unwrap();
        assert_eq!(c.value(), 0.0);
    }

    #[test]
    fn test_constant_new_one() {
        let c = Constant::new(1.0).unwrap();
        assert_eq!(c.value(), 1.0);
    }

    #[test]
    fn test_constant_new_probability() {
        let c = Constant::new(0.5).unwrap();
        assert_eq!(c.value(), 0.5);
    }

    #[test]
    fn test_constant_new_small_probability() {
        let c = Constant::new(0.001).unwrap();
        assert_eq!(c.value(), 0.001);
    }

    #[test]
    fn test_constant_new_negative() {
        let c = Constant::new(-5.0).unwrap();
        assert_eq!(c.value(), -5.0);
    }

    #[test]
    fn test_constant_new_large_value() {
        let c = Constant::new(1000.0).unwrap();
        assert_eq!(c.value(), 1000.0);
    }

    #[test]
    fn test_constant_new_pi() {
        let c = Constant::new(Constant::PI).unwrap();
        assert_eq!(c.value(), std::f64::consts::PI);
    }

    #[test]
    fn test_constant_new_nan() {
        let c = Constant::new(f64::NAN).unwrap();
        assert!(c.value().is_nan());
    }

    #[test]
    fn test_constant_new_infinity() {
        let c = Constant::new(f64::INFINITY).unwrap();
        assert!(c.value().is_infinite());
    }

    // T072-T074: Constant::value() tests
    #[test]
    fn test_constant_value_retrieval() {
        let c = Constant::new(0.123).unwrap();
        assert_eq!(c.value(), 0.123);
    }

    #[test]
    fn test_constant_value_multiple_calls() {
        let c = Constant::new(0.999).unwrap();
        assert_eq!(c.value(), 0.999);
        assert_eq!(c.value(), 0.999);
        assert_eq!(c.value(), 0.999);
    }

    #[test]
    fn test_constant_value_precision() {
        let c = Constant::new(0.123456789012345).unwrap();
        assert_eq!(c.value(), 0.123456789012345);
    }

    #[test]
    fn test_constant_value_immutable() {
        let c = Constant::new(0.5).unwrap();
        let v1 = c.value();
        let v2 = c.value();
        assert_eq!(v1, v2);
    }

    // Helper method tests
    #[test]
    fn test_constant_is_probability_valid() {
        let c1 = Constant::new(0.0).unwrap();
        let c2 = Constant::new(0.5).unwrap();
        let c3 = Constant::new(1.0).unwrap();

        assert!(c1.is_probability());
        assert!(c2.is_probability());
        assert!(c3.is_probability());
    }

    #[test]
    fn test_constant_is_probability_invalid() {
        let c1 = Constant::new(-0.1).unwrap();
        let c2 = Constant::new(1.1).unwrap();
        let c3 = Constant::new(100.0).unwrap();

        assert!(!c1.is_probability());
        assert!(!c2.is_probability());
        assert!(!c3.is_probability());
    }

    #[test]
    fn test_constant_is_non_negative() {
        let c1 = Constant::new(0.0).unwrap();
        let c2 = Constant::new(0.5).unwrap();
        let c3 = Constant::new(100.0).unwrap();

        assert!(c1.is_non_negative());
        assert!(c2.is_non_negative());
        assert!(c3.is_non_negative());

        let c4 = Constant::new(-0.1).unwrap();
        assert!(!c4.is_non_negative());
    }

    #[test]
    fn test_constant_is_positive() {
        let c1 = Constant::new(0.001).unwrap();
        let c2 = Constant::new(1.0).unwrap();

        assert!(c1.is_positive());
        assert!(c2.is_positive());

        let c3 = Constant::new(0.0).unwrap();
        let c4 = Constant::new(-1.0).unwrap();

        assert!(!c3.is_positive());
        assert!(!c4.is_positive());
    }

    #[test]
    fn test_constant_clone() {
        let c1 = Constant::new(0.5).unwrap();
        let c2 = c1.clone();

        assert_eq!(c1.value(), c2.value());
        assert_eq!(c1, c2);
    }

    #[test]
    fn test_constant_equality() {
        let c1 = Constant::new(0.5).unwrap();
        let c2 = Constant::new(0.5).unwrap();
        let c3 = Constant::new(0.6).unwrap();

        assert_eq!(c1, c2);
        assert_ne!(c1, c3);
    }

    #[test]
    fn test_constant_debug_format() {
        let c = Constant::new(0.5).unwrap();
        let debug_str = format!("{:?}", c);
        assert!(debug_str.contains("0.5"));
    }

    #[test]
    fn test_constant_constants() {
        assert_eq!(Constant::ZERO, 0.0);
        assert_eq!(Constant::ONE, 1.0);
        assert_eq!(Constant::PI, std::f64::consts::PI);
    }
}
