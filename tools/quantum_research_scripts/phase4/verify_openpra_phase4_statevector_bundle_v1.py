#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np

try:
    from qiskit import QuantumCircuit
    from qiskit.circuit.library import UnitaryGate
    from qiskit.quantum_info import Statevector
except Exception as exc:  # pragma: no cover
    raise SystemExit(
        "Qiskit is required for this bounded Phase 4 statevector verifier. "
        f"Import failure: {exc}"
    ) from exc


SCRIPT_VERSION = "phase4-statevector-verifier-v1"
INPUT_ROOT = "_work/openpra_phase4_qiskit_bundles_v1"
OUTPUT_ROOT = "_work/openpra_phase4_statevector_checks_v1"
INFEASIBLE_MASS_TOLERANCE = 1e-10


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
        candidate = Path(explicit_run)
        run_dir = candidate if candidate.is_absolute() else repo_root / candidate
        run_dir = run_dir.resolve()
        if not run_dir.is_dir():
            raise SystemExit(f"Input run does not exist: {run_dir}")
        return run_dir

    runs = sorted((repo_root / INPUT_ROOT).glob("*"), reverse=True)
    runs = [run for run in runs if run.is_dir()]
    if not runs:
        raise SystemExit(f"No runs found under {repo_root / INPUT_ROOT}")
    return runs[0]


def collect_case_dirs(input_run: Path) -> List[Path]:
    case_dirs = sorted([path for path in input_run.iterdir() if path.is_dir() and path.name.isdigit()])
    if not case_dirs:
        raise SystemExit(f"No numeric case directories found in {input_run}")
    return case_dirs


def bitstring_to_index(bitstring: str) -> int:
    return int(bitstring, 2)


def hamming_distance(left: str, right: str) -> int:
    return sum(1 for l_bit, r_bit in zip(left, right) if l_bit != r_bit)


def build_uniform_feasible_statevector(feasible_bitstrings: List[str], qubit_count: int) -> np.ndarray:
    dimension = 1 << qubit_count
    vector = np.zeros(dimension, dtype=np.complex128)

    if not feasible_bitstrings:
      raise SystemExit("Feasible basis state list is empty.")

    amplitude = 1.0 / np.sqrt(len(feasible_bitstrings))
    for bitstring in feasible_bitstrings:
        if len(bitstring) != qubit_count:
            raise SystemExit(
                f"Feasible bitstring width mismatch. Bitstring={bitstring}, expected={qubit_count}"
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


def build_feasibility_preserving_mixer_unitary(
    feasible_bitstrings: List[str], beta: float, qubit_count: int
) -> np.ndarray:
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
    return eigenvectors @ phase_diagonal @ eigenvectors.conj().T


def build_nominal_qaoa_circuit(recipe: Dict[str, Any]) -> QuantumCircuit:
    qubit_count = int(recipe["qubitCount"])
    beta = float(recipe["parameterDefaults"]["beta"])
    gamma = float(recipe["parameterDefaults"]["gamma"])
    feasible_bitstrings = list(recipe["initialState"]["feasibleBasisStateBitstrings"])
    diagonal_weights = list(recipe["costHamiltonian"]["diagonalWeights"])

    initial_state = build_uniform_feasible_statevector(feasible_bitstrings, qubit_count)
    cost_unitary = build_cost_phase_unitary(diagonal_weights, gamma)
    mixer_unitary = build_feasibility_preserving_mixer_unitary(feasible_bitstrings, beta, qubit_count)

    circuit = QuantumCircuit(qubit_count, name="bounded_qaoa_p1_nominal")
    circuit.initialize(initial_state, list(range(qubit_count)))
    circuit.append(UnitaryGate(cost_unitary, label="U_C_p1"), list(range(qubit_count)))
    circuit.append(UnitaryGate(mixer_unitary, label="U_M_p1"), list(range(qubit_count)))
    return circuit


def probability_table_from_statevector(statevector: Statevector, qubit_count: int) -> List[Tuple[str, float]]:
    probabilities = np.abs(statevector.data) ** 2
    table: List[Tuple[str, float]] = []

    for index, probability in enumerate(probabilities):
        if probability > 0.0:
            table.append((format(index, f"0{qubit_count}b"), float(probability)))

    table.sort(key=lambda item: (-item[1], item[0]))
    return table


def verify_case(case_dir: Path) -> Dict[str, Any]:
    candidate_export = load_json(next(case_dir.glob("*_primary_candidate_export.json")))
    recipe = load_json(next(case_dir.glob("*_qaoa_recipe.json")))
    circuit_summary = load_json(next(case_dir.glob("*_default_bound_circuit_summary.json")))

    feasible_bitstrings = set(recipe["initialState"]["feasibleBasisStateBitstrings"])
    mcs_bitstrings = set(recipe["mixer"]["mcsBitstrings"])
    qubit_count = int(recipe["qubitCount"])

    if qubit_count > 8:
        raise SystemExit(f"Bounded verifier only supports n <= 8. Found n = {qubit_count} in {case_dir}")

    circuit = build_nominal_qaoa_circuit(recipe)
    statevector = Statevector.from_instruction(circuit)
    table = probability_table_from_statevector(statevector, qubit_count)

    infeasible_mass = 0.0
    feasible_mass = 0.0
    mcs_mass = 0.0

    top_states: List[Dict[str, Any]] = []
    for bitstring, probability in table[:10]:
        top_states.append(
            {
                "bitstring": bitstring,
                "probability": probability,
                "is_feasible": bitstring in feasible_bitstrings,
                "is_mcs": bitstring in mcs_bitstrings,
            }
        )

    for bitstring, probability in table:
        if bitstring in feasible_bitstrings:
            feasible_mass += probability
        else:
            infeasible_mass += probability

        if bitstring in mcs_bitstrings:
            mcs_mass += probability

    total_probability = feasible_mass + infeasible_mass
    infeasible_mass_pass = infeasible_mass <= INFEASIBLE_MASS_TOLERANCE

    return {
        "case_id": case_dir.name,
        "model_id": candidate_export["modelId"],
        "model_name": candidate_export["modelName"],
        "candidate_root_node_id": candidate_export["candidateRootNodeId"],
        "topology_class": candidate_export.get("topologyClassification", {}).get("topologyClass"),
        "required_qubits": candidate_export.get("requirementsAssessment", {}).get("requiredQubits"),
        "statevector_eligible": candidate_export["statevectorVerificationPlan"]["eligible"],
        "recipe_version": recipe["recipeVersion"],
        "depth_p": recipe["depthP"],
        "beta": recipe["parameterDefaults"]["beta"],
        "gamma": recipe["parameterDefaults"]["gamma"],
        "feasible_basis_state_count": recipe["initialState"]["feasibleBasisStateCount"],
        "mcs_count": candidate_export["frozenMcsReference"]["minimalCutSetCount"],
        "circuit_depth_nominal": circuit.depth(),
        "circuit_summary_depth_materialized": circuit_summary["circuit_depth"],
        "total_probability": total_probability,
        "feasible_mass": feasible_mass,
        "infeasible_mass": infeasible_mass,
        "mcs_mass": mcs_mass,
        "infeasible_mass_tolerance": INFEASIBLE_MASS_TOLERANCE,
        "infeasible_mass_pass": infeasible_mass_pass,
        "top_states": top_states,
    }


def build_readme(output_run: Path, input_run: Path, case_reports: List[Dict[str, Any]]) -> None:
    lines = [
        "# OpenPRA Phase 4 Bounded Statevector Verification Run",
        "",
        f"Run directory: {output_run}",
        f"Input Qiskit bundle run: {input_run}",
        f"Generated at: {utc_now_iso()}",
        f"Script version: {SCRIPT_VERSION}",
        "",
        "Purpose",
        "",
        "Verify the bounded default bound QAOA plus proof case circuits under exact statevector evaluation.",
        "",
        "Key results",
        "",
    ]

    for report in case_reports:
        lines.append(
            f"- {report['case_id']}: topology={report['topology_class']}, "
            f"required_qubits={report['required_qubits']}, "
            f"infeasible_mass={report['infeasible_mass']:.12f}, "
            f"mcs_mass={report['mcs_mass']:.12f}, "
            f"pass={'yes' if report['infeasible_mass_pass'] else 'no'}"
        )

    lines.extend(
        [
            "",
            "Bounded scope note",
            "",
            "This verification covers the current synthetic A, B, C, and D proof cases only.",
            "It is a bounded exact statevector checkpoint before widening to larger cohorts.",
            "",
        ]
    )

    (output_run / "README.txt").write_text("\n".join(lines), encoding="utf-8")


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify bounded Phase 4 Qiskit bundles with exact statevector evaluation."
    )
    parser.add_argument(
        "--input-run",
        dest="input_run",
        default=None,
        help="Optional repo relative or absolute input run directory. Default: latest Qiskit bundle run.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = resolve_repo_root(Path.cwd())
    input_run = resolve_input_run(repo_root, args.input_run)
    case_dirs = collect_case_dirs(input_run)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    case_reports: List[Dict[str, Any]] = []
    for case_dir in case_dirs:
        report = verify_case(case_dir)
        case_reports.append(report)
        write_json(output_run / f"{case_dir.name}_statevector_report.json", report)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "input_run": str(input_run),
        "output_run": str(output_run),
        "case_count": len(case_reports),
        "all_infeasible_mass_pass": all(report["infeasible_mass_pass"] for report in case_reports),
        "worst_infeasible_mass": max(report["infeasible_mass"] for report in case_reports),
        "cases": case_reports,
    }

    write_json(output_run / "90_statevector_verification_summary.json", summary)
    build_readme(output_run, input_run, case_reports)
    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_statevector_verification_summary.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
