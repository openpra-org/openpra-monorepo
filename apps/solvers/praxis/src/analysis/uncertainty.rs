use crate::error::PraxisError;
use crate::mc::stats;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UncertaintyAnalysis {
    mean: f64,

    sigma: f64,

    error_factor: f64,

    confidence_interval: (f64, f64),

    num_samples: usize,

    quantiles: Vec<f64>,
}

impl UncertaintyAnalysis {
    pub fn from_samples(mut samples: Vec<f64>) -> Result<Self, PraxisError> {
        if samples.is_empty() {
            return Err(PraxisError::Logic(
                "Cannot create uncertainty analysis from empty samples".to_string(),
            ));
        }

        for (i, &sample) in samples.iter().enumerate() {
            if !(0.0..=1.0).contains(&sample) {
                return Err(PraxisError::Logic(format!(
                    "Sample {} has invalid probability: {}. Must be in [0,1]",
                    i, sample
                )));
            }
        }

        let num_samples = samples.len();

        let mean = stats::mean(&samples);
        let sigma = stats::std_dev(&samples);

        let (ci_lower, ci_upper) = stats::confidence_interval(&samples, 0.95);

        let error_factor = if mean > 0.0 { ci_upper / mean } else { 1.0 };

        samples.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let quantiles = vec![
            Self::calculate_quantile(&samples, 0.05),
            Self::calculate_quantile(&samples, 0.25),
            Self::calculate_quantile(&samples, 0.50),
            Self::calculate_quantile(&samples, 0.75),
            Self::calculate_quantile(&samples, 0.95),
        ];

        Ok(UncertaintyAnalysis {
            mean,
            sigma,
            error_factor,
            confidence_interval: (ci_lower, ci_upper),
            num_samples,
            quantiles,
        })
    }

    fn calculate_quantile(sorted_samples: &[f64], p: f64) -> f64 {
        if sorted_samples.is_empty() {
            return 0.0;
        }

        let n = sorted_samples.len();
        let index = (p * (n - 1) as f64).floor() as usize;
        let frac = p * (n - 1) as f64 - index as f64;

        if index + 1 < n {
            sorted_samples[index] * (1.0 - frac) + sorted_samples[index + 1] * frac
        } else {
            sorted_samples[index]
        }
    }

    pub fn mean(&self) -> f64 {
        self.mean
    }

    pub fn sigma(&self) -> f64 {
        self.sigma
    }

    pub fn error_factor(&self) -> f64 {
        self.error_factor
    }

    pub fn confidence_interval(&self) -> (f64, f64) {
        self.confidence_interval
    }

    pub fn num_samples(&self) -> usize {
        self.num_samples
    }

    pub fn quantiles(&self) -> &[f64] {
        &self.quantiles
    }

    pub fn median(&self) -> f64 {
        self.quantiles[2]
    }

    pub fn iqr(&self) -> f64 {
        self.quantiles[3] - self.quantiles[1]
    }

    pub fn coefficient_of_variation(&self) -> f64 {
        if self.mean > 0.0 {
            self.sigma / self.mean
        } else {
            f64::INFINITY
        }
    }
}

pub fn propagate_uncertainty(
    fault_tree: &crate::core::fault_tree::FaultTree,
    num_trials: usize,
    seed: Option<u64>,
) -> Result<UncertaintyAnalysis, PraxisError> {
    use crate::expression::EvalContext;
    use crate::mc::prng::initialize_rng;

    if num_trials == 0 {
        return Err(PraxisError::Logic(
            "Number of trials must be greater than zero".to_string(),
        ));
    }

    let mut samples = Vec::with_capacity(num_trials);
    let mut rng = initialize_rng(seed);

    let ctx = EvalContext::new(
        fault_tree.parameters(),
        fault_tree.mission_time(),
        fault_tree.mission_time(),
    );

    for _ in 0..num_trials {
        let mut sampled_ft = fault_tree.clone();

        for (event_id, event) in fault_tree.basic_events() {
            let sampled_prob = event.sample_probability(&ctx, &mut rng);

            if let Some(sampled_event) = sampled_ft.get_basic_event_mut(event_id) {
                let _ = sampled_event.set_probability(sampled_prob);
            }
        }

        let fta = crate::analysis::fault_tree::FaultTreeAnalysis::new(&sampled_ft)
            .map_err(|e| PraxisError::Logic(format!("FTA creation failed: {}", e)))?;

        let result = fta
            .analyze()
            .map_err(|e| PraxisError::Logic(format!("FTA analysis failed: {}", e)))?;

        samples.push(result.top_event_probability);
    }

    UncertaintyAnalysis::from_samples(samples)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uncertainty_analysis_basic() {
        let samples = vec![0.1, 0.12, 0.11, 0.13, 0.12, 0.10, 0.11, 0.12, 0.11, 0.10];
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        assert!((analysis.mean() - 0.112).abs() < 0.01);
        assert!(analysis.sigma() > 0.0);
        assert_eq!(analysis.num_samples(), 10);
    }

    #[test]
    fn test_uncertainty_analysis_empty_samples() {
        let samples: Vec<f64> = vec![];
        let result = UncertaintyAnalysis::from_samples(samples);
        assert!(result.is_err());
    }

    #[test]
    fn test_uncertainty_analysis_invalid_sample() {
        let samples = vec![0.1, 0.2, 1.5, 0.3];
        let result = UncertaintyAnalysis::from_samples(samples);
        assert!(result.is_err());
    }

    #[test]
    fn test_uncertainty_analysis_negative_sample() {
        let samples = vec![0.1, 0.2, -0.1, 0.3];
        let result = UncertaintyAnalysis::from_samples(samples);
        assert!(result.is_err());
    }

    #[test]
    fn test_quantiles() {
        let samples: Vec<f64> = (1..=100).map(|x| x as f64 / 100.0).collect();
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        let quantiles = analysis.quantiles();
        assert_eq!(quantiles.len(), 5);

        assert!((quantiles[0] - 0.05).abs() < 0.02);

        assert!((quantiles[2] - 0.50).abs() < 0.02);
        assert!((analysis.median() - 0.50).abs() < 0.02);

        assert!((quantiles[4] - 0.95).abs() < 0.02);
    }

    #[test]
    fn test_confidence_interval() {
        let samples: Vec<f64> = (1..=100)
            .map(|x| 0.5 + (x as f64 - 50.0) / 1000.0)
            .collect();
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        let (lower, upper) = analysis.confidence_interval();

        assert!(lower <= analysis.mean());
        assert!(upper >= analysis.mean());

        assert!(upper - lower > 0.0);
        assert!(upper - lower < 0.2);
    }

    #[test]
    fn test_error_factor() {
        let samples = vec![0.1, 0.12, 0.11, 0.13, 0.12, 0.10, 0.11, 0.12, 0.11, 0.10];
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        let ef = analysis.error_factor();
        assert!(ef >= 1.0);
        assert!(ef < 2.0);
    }

    #[test]
    fn test_iqr() {
        let samples: Vec<f64> = (1..=100).map(|x| x as f64 / 100.0).collect();
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        let iqr = analysis.iqr();

        assert!((iqr - 0.5).abs() < 0.1);
    }

    #[test]
    fn test_coefficient_of_variation() {
        let samples = vec![0.1, 0.12, 0.11, 0.13, 0.12, 0.10, 0.11, 0.12, 0.11, 0.10];
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        let cv = analysis.coefficient_of_variation();

        assert!(cv > 0.0);
        assert!(cv < 1.0);
    }

    #[test]
    fn test_coefficient_of_variation_zero_mean() {
        let samples = vec![0.0, 0.0, 0.0, 0.0, 0.0];
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        let cv = analysis.coefficient_of_variation();

        assert!(cv.is_infinite());
    }

    #[test]
    fn test_single_sample() {
        let samples = vec![0.5];
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        assert_eq!(analysis.mean(), 0.5);
        assert_eq!(analysis.sigma(), 0.0);
        assert_eq!(analysis.median(), 0.5);
    }

    #[test]
    fn test_uniform_distribution() {
        let samples: Vec<f64> = (0..1000).map(|x| 0.4 + 0.2 * (x as f64 / 1000.0)).collect();
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        assert!((analysis.mean() - 0.5).abs() < 0.01);

        assert!((analysis.sigma() - 0.0577).abs() < 0.01);
    }

    #[test]
    fn test_clone() {
        let samples = vec![0.1, 0.2, 0.3, 0.4, 0.5];
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        let cloned = analysis.clone();

        assert_eq!(analysis.mean(), cloned.mean());
        assert_eq!(analysis.sigma(), cloned.sigma());
        assert_eq!(analysis.num_samples(), cloned.num_samples());
    }

    #[test]
    fn test_high_variance_data() {
        let samples = vec![0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99];
        let analysis = UncertaintyAnalysis::from_samples(samples).unwrap();

        assert!(analysis.sigma() > 0.3);

        assert!(analysis.error_factor() > 1.5);

        assert!(analysis.iqr() > 0.5);
    }

    #[test]
    fn test_propagate_uncertainty_without_distributions() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut ft = FaultTree::new("Test".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let analysis = propagate_uncertainty(&ft, 100, Some(42)).unwrap();

        let expected = 0.28;
        assert!((analysis.mean() - expected).abs() < 0.05);
        assert!(analysis.sigma() < 0.05);
    }

    #[test]
    fn test_propagate_uncertainty_with_distributions() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};
        use crate::expression::Expr;

        let mut ft = FaultTree::new("Test".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();

        ft.add_basic_event(
            BasicEvent::with_value("E1".to_string(), 0.1, Expr::normal(0.1, 0.02)).unwrap(),
        )
        .unwrap();

        ft.add_basic_event(
            BasicEvent::with_value("E2".to_string(), 0.2, Expr::normal(0.2, 0.03)).unwrap(),
        )
        .unwrap();

        let analysis = propagate_uncertainty(&ft, 200, Some(42)).unwrap();

        assert!(analysis.sigma() > 0.01);
        assert!(analysis.mean() > 0.15 && analysis.mean() < 0.35);

        let (lower, upper) = analysis.confidence_interval();
        assert!(lower < analysis.mean());
        assert!(upper > analysis.mean());
    }

    #[test]
    fn test_propagate_uncertainty_uniform_distribution() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};
        use crate::expression::Expr;

        let mut ft = FaultTree::new("Test".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        ft.add_gate(gate).unwrap();

        ft.add_basic_event(
            BasicEvent::with_value("E1".to_string(), 0.5, Expr::uniform(0.4, 0.6)).unwrap(),
        )
        .unwrap();

        let analysis = propagate_uncertainty(&ft, 500, Some(42)).unwrap();

        assert!((analysis.mean() - 0.5).abs() < 0.1);

        assert!(analysis.sigma() > 0.01);
        assert!(analysis.sigma() < 0.1);
    }

    #[test]
    fn test_propagate_uncertainty_zero_trials() {
        use crate::core::fault_tree::FaultTree;

        let ft = FaultTree::new("Test".to_string(), "G1".to_string()).unwrap();

        let result = propagate_uncertainty(&ft, 0, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_propagate_uncertainty_reproducible() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};
        use crate::expression::Expr;

        let mut ft = FaultTree::new("Test".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        ft.add_gate(gate).unwrap();

        ft.add_basic_event(
            BasicEvent::with_value("E1".to_string(), 0.1, Expr::normal(0.1, 0.02)).unwrap(),
        )
        .unwrap();

        let analysis1 = propagate_uncertainty(&ft, 100, Some(123)).unwrap();
        let analysis2 = propagate_uncertainty(&ft, 100, Some(123)).unwrap();

        assert_eq!(analysis1.mean(), analysis2.mean());
        assert_eq!(analysis1.sigma(), analysis2.sigma());
    }
}
