#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if [[ $# -lt 1 ]]; then
  echo "Usage:"
  echo "  tools/quantum_integration/openpra_quantum_run_ws4_case_update_cycle_v1.sh --selection-rank 1 --preparation-status done --notes \"prep complete\""
  echo "  tools/quantum_integration/openpra_quantum_run_ws4_case_update_cycle_v1.sh --phase2b-row-id phase2b_row_0341 --statevector-status in_progress"
  exit 1
fi

echo "============================================================"
echo "WS4 CASE UPDATE"
echo "============================================================"
chmod 755 tools/quantum_integration/openpra_quantum_update_ws4_case_result_v1.py
python3 tools/quantum_integration/openpra_quantum_update_ws4_case_result_v1.py "$@"

echo
echo "============================================================"
echo "WS4 STATUS CYCLE"
echo "============================================================"
chmod 755 tools/quantum_integration/openpra_quantum_run_ws4_status_cycle_v1.sh
tools/quantum_integration/openpra_quantum_run_ws4_status_cycle_v1.sh

echo
echo "============================================================"
echo "DONE"
echo "============================================================"
