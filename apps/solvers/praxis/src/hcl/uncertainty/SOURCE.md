# HCL uncertainty on the uncertainty contract

HCL uncertainty uses the PRAXIS uncertainty contract (`core/distribution.rs`) and
the one PRAXIS sampler (`core/distribution_sampling.rs`). The vectorized BDD method
and the TensorBayes batch axis come from **HCL_MH**. Main supplies the point bridge
and TensorBayes inference.

Saved workbook uncertainty settings are drafts. Only an uncertainty request reads
them. Probability snapshots omit uncertainty.

## Settings

`HclUncertaintySettings` holds `sampleCount` (10 to 10,000), `seed`, `sampler`
(`MC` or `LHS`), `basicEvents`, `cptRows`, `cptGenerators`,
`uncertaintyParameters` and `uncertaintyVectors`.

- `basicEvents` are typed overrides `{ event, expression }`. Each expression is a
  probability. Its draws use the key `event:<id>`.
- Basic events without an override take the expression of their fault-tree
  catalogue entry. Events with neither stay at their point value.
- BN-bound events take their probability from BN conditioning. An override on a
  BN-bound event is an error.
- `cptRows` hold `{ node, rowIndex, row }`. The row is a vector law in the state
  order of the node, Dirichlet or fixed. One vector is drawn per trial under the
  key `cpt:<node>/<row>` or under its vector parameter name.
- `SEISMIC_FRAGILITY` gives P(true | PGA state s) = fragility(median, randomness,
  demand of s). One median draw per trial is shared by every row of the node.
  The median is a quantity and the randomness a factor.
- `SEISMIC_PGA_BINS` gives each bin 1 - exp(-f t) (`POISSON`) or f t (`LINEAR`).
  The none state gets 1 minus the sum. A sum above 1 is an error.

No probability is clipped or floored. A value outside 0 to 1 is an error that
names its source and trial.

## Sampling and evaluation

One `UncertaintyProgram` holds the parameter table, the vector table and the
fault-tree parameters. A parameter defined twice with different expressions is an
error. Every draw comes from per-key streams, so a shared parameter or vector
gives one draw per trial to every user, also across fault trees and the event-tree
initiating frequency.

Sampled CPT rows and generator rows sit on the TensorBayes batch axis. Samples are
evaluated in slices of 256 with one compiled junction tree per slice. The vector
recurrence is `low + p * (high - low)`. A BN marginal probability is the mass of
the true states divided by the mass of the row. FT samples, CPT samples, sequences
and evidence scenarios keep one sample index.

For event trees, each conditional probability sample is multiplied by the sampled
initiating frequency of the same trial. End-state totals add the annual samples at
matching indices before summarization.

## Evidence conflicts and zero-probability branches

The quantifier intersects the allowed states of a branch with the existing
evidence. An empty intersection contributes zero. A branch with zero probability
from the CPT, without a contradictory observation, can still query TensorBayes.
TensorBayes then reports `evidence has zero probability in batch row 0`. The API
stores the failed scenario and keeps successful batch rows. It does not replace
the failed result with the point result.

## Quantifier summaries

FT, sequence and end-state summaries follow
`utils/ft_gui_builder_pkg/hcl/runner.py::_vector_stats`: mean, population standard
deviation, median and linear percentiles at 5 and 95. Minimum and maximum follow
`utils/ft_gui_builder_pkg/quant.py::_compute_uq_for_top`. `hcl/numpy_statistics.rs`
ports the NumPy operations these functions use. The NumPy license is in
`LICENSES.txt`.

## Verification

The HCL_MH fixtures (`hcl_mh_uq`, `hcl_mh_distribution_domain`, `hcl_mh_cpt`,
`hcl_mh_seismic`, `hcl_mh_summaries`) stay frozen. Uncertainty tests compare the
PRAXIS populations with them statistically. Means use z scores. Quantiles use
binomial errors at the reference quantiles. Both populations are also fitted to the
exact contract law at five quantiles. Every check uses |z| <= 5.

The test harness converts the source inputs to the contract exactly. A source
lognormal (median, EF) has sigma = ln(EF) / 1.645 and becomes LOGNORMAL with
mean = median exp(sigma^2 / 2), EF = exp(1.6448536269514722 sigma) and level 0.95.
Gamma scale becomes rate 1 / scale. Exponential rate becomes GAMMA with shape 1.
Source clipping to 0 to 1 becomes a MIXTURE of point masses and a TRUNCATED law.
Beta row priors become Dirichlet rows. Inputs the contract cannot represent must
fail validation.

Summary arithmetic on fixed samples and every point value stay bit-exact.
