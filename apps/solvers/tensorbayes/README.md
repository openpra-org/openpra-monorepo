# TensorBayes

TensorBayes is OpenPRA's standalone Rust engine for exact inference in finite,
discrete Bayesian networks. It is derived from the discrete inference boundary
of the C++ `bncore` library and intentionally contains no GUI, file importer,
continuous-variable support, benchmark harness, or PRAXIS/HCL concepts.

## Phase 1 capabilities

- Dense node identifiers, ordered graph adjacency, and typed validation errors
- Scalar and batched tabular CPTs
- Dense row-major tensors and factors with scalar/batch broadcasting
- DAG moralization and four elimination heuristics
- Maximal-clique and maximum-weight junction-tree construction
- Reusable, single-threaded sum-product workspaces
- Row-major hard-evidence batches using `-1` for unobserved variables
- Shared and row-major batched soft/virtual evidence
- Single-query and packed multi-query marginals

## Data layouts

For parents added in order `P0, P1, ..., Pn`, a node `X` has CPT axes:

```text
[P0, P1, ..., Pn, X, batch]
```

The batch axis is omitted for a scalar CPT. In the flat row-major storage, the
batch index changes fastest when present, followed by `X`; the last parent
changes fastest among parent axes. Consequently:

```text
scalar_index = parent_configuration * states(X) + state(X)
batch_index  = scalar_index * batch_size + batch
```

Every conditional row is normalized independently for each batch. A scalar CPT
broadcasts over every inference row; a batched CPT must have the same batch size
as the evidence batch.

Hard evidence is row-major `[batch, variable]`. Soft evidence is either shared
`[state]` or row-major `[batch, state]`. Query results are row-major
`[batch, state]`; multi-query results pack each query's states using explicit
offsets.

## Minimal use

```rust
use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, EvidenceBatch,
    ExecutionEngine,
};

let mut graph = BayesianGraph::new();
let rain = graph.add_variable("rain", &["no", "yes"])?;
graph.set_cpt(rain, vec![0.8, 0.2])?;

let tree = CompiledJunctionTree::compile(graph, CompileHeuristic::MinFill)?;
let mut engine = ExecutionEngine::new(tree);
let evidence = EvidenceBatch::unobserved(1, 1)?;
let marginal = engine.evaluate(&evidence, rain)?;
assert_eq!(marginal.values(), &[0.8, 0.2]);
# Ok::<(), tensorbayes::Error>(())
```

Phase 2 C++ equivalence verification is recorded in
[`verification/README.md`](verification/README.md). Performance optimization
and new benchmarks remain deferred to Phase 6.
