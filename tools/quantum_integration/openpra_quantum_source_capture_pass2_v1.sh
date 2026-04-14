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

REPORT_DIR="artifacts/quantum_integration/source_capture_pass2_${UTC_NOW}"
CAPTURE_ROOT="${REPORT_DIR}/captured_source_tree"
PHASE3_DIR="tools/quantum_research_scripts/phase3"
MISC_DIR="tools/quantum_research_scripts/misc"
BACKUP_QUAR_DIR="_work/repo_cleanup_backups_${UTC_NOW}"

mkdir -p "${REPORT_DIR}" "${CAPTURE_ROOT}" "${PHASE3_DIR}" "${MISC_DIR}" "${BACKUP_QUAR_DIR}"

move_if_present() {
  local src="$1"
  local dest_dir="$2"
  if [[ -e "${src}" ]]; then
    mkdir -p "${dest_dir}"
    mv "${src}" "${dest_dir}/"
    printf "%s\t%s\tmoved\n" "${src}" "${dest_dir}/$(basename "${src}")" >> "${REPORT_DIR}/remaining_script_relocation_map.tsv"
  else
    printf "%s\t%s\tmissing_source\n" "${src}" "" >> "${REPORT_DIR}/remaining_script_relocation_map.tsv"
  fi
}

copy_with_tree() {
  local rel="$1"
  local src="${REPO_ROOT}/${rel}"
  local dest="${CAPTURE_ROOT}/${rel}"
  if [[ -f "${src}" ]]; then
    mkdir -p "$(dirname "${dest}")"
    cp -p "${src}" "${dest}"
    printf "%s\n" "${rel}" >> "${REPORT_DIR}/captured_file_list.txt"
    return 0
  fi
  printf "%s\n" "${rel}" >> "${REPORT_DIR}/missing_expected_files.txt"
  return 1
}

echo "==> Relocating remaining obvious research support scripts"
: > "${REPORT_DIR}/remaining_script_relocation_map.tsv"
printf "source_path\tdestination_path\tstatus\n" >> "${REPORT_DIR}/remaining_script_relocation_map.tsv"

move_if_present "scripts/dump_openpra_backend_topology_seam_v1.sh" "${MISC_DIR}"
move_if_present "scripts/dump_openpra_bundle_builder_only_v1.sh" "${MISC_DIR}"
move_if_present "scripts/dump_openpra_export_script_only_v1.sh" "${MISC_DIR}"
move_if_present "scripts/dump_openpra_phase3_context_v1.sh" "${PHASE3_DIR}"
move_if_present "scripts/dump_openpra_phase3_core5_v1.sh" "${PHASE3_DIR}"
move_if_present "scripts/dump_openpra_phase3_spec3_v1.sh" "${PHASE3_DIR}"
move_if_present "scripts/freeze_openpra_phase3_validation_v1.py" "${PHASE3_DIR}"

echo "==> Quarantining temporary backup clutter if present"
: > "${REPORT_DIR}/backup_quarantine_map.tsv"
printf "source_path\tdestination_path\tstatus\n" >> "${REPORT_DIR}/backup_quarantine_map.tsv"

shopt -s nullglob
for f in .gitignore.bak.*; do
  mv "${f}" "${BACKUP_QUAR_DIR}/"
  printf "%s\t%s\tmoved\n" "${f}" "${BACKUP_QUAR_DIR}/$(basename "${f}")" >> "${REPORT_DIR}/backup_quarantine_map.tsv"
done
shopt -u nullglob

echo "==> Capturing exact current source surfaces"
: > "${REPORT_DIR}/captured_file_list.txt"
: > "${REPORT_DIR}/missing_expected_files.txt"

FILES_TO_CAPTURE=(
  "packages/quantum-readiness/package.json"
  "packages/quantum-readiness/src/lib/index.ts"
  "packages/quantum-readiness/src/lib/openpra-fault-tree-graph-adapter.ts"
  "packages/quantum-readiness/src/lib/openpra-fault-tree-readiness.spec.ts"
  "packages/quantum-readiness/src/lib/quantum-readiness.spec.ts"
  "packages/quantum-readiness/src/lib/quantum-readiness.ts"
  "packages/quantum-readiness/src/lib/types.ts"
  "packages/quantum-readiness/src/lib/openpra-quantum-recovery-artifacts.spec.ts"
  "packages/quantum-readiness/src/lib/openpra-quantum-recovery-artifacts.ts"
  "packages/quantum-readiness/src/lib/openpra-quantum-recovery-batch-artifacts.spec.ts"
  "packages/quantum-readiness/src/lib/openpra-quantum-recovery-batch-artifacts.ts"
  "packages/quantum-readiness/src/lib/openpra-quantum-recovery-filesystem.spec.ts"
  "packages/quantum-readiness/src/lib/openpra-quantum-recovery-filesystem.ts"
  "packages/quantum-readiness/src/lib/openpra-quantum-recovery-rollup.spec.ts"
  "packages/quantum-readiness/src/lib/openpra-quantum-recovery-rollup.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.spec.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.ts"
  "packages/quantum-readiness/src/lib/quantum-recovery.spec.ts"
  "packages/quantum-readiness/src/lib/quantum-recovery.ts"
  "packages/web-backend/src/graphModels/graphModel.service.ts"
  "packages/web-backend/src/graphModels/graphModel.controller.spec.ts"
  "packages/web-backend/src/graphModels/graphModel.service.spec.ts"
  "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.spec.ts"
  "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
  "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
  "packages/web-backend/src/quantumReadiness/openPraFaultTreeGraph.adapter.spec.ts"
  "packages/web-backend/src/quantumReadiness/openPraFaultTreeGraph.adapter.ts"
  "packages/web-backend/src/quantumReadiness/openPraFaultTreeGraph.fixtures.ts"
  "packages/web-backend/src/quantumReadiness/quantumReadiness.normalized.spec.ts"
  "packages/web-backend/tests/graphModels.faultTree.http.spec.ts"
  "packages/web-backend/tests/openPraReleaseArtifacts.http.spec.ts"
  "packages/web-backend/tests/quantumReadiness.http.spec.ts"
  "packages/web-backend/tests/quantumReadiness.preparation.http.spec.ts"
  "packages/web-backend/tests/quantumReadiness.topNodeFallback.http.spec.ts"
  "tsconfig.base.json"
)

for rel in "${FILES_TO_CAPTURE[@]}"; do
  copy_with_tree "${rel}" || true
done

echo "==> Building concatenated source bundle text"
BUNDLE_TXT="${REPORT_DIR}/openpra_quantum_source_capture_bundle_v1.txt"
{
  echo "# OpenPRA Quantum Source Capture Bundle v1"
  echo "# scriptVersion: ${SCRIPT_VERSION}"
  echo "# createdAtUtc: ${UTC_ISO}"
  echo "# repositoryRoot: ${REPO_ROOT}"
  echo
  while IFS= read -r rel; do
    [[ -z "${rel}" ]] && continue
    echo "===== BEGIN FILE: ${rel} ====="
    cat "${CAPTURE_ROOT}/${rel}"
    echo
    echo "===== END FILE: ${rel} ====="
    echo
  done < "${REPORT_DIR}/captured_file_list.txt"
} > "${BUNDLE_TXT}"

echo "==> Building bundle tar"
tar -czf "${REPORT_DIR}/captured_source_tree.tar.gz" -C "${CAPTURE_ROOT}" .

echo "==> Capturing status after pass 2"
git status --short > "${REPORT_DIR}/git_status_short_after_pass2.txt"
git diff --stat > "${REPORT_DIR}/git_diff_stat_after_pass2.txt" || true

echo "==> Writing summary"
cat > "${REPORT_DIR}/source_capture_pass2_summary.txt" <<EOF
OpenPRA quantum source capture pass 2 completed.

scriptVersion: ${SCRIPT_VERSION}
createdAtUtc: ${UTC_ISO}
repositoryRoot: ${REPO_ROOT}

Primary actions:
- relocated remaining obvious research support scripts
- quarantined temporary backup clutter
- captured exact current source surfaces for package and backend quantum integration work
- built concatenated text bundle and tar bundle

Outputs:
- remaining script relocation map: ${REPORT_DIR}/remaining_script_relocation_map.tsv
- backup quarantine map: ${REPORT_DIR}/backup_quarantine_map.tsv
- captured file list: ${REPORT_DIR}/captured_file_list.txt
- missing expected files: ${REPORT_DIR}/missing_expected_files.txt
- concatenated bundle: ${BUNDLE_TXT}
- source tree tar: ${REPORT_DIR}/captured_source_tree.tar.gz
- status short: ${REPORT_DIR}/git_status_short_after_pass2.txt
EOF

echo
echo "DONE"
echo "Report directory: ${REPORT_DIR}"
echo "Concatenated source bundle: ${BUNDLE_TXT}"
echo "Source tree tar: ${REPORT_DIR}/captured_source_tree.tar.gz"
echo "Status short: ${REPORT_DIR}/git_status_short_after_pass2.txt"
echo
echo "Next: upload the concatenated source bundle text file into this chat so I can produce exact full file rewrites without guessing."
