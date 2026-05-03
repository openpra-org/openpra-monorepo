#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np


SCRIPT_VERSION = "phase4-statevector-parameter-sweep-v1"
INPUT_ROOT = "_work/openpra_phase4_qiskit_bundles_v1"
OUTPUT_ROOT = "_work/openpra_phase4_parameter_sweeps_v1"

ANGLE_GRID = [
    0.0,
    math.pi / 8.0,
    -math.pi / 8.0,
    math.pi / 4.0,
    -math.pi / 4.0,
    3.0 * math.pi / 8.0,
    -3.0 * math.pi / 8.0,
    math.pi / 2.0,
    -math.pi / 2.0,
]

INFEASIBLE_MASS_TOLERANCE = 1e-10


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def evaluate_point(
    qubit_count: int,
    initial_state: np.ndarray,
    diagonal_weights: List[float],
    feasible_bitstrings: List[str],
    mcs_bitstrings: List[str],
    beta: float,
    gamma: float,
) -> Dict[str, Any]:
    cost_unitary = build_cost_phase_unitary(diagonal_weights, gamma)
    mixer_unitary = build_feasibility_preserving_mixer_unitary(feasible_bitstrings, beta, qubit_count)

    final_state = mixer_unitary @ (cost_unitary @ initial_state)
    probabilities = np.abs(final_state) ** 2

    feasible_set = set(feasible_bitstrings)
    mcs_set = set(mcs_bitstrings)

    feasible_mass = 0.0
    infeasible_mass = 0.0
    mcs_mass = 0.0

    top_index = int(np.argmax(probabilities))
    top_prob = float(probabilities[top_index])
    top_bitstring = format(top_index, f"0{qubit_count}b")

    for index, probability in enumerate(probabilities):
        probability = float(probability)
        if probability == 0.0:
            continue

        bitstring = format(index, f"0{qubit_count}b")
        if bitstring in feasible_set:
            feasible_mass += probability
        else:
            infeasible_mass += probability

        if bitstring in mcs_set:
            mcs_mass += probability

    return {
        "beta": beta,
        "gamma": gamma,
        "feasible_mass": feasible_mass,
        "infeasible_mass": infeasible_mass,
        "mcs_mass": mcs_mass,
        "top_bitstring": top_bitstring,
        "top_probability": top_prob,
        "top_is_feasible": top_bitstring in feasible_set,
        "top_is_mcs": top_bitstring in mcs_set,
        "infeasible_mass_pass": infeasible_mass <= INFEASIBLE_MASS_TOLERANCE,
    }


def point_sort_key(point: Dict[str, Any]) -> Tuple[Any, ...]:
    return (
        -point["mcs_mass"],
        point["infeasible_mass"],
        abs(point["beta"]) + abs(point["gamma"]),
        abs(point["beta"]),
        abs(point["gamma"]),
        point["beta"],
        point["gamma"],
    )


def summarize_case(case_dir: Path) -> Dict[str, Any]:
    candidate_export = load_json(next(case_dir.glob("*_primary_candidate_export.json")))
    recipe = load_json(next(case_dir.glob("*_qaoa_recipe.json")))

    qubit_count = int(recipe["qubitCount"])
    feasible_bitstrings = list(recipe["initialState"]["feasibleBasisStateBitstrings"])
    mcs_bitstrings = list(recipe["mixer"]["mcsBitstrings"])
    diagonal_weights = list(recipe["costHamiltonian"]["diagonalWeights"])

    initial_state = build_uniform_feasible_statevector(feasible_bitstrings, qubit_count)

    baseline_beta = float(recipe["parameterDefaults"]["beta"])
    baseline_gamma = float(recipe["parameterDefaults"]["gamma"])

    all_points: List[Dict[str, Any]] = []
    for beta in ANGLE_GRID:
        for gamma in ANGLE_GRID:
            point = evaluate_point(
                qubit_count=qubit_count,
                initial_state=initial_state,
                diagonal_weights=diagonal_weights,
                feasible_bitstrings=feasible_bitstrings,
                mcs_bitstrings=mcs_bitstrings,
                beta=beta,
                gamma=gamma,
            )
            all_points.append(point)

    baseline = evaluate_point(
        qubit_count=qubit_count,
        initial_state=initial_state,
        diagonal_weights=diagonal_weights,
        feasible_bitstrings=feasible_bitstrings,
        mcs_bitstrings=mcs_bitstrings,
        beta=baseline_beta,
        gamma=baseline_gamma,
    )

    best = sorted(all_points, key=point_sort_key)[0]
    top_points = sorted(all_points, key=point_sort_key)[:10]

    baseline_mcs_mass = baseline["mcs_mass"]
    best_mcs_mass = best["mcs_mass"]
    improvement_abs = best_mcs_mass - baseline_mcs_mass

    if baseline_mcs_mass > 0:
        improvement_ratio = best_mcs_mass / baseline_mcs_mass
    else:
        improvement_ratio = None

    return {
        "case_id": case_dir.name,
        "model_id": candidate_export["modelId"],
        "model_name": candidate_export["modelName"],
        "candidate_root_node_id": candidate_export["candidateRootNodeId"],
        "topology_class": candidate_export.get("topologyClassification", {}).get("topologyClass"),
        "required_qubits": candidate_export.get("requirementsAssessment", {}).get("requiredQubits"),
        "basic_event_count": len(candidate_export["orderedBasicEventIds"]),
        "minimal_cut_set_count": candidate_export["frozenMcsReference"]["minimalCutSetCount"],
        "feasible_basis_state_count": recipe["initialState"]["feasibleBasisStateCount"],
        "grid_point_count": len(all_points),
        "baseline": baseline,
        "best": best,
        "improvement_abs": improvement_abs,
        "improvement_ratio": improvement_ratio,
        "best_improves_baseline": best_mcs_mass > baseline_mcs_mass + 1e-15,
        "best_top_is_mcs": best["top_is_mcs"],
        "top10_points": top_points,
    }


def build_readme(output_run: Path, input_run: Path, case_reports: List[Dict[str, Any]], summary: Dict[str, Any]) -> None:
    lines = [
        "# OpenPRA Phase 4 Exact Statevector Parameter Sweep",
        "",
        f"Run directory: {output_run}",
        f"Input Qiskit bundle run: {input_run}",
        f"Generated at: {utc_now_iso()}",
        f"Script version: {SCRIPT_VERSION}",
        "",
        "Purpose",
        "",
        "Test whether low default-bound MCS mass is mainly a fixed-parameter issue by sweeping beta and gamma over a deterministic bounded grid.",
        "",
        "Grid",
        "",
        "- beta values: 0, ±pi/8, ±pi/4, ±3pi/8, ±pi/2",
        "- gamma values: 0, ±pi/8, ±pi/4, ±3pi/8, ±pi/2",
        f"- points per case: {len(ANGLE_GRID) * len(ANGLE_GRID)}",
        "",
        "Rollup",
        "",
        f"- case count: {summary['case_count']}",
        f"- improved cases: {summary['improved_case_count']}",
        f"- all best-point infeasible mass pass: {'yes' if summary['all_best_points_pass'] else 'no'}",
        f"- mean baseline mcs mass: {summary['mean_baseline_mcs_mass']:.12f}",
        f"- mean best mcs mass: {summary['mean_best_mcs_mass']:.12f}",
        f"- mean absolute improvement: {summary['mean_improvement_abs']:.12f}",
        "",
        "Per case highlights",
        "",
    ]

    for report in case_reports:
        lines.append(
            f"- {report['case_id']}: topology={report['topology_class']}, n={report['basic_event_count']}, "
            f"baseline_mcs={report['baseline']['mcs_mass']:.12f}, "
            f"best_mcs={report['best']['mcs_mass']:.12f}, "
            f"best_beta={report['best']['beta']:.12f}, "
            f"best_gamma={report['best']['gamma']:.12f}, "
            f"improved={'yes' if report['best_improves_baseline'] else 'no'}"
        )

    lines.extend(
        [
            "",
            "Interpretation",
            "",
            "This run does not change the export plumbing. It only measures whether exact bounded parameter tuning improves MCS mass relative to the current default beta and gamma settings.",
            "",
        ]
    )

    (output_run / "README.txt").write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sweep beta and gamma for bounded Phase 4 QAOA+ recipes using exact statevector evaluation."
    )
    parser.add_argument(
        "--input-run",
        dest="input_run",
        default=None,
        help="Optional repo-relative or absolute Qiskit bundle run directory. Default: latest Qiskit bundle run.",
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
        report = summarize_case(case_dir)
        case_reports.append(report)
        write_json(output_run / f"{case_dir.name}_parameter_sweep_report.json", report)

    improved_case_count = sum(1 for report in case_reports if report["best_improves_baseline"])
    all_best_points_pass = all(report["best"]["infeasible_mass_pass"] for report in case_reports)

    mean_baseline_mcs_mass = sum(report["baseline"]["mcs_mass"] for report in case_reports) / len(case_reports)
    mean_best_mcs_mass = sum(report["best"]["mcs_mass"] for report in case_reports) / len(case_reports)
    mean_improvement_abs = sum(report["improvement_abs"] for report in case_reports) / len(case_reports)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "input_run": str(input_run),
        "output_run": str(output_run),
        "angle_grid_radians": ANGLE_GRID,
        "case_count": len(case_reports),
        "grid_points_per_case": len(ANGLE_GRID) * len(ANGLE_GRID),
        "improved_case_count": improved_case_count,
        "all_best_points_pass": all_best_points_pass,
        "mean_baseline_mcs_mass": mean_baseline_mcs_mass,
        "mean_best_mcs_mass": mean_best_mcs_mass,
        "mean_improvement_abs": mean_improvement_abs,
        "cases": case_reports,
    }

    write_json(output_run / "90_parameter_sweep_summary.json", summary)
    build_readme(output_run, input_run, case_reports, summary)
    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_parameter_sweep_summary.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
