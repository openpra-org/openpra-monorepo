#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"

LATEST_ROLLUP="$REPO_ROOT/_work/openpra_quantum_simulator_validation_v1_real_with_d/_rollup/openpra_quantum_simulator_validation_rollup_v1.json"
REPORT_OUT="$REPO_ROOT/_work/openpra_quantum_bounded_validation_report_v2"
BUNDLE_OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_bounded_completion_bundle_v2"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BUNDLE_NAME="OPENPRA_QUANTUM_BOUNDED_COMPLETION_BUNDLE_v2_${STAMP}"
BUNDLE_DIR="$BUNDLE_OUT_ROOT/$BUNDLE_NAME"
BUNDLE_TAR="$BUNDLE_OUT_ROOT/${BUNDLE_NAME}.tar.gz"
BUNDLE_SHA="${BUNDLE_TAR}.sha256"

mkdir -p "$REPORT_OUT" "$BUNDLE_DIR"/{memos,report,artifacts,workspaces}

python3 - <<'PY' "$LATEST_ROLLUP" "$REPORT_OUT"
import json, sys
from pathlib import Path
from datetime import datetime, timezone
import csv

rollup_path = Path(sys.argv[1])
out_dir = Path(sys.argv[2])

data = json.loads(rollup_path.read_text(encoding="utf-8"))

real_rows = []
synthetic_rows = []
other_rows = []

for row in data["caseRows"]:
    label = row["caseLabel"]
    if label.startswith("phase2b_row_"):
        real_rows.append(row)
    elif label.startswith("synthetic_topology_"):
        synthetic_rows.append(row)
    else:
        other_rows.append(row)

report = f"""OpenPRA Quantum Bounded Validation Report v2

Generated at UTC: {datetime.now(timezone.utc).isoformat()}
Script version: openpra-quantum-refresh-bounded-state-after-real-d-v1

Headline results

Total cases: {data['counts']['totalCases']}
Topology counts: {data['counts']['topologyCounts']}
Primary mode counts: {data['counts']['primaryModeCounts']}
All exact: {data['counts']['allExact']}
Operator attention count: {data['counts']['operatorAttentionCount']}

Supported bounded claims

The preparation selection seam is fixed for CLQUBO export to preparation artifact generation.
The real case lane currently demonstrates topology A, topology C, and representative topology D.
The synthetic proof lane currently demonstrates topology B.
All included bounded checkpoint cases recover exactly in the current synthetic exact MCS simulator lane.

Unsupported or not yet established claims

This report does not establish real case coverage for topology B.
This report does not establish broad real cohort completion.
This report does not replace the executed only hardware interpretation for row0905.
This report does not establish quantum advantage or production readiness.

Real case lane
"""

for row in real_rows:
    report += f"\n{row['caseLabel']} | topology={row['topologyClass']} | mode={row['primaryMode']} | attention={row['requiresOperatorAttention']}"

report += "\n\nSynthetic proof lane\n"
for row in synthetic_rows:
    report += f"\n{row['caseLabel']} | topology={row['topologyClass']} | mode={row['primaryMode']} | attention={row['requiresOperatorAttention']}"

if other_rows:
    report += "\n\nOther rows\n"
    for row in other_rows:
        report += f"\n{row['caseLabel']} | topology={row['topologyClass']} | mode={row['primaryMode']} | attention={row['requiresOperatorAttention']}"

report += f"""

Artifact paths

Rollup JSON: {rollup_path}

Next tranche

Continue determining whether any real topology B cases exist in the current or adjacent source lanes.
Preserve separation between the hardware validated lane and the simulator validation lane.
Treat this as a bounded validation state, not a final broad cohort completion claim.
"""

(out_dir / "OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v2.txt").write_text(report, encoding="utf-8")

summary = {
    "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
    "rollupPath": str(rollup_path),
    "totalCases": data["counts"]["totalCases"],
    "topologyCounts": data["counts"]["topologyCounts"],
    "primaryModeCounts": data["counts"]["primaryModeCounts"],
    "allExact": data["counts"]["allExact"],
    "operatorAttentionCount": data["counts"]["operatorAttentionCount"],
    "realCaseCount": len(real_rows),
    "syntheticProofCount": len(synthetic_rows),
    "otherCount": len(other_rows),
}
(out_dir / "openpra_quantum_bounded_validation_report_summary_v2.json").write_text(
    json.dumps(summary, indent=2) + "\n", encoding="utf-8"
)

def write_csv(path, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        fieldnames = [
            "caseLabel",
            "topologyClass",
            "primaryMode",
            "requiresOperatorAttention",
            "tier1RecoveredExactCutSetCount",
            "tier1ReferenceCount",
            "unionRecoveredCount",
            "unionReferenceCount",
            "unionAllRecovered",
        ]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k) for k in fieldnames})

write_csv(out_dir / "openpra_quantum_bounded_validation_real_lane_v2.csv", real_rows)
write_csv(out_dir / "openpra_quantum_bounded_validation_synthetic_lane_v2.csv", synthetic_rows)
PY

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
  "$REPO_ROOT/_work/openpra_quantum_real_cohort_inventory_memo_v1/OPENPRA_QUANTUM_REAL_COHORT_INVENTORY_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_COHORT_INVENTORY_MEMO_v1.txt"
copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_case_expansion_exhaust_ac_v1/OPENPRA_QUANTUM_REAL_CASE_EXPANSION_EXHAUST_AC_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_CASE_EXPANSION_EXHAUST_AC_MEMO_v1.txt"
copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_d_representative_v1/OPENPRA_QUANTUM_REAL_D_REPRESENTATIVE_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_D_REPRESENTATIVE_MEMO_v1.txt"
copy_if_exists \
  "$REPO_ROOT/_work/openpra_quantum_real_bd_inventory_v1/OPENPRA_QUANTUM_REAL_BD_INVENTORY_MEMO_v1.txt" \
  "$BUNDLE_DIR/memos/OPENPRA_QUANTUM_REAL_BD_INVENTORY_MEMO_v1.txt"

copy_if_exists \
  "$REPORT_OUT/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v2.txt" \
  "$BUNDLE_DIR/report/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v2.txt"
copy_if_exists \
  "$REPORT_OUT/openpra_quantum_bounded_validation_report_summary_v2.json" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_report_summary_v2.json"
copy_if_exists \
  "$REPORT_OUT/openpra_quantum_bounded_validation_real_lane_v2.csv" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_real_lane_v2.csv"
copy_if_exists \
  "$REPORT_OUT/openpra_quantum_bounded_validation_synthetic_lane_v2.csv" \
  "$BUNDLE_DIR/report/openpra_quantum_bounded_validation_synthetic_lane_v2.csv"

copy_if_exists \
  "$LATEST_ROLLUP" \
  "$BUNDLE_DIR/workspaces/openpra_quantum_simulator_validation_rollup_v1.json"

LATEST_EXPANDED_TAR="$(ls -1 "$REPO_ROOT"/_work/openpra_quantum_simulator_validation_checkpoint_v1/OPENPRA_QUANTUM_SIM_VALIDATION_EXPANDED_v1_*.tar.gz 2>/dev/null | sort | tail -1 || true)"
LATEST_EXPANDED_SHA="${LATEST_EXPANDED_TAR}.sha256"
LATEST_BOUNDED_REPORT_TAR="$(ls -1 "$REPO_ROOT"/_work/openpra_quantum_bounded_validation_report_pkg_v1/OPENPRA_QUANTUM_BOUNDED_VALIDATION_REPORT_v1_*.tar.gz 2>/dev/null | sort | tail -1 || true)"
LATEST_BOUNDED_REPORT_SHA="${LATEST_BOUNDED_REPORT_TAR}.sha256"

if [ -n "$LATEST_EXPANDED_TAR" ]; then
  copy_if_exists "$LATEST_EXPANDED_TAR" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_EXPANDED_TAR")"
  copy_if_exists "$LATEST_EXPANDED_SHA" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_EXPANDED_SHA")"
fi

if [ -n "$LATEST_BOUNDED_REPORT_TAR" ]; then
  copy_if_exists "$LATEST_BOUNDED_REPORT_TAR" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_BOUNDED_REPORT_TAR")"
  copy_if_exists "$LATEST_BOUNDED_REPORT_SHA" "$BUNDLE_DIR/artifacts/$(basename "$LATEST_BOUNDED_REPORT_SHA")"
fi

cat > "$BUNDLE_DIR/README.txt" <<EOF
OpenPRA Quantum Bounded Completion Bundle v2

Created at UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)

Headline
This bounded state currently supports:
1. Real topology A coverage
2. Real topology C coverage
3. Representative real topology D coverage
4. Synthetic proof topology B coverage

Boundary
This does not establish real topology B coverage, broad real cohort completion, quantum advantage, or production readiness.
Preserve separation between the executed only hardware lane and the simulator validation lane.
EOF

(
  cd "$BUNDLE_DIR"
  find . -type f | sort | sed 's#^\./##' > MANIFEST.txt
  sha256sum $(find . -type f | sort | sed 's#^\./##') > SHA256SUMS.txt
)

mkdir -p "$BUNDLE_OUT_ROOT"
tar -C "$BUNDLE_OUT_ROOT" -czf "$BUNDLE_TAR" "$(basename "$BUNDLE_DIR")"
sha256sum "$BUNDLE_TAR" > "$BUNDLE_SHA"

echo "$BUNDLE_DIR"
echo "$BUNDLE_TAR"
echo "$BUNDLE_SHA"
