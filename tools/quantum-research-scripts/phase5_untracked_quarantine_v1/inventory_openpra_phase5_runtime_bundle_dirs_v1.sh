#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

TARGET_0044_DIR="_work/openpra_phase4_qiskit_bundles_v1/20260409_033939Z/0044"
TARGET_0117_DIR="_work/openpra_phase4_qiskit_bundles_v1/20260409_033939Z/0117"
DONOR_0108_DIR="_work/openpra_phase4_qiskit_bundles_v1/20260409_033939Z/0108"
DONOR_SELECTED_DIR="_work/openpra_phase5_select_unique_phase4_bundle_cases_v2/20260414_023339Z/selected_phase4_bundle_cases/0001_0108_phase2b_row_0357"

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z/99_runtime_bundle_inventory_v1_${STAMP}"
mkdir -p "${OUTDIR}"

for d in "${TARGET_0044_DIR}" "${TARGET_0117_DIR}" "${DONOR_0108_DIR}" "${DONOR_SELECTED_DIR}"; do
  test -d "${d}" || { echo "Missing directory: ${d}" >&2; exit 1; }
done

echo "OUTDIR=${OUTDIR}"

dump_dir() {
  local label="$1"
  local dir="$2"

  echo
  echo "===== ${label} =====" | tee "${OUTDIR}/${label}_header.txt"
  echo "DIR=${dir}" | tee -a "${OUTDIR}/${label}_header.txt"

  echo
  echo "--- FILE LIST ---" | tee "${OUTDIR}/${label}_file_list.txt"
  find "${dir}" -maxdepth 2 -type f | sort | tee -a "${OUTDIR}/${label}_file_list.txt"

  echo
  echo "--- QPY FILES ---" | tee "${OUTDIR}/${label}_qpy_files.txt"
  find "${dir}" -maxdepth 2 -type f -name '*.qpy' | sort | tee -a "${OUTDIR}/${label}_qpy_files.txt"

  echo
  echo "--- SUMMARY STYLE FILES ---" | tee "${OUTDIR}/${label}_summary_files.txt"
  find "${dir}" -maxdepth 2 -type f \( -name '*summary*.json' -o -name '*primary_candidate_export*.json' -o -name '*circuit*.json' -o -name '*recipe*.json' -o -name '*variable_mapping*.csv' -o -name 'README.txt' \) | sort | tee -a "${OUTDIR}/${label}_summary_files.txt"

  for f in \
    "${dir}"/*default_bound_circuit_summary.json \
    "${dir}"/*primary_candidate_export.json \
    "${dir}"/*qaoa_recipe*.json \
    "${dir}"/*circuit*.json \
    "${dir}"/*variable_mapping*.csv \
    "${dir}/README.txt"
  do
    if [ -f "${f}" ]; then
      base="$(basename "${f}")"
      echo
      echo "--- ${label} :: ${base} ---" | tee "${OUTDIR}/${label}__${base}.preview.txt"
      sed -n '1,220p' "${f}" | tee -a "${OUTDIR}/${label}__${base}.preview.txt"
    fi
  done

  echo
  echo "--- GREP SIGNALS ---" | tee "${OUTDIR}/${label}_grep_signals.txt"
  grep -R -n -I \
    -e 'qpy' \
    -e 'Sampler' \
    -e 'counts' \
    -e 'raw_counts' \
    -e 'bitstring' \
    -e 'parameter' \
    -e 'beta' \
    -e 'gamma' \
    -e 'bound' \
    -e 'circuit' \
    "${dir}" | tee -a "${OUTDIR}/${label}_grep_signals.txt" || true
}

dump_dir "target_0044" "${TARGET_0044_DIR}"
dump_dir "target_0117" "${TARGET_0117_DIR}"
dump_dir "donor_0108" "${DONOR_0108_DIR}"
dump_dir "donor_selected_0108" "${DONOR_SELECTED_DIR}"

echo
echo "===== INVENTORY COMPLETE ====="
echo "OUTDIR=${OUTDIR}"
