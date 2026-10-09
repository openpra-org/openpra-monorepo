# SciPy special-function kernels for PRAXIS

PRAXIS samples every uncertainty law by its inverse CDF and reports means,
quantiles and densities. The reference library is SciPy 1.17.1. This directory
retains SciPy's own numerical kernels in C++, without replacing their
algorithms, so PRAXIS results match SciPy. `src/core/special_functions.rs` is
the only Rust caller. The uncertainty laws in `src/core/distribution_math.rs`
and the HCL sampler in `src/hcl/uncertainty/sampling.rs` both use it.

These scalar kernels are called:

| Code | Use | SciPy 1.17.1 call | Original kernel |
| --- | --- | --- | --- |
| 0 | Beta quantile | `scipy.special._ufuncs._beta_ppf` | Boost `ibeta_inv`, with SciPy's `BetaPolicyForStats` |
| 1 | Normal quantile | `scipy.special.ndtri` | XSF/Cephes `ndtri` |
| 2 | Gamma quantile | `scipy.special.gammaincinv` | XSF/Cephes `igami` |
| 3 | Exponential quantile | `scipy.special.log1p` | XSF/Cephes `log1p`, negated as in `expon._ppf` |
| 4 | Beta CDF | `scipy.special.betainc` | Boost `ibeta` |
| 5 | Beta survival | `scipy.special.betaincc` | Boost `ibetac` |
| 6 | Beta inverse survival | `scipy.special.betainccinv` | Boost `ibetac_inv` |
| 7 | Beta density | `scipy.special._ufuncs._beta_pdf` | Boost `ibeta_derivative` |
| 8 | Gamma CDF | `scipy.special.gammainc` | XSF/Cephes `igam` |
| 9 | Gamma survival | `scipy.special.gammaincc` | XSF/Cephes `igamc` |
| 10 | Gamma inverse survival | `scipy.special.gammainccinv` | XSF/Cephes `igamci` |
| 11 | Gamma density | not called by SciPy | Boost `gamma_p_derivative` |
| 12 | Normal CDF | `scipy.special.ndtr` | XSF/Cephes `ndtr` |
| 13 | log1p | `scipy.special.log1p` | XSF/Cephes `log1p` |
| 14 | expm1 | `scipy.special.expm1` | XSF/Cephes `expm1` |
| 15 | Gamma function | `scipy.special.gamma` | XSF/Cephes `Gamma` |
| 16 | Log gamma | `scipy.special.gammaln` | XSF/Cephes `lgam` |

The beta kernels use one policy, SciPy's `BetaPolicyForStats`. All headers
needed by codes 4 to 16 were already in the vendored include closure.
Uniform and triangular inverse transforms are simple expressions in Rust.
Exponential scaling remains in Rust; its logarithm uses the original SciPy
kernel, whose floating-point results can differ from the platform `log1p`.

On Windows x86-64, the reference SciPy wheel uses GCC 10.3.0 from Rtools.
The bridge selects Boost's GCC polynomial and rational evaluation methods
(method 3). MSVC's default method 2 evaluates expressions in a different order.

`build.rs` makes a private copy of the unchanged headers in Cargo's build
directory. It changes only the namespace of `std::log`, `std::exp`, `std::pow`,
`std::sin` and `std::cos` calls and using-declarations. `windows_math.h` routes
these double-only calls to Rust ports of the reference MinGW runtime, retaining
its x87 extended precision and final double conversion. This adapter adds
nothing to `namespace std` and changes no coefficients, branches or iterations.
`log1p`, `expm1` and the separate seismic `erf` call retain UCRT behavior,
matching the reference. Linux uses the original headers directly.

The general logarithm port also replaces the former exponential-only helper.
No additional DLL, compiler or Python runtime is needed in the application.

The original runtime sources, notice and their hashes are retained in
`reference/mingw/`. Its source references are:

- [SciPy Windows Rtools build](https://github.com/scipy/scipy/blob/v1.17.1/.github/workflows/wheels.yml)
- [Rtools runtime package](https://cran.r-project.org/bin/windows/Rtools/4.0/ucrt64/)
- [MinGW runtime revision](https://github.com/mingw-w64/mingw-w64/tree/acc9b9d9e/mingw-w64-crt/math)

The Rtools runtime package is `9.0.0.6214.acc9b9d9e-1`. Its source files
`log.def.h`, `internal_logl.S`, `exp.def.h`, `pow.def.h`, `powi.def.h`,
`log2l.S`, `exp2l.S`, `sin.def.h`, `sinl_internal.S`, `cos.def.h` and
`cosl_internal.S` map directly to `src/core/special_functions/windows_math.rs`. Constants and
type definitions come from `complex_internal.h`. Sources and full ZPL/public
domain notices are retained under `reference/mingw`; hashes are in its manifest.

## Provenance

These are the exact dependency revisions selected by SciPy **1.17.1**:

- Boost Math: `5e088ffe2ed0e237b9069e3a7352865283d8f196`
- SciPy XSF: `0d0a593fd31073af10062d0093144e13ae34f8f3`

References:

- [HCL_MH sampler](../../../../../resources/HCL_MH/uq/basic_event_models.py)
- [SciPy distribution PPF calls](https://github.com/scipy/scipy/blob/v1.17.1/scipy/stats/_continuous_distns.py)
- [SciPy beta wrapper and policy](https://github.com/scipy/scipy/blob/v1.17.1/scipy/special/boost_special_functions.h)
- [SciPy Boost submodule](https://github.com/scipy/scipy/tree/v1.17.1/subprojects/boost_math/math)
- [SciPy XSF submodule](https://github.com/scipy/scipy/tree/v1.17.1/subprojects/xsf)

The 204 headers are the local include closure of `beta.hpp`, `ndtri.h`,
`igami.h` and `unity.h`, including platform-conditional includes. Each is unchanged;
`manifest.json` records SHA-256 hashes. The original licenses and bundled notices
are alongside this file. No full Boost installation or network download is
required to build.

`bridge.cpp` exposes these kernels and the existing platform `erf` call to Rust. It preserves SciPy's beta
policy and returns warning/error status instead of using Python's reporting
API. Exceptions cannot cross the C ABI. `special_functions.rs` checks the status
and does not substitute another method if evaluation fails.

Building PRAXIS now requires a C++17 compiler. Cargo's `cc` build dependency
selects the native compiler and links the static library. The solver and addon
do not need Python or SciPy installed at runtime. Verification evidence is under
`outputs/hcl-issue03-exponential-lhs` and `outputs/hcl-issue04-windows-lhs`
at the repository root.

HCL_MH does not pin NumPy or SciPy. NumPy 2.4.4 and SciPy 1.17.1 are explicit
reference versions, not a claim about the author's original environment.
