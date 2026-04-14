#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


SCRIPT_VERSION = "phase4-reference-artifact-validator-v2"
PACKAGE_ROOT = "_work/openpra_phase4_reference_artifact_packages_v1"
OUTPUT_ROOT = "_work/openpra_phase4_reference_artifact_validation_v1"


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


def load_variable_mapping_csv(path: Path) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(dict(row))
    return rows


def normalize_json_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: normalize_json_value(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [normalize_json_value(item) for item in value]
    return value


def json_equal(left: Any, right: Any) -> bool:
    return normalize_json_value(left) == normalize_json_value(right)


def load_optional_qpy_path(case_dir: Path) -> Optional[Path]:
    qpy_matches = sorted(case_dir.glob("*_circuit.qpy"))
    return qpy_matches[0] if qpy_matches else None


def load_optional_qaoa_recipe_path(case_dir: Path) -> Optional[Path]:
    recipe_matches = sorted(case_dir.glob("*_qaoa_recipe.json"))
    return recipe_matches[0] if recipe_matches else None


def load_optional_circuit_summary_path(case_dir: Path) -> Optional[Path]:
    summary_matches = sorted(case_dir.glob("*_circuit_summary.json"))
    return summary_matches[0] if summary_matches else None


def build_reference_map(mapping_csv: Optional[Path]) -> Dict[str, Path]:
    if mapping_csv is None:
        return {}

    if not mapping_csv.exists():
        raise SystemExit(f"Reference mapping CSV does not exist: {mapping_csv}")

    out: Dict[str, Path] = {}
    with mapping_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required_cols = {"model_id", "reference_case_dir"}
        missing = required_cols - set(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"Reference mapping CSV missing required columns: {sorted(missing)}")

        for row in reader:
            model_id = row["model_id"].strip()
            reference_case_dir = row["reference_case_dir"].strip()
            if not model_id or not reference_case_dir:
                continue
            out[model_id] = Path(reference_case_dir).resolve()

    return out


def choose_primary_candidate(source_export: Dict[str, Any]) -> Dict[str, Any]:
    candidates = source_export.get("clQuboCandidates", [])
    if not candidates:
        raise SystemExit(f"No clQuboCandidates in source export for {source_export.get('modelId', 'unknown')}")
    for candidate in candidates:
        if candidate.get("requirementsAssessment", {}).get("matrixEntryMatched") is True:
            return candidate
    return candidates[0]


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


def normalize_paper10_qubo_model(document: Dict[str, Any]) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {}

    for key in ["ising", "n_basic", "n_vars_total", "penalty_P", "qubo", "top_gate", "vars", "subtree_id", "subtree_dir"]:
        if key in document:
            normalized[key] = document[key]

    return normalized


def compare_internal_identity(case_dir: Path) -> Dict[str, Any]:
    source_export_path = sorted(case_dir.glob("*_source_export.json"))
    if len(source_export_path) != 1:
        raise SystemExit(f"Expected exactly one source export JSON in {case_dir}")

    mixer_spec_path = sorted(case_dir.glob("*_mixer_spec.json"))
    frozen_mcs_ref_path = sorted(case_dir.glob("*_frozen_mcs_reference.json"))
    variable_mapping_path = sorted(case_dir.glob("*_variable_mapping.csv"))
    package_metadata_path = sorted(case_dir.glob("*_package_metadata.json"))

    required_exactly_one = {
      "mixer_spec": mixer_spec_path,
      "frozen_mcs_reference": frozen_mcs_ref_path,
      "variable_mapping": variable_mapping_path,
      "package_metadata": package_metadata_path,
    }

    for label, matches in required_exactly_one.items():
        if len(matches) != 1:
            raise SystemExit(f"Expected exactly one {label} artifact in {case_dir}")

    full_cl_qubo_model_path = case_dir / "full_cl_qubo_model.json"
    paper10_qubo_model_path = case_dir / "qubo_model_v1.json"

    if not full_cl_qubo_model_path.exists():
        raise SystemExit(f"Missing full_cl_qubo_model.json in {case_dir}")
    if not paper10_qubo_model_path.exists():
        raise SystemExit(f"Missing qubo_model_v1.json in {case_dir}")

    source_export = load_json(source_export_path[0])
    primary_candidate = choose_primary_candidate(source_export)

    mixer_spec_payload = load_json(mixer_spec_path[0])
    frozen_mcs_payload = load_json(frozen_mcs_ref_path[0])
    variable_mapping_rows = load_variable_mapping_csv(variable_mapping_path[0])
    package_metadata = load_json(package_metadata_path[0])
    packaged_full_model = load_json(full_cl_qubo_model_path)
    packaged_paper10_model = load_json(paper10_qubo_model_path)

    ordered_basic_event_ids = list(primary_candidate.get("orderedBasicEventIds", []))
    source_variable_mapping = list(primary_candidate.get("variableMapping", []))
    source_mixer_spec = primary_candidate.get("mixerSpecification", {})
    source_frozen_mcs = primary_candidate.get("frozenMcsReference", {})
    source_full_model = primary_candidate.get("fullClQuboModel")

    if not isinstance(source_full_model, dict):
        raise SystemExit(f"fullClQuboModel missing in source export for {case_dir}")

    expected_paper10_model = build_paper10_compatible_qubo_model(source_full_model)

    variable_mapping_pass = True
    variable_mapping_reasons: List[str] = []
    if len(variable_mapping_rows) != len(source_variable_mapping):
        variable_mapping_pass = False
        variable_mapping_reasons.append(
            f"row_count_mismatch package={len(variable_mapping_rows)} source={len(source_variable_mapping)}"
        )
    else:
        for package_row, source_row in zip(variable_mapping_rows, source_variable_mapping):
            package_index = int(package_row["variable_index"])
            package_name = package_row["variable_name"]
            package_event = package_row["basic_event_id"]

            if package_index != int(source_row["variableIndex"]):
                variable_mapping_pass = False
                variable_mapping_reasons.append(
                    f"variable_index_mismatch package={package_index} source={source_row['variableIndex']}"
                )
                break

            expected_name = source_row["variableName"]
            if package_name != expected_name:
                variable_mapping_pass = False
                variable_mapping_reasons.append(
                    f"variable_name_mismatch package={package_name} source={expected_name}"
                )
                break

            if package_event != source_row["basicEventId"]:
                variable_mapping_pass = False
                variable_mapping_reasons.append(
                    f"basic_event_id_mismatch package={package_event} source={source_row['basicEventId']}"
                )
                break

    mixer_pass = json_equal(mixer_spec_payload.get("mixer", {}), source_mixer_spec)
    frozen_mcs_pass = json_equal(frozen_mcs_payload.get("frozen_mcs_reference", {}), source_frozen_mcs)
    full_cl_qubo_model_pass = json_equal(packaged_full_model, source_full_model)
    paper10_compatible_model_pass = json_equal(
        normalize_paper10_qubo_model(packaged_paper10_model),
        normalize_paper10_qubo_model(expected_paper10_model),
    )

    metadata_pass = True
    metadata_reasons: List[str] = []
    expected_model_id = source_export.get("modelId")
    expected_candidate_root = primary_candidate.get("candidateRootNodeId")
    expected_required_qubits = primary_candidate.get("requirementsAssessment", {}).get("requiredQubits")
    expected_basic_event_count = len(ordered_basic_event_ids)
    expected_mcs_count = source_frozen_mcs.get("minimalCutSetCount")
    expected_n_vars_total = source_full_model.get("nVarsTotal")
    expected_penalty_p = source_full_model.get("penaltyP")
    expected_top_gate = source_full_model.get("topGate")

    if package_metadata.get("model_id") != expected_model_id:
        metadata_pass = False
        metadata_reasons.append(
            f"model_id_mismatch package={package_metadata.get('model_id')} source={expected_model_id}"
        )
    if package_metadata.get("candidate_root_node_id") != expected_candidate_root:
        metadata_pass = False
        metadata_reasons.append(
            f"candidate_root_node_id_mismatch package={package_metadata.get('candidate_root_node_id')} source={expected_candidate_root}"
        )
    if package_metadata.get("required_qubits") != expected_required_qubits:
        metadata_pass = False
        metadata_reasons.append(
            f"required_qubits_mismatch package={package_metadata.get('required_qubits')} source={expected_required_qubits}"
        )
    if package_metadata.get("basic_event_count") != expected_basic_event_count:
        metadata_pass = False
        metadata_reasons.append(
            f"basic_event_count_mismatch package={package_metadata.get('basic_event_count')} source={expected_basic_event_count}"
        )
    if package_metadata.get("minimal_cut_set_count") != expected_mcs_count:
        metadata_pass = False
        metadata_reasons.append(
            f"minimal_cut_set_count_mismatch package={package_metadata.get('minimal_cut_set_count')} source={expected_mcs_count}"
        )
    if package_metadata.get("full_cl_qubo_model_present") is not True:
        metadata_pass = False
        metadata_reasons.append("full_cl_qubo_model_present_missing_or_false")
    if package_metadata.get("full_cl_qubo_n_vars_total") != expected_n_vars_total:
        metadata_pass = False
        metadata_reasons.append(
            f"full_cl_qubo_n_vars_total_mismatch package={package_metadata.get('full_cl_qubo_n_vars_total')} source={expected_n_vars_total}"
        )
    if package_metadata.get("full_cl_qubo_penalty_p") != expected_penalty_p:
        metadata_pass = False
        metadata_reasons.append(
            f"full_cl_qubo_penalty_p_mismatch package={package_metadata.get('full_cl_qubo_penalty_p')} source={expected_penalty_p}"
        )
    if package_metadata.get("full_cl_qubo_top_gate") != expected_top_gate:
        metadata_pass = False
        metadata_reasons.append(
            f"full_cl_qubo_top_gate_mismatch package={package_metadata.get('full_cl_qubo_top_gate')} source={expected_top_gate}"
        )
    if package_metadata.get("paper10_compatible_qubo_model_written") is not True:
        metadata_pass = False
        metadata_reasons.append("paper10_compatible_qubo_model_written_missing_or_false")

    qpy_present = load_optional_qpy_path(case_dir) is not None
    qaoa_recipe_present = load_optional_qaoa_recipe_path(case_dir) is not None
    circuit_summary_present = load_optional_circuit_summary_path(case_dir) is not None

    internal_pass = all(
        [
            variable_mapping_pass,
            mixer_pass,
            frozen_mcs_pass,
            full_cl_qubo_model_pass,
            paper10_compatible_model_pass,
            metadata_pass,
        ]
    )

    return {
        "case_id": case_dir.name,
        "model_id": expected_model_id,
        "candidate_root_node_id": expected_candidate_root,
        "topology_class": primary_candidate.get("topologyClassification", {}).get("topologyClass"),
        "required_qubits": expected_required_qubits,
        "basic_event_count": expected_basic_event_count,
        "internal_identity_pass": internal_pass,
        "variable_mapping_pass": variable_mapping_pass,
        "variable_mapping_reasons": variable_mapping_reasons,
        "mixer_spec_pass": mixer_pass,
        "frozen_mcs_reference_pass": frozen_mcs_pass,
        "full_cl_qubo_model_pass": full_cl_qubo_model_pass,
        "paper10_compatible_model_pass": paper10_compatible_model_pass,
        "package_metadata_pass": metadata_pass,
        "package_metadata_reasons": metadata_reasons,
        "qpy_present": qpy_present,
        "qaoa_recipe_present": qaoa_recipe_present,
        "circuit_summary_present": circuit_summary_present,
    }


def compare_external_reference(case_dir: Path, reference_case_dir: Path) -> Dict[str, Any]:
    if not reference_case_dir.exists():
        return {
            "external_reference_checked": False,
            "external_reference_pass": False,
            "external_reference_reasons": [f"reference_case_dir_missing {reference_case_dir}"],
        }

    package_qubo_model_path = case_dir / "qubo_model_v1.json"
    reference_qubo_model_path = reference_case_dir / "qubo_model_v1.json"

    reasons: List[str] = []
    if not package_qubo_model_path.exists():
        reasons.append("package_qubo_model_v1_missing")
    if not reference_qubo_model_path.exists():
        reasons.append("reference_qubo_model_v1_missing")

    if reasons:
        return {
            "external_reference_checked": False,
            "external_reference_pass": False,
            "external_reference_reasons": reasons,
        }

    package_qubo_model = load_json(package_qubo_model_path)
    reference_qubo_model = load_json(reference_qubo_model_path)

    package_normalized = normalize_paper10_qubo_model(package_qubo_model)
    reference_normalized = normalize_paper10_qubo_model(reference_qubo_model)

    qubo_model_match = json_equal(package_normalized, reference_normalized)
    if not qubo_model_match:
        reasons.append("external_qubo_model_v1_mismatch")

    return {
        "external_reference_checked": True,
        "external_reference_pass": qubo_model_match,
        "external_reference_reasons": reasons,
        "external_qubo_model_v1_match": qubo_model_match,
        "reference_case_dir": str(reference_case_dir),
    }


def build_readme(
    output_run: Path,
    package_run: Path,
    checked_case_count: int,
    internal_pass_count: int,
    full_cl_qubo_model_pass_count: int,
    paper10_compatible_model_pass_count: int,
    external_checked_count: int,
    external_pass_count: int,
) -> str:
    lines: List[str] = []
    lines.append("# OpenPRA Phase 4 Reference Artifact Validation")
    lines.append("")
    lines.append(f"Run directory: {output_run}")
    lines.append(f"Generated at: {utc_now_iso()}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append(f"Package source run: {package_run}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Validate the packaged frozen 120 case Phase 4 reference artifacts against their source exports, with explicit checks for the promoted full CL QUBO model and the Paper 10 compatible qubo_model_v1.json payload."
    )
    lines.append("")
    lines.append("Validation counts")
    lines.append("")
    lines.append(f"- checked cases: {checked_case_count}")
    lines.append(f"- internal identity pass count: {internal_pass_count}")
    lines.append(f"- full CL QUBO model pass count: {full_cl_qubo_model_pass_count}")
    lines.append(f"- Paper 10 compatible model pass count: {paper10_compatible_model_pass_count}")
    lines.append(f"- external reference checked count: {external_checked_count}")
    lines.append(f"- external reference pass count: {external_pass_count}")
    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "A full pass here confirms that the packaged reference path now carries the richer CL QUBO representation as first class artifacts and is ready for direct comparison against frozen Paper 10 per instance qubo_model_v1.json files when a reference mapping is supplied."
    )
    lines.append("")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate packaged frozen Phase 4 reference artifacts."
    )
    parser.add_argument(
        "--package-run",
        dest="package_run",
        default=None,
        help="Optional repo-relative or absolute packaged-artifact run directory. Default: latest.",
    )
    parser.add_argument(
        "--reference-mapping-csv",
        dest="reference_mapping_csv",
        default=None,
        help="Optional CSV with columns model_id,reference_case_dir for external frozen-chain comparison.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    package_run = resolve_run(repo_root, args.package_run, PACKAGE_ROOT)
    reference_mapping_csv = None
    if args.reference_mapping_csv:
        mapping_path = Path(args.reference_mapping_csv)
        reference_mapping_csv = mapping_path if mapping_path.is_absolute() else (repo_root / mapping_path)

    reference_map = build_reference_map(reference_mapping_csv)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    packaged_case_dirs = sorted([path for path in package_run.iterdir() if path.is_dir() and path.name.isdigit()])
    if not packaged_case_dirs:
        raise SystemExit(f"No numeric case directories found in {package_run}")

    case_reports: List[Dict[str, Any]] = []
    internal_pass_count = 0
    full_cl_qubo_model_pass_count = 0
    paper10_compatible_model_pass_count = 0
    external_checked_count = 0
    external_pass_count = 0

    for case_dir in packaged_case_dirs:
        case_report = compare_internal_identity(case_dir)

        model_id = case_report["model_id"]
        if model_id in reference_map:
            external = compare_external_reference(case_dir, reference_map[model_id])
        else:
            external = {
                "external_reference_checked": False,
                "external_reference_pass": False,
                "external_reference_reasons": ["no_reference_mapping_for_model_id"],
            }

        case_report.update(external)
        case_reports.append(case_report)

        if case_report["internal_identity_pass"]:
            internal_pass_count += 1
        if case_report["full_cl_qubo_model_pass"]:
            full_cl_qubo_model_pass_count += 1
        if case_report["paper10_compatible_model_pass"]:
            paper10_compatible_model_pass_count += 1
        if case_report["external_reference_checked"]:
            external_checked_count += 1
            if case_report["external_reference_pass"]:
                external_pass_count += 1

        write_json(output_run / f"{case_dir.name}_artifact_validation_report.json", case_report)

    summary_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "package_run": str(package_run),
        "reference_mapping_csv": str(reference_mapping_csv) if reference_mapping_csv is not None else None,
        "checked_case_count": len(case_reports),
        "internal_identity_pass_count": internal_pass_count,
        "full_cl_qubo_model_pass_count": full_cl_qubo_model_pass_count,
        "paper10_compatible_model_pass_count": paper10_compatible_model_pass_count,
        "external_reference_checked_count": external_checked_count,
        "external_reference_pass_count": external_pass_count,
        "cases": case_reports,
    }

    write_json(output_run / "90_phase4_reference_artifact_validation_summary.json", summary_payload)
    write_text(
        output_run / "README.txt",
        build_readme(
            output_run=output_run,
            package_run=package_run,
            checked_case_count=len(case_reports),
            internal_pass_count=internal_pass_count,
            full_cl_qubo_model_pass_count=full_cl_qubo_model_pass_count,
            paper10_compatible_model_pass_count=paper10_compatible_model_pass_count,
            external_checked_count=external_checked_count,
            external_pass_count=external_pass_count,
        ),
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase4_reference_artifact_validation_summary.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
