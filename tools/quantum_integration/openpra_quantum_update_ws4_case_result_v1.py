#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
WORKSPACE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_execution_workspace_v1"

ALLOWED_STATUSES = {
    "pending",
    "in_progress",
    "done",
    "failed",
    "skipped",
}


def latest_dir(base: Path, pattern: str) -> Path:
    candidates = sorted(base.glob(pattern))
    if not candidates:
        raise RuntimeError(f"No matching directory under {base} for {pattern}")
    return candidates[-1]


def load_csv_dicts(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def append_run_log(path: Path, rows: list[list[str]]) -> None:
    with path.open("a", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(rows)


def normalize_status(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip().lower()
    if text not in ALLOWED_STATUSES:
        raise ValueError(f"Invalid status '{value}'. Allowed: {sorted(ALLOWED_STATUSES)}")
    return text


def derive_overall(prep: str, state: str, recovery: str, explicit: str | None) -> str:
    if explicit is not None:
        return explicit
    statuses = [prep, state, recovery]
    if any(s == "failed" for s in statuses):
        return "failed"
    if all(s in {"done", "skipped"} for s in statuses):
        return "done"
    if any(s in {"in_progress", "done", "skipped"} for s in statuses):
        return "in_progress"
    return "pending"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--selection-rank", help="Selection rank from execution registry")
    parser.add_argument("--phase2b-row-id", help="Phase2b row id")
    parser.add_argument("--preparation-status", help="pending|in_progress|done|failed|skipped")
    parser.add_argument("--statevector-status", help="pending|in_progress|done|failed|skipped")
    parser.add_argument("--recovery-status", help="pending|in_progress|done|failed|skipped")
    parser.add_argument("--overall-status", help="pending|in_progress|done|failed|skipped")
    parser.add_argument("--notes", help="Free text notes to store in case_result_v1.json")
    args = parser.parse_args()

    if not args.selection_rank and not args.phase2b_row_id:
        raise RuntimeError("Provide --selection-rank or --phase2b-row-id")

    prep_update = normalize_status(args.preparation_status)
    state_update = normalize_status(args.statevector_status)
    recovery_update = normalize_status(args.recovery_status)
    overall_update = normalize_status(args.overall_status)

    workspace_dir = latest_dir(WORKSPACE_BASE, "OPENPRA_WS4_EXECUTION_WORKSPACE_v1_*")
    registry_csv = workspace_dir / "openpra_ws4_execution_registry_v1.csv"
    if not registry_csv.exists():
        raise RuntimeError(f"Missing execution registry: {registry_csv}")

    registry_rows = load_csv_dicts(registry_csv)

    match = None
    for row in registry_rows:
        if args.selection_rank and row.get("selection_rank", "").strip() == args.selection_rank.strip():
            match = row
            break
        if args.phase2b_row_id and row.get("phase2b_row_id", "").strip() == args.phase2b_row_id.strip():
            match = row
            break

    if match is None:
        raise RuntimeError("No matching case found in execution registry")

    case_dir = REPO_ROOT / match["workspace_case_dir"]
    result_json = case_dir / "case_result_v1.json"
    run_log_csv = case_dir / "run_log_v1.csv"

    if not result_json.exists():
        raise RuntimeError(f"Missing case result JSON: {result_json}")
    if not run_log_csv.exists():
        raise RuntimeError(f"Missing run log CSV: {run_log_csv}")

    payload = load_json(result_json)

    old_prep = str(payload.get("preparation_validation_status", "pending")).strip().lower()
    old_state = str(payload.get("statevector_validation_status", "pending")).strip().lower()
    old_recovery = str(payload.get("recovery_validation_status", "pending")).strip().lower()
    old_overall = str(payload.get("overall_case_status", "pending")).strip().lower()

    new_prep = prep_update if prep_update is not None else old_prep
    new_state = state_update if state_update is not None else old_state
    new_recovery = recovery_update if recovery_update is not None else old_recovery
    new_overall = derive_overall(new_prep, new_state, new_recovery, overall_update)

    payload["preparation_validation_status"] = new_prep
    payload["statevector_validation_status"] = new_state
    payload["recovery_validation_status"] = new_recovery
    payload["overall_case_status"] = new_overall
    payload["last_updated_utc"] = datetime.now(timezone.utc).isoformat()

    if args.notes is not None:
        payload["notes"] = args.notes

    write_json(result_json, payload)

    timestamp = datetime.now(timezone.utc).isoformat()
    log_rows = []
    if old_prep != new_prep:
        log_rows.append([timestamp, "preparation_validation_status", new_prep, "updated_by_result_updater"])
    if old_state != new_state:
        log_rows.append([timestamp, "statevector_validation_status", new_state, "updated_by_result_updater"])
    if old_recovery != new_recovery:
        log_rows.append([timestamp, "recovery_validation_status", new_recovery, "updated_by_result_updater"])
    if old_overall != new_overall:
        log_rows.append([timestamp, "overall_case_status", new_overall, "updated_by_result_updater"])
    if args.notes is not None:
        log_rows.append([timestamp, "notes", args.notes, "updated_by_result_updater"])

    if log_rows:
        append_run_log(run_log_csv, log_rows)

    print(str(workspace_dir))
    print(str(case_dir))
    print(str(result_json))
    print(str(run_log_csv))
    print(f"selection_rank={match.get('selection_rank','')}")
    print(f"phase2b_row_id={match.get('phase2b_row_id','')}")
    print(f"preparation_validation_status={new_prep}")
    print(f"statevector_validation_status={new_state}")
    print(f"recovery_validation_status={new_recovery}")
    print(f"overall_case_status={new_overall}")


if __name__ == "__main__":
    main()
