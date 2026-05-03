#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"

SRC_0044_DIR="_work/openpra_phase4_qiskit_bundles_v1/20260409_033939Z/0044"
SRC_0117_DIR="_work/openpra_phase4_qiskit_bundles_v1/20260409_033939Z/0117"

DST_0001_DIR="${BATCH_RUN}/0001_phase2b_row_9683"
DST_0002_DIR="${BATCH_RUN}/0002_phase2b_row_4228"

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="${BATCH_RUN}/99_runtime_asset_staging_v1_${STAMP}"
mkdir -p "${OUTDIR}"

for d in "${SRC_0044_DIR}" "${SRC_0117_DIR}" "${DST_0001_DIR}" "${DST_0002_DIR}"; do
  test -d "${d}" || { echo "Missing directory: ${d}" >&2; exit 1; }
done

copy_case_assets() {
  local src_dir="$1"
  local dst_dir="$2"
  local prefix="$3"

  cp -v "${src_dir}/${prefix}_default_bound_circuit.qpy"          "${dst_dir}/runtime_source_default_bound_circuit.qpy"
  cp -v "${src_dir}/${prefix}_default_bound_circuit_summary.json" "${dst_dir}/runtime_source_default_bound_circuit_summary.json"
  cp -v "${src_dir}/${prefix}_primary_candidate_export.json"      "${dst_dir}/runtime_source_primary_candidate_export.json"
  cp -v "${src_dir}/${prefix}_qaoa_recipe.json"                   "${dst_dir}/runtime_source_qaoa_recipe.json"
  cp -v "${src_dir}/${prefix}_variable_mapping.csv"               "${dst_dir}/runtime_source_variable_mapping.csv"
  cp -v "${src_dir}/${prefix}_mixer_specification.json"           "${dst_dir}/runtime_source_mixer_specification.json"

  if [ -f "${src_dir}/${prefix}_cost_matrix.npz" ]; then
    cp -v "${src_dir}/${prefix}_cost_matrix.npz"                  "${dst_dir}/runtime_source_cost_matrix.npz"
  fi
}

copy_case_assets "${SRC_0044_DIR}" "${DST_0001_DIR}" "0044"
copy_case_assets "${SRC_0117_DIR}" "${DST_0002_DIR}" "0117"

export BATCH_RUN OUTDIR SRC_0044_DIR SRC_0117_DIR DST_0001_DIR DST_0002_DIR

python3 - <<'PY'
import json
import hashlib
import os
from pathlib import Path
from datetime import datetime, timezone

batch_run = Path(os.environ["BATCH_RUN"])
outdir = Path(os.environ["OUTDIR"])

cases = [
    {
        "case_dir": Path(os.environ["DST_0001_DIR"]),
        "source_dir": Path(os.environ["SRC_0044_DIR"]),
        "source_prefix": "0044",
        "model_id": "phase2b_row_9683",
        "candidate_root_node_id": "G:G1465",
    },
    {
        "case_dir": Path(os.environ["DST_0002_DIR"]),
        "source_dir": Path(os.environ["SRC_0117_DIR"]),
        "source_prefix": "0117",
        "model_id": "phase2b_row_4228",
        "candidate_root_node_id": "G:G303",
    },
]

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

summary = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "script_version": "stage_openpra_phase5_exact_runtime_assets_v1",
    "batch_run": str(batch_run.resolve()),
    "cases": [],
}

for case in cases:
    case_dir = case["case_dir"]
    staged_files = [
        "runtime_source_default_bound_circuit.qpy",
        "runtime_source_default_bound_circuit_summary.json",
        "runtime_source_primary_candidate_export.json",
        "runtime_source_qaoa_recipe.json",
        "runtime_source_variable_mapping.csv",
        "runtime_source_mixer_specification.json",
    ]
    if (case_dir / "runtime_source_cost_matrix.npz").exists():
        staged_files.append("runtime_source_cost_matrix.npz")

    file_rows = []
    for name in staged_files:
        p = case_dir / name
        file_rows.append({
            "file": str(p.resolve()),
            "sha256": sha256_file(p),
            "size_bytes": p.stat().st_size,
        })

    summary["cases"].append({
        "model_id": case["model_id"],
        "candidate_root_node_id": case["candidate_root_node_id"],
        "case_dir": str(case_dir.resolve()),
        "source_dir": str(case["source_dir"].resolve()),
        "source_prefix": case["source_prefix"],
        "staged_files": file_rows,
    })

summary_path = outdir / "90_runtime_asset_staging_summary.json"
summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

run_sheet = outdir / "91_runtime_asset_staging_run_sheet.txt"
with run_sheet.open("w", encoding="utf-8") as f:
    f.write("OPENPRA PHASE 5 EXACT RUNTIME ASSET STAGING\n")
    f.write(f"Generated at: {summary['generated_at']}\n\n")
    f.write("Both exact target QPY runtime assets were copied into the active Phase 5 case folders.\n")
    f.write("Next step: use runtime_source_default_bound_circuit.qpy in each case folder to generate raw_counts.json and quantum_recovered_mcs.json.\n\n")
    for case in summary["cases"]:
        f.write(f"{case['model_id']} :: {case['candidate_root_node_id']}\n")
        f.write(f"  case_dir: {case['case_dir']}\n")
        f.write(f"  source_dir: {case['source_dir']}\n")
        for row in case["staged_files"]:
            f.write(f"  {row['file']} | sha256={row['sha256']} | size={row['size_bytes']}\n")
        f.write("\n")

print(f"SUMMARY_JSON={summary_path}")
print(f"RUN_SHEET={run_sheet}")
PY

echo
echo "===== STAGED FILES 0001 ====="
find "${DST_0001_DIR}" -maxdepth 1 -type f -name 'runtime_source_*' | sort

echo
echo "===== STAGED FILES 0002 ====="
find "${DST_0002_DIR}" -maxdepth 1 -type f -name 'runtime_source_*' | sort

echo
echo "===== STAGING SUMMARY ====="
sed -n '1,260p' "${OUTDIR}/90_runtime_asset_staging_summary.json"

echo
echo "===== STAGING RUN SHEET ====="
sed -n '1,220p' "${OUTDIR}/91_runtime_asset_staging_run_sheet.txt"
