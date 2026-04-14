#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
WORK_ROOT="${REPO_ROOT}/_work/openpra_phase4_live_sources_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="${WORK_ROOT}/${STAMP}"
COMBINED="${RUN_DIR}/OPENPRA_PHASE4_LIVE_SOURCES_FULL_FILE_DUMP.txt"
SHA_FILE="${RUN_DIR}/SHA256SUMS.txt"

mkdir -p "${RUN_DIR}"

FILES=(
  "packages/quantum-readiness/src/lib/types.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.spec.ts"
  "scripts/export_openpra_phase4_clqubo_v1.js"
  "_work/openpra_phase3_freeze_v1/20260408_173301Z/OPENPRA_PHASE3_FREEZE_MEMO.md"
  "_work/openpra_phase4_clqubo_exports_v1/20260408_214257Z/90_phase4_summary.json"
  "_work/openpra_phase4_clqubo_exports_v1/20260408_214257Z/README.txt"
)

{
  echo "OPENPRA PHASE 4 LIVE SOURCES FULL FILE DUMP"
  echo "Generated UTC: ${STAMP}"
  echo "Repo Root: ${REPO_ROOT}"
  echo ""
} > "${COMBINED}"

for rel_path in "${FILES[@]}"; do
  src="${REPO_ROOT}/${rel_path}"

  {
    echo ""
    echo ""
    echo "===== BEGIN FILE: ${rel_path} ====="
  } >> "${COMBINED}"

  if [[ -f "${src}" ]]; then
    cat "${src}" >> "${COMBINED}"
  else
    echo "FILE NOT FOUND: ${rel_path}" >> "${COMBINED}"
  fi

  {
    echo ""
    echo "===== END FILE: ${rel_path} ====="
  } >> "${COMBINED}"
done

(
  cd "${RUN_DIR}"
  find . -type f ! -name "SHA256SUMS.txt" -print0 | sort -z | xargs -0 sha256sum > "${SHA_FILE}"
)

echo "RUN_DIR=${RUN_DIR}"
echo "COMBINED=${COMBINED}"
echo "SHA256=${SHA_FILE}"
echo ""
ls -lh "${RUN_DIR}"
