#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

run_step() {
  local rel_path="$1"
  echo
  echo "============================================================"
  echo "RUNNING: $rel_path"
  echo "============================================================"
  chmod 755 "$rel_path"
  if [[ "$rel_path" == *.py ]]; then
    python3 "$rel_path"
  else
    "$rel_path"
  fi
}

latest_dir() {
  local glob_path="$1"
  ls -1dt $glob_path 2>/dev/null | head -n 1 || true
}

echo "WS4 consolidated refresh starting..."
echo "REPO_ROOT=$REPO_ROOT"

run_step "tools/quantum_integration/openpra_quantum_build_ws4_validation_control_v1.py"
run_step "tools/quantum_integration/openpra_quantum_build_ws4_execution_package_v1.py"
run_step "tools/quantum_integration/openpra_quantum_build_ws4_ops_bundle_v1.py"
run_step "tools/quantum_integration/openpra_quantum_refresh_ws4_ops_views_v1.py"

OPS_DIR="$(latest_dir "_work/openpra_quantum_ws4_ops_bundle_v1/OPENPRA_WS4_OPS_BUNDLE_v1_*")"
CONTROL_DIR="$(latest_dir "_work/openpra_quantum_ws4_validation_control_v1/OPENPRA_WS4_VALIDATION_CONTROL_v1_*")"
PACKAGE_DIR="$(latest_dir "_work/openpra_quantum_ws4_execution_package_v1/OPENPRA_WS4_EXECUTION_PACKAGE_v1_*")"

echo
echo "============================================================"
echo "LATEST DIRECTORIES"
echo "============================================================"
echo "VALIDATION_CONTROL=$CONTROL_DIR"
echo "EXECUTION_PACKAGE=$PACKAGE_DIR"
echo "OPS_BUNDLE=$OPS_DIR"

if [[ -n "${OPS_DIR:-}" ]]; then
  echo
  echo "============================================================"
  echo "OPS SUMMARY"
  echo "============================================================"
  sed -n '1,80p' "$OPS_DIR/CONTROL_ROOM/openpra_ws4_ops_summary_v1.csv" || true

  echo
  echo "============================================================"
  echo "OPS MEMO"
  echo "============================================================"
  sed -n '1,80p' "$OPS_DIR/CONTROL_ROOM/openpra_ws4_ops_bundle_memo_v1.md" || true
fi

echo
echo "============================================================"
echo "GIT STATUS"
echo "============================================================"
git status --short || true

echo
echo "WS4 consolidated refresh complete."
