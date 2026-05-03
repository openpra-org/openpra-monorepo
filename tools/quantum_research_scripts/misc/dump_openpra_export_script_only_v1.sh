#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_DIR="${REPO_ROOT}/_work/openpra_export_script_only_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="${OUT_DIR}/${STAMP}"
OUT_FILE="${RUN_DIR}/export_openpra_quantum_preparation_v1.py.txt"

mkdir -p "${RUN_DIR}"

cat "${REPO_ROOT}/scripts/export_openpra_quantum_preparation_v1.py" > "${OUT_FILE}"

echo "RUN_DIR=${RUN_DIR}"
echo "OUT_FILE=${OUT_FILE}"
echo ""
wc -l "${OUT_FILE}"
sed -n '1,260p' "${OUT_FILE}"
sed -n '261,520p' "${OUT_FILE}"
sed -n '521,780p' "${OUT_FILE}"
sed -n '781,1040p' "${OUT_FILE}"
