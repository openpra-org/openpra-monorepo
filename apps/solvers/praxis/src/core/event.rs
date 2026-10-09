use crate::core::element::Element;
use crate::expression::Expr;
use crate::Result;

fn keyed_probability_value(id: &str, mut value: Expr) -> Result<Expr> {
    value.assign_draw_keys(&format!("event:{}", id));
    Ok(value)
}

#[derive(Debug, Clone, PartialEq)]
pub struct BasicEvent {
    element: Element,
    probability: f64,
    value: Option<Expr>,
    initiator: bool,
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
            initiator: false,
        })
    }

    pub fn with_value(id: String, probability: f64, value: Expr) -> Result<Self> {
        let mut event = Self::new(id, probability)?;
        event.set_value(Some(value))?;
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

    pub fn is_initiator(&self) -> bool {
        self.initiator
    }

    pub fn set_initiator(&mut self, initiator: bool) {
        self.initiator = initiator;
    }

    pub fn set_value(&mut self, value: Option<Expr>) -> Result<()> {
        self.value = match value {
            Some(value) => Some(keyed_probability_value(self.element.id(), value)?),
            None => None,
        };
        Ok(())
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
    use crate::core::distribution::Law;

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
        let truncated = Law::Truncated {
            law: Box::new(Law::Normal {
                mean: 0.5,
                standard_deviation: 0.1,
            }),
            lower: Some(0.0),
            upper: Some(1.0),
        };
        let event = BasicEvent::with_value("E1".to_string(), 0.5, Expr::draw(truncated)).unwrap();
        assert_eq!(event.probability(), 0.5);
        assert_eq!(event.value().unwrap().draws()[0].0, "event:E1");
    }

    #[test]
    fn test_basic_event_takes_a_law_with_tails_beyond_probability() {
        assert!(BasicEvent::with_value("E1".to_string(), 0.5, Expr::normal(0.5, 0.1)).is_ok());
        assert!(BasicEvent::with_value("E1".to_string(), 0.5, Expr::beta(2.0, 2.0)).is_ok());
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
