#!/usr/bin/env bash
set -u

ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUTROOT="${ROOT}/_work/openpra_phase5_find_precise_runtime_codepaths_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="${OUTROOT}/${STAMP}"

mkdir -p "${OUTDIR}"

SEARCH_PATHS=(
  "/mnt/storage_array/projects"
  "/mnt/cluster_production/projects"
  "/home/clusteradmin"
)

EXCLUDE_DIRS=(
  ".git"
  "node_modules"
  ".venv"
  "__pycache__"
  "openpra_phase5_find_raw_counts_sources_v1"
  "openpra_phase5_inventory_phase4_qiskit_bundle_artifacts_v1"
  "openpra_phase5_deep_inventory_qiskit_run_v1"
  "openpra_phase5_map_and_inventory_bundle_cases_v1"
  "openpra_phase5_extract_job_ids_and_search_runtime_artifacts_v1"
  "openpra_phase5_find_runtime_submission_paths_v1"
  "openpra_phase5_search_server_for_ibm_runtime_v1"
  "openpra_phase5_find_precise_runtime_codepaths_v1"
)

PATTERNS=(
  "qiskit_ibm_runtime"
  "QiskitRuntimeService"
  "SamplerV2"
  "EstimatorV2"
  "service.job("
  "service.jobs("
  ".result("
  "job_id"
  "session_id"
  "RuntimeJob"
  "RuntimeJobV2"
  "backend.run("
  "sampler.run("
  "get_counts("
  "quasi_dists"
)

build_find_command() {
  local base="$1"

  printf 'find %q ' "$base"
  printf '\\( '
  local first=1
  local d
  for d in "${EXCLUDE_DIRS[@]}"; do
    if [[ $first -eq 0 ]]; then
      printf ' -o '
    fi
    printf -- '-name %q' "$d"
    first=0
  done
  printf ' \\) -prune -o '
  printf -- '-type f '
  printf '\\( -name "*.py" -o -name "*.sh" -o -name "*.ipynb" -o -name "*.json" -o -name "*.log" -o -name "*.txt" \\) '
  printf -- '-print'
}

run_find_stream() {
  local base="$1"
  local cmd
  cmd="$(build_find_command "$base")"
  eval "$cmd" 2>/dev/null || true
}

{
  echo "OpenPRA Phase 5 precise runtime codepath search v1"
  echo "Generated UTC: ${STAMP}"
  echo "Root: ${ROOT}"
  echo
  echo "Search paths:"
  local_path=""
  for local_path in "${SEARCH_PATHS[@]}"; do
    echo "  ${local_path}"
  done
  echo
  echo "Patterns:"
  local_pattern=""
  for local_pattern in "${PATTERNS[@]}"; do
    echo "  ${local_pattern}"
  done
  echo
} > "${OUTDIR}/README.txt"

pattern=""
for pattern in "${PATTERNS[@]}"; do
  safe_name="$(echo "${pattern}" | tr '/.() ' '_')"
  out_file="${OUTDIR}/grep_${safe_name}.txt"

  {
    echo "===== PATTERN: ${pattern} ====="

    base=""
    for base in "${SEARCH_PATHS[@]}"; do
      if [[ ! -e "${base}" ]]; then
        continue
      fi

      while IFS= read -r file; do
        grep -nH -F "${pattern}" "${file}" 2>/dev/null || true
      done < <(run_find_stream "${base}")
    done

    echo
  } > "${out_file}"
done

{
  echo "===== LIKELY IBM RUNTIME FILES ====="

  base=""
  for base in "${SEARCH_PATHS[@]}"; do
    if [[ ! -e "${base}" ]]; then
      continue
    fi

    while IFS= read -r file; do
      echo "${file}"
    done < <(run_find_stream "${base}")
  done \
    | grep -Ei 'ibm|qiskit|runtime|sampler|estimator|harvest|submit|result|job|session' \
    || true

  echo
} > "${OUTDIR}/likely_runtime_files.txt"

{
  echo "===== BASH HISTORY IBM OR QISKIT HITS ====="
  HISTFILE="/home/clusteradmin/.bash_history"
  if [[ -f "${HISTFILE}" ]]; then
    grep -nEi 'ibm|qiskit|runtime|sampler|estimator|job_id|session_id|service\.job|\.result\(' "${HISTFILE}" || true
  else
    echo "No /home/clusteradmin/.bash_history found"
  fi
  echo
} > "${OUTDIR}/bash_history_hits.txt"

python3 - <<'PY'
from pathlib import Path
import json
import hashlib

root = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_phase5_find_precise_runtime_codepaths_v1")
latest = sorted([p for p in root.iterdir() if p.is_dir()], reverse=True)[0]

manifest = {}
for path in sorted(latest.rglob("*")):
    if path.is_file():
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest[str(path.relative_to(latest))] = digest

(latest / "00_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
with (latest / "SHA256SUMS.txt").open("w", encoding="utf-8") as handle:
    for rel, digest in sorted(manifest.items()):
        handle.write(f"{digest}  {rel}\n")

print(latest)
PY
