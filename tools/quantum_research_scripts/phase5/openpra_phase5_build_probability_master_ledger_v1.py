#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


SCRIPT_VERSION = "openpra-phase5-build-probability-master-ledger-v1"
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


def probability_template_value(batch_case_dir: Path, event_id: str) -> Optional[float]:
    path = batch_case_dir / "probabilities.json"
    if not path.exists():
        return None
    payload = load_json(path)
    probabilities = payload.get("probabilities", {})
    if not isinstance(probabilities, dict):
        return None
    value = probabilities.get(event_id)
    if isinstance(value, (int, float)):
        return float(value)
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a master probability ledger across the Phase 5 real candidate batch."
    )
    parser.add_argument(
        "--batch-run",
        dest="batch_run",
        default=None,
        help="Optional repo-relative or absolute Phase 5 candidate batch directory. Default: latest.",
    )
    return parser.parse_args()


def main() -> int:
    repo_root = Path.cwd().resolve()
    args = parse_args()
    batch_run = resolve_run(repo_root, args.batch_run, BATCH_ROOT)

    output_run = batch_run / "99_phase5_probability_master_ledger_v1"
    if output_run.exists():
        raise SystemExit(f"Output already exists: {output_run}")
    output_run.mkdir(parents=True, exist_ok=False)

    batch_case_dirs = sorted([path for path in batch_run.iterdir() if path.is_dir() and path.name[:4].isdigit()])
    if not batch_case_dirs:
        raise SystemExit(f"No batch case directories found in {batch_run}")

    event_to_candidates: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    candidate_rows: List[Dict[str, Any]] = []

    for batch_case_dir in batch_case_dirs:
        metadata = load_json(batch_case_dir / "package_metadata.json")
        ordered_basic_event_ids = extract_ordered_basic_event_ids(batch_case_dir)

        candidate_rows.append(
            {
                "batch_case_dir": str(batch_case_dir),
                "model_id": metadata["model_id"],
                "candidate_root_node_id": metadata["candidate_root_node_id"],
                "topology_class": metadata.get("topology_class"),
                "basic_event_count": metadata.get("basic_event_count"),
                "required_qubits": metadata.get("required_qubits"),
                "ordered_basic_event_ids": ordered_basic_event_ids,
            }
        )

        for ordinal, event_id in enumerate(ordered_basic_event_ids, start=1):
            current_value = probability_template_value(batch_case_dir, event_id)
            event_to_candidates[event_id].append(
                {
                    "batch_case_dir": str(batch_case_dir),
                    "model_id": metadata["model_id"],
                    "candidate_root_node_id": metadata["candidate_root_node_id"],
                    "topology_class": metadata.get("topology_class"),
                    "basic_event_count": metadata.get("basic_event_count"),
                    "required_qubits": metadata.get("required_qubits"),
                    "event_position_in_candidate": ordinal,
                    "current_probability_value": current_value,
                }
            )

    master_rows: List[Dict[str, Any]] = []
    for event_id in sorted(event_to_candidates.keys()):
        uses = event_to_candidates[event_id]
        populated_values = sorted(
            {row["current_probability_value"] for row in uses if row["current_probability_value"] is not None}
        )

        master_rows.append(
            {
                "basic_event_id": event_id,
                "use_count": len(uses),
                "candidate_count": len({row["model_id"] for row in uses}),
                "current_probability_value": populated_values[0] if len(populated_values) == 1 else None,
                "current_probability_value_count": len(populated_values),
                "candidate_model_ids": ";".join(sorted({row["model_id"] for row in uses})),
                "candidate_dirs": ";".join(sorted({row["batch_case_dir"] for row in uses})),
            }
        )

    master_csv = output_run / "phase5_probability_master_ledger.csv"
    with master_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "basic_event_id",
                "use_count",
                "candidate_count",
                "current_probability_value",
                "current_probability_value_count",
                "candidate_model_ids",
                "candidate_dirs",
            ],
        )
        writer.writeheader()
        for row in master_rows:
            writer.writerow(row)

    detailed_csv = output_run / "phase5_probability_event_usage_detail.csv"
    with detailed_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "basic_event_id",
                "batch_case_dir",
                "model_id",
                "candidate_root_node_id",
                "topology_class",
                "basic_event_count",
                "required_qubits",
                "event_position_in_candidate",
                "current_probability_value",
            ],
        )
        writer.writeheader()
        for event_id in sorted(event_to_candidates.keys()):
            for row in sorted(
                event_to_candidates[event_id],
                key=lambda item: (item["model_id"], item["event_position_in_candidate"]),
            ):
                writer.writerow(
                    {
                        "basic_event_id": event_id,
                        **row,
                    }
                )

    candidate_json = output_run / "phase5_candidate_event_sets.json"
    write_json(
        candidate_json,
        {
            "generated_at": utc_now_iso(),
            "script_version": SCRIPT_VERSION,
            "batch_run": str(batch_run),
            "candidates": candidate_rows,
        },
    )

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "counts": {
            "candidate_count": len(candidate_rows),
            "unique_basic_event_count": len(master_rows),
            "total_event_usages": sum(row["use_count"] for row in master_rows),
            "populated_unique_event_count": sum(
                1 for row in master_rows if row["current_probability_value"] is not None
            ),
        },
        "outputs": {
            "master_csv": str(master_csv),
            "detail_csv": str(detailed_csv),
            "candidate_json": str(candidate_json),
        },
    }

    write_json(output_run / "phase5_probability_master_ledger_summary.json", summary)
    write_text(
        output_run / "README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 probability master ledger v1",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"candidate_count: {summary['counts']['candidate_count']}",
                f"unique_basic_event_count: {summary['counts']['unique_basic_event_count']}",
                f"total_event_usages: {summary['counts']['total_event_usages']}",
                "",
                "This ledger consolidates every unique basic event ID across the current 20-candidate Phase 5 batch.",
                "Populate probabilities here once the authoritative source is identified, then fan those values back into candidate probabilities.json files.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / 'phase5_probability_master_ledger_summary.json'}")
    print(f"MASTER_CSV={master_csv}")
    print(f"DETAIL_CSV={detailed_csv}")
    print(f"CANDIDATE_JSON={candidate_json}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
