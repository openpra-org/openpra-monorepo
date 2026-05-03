#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${REPO_ROOT}/_work/openpra_phase4_paper10_encoder_candidates_v1/$(date -u +%Y%m%d_%H%M%SZ)"
OUT_FILE="${RUN_DIR}/OPENPRA_PHASE4_PAPER10_ENCODER_CANDIDATES_v1.txt"

mkdir -p "${RUN_DIR}"

FILES=(
  "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z_contents/Code/paper10_find_circuit_builder_v1.sh"
  "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z_contents/Code/paper10_phaseA_build_qubo_and_circuits_v1.py"
  "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z_contents/Code/paper10_phaseA_build_qubo_and_circuits_v2.py"
  "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z/PAPER10_PHASEA_WRITING_BUNDLE_v4_20260306_164533Z_contents/Code/paper10_phaseA_build_qubo_and_circuits_v3.py"
)

{
  echo "OPENPRA PHASE 4 PAPER10 ENCODER CANDIDATES v1"
  echo "Generated UTC: $(date -u +%Y%m%d_%H%M%SZ)"
  echo ""

  echo "===== FILE INVENTORY ====="
  for f in "${FILES[@]}"; do
    if [ -f "${f}" ]; then
      echo "FOUND ${f}"
    else
      echo "MISSING ${f}"
    fi
  done
  echo ""

  echo "===== TARGETED GREP ====="
  grep -nH -E "penalty_P|n_vars_total|qubo_model_v1|or_out|or_ab|and_out|xml_source|xml_path|subtree_dir|def .*qubo|def .*ising|def .*or|def .*and|class |build_.*qubo|encode_.*or|encode_.*and" "${FILES[@]}" || true
  echo ""

  for f in "${FILES[@]}"; do
    if [ -f "${f}" ]; then
      echo "===== BEGIN FILE: ${f} ====="
      cat "${f}"
      echo ""
      echo "===== END FILE: ${f} ====="
      echo ""
    fi
  done

  echo "===== REFERENCE CASE 1037 ====="
  sed -n '1,220p' /mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/derived/per_instance/1037/qubo_model_v1.json
  echo ""

  echo "===== REFERENCE CASE 0698 ====="
  sed -n '1,220p' /mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/derived/per_instance/0698/qubo_model_v1.json
  echo ""

  echo "===== REFERENCE CASE 0970 ====="
  sed -n '1,260p' /mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/derived/per_instance/0970/qubo_model_v1.json
  echo ""

  echo "===== REFERENCE CASE 10089 ====="
  sed -n '1,220p' /mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/derived/per_instance/10089/qubo_model_v1.json
  echo ""
} > "${OUT_FILE}"

sha256sum "${OUT_FILE}" > "${RUN_DIR}/SHA256SUMS.txt"

echo "RUN_DIR=${RUN_DIR}"
echo "OUT_FILE=${OUT_FILE}"
echo "SHA256=${RUN_DIR}/SHA256SUMS.txt"
echo ""
echo "===== FILE INVENTORY + TARGETED GREP ====="
sed -n '1,260p' "${OUT_FILE}"
