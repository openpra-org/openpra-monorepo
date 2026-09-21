## PRAXIS (PRA eXecution and Insight System)

PRAXIS is a command line tool for Probabilistic Risk Assessment (PRA). This repository contains Rust based implementations of PDAG based algorithms, taking inspiration from techniques introduced by PRA practitioners over the years.

## Installation

### Prerequisites

- Rust 1.70+ (install from [rustup.rs](https://rustup.rs))
- A C++17 compiler for the unchanged SciPy inverse-CDF kernels used by HCL LHS
- For GPU acceleration: CUDA Toolkit 11.0+

### From Source

```bash
# Clone repository
git clone https://github.com/rasheeqqua/praxis.git
cd praxis

# Build (CPU-only)
cargo build --release

# Build with GPU support
cargo build --release --features gpu

# CUDA (NVIDIA)
cargo build --release --features cuda

# Install to system
cargo install --path .

# Run tests
cargo test --lib --tests
```

### Code Quality

```bash
# Format code
cargo fmt

# Lint
cargo clippy -- -D warnings

# Check without building
cargo check
```

## Direct ZBDD cut-set enumeration

`zbdd-direct` constructs the cut-set ZBDD directly from the fault-tree PDAG. It does not build a BDD first and does not apply delete-term approximation.

```bash
praxis-cli model.xml --algorithm zbdd-direct --analysis cutsets-and-probability --approximation mcub --limit-order 6 --output result.xml
```

Order and probability limits are applied during coherent-model construction. Complemented logic is completed by exact consensus before final limits are applied. The direct algorithm currently supports fault-tree input.

`zbdd-end-state` groups event-tree sequence cut sets by end-state name in one shared ZBDD manager. Its output contains grouped cut sets and does not include end-state probability.

## Hybrid Causal Logic

PRAXIS can quantify selected fault-tree basic events through a discrete
TensorBayes network while leaving unbound events independent. HCL is opt-in and
does not change the existing OpenPSA XML or PBF workflows:

```bash
cargo run -- fault-tree.xml --hcl-request hcl-request.json
```

The command emits a JSON result. Canonical BN JSON, embedded XDSL, and XDSL file
sources are supported by request schema version 1. See
[`src/hcl/REQUEST_SCHEMA.md`](src/hcl/REQUEST_SCHEMA.md) for the complete input
contract, including a runnable correlated-AND example. This HCL CLI quantifies
one FT top event; HCL ET runs, evidence batches, uncertainty and point hazard
convolution use the separate Rust application API and Node addon. See the
[capability and source table](src/hcl/README.md#execution-scope-and-sources).

Numerical verification compares conditional Shannon traversal with a frozen
legacy unified network, a test-only Rust unified-network conversion, and direct
enumeration. See [`docs/HCL_VERIFICATION.md`](docs/HCL_VERIFICATION.md).

## ZBDD cache sizing

The default array operation cache uses 2^12 entries (about 64 KiB) per ZBDD
engine. This avoids allocating about 1 GiB for every short-lived event-tree
sequence engine. It changes cache capacity, not the solver algorithms or results.

Set `PRAXIS_ZBDD_CACHE_BITS` before starting the process to override the size
(10–30 bits). Large, cache-intensive models may benefit from a larger setting;
`26` restores the former default. With `PRAXIS_ZBDD_GC=1`, the existing default
remains 23 bits. `PRAXIS_OPCACHE=hashmap` with GC off still uses the existing
hash-map caches. The Node addon and native workers inherit these solver defaults.
