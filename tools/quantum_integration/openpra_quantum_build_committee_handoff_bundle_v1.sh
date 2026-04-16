#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_committee_handoff_bundle_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BUNDLE_DIR="$OUT_ROOT/OPENPRA_QUANTUM_COMMITTEE_HANDOFF_BUNDLE_v1_${STAMP}"
TAR_PATH="$OUT_ROOT/OPENPRA_QUANTUM_COMMITTEE_HANDOFF_BUNDLE_v1_${STAMP}.tar.gz"
SHA_PATH="$TAR_PATH.sha256"

mkdir -p "$BUNDLE_DIR"

copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [ -e "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -a "$src" "$dest"
  fi
}

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_validation_checkpoint_memo_v1/OPENPRA_QUANTUM_SIM_VALIDATION_CHECKPOINT_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_SIM_VALIDATION_CHECKPOINT_MEMO_v1.txt"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_validation_checkpoint_memo_v1/openpra_quantum_sim_validation_checkpoint_summary_v1.json" \
  "$BUNDLE_DIR/memos/openpra_quantum_sim_validation_checkpoint_summary_v1.json"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_cohort_inventory_memo_v1/OPENPRA_QUANTUM_REAL_COHORT_INVENTORY_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_COHORT_INVENTORY_MEMO_v1.txt"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_cohort_inventory_memo_v1/openpra_quantum_real_cohort_inventory_summary_v1.json" \
  "$BUNDLE_DIR/memos/openpra_quantum_real_cohort_inventory_summary_v1.json"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_bounded_validation_report_v1/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v1.txt" \
  "$BUNDLE_DIR/report/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v1.txt"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_bounded_validation_report_v1/openpra_quantum_bounded_validation_report_summary_v1.json" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_report_summary_v1.json"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_bounded_validation_report_v1/openpra_quantum_bounded_validation_real_lane_v1.csv" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_real_lane_v1.csv"

copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_bounded_validation_report_v1/openpra_quantum_bounded_validation_synthetic_lane_v1.csv" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_synthetic_lane_v1.csv"

LATEST_CLEAN_TAR="$(ls -1 "$REPO_ROOT"/_work/openpra_quantum_simulator_validation_checkpoint_v1/OPENPRA_QUANTUM_SIM_VALIDATION_CHECKPOINT_CLEAN_v1_*.tar.gz 2>/dev/null | sort | tail -1 || true)"
LATEST_CLEAN_SHA="${LATEST_CLEAN_TAR}.sha256"

LATEST_EXPANDED_TAR="$(ls -1 "$REPO_ROOT"/_work/openpra_quantum_simulator_validation_checkpoint_v1/OPENPRA_QUANTUM_SIM_VALIDATION_EXPANDED_v1_*.tar.gz 2>/dev/null | sort | tail -1 || true)"
LATEST_EXPANDED_SHA="${LATEST_EXPANDED_TAR}.sha256"

LATEST_REPORT_TAR="$(ls -1 "$REPO_ROOT"/_work/openpra_quantum_bounded_validation_report_pkg_v1/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v1_*.tar.gz 2>/dev/null | sort | tail -1 || true)"
LATEST_REPORT_SHA="${LATEST_REPORT_TAR}.sha256"

if [ -n "$LATEST_CLEAN_TAR" ]; then
  copy_if_exists "$LATEST_CLEAN_TAR" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_CLEAN_TAR")"
  copy_if_exists "$LATEST_CLEAN_SHA" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_CLEAN_SHA")"
fi

if [ -n "$LATEST_EXPANDED_TAR" ]; then
  copy_if_exists "$LATEST_EXPANDED_TAR" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_EXPANDED_TAR")"
  copy_if_exists "$LATEST_EXPANDED_SHA" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_EXPANDED_SHA")"
fi

if [ -n "$LATEST_REPORT_TAR" ]; then
  copy_if_exists "$LATEST_REPORT_TAR" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_REPORT_TAR")"
  copy_if_exists "$LATEST_REPORT_SHA" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_REPORT_SHA")"
fi

cat > "$BUNDLE_DIR/README.txt" <<EOF
OpenPRA Quantum Committee Handoff Bundle v1

Created at UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)

Contents
1. Checkpoint memo and summary
2. Real cohort inventory memo and summary
3. Bounded validation report, summary, and CSV lane exports
4. Latest clean checkpoint tar and SHA256
5. Latest expanded checkpoint tar and SHA256
6. Latest bounded validation report tar and SHA256

Interpretation
This bundle supports a bounded validation checkpoint.
The real lane currently demonstrates topology A and topology C.
The synthetic proof lane currently demonstrates topology B and topology D.
Do not overclaim real B or D coverage from this bundle.
Preserve separation between the executed only hardware lane and the simulator validation lane.
EOF

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
