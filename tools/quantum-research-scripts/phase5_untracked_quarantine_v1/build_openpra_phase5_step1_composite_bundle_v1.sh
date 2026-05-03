#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"

AUTHOR_TAR="_work/openpra_phase5_authoritative_project_bundle_v1/PHASE5_AUTHORITATIVE_PROJECT_BUNDLE_v1_20260412_200026Z.tar.gz"
AUTHOR_SHA="_work/openpra_phase5_authoritative_project_bundle_v1/PHASE5_AUTHORITATIVE_PROJECT_BUNDLE_v1_20260412_200026Z.tar.gz.sha256"

FREEZE_DIR="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z/99_two_case_local_execution_freeze_v1_20260415_033732Z"

RELEASE_ROOT="_work/openpra_phase5_step1_composite_bundle_v1/${STAMP}"
COMPOSITE_NAME="OPENPRA_PHASE5_STEP1_EXECUTED_ONLY_PLUS_LOCAL_FREEZE_v1_${STAMP}"
COMPOSITE_DIR="${RELEASE_ROOT}/${COMPOSITE_NAME}"

mkdir -p "${COMPOSITE_DIR}"
export STAMP AUTHOR_TAR AUTHOR_SHA FREEZE_DIR RELEASE_ROOT COMPOSITE_NAME COMPOSITE_DIR

python3 - <<'PY'
import json
import hashlib
import shutil
import tarfile
from pathlib import Path
from datetime import datetime, timezone
import os

repo = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")

author_tar = repo / os.environ["AUTHOR_TAR"]
author_sha = repo / os.environ["AUTHOR_SHA"]
freeze_dir = repo / os.environ["FREEZE_DIR"]
release_root = repo / os.environ["RELEASE_ROOT"]
composite_name = os.environ["COMPOSITE_NAME"]
composite_dir = repo / os.environ["COMPOSITE_DIR"]

if not author_tar.exists():
    raise SystemExit(f"Missing author tar: {author_tar}")
if not author_sha.exists():
    raise SystemExit(f"Missing author sha: {author_sha}")
if not freeze_dir.exists():
    raise SystemExit(f"Missing freeze dir: {freeze_dir}")

author_dst = composite_dir / "01_authoritative_executed_only_bundle"
local_dst = composite_dir / "02_two_case_local_execution_freeze"
author_dst.mkdir(parents=True, exist_ok=True)
local_dst.mkdir(parents=True, exist_ok=True)

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

generated_at = datetime.now(timezone.utc).isoformat()

# Copy authoritative executed-only bundle and sha sidecar
shutil.copy2(author_tar, author_dst / author_tar.name)
shutil.copy2(author_sha, author_dst / author_sha.name)

# Copy corrected local freeze sidecars and bundle
freeze_keep = [
    "90_two_case_local_execution_freeze_summary.json",
    "91_two_case_local_execution_manifest.csv",
    "92_two_case_local_execution_README.txt",
    "93_two_case_local_execution_freeze_bundle.tar.gz",
]

for name in freeze_keep:
    src = freeze_dir / name
    if not src.exists():
        raise SystemExit(f"Missing freeze file: {src}")
    shutil.copy2(src, local_dst / name)

# Build corrected local SHA256SUMS without self-entry
local_hash_rows = []
for name in sorted(freeze_keep):
    p = local_dst / name
    local_hash_rows.append((sha256_file(p), name))

with (local_dst / "94_SHA256SUMS.txt").open("w", encoding="utf-8") as f:
    for digest, name in local_hash_rows:
        f.write(f"{digest}  {name}\n")

# Composite README
readme = composite_dir / "00_COMPOSITE_README.txt"
with readme.open("w", encoding="utf-8") as f:
    f.write("OPENPRA PHASE 5 STEP 1 COMPOSITE BUNDLE\n")
    f.write(f"Generated at: {generated_at}\n\n")
    f.write("Contents:\n")
    f.write("  01_authoritative_executed_only_bundle\n")
    f.write("    The authoritative executed-only package used by the current manuscript.\n")
    f.write("  02_two_case_local_execution_freeze\n")
    f.write("    Supplemental two-case local execution checkpoint.\n\n")
    f.write("Important framing:\n")
    f.write("  The authoritative executed-only bundle remains the main manuscript evidence base.\n")
    f.write("  The two-case local execution freeze is supplemental strengthening evidence.\n")
    f.write("  It is local statevector sampling from staged exact QPY circuits.\n")
    f.write("  It is not IBM hardware output.\n\n")
    f.write("Corrections applied in this composite bundle:\n")
    f.write("  Included 91_two_case_local_execution_manifest.csv next to the freeze sidecars.\n")
    f.write("  Rebuilt 94_SHA256SUMS.txt for the local freeze without a bad self-hash entry.\n")

# Composite summary
summary = {
    "generated_at": generated_at,
    "composite_name": composite_name,
    "authoritative_bundle": {
        "tar": str((author_dst / author_tar.name).resolve()),
        "tar_sha256": sha256_file(author_dst / author_tar.name),
        "sha_sidecar": str((author_dst / author_sha.name).resolve()),
    },
    "local_execution_freeze": {
        "summary_json": str((local_dst / "90_two_case_local_execution_freeze_summary.json").resolve()),
        "manifest_csv": str((local_dst / "91_two_case_local_execution_manifest.csv").resolve()),
        "readme_txt": str((local_dst / "92_two_case_local_execution_README.txt").resolve()),
        "bundle_tar_gz": str((local_dst / "93_two_case_local_execution_freeze_bundle.tar.gz").resolve()),
        "bundle_tar_gz_sha256": sha256_file(local_dst / "93_two_case_local_execution_freeze_bundle.tar.gz"),
        "sha256sums_txt": str((local_dst / "94_SHA256SUMS.txt").resolve()),
    },
    "notes": [
        "Composite bundle keeps executed-only manuscript evidence separate from the supplemental local two-case checkpoint.",
        "Local freeze checksum sidecar was corrected to avoid the bad self-hash issue."
    ],
}
summary_path = composite_dir / "00_COMPOSITE_SUMMARY.json"
summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

# Tar the full composite directory
tar_path = release_root / f"{composite_name}.tar.gz"
with tarfile.open(tar_path, "w:gz") as tar:
    tar.add(composite_dir, arcname=composite_name)

sha_path = release_root / f"{composite_name}.tar.gz.sha256"
tar_digest = sha256_file(tar_path)
with sha_path.open("w", encoding="utf-8") as f:
    f.write(f"{tar_digest}  {tar_path.name}\n")

print(f"COMPOSITE_DIR={composite_dir}")
print(f"COMPOSITE_TAR={tar_path}")
print(f"COMPOSITE_SHA={sha_path}")
print(f"COMPOSITE_TAR_SHA256={tar_digest}")
PY

echo
echo "===== COMPOSITE DIRECTORY ====="
find "${COMPOSITE_DIR}" -maxdepth 2 -type f | sort

echo
echo "===== COMPOSITE README ====="
sed -n '1,220p' "${COMPOSITE_DIR}/00_COMPOSITE_README.txt"

echo
echo "===== COMPOSITE SUMMARY ====="
sed -n '1,260p' "${COMPOSITE_DIR}/00_COMPOSITE_SUMMARY.json"

echo
echo "===== RELEASE ROOT FILES ====="
find "${RELEASE_ROOT}" -maxdepth 1 -type f | sort
