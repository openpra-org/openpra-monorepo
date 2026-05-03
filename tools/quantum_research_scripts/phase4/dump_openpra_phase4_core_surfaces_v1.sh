#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
WORK_ROOT="${REPO_ROOT}/_work/openpra_phase4_core_surfaces_dump_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="${WORK_ROOT}/${STAMP}"
FILES_DIR="${RUN_DIR}/files"
COMBINED="${RUN_DIR}/OPENPRA_PHASE4_CORE_SURFACES_FULL_FILE_DUMP.txt"
SHA_FILE="${RUN_DIR}/SHA256SUMS.txt"

mkdir -p "${FILES_DIR}"

FILES=(
  "packages/quantum-readiness/src/lib/types.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.spec.ts"
  "packages/quantum-readiness/src/index.ts"
  "packages/quantum-readiness/project.json"
  "packages/quantum-readiness/package.json"
)

{
  echo "OPENPRA PHASE 4 CORE SURFACES FULL FILE DUMP"
  echo "Generated UTC: ${STAMP}"
  echo "Repo Root: ${REPO_ROOT}"
  echo ""
} > "${COMBINED}"

for rel_path in "${FILES[@]}"; do
  src="${REPO_ROOT}/${rel_path}"
  dst="${FILES_DIR}/${rel_path}"
  mkdir -p "$(dirname "${dst}")"

  {
    echo ""
    echo ""
    echo "===== BEGIN FILE: ${rel_path} ====="
  } >> "${COMBINED}"

  if [[ -f "${src}" ]]; then
    cp "${src}" "${dst}"
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

echo ""
echo "RUN_DIR=${RUN_DIR}"
echo "COMBINED=${COMBINED}"
echo "SHA256=${SHA_FILE}"
echo ""
ls -lh "${RUN_DIR}"
