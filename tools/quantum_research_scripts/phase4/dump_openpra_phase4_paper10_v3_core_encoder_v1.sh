#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${REPO_ROOT}/_work/openpra_phase4_paper10_v3_core_encoder_v1/$(date -u +%Y%m%d_%H%M%SZ)"
OUT_FILE="${RUN_DIR}/OPENPRA_PHASE4_PAPER10_V3_CORE_ENCODER_v1.txt"

mkdir -p "${RUN_DIR}"

V3="/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z_contents/Code/paper10_phaseA_build_qubo_and_circuits_v3.py"

if [ ! -f "${V3}" ]; then
  echo "Missing file: ${V3}" >&2
  exit 1
fi

{
  echo "OPENPRA PHASE 4 PAPER10 V3 CORE ENCODER v1"
  echo "Generated UTC: $(date -u +%Y%m%d_%H%M%SZ)"
  echo "Source: ${V3}"
  echo ""

  echo "===== V3 HEADER ====="
  sed -n '1,220p' "${V3}"
  echo ""

  echo "===== V3 CORE ENCODER 212-420 ====="
  sed -n '212,420p' "${V3}"
  echo ""

  echo "===== V3 BUILD LOOP 520-660 ====="
  sed -n '520,660p' "${V3}"
  echo ""

  echo "===== FROZEN REFERENCE 1037 ====="
  sed -n '1,220p' /mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/derived/per_instance/1037/qubo_model_v1.json
  echo ""

  echo "===== FROZEN REFERENCE 0698 ====="
  sed -n '1,220p' /mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/derived/per_instance/0698/qubo_model_v1.json
  echo ""

  echo "===== FROZEN REFERENCE 0970 ====="
  sed -n '1,260p' /mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/derived/per_instance/0970/qubo_model_v1.json
  echo ""
} > "${OUT_FILE}"

sha256sum "${OUT_FILE}" > "${RUN_DIR}/SHA256SUMS.txt"

echo "RUN_DIR=${RUN_DIR}"
echo "OUT_FILE=${OUT_FILE}"
echo "SHA256=${RUN_DIR}/SHA256SUMS.txt"
echo ""
echo "===== OUTPUT HEAD ====="
sed -n '1,260p' "${OUT_FILE}"
