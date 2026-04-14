#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np

try:
    from qiskit import QuantumCircuit, qpy
    from qiskit.circuit.library import UnitaryGate
except Exception as exc:  # pragma: no cover
    raise SystemExit(
        "Qiskit is required for this bounded Phase 4 materializer. "
        f"Import failure: {exc}"
    ) from exc


SCRIPT_VERSION = "phase4-qiskit-materializer-v1"
INPUT_RUN_GLOB = "_work/openpra_phase4_clqubo_exports_v1/*"
OUTPUT_ROOT = "_work/openpra_phase4_qiskit_bundles_v1"


@dataclass
class CaseMaterializationResult:
    case_id: str
    model_id: str
    candidate_root_node_id: str
    topology_class: str
    required_qubits: int
    output_dir: str
    qpy_path: str
    variable_mapping_csv_path: str
    cost_matrix_npz_path: str
    mixer_json_path: str
    qaoa_recipe_json_path: str
    circuit_summary_json_path: str


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_repo_root(start: Path) -> Path:
    return start.resolve()


def resolve_input_run(repo_root: Path, explicit_run: str | None) -> Path:
    if explicit_run:
        run_dir = (repo_root / explicit_run).resolve()
        if not run_dir.is_dir():
            raise SystemExit(f"Explicit input run does not exist: {run_dir}")
        return run_dir

    candidates = sorted((repo_root / "_work" / "openpra_phase4_clqubo_exports_v1").glob("*"), reverse=True)
    candidates = [candidate for candidate in candidates if candidate.is_dir()]
    if not candidates:
        raise SystemExit("No Phase 4 CL-QUBO export runs found under _work/openpra_phase4_clqubo_exports_v1")
    return candidates[0]


def collect_case_export_paths(input_run: Path) -> List[Path]:
    paths = sorted(input_run.glob("*_case*_clqubo_export.json"))
    if not paths:
        raise SystemExit(f"No case export JSON files found in input run: {input_run}")
    return paths


def pick_primary_candidate(document: Dict[str, Any]) -> Dict[str, Any]:
    candidates = document.get("clQuboCandidates", [])
    matched = [
        candidate
        for candidate in candidates
        if candidate.get("requirementsAssessment", {}).get("matrixEntryMatched") is True
        and candidate.get("topologyClassification", {}).get("topologyClass") in {"A", "B", "C", "D"}
    ]

    if len(matched) != 1:
        raise SystemExit(
            "Expected exactly one bounded proof candidate with matrixEntryMatched=true "
            f"and topology class A/B/C/D for model {document.get('modelId')}. "
            f"Found {len(matched)}."
        )

    return matched[0]


def bitstring_to_index(bitstring: str) -> int:
    return int(bitstring, 2)


def hamming_distance(left: str, right: str) -> int:
    return sum(1 for l_bit, r_bit in zip(left, right) if l_bit != r_bit)


def build_uniform_feasible_statevector(feasible_bitstrings: List[str], qubit_count: int) -> np.ndarray:
    dimension = 1 << qubit_count
    vector = np.zeros(dimension, dtype=np.complex128)

    if not feasible_bitstrings:
        raise SystemExit("Feasible basis state list is empty. Cannot build bounded initial state.")

    amplitude = 1.0 / np.sqrt(len(feasible_bitstrings))
    for bitstring in feasible_bitstrings:
        if len(bitstring) != qubit_count:
            raise SystemExit(
                f"Feasible bitstring width mismatch. Bitstring={bitstring}, expected width={qubit_count}"
            )
        vector[bitstring_to_index(bitstring)] = amplitude

    return vector


def build_cost_phase_unitary(diagonal_weights: List[float], gamma: float) -> np.ndarray:
    qubit_count = len(diagonal_weights)
    dimension = 1 << qubit_count
    diagonal = np.zeros(dimension, dtype=np.complex128)

    for state_index in range(dimension):
        bitstring = format(state_index, f"0{qubit_count}b")
        cost = sum(weight for bit, weight in zip(bitstring, diagonal_weights) if bit == "1")
        diagonal[state_index] = np.exp(-1j * gamma * cost)

    return np.diag(diagonal)


def build_feasibility_preserving_mixer_unitary(feasible_bitstrings: List[str], beta: float, qubit_count: int) -> np.ndarray:
    dimension = 1 << qubit_count
    adjacency = np.zeros((dimension, dimension), dtype=np.float64)
    normalized_feasible = sorted(set(feasible_bitstrings))

    for left_index, left_bitstring in enumerate(normalized_feasible):
        for right_bitstring in normalized_feasible[left_index + 1 :]:
            if hamming_distance(left_bitstring, right_bitstring) == 1:
                i = bitstring_to_index(left_bitstring)
                j = bitstring_to_index(right_bitstring)
                adjacency[i, j] = 1.0
                adjacency[j, i] = 1.0

    eigenvalues, eigenvectors = np.linalg.eigh(adjacency.astype(np.complex128))
    phase_diagonal = np.diag(np.exp(-1j * beta * eigenvalues))
    mixer_unitary = eigenvectors @ phase_diagonal @ eigenvectors.conj().T

    return mixer_unitary


def count_ops_as_plain_dict(circuit: QuantumCircuit) -> Dict[str, int]:
    raw = circuit.count_ops()
    return {str(key): int(value) for key, value in raw.items()}


def build_default_bound_qaoa_circuit(candidate: Dict[str, Any]) -> Tuple[QuantumCircuit, Dict[str, Any]]:
    recipe = candidate["qaoaCircuitRecipe"]
    qubit_count = int(recipe["qubitCount"])
    beta = float(recipe["parameterDefaults"]["beta"])
    gamma = float(recipe["parameterDefaults"]["gamma"])
    feasible_bitstrings = list(recipe["initialState"]["feasibleBasisStateBitstrings"])
    diagonal_weights = list(recipe["costHamiltonian"]["diagonalWeights"])

    initial_state = build_uniform_feasible_statevector(feasible_bitstrings, qubit_count)
    cost_unitary = build_cost_phase_unitary(diagonal_weights, gamma)
    mixer_unitary = build_feasibility_preserving_mixer_unitary(feasible_bitstrings, beta, qubit_count)

    circuit = QuantumCircuit(qubit_count, qubit_count, name=f"{candidate['candidateRootNodeId']}_qaoa_p1")
    circuit.metadata = {
        "script_version": SCRIPT_VERSION,
        "candidate_root_node_id": candidate["candidateRootNodeId"],
        "model_id": candidate["modelId"],
        "topology_class": candidate.get("topologyClassification", {}).get("topologyClass"),
        "bitstring_index_convention": "direct_binary_string_to_state_index",
        "recipe_version": recipe["recipeVersion"],
        "depth_p": recipe["depthP"],
        "beta": beta,
        "gamma": gamma,
    }

    circuit.initialize(initial_state, list(range(qubit_count)))
    circuit.append(UnitaryGate(cost_unitary, label="U_C_p1"), list(range(qubit_count)))
    circuit.append(UnitaryGate(mixer_unitary, label="U_M_p1"), list(range(qubit_count)))
    circuit.measure(list(range(qubit_count)), list(range(qubit_count)))

    summary = {
        "script_version": SCRIPT_VERSION,
        "candidate_root_node_id": candidate["candidateRootNodeId"],
        "model_id": candidate["modelId"],
        "model_name": candidate["modelName"],
        "topology_class": candidate.get("topologyClassification", {}).get("topologyClass"),
        "matrix_entry_matched": candidate.get("requirementsAssessment", {}).get("matrixEntryMatched"),
        "required_qubits": candidate.get("requirementsAssessment", {}).get("requiredQubits"),
        "qubit_count": qubit_count,
        "depth_p": recipe["depthP"],
        "beta": beta,
        "gamma": gamma,
        "feasible_basis_state_count": len(feasible_bitstrings),
        "mcs_count": candidate["frozenMcsReference"]["minimalCutSetCount"],
        "circuit_depth": int(circuit.depth()),
        "circuit_size": int(circuit.size()),
        "count_ops": count_ops_as_plain_dict(circuit),
        "qpy_eligible": True,
        "bitstring_index_convention": "direct_binary_string_to_state_index",
        "note": (
            "This is a bounded default-bound QAOA+ materialization for the synthetic proof cases. "
            "It is not yet the generalized full-corpus scalable constructor."
        ),
    }

    return circuit, summary


def write_variable_mapping_csv(path: Path, variable_mapping: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["variableIndex", "variableName", "basicEventId", "basicEventLabel"],
        )
        writer.writeheader()
        for row in variable_mapping:
            writer.writerow(
                {
                    "variableIndex": row.get("variableIndex"),
                    "variableName": row.get("variableName"),
                    "basicEventId": row.get("basicEventId"),
                    "basicEventLabel": row.get("basicEventLabel", ""),
                }
            )


def write_cost_matrix_npz(path: Path, cost_matrix: Dict[str, Any]) -> None:
    diagonal_weights = np.array(cost_matrix["diagonalWeights"], dtype=np.float64)
    qubo_matrix = np.diag(diagonal_weights)
    np.savez(
        path,
        dimension=np.array([int(cost_matrix["dimension"])], dtype=np.int64),
        diagonal_weights=diagonal_weights,
        qubo_matrix=qubo_matrix,
    )


def write_qpy(path: Path, circuit: QuantumCircuit) -> None:
    with path.open("wb") as handle:
        qpy.dump(circuit, handle)


def write_manifest(output_run: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}

    for path in sorted(output_run.rglob("*")):
        if path.is_file():
            relative_path = str(path.relative_to(output_run))
            manifest[relative_path] = sha256_file(path)

    sha_path = output_run / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as handle:
        for relative_path, digest in sorted(manifest.items()):
            handle.write(f"{digest}  {relative_path}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    return manifest


def materialize_case(case_export_path: Path, output_run: Path) -> CaseMaterializationResult:
    case_document = load_json(case_export_path)
    candidate = pick_primary_candidate(case_document)

    case_prefix = case_export_path.name.split("_")[0]
    case_id = case_prefix
    case_output_dir = output_run / case_id
    case_output_dir.mkdir(parents=True, exist_ok=True)

    candidate_export_path = case_output_dir / f"{case_id}_primary_candidate_export.json"
    variable_mapping_csv_path = case_output_dir / f"{case_id}_variable_mapping.csv"
    cost_matrix_npz_path = case_output_dir / f"{case_id}_cost_matrix.npz"
    mixer_json_path = case_output_dir / f"{case_id}_mixer_specification.json"
    qaoa_recipe_json_path = case_output_dir / f"{case_id}_qaoa_recipe.json"
    circuit_summary_json_path = case_output_dir / f"{case_id}_default_bound_circuit_summary.json"
    qpy_path = case_output_dir / f"{case_id}_default_bound_circuit.qpy"

    write_json(candidate_export_path, candidate)
    write_variable_mapping_csv(variable_mapping_csv_path, candidate["variableMapping"])
    write_cost_matrix_npz(cost_matrix_npz_path, candidate["costMatrix"])
    write_json(mixer_json_path, candidate["mixerSpecification"])
    write_json(qaoa_recipe_json_path, candidate["qaoaCircuitRecipe"])

    circuit, circuit_summary = build_default_bound_qaoa_circuit(candidate)
    write_json(circuit_summary_json_path, circuit_summary)
    write_qpy(qpy_path, circuit)

    return CaseMaterializationResult(
        case_id=case_id,
        model_id=str(candidate["modelId"]),
        candidate_root_node_id=str(candidate["candidateRootNodeId"]),
        topology_class=str(candidate.get("topologyClassification", {}).get("topologyClass")),
        required_qubits=int(candidate.get("requirementsAssessment", {}).get("requiredQubits")),
        output_dir=str(case_output_dir),
        qpy_path=str(qpy_path),
        variable_mapping_csv_path=str(variable_mapping_csv_path),
        cost_matrix_npz_path=str(cost_matrix_npz_path),
        mixer_json_path=str(mixer_json_path),
        qaoa_recipe_json_path=str(qaoa_recipe_json_path),
        circuit_summary_json_path=str(circuit_summary_json_path),
    )


def build_readme(output_run: Path, input_run: Path, results: List[CaseMaterializationResult]) -> None:
    lines = [
        "# OpenPRA Phase 4 Bounded Qiskit Materialization Run",
        "",
        f"Run directory: {output_run}",
        f"Input Phase 4 export run: {input_run}",
        f"Generated at: {datetime.now(timezone.utc).isoformat()}",
        f"Script version: {SCRIPT_VERSION}",
        "",
        "Purpose",
        "",
        "Consume the current bounded Phase 4 CL-QUBO export slice and materialize bounded default-bound Qiskit artifacts for the synthetic proof cases.",
        "",
        "Delivered artifacts per case",
        "",
        "- primary candidate export JSON",
        "- variable mapping CSV",
        "- cost matrix NPZ",
        "- mixer specification JSON",
        "- QAOA recipe JSON",
        "- default-bound Qiskit circuit summary JSON",
        "- QPY circuit export",
        "",
        "Key results",
        "",
    ]

    for result in results:
        lines.append(
            f"- {result.case_id}: model={result.model_id}, root={result.candidate_root_node_id}, "
            f"topology={result.topology_class}, required_qubits={result.required_qubits}"
        )

    lines.extend(
        [
            "",
            "Bounded scope note",
            "",
            "This run materializes default-bound proof-case circuits from the already exported bounded recipe.",
            "It is not yet the final generalized scalable QAOA+ constructor for the full OpenPRA corpus.",
            "",
        ]
    )

    (output_run / "README.txt").write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Materialize bounded Phase 4 Qiskit artifacts from the latest CL-QUBO export run."
    )
    parser.add_argument(
        "--input-run",
        dest="input_run",
        default=None,
        help="Optional repo-relative or absolute input run directory. Default: latest Phase 4 CL-QUBO export run.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = resolve_repo_root(Path.cwd())

    if args.input_run is None:
        input_run = resolve_input_run(repo_root, None)
    else:
        explicit = Path(args.input_run)
        input_run = explicit if explicit.is_absolute() else (repo_root / explicit)

    input_run = input_run.resolve()
    if not input_run.is_dir():
        raise SystemExit(f"Input run does not exist: {input_run}")

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    case_export_paths = collect_case_export_paths(input_run)
    results = [materialize_case(case_export_path, output_run) for case_export_path in case_export_paths]

    summary_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "script_version": SCRIPT_VERSION,
        "input_run": str(input_run),
        "output_run": str(output_run),
        "case_count": len(results),
        "cases": [
            {
                "case_id": result.case_id,
                "model_id": result.model_id,
                "candidate_root_node_id": result.candidate_root_node_id,
                "topology_class": result.topology_class,
                "required_qubits": result.required_qubits,
                "output_dir": result.output_dir,
                "qpy_path": result.qpy_path,
            }
            for result in results
        ],
    }
    write_json(output_run / "90_qiskit_materialization_summary.json", summary_payload)
    build_readme(output_run, input_run, results)
    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_qiskit_materialization_summary.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
