#!/usr/bin/env bash
set -u

ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUTROOT="${ROOT}/_work/openpra_phase5_find_runtime_artifact_pattern_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="${OUTROOT}/${STAMP}"

mkdir -p "${OUTDIR}"

SEARCH_PATHS=(
  "/mnt/storage_array/projects"
  "/mnt/cluster_production/projects"
  "/home/clusteradmin"
)

{
  echo "OpenPRA Phase 5 runtime artifact pattern search v1"
  echo "Generated UTC: ${STAMP}"
  echo
  echo "Search paths:"
  for p in "${SEARCH_PATHS[@]}"; do
    echo "  ${p}"
  done
  echo
} > "${OUTDIR}/README.txt"

{
  echo "===== SUBMIT REPORT FILES ====="
  find "${SEARCH_PATHS[@]}" -type f -name 'quantum_submit_report_p*_v1.json' 2>/dev/null | sort || true
  echo
} > "${OUTDIR}/submit_reports.txt"

{
  echo "===== COLLECT REPORT FILES ====="
  find "${SEARCH_PATHS[@]}" -type f -name 'quantum_collect_report_p*_v1.json' 2>/dev/null | sort || true
  echo
} > "${OUTDIR}/collect_reports.txt"

{
  echo "===== JOB META FILES ====="
  find "${SEARCH_PATHS[@]}" -type f -name 'job_meta.json' 2>/dev/null | sort || true
  echo
} > "${OUTDIR}/job_meta_files.txt"

{
  echo "===== JOB RESULT FILES ====="
  find "${SEARCH_PATHS[@]}" -type f -name 'job_result.json' 2>/dev/null | sort || true
  echo
} > "${OUTDIR}/job_result_files.txt"

{
  echo "===== JOB INPUT FILES ====="
  find "${SEARCH_PATHS[@]}" -type f -name 'job_inputs_from_service.json' 2>/dev/null | sort || true
  echo
} > "${OUTDIR}/job_inputs_files.txt"

{
  echo "===== DECODED COUNTS FILES ====="
  find "${SEARCH_PATHS[@]}" -type f -path '*/decoded_counts/pub_*_counts.json' 2>/dev/null | sort || true
  echo
} > "${OUTDIR}/decoded_counts_files.txt"

{
  echo "===== QUANTUM RAW DIRECTORIES ====="
  find "${SEARCH_PATHS[@]}" -type d -name '_quantum_raw' 2>/dev/null | sort || true
  echo
} > "${OUTDIR}/quantum_raw_dirs.txt"

python3 - <<'PY'
from pathlib import Path
import hashlib
import json

outroot = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_phase5_find_runtime_artifact_pattern_v1")
latest = sorted([p for p in outroot.iterdir() if p.is_dir()], reverse=True)[0]

summary = {}
for name in [
    "submit_reports.txt",
    "collect_reports.txt",
    "job_meta_files.txt",
    "job_result_files.txt",
    "job_inputs_files.txt",
    "decoded_counts_files.txt",
    "quantum_raw_dirs.txt",
]:
    p = latest / name
    lines = [ln for ln in p.read_text(encoding="utf-8", errors="ignore").splitlines() if ln and not ln.startswith("=====")]
    summary[name] = {
        "count": len(lines),
        "first_20": lines[:20],
    }

(latest / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

manifest = {}
for p in sorted(latest.rglob("*")):
    if p.is_file():
        manifest[str(p.relative_to(latest))] = hashlib.sha256(p.read_bytes()).hexdigest()

(latest / "00_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
with (latest / "SHA256SUMS.txt").open("w", encoding="utf-8") as f:
    for rel, digest in sorted(manifest.items()):
        f.write(f"{digest}  {rel}\n")

print(latest)
PY
