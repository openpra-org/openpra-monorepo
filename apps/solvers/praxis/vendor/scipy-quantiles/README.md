# SciPy inverse-CDF dependency for HCL_MH LHS

HCL_MH's `uq/basic_event_models.py::sample_dist` calls `scipy.stats.*.ppf`
for Latin hypercube sampling. The HCL sampling algorithm and distribution
transforms are ported to Rust. This directory retains the original mathematical
dependency in C++, without replacing its numerical algorithms.

Four scalar kernels are called:

| Distribution | SciPy 1.17.1 call | Original kernel |
| --- | --- | --- |
| Beta | `scipy.special._ufuncs._beta_ppf` | Boost `ibeta_inv`, with SciPy's `BetaPolicyForStats` |
| Normal, lognormal, logit-normal | `scipy.special.ndtri` | XSF/Cephes `ndtri` |
| Gamma | `scipy.special.gammaincinv` | XSF/Cephes `igami` |
| Exponential | `scipy.special.log1p` | XSF/Cephes `log1p`, negated as in `expon._ppf` |

Uniform and triangular inverse transforms are simple expressions
ported from HCL_MH/SciPy to `src/hcl/uncertainty/sampling.rs`.
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
`cosl_internal.S` map directly to `quantiles/windows_math.rs`. Constants and
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
API. Exceptions cannot cross the C ABI. `quantiles.rs` checks the status and
does not substitute another inverse-CDF method if evaluation fails.

Building PRAXIS now requires a C++17 compiler. Cargo's `cc` build dependency
selects the native compiler and links the static library. The solver and addon
do not need Python or SciPy installed at runtime. Verification evidence is under
`outputs/hcl-issue03-exponential-lhs` and `outputs/hcl-issue04-windows-lhs`
at the repository root.

HCL_MH does not pin NumPy or SciPy. NumPy 2.4.4 and SciPy 1.17.1 are explicit
reference versions, not a claim about the author's original environment.
