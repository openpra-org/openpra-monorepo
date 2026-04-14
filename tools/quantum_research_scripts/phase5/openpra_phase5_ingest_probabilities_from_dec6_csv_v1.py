#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


SCRIPT_VERSION = "openpra-phase5-ingest-probabilities-from-dec6-csv-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"
LEDGER_DIR_NAME = "99_phase5_probability_master_ledger_v1"
DEFAULT_DEC6_CSV = (
    "/mnt/storage_array/projects/QPRA_DISSERTATION_v1/"
    "Paper11/WORK/DEC6_mef_basic_event_metadata_v1_20260307_224412Z/"
    "dec6_mef_basic_event_metadata_v1.csv"
)


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


def canonical_float_key(value: float) -> str:
    return format(value, ".15g")


def parse_probability_pair(row: List[str]) -> Tuple[float, float]:
    if len(row) < 7:
        raise ValueError(f"Row has fewer than 7 columns: {row}")

    sci_value = float(row[5].strip())
    dec_value = float(row[6].strip())

    if not math.isclose(sci_value, dec_value, rel_tol=1e-12, abs_tol=1e-15):
        raise ValueError(
            f"Scientific and decimal probability columns disagree: sci={sci_value}, dec={dec_value}, row={row}"
        )

    return sci_value, dec_value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Populate the Phase 5 master probability JSON from the DEC6 basic-event metadata CSV."
    )
    parser.add_argument("--batch-run", default=None)
    parser.add_argument("--ledger-run", default=None)
    parser.add_argument("--source-csv", default=DEFAULT_DEC6_CSV)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    batch_run = resolve_run(repo_root, args.batch_run, BATCH_ROOT)
    ledger_run = resolve_ledger_run(batch_run, args.ledger_run, repo_root)

    source_csv = Path(args.source_csv).resolve()
    if not source_csv.is_file():
        raise SystemExit(f"Source CSV does not exist: {source_csv}")

    master_json = ledger_run / "phase5_master_probability_values.json"
    if not master_json.exists():
        raise SystemExit(f"Missing master probability JSON: {master_json}")

    master_payload = load_json(master_json)
    master_probabilities = master_payload.get("probabilities", {})
    if not isinstance(master_probabilities, dict) or not master_probabilities:
        raise SystemExit(f"Invalid master probability JSON: {master_json}")

    target_event_ids = sorted(str(event_id) for event_id in master_probabilities.keys())

    observed: Dict[str, Dict[str, Any]] = {
        event_id: {
            "values_by_key": {},
            "rows": [],
        }
        for event_id in target_event_ids
    }

    with source_csv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for row_number, row in enumerate(reader, start=1):
            if not row:
                continue
            if len(row) < 7:
                continue

            basic_event_id = row[1].strip()
            if basic_event_id not in observed:
                continue

            try:
                sci_value, dec_value = parse_probability_pair(row)
            except ValueError as exc:
                raise SystemExit(f"Probability parse error at line {row_number}: {exc}")

            value_key = canonical_float_key(dec_value)
            if value_key not in observed[basic_event_id]["values_by_key"]:
                observed[basic_event_id]["values_by_key"][value_key] = {
                    "value": dec_value,
                    "rows": [],
                }

            observed[basic_event_id]["values_by_key"][value_key]["rows"].append(
                {
                    "row_number": row_number,
                    "subtree_id": row[0].strip(),
                    "basic_event_id": basic_event_id,
                    "short_id": row[2].strip() if len(row) > 2 else "",
                    "alias": row[3].strip() if len(row) > 3 else "",
                    "description": row[4].strip() if len(row) > 4 else "",
                    "scientific_value": sci_value,
                    "decimal_value": dec_value,
                    "xml_path": row[7].strip() if len(row) > 7 else "",
                    "xml_sha256": row[8].strip() if len(row) > 8 else "",
                    "subtree_fault_tree_path": row[9].strip() if len(row) > 9 else "",
                }
            )

    audit_rows: List[Dict[str, Any]] = []
    populated_count = 0
    conflict_count = 0
    missing_count = 0

    for event_id in target_event_ids:
        value_map = observed[event_id]["values_by_key"]
        value_keys = sorted(value_map.keys())

        if len(value_keys) == 0:
            missing_count += 1
            audit_rows.append(
                {
                    "basic_event_id": event_id,
                    "status": "missing_in_source_csv",
                    "selected_value": "",
                    "distinct_value_count": 0,
                    "supporting_row_count": 0,
                    "example_descriptions": "",
                    "example_subtree_ids": "",
                }
            )
            continue

        if len(value_keys) > 1:
            conflict_count += 1
            audit_rows.append(
                {
                    "basic_event_id": event_id,
                    "status": "conflicting_values",
                    "selected_value": "",
                    "distinct_value_count": len(value_keys),
                    "supporting_row_count": sum(len(value_map[key]["rows"]) for key in value_keys),
                    "example_descriptions": ";".join(
                        sorted(
                            {
                                row["description"]
                                for key in value_keys
                                for row in value_map[key]["rows"]
                                if row["description"]
                            }
                        )[:10]
                    ),
                    "example_subtree_ids": ";".join(
                        sorted(
                            {
                                row["subtree_id"]
                                for key in value_keys
                                for row in value_map[key]["rows"]
                                if row["subtree_id"]
                            }
                        )[:10]
                    ),
                }
            )
            continue

        selected_key = value_keys[0]
        selected_value = float(value_map[selected_key]["value"])
        master_probabilities[event_id] = selected_value
        populated_count += 1

        audit_rows.append(
            {
                "basic_event_id": event_id,
                "status": "populated",
                "selected_value": canonical_float_key(selected_value),
                "distinct_value_count": 1,
                "supporting_row_count": len(value_map[selected_key]["rows"]),
                "example_descriptions": ";".join(
                    sorted(
                        {
                            row["description"]
                            for row in value_map[selected_key]["rows"]
                            if row["description"]
                        }
                    )[:10]
                ),
                "example_subtree_ids": ";".join(
                    sorted(
                        {
                            row["subtree_id"]
                            for row in value_map[selected_key]["rows"]
                            if row["subtree_id"]
                        }
                    )[:10]
                ),
            }
        )

    master_payload["updated_at"] = utc_now_iso()
    master_payload["status"] = (
        "populated_from_dec6_csv"
        if populated_count == len(target_event_ids)
        else "partially_populated_from_dec6_csv"
    )
    master_payload["source_csv"] = str(source_csv)
    master_payload["script_version"] = SCRIPT_VERSION
    master_payload["probabilities"] = master_probabilities
    write_json(master_json, master_payload)

    detail_json = ledger_run / "phase5_probability_ingest_from_dec6_detail.json"
    write_json(
        detail_json,
        {
            "generated_at": utc_now_iso(),
            "script_version": SCRIPT_VERSION,
            "source_csv": str(source_csv),
            "observed": observed,
        },
    )

    audit_csv = ledger_run / "phase5_probability_ingest_from_dec6_audit.csv"
    with audit_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "basic_event_id",
                "status",
                "selected_value",
                "distinct_value_count",
                "supporting_row_count",
                "example_descriptions",
                "example_subtree_ids",
            ],
        )
        writer.writeheader()
        for row in audit_rows:
            writer.writerow(row)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "ledger_run": str(ledger_run),
        "source_csv": str(source_csv),
        "counts": {
            "target_event_count": len(target_event_ids),
            "populated_count": populated_count,
            "conflict_count": conflict_count,
            "missing_count": missing_count,
        },
        "next_action": {
            "statement": "After ingestion, rerun the master probability fanout script so all candidate probabilities.json files are updated.",
            "follow_on_script": "scripts/openpra_phase5_apply_master_probability_values_v1.py",
        },
    }

    write_json(ledger_run / "phase5_probability_ingest_from_dec6_summary.json", summary)
    write_text(
        ledger_run / "phase5_probability_ingest_from_dec6_README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 probability ingest from DEC6 CSV",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"target_event_count: {summary['counts']['target_event_count']}",
                f"populated_count: {summary['counts']['populated_count']}",
                f"conflict_count: {summary['counts']['conflict_count']}",
                f"missing_count: {summary['counts']['missing_count']}",
                "",
                "This step writes authoritative probability values into phase5_master_probability_values.json.",
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
    print(f"SOURCE_CSV={source_csv}")
    print(f"MASTER_JSON={master_json}")
    print(f"AUDIT_CSV={audit_csv}")
    print(f"SUMMARY={ledger_run / 'phase5_probability_ingest_from_dec6_summary.json'}")
    print(f"DETAIL_JSON={detail_json}")
    print(f"BATCH_MANIFEST={batch_run / '00_manifest.json'}")
    print(f"LEDGER_MANIFEST={ledger_run / '00_manifest.json'}")
    print(f"BATCH_SHA256={batch_run / 'SHA256SUMS.txt'}")
    print(f"LEDGER_SHA256={ledger_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
