use crate::core::element::Element;
use crate::expression::{EvalContext, Expr};
use crate::Result;
use rand::Rng;

#[derive(Debug, Clone, PartialEq)]
pub struct BasicEvent {
    element: Element,
    probability: f64,
    value: Option<Expr>,
}

impl BasicEvent {
    pub fn new(id: String, probability: f64) -> Result<Self> {
        let element = Element::new(id)?;

        if !(0.0..=1.0).contains(&probability) {
            return Err(crate::error::PraxisError::Mef(
                crate::error::MefError::Domain {
                    message: "Probability must be between 0.0 and 1.0".to_string(),
                    value: Some(probability.to_string()),
                    attribute: Some("probability".to_string()),
                },
            ));
        }

        Ok(BasicEvent {
            element,
            probability,
            value: None,
        })
    }

    pub fn with_value(id: String, probability: f64, value: Expr) -> Result<Self> {
        let mut event = Self::new(id, probability)?;
        event.value = Some(value);
        Ok(event)
    }

    pub fn element(&self) -> &Element {
        &self.element
    }

    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    pub fn probability(&self) -> f64 {
        self.probability
    }

    pub fn set_probability(&mut self, probability: f64) -> Result<()> {
        if !(0.0..=1.0).contains(&probability) {
            return Err(crate::error::PraxisError::Mef(
                crate::error::MefError::Domain {
                    message: "Probability must be between 0.0 and 1.0".to_string(),
                    value: Some(probability.to_string()),
                    attribute: Some("probability".to_string()),
                },
            ));
        }
        self.probability = probability;
        Ok(())
    }

    pub fn value(&self) -> Option<&Expr> {
        self.value.as_ref()
    }

    pub fn set_value(&mut self, value: Option<Expr>) {
        self.value = value;
    }

    pub fn sample_probability<R: Rng>(&self, ctx: &EvalContext, rng: &mut R) -> f64 {
        match &self.value {
            Some(expr) => expr
                .sample(ctx, rng)
                .unwrap_or(self.probability)
                .clamp(0.0, 1.0),
            None => self.probability,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HouseEvent {
    element: Element,
    state: bool,
}

impl HouseEvent {
    pub fn new(id: String, state: bool) -> Result<Self> {
        let element = Element::new(id)?;
        Ok(HouseEvent { element, state })
    }

    pub fn element(&self) -> &Element {
        &self.element
    }

    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    pub fn state(&self) -> bool {
        self.state
    }

    pub fn set_state(&mut self, state: bool) {
        self.state = state;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand_chacha::ChaCha8Rng;
    use std::collections::HashMap;

    fn b(expr: Expr) -> Box<Expr> {
        Box::new(expr)
    }

    #[test]
    fn test_basic_event_new_valid() {
        let event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        assert_eq!(event.element().id(), "E1");
        assert_eq!(event.probability(), 0.01);
        assert!(event.value().is_none());
    }

    #[test]
    fn test_basic_event_new_bounds() {
        assert!(BasicEvent::new("E1".to_string(), 0.0).is_ok());
        assert!(BasicEvent::new("E1".to_string(), 1.0).is_ok());
        assert!(BasicEvent::new("E1".to_string(), -0.1).is_err());
        assert!(BasicEvent::new("E1".to_string(), 1.5).is_err());
    }

    #[test]
    fn test_basic_event_set_probability() {
        let mut event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        assert!(event.set_probability(0.02).is_ok());
        assert_eq!(event.probability(), 0.02);
        assert!(event.set_probability(1.5).is_err());
    }

    #[test]
    fn test_basic_event_with_value() {
        let event = BasicEvent::with_value(
            "E1".to_string(),
            0.5,
            Expr::NormalDeviate {
                mean: b(Expr::Constant(0.5)),
                sigma: b(Expr::Constant(0.1)),
            },
        )
        .unwrap();
        assert_eq!(event.probability(), 0.5);
        assert!(event.value().is_some());
    }

    #[test]
    fn test_sample_probability_without_value_is_nominal() {
        let params = HashMap::new();
        let ctx = EvalContext::new(&params, 1.0, 1.0);
        let event = BasicEvent::new("E1".to_string(), 0.123).unwrap();
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        for _ in 0..10 {
            assert_eq!(event.sample_probability(&ctx, &mut rng), 0.123);
        }
    }

    #[test]
    fn test_sample_probability_with_value_varies_around_mean() {
        let params = HashMap::new();
        let ctx = EvalContext::new(&params, 1.0, 1.0);
        let event = BasicEvent::with_value(
            "E1".to_string(),
            0.5,
            Expr::NormalDeviate {
                mean: b(Expr::Constant(0.5)),
                sigma: b(Expr::Constant(0.1)),
            },
        )
        .unwrap();
        let mut rng = ChaCha8Rng::seed_from_u64(42);
        let samples: Vec<f64> = (0..1000)
            .map(|_| event.sample_probability(&ctx, &mut rng))
            .collect();
        for value in &samples {
            assert!((0.0..=1.0).contains(value));
        }
        let mean: f64 = samples.iter().sum::<f64>() / samples.len() as f64;
        assert!((mean - 0.5).abs() < 0.05);
    }

    #[test]
    fn test_house_event() {
        let event = HouseEvent::new("H1".to_string(), true).unwrap();
        assert_eq!(event.element().id(), "H1");
        assert!(event.state());
        assert!(HouseEvent::new("".to_string(), true).is_err());

        let mut event = HouseEvent::new("H2".to_string(), false).unwrap();
        assert!(!event.state());
        event.set_state(true);
        assert!(event.state());
    }
}
