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


SCRIPT_VERSION = "openpra-phase5-prepare-real-candidate-batch-v1"
PACKAGE_ROOT = "_work/openpra_phase4_reference_artifact_packages_v1"
OUTPUT_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_manifest(root: Path) -> Dict[str, str]:
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


def find_single(case_dir: Path, pattern: str) -> Path:
    matches = sorted(case_dir.glob(pattern))
    if len(matches) != 1:
        raise SystemExit(f"Expected exactly one match for {pattern} in {case_dir}, found {len(matches)}")
    return matches[0]


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def build_readme(summary: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append("OpenPRA Phase 5 real candidate batch v1")
    lines.append("")
    lines.append(f"Generated at: {summary['generated_at']}")
    lines.append(f"Script version: {summary['script_version']}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Prepare a real candidate batch scaffold for Phase 5 importance comparison and hybrid execution work."
    )
    lines.append("")
    lines.append("What this batch includes")
    lines.append("")
    lines.append("- selected Class A and C package cases")
    lines.append("- copied classical frozen MCS reference per candidate")
    lines.append("- copied package metadata per candidate")
    lines.append("- copied qaoa recipe when present")
    lines.append("- copied circuit summary when present")
    lines.append("- placeholder path for future quantum MCS extraction output")
    lines.append("- placeholder path for required probabilities.json")
    lines.append("")
    lines.append("Important note")
    lines.append("")
    lines.append(
        "This batch does not fabricate probability inputs. It makes the missing event-level probability artifact explicit so Phase 5 can proceed cleanly once that source is available."
    )
    lines.append("")
    lines.append("Counts")
    lines.append("")
    for key, value in summary["counts"].items():
        lines.append(f"{key}: {value}")
    lines.append("")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare a real Phase 5 candidate batch from the Phase 4 packaged cohort."
    )
    parser.add_argument(
        "--package-run",
        dest="package_run",
        default=None,
        help="Optional repo-relative or absolute package run directory. Default: latest.",
    )
    parser.add_argument(
        "--target-count",
        dest="target_count",
        type=int,
        default=20,
        help="Number of Class A/C candidates to prepare.",
    )
    parser.add_argument(
        "--max-basic-event-count",
        dest="max_basic_event_count",
        type=int,
        default=8,
        help="Maximum allowed basic-event count for the prepared batch.",
    )
    parser.add_argument(
        "--allowed-topology-classes",
        dest="allowed_topology_classes",
        default="A,C",
        help="Comma-separated topology classes to include.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()
    package_run = resolve_run(repo_root, args.package_run, PACKAGE_ROOT)

    allowed_topology_classes = {
        item.strip() for item in args.allowed_topology_classes.split(",") if item.strip()
    }
    if not allowed_topology_classes:
        raise SystemExit("No allowed topology classes supplied.")

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    candidate_rows: List[Dict[str, Any]] = []
    selected_case_dirs: List[Path] = []

    package_case_dirs = sorted([path for path in package_run.iterdir() if path.is_dir() and path.name.isdigit()])
    if not package_case_dirs:
        raise SystemExit(f"No numeric case directories found in {package_run}")

    for case_dir in package_case_dirs:
        metadata_path = find_single(case_dir, "*_package_metadata.json")
        metadata = load_json(metadata_path)

        topology_class = metadata.get("topology_class")
        basic_event_count = int(metadata.get("basic_event_count", 0))
        if topology_class not in allowed_topology_classes:
            continue
        if basic_event_count > args.max_basic_event_count:
            continue

        selected_case_dirs.append(case_dir)
        if len(selected_case_dirs) >= args.target_count:
            break

    if not selected_case_dirs:
        raise SystemExit("No package cases matched the requested selection criteria.")

    for ordinal, case_dir in enumerate(selected_case_dirs, start=1):
        metadata_path = find_single(case_dir, "*_package_metadata.json")
        frozen_mcs_path = find_single(case_dir, "*_frozen_mcs_reference.json")
        source_export_path = find_single(case_dir, "*_source_export.json")

        metadata = load_json(metadata_path)
        source_export = load_json(source_export_path)

        model_id = str(metadata["model_id"])
        candidate_root_node_id = str(metadata["candidate_root_node_id"])
        topology_class = metadata.get("topology_class")
        basic_event_count = int(metadata.get("basic_event_count", 0))
        required_qubits = metadata.get("required_qubits")

        qaoa_recipe_matches = sorted(case_dir.glob("*_qaoa_recipe.json"))
        circuit_summary_matches = sorted(case_dir.glob("*_circuit_summary.json"))
        qpy_matches = sorted(case_dir.glob("*_circuit.qpy"))

        batch_case_dir = output_run / f"{ordinal:04d}_{model_id}"
        batch_case_dir.mkdir(parents=True, exist_ok=False)

        copy_file(metadata_path, batch_case_dir / "package_metadata.json")
        copy_file(frozen_mcs_path, batch_case_dir / "classical_reference_mcs.json")
        copy_file(source_export_path, batch_case_dir / "source_export.json")

        if qaoa_recipe_matches:
            copy_file(qaoa_recipe_matches[0], batch_case_dir / "qaoa_recipe.json")
        if circuit_summary_matches:
            copy_file(circuit_summary_matches[0], batch_case_dir / "circuit_summary.json")
        if qpy_matches:
            copy_file(qpy_matches[0], batch_case_dir / "circuit.qpy")

        quantum_mcs_placeholder = batch_case_dir / "quantum_recovered_mcs.json"
        probabilities_placeholder = batch_case_dir / "probabilities.json"
        notes_path = batch_case_dir / "README.txt"

        write_text(
            notes_path,
            "\n".join(
                [
                    f"model_id: {model_id}",
                    f"candidate_root_node_id: {candidate_root_node_id}",
                    f"topology_class: {topology_class}",
                    f"basic_event_count: {basic_event_count}",
                    f"required_qubits: {required_qubits}",
                    "",
                    "Required next inputs",
                    "",
                    f"- Write quantum recovered cut sets to: {quantum_mcs_placeholder}",
                    f"- Write event-level probabilities to: {probabilities_placeholder}",
                    "",
                    "The comparison module will require both files for a real Phase 5 run.",
                    "",
                ]
            ),
        )

        candidate_rows.append(
            {
                "batch_case_dir": str(batch_case_dir),
                "package_case_id": case_dir.name,
                "model_id": model_id,
                "candidate_root_node_id": candidate_root_node_id,
                "topology_class": topology_class,
                "basic_event_count": basic_event_count,
                "required_qubits": required_qubits,
                "classical_reference_mcs_json": str((batch_case_dir / "classical_reference_mcs.json").resolve()),
                "quantum_recovered_mcs_json": str(quantum_mcs_placeholder.resolve()),
                "probabilities_json": str(probabilities_placeholder.resolve()),
                "package_metadata_json": str((batch_case_dir / "package_metadata.json").resolve()),
                "source_export_json": str((batch_case_dir / "source_export.json").resolve()),
                "qaoa_recipe_present": bool(qaoa_recipe_matches),
                "circuit_summary_present": bool(circuit_summary_matches),
                "qpy_present": bool(qpy_matches),
            }
        )

    manifest_csv = output_run / "91_phase5_real_candidate_manifest.csv"
    write_csv(
        manifest_csv,
        candidate_rows,
        [
            "batch_case_dir",
            "package_case_id",
            "model_id",
            "candidate_root_node_id",
            "topology_class",
            "basic_event_count",
            "required_qubits",
            "classical_reference_mcs_json",
            "quantum_recovered_mcs_json",
            "probabilities_json",
            "package_metadata_json",
            "source_export_json",
            "qaoa_recipe_present",
            "circuit_summary_present",
            "qpy_present",
        ],
    )

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "package_run": str(package_run),
        "selection": {
            "target_count": args.target_count,
            "max_basic_event_count": args.max_basic_event_count,
            "allowed_topology_classes": sorted(allowed_topology_classes),
        },
        "counts": {
            "selected_case_count": len(candidate_rows),
            "qaoa_recipe_present_count": sum(1 for row in candidate_rows if row["qaoa_recipe_present"]),
            "circuit_summary_present_count": sum(1 for row in candidate_rows if row["circuit_summary_present"]),
            "qpy_present_count": sum(1 for row in candidate_rows if row["qpy_present"]),
            "probabilities_json_present_count": 0,
            "quantum_recovered_mcs_json_present_count": 0,
        },
        "candidates": candidate_rows,
        "next_requirement": {
            "blocking_artifact": "event_level_probabilities_json",
            "reason": (
                "The comparison module is real and working, but real candidate runs still require event-level probabilities. "
                "The thesis record states the promoted sources were not event-level ready for exact direct recompute."
            ),
        },
    }

    write_json(output_run / "90_phase5_real_candidate_batch_summary.json", summary)
    write_text(output_run / "README.txt", build_readme(summary))
    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase5_real_candidate_batch_summary.json'}")
    print(f"MANIFEST_CSV={manifest_csv}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
