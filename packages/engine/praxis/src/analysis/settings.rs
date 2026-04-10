/// Analysis settings and configuration options
///
/// This module defines configuration options for fault tree analysis,
/// including approximation methods, algorithm selection, and analysis parameters.
use std::fmt;

/// Approximation methods for probability calculation
///
/// Different approximation methods trade accuracy for computational efficiency.
/// Used for large fault trees where exact calculation is computationally expensive.
///
/// # Approximation Types
///
/// - **None**: Exact calculation (no approximation)
/// - **RareEvent**: Assumes event probabilities are small (P(union) ≈ Σ P(events))
/// - **MCUB**: Minimal Cut Upper Bound approximation
/// - **MonteCarlo**: Monte Carlo simulation (statistical sampling)
///
/// # Examples
///
/// ```
/// use praxis::analysis::settings::Approximation;
///
/// let approx = Approximation::RareEvent;
/// assert_eq!(approx.to_string(), "rare-event");
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Approximation {
    /// No approximation - exact calculation
    ///
    /// Computes exact probability using BDD or other exact methods.
    /// Most accurate but computationally expensive for large trees.
    None,

    /// Rare-Event approximation
    ///
    /// Assumes all basic events have small probabilities (typically < 0.1).
    /// Approximates P(A ∪ B) ≈ P(A) + P(B) when P(A) and P(B) are small.
    ///
    /// Formula: P(union of cut sets) ≈ Σ P(individual cut sets)
    ///
    /// **Accuracy**: Good for rare events (P < 0.1), error increases with probability
    /// **Speed**: Very fast - simple summation
    /// **Use case**: Initial screening, systems with rare failures
    RareEvent,

    /// Minimal Cut Upper Bound (MCUB) approximation
    ///
    /// Provides an upper bound on system failure probability using minimal cut sets.
    /// More accurate than rare-event for higher probabilities.
    ///
    /// Formula: P(system) ≤ 1 - ∏(1 - P(cut set))
    ///
    /// **Accuracy**: Upper bound (conservative), good for P < 0.3
    /// **Speed**: Fast - requires minimal cut sets only
    /// **Use case**: Systems with moderate failure probabilities
    Mcub,

    /// Monte Carlo simulation
    ///
    /// Statistical sampling method that simulates system behavior.
    /// Accuracy improves with more samples.
    ///
    /// **Accuracy**: Depends on sample count (typically ±1-5% with 10⁴-10⁶ samples)
    /// **Speed**: Slower for high accuracy, but predictable runtime
    /// **Use case**: Complex systems, non-coherent systems, high confidence needed
    MonteCarlo,
}

impl Approximation {
    /// Get the string representation of the approximation method
    ///
    /// Returns lowercase hyphenated name matching C++ implementation.
    ///
    /// # Examples
    ///
    /// ```
    /// use praxis::analysis::settings::Approximation;
    ///
    /// assert_eq!(Approximation::None.as_str(), "none");
    /// assert_eq!(Approximation::RareEvent.as_str(), "rare-event");
    /// assert_eq!(Approximation::Mcub.as_str(), "mcub");
    /// assert_eq!(Approximation::MonteCarlo.as_str(), "monte-carlo");
    /// ```
    pub fn as_str(&self) -> &'static str {
        match self {
            Approximation::None => "none",
            Approximation::RareEvent => "rare-event",
            Approximation::Mcub => "mcub",
            Approximation::MonteCarlo => "monte-carlo",
        }
    }

    /// Parse approximation method from string
    ///
    /// # Arguments
    /// * `s` - String representation (case-insensitive)
    ///
    /// # Returns
    /// * `Some(Approximation)` - If string is valid
    /// * `None` - If string is not recognized
    ///
    /// # Examples
    ///
    /// ```
    /// use praxis::analysis::settings::Approximation;
    ///
    /// assert_eq!(Approximation::parse("rare-event"), Some(Approximation::RareEvent));
    /// assert_eq!(Approximation::parse("MCUB"), Some(Approximation::Mcub));
    /// assert_eq!(Approximation::parse("invalid"), None);
    /// ```
    pub fn parse(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "none" => Some(Approximation::None),
            "rare-event" | "rareevent" => Some(Approximation::RareEvent),
            "mcub" => Some(Approximation::Mcub),
            "monte-carlo" | "montecarlo" | "mc" => Some(Approximation::MonteCarlo),
            _ => None,
        }
    }

    /// Check if this approximation requires minimal cut sets
    ///
    /// # Returns
    /// * `true` - If approximation needs minimal cut sets
    /// * `false` - Otherwise
    pub fn requires_cut_sets(&self) -> bool {
        matches!(self, Approximation::RareEvent | Approximation::Mcub)
    }

    /// Check if this is an exact method (no approximation)
    pub fn is_exact(&self) -> bool {
        matches!(self, Approximation::None)
    }

    /// Get a description of the approximation method
    pub fn description(&self) -> &'static str {
        match self {
            Approximation::None => "Exact calculation using BDD or other exact methods",
            Approximation::RareEvent => "Rare-event approximation: P(union) ≈ Σ P(cut sets)",
            Approximation::Mcub => "Minimal Cut Upper Bound: Conservative upper bound estimate",
            Approximation::MonteCarlo => "Monte Carlo simulation: Statistical sampling method",
        }
    }
}

impl Default for Approximation {
    /// Default approximation is None (exact calculation)
    fn default() -> Self {
        Approximation::None
    }
}

impl fmt::Display for Approximation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl std::str::FromStr for Approximation {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::parse(s).ok_or_else(|| format!("Invalid approximation method: '{}'", s))
    }
}

/// Analysis settings for fault tree analysis
///
/// Configures analysis behavior including algorithm selection,
/// approximation methods, and computational limits.
#[derive(Debug, Clone, PartialEq)]
pub struct Settings {
    /// Approximation method to use
    pub approximation: Approximation,

    /// Probability calculation algorithm (default: auto-select)
    pub algorithm: Algorithm,

    /// Mission time for time-dependent analysis (seconds)
    pub mission_time: Option<f64>,

    /// Maximum number of products/cut sets to generate (0 = unlimited)
    pub limit_order: usize,

    /// Number of trials for Monte Carlo simulation
    pub num_trials: usize,

    /// Random seed for Monte Carlo (None = use system time)
    pub seed: Option<u64>,

    /// Number of bins for importance measure histograms
    pub num_bins: usize,

    /// Confidence level for uncertainty analysis (0.0-1.0)
    pub confidence_level: f64,
}

impl Settings {
    /// Create new settings with default values
    pub fn new() -> Self {
        Settings {
            approximation: Approximation::None,
            algorithm: Algorithm::Auto,
            mission_time: None,
            limit_order: 0,
            num_trials: 1000,
            seed: None,
            num_bins: 20,
            confidence_level: 0.95,
        }
    }

    /// Set the approximation method
    pub fn with_approximation(mut self, approximation: Approximation) -> Self {
        self.approximation = approximation;
        self
    }

    /// Set the algorithm
    pub fn with_algorithm(mut self, algorithm: Algorithm) -> Self {
        self.algorithm = algorithm;
        self
    }

    /// Set mission time
    pub fn with_mission_time(mut self, time: f64) -> Self {
        self.mission_time = Some(time);
        self
    }

    /// Set limit order (max product order)
    pub fn with_limit_order(mut self, limit: usize) -> Self {
        self.limit_order = limit;
        self
    }

    /// Set number of Monte Carlo trials
    pub fn with_num_trials(mut self, trials: usize) -> Self {
        self.num_trials = trials;
        self
    }

    /// Set random seed
    pub fn with_seed(mut self, seed: u64) -> Self {
        self.seed = Some(seed);
        self
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self::new()
    }
}

/// Algorithm selection for probability calculation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Algorithm {
    /// Automatically select best algorithm based on problem characteristics
    Auto,
    /// Binary Decision Diagram
    Bdd,
    /// Zero-Suppressed Binary Decision Diagram
    Zbdd,
    /// MOCUS (Method of Obtaining Cut Sets)
    Mocus,
    /// Monte Carlo simulation
    MonteCarlo,
}

impl Algorithm {
    pub fn as_str(&self) -> &'static str {
        match self {
            Algorithm::Auto => "auto",
            Algorithm::Bdd => "bdd",
            Algorithm::Zbdd => "zbdd",
            Algorithm::Mocus => "mocus",
            Algorithm::MonteCarlo => "monte-carlo",
        }
    }
}

impl fmt::Display for Algorithm {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn test_approximation_as_str() {
        assert_eq!(Approximation::None.as_str(), "none");
        assert_eq!(Approximation::RareEvent.as_str(), "rare-event");
        assert_eq!(Approximation::Mcub.as_str(), "mcub");
        assert_eq!(Approximation::MonteCarlo.as_str(), "monte-carlo");
    }

    #[test]
    fn test_approximation_parse() {
        assert_eq!(Approximation::parse("none"), Some(Approximation::None));
        assert_eq!(
            Approximation::parse("rare-event"),
            Some(Approximation::RareEvent)
        );
        assert_eq!(
            Approximation::parse("rareevent"),
            Some(Approximation::RareEvent)
        );
        assert_eq!(Approximation::parse("MCUB"), Some(Approximation::Mcub));
        assert_eq!(
            Approximation::parse("monte-carlo"),
            Some(Approximation::MonteCarlo)
        );
        assert_eq!(
            Approximation::parse("montecarlo"),
            Some(Approximation::MonteCarlo)
        );
        assert_eq!(Approximation::parse("mc"), Some(Approximation::MonteCarlo));
        assert_eq!(Approximation::parse("invalid"), None);
    }

    #[test]
    fn test_approximation_from_str() {
        assert_eq!(
            Approximation::from_str("none").unwrap(),
            Approximation::None
        );
        assert_eq!(
            Approximation::from_str("rare-event").unwrap(),
            Approximation::RareEvent
        );
        assert_eq!(
            Approximation::from_str("MCUB").unwrap(),
            Approximation::Mcub
        );
        assert!(Approximation::from_str("invalid").is_err());
    }

    #[test]
    fn test_approximation_display() {
        assert_eq!(format!("{}", Approximation::None), "none");
        assert_eq!(format!("{}", Approximation::RareEvent), "rare-event");
        assert_eq!(format!("{}", Approximation::Mcub), "mcub");
        assert_eq!(format!("{}", Approximation::MonteCarlo), "monte-carlo");
    }

    #[test]
    fn test_approximation_default() {
        assert_eq!(Approximation::default(), Approximation::None);
    }

    #[test]
    fn test_approximation_requires_cut_sets() {
        assert!(!Approximation::None.requires_cut_sets());
        assert!(Approximation::RareEvent.requires_cut_sets());
        assert!(Approximation::Mcub.requires_cut_sets());
        assert!(!Approximation::MonteCarlo.requires_cut_sets());
    }

    #[test]
    fn test_approximation_is_exact() {
        assert!(Approximation::None.is_exact());
        assert!(!Approximation::RareEvent.is_exact());
        assert!(!Approximation::Mcub.is_exact());
        assert!(!Approximation::MonteCarlo.is_exact());
    }

    #[test]
    fn test_approximation_description() {
        assert!(!Approximation::None.description().is_empty());
        assert!(!Approximation::RareEvent.description().is_empty());
        assert!(!Approximation::Mcub.description().is_empty());
        assert!(!Approximation::MonteCarlo.description().is_empty());
    }

    #[test]
    fn test_settings_new() {
        let settings = Settings::new();
        assert_eq!(settings.approximation, Approximation::None);
        assert_eq!(settings.algorithm, Algorithm::Auto);
        assert_eq!(settings.num_trials, 1000);
        assert_eq!(settings.limit_order, 0);
    }

    #[test]
    fn test_settings_with_approximation() {
        let settings = Settings::new().with_approximation(Approximation::RareEvent);
        assert_eq!(settings.approximation, Approximation::RareEvent);
    }

    #[test]
    fn test_settings_with_algorithm() {
        let settings = Settings::new().with_algorithm(Algorithm::Bdd);
        assert_eq!(settings.algorithm, Algorithm::Bdd);
    }

    #[test]
    fn test_settings_with_mission_time() {
        let settings = Settings::new().with_mission_time(100.0);
        assert_eq!(settings.mission_time, Some(100.0));
    }

    #[test]
    fn test_settings_builder() {
        let settings = Settings::new()
            .with_approximation(Approximation::Mcub)
            .with_algorithm(Algorithm::Zbdd)
            .with_num_trials(5000)
            .with_limit_order(10);

        assert_eq!(settings.approximation, Approximation::Mcub);
        assert_eq!(settings.algorithm, Algorithm::Zbdd);
        assert_eq!(settings.num_trials, 5000);
        assert_eq!(settings.limit_order, 10);
    }

    #[test]
    fn test_algorithm_as_str() {
        assert_eq!(Algorithm::Auto.as_str(), "auto");
        assert_eq!(Algorithm::Bdd.as_str(), "bdd");
        assert_eq!(Algorithm::Zbdd.as_str(), "zbdd");
        assert_eq!(Algorithm::Mocus.as_str(), "mocus");
        assert_eq!(Algorithm::MonteCarlo.as_str(), "monte-carlo");
    }

    #[test]
    fn test_algorithm_display() {
        assert_eq!(format!("{}", Algorithm::Auto), "auto");
        assert_eq!(format!("{}", Algorithm::Bdd), "bdd");
    }
}
