#!/usr/bin/env bash
set -euo pipefail

SCRIPT_VERSION="1.0.0"
SCHEMA_VERSION="1.0.0"
DEFAULT_BRANCH="feature/openpra_quantum_integration_v1"
BRANCH_NAME="${BRANCH_NAME:-$DEFAULT_BRANCH}"
UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"
UTC_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: This script must be run inside the OpenPRA git repository."
  exit 1
fi

cd "${REPO_ROOT}"

DOCS_DIR="docs/quantum_integration"
TOOLS_DIR="tools/quantum_research_scripts"
INTEGRATION_TOOLS_DIR="tools/quantum_integration"
ARTIFACT_ROOT="artifacts/quantum_integration"
SCHEMA_DIR="schemas/quantum_integration"
BASELINE_DIR="${ARTIFACT_ROOT}/baseline_freeze_${UTC_NOW}"

mkdir -p "${DOCS_DIR}" "${TOOLS_DIR}" "${INTEGRATION_TOOLS_DIR}" "${ARTIFACT_ROOT}" "${SCHEMA_DIR}" "${BASELINE_DIR}"

backup_if_exists() {
  local target="$1"
  if [[ -f "${target}" ]]; then
    cp -p "${target}" "${target}.bak.${UTC_NOW}"
  fi
}

echo "==> Switching to integration branch"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  git switch "${BRANCH_NAME}"
else
  git switch -c "${BRANCH_NAME}"
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
HEAD_COMMIT="$(git rev-parse HEAD)"
SHORT_HEAD="$(git rev-parse --short HEAD)"

echo "==> Capturing repository state"
git status --short > "${BASELINE_DIR}/git_status_short.txt"
git status > "${BASELINE_DIR}/git_status_full.txt"
git diff --stat > "${BASELINE_DIR}/git_diff_stat.txt" || true
git diff > "${BASELINE_DIR}/git_diff.patch" || true
git ls-files --others --exclude-standard > "${BASELINE_DIR}/git_untracked_files.txt"
git ls-files > "${BASELINE_DIR}/git_tracked_files.txt"
git branch --show-current > "${BASELINE_DIR}/git_branch.txt"
printf "%s\n" "${HEAD_COMMIT}" > "${BASELINE_DIR}/git_head_commit.txt"

echo "==> Building source manifest"
TRACKED_Z="${BASELINE_DIR}/tracked_files.zlist"
UNTRACKED_Z="${BASELINE_DIR}/untracked_files.zlist"
MANIFEST_TXT="${BASELINE_DIR}/source_manifest_sha256.txt"

git ls-files -z > "${TRACKED_Z}"
git ls-files --others --exclude-standard -z > "${UNTRACKED_Z}"

python3 - <<'PY' "${TRACKED_Z}" "${UNTRACKED_Z}" "${MANIFEST_TXT}"
import hashlib
import os
import sys

tracked_z, untracked_z, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

def read_zlist(path):
    if not os.path.exists(path):
        return []
    data = open(path, "rb").read()
    if not data:
        return []
    return [p.decode("utf-8") for p in data.split(b"\x00") if p]

paths = []
seen = set()
for item in read_zlist(tracked_z) + read_zlist(untracked_z):
    if item in seen:
        continue
    if not os.path.isfile(item):
        continue
    seen.add(item)
    paths.append(item)

with open(out_path, "w", encoding="utf-8") as f:
    f.write("# schemaVersion: 1.0.0\n")
    f.write("# artifactType: source_manifest_sha256\n")
    for rel_path in sorted(paths):
        h = hashlib.sha256()
        with open(rel_path, "rb") as rf:
            for chunk in iter(lambda: rf.read(1024 * 1024), b""):
                h.update(chunk)
        f.write(f"{h.hexdigest()}  {rel_path}\n")
PY

echo "==> Building candidate research script inventory"
{
  echo "# Candidate research era scripts inventory"
  echo "# Generated: ${UTC_ISO}"
  echo
  if [[ -d "scripts" ]]; then
    find scripts -maxdepth 1 -type f \
      \( -iname "*phase4*" -o -iname "*phase5*" -o -iname "*quantum*" -o -iname "*qiskit*" \) \
      | sort
  else
    echo "No top level scripts directory found."
  fi
} > "${BASELINE_DIR}/candidate_research_script_inventory.txt"

echo "==> Writing baseline freeze note"
BASELINE_NOTE="${DOCS_DIR}/BASELINE_FREEZE_NOTE_v1.md"
backup_if_exists "${BASELINE_NOTE}"
cat > "${BASELINE_NOTE}" <<EOF
# OpenPRA Quantum Integration Baseline Freeze Note v1

## Purpose

This document records the initial baseline freeze for the OpenPRA quantum integration project. The purpose of this freeze is to establish an auditable starting point before additional integration work proceeds.

## Freeze metadata

- schemaVersion: ${SCHEMA_VERSION}
- documentVersion: 1
- createdAtUtc: ${UTC_ISO}
- createdBy: openpra_quantum_baseline_freeze_v1.sh ${SCRIPT_VERSION}
- repositoryRoot: ${REPO_ROOT}
- integrationBranch: ${CURRENT_BRANCH}
- headCommit: ${HEAD_COMMIT}
- shortHeadCommit: ${SHORT_HEAD}
- baselineArtifactDirectory: ${BASELINE_DIR}
- proposedBaselineTagAfterCommit: openpra_quantum_integration_baseline_v1_${UTC_NOW}

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

- status short: ${BASELINE_DIR}/git_status_short.txt
- status full: ${BASELINE_DIR}/git_status_full.txt
- diff stat: ${BASELINE_DIR}/git_diff_stat.txt
- full diff: ${BASELINE_DIR}/git_diff.patch
- tracked files: ${BASELINE_DIR}/git_tracked_files.txt
- untracked files: ${BASELINE_DIR}/git_untracked_files.txt
- source manifest: ${BASELINE_DIR}/source_manifest_sha256.txt
- candidate research script inventory: ${BASELINE_DIR}/candidate_research_script_inventory.txt

## Working rule

From this baseline forward, filesystem artifacts remain authoritative, database records are derived convenience views, and new artifacts must be versioned rather than overwritten.
EOF

echo "==> Writing artifact and API contract"
CONTRACT_DOC="${DOCS_DIR}/QUANTUM_ARTIFACT_AND_API_CONTRACT_v1.md"
backup_if_exists "${CONTRACT_DOC}"
cat > "${CONTRACT_DOC}" <<EOF
# OpenPRA Quantum Artifact and API Contract v1

## Purpose

This document defines the first pass artifact model and service contract for the OpenPRA quantum integration project. It is intended to reduce drift before additional implementation work proceeds.

## Contract metadata

- schemaVersion: ${SCHEMA_VERSION}
- documentVersion: 1
- createdAtUtc: ${UTC_ISO}
- createdBy: openpra_quantum_baseline_freeze_v1.sh ${SCRIPT_VERSION}

## Core design rule

OpenPRA quantum integration must support optional execution through:

- simulator
- emulator
- real_hardware

All execution providers must normalize into the same execution artifact shape so the rest of the platform can consume them consistently.

## Canonical workflow chain

PRA model  
-> subtree  
-> readiness artifact  
-> preparation artifact  
-> execution artifact  
-> recovery artifact  
-> importance artifact  
-> provenance manifest

## Required common fields for every artifact

Every quantum artifact must include at minimum:

- schemaVersion
- artifactType
- artifactId
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

## Artifact definitions

### 1. readiness artifact

Purpose: report whether a subtree is quantum tractable and why.

Required fields:
- schemaVersion
- artifactType = readiness
- artifactId
- subtreeId
- rootGateId
- topologyClass
- basicEventCount
- requiredQubits
- backendEligibility
- readinessDecision
- readinessReason
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

### 2. preparation artifact

Purpose: hold the quantum preparation output for a subtree.

Required fields:
- schemaVersion
- artifactType = preparation
- artifactId
- subtreeId
- rootGateId
- topologyClass
- clQuboEncoding
- variableMap
- qaoaRecipe
- backendEligibility
- statevectorVerificationResult
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

### 3. execution artifact

Purpose: normalize all provider outputs into one execution record.

Required fields:
- schemaVersion
- artifactType = execution
- artifactId
- subtreeId
- sourcePreparationArtifactId
- providerType
- providerName
- backendName
- executionMode
- jobIdOrRunId
- status
- shots
- submittedAtUtc
- completedAtUtc
- rawCounts
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

Allowed providerType values:
- simulator
- emulator
- real_hardware

### 4. recovery artifact

Purpose: hold MCS recovery results from quantum execution data.

Required fields:
- schemaVersion
- artifactType = recovery
- artifactId
- subtreeId
- sourceExecutionArtifactId
- classicalReferenceMcs
- tier1Result
- tier2Result
- tier3Result
- tier4NearMissAdvisory
- primaryMode
- requiresOperatorAttention
- semanticParityResult
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

### 5. importance artifact

Purpose: compare quantum derived PRA measures against classical baselines.

Required fields:
- schemaVersion
- artifactType = importance
- artifactId
- subtreeId
- sourceRecoveryArtifactId
- topologyClass
- recoveryMode
- requiresOperatorAttention
- quantumMeasures
- classicalMeasures
- agreementStatistics
- boundednessStatement
- createdAtUtc
- createdBy
- inputReferences
- sourceHashes
- notes

### 6. provenance manifest

Purpose: record the traceability chain for each workflow instance.

Required fields:
- schemaVersion
- artifactType = provenance_manifest
- artifactId
- workflowInstanceId
- relatedArtifactIds
- scriptOrPackageVersions
- timestamps
- sourceHashes
- acceptanceGateResults
- notes

## Persistence rules

1. Filesystem JSON artifacts are authoritative.
2. Database records are derived convenience views for API and UI use.
3. Database records must reference their authoritative filesystem artifact.
4. Artifacts must be versioned, not overwritten in place.

## Versioning rules

1. New outputs create a new artifactId and new timestamped artifact file.
2. Existing authoritative artifacts are not overwritten.
3. Any breaking schema change must increment schemaVersion.
4. Any endpoint that writes artifacts must also write a provenance manifest.

## First pass service contract

### readiness
- POST /api/quantum/readiness/:subtreeId
- GET /api/quantum/readiness/:subtreeId

### preparation
- POST /api/quantum/prepare/:subtreeId
- GET /api/quantum/preparation/:subtreeId
- POST /api/quantum/verify/:subtreeId

### execution
- POST /api/quantum/execute/:subtreeId
- GET /api/quantum/execution/:jobId

### recovery
- POST /api/quantum/recovery/single
- POST /api/quantum/recovery/batch
- GET /api/quantum/recovery/result/:caseId

### importance
- POST /api/quantum/importance/:subtreeId
- GET /api/quantum/importance/:subtreeId

### artifacts
- GET /api/quantum/artifact/:artifactId
- GET /api/quantum/provenance/:workflowInstanceId

## Product rule

The OpenPRA quantum path must allow a practitioner to:

1. identify a quantum tractable subtree
2. prepare the subtree for quantum execution
3. choose simulator, emulator, or real hardware
4. execute through the selected provider
5. recover MCS in platform
6. compare against the classical baseline
7. inspect provenance
8. export an artifact bundle

## Boundary rule

Nothing in this contract creates a claim of quantum advantage, production readiness, or regulatory grade equivalence. Any such claim would require separate evidence and separate validation.
EOF

echo "==> Writing run summary"
SUMMARY_FILE="${BASELINE_DIR}/baseline_freeze_summary.txt"
cat > "${SUMMARY_FILE}" <<EOF
Baseline freeze completed.

Repository root: ${REPO_ROOT}
Branch: ${CURRENT_BRANCH}
Head commit: ${HEAD_COMMIT}
Baseline directory: ${BASELINE_DIR}

Primary outputs:
- ${BASELINE_NOTE}
- ${CONTRACT_DOC}
- ${MANIFEST_TXT}
- ${BASELINE_DIR}/candidate_research_script_inventory.txt
EOF

echo
echo "DONE"
echo "Repository root: ${REPO_ROOT}"
echo "Branch: ${CURRENT_BRANCH}"
echo "Head commit: ${HEAD_COMMIT}"
echo "Baseline directory: ${BASELINE_DIR}"
echo "Baseline note: ${BASELINE_NOTE}"
echo "Contract doc: ${CONTRACT_DOC}"
echo "Source manifest: ${MANIFEST_TXT}"
echo "Research script inventory: ${BASELINE_DIR}/candidate_research_script_inventory.txt"
echo
echo "This script does not move scripts or edit source code. It creates the baseline control layer so we can make the next pass cleanly."
