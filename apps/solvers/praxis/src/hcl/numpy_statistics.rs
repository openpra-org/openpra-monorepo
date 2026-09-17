//! NumPy 2.4.4 arithmetic used by HCL_MH's quantifiers.
//! See uncertainty/SOURCE.md and uncertainty/LICENSES.txt for provenance.

// loops_utils.h.src DOUBLE_pairwise_sum for contiguous float64 values.
// Shared with the existing CPT row normalization; do not reorder the input.
pub(super) fn numpy_sum(values: &[f64]) -> f64 {
    let n = values.len();
    if n < 8 {
        return values.iter().fold(-0.0, |sum, value| sum + value);
    }
    if n <= 128 {
        let mut accumulators: [f64; 8] = values[..8].try_into().unwrap();
        let stop = n - n % 8;
        for row in values[8..stop].chunks_exact(8) {
            for index in 0..8 {
                accumulators[index] += row[index];
            }
        }
        let a = accumulators;
        let sum = ((a[0] + a[1]) + (a[2] + a[3])) + ((a[4] + a[5]) + (a[6] + a[7]));
        values[stop..].iter().fold(sum, |sum, value| sum + value)
    } else {
        let mut half = n / 2;
        half -= half % 8;
        numpy_sum(&values[..half]) + numpy_sum(&values[half..])
    }
}

pub(super) fn mean(values: &[f64]) -> f64 {
    // HCL_MH's float64 sample vector is contiguous, so NumPy reduces it in
    // one pairwise call, including above its default iterator buffer size.
    (0.0 + numpy_sum(values)) / values.len() as f64
}

pub(super) fn population_standard_deviation(values: &[f64], mean: f64) -> f64 {
    // _core/_methods.py: _var with ddof=0, then _std. Preserve sample order.
    let squared_deviations: Vec<f64> = values
        .iter()
        .map(|value| {
            let delta = value - mean;
            delta * delta
        })
        .collect();
    self::mean(&squared_deviations).sqrt()
}

pub(super) fn median(sorted: &[f64]) -> f64 {
    // np.median averages the middle slice, independently of np.percentile.
    let middle = sorted.len() / 2;
    if sorted.len() % 2 == 0 {
        mean(&sorted[middle - 1..=middle])
    } else {
        mean(&sorted[middle..=middle])
    }
}

pub(super) fn percentile(sorted: &[f64], probability: f64) -> f64 {
    // lib/_function_base_impl.py: default linear _quantile and _lerp.
    let position = probability * (sorted.len() - 1) as f64;
    let lower = position.floor() as usize;
    let upper = (lower + 1).min(sorted.len() - 1);
    let fraction = position - lower as f64;
    let difference = sorted[upper] - sorted[lower];
    if fraction >= 0.5 {
        sorted[upper] - difference * (1.0 - fraction)
    } else {
        sorted[lower] + difference * fraction
    }
}
