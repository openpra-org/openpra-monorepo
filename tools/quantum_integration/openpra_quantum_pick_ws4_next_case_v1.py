#!/usr/bin/env python3
from __future__ import annotations

import csv
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


def status_rank(value: str) -> int:
    text = (value or "").strip().lower()
    if text == "pending":
        return 0
    if text == "in_progress":
        return 1
    if text == "failed":
        return 2
    if text == "done":
        return 3
    if text == "skipped":
        return 4
    return 9


def main() -> None:
    ops_dir = latest_dir(OPS_BASE, "OPENPRA_WS4_OPS_BUNDLE_v1_*")
    workspace_dir = latest_dir(WORKSPACE_BASE, "OPENPRA_WS4_EXECUTION_WORKSPACE_v1_*")

    master_csv = ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_master_sheet_v1.csv"
    registry_csv = workspace_dir / "openpra_ws4_execution_registry_v1.csv"

    master_rows = load_csv_dicts(master_csv)
    registry_rows = load_csv_dicts(registry_csv)

    registry_map = {
        row.get("phase2b_row_id", "").strip(): row
        for row in registry_rows
        if row.get("phase2b_row_id", "").strip()
    }

    candidates = []
    for row in master_rows:
        prep = (row.get("preparation_validation_status", "") or "pending").strip().lower()
        state = (row.get("statevector_validation_status", "") or "pending").strip().lower()
        recovery = (row.get("recovery_validation_status", "") or "pending").strip().lower()
        overall = (row.get("overall_case_status", "") or "pending").strip().lower()

        if overall == "done":
            continue

        next_step = ""
        if prep in {"pending", "failed"}:
            next_step = "preparation"
        elif state in {"pending", "failed"}:
            next_step = "statevector"
        elif recovery in {"pending", "failed"}:
            next_step = "recovery"
        else:
            next_step = "review"

        phase2b_row_id = row.get("phase2b_row_id", "").strip()
        registry_row = registry_map.get(phase2b_row_id, {})
        workspace_case_dir = registry_row.get("workspace_case_dir", "")

        candidates.append(
            {
                "selection_rank": int(row.get("selection_rank", "999999") or "999999"),
                "case_id": row.get("case_id", "").strip(),
                "phase2b_row_id": phase2b_row_id,
                "root_gate_id": row.get("root_gate_id", "").strip(),
                "selection_bucket": row.get("selection_bucket", "").strip(),
                "preparation_status": prep,
                "statevector_status": state,
                "recovery_status": recovery,
                "overall_status": overall,
                "next_step": next_step,
                "source_relative_path": row.get("source_relative_path", "").strip(),
                "workspace_case_dir": workspace_case_dir,
            }
        )

    if not candidates:
        print("No pending WS4 cases found.")
        return

    candidates.sort(
        key=lambda r: (
            status_rank(r["overall_status"]),
            {"preparation": 0, "statevector": 1, "recovery": 2, "review": 3}.get(r["next_step"], 9),
            r["selection_rank"],
        )
    )

    chosen = candidates[0]

    print(f"selection_rank={chosen['selection_rank']}")
    print(f"case_id={chosen['case_id']}")
    print(f"phase2b_row_id={chosen['phase2b_row_id']}")
    print(f"root_gate_id={chosen['root_gate_id']}")
    print(f"selection_bucket={chosen['selection_bucket']}")
    print(f"next_step={chosen['next_step']}")
    print(f"preparation_status={chosen['preparation_status']}")
    print(f"statevector_status={chosen['statevector_status']}")
    print(f"recovery_status={chosen['recovery_status']}")
    print(f"overall_status={chosen['overall_status']}")
    print(f"source_relative_path={chosen['source_relative_path']}")
    print(f"workspace_case_dir={chosen['workspace_case_dir']}")


if __name__ == "__main__":
    main()
