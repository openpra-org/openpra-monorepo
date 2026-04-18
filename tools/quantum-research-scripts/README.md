# Quantum Research Scripts Quarantine

This directory contains research-oriented scripts and ad hoc helper assets that are not part of the production package tree.

## Why this directory exists

The OpenPRA Quantum Integration Plan v2 requires standalone research scripts to be isolated from production package code so the repository can remain auditable and easier to review.

These files are retained for provenance, reconstruction support, and research traceability. They should not be treated as production API or package code without separate review and promotion.

## Current quarantine groups

- `phase5_untracked_quarantine_v1`
  - Phase 5 recovery and packaging helper scripts that were previously loose under the top-level `scripts/` directory

- `misc_untracked_quarantine_v1`
  - Ancillary handoff, bundle, mirror, transfer, and audit helpers that were previously loose under `tools/quantum_integration/`
  - Includes the stray timestamped `20260415_004659Z` directory when present

## Promotion rule

A quarantined research script may be promoted later only if:

1. its purpose is documented,
2. it has tests or acceptance checks appropriate to its role,
3. it is versioned intentionally, and
4. it is explicitly moved into a supported package or maintained tools area by a later commit.
