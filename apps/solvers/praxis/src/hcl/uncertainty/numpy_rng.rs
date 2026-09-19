//! Rust port of the NumPy generator used by HCL_MH's `_build_ft_p_vectors`.
//!
//! Sources: NumPy 2.4.4 `random/bit_generator.pyx` (SeedSequence),
//! `random/src/pcg64/pcg64.{h,c}` (PCG64 XSL RR), and
//! `random/src/distributions/distributions.c` (double-precision samplers).
//! Only routines needed by FT distributions, CPT priors and permutation are
//! included. See SOURCE.md and LICENSES.txt in this directory.

mod ziggurat_constants;
use ziggurat_constants::*;

pub(super) struct NumpyRng {
    state: u128,
    increment: u128,
    buffered_u32: Option<u32>,
}

impl NumpyRng {
    pub(super) fn new(seed: u64) -> Self {
        // SeedSequence(seed).generate_state(4, dtype=np.uint64).
        let mut hash_constant = 0x43b0_d7e5_u32;
        let entropy = [seed as u32, (seed >> 32) as u32, 0, 0];
        let mut pool = entropy.map(|word| hashmix(word, &mut hash_constant));
        for source in 0..4 {
            for destination in 0..4 {
                if source != destination {
                    let hashed = hashmix(pool[source], &mut hash_constant);
                    let mixed = 0xca01_f9dd_u32
                        .wrapping_mul(pool[destination])
                        .wrapping_sub(0x4973_f715_u32.wrapping_mul(hashed));
                    pool[destination] = mixed ^ (mixed >> 16);
                }
            }
        }
        hash_constant = 0x8b51_f9dd;
        let mut words = [0_u32; 8];
        for (index, word) in words.iter_mut().enumerate() {
            let value = pool[index % 4] ^ hash_constant;
            hash_constant = hash_constant.wrapping_mul(0x58f3_8ded);
            let value = value.wrapping_mul(hash_constant);
            *word = value ^ (value >> 16);
        }
        let word64 = |index| u64::from(words[index]) | (u64::from(words[index + 1]) << 32);
        let initial_state = (u128::from(word64(0)) << 64) | u128::from(word64(2));
        let initial_sequence = (u128::from(word64(4)) << 64) | u128::from(word64(6));
        let mut rng = Self {
            state: 0,
            increment: (initial_sequence << 1) | 1,
            buffered_u32: None,
        };
        rng.step();
        rng.state = rng.state.wrapping_add(initial_state);
        rng.step();
        rng
    }

    fn step(&mut self) {
        const MULTIPLIER: u128 =
            (2_549_297_995_355_413_924_u128 << 64) | 4_865_540_595_714_422_341_u128;
        self.state = self
            .state
            .wrapping_mul(MULTIPLIER)
            .wrapping_add(self.increment);
    }

    fn next_u64(&mut self) -> u64 {
        self.step();
        ((self.state >> 64) as u64 ^ self.state as u64).rotate_right((self.state >> 122) as u32)
    }

    pub(super) fn uniform01(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 * (1.0 / 9_007_199_254_740_992.0)
    }

    // pcg64_next32 keeps the unused upper half, including across double draws.
    fn next_u32(&mut self) -> u32 {
        if let Some(value) = self.buffered_u32.take() {
            return value;
        }
        let value = self.next_u64();
        self.buffered_u32 = Some((value >> 32) as u32);
        value as u32
    }

    // NumPy distributions.c::random_interval, used by Generator.permutation.
    fn interval(&mut self, maximum: usize) -> usize {
        if maximum == 0 {
            return 0;
        }
        let mut mask = maximum as u64;
        mask |= mask >> 1;
        mask |= mask >> 2;
        mask |= mask >> 4;
        mask |= mask >> 8;
        mask |= mask >> 16;
        mask |= mask >> 32;
        loop {
            let value = if maximum <= u32::MAX as usize {
                u64::from(self.next_u32())
            } else {
                self.next_u64()
            } & mask;
            if value <= maximum as u64 {
                return value as usize;
            }
        }
    }

    /// HCL_MH sample_dist: linspace strata, uniform draws, then permutation.
    pub(super) fn lhs_quantiles(&mut self, size: usize) -> Vec<f64> {
        let step = 1.0 / size as f64;
        let mut draws = (0..size)
            .map(|index| {
                let lower = index as f64 * step;
                // np.linspace fixes its final edge to exactly one.
                let upper = if index + 1 == size {
                    1.0
                } else {
                    (index + 1) as f64 * step
                };
                self.uniform(lower, upper)
            })
            .collect::<Vec<_>>();
        self.shuffle(&mut draws);
        draws
    }

    pub(super) fn shuffle<T>(&mut self, values: &mut [T]) {
        for index in (1..values.len()).rev() {
            let destination = self.interval(index);
            values.swap(index, destination);
        }
    }

    /// NumPy 2.4.4 Generator.dirichlet: stick breaking for max(alpha) < .1,
    /// otherwise normalized Gamma draws. Do not skip deterministic draws:
    /// their RNG consumption affects every following CPT row.
    pub(super) fn dirichlet(&mut self, alpha: &[f64], size: usize) -> Vec<f64> {
        let width = alpha.len();
        let mut values = vec![0.0; size * width];
        if alpha.iter().copied().fold(0.0_f64, f64::max) < 0.1 {
            let mut cumulative = vec![0.0; width];
            let mut sum = 0.0;
            for index in (0..width).rev() {
                sum += alpha[index];
                cumulative[index] = sum;
            }
            for row in values.chunks_exact_mut(width) {
                let mut remaining = 1.0;
                for index in 0..width - 1 {
                    let fraction = self.beta(alpha[index], cumulative[index + 1]);
                    row[index] = remaining * fraction;
                    remaining *= 1.0 - fraction;
                    if cumulative[index + 1] == 0.0 {
                        break;
                    }
                }
                row[width - 1] = remaining;
            }
        } else {
            for row in values.chunks_exact_mut(width) {
                let mut sum = 0.0;
                for (value, shape) in row.iter_mut().zip(alpha) {
                    *value = self.standard_gamma(*shape);
                    sum += *value;
                }
                let inverse = 1.0 / sum;
                for value in row {
                    *value *= inverse;
                }
            }
        }
        values
    }

    pub(super) fn uniform(&mut self, lower: f64, upper: f64) -> f64 {
        lower + (upper - lower) * self.uniform01()
    }

    pub(super) fn standard_normal(&mut self) -> f64 {
        loop {
            let mut bits = self.next_u64();
            let index = (bits & 0xff) as usize;
            bits >>= 8;
            let negative = bits & 1 != 0;
            let magnitude = (bits >> 1) & 0x000f_ffff_ffff_ffff;
            let mut x = magnitude as f64 * WI_DOUBLE[index];
            if negative {
                x = -x;
            }
            if magnitude < KI_DOUBLE[index] {
                return x;
            }
            if index == 0 {
                loop {
                    let xx = -ZIGGURAT_NOR_INV_R * (-self.uniform01()).ln_1p();
                    let yy = -(-self.uniform01()).ln_1p();
                    if yy + yy > xx * xx {
                        return if (magnitude >> 8) & 1 != 0 {
                            -(ZIGGURAT_NOR_R + xx)
                        } else {
                            ZIGGURAT_NOR_R + xx
                        };
                    }
                }
            } else if (FI_DOUBLE[index - 1] - FI_DOUBLE[index]) * self.uniform01()
                + FI_DOUBLE[index]
                < (-0.5 * x * x).exp()
            {
                return x;
            }
        }
    }

    fn standard_exponential(&mut self) -> f64 {
        loop {
            let mut bits = self.next_u64() >> 3;
            let index = (bits & 0xff) as usize;
            bits >>= 8;
            let x = bits as f64 * WE_DOUBLE[index];
            if bits < KE_DOUBLE[index] {
                return x;
            }
            if index == 0 {
                return ZIGGURAT_EXP_R - (-self.uniform01()).ln_1p();
            }
            if (FE_DOUBLE[index - 1] - FE_DOUBLE[index]) * self.uniform01() + FE_DOUBLE[index]
                < (-x).exp()
            {
                return x;
            }
        }
    }

    fn standard_gamma(&mut self, shape: f64) -> f64 {
        if shape == 1.0 {
            return self.standard_exponential();
        }
        if shape == 0.0 {
            return 0.0;
        }
        if shape < 1.0 {
            loop {
                let u = self.uniform01();
                let v = self.standard_exponential();
                if u <= 1.0 - shape {
                    let x = u.powf(1.0 / shape);
                    if x <= v {
                        return x;
                    }
                } else {
                    let y = -((1.0 - u) / shape).ln();
                    let x = (1.0 - shape + shape * y).powf(1.0 / shape);
                    if x <= v + y {
                        return x;
                    }
                }
            }
        }
        let b = shape - 1.0 / 3.0;
        let c = 1.0 / (9.0 * b).sqrt();
        loop {
            let (x, v) = loop {
                let x = self.standard_normal();
                let v = 1.0 + c * x;
                if v > 0.0 {
                    break (x, v);
                }
            };
            let v = v * v * v;
            let u = self.uniform01();
            if u < 1.0 - 0.0331 * (x * x) * (x * x) || u.ln() < 0.5 * x * x + b * (1.0 - v + v.ln())
            {
                return b * v;
            }
        }
    }

    pub(super) fn beta(&mut self, a: f64, b: f64) -> f64 {
        if a <= 1.0 && b <= 1.0 {
            if a < 3e-103 && b < 3e-103 {
                return if (a + b) * self.uniform01() < a {
                    1.0
                } else {
                    0.0
                };
            }
            loop {
                let u = self.uniform01();
                let v = self.uniform01();
                let x = u.powf(1.0 / a);
                let y = v.powf(1.0 / b);
                if x + y <= 1.0 && u + v > 0.0 {
                    if x > 0.0 && y > 0.0 {
                        return x / (x + y);
                    }
                    let delta = u.ln() / a - v.ln() / b;
                    return if delta > 0.0 {
                        (-(-delta).exp().ln_1p()).exp()
                    } else {
                        (delta - delta.exp().ln_1p()).exp()
                    };
                }
            }
        }
        let ga = self.standard_gamma(a);
        let gb = self.standard_gamma(b);
        ga / (ga + gb)
    }

    pub(super) fn lognormal(&mut self, mu: f64, sigma: f64) -> f64 {
        (mu + sigma * self.standard_normal()).exp()
    }

    pub(super) fn normal(&mut self, mean: f64, standard_deviation: f64) -> f64 {
        mean + standard_deviation * self.standard_normal()
    }

    pub(super) fn gamma(&mut self, shape: f64, scale: f64) -> f64 {
        scale * self.standard_gamma(shape)
    }

    pub(super) fn exponential(&mut self, scale: f64) -> f64 {
        scale * self.standard_exponential()
    }

    pub(super) fn triangular(&mut self, lower: f64, mode: f64, upper: f64) -> f64 {
        let base = upper - lower;
        let left = mode - lower;
        let ratio = left / base;
        let left_product = left * base;
        let right_product = (upper - mode) * base;
        let u = self.uniform01();
        if u <= ratio {
            lower + (u * left_product).sqrt()
        } else {
            upper - ((1.0 - u) * right_product).sqrt()
        }
    }
}

fn hashmix(mut value: u32, hash_constant: &mut u32) -> u32 {
    value ^= *hash_constant;
    *hash_constant = hash_constant.wrapping_mul(0x931e_8875);
    value = value.wrapping_mul(*hash_constant);
    value ^ (value >> 16)
}
