# OpenPRA Quantum Research Scripts

This directory holds research-era support scripts that were used during Phase 3, Phase 4, and Phase 5 development and validation of the OpenPRA quantum integration work.

These scripts are preserved for provenance, audit, reconstruction, and bundle generation support.

They are not treated as production package code.

## Directory layout

- phase3: bounded topology classification and related freeze support
- phase4: preparation, CL-QUBO export, statevector, and bounded cohort support
- phase5: recovery workflow, batch construction, orientation audit, probability ingestion, acceptance gating, and bundle support
- misc: supporting one-off utilities that do not fit cleanly into a single phase

## Working rule

Product code belongs under package and backend source trees.

Research scripts belong here unless and until they are intentionally promoted into maintained product code.
