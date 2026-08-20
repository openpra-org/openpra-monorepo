use serde::{Deserialize, Serialize};

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum SilLevel {
    None = 0,

    Sil1 = 1,

    Sil2 = 2,

    Sil3 = 3,

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HistogramBucket {
    pub upper_bound: f64,

    pub fraction: f64,
}

impl HistogramBucket {
    pub fn new(upper_bound: f64, fraction: f64) -> Self {
        HistogramBucket {
            upper_bound,
            fraction,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Sil {
    pub pfd_avg: f64,

    pub pfh_avg: f64,

    pub pfd_histogram: Vec<HistogramBucket>,

    pub pfh_histogram: Vec<HistogramBucket>,
}

impl Sil {
    const PFD_BOUNDARIES: [f64; 6] = [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0];

    const PFH_BOUNDARIES: [f64; 6] = [1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1.0];

    pub fn from_probability(probability: f64) -> Self {
        let mut pfd_histogram = Vec::new();
        for &boundary in &Self::PFD_BOUNDARIES {
            let fraction = if probability <= boundary { 1.0 } else { 0.0 };
            pfd_histogram.push(HistogramBucket::new(boundary, fraction));
            if probability <= boundary {
                break;
            }
        }

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

    pub fn from_time_series(time_series: &[(f64, f64)]) -> Self {
        if time_series.is_empty() {
            return Self::from_probability(0.0);
        }

        if time_series.len() == 1 {
            return Self::from_probability(time_series[0].0);
        }

        let pfd_avg = average_y(time_series);

        let pfd_histogram = partition_y(time_series, &Self::PFD_BOUNDARIES);

        let pfh_series: Vec<(f64, f64)> = time_series
            .iter()
            .map(|(p, t)| if *t > 0.0 { (*p / *t, *t) } else { (0.0, *t) })
            .collect();

        let pfh_avg = average_y(&pfh_series);

        let pfh_histogram = partition_y(&pfh_series, &Self::PFH_BOUNDARIES);

        Sil {
            pfd_avg,
            pfh_avg,
            pfd_histogram,
            pfh_histogram,
        }
    }

    pub fn sil_level(&self) -> SilLevel {
        SilLevel::from_pfd(self.pfd_avg)
    }

    pub fn sil_level_pfh(&self) -> SilLevel {
        SilLevel::from_pfh(self.pfh_avg)
    }

    pub fn pfd_fractions_by_level(&self) -> (f64, f64, f64, f64, f64) {
        if self.pfd_histogram.len() < 6 {
            return (0.0, 0.0, 0.0, 0.0, 0.0);
        }

        (
            self.pfd_histogram[0].fraction + self.pfd_histogram[1].fraction,
            self.pfd_histogram[2].fraction,
            self.pfd_histogram[3].fraction,
            self.pfd_histogram[4].fraction,
            self.pfd_histogram[5].fraction,
        )
    }

    pub fn pfh_fractions_by_level(&self) -> (f64, f64, f64, f64, f64) {
        if self.pfh_histogram.len() < 6 {
            return (0.0, 0.0, 0.0, 0.0, 0.0);
        }

        (
            self.pfh_histogram[0].fraction + self.pfh_histogram[1].fraction,
            self.pfh_histogram[2].fraction,
            self.pfh_histogram[3].fraction,
            self.pfh_histogram[4].fraction,
            self.pfh_histogram[5].fraction,
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

fn partition_y(points: &[(f64, f64)], boundaries: &[f64]) -> Vec<HistogramBucket> {
    if points.len() < 2 {
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

    for i in 1..points.len() {
        let (y0, x0) = points[i - 1];
        let (y1, x1) = points[i];
        let dx = x1 - x0;

        if dx <= 0.0 {
            continue;
        }

        let slope = (y1 - y0) / dx;

        let (p0, p1) = if slope < 0.0 { (y1, y0) } else { (y0, y1) };
        let abs_slope = slope.abs();

        let mut lower_bound = 0.0;
        for (j, &upper_bound) in boundaries.iter().enumerate() {
            let contribution = if abs_slope == 0.0 {
                if p0 > lower_bound && p0 <= upper_bound {
                    dx
                } else {
                    0.0
                }
            } else {
                compute_overlap(p0, p1, lower_bound, upper_bound, abs_slope)
            };

            buckets[j] += contribution;
            lower_bound = upper_bound;
        }
    }

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

fn compute_overlap(p0: f64, p1: f64, b0: f64, b1: f64, slope: f64) -> f64 {
    if b0 < p0 && p1 <= b1 {
        return (p1 - p0) / slope;
    }

    if p0 <= b0 && b1 <= p1 {
        return (b1 - b0) / slope;
    }

    if p0 <= b0 && b0 < p1 && p1 < b1 {
        return (p1 - b0) / slope;
    }

    if b0 < p0 && p0 < b1 && b1 <= p1 {
        return (b1 - p0) / slope;
    }

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

        assert!(sil.pfd_histogram[1].fraction > 0.99);
    }

    #[test]
    fn test_integrate() {
        let points = vec![(1.0, 0.0), (2.0, 1.0), (3.0, 2.0)];
        let area = integrate(&points);

        assert!((area - 4.0).abs() < 1e-10);
    }

    #[test]
    fn test_average_y() {
        let points = vec![(1.0, 0.0), (3.0, 2.0)];
        let avg = average_y(&points);

        assert!((avg - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_sil_from_time_series() {
        let time_series = vec![(0.001, 0.0), (0.002, 100.0), (0.003, 200.0)];

        let sil = Sil::from_time_series(&time_series);

        assert!((sil.pfd_avg - 0.002).abs() < 0.001);
        assert_eq!(sil.sil_level(), SilLevel::Sil2);
    }

    #[test]
    fn test_partition_y_constant() {
        let points = vec![(0.0005, 0.0), (0.0005, 100.0)];
        let boundaries = [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1.0];

        let histogram = partition_y(&points, &boundaries);

        assert!(histogram[2].fraction > 0.99);
    }

    #[test]
    fn test_partition_y_linear() {
        let points = vec![(1e-5, 0.0), (1e-3, 100.0)];
        let boundaries = [1e-4, 1e-3];

        let histogram = partition_y(&points, &boundaries);

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

        assert!(sil3 > 0.99);
        assert!(sil4.abs() < 0.01);
        assert!(sil2.abs() < 0.01);
        assert!(sil1.abs() < 0.01);
        assert!(none.abs() < 0.01);
        assert_eq!(sil.sil_level(), SilLevel::Sil3);
    }

    #[test]
    fn test_compute_overlap() {
        assert!((compute_overlap(0.2, 0.8, 0.0, 1.0, 1.0) - 0.6).abs() < 1e-10);

        assert!((compute_overlap(0.0, 1.0, 0.2, 0.8, 1.0) - 0.6).abs() < 1e-10);

        assert_eq!(compute_overlap(0.0, 0.5, 0.6, 1.0, 1.0), 0.0);
    }

    #[test]
    fn test_sil_boundaries() {
        assert_eq!(SilLevel::from_pfd(1e-5), SilLevel::Sil4);
        assert_eq!(SilLevel::from_pfd(1e-4), SilLevel::Sil3);
        assert_eq!(SilLevel::from_pfd(1e-3), SilLevel::Sil2);
        assert_eq!(SilLevel::from_pfd(1e-2), SilLevel::Sil1);
        assert_eq!(SilLevel::from_pfd(1e-1), SilLevel::None);
    }
}
