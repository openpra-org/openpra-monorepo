/// Safety Integrity Level (SIL) metrics per IEC 61508
///
/// This module provides functionality for calculating SIL metrics including:
/// - PFD (Probability of Failure on Demand)
/// - PFH (Probability of Failure per Hour)
/// - SIL level classification
/// - Histogram generation for frequency distribution
///
/// # SIL Levels (per IEC 61508)
///
/// | Level | PFD Range              | PFH Range              |
/// |-------|------------------------|------------------------|
/// | SIL 4 | [10⁻⁵, 10⁻⁴)          | [10⁻⁹, 10⁻⁸)          |
/// | SIL 3 | [10⁻⁴, 10⁻³)          | [10⁻⁸, 10⁻⁷)          |
/// | SIL 2 | [10⁻³, 10⁻²)          | [10⁻⁷, 10⁻⁶)          |
/// | SIL 1 | [10⁻², 10⁻¹)          | [10⁻⁶, 10⁻⁵)          |
/// | None  | ≥ 10⁻¹                | ≥ 10⁻⁵                |
///
/// # Examples
///
/// ```
/// use praxis::analysis::sil::{Sil, SilLevel};
///
/// // Single point (constant probability)
/// let sil = Sil::from_probability(0.0001); // 10⁻⁴
/// assert_eq!(sil.sil_level(), SilLevel::Sil3);
///
/// // Time-series data
/// let time_series = vec![
///     (0.001, 0.0),   // P=0.001 at t=0
///     (0.002, 100.0), // P=0.002 at t=100
///     (0.003, 200.0), // P=0.003 at t=200
/// ];
/// let sil = Sil::from_time_series(&time_series);
/// assert_eq!(sil.sil_level(), SilLevel::Sil2);
/// ```
use serde::{Deserialize, Serialize};

use std::fmt;

/// SIL level classification per IEC 61508
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum SilLevel {
    /// No SIL level (probability too high)
    None = 0,
    /// SIL 1: PFD ∈ [10⁻², 10⁻¹), PFH ∈ [10⁻⁶, 10⁻⁵)
    Sil1 = 1,
    /// SIL 2: PFD ∈ [10⁻³, 10⁻²), PFH ∈ [10⁻⁷, 10⁻⁶)
    Sil2 = 2,
    /// SIL 3: PFD ∈ [10⁻⁴, 10⁻³), PFH ∈ [10⁻⁸, 10⁻⁷)
    Sil3 = 3,
    /// SIL 4: PFD ∈ [10⁻⁵, 10⁻⁴), PFH ∈ [10⁻⁹, 10⁻⁸)
    Sil4 = 4,
}

impl fmt::Display for SilLevel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SilLevel::None => write!(f, "None"),
            SilLevel::Sil1 => write!(f, "SIL 1"),
            SilLevel::Sil2 => write!(f, "SIL 2"),
            SilLevel::Sil3 => write!(f, "SIL 3"),
            SilLevel::Sil4 => write!(f, "SIL 4"),
        }
    }
}

impl SilLevel {
    /// Classify SIL level from PFD value
    pub fn from_pfd(pfd: f64) -> Self {
        if pfd < 1e-4 {
            SilLevel::Sil4
        } else if pfd < 1e-3 {
            SilLevel::Sil3
        } else if pfd < 1e-2 {
            SilLevel::Sil2
        } else if pfd < 1e-1 {
            SilLevel::Sil1
        } else {
            SilLevel::None
        }
    }

    /// Classify SIL level from PFH value
    pub fn from_pfh(pfh: f64) -> Self {
        if pfh < 1e-8 {
            SilLevel::Sil4
        } else if pfh < 1e-7 {
            SilLevel::Sil3
        } else if pfh < 1e-6 {
            SilLevel::Sil2
        } else if pfh < 1e-5 {
            SilLevel::Sil1
        } else {
            SilLevel::None
        }
    }
}

/// Histogram bucket for SIL analysis
///
/// Represents a range (lower_bound, upper_bound] and the fraction
/// of time that the probability falls within this range.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HistogramBucket {
    /// Upper bound of the range (lower bound is implicit from previous bucket)
    pub upper_bound: f64,
    /// Fraction of time in this range (0.0 to 1.0)
    pub fraction: f64,
}

impl HistogramBucket {
    /// Create a new histogram bucket
    pub fn new(upper_bound: f64, fraction: f64) -> Self {
        HistogramBucket {
            upper_bound,
            fraction,
        }
    }
}

/// Safety Integrity Level metrics
///
/// Contains PFD and PFH averages along with histograms showing
/// the distribution of time across different probability ranges.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Sil {
    /// Average Probability of Failure on Demand
    pub pfd_avg: f64,
    /// Average Probability of Failure per Hour
    pub pfh_avg: f64,
    /// PFD histogram (boundaries: 10⁻⁵, 10⁻⁴, 10⁻³, 10⁻², 10⁻¹, 1.0)
    pub pfd_histogram: Vec<HistogramBucket>,
    /// PFH histogram (boundaries: 10⁻⁹, 10⁻⁸, 10⁻⁷, 10⁻⁶, 10⁻⁵, 1.0)
    pub pfh_histogram: Vec<HistogramBucket>,
}

impl Sil {
    /// Standard PFD boundaries for SIL levels (SIL 4 to None)
    const PFD_BOUNDARIES: [f64; 6] = [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0];

    /// Standard PFH boundaries for SIL levels (SIL 4 to None)
    const PFH_BOUNDARIES: [f64; 6] = [1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1.0];

    /// Create SIL metrics from a constant probability value
    ///
    /// For a single point (no time variation), PFD equals the probability
    /// and PFH is zero (no time component).
    ///
    /// # Arguments
    /// * `probability` - The constant failure probability
    ///
    /// # Returns
    /// * `Sil` - SIL metrics with the given probability
    ///
    /// # Examples
    ///
    /// ```
    /// use praxis::analysis::sil::Sil;
    ///
    /// let sil = Sil::from_probability(0.0001); // 10⁻⁴
    /// assert_eq!(sil.pfd_avg, 0.0001);
    /// assert_eq!(sil.pfh_avg, 0.0);
    /// ```
    pub fn from_probability(probability: f64) -> Self {
        // Find which bucket the probability falls into
        let mut pfd_histogram = Vec::new();
        for &boundary in &Self::PFD_BOUNDARIES {
            let fraction = if probability <= boundary { 1.0 } else { 0.0 };
            pfd_histogram.push(HistogramBucket::new(boundary, fraction));
            if probability <= boundary {
                break;
            }
        }

        // Fill remaining buckets with 0
        while pfd_histogram.len() < 6 {
            pfd_histogram.push(HistogramBucket::new(
                Self::PFD_BOUNDARIES[pfd_histogram.len()],
                0.0,
            ));
        }

        let pfh_histogram = Self::PFH_BOUNDARIES
            .iter()
            .map(|&b| HistogramBucket::new(b, 0.0))
            .collect();

        Sil {
            pfd_avg: probability,
            pfh_avg: 0.0,
            pfd_histogram,
            pfh_histogram,
        }
    }

    /// Create SIL metrics from time series data
    ///
    /// Computes average PFD and PFH over time, and generates histograms
    /// showing the distribution of time across different probability ranges.
    ///
    /// # Arguments
    /// * `time_series` - Vector of (probability, time) pairs, sorted by time
    ///
    /// # Returns
    /// * `Sil` - SIL metrics computed from the time series
    ///
    /// # Examples
    ///
    /// ```
    /// use praxis::analysis::sil::Sil;
    ///
    /// let data = vec![
    ///     (0.001, 0.0),
    ///     (0.002, 100.0),
    ///     (0.003, 200.0),
    /// ];
    /// let sil = Sil::from_time_series(&data);
    /// assert!(sil.pfd_avg > 0.001 && sil.pfd_avg < 0.003);
    /// ```
    pub fn from_time_series(time_series: &[(f64, f64)]) -> Self {
        if time_series.is_empty() {
            return Self::from_probability(0.0);
        }

        if time_series.len() == 1 {
            return Self::from_probability(time_series[0].0);
        }

        // Compute average PFD using trapezoidal integration
        let pfd_avg = average_y(time_series);

        // Compute PFD histogram
        let pfd_histogram = partition_y(time_series, &Self::PFD_BOUNDARIES);

        // Compute PFH time series: PFH = P(t) / t for t > 0
        let pfh_series: Vec<(f64, f64)> = time_series
            .iter()
            .map(|(p, t)| if *t > 0.0 { (*p / *t, *t) } else { (0.0, *t) })
            .collect();

        // Compute average PFH
        let pfh_avg = average_y(&pfh_series);

        // Compute PFH histogram
        let pfh_histogram = partition_y(&pfh_series, &Self::PFH_BOUNDARIES);

        Sil {
            pfd_avg,
            pfh_avg,
            pfd_histogram,
            pfh_histogram,
        }
    }

    /// Get the SIL level based on PFD
    pub fn sil_level(&self) -> SilLevel {
        SilLevel::from_pfd(self.pfd_avg)
    }

    /// Get the SIL level based on PFH
    pub fn sil_level_pfh(&self) -> SilLevel {
        SilLevel::from_pfh(self.pfh_avg)
    }

    /// Get the fraction of time in each SIL level (based on PFD)
    ///
    /// Returns (SIL4, SIL3, SIL2, SIL1, None)
    pub fn pfd_fractions_by_level(&self) -> (f64, f64, f64, f64, f64) {
        if self.pfd_histogram.len() < 6 {
            return (0.0, 0.0, 0.0, 0.0, 0.0);
        }

        (
            self.pfd_histogram[0].fraction, // SIL 4: [0, 10⁻⁵)
            self.pfd_histogram[1].fraction, // SIL 3: [10⁻⁵, 10⁻⁴)
            self.pfd_histogram[2].fraction, // SIL 2: [10⁻⁴, 10⁻³)
            self.pfd_histogram[3].fraction, // SIL 1: [10⁻³, 10⁻²)
            self.pfd_histogram[4].fraction + self.pfd_histogram[5].fraction, // None: [10⁻², 1.0]
        )
    }

    /// Get the fraction of time in each SIL level (based on PFH)
    ///
    /// Returns (SIL4, SIL3, SIL2, SIL1, None)
    pub fn pfh_fractions_by_level(&self) -> (f64, f64, f64, f64, f64) {
        if self.pfh_histogram.len() < 6 {
            return (0.0, 0.0, 0.0, 0.0, 0.0);
        }

        (
            self.pfh_histogram[0].fraction, // SIL 4: [0, 10⁻⁹)
            self.pfh_histogram[1].fraction, // SIL 3: [10⁻⁹, 10⁻⁸)
            self.pfh_histogram[2].fraction, // SIL 2: [10⁻⁸, 10⁻⁷)
            self.pfh_histogram[3].fraction, // SIL 1: [10⁻⁷, 10⁻⁶)
            self.pfh_histogram[4].fraction + self.pfh_histogram[5].fraction, // None: [10⁻⁶, 1.0]
        )
    }
}

impl fmt::Display for Sil {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "SIL Metrics:")?;
        writeln!(
            f,
            "  PFD Average: {:.6e} ({})",
            self.pfd_avg,
            self.sil_level()
        )?;
        writeln!(
            f,
            "  PFH Average: {:.6e} ({})",
            self.pfh_avg,
            self.sil_level_pfh()
        )?;

        let (sil4, sil3, sil2, sil1, none) = self.pfd_fractions_by_level();
        writeln!(f, "  PFD Distribution:")?;
        writeln!(f, "    SIL 4: {:.2}%", sil4 * 100.0)?;
        writeln!(f, "    SIL 3: {:.2}%", sil3 * 100.0)?;
        writeln!(f, "    SIL 2: {:.2}%", sil2 * 100.0)?;
        writeln!(f, "    SIL 1: {:.2}%", sil1 * 100.0)?;
        writeln!(f, "    None:  {:.2}%", none * 100.0)?;

        Ok(())
    }
}

/// Integrate a function over time using trapezoidal rule
///
/// For a series of (y, x) points, computes ∫y dx using the trapezoidal method.
///
/// # Arguments
/// * `points` - Vector of (y, x) pairs
///
/// # Returns
/// * `f64` - The integral value
fn integrate(points: &[(f64, f64)]) -> f64 {
    if points.len() < 2 {
        return 0.0;
    }

    let mut area = 0.0;
    for i in 1..points.len() {
        let (y0, x0) = points[i - 1];
        let (y1, x1) = points[i];
        let dx = x1 - x0;
        let avg_y = (y0 + y1) / 2.0;
        area += avg_y * dx;
    }
    area
}

/// Compute average y value over x range
///
/// For a series of (y, x) points, computes the average y value
/// weighted by the x range: average = ∫y dx / Δx
///
/// # Arguments
/// * `points` - Vector of (y, x) pairs
///
/// # Returns
/// * `f64` - The average y value
fn average_y(points: &[(f64, f64)]) -> f64 {
    if points.is_empty() {
        return 0.0;
    }
    if points.len() == 1 {
        return points[0].0;
    }

    let range_x = points.last().unwrap().1 - points.first().unwrap().1;
    if range_x == 0.0 {
        return points[0].0;
    }

    integrate(points) / range_x
}

/// Partition the y-axis into histogram buckets
///
/// For a function represented as (y, x) points, computes the fraction
/// of x-range where y falls into each bucket defined by boundaries.
///
/// # Arguments
/// * `points` - Vector of (y, x) pairs, sorted by x
/// * `boundaries` - Upper bounds for each bucket (lower bound is implicit 0 for first)
///
/// # Returns
/// * `Vec<HistogramBucket>` - Histogram with normalized fractions
///
/// # Algorithm
///
/// For each segment between points, compute how much of the segment's
/// x-range falls into each y-bucket. Handle linear interpolation between
/// points and normalize by total x-range.
fn partition_y(points: &[(f64, f64)], boundaries: &[f64]) -> Vec<HistogramBucket> {
    if points.len() < 2 {
        // Single point or empty - put everything in the appropriate bucket
        let y = if points.is_empty() { 0.0 } else { points[0].0 };
        return boundaries
            .iter()
            .map(|&b| {
                let fraction = if y <= b { 1.0 } else { 0.0 };
                HistogramBucket::new(b, fraction)
            })
            .collect();
    }

    let mut buckets: Vec<f64> = vec![0.0; boundaries.len()];

    // Process each segment
    for i in 1..points.len() {
        let (y0, x0) = points[i - 1];
        let (y1, x1) = points[i];
        let dx = x1 - x0;

        if dx <= 0.0 {
            continue;
        }

        // Linear interpolation slope
        let slope = (y1 - y0) / dx;

        // Handle potential decreasing segments (negative slope)
        let (p0, p1) = if slope < 0.0 {
            (y1, y0) // Swap so p0 < p1
        } else {
            (y0, y1)
        };
        let abs_slope = slope.abs();

        // Compute contribution to each bucket
        let mut lower_bound = 0.0;
        for (j, &upper_bound) in boundaries.iter().enumerate() {
            let contribution = if abs_slope == 0.0 {
                // Horizontal segment
                if p0 > lower_bound && p0 <= upper_bound {
                    dx
                } else {
                    0.0
                }
            } else {
                // Sloped segment - compute overlap
                compute_overlap(p0, p1, lower_bound, upper_bound, abs_slope)
            };

            buckets[j] += contribution;
            lower_bound = upper_bound;
        }
    }

    // Normalize by total x-range
    let range_x = points.last().unwrap().1 - points.first().unwrap().1;
    if range_x > 0.0 {
        for bucket in &mut buckets {
            *bucket /= range_x;
        }
    }

    boundaries
        .iter()
        .zip(buckets.iter())
        .map(|(&b, &f)| HistogramBucket::new(b, f))
        .collect()
}

/// Compute the overlap between a segment [p0, p1] and bucket [b0, b1]
///
/// Returns the x-range contribution when the segment overlaps the bucket.
fn compute_overlap(p0: f64, p1: f64, b0: f64, b1: f64, slope: f64) -> f64 {
    // Sub-range: [p0, p1] ⊆ [b0, b1]
    if b0 < p0 && p1 <= b1 {
        return (p1 - p0) / slope;
    }

    // Super-range: [b0, b1] ⊆ [p0, p1]
    if p0 <= b0 && b1 <= p1 {
        return (b1 - b0) / slope;
    }

    // Partial overlap: b0 in [p0, p1], b1 outside
    if p0 <= b0 && b0 < p1 && p1 < b1 {
        return (p1 - b0) / slope;
    }

    // Partial overlap: b1 in [p0, p1], b0 outside
    if b0 < p0 && p0 < b1 && b1 <= p1 {
        return (b1 - p0) / slope;
    }

    // No overlap
    0.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sil_level_from_pfd() {
        assert_eq!(SilLevel::from_pfd(5e-6), SilLevel::Sil4);
        assert_eq!(SilLevel::from_pfd(5e-5), SilLevel::Sil4);
        assert_eq!(SilLevel::from_pfd(5e-4), SilLevel::Sil3);
        assert_eq!(SilLevel::from_pfd(5e-3), SilLevel::Sil2);
        assert_eq!(SilLevel::from_pfd(5e-2), SilLevel::Sil1);
        assert_eq!(SilLevel::from_pfd(0.5), SilLevel::None);
    }

    #[test]
    fn test_sil_level_from_pfh() {
        assert_eq!(SilLevel::from_pfh(5e-10), SilLevel::Sil4);
        assert_eq!(SilLevel::from_pfh(5e-9), SilLevel::Sil4);
        assert_eq!(SilLevel::from_pfh(5e-8), SilLevel::Sil3);
        assert_eq!(SilLevel::from_pfh(5e-7), SilLevel::Sil2);
        assert_eq!(SilLevel::from_pfh(5e-6), SilLevel::Sil1);
        assert_eq!(SilLevel::from_pfh(5e-5), SilLevel::None);
    }

    #[test]
    fn test_sil_from_constant_probability() {
        let sil = Sil::from_probability(0.0001);

        assert_eq!(sil.pfd_avg, 0.0001);
        assert_eq!(sil.pfh_avg, 0.0);
        assert_eq!(sil.sil_level(), SilLevel::Sil3);

        // Check histogram - should be 100% in the appropriate bucket
        assert!(sil.pfd_histogram[1].fraction > 0.99);
    }

    #[test]
    fn test_integrate() {
        let points = vec![(1.0, 0.0), (2.0, 1.0), (3.0, 2.0)];
        let area = integrate(&points);

        // Trapezoidal: (1+2)/2 * 1 + (2+3)/2 * 1 = 1.5 + 2.5 = 4.0
        assert!((area - 4.0).abs() < 1e-10);
    }

    #[test]
    fn test_average_y() {
        let points = vec![(1.0, 0.0), (3.0, 2.0)];
        let avg = average_y(&points);

        // Linear from 1 to 3 over 0 to 2: average = 2.0
        assert!((avg - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_sil_from_time_series() {
        let time_series = vec![(0.001, 0.0), (0.002, 100.0), (0.003, 200.0)];

        let sil = Sil::from_time_series(&time_series);

        // Average should be around 0.002
        assert!((sil.pfd_avg - 0.002).abs() < 0.001);
        assert_eq!(sil.sil_level(), SilLevel::Sil2);
    }

    #[test]
    fn test_partition_y_constant() {
        let points = vec![(0.0005, 0.0), (0.0005, 100.0)];
        let boundaries = [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0];

        let histogram = partition_y(&points, &boundaries);

        // Constant 0.0005 falls in bucket (1e-4, 1e-3]
        assert!(histogram[2].fraction > 0.99);
    }

    #[test]
    fn test_partition_y_linear() {
        let points = vec![(1e-5, 0.0), (1e-3, 100.0)];
        let boundaries = [1e-4, 1e-3];

        let histogram = partition_y(&points, &boundaries);

        // Linear increase from 1e-5 to 1e-3
        // y = 1e-5 + (1e-3 - 1e-5) * (x/100) = 1e-5 + 0.99e-3 * (x/100)
        // Crosses 1e-4 when: 1e-4 = 1e-5 + 0.99e-3 * (x/100)
        // => x ≈ 9.09
        // So ~9% in first bucket, ~91% in second
        assert!(histogram[0].fraction > 0.08 && histogram[0].fraction < 0.11);
        assert!(histogram[1].fraction > 0.89 && histogram[1].fraction < 0.92);
    }

    #[test]
    fn test_sil_display() {
        let sil = Sil::from_probability(0.0001);
        let output = format!("{}", sil);

        assert!(output.contains("SIL Metrics"));
        assert!(output.contains("PFD Average"));
        assert!(output.contains("SIL 3"));
    }

    #[test]
    fn test_empty_time_series() {
        let sil = Sil::from_time_series(&[]);

        assert_eq!(sil.pfd_avg, 0.0);
        assert_eq!(sil.pfh_avg, 0.0);
    }

    #[test]
    fn test_single_point_time_series() {
        let sil = Sil::from_time_series(&[(0.005, 100.0)]);

        assert_eq!(sil.pfd_avg, 0.005);
        assert_eq!(sil.sil_level(), SilLevel::Sil2);
    }

    #[test]
    fn test_pfd_fractions_by_level() {
        let sil = Sil::from_probability(0.0005);
        let (sil4, sil3, sil2, sil1, none) = sil.pfd_fractions_by_level();

        // 0.0005 falls in the range (1e-4, 1e-3], which is bucket index 2 (SIL 2)
        assert!(sil2 > 0.99);
        assert!(sil4.abs() < 0.01);
        assert!(sil3.abs() < 0.01);
        assert!(sil1.abs() < 0.01);
        assert!(none.abs() < 0.01);
    }

    #[test]
    fn test_compute_overlap() {
        // Sub-range
        assert!((compute_overlap(0.2, 0.8, 0.0, 1.0, 1.0) - 0.6).abs() < 1e-10);

        // Super-range
        assert!((compute_overlap(0.0, 1.0, 0.2, 0.8, 1.0) - 0.6).abs() < 1e-10);

        // No overlap
        assert_eq!(compute_overlap(0.0, 0.5, 0.6, 1.0, 1.0), 0.0);
    }

    #[test]
    fn test_sil_boundaries() {
        // Test boundary conditions
        assert_eq!(SilLevel::from_pfd(1e-5), SilLevel::Sil4);
        assert_eq!(SilLevel::from_pfd(1e-4), SilLevel::Sil3);
        assert_eq!(SilLevel::from_pfd(1e-3), SilLevel::Sil2);
        assert_eq!(SilLevel::from_pfd(1e-2), SilLevel::Sil1);
        assert_eq!(SilLevel::from_pfd(1e-1), SilLevel::None);
    }
}
