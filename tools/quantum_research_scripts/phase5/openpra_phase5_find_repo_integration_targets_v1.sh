#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
cd "${ROOT}"

OUTROOT="${ROOT}/_work/openpra_phase5_find_repo_integration_targets_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="${OUTROOT}/${STAMP}"

PKG_ROOT="${ROOT}/packages/quantum-readiness"
SRC_ROOT="${PKG_ROOT}/src"
LIB_ROOT="${SRC_ROOT}/lib"
POLICY_JSON="${ROOT}/_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/openpra_recovery_integration_policy_v1.json"

mkdir -p "${OUTDIR}"

{
  echo "OpenPRA Phase 5 repo integration target inventory v1"
  echo "generated_utc=${STAMP}"
  echo "root=${ROOT}"
  echo "pkg_root=${PKG_ROOT}"
  echo "src_root=${SRC_ROOT}"
  echo "lib_root=${LIB_ROOT}"
  echo "policy_json=${POLICY_JSON}"
  echo
} > "${OUTDIR}/README.txt"

if [[ ! -d "${PKG_ROOT}" ]]; then
  echo "Missing package root: ${PKG_ROOT}" >&2
  exit 1
fi

if [[ ! -d "${LIB_ROOT}" ]]; then
  echo "Missing lib root: ${LIB_ROOT}" >&2
  exit 1
fi

find "${PKG_ROOT}" -maxdepth 4 -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.json' -o -name '*.md' \) \
  | sort > "${OUTDIR}/all_pkg_files.txt"

find "${LIB_ROOT}" -maxdepth 3 -type f \
  \( -name '*.ts' -o -name '*.tsx' \) \
  | sort > "${OUTDIR}/lib_ts_files.txt"

{
  echo "===== INDEX EXPORT FILES ====="
  find "${SRC_ROOT}" -maxdepth 2 -type f \( -name 'index.ts' -o -name 'index.tsx' \) | sort
  echo
} > "${OUTDIR}/index_exports.txt"

{
  echo "===== SPEC FILES ====="
  find "${LIB_ROOT}" -maxdepth 3 -type f -name '*.spec.ts' | sort
  echo
} > "${OUTDIR}/spec_files.txt"

grep -RInE \
'quantum|readiness|preparation|prepare|fault.tree|openpra|mcs|cut.?set|export|report|candidate_root_node_id|basicEventIdSets|raw_counts|probabilities|topology|qubo|qaoa|recovery|orientation|union' \
"${LIB_ROOT}" \
--include='*.ts' \
--include='*.tsx' \
> "${OUTDIR}/grep_core_terms.txt" || true

grep -RIlE \
'quantum|readiness|preparation|prepare|fault.tree|openpra|mcs|cut.?set|export|report|candidate_root_node_id|basicEventIdSets|raw_counts|probabilities|topology|qubo|qaoa|recovery|orientation|union' \
"${LIB_ROOT}" \
--include='*.ts' \
--include='*.tsx' \
| sort > "${OUTDIR}/files_with_core_terms.txt" || true

grep -RInE \
'export function|export const|export type|export interface|class |interface |type ' \
"${LIB_ROOT}" \
--include='*.ts' \
--include='*.tsx' \
> "${OUTDIR}/grep_exports_and_types.txt" || true

grep -RInE \
'JSON\.parse|JSON\.stringify|readFile|writeFile|fs\.|path\.|yaml|toml|csv|manifest|artifact|result|summary' \
"${LIB_ROOT}" \
--include='*.ts' \
--include='*.tsx' \
> "${OUTDIR}/grep_io_and_artifacts.txt" || true

python3 - <<'PY'
from pathlib import Path
import json
import re

outdir = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo/_work/openpra_phase5_find_repo_integration_targets_v1")
latest = sorted([p for p in outdir.iterdir() if p.is_dir()], reverse=True)[0]

def read_lines(name):
    p = latest / name
    if not p.exists():
        return []
    return [ln.rstrip("\n") for ln in p.read_text(encoding="utf-8", errors="ignore").splitlines()]

lib_files = [ln for ln in read_lines("lib_ts_files.txt") if ln.strip()]
core_hits = read_lines("grep_core_terms.txt")

hit_counts = {}
for ln in core_hits:
    if not ln.strip():
        continue
    path = ln.split(":", 1)[0]
    hit_counts[path] = hit_counts.get(path, 0) + 1

likely = sorted(hit_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:20]

summary = {
    "package_file_count": len([ln for ln in read_lines("all_pkg_files.txt") if ln.strip()]),
    "lib_ts_file_count": len(lib_files),
    "files_with_core_terms_count": len([ln for ln in read_lines("files_with_core_terms.txt") if ln.strip()]),
    "top_likely_integration_files": [
        {"path": path, "core_hit_count": count}
        for path, count in likely
    ],
}

(latest / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

with (latest / "likely_integration_files.txt").open("w", encoding="utf-8") as f:
    f.write("===== LIKELY INTEGRATION FILES =====\n")
    for path, count in likely:
        f.write(f"{count:4d}  {path}\n")
PY

echo "OUTDIR=${OUTDIR}"
echo "README=${OUTDIR}/README.txt"
echo "SUMMARY=${OUTDIR}/summary.json"
echo "LIKELY=${OUTDIR}/likely_integration_files.txt"
echo "CORE_HITS=${OUTDIR}/grep_core_terms.txt"
