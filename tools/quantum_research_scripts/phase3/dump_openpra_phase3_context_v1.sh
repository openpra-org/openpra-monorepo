#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
WORK_ROOT="${REPO_ROOT}/_work/openpra_phase3_context_dump_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="${WORK_ROOT}/${STAMP}"
FILES_DIR="${RUN_DIR}/files"
COMBINED="${RUN_DIR}/OPENPRA_PHASE3_FULL_FILE_DUMP.txt"
MANIFEST="${RUN_DIR}/00_manifest.txt"
SHA_FILE="${RUN_DIR}/SHA256SUMS.txt"
TAR_PATH="${RUN_DIR}.tar.gz"

mkdir -p "${FILES_DIR}"

FILES=(
  "packages/quantum-readiness/src/lib/types.ts"
  "packages/quantum-readiness/src/lib/quantum-readiness.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.ts"
  "packages/quantum-readiness/src/lib/openpra-fault-tree-readiness.ts"
  "packages/quantum-readiness/src/lib/openpra-fault-tree-graph-adapter.ts"
  "packages/quantum-readiness/src/lib/openpra-fault-tree-graph-heuristics.ts"
  "packages/quantum-readiness/src/lib/quantum-readiness.spec.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.spec.ts"
  "packages/quantum-readiness/src/lib/openpra-fault-tree-readiness.spec.ts"
  "packages/quantum-readiness/src/lib/openpra-fault-tree-graph-adapter.spec.ts"
  "packages/quantum-readiness/src/lib/openpra-fault-tree-graph-heuristics.spec.ts"
  "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
  "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
  "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.spec.ts"
  "packages/web-backend/src/quantumReadiness/quantumReadiness.normalized.spec.ts"
  "packages/web-backend/tests/quantumReadiness.preparation.http.spec.ts"
  "packages/web-backend/tests/quantumReadiness.topNodeFallback.http.spec.ts"
  "packages/web-backend/tests/openPraReleaseArtifacts.http.spec.ts"
  "scripts/export_openpra_quantum_preparation_v1.py"
  "scripts/build_openpra_quantum_bundles_v1.py"
)

{
  echo "OPENPRA PHASE 3 CONTEXT DUMP"
  echo "generated_utc=${STAMP}"
  echo "repo_root=${REPO_ROOT}"
  echo "run_dir=${RUN_DIR}"
  echo "combined_dump=${COMBINED}"
  echo "tar_path=${TAR_PATH}"
  echo "file_count=${#FILES[@]}"
  echo ""
  echo "FILES"
  for f in "${FILES[@]}"; do
    echo "${f}"
  done
} > "${MANIFEST}"

{
  echo "OPENPRA PHASE 3 FULL FILE DUMP"
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

tar -czf "${TAR_PATH}" -C "${WORK_ROOT}" "${STAMP}"

echo ""
echo "RUN_DIR=${RUN_DIR}"
echo "COMBINED=${COMBINED}"
echo "MANIFEST=${MANIFEST}"
echo "SHA256=${SHA_FILE}"
echo "TAR=${TAR_PATH}"
echo ""
echo "Preview:"
ls -lh "${RUN_DIR}"
echo ""
echo "Combined file size:"
ls -lh "${COMBINED}"
