#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"
LEDGER_RUN="${BATCH_RUN}/99_phase5_probability_master_ledger_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="${BATCH_RUN}/99_two_case_ready_checkpoint_v1_${STAMP}"

mkdir -p "${OUTDIR}"
export BATCH_RUN LEDGER_RUN OUTDIR

python3 - <<'PY'
import json
import hashlib
import os
from pathlib import Path
from datetime import datetime, timezone

batch_run = Path(os.environ["BATCH_RUN"])
ledger_run = Path(os.environ["LEDGER_RUN"])
outdir = Path(os.environ["OUTDIR"])

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

summary = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "checkpoint_type": "openpra_phase5_two_case_ready_state_v1",
    "batch_run": str(batch_run.resolve()),
    "ledger_run": str(ledger_run.resolve()),
    "cases": [],
}

for case_dir in sorted([p for p in batch_run.iterdir() if p.is_dir() and p.name[:4].isdigit()]):
    meta = json.loads((case_dir / "package_metadata.json").read_text(encoding="utf-8"))
    probs = json.loads((case_dir / "probabilities.json").read_text(encoding="utf-8"))
    qmcs = json.loads((case_dir / "quantum_recovered_mcs.json").read_text(encoding="utf-8"))
    raw = json.loads((case_dir / "raw_counts.json").read_text(encoding="utf-8"))

    populated_probability_count = 0
    if isinstance(probs.get("probabilities"), dict):
        populated_probability_count = sum(
            1 for v in probs["probabilities"].values() if isinstance(v, (int, float))
        )

    entry = {
        "case_dir": str(case_dir.resolve()),
        "case_name": case_dir.name,
        "model_id": meta.get("model_id"),
        "candidate_root_node_id": meta.get("candidate_root_node_id"),
        "topology_class": meta.get("topology_class"),
        "basic_event_count": meta.get("basic_event_count"),
        "required_qubits": meta.get("required_qubits"),
        "probabilities_status": probs.get("status"),
        "populated_probability_count": populated_probability_count,
        "quantum_recovered_mcs_status": qmcs.get("status"),
        "raw_counts_status": raw.get("status"),
        "ordered_basic_event_ids": meta.get("ordered_basic_event_ids"),
        "files": {
            "package_metadata.json": str((case_dir / "package_metadata.json").resolve()),
            "source_export.json": str((case_dir / "source_export.json").resolve()),
            "classical_reference_mcs.json": str((case_dir / "classical_reference_mcs.json").resolve()),
            "probabilities.json": str((case_dir / "probabilities.json").resolve()),
            "quantum_recovered_mcs.json": str((case_dir / "quantum_recovered_mcs.json").resolve()),
            "raw_counts.json": str((case_dir / "raw_counts.json").resolve()),
        }
    }
    summary["cases"].append(entry)

summary["master_probability_values_json"] = str((ledger_run / "phase5_master_probability_values.json").resolve())
summary["master_probability_values_sha256"] = sha256_file(ledger_run / "phase5_master_probability_values.json")
summary["fanout_summary_json"] = str((ledger_run / "phase5_probability_fanout_summary.json").resolve())
summary["fanout_summary_sha256"] = sha256_file(ledger_run / "phase5_probability_fanout_summary.json")

summary_path = outdir / "90_two_case_ready_checkpoint_summary.json"
summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

run_sheet = outdir / "91_two_case_runtime_run_sheet.txt"
with run_sheet.open("w", encoding="utf-8") as f:
    f.write("OPENPRA PHASE 5 TWO CASE READY STATE\n")
    f.write(f"Generated at: {summary['generated_at']}\n\n")
    f.write("READY STATUS:\n")
    f.write("  Both cases have populated probabilities.json files.\n")
    f.write("  Remaining runtime side inputs to populate later are quantum_recovered_mcs.json and raw_counts.json.\n\n")
    for case in summary["cases"]:
        f.write(f"{case['case_name']}\n")
        f.write(f"  model_id: {case['model_id']}\n")
        f.write(f"  candidate_root_node_id: {case['candidate_root_node_id']}\n")
        f.write(f"  topology_class: {case['topology_class']}\n")
        f.write(f"  basic_event_count: {case['basic_event_count']}\n")
        f.write(f"  required_qubits: {case['required_qubits']}\n")
        f.write(f"  probabilities_status: {case['probabilities_status']}\n")
        f.write(f"  populated_probability_count: {case['populated_probability_count']}\n")
        f.write(f"  quantum_recovered_mcs_status: {case['quantum_recovered_mcs_status']}\n")
        f.write(f"  raw_counts_status: {case['raw_counts_status']}\n")
        f.write("  files:\n")
        for name, path in case["files"].items():
            f.write(f"    {name}: {path}\n")
        f.write("\n")
    f.write("MASTER:\n")
    f.write(f"  phase5_master_probability_values.json: {summary['master_probability_values_json']}\n")
    f.write(f"  sha256: {summary['master_probability_values_sha256']}\n")
    f.write(f"  phase5_probability_fanout_summary.json: {summary['fanout_summary_json']}\n")
    f.write(f"  sha256: {summary['fanout_summary_sha256']}\n")

print(f"SUMMARY_JSON={summary_path}")
print(f"RUN_SHEET={run_sheet}")
PY

echo
echo "===== READY CHECKPOINT SUMMARY ====="
sed -n '1,260p' "${OUTDIR}/90_two_case_ready_checkpoint_summary.json"

echo
echo "===== RUNTIME RUN SHEET ====="
sed -n '1,260p' "${OUTDIR}/91_two_case_runtime_run_sheet.txt"
