use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::core::distribution_sampling::{require_probability, SamplingPlan, UncertaintyProgram};
use crate::error::PraxisError;
use crate::mc::stats;

pub const DEFAULT_QUANTILE_PROBABILITIES: [f64; 5] = [0.05, 0.25, 0.5, 0.75, 0.95];

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct QuantileValue {
    pub probability: f64,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UncertaintyAnalysis {
    mean: f64,
    standard_deviation: f64,
    standard_error: f64,
    quantiles: Vec<QuantileValue>,
    samples: Vec<f64>,
}

fn linear_quantile(sorted: &[f64], probability: f64) -> f64 {
    let position = probability * (sorted.len() - 1) as f64;
    let index = position.floor() as usize;
    let fraction = position - index as f64;
    if index + 1 < sorted.len() {
        sorted[index] * (1.0 - fraction) + sorted[index + 1] * fraction
    } else {
        sorted[index]
    }
}

impl UncertaintyAnalysis {
    pub fn from_samples(samples: Vec<f64>) -> Result<Self, PraxisError> {
        Self::from_samples_at(samples, &DEFAULT_QUANTILE_PROBABILITIES)
    }

    pub fn from_samples_at(samples: Vec<f64>, probabilities: &[f64]) -> Result<Self, PraxisError> {
        if samples.is_empty() {
            return Err(PraxisError::Logic(
                "Cannot create uncertainty analysis from empty samples".to_string(),
            ));
        }
        for (index, sample) in samples.iter().enumerate() {
            require_probability("the top event", Some(index), *sample)?;
        }
        if let Some(bad) = probabilities.iter().find(|p| !(0.0..=1.0).contains(*p)) {
            return Err(PraxisError::Settings(format!(
                "quantile probability {} lies outside 0 to 1",
                bad
            )));
        }
        let mean = stats::mean(&samples);
        let standard_deviation = stats::std_dev(&samples);
        let standard_error = standard_deviation / (samples.len() as f64).sqrt();
        let mut sorted = samples.clone();
        sorted.sort_by(|a, b| a.total_cmp(b));
        let quantiles = probabilities
            .iter()
            .map(|probability| QuantileValue {
                probability: *probability,
                value: linear_quantile(&sorted, *probability),
            })
            .collect();
        Ok(UncertaintyAnalysis {
            mean,
            standard_deviation,
            standard_error,
            quantiles,
            samples,
        })
    }

    pub fn mean(&self) -> f64 {
        self.mean
    }

    pub fn standard_deviation(&self) -> f64 {
        self.standard_deviation
    }

    pub fn standard_error(&self) -> f64 {
        self.standard_error
    }

    pub fn num_samples(&self) -> usize {
        self.samples.len()
    }

    pub fn quantiles(&self) -> &[QuantileValue] {
        &self.quantiles
    }

    pub fn quantile(&self, probability: f64) -> Option<f64> {
        self.quantiles
            .iter()
            .find(|quantile| quantile.probability == probability)
            .map(|quantile| quantile.value)
    }

    pub fn samples(&self) -> &[f64] {
        &self.samples
    }
}

pub fn propagate_uncertainty(
    fault_tree: &crate::core::fault_tree::FaultTree,
    plan: &SamplingPlan,
) -> Result<UncertaintyAnalysis, PraxisError> {
    propagate_uncertainty_at(fault_tree, plan, &DEFAULT_QUANTILE_PROBABILITIES)
}

pub fn propagate_uncertainty_at(
    fault_tree: &crate::core::fault_tree::FaultTree,
    plan: &SamplingPlan,
    probabilities: &[f64],
) -> Result<UncertaintyAnalysis, PraxisError> {
    use crate::algorithms::bdd_vectored::probability_vectored;

    if plan.trials == 0 {
        return Err(PraxisError::Logic(
            "Number of trials must be greater than zero".to_string(),
        ));
    }

    let built = crate::algorithms::build::build_bdd(
        fault_tree,
        crate::algorithms::build::BuildOptions::default(),
    )
    .map_err(|e| PraxisError::Logic(format!("BDD construction failed: {}", e)))?;
    let bdd = built.bdd;
    let root = built.root;
    let nominal = bdd.var_probs().to_vec();

    let mut var_pos: HashMap<String, usize> = HashMap::new();
    for event_id in fault_tree.basic_events().keys() {
        if let Some(pos) = built
            .pdag
            .get_index(event_id)
            .and_then(|idx| built.var_of.get(&idx).copied())
        {
            var_pos.insert(event_id.clone(), pos);
        }
    }

    let mut uncertain: Vec<(&String, usize, &crate::expression::Expr)> = fault_tree
        .basic_events()
        .iter()
        .filter_map(|(id, event)| {
            let position = var_pos.get(id)?;
            event.value().map(|value| (id, *position, value))
        })
        .collect();
    uncertain.sort_by(|left, right| left.0.cmp(right.0));

    let program = UncertaintyProgram::from_expressions(
        fault_tree.parameters().clone(),
        fault_tree.mission_time(),
    );
    let checks = fault_tree.probability_checks();
    let targets: Vec<&crate::expression::Expr> = checks
        .iter()
        .map(|(_, check)| check)
        .chain(uncertain.iter().map(|entry| entry.2))
        .collect();
    let mut checked = program.sample(&targets, plan)?;
    let sampled = checked.split_off(checks.len());
    for ((subject, _), column) in checks.iter().zip(&checked) {
        for (trial, value) in column.iter().enumerate() {
            require_probability(subject, Some(trial), *value)?;
        }
    }
    for ((id, _, _), column) in uncertain.iter().zip(&sampled) {
        for (trial, value) in column.iter().enumerate() {
            require_probability(&format!("basic event '{}'", id), Some(trial), *value)?;
        }
    }

    const CHUNK: usize = 4096;
    let mut samples = Vec::with_capacity(plan.trials);
    let mut start = 0;
    while start < plan.trials {
        let chunk = (plan.trials - start).min(CHUNK);
        let mut columns: Vec<Vec<f64>> = nominal.iter().map(|&p| vec![p; chunk]).collect();
        for ((_, position, _), column) in uncertain.iter().zip(&sampled) {
            columns[*position].copy_from_slice(&column[start..start + chunk]);
        }
        samples.extend(probability_vectored(&bdd, root, &columns, chunk));
        start += chunk;
    }

    UncertaintyAnalysis::from_samples_at(samples, probabilities)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::distribution::Law;
    use crate::core::distribution_sampling::SamplingMethod;
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::expression::Expr;

    fn plan(trials: usize, seed: u64) -> SamplingPlan {
        SamplingPlan {
            method: SamplingMethod::MonteCarlo,
            trials,
            seed,
        }
    }

    fn or_tree() -> FaultTree {
        let mut ft = FaultTree::new("Test".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft
    }

    #[test]
    fn summary_statistics_follow_the_samples() {
        let samples = vec![0.1, 0.12, 0.11, 0.13, 0.12, 0.10, 0.11, 0.12, 0.11, 0.10];
        let analysis = UncertaintyAnalysis::from_samples(samples.clone()).unwrap();
        assert!((analysis.mean() - 0.112).abs() < 1e-12);
        assert!(analysis.standard_deviation() > 0.0);
        assert!(
            (analysis.standard_error() - analysis.standard_deviation() / 10f64.sqrt()).abs() < 1e-15
        );
        assert_eq!(analysis.samples(), samples.as_slice());
        assert_eq!(analysis.num_samples(), 10);
    }

    #[test]
    fn rejects_empty_and_out_of_range_samples() {
        assert!(UncertaintyAnalysis::from_samples(vec![]).is_err());
        assert!(UncertaintyAnalysis::from_samples(vec![0.1, 1.5]).is_err());
        assert!(UncertaintyAnalysis::from_samples(vec![0.1, -0.1]).is_err());
    }

    #[test]
    fn quantiles_use_linear_interpolation_at_the_chosen_probabilities() {
        let samples: Vec<f64> = (0..=100).map(|x| x as f64 / 100.0).collect();
        let analysis = UncertaintyAnalysis::from_samples_at(samples, &[0.05, 0.5, 0.99]).unwrap();
        assert!((analysis.quantile(0.05).unwrap() - 0.05).abs() < 1e-12);
        assert!((analysis.quantile(0.5).unwrap() - 0.5).abs() < 1e-12);
        assert!((analysis.quantile(0.99).unwrap() - 0.99).abs() < 1e-12);
        assert!(analysis.quantile(0.25).is_none());
    }

    #[test]
    fn point_values_alone_give_no_spread() {
        let mut ft = or_tree();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();
        let analysis = propagate_uncertainty(&ft, &plan(100, 42)).unwrap();
        assert!((analysis.mean() - 0.28).abs() < 1e-12);
        assert!(analysis.standard_deviation() <= 100.0 * f64::EPSILON * analysis.mean());
    }

    #[test]
    fn one_shared_parameter_moves_every_event_together() {
        let mut ft = or_tree();
        ft.set_parameter("p".to_string(), Expr::uniform(0.0, 0.5));
        ft.add_basic_event(
            BasicEvent::with_value("E1".to_string(), 0.25, Expr::Parameter("p".to_string())).unwrap(),
        )
        .unwrap();
        ft.add_basic_event(
            BasicEvent::with_value("E2".to_string(), 0.25, Expr::Parameter("p".to_string())).unwrap(),
        )
        .unwrap();
        let analysis = propagate_uncertainty(&ft, &plan(2000, 7)).unwrap();
        let expected = 0.5 - 1.0 / 12.0;
        assert!((analysis.mean() - expected).abs() < 5.0 * analysis.standard_error());
    }

    #[test]
    fn the_same_seed_repeats_and_another_seed_differs() {
        let mut ft = or_tree();
        ft.add_basic_event(
            BasicEvent::with_value("E1".to_string(), 0.1, Expr::beta(2.0, 18.0)).unwrap(),
        )
        .unwrap();
        ft.add_basic_event(
            BasicEvent::with_value(
                "E2".to_string(),
                0.2,
                Expr::draw(Law::Truncated {
                    law: Box::new(Law::Normal {
                        mean: 0.2,
                        standard_deviation: 0.03,
                    }),
                    lower: Some(0.0),
                    upper: Some(1.0),
                }),
            )
            .unwrap(),
        )
        .unwrap();
        let first = propagate_uncertainty(&ft, &plan(500, 12345)).unwrap();
        let again = propagate_uncertainty(&ft, &plan(500, 12345)).unwrap();
        let other = propagate_uncertainty(&ft, &plan(500, 54321)).unwrap();
        assert_eq!(first.samples(), again.samples());
        assert_ne!(first.samples(), other.samples());
    }

    #[test]
    fn a_formula_above_one_stops_the_run() {
        let mut ft = or_tree();
        ft.add_basic_event(
            BasicEvent::with_value(
                "E1".to_string(),
                0.5,
                Expr::Mul(vec![Expr::Constant(3.0), Expr::uniform(0.0, 0.4)]),
            )
            .unwrap(),
        )
        .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();
        let error = propagate_uncertainty(&ft, &plan(200, 3)).unwrap_err();
        assert!(error.to_string().contains("basic event 'E1'"));
    }
}
