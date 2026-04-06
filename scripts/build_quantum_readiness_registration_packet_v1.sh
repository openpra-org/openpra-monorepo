#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
PACKET_ROOT="${REPO_ROOT}/REGISTRATION_PACKETS"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
PACKET_NAME="OPENPRA_QUANTUM_READINESS_REGISTRATION_PACKET_v1_${STAMP}"
STAGE_DIR="${PACKET_ROOT}/${PACKET_NAME}"
TAR_PATH="${PACKET_ROOT}/${PACKET_NAME}.tar.gz"
SHA_PATH="${PACKET_ROOT}/${PACKET_NAME}.sha256.txt"

mkdir -p "${PACKET_ROOT}"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"

mkdir -p "${STAGE_DIR}/authorship"
mkdir -p "${STAGE_DIR}/release_bundle"
mkdir -p "${STAGE_DIR}/manifests"
mkdir -p "${STAGE_DIR}/notes"

copy_if_exists() {
  local src="$1"
  local dst="$2"
  if [ -e "${src}" ]; then
    cp -a "${src}" "${dst}"
  fi
}

copy_if_exists "${REPO_ROOT}/AUTHORS_AND_ATTRIBUTION_v1.md" "${STAGE_DIR}/authorship/"
copy_if_exists "${REPO_ROOT}/HUMAN_AUTHORSHIP_AND_AI_USE_STATEMENT_v1.md" "${STAGE_DIR}/authorship/"
copy_if_exists "${REPO_ROOT}/PROVENANCE_LOG_v1.md" "${STAGE_DIR}/authorship/"
copy_if_exists "${REPO_ROOT}/COPYRIGHT_AND_DISCLOSURE_WORKFLOW_v1.md" "${STAGE_DIR}/authorship/"
copy_if_exists "${REPO_ROOT}/FINAL_CONTRIBUTION_INVENTORY_v1.md" "${STAGE_DIR}/authorship/"
copy_if_exists "${REPO_ROOT}/COPYRIGHT_REGISTRATION_PACKET_CHECKLIST_v1.md" "${STAGE_DIR}/authorship/"
copy_if_exists "${REPO_ROOT}/OPENPRA_QUANTUM_READINESS_CONTRIBUTION_NOTE_v1.md" "${STAGE_DIR}/notes/"

LATEST_RELEASE_DIR="$(find "${REPO_ROOT}/RELEASES" -maxdepth 1 -mindepth 1 -type d -name 'OPENPRA_QUANTUM_READINESS_CONTRIBUTION_v1_*' | sort | tail -n 1 || true)"
LATEST_RELEASE_TAR="$(find "${REPO_ROOT}/RELEASES" -maxdepth 1 -type f -name 'OPENPRA_QUANTUM_READINESS_CONTRIBUTION_v1_*.tar.gz' | sort | tail -n 1 || true)"
LATEST_RELEASE_SHA="$(find "${REPO_ROOT}/RELEASES" -maxdepth 1 -type f -name 'OPENPRA_QUANTUM_READINESS_CONTRIBUTION_v1_*.sha256.txt' | sort | tail -n 1 || true)"
LATEST_AUTHORSHIP_MANIFEST="$(find "${REPO_ROOT}/AUTHORSHIP_MANIFESTS" -maxdepth 1 -type f -name 'quantum_readiness_authorship_manifest_*.txt' | sort | tail -n 1 || true)"

if [ -n "${LATEST_RELEASE_DIR}" ]; then
  cp -a "${LATEST_RELEASE_DIR}" "${STAGE_DIR}/release_bundle/"
fi

if [ -n "${LATEST_RELEASE_TAR}" ]; then
  cp -a "${LATEST_RELEASE_TAR}" "${STAGE_DIR}/release_bundle/"
fi

if [ -n "${LATEST_RELEASE_SHA}" ]; then
  cp -a "${LATEST_RELEASE_SHA}" "${STAGE_DIR}/release_bundle/"
fi

if [ -n "${LATEST_AUTHORSHIP_MANIFEST}" ]; then
  cp -a "${LATEST_AUTHORSHIP_MANIFEST}" "${STAGE_DIR}/manifests/"
fi

cat > "${STAGE_DIR}/README_REGISTRATION_PACKET_v1.md" <<EOF
# OpenPRA Quantum Readiness Registration Packet v1

## Purpose

This packet is intended to support copyright registration preparation and authorship documentation for the OpenPRA Quantum Readiness contribution.

## Included sections

### authorship
Contains the authorship, provenance, inventory, and registration workflow documents.

### release_bundle
Contains the most recent frozen release stage directory and related tarball files if present.

### manifests
Contains the most recent authorship SHA256 manifest if present.

### notes
Contains the contribution note.

## Freeze timestamp

${STAMP}
EOF

{
  echo "OpenPRA Quantum Readiness Registration Packet Inventory"
  echo "UTC Timestamp: ${STAMP}"
  echo
  find "${STAGE_DIR}" -type f | sort | sed "s#${STAGE_DIR}/##"
} > "${STAGE_DIR}/FILE_INVENTORY_v1.txt"

{
  echo "OpenPRA Quantum Readiness Registration Packet SHA256"
  echo "UTC Timestamp: ${STAMP}"
  echo
  cd "${STAGE_DIR}"
  find . -type f | sort | while read -r file; do
    sha256sum "${file}"
  done
} > "${STAGE_DIR}/SHA256_MANIFEST_v1.txt"

tar -C "${PACKET_ROOT}" -czf "${TAR_PATH}" "${PACKET_NAME}"
sha256sum "${TAR_PATH}" > "${SHA_PATH}"

echo "Created stage directory:"
echo "${STAGE_DIR}"
echo
echo "Created tarball:"
echo "${TAR_PATH}"
echo
echo "Created tarball sha256:"
echo "${SHA_PATH}"
