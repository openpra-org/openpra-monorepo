# Tasks 19–20: FT probability and BN CPT uncertainty

The sampling and vectorized BDD method come from **HCL_MH**. Main supplies the
original point-probability bridge and TensorBayes inference. No new probability
or inverse-CDF algorithm is introduced.

Saved workbook uncertainty settings are drafts and remain unchanged during
loading and probability execution. Only an uncertainty request validates its
selected configuration. Probability snapshots omit uncertainty, including
obsolete or malformed settings. The frontend offers explicit review before
those settings can be used for uncertainty; it never infers replacement priors.

The numeric web API accepts seeds from 0 through `Number.MAX_SAFE_INTEGER`
(`9007199254740991`). This removes the former 32-bit web cap without changing
the solver's `u64` seed or NumPy SeedSequence/PCG64 port. HCL_MH passes seeds
directly to `np.random.default_rng`; larger Python integers remain outside
this numeric web contract. Unsafe JavaScript integers are rejected, never
rounded, truncated to 32 bits or reduced modulo a smaller range.

## Exact verification reference

Use main's HCL + TensorBayes for BN inference, including sampled CPTs. HCL_MH's
Pgmpy backend can round differently; it is a separate engine comparison.

For uncertainty verification, run the original sources in this order:

1. Generate FT and CPT samples with HCL_MH.
2. Run HCL_MH's original CUDD vector evaluator (`_eval_slice_cudd`) with
   conditional BN queries supplied by original main TensorBayes. Preserve
   binary64 values, evidence, state bindings and supplied BDD order. Use
   HCL_MH's FT probability clipping.
3. Summarize those probabilities with HCL_MH's original NumPy statistics.
4. Compare samples, probabilities, API summaries and saved results exactly.

Retain Pgmpy differences separately. Do not round values or change TensorBayes
to make the two inference engines appear identical.

Main's scalar HCL recurrence is `p * high + (1 - p) * low`; HCL_MH's vector
recurrence is `low + p * (high - low)`. These can round differently even with
identical BN marginals. Compare point calculations against main and uncertainty
calculations against the source combination above. Scalar main runs on sampled
inputs are useful diagnostics, but do not replace the vector reference.

Use the CUDD reference for complemented BDD traversal. HCL_MH's fallback
`_eval_slice_let` expands cofactors instead and can round differently for NOT
gates. If CUDD runs on another platform, pass it the original sampling
platform's exact binary64 population and summarize its output on that original
platform. Sampling libraries can also round differently across platforms.

## Evidence conflicts and zero-probability branches (issue 21)

HCL_MH's full `BNPathOracle` can raise a path/base-evidence conflict while its
vector evaluator visits a branch that cannot occur under the supplied evidence.
For example, with `A=False` observed and `TOP=A AND B`, visiting `A=True` raises
in `_evidence_from_context_int` even though the top-event probability is zero.
The verification record retains this original-source exception separately.

The application already uses main's `hcl/quantify.rs::EvidenceContext::extend`
rule: intersect the branch's allowed states with the existing evidence; an
empty intersection contributes zero. The UQ port retains that source rule and
the HCL_MH vector arithmetic. Replaying the original 16 batch cases against the
established combined reference requires no numerical change.

A separate limitation remains when a branch has zero probability because of
the CPT, without an explicit contradictory observation. With `P(A=True)=0`
and `TOP=A AND B`, main's point calculation skips the branch and returns zero.
The HCL_MH vector traversal with original TensorBayes still queries `B` under
the impossible `A=True` branch. TensorBayes and the native API report
`evidence has zero probability in batch row 0`. The full HCL_MH/Pgmpy path can
complete for this same input; it is not an interchangeable exact reference.

The API stores `PRAXIS_BAYESIAN` for the failed scenario and retains successful
batch rows. It does not replace the failed UQ result with the point result,
switch inference engines, discard samples or resample. Resolving zero-mass
branches in sampled vector evaluation requires an approved source correction;
the original HCL_MH conflict exception also remains an upstream issue.

## Supported source methods

For event-tree annual frequencies, multiply each conditional probability
sample by the annualized initiating-event frequency, then summarize that
vector with the same HCL_MH statistics routine. End-state totals add these
annual samples at matching indices before summarization. Do not multiply
already-computed means, standard deviations or percentiles: that changes the
floating-point operation order. Frequency conversion is an application
adapter; the source sampling, BDD evaluation and statistics stay unchanged.

Both Monte Carlo (MC) and Latin hypercube sampling (LHS) support these direct
probability distributions:

Validation follows `uq/basic_event_models.py::sample_dist` separately for each
sampler. Uniform endpoints may be outside [0,1] or equal. MC requires ordered
endpoints with a finite width; LHS retains the source's affine transform even
for reversed endpoints. Bounds are never sorted or clamped before drawing.
Lognormal medians may be any positive finite value. MC accepts normal/logit-normal
spread zero and lognormal error factor one, preserving their RNG consumption.
LHS rejects those zero-spread parameters explicitly because SciPy returns NaN.
Negative spread, error factor below one and other unsupported parameters stay
invalid. Source clipping still applies after drawing; no sampler is substituted.
For uniform, normal, logit-normal and triangular fields, the source's
`_get_param(...) or 0.0` converts signed zero to positive zero before sampling.
The Rust sampling copy applies the same default; stored inputs retain their bits.

The frontend and backend use the same sampler-aware schema, including the
legacy `basicEventSampler` alias and omitted-sampler MC default. Frozen Windows
and Linux fixtures in `hcl_mh_distribution_domain` execute unchanged source
sampling and check exact samples, subsequent RNG draws, and rejected domains.

| Family | Canonical app parameters | HCL_MH parameter mapping |
| --- | --- | --- |
| Beta | alpha, beta | alpha, beta |
| Uniform | lower, upper | a, b |
| Normal | mean, standardDeviation | mu, sigma |
| Lognormal | median, errorFactor | median, error_factor |
| Logit-normal | mu, sigma | mu, sigma |
| Gamma | shape, scale | shape, scale |
| Exponential | rate | rate; scale = 1/rate |
| Triangular | lower, mode, upper | a, m, b |

HCL_MH's binary Dirichlet spelling is a beta alias, not a ninth distribution.
Alternative source parameter spellings map to the canonical forms above; the
app does not expose each spelling as a separate choice. Exponential rate is a
parameter of a probability distribution, not a component failure-rate model.

## Source mapping

Paths below are relative to the repository root.

| Operation | Original source | Implementation |
| --- | --- | --- |
| Eight MC distributions and LHS stratification/permutation/PPF | `resources/HCL_MH/uq/basic_event_models.py::sample_dist` | `sampling.rs`, `numpy_rng.rs`, `quantiles.rs` |
| Lognormal `mu=log(median)`, `sigma=log(error_factor)/1.645` | `basic_event_models.py::_lognormal_mu_sigma` | `sampling.rs` |
| Separate FT RNG; complete vector per event; clip to `[0,1]` | `resources/HCL_MH/utils/ft_gui_builder_pkg/hcl/runner.py::_build_ft_p_vectors` | `PreparedHclUncertainty::with_chunk_size`, `sample_probabilities` |
| Sampled and nominal FT input clipping to `[1e-15,1-1e-15]` | `resources/HCL_MH/engines/bdd_vec_shannon.py::_NameResolver` | `PreparedHclUncertainty::quantify` |
| `low + p * (high - low)` vector recurrence | `bdd_vec_shannon.py::_fused_shannon` and vector evaluators | `BatchedHclQuantifier::recurse` |
| BN queries conditioned on earlier branch decisions | Source vector evaluators' `bn_path_oracle.p_vec` calls | TensorBayes `conditional_event_probabilities` |
| Sample slicing, new evaluation cache per slice | `bdd_vec_shannon.py::solve_top_event_vector`, `evaluate_bdd` | `PreparedHclUncertainty::quantify` |
| Batched CPT/evidence evaluation and 256-sample default | `oracle/bn_path_oracle.py::_compute_uq_pybncore_vectorized_context`; HCL config `bn_uq_pybncore_chunk_size` | `SampleChunk`, TensorBayes batch axis |

LHS forms `S` equal intervals of cumulative probability, draws once in each,
shuffles those draws, and applies the chosen inverse CDF. This follows the
source branch where SciPy is available. The native kernels are always built;
there is no silent fallback from LHS to MC.

The ordered uncertainty list corresponds to the source runner's ordered
`base_probs` dictionary. A complete vector is drawn before the next event.
Changing BDD variable order or BN CPT settings does not change that ordering.
FT and CPT samples retain their shared indices through each BDD slice.

## Transport and UI

`sampler` selects MC or LHS for both FT probabilities and BN CPT priors, as in
HCL_MH's runner. Each input uses its own source routine and separate RNG seeded
with the same configured seed. Task 19's FT sampling algorithms are unchanged.
Omitted values preserve legacy MC; newly enabled UI configurations default to
LHS. The former `basicEventSampler` spelling is normalized when reading saved
settings and accepted as an addon alias (`basic_event_sampler` in the Rust API).
Only the canonical field is written by the editor and backend.

The frontend edits and validates all eight parameter forms. The backend forwards
the sampler and definitions; the addon uses the core distribution type instead
of a duplicate enum. Core serde aliases map camelCase transport fields to the
existing Rust names. The API accepts 10–10,000 samples. Parameter validation
follows the sampler-specific source domains documented above.

Main's point-probability algorithm, BDD ordering and the sequence-based execution
policy are unchanged. UQ input clipping does not alter point probabilities.

## Inherited uncertainty clipping (issue 20)

HCL_MH's `_NameResolver` clips unlinked FT input vectors to
`[1e-15, 1-1e-15]`. This includes nominal probabilities broadcast across samples
when no distribution is assigned. Sampled FT probabilities first pass through
the source runner's `[0,1]` clipping. MC and LHS use the same propagation bounds.

For a single unlinked event with nominal probability `0`, the point result is
`0`, while every uncertainty sample is `1e-15`. A nominal `1` becomes
`1-1e-15` in the uncertainty vector. The reported mean is computed from that
vector with source statistics; floating-point summation can affect its last bits.
An uncertainty summary therefore need not equal the nominal point result,
even without a sampled distribution.

These are input bounds, not bounds on the final top-event probability. An AND
of two events at the lower bound can yield a probability below `1e-15`.
Constant BDD terminals also retain their Boolean values.

BN-linked events obtain probabilities from conditional BN queries, bypassing
the FT resolver. Static CPTs and Dirichlet rows do not acquire the FT floor.
The separate `cptProbabilityClipEpsilon` setting applies to sampled Beta rows
and fragility probabilities, following `BNPathOracle`; it does not control
the fixed FT bounds and is not a global floor on BN query results.

The API retains both the unchanged point probability and the source uncertainty
summary. Preserve these rules for source fidelity; removing clipping, changing
its bounds or adjusting results afterward would change the source method.

## Task 20: explicit CPT row priors

The source is `resources/HCL_MH/oracle/bn_path_oracle.py`:

| Operation | Original source | Rust port |
| --- | --- | --- |
| Explicit Beta(alpha,beta) and Dirichlet(alpha-vector) row definitions | `_compile_uq` | `HclCptPrior`, `validate_prior` |
| Seeded NumPy generator, complete sample population per configured row | `__init__`, `_precompute_samples_mc` | `sample_network`, `NumpyRng` |
| MC Beta and Dirichlet | `_precompute_samples_mc` | `sample_row`, `NumpyRng::dirichlet` |
| BN “LHS”: sort/shuffle Beta draws; sort/shuffle each Gamma column then normalize rows | `_precompute_samples_lhs` | `sample_row` |
| Beta true/complement state placement and optional clipping | `_row_binary_for_true`, `_clip01_vec` | `sample_row` |
| Fixed CPT rows plus sampled rows on the batch axis | `_pybncore_build_cpt_batch` | `sample_network`, existing TensorBayes batching |
| Reuse sample indices for each conditioned BDD query | `_compute_uq_pybncore_vectorized_context`, `p_vec` | existing `PreparedHclUncertainty`/`BatchedHclQuantifier` |

BN “LHS” is preserved literally. Its row-prior routine sorts and shuffles random
draws; it does not enforce the FT sampler's one-draw-per-probability-stratum rule.
No inverse-CDF or alternative Dirichlet-LHS method is substituted.

The ordered flat row list is grouped by first occurrence of each node, retaining
row order within that node. This represents the source's ordered `nodes` mapping
and each node's ordered `rows` list. BN node storage/compilation order does not
change RNG draw order. Unspecified rows retain their nominal probabilities.

`trueStateId` (`true_state` in Rust) maps a stable app state identifier to the
source's literal `True` outcome; the other binary state receives `1-p`. This is
an input-label mapping, not a different Beta probability calculation.
Beta rows of one node must use the same probability state, corresponding to one
source `True` label; the editor keeps that selection consistent across rows.
Dirichlet alpha parameters follow the BN's displayed state order. Beta requires positive
finite alpha/beta; Dirichlet allows structural zeros with a positive finite total.
Node cardinality, state identity and row identity are validated.

`cptProbabilityClipEpsilon` (`cpt_probability_clip_epsilon` in Rust) defaults to
zero, as in the source. A value in `[0,0.5)` clips Beta and fragility probabilities to
`[epsilon,1-epsilon]`. It does not clip Dirichlet rows, PGA bins or point probabilities.

The old nominal-probability-times-ESS solver and ChaCha/Gamma CPT sampler were
removed. ESS-only records require explicit reconfiguration; the editor offers
that action and strips the old row fields when replaced. The backend/addon reject
them rather than inferring a new prior or silently falling back. This is a schema
change for existing CPT-uncertainty configurations, not an automatic migration.

NumPy's MC Dirichlet sampler uses stick breaking when `max(alpha)<0.1`, otherwise
normalized Gamma draws. `numpy_rng.rs` ports both branches from NumPy 2.4.4
`random/_generator.pyx`. Deterministic rows still consume the source RNG stream.
BN LHS normalization follows NumPy's pairwise row summation
(`_core/src/umath/loops_utils.h.src`). If source Gamma draws cannot normalize to
finite probabilities (e.g. extremely small LHS parameters), execution returns
an error; no resampling or method change is introduced.

### Nonfinite sampling failures (issue 22)

In `_precompute_samples_lhs`, sufficiently small Dirichlet alpha values can
produce an all-zero Gamma row. The source divides that row by its zero sum,
producing NaN. This is a sampling failure, not an invalid-prior threshold:
the same prior can yield finite samples with another seed or sample count.
`cptProbabilityClipEpsilon` does not repair Dirichlet normalization.

The port retains those draws and rejects nonfinite CPT samples with
`PRAXIS_HCL`: `CPT sampling produced a nonfinite probability; the source sampler
cannot normalize these prior draws`. The API records a failed run with no
numeric result. Batch scenario failures retain that message; a completed batch
parent does not imply that its scenarios succeeded.

Zero-spread normal/logit-normal and error-factor-one lognormal LHS inputs are
different: their source inverse CDF is undefined for every sample. The shared
frontend/backend schema rejects these uncertainty requests before execution;
native validation and execution also reject them. MC accepts these parameters,
and constant uniform inputs remain valid for both samplers.

There is no automatic retry, clamping repair, sampler substitution or point
fallback. An explicitly requested point calculation still uses main's original
algorithm and ignores saved uncertainty drafts without modifying them.
Issue 22 verification records original nonfinite values with their binary64
bits, finite source/API comparisons, and persisted failures separately. It
does not invent numeric reference values for undefined source output.

`tests/fixtures/hcl_mh_cpt/generate.py` executes AST-extracted, unchanged source
methods for prior compilation, MC/LHS generation, Beta clipping and CPT batches.
It records hashes and NumPy 2.4.4. The actual source vector BDD is also exercised
using an exact small-network probability oracle. Tests compare individual CPT
entries, fixed rows, mixed row/node order, structural zeros, tiny priors, wide
CPTs, evidence and sample pairing at chunk sizes 1, 31, 256, 512 and 513.
The addon test compares the rebuilt native boundary with the same fixtures.

## Seismic CPT generators

`seismic.rs` ports `oracle/bn_path_oracle.py` without replacing its methods:

| Source | Rust behavior |
| --- | --- |
| `_compile_uq`, lines 2146–2274 | Binary fragility node, existing PGA parent, positive theta/beta_r, nonnegative beta_u, center per PGA state |
| `_pybncore_build_cpt_batch`, lines 2662–2695 | capacity = theta * exp(beta_u*z); failure = Phi(log(PGA/capacity)/beta_r); true/false CPT columns |
| `_compile_uq`, lines 2276–2380 | Root PGA node, explicit none state, positive mission time, ordered bins covering all other states |
| `_pybncore_build_cpt_batch`, lines 2697–2730 | sigma = log(EF95)/1.645; sampled frequency = median * exp(sigma*z); Poisson or linear probabilities; none = max(0,1-sum) |
| `_lhs_standard_normal`, line 125 | Stratified uniforms, clip to [1e-12,1-1e-12], Python NormalDist inverse CDF, permutation |

One fragility capacity vector is reused across every CPT row of that component,
including rows with other parents. Different generator nodes draw separately.
PGA-bin MC draws are sample-major; LHS draws each bin column in configured order.
Bin totals above `1+1e-9` raise an error, without resampling, renormalization or
capped-linear substitution. Fragility applies the optional CPT clipping epsilon;
PGA bins do not.

App `cptGenerators` entries contain a BN node reference plus `generator`.
The Rust analysis settings use `cpt_generators`, with `node` plus `generator`.
Generator fields use camelCase in both APIs. IDs map directly to source labels;
`theta`, `betaR`, `betaU` are the explicit canonical forms of source aliases.
A node accepts row priors or one generator, never both. The input adapter builds
the source ordered node map from row-prior nodes first, then the generator list.
This is the documented input order; topology never reorders the sampling stream.

`statistics_normal.rs` ports CPython 3.12.10's actual AS241 expressions used by
`statistics.NormalDist.inv_cdf`. It does not substitute SciPy's normal inverse
CDF used for FT LHS. Fragility's `math.erf` uses the platform C math function,
as CPython does, through the existing C++ ABI. The PSF license is included.

`tests/fixtures/hcl_mh_source.py` shares the unchanged-source AST harness between
CPT-prior and seismic fixtures. `hcl_mh_seismic/generate.py` records 14 MC/LHS
cases, 75,924 CPT entries, 3,078 actual source BDD outputs and invalid-total errors.
Tests cover extra parents in different orders, reversed states, zero centers,
zero frequency, beta_u=0, clipping, mixed row priors/generators, conditional
evidence, chunk boundaries and both native FT and ET paths.

The local saved-data conversion is separate from quantification. Five ESS-only
rows in four workbooks were converted to explicit Dirichlet alpha = saved
probability * saved ESS, in BN state order. This preserves their former prior
parameters; source NumPy sampling still replaces the former sampler. Backups,
revision checks and before/after verification are in
`outputs/hcl-seismic-generators`. Historical analysis snapshots were preserved.

## Quantifier summaries (task 21)

The HCL FT, sequence and end-state summaries follow
`utils/ft_gui_builder_pkg/hcl/runner.py::_vector_stats` (line 3078):
`np.mean`, `np.std` with the default `ddof=0`, `np.median` and the default
linear `np.percentile` at 5 and 95. `et/et_integration.py::quantify_end_state`
also uses `np.std` with `ddof=0` for sequence and end-state vectors.
Minimum and maximum follow the bounds in
`utils/ft_gui_builder_pkg/quant.py::_compute_uq_for_top` (lines 663–684).
Main's original HCL bridge supplies no UQ summaries.

`hcl/numpy_statistics.rs` ports the NumPy operations invoked by these functions:
the contiguous float64 pairwise sum in `_core/src/umath/loops_utils.h.src`,
mean/population variance in `_core/_methods.py`, and median/linear interpolation
in `lib/_function_base_impl.py`. Mean and variance use the original sample order;
sorting is limited to quantiles and bounds. Median averages the central one or
two values; percentile interpolation preserves NumPy's two arithmetic branches.
The existing CPT normalization now imports the same pairwise-sum helper without
changing its calculations. The NumPy license remains in `LICENSES.txt`.

The former `N-1` standard deviation, weighted-sum percentile helper and HCL
coefficient-of-variation field were removed. No CV counterpart was identified
in either allowed HCL source. The ordinary PRAXIS UQ API is separate and unchanged.
The later hazard-cell routine in `analysis/metrics.py` uses a different SD
convention; it is not the quantifier summary source selected here. Sampled
hazard convolution was removed in task 23; point convolution is unchanged.

The approved application exceptions remain: a BDD per sequence, annual-frequency
scaling and summation of aligned sequence samples by end state. This change
does not adopt HCL_MH's combined end-state BDD. Task 38 completed end-state display.

`tests/fixtures/hcl_mh_summaries/generate.py` executes the unchanged source
summary functions via AST extraction. It records source/dependency hashes,
25 known populations (including 10000 samples), and native-boundary expectations
from existing CPT/seismic source fixtures. Binary float encodings make the core
comparisons exact rather than dependent on JSON decimal parsing. Native tests
also check conditional summaries, annual summaries, shared end-state sample
pairing, evidence, MC/LHS and omission of the removed CV field.

## Original numerical dependencies

The reproducibility baseline is **NumPy 2.4.4 / SciPy 1.17.1**. HCL_MH does not pin
these versions in its requirements.

- `numpy_rng.rs` ports NumPy's SeedSequence, PCG64 XSL RR, scalar samplers,
  buffered uint32 draws and permutation routine. It preserves the source's random
  stream across multiple LHS vectors. NumPy/PCG licenses are in `LICENSES.txt`.
- `vendor/scipy-quantiles` retains the unchanged Boost and XSF kernels that SciPy
  calls for beta, normal and gamma inverse CDFs. A small C ABI connects them to
  Rust; their algorithms are not replaced. This introduces a **C++17 build
  requirement**, but no Python runtime requirement. See its README, original
  licenses, exact revision records and per-header hashes.
- Uniform, exponential and triangular inverse transforms are Rust ports of the
  source expressions. LHS lognormal scaling follows SciPy's PPF expression,
  which has a different floating-point operation order from MC lognormal draws.

[NumPy generator source](https://github.com/numpy/numpy/tree/v2.4.4/numpy/random),
[SciPy PPF source](https://github.com/scipy/scipy/blob/v1.17.1/scipy/stats/_continuous_distns.py),
[dependency provenance](../../../vendor/scipy-quantiles/README.md).

## Verification and remaining tasks

`tests/fixtures/hcl_mh_uq/generate.py` runs the unchanged HCL_MH sampler, actual
GUI vector-builder function and actual NumPy BDD evaluator. The fixture records
source hashes and dependency versions. Source tests compare individual samples
for every family/method, multiple vectors sharing one LHS stream, vectorized BDD
outputs, clipping, complements, evidence and sample pairing across chunks.
Comparisons allow only platform math-library rounding.

Parameter/failure-rate uncertainty and GPU evaluation are not part of this
change. Seismic fragility, PGA-bin generators and quantifier summaries are aligned above.
Task 23 removed sampled hazard convolution and its separate evidence-mass engine.
Ordinary FT/CPT sample pairing and chunked vector evaluation remain regression checked.
