# scram-boolean — Deferred & Missing Features

Running log toward making SCRAM a complete solver. Two parts: **(A) Deferred in
the `scram-boolean` wiring** — capabilities SCRAM already has but the new
Boolean-contract path does not yet bridge (the area sections below, each item
tagged with the increment that deferred it); and **(B) Missing in SCRAM the
engine** — capabilities SCRAM lacks entirely (final section).

# Part A — Deferred in the scram-boolean wiring

## Input / model building

- **Uncertainty distributions** — `BasicEventBinding.distribution`
  (`ParameterDistribution`: lognormal, normal, beta, gamma, etc.) is ignored;
  only `pointProbability` is mapped to a `ConstantExpression`. Basic events with
  only a distribution currently get probability `0.0`. Needed for the
  uncertainty path. [inc 2]
- **Rate value models** — `RATE_PER_HOUR` / `RATE_PER_DEMAND` are treated as a
  plain probability; no rate→probability conversion (exponential/GLM with
  mission time). [inc 2]

## Settings

- **Monte-Carlo convergence params unmapped** — `confidence`, `delta`, `burnIn`,
  `earlyStop`, `ciPolicy`, `batchSize`, `sampleSize`, `overheadRatio`,
  `oracleP`, `watchMode` have no setters in `scram::core::Settings`, so they are
  dropped. They belong to the Monte-Carlo/convergence engine path that this
  `Settings` class does not expose. [inc 3]
- **`pdag` / `monte-carlo` selection** — mapped via the string setters
  (`algorithm("pdag")`, `approximation("monte-carlo")`) mirroring the old
  addon, but `core::Algorithm` is only `{bdd, zbdd, mocus}` and
  `core::Approximation` is only `{none, rare-event, mcub}`. The Monte-Carlo /
  PDAG route needs verification (and may require a different driver). [inc 3]

## Output / serialization

Populated per root: `topEventProbability` (`p_total`), `cutSets`
(products + literals + per-product probability + order distribution),
`importance` (FV/RAW/RRW/Birnbaum/criticality), `uncertainty`
(mean/sigma/errorFactor/quantiles). Sequence `frequency` = prob × IE-frequency
(IE value from its binding); end-state `frequency` = Σ contributing sequence
frequencies, `probability` = `p_total` of the aggregation node.

Not yet produced:

- **SIL** (`SafetyIntegrityLevelResult`) — SCRAM derives SIL from time-stepped
  probability (`p_time` + `time_step`); the time-series → average-PFD → band
  extraction is not implemented. [inc 4]
- **Sensitivity** (`SensitivityResultEntry`) — SCRAM has no native sensitivity
  studies (a multi-run/parameter-perturbation feature); not produced. [inc 4]
- **Top-level aggregates** — `QuantificationResult.importance` /
  `.uncertainty` / `.convergence` / `.sensitivity` / `.safetyIntegrityLevels`
  are left empty; per-root importance/uncertainty live in the FaultTree /
  Sequence / EndState blocks instead. [inc 4]
- **UncertaintyResult.percentiles and .histogramBins** — only mean/sigma/
  errorFactor/quantiles are filled. [inc 4]
- **Result metadata** — `id`, `requestRef`, `timestamp`, `solverVersion`,
  `modelVersionRef`, `configurationControlRecordId`, `modelFeatures`,
  `runtimeSummary` are unset (the request ids + `analysis_time` can be wired in
  later). [inc 4]
- **SymbolTable** — NOT produced by the solver. The solver is numeric-only;
  names live in MEF, so the id→name `SymbolTable` is an upstream / render-time
  artifact, not solver output. [inc 4]
- **Mixed-IE end states** — end-state `probability` is the OR-aggregation
  `p_total` (a conditional probability); when contributing sequences have
  different initiating-event frequencies, that probability is not a simple
  product with one IE frequency. `frequency` (Σ of sequence frequencies) is the
  meaningful release-category metric in that case. [inc 4]

## Behaviour notes & remaining unverified assumptions

- **Single-gate fault tree per root** — VERIFIED (Linux/GCC, Ubuntu 24.04
  container): each root is the sole gate of its own `mef::FaultTree` +
  `CollectTopEvents()`, the cone reached via formula pointers; `RiskAnalysis`
  quantifies it correctly (OR smoke test = exact 0.28). [inc 2; verified]
- **Roots must be gates** — a root that is not a GATE node is skipped (only
  gates become `top_events`). [inc 2]
- **CCF factor levels** — STILL UNVERIFIED at runtime: MGL
  `beta`/`gamma`/`delta` mapped to levels 2/3/4…; alpha/phi factors iterated in
  map (sorted-key) order. The CCF path compiles but no test exercises
  expansion through `RiskAnalysis` yet. [inc 2]

## Testing

- Build + test verified on Linux/GCC (Ubuntu 24.04, Ninja, Release): full
  configure, core + `scram-boolean` + `scram-boolean-test` compile clean, and
  `ctest` passes 1/1 (6 assertions). The dev machine itself cannot build the
  core (MSVC flag issue), so local verification stays container-based.
- Coverage is one smoke test (`tests/scram_boolean_test.cpp`: OR of two basic
  events → exact BDD probability). Comprehensive fixtures are deferred:
  AND/ATLEAST/NOT gates, MOCUS/ZBDD/approximation paths, CCF expansion,
  sequences + IE frequency, end-state aggregation, house events, and
  importance/uncertainty outputs. [inc 5]

# Part B — Missing in SCRAM the engine (toward a complete solver)

Capabilities SCRAM does **not** have at all (distinct from Part A, which SCRAM
supports but `scram-boolean` doesn't yet bridge). Verified against `src/`.

Already present in SCRAM (NOT gaps — for reference): fault trees, event trees
(collect-formula), CCF (beta/MGL/alpha/phi), substitutions, alignments/plant
operating states, parameters/expressions, time-dependent & repairable failure
models (`Exponential`/`Glm`/`Weibull`/`PeriodicTest`), uncertainty distributions
(`Uniform`/`Normal`/`Lognormal`/`Gamma`/`Beta`/`Histogram`), BDD/ZBDD/MOCUS,
probability (exact + rare-event/MCUB), importance (Birnbaum/CIF/DIF/RAW/RRW),
SIL, prime implicants.

Gaps:

- **Global / variance-based sensitivity** — no Sobol indices or uncertainty
  importance; no sensitivity-analysis module exists.
- **Local sensitivity** — no parametric what-if / tornado studies.
- **Multi-state components** — strictly binary success/failure; no multi-valued
  components or multi-valued quantification.
- **Dynamic PRA** — no temporal/dynamic gates (priority-AND, spare,
  sequence-enforcing), no Markov models for state-dependent repairable
  components, no dynamic event trees, no discrete-event/simulation-based
  quantification.
- **Correlated / advanced-sampling uncertainty** — uncertainty propagation
  assumes independent distributions; no correlation (copulas / shared
  parameters) and no Latin-Hypercube or quasi-random sampling.
- **Bayesian data integration** — no prior/posterior updating or
  population-variability curves feeding the uncertainty analysis.
- **Multi-unit & external hazards** — no site-level (multi-unit, shared-system,
  inter-unit dependency) analysis and no external-hazard integration (seismic,
  fire, flooding).
- **Risk integration to end states** — sequence/event-tree frequencies are
  produced, but there is no first-class release-category binning or total
  plant/site risk-metric aggregation with contributor attribution.
- **Diagnostics / explainability** — no dominant-contributor ranking,
  single-point-of-failure or defence-in-depth diagnostics, or traceable
  input→result derivations; output is numbers, not explanations.

Partial (not a clean gap): phased-mission / time-varying configurations —
SCRAM has alignments/phases (plant operating states) but not full temporal
phased-mission quantification.
