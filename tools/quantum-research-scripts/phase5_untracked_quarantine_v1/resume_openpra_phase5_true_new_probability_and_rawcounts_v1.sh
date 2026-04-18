#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"
LEDGER_RUN="${BATCH_RUN}/99_phase5_probability_master_ledger_v1"
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

INGEST_DEC6_PY="$(pick_script \
  "./tools/quantum_research_scripts/phase5/openpra_phase5_ingest_probabilities_from_dec6_csv_v1.py" \
  "${AUTHOR_SCRIPTS}/openpra_phase5_ingest_probabilities_from_dec6_csv_v1.py")"

INIT_RAW_COUNTS_PY="$(pick_script \
  "./tools/quantum_research_scripts/phase5/openpra_phase5_initialize_raw_counts_templates_v1.py" \
  "${AUTHOR_SCRIPTS}/openpra_phase5_initialize_raw_counts_templates_v1.py")"

for p in \
  "${APPLY_MASTER_PY}" \
  "${INGEST_DEC6_PY}" \
  "${INIT_RAW_COUNTS_PY}"
do
  test -f "${p}" || { echo "Missing required script: ${p}" >&2; exit 1; }
done

test -d "${BATCH_RUN}" || { echo "Missing batch run: ${BATCH_RUN}" >&2; exit 1; }
test -d "${LEDGER_RUN}" || { echo "Missing ledger run: ${LEDGER_RUN}" >&2; exit 1; }

echo
echo "===== STEP 1 CREATE MASTER TEMPLATE IF MISSING ====="
python3 "${APPLY_MASTER_PY}" \
  --batch-run "${BATCH_RUN}" \
  --ledger-run "${LEDGER_RUN}"

test -f "${LEDGER_RUN}/phase5_master_probability_values.json"

echo
echo "===== MASTER TEMPLATE ====="
sed -n '1,220p' "${LEDGER_RUN}/phase5_master_probability_values.json"

echo
echo "===== STEP 2 INGEST DEC6 PROBABILITIES ====="
python3 "${INGEST_DEC6_PY}" \
  --batch-run "${BATCH_RUN}" \
  --ledger-run "${LEDGER_RUN}"

test -f "${LEDGER_RUN}/phase5_probability_ingest_from_dec6_summary.json"

echo
echo "===== DEC6 INGEST SUMMARY ====="
sed -n '1,220p' "${LEDGER_RUN}/phase5_probability_ingest_from_dec6_summary.json"

echo
echo "===== STEP 3 FAN OUT POPULATED MASTER VALUES ====="
python3 "${APPLY_MASTER_PY}" \
  --batch-run "${BATCH_RUN}" \
  --ledger-run "${LEDGER_RUN}"

test -f "${LEDGER_RUN}/phase5_probability_fanout_summary.json"

echo
echo "===== PROBABILITY FANOUT SUMMARY ====="
sed -n '1,220p' "${LEDGER_RUN}/phase5_probability_fanout_summary.json"

echo
echo "===== STEP 4 INITIALIZE RAW COUNTS TEMPLATES ====="
python3 "${INIT_RAW_COUNTS_PY}" \
  --batch-run "${BATCH_RUN}"

test -f "${BATCH_RUN}/97_phase5_raw_counts_readiness_summary.json"

echo
echo "===== RAW COUNTS READINESS SUMMARY ====="
sed -n '1,220p' "${BATCH_RUN}/97_phase5_raw_counts_readiness_summary.json"

echo
echo "===== PER CASE STATUS CHECK ====="
python3 - <<'PY'
import json
from pathlib import Path

batch_run = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z")

for case_dir in sorted([p for p in batch_run.iterdir() if p.is_dir() and p.name[:4].isdigit()]):
    meta = json.loads((case_dir / "package_metadata.json").read_text(encoding="utf-8"))
    probs = json.loads((case_dir / "probabilities.json").read_text(encoding="utf-8"))
    qmcs = json.loads((case_dir / "quantum_recovered_mcs.json").read_text(encoding="utf-8"))
    raw = json.loads((case_dir / "raw_counts.json").read_text(encoding="utf-8"))

    populated_probability_count = 0
    if isinstance(probs.get("probabilities"), dict):
        populated_probability_count = sum(
            1 for v in probs["probabilities"].values() if isinstance(v, (int, float))
        )

    quantum_mcs_count = 0
    if isinstance(qmcs.get("basicEventIdSets"), list):
        quantum_mcs_count = len(qmcs["basicEventIdSets"])

    raw_counts_entry_count = 0
    if isinstance(raw.get("counts"), dict):
        raw_counts_entry_count = len(raw["counts"])

    print()
    print(case_dir.name)
    print("  model_id =", meta.get("model_id"))
    print("  candidate_root_node_id =", meta.get("candidate_root_node_id"))
    print("  topology_class =", meta.get("topology_class"))
    print("  basic_event_count =", meta.get("basic_event_count"))
    print("  probabilities_status =", probs.get("status"))
    print("  populated_probability_count =", populated_probability_count)
    print("  quantum_mcs_status =", qmcs.get("status"))
    print("  quantum_mcs_count =", quantum_mcs_count)
    print("  raw_counts_status =", raw.get("status"))
    print("  raw_counts_entry_count =", raw_counts_entry_count)
PY
