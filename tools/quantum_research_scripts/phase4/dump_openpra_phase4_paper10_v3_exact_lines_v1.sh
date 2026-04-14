#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${REPO_ROOT}/_work/openpra_phase4_paper10_v3_exact_lines_v1/$(date -u +%Y%m%d_%H%M%SZ)"
OUT_FILE="${RUN_DIR}/OPENPRA_PHASE4_PAPER10_V3_EXACT_LINES_v1.txt"

mkdir -p "${RUN_DIR}"

V3="/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z_contents/Code/paper10_phaseA_build_qubo_and_circuits_v3.py"

if [ ! -f "${V3}" ]; then
  echo "Missing file: ${V3}" >&2
  exit 1
fi

{
  echo "OPENPRA PHASE 4 PAPER10 V3 EXACT LINES v1"
  echo "Generated UTC: $(date -u +%Y%m%d_%H%M%SZ)"
  echo "Source: ${V3}"
  echo ""

  echo "===== V3 LINES 240-380 ====="
  nl -ba "${V3}" | sed -n '240,380p'
  echo ""

  echo "===== V3 LINES 520-640 ====="
  nl -ba "${V3}" | sed -n '520,640p'
  echo ""

  echo "===== CURRENT OPENPRA QUANTUM PREPARATION CORE ====="
  nl -ba packages/quantum-readiness/src/lib/quantum-preparation.ts | sed -n '340,705p'
  echo ""

  echo "===== FROZEN REFERENCE 1037 ====="
  sed -n '1,220p' /mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/derived/per_instance/1037/qubo_model_v1.json
  echo ""

  echo "===== FROZEN REFERENCE 0698 ====="
  sed -n '1,220p' /mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/derived/per_instance/0698/qubo_model_v1.json
  echo ""

  echo "===== FROZEN REFERENCE 10619 ====="
  sed -n '1,220p' /mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/derived/per_instance/10619/qubo_model_v1.json
  echo ""
} > "${OUT_FILE}"

sha256sum "${OUT_FILE}" > "${RUN_DIR}/SHA256SUMS.txt"

echo "RUN_DIR=${RUN_DIR}"
echo "OUT_FILE=${OUT_FILE}"
echo "SHA256=${RUN_DIR}/SHA256SUMS.txt"
echo ""
echo "===== OUTPUT HEAD ====="
sed -n '1,260p' "${OUT_FILE}"
