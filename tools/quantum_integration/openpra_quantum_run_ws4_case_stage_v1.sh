#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

WORKSPACE_BASE="_work/openpra_quantum_ws4_execution_workspace_v1"

usage() {
  echo "Usage:"
  echo "  $0 --selection-rank 6 --stage preparation --cmd 'python3 my_prep_runner.py --case phase2b_row_17608'"
  echo "  $0 --selection-rank 6 --stage statevector --cmd 'python3 my_state_runner.py --case phase2b_row_17608'"
  echo "  $0 --selection-rank 6 --stage recovery --cmd 'python3 my_recovery_runner.py --case phase2b_row_17608'"
  exit 1
}

latest_dir() {
  local glob_path="$1"
  ls -1dt $glob_path 2>/dev/null | head -n 1 || true
}

SELECTION_RANK=""
PHASE2B_ROW_ID=""
STAGE=""
CMD=""
NOTES_PREFIX=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --selection-rank)
      SELECTION_RANK="${2:-}"
      shift 2
      ;;
    --phase2b-row-id)
      PHASE2B_ROW_ID="${2:-}"
      shift 2
      ;;
    --stage)
      STAGE="${2:-}"
      shift 2
      ;;
    --cmd)
      CMD="${2:-}"
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

if [[ -z "${STAGE}" || -z "${CMD}" ]]; then
  usage
fi

if [[ -z "${SELECTION_RANK}" && -z "${PHASE2B_ROW_ID}" ]]; then
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

CASE_SELECTOR_FLAG=""
CASE_SELECTOR_VALUE=""
if [[ -n "${SELECTION_RANK}" ]]; then
  CASE_SELECTOR_FLAG="--selection-rank"
  CASE_SELECTOR_VALUE="${SELECTION_RANK}"
else
  CASE_SELECTOR_FLAG="--phase2b-row-id"
  CASE_SELECTOR_VALUE="${PHASE2B_ROW_ID}"
fi

TRANSITION_START=""
TRANSITION_DONE=""
case "${STAGE}" in
  preparation)
    TRANSITION_START="prep_start"
    TRANSITION_DONE="prep_done"
    ;;
  statevector)
    TRANSITION_START="state_start"
    TRANSITION_DONE="state_done"
    ;;
  recovery)
    TRANSITION_START="recovery_start"
    TRANSITION_DONE="recovery_done"
    ;;
esac

echo "============================================================"
echo "WS4 STAGE START"
echo "============================================================"
tools/quantum_integration/openpra_quantum_run_ws4_case_transition_v1.sh \
  "${CASE_SELECTOR_FLAG}" "${CASE_SELECTOR_VALUE}" \
  "${TRANSITION_START}"

echo
echo "============================================================"
echo "EXECUTING STAGE COMMAND"
echo "============================================================"
echo "STAGE=${STAGE}"
echo "COMMAND=${CMD}"

set +e
bash -lc "${CMD}"
RC=$?
set -e

if [[ ${RC} -ne 0 ]]; then
  echo
  echo "============================================================"
  echo "STAGE FAILED"
  echo "============================================================"
  python3 tools/quantum_integration/openpra_quantum_update_ws4_case_result_v1.py \
    "${CASE_SELECTOR_FLAG}" "${CASE_SELECTOR_VALUE}" \
    "--${STAGE}-status" failed \
    --notes "${NOTES_PREFIX}${STAGE} command failed with exit code ${RC}"

  tools/quantum_integration/openpra_quantum_run_ws4_status_cycle_v1.sh
  exit ${RC}
fi

echo
echo "============================================================"
echo "WS4 STAGE COMPLETE"
echo "============================================================"
tools/quantum_integration/openpra_quantum_run_ws4_case_transition_v1.sh \
  "${CASE_SELECTOR_FLAG}" "${CASE_SELECTOR_VALUE}" \
  "${TRANSITION_DONE}"

echo
echo "WS4 stage runner complete."
