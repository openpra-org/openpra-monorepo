#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_final_project_state_bundle_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BUNDLE_NAME="OPENPRA_QUANTUM_FINAL_PROJECT_STATE_BUNDLE_v1_${STAMP}"
BUNDLE_DIR="$OUT_ROOT/$BUNDLE_NAME"
TAR_PATH="$OUT_ROOT/${BUNDLE_NAME}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$BUNDLE_DIR"/{memos,report,artifacts,workspaces}

copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [ -e "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -a "$src" "$dest"
  fi
}

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_b_search_v1/OPENPRA_QUANTUM_REAL_B_SEARCH_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_B_SEARCH_MEMO_v1.txt"
copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_b_search_v1/openpra_quantum_real_b_search_summary_v1.json" \
  "$BUNDLE_DIR/memos/openpra_quantum_real_b_search_summary_v1.json"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_b_search_outside_work_v1/OPENPRA_QUANTUM_REAL_B_SEARCH_OUTSIDE_WORK_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_B_SEARCH_OUTSIDE_WORK_MEMO_v1.txt"
copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_b_search_outside_work_v1/openpra_quantum_real_b_search_outside_work_summary_v1.json" \
  "$BUNDLE_DIR/memos/openpra_quantum_real_b_search_outside_work_summary_v1.json"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_d_representative_v1/OPENPRA_QUANTUM_REAL_D_REPRESENTATIVE_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_D_REPRESENTATIVE_MEMO_v1.txt"
copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_case_expansion_exhaust_ac_v1/OPENPRA_QUANTUM_REAL_CASE_EXPANSION_EXHAUST_AC_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_CASE_EXPANSION_EXHAUST_AC_MEMO_v1.txt"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_bounded_validation_report_v2/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v2.txt" \
  "$BUNDLE_DIR/report/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v2.txt"
copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_bounded_validation_report_v2/openpra_quantum_bounded_validation_report_summary_v2.json" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_report_summary_v2.json"
copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_bounded_validation_report_v2/openpra_quantum_bounded_validation_real_lane_v2.csv" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_real_lane_v2.csv"
copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_bounded_validation_report_v2/openpra_quantum_bounded_validation_synthetic_lane_v2.csv" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_synthetic_lane_v2.csv"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_simulator_validation_v1_real_with_d/_rollup/openpra_quantum_simulator_validation_rollup_v1.json" \
  "$BUNDLE_DIR/workspaces/openpra_quantum_simulator_validation_rollup_v1.json"

LATEST_CONCLUSION_TAR="$(ls -1 "$REPO_ROOT"/_work/openpra_quantum_current_lane_conclusion_bundle_v1/OPENPRA_QUANTUM_CURRENT_LANE_CONCLUSION_BUNDLE_v1_*.tar.gz 2>/dev/null | sort | tail -1 || true)"
LATEST_CONCLUSION_SHA="${LATEST_CONCLUSION_TAR}.sha256"

if [ -n "$LATEST_CONCLUSION_TAR" ]; then
  copy_if_exists "$LATEST_CONCLUSION_TAR" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_CONCLUSION_TAR")"
  copy_if_exists "$LATEST_CONCLUSION_SHA" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_CONCLUSION_SHA")"
fi

cat > "$BUNDLE_DIR/README.txt" <<EOF
OpenPRA Quantum Final Project State Bundle v1

Created at UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)

Final current-source conclusion
1. Real topology A exists
2. Real topology C exists
3. Real topology D exists
4. Real topology B was not found in the accessible current source universe
5. Synthetic topology B remains required for bounded proof coverage

Boundary
This is the final bounded state for the currently accessible sources.
This does not establish broad completion beyond the accessible source universe.
This does not establish quantum advantage or production readiness.
Preserve separation between the executed only hardware lane and the simulator validation lane.
EOF

(
  cd "$BUNDLE_DIR"
  find . -type f | sort | sed 's#^\./##' > MANIFEST.txt
  sha256sum $(find . -type f | sort | sed 's#^\./##') > SHA256SUMS.txt
)

mkdir -p "$OUT_ROOT"
tar -C "$OUT_ROOT" -czf "$TAR_PATH" "$(basename "$BUNDLE_DIR")"
sha256sum "$TAR_PATH" > "$SHA_PATH"

echo "$BUNDLE_DIR"
echo "$TAR_PATH"
echo "$SHA_PATH"
