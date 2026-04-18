#!/usr/bin/env python3
from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
OPS_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_ops_bundle_v1"


def find_latest_ops_dir() -> Path:
    candidates = sorted(OPS_BASE.glob("OPENPRA_WS4_OPS_BUNDLE_v1_*"))
    if not candidates:
        raise RuntimeError(f"No WS4 ops bundle found under {OPS_BASE}")
    return candidates[-1]


def load_csv_dicts(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def main() -> None:
    ops_dir = find_latest_ops_dir()
    control_room = ops_dir / "CONTROL_ROOM"
    inputs_dir = ops_dir / "INPUTS"

    master_csv = control_room / "openpra_ws4_ops_master_sheet_v1.csv"
    holdouts_csv = control_room / "openpra_ws4_ops_holdouts_v1.csv"
    summary_csv = control_room / "openpra_ws4_ops_summary_v1.csv"
    memo_md = control_room / "openpra_ws4_ops_bundle_memo_v1.md"

    prep_csv = inputs_dir / "openpra_ws4_preparation_batch_v1.csv"
    statevector_csv = inputs_dir / "openpra_ws4_statevector_batch_v1.csv"
    recovery_csv = inputs_dir / "openpra_ws4_recovery_batch_v1.csv"

    master_rows = load_csv_dicts(master_csv)
    holdout_rows = load_csv_dicts(holdouts_csv)

    prep_rows = []
    statevector_rows = []
    recovery_rows = []

    prep_done = 0
    state_done = 0
    recovery_done = 0
    overall_done = 0

    for row in master_rows:
        selection_rank = row.get("selection_rank", "").strip()
        case_id = row.get("case_id", "").strip()
        phase2b_row_id = row.get("phase2b_row_id", "").strip()
        source_relative_path = row.get("source_relative_path", "").strip()

        prep_status = row.get("preparation_validation_status", "").strip() or "pending"
        state_status = row.get("statevector_validation_status", "").strip() or "pending"
        recovery_status = row.get("recovery_validation_status", "").strip() or "pending"
        overall_status = row.get("overall_case_status", "").strip() or "pending"

        if prep_status == "done":
            prep_done += 1
        if state_status == "done":
            state_done += 1
        if recovery_status == "done":
            recovery_done += 1
        if overall_status == "done":
            overall_done += 1

        prep_rows.append(
            [
                selection_rank,
                case_id,
                phase2b_row_id,
                source_relative_path,
                "run_preparation_validation",
                prep_status,
                "",
            ]
        )
        statevector_rows.append(
            [
                selection_rank,
                case_id,
                phase2b_row_id,
                source_relative_path,
                "run_statevector_validation",
                state_status,
                "",
            ]
        )
        recovery_rows.append(
            [
                selection_rank,
                case_id,
                phase2b_row_id,
                source_relative_path,
                "run_recovery_validation",
                recovery_status,
                "",
            ]
        )

    write_csv(
        prep_csv,
        ["selection_rank", "case_id", "phase2b_row_id", "source_relative_path", "task", "status", "notes"],
        prep_rows,
    )
    write_csv(
        statevector_csv,
        ["selection_rank", "case_id", "phase2b_row_id", "source_relative_path", "task", "status", "notes"],
        statevector_rows,
    )
    write_csv(
        recovery_csv,
        ["selection_rank", "case_id", "phase2b_row_id", "source_relative_path", "task", "status", "notes"],
        recovery_rows,
    )

    summary_rows = [
        ["execution_baseline", "review_clean_case_count", str(len(master_rows))],
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
        "",
        f"Execution baseline case count: {len(master_rows)}",
        f"Holdout count: {len(holdout_rows)}",
        "",
        "Progress snapshot:",
        f"- preparation done: {prep_done}",
        f"- statevector done: {state_done}",
        f"- recovery done: {recovery_done}",
        f"- overall done: {overall_done}",
        "",
        "Decision:",
        "Use the control-room master sheet as the single status authority and refresh the derived views from it.",
    ]
    memo_md.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    print(str(ops_dir))
    print(str(prep_csv))
    print(str(statevector_csv))
    print(str(recovery_csv))
    print(str(summary_csv))
    print(str(memo_md))
    print(f"execution_baseline_case_count={len(master_rows)}")
    print(f"holdout_case_count={len(holdout_rows)}")
    print(f"overall_done={overall_done}")


if __name__ == "__main__":
    main()
