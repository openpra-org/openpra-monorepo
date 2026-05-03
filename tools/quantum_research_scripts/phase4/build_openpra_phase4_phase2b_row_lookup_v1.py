#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


SCRIPT_VERSION = "phase4-phase2b-row-lookup-v2"
PACKAGE_ROOT = "_work/openpra_phase4_reference_artifact_packages_v1"
OUTPUT_ROOT = "_work/openpra_phase4_phase2b_row_lookup_v1"
DEFAULT_CANDIDATE_CSV = (
    "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/"
    "PaperB_reactor_models/06_phase2B_reactor_scale/"
    "02_structural_analysis_runs/PHASE2B_STRUCTURAL_ANALYSIS_v1_20260220_175859Z/"
    "candidate_subtrees_basic_le_20_v1.csv"
)


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


def parse_model_row_number(model_id: str) -> int:
    match = re.fullmatch(r"phase2b_row_(\d+)", model_id)
    if not match:
        raise SystemExit(f"Unexpected model_id format: {model_id}")
    return int(match.group(1))


def normalize_gate_name(candidate_root_node_id: Optional[str]) -> Optional[str]:
    if candidate_root_node_id is None:
        return None
    if ":" in candidate_root_node_id:
        return candidate_root_node_id.split(":", 1)[1]
    return candidate_root_node_id


def read_candidate_csv_rows(candidate_csv: Path) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    with candidate_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {
            "xml_path",
            "gate_name",
            "subtree_basic_count",
            "subtree_depth",
            "subtree_basic_truncated",
            "cycle_suspected",
        }
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"Candidate CSV missing required columns: {sorted(missing)}")

        for row in reader:
            rows.append(dict(row))
    return rows


def load_case_identity(case_dir: Path) -> Dict[str, Any]:
    metadata_files = sorted(case_dir.glob("*_package_metadata.json"))
    export_files = sorted(case_dir.glob("*_source_export.json"))

    if len(metadata_files) != 1:
        raise SystemExit(f"Expected exactly one package metadata file in {case_dir}")
    if len(export_files) != 1:
        raise SystemExit(f"Expected exactly one source export file in {case_dir}")

    metadata = load_json(metadata_files[0])
    source_export = load_json(export_files[0])

    candidate_root_node_id = metadata.get("candidate_root_node_id")
    if candidate_root_node_id:
        return {
            "case_id": case_dir.name,
            "model_id": metadata["model_id"],
            "candidate_root_node_id": candidate_root_node_id,
            "gate_name_normalized": normalize_gate_name(candidate_root_node_id),
            "topology_class": metadata.get("topology_class"),
            "required_qubits": metadata.get("required_qubits"),
            "basic_event_count": metadata.get("basic_event_count"),
        }

    chosen = None
    for candidate in source_export.get("clQuboCandidates", []):
        if candidate.get("requirementsAssessment", {}).get("matrixEntryMatched") is True:
            chosen = candidate
            break
    if chosen is None:
        candidates = source_export.get("clQuboCandidates", [])
        if not candidates:
            raise SystemExit(f"No clQuboCandidates found in {export_files[0]}")
        chosen = candidates[0]

    fallback_root = chosen.get("candidateRootNodeId")

    return {
        "case_id": case_dir.name,
        "model_id": metadata["model_id"],
        "candidate_root_node_id": fallback_root,
        "gate_name_normalized": normalize_gate_name(fallback_root),
        "topology_class": metadata.get("topology_class"),
        "required_qubits": metadata.get("required_qubits"),
        "basic_event_count": metadata.get("basic_event_count"),
    }


def build_lookup_rows(
    package_run: Path,
    package_summary: Dict[str, Any],
    candidate_rows: List[Dict[str, str]],
) -> List[Dict[str, Any]]:
    case_dirs = sorted([p for p in package_run.iterdir() if p.is_dir() and p.name.isdigit()])
    if len(case_dirs) != len(package_summary["packaged_cases"]):
        raise SystemExit(
            f"Case directory count mismatch: dirs={len(case_dirs)} summary={len(package_summary['packaged_cases'])}"
        )

    out: List[Dict[str, Any]] = []

    for case_dir in case_dirs:
        case_identity = load_case_identity(case_dir)
        model_id = case_identity["model_id"]
        data_row_index_1based = parse_model_row_number(model_id)

        if data_row_index_1based < 1 or data_row_index_1based > len(candidate_rows):
            raise SystemExit(
                f"Model row index out of bounds for {model_id}: {data_row_index_1based} not in 1..{len(candidate_rows)}"
            )

        candidate_row = candidate_rows[data_row_index_1based - 1]

        expected_gate_name = case_identity["gate_name_normalized"]
        observed_gate_name = candidate_row["gate_name"]

        expected_basic_count = int(case_identity["basic_event_count"])
        observed_basic_count = int(candidate_row["subtree_basic_count"])

        gate_match = expected_gate_name == observed_gate_name
        basic_count_match = expected_basic_count == observed_basic_count
        required_qubits_match = int(case_identity["required_qubits"]) == observed_basic_count

        row_pass = gate_match and basic_count_match and required_qubits_match

        reasons: List[str] = []
        if not gate_match:
            reasons.append(
                f"gate_name_mismatch package={expected_gate_name} candidate_csv={observed_gate_name}"
            )
        if not basic_count_match:
            reasons.append(
                f"basic_count_mismatch package={expected_basic_count} candidate_csv={observed_basic_count}"
            )
        if not required_qubits_match:
            reasons.append(
                f"required_qubits_mismatch package={case_identity['required_qubits']} candidate_csv_basic_count={observed_basic_count}"
            )

        out.append(
            {
                "case_id": case_identity["case_id"],
                "model_id": model_id,
                "phase2b_data_row_index_1based": data_row_index_1based,
                "phase2b_csv_line_number_with_header": data_row_index_1based + 1,
                "package_candidate_root_node_id": case_identity["candidate_root_node_id"],
                "package_gate_name_normalized": expected_gate_name,
                "package_topology_class": case_identity["topology_class"],
                "package_required_qubits": case_identity["required_qubits"],
                "package_basic_event_count": case_identity["basic_event_count"],
                "candidate_csv_xml_path": candidate_row["xml_path"],
                "candidate_csv_gate_name": observed_gate_name,
                "candidate_csv_subtree_basic_count": observed_basic_count,
                "candidate_csv_subtree_depth": int(candidate_row["subtree_depth"]),
                "candidate_csv_subtree_basic_truncated": int(candidate_row["subtree_basic_truncated"]),
                "candidate_csv_cycle_suspected": int(candidate_row["cycle_suspected"]),
                "row_lookup_pass": row_pass,
                "row_lookup_reasons": reasons,
            }
        )

    return out


def write_lookup_csv(path: Path, rows: List[Dict[str, Any]]) -> None:
    fieldnames = [
        "case_id",
        "model_id",
        "phase2b_data_row_index_1based",
        "phase2b_csv_line_number_with_header",
        "package_candidate_root_node_id",
        "package_gate_name_normalized",
        "package_topology_class",
        "package_required_qubits",
        "package_basic_event_count",
        "candidate_csv_xml_path",
        "candidate_csv_gate_name",
        "candidate_csv_subtree_basic_count",
        "candidate_csv_subtree_depth",
        "candidate_csv_subtree_basic_truncated",
        "candidate_csv_cycle_suspected",
        "row_lookup_pass",
        "row_lookup_reasons",
    ]

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    **row,
                    "row_lookup_reasons": "|".join(row["row_lookup_reasons"]),
                }
            )


def build_readme(
    output_run: Path,
    package_run: Path,
    candidate_csv: Path,
    row_count: int,
    pass_count: int,
) -> str:
    lines: List[str] = []
    lines.append("# OpenPRA Phase 4 Phase2B Row Lookup")
    lines.append("")
    lines.append(f"Run directory: {output_run}")
    lines.append(f"Generated at: {utc_now_iso()}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append(f"Package source run: {package_run}")
    lines.append(f"Candidate CSV: {candidate_csv}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Build the deterministic lookup from packaged Phase 4 model_ids of the form phase2b_row_N to the canonical Phase2B candidate CSV data row N."
    )
    lines.append("")
    lines.append("Counts")
    lines.append("")
    lines.append(f"- checked packaged cases: {row_count}")
    lines.append(f"- row lookup pass count: {pass_count}")
    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "A full pass here confirms the row-index join seam from the packaged Phase 4 reference path into the canonical Phase2B structural-analysis candidate corpus."
    )
    lines.append("")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the deterministic Phase2B row lookup manifest for packaged Phase 4 reference cases."
    )
    parser.add_argument(
        "--package-run",
        dest="package_run",
        default=None,
        help="Optional repo-relative or absolute reference-artifact package run directory. Default: latest.",
    )
    parser.add_argument(
        "--candidate-csv",
        dest="candidate_csv",
        default=DEFAULT_CANDIDATE_CSV,
        help="Canonical Phase2B candidate CSV used for row lookup.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    package_run = resolve_run(repo_root, args.package_run, PACKAGE_ROOT)
    candidate_csv = Path(args.candidate_csv).resolve()

    if not candidate_csv.exists():
        raise SystemExit(f"Candidate CSV does not exist: {candidate_csv}")

    package_summary_path = package_run / "90_phase4_reference_artifact_package_summary.json"
    package_summary = load_json(package_summary_path)
    candidate_rows = read_candidate_csv_rows(candidate_csv)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    lookup_rows = build_lookup_rows(package_run, package_summary, candidate_rows)
    pass_count = sum(1 for row in lookup_rows if row["row_lookup_pass"])

    summary_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "package_run": str(package_run),
        "candidate_csv": str(candidate_csv),
        "checked_packaged_cases": len(lookup_rows),
        "row_lookup_pass_count": pass_count,
        "rows": lookup_rows,
    }

    write_json(output_run / "90_phase4_phase2b_row_lookup_summary.json", summary_payload)
    write_lookup_csv(output_run / "91_phase4_phase2b_row_lookup.csv", lookup_rows)
    write_json(
        output_run / "92_phase4_phase2b_reference_seed.json",
        {
            "generated_at": utc_now_iso(),
            "script_version": SCRIPT_VERSION,
            "candidate_csv": str(candidate_csv),
            "reference_rows": [
                {
                    "model_id": row["model_id"],
                    "phase2b_data_row_index_1based": row["phase2b_data_row_index_1based"],
                    "xml_path": row["candidate_csv_xml_path"],
                    "gate_name": row["candidate_csv_gate_name"],
                    "subtree_basic_count": row["candidate_csv_subtree_basic_count"],
                }
                for row in lookup_rows
                if row["row_lookup_pass"]
            ],
        },
    )

    (output_run / "README.txt").write_text(
        build_readme(
            output_run=output_run,
            package_run=package_run,
            candidate_csv=candidate_csv,
            row_count=len(lookup_rows),
            pass_count=pass_count,
        ),
        encoding="utf-8",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase4_phase2b_row_lookup_summary.json'}")
    print(f"LOOKUP_CSV={output_run / '91_phase4_phase2b_row_lookup.csv'}")
    print(f"REFERENCE_SEED={output_run / '92_phase4_phase2b_reference_seed.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
