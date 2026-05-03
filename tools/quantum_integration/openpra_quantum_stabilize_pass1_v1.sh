#!/usr/bin/env bash
set -euo pipefail

SCRIPT_VERSION="1.0.0"
UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"
UTC_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: This script must be run inside the OpenPRA git repository."
  exit 1
fi

cd "${REPO_ROOT}"

REPORT_DIR="artifacts/quantum_integration/stabilize_pass1_${UTC_NOW}"
README_PATH="tools/quantum_research_scripts/README.md"
ROLLUP_PATH="packages/quantum-readiness/src/lib/openpra-quantum-recovery-rollup.ts"

mkdir -p "${REPORT_DIR}" "tools/quantum_research_scripts"

backup_if_exists() {
  local target="$1"
  if [[ -f "${target}" ]]; then
    cp -p "${target}" "${target}.bak.${UTC_NOW}"
  fi
}

echo "==> Writing research scripts README"
backup_if_exists "${README_PATH}"
cat > "${README_PATH}" <<EOF
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
EOF

echo "==> Repairing openpra-quantum-recovery-rollup.ts compile blocker"
backup_if_exists "${ROLLUP_PATH}"
cat > "${ROLLUP_PATH}" <<'EOF'
import type { QuantumRecoveryLadderResult } from "./quantum-recovery";

export interface OpenpraQuantumRecoveryBatchRollupCaseInput {
  label: string;
  result: QuantumRecoveryLadderResult;
  candidateDir?: string;
  resultPath?: string;
  resultSha256?: string;
}

export interface OpenpraQuantumRecoveryBatchRollupCase {
  label: string;
  modelId: string;
  candidateRootNodeId: string;
  topologyClass: string | null;
  basicEventCount: number | null;
  requiredQubits: number | null;
  primaryMode: string;
  requiresOperatorAttention: boolean;
  referenceCutSetCount: number;
  tier1RecoveredExactCutSetCount: number;
  unionRecoveredCount: number;
  unionAllRecovered: boolean;
  candidateDir?: string;
  resultPath?: string;
  resultSha256?: string;
}

export interface OpenpraQuantumRecoveryBatchRollup {
  generatedAt: string;
  scriptVersion: string;
  batchRoot: string;
  caseCount: number;
  exactHardwareRecoveryCaseCount: number;
  unionSensitivityRecoveryCaseCount: number;
  operatorAttentionRequiredCaseCount: number;
  cases: OpenpraQuantumRecoveryBatchRollupCase[];
}

const MODULE_VERSION = "openpra-quantum-recovery-rollup-v1";

function normalizeNullableNumber(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeNullableString(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function buildOpenpraQuantumRecoveryBatchRollup(
  batchRoot: string,
  caseInputs: OpenpraQuantumRecoveryBatchRollupCaseInput[]
): OpenpraQuantumRecoveryBatchRollup {
  const orderedCases = [...caseInputs]
    .sort((left, right) => left.label.localeCompare(right.label))
    .map<OpenpraQuantumRecoveryBatchRollupCase>((entry) => ({
      label: entry.label,
      modelId: entry.result.modelId,
      candidateRootNodeId: entry.result.candidateRootNodeId,
      topologyClass: normalizeNullableString(entry.result.topologyClass),
      basicEventCount: normalizeNullableNumber(entry.result.basicEventCount),
      requiredQubits: normalizeNullableNumber(entry.result.requiredQubits),
      primaryMode: entry.result.integrationRecommendation.primaryMode,
      requiresOperatorAttention:
        entry.result.integrationRecommendation.requiresOperatorAttention,
      referenceCutSetCount: entry.result.referenceCutSetCount,
      tier1RecoveredExactCutSetCount:
        entry.result.recoveryTier1ExactHardware.recoveredExactCutSetCount,
      unionRecoveredCount:
        entry.result.recoveryTier3UnionSensitivity.unionRecoveredCount,
      unionAllRecovered:
        entry.result.recoveryTier3UnionSensitivity.allRecoveredInUnion,
      ...(entry.candidateDir ? { candidateDir: entry.candidateDir } : {}),
      ...(entry.resultPath ? { resultPath: entry.resultPath } : {}),
      ...(entry.resultSha256 ? { resultSha256: entry.resultSha256 } : {})
    }));

  return {
    generatedAt: new Date().toISOString(),
    scriptVersion: MODULE_VERSION,
    batchRoot,
    caseCount: orderedCases.length,
    exactHardwareRecoveryCaseCount: orderedCases.filter(
      (row) => row.primaryMode === "exact_hardware_recovery"
    ).length,
    unionSensitivityRecoveryCaseCount: orderedCases.filter(
      (row) => row.primaryMode === "union_sensitivity_recovery"
    ).length,
    operatorAttentionRequiredCaseCount: orderedCases.filter(
      (row) => row.requiresOperatorAttention
    ).length,
    cases: orderedCases
  };
}
EOF

echo "==> Running quantum-readiness tests"
if nx test quantum-readiness > "${REPORT_DIR}/nx_test_quantum_readiness.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_test_quantum_readiness.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_test_quantum_readiness.status"
fi

echo "==> Running web-backend tests"
if nx test web-backend > "${REPORT_DIR}/nx_test_web_backend.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_test_web_backend.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_test_web_backend.status"
fi

echo "==> Running quantum-readiness build"
if nx build quantum-readiness > "${REPORT_DIR}/nx_build_quantum_readiness.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_build_quantum_readiness.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_build_quantum_readiness.status"
fi

echo "==> Capturing git status after stabilization pass 1"
git status --short > "${REPORT_DIR}/git_status_short_after_stabilize_pass1.txt"
git diff --stat > "${REPORT_DIR}/git_diff_stat_after_stabilize_pass1.txt" || true

echo "==> Writing summary"
cat > "${REPORT_DIR}/stabilize_pass1_summary.txt" <<EOF
OpenPRA quantum stabilization pass 1 completed.

scriptVersion: ${SCRIPT_VERSION}
createdAtUtc: ${UTC_ISO}
repositoryRoot: ${REPO_ROOT}

Actions:
- wrote tools/quantum_research_scripts/README.md
- repaired obvious compile blocker in openpra-quantum-recovery-rollup.ts
- ran nx test quantum-readiness
- ran nx test web-backend
- ran nx build quantum-readiness

Outputs:
- ${REPORT_DIR}/nx_test_quantum_readiness.status
- ${REPORT_DIR}/nx_test_quantum_readiness.log
- ${REPORT_DIR}/nx_test_web_backend.status
- ${REPORT_DIR}/nx_test_web_backend.log
- ${REPORT_DIR}/nx_build_quantum_readiness.status
- ${REPORT_DIR}/nx_build_quantum_readiness.log
- ${REPORT_DIR}/git_status_short_after_stabilize_pass1.txt
EOF

echo
echo "DONE"
echo "Report directory: ${REPORT_DIR}"
echo "Quantum-readiness test status: $(cat "${REPORT_DIR}/nx_test_quantum_readiness.status")"
echo "Web-backend test status: $(cat "${REPORT_DIR}/nx_test_web_backend.status")"
echo "Quantum-readiness build status: $(cat "${REPORT_DIR}/nx_build_quantum_readiness.status")"
