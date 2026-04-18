#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

OPS_BASE="_work/openpra_quantum_ws4_ops_bundle_v1"
BATCH_RUNS_BASE="_work/openpra_quantum_ws4_stage_batch_runs_v1"
MAX_PARALLEL=1
STAGE=""
SELECTION_RANKS=""
CMD_TEMPLATE=""
NOTES_PREFIX=""

usage() {
  echo "Usage:"
  echo "  $0 --stage preparation --selection-ranks 7,8,9 --cmd-template 'python3 runner.py --case {phase2b_row_id}'"
  echo "  $0 --stage statevector --selection-ranks 7,8 --cmd-template 'python3 state_runner.py --case {phase2b_row_id}' --max-parallel 2"
  echo
  echo "Placeholders allowed in --cmd-template:"
  echo "  {selection_rank}"
  echo "  {case_id}"
  echo "  {phase2b_row_id}"
  echo "  {root_gate_id}"
  echo "  {selection_bucket}"
  echo "  {source_relative_path}"
  exit 1
}

latest_dir() {
  local glob_path="$1"
  ls -1dt $glob_path 2>/dev/null | head -n 1 || true
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage)
      STAGE="${2:-}"
      shift 2
      ;;
    --selection-ranks)
      SELECTION_RANKS="${2:-}"
      shift 2
      ;;
    --cmd-template)
      CMD_TEMPLATE="${2:-}"
      shift 2
      ;;
    --max-parallel)
      MAX_PARALLEL="${2:-}"
      shift 2
      ;;
    --notes-prefix)
      NOTES_PREFIX="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      ;;
  esac
done

if [[ -z "${STAGE}" || -z "${SELECTION_RANKS}" || -z "${CMD_TEMPLATE}" ]]; then
  usage
fi

case "${STAGE}" in
  preparation|statevector|recovery)
    ;;
  *)
    echo "Invalid stage: ${STAGE}"
    usage
    ;;
esac

OPS_DIR="$(latest_dir "${OPS_BASE}/OPENPRA_WS4_OPS_BUNDLE_v1_*")"
MASTER_CSV="${OPS_DIR}/CONTROL_ROOM/openpra_ws4_ops_master_sheet_v1.csv"
if [[ ! -f "${MASTER_CSV}" ]]; then
  echo "Missing master CSV: ${MASTER_CSV}"
  exit 1
fi

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BATCH_DIR="${BATCH_RUNS_BASE}/WS4_STAGE_BATCH_${STAGE}_v2_${STAMP}"
LOG_DIR="${BATCH_DIR}/logs"
RESULTS_DIR="${BATCH_DIR}/results"
mkdir -p "${LOG_DIR}" "${RESULTS_DIR}"

resolve_field() {
  local selection_rank="$1"
  local column="$2"
  python3 - <<'PY' "${MASTER_CSV}" "${selection_rank}" "${column}"
import csv, sys
path, selection_rank, column = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, "r", encoding="utf-8", newline="") as f:
    rows = list(csv.DictReader(f))
for row in rows:
    if row.get("selection_rank", "").strip() == selection_rank:
        print(row.get(column, "").strip())
        raise SystemExit(0)
raise SystemExit(1)
PY
}

build_cmd() {
  local selection_rank="$1"
  local case_id phase2b_row_id root_gate_id selection_bucket source_relative_path cmd
  case_id="$(resolve_field "${selection_rank}" "case_id")"
  phase2b_row_id="$(resolve_field "${selection_rank}" "phase2b_row_id")"
  root_gate_id="$(resolve_field "${selection_rank}" "root_gate_id")"
  selection_bucket="$(resolve_field "${selection_rank}" "selection_bucket")"
  source_relative_path="$(resolve_field "${selection_rank}" "source_relative_path")"

  cmd="${CMD_TEMPLATE}"
  cmd="${cmd//\{selection_rank\}/${selection_rank}}"
  cmd="${cmd//\{case_id\}/${case_id}}"
  cmd="${cmd//\{phase2b_row_id\}/${phase2b_row_id}}"
  cmd="${cmd//\{root_gate_id\}/${root_gate_id}}"
  cmd="${cmd//\{selection_bucket\}/${selection_bucket}}"
  cmd="${cmd//\{source_relative_path\}/${source_relative_path}}"
  printf '%s' "${cmd}"
}

run_case_stage() {
  local selection_rank="$1"
  local case_id phase2b_row_id root_gate_id selection_bucket source_relative_path cmd
  local log_file result_file stage_flag rc status note

  case_id="$(resolve_field "${selection_rank}" "case_id")"
  phase2b_row_id="$(resolve_field "${selection_rank}" "phase2b_row_id")"
  root_gate_id="$(resolve_field "${selection_rank}" "root_gate_id")"
  selection_bucket="$(resolve_field "${selection_rank}" "selection_bucket")"
  source_relative_path="$(resolve_field "${selection_rank}" "source_relative_path")"
  cmd="$(build_cmd "${selection_rank}")"

  log_file="${LOG_DIR}/${selection_rank}_${phase2b_row_id}.log"
  result_file="${RESULTS_DIR}/${selection_rank}_${phase2b_row_id}.csv"

  {
    echo "selection_rank=${selection_rank}"
    echo "case_id=${case_id}"
    echo "phase2b_row_id=${phase2b_row_id}"
    echo "stage=${STAGE}"
    echo "cmd=${cmd}"
    echo "started_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo
  } > "${log_file}"

  stage_flag="--${STAGE}-status"

  python3 tools/quantum_integration/openpra_quantum_update_ws4_case_result_v1.py \
    --selection-rank "${selection_rank}" \
    "${stage_flag}" in_progress \
    --notes "${NOTES_PREFIX}${STAGE} batch started" >> "${log_file}" 2>&1

  set +e
  bash -lc "${cmd}" >> "${log_file}" 2>&1
  rc=$?
  set -e

  if [[ ${rc} -eq 0 ]]; then
    status="done"
    note="${NOTES_PREFIX}${STAGE} batch complete"
  else
    status="failed"
    note="${NOTES_PREFIX}${STAGE} batch failed with exit code ${rc}"
  fi

  python3 tools/quantum_integration/openpra_quantum_update_ws4_case_result_v1.py \
    --selection-rank "${selection_rank}" \
    "${stage_flag}" "${status}" \
    --notes "${note}" >> "${log_file}" 2>&1

  {
    echo "selection_rank,case_id,phase2b_row_id,stage,final_status,exit_code,root_gate_id,selection_bucket,source_relative_path"
    echo "${selection_rank},${case_id},${phase2b_row_id},${STAGE},${status},${rc},${root_gate_id},${selection_bucket},${source_relative_path}"
  } > "${result_file}"

  return 0
}

IFS=',' read -r -a RANK_ARRAY <<< "${SELECTION_RANKS}"

active=0
for rank in "${RANK_ARRAY[@]}"; do
  rank="$(echo "${rank}" | xargs)"
  [[ -z "${rank}" ]] && continue

  run_case_stage "${rank}" &
  active=$((active + 1))

  if [[ "${active}" -ge "${MAX_PARALLEL}" ]]; then
    wait -n
    active=$((active - 1))
  fi
done
wait

SUMMARY_CSV="${BATCH_DIR}/batch_summary_v1.csv"
{
  echo "selection_rank,case_id,phase2b_row_id,stage,final_status,exit_code,root_gate_id,selection_bucket,source_relative_path"
  cat "${RESULTS_DIR}"/*.csv | tail -n +2
} > "${SUMMARY_CSV}"

SUCCESS_COUNT="$(awk -F',' 'NR>1 && $5=="done" {c++} END {print c+0}' "${SUMMARY_CSV}")"
FAIL_COUNT="$(awk -F',' 'NR>1 && $5=="failed" {c++} END {print c+0}' "${SUMMARY_CSV}")"

META_JSON="${BATCH_DIR}/batch_meta_v1.json"
cat > "${META_JSON}" <<EOF
{
  "stage": "${STAGE}",
  "selection_ranks": "${SELECTION_RANKS}",
  "max_parallel": ${MAX_PARALLEL},
  "success_count": ${SUCCESS_COUNT},
  "fail_count": ${FAIL_COUNT},
  "summary_csv": "${SUMMARY_CSV}",
  "logs_dir": "${LOG_DIR}",
  "generated_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo
echo "============================================================"
echo "RUNNING SINGLE FINAL WS4 STATUS CYCLE"
echo "============================================================"
tools/quantum_integration/openpra_quantum_run_ws4_status_cycle_v1.sh

echo
echo "============================================================"
echo "BATCH SUMMARY"
echo "============================================================"
cat "${SUMMARY_CSV}"
echo
echo "success_count=${SUCCESS_COUNT}"
echo "fail_count=${FAIL_COUNT}"
echo "batch_dir=${BATCH_DIR}"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  exit 1
fi
