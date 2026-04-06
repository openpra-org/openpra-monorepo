# quantum-readiness

A first-pass OpenPRA library for deterministic quantum readiness screening of normalized fault tree structures.

## Version 1 scope

This package is intentionally narrow.

It provides:
- normalized fault tree input types
- candidate subtree extraction
- simple readiness screening
- deterministic report generation
- human readable summary generation

It does not yet provide:
- OpenPSA XML parsing
- direct OpenPRA database integration
- CL-QUBO export
- Qiskit circuit generation
- hardware execution
- PRA importance measure propagation
