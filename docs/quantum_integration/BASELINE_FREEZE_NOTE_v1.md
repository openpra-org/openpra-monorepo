# OpenPRA Quantum Integration Baseline Freeze Note v1

## Purpose

This document records the initial baseline freeze for the OpenPRA quantum integration project. The purpose of this freeze is to establish an auditable starting point before additional integration work proceeds.

## Freeze metadata

- schemaVersion: 1.0.0
- documentVersion: 1
- createdAtUtc: 2026-04-13T19:38:55Z
- createdBy: openpra_quantum_baseline_freeze_v1.sh 1.0.0
- repositoryRoot: /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo
- integrationBranch: feature/openpra_quantum_integration_v1
- headCommit: d66fd683aa1547c4e03b0bdf0fc978f65696d6b5
- shortHeadCommit: d66fd683
- baselineArtifactDirectory: artifacts/quantum_integration/baseline_freeze_20260413_193855Z
- proposedBaselineTagAfterCommit: openpra_quantum_integration_baseline_v1_20260413_193855Z

## Validated basis carried into this project

The project starts from a research and validation basis that already exists.

1. Phase 4 established a bounded preparation basis with validated CL QUBO export and statevector verification on a stratified reactor scale cohort.
2. Phase 5 established a package based recovery workflow with semantic parity against the legacy script era workflow on the executed only validation cohort.
3. The project direction is now to move from validated package migration to native OpenPRA quantum integration with optional simulator, emulator, and real hardware execution paths.

## What is inside this freeze

- repository state snapshot
- branch and commit capture
- tracked and untracked file inventory
- full source SHA256 manifest for the current filesystem state
- candidate research script inventory
- initial artifact and API contract document

## What is not yet proven

The following are not yet treated as proven platform capabilities at this freeze point.

- broad workflow robustness across diverse topology classes and sizes beyond the narrow validated recovery cohort
- downstream OpenPRA risk quantification consumption of quantum recovery outputs
- live execution through a web backend path
- multi user or production grade operational behavior
- regulatory grade importance agreement
- any claim of quantum advantage
- any external market claim such as being the first PRA tool with quantum support

## Immediate next project actions

1. review the candidate research script inventory
2. separate research era scripts from package and backend code paths where appropriate
3. lock artifact schemas and API contracts
4. expose recovery as the first backend service
5. expose preparation as the second backend service

## Baseline artifacts

- status short: artifacts/quantum_integration/baseline_freeze_20260413_193855Z/git_status_short.txt
- status full: artifacts/quantum_integration/baseline_freeze_20260413_193855Z/git_status_full.txt
- diff stat: artifacts/quantum_integration/baseline_freeze_20260413_193855Z/git_diff_stat.txt
- full diff: artifacts/quantum_integration/baseline_freeze_20260413_193855Z/git_diff.patch
- tracked files: artifacts/quantum_integration/baseline_freeze_20260413_193855Z/git_tracked_files.txt
- untracked files: artifacts/quantum_integration/baseline_freeze_20260413_193855Z/git_untracked_files.txt
- source manifest: artifacts/quantum_integration/baseline_freeze_20260413_193855Z/source_manifest_sha256.txt
- candidate research script inventory: artifacts/quantum_integration/baseline_freeze_20260413_193855Z/candidate_research_script_inventory.txt

## Working rule

From this baseline forward, filesystem artifacts remain authoritative, database records are derived convenience views, and new artifacts must be versioned rather than overwritten.
