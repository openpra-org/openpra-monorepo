# FINAL CONTRIBUTION INVENTORY v1

## Purpose

This document records the current completed contribution set for the OpenPRA Quantum Readiness work.

## Primary human author

Devin Peters

## Project title

OpenPRA Quantum Readiness Contribution v1

## Repository root

`/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo`

## Completed code contribution set

### Standalone package

Location:
`packages/quantum-readiness`

Included work:
1. normalized fault tree types
2. readiness analysis engine
3. readiness report generation
4. markdown summary generation
5. OpenPRA fault tree graph adapter
6. conservative default OpenPRA graph heuristics
7. graph to readiness facade
8. smoke runner scripts
9. package level tests

### Backend feature slice

Location:
`packages/web-backend/src/quantumReadiness`

Included work:
1. backend service
2. backend controller
3. backend module
4. by id graph retrieval path
5. direct graph route
6. route level HTTP tests
7. controller tests
8. service tests

### Backend registration

Location:
`packages/web-backend/src/api.module.ts`

Included work:
1. module import
2. route tree registration under `/api/quantum-readiness`

## Current route surface

### Direct graph analysis
`POST /api/quantum-readiness/fault-tree-graph`

### Stored graph by id analysis
`POST /api/quantum-readiness/fault-tree-graph/by-id`

## Current behavior

### Direct graph route returns
1. normalized fault tree
2. structured readiness report
3. markdown summary

### By id route returns
1. normalized fault tree
2. structured readiness report
3. markdown summary

### Missing stored graph behavior
Returns 404 when the stored graph is missing or has no nodes.

## Authorship and provenance records already created

1. `AUTHORS_AND_ATTRIBUTION_v1.md`
2. `HUMAN_AUTHORSHIP_AND_AI_USE_STATEMENT_v1.md`
3. `PROVENANCE_LOG_v1.md`
4. `COPYRIGHT_AND_DISCLOSURE_WORKFLOW_v1.md`
5. authorship SHA manifest under `AUTHORSHIP_MANIFESTS/`

## Release packaging already created

Location:
`RELEASES/OPENPRA_QUANTUM_READINESS_CONTRIBUTION_v1_20260406_001720Z`

Artifacts:
1. stage directory
2. tar.gz bundle
3. tarball SHA256 sidecar
4. file inventory
5. SHA256 manifest
6. authorship documents
7. smoke run evidence

## Tests completed at this milestone

### Package level
1. readiness package tests
2. readiness package build
3. readiness package lint

### Backend level
1. service spec
2. controller spec
3. HTTP spec
4. backend lint

## Out of scope at this milestone

1. CL QUBO export
2. Qiskit circuit generation
3. live hardware execution
4. frontend UI integration
5. direct MEF parsing in backend routes
6. advanced PRA importance propagation

## Human authorship statement for this inventory

This contribution inventory is intended to document the human-authored project direction, code selection, code revision, integration, testing, packaging, and final arrangement completed by Devin Peters.

AI tools were used only for brainstorming.

## Freeze note

This inventory reflects the contribution state as of the current milestone and should be updated only when a new intentional milestone is completed.

## Version

Version:
v1

Date:
2026 04 05
