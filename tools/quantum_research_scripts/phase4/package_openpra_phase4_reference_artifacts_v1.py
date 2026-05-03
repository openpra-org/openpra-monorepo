#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np


SCRIPT_VERSION = "phase4-reference-artifact-packager-v3"
TUNED_ROOT = "_work/openpra_phase4_tuned_exports_v1"
QISKIT_ROOT = "_work/openpra_phase4_qiskit_bundles_v1"
OUTPUT_ROOT = "_work/openpra_phase4_reference_artifact_packages_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_sha256sums(root: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            relative = str(path.relative_to(root))
            manifest[relative] = sha256_file(path)

    sha_path = root / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as handle:
        for relative, digest in sorted(manifest.items()):
            handle.write(f"{digest}  {relative}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    return manifest


def latest_run(root: Path) -> Path:
    runs = sorted([path for path in root.glob("*") if path.is_dir()], reverse=True)
    if not runs:
        raise SystemExit(f"No runs found under {root}")
    return runs[0]


def resolve_run(repo_root: Path, explicit_path: Optional[str], default_root: str) -> Path:
    if explicit_path:
        candidate = Path(explicit_path)
        run_dir = candidate if candidate.is_absolute() else (repo_root / candidate)
        run_dir = run_dir.resolve()
        if not run_dir.is_dir():
            raise SystemExit(f"Run does not exist: {run_dir}")
        return run_dir
    return latest_run((repo_root / default_root).resolve())


def choose_primary_candidate(payload: Dict[str, Any]) -> Dict[str, Any]:
    candidates = payload.get("clQuboCandidates", [])
    if not candidates:
        raise SystemExit(f"No clQuboCandidates found for model {payload.get('modelId', 'unknown')}")

    for candidate in candidates:
        if candidate.get("requirementsAssessment", {}).get("matrixEntryMatched") is True:
            return candidate

    return candidates[0]


def find_case_id_from_filename(filename: str) -> str:
    return filename.split("_", 1)[0]


def build_diagonal_qubo_matrix(diagonal_weights: List[float]) -> np.ndarray:
    weights = np.asarray(diagonal_weights, dtype=np.float64)
    return np.diag(weights)


def write_variable_mapping_csv(path: Path, source_variable_mapping: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["variable_index", "variable_name", "basic_event_id"])
        for row in source_variable_mapping:
            writer.writerow(
                [
                    int(row["variableIndex"]),
                    row["variableName"],
                    row["basicEventId"],
                ]
            )


def copy_if_exists(src: Path, dst: Path) -> bool:
    if src.exists():
        shutil.copy2(src, dst)
        return True
    return False


def require_full_cl_qubo_model(candidate: Dict[str, Any], export_json_path: Path) -> Dict[str, Any]:
    model = candidate.get("fullClQuboModel")
    if not isinstance(model, dict):
        raise SystemExit(
            f"fullClQuboModel missing or invalid in source export: {export_json_path}"
        )

    required_top_keys = {"status", "encodingFamily", "nBasic", "nVarsTotal", "penaltyP", "topGate", "vars", "qubo", "ising"}
    missing = sorted(required_top_keys - set(model.keys()))
    if missing:
        raise SystemExit(
            f"fullClQuboModel missing required keys in {export_json_path}: {missing}"
        )

    return model


def build_paper10_compatible_qubo_model(full_model: Dict[str, Any]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "ising": full_model["ising"],
        "n_basic": full_model["nBasic"],
        "n_vars_total": full_model["nVarsTotal"],
        "penalty_P": full_model["penaltyP"],
        "qubo": full_model["qubo"],
        "top_gate": full_model["topGate"],
        "vars": full_model["vars"],
    }

    if full_model.get("subtreeId") is not None:
        payload["subtree_id"] = full_model["subtreeId"]

    if full_model.get("subtreeDir") is not None:
        payload["subtree_dir"] = full_model["subtreeDir"]

    return payload


def package_one_case(
    export_json_path: Path,
    qiskit_run: Path,
    output_run: Path,
) -> Dict[str, Any]:
    payload = load_json(export_json_path)
    candidate = choose_primary_candidate(payload)
    recipe = candidate.get("qaoaCircuitRecipe", {})
    cost_h = recipe.get("costHamiltonian", {})
    mixer = recipe.get("mixer", {})
    ordered_basic_event_ids = list(candidate.get("orderedBasicEventIds", []))
    source_variable_mapping = list(candidate.get("variableMapping", []))
    frozen_mcs_reference = candidate.get("frozenMcsReference", {})
    full_cl_qubo_model = require_full_cl_qubo_model(candidate, export_json_path)
    paper10_compatible_qubo_model = build_paper10_compatible_qubo_model(full_cl_qubo_model)

    diagonal_weights = list(cost_h.get("diagonalWeights", []))
    if not diagonal_weights:
        raise SystemExit(f"No diagonalWeights found in {export_json_path}")

    if not source_variable_mapping:
        raise SystemExit(f"No variableMapping found in {export_json_path}")

    case_id = find_case_id_from_filename(export_json_path.name)
    model_id = payload.get("modelId", f"unknown_model_{case_id}")
    case_dir = output_run / case_id
    case_dir.mkdir(parents=True, exist_ok=False)

    qubo_matrix = build_diagonal_qubo_matrix(diagonal_weights)
    np.savez_compressed(
        case_dir / f"{case_id}_qubo_matrix.npz",
        qubo_matrix=qubo_matrix,
        diagonal_weights=np.asarray(diagonal_weights, dtype=np.float64),
    )

    write_json(
        case_dir / f"{case_id}_mixer_spec.json",
        {
            "generated_at": utc_now_iso(),
            "script_version": SCRIPT_VERSION,
            "model_id": model_id,
            "candidate_root_node_id": candidate.get("candidateRootNodeId"),
            "mixer": mixer,
        },
    )

    write_variable_mapping_csv(
        case_dir / f"{case_id}_variable_mapping.csv",
        source_variable_mapping,
    )

    write_json(
        case_dir / f"{case_id}_frozen_mcs_reference.json",
        {
            "generated_at": utc_now_iso(),
            "script_version": SCRIPT_VERSION,
            "model_id": model_id,
            "candidate_root_node_id": candidate.get("candidateRootNodeId"),
            "frozen_mcs_reference": frozen_mcs_reference,
        },
    )

    write_json(case_dir / "full_cl_qubo_model.json", full_cl_qubo_model)
    write_json(case_dir / "qubo_model_v1.json", paper10_compatible_qubo_model)

    write_json(
        case_dir / f"{case_id}_package_metadata.json",
        {
            "generated_at": utc_now_iso(),
            "script_version": SCRIPT_VERSION,
            "model_id": model_id,
            "model_name": payload.get("modelName"),
            "candidate_root_node_id": candidate.get("candidateRootNodeId"),
            "topology_class": candidate.get("topologyClassification", {}).get("topologyClass"),
            "required_qubits": candidate.get("requirementsAssessment", {}).get("requiredQubits"),
            "basic_event_count": len(ordered_basic_event_ids),
            "minimal_cut_set_count": frozen_mcs_reference.get("minimalCutSetCount"),
            "statevector_verification_eligible": candidate.get("statevectorVerificationPlan", {}).get("eligible"),
            "full_cl_qubo_model_present": True,
            "full_cl_qubo_n_vars_total": full_cl_qubo_model.get("nVarsTotal"),
            "full_cl_qubo_penalty_p": full_cl_qubo_model.get("penaltyP"),
            "full_cl_qubo_top_gate": full_cl_qubo_model.get("topGate"),
            "paper10_compatible_qubo_model_written": True,
            "tuned_parameter_application": payload.get("tuned_parameter_application"),
            "source_export_file": str(export_json_path),
        },
    )

    write_json(case_dir / f"{case_id}_source_export.json", payload)

    qiskit_case_dir = qiskit_run / case_id
    qpy_copied = False
    circuit_summary_copied = False
    recipe_copied = False

    if qiskit_case_dir.exists():
        qpy_files = sorted(qiskit_case_dir.glob("*.qpy"))
        if qpy_files:
            qpy_copied = copy_if_exists(qpy_files[0], case_dir / f"{case_id}_circuit.qpy")

        summary_files = sorted(qiskit_case_dir.glob("*_bound_circuit_summary.json"))
        if summary_files:
            circuit_summary_copied = copy_if_exists(summary_files[0], case_dir / f"{case_id}_circuit_summary.json")

        recipe_files = sorted(qiskit_case_dir.glob("*_qaoa_recipe.json"))
        if recipe_files:
            recipe_copied = copy_if_exists(recipe_files[0], case_dir / f"{case_id}_qaoa_recipe.json")

    case_manifest = write_sha256sums(case_dir)
    write_json(case_dir / "00_manifest.json", case_manifest)

    return {
        "case_id": case_id,
        "model_id": model_id,
        "topology_class": candidate.get("topologyClassification", {}).get("topologyClass"),
        "required_qubits": candidate.get("requirementsAssessment", {}).get("requiredQubits"),
        "basic_event_count": len(ordered_basic_event_ids),
        "minimal_cut_set_count": frozen_mcs_reference.get("minimalCutSetCount"),
        "full_cl_qubo_model_written": True,
        "paper10_compatible_qubo_model_written": True,
        "full_cl_qubo_n_vars_total": full_cl_qubo_model.get("nVarsTotal"),
        "full_cl_qubo_top_gate": full_cl_qubo_model.get("topGate"),
        "qpy_copied": qpy_copied,
        "qaoa_recipe_copied": recipe_copied,
        "circuit_summary_copied": circuit_summary_copied,
    }


def build_readme(
    output_run: Path,
    tuned_run: Path,
    qiskit_run: Path,
    packaged_cases: List[Dict[str, Any]],
) -> str:
    qpy_count = sum(1 for case in packaged_cases if case["qpy_copied"])
    recipe_count = sum(1 for case in packaged_cases if case["qaoa_recipe_copied"])
    summary_count = sum(1 for case in packaged_cases if case["circuit_summary_copied"])
    full_model_count = sum(1 for case in packaged_cases if case["full_cl_qubo_model_written"])
    paper10_model_count = sum(1 for case in packaged_cases if case["paper10_compatible_qubo_model_written"])

    lines: List[str] = []
    lines.append("# OpenPRA Phase 4 Reference Artifact Packages")
    lines.append("")
    lines.append(f"Run directory: {output_run}")
    lines.append(f"Generated at: {utc_now_iso()}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append(f"Tuned source run: {tuned_run}")
    lines.append(f"Qiskit source run: {qiskit_run}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Package the frozen 120 case tuned Phase 4 reference run into roadmap style per case artifacts while promoting the full CL QUBO model into first class package outputs."
    )
    lines.append("")
    lines.append("Packaged contents per case")
    lines.append("")
    lines.append("- QUBO matrix as .npz")
    lines.append("- mixer specification as JSON")
    lines.append("- variable mapping as CSV")
    lines.append("- frozen MCS reference as JSON")
    lines.append("- full CL QUBO model as full_cl_qubo_model.json")
    lines.append("- Paper 10 compatible CL QUBO model as qubo_model_v1.json")
    lines.append("- source export JSON")
    lines.append("- optional QPY circuit copy when present")
    lines.append("- optional QAOA recipe and circuit summary copies when present")
    lines.append("- per case SHA256 manifest")
    lines.append("")
    lines.append("Counts")
    lines.append("")
    lines.append(f"- packaged cases: {len(packaged_cases)}")
    lines.append(f"- full CL QUBO model files written: {full_model_count}")
    lines.append(f"- Paper 10 compatible qubo_model_v1.json files written: {paper10_model_count}")
    lines.append(f"- QPY copied: {qpy_count}")
    lines.append(f"- QAOA recipe copied: {recipe_count}")
    lines.append(f"- circuit summary copied: {summary_count}")
    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "This tranche keeps the existing bounded slice artifacts but now promotes the richer full CL QUBO representation into standalone package outputs so the next comparison step can target frozen Paper 10 per instance qubo_model_v1.json files directly."
    )
    lines.append("")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Package frozen Phase 4 tuned reference artifacts into roadmap style per case export packages."
    )
    parser.add_argument(
        "--tuned-run",
        dest="tuned_run",
        default=None,
        help="Optional repo-relative or absolute tuned export run directory. Default: latest.",
    )
    parser.add_argument(
        "--qiskit-run",
        dest="qiskit_run",
        default=None,
        help="Optional repo-relative or absolute Qiskit bundle run directory. Default: latest.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    tuned_run = resolve_run(repo_root, args.tuned_run, TUNED_ROOT)
    qiskit_run = resolve_run(repo_root, args.qiskit_run, QISKIT_ROOT)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    export_files = sorted(tuned_run.glob("*_clqubo_export.json"))
    if not export_files:
        raise SystemExit(f"No *_clqubo_export.json files found in {tuned_run}")

    packaged_cases: List[Dict[str, Any]] = []
    for export_json_path in export_files:
        packaged_cases.append(package_one_case(export_json_path, qiskit_run, output_run))

    summary_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "tuned_run": str(tuned_run),
        "qiskit_run": str(qiskit_run),
        "output_run": str(output_run),
        "packaged_case_count": len(packaged_cases),
        "full_cl_qubo_model_written_count": sum(
            1 for case in packaged_cases if case["full_cl_qubo_model_written"]
        ),
        "paper10_compatible_qubo_model_written_count": sum(
            1 for case in packaged_cases if case["paper10_compatible_qubo_model_written"]
        ),
        "packaged_cases": packaged_cases,
    }

    write_json(output_run / "90_phase4_reference_artifact_package_summary.json", summary_payload)
    write_text(output_run / "README.txt", build_readme(output_run, tuned_run, qiskit_run, packaged_cases))

    manifest = write_sha256sums(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase4_reference_artifact_package_summary.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
