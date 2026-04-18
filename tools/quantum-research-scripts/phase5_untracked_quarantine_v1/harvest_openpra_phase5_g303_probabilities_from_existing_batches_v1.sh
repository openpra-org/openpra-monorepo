#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

CURRENT_BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"
CURRENT_LEDGER_RUN="${CURRENT_BATCH_RUN}/99_phase5_probability_master_ledger_v1"
MASTER_JSON="${CURRENT_LEDGER_RUN}/phase5_master_probability_values.json"
AUTHOR_SCRIPTS="_work/openpra_phase5_authoritative_project_bundle_v1/PHASE5_AUTHORITATIVE_PROJECT_BUNDLE_v1_20260412_200026Z/scripts"

pick_script() {
  for candidate in "$@"; do
    if [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

APPLY_MASTER_PY="$(pick_script \
  "./tools/quantum_research_scripts/phase5/openpra_phase5_apply_master_probability_values_v1.py" \
  "${AUTHOR_SCRIPTS}/openpra_phase5_apply_master_probability_values_v1.py")"

test -f "${MASTER_JSON}" || { echo "Missing master JSON: ${MASTER_JSON}" >&2; exit 1; }
test -f "${APPLY_MASTER_PY}" || { echo "Missing apply script: ${APPLY_MASTER_PY}" >&2; exit 1; }

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="${CURRENT_LEDGER_RUN}/g303_probability_donor_probe_v1_${STAMP}"
mkdir -p "${OUTDIR}"
export OUTDIR MASTER_JSON CURRENT_BATCH_RUN CURRENT_LEDGER_RUN

python3 - <<'PY'
import json
import os
from pathlib import Path

repo = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
outdir = repo / os.environ["OUTDIR"]
master_json = repo / os.environ["MASTER_JSON"]
current_batch_run = repo / os.environ["CURRENT_BATCH_RUN"]

master = json.loads(master_json.read_text(encoding="utf-8"))
needed = {k for k, v in master["probabilities"].items() if v is None}

scan_roots = [
    repo / "_work/openpra_phase5_real_candidate_batch_v1",
    repo / "_work/openpra_phase5_authoritative_project_bundle_v1",
]

donors = []

for root in scan_roots:
    if not root.exists():
        continue

    for prob_path in root.rglob("probabilities.json"):
        if current_batch_run in prob_path.parents:
            continue

        meta_path = prob_path.parent / "package_metadata.json"
        if not meta_path.exists():
            continue

        try:
            probs = json.loads(prob_path.read_text(encoding="utf-8"))
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            continue

        prob_map = probs.get("probabilities", {})
        if not isinstance(prob_map, dict):
            continue

        populated = {k: v for k, v in prob_map.items() if isinstance(v, (int, float))}

        donor = {
            "probabilities_json": str(prob_path.relative_to(repo)),
            "package_metadata_json": str(meta_path.relative_to(repo)),
            "model_id": meta.get("model_id"),
            "candidate_root_node_id": meta.get("candidate_root_node_id"),
            "topology_class": meta.get("topology_class"),
            "basic_event_count": meta.get("basic_event_count"),
            "required_qubits": meta.get("required_qubits"),
            "probabilities_status": probs.get("status"),
            "populated_probability_count": len(populated),
            "needed_overlap_count": len(needed & set(populated.keys())),
            "needed_overlap_event_ids": sorted(needed & set(populated.keys())),
            "all_needed_present": needed <= set(populated.keys()),
            "same_g303_d8_signature": (
                meta.get("candidate_root_node_id") == "G:G303"
                and meta.get("topology_class") == "D"
                and meta.get("basic_event_count") == 8
            ),
            "values_for_needed": {k: populated[k] for k in sorted(needed & set(populated.keys()))},
        }

        if donor["needed_overlap_count"] > 0:
            donors.append(donor)

donors.sort(
    key=lambda d: (
        0 if d["same_g303_d8_signature"] else 1,
        0 if d["all_needed_present"] else 1,
        -d["needed_overlap_count"],
        -d["populated_probability_count"],
        d["probabilities_json"],
    )
)

(outdir / "90_g303_probability_donor_candidates.json").write_text(
    json.dumps(donors, indent=2),
    encoding="utf-8",
)

summary = {
    "needed_event_ids": sorted(needed),
    "donor_count": len(donors),
    "best_donor": donors[0] if donors else None,
    "auto_patch_performed": False,
}

if donors and donors[0]["all_needed_present"]:
    best = donors[0]
    best_prob_path = repo / best["probabilities_json"]
    best_probs = json.loads(best_prob_path.read_text(encoding="utf-8"))
    best_map = best_probs["probabilities"]

    for ev in needed:
        master["probabilities"][ev] = best_map[ev]

    master["status"] = "partially_populated_with_g303_donor_bridge"
    notes = master.get("notes", [])
    if isinstance(notes, list):
        notes.append(
            "Missing G:G303 event probabilities were filled from an existing populated donor probabilities.json with matching event IDs."
        )
        notes.append(f"Donor source: {best['probabilities_json']}")
    else:
        master["notes"] = [
            "Missing G:G303 event probabilities were filled from an existing populated donor probabilities.json with matching event IDs.",
            f"Donor source: {best['probabilities_json']}",
        ]

    master_json.write_text(json.dumps(master, indent=2) + "\n", encoding="utf-8")
    summary["auto_patch_performed"] = True
    summary["patched_from"] = best["probabilities_json"]

(outdir / "91_g303_probability_donor_summary.json").write_text(
    json.dumps(summary, indent=2),
    encoding="utf-8",
)

print("DONOR_JSON=" + str((outdir / "90_g303_probability_donor_candidates.json").relative_to(repo)))
print("SUMMARY_JSON=" + str((outdir / "91_g303_probability_donor_summary.json").relative_to(repo)))
print()
print("===== DONOR SUMMARY =====")
print(json.dumps(summary, indent=2))
print()
print("===== TOP DONORS =====")
for donor in donors[:10]:
    print(json.dumps(donor, indent=2))
    print()
PY

echo
echo "===== MASTER JSON AFTER DONOR PATCH ATTEMPT ====="
sed -n '1,220p' "${MASTER_JSON}"

echo
echo "===== RERUN FANOUT ====="
python3 "${APPLY_MASTER_PY}" \
  --batch-run "${CURRENT_BATCH_RUN}" \
  --ledger-run "${CURRENT_LEDGER_RUN}"

echo
echo "===== FANOUT SUMMARY ====="
sed -n '1,220p' "${CURRENT_LEDGER_RUN}/phase5_probability_fanout_summary.json"

echo
echo "===== PER CASE PROBABILITY STATUS ====="
python3 - <<'PY'
import json
from pathlib import Path

batch_run = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z")

for case_dir in sorted([p for p in batch_run.iterdir() if p.is_dir() and p.name[:4].isdigit()]):
    probs = json.loads((case_dir / "probabilities.json").read_text(encoding="utf-8"))
    meta = json.loads((case_dir / "package_metadata.json").read_text(encoding="utf-8"))
    populated = 0
    if isinstance(probs.get("probabilities"), dict):
        populated = sum(1 for v in probs["probabilities"].values() if isinstance(v, (int, float)))
    print()
    print(case_dir.name)
    print("  model_id =", meta.get("model_id"))
    print("  candidate_root_node_id =", meta.get("candidate_root_node_id"))
    print("  probabilities_status =", probs.get("status"))
    print("  populated_probability_count =", populated)
PY
