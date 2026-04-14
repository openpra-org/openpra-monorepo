#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


SCRIPT_VERSION = "openpra-phase5-initialize-candidate-inputs-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"


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


def choose_primary_candidate(source_export: Dict[str, Any], candidate_root_node_id: str) -> Dict[str, Any]:
    candidates = source_export.get("clQuboCandidates", [])
    if not candidates:
        raise SystemExit("source_export.json missing clQuboCandidates")

    for candidate in candidates:
        if candidate.get("candidateRootNodeId") == candidate_root_node_id:
            return candidate

    return candidates[0]


def extract_ordered_basic_event_ids(batch_case_dir: Path) -> List[str]:
    metadata = load_json(batch_case_dir / "package_metadata.json")
    source_export = load_json(batch_case_dir / "source_export.json")
    candidate = choose_primary_candidate(source_export, str(metadata["candidate_root_node_id"]))
    ordered_basic_event_ids = candidate.get("orderedBasicEventIds", [])
    if not isinstance(ordered_basic_event_ids, list) or not ordered_basic_event_ids:
        raise SystemExit(f"Could not extract orderedBasicEventIds from {batch_case_dir}")
    return [str(item) for item in ordered_basic_event_ids]


def build_probability_template(batch_case_dir: Path, ordered_basic_event_ids: List[str]) -> Dict[str, Any]:
    metadata = load_json(batch_case_dir / "package_metadata.json")
    return {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "status": "template_not_populated",
        "model_id": metadata["model_id"],
        "candidate_root_node_id": metadata["candidate_root_node_id"],
        "topology_class": metadata.get("topology_class"),
        "basic_event_count": metadata.get("basic_event_count"),
        "required_qubits": metadata.get("required_qubits"),
        "probabilities": {event_id: None for event_id in ordered_basic_event_ids},
        "notes": [
            "Populate each event with a numeric probability before running the real Phase 5 comparison.",
            "Do not leave null values in the final runnable input.",
        ],
    }


def build_quantum_mcs_template(batch_case_dir: Path, ordered_basic_event_ids: List[str]) -> Dict[str, Any]:
    metadata = load_json(batch_case_dir / "package_metadata.json")
    return {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "status": "template_not_populated",
        "model_id": metadata["model_id"],
        "candidate_root_node_id": metadata["candidate_root_node_id"],
        "allowed_basic_event_ids": ordered_basic_event_ids,
        "basicEventIdSets": [],
        "notes": [
            "Write recovered quantum cut sets as a list of basic-event ID lists.",
            "Each cut set should only use IDs from allowed_basic_event_ids.",
            "Leave status as populated only after the list is final.",
        ],
    }


def probability_template_is_populated(path: Path) -> bool:
    if not path.exists():
        return False
    payload = load_json(path)
    probabilities = payload.get("probabilities", {})
    if not isinstance(probabilities, dict) or not probabilities:
        return False
    for value in probabilities.values():
        if not isinstance(value, (int, float)):
            return False
    return True


def quantum_mcs_template_is_populated(path: Path) -> bool:
    if not path.exists():
        return False
    payload = load_json(path)
    cut_sets = payload.get("basicEventIdSets")
    if not isinstance(cut_sets, list):
        return False
    if len(cut_sets) == 0:
        return False
    for cut_set in cut_sets:
        if not isinstance(cut_set, list):
            return False
        for item in cut_set:
            if not isinstance(item, str) or not item.strip():
                return False
    return True


def read_optional_json(path: Path) -> Optional[Any]:
    if not path.exists():
        return None
    return load_json(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Initialize Phase 5 candidate input templates and write a readiness audit."
    )
    parser.add_argument(
        "--batch-run",
        dest="batch_run",
        default=None,
        help="Optional repo-relative or absolute Phase 5 candidate batch directory. Default: latest.",
    )
    parser.add_argument(
        "--overwrite-existing-templates",
        dest="overwrite_existing_templates",
        action="store_true",
        help="Overwrite existing probabilities.json and quantum_recovered_mcs.json templates.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()
    batch_run = resolve_run(repo_root, args.batch_run, BATCH_ROOT)

    batch_case_dirs = sorted([path for path in batch_run.iterdir() if path.is_dir() and path.name[:4].isdigit()])
    if not batch_case_dirs:
        raise SystemExit(f"No batch case directories found in {batch_run}")

    audit_rows: List[Dict[str, Any]] = []

    for batch_case_dir in batch_case_dirs:
        metadata = load_json(batch_case_dir / "package_metadata.json")
        ordered_basic_event_ids = extract_ordered_basic_event_ids(batch_case_dir)

        probabilities_path = batch_case_dir / "probabilities.json"
        quantum_mcs_path = batch_case_dir / "quantum_recovered_mcs.json"

        if args.overwrite_existing_templates or not probabilities_path.exists():
            write_json(
                probabilities_path,
                build_probability_template(batch_case_dir, ordered_basic_event_ids),
            )

        if args.overwrite_existing_templates or not quantum_mcs_path.exists():
            write_json(
                quantum_mcs_path,
                build_quantum_mcs_template(batch_case_dir, ordered_basic_event_ids),
            )

        probabilities_payload = read_optional_json(probabilities_path)
        quantum_payload = read_optional_json(quantum_mcs_path)

        probabilities_populated = probability_template_is_populated(probabilities_path)
        quantum_mcs_populated = quantum_mcs_template_is_populated(quantum_mcs_path)

        ready_for_phase5_compare = probabilities_populated and quantum_mcs_populated

        audit_rows.append(
            {
                "batch_case_dir": str(batch_case_dir),
                "model_id": metadata["model_id"],
                "candidate_root_node_id": metadata["candidate_root_node_id"],
                "topology_class": metadata.get("topology_class"),
                "basic_event_count": metadata.get("basic_event_count"),
                "required_qubits": metadata.get("required_qubits"),
                "probabilities_json": str(probabilities_path),
                "probabilities_status": probabilities_payload.get("status") if isinstance(probabilities_payload, dict) else None,
                "probabilities_populated": probabilities_populated,
                "quantum_recovered_mcs_json": str(quantum_mcs_path),
                "quantum_mcs_status": quantum_payload.get("status") if isinstance(quantum_payload, dict) else None,
                "quantum_mcs_populated": quantum_mcs_populated,
                "ready_for_phase5_compare": ready_for_phase5_compare,
            }
        )

    ready_count = sum(1 for row in audit_rows if row["ready_for_phase5_compare"])
    probabilities_populated_count = sum(1 for row in audit_rows if row["probabilities_populated"])
    quantum_mcs_populated_count = sum(1 for row in audit_rows if row["quantum_mcs_populated"])

    audit_csv = batch_run / "93_phase5_input_readiness_audit.csv"
    with audit_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "batch_case_dir",
                "model_id",
                "candidate_root_node_id",
                "topology_class",
                "basic_event_count",
                "required_qubits",
                "probabilities_json",
                "probabilities_status",
                "probabilities_populated",
                "quantum_recovered_mcs_json",
                "quantum_mcs_status",
                "quantum_mcs_populated",
                "ready_for_phase5_compare",
            ],
        )
        writer.writeheader()
        for row in audit_rows:
            writer.writerow(row)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "counts": {
            "candidate_count": len(audit_rows),
            "probabilities_json_present_count": len(audit_rows),
            "quantum_recovered_mcs_json_present_count": len(audit_rows),
            "probabilities_populated_count": probabilities_populated_count,
            "quantum_recovered_mcs_populated_count": quantum_mcs_populated_count,
            "ready_for_phase5_compare_count": ready_count,
        },
        "candidates": audit_rows,
        "next_action": {
            "statement": "Populate probabilities.json and quantum_recovered_mcs.json for the selected candidates, then run the real Phase 5 comparison.",
            "blocking_items": [
                "event_level_probabilities",
                "quantum_recovered_cut_sets",
            ],
        },
    }

    write_json(batch_run / "94_phase5_input_readiness_summary.json", summary)
    write_text(
        batch_run / "95_phase5_input_readiness_README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 input readiness audit",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"candidate_count: {len(audit_rows)}",
                f"probabilities_populated_count: {probabilities_populated_count}",
                f"quantum_recovered_mcs_populated_count: {quantum_mcs_populated_count}",
                f"ready_for_phase5_compare_count: {ready_count}",
                "",
                "This audit initializes missing templates and reports which candidates are runnable for the real Phase 5 compare step.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(batch_run)
    write_json(batch_run / "00_manifest.json", manifest)

    print(f"BATCH_RUN={batch_run}")
    print(f"AUDIT_CSV={audit_csv}")
    print(f"SUMMARY={batch_run / '94_phase5_input_readiness_summary.json'}")
    print(f"README={batch_run / '95_phase5_input_readiness_README.txt'}")
    print(f"MANIFEST={batch_run / '00_manifest.json'}")
    print(f"SHA256={batch_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
