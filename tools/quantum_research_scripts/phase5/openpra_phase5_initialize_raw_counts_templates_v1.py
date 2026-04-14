#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


SCRIPT_VERSION = "openpra-phase5-initialize-raw-counts-templates-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def build_raw_counts_template(batch_case_dir: Path, ordered_basic_event_ids: List[str]) -> Dict[str, Any]:
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
        "ordered_basic_event_ids": ordered_basic_event_ids,
        "bitstring_convention": "declared_order",
        "counts": {},
        "shots_total": None,
        "notes": [
            "Populate counts with computational-basis bitstring to count mappings.",
            "Bitstring length must match ordered_basic_event_ids length.",
            "Use declared_order unless a later audit proves otherwise.",
            "Set shots_total to the integer total shots once populated.",
        ],
    }


def raw_counts_template_is_populated(path: Path, expected_length: int) -> bool:
    if not path.exists():
        return False

    payload = load_json(path)
    counts = payload.get("counts")
    shots_total = payload.get("shots_total")

    if not isinstance(counts, dict) or not counts:
        return False

    total = 0
    for bitstring, count in counts.items():
        if not isinstance(bitstring, str):
            return False
        stripped = bitstring.strip()
        if len(stripped) != expected_length:
            return False
        if any(ch not in {"0", "1"} for ch in stripped):
            return False
        if not isinstance(count, int):
            return False
        if count < 0:
            return False
        total += count

    if not isinstance(shots_total, int):
        return False
    if shots_total <= 0:
        return False
    if total != shots_total:
        return False

    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Initialize raw_counts.json templates in the Phase 5 real candidate batch."
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
        help="Overwrite existing raw_counts.json templates.",
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

        raw_counts_path = batch_case_dir / "raw_counts.json"
        if args.overwrite_existing_templates or not raw_counts_path.exists():
            write_json(
                raw_counts_path,
                build_raw_counts_template(batch_case_dir, ordered_basic_event_ids),
            )

        payload = load_json(raw_counts_path)
        populated = raw_counts_template_is_populated(raw_counts_path, len(ordered_basic_event_ids))

        audit_rows.append(
            {
                "batch_case_dir": str(batch_case_dir),
                "model_id": metadata["model_id"],
                "candidate_root_node_id": metadata["candidate_root_node_id"],
                "topology_class": metadata.get("topology_class"),
                "basic_event_count": metadata.get("basic_event_count"),
                "required_qubits": metadata.get("required_qubits"),
                "raw_counts_json": str(raw_counts_path),
                "raw_counts_status": payload.get("status") if isinstance(payload, dict) else None,
                "raw_counts_populated": populated,
                "bitstring_convention": payload.get("bitstring_convention") if isinstance(payload, dict) else None,
            }
        )

    populated_count = sum(1 for row in audit_rows if row["raw_counts_populated"])

    audit_csv = batch_run / "96_phase5_raw_counts_readiness_audit.csv"
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
                "raw_counts_json",
                "raw_counts_status",
                "raw_counts_populated",
                "bitstring_convention",
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
            "raw_counts_json_present_count": len(audit_rows),
            "raw_counts_populated_count": populated_count,
        },
        "candidates": audit_rows,
        "next_action": {
            "statement": "Populate raw_counts.json for candidates with hardware or simulator measurement outputs, then run the recompute script on real inputs.",
            "blocking_item": "raw_measurement_counts",
        },
    }

    write_json(batch_run / "97_phase5_raw_counts_readiness_summary.json", summary)
    write_text(
        batch_run / "98_phase5_raw_counts_readiness_README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 raw counts readiness audit",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"candidate_count: {len(audit_rows)}",
                f"raw_counts_json_present_count: {len(audit_rows)}",
                f"raw_counts_populated_count: {populated_count}",
                "",
                "This audit initializes raw_counts.json templates and reports which candidates have runnable raw-count inputs.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(batch_run)
    write_json(batch_run / "00_manifest.json", manifest)

    print(f"BATCH_RUN={batch_run}")
    print(f"AUDIT_CSV={audit_csv}")
    print(f"SUMMARY={batch_run / '97_phase5_raw_counts_readiness_summary.json'}")
    print(f"README={batch_run / '98_phase5_raw_counts_readiness_README.txt'}")
    print(f"MANIFEST={batch_run / '00_manifest.json'}")
    print(f"SHA256={batch_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
