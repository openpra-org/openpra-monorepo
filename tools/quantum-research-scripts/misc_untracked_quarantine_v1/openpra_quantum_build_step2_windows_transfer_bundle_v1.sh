#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_step2_windows_transfer_bundle_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BUNDLE_NAME="OPENPRA_QUANTUM_STEP2_TRANSFER_BUNDLE_v1_${STAMP}"
RUN_DIR="$OUT_ROOT/$BUNDLE_NAME"
TAR_PATH="$OUT_ROOT/${BUNDLE_NAME}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p \
  "$RUN_DIR/repo/packages/quantum-readiness/src/lib" \
  "$RUN_DIR/repo/packages/web-backend/src/quantumReadiness" \
  "$RUN_DIR/repo/packages/web-backend/tests" \
  "$RUN_DIR/repo/tools/quantum_integration" \
  "$RUN_DIR/checkpoints" \
  "$RUN_DIR/reports" \
  "$RUN_DIR/meta"

cd "$REPO_ROOT"

echo "Building Step 2 transfer bundle at:"
echo "  $RUN_DIR"

#
# 1. Capture authoritative git state
#
git rev-parse HEAD > "$RUN_DIR/meta/HEAD_COMMIT.txt"
git rev-parse --abbrev-ref HEAD > "$RUN_DIR/meta/BRANCH.txt"
git status --short > "$RUN_DIR/meta/GIT_STATUS_SHORT.txt"
git log --oneline -n 60 > "$RUN_DIR/meta/GIT_LOG_ONELINE_60.txt"

#
# 2. Copy source files that represent the Step 2 integration work
#    Keep scope focused on the quantum integration work and frontend chain
#
cp -a packages/quantum-readiness/src/lib/*.ts \
  "$RUN_DIR/repo/packages/quantum-readiness/src/lib/" || true

cp -a packages/web-backend/src/quantumReadiness/*.ts \
  "$RUN_DIR/repo/packages/web-backend/src/quantumReadiness/" || true

cp -a packages/web-backend/tests/*.ts \
  "$RUN_DIR/repo/packages/web-backend/tests/" || true

cp -a tools/quantum_integration/* \
  "$RUN_DIR/repo/tools/quantum_integration/" || true

#
# 3. Copy the key checkpoint and report _work directories produced in this thread
#    Only copy directories that actually exist
#
copy_if_exists () {
  local SRC="$1"
  local DEST_PARENT="$2"
  if [ -e "$SRC" ]; then
    cp -a "$SRC" "$DEST_PARENT/"
  fi
}

copy_if_exists "_work/openpra_quantum_simulator_validation_checkpoint_v1" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_validation_checkpoint_memo_v1" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_real_case_expansion_v1" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_real_case_expansion_v2" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_real_cohort_inventory_memo_v1" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_bounded_validation_report_v1" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_bounded_validation_report_pkg_v1" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_bounded_completion_bundle_v1" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_bounded_completion_bundle_v2" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_real_b_search_v1" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_real_b_search_outside_work_v1" "$RUN_DIR/checkpoints"
copy_if_exists "_work/openpra_quantum_final_project_state_bundle_v1" "$RUN_DIR/checkpoints"

copy_if_exists "_work/openpra_quantum_ws5_ws6_bootstrap_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_ws5_ws6_acceptance_manifests_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_ws5_ws6_contract_examples_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_ws5_ws6_contract_outputs_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_ws5_ws6_service_stub_outputs_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_ws5_ws6_service_facade_outputs_v1" "$RUN_DIR/reports"

copy_if_exists "_work/openpra_quantum_ws6_provider_bridge_submission_checkpoint_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_ws6_provider_bridge_completion_checkpoint_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_ws5_canonical_bounded_report_checkpoint_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_ws6_canonical_execution_report_checkpoint_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_canonical_program_report_checkpoint_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_frontend_summary_checkpoint_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_frontend_workspace_snapshot_checkpoint_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_frontend_seed_state_checkpoint_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_frontend_bootstrap_packet_checkpoint_v1" "$RUN_DIR/reports"
copy_if_exists "_work/openpra_quantum_frontend_dashboard_payload_checkpoint_v1" "$RUN_DIR/reports"

#
# 4. Write a manifest and a short README
#
cat > "$RUN_DIR/README.txt" <<EOF
OpenPRA Quantum Step 2 Transfer Bundle v1

Generated UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Purpose
This bundle captures the current OpenPRA quantum integration Step 2 state for transfer to Windows.

Included
1. Repo source files for quantum-readiness, backend quantumReadiness, tests, and tools/quantum_integration
2. Key _work checkpoint and report directories created during the Step 2 integration effort
3. Git metadata including HEAD commit, branch, status, and recent log

Excluded on purpose
1. Unrelated Phase 5 helper noise
2. Large unrelated work products outside the current integration scope
3. Anything not present at bundle time

Authoritative repo root
$REPO_ROOT
EOF

{
  echo "BUNDLE_NAME=$BUNDLE_NAME"
  echo "GENERATED_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "REPO_ROOT=$REPO_ROOT"
  echo "HEAD_COMMIT=$(cat "$RUN_DIR/meta/HEAD_COMMIT.txt")"
  echo "BRANCH=$(cat "$RUN_DIR/meta/BRANCH.txt")"
  echo
  echo "[TOP_LEVEL_CONTENTS]"
  find "$RUN_DIR" -maxdepth 2 -mindepth 1 | sort
} > "$RUN_DIR/MANIFEST.txt"

#
# 5. Package and hash
#
mkdir -p "$OUT_ROOT"
tar -C "$OUT_ROOT" -czf "$TAR_PATH" "$BUNDLE_NAME"
sha256sum "$TAR_PATH" > "$SHA_PATH"

echo
echo "Bundle directory:"
echo "$RUN_DIR"
echo
echo "Tarball:"
echo "$TAR_PATH"
echo
echo "SHA256:"
echo "$SHA_PATH"
echo
ls -lh "$TAR_PATH" "$SHA_PATH"
