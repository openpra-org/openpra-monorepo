#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from qiskit import qpy


SCRIPT_VERSION = "openpra-phase5-stage-single-case-runtime-package-v1"
DEFAULT_OUTPUT_ROOT = "_work/openpra_phase5_single_case_runtime_package_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifest(root: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            rel = str(path.relative_to(root))
            manifest[rel] = sha256_file(path)

    sha_path = root / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as f:
        for rel, digest in sorted(manifest.items()):
            f.write(f"{digest}  {rel}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    return manifest


def read_variable_mapping_csv(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(
                {
                    "variableIndex": int(row["variableIndex"]),
                    "variableName": row["variableName"],
                    "basicEventId": row["basicEventId"],
                    "basicEventLabel": row["basicEventLabel"],
                }
            )
    return rows


def load_qpy_summary(path: Path) -> Dict[str, Any]:
    with path.open("rb") as f:
        circuits = list(qpy.load(f))

    if not circuits:
        raise RuntimeError(f"No circuits found in QPY: {path}")
    if len(circuits) != 1:
        raise RuntimeError(f"Expected exactly one circuit in QPY, found {len(circuits)}: {path}")

    qc = circuits[0]
    return {
        "circuit_count": len(circuits),
        "name": qc.name,
        "num_qubits": qc.num_qubits,
        "num_clbits": qc.num_clbits,
        "depth": qc.depth(),
        "size": qc.size(),
        "count_ops": {str(k): int(v) for k, v in qc.count_ops().items()},
    }


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        description="Stage a single-case OpenPRA runtime package from an existing Phase 4 Qiskit bundle case."
    )
    ap.add_argument("--bundle-case", required=True, help="Absolute or repo-relative bundle case directory")
    ap.add_argument("--candidate-dir", required=True, help="Absolute or repo-relative Phase 5 candidate directory")
    ap.add_argument("--output-root", default=DEFAULT_OUTPUT_ROOT, help="Repo-relative or absolute output root")
    return ap.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    bundle_case = Path(args.bundle_case)
    if not bundle_case.is_absolute():
        bundle_case = (repo_root / bundle_case).resolve()
    if not bundle_case.is_dir():
        raise SystemExit(f"Bundle case directory does not exist: {bundle_case}")

    candidate_dir = Path(args.candidate_dir)
    if not candidate_dir.is_absolute():
        candidate_dir = (repo_root / candidate_dir).resolve()
    if not candidate_dir.is_dir():
        raise SystemExit(f"Candidate directory does not exist: {candidate_dir}")

    output_root = Path(args.output_root)
    if not output_root.is_absolute():
        output_root = (repo_root / output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    qpy_files = sorted(bundle_case.glob("*.qpy"))
    if len(qpy_files) != 1:
        raise SystemExit(f"Expected exactly one QPY file in {bundle_case}, found {len(qpy_files)}")
    qpy_file = qpy_files[0]

    variable_mapping_csv = next(iter(sorted(bundle_case.glob("*_variable_mapping.csv"))), None)
    bound_summary_json = next(iter(sorted(bundle_case.glob("*_default_bound_circuit_summary.json"))), None)
    primary_export_json = next(iter(sorted(bundle_case.glob("*_primary_candidate_export.json"))), None)
    qaoa_recipe_json = next(iter(sorted(bundle_case.glob("*_qaoa_recipe.json"))), None)
    mixer_spec_json = next(iter(sorted(bundle_case.glob("*_mixer_specification.json"))), None)
    cost_matrix_npz = next(iter(sorted(bundle_case.glob("*_cost_matrix.npz"))), None)

    required_bundle_files = [
        variable_mapping_csv,
        bound_summary_json,
        primary_export_json,
        qaoa_recipe_json,
        mixer_spec_json,
        cost_matrix_npz,
    ]
    if any(p is None for p in required_bundle_files):
        raise SystemExit("Bundle case is missing one or more required artifacts")

    package_metadata_json = candidate_dir / "package_metadata.json"
    source_export_json = candidate_dir / "source_export.json"
    classical_reference_mcs_json = candidate_dir / "classical_reference_mcs.json"
    probabilities_json = candidate_dir / "probabilities.json"

    for p in [
        package_metadata_json,
        source_export_json,
        classical_reference_mcs_json,
        probabilities_json,
    ]:
        if not p.exists():
            raise SystemExit(f"Missing required candidate artifact: {p}")

    package_metadata = load_json(package_metadata_json)
    primary_export = load_json(primary_export_json)
    bound_summary = load_json(bound_summary_json)
    qaoa_recipe = load_json(qaoa_recipe_json)
    probabilities = load_json(probabilities_json)
    variable_mapping = read_variable_mapping_csv(variable_mapping_csv)
    qpy_summary = load_qpy_summary(qpy_file)

    model_id = str(package_metadata["model_id"])
    stage_dir = output_root / f"{utc_stamp()}_{model_id}"
    artifacts_dir = stage_dir / "artifacts"
    runtime_inputs_dir = stage_dir / "runtime_inputs"
    artifacts_dir.mkdir(parents=True, exist_ok=False)
    runtime_inputs_dir.mkdir(parents=True, exist_ok=False)

    copies = {
        "bundle_qpy": (qpy_file, runtime_inputs_dir / qpy_file.name),
        "variable_mapping_csv": (variable_mapping_csv, artifacts_dir / variable_mapping_csv.name),
        "bound_summary_json": (bound_summary_json, artifacts_dir / bound_summary_json.name),
        "primary_export_json": (primary_export_json, artifacts_dir / primary_export_json.name),
        "qaoa_recipe_json": (qaoa_recipe_json, artifacts_dir / qaoa_recipe_json.name),
        "mixer_spec_json": (mixer_spec_json, artifacts_dir / mixer_spec_json.name),
        "cost_matrix_npz": (cost_matrix_npz, artifacts_dir / cost_matrix_npz.name),
        "package_metadata_json": (package_metadata_json, artifacts_dir / package_metadata_json.name),
        "source_export_json": (source_export_json, artifacts_dir / source_export_json.name),
        "classical_reference_mcs_json": (classical_reference_mcs_json, artifacts_dir / classical_reference_mcs_json.name),
        "probabilities_json": (probabilities_json, artifacts_dir / probabilities_json.name),
    }

    copied_paths: Dict[str, str] = {}
    for key, (src, dst) in copies.items():
        shutil.copy2(src, dst)
        copied_paths[key] = str(dst)

    runtime_manifest = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "stage_dir": str(stage_dir),
        "bundle_case_dir": str(bundle_case),
        "candidate_dir": str(candidate_dir),
        "model_id": model_id,
        "candidate_root_node_id": package_metadata["candidate_root_node_id"],
        "topology_class": package_metadata.get("topology_class"),
        "required_qubits": package_metadata.get("required_qubits"),
        "ordered_basic_event_ids": primary_export["orderedBasicEventIds"],
        "variable_mapping": variable_mapping,
        "frozen_mcs_reference": primary_export["frozenMcsReference"],
        "probabilities": probabilities.get("probabilities", {}),
        "measurement_basis": qaoa_recipe.get("measurementBasis"),
        "bitstring_index_convention": bound_summary.get("bitstring_index_convention"),
        "qpy_summary": qpy_summary,
        "artifacts": copied_paths,
        "next_step": {
            "statement": "Use the staged QPY and metadata to submit one real IBM Runtime job, then harvest decoded counts into raw_counts.json.",
            "submit_target": "single_case_openpra_1037",
        },
    }

    write_json(stage_dir / "openpra_single_case_runtime_manifest_v1.json", runtime_manifest)

    raw_counts_template = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "status": "template_not_populated",
        "model_id": model_id,
        "candidate_root_node_id": package_metadata["candidate_root_node_id"],
        "topology_class": package_metadata.get("topology_class"),
        "basic_event_count": package_metadata.get("basic_event_count"),
        "required_qubits": package_metadata.get("required_qubits"),
        "ordered_basic_event_ids": primary_export["orderedBasicEventIds"],
        "bitstring_convention": "declared_order",
        "counts": {},
        "shots_total": 0,
        "notes": [
            "Populate from harvested IBM Runtime counts for the staged QPY circuit.",
            "The direct bitstring convention from the bundle summary should be treated as declared order for downstream raw_counts handling.",
        ],
    }
    write_json(stage_dir / "raw_counts_template.json", raw_counts_template)

    readme = "\n".join(
        [
            f"OpenPRA single-case runtime stage package",
            "",
            f"model_id: {model_id}",
            f"candidate_root_node_id: {package_metadata['candidate_root_node_id']}",
            f"bundle_case_dir: {bundle_case}",
            f"candidate_dir: {candidate_dir}",
            f"qpy_file: {copied_paths['bundle_qpy']}",
            "",
            "Contents:",
            "  runtime_inputs/",
            "    QPY circuit for live submit",
            "  artifacts/",
            "    variable mapping, candidate export, circuit summary, recipe, probabilities, classical reference, and supporting files",
            "",
            "Next:",
            "  submit one live job using the staged QPY",
            "  harvest job_meta.json, job_result.json, and decoded counts",
            "  convert harvested counts into raw_counts.json",
            "  run the validated quantum_recovered_mcs builder",
            "",
        ]
    ) + "\n"
    write_text(stage_dir / "README.txt", readme)

    manifest = write_manifest(stage_dir)
    write_json(stage_dir / "00_manifest.json", manifest)

    print(f"STAGE_DIR={stage_dir}")
    print(f"RUNTIME_MANIFEST={stage_dir / 'openpra_single_case_runtime_manifest_v1.json'}")
    print(f"RAW_COUNTS_TEMPLATE={stage_dir / 'raw_counts_template.json'}")
    print(f"README={stage_dir / 'README.txt'}")
    print(f"MANIFEST={stage_dir / '00_manifest.json'}")
    print(f"SHA256={stage_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
