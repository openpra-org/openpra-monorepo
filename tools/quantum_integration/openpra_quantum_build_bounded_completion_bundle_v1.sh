#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_bounded_completion_bundle_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BUNDLE_NAME="OPENPRA_QUANTUM_BOUNDED_COMPLETION_BUNDLE_v1_${STAMP}"
BUNDLE_DIR="$OUT_ROOT/$BUNDLE_NAME"
TAR_PATH="$OUT_ROOT/${BUNDLE_NAME}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

ROLLUP_JSON="$REPO_ROOT/_work/openpra_quantum_simulator_validation_v1_real_exhaust_ac/_rollup/openpra_quantum_simulator_validation_rollup_v1.json"
EXHAUST_MEMO="$REPO_ROOT/_work/openpra_quantum_real_case_expansion_exhaust_ac_v1/OPENPRA_QUANTUM_REAL_CASE_EXPANSION_EXHAUST_AC_MEMO_v1.txt"
EXHAUST_SUMMARY="$REPO_ROOT/_work/openpra_quantum_real_case_expansion_exhaust_ac_v1/openpra_quantum_real_case_expansion_exhaust_ac_summary_v1.json"
BOUNDED_REPORT_DIR="$REPO_ROOT/_work/openpra_quantum_bounded_validation_report_v1"
CHECKPOINT_MEMO_DIR="$REPO_ROOT/_work/openpra_quantum_validation_checkpoint_memo_v1"
REAL_COHORT_MEMO_DIR="$REPO_ROOT/_work/openpra_quantum_real_cohort_inventory_memo_v1"
EXHAUST_WORKSPACE_DIR="$REPO_ROOT/_work/openpra_quantum_simulator_validation_v1_real_exhaust_ac"

mkdir -p "$BUNDLE_DIR"/{memos,report,artifacts,workspaces}

copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [ -e "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -a "$src" "$dest"
  fi
}

copy_if_exists "$EXHAUST_MEMO" "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_CASE_EXPANSION_EXHAUST_AC_MEMO_v1.txt"
copy_if_exists "$EXHAUST_SUMMARY" "$BUNDLE_DIR/memos/openpra_quantum_real_case_expansion_exhaust_ac_summary_v1.json"

copy_if_exists "$CHECKPOINT_MEMO_DIR/OPENPRA_QUANTUM_SIM_VALIDATION_CHECKPOINT_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_SIM_VALIDATION_CHECKPOINT_MEMO_v1.txt"
copy_if_exists "$CHECKPOINT_MEMO_DIR/openpra_quantum_sim_validation_checkpoint_summary_v1.json" \
  "$BUNDLE_DIR/memos/openpra_quantum_sim_validation_checkpoint_summary_v1.json"

copy_if_exists "$REAL_COHORT_MEMO_DIR/OPENPRA_QUANTUM_REAL_COHORT_INVENTORY_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_COHORT_INVENTORY_MEMO_v1.txt"
copy_if_exists "$REAL_COHORT_MEMO_DIR/openpra_quantum_real_cohort_inventory_summary_v1.json" \
  "$BUNDLE_DIR/memos/openpra_quantum_real_cohort_inventory_summary_v1.json"

copy_if_exists "$BOUNDED_REPORT_DIR/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v1.txt" \
  "$BUNDLE_DIR/report/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v1.txt"
copy_if_exists "$BOUNDED_REPORT_DIR/openpra_quantum_bounded_validation_report_summary_v1.json" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_report_summary_v1.json"
copy_if_exists "$BOUNDED_REPORT_DIR/openpra_quantum_bounded_validation_real_lane_v1.csv" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_real_lane_v1.csv"
copy_if_exists "$BOUNDED_REPORT_DIR/openpra_quantum_bounded_validation_synthetic_lane_v1.csv" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_synthetic_lane_v1.csv"

copy_if_exists "$ROLLUP_JSON" "$BUNDLE_DIR/workspaces/openpra_quantum_simulator_validation_rollup_v1.json"

LATEST_EXPANDED_TAR="$(ls -1 "$REPO_ROOT"/_work/openpra_quantum_simulator_validation_checkpoint_v1/OPENPRA_QUANTUM_SIM_VALIDATION_EXPANDED_v1_*.tar.gz 2>/dev/null | sort | tail -1 || true)"
LATEST_EXPANDED_SHA="${LATEST_EXPANDED_TAR}.sha256"
LATEST_REPORT_TAR="$(ls -1 "$REPO_ROOT"/_work/openpra_quantum_bounded_validation_report_pkg_v1/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v1_*.tar.gz 2>/dev/null | sort | tail -1 || true)"
LATEST_REPORT_SHA="${LATEST_REPORT_TAR}.sha256"

if [ -n "$LATEST_EXPANDED_TAR" ]; then
  copy_if_exists "$LATEST_EXPANDED_TAR" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_EXPANDED_TAR")"
  copy_if_exists "$LATEST_EXPANDED_SHA" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_EXPANDED_SHA")"
fi

if [ -n "$LATEST_REPORT_TAR" ]; then
  copy_if_exists "$LATEST_REPORT_TAR" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_REPORT_TAR")"
  copy_if_exists "$LATEST_REPORT_SHA" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_REPORT_SHA")"
fi

python3 - <<'PY' "$ROLLUP_JSON" "$BUNDLE_DIR/README.txt"
import json, sys
rollup_path, readme_path = sys.argv[1], sys.argv[2]
with open(rollup_path, "r", encoding="utf-8") as f:
    data = json.load(f)

text = f"""OpenPRA Quantum Bounded Completion Bundle v1

This bundle captures the current bounded evidence state.

Headline
Total cases: {data['counts']['totalCases']}
Topology counts: {data['counts']['topologyCounts']}
Primary mode counts: {data['counts']['primaryModeCounts']}
All exact: {data['counts']['allExact']}
Operator attention count: {data['counts']['operatorAttentionCount']}

Interpretation
1. The real lane currently demonstrates topology A and topology C.
2. The synthetic proof lane currently demonstrates topology B and topology D.
3. This is a bounded validation state, not a final broad real cohort completion claim.
4. Preserve separation between the executed only hardware lane and the simulator validation lane.

Contents
1. Checkpoint memo and summary
2. Real cohort inventory memo and summary
3. Exhaust A C expansion memo and summary
4. Bounded validation report and CSV exports
5. Latest expanded checkpoint artifact and SHA256
6. Latest bounded validation report artifact and SHA256
"""
with open(readme_path, "w", encoding="utf-8") as f:
    f.write(text)
PY

(
  cd "$BUNDLE_DIR"
  find . -type f | sort | sed 's#^\./##' > MANIFEST.txt
  sha256sum $(find . -type f | sort | sed 's#^\./##') > SHA256SUMS.txt
)

tar -C "$OUT_ROOT" -czf "$TAR_PATH" "$(basename "$BUNDLE_DIR")"
sha256sum "$TAR_PATH" > "$SHA_PATH"

echo "$BUNDLE_DIR"
echo "$TAR_PATH"
echo "$SHA_PATH"
