#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"
LEDGER_RUN="${BATCH_RUN}/99_phase5_probability_master_ledger_v1"
DEC6_CSV="/mnt/storage_array/projects/QPRA_DISSERTATION_v1/Paper11/WORK/DEC6_mef_basic_event_metadata_v1_20260307_224412Z/dec6_mef_basic_event_metadata_v1.csv"

OUTDIR="${LEDGER_RUN}/missing_probability_probe_v1"
mkdir -p "${OUTDIR}"

python3 - <<'PY'
import json
from pathlib import Path

ledger = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z/99_phase5_probability_master_ledger_v1")
master = json.loads((ledger / "phase5_master_probability_values.json").read_text(encoding="utf-8"))

missing = [k for k, v in master["probabilities"].items() if v is None]

out = ledger / "missing_probability_probe_v1" / "missing_event_ids.txt"
out.write_text("\n".join(missing) + "\n", encoding="utf-8")

print("MISSING_COUNT=", len(missing))
print("MISSING_LIST=", ";".join(missing))
print("MISSING_TXT=", out)
PY

echo
echo "===== GREP DEC6 CSV FOR MISSING EVENTS ====="
while IFS= read -r ev; do
  [ -n "$ev" ] || continue
  echo
  echo "---- ${ev} ----"
  grep -n "${ev#B:}" "${DEC6_CSV}" || true
done < "${OUTDIR}/missing_event_ids.txt" | tee "${OUTDIR}/grep_dec6_results.txt"

echo
echo "===== RIPGREP REPO FOR MISSING EVENTS ====="
while IFS= read -r ev; do
  [ -n "$ev" ] || continue
  echo
  echo "---- ${ev} ----"
  rg -n "${ev#B:}" /mnt/storage_array/projects/OPENPRA_DEV_v1 /mnt/storage_array/projects/QPRA_DISSERTATION_v1 || true
done < "${OUTDIR}/missing_event_ids.txt" | tee "${OUTDIR}/rg_repo_results.txt"

echo
echo "OUTPUT_DIR=${OUTDIR}"
echo "DEC6_GREP=${OUTDIR}/grep_dec6_results.txt"
echo "REPO_RG=${OUTDIR}/rg_repo_results.txt"
