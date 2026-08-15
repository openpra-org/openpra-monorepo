## PRAXIS (PRA eXecution and Insight System)

PRAXIS is a command line tool for Probabilistic Risk Assessment (PRA). This repository contains Rust based implementations of PDAG based algorithms, taking inspiration from techniques introduced by PRA practitioners over the years.

## Installation

### Prerequisites

- Rust 1.70+ (install from [rustup.rs](https://rustup.rs))
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
contract.

Numerical verification compares conditional Shannon traversal with a frozen
legacy unified network, a test-only Rust unified-network conversion, and direct
enumeration. See [`docs/HCL_VERIFICATION.md`](docs/HCL_VERIFICATION.md).
