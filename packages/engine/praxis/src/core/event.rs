// Event types - BasicEvent and HouseEvent
// Converted from mcSCRAM/src/event.cc and mcSCRAM/src/event.h
// Phase 2: T021-T032

use crate::core::element::Element;
use crate::Result;
use rand::Rng;
use rand_distr::{Distribution as RandDistribution, LogNormal, Normal, Uniform};

/// Probability distribution for uncertainty analysis
///
/// Represents different probability distributions that can be assigned
/// to basic events for uncertainty quantification.
#[derive(Debug, Clone, PartialEq)]
pub enum Distribution {
    /// Normal distribution with mean (μ) and standard deviation (σ)
    Normal(f64, f64),

    /// Log-normal distribution with parameters μ and σ
    /// The underlying normal distribution has mean μ and std dev σ
    LogNormal(f64, f64),

    /// Uniform distribution over interval [a, b]
    Uniform(f64, f64),
}

impl Distribution {
    /// Sample a value from this distribution using the provided RNG
    ///
    /// Returns a value clamped to [0, 1] to ensure valid probability
    pub fn sample<R: Rng>(&self, rng: &mut R) -> f64 {
        let value = match self {
            Distribution::Normal(mean, std_dev) => {
                let normal = Normal::new(*mean, *std_dev).unwrap();
                normal.sample(rng)
            }
            Distribution::LogNormal(mu, sigma) => {
                let lognormal = LogNormal::new(*mu, *sigma).unwrap();
                lognormal.sample(rng)
            }
            Distribution::Uniform(a, b) => {
                let uniform = Uniform::new(*a, *b);
                uniform.sample(rng)
            }
        };

        // Clamp to [0, 1] for valid probabilities
        value.clamp(0.0, 1.0)
    }

    /// Returns the mean (expected value) of the distribution
    pub fn mean(&self) -> f64 {
        match self {
            Distribution::Normal(mean, _) => *mean,
            Distribution::LogNormal(mu, sigma) => {
                // For lognormal, E[X] = exp(μ + σ²/2)
                (mu + sigma * sigma / 2.0).exp()
            }
            Distribution::Uniform(a, b) => (a + b) / 2.0,
        }
    }
}

/// BasicEvent represents a probabilistic failure event in a fault tree
/// Corresponds to BasicEvent class in C++
#[derive(Debug, Clone, PartialEq)]
pub struct BasicEvent {
    element: Element,
    probability: f64,
    distribution: Option<Distribution>,
}

impl BasicEvent {
    /// Creates a new BasicEvent with the given id and probability.
    /// Corresponds to BasicEvent constructor in C++ (inherits from Event/Id)
    /// T021: BasicEvent::new() constructor
    ///
    /// # Arguments
    /// * `id` - The unique identifier for the event
    /// * `probability` - The probability value [0.0, 1.0]
    ///
    /// # Errors
    /// * Returns error if id is invalid (via Element::new())
    /// * Returns error if probability is not in [0.0, 1.0]
    ///
    /// # Example
    /// ```
    /// use praxis::core::event::BasicEvent;
    /// let event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
    /// ```
    pub fn new(id: String, probability: f64) -> Result<Self> {
        let element = Element::new(id)?;

        // Validate probability is in valid range [0.0, 1.0]
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
            distribution: None,
        })
    }

    /// Creates a new BasicEvent with an uncertainty distribution
    ///
    /// # Arguments
    /// * `id` - The unique identifier for the event
    /// * `probability` - The nominal (mean) probability value [0.0, 1.0]
    /// * `distribution` - The uncertainty distribution for this event
    ///
    /// # Example
    /// ```
    /// use praxis::core::event::{BasicEvent, Distribution};
    /// let event = BasicEvent::with_distribution(
    ///     "E1".to_string(),
    ///     0.01,
    ///     Distribution::Normal(0.01, 0.002)
    /// ).unwrap();
    /// ```
    pub fn with_distribution(
        id: String,
        probability: f64,
        distribution: Distribution,
    ) -> Result<Self> {
        let mut event = Self::new(id, probability)?;
        event.distribution = Some(distribution);
        Ok(event)
    }

    /// Returns reference to the underlying Element
    /// Provides access to id, name, label
    pub fn element(&self) -> &Element {
        &self.element
    }

    /// Returns mutable reference to the underlying Element
    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    /// Returns the probability value of this basic event
    /// Corresponds to BasicEvent::p() const in C++
    /// T024: BasicEvent::probability() method
    pub fn probability(&self) -> f64 {
        self.probability
    }

    /// Sets the probability value for this basic event
    ///
    /// # Errors
    /// Returns error if probability is not in [0.0, 1.0]
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

    /// Returns the uncertainty distribution if assigned
    pub fn distribution(&self) -> Option<&Distribution> {
        self.distribution.as_ref()
    }

    /// Sets the uncertainty distribution for this event
    pub fn set_distribution(&mut self, distribution: Option<Distribution>) {
        self.distribution = distribution;
    }

    /// Samples a probability value from the distribution (if present)
    /// or returns the nominal probability
    pub fn sample_probability<R: Rng>(&self, rng: &mut R) -> f64 {
        match &self.distribution {
            Some(dist) => dist.sample(rng),
            None => self.probability,
        }
    }
}

/// HouseEvent represents a deterministic event (always true or false)
/// Corresponds to HouseEvent class in C++
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HouseEvent {
    element: Element,
    state: bool,
}

impl HouseEvent {
    /// Creates a new HouseEvent with the given id and state.
    /// Corresponds to HouseEvent constructor in C++
    /// T027: HouseEvent::new() constructor
    ///
    /// # Arguments
    /// * `id` - The unique identifier for the event
    /// * `state` - The boolean state (true/false)
    ///
    /// # Errors
    /// Returns error if id is invalid (via Element::new())
    ///
    /// # Example
    /// ```
    /// use praxis::core::event::HouseEvent;
    /// let event = HouseEvent::new("H1".to_string(), true).unwrap();
    /// ```
    pub fn new(id: String, state: bool) -> Result<Self> {
        let element = Element::new(id)?;
        Ok(HouseEvent { element, state })
    }

    /// Returns reference to the underlying Element
    pub fn element(&self) -> &Element {
        &self.element
    }

    /// Returns mutable reference to the underlying Element
    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    /// Returns the state of this house event (true or false)
    /// Corresponds to HouseEvent::state() const in C++
    /// T030: HouseEvent::state() method
    pub fn state(&self) -> bool {
        self.state
    }

    /// Sets the state for this house event
    /// Corresponds to HouseEvent::state(bool) in C++
    pub fn set_state(&mut self, state: bool) {
        self.state = state;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // T022: Tests for BasicEvent::new()
    #[test]
    fn test_basic_event_new_valid() {
        let event = BasicEvent::new("E1".to_string(), 0.01);
        assert!(event.is_ok());

        let event = event.unwrap();
        assert_eq!(event.element().id(), "E1");
        assert_eq!(event.probability(), 0.01);
    }

    #[test]
    fn test_basic_event_new_zero_probability() {
        let event = BasicEvent::new("E1".to_string(), 0.0).unwrap();
        assert_eq!(event.probability(), 0.0);
    }

    #[test]
    fn test_basic_event_new_one_probability() {
        let event = BasicEvent::new("E1".to_string(), 1.0).unwrap();
        assert_eq!(event.probability(), 1.0);
    }

    #[test]
    fn test_basic_event_new_invalid_probability_negative() {
        let result = BasicEvent::new("E1".to_string(), -0.1);
        assert!(result.is_err());

        match result.unwrap_err() {
            crate::error::PraxisError::Mef(crate::error::MefError::Domain { message, .. }) => {
                assert!(message.contains("between 0.0 and 1.0"));
            }
            _ => panic!("Expected MEF Domain error"),
        }
    }

    #[test]
    fn test_basic_event_new_invalid_probability_over_one() {
        let result = BasicEvent::new("E1".to_string(), 1.5);
        assert!(result.is_err());

        match result.unwrap_err() {
            crate::error::PraxisError::Mef(crate::error::MefError::Domain { .. }) => {}
            _ => panic!("Expected MEF Domain error"),
        }
    }

    #[test]
    fn test_basic_event_element_access() {
        let event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        assert_eq!(event.element().id(), "E1");
        assert_eq!(event.element().name(), None);
        assert_eq!(event.element().label(), None);
    }

    #[test]
    fn test_basic_event_element_mut() {
        let mut event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        event.element_mut().set_name("Event One".to_string());
        event
            .element_mut()
            .set_label(Some("First event".to_string()));

        assert_eq!(event.element().name(), Some("Event One"));
        assert_eq!(event.element().label(), Some("First event"));
    }

    // T025: Tests for BasicEvent::probability()
    #[test]
    fn test_basic_event_probability_getter() {
        let event = BasicEvent::new("E1".to_string(), 0.05).unwrap();
        assert_eq!(event.probability(), 0.05);
    }

    #[test]
    fn test_basic_event_probability_returns_correct_value() {
        let event = BasicEvent::new("E1".to_string(), 0.123).unwrap();
        assert!((event.probability() - 0.123).abs() < 1e-10);
    }

    #[test]
    fn test_basic_event_set_probability_valid() {
        let mut event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        assert!(event.set_probability(0.02).is_ok());
        assert_eq!(event.probability(), 0.02);
    }

    #[test]
    fn test_basic_event_set_probability_invalid() {
        let mut event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        assert!(event.set_probability(1.5).is_err());
        assert!(event.set_probability(-0.1).is_err());
    }

    // T274: Tests for Distribution support
    #[test]
    fn test_basic_event_with_distribution() {
        let event = BasicEvent::with_distribution(
            "E1".to_string(),
            0.01,
            Distribution::Normal(0.01, 0.002),
        )
        .unwrap();

        assert_eq!(event.probability(), 0.01);
        assert!(event.distribution().is_some());
    }

    #[test]
    fn test_basic_event_set_distribution() {
        let mut event = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        assert!(event.distribution().is_none());

        event.set_distribution(Some(Distribution::Normal(0.01, 0.002)));
        assert!(event.distribution().is_some());

        event.set_distribution(None);
        assert!(event.distribution().is_none());
    }

    #[test]
    fn test_distribution_normal_sample() {
        use rand::SeedableRng;
        use rand_chacha::ChaCha8Rng;

        let dist = Distribution::Normal(0.5, 0.1);
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        // Sample multiple times
        for _ in 0..100 {
            let value = dist.sample(&mut rng);
            assert!(
                (0.0..=1.0).contains(&value),
                "Sampled value {} out of range",
                value
            );
        }
    }

    #[test]
    fn test_distribution_lognormal_sample() {
        use rand::SeedableRng;
        use rand_chacha::ChaCha8Rng;

        let dist = Distribution::LogNormal(-3.0, 0.5);
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        // Sample multiple times
        for _ in 0..100 {
            let value = dist.sample(&mut rng);
            assert!(
                (0.0..=1.0).contains(&value),
                "Sampled value {} out of range",
                value
            );
        }
    }

    #[test]
    fn test_distribution_uniform_sample() {
        use rand::SeedableRng;
        use rand_chacha::ChaCha8Rng;

        let dist = Distribution::Uniform(0.1, 0.3);
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        // Sample multiple times
        for _ in 0..100 {
            let value = dist.sample(&mut rng);
            assert!(
                (0.1..=0.3).contains(&value),
                "Sampled value {} out of range",
                value
            );
        }
    }

    #[test]
    fn test_distribution_mean() {
        let normal = Distribution::Normal(0.5, 0.1);
        assert!((normal.mean() - 0.5).abs() < 0.001);

        let uniform = Distribution::Uniform(0.2, 0.8);
        assert!((uniform.mean() - 0.5).abs() < 0.001);

        let lognormal = Distribution::LogNormal(-2.0, 0.5);
        let mean = lognormal.mean();
        assert!(mean > 0.0 && mean < 1.0);
    }

    #[test]
    fn test_basic_event_sample_probability_without_distribution() {
        use rand::SeedableRng;
        use rand_chacha::ChaCha8Rng;

        let event = BasicEvent::new("E1".to_string(), 0.123).unwrap();
        let mut rng = ChaCha8Rng::seed_from_u64(42);

        // Without distribution, should always return nominal probability
        for _ in 0..10 {
            assert_eq!(event.sample_probability(&mut rng), 0.123);
        }
    }

    #[test]
    fn test_basic_event_sample_probability_with_distribution() {
        use rand::SeedableRng;
        use rand_chacha::ChaCha8Rng;

        let event =
            BasicEvent::with_distribution("E1".to_string(), 0.5, Distribution::Normal(0.5, 0.1))
                .unwrap();

        let mut rng = ChaCha8Rng::seed_from_u64(42);

        // With distribution, should sample different values
        let samples: Vec<f64> = (0..100)
            .map(|_| event.sample_probability(&mut rng))
            .collect();

        // Should have some variance
        let mean: f64 = samples.iter().sum::<f64>() / samples.len() as f64;
        let variance: f64 =
            samples.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / samples.len() as f64;

        assert!(variance > 0.001, "Samples should have variance");
        assert!((mean - 0.5).abs() < 0.1, "Mean should be close to 0.5");
    }

    #[test]
    fn test_basic_event_clone() {
        let event1 = BasicEvent::new("E1".to_string(), 0.01).unwrap();
        let event2 = event1.clone();

        assert_eq!(event1.element().id(), event2.element().id());
        assert_eq!(event1.probability(), event2.probability());
    }

    // T028: Tests for HouseEvent::new()
    #[test]
    fn test_house_event_new_true() {
        let event = HouseEvent::new("H1".to_string(), true);
        assert!(event.is_ok());

        let event = event.unwrap();
        assert_eq!(event.element().id(), "H1");
        assert!(event.state());
    }

    #[test]
    fn test_house_event_new_false() {
        let event = HouseEvent::new("H1".to_string(), false).unwrap();
        assert!(!event.state());
    }

    #[test]
    fn test_house_event_new_invalid_id() {
        let result = HouseEvent::new("".to_string(), true);
        assert!(result.is_err());
    }

    #[test]
    fn test_house_event_element_access() {
        let event = HouseEvent::new("H1".to_string(), true).unwrap();
        assert_eq!(event.element().id(), "H1");
        assert_eq!(event.element().name(), None);
        assert_eq!(event.element().label(), None);
    }

    #[test]
    fn test_house_event_element_mut() {
        let mut event = HouseEvent::new("H1".to_string(), true).unwrap();
        event.element_mut().set_name("House Event One".to_string());
        event
            .element_mut()
            .set_label(Some("Deterministic event".to_string()));

        assert_eq!(event.element().name(), Some("House Event One"));
        assert_eq!(event.element().label(), Some("Deterministic event"));
    }

    // T031: Tests for HouseEvent::state()
    #[test]
    fn test_house_event_state_getter_true() {
        let event = HouseEvent::new("H1".to_string(), true).unwrap();
        assert!(event.state());
    }

    #[test]
    fn test_house_event_state_getter_false() {
        let event = HouseEvent::new("H1".to_string(), false).unwrap();
        assert!(!event.state());
    }

    #[test]
    fn test_house_event_set_state() {
        let mut event = HouseEvent::new("H1".to_string(), false).unwrap();
        assert!(!event.state());

        event.set_state(true);
        assert!(event.state());

        event.set_state(false);
        assert!(!event.state());
    }

    #[test]
    fn test_house_event_clone() {
        let event1 = HouseEvent::new("H1".to_string(), true).unwrap();
        let event2 = event1.clone();

        assert_eq!(event1.element().id(), event2.element().id());
        assert_eq!(event1.state(), event2.state());
    }

    #[test]
    fn test_house_event_equality() {
        let event1 = HouseEvent::new("H1".to_string(), true).unwrap();
        let event2 = HouseEvent::new("H1".to_string(), true).unwrap();
        let event3 = HouseEvent::new("H1".to_string(), false).unwrap();
        let event4 = HouseEvent::new("H2".to_string(), true).unwrap();

        assert_eq!(event1, event2);
        assert_ne!(event1, event3);
        assert_ne!(event1, event4);
    }
}
