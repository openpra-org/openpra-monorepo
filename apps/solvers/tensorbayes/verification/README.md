# TensorBayes C++ Equivalence Verification

This directory contains the Phase 2 comparison against the maintained C++
`bncore` discrete engine. It does not use or copy the old BNCore/HCL tests,
benchmarks, Python bindings, GUI, continuous inference, or generated README
values.

## Run

From `apps/solvers/tensorbayes`:

```bash
./verification/run_cpp_equivalence.sh "/path/to/bncore"
```

The runner compiles `cpp_oracle.cpp` with only the seven relevant C++ engine
sources into a temporary directory, activates the ignored Rust equivalence
test, and removes the temporary build when it exits. Normal `cargo test` runs
do not require the external C++ repository or a C++ compiler.

## Corpus

The deterministic corpus contains seven cases and 114 marginal values:

| Case | Coverage |
| --- | --- |
| `chain_prior` | Scalar CPTs and multi-query priors |
| `chain_hard_batch` | Four hard-evidence rows and multi-query output |
| `chain_soft_shared` | Shared set-valued and non-normalized soft evidence |
| `chain_soft_batched_leaf` | Row-major batched soft evidence |
| `chain_soft_batched_separator` | Soft evidence on a variable shared by two cliques |
| `batched_cpt` | Mixed scalar/batched CPTs and hard evidence |
| `parent_order` | CPT parent order different from node-ID order |

The comparison tolerance is `1e-12` times the larger result magnitude, with a
minimum scale of one.

## Phase 2 result

- 93 values match the maintained C++ engine directly.
- 21 values intentionally differ in `chain_soft_batched_separator` because the
  C++ workspace applies a node's virtual-evidence likelihood in every clique
  containing that node. For a two-clique separator this squares the likelihood.
- The oracle test separately confirms that those 21 C++ values equal a Rust
  evaluation with squared likelihoods. A regular TensorBayes regression test
  confirms the intended apply-once virtual-evidence result by direct
  enumeration.

TensorBayes does not reproduce this C++ defect. A virtual-evidence factor is
attached to one containing clique and therefore contributes exactly once to the
joint distribution. The external BNCore working tree was not modified.
