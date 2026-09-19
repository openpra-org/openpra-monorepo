# Task 40: Native execution boundary

Issue 25 exposes the existing PRAXIS XOR gate through the shared schema,
fault-tree editor, OpenPSA interchange and Node addon. The addon maps `XOR`
directly to `Formula::Xor`; the BDD algorithm is unchanged. XOR means an odd
number of true inputs, including three true inputs in a three-input gate.
The source is main commit `96b949e96ccbb2fa6eef7a27170dfc9cb9f54182`,
`apps/solvers/praxis/src/algorithms/bdd_engine.rs`, `combine_pdag`'s XOR fold.

This is application infrastructure authorized for the backend, Praetor and
Node addon. It introduces no quantification algorithm. PRAXIS, TensorBayes,
HCL_MH reference files and the method-specific addon adapters are unchanged
from the beginning of task 40.

## Request path

The frontend sends its existing request. The backend captures cancellation for
that HTTP request, builds the existing snapshot and calls Praetor with a deadline.
Praetor enforces its capacity limit, starts the canonical JavaScript worker in a
separate process, and loads the synchronous native addon there. The existing
adapter calls PRAXIS/TensorBayes and returns the same numerical result. Both
services validate the response envelope; the backend additionally validates the
method-specific result and saves the existing immutable run record.

Node's [child-process API](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options)
provides the process boundary. [Process termination](https://nodejs.org/api/child_process.html#subprocesskillsignal)
stops synchronous native work. Praetor waits for process closure before releasing
its slot. This replaces the duplicate JavaScript/TypeScript thread-worker sources;
Nest copies the sole JavaScript source into the compiled service.

## Limits and errors

Defaults are 5 minutes and 2 simultaneous native jobs per Praetor process. The
backend forwards an absolute deadline and waits another 10 seconds for transport.
Timeout, a disconnected request and orderly service shutdown cancel execution;
excess jobs are rejected immediately. See the [addon configuration](../../solvers/praxis-node/README.md#application-execution-limits).

The shared `praxis-node/protocol` module contains only transport validation and
execution settings. Importing it in the backend does not load native code.
Unknown/missing/malformed `methodType` values fail addon validation and execution.
Envelopes must contain version 1.0.0 and exactly one complete result or error.
The backend's existing method schemas still validate the result contents.

Issue 17 adds an optional worker V8 heap setting and a large-HCL deployment
overlay. Total memory is governed by the container/host; Rust allocations are
outside the V8 heap. The profile serializes native jobs and gives the manager
and child a shared memory budget. See the [large-run configuration](../../solvers/praxis-node/README.md#large-hcl-runs).
This is execution infrastructure, with no changes to the numerical sources.

## Verification

Regression tests stop a real child process while it is blocked in synchronous
native computation, confirm its PID has exited and reuse the capacity. They also
cover compiled worker packaging, deadline propagation, concurrent limits,
request-scoped cancellation, malformed envelopes and stored failure codes.

A browser fixture uses production frontend API helpers/result components, real
backend controllers/database and the compiled Praetor service/worker with the
native addon. It saves and retrieves FT, BN, HCL FT/ET and uncertainty batch runs.
Eight before/after addon executions preserve every returned field exactly.
See the [completion report](../../../outputs/hcl-task40/REPORT.md).

The browser fixture substitutes authentication and uses a temporary database;
it is not a deployed-app or production authorization test. Linux and Docker
execution were not tested. Direct addon calls do not inherit Praetor's limits.

## Bayesian table allocation preflight

Praetor calls the addon's `preflight(requestJson, operation)` inside its timed
worker before inference. The addon calls the unchanged TensorBayes MinFill
compiler and reports the largest clique's state-product × batch size × 8 bytes.
BN batches use requested rows; HCL uncertainty uses the existing 256-sample
slices. Ordinary FT/ET execution and scenario generation require no BN table.

`PRAETOR_NATIVE_MAX_CLIQUE_MB` limits a single planned table (default 4096 MiB).
An oversized request returns `PRAXIS_RESOURCE_LIMIT` with exact `requiredBytes`,
`limitBytes`, clique nodes and batch size, before dense calibration. The backend
retains that structured failure in run history. This does not estimate or cap
total memory, and does not alter probabilities, ordering or inference algorithms.

## Failure-rate precision

Failure-rate inputs retain `HCL_MH/uq/basic_event_models.py::calc_probability`
type 3: `1 - exp(-rate * time)`, after converting time units. PRAXIS implements
this in `quantitative.rs::failure_rate_to_probability`; the editor preview uses
`interfaces/mef-types/modeling/quantitative-semantics.ts::failureRateToProbability`.

For a rate of `1e-20` per hour and a one-hour mission, the source and API return
zero: the exponential rounds to one before subtraction. The mathematical
probability is positive and representable. A zero from this conversion therefore
does not always mean a zero input rate. Small nonzero results can also lose
relative precision.

This inherited numerical limitation is retained for source fidelity. Replacing
the expression with `-expm1(-rate * time)` would change results and requires an
explicitly approved source correction. No rounding, minimum probability, or
automatic fallback is applied. Direct probability inputs remain distinct from
rate conversion.

The editor preview uses JavaScript `Math.exp`, whose last bits can differ from
the native conversion. Issue 19 verification found this at exposure `1e-8`:
the preview returned `9.99999993922529e-9`, while `HCL_MH` and both native API
platforms returned `1.0000000050247593e-8`. Saved solver results use the native
conversion. Preview parity remains a separate recorded discrepancy.
