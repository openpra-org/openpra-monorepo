#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

CURRENT_BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"
CURRENT_LEDGER_RUN="${CURRENT_BATCH_RUN}/99_phase5_probability_master_ledger_v1"
MASTER_JSON="${CURRENT_LEDGER_RUN}/phase5_master_probability_values.json"
XML_PROBE_SUMMARY="${CURRENT_LEDGER_RUN}/upstream_probability_source_probe_v1_20260415_031748Z/xml_value_extract_v1/91_xml_event_value_summary.json"
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
test -f "${XML_PROBE_SUMMARY}" || { echo "Missing XML probe summary: ${XML_PROBE_SUMMARY}" >&2; exit 1; }
test -f "${APPLY_MASTER_PY}" || { echo "Missing apply script: ${APPLY_MASTER_PY}" >&2; exit 1; }

BACKUP_JSON="${MASTER_JSON}.bak_$(date -u +%Y%m%d_%H%M%SZ)"
cp -v "${MASTER_JSON}" "${BACKUP_JSON}"

export MASTER_JSON XML_PROBE_SUMMARY

python3 - <<'PY'
import json
import os
from pathlib import Path

master_path = Path(os.environ["MASTER_JSON"])
probe_summary_path = Path(os.environ["XML_PROBE_SUMMARY"])

master = json.loads(master_path.read_text(encoding="utf-8"))
probe_summary = json.loads(probe_summary_path.read_text(encoding="utf-8"))

patch_values = {
    "B:BE3731": 0.000734,
    "B:BE3754": 0.000734,
    "B:BE3755": 0.000734,
    "B:BE3756": 0.000734,
    "B:BE3757": 0.000734,
    "B:BE466": 0.1,
    "B:BE581": 0.0,
}

probs = master.get("probabilities", {})
if not isinstance(probs, dict):
    raise SystemExit("Master JSON has no usable probabilities map")

for event_id, value in patch_values.items():
    if event_id not in probs:
        raise SystemExit(f"Missing target event in master JSON: {event_id}")
    probs[event_id] = value

master["status"] = "populated_from_dec6_csv_plus_upstream_mef_xml_probe"
master["updated_at"] = __import__("datetime").datetime.utcnow().isoformat() + "Z"
notes = master.get("notes")
if not isinstance(notes, list):
    notes = []
master["notes"] = notes + [
    "Seven missing G:G303 event probabilities were patched from upstream MEF XML probe results.",
    "Source summary: " + str(probe_summary_path),
    "Patched events: " + ";".join(sorted(patch_values.keys())),
]

master_path.write_text(json.dumps(master, indent=2) + "\n", encoding="utf-8")
print("PATCHED_MASTER_JSON=" + str(master_path))
print("PATCH_VALUES=" + json.dumps(patch_values, sort_keys=True))

print()
print("===== XML PROBE SUMMARY SNAPSHOT =====")
for row in probe_summary:
    event_id = row.get("event_id")
    top = row.get("top_numeric_signatures", [])
    print(event_id, top[:2])
PY

echo
echo "===== MASTER JSON AFTER PATCH ====="
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
