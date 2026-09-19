# PRAXIS Node addon

This package contains the NAPI-RS boundary between Node.js and the PRAXIS Rust
solver. Its only public functions are synchronous JSON operations:

- `validate(requestJson)` validates the transport envelope and the selected FT, BN, ET or HCL model.
- `execute(requestJson)` dispatches to the method-specific PRAXIS adapter.
- `preflight(requestJson, operation)` reports planned Bayesian table memory without inference.

All functions require `request.methodType` to be `FAULT_TREE`,
`BAYESIAN_NETWORK`, `EVENT_TREE` or `HYBRID_CAUSAL_LOGIC`.
Missing, malformed and unsupported methods return `UNSUPPORTED_METHOD_TYPE`;
validation never reports success for an unimplemented method.

The Praetor Docker image builds the Linux GNU addon in its builder stage and
copies `package.json`, the generated loader and declarations, the shared
`protocol.js`/`protocol.d.ts` files, and the release `.node` binary into the
runtime image.

The addon uses PRAXIS for quantification. Resource preflight calls the same
TensorBayes compiler directly; it does not perform inference.

The [capability/source table](../praxis/src/hcl/README.md#execution-scope-and-sources)
distinguishes this application API from the probability-only HCL CLI and records
the selected algorithms, mathematical definitions and approved exceptions.

## Application execution limits

Praetor runs each native validation/execution in a separate Node process. A
single canonical `praxis.worker.js` is copied unchanged by the Nest build.
Timeout, HTTP disconnect and orderly Praetor shutdown terminate that process,
including synchronous native computation. Capacity is released after exit.

- `PRAETOR_NATIVE_TIMEOUT_MS`: positive integer milliseconds; default `300000`
  (5 minutes), maximum `2147000000`. Configure consistently in backend and Praetor.
- `PRAETOR_NATIVE_MAX_CONCURRENT`: positive integer; default `2`, per Praetor
  process, shared by native validation and execution. Excess requests fail
  immediately with `PRAXIS_BUSY`; there is no waiting queue.
- `PRAETOR_NATIVE_HEAP_MB`: optional positive integer megabytes for each native
  worker's V8 old-space heap. When omitted, Node's default or inherited
  `NODE_OPTIONS` applies. An explicit setting overrides that heap flag for the
  worker only. **This does not limit Rust allocations or total process memory.**
- `PRAETOR_NATIVE_MAX_CLIQUE_MB`: positive integer MiB per planned Bayesian
  table; default `4096`. Oversized tables fail preflight with `PRAXIS_RESOURCE_LIMIT`.
- The backend sends an absolute `x-praxis-deadline`. Praetor uses the smaller
  remaining deadline/server budget. The backend allows 10 seconds extra for
  termination and result transport.
- Execution failures use `PRAXIS_TIMEOUT`, `PRAXIS_CANCELLED`, `PRAXIS_BUSY` or
  `PRAXIS_WORKER_FAILURE`. Existing run storage retains these failure codes.
  Cancellation follows an aborted/disconnected HTTP request; no GUI Cancel
  control is added.

`require("praxis-node/protocol")` loads the shared envelope validator and limit
constants without loading the native binary. Backend and Praetor both require
version `1.0.0`, exactly one result/error, and complete structured error fields.
Method-specific result validation remains in the backend. Direct addon calls
are synchronous and do not receive Praetor's process limits automatically.

See [execution source map](../../docs-md/guides/praxis-execution-source-map.md)
for the source boundary and verification scope.

### Large HCL runs

Use `deploy/microservices/praetor/hcl-large.compose.yml` as a second Compose/stack
file after the existing Praetor deployment file. Its configurable starting
profile is a 30-minute deadline, one native job, a 4096 MiB worker heap, and
16 GiB total container memory with a 12 GiB scheduling reservation. The native
HTTP endpoint runs in **praetor-manager**; RabbitMQ engine replicas do not add
capacity to this endpoint.

Apply `deploy/web/hcl-large.compose.yml` after the web deployment file too;
it supplies the same deadline to the backend. For non-container deployments,
set `PRAETOR_NATIVE_TIMEOUT_MS=1800000` in both services and restart them.
The shorter backend/Praetor deadline always wins. Proxy and
client deadlines must exceed the execution budget plus the 10-second transport
grace. Adjust `PRAETOR_MEMORY_LIMIT` and `PRAETOR_MEMORY_RESERVATION` for the host;
increasing concurrency requires enough memory for every simultaneous native
job plus the manager and transport buffers. The reservation is for scheduling,
not an additional memory allowance or a per-worker RSS limit.

RHR previously exceeded an 8 GiB test RSS guard and completed with 12 GiB.
Increasing V8's heap alone cannot solve that native allocation pressure. Run
large source/API verification sequentially with explicit time and memory
budgets, and record resource failures separately from numerical mismatches.
These settings change execution capacity only; they cannot guarantee that a
model fits available RAM or fix the separate 768 GiB source-allocation issue.

## Standalone Bayesian-network batches

The existing BN run endpoint accepts either `query: {evidence, queryNodeIds}`
or `query: {scenarios, queryNodeIds}`. Each scenario contains `id`, `code`,
`name` and `evidence: {observations: [{nodeId, stateId}]}`. These alternatives
cannot be mixed; batches must contain at least one scenario with a unique ID.

The SY editor sends one batch request. Both SY and ESQ backend routes save
one immutable run, including every scenario, and return ordered per-scenario
statuses/results plus compilation counts. Single-query requests/results remain
compatible. Invalid evidence references and zero-probability evidence fail only
their rows; malformed requests or an invalid shared model/query fail the run.

PRAXIS's application adapter compiles one MinFill junction tree and calls
main's unchanged TensorBayes `EvidenceBatch::from_rows` and `evaluate_multi`.
If TensorBayes reports a zero-mass row, the adapter records that failure and
retries the remaining rows on the same engine after clearing its workspace
cache. This preserves the existing per-scenario failure behavior without
changing inference. The previous frontend request loop is removed.

Source: [TensorBayes engine](../tensorbayes/src/engine.rs) and
[main's batch regression](../tensorbayes/tests/inference.rs).

## Standalone fault trees

The adapter builds one BDD with PRAXIS's existing `build_bdd` API and returns
exact top-event probability, including NOT logic. It does not enumerate or
return cut sets. Cut-set algorithms remain in the PRAXIS Rust library and CLI;
the web frontend, backend and Node addon do not expose them for FT or ET runs.

HCL FT and ET probability runs use main's original HCL+TensorBayes quantifier.
The addon supplies HCL_MH's BN depth order followed by BFS FT-only events,
unless the request supplies an explicit order. Sequences keep separate BDDs.
HCL cut sets and importance are disabled pending methodological review
(tasks 10–11 deferred). Their result fields and exports have been removed.
FT/CPT uncertainty, summary statistics and point hazard convolution follow
their reviewed sources. Sampled hazard convolution is disabled; its dedicated
calculation and result fields were removed in task 23.
The PRAXIS cut-set algorithms and shared ZBDD cache fix remain in place.

## HCL FT and CPT uncertainty

HCL FT and ET requests, including batches, accept `calculationType`:
`PROBABILITY` (the default) or `UNCERTAINTY`. Uncertainty requires saved settings
and an explicit request. The application removes uncertainty from probability
execution snapshots, leaving workbook settings intact. The addon also ignores
unused uncertainty settings before deserializing or validating them.

Point hazard runs remain available with saved uncertainty settings; requesting
`UNCERTAINTY` with hazard convolution is rejected. Existing CLI probability
algorithms are unchanged. Older addon callers that relied on saved settings to
trigger sampling must now send `calculationType: "UNCERTAINTY"`.

MC and LHS support beta, uniform, normal, lognormal, logit-normal, gamma,
exponential and triangular FT probability distributions. `sampler` selects `MC`
or `LHS` for both FT and BN inputs, using HCL_MH's corresponding routines.
Omitted settings retain MC; new UI configurations default to LHS. The old
`basicEventSampler` field remains a read alias.

CPT rows accept `prior: {family:"BETA", alpha, beta, trueStateId}` or
`prior: {family:"DIRICHLET", alpha:[...]}` in BN state order. Optional
`cptProbabilityClipEpsilon` defaults to zero and affects Beta and fragility probabilities. BN LHS follows the source's sorting/shuffling routine, not the FT
inverse-CDF routine. Former `equivalentSampleSize` records must be explicitly
reconfigured; the old solver path is removed.

`cptGenerators` supports HCL_MH seismic fragility and root PGA bins, using
MC or the source generator LHS routine. A node uses row priors or one generator.
Fragility shifts one capacity curve per sample; PGA bins support Poisson and
linear conversion and reject excessive totals. Both use the existing vectorized
FT/ET uncertainty path. See the source map for fields, ordering and verification.

The addon builds the Rust sampling port and the original SciPy inverse-CDF
kernels. A C++17 compiler is required at build time; Python is not required at
runtime. The Praetor builder already installs g++. Kernel sources, pinned
revisions and verification are documented in
[the source map](../praxis/src/hcl/uncertainty/SOURCE.md). Original dependency
notices ship with the addon in `THIRD_PARTY_NOTICES.txt`.

## Point hazard convolution

Hazard batches preserve base BN evidence and weight all scenario observations
using HCL_MH's sequential conditional queries through main's TensorBayes engine.
Optional normalization uses the total selected mass; annual scaling is separate.
FT, sequence and end-state totals return `convolvedProbability` alongside
`integratedAnnualFrequency`. Contribution rows also return `probabilityContribution`.

Zero-weight point scenarios return only `scenarioId` and
`status: "skipped_zero_weight"` in `batchResults`. FT convolution rows have a null
`conditionalProbability` and zero contributions; skipped ET rows have no sequences.
The backend stores these as `SKIPPED` runs without a result or failure.
An all-zero grid succeeds with zero totals, including when normalization is enabled.
Validation and execution reject hazard convolution when the request selects
`calculationType: "UNCERTAINTY"`. The UI disables that combination; the backend
rejects it before creating runs. `PROBABILITY` ignores saved uncertainty settings
for execution and leaves them available for later uncertainty runs.
Source references and the point-only boundary are documented in
[the hazard source map](../praxis/src/hcl/HAZARD_SOURCE.md).

## JSON protocol

Event-tree transfers enter the destination tree and enumerate its complete
success/failure paths. Snapshot traversal is adapted from
`resources/HCL_MH/et/et_compiler.py::enumerate_paths`; the inherited PRAXIS
`SequenceFormulaBuilder` and BDD evaluate the combined conditions. HCL point
probability calls the original main `HclQuantifier`.

Transfer targets contain only `modelId`. The obsolete destination-sequence
selection has been removed from workbook schemas, seed data and the editor.
Expanded results have stable UUIDs and a `sequenceChain` recording each source
and destination sequence. Their `path` includes conditions across all trees;
the initiating frequency is applied once, from the source tree.

Like HCL_MH's `enumerate_paths`, branches may contain only success or only
failure. The selected condition remains in the sequence BDD. Such paths retain
their calculated probabilities without normalization or an invented sibling.
Frontend, shared backend validation and the addon reject duplicate paths and
mixing bypass with success/failure. The existing PRAXIS fork and sequence solver
already support a single outcome.

The current protocol version is `1.0.0`. A call carries the backend's typed
validate or execute request together with the immutable project-model snapshots
needed to resolve cross-model references:

```json
{
  "schemaVersion": "1.0.0",
  "request": {},
  "modelSnapshots": []
}
```

Successful computations use the corresponding versioned result envelope:

```json
{ "schemaVersion": "1.0.0", "result": {} }
```

Request-validation and PRAXIS failures use a stable error kind and code, while
retaining a human-readable message and structured details:

```json
{
  "schemaVersion": "1.0.0",
  "error": {
    "kind": "VALIDATION_ERROR",
    "code": "UNSUPPORTED_SCHEMA_VERSION",
    "message": "...",
    "details": {
      "expectedSchemaVersion": "1.0.0",
      "receivedSchemaVersion": "2.0.0"
    }
  }
}
```

## Bayesian table preflight

`preflight(requestJson, operation)` reports the largest planned dense Bayesian
clique table using the original TensorBayes MinFill compiler, without inference.
`operation` is `validate` or `execute`. Sizes are exact decimal byte strings.
BN queries include the requested evidence batch; HCL uncertainty includes the
existing sample slices of at most 256. Invalid BN rows or unused HCL branches may
reduce actual allocations. Ordinary FT/ET runs and scenario generation have no
Bayesian table. BN structural validation also needs no table.

Praetor runs this preflight before validation/inference and returns
`PRAXIS_RESOURCE_LIMIT` when a table exceeds `PRAETOR_NATIVE_MAX_CLIQUE_MB`
(default **4096 MiB**, positive integer). Increase it only after reviewing host or
container capacity. This is an admission limit for one table, **not total memory,
a reservation, or a V8 heap limit**. Other tables, BDDs, CPT samples and caches
need additional memory; the existing process timeout and container limits still
apply. Direct addon/CLI callers retain the original solver behavior and can call
preflight before execution. Numerical solver code is unchanged.

## Development

```shell
pnpm --filter praxis-node build:debug
pnpm --filter praxis-node lint
pnpm --filter praxis-node test
```
