# Point hazard convolution: source map

Task 22 follows the local HCL_MH point-hazard implementation. The original
main HCL quantifier and TensorBayes engine remain byte-identical to commit
`96b949e96ccbb2fa6eef7a27170dfc9cb9f54182`.

## Methods

| Operation | Original source under `resources/HCL_MH` | Current code |
| --- | --- | --- |
| Joint scenario weight conditional on base evidence | `utils/ft_gui_builder_pkg/hcl/hazard_sweep.py::_joint_probability_for_assignment` | `hazard.rs::conditional_evidence_probabilities_for_network` |
| BN query order | `engines/bn_pgmpy.py::topological_order`, using `networkx.topological_sort` | `hazard.rs::topological_order` |
| Raw, normalized and scaled weights; zero-mass handling | `utils/ft_gui_builder_pkg/hcl/hazard_convolution.py::build_hazard_convolution_weights` | `../quantitative.rs::prepare_hazard_weights` |
| FT, sequence and end-state weighted sums | `utils/ft_gui_builder_pkg/hcl/hazard_convolution.py::aggregate_hazard_convolution_results` | `praxis-node/src/hybrid_causal_logic.rs`, `praxis-node/src/event_tree.rs` |

Each scenario starts with the complete base evidence. In BN topological order,
query the probability of each scenario observation, conditional on the base and
earlier observations. Multiply these terms and add each observation to the
context. A state already fixed by the base contributes one if it matches, zero
if it conflicts. Stop when the product is zero. All scenario observations enter
the weight, including conditions outside the selected hazard dimensions.

The native boundary checks that hazard-grid assignments match the target's
scenario observations. Target evaluation uses the merged evidence. Point rows
with zero weight are skipped before BDD execution. An all-zero grid builds no
BDD and returns zero totals; normalization also returns zero, as in the source.

For selected weights `w`, optional normalization uses `w / sum(w)`. Convolved
probability is the sequential sum of weight times conditional probability.
Annual contributions use the separately scaled weights. Both totals are
returned. The existing typed time-unit conversion and separate BDD per ET
sequence are retained under the user's earlier exceptions. End states retain
the approved sum over their sequence results; no combined BDD is introduced.

## Numerical dependency

HCL_MH's Python `sum` determines weight-normalization arithmetic. The pinned
fixture runtime is CPython 3.12.10; `quantitative.rs::python_float_sum` ports its
compensated float path, including final correction. Contribution accumulation
uses the source's explicit sequential `+=` operations.

The dependency source is [CPython 3.12.10 `builtin_sum`](https://github.com/python/cpython/blob/v3.12.10/Python/bltinmodule.c#L2464).
The PSF license is already retained in `uncertainty/LICENSES.txt` and the addon
`THIRD_PARTY_NOTICES.txt`. This is the source interpreter's arithmetic, not a
replacement hazard algorithm.

## Application mapping

- Native skipped batch rows contain `scenarioId` and `status: "skipped_zero_weight"`.
- FT hazard rows have null `conditionalProbability` and zero contributions.
- Skipped ET rows have no sequence results. If every row is skipped, sequence
  and end-state aggregate arrays are empty, following the source aggregate.
- The backend stores a terminal `SKIPPED` run with null result and failure.
  The frontend identifies the skipped row instead of displaying a probability.
- `convolvedProbability` accompanies `integratedAnnualFrequency`; row-level
  `probabilityContribution` accompanies `annualContribution`.
- Partial grids, including a single selected cell, are executable even when
  their scenario evidence does not vary a target. Ordinary scenario batches
  also allow unchanged results. Both retain model and declared-target validation.

## Verification and boundary

`tests/fixtures/hcl_mh_hazard/generate.py` executes unchanged source functions
using AST extraction, the actual HCL_MH BDD evaluator, and a small enumerated
BN query oracle. The oracle supplies conditional queries only; the original
source computes the joint weights and convolution. Fixtures record source
hashes and runtime versions. Fourteen cases cover dependence, base evidence,
additional scenario conditions, multi-node grids, partial normalization,
zero-weight cells, all-zero grids, and annual scaling. A 1000-row fixture checks
the interpreter's weight-summation order. Rust and native FT/ET tests consume
these source outputs. Conditional inference comparisons allow platform-level
rounding. Backend tests cover stored skipped runs; UI tests cover their display.

**Task 23 enforces the source boundary.** HCL_MH's
`ensure_hazard_convolution_supported` rejects enabled UQ with more than one
sample. Its original guard and `test_uq_rejection_for_samples_greater_than_one`
are the references for the Rust and shared application checks. Existing
application UQ settings require at least ten samples, so hazard convolution
requires uncertainty to be off. This does not introduce a one-sample UQ mode.

Both core hazard entry points reject the combination before compilation or
sampling. Addon validation/execution and backend batch execution also reject
active uncertainty. At the application boundary, task 31 added explicit
`calculationType` selection: `PROBABILITY` omits uncertainty from the execution
snapshot while preserving saved workbook settings. Saved settings alone therefore
do not block point hazard runs. Selecting `UNCERTAINTY` disables hazard convolution
in the UI and is rejected by backend/addon before execution. Direct Rust callers
must omit active uncertainty settings for core hazard entry points. Ordinary
FT/ET scenario uncertainty remains available.

The sampled weight ratio, sampled integration routines, their result fields,
and the now-unused TensorBayes evidence-mass engine were removed. The original
main inference files are unchanged. Removing the sampled method eliminates its
former clearing of fixed hazard evidence and omission of extra scenario conditions.
The removed implementation is archived in `outputs/hcl-task23/before.zip`.

HCL_MH separately offers `apply_single_base_evidence_convolution`, which scales
one case's outputs by a fixed nominal evidence weight, including its UQ
summaries. That method is distinct from the removed sampled-grid integration
and was not added here. FT/CPT sampling, vectorized BDD evaluation, seismic
fragility and PGA-bin generators retain their reviewed implementations.
Task 38 completed end-state display. Cut sets remain absent from the application.
See [execution scope](README.md#execution-scope-and-sources) for current API boundaries.
