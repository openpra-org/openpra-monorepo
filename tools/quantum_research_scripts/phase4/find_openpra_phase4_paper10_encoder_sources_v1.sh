#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${REPO_ROOT}/_work/openpra_phase4_paper10_encoder_source_search_v1/$(date -u +%Y%m%d_%H%M%SZ)"
mkdir -p "${RUN_DIR}"

ROOTS=(
  "/mnt/storage_array/projects/QPRA_DISSERTATION_v1/Paper10"
  "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10"
)

CODE_HITS="${RUN_DIR}/paper10_encoder_code_hits.txt"
FILE_LIST="${RUN_DIR}/paper10_encoder_candidate_files.txt"
SUMMARY="${RUN_DIR}/paper10_encoder_search_summary.txt"

: > "${CODE_HITS}"
: > "${FILE_LIST}"
: > "${SUMMARY}"

echo "OPENPRA PHASE 4 PAPER10 ENCODER SOURCE SEARCH v1" | tee -a "${SUMMARY}"
echo "Generated UTC: $(date -u +%Y%m%d_%H%M%SZ)" | tee -a "${SUMMARY}"
echo "" | tee -a "${SUMMARY}"

for ROOT in "${ROOTS[@]}"; do
  if [ ! -d "${ROOT}" ]; then
    echo "SKIP missing root: ${ROOT}" | tee -a "${SUMMARY}"
    continue
  fi

  echo "SEARCH ROOT: ${ROOT}" | tee -a "${SUMMARY}"

  find "${ROOT}" -type f \
    \( \
      -name "*.py" -o \
      -name "*.ipynb" -o \
      -name "*.js" -o \
      -name "*.ts" -o \
      -name "*.sh" -o \
      -name "*.json" -o \
      -name "*.md" \
    \) -print0 \
  | xargs -0 grep -nHI -E \
      "qubo_model_v1\\.json|penalty_P|AUX:or_out|AUX:and_out|AUX:or_ab|66\\.5|n_vars_total|xml_source|xml_path|subtree_dir|per_instance|qubo model|ising|build.*qubo|encode.*or|encode.*and" \
      >> "${CODE_HITS}" || true

  echo "" >> "${SUMMARY}"
done

sort -u "${CODE_HITS}" > "${RUN_DIR}/paper10_encoder_code_hits_sorted.txt"
cut -d: -f1 "${RUN_DIR}/paper10_encoder_code_hits_sorted.txt" | sort -u > "${FILE_LIST}"

{
  echo ""
  echo "UNIQUE MATCHED FILE COUNT: $(wc -l < "${FILE_LIST}")"
  echo "TOTAL HIT LINE COUNT: $(wc -l < "${RUN_DIR}/paper10_encoder_code_hits_sorted.txt")"
  echo ""
  echo "===== UNIQUE FILES ====="
  sed -n '1,200p' "${FILE_LIST}"
  echo ""
  echo "===== HIT HEAD ====="
  sed -n '1,300p' "${RUN_DIR}/paper10_encoder_code_hits_sorted.txt"
} | tee -a "${SUMMARY}"

echo ""
echo "RUN_DIR=${RUN_DIR}"
echo "SUMMARY=${SUMMARY}"
echo "FILE_LIST=${FILE_LIST}"
echo "HITS=${RUN_DIR}/paper10_encoder_code_hits_sorted.txt"
