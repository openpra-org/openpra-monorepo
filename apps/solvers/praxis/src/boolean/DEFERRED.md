# praxis::boolean — Deferred & Missing Features

Running log toward making PRAXIS a complete solver. Two parts: **(A) Deferred
in the `praxis::boolean` wiring** — capabilities PRAXIS has but this
Boolean-contract path does not yet bridge, or contract fields accepted without
effect; and **(B) Missing in PRAXIS the engine** — capabilities the engine
lacks entirely (tracked in detail by `plans/PRAXIS_ROADMAP.tex`).

# Part A — Deferred in the praxis::boolean wiring

## Input / model building

- **Distributions** — only `NORMAL`, `LOGNORMAL` (median + error factor →
  μ = ln(median), σ = ln(EF)/1.645, the 95% convention), and `UNIFORM` map to
  the engine's `Distribution`; `POINT_ESTIMATE` maps to the nominal
  probability. `BETA`, `GAMMA`, `EXPONENTIAL`, `WEIBULL`, `LOGNORMAL_TIME`,
  `BINOMIAL`, `POISSON` are unsupported by the engine's 3-family enum — a
  binding with only such a distribution gets nominal probability `0.0`.
- **Rate value models** — `RATE_PER_HOUR` / `RATE_PER_DEMAND` are treated as a
  plain probability; no rate→probability conversion (needs mission time, R1).
- **CCF is structurally inert** — contract groups are mapped to the engine's
  four models and expanded (`expand_ccf_groups`), but the engine only *adds*
  the generated events to the basic-event set; it does **not** rewire gate
  logic to replace members with OR(independent, common) events. Quantified
  numbers therefore do not change. This is parity with the engine's
  `--analysis ccf` behaviour, not full CCF (see Part B / R9).
- **Per-root rebuild** — every root (fault tree, sequence, end-state
  aggregation) rebuilds its reachable cone as an independent `FaultTree`;
  shared subtrees are re-quantified per root with no cross-root caching.

## Settings

- **Unmapped (engine has the capability, not wired):** `earlyStop`,
  `confidence`, `delta`, `burnIn` — the DPMC engine supports Wald
  convergence (`run_cpu_with_watch_and_convergence`); this path always calls
  `run_cpu`. `watchMode` (live progress) likewise not wired.
- **Unmapped (no engine equivalent):** `ciPolicy` (engine is Wald-only),
  `batchSize`, `sampleSize`, `overheadRatio`, `oracleP`, `noKn`, `noXor`,
  `keepNullGates`, `compilationLevel`, `pdag`, `adaptive` (the adaptive route
  lived in the deleted JSON path), `primeImplicants` (library-only, R12),
  `missionTime`, `timeStep` (inert in the engine, R1/R3), `numQuantiles`,
  `numBins` (engine reports fixed quantiles).
- **Monte Carlo** — CPU backend only; no CUDA/WGPU dispatch, no variance
  reduction, no early stopping. `std_dev` / confidence interval / `successes`
  from `MonteCarloResult` are not serialized (no per-root contract home), and
  the top-level `ConvergenceResult` is not populated.
- **MOCUS is coherent-only** (engine constraint): NOT/XOR/NAND/NOR/IFF gates
  error; sequence expressions with success branches need BDD or ZBDD.

## Output / serialization

Populated per root: `topEventProbability` (exact for BDD/ZBDD,
rare-event/MCUB for MOCUS/ZBDD with approximation, Monte Carlo estimate),
`cutSets` (MOCUS or ZBDD enumeration; literals parsed back to numeric ids;
per-set probability; order distribution), `importance`
(FV/RAW/RRW/Birnbaum/criticality), `uncertainty`
(mean/sigma/errorFactor/rank-based quantiles), `safetyIntegrityLevels`
(probability → PFD band). Sequence `frequency` = probability × IE frequency
(IE value from its binding); end-state `probability`/`uncertainty` from the
`aggregationNodeId` root only (by design), `frequency` = Σ contributing
sequence frequencies.

Not yet produced:

- **`initiatingEvents` grouping** — sequences are emitted flat in
  `sumOfProducts`; the per-IE grouping block is not assembled.
- **`UncertaintyResult.percentiles` / `.histogramBins`** — only
  mean/sigma/errorFactor/quantiles are filled; quantile fractions are
  rank-based ((i+1)/n), not configured quantile points.
- **`distributionByOrder` convention** — indexed by order with index 0 the
  unity set (an empty cut set), not offset by one.
- **Result metadata** — `id`, `requestRef`, `timestamp`, `solverVersion`,
  `modelVersionRef`, `configurationControlRecordId`, `modelFeatures`,
  `runtimeSummary` unset.
- **SymbolTable** — not produced; the solver is numeric-only and names are an
  upstream/render-time artifact.
- **Mixed-IE end states** — the aggregation-node probability is conditional;
  when contributing sequences have different IE frequencies the summed
  `frequency` is the meaningful release-category metric, not probability ×
  any single IE frequency.
- **Importance `occurrence`** — the engine's cut-set occurrence count has no
  contract field.

## Testing

- Covered (`tests/integration/boolean/quantify_boolean.rs` + builder unit
  tests): BDD exact, MOCUS + rare-event, ZBDD enumeration + exact, ATLEAST,
  NULL pass-through, NOT success-branch sequence + frequency, end-state
  aggregation, Monte Carlo, importance, uncertainty (Normal), SIL banding,
  CCF expansion, id prefixing/dedupe/house-state mapping.
- Not covered: XOR/NAND/NOR/IFF roots, limit-order/cut-off truncation paths,
  ZBDD with approximations, lognormal/uniform uncertainty, malformed-model
  error paths beyond missing-node/non-gate-root.

# Part B — Missing in PRAXIS the engine

Tracked in full by `plans/PRAXIS_ROADMAP.tex` (R1–R26); the items this module
makes visible:

- **R9 — proper CCF** — the four parametric models use simplified equal-split
  mathematics (MGL treats factors as per-level masses), and expansion does not
  rewire gate logic, so CCF does not affect quantification.
- **R2/R1/R3 — expressions, time-dependent failure models, time-resolved
  quantification** — bindings are constants; `missionTime`/`timeStep` have
  nothing to drive.
- **R4 — exact importance** — the importance recursion assumes independence
  (approximate for shared/repeated events and voting gates).
- **R10 — complete cut-set engine** — MOCUS is coherent-only and the cut-set
  route has no exact probability (approximations only).
- **R11 — distribution families and correlation** — engine supports 3
  independent families; no beta/gamma/etc., no correlation, no LHS.
- **R12 — prime implicants** — library-only, not reachable from this path.
- **R17 / R26 — multi-state, dynamic PRA** — absent (binary, static engine).
