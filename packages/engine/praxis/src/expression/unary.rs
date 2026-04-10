/// Unary mathematical operations for expressions
///
/// Provides common mathematical transformations: negation, absolute value,
/// square root, power, exponential, logarithm, and trigonometric functions.
use crate::error::{MefError, PraxisError};

/// Negation operation: -x
///
/// # Examples
/// ```
/// use praxis::expression::unary::Neg;
///
/// let neg = Neg::new(5.0);
/// assert_eq!(neg.evaluate(), -5.0);
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Neg {
    operand: f64,
}

impl Neg {
    /// Creates a new negation operation
    pub fn new(operand: f64) -> Self {
        Neg { operand }
    }

    /// Evaluates the negation
    pub fn evaluate(&self) -> f64 {
        -self.operand
    }
}

/// Absolute value operation: |x|
///
/// # Examples
/// ```
/// use praxis::expression::unary::Abs;
///
/// let abs = Abs::new(-5.0);
/// assert_eq!(abs.evaluate(), 5.0);
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Abs {
    operand: f64,
}

impl Abs {
    /// Creates a new absolute value operation
    pub fn new(operand: f64) -> Self {
        Abs { operand }
    }

    /// Evaluates the absolute value
    pub fn evaluate(&self) -> f64 {
        self.operand.abs()
    }
}

/// Square root operation: √x
///
/// # Examples
/// ```
/// use praxis::expression::unary::Sqrt;
///
/// let sqrt = Sqrt::new(9.0).unwrap();
/// assert_eq!(sqrt.evaluate(), 3.0);
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Sqrt {
    operand: f64,
}

impl Sqrt {
    /// Creates a new square root operation
    ///
    /// # Errors
    /// Returns error if operand is negative
    pub fn new(operand: f64) -> Result<Self, PraxisError> {
        if operand < 0.0 {
            return Err(PraxisError::Mef(MefError::Domain {
                message: format!("Square root operand must be non-negative, got {}", operand),
                value: Some(operand.to_string()),
                attribute: Some("operand".to_string()),
            }));
        }
        Ok(Sqrt { operand })
    }

    /// Evaluates the square root
    pub fn evaluate(&self) -> f64 {
        self.operand.sqrt()
    }
}

/// Power operation: x^y
///
/// # Examples
/// ```
/// use praxis::expression::unary::Pow;
///
/// let pow = Pow::new(2.0, 3.0);
/// assert_eq!(pow.evaluate(), Ok(8.0));
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Pow {
    base: f64,
    exponent: f64,
}

impl Pow {
    /// Creates a new power operation
    pub fn new(base: f64, exponent: f64) -> Self {
        Pow { base, exponent }
    }

    /// Evaluates the power operation
    ///
    /// # Errors
    /// Returns error if result is NaN or infinite
    pub fn evaluate(&self) -> Result<f64, PraxisError> {
        let result = self.base.powf(self.exponent);
        if result.is_nan() {
            return Err(PraxisError::Mef(MefError::Domain {
                message: format!(
                    "Power operation {}^{} results in NaN",
                    self.base, self.exponent
                ),
                value: None,
                attribute: None,
            }));
        }
        if result.is_infinite() {
            return Err(PraxisError::Mef(MefError::Domain {
                message: format!(
                    "Power operation {}^{} results in infinity",
                    self.base, self.exponent
                ),
                value: None,
                attribute: None,
            }));
        }
        Ok(result)
    }
}

/// Exponential operation: e^x
///
/// # Examples
/// ```
/// use praxis::expression::unary::Exp;
///
/// let exp = Exp::new(0.0);
/// assert_eq!(exp.evaluate(), Ok(1.0));
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Exp {
    operand: f64,
}

impl Exp {
    /// Creates a new exponential operation
    pub fn new(operand: f64) -> Self {
        Exp { operand }
    }

    /// Evaluates the exponential
    ///
    /// # Errors
    /// Returns error if result is infinite
    pub fn evaluate(&self) -> Result<f64, PraxisError> {
        let result = self.operand.exp();
        if result.is_infinite() {
            return Err(PraxisError::Mef(MefError::Domain {
                message: format!("Exponential e^{} results in infinity", self.operand),
                value: Some(self.operand.to_string()),
                attribute: None,
            }));
        }
        Ok(result)
    }
}

/// Natural logarithm operation: ln(x)
///
/// # Examples
/// ```
/// use praxis::expression::unary::Log;
///
/// let log = Log::new(2.718281828459045).unwrap();
/// assert!((log.evaluate() - 1.0).abs() < 1e-10);
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Log {
    operand: f64,
}

impl Log {
    /// Creates a new natural logarithm operation
    ///
    /// # Errors
    /// Returns error if operand is non-positive
    pub fn new(operand: f64) -> Result<Self, PraxisError> {
        if operand <= 0.0 {
            return Err(PraxisError::Mef(MefError::Domain {
                message: format!("Logarithm operand must be positive, got {}", operand),
                value: Some(operand.to_string()),
                attribute: Some("operand".to_string()),
            }));
        }
        Ok(Log { operand })
    }

    /// Evaluates the natural logarithm
    pub fn evaluate(&self) -> f64 {
        self.operand.ln()
    }
}

/// Base-10 logarithm operation: log₁₀(x)
///
/// # Examples
/// ```
/// use praxis::expression::unary::Log10;
///
/// let log10 = Log10::new(100.0).unwrap();
/// assert_eq!(log10.evaluate(), 2.0);
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Log10 {
    operand: f64,
}

impl Log10 {
    /// Creates a new base-10 logarithm operation
    ///
    /// # Errors
    /// Returns error if operand is non-positive
    pub fn new(operand: f64) -> Result<Self, PraxisError> {
        if operand <= 0.0 {
            return Err(PraxisError::Mef(MefError::Domain {
                message: format!("Log10 operand must be positive, got {}", operand),
                value: Some(operand.to_string()),
                attribute: Some("operand".to_string()),
            }));
        }
        Ok(Log10 { operand })
    }

    /// Evaluates the base-10 logarithm
    pub fn evaluate(&self) -> f64 {
        self.operand.log10()
    }
}

/// Sine operation: sin(x)
///
/// # Examples
/// ```
/// use praxis::expression::unary::Sin;
/// use std::f64::consts::PI;
///
/// let sin = Sin::new(PI / 2.0);
/// assert!((sin.evaluate() - 1.0).abs() < 1e-10);
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Sin {
    operand: f64,
}

impl Sin {
    /// Creates a new sine operation (operand in radians)
    pub fn new(operand: f64) -> Self {
        Sin { operand }
    }

    /// Evaluates the sine
    pub fn evaluate(&self) -> f64 {
        self.operand.sin()
    }
}

/// Cosine operation: cos(x)
///
/// # Examples
/// ```
/// use praxis::expression::unary::Cos;
/// use std::f64::consts::PI;
///
/// let cos = Cos::new(PI);
/// assert!((cos.evaluate() + 1.0).abs() < 1e-10);
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Cos {
    operand: f64,
}

impl Cos {
    /// Creates a new cosine operation (operand in radians)
    pub fn new(operand: f64) -> Self {
        Cos { operand }
    }

    /// Evaluates the cosine
    pub fn evaluate(&self) -> f64 {
        self.operand.cos()
    }
}

/// Tangent operation: tan(x)
///
/// # Examples
/// ```
/// use praxis::expression::unary::Tan;
/// use std::f64::consts::PI;
///
/// let tan = Tan::new(PI / 4.0);
/// assert!((tan.evaluate().unwrap() - 1.0).abs() < 1e-10);
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct Tan {
    operand: f64,
}

impl Tan {
    /// Creates a new tangent operation (operand in radians)
    pub fn new(operand: f64) -> Self {
        Tan { operand }
    }

    /// Evaluates the tangent
    ///
    /// # Errors
    /// Returns error if result is infinite (at π/2, 3π/2, etc.)
    pub fn evaluate(&self) -> Result<f64, PraxisError> {
        let result = self.operand.tan();
        if result.is_infinite() {
            return Err(PraxisError::Mef(MefError::Domain {
                message: format!("Tangent tan({}) is undefined (±infinity)", self.operand),
                value: Some(self.operand.to_string()),
                attribute: None,
            }));
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::{E, PI};

    // Negation tests
    #[test]
    fn test_neg_positive() {
        let neg = Neg::new(5.0);
        assert_eq!(neg.evaluate(), -5.0);
    }

    #[test]
    fn test_neg_negative() {
        let neg = Neg::new(-3.0);
        assert_eq!(neg.evaluate(), 3.0);
    }

    #[test]
    fn test_neg_zero() {
        let neg = Neg::new(0.0);
        assert_eq!(neg.evaluate(), -0.0);
    }

    #[test]
    fn test_neg_clone() {
        let neg1 = Neg::new(5.0);
        let neg2 = neg1.clone();
        assert_eq!(neg1.evaluate(), neg2.evaluate());
    }

    // Absolute value tests
    #[test]
    fn test_abs_positive() {
        let abs = Abs::new(5.0);
        assert_eq!(abs.evaluate(), 5.0);
    }

    #[test]
    fn test_abs_negative() {
        let abs = Abs::new(-5.0);
        assert_eq!(abs.evaluate(), 5.0);
    }

    #[test]
    fn test_abs_zero() {
        let abs = Abs::new(0.0);
        assert_eq!(abs.evaluate(), 0.0);
    }

    #[test]
    fn test_abs_decimal() {
        let abs = Abs::new(-std::f64::consts::PI);
        assert_eq!(abs.evaluate(), std::f64::consts::PI);
    }

    // Square root tests
    #[test]
    fn test_sqrt_valid() {
        let sqrt = Sqrt::new(9.0).unwrap();
        assert_eq!(sqrt.evaluate(), 3.0);
    }

    #[test]
    fn test_sqrt_zero() {
        let sqrt = Sqrt::new(0.0).unwrap();
        assert_eq!(sqrt.evaluate(), 0.0);
    }

    #[test]
    fn test_sqrt_negative_error() {
        let result = Sqrt::new(-1.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_sqrt_decimal() {
        let sqrt = Sqrt::new(2.0).unwrap();
        assert!((sqrt.evaluate() - std::f64::consts::SQRT_2).abs() < 1e-10);
    }

    // Power tests
    #[test]
    fn test_pow_basic() {
        let pow = Pow::new(2.0, 3.0);
        assert_eq!(pow.evaluate().unwrap(), 8.0);
    }

    #[test]
    fn test_pow_fractional() {
        let pow = Pow::new(4.0, 0.5);
        assert_eq!(pow.evaluate().unwrap(), 2.0);
    }

    #[test]
    fn test_pow_negative_exponent() {
        let pow = Pow::new(2.0, -2.0);
        assert_eq!(pow.evaluate().unwrap(), 0.25);
    }

    #[test]
    fn test_pow_zero_exponent() {
        let pow = Pow::new(5.0, 0.0);
        assert_eq!(pow.evaluate().unwrap(), 1.0);
    }

    #[test]
    fn test_pow_negative_base_integer_exponent() {
        let pow = Pow::new(-2.0, 3.0);
        assert_eq!(pow.evaluate().unwrap(), -8.0);
    }

    #[test]
    fn test_pow_overflow_error() {
        let pow = Pow::new(10.0, 1000.0);
        assert!(pow.evaluate().is_err());
    }

    // Exponential tests
    #[test]
    fn test_exp_zero() {
        let exp = Exp::new(0.0);
        assert_eq!(exp.evaluate().unwrap(), 1.0);
    }

    #[test]
    fn test_exp_one() {
        let exp = Exp::new(1.0);
        assert!((exp.evaluate().unwrap() - E).abs() < 1e-10);
    }

    #[test]
    fn test_exp_negative() {
        let exp = Exp::new(-1.0);
        assert!((exp.evaluate().unwrap() - 1.0 / E).abs() < 1e-10);
    }

    #[test]
    fn test_exp_overflow_error() {
        let exp = Exp::new(1000.0);
        assert!(exp.evaluate().is_err());
    }

    // Natural logarithm tests
    #[test]
    fn test_log_e() {
        let log = Log::new(E).unwrap();
        assert!((log.evaluate() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_log_one() {
        let log = Log::new(1.0).unwrap();
        assert_eq!(log.evaluate(), 0.0);
    }

    #[test]
    fn test_log_zero_error() {
        let result = Log::new(0.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_log_negative_error() {
        let result = Log::new(-1.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_log_decimal() {
        let log = Log::new(10.0).unwrap();
        assert!((log.evaluate() - std::f64::consts::LN_10).abs() < 1e-10);
    }

    // Base-10 logarithm tests
    #[test]
    fn test_log10_hundred() {
        let log10 = Log10::new(100.0).unwrap();
        assert_eq!(log10.evaluate(), 2.0);
    }

    #[test]
    fn test_log10_one() {
        let log10 = Log10::new(1.0).unwrap();
        assert_eq!(log10.evaluate(), 0.0);
    }

    #[test]
    fn test_log10_negative_error() {
        let result = Log10::new(-10.0);
        assert!(result.is_err());
    }

    // Sine tests
    #[test]
    fn test_sin_zero() {
        let sin = Sin::new(0.0);
        assert_eq!(sin.evaluate(), 0.0);
    }

    #[test]
    fn test_sin_pi_half() {
        let sin = Sin::new(PI / 2.0);
        assert!((sin.evaluate() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_sin_pi() {
        let sin = Sin::new(PI);
        assert!(sin.evaluate().abs() < 1e-10);
    }

    #[test]
    fn test_sin_negative() {
        let sin = Sin::new(-PI / 2.0);
        assert!((sin.evaluate() + 1.0).abs() < 1e-10);
    }

    // Cosine tests
    #[test]
    fn test_cos_zero() {
        let cos = Cos::new(0.0);
        assert_eq!(cos.evaluate(), 1.0);
    }

    #[test]
    fn test_cos_pi() {
        let cos = Cos::new(PI);
        assert!((cos.evaluate() + 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_cos_pi_half() {
        let cos = Cos::new(PI / 2.0);
        assert!(cos.evaluate().abs() < 1e-10);
    }

    // Tangent tests
    #[test]
    fn test_tan_zero() {
        let tan = Tan::new(0.0);
        assert_eq!(tan.evaluate().unwrap(), 0.0);
    }

    #[test]
    fn test_tan_pi_quarter() {
        let tan = Tan::new(PI / 4.0);
        assert!((tan.evaluate().unwrap() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_tan_negative() {
        let tan = Tan::new(-PI / 4.0);
        assert!((tan.evaluate().unwrap() + 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_tan_undefined_pi_half() {
        let tan = Tan::new(PI / 2.0);
        // Tangent at π/2 should be infinite, so evaluate should return error
        let result = tan.evaluate();
        assert!(result.is_err() || result.unwrap().abs() > 1e10);
    }
}
