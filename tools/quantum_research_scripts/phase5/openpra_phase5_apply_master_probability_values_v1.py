#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


SCRIPT_VERSION = "openpra-phase5-apply-master-probability-values-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"
LEDGER_DIR_NAME = "99_phase5_probability_master_ledger_v1"


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


def resolve_ledger_run(batch_run: Path, explicit_ledger_run: Optional[str], repo_root: Path) -> Path:
    if explicit_ledger_run:
        candidate = Path(explicit_ledger_run)
        ledger_run = candidate if candidate.is_absolute() else (repo_root / candidate)
        ledger_run = ledger_run.resolve()
        if not ledger_run.is_dir():
            raise SystemExit(f"Ledger run does not exist: {ledger_run}")
        return ledger_run

    ledger_run = (batch_run / LEDGER_DIR_NAME).resolve()
    if not ledger_run.is_dir():
        raise SystemExit(f"Default ledger directory does not exist: {ledger_run}")
    return ledger_run


def build_master_probability_template(master_csv: Path) -> Dict[str, Any]:
    probabilities: Dict[str, Optional[float]] = {}

    with master_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            event_id = str(row["basic_event_id"]).strip()
            if event_id:
                probabilities[event_id] = None

    return {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "status": "template_not_populated",
        "probabilities": probabilities,
        "notes": [
            "Populate each basic event ID with its authoritative probability once identified.",
            "This master file is the single source for probability fan-out into candidate probabilities.json files.",
            "Use numeric JSON values only.",
        ],
    }


def load_or_create_master_values(ledger_run: Path) -> Path:
    master_csv = ledger_run / "phase5_probability_master_ledger.csv"
    if not master_csv.exists():
        raise SystemExit(f"Missing master CSV: {master_csv}")

    master_values_json = ledger_run / "phase5_master_probability_values.json"
    if not master_values_json.exists():
        write_json(master_values_json, build_master_probability_template(master_csv))

    return master_values_json


def numeric_or_none(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def count_populated_master_values(master_payload: Dict[str, Any]) -> int:
    probabilities = master_payload.get("probabilities", {})
    if not isinstance(probabilities, dict):
        return 0
    return sum(1 for value in probabilities.values() if isinstance(value, (int, float)))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Apply master probability values into the Phase 5 candidate probabilities.json files."
    )
    parser.add_argument(
        "--batch-run",
        dest="batch_run",
        default=None,
        help="Optional repo-relative or absolute Phase 5 candidate batch directory. Default: latest.",
    )
    parser.add_argument(
        "--ledger-run",
        dest="ledger_run",
        default=None,
        help="Optional repo-relative or absolute ledger directory. Default: batch-run/99_phase5_probability_master_ledger_v1.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    batch_run = resolve_run(repo_root, args.batch_run, BATCH_ROOT)
    ledger_run = resolve_ledger_run(batch_run, args.ledger_run, repo_root)

    master_values_json = load_or_create_master_values(ledger_run)
    master_payload = load_json(master_values_json)
    master_probabilities = master_payload.get("probabilities", {})
    if not isinstance(master_probabilities, dict):
        raise SystemExit(f"Invalid master probability JSON: {master_values_json}")

    batch_case_dirs = sorted([path for path in batch_run.iterdir() if path.is_dir() and path.name[:4].isdigit()])
    if not batch_case_dirs:
        raise SystemExit(f"No batch case directories found in {batch_run}")

    audit_rows: List[Dict[str, Any]] = []
    candidate_populated_count = 0

    for batch_case_dir in batch_case_dirs:
        probabilities_path = batch_case_dir / "probabilities.json"
        if not probabilities_path.exists():
            raise SystemExit(f"Missing candidate probabilities.json: {probabilities_path}")

        payload = load_json(probabilities_path)
        probabilities = payload.get("probabilities", {})
        if not isinstance(probabilities, dict):
            raise SystemExit(f"Invalid candidate probabilities payload: {probabilities_path}")

        applied_count = 0
        missing_master_event_ids: List[str] = []
        unfilled_event_ids: List[str] = []

        for event_id in sorted(probabilities.keys()):
            if event_id not in master_probabilities:
                missing_master_event_ids.append(event_id)
                continue

            master_value = numeric_or_none(master_probabilities[event_id])
            if master_value is not None:
                if probabilities.get(event_id) != master_value:
                    probabilities[event_id] = master_value
                applied_count += 1
            else:
                probabilities[event_id] = None
                unfilled_event_ids.append(event_id)

        candidate_populated = len(unfilled_event_ids) == 0 and len(missing_master_event_ids) == 0
        payload["updated_at"] = utc_now_iso()
        payload["master_probability_values_json"] = str(master_values_json.resolve())
        payload["status"] = "populated_from_master" if candidate_populated else "template_not_populated"
        payload["probabilities"] = probabilities

        write_json(probabilities_path, payload)

        metadata = load_json(batch_case_dir / "package_metadata.json")
        if candidate_populated:
            candidate_populated_count += 1

        audit_rows.append(
            {
                "batch_case_dir": str(batch_case_dir),
                "model_id": metadata["model_id"],
                "candidate_root_node_id": metadata["candidate_root_node_id"],
                "topology_class": metadata.get("topology_class"),
                "basic_event_count": metadata.get("basic_event_count"),
                "required_qubits": metadata.get("required_qubits"),
                "applied_count": applied_count,
                "missing_master_event_count": len(missing_master_event_ids),
                "unfilled_event_count": len(unfilled_event_ids),
                "candidate_populated": candidate_populated,
                "missing_master_event_ids": ";".join(missing_master_event_ids),
                "unfilled_event_ids": ";".join(unfilled_event_ids),
            }
        )

    populated_master_value_count = count_populated_master_values(master_payload)
    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "ledger_run": str(ledger_run),
        "master_probability_values_json": str(master_values_json),
        "counts": {
            "candidate_count": len(audit_rows),
            "master_event_count": len(master_probabilities),
            "populated_master_value_count": populated_master_value_count,
            "candidate_populated_count": candidate_populated_count,
        },
        "candidates": audit_rows,
        "next_action": {
            "statement": "Populate phase5_master_probability_values.json with authoritative numbers, rerun this script, then rerun the Phase 5 ready-batch harness.",
            "blocking_item": "authoritative_probability_values",
        },
    }

    audit_csv = ledger_run / "phase5_probability_fanout_audit.csv"
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
                "applied_count",
                "missing_master_event_count",
                "unfilled_event_count",
                "candidate_populated",
                "missing_master_event_ids",
                "unfilled_event_ids",
            ],
        )
        writer.writeheader()
        for row in audit_rows:
            writer.writerow(row)

    write_json(ledger_run / "phase5_probability_fanout_summary.json", summary)
    write_text(
        ledger_run / "phase5_probability_fanout_README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 probability fan-out",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"master_event_count: {summary['counts']['master_event_count']}",
                f"populated_master_value_count: {summary['counts']['populated_master_value_count']}",
                f"candidate_populated_count: {summary['counts']['candidate_populated_count']}",
                "",
                "Populate the master probability JSON once, then rerun this script to push values into all candidate probabilities.json files.",
                "",
            ]
        ) + "\n",
    )

    batch_manifest = write_manifest(batch_run)
    write_json(batch_run / "00_manifest.json", batch_manifest)

    ledger_manifest = write_manifest(ledger_run)
    write_json(ledger_run / "00_manifest.json", ledger_manifest)

    print(f"BATCH_RUN={batch_run}")
    print(f"LEDGER_RUN={ledger_run}")
    print(f"MASTER_VALUES_JSON={master_values_json}")
    print(f"AUDIT_CSV={audit_csv}")
    print(f"SUMMARY={ledger_run / 'phase5_probability_fanout_summary.json'}")
    print(f"README={ledger_run / 'phase5_probability_fanout_README.txt'}")
    print(f"BATCH_MANIFEST={batch_run / '00_manifest.json'}")
    print(f"LEDGER_MANIFEST={ledger_run / '00_manifest.json'}")
    print(f"BATCH_SHA256={batch_run / 'SHA256SUMS.txt'}")
    print(f"LEDGER_SHA256={ledger_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
