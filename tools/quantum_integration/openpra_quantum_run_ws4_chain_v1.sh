#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

run_python_step() {
  local rel_path="$1"
  echo
  echo "============================================================"
  echo "RUNNING: $rel_path"
  echo "============================================================"
  chmod 755 "$rel_path"
  python3 "$rel_path"
}

show_latest_dir() {
  local rel_base="$1"
  if [ -d "$rel_base" ]; then
    local latest
    latest="$(ls -1dt "$rel_base"/* 2>/dev/null | head -n 1 || true)"
    if [ -n "$latest" ]; then
      echo "$latest"
    else
      echo "(no runs found under $rel_base)"
    fi
  else
    echo "(missing directory $rel_base)"
  fi
}

run_python_step "tools/quantum_integration/openpra_quantum_init_ws4_broader_cohort_validation_v1.py"
run_python_step "tools/quantum_integration/openpra_quantum_inventory_ws4_candidate_sources_v1.py"
run_python_step "tools/quantum_integration/openpra_quantum_build_ws4_source_shortlist_v1.py"
run_python_step "tools/quantum_integration/openpra_quantum_build_ws4_tier1_review_slate_v1.py"
run_python_step "tools/quantum_integration/openpra_quantum_build_ws4_tier1_source_pack_v1.py"
run_python_step "tools/quantum_integration/openpra_quantum_build_ws4_tier1_inspection_digest_v1.py"
run_python_step "tools/quantum_integration/openpra_quantum_build_ws4_selection_seed_v1.py"

echo
echo "============================================================"
echo "LATEST WS4 ARTIFACT DIRECTORIES"
echo "============================================================"
echo "Scaffold:"
show_latest_dir "_work/openpra_quantum_ws4_broader_cohort_validation_v1"
echo
echo "Candidate source inventory:"
show_latest_dir "_work/openpra_quantum_ws4_candidate_source_inventory_v1"
echo
echo "Source shortlist:"
show_latest_dir "_work/openpra_quantum_ws4_source_shortlist_v1"
echo
echo "Tier1 review slate:"
show_latest_dir "_work/openpra_quantum_ws4_tier1_review_slate_v1"
echo
echo "Tier1 source pack:"
show_latest_dir "_work/openpra_quantum_ws4_tier1_source_pack_v1"
echo
echo "Tier1 inspection digest:"
show_latest_dir "_work/openpra_quantum_ws4_tier1_inspection_digest_v1"
echo
echo "Selection seed:"
show_latest_dir "_work/openpra_quantum_ws4_selection_seed_v1"

echo
echo "============================================================"
echo "GIT STATUS"
echo "============================================================"
git status --short
