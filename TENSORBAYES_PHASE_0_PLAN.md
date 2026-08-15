# TensorBayes Implementation Plan

## Status

- Phase 0 status: complete — architecture and scope defined
- Phase 1 status: complete — discrete Rust engine implemented
- Phase 2 status: complete — C++ equivalence verification recorded
- Phase 3 status: complete — PRAXIS HCL computational bridge implemented
- Phase 4 status: complete — public API, canonical input, XDSL import, and CLI implemented
- Benchmarking status: deferred to Phase 6
- Legacy fixture or test migration: excluded
- Bayesian-engine source of truth: `/Users/akrambatikh/Documents/projects/Libraries/BN C++/bncore`
- Current local branch: `revamp`, tracking `origin/revamp`
- Current implementation baseline: `0a82f6b1`

During the initial review, local `main` and the previous local `revamp` both
pointed to `e88696e8`, while `origin/revamp` pointed to `0a82f6b1`. The working
tree has now been switched to a new local `revamp` that tracks `origin/revamp`,
so PRAXIS is present under `apps/solvers/praxis`. The previous local branch and
its history are preserved as `revamp-local-backup`.

Phase 1 was implemented in the current working tree under
`apps/solvers/tensorbayes`. Phase 0 remains documentation-only; no legacy GUI,
benchmark, binding, or test code was converted.

## Purpose

TensorBayes will be a standalone Rust Bayesian-network inference library derived from the relevant discrete inference engine in the C++ `bncore` project. PRAXIS will depend on TensorBayes when Hybrid Causal Logic (HCL) quantification is added.

The intended dependency direction is:

```text
TensorBayes (generic discrete Bayesian inference)
    ↑
PRAXIS HCL adapter (Boolean-event/BN bindings and conditional Shannon traversal)
    ↑
OpenPRA/Praetor (model conversion, execution, and result transport)
```

TensorBayes must not contain PRAXIS, fault-tree, HCL, OpenPRA database, or GUI concepts.

## Phase 0 Objective

Phase 0 produces design records only. Its job is to make the later conversion mechanical and reviewable by defining:

1. The exact C++ source boundary that will be used.
2. The C++-to-Rust module map.
3. Required and deferred Bayesian capabilities.
4. Tensor and CPT layout contracts.
5. The public Rust API boundary.
6. Ownership and lifetime relationships.
7. The future connection points to PRAXIS and OpenPRA.

Phase 0 does not establish numerical golden values from the old HCL README files. Correctness cases and performance baselines will be created later from the maintained engines and the future benchmark corpus.

## Proposed Future Repository Location

PRAXIS already exists on the current `revamp` baseline. The proposed TensorBayes
crate and PRAXIS HCL module paths below do not exist yet; they describe the layout
for later implementation phases.

TensorBayes should be introduced as an independent Rust library rather than as an internal PRAXIS module:

```text
apps/solvers/tensorbayes/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── graph.rs
    ├── tensor.rs
    ├── factor.rs
    ├── junction_tree.rs
    ├── compiler.rs
    ├── workspace.rs
    ├── engine.rs
    └── error.rs
```

The Cargo package and Rust crate name should be `tensorbayes`.

PRAXIS should later reference it through a path dependency. HCL-specific code should remain under PRAXIS, for example:

```text
apps/solvers/praxis/src/hcl/
├── model.rs
├── binding.rs
├── ordering.rs
└── quantify.rs
```

## C++ Source Boundary

### Required discrete-engine sources

The following files define the initial TensorBayes conversion boundary.

#### Graph and variable model

- `include/bncore/graph/node.hpp`
- `include/bncore/graph/graph.hpp`
- `src/graph.cpp`

Relevant behavior:

- Dense node identifiers
- Node names and state labels
- Ordered parent and child adjacency
- Scalar and batched CPT storage
- CPT shape and probability validation
- Name-to-ID lookup

`Graph::split_state` is not part of the initial port because its primary consumer is dynamic discretization.

#### Tensor and factor kernel

- `include/bncore/factors/dense_tensor.hpp`
- `include/bncore/factors/factor.hpp`
- `src/dense_tensor.cpp`
- `src/factor.cpp`

Relevant behavior:

- Dense row-major tensors
- Precomputed strides
- Owned and reusable storage
- Factor scopes
- Scalar and batched dimensions
- Factor multiplication
- Factor marginalization
- Scalar/batched broadcasting

The C++ bump allocator is an implementation technique, not a required public abstraction. Rust can use owned and reusable buffers while preserving the same layout and allocation behavior at the workspace boundary.

#### Junction-tree representation and compiler

- `include/bncore/inference/junction_tree.hpp`
- `include/bncore/inference/compiler.hpp`
- `src/junction_tree.cpp`
- `src/compiler.cpp`

Relevant behavior:

- DAG moralization
- Min-fill elimination
- Triangulation
- Maximal-clique construction
- Clique-tree and separator construction
- CPT-to-clique assignment
- Treewidth and table-size statistics

Commercial-license validation stubs in the C++ implementation are not part of TensorBayes.

#### Sum-product workspace

- `include/bncore/inference/workspace.hpp`
- `src/workspace.cpp`

Relevant behavior:

- Clique-potential construction
- Precomputed collect, distribute, and assembly schedules
- Precomputed tensor index maps
- Sum-product calibration
- Hard evidence
- Soft or virtual evidence
- Scalar and batched CPT inference
- Single-variable and multi-variable marginal extraction
- Reusable message buffers
- Reusable scratch buffers
- Workspace reset and cache invalidation

The first conversion pass should exclude max-product/MAP behavior from this large source file. The boundary must be documented at the function and field level before conversion begins so sum-product state is not accidentally coupled to MAP traceback state.

#### Batch execution engine

- `include/bncore/inference/engine.hpp`
- `src/engine.cpp`

Relevant behavior:

- Single-query evaluation
- Multi-query evaluation
- Evidence batches
- Batched CPT offsets and chunks
- Workspace reuse
- Soft-evidence application
- Cache invalidation

The first Rust implementation may execute single-threaded while preserving batch semantics. C++ thread-pool code is not a required line-for-line port.

### Explicitly excluded sources

The following are outside the initial TensorBayes scope:

- `include/bncore/discretization/cpd_integrator.hpp`
- `include/bncore/discretization/manager.hpp`
- `include/bncore/inference/hybrid_engine.hpp`
- `src/cpd_integrator.cpp`
- `src/manager.cpp`
- `src/hybrid_engine.cpp`
- Continuous-variable metadata and evidence
- Dynamic discretization and bin refinement
- Distribution-specific CPD integrators
- `Graph::split_state` in the initial port
- Max-product calibration and MAP/MPE traceback in the initial port
- Python and nanobind bindings under `src_python/`
- Python wrappers and utilities under `pybncore/`
- Loopy belief propagation
- Posterior convenience layers
- GUI code under `pybncore_gui/`
- Examples
- Existing C++ and Python tests
- Existing benchmarks
- Benchmark reports and generated plots
- SMILE headers, libraries, adapters, and license files

Existing tests and benchmarks will not be copied. Later phases may create focused Rust verification cases and a new benchmark corpus.

## Required TensorBayes Capabilities

The initial discrete engine must ultimately provide:

1. Discrete Bayesian DAG construction.
2. Arbitrary finite state cardinalities.
3. Ordered tabular CPTs.
4. Scalar CPTs.
5. Batched CPTs for future uncertainty propagation.
6. Hard evidence.
7. Soft/set-valued evidence.
8. Exact sum-product marginal inference.
9. Multiple marginal queries from one calibration.
10. Reusable compiled junction trees.
11. Reusable inference workspaces.
12. Explicit validation and typed errors.

Soft evidence is an HCL-relevant capability. A Boolean event mapped to a subset of states in a multi-state BN node can be represented as a zero/one likelihood vector without creating an artificial binary proxy node.

## Deferred TensorBayes Capabilities

These capabilities should not complicate the first conversion:

- Continuous or hybrid Bayesian networks
- Dynamic discretization
- MAP/MPE inference
- State splitting
- Loopy belief propagation
- Sensitivity and value-of-information analysis
- D-separation/Bayes-Ball pruning
- Barren-clique pruning
- Parallel batch scheduling
- Python bindings
- GUI or visualization
- File import/export

D-separation, barren-node pruning, lazy propagation, and parallel execution are performance phases. Their Rust implementations should follow only after the unoptimized sum-product path is verified.

## Data-Layout Contracts to Record Before Conversion

Phase 0 must record the following layouts from the C++ implementation in enough detail that Rust code can be reviewed against them.

### Node identifiers

- C++ uses dense `std::uint32_t` node IDs.
- Rust should use a typed newtype such as `NodeId(u32)` rather than exposing raw indexes.
- State positions should likewise use a typed representation where it improves API safety.

### CPT layout

The C++ graph stores a flat CPT with the child-state axis after all ordered parent axes. A batch axis, when present, is last:

```text
[parent configuration ..., child state, batch]
```

For scalar CPTs the implicit batch size is one. TensorBayes must preserve parent order and this flattening rule so C++/Rust comparisons are unambiguous.

Before Phase 1, document:

- Parent configuration enumeration order
- Child-state stride
- Scalar CPT length calculation
- Batched CPT length calculation
- Batch-offset behavior
- Row normalization boundaries

### Factor layout

- Factor scope order is significant.
- A scalar factor tensor has one dimension per scope variable.
- A batched factor adds a final batch dimension.
- Multiplication must preserve the C++ scope-union ordering contract.
- Marginalization must preserve the remaining scope order.

### Evidence layout

- Hard evidence is represented as a matrix with one state index per model variable and batch row.
- The unobserved sentinel must be explicitly recorded and kept stable.
- Soft evidence is a likelihood vector per state, not a normalized probability distribution.
- Batched soft evidence is row-major by batch row and state.

### Query output layout

- Single-query output is batch rows by queried state.
- Multi-query output packs state ranges using explicit offsets.
- Rust should expose safe typed views or owned result objects while preserving the packed internal representation.

## Proposed Public Rust API

This is an architectural target, not code to be written in Phase 0:

```rust
pub struct BayesianGraph { /* dense variables, adjacency, CPTs */ }
pub struct CompiledJunctionTree { /* immutable compiled structure */ }
pub struct InferenceWorkspace { /* mutable reusable inference state */ }
pub struct ExecutionEngine { /* workspace ownership and batch execution */ }

pub struct EvidenceBatch { /* hard evidence matrix */ }
pub struct MarginalBatch { /* batch x states */ }
pub struct MultiMarginalBatch { /* packed marginals plus offsets */ }

impl BayesianGraph {
    pub fn add_variable(&mut self, name: &str, states: &[String]) -> Result<NodeId>;
    pub fn add_edge(&mut self, parent: NodeId, child: NodeId) -> Result<()>;
    pub fn set_cpt(&mut self, node: NodeId, values: Vec<f64>) -> Result<()>;
    pub fn validate(&self) -> Result<()>;
}

impl CompiledJunctionTree {
    pub fn compile(graph: BayesianGraph, heuristic: CompileHeuristic) -> Result<Self>;
}

impl ExecutionEngine {
    pub fn evaluate(
        &mut self,
        evidence: &EvidenceBatch,
        query: NodeId,
    ) -> Result<MarginalBatch>;

    pub fn evaluate_multi(
        &mut self,
        evidence: &EvidenceBatch,
        queries: &[NodeId],
    ) -> Result<MultiMarginalBatch>;

    pub fn set_soft_evidence(
        &mut self,
        node: NodeId,
        likelihoods: &[f64],
    ) -> Result<()>;

    pub fn clear_soft_evidence(&mut self);
    pub fn invalidate_workspace_cache(&mut self);
}
```

API refinement is allowed during Phase 0. Algorithm conversion is not.

## Ownership and Mutability Model

The proposed Rust ownership boundary is:

1. `BayesianGraph` is mutable during model construction.
2. Compilation validates and consumes or immutably owns the graph.
3. `CompiledJunctionTree` is immutable and shareable after compilation.
4. `InferenceWorkspace` owns mutable potentials, evidence, messages, caches, and scratch buffers.
5. `ExecutionEngine` owns or pools workspaces and provides the public evaluation API.

This prevents evidence or calibration state from mutating the graph or compiled clique structure. It also permits future parallel execution with one workspace per worker and a shared immutable compiled tree.

## Error Model

TensorBayes should use a typed `thiserror` error enum covering at least:

- Duplicate variable names
- Unknown node or state
- Self-edge or graph cycle
- Invalid CPT size
- Invalid batched CPT geometry
- NaN, infinity, negative probability, or probability above one
- CPT row normalization failure
- Evidence width or state-range mismatch
- Soft-evidence cardinality mismatch
- Invalid query node
- Compilation failure
- Inconsistent or zero-mass evidence
- Tensor dimension or overflow failure

Panics should be limited to internal invariant violations that cannot be caused by model input.

## Future PRAXIS HCL Boundary

PRAXIS should later define an adapter around TensorBayes rather than placing HCL logic inside the TensorBayes engine.

The adapter will provide:

- Boolean/fault-tree event to BN-node bindings
- The state subset meaning “Boolean event occurs”
- Persistent base evidence
- BDD-path evidence conversion
- Conditional probability queries
- Context caches
- HCL-specific BDD variable ordering

The central HCL recurrence will remain in PRAXIS:

```text
P(f | E) =
    P(X=true | E)  * P(high | E, X=true)
  + P(X=false | E) * P(low  | E, X=false)
```

PRAXIS will reuse its existing PDAG and BDD. TensorBayes will only answer Bayesian marginal queries under evidence.

## Later-Phase Roadmap

### Phase 1 — TensorBayes discrete engine conversion

- [x] Graph and CPT model
- [x] Dense tensor and factor operations
- [x] Junction-tree representation and compiler
- [x] Single-threaded sum-product workspace
- [x] Hard and soft evidence
- [x] Single and multi-query marginals
- [x] Scalar and batched CPT execution
- [x] Execution engine and workspace reuse

Phase 1 completion record (2026-08-14):

- Added the standalone `tensorbayes` Rust crate under `apps/solvers/tensorbayes`.
- Preserved ordered-parent CPT layout with an optional final batch axis.
- Implemented min-weight, min-fill, min-degree, and weighted-min-fill compilation.
- Implemented maximum-weight clique-tree construction, including empty
  separators between independent graph components.
- Implemented reusable sum-product calibration with hard, shared soft, and
  batched soft evidence.
- Added typed single-query and packed multi-query result objects.
- Added Phase 1 contract and smoke tests without copying legacy tests or
  establishing the Phase 2 C++ comparison corpus.

### Phase 2 — TensorBayes correctness verification

- [x] Create focused Rust verification cases rather than porting the old tests.
- [x] Compare TensorBayes results directly with the maintained C++ engine.
- [x] Verify scalar and batched layouts, evidence, and multi-query results.
- [x] Do not treat the old HCL README values as authoritative.

Phase 2 completion record (2026-08-14):

- Added a minimal C++ oracle compiled from only the seven in-scope BNCore
  discrete-engine sources.
- Added seven deterministic cross-language cases producing 114 marginal values.
- Confirmed 93 values match directly within a relative/absolute tolerance of
  `1e-12`.
- Found and isolated 21 results where BNCore repeatedly applies soft evidence
  to a separator variable—once per containing clique—thereby squaring the
  likelihood in the two-clique case.
- Confirmed the C++ values equal squared-likelihood inference and retained the
  mathematically correct apply-once behavior in TensorBayes, guarded by an
  independent enumeration regression.
- Left the external, already-dirty BNCore working tree unchanged.
- Recorded the reproducible runner and full coverage details in
  `apps/solvers/tensorbayes/verification/README.md`.

### Phase 3 — PRAXIS HCL bridge

- [x] Define HCL bindings and base evidence.
- [x] Add caller-controlled BDD ordering.
- [x] Implement conditional Shannon traversal using TensorBayes.
- [x] Add BN-query and BDD-context caches.
- [x] Support binary and multi-state bindings.

Phase 3 completion record (2026-08-15):

- Added the `tensorbayes` dependency to PRAXIS and an isolated `praxis::hcl`
  module; model serialization and request-envelope concerns remain deferred to
  Phase 4.
- Added validated Boolean-event bindings from BDD variables to binary or
  arbitrary state subsets of TensorBayes nodes, plus persistent hard base
  evidence.
- Added an exact caller-provided basic-event order to the existing PRAXIS BDD
  builder. The order must contain every basic event exactly once.
- Implemented conditional Shannon traversal. Bound variables use TensorBayes
  conditional marginals under the accumulated path context; unbound variables
  retain their existing independent BDD probabilities.
- Added exact path-context and BN-query caches, cache statistics, cache
  invalidation when base evidence changes, complement-edge handling, and
  contradictory-branch elimination.
- Added focused integration coverage for correlated binary events, mutable base
  evidence, mixed bound/unbound events, multi-state partitions on one BN node,
  complement edges, validation, explicit ordering, and cache reuse.

### Phase 4 — PRAXIS API and model I/O

- [x] Add `HclModel`, `HclSettings`, and `quantify_hcl`.
- [x] Add canonical BN input and minimal required XDSL import.
- [x] Define an HCL request envelope.
- [x] Add CLI support without changing existing OpenPSA/PBF behavior.

Phase 4 completion record (2026-08-15):

- Added a name-based public model boundary with `HclModel`, `HclSettings`,
  `HclBindingSpec`, `HclEvidenceSpec`, `HclResult`, and `quantify_hcl`.
- Added strict canonical discrete-BN input with named variables, ordered parents,
  named states, scalar CPT validation, and conversion to `BayesianGraph`.
- Added a minimal XDSL importer for discrete CPT nodes. It preserves declared
  state and parent order, ignores GeNIe presentation extensions, and rejects
  decision, utility, deterministic, continuous, or malformed inputs rather than
  approximating them.
- Added version 1 of the serializable HCL request envelope. It supports embedded
  canonical data, embedded XDSL, or an XDSL file path; CLI-relative file paths
  resolve against the request directory.
- Added serializable HCL output with probability, selected BDD order, BDD size,
  bridge-cache statistics, and junction-tree statistics.
- Added the opt-in `--hcl-request <JSON>` CLI path. The positional fault-tree
  input remains OpenPSA XML or PBF, HCL results are JSON, and commands without
  the new option retain the existing execution path.
- Added focused API, canonical-input, XDSL, request-validation, evidence, and
  binary CLI tests.
- Added an HCL numerical verification gate using a compact legacy model-input
  fixture. Conditional Shannon traversal is compared with the old
  Python-generated unified XDSL, a test-only Rust unified-BN conversion, and
  direct state-space enumeration.
- Added multi-state overlapping bindings, hard evidence, BDD-order invariance,
  cache reuse, and cache-clear invariance checks. The method, corpus policy,
  limitations, commands, and recorded probabilities are documented in
  `apps/solvers/praxis/docs/HCL_VERIFICATION.md`.
- The complete PRAXIS suite passes with 882 tests successful and two
  pre-existing ignored tests.

### Phase 5 — OpenPRA/Praetor integration

- Convert OpenPRA BN data into the canonical TensorBayes representation.
- Extend Praetor input-format handling.
- Run HCL through the existing PRAXIS process boundary.
- Return standard PRAXIS quantification results.

### Phase 6 — Optimization and new benchmarking

- Add D-separation/Bayes-Ball pruning.
- Add barren-clique pruning.
- Add lazy base-potential reuse.
- Add HCL context projection and dependency groups.
- Add parallel batch execution.
- Establish a new correctness and performance corpus.
- Compare C++ BNCore, TensorBayes, and integrated PRAXIS HCL.

## Phase 0 Deliverables

Phase 0 is complete when the team has reviewed and accepted:

- [x] The name `TensorBayes` and crate name `tensorbayes`
- [x] Standalone crate placement under `apps/solvers/tensorbayes`
- [x] Required C++ file boundary
- [x] Explicit excluded file and feature boundary
- [x] CPT flattening and parent-order contract
- [x] Scalar and batched factor-layout contract
- [x] Hard and soft evidence layout contract
- [x] Query output layout contract
- [x] Public Rust API shape
- [x] Ownership and mutability model
- [x] Typed error categories
- [x] PRAXIS/TensorBayes separation
- [x] Deferred optimization list
- [x] Later verification and benchmarking strategy

This checklist was accepted when Phase 1 implementation was requested. Phase 2
then established direct C++ comparison, and Phase 3 connected the verified
TensorBayes engine to PRAXIS's BDD traversal boundary.
