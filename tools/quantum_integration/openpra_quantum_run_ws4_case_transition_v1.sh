#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if [[ $# -lt 2 ]]; then
  echo "Usage:"
  echo "  $0 --selection-rank 5 prep_start"
  echo "  $0 --selection-rank 5 prep_done_and_state_start"
  echo "  $0 --selection-rank 5 state_done_and_recovery_start"
  echo "  $0 --selection-rank 5 recovery_done"
  echo
  echo "You may also use --phase2b-row-id instead of --selection-rank."
  exit 1
fi

CASE_SELECTOR_FLAG=""
CASE_SELECTOR_VALUE=""
TRANSITION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --selection-rank|--phase2b-row-id)
      CASE_SELECTOR_FLAG="$1"
      CASE_SELECTOR_VALUE="${2:-}"
      shift 2
      ;;
    *)
      TRANSITION="$1"
      shift
      ;;
  esac
done

if [[ -z "${CASE_SELECTOR_FLAG}" || -z "${CASE_SELECTOR_VALUE}" || -z "${TRANSITION}" ]]; then
  echo "Missing case selector or transition."
  exit 1
fi

run_update() {
  tools/quantum_integration/openpra_quantum_run_ws4_case_update_cycle_v1.sh \
    "${CASE_SELECTOR_FLAG}" "${CASE_SELECTOR_VALUE}" "$@"
}

case "${TRANSITION}" in
  prep_start)
    run_update --preparation-status in_progress --notes "Preparation validation started"
    ;;
  prep_done)
    run_update --preparation-status done --notes "Preparation validation complete"
    ;;
  prep_done_and_state_start)
    run_update --preparation-status done --statevector-status in_progress --notes "Preparation validation complete; statevector validation started"
    ;;
  state_start)
    run_update --statevector-status in_progress --notes "Statevector validation started"
    ;;
  state_done)
    run_update --statevector-status done --notes "Statevector validation complete"
    ;;
  state_done_and_recovery_start)
    run_update --statevector-status done --recovery-status in_progress --notes "Statevector validation complete; recovery validation started"
    ;;
  recovery_start)
    run_update --recovery-status in_progress --notes "Recovery validation started"
    ;;
  recovery_done)
    run_update --recovery-status done --notes "Recovery validation complete"
    ;;
  full_pass)
    run_update \
      --preparation-status done \
      --statevector-status done \
      --recovery-status done \
      --overall-status done \
      --notes "Preparation, statevector, and recovery validation complete"
    ;;
  *)
    echo "Unknown transition: ${TRANSITION}"
    echo "Allowed:"
    echo "  prep_start"
    echo "  prep_done"
    echo "  prep_done_and_state_start"
    echo "  state_start"
    echo "  state_done"
    echo "  state_done_and_recovery_start"
    echo "  recovery_start"
    echo "  recovery_done"
    echo "  full_pass"
    exit 1
    ;;
esac
