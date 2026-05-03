#!/usr/bin/env python3

from __future__ import annotations

import csv
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


SCRIPT_VERSION = "phase4-first-real-bounded-cohort-selector-v1"
DEFAULT_LIMIT = 20


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


def priority_rank(value: str) -> int:
    if value == "high":
        return 0
    if value == "low":
        return 1
    return 2


def topology_rank(value: str) -> int:
    if value in {"A", "C"}:
        return 0
    if value in {"B", "D"}:
        return 1
    return 2


def selection_sort_key(candidate: Dict[str, Any]) -> Tuple[Any, ...]:
    return (
        topology_rank(candidate["topology_class"]),
        priority_rank(candidate["execution_priority"]),
        candidate["basic_event_count"],
        candidate["gate_count"],
        candidate["model_id"],
        candidate["candidate_root_node_id"],
    )


def determine_exclusion_reasons(candidate: Dict[str, Any]) -> List[str]:
    reasons: List[str] = []

    if candidate["is_synthetic"]:
        reasons.append("synthetic_model")
    if not candidate["matrix_entry_matched"]:
        reasons.append("matrix_entry_not_matched")
    if not candidate["has_topology"]:
        reasons.append("missing_topology_classification")
    if not candidate["has_requirements"]:
        reasons.append("missing_requirements_assessment")
    if candidate["basic_event_count"] is None:
        reasons.append("missing_basic_event_count")
    elif candidate["basic_event_count"] > 8:
        reasons.append("basic_event_count_gt_8")
    if candidate["topology_class"] not in {"A", "B", "C", "D"}:
        reasons.append("topology_not_bounded_ABCD")

    return reasons


def write_selected_csv(path: Path, selected_candidates: List[Dict[str, Any]]) -> None:
    fieldnames = [
        "selection_rank",
        "model_id",
        "model_name",
        "candidate_root_node_id",
        "candidate_root_gate_type",
        "source_preparation_file",
        "source_phase3_run",
        "source_format",
        "topology_class",
        "execution_priority",
        "matrix_entry_matched",
        "required_qubits",
        "basic_event_count",
        "gate_count",
        "max_depth",
        "selection_bucket",
    ]

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for index, candidate in enumerate(selected_candidates, start=1):
            writer.writerow(
                {
                    "selection_rank": index,
                    "model_id": candidate["model_id"],
                    "model_name": candidate["model_name"],
                    "candidate_root_node_id": candidate["candidate_root_node_id"],
                    "candidate_root_gate_type": candidate["candidate_root_gate_type"],
                    "source_preparation_file": candidate["source_preparation_file"],
                    "source_phase3_run": candidate["source_phase3_run"],
                    "source_format": candidate["source_format"],
                    "topology_class": candidate["topology_class"],
                    "execution_priority": candidate["execution_priority"],
                    "matrix_entry_matched": candidate["matrix_entry_matched"],
                    "required_qubits": candidate["required_qubits"],
                    "basic_event_count": candidate["basic_event_count"],
                    "gate_count": candidate["gate_count"],
                    "max_depth": candidate["max_depth"],
                    "selection_bucket": candidate["selection_bucket"],
                }
            )


def build_candidate_rows(input_run: Path) -> List[Dict[str, Any]]:
    preparation_files = sorted(input_run.glob("*_preparation.json"))
    if not preparation_files:
        raise SystemExit(f"No *_preparation.json files found in {input_run}")

    rows: List[Dict[str, Any]] = []

    for preparation_file in preparation_files:
        payload = load_json(preparation_file)
        prep_candidates = payload.get("preparationCandidates", [])

        for prep_candidate in prep_candidates:
            topology = prep_candidate.get("topologyClassification") or {}
            requirements = prep_candidate.get("requirementsAssessment") or {}

            model_id = prep_candidate.get("modelId", payload.get("modelId", "unknown"))
            topology_class = topology.get("topologyClass", "unclassified")
            execution_priority = requirements.get("executionPriority", "unknown")
            basic_event_count = prep_candidate.get("basicEventCount")
            gate_count = prep_candidate.get("gateCount")
            max_depth = prep_candidate.get("maxDepth")

            row = {
                "model_id": model_id,
                "model_name": prep_candidate.get("modelName", payload.get("modelName", "unknown")),
                "candidate_root_node_id": prep_candidate.get("candidateRootNodeId"),
                "candidate_root_node_label": prep_candidate.get("candidateRootNodeLabel"),
                "candidate_root_gate_type": prep_candidate.get("candidateRootGateType"),
                "source_preparation_file": preparation_file.name,
                "source_phase3_run": str(input_run),
                "source_format": prep_candidate.get("sourceFormat", payload.get("sourceFormat", "unknown")),
                "topology_class": topology_class,
                "execution_priority": execution_priority,
                "matrix_entry_matched": bool(requirements.get("matrixEntryMatched", False)),
                "required_qubits": requirements.get("requiredQubits"),
                "basic_event_count": basic_event_count,
                "gate_count": gate_count,
                "max_depth": max_depth,
                "has_topology": bool(prep_candidate.get("topologyClassification")),
                "has_requirements": bool(prep_candidate.get("requirementsAssessment")),
                "is_synthetic": str(model_id).startswith("synthetic_"),
            }

            row["exclusion_reasons"] = determine_exclusion_reasons(row)
            row["eligible_for_first_real_bounded_cohort"] = len(row["exclusion_reasons"]) == 0

            if row["topology_class"] in {"A", "C"} and row["execution_priority"] == "high":
                row["selection_bucket"] = "tier1_favorable_high"
            elif row["topology_class"] in {"A", "C"}:
                row["selection_bucket"] = "tier2_favorable_other"
            elif row["topology_class"] in {"B", "D"} and row["execution_priority"] == "high":
                row["selection_bucket"] = "tier3_unfavorable_high"
            else:
                row["selection_bucket"] = "tier4_unfavorable_other"

            rows.append(row)

    return rows


def build_readme(
    output_run: Path,
    input_run: Path,
    selected_candidates: List[Dict[str, Any]],
    total_candidates_scanned: int,
    real_candidates_scanned: int,
    eligible_candidates_count: int,
    limit: int,
) -> str:
    lines: List[str] = []

    lines.append("# OpenPRA Phase 4 First Real Bounded Cohort Selection")
    lines.append("")
    lines.append(f"Run directory: {output_run}")
    lines.append(f"Input Phase 3 preparation run: {input_run}")
    lines.append(f"Generated at: {utc_now_iso()}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Select the first real bounded Phase 4 cohort from the frozen Phase 3 preparation exports without reopening Phase 3 plumbing."
    )
    lines.append("")
    lines.append("Selection rules")
    lines.append("")
    lines.append("- exclude synthetic models")
    lines.append("- require bounded topology class A, B, C, or D")
    lines.append("- require requirements matrix match")
    lines.append("- require basic event count <= 8")
    lines.append("- sort A/C before B/D")
    lines.append("- sort high priority before low or unknown")
    lines.append("- take up to the configured cohort limit")
    lines.append("")
    lines.append("Counts")
    lines.append("")
    lines.append(f"- total candidates scanned: {total_candidates_scanned}")
    lines.append(f"- real candidates scanned: {real_candidates_scanned}")
    lines.append(f"- eligible real bounded candidates: {eligible_candidates_count}")
    lines.append(f"- cohort limit: {limit}")
    lines.append(f"- selected count: {len(selected_candidates)}")
    lines.append("")

    if selected_candidates:
        lines.append("Selected candidates")
        lines.append("")
        for index, candidate in enumerate(selected_candidates, start=1):
            lines.append(
                f"- #{index}: model={candidate['model_id']}, root={candidate['candidate_root_node_id']}, "
                f"topology={candidate['topology_class']}, priority={candidate['execution_priority']}, "
                f"n={candidate['basic_event_count']}, qubits={candidate['required_qubits']}, "
                f"bucket={candidate['selection_bucket']}"
            )
        lines.append("")
    else:
        lines.append("Selected candidates")
        lines.append("")
        lines.append("- none")
        lines.append("")

    lines.append("Interpretation")
    lines.append("")
    if selected_candidates:
        lines.append(
            "A first real bounded cohort now exists and can be used as the next widening seam for Phase 4 export work."
        )
    else:
        lines.append(
            "No real bounded cohort candidates were found in the frozen Phase 3 preparation run under the current selection rules. "
            "The next move would be to connect the exporter to the actual OpenPRA corpus path rather than synthetic-only sources."
        )
    lines.append("")

    return "\n".join(lines) + "\n"


def main() -> int:
    repo_root = Path.cwd().resolve()

    phase3_root = repo_root / "_work" / "openpra_quantum_preparation_exports_v1"
    input_run = latest_run(phase3_root)

    output_root = repo_root / "_work" / "openpra_phase4_first_real_bounded_cohort_v1"
    output_run = output_root / utc_stamp()
    output_run.mkdir(parents=True, exist_ok=False)

    all_candidates = build_candidate_rows(input_run)
    total_candidates_scanned = len(all_candidates)
    real_candidates_scanned = sum(1 for row in all_candidates if not row["is_synthetic"])
    eligible_candidates = [row for row in all_candidates if row["eligible_for_first_real_bounded_cohort"]]
    eligible_candidates.sort(key=selection_sort_key)

    selected_candidates = eligible_candidates[:DEFAULT_LIMIT]

    excluded_candidates = [
        row for row in all_candidates if not row["eligible_for_first_real_bounded_cohort"]
    ]
    excluded_candidates.sort(
        key=lambda row: (
            row["model_id"],
            row["candidate_root_node_id"],
        )
    )

    summary_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "input_run": str(input_run),
        "output_run": str(output_run),
        "selection_type": "first_real_bounded_phase4_cohort",
        "selection_limit": DEFAULT_LIMIT,
        "total_candidates_scanned": total_candidates_scanned,
        "real_candidates_scanned": real_candidates_scanned,
        "eligible_candidates_count": len(eligible_candidates),
        "selected_count": len(selected_candidates),
        "selected_candidates": selected_candidates,
        "excluded_candidates": excluded_candidates,
        "selection_pass": len(selected_candidates) > 0,
        "selection_notes": [
            "Selection is derived from frozen Phase 3 preparation exports only.",
            "Selection excludes synthetic proof models.",
            "Selection prioritizes topology classes A and C before B and D.",
            "Selection prioritizes execution priority high before low or unknown.",
            "This run selects a cohort manifest only. It does not yet perform CL-QUBO export for the selected real cohort."
        ],
    }

    summary_path = output_run / "90_first_real_bounded_cohort_summary.json"
    write_json(summary_path, summary_payload)

    selected_json_path = output_run / "91_selected_real_bounded_cohort.json"
    write_json(
        selected_json_path,
        {
            "generated_at": utc_now_iso(),
            "script_version": SCRIPT_VERSION,
            "input_run": str(input_run),
            "selection_limit": DEFAULT_LIMIT,
            "selected_count": len(selected_candidates),
            "selected_candidates": selected_candidates,
        },
    )

    selected_csv_path = output_run / "92_selected_real_bounded_cohort.csv"
    write_selected_csv(selected_csv_path, selected_candidates)

    readme_text = build_readme(
        output_run=output_run,
        input_run=input_run,
        selected_candidates=selected_candidates,
        total_candidates_scanned=total_candidates_scanned,
        real_candidates_scanned=real_candidates_scanned,
        eligible_candidates_count=len(eligible_candidates),
        limit=DEFAULT_LIMIT,
    )
    readme_path = output_run / "README.txt"
    write_text(readme_path, readme_text)

    manifest = write_manifest(output_run)
    manifest_path = output_run / "00_manifest.json"
    write_json(manifest_path, manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={summary_path}")
    print(f"SELECTED_JSON={selected_json_path}")
    print(f"SELECTED_CSV={selected_csv_path}")
    print(f"README={readme_path}")
    print(f"MANIFEST={manifest_path}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
