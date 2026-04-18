#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"
LEDGER_RUN="${BATCH_RUN}/99_phase5_probability_master_ledger_v1"
OUTDIR="${LEDGER_RUN}/missing_probability_probe_v2"
MISSING_TXT="${LEDGER_RUN}/missing_probability_probe_v1/missing_event_ids.txt"

mkdir -p "${OUTDIR}"
test -f "${MISSING_TXT}" || { echo "Missing event list: ${MISSING_TXT}" >&2; exit 1; }

SEARCH_ROOTS=(
  "/mnt/storage_array/projects/OPENPRA_DEV_v1"
  "/mnt/storage_array/projects/QPRA_POSTTHESIS_v1"
  "/mnt/storage_array/projects/QPRA_DISSERTATION_v1"
  "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1"
)

echo "OUTDIR=${OUTDIR}"
echo "MISSING_TXT=${MISSING_TXT}"

echo
echo "===== FULL RECURSIVE GREP SEARCH ====="

while IFS= read -r ev; do
  [ -n "${ev}" ] || continue
  short="${ev#B:}"
  safe_name="$(printf '%s' "${short}" | tr ':' '_' )"
  out_file="${OUTDIR}/${safe_name}_grep_hits.txt"

  echo
  echo "---- ${ev} ----"

  {
    echo "EVENT=${ev}"
    echo "SHORT=${short}"
    echo
    for root in "${SEARCH_ROOTS[@]}"; do
      if [ -d "${root}" ]; then
        echo "### ROOT ${root}"
        grep -R -n -I --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude='*.tar.gz' --exclude='*.zip' --exclude='*.qpy' "${short}" "${root}" || true
        echo
      fi
    done
  } > "${out_file}"

  hit_count="$(grep -c ':' "${out_file}" || true)"
  echo "HITS_FILE=${out_file}"
  echo "HIT_LINES=${hit_count}"

done < "${MISSING_TXT}"

echo
echo "===== SUMMARY OF HIT FILES ====="
find "${OUTDIR}" -maxdepth 1 -type f -name '*_grep_hits.txt' | sort

echo
echo "===== COMBINED NONEMPTY FILES ====="
for f in "${OUTDIR}"/*_grep_hits.txt; do
  [ -f "${f}" ] || continue
  if grep -q '^/mnt\|^[A-Za-z0-9_./-]\+:' "${f}" 2>/dev/null; then
    echo
    echo "########## ${f} ##########"
    sed -n '1,220p' "${f}"
  fi
done
