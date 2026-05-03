#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_BASE="${REPO_ROOT}/_work/openpra_phase4_transition_sources_v2"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="${WORK_BASE}/${STAMP}"
COMBINED="${RUN_DIR}/OPENPRA_PHASE4_TRANSITION_SOURCES_v2.txt"
SHA256="${RUN_DIR}/SHA256SUMS.txt"
MANIFEST="${RUN_DIR}/00_manifest.json"

mkdir -p "${RUN_DIR}"

FILES=(
  "packages/quantum-readiness/src/lib/types.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.ts"
  "packages/quantum-readiness/src/lib/quantum-preparation.spec.ts"
  "scripts/export_openpra_phase4_clqubo_v1.js"
  "scripts/materialize_openpra_phase4_qiskit_bundle_v1.py"
  "scripts/verify_openpra_phase4_statevector_bundle_v1.py"
  "scripts/package_openpra_phase4_reference_artifacts_v1.py"
  "scripts/validate_openpra_phase4_reference_artifacts_v1.py"
  "scripts/build_openpra_phase4_phase2b_row_lookup_v1.py"
)

{
  echo "OPENPRA PHASE 4 TRANSITION SOURCES v2"
  echo "Generated UTC: $(date -u +%Y%m%d_%H%M%SZ)"
  echo "Repo Root: ${REPO_ROOT}"
  echo ""

  for REL in "${FILES[@]}"; do
    ABS="${REPO_ROOT}/${REL}"
    echo ""
    echo "===== BEGIN FILE: ${REL} ====="
    if [[ -f "${ABS}" ]]; then
      cat "${ABS}"
    else
      echo "FILE_NOT_FOUND: ${REL}"
    fi
    echo ""
    echo "===== END FILE: ${REL} ====="
    echo ""
  done
} > "${COMBINED}"

python3 - <<'PY' "${RUN_DIR}" "${COMBINED}" "${SHA256}" "${MANIFEST}"
import hashlib
import json
import os
import sys
from pathlib import Path

run_dir = Path(sys.argv[1])
combined = Path(sys.argv[2])
sha_path = Path(sys.argv[3])
manifest_path = Path(sys.argv[4])

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

entries = {}
for path in sorted(run_dir.rglob("*")):
    if path.is_file() and path.name not in {"SHA256SUMS.txt", "00_manifest.json"}:
        entries[str(path.relative_to(run_dir))] = sha256_file(path)

with sha_path.open("w", encoding="utf-8") as f:
    for rel, digest in sorted(entries.items()):
        f.write(f"{digest}  {rel}\n")

entries["SHA256SUMS.txt"] = sha256_file(sha_path)

manifest = {
    "generated_utc": Path(combined).stat().st_mtime,
    "run_dir": str(run_dir),
    "files": entries,
}
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
PY

echo "RUN_DIR=${RUN_DIR}"
echo "COMBINED=${COMBINED}"
echo "SHA256=${SHA256}"
echo "MANIFEST=${MANIFEST}"
ls -lh "${RUN_DIR}"
