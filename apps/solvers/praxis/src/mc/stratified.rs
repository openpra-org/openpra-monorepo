use crate::{PraxisError, Result};

const PILOT_SHARE: f64 = 0.1;
const MIN_PILOT_TRIALS: usize = 32;
const MIN_TOTAL_TRIALS: usize = 4;

/// A two stage stratified run. A pilot gives every stratum the same trials, and
/// the rest follow Neyman allocation, proportional to each stratum's weight and
/// estimated standard deviation. The estimate uses only the second stage, so the
/// allocation cannot bias it.
#[derive(Debug, Clone, PartialEq)]
pub struct StratifiedDesign {
    events: Vec<usize>,
    weights: Vec<f64>,
    pilot_trials: usize,
    final_trials: usize,
}

impl StratifiedDesign {
    /// Stratifies on the `requested_events` rarest events that can both occur
    /// and not occur, using fewer when the run is too short to visit every stratum.
    pub fn new(
        event_probabilities: &[f64],
        requested_events: usize,
        total_trials: usize,
    ) -> Result<Self> {
        if total_trials < MIN_TOTAL_TRIALS {
            return Err(PraxisError::Settings(format!(
                "Stratified sampling needs at least {MIN_TOTAL_TRIALS} trials"
            )));
        }
        let mut events: Vec<usize> = (0..event_probabilities.len())
            .filter(|&event| (0.0..1.0).contains(&event_probabilities[event]))
            .filter(|&event| event_probabilities[event] > 0.0)
            .collect();
        events.sort_by(|&left, &right| {
            event_probabilities[left].total_cmp(&event_probabilities[right])
        });
        events.truncate(requested_events);
        while (1usize << events.len()) * 2 > total_trials {
            events.pop();
        }

        let weights = stratum_weights(&events, event_probabilities);
        let active = weights.iter().filter(|&&weight| weight > 0.0).count();
        let most = total_trials / (2 * active);
        let share = (PILOT_SHARE * total_trials as f64) as usize / active;
        let pilot_trials = share.max(MIN_PILOT_TRIALS).min(most).max(1);
        Ok(Self {
            events,
            weights,
            pilot_trials,
            final_trials: total_trials - pilot_trials * active,
        })
    }

    pub fn strata(&self) -> usize {
        self.weights.len()
    }

    pub fn events(&self) -> &[usize] {
        &self.events
    }

    pub fn weight(&self, stratum: usize) -> f64 {
        self.weights[stratum]
    }

    pub fn event_fails(&self, stratum: usize, position: usize) -> bool {
        (stratum >> position) & 1 == 1
    }

    pub fn pilot_trials(&self, stratum: usize) -> usize {
        if self.weights[stratum] > 0.0 {
            self.pilot_trials
        } else {
            0
        }
    }

    /// Distributes the second stage trials from the pilot hit counts. Every
    /// stratum with positive weight receives at least one trial, so none is
    /// silently left out of the estimate.
    pub fn allocate(&self, pilot_successes: &[u64]) -> Vec<usize> {
        let scores: Vec<f64> = self
            .weights
            .iter()
            .zip(pilot_successes)
            .map(|(&weight, &successes)| {
                let p = smoothed_proportion(successes, self.pilot_trials);
                weight * (p * (1.0 - p)).sqrt()
            })
            .collect();
        let active = self.weights.iter().filter(|&&weight| weight > 0.0).count();
        let spare = self.final_trials - active;
        let total: f64 = scores.iter().sum();

        let mut allocation = vec![0usize; scores.len()];
        let mut remainders = Vec::with_capacity(active);
        let mut assigned = 0usize;
        for (stratum, &score) in scores.iter().enumerate() {
            if self.weights[stratum] <= 0.0 {
                continue;
            }
            let quota = spare as f64 * score / total;
            let whole = quota.floor() as usize;
            allocation[stratum] = 1 + whole;
            assigned += whole;
            remainders.push((quota - quota.floor(), stratum));
        }
        remainders.sort_by(|left, right| right.0.total_cmp(&left.0).then(left.1.cmp(&right.1)));
        for &(_, stratum) in remainders.iter().take(spare.saturating_sub(assigned)) {
            allocation[stratum] += 1;
        }
        allocation
    }
}

fn stratum_weights(events: &[usize], event_probabilities: &[f64]) -> Vec<f64> {
    (0..1usize << events.len())
        .map(|stratum| {
            events
                .iter()
                .enumerate()
                .map(|(position, &event)| {
                    let p = event_probabilities[event];
                    if (stratum >> position) & 1 == 1 {
                        p
                    } else {
                        1.0 - p
                    }
                })
                .product()
        })
        .collect()
}

fn smoothed_proportion(successes: u64, trials: usize) -> f64 {
    (successes as f64 + 0.5) / (trials as f64 + 1.0)
}

/// The seed of one sampling draw, which keeps every stratum and stage on its own stream.
pub fn draw_seed(seed: u64, draw: usize) -> u64 {
    seed.wrapping_add(0x9e37_79b9_7f4a_7c15u64.wrapping_mul((draw as u64).wrapping_add(1)))
}

#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct StratifiedEstimate {
    pub probability: f64,
    pub variance: f64,
}

impl StratifiedEstimate {
    pub fn add(&mut self, weight: f64, successes: u64, trials: usize) {
        let n = trials as f64;
        self.probability += weight * successes as f64 / n;
        let p = smoothed_proportion(successes, trials);
        self.variance += weight * weight * p * (1.0 - p) / n;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn design(total: usize) -> StratifiedDesign {
        StratifiedDesign::new(&[0.1, 0.01], 2, total).unwrap()
    }

    #[test]
    fn strata_follow_the_rarest_events_first() {
        let d = design(10_000);
        assert_eq!(d.events(), &[1, 0]);
    }

    #[test]
    fn weights_cover_every_combination_of_the_fixed_events() {
        let d = design(10_000);
        assert_eq!(d.strata(), 4);
        assert!((d.weight(0) - 0.99 * 0.9).abs() < 1e-15);
        assert!((d.weight(1) - 0.01 * 0.9).abs() < 1e-15);
        assert!((d.weight(2) - 0.99 * 0.1).abs() < 1e-15);
        assert!((d.weight(3) - 0.01 * 0.1).abs() < 1e-15);
        assert!(d.event_fails(3, 0) && d.event_fails(3, 1) && !d.event_fails(2, 0));
    }

    #[test]
    fn allocation_spends_exactly_the_requested_trials() {
        for total in [8, 100, 1_000, 1_000_003] {
            let d = design(total);
            let pilots: usize = (0..d.strata()).map(|s| d.pilot_trials(s)).sum();
            let allocated: usize = d.allocate(&[0, 1, 1, 0]).iter().sum();
            assert_eq!(pilots + allocated, total, "{total}");
        }
    }

    #[test]
    fn allocation_follows_weight_times_standard_deviation() {
        let d = design(1_000_000);
        let half = d.pilot_trials(0) as u64 / 2;
        let allocation = d.allocate(&[0, half, 0, half]);
        assert!(allocation[1] > allocation[2], "{allocation:?}");
        assert!(allocation[0] > allocation[3], "{allocation:?}");
    }

    #[test]
    fn events_that_cannot_vary_are_not_stratified() {
        let d = StratifiedDesign::new(&[0.0, 1.0, 0.5], 3, 1_000).unwrap();
        assert_eq!(d.events(), &[2]);
    }

    #[test]
    fn a_model_of_certain_events_runs_as_one_stratum() {
        let d = StratifiedDesign::new(&[0.0, 1.0], 2, 1_000).unwrap();
        assert_eq!(d.strata(), 1);
        assert_eq!(d.pilot_trials(0) + d.allocate(&[0])[0], 1_000);
    }

    #[test]
    fn strata_too_rare_to_represent_get_no_trials() {
        let d = StratifiedDesign::new(&[1e-200, 1e-200], 2, 1_000).unwrap();
        assert_eq!(d.weight(3), 0.0);
        assert_eq!(d.pilot_trials(3), 0);
        let allocation = d.allocate(&[0, 0, 0, 0]);
        assert_eq!(allocation[3], 0);
        assert!(allocation[..3].iter().all(|&trials| trials >= 1));
    }

    #[test]
    fn short_runs_drop_events_instead_of_strata() {
        let d = StratifiedDesign::new(&[0.1, 0.2, 0.3], 3, 8).unwrap();
        assert_eq!(d.events(), &[0, 1]);
        assert!(d.allocate(&[0; 4]).iter().all(|&trials| trials >= 1));
    }

    #[test]
    fn runs_too_short_to_stratify_are_refused() {
        assert!(StratifiedDesign::new(&[0.1], 1, 3).is_err());
    }

    #[test]
    fn every_draw_gets_its_own_seed() {
        assert_ne!(draw_seed(7, 0), draw_seed(7, 1));
        assert_eq!(draw_seed(7, 3), draw_seed(7, 3));
    }

    #[test]
    fn estimate_weights_each_stratum() {
        let mut estimate = StratifiedEstimate::default();
        estimate.add(0.75, 10, 100);
        estimate.add(0.25, 50, 100);
        assert!((estimate.probability - 0.2).abs() < 1e-15);
        assert!(estimate.variance > 0.0);
    }

    #[test]
    fn a_stratum_without_hits_still_adds_variance() {
        let mut estimate = StratifiedEstimate::default();
        estimate.add(1.0, 0, 1_000);
        assert_eq!(estimate.probability, 0.0);
        assert!(estimate.variance > 0.0);
    }
}
