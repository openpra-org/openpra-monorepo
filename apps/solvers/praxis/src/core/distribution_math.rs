use std::cmp::Ordering;
use std::f64::consts::{FRAC_PI_2, FRAC_PI_4, PI};

use rand::{Rng, RngCore};
use rand_distr::{Beta as BetaDraw, Distribution, Gamma as GammaDraw, StandardNormal, StudentT as StudentDraw};

use crate::core::distribution::{
    CountLikelihood, DiscreteOutcome, DurationModel, DurationOutput, DurationParameter, EvidenceTerm, Law,
    QuantilePoint, SampleSmoothing, StandbyDemandKind, TabulatedScale,
};
use crate::core::distribution_inference as inference;
use crate::core::special_functions as kernels;
use crate::error::MefError;
use crate::{PraxisError, Result};

fn math_error(message: String) -> PraxisError {
    PraxisError::Mef(MefError::Domain {
        message,
        value: None,
        attribute: None,
    })
}

fn brent<F: FnMut(f64) -> Result<f64>>(mut function: F, start: f64, end: f64) -> Result<f64> {
    let mut a = start;
    let mut b = end;
    let mut fa = function(a)?;
    let mut fb = function(b)?;
    if fa == 0.0 {
        return Ok(a);
    }
    if fb == 0.0 {
        return Ok(b);
    }
    if fa.signum() == fb.signum() {
        return Err(math_error(format!(
            "root finding needs a sign change between {} and {}",
            a, b
        )));
    }
    let mut c = a;
    let mut fc = fa;
    let mut d = b - a;
    let mut e = d;
    loop {
        if fb.signum() == fc.signum() {
            c = a;
            fc = fa;
            d = b - a;
            e = d;
        }
        if fc.abs() < fb.abs() {
            a = b;
            b = c;
            c = a;
            fa = fb;
            fb = fc;
            fc = fa;
        }
        let tolerance = 2.0 * f64::EPSILON * b.abs() + f64::MIN_POSITIVE;
        let middle = 0.5 * (c - b);
        if middle.abs() <= tolerance || fb == 0.0 {
            return Ok(b);
        }
        if e.abs() < tolerance || fa.abs() <= fb.abs() {
            d = middle;
            e = middle;
        } else {
            let s = fb / fa;
            let (mut p, mut q) = if a == c {
                (2.0 * middle * s, 1.0 - s)
            } else {
                let qa = fa / fc;
                let r = fb / fc;
                (
                    s * (2.0 * middle * qa * (qa - r) - (b - a) * (r - 1.0)),
                    (qa - 1.0) * (r - 1.0) * (s - 1.0),
                )
            };
            if p > 0.0 {
                q = -q;
            } else {
                p = -p;
            }
            if 2.0 * p < (3.0 * middle * q - (tolerance * q).abs()).min((e * q).abs()) {
                e = d;
                d = p / q;
            } else {
                d = middle;
                e = middle;
            }
        }
        a = b;
        fa = fb;
        b += if d.abs() > tolerance {
            d
        } else {
            tolerance.copysign(middle)
        };
        fb = function(b)?;
    }
}

fn expand_bracket<F: FnMut(f64) -> Result<f64>>(
    mut function: F,
    fixed: f64,
    mut moving: f64,
) -> Result<f64> {
    let fixed_value = function(fixed)?;
    loop {
        let value = function(moving)?;
        if value.signum() != fixed_value.signum() || value == 0.0 {
            return Ok(moving);
        }
        let next = fixed + 2.0 * (moving - fixed);
        if !next.is_finite() || next == moving {
            return Err(math_error(
                "no root exists within the range of double precision".to_string(),
            ));
        }
        moving = next;
    }
}

pub(crate) fn tanh_sinh<F: FnMut(f64, f64) -> Result<f64>>(mut integrand: F) -> Result<f64> {
    let mut step = 1.0;
    let mut node_sum = FRAC_PI_4 * integrand(0.5, 0.5)?;
    let mut absolute_sum = node_sum.abs();
    let add_nodes = |start: f64,
                         stride: f64,
                         node_sum: &mut f64,
                         absolute_sum: &mut f64,
                         integrand: &mut F|
     -> Result<()> {
        let mut t = start;
        loop {
            let s = FRAC_PI_2 * t.sinh();
            let tail = (-2.0 * s).exp();
            let small = tail / (1.0 + tail);
            let large = 1.0 / (1.0 + tail);
            let weight = FRAC_PI_4 * t.cosh() * 4.0 * tail / ((1.0 + tail) * (1.0 + tail));
            if small <= 0.0 || weight <= 0.0 {
                return Ok(());
            }
            let upper = integrand(large, small)? * weight;
            let lower = integrand(small, large)? * weight;
            if upper.is_nan() || lower.is_nan() {
                return Err(math_error(
                    "an integrand is undefined at a quadrature node".to_string(),
                ));
            }
            *node_sum += upper + lower;
            *absolute_sum += upper.abs() + lower.abs();
            t += stride;
        }
    };
    add_nodes(1.0, 1.0, &mut node_sum, &mut absolute_sum, &mut integrand)?;
    let mut estimate = step * node_sum;
    let mut previous_change = f64::INFINITY;
    let mut level = 0;
    loop {
        step *= 0.5;
        level += 1;
        add_nodes(step, 2.0 * step, &mut node_sum, &mut absolute_sum, &mut integrand)?;
        let next = step * node_sum;
        let change = (next - estimate).abs();
        estimate = next;
        if change <= NUMERIC_TOLERANCE * step * absolute_sum {
            return Ok(estimate);
        }
        if level >= 4 && change >= previous_change {
            return Ok(estimate);
        }
        if step <= f64::EPSILON {
            return Ok(estimate);
        }
        previous_change = change;
    }
}

fn integrate_between<F: FnMut(f64, f64) -> Result<f64>>(
    start: f64,
    end: f64,
    end_complement: f64,
    mut integrand: F,
) -> Result<f64> {
    let width = end - start;
    if width <= 0.0 {
        return Ok(0.0);
    }
    Ok(width
        * tanh_sinh(|r, one_minus_r| {
            integrand(start + width * r, end_complement + width * one_minus_r)
        })?)
}

pub(crate) fn open_unit_pair<R: RngCore + ?Sized>(rng: &mut R) -> (f64, f64) {
    let resolution = (1u64 << f64::MANTISSA_DIGITS) as f64;
    let numerator = ((rng.next_u64() >> (u64::BITS - f64::MANTISSA_DIGITS + 1)) * 2 + 1) as f64;
    (numerator / resolution, (resolution - numerator) / resolution)
}

fn standard_normal<R: Rng + ?Sized>(rng: &mut R) -> f64 {
    rng.sample(StandardNormal)
}

fn draw_error(message: String) -> PraxisError {
    math_error(format!("a random draw cannot be made: {}", message))
}

fn atom_draw<R: Rng + ?Sized>(atoms: &[Atom], rng: &mut R) -> f64 {
    let (u, _) = open_unit_pair(rng);
    let index = atoms.partition_point(|atom| atom.cumulative < u).min(atoms.len() - 1);
    atoms[index].value
}

fn logistic(value: f64) -> f64 {
    if value >= 0.0 {
        1.0 / (1.0 + (-value).exp())
    } else {
        let exponential = value.exp();
        exponential / (1.0 + exponential)
    }
}

pub(crate) const KRONROD_NODES: [f64; 11] = [
    0.995_657_163_025_808_1,
    0.973_906_528_517_171_7,
    0.930_157_491_355_708_2,
    0.865_063_366_688_984_5,
    0.780_817_726_586_416_9,
    0.679_409_568_299_024_4,
    0.562_757_134_668_604_7,
    0.433_395_394_129_247_2,
    0.294_392_862_701_460_2,
    0.148_874_338_981_631_2,
    0.0,
];
pub(crate) const KRONROD_WEIGHTS: [f64; 11] = [
    0.011_694_638_867_371_874,
    0.032_558_162_307_964_73,
    0.054_755_896_574_351_996,
    0.075_039_674_810_919_95,
    0.093_125_454_583_697_6,
    0.109_387_158_802_297_64,
    0.123_491_976_262_065_85,
    0.134_709_217_311_473_33,
    0.142_775_938_577_060_08,
    0.147_739_104_901_338_49,
    0.149_445_554_002_916_9,
];
pub(crate) const GAUSS_WEIGHTS: [f64; 5] = [
    0.066_671_344_308_688_14,
    0.149_451_349_150_580_6,
    0.219_086_362_515_982_04,
    0.269_266_719_309_996_35,
    0.295_524_224_714_752_87,
];

pub const NUMERIC_TOLERANCE: f64 = 1e-6;

const POPULATION_PANELS: usize = 4096;

const HERMITE_ORDERS: [usize; 3] = [20, 40, 80];

const UNDERFLOW_DROP: f64 = 745.0;

pub const NORMAL_QUANTILE_95: f64 = 1.6448536269514722;

pub fn exp_minus_one_over_x_squared(x: f64) -> Result<f64> {
    if x.abs() < 1.0 {
        let mut term = 0.5;
        let mut total = 0.0;
        let mut n = 2.0;
        loop {
            let next = total + term;
            if next == total {
                return Ok(total);
            }
            total = next;
            n += 1.0;
            term *= x / n;
        }
    }
    Ok((kernels::exp_minus_one(x)? - x) / (x * x))
}

#[derive(Debug, Clone)]
struct Atom {
    value: f64,
    cumulative: f64,
}

fn atoms_from(mut pairs: Vec<(f64, f64)>) -> Result<Vec<Atom>> {
    pairs.sort_by(|left, right| left.0.total_cmp(&right.0));
    let total: f64 = pairs.iter().map(|pair| pair.1).sum();
    if total.is_nan() || total <= 0.0 {
        return Err(math_error("weights must have a positive sum".to_string()));
    }
    let mut atoms: Vec<Atom> = Vec::with_capacity(pairs.len());
    let mut running = 0.0;
    for (value, weight) in pairs {
        running += weight;
        match atoms.last_mut() {
            Some(last) if last.value == value => last.cumulative = running / total,
            _ => atoms.push(Atom {
                value,
                cumulative: running / total,
            }),
        }
    }
    if let Some(last) = atoms.last_mut() {
        last.cumulative = 1.0;
    }
    Ok(atoms)
}

fn atom_probabilities(atoms: &[Atom]) -> impl Iterator<Item = (f64, f64)> + '_ {
    atoms.iter().enumerate().map(|(index, atom)| {
        let before = if index == 0 {
            0.0
        } else {
            atoms[index - 1].cumulative
        };
        (atom.value, atom.cumulative - before)
    })
}

fn metalog_basis(term: usize, y: f64, one_minus_y: f64) -> f64 {
    let logit = y.ln() - one_minus_y.ln();
    let centered = if y <= 0.5 { y - 0.5 } else { 0.5 - one_minus_y };
    match term {
        1 => 1.0,
        2 => logit,
        3 => centered * logit,
        4 => centered,
        odd if odd % 2 == 1 => centered.powi(((odd - 1) / 2) as i32),
        even => centered.powi((even / 2 - 1) as i32) * logit,
    }
}

fn metalog_core(coefficients: &[f64], y: f64, one_minus_y: f64) -> f64 {
    coefficients
        .iter()
        .enumerate()
        .map(|(index, coefficient)| coefficient * metalog_basis(index + 1, y, one_minus_y))
        .sum()
}

fn metalog_scaled_slope(coefficients: &[f64], y: f64) -> f64 {
    let spread = y * (1.0 - y);
    let logit = (y / (1.0 - y)).ln();
    let centered = y - 0.5;
    coefficients
        .iter()
        .enumerate()
        .map(|(index, coefficient)| {
            let term = index + 1;
            coefficient
                * match term {
                    1 => 0.0,
                    2 => 1.0,
                    3 => spread * logit + centered,
                    4 => spread,
                    odd if odd % 2 == 1 => {
                        let power = ((odd - 1) / 2) as i32;
                        spread * f64::from(power) * centered.powi(power - 1)
                    }
                    even => {
                        let power = (even / 2 - 1) as i32;
                        spread * f64::from(power) * centered.powi(power - 1) * logit
                            + centered.powi(power)
                    }
                }
        })
        .sum()
}

#[derive(Debug, Clone, Copy)]
struct Interval {
    low: f64,
    high: f64,
}

impl Interval {
    fn point(value: f64) -> Interval {
        Interval {
            low: value,
            high: value,
        }
    }

    fn add(self, other: Interval) -> Interval {
        Interval {
            low: self.low + other.low,
            high: self.high + other.high,
        }
    }

    fn multiply(self, other: Interval) -> Interval {
        let products = [
            self.low * other.low,
            self.low * other.high,
            self.high * other.low,
            self.high * other.high,
        ];
        Interval {
            low: products.iter().copied().fold(f64::INFINITY, f64::min),
            high: products.iter().copied().fold(f64::NEG_INFINITY, f64::max),
        }
    }

    fn scale(self, factor: f64) -> Interval {
        self.multiply(Interval::point(factor))
    }

    fn power(self, exponent: i32) -> Interval {
        if exponent == 0 {
            return Interval::point(1.0);
        }
        let low = self.low.powi(exponent);
        let high = self.high.powi(exponent);
        if exponent % 2 == 0 && self.low < 0.0 && self.high > 0.0 {
            Interval {
                low: 0.0,
                high: low.max(high),
            }
        } else {
            Interval {
                low: low.min(high),
                high: low.max(high),
            }
        }
    }
}

fn spread_logit(y: f64) -> f64 {
    if y <= 0.0 || y >= 1.0 {
        0.0
    } else {
        y * (1.0 - y) * (y / (1.0 - y)).ln()
    }
}

fn spread_logit_turning_point() -> Result<f64> {
    brent(
        |y| Ok((1.0 - 2.0 * y) * (y / (1.0 - y)).ln() + 1.0),
        f64::MIN_POSITIVE.sqrt(),
        0.5,
    )
}

fn range_on(
    function: impl Fn(f64) -> f64,
    low: f64,
    high: f64,
    turning_points: &[f64],
) -> Interval {
    let mut values = vec![function(low), function(high)];
    for point in turning_points {
        if *point > low && *point < high {
            values.push(function(*point));
        }
    }
    Interval {
        low: values.iter().copied().fold(f64::INFINITY, f64::min),
        high: values.iter().copied().fold(f64::NEG_INFINITY, f64::max),
    }
}

fn metalog_slope_bound(coefficients: &[f64], low: f64, high: f64, turning: f64) -> Interval {
    let spread = range_on(|y| y * (1.0 - y), low, high, &[0.5]);
    let centered = Interval {
        low: low - 0.5,
        high: high - 0.5,
    };
    let spread_log = range_on(spread_logit, low, high, &[turning, 1.0 - turning]);
    let mut total = Interval::point(0.0);
    for (index, coefficient) in coefficients.iter().enumerate() {
        let term = index + 1;
        let piece = match term {
            1 => Interval::point(0.0),
            2 => Interval::point(1.0),
            3 => spread_log.add(centered),
            4 => spread,
            odd if odd % 2 == 1 => {
                let power = ((odd - 1) / 2) as i32;
                spread
                    .multiply(centered.power(power - 1))
                    .scale(f64::from(power))
            }
            even => {
                let power = (even / 2 - 1) as i32;
                spread_log
                    .multiply(centered.power(power - 1))
                    .scale(f64::from(power))
                    .add(centered.power(power))
            }
        };
        total = total.add(piece.scale(*coefficient));
    }
    total
}

fn metalog_tail_exponents(coefficients: &[f64]) -> (f64, f64) {
    let mut endpoint_low = coefficients.get(1).copied().unwrap_or(0.0);
    let mut endpoint_high = endpoint_low;
    for (index, coefficient) in coefficients.iter().enumerate() {
        let term = index + 1;
        if term == 3 {
            endpoint_low -= 0.5 * coefficient;
            endpoint_high += 0.5 * coefficient;
        } else if term >= 6 && term % 2 == 0 {
            let power = (term / 2 - 1) as i32;
            endpoint_low += coefficient * (-0.5f64).powi(power);
            endpoint_high += coefficient * 0.5f64.powi(power);
        }
    }
    (endpoint_low, endpoint_high)
}

fn metalog_feasible(coefficients: &[f64]) -> Result<bool> {
    let turning = spread_logit_turning_point()?;
    let (endpoint_low, endpoint_high) = metalog_tail_exponents(coefficients);
    if !(endpoint_low > 0.0 && endpoint_high > 0.0) {
        return Ok(false);
    }
    let mut pending = vec![(0.0, 1.0)];
    while let Some((low, high)) = pending.pop() {
        if metalog_slope_bound(coefficients, low, high, turning).low > 0.0 {
            continue;
        }
        let middle = 0.5 * (low + high);
        if middle <= low || middle >= high {
            return Ok(false);
        }
        if metalog_scaled_slope(coefficients, middle) <= 0.0 {
            return Ok(false);
        }
        pending.push((low, middle));
        pending.push((middle, high));
    }
    Ok(true)
}

fn solve_linear(mut matrix: Vec<Vec<f64>>, mut right: Vec<f64>) -> Result<Vec<f64>> {
    let size = right.len();
    for column in 0..size {
        let pivot = (column..size)
            .max_by(|left, right_row| {
                matrix[*left][column]
                    .abs()
                    .total_cmp(&matrix[*right_row][column].abs())
            })
            .unwrap_or(column);
        if matrix[pivot][column] == 0.0 {
            return Err(math_error(
                "the metalog points do not determine a unique law".to_string(),
            ));
        }
        matrix.swap(column, pivot);
        right.swap(column, pivot);
        for row in column + 1..size {
            let factor = matrix[row][column] / matrix[column][column];
            let (above, below) = matrix.split_at_mut(row);
            for (target, source) in below[0][column..size].iter_mut().zip(&above[column][column..size]) {
                *target -= factor * source;
            }
            right[row] -= factor * right[column];
        }
    }
    let mut solution = vec![0.0; size];
    for row in (0..size).rev() {
        let known: f64 = (row + 1..size)
            .map(|column| matrix[row][column] * solution[column])
            .sum();
        solution[row] = (right[row] - known) / matrix[row][row];
    }
    Ok(solution)
}

#[derive(Debug, Clone)]
struct Constrained {
    log_strength: f64,
    lower_half: f64,
    upper_half: f64,
}

impl Constrained {
    fn weight(&self, from_zero: f64, from_one: f64) -> f64 {
        if self.log_strength <= 0.0 {
            (self.log_strength * from_zero.sin().powi(2)).exp()
        } else {
            (-self.log_strength * from_one.sin().powi(2)).exp()
        }
    }

    fn lower_between(&self, start: f64, end: f64, power: i32) -> Result<f64> {
        integrate_between(start, end, FRAC_PI_2 - end, |angle, rest| {
            Ok(angle.sin().powi(2).powi(power) * self.weight(angle, rest))
        })
    }

    fn upper_between(&self, start: f64, end: f64, power: i32) -> Result<f64> {
        integrate_between(start, end, FRAC_PI_2 - end, |angle, rest| {
            Ok(angle.cos().powi(2).powi(power) * self.weight(rest, angle))
        })
    }

    fn total(&self) -> f64 {
        self.lower_half + self.upper_half
    }

    fn with_strength(log_strength: f64) -> Result<Constrained> {
        let mut law = Constrained {
            log_strength,
            lower_half: 0.0,
            upper_half: 0.0,
        };
        law.lower_half = law.lower_between(0.0, FRAC_PI_4, 0)?;
        law.upper_half = law.upper_between(0.0, FRAC_PI_4, 0)?;
        Ok(law)
    }

    fn moment(&self, power: i32) -> Result<f64> {
        Ok((self.lower_between(0.0, FRAC_PI_4, power)? + self.upper_between(0.0, FRAC_PI_4, power)?)
            / self.total())
    }

    fn draw<R: Rng + ?Sized>(&self, rng: &mut R) -> f64 {
        loop {
            let (u, v) = open_unit_pair(rng);
            let angle = FRAC_PI_2 * u;
            let rest = FRAC_PI_2 * v;
            let (accept, _) = open_unit_pair(rng);
            if accept <= self.weight(angle, rest) {
                return angle.sin().powi(2);
            }
        }
    }

    fn mean_for(log_strength: f64) -> Result<f64> {
        Constrained::with_strength(log_strength)?.moment(1)
    }

    fn for_mean(mean: f64) -> Result<Constrained> {
        let log_strength = if mean == 0.5 {
            0.0
        } else if mean < 0.5 {
            let start = -0.5 / mean;
            let low = expand_bracket(|b| Ok(Constrained::mean_for(b)? - mean), 0.0, start)?;
            brent(|b| Ok(Constrained::mean_for(b)? - mean), low, 0.0)?
        } else {
            let start = 0.5 / (1.0 - mean);
            let high = expand_bracket(|b| Ok(Constrained::mean_for(b)? - mean), 0.0, start)?;
            brent(|b| Ok(Constrained::mean_for(b)? - mean), 0.0, high)?
        };
        Constrained::with_strength(log_strength)
    }

    fn variance(&self, mean: f64) -> Result<f64> {
        Ok(self.moment(2)? - mean * mean)
    }

    fn angles(probability: f64) -> (f64, f64) {
        (probability.sqrt().asin(), (1.0 - probability).sqrt().asin())
    }

    fn lower_cdf(&self, angle: f64) -> Result<f64> {
        Ok(self.lower_between(0.0, angle, 0)? / self.total())
    }

    fn lower_survival(&self, angle: f64) -> Result<f64> {
        Ok((self.lower_between(angle, FRAC_PI_4, 0)? + self.upper_half) / self.total())
    }

    fn upper_survival(&self, angle: f64) -> Result<f64> {
        Ok(self.upper_between(0.0, angle, 0)? / self.total())
    }

    fn upper_cdf(&self, angle: f64) -> Result<f64> {
        Ok((self.lower_half + self.upper_between(angle, FRAC_PI_4, 0)?) / self.total())
    }

    fn cdf(&self, probability: f64) -> Result<f64> {
        let (from_zero, from_one) = Constrained::angles(probability);
        if probability <= 0.5 {
            self.lower_cdf(from_zero)
        } else {
            self.upper_cdf(from_one)
        }
    }

    fn survival(&self, probability: f64) -> Result<f64> {
        let (from_zero, from_one) = Constrained::angles(probability);
        if probability >= 0.5 {
            self.upper_survival(from_one)
        } else {
            self.lower_survival(from_zero)
        }
    }

    fn density(&self, probability: f64) -> f64 {
        let (from_zero, from_one) = Constrained::angles(probability);
        self.weight(from_zero, from_one)
            / (self.total() * 2.0 * (probability * (1.0 - probability)).sqrt())
    }

    fn solve_angle<F: Fn(f64) -> Result<f64>>(&self, residual_of: F, rising: bool, upper_chart: bool) -> Result<f64> {
        let mut low = 0.0;
        let mut high = FRAC_PI_4;
        let mut angle = 0.5 * FRAC_PI_4;
        loop {
            let residual = residual_of(angle)?;
            let above = if rising { residual > 0.0 } else { residual < 0.0 };
            if residual == 0.0 {
                return Ok(angle);
            }
            if above {
                high = angle;
            } else {
                low = angle;
            }
            let slope = if upper_chart {
                self.weight(FRAC_PI_2 - angle, angle)
            } else {
                self.weight(angle, FRAC_PI_2 - angle)
            } / self.total();
            let signed = if rising { slope } else { -slope };
            let newton = angle - residual / signed;
            let next = if slope > 0.0 && newton > low && newton < high {
                newton
            } else {
                0.5 * (low + high)
            };
            if next == angle || high - low <= 2.0 * f64::EPSILON * high {
                return Ok(next);
            }
            angle = next;
        }
    }

    fn quantile(&self, u: f64, one_minus_u: f64) -> Result<f64> {
        if u <= self.lower_half / self.total() {
            let angle = if u <= 0.5 {
                self.solve_angle(|angle| Ok(self.lower_cdf(angle)? - u), true, false)?
            } else {
                self.solve_angle(|angle| Ok(self.lower_survival(angle)? - one_minus_u), false, false)?
            };
            Ok(angle.sin().powi(2))
        } else {
            let angle = if one_minus_u <= 0.5 {
                self.solve_angle(|angle| Ok(self.upper_survival(angle)? - one_minus_u), true, true)?
            } else {
                self.solve_angle(|angle| Ok(self.upper_cdf(angle)? - u), false, true)?
            };
            Ok(angle.cos().powi(2))
        }
    }
}

fn golden_maximum<F: FnMut(f64) -> Result<f64>>(mut objective: F) -> Result<f64> {
    let ratio = 0.5 * (5.0f64.sqrt() - 1.0);
    let mut low = 0.0;
    let mut high = 1.0;
    let mut left = high - ratio * (high - low);
    let mut right = low + ratio * (high - low);
    let mut left_value = objective(left)?;
    let mut right_value = objective(right)?;
    loop {
        if left_value < right_value {
            low = left;
            left = right;
            left_value = right_value;
            let next = low + ratio * (high - low);
            if next <= left || next >= high {
                return Ok(left);
            }
            right = next;
            right_value = objective(right)?;
        } else {
            high = right;
            right = left;
            right_value = left_value;
            let next = high - ratio * (high - low);
            if next >= right || next <= low {
                return Ok(right);
            }
            left = next;
            left_value = objective(left)?;
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum Axis {
    Unit,
    Line,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Spot {
    pub(crate) value: f64,
    pub(crate) complement: f64,
}

impl Spot {
    pub(crate) fn unit(value: f64, complement: f64) -> Spot {
        Spot { value, complement }
    }

    fn interior(self) -> bool {
        self.value > 0.0 && self.complement > 0.0
    }

    fn line(value: f64) -> Spot {
        Spot {
            value,
            complement: 0.0,
        }
    }
}

impl Axis {
    fn before(self, left: Spot, right: Spot) -> bool {
        match self {
            Axis::Unit if left.value >= 0.5 && right.value >= 0.5 => left.complement > right.complement,
            _ => left.value < right.value,
        }
    }

    fn width(self, start: Spot, end: Spot) -> f64 {
        match self {
            Axis::Unit if start.value >= 0.5 => start.complement - end.complement,
            _ => end.value - start.value,
        }
    }

    fn settled(self, spot: Spot) -> Spot {
        match self {
            Axis::Unit if spot.complement < spot.value => Spot::unit(1.0 - spot.complement, spot.complement),
            Axis::Unit => Spot::unit(spot.value, 1.0 - spot.value),
            Axis::Line => spot,
        }
    }

    fn between(self, start: Spot, end: Spot, width: f64, fraction: f64, rest: f64) -> Spot {
        self.settled(if fraction <= 0.5 {
            Spot {
                value: start.value + width * fraction,
                complement: start.complement - width * fraction,
            }
        } else {
            Spot {
                value: end.value - width * rest,
                complement: end.complement + width * rest,
            }
        })
    }

    fn shifted(self, spot: Spot, step: f64) -> Spot {
        self.settled(Spot {
            value: spot.value + step,
            complement: spot.complement - step,
        })
    }

    fn scale(self, spot: Spot) -> f64 {
        match self {
            Axis::Unit => spot.value.min(spot.complement),
            Axis::Line => spot.value.abs().max(1.0),
        }
    }

    fn integrate<F: FnMut(Spot) -> Result<f64>>(self, start: Spot, end: Spot, mut integrand: F) -> Result<f64> {
        if start == end {
            return Ok(0.0);
        }
        if self.before(end, start) {
            return Ok(-self.integrate(end, start, integrand)?);
        }
        let width = self.width(start, end);
        if width.is_nan() || width <= 0.0 {
            return Ok(0.0);
        }
        Ok(width
            * tanh_sinh(|fraction, rest| {
                integrand(self.between(start, end, width, fraction, rest))
            })?)
    }
}

#[derive(Debug, Clone, Copy)]
enum Rule {
    TanhSinh,
    Kronrod,
}

impl Rule {
    fn integrate<F: FnMut(Spot) -> Result<f64>>(self, axis: Axis, start: Spot, end: Spot, mut integrand: F) -> Result<f64> {
        match self {
            Rule::TanhSinh => axis.integrate(start, end, integrand),
            Rule::Kronrod => {
                if start == end {
                    return Ok(0.0);
                }
                if axis.before(end, start) {
                    return Ok(-self.integrate(axis, end, start, integrand)?);
                }
                let width = axis.width(start, end);
                if width.is_nan() || width <= 0.0 {
                    return Ok(0.0);
                }
                Ok(kronrod_collect(axis, &[start, end], NUMERIC_TOLERANCE, |spot| Ok((integrand(spot)?, ())))?
                    .into_iter()
                    .map(|(weight, value, _)| weight * value)
                    .sum())
            }
        }
    }
}

#[derive(Debug, Clone)]
struct Cells {
    axis: Axis,
    rule: Rule,
    knots: Vec<Spot>,
    below: Vec<f64>,
    above: Vec<f64>,
}

impl Cells {
    fn build<F: FnMut(Spot) -> Result<f64>>(axis: Axis, rule: Rule, mut knots: Vec<Spot>, mut integrand: F) -> Result<Cells> {
        knots.sort_by(|left, right| {
            if axis.before(*left, *right) {
                Ordering::Less
            } else if axis.before(*right, *left) {
                Ordering::Greater
            } else {
                Ordering::Equal
            }
        });
        knots.dedup_by(|later, earlier| !axis.before(*earlier, *later));
        let pieces = knots
            .windows(2)
            .map(|pair| rule.integrate(axis, pair[0], pair[1], &mut integrand))
            .collect::<Result<Vec<f64>>>()?;
        let mut below = vec![0.0];
        let mut running = 0.0;
        for piece in &pieces {
            running += piece;
            below.push(running);
        }
        let mut above = vec![0.0; knots.len()];
        let mut running = 0.0;
        for (index, piece) in pieces.iter().enumerate().rev() {
            running += piece;
            above[index] = running;
        }
        if !(running > 0.0 && running.is_finite()) {
            return Err(math_error(
                "the evidence leaves the law no probability".to_string(),
            ));
        }
        Ok(Cells {
            axis,
            rule,
            knots,
            below,
            above,
        })
    }

    fn total(&self) -> f64 {
        self.above[0]
    }

    fn cell(&self, spot: Spot) -> usize {
        let mut low = 0;
        let mut high = self.knots.len() - 2;
        while low < high {
            let middle = (low + high).div_ceil(2);
            if self.axis.before(spot, self.knots[middle]) {
                high = middle - 1;
            } else {
                low = middle;
            }
        }
        low
    }

    fn below_at<F: FnMut(Spot) -> Result<f64>>(&self, spot: Spot, integrand: F) -> Result<f64> {
        let index = self.cell(spot);
        Ok(self.below[index] + self.rule.integrate(self.axis, self.knots[index], spot, integrand)?)
    }

    fn above_at<F: FnMut(Spot) -> Result<f64>>(&self, spot: Spot, integrand: F) -> Result<f64> {
        let index = self.cell(spot);
        Ok(self.above[index + 1] + self.rule.integrate(self.axis, spot, self.knots[index + 1], integrand)?)
    }

    fn moment<F: FnMut(Spot) -> Result<f64>>(&self, mut integrand: F) -> Result<f64> {
        let mut total = 0.0;
        for pair in self.knots.windows(2) {
            total += self.rule.integrate(self.axis, pair[0], pair[1], &mut integrand)?;
        }
        Ok(total / self.total())
    }

    fn solve<F: FnMut(Spot) -> Result<f64>>(&self, probability: f64, complement: f64, mut integrand: F) -> Result<Spot> {
        require_open_unit(probability, complement)?;
        let axis = self.axis;
        let total = self.total();
        let from_below = probability <= 0.5;
        let target = if from_below {
            probability * total
        } else {
            complement * total
        };
        let last = self.knots.len() - 2;
        let index = if from_below {
            self.below[1..=last].iter().take_while(|mass| **mass <= target).count()
        } else {
            last - self.above[1..=last]
                .iter()
                .rev()
                .take_while(|mass| **mass <= target)
                .count()
        };
        let mut low = self.knots[index];
        let mut high = self.knots[index + 1];
        let mut anchor = if from_below { self.below[index] } else { self.above[index + 1] };
        let mut spot = axis.between(low, high, axis.width(low, high), 0.5, 0.5);
        loop {
            let mass = if from_below {
                anchor + self.rule.integrate(axis, low, spot, &mut integrand)?
            } else {
                anchor + self.rule.integrate(axis, spot, high, &mut integrand)?
            };
            let residual = target - mass;
            if residual == 0.0 {
                return Ok(spot);
            }
            let short = residual > 0.0;
            if short == from_below {
                low = spot;
            } else {
                high = spot;
            }
            if short {
                anchor = mass;
            }
            let width = axis.width(low, high);
            let density = integrand(spot)?;
            let step = if from_below { residual } else { -residual };
            let next = if density > 0.0 && density.is_finite() {
                let candidate = axis.shifted(spot, step / density);
                if axis.before(low, candidate) && axis.before(candidate, high) {
                    candidate
                } else {
                    axis.between(low, high, width, 0.5, 0.5)
                }
            } else {
                axis.between(low, high, width, 0.5, 0.5)
            };
            if next == spot || width <= 4.0 * f64::EPSILON * axis.scale(spot) {
                return Ok(next);
            }
            let moved = if axis.before(spot, next) { axis.width(spot, next) } else { axis.width(next, spot) };
            if density > 0.0 && moved <= NUMERIC_TOLERANCE * axis.scale(next) {
                return Ok(next);
            }
            spot = next;
        }
    }
}

const LIKELIHOOD_LEVELS: [f64; 7] = [0.125, 0.5, 2.0, 8.0, 32.0, 128.0, 512.0];

const MODE_SCAN_POINTS: usize = 241;

const MODE_SCAN_REACH: f64 = 60.0;

const COMBINATION_LIMIT: usize = 4096;

const SLOPE_STEP: f64 = 1e-4;

fn power_log(power: f64, log_base: f64) -> f64 {
    if power == 0.0 {
        0.0
    } else {
        power * log_base
    }
}

fn log_sum(logs: impl Iterator<Item = f64>) -> f64 {
    let values: Vec<f64> = logs.collect();
    let top = values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    if !top.is_finite() {
        return top;
    }
    top + values.iter().map(|value| (value - top).exp()).sum::<f64>().ln()
}

#[derive(Debug, Clone, Copy)]
struct Standby {
    random: bool,
    failures: f64,
    survivals: f64,
    interval: f64,
}

impl Standby {
    fn log_likelihood(&self, theta: f64) -> Result<f64> {
        if theta <= 0.0 {
            return Ok(if self.failures > 0.0 { f64::NEG_INFINITY } else { 0.0 });
        }
        let x = self.interval * theta;
        let log_failed_mass = (-(-x).exp_m1()).ln();
        if self.random {
            let log_fail = (x * exp_minus_one_over_x_squared(-x)?).ln();
            let log_survive = log_failed_mass - x.ln();
            Ok(power_log(self.failures, log_fail) + power_log(self.survivals, log_survive))
        } else {
            Ok(power_log(self.failures, log_failed_mass) - self.survivals * x)
        }
    }

    fn log_slope(&self, theta: f64) -> Result<f64> {
        if theta <= 0.0 {
            return Ok(self.failures);
        }
        let x = self.interval * theta;
        let ratio = if x > UNDERFLOW_DROP { 0.0 } else { x / x.exp_m1() };
        if self.random {
            let survive_slope = ratio - 1.0;
            let survive = -(-x).exp_m1() / x;
            let fail = x * exp_minus_one_over_x_squared(-x)?;
            Ok(self.failures * (-survive_slope * survive / fail) + self.survivals * survive_slope)
        } else {
            Ok(self.failures * ratio - self.survivals * x)
        }
    }
}

#[derive(Debug, Clone)]
struct Uncertain {
    binomial: bool,
    exposure: f64,
    outcomes: Vec<(f64, f64)>,
}

impl Uncertain {
    fn from_term(count: CountLikelihood, outcomes: &[DiscreteOutcome], exposure: f64) -> Result<Uncertain> {
        let total: f64 = outcomes.iter().map(|outcome| outcome.weight).sum();
        let binomial = count == CountLikelihood::Binomial;
        let constant_of = |failures: f64| -> Result<f64> {
            Ok(if binomial {
                kernels::log_gamma(exposure + 1.0)? - kernels::log_gamma(failures + 1.0)?
                    - kernels::log_gamma(exposure - failures + 1.0)?
            } else {
                power_log(failures, exposure.ln()) - kernels::log_gamma(failures + 1.0)?
            })
        };
        let outcomes = outcomes
            .iter()
            .map(|outcome| Ok((outcome.value, (outcome.weight / total).ln() + constant_of(outcome.value)?)))
            .collect::<Result<Vec<(f64, f64)>>>()?;
        Ok(Uncertain {
            binomial,
            exposure,
            outcomes,
        })
    }

    fn parts(&self, theta: f64) -> Result<Vec<f64>> {
        let log_theta = if theta > 0.0 { theta.ln() } else { f64::NEG_INFINITY };
        let log_rest = if self.binomial {
            if theta < 1.0 {
                (-theta).ln_1p()
            } else {
                f64::NEG_INFINITY
            }
        } else {
            0.0
        };
        Ok(self
            .outcomes
            .iter()
            .map(|(failures, log_weight)| {
                let rest = if self.binomial {
                    power_log(self.exposure - failures, log_rest)
                } else {
                    0.0
                };
                log_weight + power_log(*failures, log_theta) + rest
            })
            .collect())
    }

    fn log_likelihood(&self, theta: f64) -> Result<f64> {
        if theta < 0.0 || (self.binomial && theta > 1.0) {
            return Ok(f64::NEG_INFINITY);
        }
        let shared = if self.binomial { 0.0 } else { -self.exposure * theta };
        Ok(log_sum(self.parts(theta)?.into_iter()) + shared)
    }

    fn log_slope(&self, theta: f64) -> Result<f64> {
        let parts = self.parts(theta)?;
        let total = log_sum(parts.iter().copied());
        let mut slope = 0.0;
        for ((failures, _), part) in self.outcomes.iter().zip(parts) {
            let share = (part - total).exp();
            let own = if self.binomial {
                failures - (self.exposure - failures) * theta / (1.0 - theta)
            } else {
                failures - self.exposure * theta
            };
            if share > 0.0 {
                slope += share * own;
            }
        }
        Ok(slope)
    }
}

#[derive(Debug, Clone)]
struct Evidence {
    failures: f64,
    survivals: f64,
    exposure: f64,
    binomial: bool,
    standby: Vec<Standby>,
    uncertain: Vec<Uncertain>,
}

impl Evidence {
    fn counts(failures: f64, survivals: f64, exposure: f64, binomial: bool) -> Evidence {
        Evidence {
            failures,
            survivals,
            exposure,
            binomial,
            standby: Vec::new(),
            uncertain: Vec::new(),
        }
    }

    fn from_terms(terms: &[EvidenceTerm]) -> Result<Evidence> {
        let mut evidence = Evidence::counts(0.0, 0.0, 0.0, false);
        for term in terms {
            match term {
                EvidenceTerm::Binomial { failures, exposure } => {
                    evidence.failures += failures;
                    evidence.survivals += exposure - failures;
                    evidence.binomial = true;
                }
                EvidenceTerm::Poisson { failures, exposure } => {
                    evidence.failures += failures;
                    evidence.exposure += exposure;
                }
                EvidenceTerm::StandbyDemand {
                    demand,
                    failures,
                    exposure,
                    test_interval,
                } => evidence.standby.push(Standby {
                    random: *demand == StandbyDemandKind::Random,
                    failures: *failures,
                    survivals: exposure - failures,
                    interval: *test_interval,
                }),
                EvidenceTerm::UncertainCount {
                    count,
                    outcomes,
                    exposure,
                } => evidence.uncertain.push(Uncertain::from_term(*count, outcomes, *exposure)?),
            }
        }
        Ok(evidence)
    }

    fn is_plain(&self) -> bool {
        self.standby.is_empty() && self.uncertain.is_empty()
    }

    fn bounded(&self) -> bool {
        self.binomial || self.uncertain.iter().any(|term| term.binomial)
    }

    fn rate_bounded(&self) -> bool {
        self.exposure > 0.0
            || self.survivals > 0.0
            || !self.uncertain.is_empty()
            || self.standby.iter().any(|term| term.survivals > 0.0)
    }

    fn gamma_conjugate(&self) -> bool {
        !self.binomial && self.standby.is_empty() && self.uncertain.iter().all(|term| !term.binomial)
    }

    fn beta_conjugate(&self) -> bool {
        self.exposure == 0.0 && self.standby.is_empty() && self.uncertain.iter().all(|term| term.binomial)
    }

    fn reach(&self) -> f64 {
        self.exposure
            + self.survivals
            + self
                .standby
                .iter()
                .map(|term| (term.failures + term.survivals) * term.interval)
                .sum::<f64>()
            + self.uncertain.iter().map(|term| term.exposure).sum::<f64>()
    }

    fn plain_mode(&self) -> f64 {
        let (failures, survivals, exposure) = (self.failures, self.survivals, self.exposure);
        if failures == 0.0 {
            0.0
        } else if survivals == 0.0 && exposure == 0.0 {
            1.0
        } else if survivals == 0.0 {
            failures / exposure
        } else if exposure == 0.0 {
            failures / (failures + survivals)
        } else {
            let sum = failures + survivals + exposure;
            2.0 * failures / (sum + (sum * sum - 4.0 * exposure * failures).sqrt())
        }
    }

    fn mode_within(&self, low: f64, high: f64) -> Result<f64> {
        if self.is_plain() {
            return Ok(self.plain_mode().clamp(low, high));
        }
        let reach = self.reach();
        let guess = if reach > 0.0 && reach.is_finite() {
            1.0 / reach
        } else {
            1.0
        };
        let start = if low > 0.0 { low.ln() } else { guess.ln() - MODE_SCAN_REACH };
        let end = if high.is_finite() { high.ln() } else { guess.ln() + MODE_SCAN_REACH };
        let step = (end - start) / (MODE_SCAN_POINTS - 1) as f64;
        let at = |index: usize| if index + 1 == MODE_SCAN_POINTS { end } else { start + step * index as f64 };
        let mut best = (0, f64::NEG_INFINITY);
        for index in 0..MODE_SCAN_POINTS {
            let value = self.log_likelihood(at(index).exp())?;
            if value > best.1 {
                best = (index, value);
            }
        }
        if !best.1.is_finite() {
            return Ok(low.max(guess).min(high));
        }
        if best.0 == 0 && low <= 0.0 && self.log_likelihood(0.0)? >= best.1 {
            return Ok(low);
        }
        let left = at(best.0.saturating_sub(1));
        let right = at((best.0 + 1).min(MODE_SCAN_POINTS - 1));
        let position = golden_maximum(|w| self.log_likelihood((left + w * (right - left)).exp()))?;
        let theta = (left + position * (right - left)).exp();
        Ok(if self.log_likelihood(theta)? >= best.1 {
            theta
        } else {
            at(best.0).exp()
        }
        .clamp(low, high))
    }

    fn log_likelihood(&self, theta: f64) -> Result<f64> {
        if theta.is_infinite() || theta.is_nan() {
            return Ok(f64::NEG_INFINITY);
        }
        let mut total = -self.exposure * theta;
        if self.failures > 0.0 {
            if theta <= 0.0 {
                return Ok(f64::NEG_INFINITY);
            }
            total += self.failures * theta.ln();
        }
        if self.survivals > 0.0 {
            if theta >= 1.0 {
                return Ok(f64::NEG_INFINITY);
            }
            total += self.survivals * kernels::log_one_plus(-theta)?;
        }
        for term in &self.standby {
            total += term.log_likelihood(theta)?;
        }
        for term in &self.uncertain {
            total += term.log_likelihood(theta)?;
        }
        Ok(total)
    }

    fn extra_slope(&self, theta: f64) -> Result<f64> {
        let mut slope = 0.0;
        for term in &self.standby {
            slope += term.log_slope(theta)?;
        }
        for term in &self.uncertain {
            slope += term.log_slope(theta)?;
        }
        Ok(slope)
    }

    fn log_slope(&self, theta: f64) -> f64 {
        let mut slope = self.failures - self.exposure * theta;
        if self.survivals > 0.0 {
            slope -= self.survivals * theta / (1.0 - theta);
        }
        if !self.is_plain() {
            slope += self.extra_slope(theta).unwrap_or(f64::NAN);
        }
        slope
    }

    fn log_curvature(&self, theta: f64) -> f64 {
        let mut curvature = -self.exposure * theta;
        if self.survivals > 0.0 {
            curvature -= self.survivals * theta / ((1.0 - theta) * (1.0 - theta));
        }
        if !self.is_plain() {
            let up = self.extra_slope(theta * SLOPE_STEP.exp()).unwrap_or(f64::NAN);
            let down = self.extra_slope(theta * (-SLOPE_STEP).exp()).unwrap_or(f64::NAN);
            curvature += (up - down) / (2.0 * SLOPE_STEP);
        }
        curvature
    }

    fn combinations(&self) -> Option<Vec<(f64, f64)>> {
        let mut combined: Vec<(f64, f64)> = vec![(0.0, 0.0)];
        for term in &self.uncertain {
            let mut next: Vec<(f64, f64)> = Vec::with_capacity(combined.len() * term.outcomes.len());
            for (log_weight, failures) in &combined {
                for (extra, own) in &term.outcomes {
                    next.push((log_weight + own, failures + extra));
                }
            }
            next.sort_by(|left, right| left.1.total_cmp(&right.1));
            let mut merged: Vec<(f64, f64)> = Vec::with_capacity(next.len());
            for (log_weight, failures) in next {
                match merged.last_mut() {
                    Some(last) if last.1 == failures => last.0 = log_sum([last.0, log_weight].into_iter()),
                    _ => merged.push((log_weight, failures)),
                }
            }
            if merged.len() > COMBINATION_LIMIT {
                return None;
            }
            combined = merged;
        }
        Some(combined)
    }

    fn level_points(&self, low: f64, high: f64, center: f64, peak: f64) -> Result<Vec<f64>> {
        let finite = |value: f64| value.max(-f64::MAX);
        let mut points = Vec::new();
        for level in LIKELIHOOD_LEVELS {
            let target = peak - level;
            if center > low && center > 0.0 {
                let edge = if low > 0.0 {
                    Some(self.log_likelihood(low)?)
                } else {
                    None
                };
                if edge.is_none_or(|value| value < target) {
                    let residual = |v: f64| Ok(finite(self.log_likelihood(v.exp())?) - target);
                    let anchor = center.ln();
                    let start = match edge {
                        Some(_) => Some(low.ln()),
                        None => expand_bracket(residual, anchor, anchor - 1.0).ok(),
                    };
                    if let Some(start) = start {
                        points.push(brent(residual, start, anchor)?.exp());
                    }
                }
            }
            if center < high {
                let edge = if high.is_finite() {
                    Some(self.log_likelihood(high)?)
                } else {
                    None
                };
                if edge.is_none_or(|value| value < target) {
                    let residual = |theta: f64| Ok(finite(self.log_likelihood(theta)?) - target);
                    let end = match edge {
                        Some(_) => high,
                        None => {
                            let step = if center > 0.0 {
                                center
                            } else {
                                1.0 / self.reach()
                            };
                            expand_bracket(residual, center, center + step)?
                        }
                    };
                    points.push(brent(residual, center, end)?);
                }
            }
        }
        Ok(points)
    }
}

fn conjugate_parts(parts: Vec<(f64, Prepared)>) -> Result<(Prepared, f64)> {
    let top = parts.iter().map(|(log, _)| *log).fold(f64::NEG_INFINITY, f64::max);
    if !top.is_finite() {
        return Err(math_error(
            "the evidence leaves the law no probability".to_string(),
        ));
    }
    let kept: Vec<(f64, Prepared)> = parts
        .into_iter()
        .map(|(log, posterior)| ((log - top).exp(), posterior))
        .filter(|(weight, _)| *weight > 0.0)
        .collect();
    let sum: f64 = kept.iter().map(|(weight, _)| weight).sum();
    if kept.len() == 1 {
        let (_, only) = kept.into_iter().next().ok_or_else(|| math_error("no posterior part".to_string()))?;
        return Ok((only, top + sum.ln()));
    }
    Ok((
        mixture(
            kept.into_iter()
                .map(|(weight, posterior)| (weight / sum, posterior))
                .collect(),
        ),
        top + sum.ln(),
    ))
}

fn conjugate_gamma(shape: f64, rate: f64, evidence: &Evidence, combinations: Vec<(f64, f64)>) -> Result<(Prepared, f64)> {
    let exposure = evidence.exposure + evidence.uncertain.iter().map(|term| term.exposure).sum::<f64>();
    let posterior_rate = rate + exposure;
    let prior_part = if rate > 0.0 { shape * rate.ln() } else { 0.0 };
    let parts = combinations
        .into_iter()
        .map(|(log_weight, extra)| {
            let posterior_shape = shape + evidence.failures + extra;
            Ok((
                log_weight + kernels::log_gamma(posterior_shape)? - kernels::log_gamma(shape)? + prior_part
                    - posterior_shape * posterior_rate.ln(),
                Prepared::Gamma {
                    shape: posterior_shape,
                    scale: 1.0 / posterior_rate,
                },
            ))
        })
        .collect::<Result<Vec<(f64, Prepared)>>>()?;
    conjugate_parts(parts)
}

fn conjugate_beta(alpha: f64, beta: f64, evidence: &Evidence, combinations: Vec<(f64, f64)>) -> Result<(Prepared, f64)> {
    let demands: f64 = evidence.uncertain.iter().map(|term| term.exposure).sum();
    let prior_part = log_beta(alpha, beta)?;
    let parts = combinations
        .into_iter()
        .map(|(log_weight, extra)| {
            let posterior_alpha = alpha + evidence.failures + extra;
            let posterior_beta = beta + evidence.survivals + demands - extra;
            Ok((
                log_weight + log_beta(posterior_alpha, posterior_beta)? - prior_part,
                Prepared::Beta {
                    alpha: posterior_alpha,
                    beta: posterior_beta,
                    lower: 0.0,
                    width: 1.0,
                },
            ))
        })
        .collect::<Result<Vec<(f64, Prepared)>>>()?;
    conjugate_parts(parts)
}

fn noninformative(evidence: &Evidence) -> Result<Prepared> {
    if !evidence.standby.is_empty() {
        if !evidence.bounded() && !evidence.rate_bounded() {
            return Err(math_error(
                "a posterior with no prior needs a standby demand without a failure or some exposure time"
                    .to_string(),
            ));
        }
        let prior = PriorShape::Power {
            exponent: -0.5,
            upper_log: evidence.bounded().then_some(0.0),
        };
        return Ok(Prepared::Density(Box::new(DensityPosterior::new(prior, evidence.clone())?)));
    }
    if evidence.bounded() {
        if evidence.is_plain() {
            let beta = Prepared::Beta {
                alpha: 0.5 + evidence.failures,
                beta: 0.5 + evidence.survivals,
                lower: 0.0,
                width: 1.0,
            };
            if evidence.exposure == 0.0 {
                return Ok(beta);
            }
            let tilt = Evidence::counts(0.0, 0.0, evidence.exposure, true);
            return Ok(Prepared::Posterior(Box::new(BayesPosterior::new(beta, tilt)?)));
        }
        let jeffreys = Prepared::Beta {
            alpha: 0.5,
            beta: 0.5,
            lower: 0.0,
            width: 1.0,
        };
        return Ok(updated(jeffreys, evidence)?.0);
    }
    match evidence.combinations() {
        Some(combinations) => Ok(conjugate_gamma(0.5, 0.0, evidence, combinations)?.0),
        None => {
            let prior = PriorShape::Power {
                exponent: -0.5,
                upper_log: None,
            };
            Ok(Prepared::Density(Box::new(DensityPosterior::new(prior, evidence.clone())?)))
        }
    }
}

#[derive(Debug, Clone)]
struct BayesPosterior {
    prior: Prepared,
    evidence: Evidence,
    peak: f64,
    cells: Cells,
    inverse_cost: usize,
}

impl BayesPosterior {
    fn new(prior: Prepared, evidence: Evidence) -> Result<BayesPosterior> {
        let (low, high) = prior.support();
        if low < 0.0 || (evidence.bounded() && high > 1.0) {
            return Err(math_error(
                "a posterior prior must stay inside the range its evidence allows".to_string(),
            ));
        }
        let center = evidence.mode_within(low, high)?;
        let peak = evidence.log_likelihood(center)?;
        if !peak.is_finite() {
            return Err(math_error(
                "the evidence is impossible everywhere inside the prior's support".to_string(),
            ));
        }
        let mut thetas = evidence.level_points(low, high, center, peak)?;
        if center > low && center < high {
            thetas.push(center);
        }
        let mut knots = vec![Spot::unit(0.0, 1.0), Spot::unit(1.0, 0.0)];
        for theta in thetas {
            knots.push(Axis::Unit.settled(Spot::unit(prior.cdf(theta)?, prior.survival(theta)?)));
        }
        for point in prior.quantile_breakpoints()? {
            knots.push(Spot::unit(point, 1.0 - point));
        }
        let cells = Cells::build(Axis::Unit, Rule::TanhSinh, knots, |spot| {
            if !spot.interior() {
                return Ok(0.0);
            }
            let theta = prior.quantile_pair(spot.value, spot.complement)?;
            Ok((evidence.log_likelihood(theta)? - peak).exp())
        })?;
        let mut posterior = BayesPosterior {
            prior,
            evidence,
            peak,
            cells,
            inverse_cost: 0,
        };
        let count = std::cell::Cell::new(0usize);
        posterior.cells.solve(0.5, 0.5, |spot| {
            count.set(count.get() + 1);
            posterior.integrand(spot)
        })?;
        posterior.inverse_cost = count.get();
        Ok(posterior)
    }

    fn draw<R: Rng + ?Sized>(&self, rng: &mut R) -> Result<f64> {
        if 1.0 / self.cells.total() > self.inverse_cost as f64 {
            let (u, v) = open_unit_pair(rng);
            return self.quantile(u, v);
        }
        loop {
            let theta = self.prior.draw(rng)?;
            let (accept, _) = open_unit_pair(rng);
            if accept.ln() <= self.evidence.log_likelihood(theta)? - self.peak {
                return Ok(theta);
            }
        }
    }

    fn integrand(&self, spot: Spot) -> Result<f64> {
        if !spot.interior() {
            return Ok(0.0);
        }
        let theta = self.prior.quantile_pair(spot.value, spot.complement)?;
        Ok((self.evidence.log_likelihood(theta)? - self.peak).exp())
    }

    fn weighted<F: Fn(f64) -> f64>(&self, spot: Spot, factor: F) -> Result<f64> {
        let weight = self.integrand(spot)?;
        if weight == 0.0 {
            return Ok(0.0);
        }
        Ok(factor(self.prior.quantile_pair(spot.value, spot.complement)?) * weight)
    }

    fn spot(&self, x: f64) -> Result<Spot> {
        Ok(Axis::Unit.settled(Spot::unit(self.prior.cdf(x)?, self.prior.survival(x)?)))
    }

    fn log_marginal(&self) -> f64 {
        self.cells.total().ln() + self.peak
    }

    fn cdf(&self, x: f64) -> Result<f64> {
        let (low, high) = self.prior.support();
        if x <= low {
            return Ok(0.0);
        }
        if x >= high {
            return Ok(1.0);
        }
        Ok(self.cells.below_at(self.spot(x)?, |spot| self.integrand(spot))? / self.cells.total())
    }

    fn survival(&self, x: f64) -> Result<f64> {
        let (low, high) = self.prior.support();
        if x <= low {
            return Ok(1.0);
        }
        if x >= high {
            return Ok(0.0);
        }
        Ok(self.cells.above_at(self.spot(x)?, |spot| self.integrand(spot))? / self.cells.total())
    }

    fn quantile(&self, u: f64, one_minus_u: f64) -> Result<f64> {
        let spot = self.cells.solve(u, one_minus_u, |spot| self.integrand(spot))?;
        self.prior.quantile_pair(spot.value, spot.complement)
    }

    fn density(&self, x: f64) -> Result<f64> {
        let weight = (self.evidence.log_likelihood(x)? - self.peak).exp();
        if weight == 0.0 {
            return Ok(0.0);
        }
        Ok(self.prior.density(x)? * weight / self.cells.total())
    }

    fn moments(&self) -> Result<(f64, f64)> {
        let mean = self.cells.moment(|spot| self.weighted(spot, |theta| theta))?;
        let variance = self
            .cells
            .moment(|spot| self.weighted(spot, |theta| (theta - mean).powi(2)))?;
        Ok((mean, variance))
    }
}

fn log_beta(alpha: f64, beta: f64) -> Result<f64> {
    Ok(kernels::log_gamma(alpha)? + kernels::log_gamma(beta)? - kernels::log_gamma(alpha + beta)?)
}

fn updated(prior: Prepared, evidence: &Evidence) -> Result<(Prepared, f64)> {
    Ok(match prior {
        Prepared::Gamma { shape, scale } if evidence.gamma_conjugate() && evidence.combinations().is_some() => {
            let combinations = evidence.combinations().unwrap_or_default();
            conjugate_gamma(shape, 1.0 / scale, evidence, combinations)?
        }
        Prepared::Beta {
            alpha,
            beta,
            lower,
            width,
        } if lower == 0.0 && width == 1.0 && evidence.beta_conjugate() && evidence.combinations().is_some() => {
            let combinations = evidence.combinations().unwrap_or_default();
            conjugate_beta(alpha, beta, evidence, combinations)?
        }
        Prepared::Point { value } => {
            let log_marginal = evidence.log_likelihood(value)?;
            if log_marginal == f64::NEG_INFINITY {
                return Err(math_error(
                    "the evidence is impossible at the prior's point value".to_string(),
                ));
            }
            (Prepared::Point { value }, log_marginal)
        }
        Prepared::Atoms { atoms } => {
            let logs = atom_probabilities(&atoms)
                .map(|(value, probability)| Ok((value, probability.ln() + evidence.log_likelihood(value)?)))
                .collect::<Result<Vec<(f64, f64)>>>()?;
            let top = logs.iter().map(|(_, log)| *log).fold(f64::NEG_INFINITY, f64::max);
            if top == f64::NEG_INFINITY {
                return Err(math_error(
                    "the evidence is impossible at every outcome of the prior".to_string(),
                ));
            }
            let pairs: Vec<(f64, f64)> = logs
                .into_iter()
                .map(|(value, log)| (value, (log - top).exp()))
                .filter(|(_, weight)| *weight > 0.0)
                .collect();
            let sum: f64 = pairs.iter().map(|(_, weight)| weight).sum();
            (Prepared::Atoms { atoms: atoms_from(pairs)? }, top + sum.ln())
        }
        Prepared::Mixture { components, .. } => {
            let parts = components
                .into_iter()
                .map(|(weight, component)| {
                    let (posterior, log_marginal) = updated(component, evidence)?;
                    Ok((weight.ln() + log_marginal, posterior))
                })
                .collect::<Result<Vec<(f64, Prepared)>>>()?;
            let top = parts.iter().map(|(log, _)| *log).fold(f64::NEG_INFINITY, f64::max);
            let kept: Vec<(f64, Prepared)> = parts
                .into_iter()
                .map(|(log, posterior)| ((log - top).exp(), posterior))
                .filter(|(weight, _)| *weight > 0.0)
                .collect();
            let sum: f64 = kept.iter().map(|(weight, _)| weight).sum();
            (
                mixture(
                    kept.into_iter()
                        .map(|(weight, posterior)| (weight / sum, posterior))
                        .collect(),
                ),
                top + sum.ln(),
            )
        }
        other if other.is_atomic() => {
            return Err(math_error(
                "a posterior needs a prior that is continuous or made of point masses only"
                    .to_string(),
            ))
        }
        other if other.quantile_is_closed() => {
            let posterior = BayesPosterior::new(other, evidence.clone())?;
            let log_marginal = posterior.log_marginal();
            (Prepared::Posterior(Box::new(posterior)), log_marginal)
        }
        other => {
            let (low, _) = other.support();
            if low < 0.0 {
                return Err(math_error(
                    "a posterior prior must stay inside the range its evidence allows".to_string(),
                ));
            }
            let posterior = DensityPosterior::new(PriorShape::Law(Box::new(other)), evidence.clone())?;
            let log_marginal = posterior.log_marginal();
            (Prepared::Density(Box::new(posterior)), log_marginal)
        }
    })
}

fn normal_mass(start: f64, end: f64) -> Result<f64> {
    if start > 0.0 {
        Ok(kernels::normal_cdf(-start)? - kernels::normal_cdf(-end)?)
    } else {
        Ok(kernels::normal_cdf(end)? - kernels::normal_cdf(start)?)
    }
}

fn gaussian_reach() -> f64 {
    (-2.0 * f64::from_bits(1).ln()).sqrt()
}

fn falling_root<F: Fn(f64) -> f64, G: Fn(f64) -> f64>(function: F, slope: G, start: f64, end: f64) -> f64 {
    let mut low = start;
    let mut high = end;
    let mut point = 0.5 * (low + high);
    loop {
        let value = function(point);
        if value == 0.0 {
            return point;
        }
        if value > 0.0 {
            low = point;
        } else {
            high = point;
        }
        let gradient = slope(point);
        let newton = point - value / gradient;
        let next = if gradient < 0.0 && newton > low && newton < high {
            newton
        } else {
            0.5 * (low + high)
        };
        if next == point || high - low <= 4.0 * f64::EPSILON * point.abs().max(1.0) {
            return next;
        }
        point = next;
    }
}

fn hermite_rule(order: usize) -> Vec<(f64, f64)> {
    let quarter = PI.powf(-0.25);
    let half = order.div_ceil(2);
    let mut physicists = vec![(0.0, 0.0); order];
    let mut z = 0.0;
    for index in 0..half {
        let n = order as f64;
        z = match index {
            0 => (2.0 * n + 1.0).sqrt() - 1.85575 * (2.0 * n + 1.0).powf(-0.16667),
            1 => z - 1.14 * n.powf(0.426) / z,
            2 => 1.86 * z - 0.86 * physicists[0].0,
            3 => 1.91 * z - 0.91 * physicists[1].0,
            _ => 2.0 * z - physicists[index - 2].0,
        };
        let mut slope = 0.0;
        for _ in 0..100 {
            let mut current = quarter;
            let mut previous = 0.0;
            for degree in 1..=order {
                let older = previous;
                previous = current;
                let j = degree as f64;
                current = z * (2.0 / j).sqrt() * previous - ((j - 1.0) / j).sqrt() * older;
            }
            slope = (2.0 * n).sqrt() * previous;
            let step = current / slope;
            z -= step;
            if step.abs() <= 3.0 * f64::EPSILON * z.abs().max(1.0) {
                break;
            }
        }
        let weight = 2.0 / (slope * slope);
        physicists[index] = (z, weight);
        physicists[order - 1 - index] = (-z, weight);
    }
    physicists
        .into_iter()
        .map(|(node, weight)| (std::f64::consts::SQRT_2 * node, std::f64::consts::SQRT_2 * weight))
        .collect()
}

fn hermite_rules() -> &'static [Vec<(f64, f64)>] {
    static RULES: std::sync::OnceLock<Vec<Vec<(f64, f64)>>> = std::sync::OnceLock::new();
    RULES.get_or_init(|| HERMITE_ORDERS.iter().map(|order| hermite_rule(*order)).collect())
}

fn hermite_marginal<F: Fn(f64) -> Result<f64>>(log_density: F, center: f64, width: f64, top: f64, limit: Option<f64>) -> Result<Option<f64>> {
    let rules = hermite_rules();
    let reach = rules.last().map_or(0.0, |rule| rule.iter().map(|(node, _)| node.abs()).fold(0.0, f64::max));
    if limit.is_some_and(|edge| center + width * reach >= edge) {
        return Ok(None);
    }
    let mut previous: Option<f64> = None;
    for rule in rules {
        let mut total = 0.0;
        for (node, weight) in rule {
            let value = (log_density(center + width * node)? - top + 0.5 * node * node).exp();
            if value.is_nan() {
                return Ok(None);
            }
            total += weight * value;
        }
        if !total.is_finite() {
            return Ok(None);
        }
        if let Some(earlier) = previous {
            if (total - earlier).abs() <= NUMERIC_TOLERANCE * total {
                return Ok(Some(width * total));
            }
        }
        previous = Some(total);
    }
    Ok(None)
}

fn member_log_marginal(member: &Evidence, mu: f64, sigma: f64, upper_log: Option<f64>) -> Result<f64> {
    let limit = upper_log.map(|bound| (bound - mu) / sigma);
    let upper = upper_log.map(f64::exp);
    let theta = |z: f64| -> f64 {
        let value = (mu + sigma * z).exp();
        match (limit, upper) {
            (Some(edge), Some(bound)) if z >= edge => bound,
            (_, Some(bound)) => value.min(bound),
            _ => value,
        }
    };
    let log_density = |z: f64| -> Result<f64> {
        if limit.is_some_and(|edge| z > edge) {
            return Ok(f64::NEG_INFINITY);
        }
        Ok(-0.5 * z * z + member.log_likelihood(theta(z))?)
    };
    let slope = |z: f64| sigma * member.log_slope(theta(z)) - z;
    let curvature = |z: f64| sigma * sigma * member.log_curvature(theta(z)) - 1.0;
    let rising_edge = |from: f64, step: f64| -> f64 {
        let mut reach = from + step;
        let mut stride = step;
        while slope(reach) > 0.0 {
            stride *= 2.0;
            reach = from + stride;
        }
        reach
    };
    let falling_edge = |from: f64, step: f64| -> f64 {
        let mut reach = from - step;
        let mut stride = step;
        while slope(reach) < 0.0 {
            stride *= 2.0;
            reach = from - stride;
        }
        reach
    };
    let interior = match limit {
        Some(edge) if slope(edge) >= 0.0 => edge,
        Some(edge) => falling_root(slope, curvature, falling_edge(edge, 1.0), edge),
        None => {
            let origin = slope(0.0);
            if origin == 0.0 {
                0.0
            } else if origin > 0.0 {
                falling_root(slope, curvature, 0.0, rising_edge(0.0, 1.0))
            } else {
                falling_root(slope, curvature, falling_edge(0.0, 1.0), 0.0)
            }
        }
    };
    let top = log_density(interior)?;
    let width = 1.0 / (-curvature(interior)).sqrt();
    let normalizer = match limit {
        Some(edge) => kernels::normal_cdf(edge)?.ln(),
        None => 0.0,
    };
    if let Some(mass) = hermite_marginal(log_density, interior, width, top, limit)? {
        return Ok(top + mass.ln() - 0.5 * (2.0 * PI).ln() - normalizer);
    }
    let step = if width.is_finite() && width > 0.0 { width } else { 1.0 };
    let mut breaks = vec![Spot::line(interior)];
    let mut reach = step;
    loop {
        let z = interior - reach;
        breaks.push(Spot::line(z));
        if log_density(z)? - top < -UNDERFLOW_DROP || reach > 1e6 {
            break;
        }
        reach *= 2.0;
    }
    let mut reach = step;
    loop {
        let z = interior + reach;
        if let Some(edge) = limit {
            if z >= edge {
                breaks.push(Spot::line(edge));
                break;
            }
        }
        breaks.push(Spot::line(z));
        if log_density(z)? - top < -UNDERFLOW_DROP || reach > 1e6 {
            break;
        }
        reach *= 2.0;
    }
    breaks.sort_by(|left, right| left.value.total_cmp(&right.value));
    let mass: f64 = kronrod_collect(Axis::Line, &breaks, NUMERIC_TOLERANCE, |spot| Ok(((log_density(spot.value)? - top).exp(), ())))?
        .into_iter()
        .map(|(weight, value, _)| weight * value)
        .sum();
    Ok(top + mass.ln() - 0.5 * (2.0 * PI).ln() - normalizer)
}

struct KronrodPanel<T> {
    start: Spot,
    end: Spot,
    value: f64,
    error: f64,
    floor: bool,
    nodes: Vec<(f64, f64, T)>,
}

fn kronrod_panel<T, F: FnMut(Spot) -> Result<(f64, T)>>(axis: Axis, start: Spot, end: Spot, integrand: &mut F) -> Result<KronrodPanel<T>> {
    let width = axis.width(start, end);
    let half = 0.5 * width;
    let mut nodes = Vec::with_capacity(21);
    let mut evaluate = |fraction: f64, rest: f64| -> Result<(f64, T)> {
        let (value, payload) = integrand(axis.between(start, end, width, fraction, rest))?;
        if value.is_nan() {
            return Err(math_error("an integrand is undefined at a quadrature node".to_string()));
        }
        Ok((value, payload))
    };
    let (center, payload) = evaluate(0.5, 0.5)?;
    let mut kronrod = KRONROD_WEIGHTS[10] * center;
    let mut gauss = 0.0;
    nodes.push((KRONROD_WEIGHTS[10] * half, center, payload));
    for node in 0..10 {
        let offset = KRONROD_NODES[node];
        let near = 0.5 * (1.0 - offset);
        let far = 0.5 * (1.0 + offset);
        let (lower, lower_payload) = evaluate(near, far)?;
        let (upper, upper_payload) = evaluate(far, near)?;
        let pair = lower + upper;
        kronrod += KRONROD_WEIGHTS[node] * pair;
        if node % 2 == 1 {
            gauss += GAUSS_WEIGHTS[node / 2] * pair;
        }
        nodes.push((KRONROD_WEIGHTS[node] * half, lower, lower_payload));
        nodes.push((KRONROD_WEIGHTS[node] * half, upper, upper_payload));
    }
    let value = kronrod * half;
    let mean = 0.5 * kronrod;
    let mut spread = KRONROD_WEIGHTS[10] * (center - mean).abs();
    let mut magnitude = KRONROD_WEIGHTS[10] * center.abs();
    for (index, (_, sample, _)) in nodes.iter().enumerate().skip(1) {
        let weight = KRONROD_WEIGHTS[(index - 1) / 2];
        spread += weight * (sample - mean).abs();
        magnitude += weight * sample.abs();
    }
    spread *= half.abs();
    magnitude *= half.abs();
    let mut error = ((kronrod - gauss) * half).abs();
    if spread > 0.0 && error > 0.0 {
        error = spread * (200.0 * error / spread).powf(1.5).min(1.0);
    }
    if magnitude > f64::MIN_POSITIVE / (50.0 * f64::EPSILON) {
        error = error.max(50.0 * f64::EPSILON * magnitude);
    }
    Ok(KronrodPanel {
        start,
        end,
        value,
        error,
        floor: false,
        nodes,
    })
}

pub(crate) fn kronrod_collect<T, F: FnMut(Spot) -> Result<(f64, T)>>(axis: Axis, breaks: &[Spot], tolerance: f64, mut integrand: F) -> Result<Vec<(f64, f64, T)>> {
    let mut panels = Vec::new();
    for pair in breaks.windows(2) {
        if axis.width(pair[0], pair[1]) > 0.0 {
            panels.push(kronrod_panel(axis, pair[0], pair[1], &mut integrand)?);
        }
    }
    loop {
        let total: f64 = panels.iter().map(|panel| panel.value).sum();
        let open: f64 = panels.iter().filter(|panel| !panel.floor).map(|panel| panel.error).sum();
        if total.is_nan() || total <= 0.0 || open <= tolerance * total {
            break;
        }
        if panels.len() >= POPULATION_PANELS {
            return Err(math_error("the population integral does not settle".to_string()));
        }
        let worst = panels
            .iter()
            .enumerate()
            .filter(|(_, panel)| !panel.floor)
            .max_by(|left, right| left.1.error.total_cmp(&right.1.error))
            .map_or(0, |(index, _)| index);
        let panel = panels.swap_remove(worst);
        let width = axis.width(panel.start, panel.end);
        let middle = axis.between(panel.start, panel.end, width, 0.5, 0.5);
        if !(axis.width(panel.start, middle) > 0.0 && axis.width(middle, panel.end) > 0.0) {
            return Err(math_error("the population integral does not settle".to_string()));
        }
        let mut left = kronrod_panel(axis, panel.start, middle, &mut integrand)?;
        let mut right = kronrod_panel(axis, middle, panel.end, &mut integrand)?;
        let value = left.value + right.value;
        let floor = left.error + right.error >= 0.99 * panel.error && (value - panel.value).abs() <= 1e-5 * value.abs();
        left.floor = floor;
        right.floor = floor;
        panels.push(left);
        panels.push(right);
    }
    Ok(panels.into_iter().flat_map(|panel| panel.nodes).collect())
}

enum HyperAxis<'a> {
    Atoms(Vec<(f64, f64)>),
    Continuous(&'a Prepared),
}

impl<'a> HyperAxis<'a> {
    fn new(law: &'a Prepared) -> Result<HyperAxis<'a>> {
        match law {
            Prepared::Point { value } => Ok(HyperAxis::Atoms(vec![(*value, 1.0)])),
            Prepared::Atoms { atoms } => Ok(HyperAxis::Atoms(atom_probabilities(atoms).collect())),
            other if other.is_atomic() => Err(math_error(
                "a population hyperprior must be continuous or made of point masses only".to_string(),
            )),
            other => Ok(HyperAxis::Continuous(other)),
        }
    }

    fn value(&self, position: f64) -> Result<f64> {
        match self {
            HyperAxis::Atoms(atoms) => Ok(atoms[position as usize].0),
            HyperAxis::Continuous(law) => law.quantile_pair(position, 1.0 - position),
        }
    }

    fn best<F: FnMut(f64) -> Result<f64>>(&self, mut objective: F) -> Result<f64> {
        match self {
            HyperAxis::Atoms(atoms) => {
                let mut best = (0, f64::NEG_INFINITY);
                for (index, (value, _)) in atoms.iter().enumerate() {
                    let score = objective(*value)?;
                    if score > best.1 {
                        best = (index, score);
                    }
                }
                Ok(best.0 as f64)
            }
            HyperAxis::Continuous(law) => golden_maximum(|w| objective(law.quantile_pair(w, 1.0 - w)?)),
        }
    }

    fn breaks<F: FnMut(f64) -> Result<f64>>(&self, position: f64, peak: f64, mut objective: F) -> Result<Vec<Spot>> {
        let HyperAxis::Continuous(law) = self else {
            return Ok(Vec::new());
        };
        let center = Spot::unit(position, 1.0 - position);
        let mut breaks = vec![Spot::unit(0.0, 1.0), center, Spot::unit(1.0, 0.0)];
        let mut drop = |w: f64| -> Result<f64> {
            let inside = w.clamp(f64::MIN_POSITIVE, 1.0 - f64::EPSILON);
            let value = peak - objective(law.quantile_pair(inside, 1.0 - inside)?)?;
            Ok(if value.is_finite() { value } else { f64::MAX })
        };
        for step in [-1.0, 1.0] {
            let edge = if step < 0.0 { f64::MIN_POSITIVE } else { 1.0 - f64::EPSILON };
            if (edge - position) * step <= 0.0 {
                continue;
            }
            let edge_drop = drop(edge)?;
            let mut inner = position;
            for level in LIKELIHOOD_LEVELS {
                if edge_drop.is_nan() || edge_drop <= level {
                    break;
                }
                let found = brent(|w| Ok(drop(w)? - level), inner, edge)?;
                breaks.push(Spot::unit(found, 1.0 - found));
                inner = found;
            }
        }
        Ok(breaks)
    }

    fn collect<T, F: FnMut(f64) -> Result<(f64, T)>>(&self, breaks: &[Spot], tolerance: f64, mut integrand: F) -> Result<Vec<(f64, f64, T)>> {
        match self {
            HyperAxis::Atoms(atoms) => atoms
                .iter()
                .map(|(value, probability)| {
                    let (inside, payload) = integrand(*value)?;
                    Ok((*probability, inside, payload))
                })
                .collect(),
            HyperAxis::Continuous(law) => {
                let resolution = f64::MIN_POSITIVE / f64::EPSILON;
                let mut sorted: Vec<Spot> = breaks
                    .iter()
                    .copied()
                    .filter(|spot| spot.value == 0.0 || spot.complement == 0.0 || (spot.value > resolution && spot.complement > resolution))
                    .collect();
                sorted.sort_by(|left, right| left.value.total_cmp(&right.value));
                sorted.dedup_by(|later, earlier| later.value == earlier.value);
                kronrod_collect(Axis::Unit, &sorted, tolerance, |spot| integrand(law.quantile_pair(spot.value, spot.complement)?))
            }
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct Kernel {
    weight: f64,
    mu: f64,
    sigma: f64,
    mass: f64,
    beyond: f64,
}

fn pruned(mut weighted: Vec<(f64, f64, f64)>) -> Vec<(f64, f64, f64)> {
    weighted.retain(|(weight, _, _)| *weight > 0.0);
    weighted.sort_by(|left, right| left.0.total_cmp(&right.0));
    let total: f64 = weighted.iter().map(|(weight, _, _)| weight).sum();
    let mut dropped = 0.0;
    let mut start = 0;
    while start < weighted.len() && dropped + weighted[start].0 <= f64::EPSILON * total {
        dropped += weighted[start].0;
        start += 1;
    }
    weighted.split_off(start)
}

fn hyperposterior(
    mu_law: &Prepared,
    sigma_law: &Prepared,
    upper_log: Option<f64>,
    members: &[Evidence],
    target: Option<usize>,
) -> Result<Vec<Kernel>> {
    let joint = |mu: f64, sigma: f64| -> Result<(f64, f64)> {
        if sigma.is_nan() || sigma <= 0.0 {
            return Ok((f64::NEG_INFINITY, 0.0));
        }
        let mut total = 0.0;
        let mut own = 0.0;
        for (index, member) in members.iter().enumerate() {
            let log = member_log_marginal(member, mu, sigma, upper_log)?;
            total += log;
            if Some(index) == target {
                own = log;
            }
        }
        Ok((total, own))
    };
    let mu_axis = HyperAxis::new(mu_law)?;
    let sigma_axis = HyperAxis::new(sigma_law)?;
    let mut mu_position = mu_axis.best(|mu| Ok(joint(mu, sigma_axis.value(match &sigma_axis {
        HyperAxis::Atoms(_) => 0.0,
        HyperAxis::Continuous(_) => 0.5,
    })?)?.0))?;
    let mut sigma_position = sigma_axis.best(|sigma| Ok(joint(mu_axis.value(mu_position)?, sigma)?.0))?;
    let mut peak = joint(mu_axis.value(mu_position)?, sigma_axis.value(sigma_position)?)?.0;
    loop {
        let sigma_value = sigma_axis.value(sigma_position)?;
        let next_mu = mu_axis.best(|mu| Ok(joint(mu, sigma_value)?.0))?;
        let mu_value = mu_axis.value(next_mu)?;
        let next_sigma = sigma_axis.best(|sigma| Ok(joint(mu_value, sigma)?.0))?;
        let next_peak = joint(mu_value, sigma_axis.value(next_sigma)?)?.0;
        if next_peak.partial_cmp(&peak) != Some(Ordering::Greater) {
            break;
        }
        mu_position = next_mu;
        sigma_position = next_sigma;
        peak = next_peak;
    }
    if !peak.is_finite() {
        return Err(math_error(
            "the population evidence is impossible across the hyperprior".to_string(),
        ));
    }
    let mu_mode = mu_axis.value(mu_position)?;
    let sigma_mode = sigma_axis.value(sigma_position)?;
    let mu_breaks = mu_axis.breaks(mu_position, peak, |mu| Ok(joint(mu, sigma_mode)?.0))?;
    let sigma_breaks = sigma_axis.breaks(sigma_position, peak, |sigma| Ok(joint(mu_mode, sigma)?.0))?;
    let outer = sigma_axis.collect(&sigma_breaks, NUMERIC_TOLERANCE, |sigma| {
        let inner = mu_axis.collect(&mu_breaks, NUMERIC_TOLERANCE, |mu| {
            let (total, own) = joint(mu, sigma)?;
            Ok(((total - peak).exp(), (mu, own)))
        })?;
        let sum: f64 = inner.iter().map(|(weight, inside, _)| weight * inside).sum();
        Ok((sum, (sigma, inner)))
    })?;
    let mut full = Vec::new();
    let mut loo = Vec::new();
    for (outer_weight, _, (sigma, inner)) in outer {
        for (inner_weight, inside, (mu, own)) in inner {
            let weight = outer_weight * inner_weight * inside;
            if weight > 0.0 {
                full.push((weight, mu, sigma));
                if target.is_some() {
                    loo.push((weight.ln() - own, mu, sigma));
                }
            }
        }
    }
    let chosen = match target {
        None => full,
        Some(_) => {
            let top = loo.iter().map(|(log, _, _)| *log).fold(f64::NEG_INFINITY, f64::max);
            loo.into_iter().map(|(log, mu, sigma)| ((log - top).exp(), mu, sigma)).collect()
        }
    };
    let kept = pruned(chosen);
    if kept.is_empty() {
        return Err(math_error(
            "the population evidence leaves the hyperparameters no probability".to_string(),
        ));
    }
    let sum: f64 = kept.iter().map(|(weight, _, _)| weight).sum();
    kept.into_iter()
        .map(|(weight, mu, sigma)| {
            let (mass, beyond) = match upper_log {
                Some(bound) => (
                    kernels::normal_cdf((bound - mu) / sigma)?,
                    kernels::normal_cdf((mu - bound) / sigma)?,
                ),
                None => (1.0, 0.0),
            };
            Ok(Kernel {
                weight: weight / sum,
                mu,
                sigma,
                mass,
                beyond,
            })
        })
        .collect()
}

#[derive(Debug, Clone)]
enum PriorShape {
    Kernels { kernels: Vec<Kernel>, upper_log: Option<f64> },
    Law(Box<Prepared>),
    Power { exponent: f64, upper_log: Option<f64> },
}

fn kernel_density(kernels: &[Kernel], upper_log: Option<f64>, v: f64) -> f64 {
    if upper_log.is_some_and(|bound| v > bound) {
        return 0.0;
    }
    let mut total = 0.0;
    for kernel in kernels {
        let z = (v - kernel.mu) / kernel.sigma;
        total += kernel.weight * (-0.5 * z * z).exp() / (kernel.sigma * kernel.mass);
    }
    total / (2.0 * PI).sqrt()
}

impl PriorShape {
    fn log_density(&self, v: f64) -> Result<f64> {
        match self {
            PriorShape::Kernels { kernels, upper_log } => Ok(kernel_density(kernels, *upper_log, v)),
            PriorShape::Law(prior) => {
                let theta = v.exp();
                if !(theta > 0.0 && theta.is_finite()) {
                    return Ok(0.0);
                }
                Ok(prior.density(theta)? * theta)
            }
            PriorShape::Power { exponent, upper_log } => {
                if upper_log.is_some_and(|bound| v > bound) {
                    return Ok(0.0);
                }
                Ok(((exponent + 1.0) * v).exp())
            }
        }
    }

    fn bounds(&self) -> (f64, f64) {
        match self {
            PriorShape::Kernels { kernels, upper_log } => {
                let reach = gaussian_reach();
                let start = kernels
                    .iter()
                    .map(|kernel| kernel.mu - reach * kernel.sigma)
                    .fold(f64::INFINITY, f64::min);
                let end = kernels
                    .iter()
                    .map(|kernel| kernel.mu + reach * kernel.sigma)
                    .fold(f64::NEG_INFINITY, f64::max);
                (start, upper_log.map_or(end, |bound| end.min(bound)))
            }
            PriorShape::Law(prior) => {
                let (low, high) = prior.support();
                (if low > 0.0 { low.ln() } else { f64::NEG_INFINITY }, if high.is_finite() { high.ln() } else { f64::INFINITY })
            }
            PriorShape::Power { upper_log, .. } => (f64::NEG_INFINITY, upper_log.unwrap_or(f64::INFINITY)),
        }
    }
}

#[derive(Debug, Clone)]
struct DensityPosterior {
    prior: PriorShape,
    evidence: Evidence,
    peak: f64,
    cells: Cells,
    inverse_cost: usize,
    kernel_cumulative: Vec<f64>,
}

impl DensityPosterior {
    fn new(prior: PriorShape, evidence: Evidence) -> Result<DensityPosterior> {
        let (bound_start, bound_end) = prior.bounds();
        let low = if bound_start.is_finite() { bound_start.exp() } else { 0.0 };
        let high = if bound_end.is_finite() { bound_end.exp() } else { f64::INFINITY };
        let center = evidence.mode_within(low, high)?;
        let peak = evidence.log_likelihood(center)?;
        if !peak.is_finite() {
            return Err(math_error(
                "the evidence is impossible everywhere the prior reaches".to_string(),
            ));
        }
        let integrand = |v: f64| -> Result<f64> {
            let density = prior.log_density(v)?;
            if density == 0.0 {
                return Ok(0.0);
            }
            Ok(density * (evidence.log_likelihood(v.exp())? - peak).exp())
        };
        let mut inner: Vec<f64> = evidence
            .level_points(low, high, center, peak)?
            .into_iter()
            .map(f64::ln)
            .filter(|v| *v > bound_start && *v < bound_end)
            .collect();
        if center > low && center < high {
            inner.push(center.ln());
        }
        if inner.is_empty() {
            inner.push(if bound_start.is_finite() && bound_end.is_finite() {
                0.5 * (bound_start + bound_end)
            } else if bound_end.is_finite() {
                bound_end - 1.0
            } else if bound_start.is_finite() {
                bound_start + 1.0
            } else {
                0.0
            });
        }
        let lowest = inner.iter().copied().fold(f64::INFINITY, f64::min);
        let highest = inner.iter().copied().fold(f64::NEG_INFINITY, f64::max);
        let start = if bound_start.is_finite() {
            bound_start
        } else {
            let mut stride = 1.0;
            while integrand(lowest - stride)? > 0.0 {
                stride *= 2.0;
            }
            lowest - stride
        };
        let end = if bound_end.is_finite() {
            bound_end
        } else {
            let mut stride = 1.0;
            while integrand(highest + stride)? > 0.0 {
                stride *= 2.0;
            }
            highest + stride
        };
        let mut knots = vec![Spot::line(start), Spot::line(end)];
        knots.extend(inner.into_iter().filter(|v| *v > start && *v < end).map(Spot::line));
        let rule = match prior {
            PriorShape::Kernels { .. } => Rule::Kronrod,
            PriorShape::Law(_) | PriorShape::Power { .. } => Rule::TanhSinh,
        };
        let cells = Cells::build(Axis::Line, rule, knots, |spot| integrand(spot.value))?;
        let kernel_cumulative = match &prior {
            PriorShape::Kernels { kernels, .. } => kernels
                .iter()
                .scan(0.0, |running, kernel| {
                    *running += kernel.weight;
                    Some(*running)
                })
                .collect(),
            PriorShape::Law(_) | PriorShape::Power { .. } => Vec::new(),
        };
        let mut posterior = DensityPosterior {
            prior,
            evidence,
            peak,
            cells,
            inverse_cost: 0,
            kernel_cumulative,
        };
        let count = std::cell::Cell::new(0usize);
        posterior.cells.solve(0.5, 0.5, |spot| {
            count.set(count.get() + 1);
            posterior.integrand(spot)
        })?;
        posterior.inverse_cost = count.get();
        Ok(posterior)
    }

    fn prior_draw<R: Rng + ?Sized>(&self, rng: &mut R) -> Result<f64> {
        match &self.prior {
            PriorShape::Law(prior) => prior.draw(rng),
            PriorShape::Power { .. } => Err(math_error(
                "an improper prior cannot be drawn from".to_string(),
            )),
            PriorShape::Kernels { kernels, upper_log } => {
                let total = self.kernel_cumulative.last().copied().unwrap_or(1.0);
                loop {
                    let (u, _) = open_unit_pair(rng);
                    let index = self.kernel_cumulative.partition_point(|value| *value < u * total).min(kernels.len() - 1);
                    let kernel = &kernels[index];
                    let v = kernel.mu + kernel.sigma * standard_normal(rng);
                    if upper_log.is_none_or(|bound| v <= bound) {
                        return Ok(v.exp());
                    }
                }
            }
        }
    }

    fn draw<R: Rng + ?Sized>(&self, rng: &mut R) -> Result<f64> {
        if matches!(self.prior, PriorShape::Power { .. }) || 1.0 / self.cells.total() > self.inverse_cost as f64 {
            let (u, v) = open_unit_pair(rng);
            return self.quantile(u, v);
        }
        loop {
            let theta = self.prior_draw(rng)?;
            let (accept, _) = open_unit_pair(rng);
            if accept.ln() <= self.evidence.log_likelihood(theta)? - self.peak {
                return Ok(theta);
            }
        }
    }

    fn integrand(&self, spot: Spot) -> Result<f64> {
        let density = self.prior.log_density(spot.value)?;
        if density == 0.0 {
            return Ok(0.0);
        }
        Ok(density * (self.evidence.log_likelihood(spot.value.exp())? - self.peak).exp())
    }

    fn log_marginal(&self) -> f64 {
        self.cells.total().ln() + self.peak
    }

    fn range(&self) -> (f64, f64) {
        (
            self.cells.knots[0].value,
            self.cells.knots[self.cells.knots.len() - 1].value,
        )
    }

    fn support(&self) -> (f64, f64) {
        let (start, end) = self.range();
        (start.exp(), end.exp())
    }

    fn cdf(&self, x: f64) -> Result<f64> {
        let (start, end) = self.range();
        if x <= 0.0 || x.ln() <= start {
            return Ok(0.0);
        }
        if x.ln() >= end {
            return Ok(1.0);
        }
        Ok(self.cells.below_at(Spot::line(x.ln()), |spot| self.integrand(spot))? / self.cells.total())
    }

    fn survival(&self, x: f64) -> Result<f64> {
        let (start, end) = self.range();
        if x <= 0.0 || x.ln() <= start {
            return Ok(1.0);
        }
        if x.ln() >= end {
            return Ok(0.0);
        }
        Ok(self.cells.above_at(Spot::line(x.ln()), |spot| self.integrand(spot))? / self.cells.total())
    }

    fn quantile(&self, u: f64, one_minus_u: f64) -> Result<f64> {
        Ok(self
            .cells
            .solve(u, one_minus_u, |spot| self.integrand(spot))?
            .value
            .exp())
    }

    fn density(&self, x: f64) -> Result<f64> {
        if x <= 0.0 {
            return Ok(0.0);
        }
        Ok(self.integrand(Spot::line(x.ln()))? / (x * self.cells.total()))
    }

    fn moments(&self) -> Result<(f64, f64)> {
        let mean = self
            .cells
            .moment(|spot| Ok(spot.value.exp() * self.integrand(spot)?))?;
        let variance = self
            .cells
            .moment(|spot| Ok((spot.value.exp() - mean).powi(2) * self.integrand(spot)?))?;
        Ok((mean, variance))
    }
}

fn mixture(components: Vec<(f64, Prepared)>) -> Prepared {
    let cumulative = components
        .iter()
        .scan(0.0, |running, (weight, _)| {
            *running += weight;
            Some(*running)
        })
        .collect();
    Prepared::Mixture { components, cumulative }
}

fn lognormal_kernel(kernel: &Kernel, upper: Option<f64>) -> Prepared {
    let lognormal = Prepared::Lognormal {
        mean: (kernel.mu + 0.5 * kernel.sigma * kernel.sigma).exp(),
        sigma: kernel.sigma,
        median: kernel.mu.exp(),
    };
    match upper {
        Some(bound) => Prepared::Truncated {
            inner: Box::new(lognormal),
            lower: 0.0,
            upper: bound,
            cdf_lower: 0.0,
            cdf_upper: kernel.mass,
            survival_lower: 1.0,
            survival_upper: kernel.beyond,
        },
        None => lognormal,
    }
}

fn population(
    mu: &Law,
    sigma: &Law,
    upper: Option<f64>,
    terms: &[EvidenceTerm],
    target: Option<usize>,
) -> Result<Prepared> {
    let mu_law = Prepared::from_law(mu)?;
    let sigma_law = Prepared::from_law(sigma)?;
    let members: Vec<Evidence> = terms
        .iter()
        .map(|term| Evidence::from_terms(std::slice::from_ref(term)))
        .collect::<Result<Vec<Evidence>>>()?;
    let upper_log = upper.map(f64::ln);
    let kernels = hyperposterior(&mu_law, &sigma_law, upper_log, &members, target)?;
    match target {
        None => Ok(mixture(
            kernels
                .iter()
                .map(|kernel| (kernel.weight, lognormal_kernel(kernel, upper)))
                .collect(),
        )),
        Some(index) => Ok(Prepared::Density(Box::new(DensityPosterior::new(
            PriorShape::Kernels { kernels, upper_log },
            members[index].clone(),
        )?))),
    }
}

const OUTPUT_KNOTS: usize = 400;

const OUTPUT_SCORE_REACH: f64 = 8.3;

const OUTPUT_TAIL: f64 = 1e-9;

const OUTPUT_DIVERGENCE: f64 = 1e-3;

#[derive(Debug, Clone, Copy, PartialEq)]
enum Mapping {
    Survival { time: f64 },
    Reciprocal,
}

impl Mapping {
    fn apply(self, x: f64) -> f64 {
        match self {
            Mapping::Survival { time } => (-x * time).exp(),
            Mapping::Reciprocal => 1.0 / x,
        }
    }

    fn invert(self, y: f64) -> f64 {
        match self {
            Mapping::Survival { time } => -y.ln() / time,
            Mapping::Reciprocal => 1.0 / y,
        }
    }

    fn inverse_slope(self, y: f64) -> f64 {
        match self {
            Mapping::Survival { time } => 1.0 / (time * y),
            Mapping::Reciprocal => 1.0 / (y * y),
        }
    }
}

fn mapped(inner: Prepared, mapping: Mapping) -> Result<Prepared> {
    Ok(match inner {
        Prepared::Point { value } => Prepared::Point {
            value: mapping.apply(value),
        },
        Prepared::Atoms { atoms } => Prepared::Atoms {
            atoms: atoms_from(
                atom_probabilities(&atoms)
                    .map(|(value, probability)| (mapping.apply(value), probability))
                    .collect(),
            )?,
        },
        other => Prepared::Mapped {
            inner: Box::new(other),
            mapping,
        },
    })
}

fn duration(
    model: DurationModel,
    times: &[f64],
    censored: &[f64],
    priors: &[crate::core::distribution::DurationPrior],
    output: &DurationOutput,
) -> Result<Prepared> {
    if model != DurationModel::Exponential {
        return tabulated_output(inference::duration_atoms(model, times, censored, priors, output)?);
    }
    let failures = times.len() as f64;
    let exposure: f64 = times.iter().chain(censored.iter()).sum();
    let evidence = Evidence::counts(failures, 0.0, exposure, false);
    let posterior = match priors.iter().find(|prior| prior.parameter == DurationParameter::Rate) {
        Some(prior) => updated(Prepared::from_law(&prior.law)?, &evidence)?.0,
        None => Prepared::Gamma {
            shape: failures,
            scale: 1.0 / exposure,
        },
    };
    let mapping = match output {
        DurationOutput::Exceedance { time } => Mapping::Survival { time: *time },
        DurationOutput::Mean => Mapping::Reciprocal,
    };
    mapped(posterior, mapping)
}

fn empirical_bayes(evidence: &[crate::core::distribution::CountEvidence], target: Option<usize>) -> Result<Prepared> {
    let fitted = inference::fit_population(evidence)?;
    let member = match target {
        Some(index) => Some(evidence.get(index).ok_or_else(|| {
            math_error("an empirical Bayes target names one of its members".to_string())
        })?),
        None => None,
    };
    let failures = member.map_or(0.0, |term| term.failures);
    let exposure = member.map_or(0.0, |term| term.exposure);
    Ok(match fitted {
        inference::FittedPopulation::Gamma { shape, rate } => Prepared::Gamma {
            shape: shape + failures,
            scale: 1.0 / (rate + exposure),
        },
        inference::FittedPopulation::Beta { alpha, beta } => Prepared::Beta {
            alpha: alpha + failures,
            beta: beta + exposure - failures,
            lower: 0.0,
            width: 1.0,
        },
    })
}

fn segment_below(position: f64, start: (f64, f64), end: (f64, f64)) -> f64 {
    let ((low_value, low_weight), (high_value, high_weight)) = (start, end);
    let whole = 0.5 * (low_weight + high_weight);
    if low_value == high_value {
        return if position >= low_value { whole } else { 0.0 };
    }
    let cut = ((position - low_value) / (high_value - low_value)).clamp(0.0, 1.0);
    let before = low_weight * cut + 0.5 * (high_weight - low_weight) * cut * cut;
    if high_value > low_value {
        before
    } else {
        whole - before
    }
}

fn tabulated_output(rows: Vec<inference::OutputRow>) -> Result<Prepared> {
    let floor = f64::MIN_POSITIVE.ln();
    let mut segments: Vec<((f64, f64), (f64, f64))> = Vec::new();
    let mut nodes: Vec<(f64, f64)> = Vec::new();
    let mut lost = 0.0;
    for row in &rows {
        let cleaned: Vec<(f64, f64)> = row
            .iter()
            .map(|(value, weight)| {
                if value.is_nan() || *value == f64::INFINITY {
                    lost += weight;
                    (f64::NAN, 0.0)
                } else {
                    (value.max(floor), *weight)
                }
            })
            .collect();
        if cleaned.len() == 1 {
            if !cleaned[0].0.is_nan() && cleaned[0].1 > 0.0 {
                nodes.push(cleaned[0]);
                segments.push((cleaned[0], cleaned[0]));
            }
            continue;
        }
        for (index, node) in cleaned.iter().enumerate() {
            if !node.0.is_nan() && node.1 > 0.0 {
                let share = if index == 0 || index + 1 == cleaned.len() { 0.5 } else { 1.0 };
                nodes.push((node.0, node.1 * share));
            }
        }
        for pair in cleaned.windows(2) {
            if pair[0].1 + pair[1].1 <= 0.0 {
                continue;
            }
            match (pair[0].0.is_nan(), pair[1].0.is_nan()) {
                (false, false) => segments.push((pair[0], pair[1])),
                (false, true) => segments.push(((pair[0].0, pair[0].1), (pair[0].0, pair[0].1))),
                (true, false) => segments.push(((pair[1].0, pair[1].1), (pair[1].0, pair[1].1))),
                (true, true) => {}
            }
        }
    }
    let total: f64 = nodes.iter().map(|(_, weight)| weight).sum();
    if !(total > 0.0 && total.is_finite()) || lost > OUTPUT_TAIL * total {
        return Err(math_error(
            "the output has no finite posterior with these data. Add data or a prior".to_string(),
        ));
    }
    nodes.sort_by(|left, right| left.0.total_cmp(&right.0));
    let mean: f64 = nodes.iter().map(|(value, weight)| value.exp() * weight).sum::<f64>() / total;
    let variance: f64 = nodes
        .iter()
        .map(|(value, weight)| (value.exp() - mean).powi(2) * weight)
        .sum::<f64>()
        / total;
    let mut trimmed_mass = 0.0;
    let mut trimmed_sum = 0.0;
    for (value, weight) in &nodes {
        if trimmed_mass + weight > (1.0 - OUTPUT_TAIL) * total {
            break;
        }
        trimmed_mass += weight;
        trimmed_sum += value.exp() * weight;
    }
    if !mean.is_finite()
        || (trimmed_mass > 0.0 && (trimmed_sum / trimmed_mass - mean).abs() > OUTPUT_DIVERGENCE * mean.abs().max(f64::MIN_POSITIVE))
    {
        return Err(math_error(
            "the output has no finite posterior mean with these data. Add data or a prior".to_string(),
        ));
    }
    let segment_total: f64 = segments
        .iter()
        .map(|(start, end)| 0.5 * (start.1 + end.1))
        .sum();
    let low = segments
        .iter()
        .map(|(start, end)| start.0.min(end.0))
        .fold(f64::INFINITY, f64::min);
    let high = segments
        .iter()
        .map(|(start, end)| start.0.max(end.0))
        .fold(f64::NEG_INFINITY, f64::max);
    if high.partial_cmp(&low) != Some(Ordering::Greater) || segment_total.partial_cmp(&0.0) != Some(Ordering::Greater) {
        return Ok(Prepared::Point { value: mean });
    }
    let mut middles = Vec::with_capacity(nodes.len());
    let mut running = 0.0;
    for (value, weight) in &nodes {
        middles.push(((running + 0.5 * weight) / total, *value));
        running += weight;
    }
    let first = middles[0].0;
    let last = middles[middles.len() - 1].0;
    let mut ordinates = Vec::with_capacity(OUTPUT_KNOTS);
    if middles.len() > 1 && last > first {
        let last_complement = 0.5 * nodes[nodes.len() - 1].1 / total;
        let score_low = kernels::normal_quantile(first)?.max(-OUTPUT_SCORE_REACH);
        let score_high = (-kernels::normal_quantile(last_complement)?).min(OUTPUT_SCORE_REACH);
        let mut targets: Vec<f64> = Vec::with_capacity(OUTPUT_KNOTS);
        for index in 1..OUTPUT_KNOTS {
            let fraction = index as f64 / OUTPUT_KNOTS as f64;
            targets.push(kernels::normal_cdf(score_low + (score_high - score_low) * fraction)?);
        }
        targets.retain(|probability| *probability > first && *probability < last);
        targets.sort_by(f64::total_cmp);
        targets.dedup();
        let mut cursor = 0;
        for probability in targets {
            while cursor + 2 < middles.len() && middles[cursor + 1].0 < probability {
                cursor += 1;
            }
            let (left, right) = (middles[cursor], middles[cursor + 1]);
            let fraction = if right.0 > left.0 {
                ((probability - left.0) / (right.0 - left.0)).clamp(0.0, 1.0)
            } else {
                0.0
            };
            ordinates.push(left.1 + fraction * (right.1 - left.1));
        }
    }
    let mut points = vec![QuantilePoint {
        probability: 0.0,
        value: low.exp(),
    }];
    for ordinate in ordinates {
        if !(ordinate > low && ordinate < high) {
            continue;
        }
        let below: f64 = segments
            .iter()
            .map(|(start, end)| segment_below(ordinate, *start, *end))
            .sum::<f64>()
            / segment_total;
        let value = ordinate.exp();
        if below > 0.0
            && below < 1.0
            && points
                .last()
                .is_some_and(|point| below > point.probability && value > point.value)
        {
            points.push(QuantilePoint {
                probability: below,
                value,
            });
        }
    }
    let top = high.exp();
    if points.last().is_some_and(|point| point.value >= top) {
        points.pop();
    }
    points.push(QuantilePoint {
        probability: 1.0,
        value: top,
    });
    if points.len() < 2 || points[0].value >= top {
        return Ok(Prepared::Point { value: mean });
    }
    Ok(Prepared::Gridded {
        table: Box::new(Prepared::Tabulated {
            points,
            logarithmic: false,
        }),
        moments: (mean, variance),
    })
}

fn closed_parts(prepared: &Prepared, weight: f64, parts: &mut Vec<crate::core::distribution::MixtureComponent>) -> bool {
    let law = match prepared {
        Prepared::Point { value } => Law::Point { value: *value },
        Prepared::Gamma { shape, scale } => Law::Gamma {
            shape: *shape,
            rate: 1.0 / scale,
        },
        Prepared::Beta {
            alpha,
            beta,
            lower,
            width,
        } => Law::Beta {
            alpha: *alpha,
            beta: *beta,
            lower: *lower,
            upper: lower + width,
        },
        Prepared::Mixture { components, .. } => {
            return components
                .iter()
                .all(|(share, component)| closed_parts(component, weight * share, parts));
        }
        _ => return false,
    };
    parts.push(crate::core::distribution::MixtureComponent { weight, law });
    true
}

pub fn closed_form(law: &Law) -> Result<Option<Law>> {
    let prepared = Prepared::from_law(law)?;
    let mut parts = Vec::new();
    if !closed_parts(&prepared, 1.0, &mut parts) {
        return Ok(None);
    }
    Ok(match parts.len() {
        0 => None,
        1 => parts.pop().map(|part| part.law),
        _ => Some(Law::Mixture { components: parts }),
    })
}

const PRODUCT_TAIL: f64 = 1e-13;

const PRODUCT_STEP: f64 = 0.004;

const PRODUCT_CELLS_PER_SPREAD: f64 = 200.0;

const PRODUCT_NODE_LIMIT: f64 = 131_072.0;

const GAUSS_THREE: [(f64, f64); 3] = [
    (-0.774_596_669_241_483_4, 5.0 / 9.0),
    (0.0, 8.0 / 9.0),
    (0.774_596_669_241_483_4, 5.0 / 9.0),
];

fn product_log_range(factor: &Prepared) -> Result<(f64, f64)> {
    if factor.support().0 < 0.0 {
        return Err(math_error(
            "a product law needs factors that stay at or above zero".to_string(),
        ));
    }
    let high = factor.quantile_pair(1.0 - PRODUCT_TAIL, PRODUCT_TAIL)?;
    let mut tail = PRODUCT_TAIL;
    let low = loop {
        let value = factor.quantile_pair(tail, 1.0 - tail)?;
        if value > 0.0 {
            break value;
        }
        tail *= 1e3;
        if tail >= 1e-3 {
            return Err(math_error(
                "a product law needs factors with no probability at zero".to_string(),
            ));
        }
    };
    if !(high.is_finite() && high >= low) {
        return Err(math_error(
            "a product factor has no finite upper quantile".to_string(),
        ));
    }
    Ok((low.ln(), high.ln()))
}

fn product_log_spread(factor: &Prepared) -> Result<f64> {
    let low = factor.quantile_pair(0.05, 0.95)?;
    let high = factor.quantile_pair(0.95, 0.05)?;
    Ok(if low > 0.0 && high > low {
        (high / low).ln() / (2.0 * NORMAL_QUANTILE_95)
    } else {
        0.0
    })
}

fn cell_share(factor: &Prepared, left: f64, step: f64) -> f64 {
    let mut weight = 0.0;
    let mut moment = 0.0;
    for (node, share) in GAUSS_THREE {
        let offset = 0.5 * step * (1.0 + node);
        let x = (left + offset).exp();
        let density = match factor.density(x) {
            Ok(value) => value,
            Err(_) => {
                weight = 0.0;
                break;
            }
        };
        let part = density * x * share;
        weight += part;
        moment += part * offset.exp_m1();
    }
    let ratio = if weight > 0.0 && weight.is_finite() && moment.is_finite() {
        moment / weight
    } else {
        (0.5 * step).exp_m1()
    };
    (ratio / step.exp_m1()).clamp(0.0, 1.0)
}

fn binned_factor(factor: &Prepared, origin: f64, step: f64, cells: usize) -> Result<Vec<f64>> {
    let mut masses = vec![0.0; cells + 1];
    if let Prepared::Atoms { atoms } = factor {
        for (value, probability) in atom_probabilities(atoms) {
            if value <= 0.0 {
                continue;
            }
            let position = ((value.ln() - origin) / step).clamp(0.0, cells as f64);
            let index = (position.floor() as usize).min(cells - 1);
            let left = (origin + index as f64 * step).exp();
            let share = ((value / left - 1.0) / step.exp_m1()).clamp(0.0, 1.0);
            masses[index] += probability * (1.0 - share);
            masses[index + 1] += probability * share;
        }
        return Ok(masses);
    }
    let mut below = Vec::with_capacity(cells + 1);
    let mut above = Vec::with_capacity(cells + 1);
    for index in 0..=cells {
        let x = (origin + index as f64 * step).exp();
        let mass = factor.cdf(x)?;
        below.push(mass);
        above.push(if mass > 0.5 { factor.survival(x)? } else { 1.0 - mass });
    }
    for index in 0..cells {
        let mass = if below[index] > 0.5 {
            above[index] - above[index + 1]
        } else {
            below[index + 1] - below[index]
        };
        if !(mass > 0.0) {
            continue;
        }
        let share = cell_share(factor, origin + index as f64 * step, step);
        masses[index] += mass * (1.0 - share);
        masses[index + 1] += mass * share;
    }
    Ok(masses)
}

fn trimmed(masses: Vec<f64>) -> (usize, Vec<f64>) {
    let first = masses.iter().position(|mass| *mass > 0.0).unwrap_or(0);
    let last = masses.iter().rposition(|mass| *mass > 0.0).unwrap_or(first);
    (first, masses[first..=last].to_vec())
}

fn convolved(left: &[f64], right: &[f64]) -> Vec<f64> {
    let mut out = vec![0.0; left.len() + right.len() - 1];
    for (index, mass) in left.iter().enumerate() {
        if *mass == 0.0 {
            continue;
        }
        for (offset, other) in right.iter().enumerate() {
            out[index + offset] += mass * other;
        }
    }
    out
}

fn ramp(left: f64, right: f64, depth: f64) -> f64 {
    let curve = right - left;
    let reach = left * left + 2.0 * curve * depth;
    let denominator = left + reach.max(0.0).sqrt();
    if denominator > 0.0 {
        (2.0 * depth / denominator).clamp(0.0, 1.0)
    } else {
        0.0
    }
}

#[derive(Debug, Clone)]
struct ProductGrid {
    factors: Vec<Prepared>,
    constant: f64,
    start: f64,
    step: f64,
    masses: Vec<f64>,
    lower_edges: Vec<f64>,
    upper_edges: Vec<f64>,
    moments: (f64, f64),
}

impl ProductGrid {
    fn new(factors: Vec<Prepared>, constant: f64) -> Result<ProductGrid> {
        let ranges = factors
            .iter()
            .map(product_log_range)
            .collect::<Result<Vec<(f64, f64)>>>()?;
        let mut step = PRODUCT_STEP;
        for factor in &factors {
            let spread = product_log_spread(factor)?;
            if spread > 0.0 {
                step = step.min(spread / PRODUCT_CELLS_PER_SPREAD);
            }
        }
        let width: f64 = ranges.iter().map(|(low, high)| high - low).sum();
        step = step.max(width / PRODUCT_NODE_LIMIT);
        let mut origin = constant.ln();
        let mut masses = vec![1.0];
        for (factor, (low, high)) in factors.iter().zip(&ranges) {
            let cells = ((high - low) / step).ceil().max(1.0) as usize;
            let (offset, binned) = trimmed(binned_factor(factor, *low, step, cells)?);
            origin += low + offset as f64 * step;
            masses = convolved(&masses, &binned);
        }
        let total: f64 = masses.iter().sum();
        if !(total > 0.0 && total.is_finite()) {
            return Err(math_error("a product law keeps no probability".to_string()));
        }
        let kernel = (exp_minus_one_over_x_squared(step)? + exp_minus_one_over_x_squared(-step)?).ln();
        let mut padded = Vec::with_capacity(masses.len() + 2);
        padded.push(0.0);
        padded.extend(masses.into_iter().map(|mass| mass / total));
        padded.push(0.0);
        let count = padded.len();
        let mut below = vec![0.0; count];
        for index in 1..count {
            below[index] = below[index - 1] + padded[index - 1];
        }
        let mut above = vec![0.0; count + 1];
        for index in (0..count).rev() {
            above[index] = above[index + 1] + padded[index];
        }
        let lower_edges = (0..count).map(|index| below[index] + 0.5 * padded[index]).collect();
        let upper_edges = (0..count).map(|index| above[index + 1] + 0.5 * padded[index]).collect();
        let parts = factors
            .iter()
            .map(Prepared::moments)
            .collect::<Result<Vec<(f64, f64)>>>()?;
        let mean = constant * parts.iter().map(|(mean, _)| mean).product::<f64>();
        let relative: f64 = parts
            .iter()
            .map(|(part_mean, part_variance)| (part_variance / (part_mean * part_mean)).ln_1p())
            .sum();
        Ok(ProductGrid {
            factors,
            constant,
            start: origin - step - kernel,
            step,
            masses: padded,
            lower_edges,
            upper_edges,
            moments: (mean, mean * mean * relative.exp_m1()),
        })
    }

    fn draw<R: Rng + ?Sized>(&self, rng: &mut R) -> Result<f64> {
        let mut value = self.constant;
        for factor in &self.factors {
            value *= factor.draw(rng)?;
        }
        Ok(value)
    }

    fn support(&self) -> (f64, f64) {
        (
            self.start.exp(),
            (self.start + (self.masses.len() - 1) as f64 * self.step).exp(),
        )
    }

    fn locate(&self, x: f64) -> Option<(usize, f64)> {
        let position = (x.ln() - self.start) / self.step;
        if !(position > 0.0 && position < (self.masses.len() - 1) as f64) {
            return None;
        }
        let index = (position.floor() as usize).min(self.masses.len() - 2);
        Some((index, position - index as f64))
    }

    fn cdf(&self, x: f64) -> f64 {
        if x <= 0.0 {
            return 0.0;
        }
        match self.locate(x) {
            Some((index, t)) => {
                let (left, right) = (self.masses[index], self.masses[index + 1]);
                (self.lower_edges[index] + left * t + 0.5 * (right - left) * t * t).clamp(0.0, 1.0)
            }
            None => {
                if x <= self.support().0 {
                    0.0
                } else {
                    1.0
                }
            }
        }
    }

    fn survival(&self, x: f64) -> f64 {
        if x <= 0.0 {
            return 1.0;
        }
        match self.locate(x) {
            Some((index, t)) => {
                let (left, right) = (self.masses[index], self.masses[index + 1]);
                (self.upper_edges[index] - left * t - 0.5 * (right - left) * t * t).clamp(0.0, 1.0)
            }
            None => {
                if x <= self.support().0 {
                    1.0
                } else {
                    0.0
                }
            }
        }
    }

    fn density(&self, x: f64) -> f64 {
        if x <= 0.0 {
            return 0.0;
        }
        match self.locate(x) {
            Some((index, t)) => {
                (self.masses[index] * (1.0 - t) + self.masses[index + 1] * t) / (self.step * x)
            }
            None => 0.0,
        }
    }

    fn quantile(&self, u: f64, one_minus_u: f64) -> f64 {
        let last = self.masses.len() - 2;
        let (index, t) = if u <= 0.5 {
            let index = self
                .lower_edges
                .partition_point(|edge| *edge <= u)
                .saturating_sub(1)
                .min(last);
            let (left, right) = (self.masses[index], self.masses[index + 1]);
            (index, ramp(left, right, u - self.lower_edges[index]))
        } else {
            let index = self
                .upper_edges
                .partition_point(|edge| *edge >= one_minus_u)
                .saturating_sub(1)
                .min(last);
            let (left, right) = (self.masses[index], self.masses[index + 1]);
            (index, ramp(left, right, self.upper_edges[index] - one_minus_u))
        };
        (self.start + (index as f64 + t) * self.step).exp()
    }
}

fn scaled_prepared(inner: Prepared, factor: f64) -> Prepared {
    if factor == 1.0 {
        return inner;
    }
    let positive = factor > 0.0;
    match inner {
        Prepared::Point { value } => Prepared::Point {
            value: value * factor,
        },
        Prepared::Gamma { shape, scale } if positive => Prepared::Gamma {
            shape,
            scale: scale * factor,
        },
        Prepared::Lognormal { mean, sigma, median } if positive => Prepared::Lognormal {
            mean: mean * factor,
            sigma,
            median: median * factor,
        },
        Prepared::Beta {
            alpha,
            beta,
            lower,
            width,
        } if positive => Prepared::Beta {
            alpha,
            beta,
            lower: lower * factor,
            width: width * factor,
        },
        Prepared::Uniform { lower, upper } if positive => Prepared::Uniform {
            lower: lower * factor,
            upper: upper * factor,
        },
        Prepared::LogUniform { lower, upper } if positive => Prepared::LogUniform {
            lower: lower * factor,
            upper: upper * factor,
        },
        Prepared::Normal { mean, deviation } if positive => Prepared::Normal {
            mean: mean * factor,
            deviation: deviation * factor,
        },
        Prepared::Weibull {
            scale,
            shape,
            location,
        } if positive => Prepared::Weibull {
            scale: scale * factor,
            shape,
            location: location * factor,
        },
        other => Prepared::Scaled {
            inner: Box::new(other),
            factor,
        },
    }
}

fn product(factors: &[Law]) -> Result<Prepared> {
    let mut constant = 1.0;
    let mut spread = 0.0;
    let mut log_median = 0.0;
    let mut lognormals = 0;
    let mut others = Vec::new();
    for factor in factors {
        match Prepared::from_law(factor)? {
            Prepared::Point { value } => constant *= value,
            Prepared::Lognormal { sigma, median, .. } => {
                lognormals += 1;
                spread += sigma * sigma;
                log_median += median.ln();
            }
            other => others.push(other),
        }
    }
    if lognormals > 0 {
        let sigma = spread.sqrt();
        let median = log_median.exp();
        others.push(Prepared::Lognormal {
            mean: median * (0.5 * spread).exp(),
            sigma,
            median,
        });
    }
    if constant == 0.0 || others.is_empty() {
        return Ok(Prepared::Point { value: constant });
    }
    if others.len() == 1 {
        return Ok(scaled_prepared(others.remove(0), constant));
    }
    let grid = Prepared::Product(Box::new(ProductGrid::new(others, constant.abs())?));
    Ok(if constant < 0.0 { scaled_prepared(grid, -1.0) } else { grid })
}

#[derive(Debug, Clone)]
enum Prepared {
    Point {
        value: f64,
    },
    Beta {
        alpha: f64,
        beta: f64,
        lower: f64,
        width: f64,
    },
    Gamma {
        shape: f64,
        scale: f64,
    },
    Lognormal {
        mean: f64,
        sigma: f64,
        median: f64,
    },
    Normal {
        mean: f64,
        deviation: f64,
    },
    StudentT {
        location: f64,
        scale: f64,
        freedom: f64,
    },
    LogitNormal {
        mu: f64,
        sigma: f64,
    },
    Uniform {
        lower: f64,
        upper: f64,
    },
    LogUniform {
        lower: f64,
        upper: f64,
    },
    Triangular {
        lower: f64,
        mode: f64,
        upper: f64,
        logarithmic: bool,
    },
    Weibull {
        scale: f64,
        shape: f64,
        location: f64,
    },
    MaximumEntropy {
        lower: f64,
        upper: f64,
        mean: f64,
        slope: f64,
    },
    Constrained {
        mean: f64,
        law: Constrained,
    },
    Atoms {
        atoms: Vec<Atom>,
    },
    Tabulated {
        points: Vec<QuantilePoint>,
        logarithmic: bool,
    },
    Metalog {
        coefficients: Vec<f64>,
        lower: Option<f64>,
        upper: Option<f64>,
    },
    Kernel {
        atoms: Vec<Atom>,
        bandwidth: f64,
    },
    Truncated {
        inner: Box<Prepared>,
        lower: f64,
        upper: f64,
        cdf_lower: f64,
        cdf_upper: f64,
        survival_lower: f64,
        survival_upper: f64,
    },
    Mixture {
        components: Vec<(f64, Prepared)>,
        cumulative: Vec<f64>,
    },
    Posterior(Box<BayesPosterior>),
    Density(Box<DensityPosterior>),
    Mapped {
        inner: Box<Prepared>,
        mapping: Mapping,
    },
    Gridded {
        table: Box<Prepared>,
        moments: (f64, f64),
    },
    Scaled {
        inner: Box<Prepared>,
        factor: f64,
    },
    Product(Box<ProductGrid>),
}

#[derive(Debug, Clone, Copy)]
struct InverseKnot {
    score: f64,
    ordinate: f64,
    slope: f64,
}

fn normal_score(u: f64, one_minus_u: f64) -> Result<f64> {
    if u <= 0.5 {
        kernels::normal_quantile(u)
    } else {
        Ok(-kernels::normal_quantile(one_minus_u)?)
    }
}

fn hermite(left: InverseKnot, right: InverseKnot, score: f64) -> f64 {
    let width = right.score - left.score;
    if width <= 0.0 {
        return left.ordinate;
    }
    let t = (score - left.score) / width;
    let rest = 1.0 - t;
    let value = (1.0 + 2.0 * t) * rest * rest * left.ordinate
        + t * rest * rest * width * left.slope
        + t * t * (3.0 - 2.0 * t) * right.ordinate
        - t * t * rest * width * right.slope;
    value.max(left.ordinate).min(right.ordinate)
}

struct InverseTable<'a> {
    law: &'a Prepared,
    logarithmic: bool,
    knots: Vec<InverseKnot>,
}

impl<'a> InverseTable<'a> {
    fn build(law: &'a Prepared, low: (f64, f64), high: (f64, f64)) -> Result<InverseTable<'a>> {
        let low_value = law.quantile_pair(low.0, low.1)?;
        let mut table = InverseTable {
            law,
            logarithmic: law.support().0 >= 0.0 && low_value > 0.0,
            knots: Vec::new(),
        };
        let first = table.knot(normal_score(low.0, low.1)?, low_value)?;
        let high_score = normal_score(high.0, high.1)?;
        if high_score <= first.score {
            table.knots.push(first);
            return Ok(table);
        }
        let last = table.knot(high_score, law.quantile_pair(high.0, high.1)?)?;
        let mut knots = vec![first];
        let mut pending = vec![last];
        while let Some(right) = pending.last().copied() {
            let left = knots[knots.len() - 1];
            if table.settled(left, right)? {
                knots.push(right);
                pending.pop();
            } else {
                pending.push(table.between(left, right)?);
            }
        }
        table.knots = knots;
        Ok(table)
    }

    fn abscissa(&self, ordinate: f64) -> f64 {
        if self.logarithmic {
            ordinate.exp()
        } else {
            ordinate
        }
    }

    fn stretch(&self, x: f64) -> Result<f64> {
        let density = self.law.density(x)?;
        Ok(if self.logarithmic { density * x } else { density })
    }

    fn knot(&self, score: f64, x: f64) -> Result<InverseKnot> {
        Ok(InverseKnot {
            score,
            ordinate: if self.logarithmic { x.ln() } else { x },
            slope: (-0.5 * score * score).exp() / ((2.0 * PI).sqrt() * self.stretch(x)?),
        })
    }

    fn tolerance(&self, ordinate: f64) -> f64 {
        if self.logarithmic {
            NUMERIC_TOLERANCE
        } else {
            NUMERIC_TOLERANCE * ordinate.abs()
        }
    }

    fn settled(&self, left: InverseKnot, right: InverseKnot) -> Result<bool> {
        let spread = right.ordinate - left.ordinate;
        let halfway = 0.5 * (left.ordinate + right.ordinate);
        if right.score <= left.score
            || halfway <= left.ordinate
            || halfway >= right.ordinate
            || spread <= self.tolerance(left.ordinate).min(self.tolerance(right.ordinate))
        {
            return Ok(true);
        }
        let secant = spread / (right.score - left.score);
        let (rise_left, rise_right) = (left.slope / secant, right.slope / secant);
        if !(rise_left.is_finite() && rise_right.is_finite() && rise_left * rise_left + rise_right * rise_right <= 9.0) {
            return Ok(false);
        }
        let middle = 0.5 * (left.score + right.score);
        let ordinate = hermite(left, right, middle);
        let x = self.abscissa(ordinate);
        let residual = if middle <= 0.0 {
            kernels::normal_cdf(middle)? - self.law.cdf(x)?
        } else {
            self.law.survival(x)? - kernels::normal_cdf(-middle)?
        };
        let stretch = self.stretch(x)?;
        Ok(stretch > 0.0 && stretch.is_finite() && residual.abs() <= self.tolerance(ordinate) * stretch)
    }

    fn between(&self, left: InverseKnot, right: InverseKnot) -> Result<InverseKnot> {
        let x = self.abscissa(0.5 * (left.ordinate + right.ordinate));
        let upper = left.score + right.score > 0.0;
        let below = if upper { None } else { Some(self.law.cdf(x)?) };
        let score = match below {
            Some(mass) if mass <= 0.5 => kernels::normal_quantile(mass)?,
            _ => {
                let above = self.law.survival(x)?;
                if above <= 0.5 {
                    -kernels::normal_quantile(above)?
                } else {
                    kernels::normal_quantile(self.law.cdf(x)?)?
                }
            }
        };
        self.knot(score.clamp(left.score, right.score), x)
    }

    fn value(&self, u: f64, one_minus_u: f64) -> Result<f64> {
        let score = normal_score(u, one_minus_u)?;
        let index = self.knots.partition_point(|knot| knot.score < score);
        if index == self.knots.len() || (index == 0 && score < self.knots[0].score) {
            return self.law.quantile_pair(u, one_minus_u);
        }
        if index == 0 {
            return Ok(self.abscissa(self.knots[0].ordinate));
        }
        Ok(self.abscissa(hermite(self.knots[index - 1], self.knots[index], score)))
    }
}

#[derive(Debug, Clone)]
pub struct PreparedLaw {
    prepared: Prepared,
    moments: (f64, f64),
}

impl PreparedLaw {
    pub fn new(law: &Law) -> Result<PreparedLaw> {
        let prepared = Prepared::from_law(law)?;
        let moments = prepared.moments()?;
        Ok(PreparedLaw { prepared, moments })
    }

    pub fn mean(&self) -> f64 {
        self.moments.0
    }

    pub fn variance(&self) -> f64 {
        self.moments.1
    }

    pub fn quantile(&self, u: f64) -> Result<f64> {
        self.prepared.quantile_pair(u, 1.0 - u)
    }

    pub fn draw<R: Rng + ?Sized>(&self, rng: &mut R) -> Result<f64> {
        self.prepared.draw(rng)
    }

    pub fn quantile_pair(&self, u: f64, one_minus_u: f64) -> Result<f64> {
        self.prepared.quantile_pair(u, one_minus_u)
    }

    pub fn quantile_pairs(&self, pairs: &[(f64, f64)]) -> Result<Vec<f64>> {
        let numeric = self.prepared.numeric_inverse();
        if !numeric || self.prepared.is_atomic() || pairs.is_empty() {
            return pairs.iter().map(|(u, v)| self.prepared.quantile_pair(*u, *v)).collect();
        }
        for (u, v) in pairs {
            require_open_unit(*u, *v)?;
        }
        let scores = pairs.iter().map(|(u, v)| normal_score(*u, *v)).collect::<Result<Vec<f64>>>()?;
        let lowest = (0..pairs.len()).fold(0, |best, index| if scores[index] < scores[best] { index } else { best });
        let highest = (0..pairs.len()).fold(0, |best, index| if scores[index] > scores[best] { index } else { best });
        let table = InverseTable::build(&self.prepared, pairs[lowest], pairs[highest])?;
        pairs.iter().map(|(u, v)| table.value(*u, *v)).collect()
    }

    pub fn cdf(&self, x: f64) -> Result<f64> {
        self.prepared.cdf(x)
    }

    pub fn survival(&self, x: f64) -> Result<f64> {
        self.prepared.survival(x)
    }

    pub fn density(&self, x: f64) -> Result<f64> {
        self.prepared.density(x)
    }

    pub fn atoms(&self) -> Vec<(f64, f64)> {
        match &self.prepared {
            Prepared::Point { value } => vec![(*value, 1.0)],
            Prepared::Atoms { atoms } => atom_probabilities(atoms).collect(),
            _ => Vec::new(),
        }
    }
}

fn require_open_unit(u: f64, one_minus_u: f64) -> Result<()> {
    if u > 0.0 && one_minus_u > 0.0 && u <= 1.0 && one_minus_u <= 1.0 {
        Ok(())
    } else {
        Err(math_error(format!(
            "a quantile needs a probability strictly between 0 and 1, not {}",
            u
        )))
    }
}

fn student_cdf_pair(t: f64, freedom: f64) -> Result<(f64, f64)> {
    let squared = t * t;
    let (lower_tail, near_center) = if squared < freedom {
        let half = 0.5 * kernels::beta_cdf(squared / (freedom + squared), 0.5, 0.5 * freedom)?;
        (0.5 - half, 0.5 + half)
    } else {
        let tail = 0.5 * kernels::beta_cdf(freedom / (freedom + squared), 0.5 * freedom, 0.5)?;
        (tail, 1.0 - tail)
    };
    Ok(if t < 0.0 {
        (lower_tail, near_center)
    } else {
        (near_center, lower_tail)
    })
}

fn student_quantile(u: f64, one_minus_u: f64, freedom: f64) -> Result<f64> {
    let tail = u.min(one_minus_u);
    let magnitude = if tail > 0.25 {
        let ratio = kernels::beta_quantile(1.0 - 2.0 * tail, 0.5, 0.5 * freedom)?;
        (freedom * ratio / (1.0 - ratio)).sqrt()
    } else {
        let ratio = kernels::beta_quantile(2.0 * tail, 0.5 * freedom, 0.5)?;
        (freedom * (1.0 - ratio) / ratio).sqrt()
    };
    Ok(if u < 0.5 { -magnitude } else { magnitude })
}

fn triangle_cdf(x: f64, lower: f64, mode: f64, upper: f64) -> f64 {
    if x <= lower {
        0.0
    } else if x >= upper {
        1.0
    } else if x <= mode {
        (x - lower).powi(2) / ((upper - lower) * (mode - lower))
    } else {
        1.0 - (upper - x).powi(2) / ((upper - lower) * (upper - mode))
    }
}

fn triangle_quantile(u: f64, one_minus_u: f64, lower: f64, mode: f64, upper: f64) -> f64 {
    let width = upper - lower;
    let split = (mode - lower) / width;
    if u <= split {
        lower + (u * width * (mode - lower)).sqrt()
    } else {
        upper - (one_minus_u * width * (upper - mode)).sqrt()
    }
}

fn triangle_density(x: f64, lower: f64, mode: f64, upper: f64) -> f64 {
    if x < lower || x > upper {
        0.0
    } else if x <= mode && mode > lower {
        2.0 * (x - lower) / ((upper - lower) * (mode - lower))
    } else if upper > mode {
        2.0 * (upper - x) / ((upper - lower) * (upper - mode))
    } else {
        2.0 / (upper - lower)
    }
}

fn entropy_mean_fraction(slope_width: f64) -> Result<f64> {
    if slope_width == 0.0 {
        return Ok(0.5);
    }
    let complement = -kernels::exp_minus_one(-slope_width)?;
    if slope_width.abs() < 1.0 {
        Ok(slope_width * exp_minus_one_over_x_squared(-slope_width)? / complement)
    } else {
        Ok(1.0 / complement - 1.0 / slope_width)
    }
}

impl Prepared {
    fn from_law(law: &Law) -> Result<Prepared> {
        Ok(match law {
            Law::Point { value } => Prepared::Point { value: *value },
            Law::Beta {
                alpha,
                beta,
                lower,
                upper,
            } => Prepared::Beta {
                alpha: *alpha,
                beta: *beta,
                lower: *lower,
                width: upper - lower,
            },
            Law::Gamma { shape, rate } => Prepared::Gamma {
                shape: *shape,
                scale: 1.0 / rate,
            },
            Law::Lognormal {
                mean,
                error_factor,
                level,
            } => {
                let sigma = error_factor.ln() / kernels::normal_quantile(*level)?;
                Prepared::Lognormal {
                    mean: *mean,
                    sigma,
                    median: mean * (-0.5 * sigma * sigma).exp(),
                }
            }
            Law::Normal {
                mean,
                standard_deviation,
            } => Prepared::Normal {
                mean: *mean,
                deviation: *standard_deviation,
            },
            Law::StudentT {
                location,
                scale,
                degrees_of_freedom,
            } => Prepared::StudentT {
                location: *location,
                scale: *scale,
                freedom: *degrees_of_freedom,
            },
            Law::LogitNormal { mu, sigma } => Prepared::LogitNormal {
                mu: *mu,
                sigma: *sigma,
            },
            Law::Uniform { lower, upper } => Prepared::Uniform {
                lower: *lower,
                upper: *upper,
            },
            Law::LogUniform { lower, upper } => Prepared::LogUniform {
                lower: *lower,
                upper: *upper,
            },
            Law::Triangular { lower, mode, upper } => Prepared::Triangular {
                lower: *lower,
                mode: *mode,
                upper: *upper,
                logarithmic: false,
            },
            Law::LogTriangular { lower, mode, upper } => Prepared::Triangular {
                lower: lower.ln(),
                mode: mode.ln(),
                upper: upper.ln(),
                logarithmic: true,
            },
            Law::Weibull {
                scale,
                shape,
                location,
            } => Prepared::Weibull {
                scale: *scale,
                shape: *shape,
                location: *location,
            },
            Law::MaximumEntropy { lower, mean, upper } => {
                let width = upper - lower;
                let target = (mean - lower) / width;
                let slope_width = if target == 0.5 {
                    0.0
                } else {
                    let start = if target < 0.5 { -1.0 } else { 1.0 };
                    let end = expand_bracket(
                        |s| Ok(entropy_mean_fraction(s)? - target),
                        0.0,
                        start,
                    )?;
                    brent(|s| Ok(entropy_mean_fraction(s)? - target), 0.0, end)?
                };
                Prepared::MaximumEntropy {
                    lower: *lower,
                    upper: *upper,
                    mean: *mean,
                    slope: slope_width / width,
                }
            }
            Law::ConstrainedNoninformative { mean } => Prepared::Constrained {
                mean: *mean,
                law: Constrained::for_mean(*mean)?,
            },
            Law::Discrete { outcomes } => Prepared::Atoms {
                atoms: atoms_from(
                    outcomes
                        .iter()
                        .map(|outcome| (outcome.value, outcome.weight))
                        .collect(),
                )?,
            },
            Law::Tabulated { points, scale } => Prepared::Tabulated {
                points: points.clone(),
                logarithmic: *scale == TabulatedScale::Log,
            },
            Law::Metalog {
                points,
                lower,
                upper,
            } => {
                let transform = |x: f64| match (lower, upper) {
                    (None, None) => x,
                    (Some(low), None) => (x - low).ln(),
                    (None, Some(high)) => -(high - x).ln(),
                    (Some(low), Some(high)) => ((x - low) / (high - x)).ln(),
                };
                let size = points.len();
                let matrix = points
                    .iter()
                    .map(|point| {
                        (1..=size)
                            .map(|term| metalog_basis(term, point.probability, 1.0 - point.probability))
                            .collect()
                    })
                    .collect();
                let right = points.iter().map(|point| transform(point.value)).collect();
                let coefficients = solve_linear(matrix, right)?;
                if !metalog_feasible(&coefficients)? {
                    return Err(math_error(
                        "these metalog points give a quantile that does not rise everywhere"
                            .to_string(),
                    ));
                }
                Prepared::Metalog {
                    coefficients,
                    lower: *lower,
                    upper: *upper,
                }
            }
            Law::Samples {
                values,
                weights,
                smoothing,
            } => {
                let pairs = values
                    .iter()
                    .enumerate()
                    .map(|(index, value)| (*value, weights.get(index).copied().unwrap_or(1.0)))
                    .collect();
                let atoms = atoms_from(pairs)?;
                match smoothing {
                    SampleSmoothing::None => Prepared::Atoms { atoms },
                    SampleSmoothing::GaussianKernel { bandwidth } => Prepared::Kernel {
                        atoms,
                        bandwidth: *bandwidth,
                    },
                }
            }
            Law::Truncated { law, lower, upper } => {
                let inner = Prepared::from_law(law)?;
                let (support_low, support_high) = law.support();
                let low = lower.map_or(support_low, |value| value.max(support_low));
                let high = upper.map_or(support_high, |value| value.min(support_high));
                let cdf_lower = if low.is_finite() { inner.cdf_left(low)? } else { 0.0 };
                let survival_lower = if low.is_finite() {
                    1.0 - cdf_lower
                } else {
                    1.0
                };
                let survival_lower = if low.is_finite() && cdf_lower > 0.5 {
                    inner.survival_left(low)?
                } else {
                    survival_lower
                };
                let cdf_upper = if high.is_finite() { inner.cdf(high)? } else { 1.0 };
                let survival_upper = if high.is_finite() {
                    inner.survival(high)?
                } else {
                    0.0
                };
                if !(cdf_upper - cdf_lower > 0.0 || survival_lower - survival_upper > 0.0) {
                    return Err(math_error(
                        "the truncation keeps no probability of the inner law".to_string(),
                    ));
                }
                match inner {
                    Prepared::Point { value } => return Ok(Prepared::Point { value }),
                    Prepared::Atoms { atoms } => {
                        return Ok(Prepared::Atoms {
                            atoms: atoms_from(
                                atom_probabilities(&atoms)
                                    .filter(|(value, _)| *value >= low && *value <= high)
                                    .collect(),
                            )?,
                        })
                    }
                    Prepared::Tabulated {
                        points,
                        logarithmic,
                    } => {
                        return Ok(Prepared::Tabulated {
                            points: truncate_tabulated(&points, logarithmic, low, high),
                            logarithmic,
                        })
                    }
                    Prepared::Uniform { .. } => {
                        return Ok(Prepared::Uniform {
                            lower: low,
                            upper: high,
                        })
                    }
                    Prepared::LogUniform { .. } => {
                        return Ok(Prepared::LogUniform {
                            lower: low,
                            upper: high,
                        })
                    }
                    _ => {}
                }
                Prepared::Truncated {
                    inner: Box::new(inner),
                    lower: low,
                    upper: high,
                    cdf_lower,
                    cdf_upper,
                    survival_lower,
                    survival_upper,
                }
            }
            Law::Posterior { prior, evidence } => {
                let evidence = Evidence::from_terms(evidence)?;
                match prior {
                    Some(law) => updated(Prepared::from_law(law)?, &evidence)?.0,
                    None => noninformative(&evidence)?,
                }
            }
            Law::EmpiricalBayes { evidence, target } => empirical_bayes(evidence, *target)?,
            Law::Duration {
                model,
                times,
                censored,
                priors,
                output,
            } => duration(*model, times, censored, priors, output)?,
            Law::Trend { bins, at } => tabulated_output(inference::trend_atoms(bins, *at)?)?,
            Law::Product { factors } => product(factors)?,
            Law::Population {
                mu,
                sigma,
                upper,
                evidence,
                target,
            } => population(mu, sigma, *upper, evidence, *target)?,
            Law::Mixture { components } => {
                let total: f64 = components.iter().map(|component| component.weight).sum();
                mixture(
                    components
                        .iter()
                        .map(|component| {
                            Ok((component.weight / total, Prepared::from_law(&component.law)?))
                        })
                        .collect::<Result<Vec<_>>>()?,
                )
            }
        })
    }

    fn draw<R: Rng + ?Sized>(&self, rng: &mut R) -> Result<f64> {
        Ok(match self {
            Prepared::Point { value } => *value,
            Prepared::Beta { alpha, beta, lower, width } => {
                let sample: f64 = BetaDraw::new(*alpha, *beta).map_err(|error| draw_error(error.to_string()))?.sample(rng);
                lower + width * sample
            }
            Prepared::Gamma { shape, scale } => GammaDraw::new(*shape, *scale)
                .map_err(|error| draw_error(error.to_string()))?
                .sample(rng),
            Prepared::Lognormal { sigma, median, .. } => median * (sigma * standard_normal(rng)).exp(),
            Prepared::Normal { mean, deviation } => mean + deviation * standard_normal(rng),
            Prepared::StudentT { location, scale, freedom } => {
                let sample: f64 = StudentDraw::new(*freedom).map_err(|error| draw_error(error.to_string()))?.sample(rng);
                location + scale * sample
            }
            Prepared::LogitNormal { mu, sigma } => logistic(mu + sigma * standard_normal(rng)),
            Prepared::Uniform { lower, upper } => {
                let (u, _) = open_unit_pair(rng);
                lower + (upper - lower) * u
            }
            Prepared::LogUniform { lower, upper } => {
                let (u, _) = open_unit_pair(rng);
                (lower.ln() + (upper.ln() - lower.ln()) * u).exp()
            }
            Prepared::Weibull { scale, shape, location } => {
                let (_, v) = open_unit_pair(rng);
                location + scale * (-v.ln()).powf(1.0 / shape)
            }
            Prepared::Triangular { .. } | Prepared::MaximumEntropy { .. } | Prepared::Tabulated { .. } | Prepared::Metalog { .. } => {
                let (u, v) = open_unit_pair(rng);
                self.quantile_pair(u, v)?
            }
            Prepared::Constrained { law, .. } => law.draw(rng),
            Prepared::Atoms { atoms } => atom_draw(atoms, rng),
            Prepared::Kernel { atoms, bandwidth } => atom_draw(atoms, rng) + bandwidth * standard_normal(rng),
            Prepared::Truncated { inner, lower, upper, .. } => loop {
                let sample = inner.draw(rng)?;
                if sample >= *lower && sample <= *upper {
                    break sample;
                }
            },
            Prepared::Mixture { components, cumulative } => {
                let (u, _) = open_unit_pair(rng);
                let target = u * cumulative[cumulative.len() - 1];
                let chosen = cumulative.partition_point(|running| *running < target).min(components.len() - 1);
                components[chosen].1.draw(rng)?
            }
            Prepared::Posterior(posterior) => posterior.draw(rng)?,
            Prepared::Density(posterior) => posterior.draw(rng)?,
            Prepared::Mapped { inner, mapping } => mapping.apply(inner.draw(rng)?),
            Prepared::Gridded { table, .. } => table.draw(rng)?,
            Prepared::Scaled { inner, factor } => factor * inner.draw(rng)?,
            Prepared::Product(grid) => grid.draw(rng)?,
        })
    }

    fn quantile_is_closed(&self) -> bool {
        match self {
            Prepared::Constrained { .. } | Prepared::Mixture { .. } | Prepared::Kernel { .. } | Prepared::Density(_) => false,
            Prepared::Truncated { inner, .. } | Prepared::Mapped { inner, .. } | Prepared::Scaled { inner, .. } => inner.quantile_is_closed(),
            Prepared::Gridded { table, .. } => table.quantile_is_closed(),
            _ => true,
        }
    }

    fn numeric_inverse(&self) -> bool {
        match self {
            Prepared::Posterior(_) => true,
            Prepared::Mapped { inner, .. } | Prepared::Scaled { inner, .. } => inner.numeric_inverse(),
            other => !other.quantile_is_closed(),
        }
    }

    fn is_atomic(&self) -> bool {
        match self {
            Prepared::Point { .. } | Prepared::Atoms { .. } => true,
            Prepared::Tabulated { points, .. } => {
                points.windows(2).any(|pair| pair[0].value == pair[1].value)
            }
            Prepared::Truncated { inner, .. } | Prepared::Mapped { inner, .. } | Prepared::Scaled { inner, .. } => inner.is_atomic(),
            Prepared::Gridded { table, .. } => table.is_atomic(),
            Prepared::Mixture { components, .. } => {
                components.iter().any(|(_, component)| component.is_atomic())
            }
            _ => false,
        }
    }

    fn cdf(&self, x: f64) -> Result<f64> {
        Ok(match self {
            Prepared::Point { value } => {
                if x >= *value {
                    1.0
                } else {
                    0.0
                }
            }
            Prepared::Beta {
                alpha,
                beta,
                lower,
                width,
            } => {
                let standard = (x - lower) / width;
                if standard <= 0.0 {
                    0.0
                } else if standard >= 1.0 {
                    1.0
                } else {
                    kernels::beta_cdf(standard, *alpha, *beta)?
                }
            }
            Prepared::Gamma { shape, scale } => {
                if x <= 0.0 {
                    0.0
                } else {
                    kernels::gamma_cdf(x / scale, *shape)?
                }
            }
            Prepared::Lognormal { sigma, median, .. } => {
                if x <= 0.0 {
                    0.0
                } else {
                    kernels::normal_cdf((x / median).ln() / sigma)?
                }
            }
            Prepared::Normal { mean, deviation } => kernels::normal_cdf((x - mean) / deviation)?,
            Prepared::StudentT {
                location,
                scale,
                freedom,
            } => student_cdf_pair((x - location) / scale, *freedom)?.0,
            Prepared::LogitNormal { mu, sigma } => {
                if x <= 0.0 {
                    0.0
                } else if x >= 1.0 {
                    1.0
                } else {
                    kernels::normal_cdf(((x / (1.0 - x)).ln() - mu) / sigma)?
                }
            }
            Prepared::Uniform { lower, upper } => ((x - lower) / (upper - lower)).clamp(0.0, 1.0),
            Prepared::LogUniform { lower, upper } => {
                if x <= *lower {
                    0.0
                } else {
                    ((x / lower).ln() / (upper / lower).ln()).min(1.0)
                }
            }
            Prepared::Triangular {
                lower,
                mode,
                upper,
                logarithmic,
            } => {
                let position = if *logarithmic {
                    if x <= 0.0 {
                        return Ok(0.0);
                    }
                    x.ln()
                } else {
                    x
                };
                triangle_cdf(position, *lower, *mode, *upper)
            }
            Prepared::Weibull {
                scale,
                shape,
                location,
            } => {
                if x <= *location {
                    0.0
                } else {
                    -kernels::exp_minus_one(-((x - location) / scale).powf(*shape))?
                }
            }
            Prepared::MaximumEntropy {
                lower,
                upper,
                slope,
                ..
            } => entropy_cdf(*lower, *upper, *slope, x)?,
            Prepared::Constrained { law, .. } => {
                if x <= 0.0 {
                    0.0
                } else if x >= 1.0 {
                    1.0
                } else {
                    law.cdf(x)?
                }
            }
            Prepared::Atoms { atoms } => atoms
                .iter()
                .take_while(|atom| atom.value <= x)
                .last()
                .map_or(0.0, |atom| atom.cumulative),
            Prepared::Tabulated {
                points,
                logarithmic,
            } => tabulated_cdf(points, *logarithmic, x),
            Prepared::Metalog { .. } => {
                if x <= self.support().0 {
                    0.0
                } else if x >= self.support().1 {
                    1.0
                } else {
                    self.metalog_probability(x)?
                }
            }
            Prepared::Kernel { atoms, bandwidth } => {
                let mut total = 0.0;
                for (value, probability) in atom_probabilities(atoms) {
                    total += probability * kernels::normal_cdf((x - value) / bandwidth)?;
                }
                total
            }
            Prepared::Truncated {
                inner,
                lower,
                upper,
                cdf_lower,
                cdf_upper,
                survival_lower,
                survival_upper,
            } => {
                if x < *lower {
                    0.0
                } else if x >= *upper {
                    1.0
                } else if *cdf_lower > 0.5 {
                    (survival_lower - inner.survival(x)?) / (survival_lower - survival_upper)
                } else {
                    (inner.cdf(x)? - cdf_lower) / (cdf_upper - cdf_lower)
                }
            }
            Prepared::Mixture { components, .. } => {
                let mut total = 0.0;
                for (weight, component) in components {
                    total += weight * component.cdf(x)?;
                }
                total
            }
            Prepared::Posterior(law) => law.cdf(x)?,
            Prepared::Density(law) => law.cdf(x)?,
            Prepared::Mapped { inner, mapping } => {
                let (low, high) = self.support();
                if x < low {
                    0.0
                } else if x >= high {
                    1.0
                } else {
                    inner.survival(mapping.invert(x))?
                }
            }
            Prepared::Gridded { table, .. } => table.cdf(x)?,
            Prepared::Scaled { inner, factor } => {
                if *factor > 0.0 {
                    inner.cdf(x / factor)?
                } else {
                    inner.survival_left(x / factor)?
                }
            }
            Prepared::Product(grid) => grid.cdf(x),
        })
    }

    fn survival(&self, x: f64) -> Result<f64> {
        Ok(match self {
            Prepared::Beta {
                alpha,
                beta,
                lower,
                width,
            } => {
                let standard = (x - lower) / width;
                if standard <= 0.0 {
                    1.0
                } else if standard >= 1.0 {
                    0.0
                } else {
                    kernels::beta_survival(standard, *alpha, *beta)?
                }
            }
            Prepared::Gamma { shape, scale } => {
                if x <= 0.0 {
                    1.0
                } else {
                    kernels::gamma_survival(x / scale, *shape)?
                }
            }
            Prepared::Lognormal { sigma, median, .. } => {
                if x <= 0.0 {
                    1.0
                } else {
                    kernels::normal_cdf(-(x / median).ln() / sigma)?
                }
            }
            Prepared::Normal { mean, deviation } => {
                kernels::normal_cdf(-(x - mean) / deviation)?
            }
            Prepared::StudentT {
                location,
                scale,
                freedom,
            } => student_cdf_pair((x - location) / scale, *freedom)?.1,
            Prepared::LogitNormal { mu, sigma } => {
                if x <= 0.0 {
                    1.0
                } else if x >= 1.0 {
                    0.0
                } else {
                    kernels::normal_cdf(-((x / (1.0 - x)).ln() - mu) / sigma)?
                }
            }
            Prepared::Weibull {
                scale,
                shape,
                location,
            } => {
                if x <= *location {
                    1.0
                } else {
                    (-((x - location) / scale).powf(*shape)).exp()
                }
            }
            Prepared::Constrained { law, .. } => {
                if x <= 0.0 {
                    1.0
                } else if x >= 1.0 {
                    0.0
                } else {
                    law.survival(x)?
                }
            }
            Prepared::Uniform { lower, upper } => ((upper - x) / (upper - lower)).clamp(0.0, 1.0),
            Prepared::LogUniform { lower, upper } => {
                if x >= *upper {
                    0.0
                } else {
                    ((upper / x).ln() / (upper / lower).ln()).min(1.0)
                }
            }
            Prepared::Triangular {
                lower,
                mode,
                upper,
                logarithmic,
            } => {
                let position = if *logarithmic {
                    if x <= 0.0 {
                        return Ok(1.0);
                    }
                    x.ln()
                } else {
                    x
                };
                triangle_survival(position, *lower, *mode, *upper)
            }
            Prepared::Tabulated {
                points,
                logarithmic,
            } => tabulated_survival(points, *logarithmic, x),
            Prepared::MaximumEntropy {
                lower,
                upper,
                slope,
                ..
            } => entropy_survival(*lower, *upper, *slope, x)?,
            Prepared::Kernel { atoms, bandwidth } => {
                let mut total = 0.0;
                for (value, probability) in atom_probabilities(atoms) {
                    total += probability * kernels::normal_cdf(-(x - value) / bandwidth)?;
                }
                total
            }
            Prepared::Truncated {
                inner,
                lower,
                upper,
                cdf_lower,
                cdf_upper,
                survival_lower,
                survival_upper,
            } => {
                if x < *lower {
                    1.0
                } else if x >= *upper {
                    0.0
                } else if *cdf_lower > 0.5 {
                    (inner.survival(x)? - survival_upper) / (survival_lower - survival_upper)
                } else {
                    (cdf_upper - inner.cdf(x)?) / (cdf_upper - cdf_lower)
                }
            }
            Prepared::Mixture { components, .. } => {
                let mut total = 0.0;
                for (weight, component) in components {
                    total += weight * component.survival(x)?;
                }
                total
            }
            Prepared::Posterior(law) => law.survival(x)?,
            Prepared::Density(law) => law.survival(x)?,
            Prepared::Mapped { inner, mapping } => {
                let (low, high) = self.support();
                if x < low {
                    1.0
                } else if x >= high {
                    0.0
                } else {
                    inner.cdf(mapping.invert(x))?
                }
            }
            Prepared::Gridded { table, .. } => table.survival(x)?,
            Prepared::Scaled { inner, factor } => {
                if *factor > 0.0 {
                    inner.survival(x / factor)?
                } else {
                    inner.cdf_left(x / factor)?
                }
            }
            Prepared::Product(grid) => grid.survival(x),
            _ => 1.0 - self.cdf(x)?,
        })
    }

    fn cdf_left(&self, x: f64) -> Result<f64> {
        Ok(match self {
            Prepared::Point { value } => {
                if x > *value {
                    1.0
                } else {
                    0.0
                }
            }
            Prepared::Atoms { atoms } => atoms
                .iter()
                .take_while(|atom| atom.value < x)
                .last()
                .map_or(0.0, |atom| atom.cumulative),
            Prepared::Tabulated { points, .. } => points
                .iter()
                .rfind(|point| point.value < x)
                .map_or(0.0, |point| point.probability)
                .max(if self.is_atomic() { 0.0 } else { self.cdf(x)? }),
            Prepared::Mixture { components, .. } => {
                let mut total = 0.0;
                for (weight, component) in components {
                    total += weight * component.cdf_left(x)?;
                }
                total
            }
            _ => self.cdf(x)?,
        })
    }

    fn survival_left(&self, x: f64) -> Result<f64> {
        if self.is_atomic() {
            Ok(1.0 - self.cdf_left(x)?)
        } else {
            self.survival(x)
        }
    }

    fn support(&self) -> (f64, f64) {
        match self {
            Prepared::Point { value } => (*value, *value),
            Prepared::Beta { lower, width, .. } => (*lower, lower + width),
            Prepared::Gamma { .. } | Prepared::Lognormal { .. } => (0.0, f64::INFINITY),
            Prepared::Normal { .. } | Prepared::StudentT { .. } | Prepared::Kernel { .. } => {
                (f64::NEG_INFINITY, f64::INFINITY)
            }
            Prepared::LogitNormal { .. } | Prepared::Constrained { .. } => (0.0, 1.0),
            Prepared::Uniform { lower, upper }
            | Prepared::LogUniform { lower, upper }
            | Prepared::MaximumEntropy { lower, upper, .. } => (*lower, *upper),
            Prepared::Triangular {
                lower,
                upper,
                logarithmic,
                ..
            } => {
                if *logarithmic {
                    (lower.exp(), upper.exp())
                } else {
                    (*lower, *upper)
                }
            }
            Prepared::Weibull { location, .. } => (*location, f64::INFINITY),
            Prepared::Atoms { atoms } => (atoms[0].value, atoms[atoms.len() - 1].value),
            Prepared::Tabulated { points, .. } => (points[0].value, points[points.len() - 1].value),
            Prepared::Metalog { lower, upper, .. } => (
                lower.unwrap_or(f64::NEG_INFINITY),
                upper.unwrap_or(f64::INFINITY),
            ),
            Prepared::Truncated { lower, upper, .. } => (*lower, *upper),
            Prepared::Mixture { components, .. } => components.iter().fold(
                (f64::INFINITY, f64::NEG_INFINITY),
                |(low, high), (_, component)| {
                    let (component_low, component_high) = component.support();
                    (low.min(component_low), high.max(component_high))
                },
            ),
            Prepared::Posterior(law) => law.prior.support(),
            Prepared::Density(law) => law.support(),
            Prepared::Mapped { inner, mapping } => {
                let (low, high) = inner.support();
                (mapping.apply(high), mapping.apply(low))
            }
            Prepared::Gridded { table, .. } => table.support(),
            Prepared::Scaled { inner, factor } => {
                let (low, high) = inner.support();
                if *factor > 0.0 {
                    (low * factor, high * factor)
                } else {
                    (high * factor, low * factor)
                }
            }
            Prepared::Product(grid) => grid.support(),
        }
    }

    fn solve_quantile(&self, u: f64, one_minus_u: f64, low: f64, high: f64) -> Result<f64> {
        if low == high || self.covers_lower_edge(u, one_minus_u, low)? {
            return Ok(low);
        }
        if u > 0.5 {
            brent(|x| Ok(one_minus_u - self.survival(x)?), low, high)
        } else {
            brent(|x| Ok(self.cdf(x)? - u), low, high)
        }
    }

    fn covers_lower_edge(&self, u: f64, one_minus_u: f64, low: f64) -> Result<bool> {
        Ok(if u > 0.5 {
            self.survival(low)? <= one_minus_u
        } else {
            self.cdf(low)? >= u
        })
    }

    fn metalog_transform(&self, core: f64) -> f64 {
        match self {
            Prepared::Metalog { lower, upper, .. } => match (lower, upper) {
                (None, None) => core,
                (Some(low), None) => low + core.exp(),
                (None, Some(high)) => high - (-core).exp(),
                (Some(low), Some(high)) => low + (high - low) * logistic(core),
            },
            _ => core,
        }
    }

    fn metalog_probability(&self, x: f64) -> Result<f64> {
        let Prepared::Metalog { coefficients, .. } = self else {
            return Err(math_error("not a metalog law".to_string()));
        };
        brent(
            |y| {
                if y <= 0.0 {
                    return Ok(-1.0);
                }
                if y >= 1.0 {
                    return Ok(1.0);
                }
                Ok(self.metalog_transform(metalog_core(coefficients, y, 1.0 - y)) - x)
            },
            0.0,
            1.0,
        )
    }

    fn quantile_pair(&self, u: f64, one_minus_u: f64) -> Result<f64> {
        require_open_unit(u, one_minus_u)?;
        let upper_half = u > 0.5;
        Ok(match self {
            Prepared::Point { value } => *value,
            Prepared::Beta {
                alpha,
                beta,
                lower,
                width,
            } => {
                let standard = if upper_half {
                    kernels::beta_inverse_survival(one_minus_u, *alpha, *beta)?
                } else {
                    kernels::beta_quantile(u, *alpha, *beta)?
                };
                standard * width + lower
            }
            Prepared::Gamma { shape, scale } => {
                let standard = if upper_half {
                    kernels::gamma_inverse_survival(one_minus_u, *shape)?
                } else {
                    kernels::gamma_quantile(u, *shape)?
                };
                standard * scale
            }
            Prepared::Lognormal { sigma, median, .. } => {
                let z = if upper_half {
                    -kernels::normal_quantile(one_minus_u)?
                } else {
                    kernels::normal_quantile(u)?
                };
                (sigma * z).exp() * median
            }
            Prepared::Normal { mean, deviation } => {
                let z = if upper_half {
                    -kernels::normal_quantile(one_minus_u)?
                } else {
                    kernels::normal_quantile(u)?
                };
                z * deviation + mean
            }
            Prepared::StudentT {
                location,
                scale,
                freedom,
            } => student_quantile(u, one_minus_u, *freedom)? * scale + location,
            Prepared::LogitNormal { mu, sigma } => {
                let z = if upper_half {
                    -kernels::normal_quantile(one_minus_u)?
                } else {
                    kernels::normal_quantile(u)?
                };
                logistic(mu + sigma * z)
            }
            Prepared::Uniform { lower, upper } => {
                if upper_half {
                    upper - one_minus_u * (upper - lower)
                } else {
                    lower + u * (upper - lower)
                }
            }
            Prepared::LogUniform { lower, upper } => {
                let span = (upper / lower).ln();
                if upper_half {
                    upper * (-one_minus_u * span).exp()
                } else {
                    lower * (u * span).exp()
                }
            }
            Prepared::Triangular {
                lower,
                mode,
                upper,
                logarithmic,
            } => {
                let position = triangle_quantile(u, one_minus_u, *lower, *mode, *upper);
                if *logarithmic {
                    position.exp()
                } else {
                    position
                }
            }
            Prepared::Weibull {
                scale,
                shape,
                location,
            } => {
                let exposure = if upper_half {
                    -one_minus_u.ln()
                } else {
                    -kernels::log_one_plus(-u)?
                };
                exposure.powf(1.0 / shape) * scale + location
            }
            Prepared::MaximumEntropy {
                lower,
                upper,
                slope,
                ..
            } => entropy_quantile(*lower, *upper, *slope, u, one_minus_u)?,
            Prepared::Constrained { law, .. } => law.quantile(u, one_minus_u)?,
            Prepared::Atoms { atoms } => atoms
                .iter()
                .find(|atom| atom.cumulative >= u)
                .map_or(atoms[atoms.len() - 1].value, |atom| atom.value),
            Prepared::Tabulated {
                points,
                logarithmic,
            } => tabulated_quantile(points, *logarithmic, u),
            Prepared::Metalog { coefficients, .. } => {
                self.metalog_transform(metalog_core(coefficients, u, one_minus_u))
            }
            Prepared::Kernel { atoms, bandwidth } => {
                let z = if upper_half {
                    -kernels::normal_quantile(one_minus_u)?
                } else {
                    kernels::normal_quantile(u)?
                };
                let low = atoms[0].value + bandwidth * z;
                let high = atoms[atoms.len() - 1].value + bandwidth * z;
                self.solve_quantile(u, one_minus_u, low, high)?
            }
            Prepared::Truncated {
                inner,
                cdf_lower,
                cdf_upper,
                survival_lower,
                survival_upper,
                lower,
                upper,
            } => {
                let mass = if *cdf_lower > 0.5 {
                    survival_lower - survival_upper
                } else {
                    cdf_upper - cdf_lower
                };
                let value = inner.quantile_pair(
                    (cdf_lower + u * mass).min(1.0),
                    (survival_upper + one_minus_u * mass).min(1.0),
                )?;
                value.clamp(*lower, *upper)
            }
            Prepared::Mixture { components, .. } => {
                let mut low = f64::INFINITY;
                let mut high = f64::NEG_INFINITY;
                for (_, component) in components {
                    let value = component.quantile_pair(u, one_minus_u)?;
                    low = low.min(value);
                    high = high.max(value);
                }
                if self.is_atomic() && low != high {
                    mixture_atomic_quantile(self, u, low, high)?
                } else {
                    self.solve_quantile(u, one_minus_u, low, high)?
                }
            }
            Prepared::Posterior(law) => law.quantile(u, one_minus_u)?,
            Prepared::Density(law) => law.quantile(u, one_minus_u)?,
            Prepared::Mapped { inner, mapping } => mapping.apply(inner.quantile_pair(one_minus_u, u)?),
            Prepared::Gridded { table, .. } => table.quantile_pair(u, one_minus_u)?,
            Prepared::Scaled { inner, factor } => {
                if *factor > 0.0 {
                    factor * inner.quantile_pair(u, one_minus_u)?
                } else {
                    factor * inner.quantile_pair(one_minus_u, u)?
                }
            }
            Prepared::Product(grid) => grid.quantile(u, one_minus_u),
        })
    }

    fn density(&self, x: f64) -> Result<f64> {
        if self.is_atomic() {
            return Err(math_error(
                "a law with point masses has no density at its masses".to_string(),
            ));
        }
        let (low, high) = self.support();
        if x < low || x > high {
            return Ok(0.0);
        }
        Ok(match self {
            Prepared::Beta {
                alpha,
                beta,
                lower,
                width,
            } => kernels::beta_density((x - lower) / width, *alpha, *beta)? / width,
            Prepared::Gamma { shape, scale } => kernels::gamma_density(x / scale, *shape)? / scale,
            Prepared::Lognormal { sigma, median, .. } => {
                if x <= 0.0 {
                    0.0
                } else {
                    let z = (x / median).ln() / sigma;
                    (-0.5 * z * z).exp() / (x * sigma * (2.0 * PI).sqrt())
                }
            }
            Prepared::Normal { mean, deviation } => {
                let z = (x - mean) / deviation;
                (-0.5 * z * z).exp() / (deviation * (2.0 * PI).sqrt())
            }
            Prepared::StudentT {
                location,
                scale,
                freedom,
            } => {
                let t = (x - location) / scale;
                let log_constant = kernels::log_gamma(0.5 * (freedom + 1.0))?
                    - kernels::log_gamma(0.5 * freedom)?
                    - 0.5 * (freedom * PI).ln();
                (log_constant - 0.5 * (freedom + 1.0) * (t * t / freedom).ln_1p()).exp() / scale
            }
            Prepared::LogitNormal { mu, sigma } => {
                if x <= 0.0 || x >= 1.0 {
                    0.0
                } else {
                    let z = ((x / (1.0 - x)).ln() - mu) / sigma;
                    (-0.5 * z * z).exp() / (sigma * (2.0 * PI).sqrt() * x * (1.0 - x))
                }
            }
            Prepared::Uniform { lower, upper } => 1.0 / (upper - lower),
            Prepared::LogUniform { lower, upper } => 1.0 / (x * (upper / lower).ln()),
            Prepared::Triangular {
                lower,
                mode,
                upper,
                logarithmic,
            } => {
                if *logarithmic {
                    triangle_density(x.ln(), *lower, *mode, *upper) / x
                } else {
                    triangle_density(x, *lower, *mode, *upper)
                }
            }
            Prepared::Weibull {
                scale,
                shape,
                location,
            } => {
                let t = (x - location) / scale;
                if t <= 0.0 {
                    if *shape < 1.0 {
                        f64::INFINITY
                    } else if *shape == 1.0 {
                        1.0 / scale
                    } else {
                        0.0
                    }
                } else {
                    shape / scale * t.powf(shape - 1.0) * (-t.powf(*shape)).exp()
                }
            }
            Prepared::MaximumEntropy {
                lower,
                upper,
                slope,
                ..
            } => {
                let width = upper - lower;
                if *slope == 0.0 {
                    1.0 / width
                } else if *slope < 0.0 {
                    slope * (slope * (x - lower)).exp() / kernels::exp_minus_one(slope * width)?
                } else {
                    slope * (slope * (x - upper)).exp()
                        / -kernels::exp_minus_one(-slope * width)?
                }
            }
            Prepared::Constrained { law, .. } => {
                if x <= 0.0 || x >= 1.0 {
                    0.0
                } else {
                    law.density(x)
                }
            }
            Prepared::Tabulated {
                points,
                logarithmic,
            } => tabulated_density(points, *logarithmic, x),
            Prepared::Metalog { coefficients, .. } => {
                let y = self.metalog_probability(x)?;
                let slope = metalog_scaled_slope(coefficients, y) / (y * (1.0 - y));
                let core = metalog_core(coefficients, y, 1.0 - y);
                let transform_slope = match self {
                    Prepared::Metalog { lower, upper, .. } => match (lower, upper) {
                        (None, None) => 1.0,
                        (Some(_), None) => core.exp(),
                        (None, Some(_)) => (-core).exp(),
                        (Some(low), Some(high)) => {
                            let p = logistic(core);
                            (high - low) * p * (1.0 - p)
                        }
                    },
                    _ => 1.0,
                };
                1.0 / (slope * transform_slope)
            }
            Prepared::Kernel { atoms, bandwidth } => {
                let mut total = 0.0;
                for (value, probability) in atom_probabilities(atoms) {
                    let z = (x - value) / bandwidth;
                    total += probability * (-0.5 * z * z).exp();
                }
                total / (bandwidth * (2.0 * PI).sqrt())
            }
            Prepared::Truncated {
                inner,
                cdf_lower,
                cdf_upper,
                survival_lower,
                survival_upper,
                ..
            } => {
                let mass = if *cdf_lower > 0.5 {
                    survival_lower - survival_upper
                } else {
                    cdf_upper - cdf_lower
                };
                inner.density(x)? / mass
            }
            Prepared::Mixture { components, .. } => {
                let mut total = 0.0;
                for (weight, component) in components {
                    total += weight * component.density(x)?;
                }
                total
            }
            Prepared::Posterior(law) => law.density(x)?,
            Prepared::Density(law) => law.density(x)?,
            Prepared::Mapped { inner, mapping } => {
                if x <= 0.0 {
                    0.0
                } else {
                    inner.density(mapping.invert(x))? * mapping.inverse_slope(x)
                }
            }
            Prepared::Gridded { table, .. } => table.density(x)?,
            Prepared::Scaled { inner, factor } => inner.density(x / factor)? / factor.abs(),
            Prepared::Product(grid) => grid.density(x),
            Prepared::Point { .. } | Prepared::Atoms { .. } => 0.0,
        })
    }

    fn quantile_breakpoints(&self) -> Result<Vec<f64>> {
        Ok(match self {
            Prepared::Triangular {
                lower,
                mode,
                upper,
                ..
            } => vec![(mode - lower) / (upper - lower)],
            Prepared::Truncated {
                inner,
                cdf_lower,
                cdf_upper,
                survival_lower,
                survival_upper,
                ..
            } => inner
                .quantile_breakpoints()?
                .into_iter()
                .map(|point| {
                    if *cdf_lower > 0.5 {
                        (survival_lower - (1.0 - point)) / (survival_lower - survival_upper)
                    } else {
                        (point - cdf_lower) / (cdf_upper - cdf_lower)
                    }
                })
                .filter(|point| *point > 0.0 && *point < 1.0)
                .collect(),
            Prepared::Mapped { inner, .. } => inner
                .quantile_breakpoints()?
                .into_iter()
                .map(|point| 1.0 - point)
                .rev()
                .collect(),
            Prepared::Scaled { inner, factor } if *factor < 0.0 => inner
                .quantile_breakpoints()?
                .into_iter()
                .map(|point| 1.0 - point)
                .rev()
                .collect(),
            Prepared::Scaled { inner, .. } => inner.quantile_breakpoints()?,
            _ => Vec::new(),
        })
    }

    fn mean_only(&self) -> Result<f64> {
        if let Prepared::Mixture { components, .. } = self {
            let mut total = 0.0;
            for (weight, component) in components {
                total += weight * component.mean_only()?;
            }
            return Ok(total);
        }
        let mut cuts = vec![0.0];
        cuts.extend(self.quantile_breakpoints()?);
        cuts.push(1.0);
        let mut mean = 0.0;
        for pair in cuts.windows(2) {
            mean += integrate_between(pair[0], pair[1], 1.0 - pair[1], |u, v| {
                self.quantile_pair(u, v)
            })?;
        }
        Ok(mean)
    }

    fn quadrature_moments(&self) -> Result<(f64, f64)> {
        let mut cuts = vec![0.0];
        cuts.extend(self.quantile_breakpoints()?);
        cuts.push(1.0);
        let mut mean = 0.0;
        for pair in cuts.windows(2) {
            mean += integrate_between(pair[0], pair[1], 1.0 - pair[1], |u, v| {
                self.quantile_pair(u, v)
            })?;
        }
        let mut variance = 0.0;
        for pair in cuts.windows(2) {
            variance += integrate_between(pair[0], pair[1], 1.0 - pair[1], |u, v| {
                Ok((self.quantile_pair(u, v)? - mean).powi(2))
            })?;
        }
        Ok((mean, variance))
    }

    fn moment_existence(&self) -> (bool, bool) {
        let (low, high) = self.support();
        if low.is_finite() && high.is_finite() {
            return (true, true);
        }
        match self {
            Prepared::StudentT { freedom, .. } => (*freedom > 1.0, *freedom > 2.0),
            Prepared::Metalog {
                coefficients,
                lower,
                upper,
            } => {
                let (exponent_low, exponent_high) = metalog_tail_exponents(coefficients);
                let exponent = match (lower, upper) {
                    (Some(_), None) => exponent_high,
                    (None, Some(_)) => exponent_low,
                    _ => 0.0,
                };
                (exponent < 1.0, exponent < 0.5)
            }
            Prepared::Truncated { inner, .. } | Prepared::Scaled { inner, .. } => inner.moment_existence(),
            Prepared::Mapped {
                inner,
                mapping: Mapping::Reciprocal,
            } => match inner.as_ref() {
                Prepared::Gamma { shape, .. } => (*shape > 1.0, *shape > 2.0),
                _ => (true, true),
            },
            Prepared::Mixture { components, .. } => components.iter().fold(
                (true, true),
                |(mean, variance), (_, component)| {
                    let (component_mean, component_variance) = component.moment_existence();
                    (mean && component_mean, variance && component_variance)
                },
            ),
            _ => (true, true),
        }
    }

    fn moments(&self) -> Result<(f64, f64)> {
        let (mean_exists, variance_exists) = self.moment_existence();
        if !mean_exists {
            return Err(math_error(
                "this law has no finite mean, so it has no point value".to_string(),
            ));
        }
        if !variance_exists {
            let mean = match self {
                Prepared::StudentT { location, .. } => *location,
                _ => self.mean_only()?,
            };
            return Ok((mean, f64::INFINITY));
        }
        Ok(match self {
            Prepared::Point { value } => (*value, 0.0),
            Prepared::Beta {
                alpha,
                beta,
                lower,
                width,
            } => {
                let sum = alpha + beta;
                (
                    lower + width * alpha / sum,
                    width * width * alpha * beta / (sum * sum * (sum + 1.0)),
                )
            }
            Prepared::Gamma { shape, scale } => (shape * scale, shape * scale * scale),
            Prepared::Lognormal { mean, sigma, .. } => (
                *mean,
                mean * mean * kernels::exp_minus_one(sigma * sigma)?,
            ),
            Prepared::Normal { mean, deviation } => (*mean, deviation * deviation),
            Prepared::StudentT {
                location,
                scale,
                freedom,
            } => (*location, scale * scale * freedom / (freedom - 2.0)),
            Prepared::Uniform { lower, upper } => {
                ((lower + upper) / 2.0, (upper - lower).powi(2) / 12.0)
            }
            Prepared::LogUniform { lower, upper } => {
                let span = (upper / lower).ln();
                let mean = (upper - lower) / span;
                let square = (upper * upper - lower * lower) / (2.0 * span);
                (mean, square - mean * mean)
            }
            Prepared::Triangular {
                lower,
                mode,
                upper,
                logarithmic: false,
            } => (
                (lower + mode + upper) / 3.0,
                (lower * lower + mode * mode + upper * upper
                    - lower * mode
                    - lower * upper
                    - mode * upper)
                    / 18.0,
            ),
            Prepared::Weibull {
                scale,
                shape,
                location,
            } => {
                let first = kernels::gamma_function(1.0 + 1.0 / shape)?;
                let second = kernels::gamma_function(1.0 + 2.0 / shape)?;
                (
                    location + scale * first,
                    scale * scale * (second - first * first),
                )
            }
            Prepared::MaximumEntropy { mean, .. } => (*mean, self.quadrature_moments()?.1),
            Prepared::Constrained { mean, law } => (*mean, law.variance(*mean)?),
            Prepared::Atoms { atoms } => {
                let mean: f64 = atom_probabilities(atoms)
                    .map(|(value, probability)| value * probability)
                    .sum();
                let variance = atom_probabilities(atoms)
                    .map(|(value, probability)| probability * (value - mean).powi(2))
                    .sum();
                (mean, variance)
            }
            Prepared::Tabulated {
                points,
                logarithmic,
            } => tabulated_moments(points, *logarithmic),
            Prepared::Kernel { atoms, bandwidth } => {
                let mean: f64 = atom_probabilities(atoms)
                    .map(|(value, probability)| value * probability)
                    .sum();
                let variance: f64 = atom_probabilities(atoms)
                    .map(|(value, probability)| probability * (value - mean).powi(2))
                    .sum();
                (mean, variance + bandwidth * bandwidth)
            }
            Prepared::Mixture { components, .. } => {
                let parts = components
                    .iter()
                    .map(|(weight, component)| Ok((*weight, component.moments()?)))
                    .collect::<Result<Vec<_>>>()?;
                let mean: f64 = parts.iter().map(|(weight, (mean, _))| weight * mean).sum();
                let variance = parts
                    .iter()
                    .map(|(weight, (part_mean, part_variance))| {
                        weight * (part_variance + (part_mean - mean).powi(2))
                    })
                    .sum();
                (mean, variance)
            }
            Prepared::Posterior(law) => law.moments()?,
            Prepared::Density(law) => law.moments()?,
            Prepared::Gridded { moments, .. } => *moments,
            Prepared::Product(grid) => grid.moments,
            Prepared::Scaled { inner, factor } => {
                let (mean, variance) = inner.moments()?;
                (factor * mean, factor * factor * variance)
            }
            Prepared::Mapped { inner, mapping } if matches!(inner.as_ref(), Prepared::Gamma { .. }) => {
                let Prepared::Gamma { shape, scale } = inner.as_ref() else {
                    return Err(math_error("not a gamma law".to_string()));
                };
                match mapping {
                    Mapping::Survival { time } => {
                        let first = (-shape * (time * scale).ln_1p()).exp();
                        let second = (-shape * (2.0 * time * scale).ln_1p()).exp();
                        (first, (second - first * first).max(0.0))
                    }
                    Mapping::Reciprocal => {
                        let mean = 1.0 / (scale * (shape - 1.0));
                        (mean, mean * mean / (shape - 2.0))
                    }
                }
            }
            Prepared::Truncated {
                inner,
                lower,
                upper,
                ..
            } if matches!(inner.as_ref(), Prepared::Lognormal { .. }) => {
                let Prepared::Lognormal { sigma, median, .. } = inner.as_ref() else {
                    return Err(math_error("not a lognormal law".to_string()));
                };
                truncated_lognormal_moments(*sigma, *median, *lower, *upper)?
            }
            _ => self.quadrature_moments()?,
        })
    }
}

fn truncated_lognormal_moments(sigma: f64, median: f64, lower: f64, upper: f64) -> Result<(f64, f64)> {
    let position = |bound: f64| {
        if bound <= 0.0 {
            f64::NEG_INFINITY
        } else {
            (bound / median).ln() / sigma
        }
    };
    let (start, end) = (position(lower), position(upper));
    let mass = normal_mass(start, end)?;
    let first = median * (0.5 * sigma * sigma).exp() * normal_mass(start - sigma, end - sigma)? / mass;
    let second = median * median * (2.0 * sigma * sigma).exp()
        * normal_mass(start - 2.0 * sigma, end - 2.0 * sigma)?
        / mass;
    Ok((first, second - first * first))
}

fn mixture_atomic_quantile(law: &Prepared, u: f64, low: f64, high: f64) -> Result<f64> {
    if law.cdf(low)? >= u {
        return Ok(low);
    }
    let mut left = low;
    let mut right = high;
    loop {
        let middle = 0.5 * (left + right);
        if middle <= left || middle >= right {
            return Ok(right);
        }
        if law.cdf(middle)? >= u {
            right = middle;
        } else {
            left = middle;
        }
    }
}

fn tabulated_cdf(points: &[QuantilePoint], logarithmic: bool, x: f64) -> f64 {
    if x < points[0].value {
        return 0.0;
    }
    if x >= points[points.len() - 1].value {
        return 1.0;
    }
    let mut result = 0.0;
    for pair in points.windows(2) {
        let (left, right) = (&pair[0], &pair[1]);
        if x >= right.value {
            result = right.probability;
            continue;
        }
        if x >= left.value && right.value > left.value {
            let fraction = if logarithmic {
                (x / left.value).ln() / (right.value / left.value).ln()
            } else {
                (x - left.value) / (right.value - left.value)
            };
            return left.probability + fraction * (right.probability - left.probability);
        }
        if x < left.value {
            break;
        }
        result = result.max(left.probability);
    }
    result
}

fn tabulated_quantile(points: &[QuantilePoint], logarithmic: bool, u: f64) -> f64 {
    for pair in points.windows(2) {
        let (left, right) = (&pair[0], &pair[1]);
        if u <= right.probability {
            if right.value == left.value {
                return left.value;
            }
            let fraction = (u - left.probability) / (right.probability - left.probability);
            return if logarithmic {
                left.value * ((right.value / left.value).ln() * fraction).exp()
            } else {
                left.value + fraction * (right.value - left.value)
            };
        }
    }
    points[points.len() - 1].value
}

fn tabulated_density(points: &[QuantilePoint], logarithmic: bool, x: f64) -> f64 {
    for pair in points.windows(2) {
        let (left, right) = (&pair[0], &pair[1]);
        if x >= left.value && x <= right.value && right.value > left.value {
            let mass = right.probability - left.probability;
            return if logarithmic {
                mass / (x * (right.value / left.value).ln())
            } else {
                mass / (right.value - left.value)
            };
        }
    }
    0.0
}

fn tabulated_moments(points: &[QuantilePoint], logarithmic: bool) -> (f64, f64) {
    let segment_first = |left: &QuantilePoint, right: &QuantilePoint| {
        if right.value == left.value {
            left.value
        } else if logarithmic {
            (right.value - left.value) / (right.value / left.value).ln()
        } else {
            0.5 * (left.value + right.value)
        }
    };
    let mean: f64 = points
        .windows(2)
        .map(|pair| (pair[1].probability - pair[0].probability) * segment_first(&pair[0], &pair[1]))
        .sum();
    let variance = points
        .windows(2)
        .map(|pair| {
            let (left, right) = (&pair[0], &pair[1]);
            let mass = right.probability - left.probability;
            let spread = if right.value == left.value {
                (left.value - mean).powi(2)
            } else if logarithmic {
                let span = (right.value / left.value).ln();
                let first = (right.value - left.value) / span;
                let second = (right.value * right.value - left.value * left.value) / (2.0 * span);
                second - 2.0 * mean * first + mean * mean
            } else {
                let a = left.value - mean;
                let b = right.value - mean;
                (a * a + a * b + b * b) / 3.0
            };
            mass * spread
        })
        .sum();
    (mean, variance)
}

fn truncate_tabulated(
    points: &[QuantilePoint],
    logarithmic: bool,
    low: f64,
    high: f64,
) -> Vec<QuantilePoint> {
    let bottom = tabulated_cdf(points, logarithmic, low);
    let top = tabulated_cdf(points, logarithmic, high);
    let mass = top - bottom;
    let mut kept = vec![QuantilePoint {
        probability: 0.0,
        value: low,
    }];
    for point in points {
        if point.value > low && point.value < high {
            kept.push(QuantilePoint {
                probability: (point.probability - bottom) / mass,
                value: point.value,
            });
        }
    }
    kept.push(QuantilePoint {
        probability: 1.0,
        value: high,
    });
    kept
}

fn triangle_survival(x: f64, lower: f64, mode: f64, upper: f64) -> f64 {
    if x <= lower {
        1.0
    } else if x >= upper {
        0.0
    } else if x <= mode {
        1.0 - (x - lower).powi(2) / ((upper - lower) * (mode - lower))
    } else {
        (upper - x).powi(2) / ((upper - lower) * (upper - mode))
    }
}

fn tabulated_survival(points: &[QuantilePoint], logarithmic: bool, x: f64) -> f64 {
    if x < points[0].value {
        return 1.0;
    }
    if x >= points[points.len() - 1].value {
        return 0.0;
    }
    for pair in points.windows(2) {
        let (left, right) = (&pair[0], &pair[1]);
        if x < right.value && x >= left.value && right.value > left.value {
            let remaining = if logarithmic {
                (right.value / x).ln() / (right.value / left.value).ln()
            } else {
                (right.value - x) / (right.value - left.value)
            };
            return (1.0 - right.probability) + remaining * (right.probability - left.probability);
        }
    }
    1.0 - tabulated_cdf(points, logarithmic, x)
}

fn entropy_cdf(lower: f64, upper: f64, slope: f64, x: f64) -> Result<f64> {
    if x <= lower {
        return Ok(0.0);
    }
    if x >= upper {
        return Ok(1.0);
    }
    if slope == 0.0 {
        return Ok((x - lower) / (upper - lower));
    }
    let whole = kernels::exp_minus_one(slope * (upper - lower))?;
    if whole.is_finite() {
        Ok(kernels::exp_minus_one(slope * (x - lower))? / whole)
    } else {
        Ok((slope * (x - upper)).exp() * kernels::exp_minus_one(-slope * (x - lower))?
            / kernels::exp_minus_one(-slope * (upper - lower))?)
    }
}

fn entropy_survival(lower: f64, upper: f64, slope: f64, x: f64) -> Result<f64> {
    if x <= lower {
        return Ok(1.0);
    }
    if x >= upper {
        return Ok(0.0);
    }
    if slope == 0.0 {
        return Ok((upper - x) / (upper - lower));
    }
    let tail = kernels::exp_minus_one(slope * (upper - x))?;
    if slope < 0.0 {
        Ok(tail * (slope * (x - lower)).exp() / kernels::exp_minus_one(slope * (upper - lower))?)
    } else {
        Ok(tail * (slope * (x - upper)).exp() / -kernels::exp_minus_one(-slope * (upper - lower))?)
    }
}

fn entropy_quantile(lower: f64, upper: f64, slope: f64, u: f64, one_minus_u: f64) -> Result<f64> {
    let width = upper - lower;
    if slope == 0.0 {
        return Ok(if u > 0.5 {
            upper - one_minus_u * width
        } else {
            lower + u * width
        });
    }
    let from_lower = kernels::exp_minus_one(slope * width)?;
    let from_upper = -kernels::exp_minus_one(-slope * width)?;
    let use_lower = if u > 0.5 {
        !from_upper.is_finite()
    } else {
        from_lower.is_finite()
    };
    if use_lower {
        Ok(lower + kernels::log_one_plus(u * from_lower)? / slope)
    } else {
        Ok(upper + kernels::log_one_plus(-one_minus_u * from_upper)? / slope)
    }
}
