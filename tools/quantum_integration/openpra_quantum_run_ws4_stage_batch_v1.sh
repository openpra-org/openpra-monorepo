#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

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

OPS_BASE="_work/openpra_quantum_ws4_ops_bundle_v1"
MAX_PARALLEL=1
STAGE=""
SELECTION_RANKS=""
CMD_TEMPLATE=""

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

latest_dir() {
  local glob_path="$1"
  ls -1dt $glob_path 2>/dev/null | head -n 1 || true
}

OPS_DIR="$(latest_dir "${OPS_BASE}/OPENPRA_WS4_OPS_BUNDLE_v1_*")"
MASTER_CSV="${OPS_DIR}/CONTROL_ROOM/openpra_ws4_ops_master_sheet_v1.csv"

if [[ ! -f "${MASTER_CSV}" ]]; then
  echo "Missing master CSV: ${MASTER_CSV}"
  exit 1
fi

resolve_field() {
  local selection_rank="$1"
  local column="$2"
  python3 - <<'PY' "${MASTER_CSV}" "${selection_rank}" "${column}"
import csv, sys
path, selection_rank, column = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, "r", encoding="utf-8", newline="") as f:
    rows = list(csv.DictReader(f))
for row in rows:
    if row.get("selection_rank","").strip() == selection_rank:
        print(row.get(column,"").strip())
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

run_one() {
  local selection_rank="$1"
  local cmd
  cmd="$(build_cmd "${selection_rank}")"

  echo
  echo "============================================================"
  echo "WS4 BATCH ITEM"
  echo "============================================================"
  echo "selection_rank=${selection_rank}"
  echo "stage=${STAGE}"
  echo "cmd=${cmd}"

  tools/quantum_integration/openpra_quantum_run_ws4_case_stage_v1.sh \
    --selection-rank "${selection_rank}" \
    --stage "${STAGE}" \
    --cmd "${cmd}"
}

IFS=',' read -r -a RANK_ARRAY <<< "${SELECTION_RANKS}"

if [[ "${MAX_PARALLEL}" -le 1 ]]; then
  for rank in "${RANK_ARRAY[@]}"; do
    rank="$(echo "${rank}" | xargs)"
    [[ -z "${rank}" ]] && continue
    run_one "${rank}"
  done
else
  pids=()
  active=0
  for rank in "${RANK_ARRAY[@]}"; do
    rank="$(echo "${rank}" | xargs)"
    [[ -z "${rank}" ]] && continue

    (
      run_one "${rank}"
    ) &
    pids+=($!)
    active=$((active + 1))

    if [[ "${active}" -ge "${MAX_PARALLEL}" ]]; then
      wait -n
      active=$((active - 1))
    fi
  done
  wait
fi

echo
echo "============================================================"
echo "FINAL WS4 SUMMARY"
echo "============================================================"
LATEST_OPS="$(latest_dir "${OPS_BASE}/OPENPRA_WS4_OPS_BUNDLE_v1_*")"
sed -n '1,80p' "${LATEST_OPS}/CONTROL_ROOM/openpra_ws4_ops_summary_v1.csv" || true
