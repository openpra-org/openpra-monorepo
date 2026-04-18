#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
OPS_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_ops_bundle_v1"
WORKSPACE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_execution_workspace_v1"


def latest_dir(base: Path, pattern: str) -> Path:
    candidates = sorted(base.glob(pattern))
    if not candidates:
        raise RuntimeError(f"No matching directory under {base} for {pattern}")
    return candidates[-1]


def load_csv_dicts(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_status(value: str) -> str:
    text = (value or "").strip().lower()
    if text in {"done", "passed", "complete", "completed", "success"}:
        return "done"
    if text in {"failed", "error"}:
        return "failed"
    if text in {"running", "in_progress", "started"}:
        return "in_progress"
    if text in {"skipped"}:
        return "skipped"
    return "pending"


def derive_overall(prep: str, state: str, recovery: str, explicit: str) -> str:
    explicit_norm = normalize_status(explicit)
    if explicit_norm != "pending":
        return explicit_norm

    statuses = [prep, state, recovery]
    if all(s in {"done", "skipped"} for s in statuses):
        return "done"
    if any(s == "failed" for s in statuses):
        return "failed"
    if any(s in {"done", "in_progress", "skipped"} for s in statuses):
        return "in_progress"
    return "pending"


def main() -> None:
    ops_dir = latest_dir(OPS_BASE, "OPENPRA_WS4_OPS_BUNDLE_v1_*")
    workspace_dir = latest_dir(WORKSPACE_BASE, "OPENPRA_WS4_EXECUTION_WORKSPACE_v1_*")

    master_csv = ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_master_sheet_v1.csv"
    holdouts_csv = ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_holdouts_v1.csv"
    summary_csv = ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_summary_v1.csv"
    memo_md = ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_bundle_memo_v1.md"
    registry_csv = workspace_dir / "openpra_ws4_execution_registry_v1.csv"

    if not master_csv.exists():
        raise RuntimeError(f"Missing ops master sheet: {master_csv}")
    if not registry_csv.exists():
        raise RuntimeError(f"Missing execution registry: {registry_csv}")

    master_rows = load_csv_dicts(master_csv)
    holdout_rows = load_csv_dicts(holdouts_csv) if holdouts_csv.exists() else []
    registry_rows = load_csv_dicts(registry_csv)

    registry_map = {
        row.get("phase2b_row_id", "").strip(): row
        for row in registry_rows
        if row.get("phase2b_row_id", "").strip()
    }

    updated_rows = []
    prep_done = 0
    state_done = 0
    recovery_done = 0
    overall_done = 0

    for row in master_rows:
        phase2b_row_id = row.get("phase2b_row_id", "").strip()
        registry_row = registry_map.get(phase2b_row_id)

        prep_status = normalize_status(row.get("preparation_validation_status", "pending"))
        state_status = normalize_status(row.get("statevector_validation_status", "pending"))
        recovery_status = normalize_status(row.get("recovery_validation_status", "pending"))
        overall_status = normalize_status(row.get("overall_case_status", "pending"))
        notes = row.get("notes", "").strip()

        if registry_row:
            case_dir = REPO_ROOT / registry_row["workspace_case_dir"]
            result_json = case_dir / "case_result_v1.json"
            if result_json.exists():
                result = load_json(result_json)
                prep_status = normalize_status(result.get("preparation_validation_status", prep_status))
                state_status = normalize_status(result.get("statevector_validation_status", state_status))
                recovery_status = normalize_status(result.get("recovery_validation_status", recovery_status))
                overall_status = derive_overall(
                    prep_status,
                    state_status,
                    recovery_status,
                    result.get("overall_case_status", overall_status),
                )
                if isinstance(result.get("notes"), str) and result.get("notes", "").strip():
                    notes = result["notes"].strip()

        if prep_status == "done":
            prep_done += 1
        if state_status == "done":
            state_done += 1
        if recovery_status == "done":
            recovery_done += 1
        if overall_status == "done":
            overall_done += 1

        updated_rows.append(
            [
                row.get("selection_rank", "").strip(),
                row.get("case_id", "").strip(),
                phase2b_row_id,
                row.get("root_gate_id", "").strip(),
                row.get("topology_class", "").strip(),
                row.get("n_basic", "").strip(),
                row.get("selection_bucket", "").strip(),
                row.get("source_relative_path", "").strip(),
                row.get("preparation_input_status", "artifact_present").strip() or "artifact_present",
                prep_status,
                state_status,
                recovery_status,
                overall_status,
                notes,
            ]
        )

    write_csv(
        master_csv,
        [
            "selection_rank",
            "case_id",
            "phase2b_row_id",
            "root_gate_id",
            "topology_class",
            "n_basic",
            "selection_bucket",
            "source_relative_path",
            "preparation_input_status",
            "preparation_validation_status",
            "statevector_validation_status",
            "recovery_validation_status",
            "overall_case_status",
            "notes",
        ],
        updated_rows,
    )

    summary_rows = [
        ["execution_baseline", "review_clean_case_count", str(len(updated_rows))],
        ["holdouts", "holdout_case_count", str(len(holdout_rows))],
        ["progress", "preparation_done", str(prep_done)],
        ["progress", "statevector_done", str(state_done)],
        ["progress", "recovery_done", str(recovery_done)],
        ["progress", "overall_done", str(overall_done)],
    ]
    write_csv(summary_csv, ["category", "key", "count_or_status"], summary_rows)

    memo_lines = [
        "# OpenPRA WS4 Ops Bundle Memo v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Ops bundle: {ops_dir.relative_to(REPO_ROOT).as_posix()}",
        f"Workspace: {workspace_dir.relative_to(REPO_ROOT).as_posix()}",
        "",
        f"Execution baseline case count: {len(updated_rows)}",
        f"Holdout count: {len(holdout_rows)}",
        "",
        "Progress snapshot:",
        f"- preparation done: {prep_done}",
        f"- statevector done: {state_done}",
        f"- recovery done: {recovery_done}",
        f"- overall done: {overall_done}",
        "",
        "Decision:",
        "Use workspace case_result_v1.json files as the source for ops master status refresh.",
    ]
    memo_md.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    print(str(ops_dir))
    print(str(workspace_dir))
    print(str(master_csv))
    print(str(summary_csv))
    print(str(memo_md))
    print(f"execution_baseline_case_count={len(updated_rows)}")
    print(f"holdout_case_count={len(holdout_rows)}")
    print(f"overall_done={overall_done}")


if __name__ == "__main__":
    main()
