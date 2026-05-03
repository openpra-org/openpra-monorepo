#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


SCRIPT_VERSION = "phase4-external-qubo-mismatch-analysis-v1"
VALIDATION_ROOT = "_work/openpra_phase4_reference_artifact_validation_v1"
PACKAGE_ROOT = "_work/openpra_phase4_reference_artifact_packages_v1"
OUTPUT_ROOT = "_work/openpra_phase4_external_qubo_mismatch_analysis_v1"
FLOAT_TOL = 1e-12


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


def load_mapping_csv(path: Path) -> Dict[str, Path]:
    if not path.exists():
        raise SystemExit(f"Mapping CSV does not exist: {path}")

    out: Dict[str, Path] = {}
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"model_id", "reference_case_dir"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"Mapping CSV missing required columns: {sorted(missing)}")

        for row in reader:
            model_id = row["model_id"].strip()
            ref_dir = row["reference_case_dir"].strip()
            if model_id and ref_dir:
                out[model_id] = Path(ref_dir).resolve()

    return out


def build_package_case_index(package_run: Path) -> Dict[str, Path]:
    index: Dict[str, Path] = {}
    case_dirs = sorted([p for p in package_run.iterdir() if p.is_dir() and p.name.isdigit()])
    for case_dir in case_dirs:
        metadata_files = sorted(case_dir.glob("*_package_metadata.json"))
        if len(metadata_files) != 1:
            continue
        metadata = load_json(metadata_files[0])
        model_id = metadata.get("model_id")
        if isinstance(model_id, str):
            index[model_id] = case_dir
    return index


def numeric_close(left: Any, right: Any, tol: float = FLOAT_TOL) -> bool:
    try:
        return abs(float(left) - float(right)) <= tol
    except Exception:
        return False


def compare_scalar_field(name: str, left: Any, right: Any) -> Optional[Dict[str, Any]]:
    if isinstance(left, (int, float)) or isinstance(right, (int, float)):
        if numeric_close(left, right):
            return None
    if left == right:
        return None
    return {
        "field": name,
        "package_value": left,
        "reference_value": right,
    }


def compare_vars(package_vars: List[Dict[str, Any]], reference_vars: List[Dict[str, Any]]) -> Dict[str, Any]:
    report: Dict[str, Any] = {
        "length_match": len(package_vars) == len(reference_vars),
        "package_length": len(package_vars),
        "reference_length": len(reference_vars),
        "first_difference_index": None,
        "first_difference_package": None,
        "first_difference_reference": None,
    }

    for idx, (left, right) in enumerate(zip(package_vars, reference_vars)):
        if left != right:
            report["first_difference_index"] = idx
            report["first_difference_package"] = left
            report["first_difference_reference"] = right
            return report

    if len(package_vars) != len(reference_vars):
        idx = min(len(package_vars), len(reference_vars))
        report["first_difference_index"] = idx
        report["first_difference_package"] = package_vars[idx] if idx < len(package_vars) else None
        report["first_difference_reference"] = reference_vars[idx] if idx < len(reference_vars) else None

    return report


def compare_numeric_map(name: str, package_map: Dict[str, Any], reference_map: Dict[str, Any]) -> Dict[str, Any]:
    package_keys = set(package_map.keys())
    reference_keys = set(reference_map.keys())

    package_only = sorted(package_keys - reference_keys)
    reference_only = sorted(reference_keys - package_keys)
    shared = sorted(package_keys & reference_keys)

    value_mismatches: List[Dict[str, Any]] = []
    for key in shared:
        left = package_map[key]
        right = reference_map[key]
        if not numeric_close(left, right):
            value_mismatches.append(
                {
                    "key": key,
                    "package_value": left,
                    "reference_value": right,
                    "delta": float(left) - float(right),
                }
            )

    return {
        "name": name,
        "package_key_count": len(package_map),
        "reference_key_count": len(reference_map),
        "package_only_keys": package_only[:20],
        "reference_only_keys": reference_only[:20],
        "package_only_key_count": len(package_only),
        "reference_only_key_count": len(reference_only),
        "value_mismatch_count": len(value_mismatches),
        "value_mismatches_head": value_mismatches[:20],
        "all_match": len(package_only) == 0 and len(reference_only) == 0 and len(value_mismatches) == 0,
    }


def compare_qubo_or_ising_block(name: str, package_block: Dict[str, Any], reference_block: Dict[str, Any]) -> Dict[str, Any]:
    const_diff = None
    if not numeric_close(package_block.get("const"), reference_block.get("const")):
        const_diff = {
            "package_value": package_block.get("const"),
            "reference_value": reference_block.get("const"),
            "delta": float(package_block.get("const", 0.0)) - float(reference_block.get("const", 0.0)),
        }

    submaps: List[Dict[str, Any]] = []
    for subname in ["lin", "quad", "h", "J"]:
        if subname in package_block or subname in reference_block:
            submaps.append(
                compare_numeric_map(
                    f"{name}.{subname}",
                    package_block.get(subname, {}),
                    reference_block.get(subname, {}),
                )
            )

    return {
        "name": name,
        "const_match": const_diff is None,
        "const_diff": const_diff,
        "submaps": submaps,
        "all_match": const_diff is None and all(item["all_match"] for item in submaps),
    }


def analyze_one_case(
    case_report: Dict[str, Any],
    package_case_dir: Path,
    reference_case_dir: Path,
) -> Dict[str, Any]:
    package_qubo_path = package_case_dir / "qubo_model_v1.json"
    reference_qubo_path = reference_case_dir / "qubo_model_v1.json"

    if not package_qubo_path.exists():
        raise SystemExit(f"Missing package qubo_model_v1.json: {package_qubo_path}")
    if not reference_qubo_path.exists():
        raise SystemExit(f"Missing reference qubo_model_v1.json: {reference_qubo_path}")

    package_doc = load_json(package_qubo_path)
    reference_doc = load_json(reference_qubo_path)

    scalar_diffs: List[Dict[str, Any]] = []
    for field in ["n_basic", "n_vars_total", "penalty_P", "top_gate", "subtree_id", "subtree_dir"]:
        if field in package_doc or field in reference_doc:
            diff = compare_scalar_field(field, package_doc.get(field), reference_doc.get(field))
            if diff is not None:
                scalar_diffs.append(diff)

    vars_report = compare_vars(package_doc.get("vars", []), reference_doc.get("vars", []))
    qubo_report = compare_qubo_or_ising_block("qubo", package_doc.get("qubo", {}), reference_doc.get("qubo", {}))
    ising_report = compare_qubo_or_ising_block("ising", package_doc.get("ising", {}), reference_doc.get("ising", {}))

    top_level_keys_match = sorted(package_doc.keys()) == sorted(reference_doc.keys())

    mismatch_categories: List[str] = []
    if not top_level_keys_match:
        mismatch_categories.append("top_level_keys")
    if scalar_diffs:
        mismatch_categories.append("scalar_fields")
    if not vars_report["length_match"] or vars_report["first_difference_index"] is not None:
        mismatch_categories.append("vars")
    if not qubo_report["all_match"]:
        mismatch_categories.append("qubo")
    if not ising_report["all_match"]:
        mismatch_categories.append("ising")

    return {
        "case_id": case_report["case_id"],
        "model_id": case_report["model_id"],
        "candidate_root_node_id": case_report["candidate_root_node_id"],
        "reference_case_dir": str(reference_case_dir),
        "package_qubo_model_v1": str(package_qubo_path),
        "reference_qubo_model_v1": str(reference_qubo_path),
        "top_level_keys_match": top_level_keys_match,
        "package_top_level_keys": sorted(package_doc.keys()),
        "reference_top_level_keys": sorted(reference_doc.keys()),
        "scalar_diffs": scalar_diffs,
        "vars_report": vars_report,
        "qubo_report": qubo_report,
        "ising_report": ising_report,
        "mismatch_categories": mismatch_categories,
        "all_match": len(mismatch_categories) == 0,
    }


def build_readme(
    output_run: Path,
    validation_run: Path,
    package_run: Path,
    analyzed_count: int,
    full_match_count: int,
) -> str:
    lines: List[str] = []
    lines.append("# OpenPRA Phase 4 External QUBO Mismatch Analysis")
    lines.append("")
    lines.append(f"Run directory: {output_run}")
    lines.append(f"Generated at: {utc_now_iso()}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append(f"Validation run: {validation_run}")
    lines.append(f"Package run: {package_run}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Analyze case by case structural differences between packaged qubo_model_v1.json artifacts and directly matched frozen Paper10 reference qubo_model_v1.json artifacts."
    )
    lines.append("")
    lines.append("Counts")
    lines.append("")
    lines.append(f"- analyzed_count: {analyzed_count}")
    lines.append(f"- full_match_count: {full_match_count}")
    lines.append(f"- mismatch_count: {analyzed_count - full_match_count}")
    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "This run is diagnostic. It identifies which parts of the external qubo_model_v1 payload differ so the next correction can be aimed at the true seam instead of guessing."
    )
    lines.append("")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze detailed mismatches between packaged and frozen Paper10 qubo_model_v1.json artifacts."
    )
    parser.add_argument(
        "--validation-run",
        dest="validation_run",
        default=None,
        help="Optional repo-relative or absolute validation run directory. Default: latest.",
    )
    parser.add_argument(
        "--package-run",
        dest="package_run",
        default=None,
        help="Optional repo-relative or absolute package run directory. Default: latest.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    validation_run = resolve_run(repo_root, args.validation_run, VALIDATION_ROOT)
    package_run = resolve_run(repo_root, args.package_run, PACKAGE_ROOT)

    validation_summary_path = validation_run / "90_phase4_reference_artifact_validation_summary.json"
    if not validation_summary_path.exists():
        raise SystemExit(f"Validation summary does not exist: {validation_summary_path}")

    validation_summary = load_json(validation_summary_path)
    package_case_index = build_package_case_index(package_run)

    externally_checked = [
        case
        for case in validation_summary.get("cases", [])
        if case.get("external_reference_checked") is True
    ]
    if not externally_checked:
        raise SystemExit("No externally checked cases found in validation summary.")

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    case_reports: List[Dict[str, Any]] = []
    full_match_count = 0

    for case in externally_checked:
        model_id = case["model_id"]
        reference_case_dir = Path(case["reference_case_dir"]).resolve()

        if model_id not in package_case_index:
            raise SystemExit(f"Package case directory not found for model_id: {model_id}")

        report = analyze_one_case(case, package_case_index[model_id], reference_case_dir)
        case_reports.append(report)
        if report["all_match"]:
            full_match_count += 1

        write_json(output_run / f"{case['case_id']}_external_qubo_diff_report.json", report)

    summary_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "validation_run": str(validation_run),
        "package_run": str(package_run),
        "externally_checked_count": len(externally_checked),
        "full_match_count": full_match_count,
        "mismatch_count": len(externally_checked) - full_match_count,
        "cases": case_reports,
    }

    write_json(output_run / "90_phase4_external_qubo_mismatch_summary.json", summary_payload)
    (output_run / "README.txt").write_text(
        build_readme(
            output_run=output_run,
            validation_run=validation_run,
            package_run=package_run,
            analyzed_count=len(externally_checked),
            full_match_count=full_match_count,
        ),
        encoding="utf-8",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase4_external_qubo_mismatch_summary.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")
    print(f"EXTERNALLY_CHECKED_COUNT={len(externally_checked)}")
    print(f"FULL_MATCH_COUNT={full_match_count}")
    print(f"MISMATCH_COUNT={len(externally_checked) - full_match_count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
