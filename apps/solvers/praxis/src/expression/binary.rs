/// Binary operations for arithmetic expressions
///
/// Provides basic arithmetic operations (Add, Multiply, Divide, Subtract)
/// that operate on two operand values.
use crate::Result;

/// Addition operation: left + right
#[derive(Debug, Clone, PartialEq)]
pub struct Add {
    left: f64,
    right: f64,
}

impl Add {
    /// Create a new addition operation
    ///
    /// # Arguments
    /// * `left` - Left operand
    /// * `right` - Right operand
    ///
    /// # Returns
    /// * `Ok(Add)` - Successfully created addition operation
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::binary::Add;
    ///
    /// let add = Add::new(5.0, 3.0).unwrap();
    /// assert_eq!(add.evaluate(), 8.0);
    /// ```
    pub fn new(left: f64, right: f64) -> Result<Self> {
        Ok(Add { left, right })
    }

    /// Evaluate the addition operation
    ///
    /// # Returns
    /// The sum of left and right operands
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::binary::Add;
    ///
    /// let add = Add::new(5.0, 3.0).unwrap();
    /// assert_eq!(add.evaluate(), 8.0);
    /// ```
    pub fn evaluate(&self) -> f64 {
        self.left + self.right
    }

    /// Get the left operand
    pub fn left(&self) -> f64 {
        self.left
    }

    /// Get the right operand
    pub fn right(&self) -> f64 {
        self.right
    }
}

/// Multiplication operation: left * right
#[derive(Debug, Clone, PartialEq)]
pub struct Multiply {
    left: f64,
    right: f64,
}

impl Multiply {
    /// Create a new multiplication operation
    ///
    /// # Arguments
    /// * `left` - Left operand
    /// * `right` - Right operand
    ///
    /// # Returns
    /// * `Ok(Multiply)` - Successfully created multiplication operation
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::binary::Multiply;
    ///
    /// let mul = Multiply::new(4.0, 3.0).unwrap();
    /// assert_eq!(mul.evaluate(), 12.0);
    /// ```
    pub fn new(left: f64, right: f64) -> Result<Self> {
        Ok(Multiply { left, right })
    }

    /// Evaluate the multiplication operation
    ///
    /// # Returns
    /// The product of left and right operands
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::binary::Multiply;
    ///
    /// let mul = Multiply::new(4.0, 3.0).unwrap();
    /// assert_eq!(mul.evaluate(), 12.0);
    /// ```
    pub fn evaluate(&self) -> f64 {
        self.left * self.right
    }

    /// Get the left operand
    pub fn left(&self) -> f64 {
        self.left
    }

    /// Get the right operand
    pub fn right(&self) -> f64 {
        self.right
    }
}

/// Division operation: left / right
#[derive(Debug, Clone, PartialEq)]
pub struct Divide {
    left: f64,
    right: f64,
}

impl Divide {
    /// Create a new division operation
    ///
    /// # Arguments
    /// * `left` - Left operand (dividend)
    /// * `right` - Right operand (divisor)
    ///
    /// # Returns
    /// * `Ok(Divide)` - Successfully created division operation
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::binary::Divide;
    ///
    /// let div = Divide::new(10.0, 2.0).unwrap();
    /// assert_eq!(div.evaluate(), 5.0);
    /// ```
    pub fn new(left: f64, right: f64) -> Result<Self> {
        Ok(Divide { left, right })
    }

    /// Evaluate the division operation
    ///
    /// # Returns
    /// The quotient of left divided by right
    ///
    /// # Note
    /// Division by zero will return infinity or NaN according to IEEE 754
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::binary::Divide;
    ///
    /// let div = Divide::new(10.0, 2.0).unwrap();
    /// assert_eq!(div.evaluate(), 5.0);
    /// ```
    pub fn evaluate(&self) -> f64 {
        self.left / self.right
    }

    /// Get the left operand
    pub fn left(&self) -> f64 {
        self.left
    }

    /// Get the right operand
    pub fn right(&self) -> f64 {
        self.right
    }
}

/// Subtraction operation: left - right
#[derive(Debug, Clone, PartialEq)]
pub struct Subtract {
    left: f64,
    right: f64,
}

impl Subtract {
    /// Create a new subtraction operation
    ///
    /// # Arguments
    /// * `left` - Left operand (minuend)
    /// * `right` - Right operand (subtrahend)
    ///
    /// # Returns
    /// * `Ok(Subtract)` - Successfully created subtraction operation
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::binary::Subtract;
    ///
    /// let sub = Subtract::new(7.0, 3.0).unwrap();
    /// assert_eq!(sub.evaluate(), 4.0);
    /// ```
    pub fn new(left: f64, right: f64) -> Result<Self> {
        Ok(Subtract { left, right })
    }

    /// Evaluate the subtraction operation
    ///
    /// # Returns
    /// The difference of left minus right
    ///
    /// # Examples
    /// ```
    /// use praxis::expression::binary::Subtract;
    ///
    /// let sub = Subtract::new(7.0, 3.0).unwrap();
    /// assert_eq!(sub.evaluate(), 4.0);
    /// ```
    pub fn evaluate(&self) -> f64 {
        self.left - self.right
    }

    /// Get the left operand
    pub fn left(&self) -> f64 {
        self.left
    }

    /// Get the right operand
    pub fn right(&self) -> f64 {
        self.right
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // T081-T083: Add::new() tests
    #[test]
    fn test_add_new_basic() {
        let add = Add::new(5.0, 3.0).unwrap();
        assert_eq!(add.left(), 5.0);
        assert_eq!(add.right(), 3.0);
    }

    #[test]
    fn test_add_new_zero() {
        let add = Add::new(0.0, 0.0).unwrap();
        assert_eq!(add.left(), 0.0);
        assert_eq!(add.right(), 0.0);
    }

    #[test]
    fn test_add_new_negative() {
        let add = Add::new(-5.0, -3.0).unwrap();
        assert_eq!(add.left(), -5.0);
        assert_eq!(add.right(), -3.0);
    }

    // T084-T086: Add::evaluate() tests
    #[test]
    fn test_add_evaluate_basic() {
        let add = Add::new(5.0, 3.0).unwrap();
        assert_eq!(add.evaluate(), 8.0);
    }

    #[test]
    fn test_add_evaluate_zero() {
        let add = Add::new(5.0, 0.0).unwrap();
        assert_eq!(add.evaluate(), 5.0);
    }

    #[test]
    fn test_add_evaluate_negative() {
        let add = Add::new(-5.0, 3.0).unwrap();
        assert_eq!(add.evaluate(), -2.0);
    }

    #[test]
    fn test_add_evaluate_decimals() {
        let add = Add::new(0.1, 0.2).unwrap();
        assert!((add.evaluate() - 0.3).abs() < 1e-10);
    }

    #[test]
    fn test_add_evaluate_large_numbers() {
        let add = Add::new(1e10, 2e10).unwrap();
        assert_eq!(add.evaluate(), 3e10);
    }

    // T087-T089: Multiply::evaluate() tests
    #[test]
    fn test_multiply_new_basic() {
        let mul = Multiply::new(4.0, 3.0).unwrap();
        assert_eq!(mul.left(), 4.0);
        assert_eq!(mul.right(), 3.0);
    }

    #[test]
    fn test_multiply_evaluate_basic() {
        let mul = Multiply::new(4.0, 3.0).unwrap();
        assert_eq!(mul.evaluate(), 12.0);
    }

    #[test]
    fn test_multiply_evaluate_zero() {
        let mul = Multiply::new(5.0, 0.0).unwrap();
        assert_eq!(mul.evaluate(), 0.0);
    }

    #[test]
    fn test_multiply_evaluate_negative() {
        let mul = Multiply::new(-4.0, 3.0).unwrap();
        assert_eq!(mul.evaluate(), -12.0);
    }

    #[test]
    fn test_multiply_evaluate_decimals() {
        let mul = Multiply::new(0.5, 0.4).unwrap();
        assert!((mul.evaluate() - 0.2).abs() < 1e-10);
    }

    #[test]
    fn test_multiply_evaluate_probabilities() {
        let mul = Multiply::new(0.9, 0.8).unwrap();
        assert!((mul.evaluate() - 0.72).abs() < 1e-10);
    }

    // T090-T092: Divide::evaluate() tests
    #[test]
    fn test_divide_new_basic() {
        let div = Divide::new(10.0, 2.0).unwrap();
        assert_eq!(div.left(), 10.0);
        assert_eq!(div.right(), 2.0);
    }

    #[test]
    fn test_divide_evaluate_basic() {
        let div = Divide::new(10.0, 2.0).unwrap();
        assert_eq!(div.evaluate(), 5.0);
    }

    #[test]
    fn test_divide_evaluate_one() {
        let div = Divide::new(5.0, 1.0).unwrap();
        assert_eq!(div.evaluate(), 5.0);
    }

    #[test]
    fn test_divide_evaluate_same_numbers() {
        let div = Divide::new(7.0, 7.0).unwrap();
        assert_eq!(div.evaluate(), 1.0);
    }

    #[test]
    fn test_divide_evaluate_decimals() {
        let div = Divide::new(1.0, 4.0).unwrap();
        assert_eq!(div.evaluate(), 0.25);
    }

    #[test]
    fn test_divide_evaluate_by_zero() {
        let div = Divide::new(10.0, 0.0).unwrap();
        assert!(div.evaluate().is_infinite());
    }

    #[test]
    fn test_divide_evaluate_negative() {
        let div = Divide::new(-10.0, 2.0).unwrap();
        assert_eq!(div.evaluate(), -5.0);
    }

    // T093-T095: Subtract::evaluate() tests
    #[test]
    fn test_subtract_new_basic() {
        let sub = Subtract::new(7.0, 3.0).unwrap();
        assert_eq!(sub.left(), 7.0);
        assert_eq!(sub.right(), 3.0);
    }

    #[test]
    fn test_subtract_evaluate_basic() {
        let sub = Subtract::new(7.0, 3.0).unwrap();
        assert_eq!(sub.evaluate(), 4.0);
    }

    #[test]
    fn test_subtract_evaluate_zero() {
        let sub = Subtract::new(5.0, 0.0).unwrap();
        assert_eq!(sub.evaluate(), 5.0);
    }

    #[test]
    fn test_subtract_evaluate_same_numbers() {
        let sub = Subtract::new(5.0, 5.0).unwrap();
        assert_eq!(sub.evaluate(), 0.0);
    }

    #[test]
    fn test_subtract_evaluate_negative_result() {
        let sub = Subtract::new(3.0, 7.0).unwrap();
        assert_eq!(sub.evaluate(), -4.0);
    }

    #[test]
    fn test_subtract_evaluate_decimals() {
        let sub = Subtract::new(0.5, 0.2).unwrap();
        assert!((sub.evaluate() - 0.3).abs() < 1e-10);
    }

    #[test]
    fn test_subtract_evaluate_negative_operands() {
        let sub = Subtract::new(-5.0, -3.0).unwrap();
        assert_eq!(sub.evaluate(), -2.0);
    }

    // Additional tests for completeness
    #[test]
    fn test_operations_clone() {
        let add = Add::new(1.0, 2.0).unwrap();
        let cloned = add.clone();
        assert_eq!(add, cloned);

        let mul = Multiply::new(3.0, 4.0).unwrap();
        let cloned = mul.clone();
        assert_eq!(mul, cloned);
    }

    #[test]
    fn test_operations_debug() {
        let add = Add::new(1.0, 2.0).unwrap();
        let debug = format!("{:?}", add);
        assert!(debug.contains("Add"));

        let mul = Multiply::new(3.0, 4.0).unwrap();
        let debug = format!("{:?}", mul);
        assert!(debug.contains("Multiply"));
    }

    #[test]
    fn test_operations_equality() {
        let add1 = Add::new(5.0, 3.0).unwrap();
        let add2 = Add::new(5.0, 3.0).unwrap();
        let add3 = Add::new(5.0, 4.0).unwrap();

        assert_eq!(add1, add2);
        assert_ne!(add1, add3);
    }

    #[test]
    fn test_complex_calculation() {
        // (5 + 3) * 2 = 16
        let add = Add::new(5.0, 3.0).unwrap();
        let result = add.evaluate();
        let mul = Multiply::new(result, 2.0).unwrap();
        assert_eq!(mul.evaluate(), 16.0);
    }

    #[test]
    fn test_probability_calculations() {
        // P(A and B) = P(A) * P(B) for independent events
        let mul = Multiply::new(0.1, 0.2).unwrap();
        assert!((mul.evaluate() - 0.02).abs() < 1e-10);

        // P(A or B) = P(A) + P(B) - P(A and B) (simplified for disjoint)
        let add = Add::new(0.1, 0.2).unwrap();
        assert!((add.evaluate() - 0.3).abs() < 1e-10);
    }
}
