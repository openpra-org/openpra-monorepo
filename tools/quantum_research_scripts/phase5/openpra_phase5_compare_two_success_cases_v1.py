#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


SCRIPT_VERSION = "openpra-phase5-compare-two-success-cases-v1"
DEFAULT_OUTPUT_ROOT = "_work/openpra_phase5_compare_two_success_cases_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def read_variable_mapping_csv(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(dict(row))
    return rows


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def compare_values(a: Any, b: Any) -> Dict[str, Any]:
    return {
        "equal": a == b,
        "left": a,
        "right": b,
    }


def case_snapshot(candidate_dir: Path, stage_dir: Path) -> Dict[str, Any]:
    package_metadata = load_json(candidate_dir / "package_metadata.json")
    source_export = load_json(candidate_dir / "source_export.json")
    classical_reference = load_json(candidate_dir / "classical_reference_mcs.json")
    raw_counts = load_json(candidate_dir / "raw_counts.json")
    recovered = load_json(candidate_dir / "quantum_recovered_mcs.json")
    build_summary = load_json(candidate_dir / "quantum_recovered_mcs_build_summary.json")
    runtime_manifest = load_json(stage_dir / "openpra_single_case_runtime_manifest_v1.json")
    submit_report = load_json(stage_dir / "quantum_submit_report_p1_v1.json")
    collect_report = load_json(stage_dir / "quantum_collect_report_p1_v1.json")

    bundle_qpy = Path(runtime_manifest["artifacts"]["bundle_qpy"])
    variable_mapping_csv = Path(runtime_manifest["artifacts"]["variable_mapping_csv"])
    primary_export_json = Path(runtime_manifest["artifacts"]["primary_export_json"])
    qaoa_recipe_json = Path(runtime_manifest["artifacts"]["qaoa_recipe_json"])
    bound_summary_json = Path(runtime_manifest["artifacts"]["bound_summary_json"])

    return {
        "model_id": runtime_manifest["model_id"],
        "candidate_root_node_id": runtime_manifest["candidate_root_node_id"],
        "topology_class": runtime_manifest["topology_class"],
        "required_qubits": runtime_manifest["required_qubits"],
        "ordered_basic_event_ids": runtime_manifest["ordered_basic_event_ids"],
        "probabilities": runtime_manifest["probabilities"],
        "frozen_mcs_reference": runtime_manifest["frozen_mcs_reference"],
        "measurement_basis": runtime_manifest["measurement_basis"],
        "bitstring_index_convention": runtime_manifest["bitstring_index_convention"],
        "qpy_sha256": sha256_file(bundle_qpy),
        "variable_mapping_sha256": sha256_file(variable_mapping_csv),
        "primary_export_sha256": sha256_file(primary_export_json),
        "qaoa_recipe_sha256": sha256_file(qaoa_recipe_json),
        "bound_summary_sha256": sha256_file(bound_summary_json),
        "package_metadata_sha256": sha256_file(candidate_dir / "package_metadata.json"),
        "source_export_sha256": sha256_file(candidate_dir / "source_export.json"),
        "classical_reference_sha256": sha256_file(candidate_dir / "classical_reference_mcs.json"),
        "raw_counts_sha256": sha256_file(candidate_dir / "raw_counts.json"),
        "quantum_recovered_mcs_sha256": sha256_file(candidate_dir / "quantum_recovered_mcs.json"),
        "variable_mapping_rows": read_variable_mapping_csv(variable_mapping_csv),
        "package_metadata": package_metadata,
        "source_export": source_export,
        "classical_reference": classical_reference,
        "raw_counts": raw_counts,
        "quantum_recovered_mcs": recovered,
        "quantum_recovered_mcs_build_summary": build_summary,
        "submit_report": submit_report,
        "collect_report": collect_report,
    }


def write_manifest(root: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            manifest[str(path.relative_to(root))] = sha256_file(path)
    sha_path = root / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as f:
        for rel, digest in sorted(manifest.items()):
            f.write(f"{digest}  {rel}\n")
    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    return manifest


def main() -> int:
    ap = argparse.ArgumentParser(description="Compare two successful OpenPRA hardware cases for distinctness.")
    ap.add_argument("--candidate-a", required=True)
    ap.add_argument("--stage-a", required=True)
    ap.add_argument("--candidate-b", required=True)
    ap.add_argument("--stage-b", required=True)
    ap.add_argument("--output-root", default=DEFAULT_OUTPUT_ROOT)
    args = ap.parse_args()

    repo_root = Path.cwd().resolve()

    candidate_a = (repo_root / args.candidate_a).resolve()
    stage_a = (repo_root / args.stage_a).resolve()
    candidate_b = (repo_root / args.candidate_b).resolve()
    stage_b = (repo_root / args.stage_b).resolve()
    output_root = (repo_root / args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    left = case_snapshot(candidate_a, stage_a)
    right = case_snapshot(candidate_b, stage_b)

    compare = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "left_model_id": left["model_id"],
        "right_model_id": right["model_id"],
        "identity_checks": {
            "candidate_root_node_id": compare_values(left["candidate_root_node_id"], right["candidate_root_node_id"]),
            "topology_class": compare_values(left["topology_class"], right["topology_class"]),
            "required_qubits": compare_values(left["required_qubits"], right["required_qubits"]),
            "ordered_basic_event_ids": compare_values(left["ordered_basic_event_ids"], right["ordered_basic_event_ids"]),
            "probabilities": compare_values(left["probabilities"], right["probabilities"]),
            "frozen_mcs_reference": compare_values(left["frozen_mcs_reference"], right["frozen_mcs_reference"]),
            "measurement_basis": compare_values(left["measurement_basis"], right["measurement_basis"]),
            "bitstring_index_convention": compare_values(left["bitstring_index_convention"], right["bitstring_index_convention"]),
        },
        "artifact_hash_checks": {
            "qpy_sha256": compare_values(left["qpy_sha256"], right["qpy_sha256"]),
            "variable_mapping_sha256": compare_values(left["variable_mapping_sha256"], right["variable_mapping_sha256"]),
            "primary_export_sha256": compare_values(left["primary_export_sha256"], right["primary_export_sha256"]),
            "qaoa_recipe_sha256": compare_values(left["qaoa_recipe_sha256"], right["qaoa_recipe_sha256"]),
            "bound_summary_sha256": compare_values(left["bound_summary_sha256"], right["bound_summary_sha256"]),
            "package_metadata_sha256": compare_values(left["package_metadata_sha256"], right["package_metadata_sha256"]),
            "source_export_sha256": compare_values(left["source_export_sha256"], right["source_export_sha256"]),
            "classical_reference_sha256": compare_values(left["classical_reference_sha256"], right["classical_reference_sha256"]),
            "raw_counts_sha256": compare_values(left["raw_counts_sha256"], right["raw_counts_sha256"]),
            "quantum_recovered_mcs_sha256": compare_values(left["quantum_recovered_mcs_sha256"], right["quantum_recovered_mcs_sha256"]),
        },
        "hardware_checks": {
            "backend": compare_values(left["submit_report"]["backend"], right["submit_report"]["backend"]),
            "job_id": compare_values(left["collect_report"]["job_id"], right["collect_report"]["job_id"]),
            "shots_total": compare_values(left["raw_counts"]["shots_total"], right["raw_counts"]["shots_total"]),
            "recovered_exact_cut_set_count": compare_values(
                left["quantum_recovered_mcs_build_summary"]["recovered_exact_cut_set_count"],
                right["quantum_recovered_mcs_build_summary"]["recovered_exact_cut_set_count"],
            ),
        },
    }

    same_structure = (
        compare["identity_checks"]["candidate_root_node_id"]["equal"]
        and compare["identity_checks"]["ordered_basic_event_ids"]["equal"]
        and compare["identity_checks"]["frozen_mcs_reference"]["equal"]
        and compare["artifact_hash_checks"]["qpy_sha256"]["equal"]
    )

    same_hardware_sample = compare["artifact_hash_checks"]["raw_counts_sha256"]["equal"]

    compare["conclusion"] = {
        "same_structure_case": same_structure,
        "same_hardware_sample": same_hardware_sample,
        "interpretation": (
            "Same structural case with distinct hardware samples"
            if same_structure and not same_hardware_sample
            else "Same structural case and same hardware sample"
            if same_structure and same_hardware_sample
            else "Distinct structural cases"
        ),
    }

    outdir = output_root / f"{utc_stamp()}_{left['model_id']}_vs_{right['model_id']}"
    outdir.mkdir(parents=True, exist_ok=False)

    write_json(outdir / "comparison_summary.json", compare)

    readme = "\n".join(
        [
            "OpenPRA Phase 5 two-case distinctness audit",
            "",
            f"left_model_id: {left['model_id']}",
            f"right_model_id: {right['model_id']}",
            f"same_structure_case: {compare['conclusion']['same_structure_case']}",
            f"same_hardware_sample: {compare['conclusion']['same_hardware_sample']}",
            f"interpretation: {compare['conclusion']['interpretation']}",
            "",
        ]
    ) + "\n"
    write_text(outdir / "README.txt", readme)

    manifest = write_manifest(outdir)
    write_json(outdir / "00_manifest.json", manifest)

    print(f"OUTDIR={outdir}")
    print(f"SUMMARY={outdir / 'comparison_summary.json'}")
    print(f"README={outdir / 'README.txt'}")
    print(f"MANIFEST={outdir / '00_manifest.json'}")
    print(f"SHA256={outdir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
