#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
cd "${ROOT}"

RUNTIME_PY="/mnt/storage_array/projects/quantum_advantage_study/.venv_quantum/bin/python"
STAGE_RUN="_work/openpra_phase5_single_case_runtime_package_v1/20260411_020049Z_phase2b_row_1037"
BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z"
CANDIDATE_DIR="_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/0001_phase2b_row_1037"
COLLECT_REPORT="${STAGE_RUN}/quantum_collect_report_p1_v1.json"

echo "ROOT=${ROOT}"
echo "RUNTIME_PY=${RUNTIME_PY}"
echo "STAGE_RUN=${STAGE_RUN}"
echo "BATCH_RUN=${BATCH_RUN}"
echo "CANDIDATE_DIR=${CANDIDATE_DIR}"
echo ""

if [[ ! -x "${RUNTIME_PY}" ]]; then
  echo "Missing runtime python: ${RUNTIME_PY}" >&2
  exit 1
fi

if [[ ! -d "${STAGE_RUN}" ]]; then
  echo "Missing stage run: ${STAGE_RUN}" >&2
  exit 1
fi

if [[ ! -d "${CANDIDATE_DIR}" ]]; then
  echo "Missing candidate dir: ${CANDIDATE_DIR}" >&2
  exit 1
fi

if [[ ! -d "${BATCH_RUN}" ]]; then
  echo "Missing batch run: ${BATCH_RUN}" >&2
  exit 1
fi

while true; do
  echo "=================================================="
  date -u +"UTC %Y-%m-%dT%H:%M:%SZ"
  echo "Polling live OpenPRA single-case job..."
  echo ""

  "${RUNTIME_PY}" scripts/openpra_phase5_collect_single_case_runtime_v1.py \
    --stage-dir "${STAGE_RUN}" \
    --sync-to-candidate

  if [[ ! -f "${COLLECT_REPORT}" ]]; then
    echo "Collect report not found yet: ${COLLECT_REPORT}"
    sleep 60
    continue
  fi

  STATUS="$(
    python3 - <<'PY'
import json
from pathlib import Path
p = Path("_work/openpra_phase5_single_case_runtime_package_v1/20260411_020049Z_phase2b_row_1037/quantum_collect_report_p1_v1.json")
obj = json.loads(p.read_text(encoding="utf-8"))
print(obj.get("status", "UNKNOWN"))
PY
  )"

  RAW_READY="$(
    python3 - <<'PY'
import json
from pathlib import Path
p = Path("_work/openpra_phase5_single_case_runtime_package_v1/20260411_020049Z_phase2b_row_1037/quantum_collect_report_p1_v1.json")
obj = json.loads(p.read_text(encoding="utf-8"))
print("true" if obj.get("raw_counts_populated") else "false")
PY
  )"

  JOB_ID="$(
    python3 - <<'PY'
import json
from pathlib import Path
p = Path("_work/openpra_phase5_single_case_runtime_package_v1/20260411_020049Z_phase2b_row_1037/quantum_collect_report_p1_v1.json")
obj = json.loads(p.read_text(encoding="utf-8"))
print(obj.get("job_id", "UNKNOWN"))
PY
  )"

  echo "JOB_ID=${JOB_ID}"
  echo "STATUS=${STATUS}"
  echo "RAW_READY=${RAW_READY}"
  echo ""

  if [[ "${RAW_READY}" == "true" ]]; then
    echo "Counts are ready. Building quantum_recovered_mcs.json ..."
    echo ""

    python3 scripts/openpra_phase5_build_quantum_mcs_from_raw_counts_v1.py \
      --batch-run "${BATCH_RUN}" \
      --candidate-dir "${CANDIDATE_DIR}"

    echo ""
    echo "===== FINAL COLLECT REPORT ====="
    sed -n '1,240p' "${COLLECT_REPORT}"
    echo ""
    echo "===== CANDIDATE RAW COUNTS ====="
    sed -n '1,220p' "${CANDIDATE_DIR}/raw_counts.json"
    echo ""
    echo "===== QUANTUM MCS BUILD SUMMARY ====="
    sed -n '1,220p' "${CANDIDATE_DIR}/quantum_recovered_mcs_build_summary.json"
    echo ""
    echo "===== QUANTUM RECOVERED MCS ====="
    sed -n '1,260p' "${CANDIDATE_DIR}/quantum_recovered_mcs.json"
    break
  fi

  echo "Job not done yet. Sleeping 60 seconds..."
  echo ""
  sleep 60
done
