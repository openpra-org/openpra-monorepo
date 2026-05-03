#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${REPO_ROOT}/_work/openpra_phase4_current_core_sources_v1/$(date -u +%Y%m%d_%H%M%SZ)"
OUT_FILE="${RUN_DIR}/OPENPRA_PHASE4_CURRENT_CORE_SOURCES_v1.txt"

mkdir -p "${RUN_DIR}"

{
  echo "OPENPRA PHASE 4 CURRENT CORE SOURCES v1"
  echo "Generated UTC: $(date -u +%Y%m%d_%H%M%SZ)"
  echo "Repo Root: ${REPO_ROOT}"
  echo ""

  for rel in \
    "packages/quantum-readiness/src/lib/types.ts" \
    "packages/quantum-readiness/src/lib/quantum-preparation.ts" \
    "packages/quantum-readiness/src/lib/quantum-preparation.spec.ts"
  do
    abs="${REPO_ROOT}/${rel}"
    echo "===== BEGIN FILE: ${rel} ====="
    cat "${abs}"
    echo ""
    echo "===== END FILE: ${rel} ====="
    echo ""
  done
} > "${OUT_FILE}"

sha256sum "${OUT_FILE}" > "${RUN_DIR}/SHA256SUMS.txt"

echo "RUN_DIR=${RUN_DIR}"
echo "OUT_FILE=${OUT_FILE}"
echo "SHA256=${RUN_DIR}/SHA256SUMS.txt"
echo ""
echo "===== FILE START ====="
sed -n '1,40p' "${OUT_FILE}"
echo ""
echo "===== QUANTUM PREPARATION START ====="
awk '/^===== BEGIN FILE: packages\/quantum-readiness\/src\/lib\/quantum-preparation\.ts =====$/,/^===== END FILE: packages\/quantum-readiness\/src\/lib\/quantum-preparation\.ts =====$/' "${OUT_FILE}"
echo ""
echo "===== SPEC START ====="
awk '/^===== BEGIN FILE: packages\/quantum-readiness\/src\/lib\/quantum-preparation\.spec\.ts =====$/,/^===== END FILE: packages\/quantum-readiness\/src\/lib\/quantum-preparation\.spec\.ts =====$/' "${OUT_FILE}"
