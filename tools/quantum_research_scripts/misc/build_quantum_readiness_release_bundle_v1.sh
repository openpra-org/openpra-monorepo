#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
RELEASE_ROOT="${REPO_ROOT}/RELEASES"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BUNDLE_NAME="OPENPRA_QUANTUM_READINESS_CONTRIBUTION_v1_${STAMP}"
STAGE_DIR="${RELEASE_ROOT}/${BUNDLE_NAME}"
TAR_PATH="${RELEASE_ROOT}/${BUNDLE_NAME}.tar.gz"
SHA_PATH="${RELEASE_ROOT}/${BUNDLE_NAME}.sha256.txt"

mkdir -p "${RELEASE_ROOT}"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"

mkdir -p "${STAGE_DIR}/code/package_quantum_readiness"
mkdir -p "${STAGE_DIR}/code/web_backend_quantum_readiness"
mkdir -p "${STAGE_DIR}/docs/authorship"
mkdir -p "${STAGE_DIR}/docs/project_notes"
mkdir -p "${STAGE_DIR}/evidence"
mkdir -p "${STAGE_DIR}/manifests"

copy_if_exists() {
  local src="$1"
  local dst="$2"
  if [ -e "${src}" ]; then
    cp -a "${src}" "${dst}"
  fi
}

copy_if_exists "${REPO_ROOT}/packages/quantum-readiness" "${STAGE_DIR}/code/package_quantum_readiness/"
copy_if_exists "${REPO_ROOT}/packages/web-backend/src/quantumReadiness" "${STAGE_DIR}/code/web_backend_quantum_readiness/"
copy_if_exists "${REPO_ROOT}/packages/web-backend/tests/quantumReadiness.http.spec.ts" "${STAGE_DIR}/code/web_backend_quantum_readiness/"
copy_if_exists "${REPO_ROOT}/packages/web-backend/src/api.module.ts" "${STAGE_DIR}/code/web_backend_quantum_readiness/"
copy_if_exists "${REPO_ROOT}/packages/web-backend/package.json" "${STAGE_DIR}/code/web_backend_quantum_readiness/"

copy_if_exists "${REPO_ROOT}/AUTHORS_AND_ATTRIBUTION_v1.md" "${STAGE_DIR}/docs/authorship/"
copy_if_exists "${REPO_ROOT}/HUMAN_AUTHORSHIP_AND_AI_USE_STATEMENT_v1.md" "${STAGE_DIR}/docs/authorship/"
copy_if_exists "${REPO_ROOT}/PROVENANCE_LOG_v1.md" "${STAGE_DIR}/docs/authorship/"
copy_if_exists "${REPO_ROOT}/COPYRIGHT_AND_DISCLOSURE_WORKFLOW_v1.md" "${STAGE_DIR}/docs/authorship/"
copy_if_exists "${REPO_ROOT}/OPENPRA_QUANTUM_READINESS_CONTRIBUTION_NOTE_v1.md" "${STAGE_DIR}/docs/project_notes/"

LATEST_AUTHORSHIP_MANIFEST="$(find "${REPO_ROOT}/AUTHORSHIP_MANIFESTS" -maxdepth 1 -type f -name 'quantum_readiness_authorship_manifest_*.txt' 2>/dev/null | sort | tail -n 1 || true)"
if [ -n "${LATEST_AUTHORSHIP_MANIFEST}" ]; then
  cp -a "${LATEST_AUTHORSHIP_MANIFEST}" "${STAGE_DIR}/manifests/"
fi

if [ -d "${REPO_ROOT}/packages/quantum-readiness/tmp" ]; then
  cp -a "${REPO_ROOT}/packages/quantum-readiness/tmp" "${STAGE_DIR}/evidence/"
fi

cat > "${STAGE_DIR}/README_BUNDLE_v1.md" <<EOF
# OpenPRA Quantum Readiness Contribution Bundle v1

## Purpose

This bundle captures the current milestone implementation of the OpenPRA Quantum Readiness contribution.

## Included content

### Code
1. quantum-readiness package
2. web-backend quantumReadiness feature slice
3. associated HTTP test
4. api.module.ts registration point
5. web-backend package.json

### Authorship and provenance
1. AUTHORS_AND_ATTRIBUTION_v1.md
2. HUMAN_AUTHORSHIP_AND_AI_USE_STATEMENT_v1.md
3. PROVENANCE_LOG_v1.md
4. COPYRIGHT_AND_DISCLOSURE_WORKFLOW_v1.md

### Evidence
1. smoke runner outputs under the package tmp directory
2. latest authorship manifest if available

## Freeze timestamp

${STAMP}
EOF

{
  echo "OpenPRA Quantum Readiness Contribution Bundle Inventory"
  echo "UTC Timestamp: ${STAMP}"
  echo
  find "${STAGE_DIR}" -type f | sort | sed "s#${STAGE_DIR}/##"
} > "${STAGE_DIR}/FILE_INVENTORY_v1.txt"

{
  echo "OpenPRA Quantum Readiness Contribution Bundle SHA256"
  echo "UTC Timestamp: ${STAMP}"
  echo
  cd "${STAGE_DIR}"
  find . -type f | sort | while read -r file; do
    sha256sum "${file}"
  done
} > "${STAGE_DIR}/SHA256_MANIFEST_v1.txt"

tar -C "${RELEASE_ROOT}" -czf "${TAR_PATH}" "${BUNDLE_NAME}"
sha256sum "${TAR_PATH}" > "${SHA_PATH}"

echo "Created stage directory:"
echo "${STAGE_DIR}"
echo
echo "Created tarball:"
echo "${TAR_PATH}"
echo
echo "Created tarball sha256:"
echo "${SHA_PATH}"
