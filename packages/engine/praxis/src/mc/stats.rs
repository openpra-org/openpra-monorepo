use statrs::distribution::{Beta, ContinuousCDF, Normal};

const P_MIN_DEFAULT: f64 = 1.0e-12;

pub fn mean(samples: &[f64]) -> f64 {
    if samples.is_empty() {
        return 0.0;
    }
    samples.iter().sum::<f64>() / samples.len() as f64
}

pub fn variance(samples: &[f64]) -> f64 {
    if samples.len() < 2 {
        return 0.0;
    }

    let m = mean(samples);
    let sum_sq_diff: f64 = samples.iter().map(|&x| (x - m).powi(2)).sum();

    sum_sq_diff / (samples.len() - 1) as f64
}

pub fn std_dev(samples: &[f64]) -> f64 {
    variance(samples).sqrt()
}

pub fn confidence_interval(samples: &[f64], confidence: f64) -> (f64, f64) {
    if samples.is_empty() {
        return (0.0, 0.0);
    }

    let m = mean(samples);

    if samples.len() == 1 {
        return (m, m);
    }

    let std_err = std_dev(samples) / (samples.len() as f64).sqrt();

    let z_score = match confidence {
        c if (c - 0.90).abs() < 0.01 => 1.645,
        c if (c - 0.95).abs() < 0.01 => 1.96,
        c if (c - 0.99).abs() < 0.01 => 2.576,
        _ => {
            1.96
        }
    };

    let margin = z_score * std_err;
    (m - margin, m + margin)
}

fn clamp01(x: f64) -> f64 {
    if x.is_nan() {
        return 0.0;
    }
    x.clamp(0.0, 1.0)
}

pub fn normal_quantile_two_sided(confidence: f64) -> Option<f64> {
    if !(confidence.is_finite() && confidence > 0.0 && confidence < 1.0) {
        return None;
    }
    let q = 1.0 - (1.0 - confidence) / 2.0;
    let n01 = Normal::new(0.0, 1.0).ok()?;
    Some(n01.inverse_cdf(q))
}

pub fn half_width_wald(p_hat: f64, n: u64, z: f64) -> Option<f64> {
    if n == 0 || !z.is_finite() {
        return None;
    }
    let p = clamp01(p_hat);
    let n_f = n as f64;
    let se = (p * (1.0 - p) / n_f).sqrt();
    Some(z.abs() * se)
}

pub fn half_width_log10_wald(p_hat: f64, n: u64, z: f64, p_min: f64) -> Option<f64> {
    if n == 0 || !z.is_finite() {
        return None;
    }
    let p = clamp01(p_hat).max(if p_min.is_finite() { p_min } else { P_MIN_DEFAULT });
    let eps = half_width_wald(p, n, z)?;
    Some(eps / (p * std::f64::consts::LN_10))
}

pub fn should_stop_convergence_wald_linear_and_log10(
    p_hat: f64,
    n: u64,
    delta: f64,
    confidence: f64,
    burn_in: u64,
) -> bool {
    if n < burn_in {
        return false;
    }
    if !(delta.is_finite() && delta > 0.0) {
        return false;
    }

    let z = match normal_quantile_two_sided(confidence) {
        Some(z) if z.is_finite() => z,
        _ => return false,
    };

    let p = clamp01(p_hat);
    let target_eps_linear = delta * p.max(P_MIN_DEFAULT);
    let eps_linear = match half_width_wald(p, n, z) {
        Some(e) => e,
        None => return false,
    };

    if !(eps_linear > 0.0 && eps_linear <= target_eps_linear) {
        return false;
    }

    let eps_log = match half_width_log10_wald(p, n, z, P_MIN_DEFAULT) {
        Some(e) => e,
        None => return false,
    };

    eps_log > 0.0 && eps_log <= delta
}

pub fn ci_wald(p_hat: f64, n: u64) -> (f64, f64) {
    ci_wald_z(p_hat, n, 1.96)
}

pub fn ci_wald_z(p_hat: f64, n: u64, z: f64) -> (f64, f64) {
    if n == 0 {
        return (0.0, 1.0);
    }

    let p = clamp01(p_hat);
    let n_f = n as f64;
    let se = (p * (1.0 - p) / n_f).sqrt();
    let margin = z.abs() * se;

    (clamp01(p - margin), clamp01(p + margin))
}

pub fn relative_half_width_wald(p_hat: f64, n: u64, z: f64) -> Option<f64> {
    if n == 0 {
        return None;
    }

    let p = clamp01(p_hat);
    if p == 0.0 {
        return None;
    }

    let n_f = n as f64;
    let se = (p * (1.0 - p) / n_f).sqrt();
    let margin = z.abs() * se;
    Some(margin / p)
}

pub fn should_stop_relative_half_width_wald(
    p_hat: f64,
    n: u64,
    target_rhw: f64,
    min_n: u64,
) -> bool {
    if n < min_n {
        return false;
    }
    if !(target_rhw.is_finite() && target_rhw > 0.0) {
        return false;
    }

    match relative_half_width_wald(p_hat, n, 1.96) {
        Some(rhw) => rhw <= target_rhw,
        None => false,
    }
}

pub fn jeffreys_posterior_mean(successes: u64, trials: u64) -> Option<f64> {
    if successes > trials {
        return None;
    }
    let s = successes as f64;
    let n = trials as f64;
    Some((s + 0.5) / (n + 1.0))
}

pub fn jeffreys_credible_interval(
    successes: u64,
    trials: u64,
    cred_mass: f64,
) -> Option<(f64, f64)> {
    if successes > trials {
        return None;
    }
    if !(cred_mass.is_finite() && cred_mass > 0.0 && cred_mass < 1.0) {
        return None;
    }

    let alpha = (successes as f64) + 0.5;
    let beta = ((trials - successes) as f64) + 0.5;

    let dist = Beta::new(alpha, beta).ok()?;
    let tail = (1.0 - cred_mass) / 2.0;
    let lo = dist.inverse_cdf(tail);
    let hi = dist.inverse_cdf(1.0 - tail);

    Some((clamp01(lo), clamp01(hi)))
}

pub fn clopper_pearson_upper_bound(
    successes: u64,
    trials: u64,
    confidence: f64,
) -> Option<f64> {
    if successes > trials {
        return None;
    }
    if trials == 0 {
        return None;
    }
    if !(confidence.is_finite() && confidence > 0.0 && confidence < 1.0) {
        return None;
    }
    if successes == trials {
        return Some(1.0);
    }

    let alpha = (successes + 1) as f64;
    let beta = (trials - successes) as f64;
    let dist = Beta::new(alpha, beta).ok()?;
    Some(clamp01(dist.inverse_cdf(confidence)))
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ProportionStats {
    pub p_hat: f64,
    pub ci_low: f64,
    pub ci_high: f64,
}

pub fn proportion_stats_from_tally(successes: u64, trials: u64) -> ProportionStats {
    let p_hat = if trials == 0 {
        0.0
    } else {
        (successes as f64) / (trials as f64)
    };
    let (ci_low, ci_high) = ci_wald(p_hat, trials);
    ProportionStats {
        p_hat,
        ci_low,
        ci_high,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RefreshCadence {
    pub every: u64,
}

impl RefreshCadence {
    pub fn should_refresh(&self, step: u64) -> bool {
        self.every != 0 && step != 0 && step.is_multiple_of(self.every)
    }
}

#[derive(Debug, Clone)]
pub struct StatsRefresher {
    cadence: RefreshCadence,
    last_step: u64,
    last: Option<ProportionStats>,
}

impl StatsRefresher {
    pub fn new(cadence: RefreshCadence) -> Self {
        Self {
            cadence,
            last_step: 0,
            last: None,
        }
    }

    pub fn last_step(&self) -> u64 {
        self.last_step
    }

    pub fn last(&self) -> Option<ProportionStats> {
        self.last
    }

    pub fn update(&mut self, step: u64, successes: u64, trials: u64, force: bool) -> bool {
        if force || self.cadence.should_refresh(step) {
            self.last = Some(proportion_stats_from_tally(successes, trials));
            self.last_step = step;
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mean_basic() {
        let samples = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let m = mean(&samples);
        assert!((m - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_mean_empty() {
        let samples: Vec<f64> = vec![];
        let m = mean(&samples);
        assert_eq!(m, 0.0);
    }

    #[test]
    fn test_mean_single() {
        let samples = vec![42.0];
        let m = mean(&samples);
        assert!((m - 42.0).abs() < 1e-10);
    }

    #[test]
    fn test_mean_probabilities() {
        let samples = vec![0.1, 0.2, 0.3, 0.4];
        let m = mean(&samples);
        assert!((m - 0.25).abs() < 1e-10);
    }

    #[test]
    fn test_variance_basic() {
        let samples = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let v = variance(&samples);
        assert!((v - 2.5).abs() < 1e-10);
    }

    #[test]
    fn test_variance_empty() {
        let samples: Vec<f64> = vec![];
        let v = variance(&samples);
        assert_eq!(v, 0.0);
    }

    #[test]
    fn test_variance_single() {
        let samples = vec![42.0];
        let v = variance(&samples);
        assert_eq!(v, 0.0);
    }

    #[test]
    fn test_variance_identical() {
        let samples = vec![5.0, 5.0, 5.0, 5.0];
        let v = variance(&samples);
        assert!(v.abs() < 1e-10);
    }

    #[test]
    fn test_std_dev_basic() {
        let samples = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let sd = std_dev(&samples);
        assert!((sd - 2.5_f64.sqrt()).abs() < 1e-10);
    }

    #[test]
    fn test_confidence_interval_95() {
        let samples: Vec<f64> = (0..1000).map(|i| 10.0 + (i as f64) * 0.01).collect();
        let m = mean(&samples);
        let (lower, upper) = confidence_interval(&samples, 0.95);

        assert!(lower < m && m < upper);

        assert!((m - lower - (upper - m)).abs() < 1e-6);
    }

    #[test]
    fn test_confidence_interval_99() {
        let samples: Vec<f64> = (0..1000).map(|i| 0.5 + (i as f64) * 0.0001).collect();
        let _m = mean(&samples);
        let (lower_95, upper_95) = confidence_interval(&samples, 0.95);
        let (lower_99, upper_99) = confidence_interval(&samples, 0.99);

        assert!(lower_99 < lower_95);
        assert!(upper_99 > upper_95);
    }

    #[test]
    fn test_confidence_interval_empty() {
        let samples: Vec<f64> = vec![];
        let (lower, upper) = confidence_interval(&samples, 0.95);
        assert_eq!(lower, 0.0);
        assert_eq!(upper, 0.0);
    }

    #[test]
    fn test_ci_wald_clamps_to_unit_interval() {
        let (lo0, hi0) = ci_wald(0.0, 10);
        assert_eq!(lo0, 0.0);
        assert_eq!(hi0, 0.0);

        let (lo1, hi1) = ci_wald(1.0, 10);
        assert_eq!(lo1, 1.0);
        assert_eq!(hi1, 1.0);

        let (lo, hi) = ci_wald(-3.0, 10);
        assert_eq!(lo, 0.0);
        assert_eq!(hi, 0.0);
    }

    #[test]
    fn test_ci_wald_is_symmetric_around_half() {
        let n = 1_000u64;
        let (lo, hi) = ci_wald(0.5, n);
        let mid = 0.5;
        assert!((mid - lo - (hi - mid)).abs() < 1e-12);
    }

    #[test]
    fn test_ci_wald_shrinks_with_more_samples() {
        let (lo_small, hi_small) = ci_wald(0.2, 100);
        let (lo_big, hi_big) = ci_wald(0.2, 10_000);
        assert!((hi_big - lo_big) < (hi_small - lo_small));
    }

    #[test]
    fn test_relative_half_width_wald_shrinks_with_more_samples() {
        let rhw_small = relative_half_width_wald(0.1, 100, 1.96).unwrap();
        let rhw_big = relative_half_width_wald(0.1, 10_000, 1.96).unwrap();
        assert!(rhw_big < rhw_small);
    }

    #[test]
    fn test_relative_half_width_wald_is_undefined_at_zero_probability() {
        assert!(relative_half_width_wald(0.0, 10_000, 1.96).is_none());
        assert!(relative_half_width_wald(-1.0, 10_000, 1.96).is_none());
    }

    #[test]
    fn test_should_stop_relative_half_width_wald() {
        assert!(!should_stop_relative_half_width_wald(0.1, 100, 0.1, 100));
        assert!(should_stop_relative_half_width_wald(0.1, 10_000, 0.1, 100));

        assert!(!should_stop_relative_half_width_wald(
            0.1, 10_000, 0.1, 20_000
        ));

        assert!(!should_stop_relative_half_width_wald(0.0, 10_000, 0.1, 100));
    }

    #[test]
    fn test_jeffreys_posterior_mean_edge_cases() {
        let m0 = jeffreys_posterior_mean(0, 10).unwrap();
        assert!((m0 - (0.5 / 11.0)).abs() < 1e-12);

        let m1 = jeffreys_posterior_mean(10, 10).unwrap();
        assert!((m1 - (10.5 / 11.0)).abs() < 1e-12);

        let m_empty = jeffreys_posterior_mean(0, 0).unwrap();
        assert!((m_empty - 0.5).abs() < 1e-12);

        assert!(jeffreys_posterior_mean(11, 10).is_none());
    }

    #[test]
    fn test_jeffreys_credible_interval_is_well_formed() {
        let (lo, hi) = jeffreys_credible_interval(0, 10, 0.95).unwrap();
        assert!(0.0 <= lo && lo <= hi && hi <= 1.0);

        let (lo2, hi2) = jeffreys_credible_interval(10, 10, 0.95).unwrap();
        assert!(0.0 <= lo2 && lo2 <= hi2 && hi2 <= 1.0);

        let (lo3, hi3) = jeffreys_credible_interval(50, 100, 0.95).unwrap();
        assert!((0.5 - lo3 - (hi3 - 0.5)).abs() < 1e-6);

        assert!(jeffreys_credible_interval(11, 10, 0.95).is_none());
        assert!(jeffreys_credible_interval(1, 10, 1.0).is_none());
        assert!(jeffreys_credible_interval(1, 10, 0.0).is_none());
    }

    #[test]
    fn refresh_cadence_only_updates_on_refresh_points() {
        let cadence = RefreshCadence { every: 3 };
        let mut refresher = StatsRefresher::new(cadence);

        let mut last_seen = None;
        for step in 1u64..=10u64 {
            let successes = step;
            let trials = step * 10;
            let did = refresher.update(step, successes, trials, false);

            if cadence.should_refresh(step) {
                assert!(did);
                assert_eq!(refresher.last_step(), step);
                last_seen = refresher.last();
                let expected = proportion_stats_from_tally(successes, trials);
                assert_eq!(refresher.last(), Some(expected));
            } else {
                assert!(!did);
                assert_eq!(refresher.last(), last_seen);
            }
        }
    }

    #[test]
    fn refresh_cadence_can_force_final_refresh() {
        let cadence = RefreshCadence { every: 4 };
        let mut refresher = StatsRefresher::new(cadence);

        let did = refresher.update(7, 2, 10, true);
        assert!(did);
        assert_eq!(refresher.last_step(), 7);
        assert_eq!(refresher.last(), Some(proportion_stats_from_tally(2, 10)));
    }

    #[test]
    fn test_confidence_interval_single() {
        let samples = vec![42.0];
        let (lower, upper) = confidence_interval(&samples, 0.95);
        assert_eq!(lower, 42.0);
        assert_eq!(upper, 42.0);
    }

    #[test]
    fn test_confidence_interval_contains_true_mean() {
        let samples: Vec<f64> = vec![0.12, 0.13, 0.11, 0.14, 0.125, 0.115, 0.135, 0.12];
        let true_mean = 0.125;
        let (lower, upper) = confidence_interval(&samples, 0.95);

        assert!(lower < true_mean && true_mean < upper);
    }
}
