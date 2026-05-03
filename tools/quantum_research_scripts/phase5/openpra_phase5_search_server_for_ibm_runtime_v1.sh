#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUTROOT="${ROOT}/_work/openpra_phase5_search_server_for_ibm_runtime_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="${OUTROOT}/${STAMP}"

mkdir -p "${OUTDIR}"

SEARCH_PATHS=(
  "/mnt/storage_array/projects"
  "/mnt/cluster_production/projects"
  "/home/clusteradmin"
)

PATTERNS=(
  "QiskitRuntimeService"
  "qiskit_ibm_runtime"
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
  "quasi_dists"
  "get_counts("
)

{
  echo "OpenPRA Phase 5 server wide IBM runtime search v1"
  echo "Generated UTC: ${STAMP}"
  echo "Search paths:"
  for p in "${SEARCH_PATHS[@]}"; do
    echo "  ${p}"
  done
  echo
} > "${OUTDIR}/README.txt"

for pattern in "${PATTERNS[@]}"; do
  safe_name="$(echo "${pattern}" | tr '/.() ' '_')"
  out_file="${OUTDIR}/grep_${safe_name}.txt"
  {
    echo "===== PATTERN: ${pattern} ====="
    grep -RIn \
      --exclude-dir=.git \
      --exclude-dir=node_modules \
      --exclude-dir=.venv \
      --exclude-dir=__pycache__ \
      --exclude-dir=openpra_phase5_extract_job_ids_and_search_runtime_artifacts_v1 \
      --exclude-dir=openpra_phase5_find_raw_counts_sources_v1 \
      --exclude-dir=openpra_phase5_inventory_phase4_qiskit_bundle_artifacts_v1 \
      --exclude-dir=openpra_phase5_deep_inventory_qiskit_run_v1 \
      --exclude-dir=openpra_phase5_map_and_inventory_bundle_cases_v1 \
      --exclude-dir=openpra_phase5_find_runtime_submission_paths_v1 \
      --exclude-dir=openpra_phase5_search_server_for_ibm_runtime_v1 \
      --binary-files=without-match \
      -F "${pattern}" "${SEARCH_PATHS[@]}" || true
    echo
  } > "${out_file}"
done

{
  echo "===== LIKELY IBM RUNTIME FILES ====="
  find "${SEARCH_PATHS[@]}" -type f \
    \( -name "*.py" -o -name "*.sh" -o -name "*.ipynb" -o -name "*.json" -o -name "*.log" -o -name "*.txt" \) \
    | grep -Ei 'ibm|qiskit|runtime|sampler|estimator|harvest|submit|result|job|session' \
    | grep -Ev 'openpra_phase5_extract_job_ids_and_search_runtime_artifacts_v1|openpra_phase5_find_raw_counts_sources_v1|openpra_phase5_inventory_phase4_qiskit_bundle_artifacts_v1|openpra_phase5_deep_inventory_qiskit_run_v1|openpra_phase5_map_and_inventory_bundle_cases_v1|openpra_phase5_find_runtime_submission_paths_v1|openpra_phase5_search_server_for_ibm_runtime_v1' \
    || true
  echo
} > "${OUTDIR}/likely_runtime_files.txt"

python3 - <<'PY'
from pathlib import Path
import json
import hashlib

root = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_phase5_search_server_for_ibm_runtime_v1")
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
