//! The same inverse-CDF kernels called by HCL_MH through SciPy 1.17.1.
//! Sampling and distribution transforms live in Rust; this ABI keeps the
//! source's numerical dependency unchanged. No Python runtime is required.

use crate::{PraxisError, Result};

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
mod windows_math;

#[repr(C)]
struct QuantileResult {
    value: f64,
    status: std::ffi::c_int,
}

extern "C" {
    fn hcl_scipy_quantile(family: std::ffi::c_int, q: f64, a: f64, b: f64) -> QuantileResult;
}

fn evaluate(family: std::ffi::c_int, q: f64, a: f64, b: f64) -> Result<f64> {
    // All arguments and the return value are C scalars. The bridge catches
    // every C++ exception, retains no references, and uses thread-local status.
    let result = unsafe { hcl_scipy_quantile(family, q, a, b) };
    if result.status == 2 || result.value.is_nan() {
        return Err(PraxisError::Hcl(
            "the source inverse CDF could not evaluate these LHS parameters".into(),
        ));
    }
    if result.status == 1 {
        tracing::warn!(
            family,
            q,
            a,
            b,
            "SciPy inverse CDF reported a numerical warning"
        );
    }
    Ok(result.value)
}

pub(super) fn beta(q: f64, alpha: f64, beta: f64) -> Result<f64> {
    evaluate(0, q, alpha, beta)
}

pub(super) fn normal(q: f64) -> Result<f64> {
    evaluate(1, q, 0.0, 0.0)
}

pub(super) fn gamma(q: f64, shape: f64) -> Result<f64> {
    evaluate(2, q, shape, 0.0)
}

pub(super) fn exponential(q: f64) -> Result<f64> {
    evaluate(3, q, 0.0, 0.0)
}

#[cfg(all(test, target_os = "windows", target_arch = "x86_64"))]
mod tests {
    #[test]
    fn exponential_uses_the_source_windows_logarithm() {
        // SciPy 1.17.1 Windows expon.ppf(0.3309436777652292), scale=1.
        // MSVC's log gives the adjacent lower value for this input.
        assert_eq!(
            super::exponential(0.3309436777652292).unwrap().to_bits(),
            0x3fd9b884649cfeab,
        );
    }

    #[test]
    fn windows_quantiles_match_scipy_exact_bits() {
        // Fresh SciPy 1.17.1 reference values; no decimal rounding tolerance.
        let cases: &[(i32, f64, f64, f64, u64)] = &[
            (0, 0.0753845957343932, 2.0, 8.0, 0x3faa70f7158c7cba),
            (0, 0.9799152753199261, 2.0, 8.0, 0x3fdfe021c6724353),
            (0, 0.131, 0.5, 0.5, 0x3fa56018e7348012),
            (0, 0.371, 100.0, 200.0, 0x3fd4bd0ece66af0e),
            (0, 0.293, 1.0, 8.0, 0x3fa5b76468b882fc),
            (0, 0.19, 0.05, 3.0, 0x3ccf2668784af6bc),
            (0, 0.123, 10000.0, 10000.0, 0x3fdfbccc89363e0b),
            (2, 0.059821533587857585, 2.0, 0.0, 0x3fd92f57fe6be374),
            (2, 0.018299711890537383, 2.0, 0.0, 0x3fca3391fdb417a5),
            (2, 0.063, 1.0, 0.0, 0x3fb0a88ef1e65106),
            (2, 0.0001, 0.1, 0.0, 0x3795295715028c3e),
            (2, 0.9, 100.0, 0.0, 0x405c40ac6c447706),
            (1, 1e-05, 0.0, 0.0, 0xc0110f3f8843a3d9),
            (1, 0.05989234230213047, 0.0, 0.0, 0xbff8e40e98bcbdc7),
            (1, 0.0703047134376713, 0.0, 0.0, 0xbff7938f57e7ec65),
        ];
        for &(family, q, a, b, expected) in cases {
            assert_eq!(
                super::evaluate(family, q, a, b).unwrap().to_bits(),
                expected,
                "family={family}, q={q}, a={a}, b={b}"
            );
        }
    }
}
