use std::ffi::c_int;

use crate::{PraxisError, Result};

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
mod windows_math;

#[repr(C)]
struct SpecialResult {
    value: f64,
    status: c_int,
}

extern "C" {
    fn praxis_special_function(function: c_int, x: f64, a: f64, b: f64) -> SpecialResult;
    fn praxis_math_erf(x: f64) -> f64;
}

#[derive(Clone, Copy, Debug)]
enum Kernel {
    BetaQuantile = 0,
    NormalQuantile = 1,
    GammaQuantile = 2,
    ExponentialQuantile = 3,
    BetaCdf = 4,
    BetaSurvival = 5,
    BetaInverseSurvival = 6,
    BetaDensity = 7,
    GammaCdf = 8,
    GammaSurvival = 9,
    GammaInverseSurvival = 10,
    GammaDensity = 11,
    NormalCdf = 12,
    LogOnePlus = 13,
    ExpMinusOne = 14,
    GammaFunction = 15,
    LogGamma = 16,
}

fn evaluate(kernel: Kernel, x: f64, a: f64, b: f64) -> Result<f64> {
    let result = unsafe { praxis_special_function(kernel as c_int, x, a, b) };
    if result.status == 2 || result.value.is_nan() {
        return Err(PraxisError::Logic(format!(
            "the {:?} kernel could not evaluate ({}, {}, {})",
            kernel, x, a, b
        )));
    }
    if result.status == 1 {
        tracing::warn!(?kernel, x, a, b, "a SciPy kernel reported a numerical warning");
    }
    Ok(result.value)
}

pub fn beta_quantile(q: f64, alpha: f64, beta: f64) -> Result<f64> {
    evaluate(Kernel::BetaQuantile, q, alpha, beta)
}

pub fn beta_inverse_survival(q: f64, alpha: f64, beta: f64) -> Result<f64> {
    evaluate(Kernel::BetaInverseSurvival, q, alpha, beta)
}

pub fn beta_cdf(x: f64, alpha: f64, beta: f64) -> Result<f64> {
    evaluate(Kernel::BetaCdf, x, alpha, beta)
}

pub fn beta_survival(x: f64, alpha: f64, beta: f64) -> Result<f64> {
    evaluate(Kernel::BetaSurvival, x, alpha, beta)
}

pub fn beta_density(x: f64, alpha: f64, beta: f64) -> Result<f64> {
    evaluate(Kernel::BetaDensity, x, alpha, beta)
}

pub fn normal_quantile(q: f64) -> Result<f64> {
    evaluate(Kernel::NormalQuantile, q, 0.0, 0.0)
}

pub fn normal_cdf(x: f64) -> Result<f64> {
    evaluate(Kernel::NormalCdf, x, 0.0, 0.0)
}

pub fn gamma_quantile(q: f64, shape: f64) -> Result<f64> {
    evaluate(Kernel::GammaQuantile, q, shape, 0.0)
}

pub fn gamma_inverse_survival(q: f64, shape: f64) -> Result<f64> {
    evaluate(Kernel::GammaInverseSurvival, q, shape, 0.0)
}

pub fn gamma_cdf(x: f64, shape: f64) -> Result<f64> {
    evaluate(Kernel::GammaCdf, x, shape, 0.0)
}

pub fn gamma_survival(x: f64, shape: f64) -> Result<f64> {
    evaluate(Kernel::GammaSurvival, x, shape, 0.0)
}

pub fn gamma_density(x: f64, shape: f64) -> Result<f64> {
    evaluate(Kernel::GammaDensity, x, shape, 0.0)
}

pub fn exponential_quantile(q: f64) -> Result<f64> {
    evaluate(Kernel::ExponentialQuantile, q, 0.0, 0.0)
}

pub fn log_one_plus(x: f64) -> Result<f64> {
    evaluate(Kernel::LogOnePlus, x, 0.0, 0.0)
}

pub fn exp_minus_one(x: f64) -> Result<f64> {
    evaluate(Kernel::ExpMinusOne, x, 0.0, 0.0)
}

pub fn gamma_function(x: f64) -> Result<f64> {
    evaluate(Kernel::GammaFunction, x, 0.0, 0.0)
}

pub fn log_gamma(x: f64) -> Result<f64> {
    evaluate(Kernel::LogGamma, x, 0.0, 0.0)
}

pub fn erf(x: f64) -> f64 {
    unsafe { praxis_math_erf(x) }
}

#[cfg(all(test, target_os = "windows", target_arch = "x86_64"))]
mod tests {
    #[test]
    fn exponential_uses_the_source_windows_logarithm() {
        assert_eq!(
            super::exponential_quantile(0.3309436777652292)
                .unwrap()
                .to_bits(),
            0x3fd9b884649cfeab,
        );
    }

    #[test]
    fn windows_quantiles_match_scipy_exact_bits() {
        let beta: &[(f64, f64, f64, u64)] = &[
            (0.0753845957343932, 2.0, 8.0, 0x3faa70f7158c7cba),
            (0.9799152753199261, 2.0, 8.0, 0x3fdfe021c6724353),
            (0.131, 0.5, 0.5, 0x3fa56018e7348012),
            (0.371, 100.0, 200.0, 0x3fd4bd0ece66af0e),
            (0.293, 1.0, 8.0, 0x3fa5b76468b882fc),
            (0.19, 0.05, 3.0, 0x3ccf2668784af6bc),
            (0.123, 10000.0, 10000.0, 0x3fdfbccc89363e0b),
        ];
        for &(q, alpha, b, expected) in beta {
            assert_eq!(
                super::beta_quantile(q, alpha, b).unwrap().to_bits(),
                expected,
                "beta q={q}, a={alpha}, b={b}"
            );
        }
        let gamma: &[(f64, f64, u64)] = &[
            (0.059821533587857585, 2.0, 0x3fd92f57fe6be374),
            (0.018299711890537383, 2.0, 0x3fca3391fdb417a5),
            (0.063, 1.0, 0x3fb0a88ef1e65106),
            (0.0001, 0.1, 0x3795295715028c3e),
            (0.9, 100.0, 0x405c40ac6c447706),
        ];
        for &(q, shape, expected) in gamma {
            assert_eq!(
                super::gamma_quantile(q, shape).unwrap().to_bits(),
                expected,
                "gamma q={q}, shape={shape}"
            );
        }
        let normal: &[(f64, u64)] = &[
            (1e-05, 0xc0110f3f8843a3d9),
            (0.05989234230213047, 0xbff8e40e98bcbdc7),
            (0.0703047134376713, 0xbff7938f57e7ec65),
        ];
        for &(q, expected) in normal {
            assert_eq!(
                super::normal_quantile(q).unwrap().to_bits(),
                expected,
                "normal q={q}"
            );
        }
    }
}
