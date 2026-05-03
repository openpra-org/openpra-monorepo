#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
FREEZE_DIR="${BATCH_RUN}/99_two_case_local_execution_freeze_v1_${STAMP}"
mkdir -p "${FREEZE_DIR}"

export BATCH_RUN FREEZE_DIR

python3 - <<'PY'
import json
import hashlib
import os
import tarfile
from pathlib import Path
from datetime import datetime, timezone

batch_run = Path(os.environ["BATCH_RUN"])
freeze_dir = Path(os.environ["FREEZE_DIR"])

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

generated_at = datetime.now(timezone.utc).isoformat()

case_dirs = sorted([p for p in batch_run.iterdir() if p.is_dir() and p.name[:4].isdigit()])

summary = {
    "generated_at": generated_at,
    "freeze_type": "openpra_phase5_two_case_local_execution_v1",
    "batch_run": str(batch_run.resolve()),
    "case_count": len(case_dirs),
    "cases": [],
    "overall_assertions": {
        "all_probabilities_populated": True,
        "all_raw_counts_populated": True,
        "all_quantum_recovered_mcs_populated": True,
        "all_reference_mcs_recovered": True,
        "execution_mode": "local_statevector_sampling_from_staged_exact_qpy",
    },
}

required_files = [
    "package_metadata.json",
    "probabilities.json",
    "raw_counts.json",
    "quantum_recovered_mcs.json",
    "runtime_source_default_bound_circuit.qpy",
    "runtime_source_default_bound_circuit_summary.json",
    "runtime_source_primary_candidate_export.json",
    "runtime_source_qaoa_recipe.json",
    "runtime_source_variable_mapping.csv",
    "runtime_source_mixer_specification.json",
]

manifest_rows = []

for case_dir in case_dirs:
    for req in required_files:
        if not (case_dir / req).exists():
            raise RuntimeError(f"Missing required file for freeze: {case_dir / req}")

    meta = json.loads((case_dir / "package_metadata.json").read_text(encoding="utf-8"))
    probs = json.loads((case_dir / "probabilities.json").read_text(encoding="utf-8"))
    raw = json.loads((case_dir / "raw_counts.json").read_text(encoding="utf-8"))
    qmcs = json.loads((case_dir / "quantum_recovered_mcs.json").read_text(encoding="utf-8"))

    prob_count = 0
    if isinstance(probs.get("probabilities"), dict):
        prob_count = sum(1 for v in probs["probabilities"].values() if isinstance(v, (int, float)))

    raw_count_entries = len(raw.get("counts", {})) if isinstance(raw.get("counts"), dict) else 0
    recovered_mcs_count = qmcs.get("recovered_mcs_count")
    reference_mcs_count = qmcs.get("reference_mcs_count")
    all_ref = bool(qmcs.get("all_reference_mcs_recovered"))

    summary["overall_assertions"]["all_probabilities_populated"] &= (probs.get("status") == "populated_from_master")
    summary["overall_assertions"]["all_raw_counts_populated"] &= (raw.get("status") == "populated_from_local_statevector_sampling")
    summary["overall_assertions"]["all_quantum_recovered_mcs_populated"] &= (qmcs.get("status") == "populated_from_local_statevector_sampling")
    summary["overall_assertions"]["all_reference_mcs_recovered"] &= all_ref

    case_entry = {
        "case_name": case_dir.name,
        "model_id": meta.get("model_id"),
        "candidate_root_node_id": meta.get("candidate_root_node_id"),
        "topology_class": meta.get("topology_class"),
        "basic_event_count": meta.get("basic_event_count"),
        "required_qubits": meta.get("required_qubits"),
        "probabilities_status": probs.get("status"),
        "populated_probability_count": prob_count,
        "raw_counts_status": raw.get("status"),
        "raw_count_entries": raw_count_entries,
        "quantum_recovered_mcs_status": qmcs.get("status"),
        "reference_mcs_count": reference_mcs_count,
        "recovered_mcs_count": recovered_mcs_count,
        "all_reference_mcs_recovered": all_ref,
        "top_recovered_bitstrings": qmcs.get("recovered_bitstrings", [])[:10],
        "files": {},
    }

    for req in required_files:
        p = case_dir / req
        case_entry["files"][req] = {
            "path": str(p.resolve()),
            "sha256": sha256_file(p),
            "size_bytes": p.stat().st_size,
        }
        manifest_rows.append({
            "case_name": case_dir.name,
            "file_name": req,
            "path": str(p.resolve()),
            "sha256": case_entry["files"][req]["sha256"],
            "size_bytes": case_entry["files"][req]["size_bytes"],
        })

    summary["cases"].append(case_entry)

summary_path = freeze_dir / "90_two_case_local_execution_freeze_summary.json"
summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

manifest_csv = freeze_dir / "91_two_case_local_execution_manifest.csv"
with manifest_csv.open("w", encoding="utf-8") as f:
    f.write("case_name,file_name,path,sha256,size_bytes\n")
    for row in manifest_rows:
        f.write(
            f'{row["case_name"]},{row["file_name"]},{row["path"]},{row["sha256"]},{row["size_bytes"]}\n'
        )

readme_path = freeze_dir / "92_two_case_local_execution_README.txt"
with readme_path.open("w", encoding="utf-8") as f:
    f.write("OPENPRA PHASE 5 TWO CASE LOCAL EXECUTION FREEZE\n")
    f.write(f"Generated at: {generated_at}\n\n")
    f.write("Scope:\n")
    f.write("  This freeze captures the 2 case local execution checkpoint after probabilities, raw_counts, and quantum_recovered_mcs were populated.\n")
    f.write("  Execution mode is local statevector sampling from staged exact QPY circuits.\n")
    f.write("  This is not IBM hardware output.\n\n")
    f.write("High level result:\n")
    f.write(f'  all_probabilities_populated = {summary["overall_assertions"]["all_probabilities_populated"]}\n')
    f.write(f'  all_raw_counts_populated = {summary["overall_assertions"]["all_raw_counts_populated"]}\n')
    f.write(f'  all_quantum_recovered_mcs_populated = {summary["overall_assertions"]["all_quantum_recovered_mcs_populated"]}\n')
    f.write(f'  all_reference_mcs_recovered = {summary["overall_assertions"]["all_reference_mcs_recovered"]}\n\n')
    for case in summary["cases"]:
        f.write(f'{case["case_name"]}\n')
        f.write(f'  model_id: {case["model_id"]}\n')
        f.write(f'  candidate_root_node_id: {case["candidate_root_node_id"]}\n')
        f.write(f'  topology_class: {case["topology_class"]}\n')
        f.write(f'  basic_event_count: {case["basic_event_count"]}\n')
        f.write(f'  required_qubits: {case["required_qubits"]}\n')
        f.write(f'  probabilities_status: {case["probabilities_status"]}\n')
        f.write(f'  populated_probability_count: {case["populated_probability_count"]}\n')
        f.write(f'  raw_counts_status: {case["raw_counts_status"]}\n')
        f.write(f'  raw_count_entries: {case["raw_count_entries"]}\n')
        f.write(f'  quantum_recovered_mcs_status: {case["quantum_recovered_mcs_status"]}\n')
        f.write(f'  reference_mcs_count: {case["reference_mcs_count"]}\n')
        f.write(f'  recovered_mcs_count: {case["recovered_mcs_count"]}\n')
        f.write(f'  all_reference_mcs_recovered: {case["all_reference_mcs_recovered"]}\n\n')

tar_path = freeze_dir / "93_two_case_local_execution_freeze_bundle.tar.gz"
with tarfile.open(tar_path, "w:gz") as tar:
    tar.add(summary_path, arcname=summary_path.name)
    tar.add(manifest_csv, arcname=manifest_csv.name)
    tar.add(readme_path, arcname=readme_path.name)
    for case in case_dirs:
        for req in required_files + ["classical_reference_mcs.json", "source_export.json"]:
            p = case / req
            if p.exists():
                tar.add(p, arcname=f"{case.name}/{p.name}")

sha_path = freeze_dir / "94_SHA256SUMS.txt"
with sha_path.open("w", encoding="utf-8") as f:
    for p in sorted(freeze_dir.iterdir()):
        if p.is_file():
            f.write(f"{sha256_file(p)}  {p.name}\n")

print(f"SUMMARY_JSON={summary_path}")
print(f"MANIFEST_CSV={manifest_csv}")
print(f"README_TXT={readme_path}")
print(f"TAR_GZ={tar_path}")
print(f"SHA256SUMS={sha_path}")
PY

echo
echo "===== FREEZE SUMMARY ====="
sed -n '1,260p' "${FREEZE_DIR}/90_two_case_local_execution_freeze_summary.json"

echo
echo "===== FREEZE README ====="
sed -n '1,220p' "${FREEZE_DIR}/92_two_case_local_execution_README.txt"

echo
echo "===== FREEZE DIRECTORY ====="
find "${FREEZE_DIR}" -maxdepth 1 -type f | sort
