#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

SELECTION_RANKS=""
PREP_CMD_TEMPLATE=""
STATE_CMD_TEMPLATE=""
RECOVERY_CMD_TEMPLATE=""
MAX_PARALLEL=2

usage() {
  echo "Usage:"
  echo "  $0 --selection-ranks 15,16,17,18 \\"
  echo "     --prep-cmd-template 'echo running preparation for {phase2b_row_id}' \\"
  echo "     --state-cmd-template 'echo running statevector for {phase2b_row_id}' \\"
  echo "     --recovery-cmd-template 'echo running recovery for {phase2b_row_id}' \\"
  echo "     --max-parallel 2"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --selection-ranks)
      SELECTION_RANKS="${2:-}"
      shift 2
      ;;
    --prep-cmd-template)
      PREP_CMD_TEMPLATE="${2:-}"
      shift 2
      ;;
    --state-cmd-template)
      STATE_CMD_TEMPLATE="${2:-}"
      shift 2
      ;;
    --recovery-cmd-template)
      RECOVERY_CMD_TEMPLATE="${2:-}"
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

if [[ -z "${SELECTION_RANKS}" || -z "${PREP_CMD_TEMPLATE}" || -z "${STATE_CMD_TEMPLATE}" || -z "${RECOVERY_CMD_TEMPLATE}" ]]; then
  usage
fi

echo "============================================================"
echo "WS4 FULL COHORT RUN"
echo "============================================================"
echo "selection_ranks=${SELECTION_RANKS}"
echo "max_parallel=${MAX_PARALLEL}"

echo
echo "============================================================"
echo "STAGE 1 OF 3: PREPARATION"
echo "============================================================"
tools/quantum_integration/openpra_quantum_run_ws4_stage_batch_v2.sh \
  --stage preparation \
  --selection-ranks "${SELECTION_RANKS}" \
  --cmd-template "${PREP_CMD_TEMPLATE}" \
  --max-parallel "${MAX_PARALLEL}"

echo
echo "============================================================"
echo "STAGE 2 OF 3: STATEVECTOR"
echo "============================================================"
tools/quantum_integration/openpra_quantum_run_ws4_stage_batch_v2.sh \
  --stage statevector \
  --selection-ranks "${SELECTION_RANKS}" \
  --cmd-template "${STATE_CMD_TEMPLATE}" \
  --max-parallel "${MAX_PARALLEL}"

echo
echo "============================================================"
echo "STAGE 3 OF 3: RECOVERY"
echo "============================================================"
tools/quantum_integration/openpra_quantum_run_ws4_stage_batch_v2.sh \
  --stage recovery \
  --selection-ranks "${SELECTION_RANKS}" \
  --cmd-template "${RECOVERY_CMD_TEMPLATE}" \
  --max-parallel "${MAX_PARALLEL}"

echo
echo "============================================================"
echo "NEXT CASE PICK"
echo "============================================================"
python3 tools/quantum_integration/openpra_quantum_pick_ws4_next_case_v1.py

echo
echo "WS4 full cohort run complete."
