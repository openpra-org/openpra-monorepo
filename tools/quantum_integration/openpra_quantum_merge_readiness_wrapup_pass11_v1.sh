#!/usr/bin/env bash
set -euo pipefail

SCRIPT_VERSION="1.0.0"
UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: This script must be run inside the OpenPRA git repository."
  exit 1
fi

cd "${REPO_ROOT}"

REPORT_DIR="artifacts/quantum_integration/merge_readiness_wrapup_pass11_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

echo "==> Capturing git state"
git rev-parse --abbrev-ref HEAD > "${REPORT_DIR}/branch.txt"
git rev-parse HEAD > "${REPORT_DIR}/head.txt"
git status --short > "${REPORT_DIR}/git_status_short.txt"
git log --oneline -n 40 > "${REPORT_DIR}/git_log_oneline_40.txt"
git log --oneline --grep='OpenPRA quantum' -n 80 > "${REPORT_DIR}/quantum_commit_spine.txt"

echo "==> Running quantum-readiness tests"
if ./node_modules/.bin/nx test quantum-readiness > "${REPORT_DIR}/nx_test_quantum_readiness.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_test_quantum_readiness.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_test_quantum_readiness.status"
fi

echo "==> Running web-backend tests"
if ./node_modules/.bin/nx test web-backend > "${REPORT_DIR}/nx_test_web_backend.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_test_web_backend.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_test_web_backend.status"
fi

echo "==> Running quantum-readiness build"
if ./node_modules/.bin/nx build quantum-readiness > "${REPORT_DIR}/nx_build_quantum_readiness.log" 2>&1; then
  echo "PASS" > "${REPORT_DIR}/nx_build_quantum_readiness.status"
else
  echo "FAIL" > "${REPORT_DIR}/nx_build_quantum_readiness.status"
fi

python3 <<'PY'
from pathlib import Path
import json
import re

report_dir = Path("artifacts/quantum_integration").glob("merge_readiness_wrapup_pass11_*")
report_dir = sorted(report_dir)[-1]

branch = (report_dir / "branch.txt").read_text(encoding="utf-8").strip()
head = (report_dir / "head.txt").read_text(encoding="utf-8").strip()
status_lines = [
    line.rstrip("\n")
    for line in (report_dir / "git_status_short.txt").read_text(encoding="utf-8").splitlines()
    if line.strip()
]

quantum_test = (report_dir / "nx_test_quantum_readiness.status").read_text(encoding="utf-8").strip()
web_test = (report_dir / "nx_test_web_backend.status").read_text(encoding="utf-8").strip()
build_status = (report_dir / "nx_build_quantum_readiness.status").read_text(encoding="utf-8").strip()

allowed_untracked_prefixes = [
    "?? 20260415_004659Z/",
    "?? scripts/build_openpra_phase5_",
    "?? scripts/checkpoint_openpra_phase5_",
    "?? scripts/extract_openpra_phase5_",
    "?? scripts/find_openpra_phase5_",
    "?? scripts/freeze_openpra_phase5_",
    "?? scripts/harvest_openpra_phase5_",
    "?? scripts/inspect_openpra_phase5_",
    "?? scripts/inventory_openpra_phase5_",
    "?? scripts/materialize_openpra_phase5_",
    "?? scripts/patch_openpra_phase5_",
    "?? scripts/populate_openpra_phase5_",
    "?? scripts/probe_openpra_phase5_",
    "?? scripts/recover_openpra_phase5_",
    "?? scripts/resume_openpra_phase5_",
    "?? scripts/search_openpra_phase5_",
    "?? scripts/stage_openpra_phase5_",
    "?? tools/quantum_integration/openpra_quantum_importance_comparison_write_pass1_v1.sh",
    "?? tools/quantum_integration/openpra_quantum_workflow_handoff_audit_pass9_v1.sh",
    "?? tools/quantum_integration/openpra_quantum_workflow_release_bundle_pass7_v1.sh",
    "?? tools/quantum_integration/openpra_quantum_workflow_release_manifest_pass6_v1.sh",
]

def is_allowed(line: str) -> bool:
    return any(line.startswith(prefix) for prefix in allowed_untracked_prefixes)

tracked_noise = []
unapproved_untracked = []

for line in status_lines:
    if line.startswith("?? "):
        if not is_allowed(line):
            unapproved_untracked.append(line)
    else:
        tracked_noise.append(line)

tests_green = quantum_test == "PASS" and web_test == "PASS" and build_status == "PASS"
clean_enough = len(tracked_noise) == 0 and len(unapproved_untracked) == 0
merge_ready = tests_green and clean_enough

next_actions = []
if tracked_noise:
    next_actions.append("Resolve tracked working tree changes before merge.")
if unapproved_untracked:
    next_actions.append("Review or remove unexpected untracked files before merge.")
if quantum_test != "PASS":
    next_actions.append("Fix quantum-readiness test failures.")
if web_test != "PASS":
    next_actions.append("Fix web-backend test failures.")
if build_status != "PASS":
    next_actions.append("Fix quantum-readiness build failures.")
if not next_actions:
    next_actions.append("Backend integration track is ready for review, handoff, and merge consideration.")

summary = {
    "branch": branch,
    "head": head,
    "tests": {
        "quantum_readiness_test": quantum_test,
        "web_backend_test": web_test,
        "quantum_readiness_build": build_status,
    },
    "working_tree": {
        "tracked_noise": tracked_noise,
        "unapproved_untracked": unapproved_untracked,
        "allowed_untracked_count": sum(1 for line in status_lines if line.startswith("?? ") and is_allowed(line)),
    },
    "assessment": {
        "tests_green": tests_green,
        "clean_enough": clean_enough,
        "merge_ready": merge_ready,
    },
    "next_actions": next_actions,
}

(report_dir / "openpra_quantum_merge_readiness_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\n",
    encoding="utf-8",
)

md = []
md.append("# OpenPRA Quantum Integration Merge Readiness Summary")
md.append("")
md.append(f"Branch: `{branch}`")
md.append(f"HEAD: `{head}`")
md.append("")
md.append("## Validation")
md.append("")
md.append(f"* quantum-readiness test: **{quantum_test}**")
md.append(f"* web-backend test: **{web_test}**")
md.append(f"* quantum-readiness build: **{build_status}**")
md.append("")
md.append("## Working tree")
md.append("")
md.append(f"* tracked noise count: **{len(tracked_noise)}**")
md.append(f"* unapproved untracked count: **{len(unapproved_untracked)}**")
md.append("")
md.append("## Assessment")
md.append("")
md.append(f"* tests green: **{tests_green}**")
md.append(f"* clean enough: **{clean_enough}**")
md.append(f"* merge ready: **{merge_ready}**")
md.append("")
md.append("## Next actions")
md.append("")
for action in next_actions:
    md.append(f"* {action}")
md.append("")

(report_dir / "openpra_quantum_merge_readiness_summary_v1.md").write_text(
    "\n".join(md) + "\n",
    encoding="utf-8",
)
PY

echo "DONE"
echo "Report directory: ${REPORT_DIR}"
echo "quantum-readiness test: $(cat "${REPORT_DIR}/nx_test_quantum_readiness.status")"
echo "web-backend test: $(cat "${REPORT_DIR}/nx_test_web_backend.status")"
echo "quantum-readiness build: $(cat "${REPORT_DIR}/nx_build_quantum_readiness.status")"
