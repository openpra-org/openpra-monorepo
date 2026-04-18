#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import hashlib
import shutil
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
OPS_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_ops_bundle_v1"
WORKSPACE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_execution_workspace_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_completion_freeze_v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def latest_dir(base: Path, pattern: str) -> Path:
    candidates = sorted(base.glob(pattern))
    if not candidates:
        raise RuntimeError(f"No matching directory under {base} for {pattern}")
    return candidates[-1]


def load_csv_dicts(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    ops_dir = latest_dir(OPS_BASE, "OPENPRA_WS4_OPS_BUNDLE_v1_*")
    workspace_dir = latest_dir(WORKSPACE_BASE, "OPENPRA_WS4_EXECUTION_WORKSPACE_v1_*")

    master_csv = ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_master_sheet_v1.csv"
    summary_csv = ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_summary_v1.csv"
    holdouts_csv = ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_holdouts_v1.csv"

    master_rows = load_csv_dicts(master_csv)
    summary_rows = load_csv_dicts(summary_csv)
    holdout_rows = load_csv_dicts(holdouts_csv) if holdouts_csv.exists() else []

    summary_map = {row["key"]: row["count_or_status"] for row in summary_rows}
    overall_done = int(summary_map.get("overall_done", "0"))
    baseline_count = int(summary_map.get("review_clean_case_count", "0"))
    holdout_count = int(summary_map.get("holdout_case_count", str(len(holdout_rows))))

    if overall_done != baseline_count:
        raise RuntimeError(
            f"WS4 baseline not complete: overall_done={overall_done}, baseline_count={baseline_count}"
        )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_COMPLETION_FREEZE_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    control_dir = out_dir / "CONTROL"
    copied_dir = out_dir / "COPIED_INPUTS"
    manifests_dir = out_dir / "MANIFESTS"
    control_dir.mkdir(parents=True, exist_ok=True)
    copied_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    files_to_copy = [
        master_csv,
        summary_csv,
        holdouts_csv,
        ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_bundle_memo_v1.md",
        workspace_dir / "openpra_ws4_execution_registry_v1.csv",
        workspace_dir / "openpra_ws4_holdout_registry_v1.csv",
        workspace_dir / "openpra_ws4_execution_workspace_summary_v1.json",
        workspace_dir / "openpra_ws4_execution_workspace_memo_v1.md",
    ]

    copied_files: list[Path] = []
    for src in files_to_copy:
        if src.exists():
            dst = copied_dir / src.name
            shutil.copy2(src, dst)
            copied_files.append(dst)

    complete_rows = []
    incomplete_rows = []
    for row in master_rows:
        overall_status = row.get("overall_case_status", "").strip().lower()
        out = [
            row.get("selection_rank", "").strip(),
            row.get("case_id", "").strip(),
            row.get("phase2b_row_id", "").strip(),
            row.get("root_gate_id", "").strip(),
            row.get("topology_class", "").strip(),
            row.get("n_basic", "").strip(),
            row.get("selection_bucket", "").strip(),
            row.get("preparation_validation_status", "").strip(),
            row.get("statevector_validation_status", "").strip(),
            row.get("recovery_validation_status", "").strip(),
            row.get("overall_case_status", "").strip(),
            row.get("source_relative_path", "").strip(),
        ]
        if overall_status == "done":
            complete_rows.append(out)
        else:
            incomplete_rows.append(out)

    completed_csv = control_dir / "openpra_ws4_completed_baseline_v1.csv"
    incomplete_csv = control_dir / "openpra_ws4_incomplete_baseline_v1.csv"
    holdout_export_csv = control_dir / "openpra_ws4_holdouts_v1.csv"

    header = [
        "selection_rank",
        "case_id",
        "phase2b_row_id",
        "root_gate_id",
        "topology_class",
        "n_basic",
        "selection_bucket",
        "preparation_validation_status",
        "statevector_validation_status",
        "recovery_validation_status",
        "overall_case_status",
        "source_relative_path",
    ]
    write_csv(completed_csv, header, complete_rows)
    write_csv(incomplete_csv, header, incomplete_rows)

    holdout_export_rows = []
    for row in holdout_rows:
        holdout_export_rows.append([
            row.get("phase2b_row_id", "").strip(),
            row.get("root_gate_id", "").strip(),
            row.get("topology_class", "").strip(),
            row.get("n_basic", "").strip(),
            row.get("selection_bucket", "").strip(),
            row.get("source_relative_path", "").strip(),
            row.get("holdout_reason", "").strip(),
            row.get("followup_status", "").strip(),
        ])
    write_csv(
        holdout_export_csv,
        [
            "phase2b_row_id",
            "root_gate_id",
            "topology_class",
            "n_basic",
            "selection_bucket",
            "source_relative_path",
            "holdout_reason",
            "followup_status",
        ],
        holdout_export_rows,
    )

    freeze_json = control_dir / "openpra_ws4_completion_freeze_v1.json"
    write_json(
        freeze_json,
        {
            "artifact_name": "OPENPRA_WS4_COMPLETION_FREEZE_v1",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_ops_dir": ops_dir.relative_to(REPO_ROOT).as_posix(),
            "source_workspace_dir": workspace_dir.relative_to(REPO_ROOT).as_posix(),
            "baseline_case_count": baseline_count,
            "overall_done": overall_done,
            "baseline_complete": overall_done == baseline_count,
            "holdout_count": holdout_count,
            "outputs": {
                "completed_csv": completed_csv.relative_to(REPO_ROOT).as_posix(),
                "incomplete_csv": incomplete_csv.relative_to(REPO_ROOT).as_posix(),
                "holdouts_csv": holdout_export_csv.relative_to(REPO_ROOT).as_posix(),
            },
        },
    )

    memo_md = control_dir / "openpra_ws4_completion_freeze_memo_v1.md"
    memo_md.write_text(
        "\n".join(
            [
                "# OpenPRA WS4 Completion Freeze v1",
                "",
                f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
                f"Source ops bundle: {ops_dir.relative_to(REPO_ROOT).as_posix()}",
                f"Source workspace: {workspace_dir.relative_to(REPO_ROOT).as_posix()}",
                "",
                f"Baseline cases complete: {overall_done} / {baseline_count}",
                f"Holdouts outside baseline: {holdout_count}",
                "",
                "Decision:",
                "WS4 review clean baseline is complete and frozen.",
                "",
                "Important note:",
                "Holdouts remain outside the completed baseline and should be handled separately.",
            ]
        ) + "\n",
        encoding="utf-8",
    )

    manifest_json = manifests_dir / "openpra_ws4_completion_freeze_manifest_v1.json"
    manifest_files = [completed_csv, incomplete_csv, holdout_export_csv, freeze_json, memo_md, *copied_files]
    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_COMPLETION_FREEZE_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for path in manifest_files:
        manifest_payload["files"].append(
            {
                "relative_path": path.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(path),
                "size_bytes": path.stat().st_size,
            }
        )
    write_json(manifest_json, manifest_payload)

    manifest_sha = manifests_dir / "openpra_ws4_completion_freeze_manifest_v1.json.sha256"
    manifest_sha.write_text(
        f"{sha256_file(manifest_json)}  {manifest_json.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(completed_csv))
    print(str(incomplete_csv))
    print(str(holdout_export_csv))
    print(str(freeze_json))
    print(str(memo_md))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"baseline_case_count={baseline_count}")
    print(f"overall_done={overall_done}")
    print(f"holdout_count={holdout_count}")


if __name__ == "__main__":
    main()
