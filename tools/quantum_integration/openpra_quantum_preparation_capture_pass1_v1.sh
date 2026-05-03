#!/usr/bin/env bash
set -euo pipefail

UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"
UTC_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: run inside repo"
  exit 1
fi

cd "${REPO_ROOT}"

OUTDIR="artifacts/quantum_integration/preparation_capture_pass1_${UTC_NOW}"
mkdir -p "${OUTDIR}"

FILES=(
  "docs/quantum_integration/QUANTUM_ARTIFACT_AND_API_CONTRACT_v1.md"
  "packages/quantum-readiness/src/lib/types.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.spec.ts"
  "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
  "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
  "packages/web-backend/tests/quantumReadiness.preparation.http.spec.ts"
)

BUNDLE="${OUTDIR}/openpra_quantum_preparation_capture_bundle_v1.txt"

{
  echo "# OpenPRA Quantum Preparation Capture Bundle v1"
  echo "# createdAtUtc: ${UTC_ISO}"
  echo "# repoRoot: ${REPO_ROOT}"
  echo
  for rel in "${FILES[@]}"; do
    echo "===== BEGIN FILE: ${rel} ====="
    cat "${rel}"
    echo
    echo "===== END FILE: ${rel} ====="
    echo
  done
} > "${BUNDLE}"

echo "DONE"
echo "${BUNDLE}"
