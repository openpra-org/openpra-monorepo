#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
cd "${REPO_ROOT}"

UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"
OUT_ROOT="${REPO_ROOT}/artifacts/quantum_integration/HANDOFF_openpra_quantum_integration_${UTC_NOW}"
BUNDLE_DIR="${OUT_ROOT}/openpra_quantum_integration_handoff_bundle"
SRC_DIR="${BUNDLE_DIR}/source"
ART_DIR="${BUNDLE_DIR}/artifacts"
META_DIR="${BUNDLE_DIR}/meta"

mkdir -p "${SRC_DIR}" "${ART_DIR}" "${META_DIR}"

echo "==> Capturing git metadata"
git rev-parse --abbrev-ref HEAD > "${META_DIR}/branch.txt"
git rev-parse HEAD > "${META_DIR}/head.txt"
git status --short > "${META_DIR}/git_status_short.txt"
git log --oneline -n 60 > "${META_DIR}/git_log_oneline_60.txt"
git log --oneline --grep='OpenPRA quantum' -n 120 > "${META_DIR}/quantum_commit_spine.txt"

echo "==> Locating latest authoritative artifact directories"
LATEST_WRAPUP="$(ls -td artifacts/quantum_integration/merge_readiness_wrapup_pass11_* 2>/dev/null | head -n 1 || true)"
LATEST_HANDOFF_BUNDLE="$(ls -td artifacts/quantum_integration/release_handoff_bundle_pass10_* 2>/dev/null | head -n 1 || true)"
LATEST_HANDOFF_AUDIT="$(ls -td artifacts/quantum_integration/workflow_handoff_audit_pass9_* 2>/dev/null | head -n 1 || true)"
LATEST_RELEASE_BUNDLE="$(ls -td artifacts/quantum_integration/workflow_release_bundle_pass7_* 2>/dev/null | head -n 1 || true)"
LATEST_RELEASE_SUMMARY="$(ls -td artifacts/quantum_integration/workflow_release_summary_pass5_* 2>/dev/null | head -n 1 || true)"
LATEST_RELEASE_MANIFEST="$(ls -td artifacts/quantum_integration/workflow_release_manifest_pass6_* 2>/dev/null | head -n 1 || true)"

printf '%s\n' \
  "LATEST_WRAPUP=${LATEST_WRAPUP}" \
  "LATEST_HANDOFF_BUNDLE=${LATEST_HANDOFF_BUNDLE}" \
  "LATEST_HANDOFF_AUDIT=${LATEST_HANDOFF_AUDIT}" \
  "LATEST_RELEASE_BUNDLE=${LATEST_RELEASE_BUNDLE}" \
  "LATEST_RELEASE_SUMMARY=${LATEST_RELEASE_SUMMARY}" \
  "LATEST_RELEASE_MANIFEST=${LATEST_RELEASE_MANIFEST}" \
  > "${META_DIR}/latest_artifact_dirs.txt"

echo "==> Copying latest audit and release artifacts"
for d in \
  "${LATEST_WRAPUP}" \
  "${LATEST_HANDOFF_BUNDLE}" \
  "${LATEST_HANDOFF_AUDIT}" \
  "${LATEST_RELEASE_BUNDLE}" \
  "${LATEST_RELEASE_SUMMARY}" \
  "${LATEST_RELEASE_MANIFEST}"
do
  if [[ -n "${d}" && -d "${d}" ]]; then
    cp -a "${d}" "${ART_DIR}/"
  fi
done

echo "==> Copying authoritative source trees"
mkdir -p "${SRC_DIR}/packages/quantum-readiness/src"
mkdir -p "${SRC_DIR}/packages/web-backend/src"
mkdir -p "${SRC_DIR}/packages/web-backend/tests"
mkdir -p "${SRC_DIR}/tools"

cp -a packages/quantum-readiness/src/lib "${SRC_DIR}/packages/quantum-readiness/src/"
cp -a packages/web-backend/src/quantumReadiness "${SRC_DIR}/packages/web-backend/src/"

find packages/web-backend/tests -maxdepth 1 -type f \( \
  -name 'quantumReadiness*.spec.ts' -o \
  -name 'openPraReleaseArtifacts.http.spec.ts' \
\) -print0 | while IFS= read -r -d '' f; do
  cp -a "${f}" "${SRC_DIR}/packages/web-backend/tests/"
done

mkdir -p "${SRC_DIR}/tools/quantum_integration"
find tools/quantum_integration -maxdepth 1 -type f -name 'openpra_quantum_*.sh' \
  ! -name 'openpra_quantum_importance_comparison_write_pass1_v1.sh' \
  ! -name 'openpra_quantum_workflow_handoff_audit_pass9_v1.sh' \
  ! -name 'openpra_quantum_workflow_release_bundle_pass7_v1.sh' \
  ! -name 'openpra_quantum_workflow_release_manifest_pass6_v1.sh' \
  -print0 | while IFS= read -r -d '' f; do
    cp -a "${f}" "${SRC_DIR}/tools/quantum_integration/"
done

echo "==> Writing new chat handoff prompt"
cat > "${META_DIR}/NEW_CHAT_HANDOFF_PROMPT.txt" <<'EOF'
NEW CHAT HANDOFF PROMPT

You are taking over an active OpenPRA quantum integration project for Devin Peters.

Read this entire prompt first.
Then use the uploaded handoff bundle as the authoritative project snapshot.
Do not restart discovery from scratch.
Do not ask me to re explain things that are already in this handoff or in the uploaded bundle unless something is truly missing.

PROJECT GOAL

The overall goal is to complete the OpenPRA integration with quantum computing so a PRA practitioner can use OpenPRA to:

1. identify a tractable subtree
2. generate readiness and preparation artifacts
3. choose execution mode
4. execute through simulator, emulator, or real quantum hardware when available
5. recover and compare results against the classical baseline
6. inspect provenance and export a release ready handoff bundle

CURRENT AUTHORITATIVE STATUS

The backend integration track is complete, handoff ready, and merge ready.

Latest authoritative backend branch state:
branch: feature/openpra_quantum_integration_v1
head: ce2e142c479cc07c87be3f7b8236f78efa4aa8b5

Latest merge readiness result:
quantum_readiness test: PASS
web_backend test: PASS
quantum_readiness build: PASS
tracked noise: 0
unapproved untracked files: 0
merge_ready: true

Latest validated web backend state:
75 suites passing
656 tests passing

WHAT HAS BEEN COMPLETED

The backend quantum integration now includes:

1. workflow run scaffold
2. preparation workflow run
3. execution workflow run
4. recovery workflow run
5. recovery batch workflow run
6. full pipeline workflow run
7. workflow by id access paths
8. workflow inspection
9. workflow listing
10. latest workflow run lookup
11. latest workflow run by kind
12. latest workflow run by target
13. preparation artifact exposure and writes
14. execution artifact exposure and writes
15. recovery artifact exposure and writes
16. recovery batch rollup writes
17. importance comparison
18. importance comparison writes
19. importance comparison writes by target
20. importance comparison writes by kind
21. importance comparison writes by workflow run
22. importance reports
23. importance report writes
24. importance report writes by target
25. importance report writes by kind
26. importance report writes by workflow run
27. workflow release summary
28. workflow release manifest
29. workflow release bundle
30. workflow release bundle writes by target
31. workflow release bundle writes by kind
32. workflow handoff audit
33. final release handoff bundle
34. merge readiness wrapup helper and final merge readiness confirmation

The backend branch is not the current problem.
Do not reopen backend feature plumbing unless there is a concrete defect.

WHAT REMAINS TO COMPLETE THE FULL PROJECT

The project as a whole is not fully done yet.
The main remaining work is outside the now completed backend service layer.

Remaining major work from the plan:

1. provider execution maturity
   simulator provider
   emulator provider
   IBM hardware provider when practical and stable

2. broader validation
   stratified cohort coverage
   broader preparation validation
   synthetic execution and exact recovery checks
   hardware overlap validation where data exists
   formal validation report

3. actual OpenPRA user experience
   readiness dashboard
   subtree detail page
   execution mode selection
   recovery results view
   importance comparison view
   provenance and export page

4. release documentation
   operator guide
   developer guide
   provider configuration guide
   sample walkthrough
   release positioning review for any first claim

CURRENT RECOMMENDED ORDER OF WORK

1. treat the backend branch as the authoritative backend baseline
2. do not add more backend endpoints unless a real defect appears
3. decide and plan the next major phase:
   provider layer first, or frontend first
4. build a concrete work plan for the remaining full project
5. use the uploaded handoff bundle as the code and artifact reference for informed decisions

USER PREFERENCES AND WORKING RULES

1. Keep moving forward.
2. Do not waste time re explaining things already settled.
3. Do not ask repetitive clarification questions.
4. Be direct, accurate, and audit ready.
5. Consolidate steps when safe.
6. When editing files, provide full file contents, not partial diffs.
7. Keep unrelated Phase 5 scripts out of this integration work.
8. Avoid side explorations unless clearly justified.
9. Focus on getting the project finished as a whole, not endlessly extending the backend.

REPO AND PATHS

Repo root:
 /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

Primary branch:
 feature/openpra_quantum_integration_v1

IMPORTANT UNRELATED ITEMS TO IGNORE

These are not part of the completed backend tranche and should not be staged into this integration work:

1. 20260415_004659Z
2. scripts/openpra_phase5 and other phase5 true_new helpers
3. obsolete failed helper scripts:
   tools/quantum_integration/openpra_quantum_importance_comparison_write_pass1_v1.sh
   tools/quantum_integration/openpra_quantum_workflow_handoff_audit_pass9_v1.sh
   tools/quantum_integration/openpra_quantum_workflow_release_bundle_pass7_v1.sh
   tools/quantum_integration/openpra_quantum_workflow_release_manifest_pass6_v1.sh

WHAT I NEED FROM YOU NOW

1. Read the uploaded handoff bundle and use it as the source of truth.
2. Confirm the remaining work to finish the full project.
3. Propose the most efficient next major phase.
4. Then help me execute that phase without redoing backend work that is already complete.

END OF HANDOFF PROMPT
EOF

echo "==> Writing bundle inventory"
(
  cd "${BUNDLE_DIR}"
  find . -type f | sort
) > "${META_DIR}/bundle_inventory.txt"

echo "==> Creating tarball and SHA256"
cd "${OUT_ROOT}"
TAR_NAME="$(basename "${BUNDLE_DIR}").tar.gz"
tar -czf "${TAR_NAME}" "$(basename "${BUNDLE_DIR}")"
sha256sum "${TAR_NAME}" > "${TAR_NAME}.sha256"

echo
echo "DONE"
echo "Output root: ${OUT_ROOT}"
echo "Bundle directory: ${BUNDLE_DIR}"
echo "Tarball: ${OUT_ROOT}/${TAR_NAME}"
echo "SHA256: ${OUT_ROOT}/${TAR_NAME}.sha256"
echo
echo "To copy to Windows, run something like:"
echo 'scp clusteradmin@440work:'"${OUT_ROOT}/${TAR_NAME}"' "C:\Users\devin\OneDrive\Documents\NC State\OpenPRA\tars"'
echo 'scp clusteradmin@440work:'"${OUT_ROOT}/${TAR_NAME}.sha256"' "C:\Users\devin\OneDrive\Documents\NC State\OpenPRA\tars"'
