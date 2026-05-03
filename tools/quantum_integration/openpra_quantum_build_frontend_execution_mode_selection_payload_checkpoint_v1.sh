#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BASE_DIR="$REPO_ROOT/_work/openpra_quantum_frontend_execution_mode_selection_payload_checkpoint_v1"
OUT_DIR="$BASE_DIR/OPENPRA_QUANTUM_FRONTEND_EXECUTION_MODE_SELECTION_PAYLOAD_CHECKPOINT_v1_${STAMP}"

mkdir -p "$OUT_DIR"

copy_into_checkpoint() {
  local rel_path="$1"
  mkdir -p "$OUT_DIR/$(dirname "$rel_path")"
  cp "$REPO_ROOT/$rel_path" "$OUT_DIR/$rel_path"
}

copy_into_checkpoint "packages/quantum-readiness/src/lib/openpra-quantum-frontend-execution-mode-selection-payload.ts"
copy_into_checkpoint "packages/quantum-readiness/src/lib/openpra-quantum-frontend-execution-mode-selection-payload.spec.ts"
copy_into_checkpoint "packages/quantum-readiness/src/lib/index.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendExecutionModeSelectionPayload.service.spec.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendExecutionModeSelectionPayload.controller.spec.ts"
copy_into_checkpoint "packages/web-backend/tests/quantumReadiness.frontendExecutionModeSelectionPayload.http.spec.ts"
copy_into_checkpoint "tools/quantum_integration/apply_ws7_frontend_execution_mode_selection_payload_chunk_r_v1.py"
copy_into_checkpoint "tools/quantum_integration/openpra_quantum_build_frontend_execution_mode_selection_payload_checkpoint_v1.sh"

tar -czf "${OUT_DIR}.tar.gz" -C "$BASE_DIR" "$(basename "$OUT_DIR")"
sha256sum "${OUT_DIR}.tar.gz" > "${OUT_DIR}.tar.gz.sha256"

echo "$OUT_DIR"
echo "${OUT_DIR}.tar.gz"
echo "${OUT_DIR}.tar.gz.sha256"
