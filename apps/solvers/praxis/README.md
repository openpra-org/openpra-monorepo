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
