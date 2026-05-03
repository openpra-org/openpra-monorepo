#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

BATCH_RUN="_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z"
SHOTS=8192
SEED=12345

pick_python() {
  for p in \
    "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/PaperA_semantic_preserving/.venv/bin/python" \
    "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper8/venv_paper8_qiskit/bin/python" \
    "$(command -v python3)"
  do
    if [ -n "${p}" ] && [ -x "${p}" ]; then
      echo "${p}"
      return 0
    fi
  done
  return 1
}

PYTHON_BIN="$(pick_python)"
test -n "${PYTHON_BIN}" || { echo "No usable python interpreter found" >&2; exit 1; }
echo "PYTHON_BIN=${PYTHON_BIN}"

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="${BATCH_RUN}/99_local_counts_from_staged_qpy_v1_${STAMP}"
mkdir -p "${OUTDIR}"

export BATCH_RUN SHOTS SEED OUTDIR

"${PYTHON_BIN}" - <<'PY'
import json
import math
import os
import hashlib
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
from qiskit import qpy
from qiskit.quantum_info import Statevector

batch_run = Path(os.environ["BATCH_RUN"])
shots = int(os.environ["SHOTS"])
seed = int(os.environ["SEED"])
outdir = Path(os.environ["OUTDIR"])

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def load_single_qpy(path: Path):
    with path.open("rb") as f:
        circuits = list(qpy.load(f))
    if len(circuits) != 1:
        raise RuntimeError(f"Expected exactly 1 circuit in {path}, found {len(circuits)}")
    return circuits[0]

def sample_counts_from_statevector(circuit, shots: int, seed: int):
    bare = circuit.remove_final_measurements(inplace=False)
    sv = Statevector.from_instruction(bare)
    probs = sv.probabilities_dict()

    filtered = [(bit, float(prob)) for bit, prob in probs.items() if float(prob) > 0.0]
    filtered.sort(key=lambda x: x[0])

    bitstrings = [bit for bit, _ in filtered]
    prob_values = np.array([prob for _, prob in filtered], dtype=float)
    prob_values = prob_values / prob_values.sum()

    rng = np.random.default_rng(seed)
    sampled = rng.multinomial(shots, prob_values)

    counts = {}
    for bit, c in zip(bitstrings, sampled):
        if int(c) > 0:
            counts[bit] = int(c)

    return counts, {bit: float(prob) for bit, prob in filtered}

def build_quantum_recovered(reference_payload, counts_map):
    frozen = reference_payload.get("frozenMcsReference", {})
    ref_bitstrings = frozen.get("bitstrings", [])
    ref_sets = frozen.get("basicEventIdSets", [])

    recovered_bitstrings = []
    recovered_sets = []

    for bit, evset in zip(ref_bitstrings, ref_sets):
        if counts_map.get(bit, 0) > 0:
            recovered_bitstrings.append(bit)
            recovered_sets.append(evset)

    return {
        "reference_mcs_count": len(ref_bitstrings),
        "recovered_mcs_count": len(recovered_bitstrings),
        "all_reference_mcs_recovered": len(recovered_bitstrings) == len(ref_bitstrings),
        "recovered_bitstrings": recovered_bitstrings,
        "basicEventIdSets": recovered_sets,
    }

batch_summary = {
    "generated_at": utc_now(),
    "script_version": "populate_openpra_phase5_counts_from_staged_qpy_v1",
    "batch_run": str(batch_run.resolve()),
    "shots": shots,
    "seed": seed,
    "cases": [],
}

case_dirs = sorted([p for p in batch_run.iterdir() if p.is_dir() and p.name[:4].isdigit()])

for idx, case_dir in enumerate(case_dirs, start=1):
    qpy_path = case_dir / "runtime_source_default_bound_circuit.qpy"
    summary_path = case_dir / "runtime_source_default_bound_circuit_summary.json"
    export_path = case_dir / "runtime_source_primary_candidate_export.json"
    raw_counts_path = case_dir / "raw_counts.json"
    qmcs_path = case_dir / "quantum_recovered_mcs.json"
    probs_path = case_dir / "probabilities.json"

    for required in [qpy_path, summary_path, export_path, probs_path]:
        if not required.exists():
            raise RuntimeError(f"Missing required runtime staged file: {required}")

    circuit = load_single_qpy(qpy_path)
    summary_payload = json.loads(summary_path.read_text(encoding="utf-8"))
    export_payload = json.loads(export_path.read_text(encoding="utf-8"))
    probs_payload = json.loads(probs_path.read_text(encoding="utf-8"))

    case_seed = seed + idx
    counts_map, exact_probabilities = sample_counts_from_statevector(circuit, shots=shots, seed=case_seed)
    recovered = build_quantum_recovered(export_payload, counts_map)

    raw_counts_payload = {
        "generated_at": utc_now(),
        "script_version": "populate_openpra_phase5_counts_from_staged_qpy_v1",
        "status": "populated_from_local_statevector_sampling",
        "case_dir": str(case_dir.resolve()),
        "source_qpy": str(qpy_path.resolve()),
        "source_qpy_sha256": sha256_file(qpy_path),
        "shots": shots,
        "seed": case_seed,
        "bitstring_index_convention": summary_payload.get("bitstring_index_convention"),
        "counts": dict(sorted(counts_map.items())),
        "notes": [
            "Counts were generated by exact statevector sampling from the staged bound QPY circuit.",
            "This is a local simulator style population step, not IBM hardware output."
        ],
    }

    qmcs_payload = {
        "generated_at": utc_now(),
        "script_version": "populate_openpra_phase5_counts_from_staged_qpy_v1",
        "status": "populated_from_local_statevector_sampling",
        "case_dir": str(case_dir.resolve()),
        "source_qpy": str(qpy_path.resolve()),
        "shots": shots,
        "seed": case_seed,
        "reference_mcs_count": recovered["reference_mcs_count"],
        "recovered_mcs_count": recovered["recovered_mcs_count"],
        "all_reference_mcs_recovered": recovered["all_reference_mcs_recovered"],
        "recovered_bitstrings": recovered["recovered_bitstrings"],
        "basicEventIdSets": recovered["basicEventIdSets"],
        "notes": [
            "Recovered MCS entries are those frozen reference MCS bitstrings with nonzero sampled counts.",
            "This is a local simulator style population step, not IBM hardware output."
        ],
    }

    raw_counts_path.write_text(json.dumps(raw_counts_payload, indent=2) + "\n", encoding="utf-8")
    qmcs_path.write_text(json.dumps(qmcs_payload, indent=2) + "\n", encoding="utf-8")

    case_row = {
        "case_dir": str(case_dir.resolve()),
        "model_id": export_payload.get("modelId"),
        "candidate_root_node_id": export_payload.get("candidateRootNodeId"),
        "qubit_count": circuit.num_qubits,
        "shots": shots,
        "seed": case_seed,
        "nonzero_count_bitstrings": len(counts_map),
        "top_counts": sorted(counts_map.items(), key=lambda x: (-x[1], x[0]))[:10],
        "probabilities_status": probs_payload.get("status"),
        "reference_mcs_count": recovered["reference_mcs_count"],
        "recovered_mcs_count": recovered["recovered_mcs_count"],
        "all_reference_mcs_recovered": recovered["all_reference_mcs_recovered"],
        "raw_counts_json": str(raw_counts_path.resolve()),
        "quantum_recovered_mcs_json": str(qmcs_path.resolve()),
    }
    batch_summary["cases"].append(case_row)

summary_path = outdir / "90_local_counts_population_summary.json"
summary_path.write_text(json.dumps(batch_summary, indent=2) + "\n", encoding="utf-8")

run_sheet = outdir / "91_local_counts_population_run_sheet.txt"
with run_sheet.open("w", encoding="utf-8") as f:
    f.write("OPENPRA PHASE 5 LOCAL COUNTS POPULATION FROM STAGED QPY\n")
    f.write(f"Generated at: {batch_summary['generated_at']}\n")
    f.write(f"Shots: {shots}\n")
    f.write(f"Seed base: {seed}\n\n")
    for row in batch_summary["cases"]:
        f.write(f"{row['model_id']} :: {row['candidate_root_node_id']}\n")
        f.write(f"  case_dir: {row['case_dir']}\n")
        f.write(f"  qubit_count: {row['qubit_count']}\n")
        f.write(f"  shots: {row['shots']}\n")
        f.write(f"  seed: {row['seed']}\n")
        f.write(f"  nonzero_count_bitstrings: {row['nonzero_count_bitstrings']}\n")
        f.write(f"  reference_mcs_count: {row['reference_mcs_count']}\n")
        f.write(f"  recovered_mcs_count: {row['recovered_mcs_count']}\n")
        f.write(f"  all_reference_mcs_recovered: {row['all_reference_mcs_recovered']}\n")
        f.write(f"  raw_counts_json: {row['raw_counts_json']}\n")
        f.write(f"  quantum_recovered_mcs_json: {row['quantum_recovered_mcs_json']}\n")
        f.write("  top_counts:\n")
        for bit, count in row["top_counts"]:
            f.write(f"    {bit}: {count}\n")
        f.write("\n")

print(f"SUMMARY_JSON={summary_path}")
print(f"RUN_SHEET={run_sheet}")
PY

echo
echo "===== RAW COUNTS STATUS 0001 ====="
sed -n '1,220p' "${BATCH_RUN}/0001_phase2b_row_9683/raw_counts.json"

echo
echo "===== QUANTUM RECOVERED MCS STATUS 0001 ====="
sed -n '1,220p' "${BATCH_RUN}/0001_phase2b_row_9683/quantum_recovered_mcs.json"

echo
echo "===== RAW COUNTS STATUS 0002 ====="
sed -n '1,220p' "${BATCH_RUN}/0002_phase2b_row_4228/raw_counts.json"

echo
echo "===== QUANTUM RECOVERED MCS STATUS 0002 ====="
sed -n '1,220p' "${BATCH_RUN}/0002_phase2b_row_4228/quantum_recovered_mcs.json"

echo
echo "===== LOCAL COUNTS POPULATION SUMMARY ====="
sed -n '1,260p' "${OUTDIR}/90_local_counts_population_summary.json"

echo
echo "===== LOCAL COUNTS POPULATION RUN SHEET ====="
sed -n '1,220p' "${OUTDIR}/91_local_counts_population_run_sheet.txt"
