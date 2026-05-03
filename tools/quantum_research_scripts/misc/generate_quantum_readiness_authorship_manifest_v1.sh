#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_DIR="${REPO_ROOT}/AUTHORSHIP_MANIFESTS"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUT_FILE="${OUT_DIR}/quantum_readiness_authorship_manifest_${STAMP}.txt"

mkdir -p "${OUT_DIR}"

cd "${REPO_ROOT}"

{
  echo "OpenPRA Quantum Readiness Authorship Manifest"
  echo "UTC Timestamp: ${STAMP}"
  echo
  echo "[Top level authorship files]"
  sha256sum \
    AUTHORS_AND_ATTRIBUTION_v1.md \
    HUMAN_AUTHORSHIP_AND_AI_USE_STATEMENT_v1.md \
    PROVENANCE_LOG_v1.md \
    COPYRIGHT_AND_DISCLOSURE_WORKFLOW_v1.md
  echo
  echo "[quantum-readiness package files]"
  find packages/quantum-readiness -type f | sort | while read -r file; do
    sha256sum "${file}"
  done
  echo
  echo "[web-backend quantumReadiness files]"
  find packages/web-backend/src/quantumReadiness -type f | sort | while read -r file; do
    sha256sum "${file}"
  done
  echo
  echo "[web-backend quantum readiness tests]"
  find packages/web-backend/tests -type f | grep "quantumReadiness" | sort | while read -r file; do
    sha256sum "${file}"
  done
} > "${OUT_FILE}"

echo "Wrote ${OUT_FILE}"
