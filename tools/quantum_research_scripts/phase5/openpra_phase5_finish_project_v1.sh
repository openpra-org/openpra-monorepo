#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
DEFAULT_BATCH_ROOT="${ROOT}/_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z"
BATCH_ROOT="${1:-${DEFAULT_BATCH_ROOT}}"

cd "${ROOT}"

echo "ROOT=${ROOT}"
echo "BATCH_ROOT=${BATCH_ROOT}"
echo ""

npx nx test quantum-readiness --skip-nx-cache
npx nx build quantum-readiness --skip-nx-cache

node scripts/openpra_phase5_canonical_openpra_entrypoint_v1.cjs \
  --batch-root "${BATCH_ROOT}" \
  --selection-mode legacy_validated_only

bash scripts/openpra_phase5_package_final_integration_tranche_v1.sh "${BATCH_ROOT}"

python3 scripts/openpra_phase5_build_executed_only_package_release_bundle_v1.py
python3 scripts/openpra_phase5_build_project_closeout_bundle_v1.py
python3 scripts/openpra_phase5_build_final_acceptance_bundle_v1.py

CANON_RUN="$(ls -1dt _work/openpra_phase5_canonical_openpra_entrypoint_v1/*/ | head -n 1)"
FINAL_RUN="$(ls -1dt _work/openpra_phase5_package_final_integration_tranche_v1/*/ | head -n 1)"
REL_RUN="$(ls -1dt _work/openpra_phase5_executed_only_package_release_v1/PHASE5_EXECUTED_ONLY_PACKAGE_RELEASE_BUNDLE_v1_*/ | head -n 1)"
CLOSE_RUN="$(ls -1dt _work/openpra_phase5_project_closeout_bundle_v1/PHASE5_PROJECT_CLOSEOUT_BUNDLE_v1_*/ | head -n 1)"
ACCEPT_RUN="$(ls -1dt _work/openpra_phase5_final_acceptance_bundle_v1/PHASE5_FINAL_ACCEPTANCE_BUNDLE_v1_*/ | head -n 1)"

echo ""
echo "CANON_RUN=${CANON_RUN}"
echo "FINAL_RUN=${FINAL_RUN}"
echo "REL_RUN=${REL_RUN}"
echo "CLOSE_RUN=${CLOSE_RUN}"
echo "ACCEPT_RUN=${ACCEPT_RUN}"
echo ""
echo "===== FINAL ACCEPTANCE README ====="
sed -n '1,220p' "${ACCEPT_RUN}/README.txt"
echo ""
echo "===== FINAL ACCEPTANCE SUMMARY ====="
sed -n '1,260p' "${ACCEPT_RUN}/acceptance_summary.json"
