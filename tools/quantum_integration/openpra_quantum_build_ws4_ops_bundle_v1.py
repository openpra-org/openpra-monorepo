#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import shutil
import hashlib
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
FREEZE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_review_clean_freeze_v1"
CONTROL_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_validation_control_v1"
PACKAGE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_execution_package_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_ops_bundle_v1"


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


def copy_if_exists(src: Path, dst: Path) -> bool:
    if not src.exists():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


def main() -> None:
    freeze_dir = latest_dir(FREEZE_BASE, "OPENPRA_WS4_REVIEW_CLEAN_FREEZE_v1_*")
    control_dir = latest_dir(CONTROL_BASE, "OPENPRA_WS4_VALIDATION_CONTROL_v1_*")
    package_dir = latest_dir(PACKAGE_BASE, "OPENPRA_WS4_EXECUTION_PACKAGE_v1_*")

    cohort_csv = freeze_dir / "openpra_ws4_review_clean_cohort_v1.csv"
    holdout_csv = freeze_dir / "openpra_ws4_review_clean_holdouts_v1.csv"
    master_csv = package_dir / "openpra_ws4_master_execution_sheet_v1.csv"
    bucket_csv = package_dir / "openpra_ws4_bucket_batch_plan_v1.csv"
    gate_csv = package_dir / "openpra_ws4_root_gate_batch_plan_v1.csv"
    holdout_followup_csv = package_dir / "openpra_ws4_holdout_followup_batch_v1.csv"

    if not cohort_csv.exists():
        raise RuntimeError(f"Missing cohort CSV: {cohort_csv}")
    if not master_csv.exists():
        raise RuntimeError(f"Missing master execution sheet: {master_csv}")

    cohort_rows = load_csv_dicts(cohort_csv)
    holdout_rows = load_csv_dicts(holdout_csv) if holdout_csv.exists() else []
    master_rows = load_csv_dicts(master_csv)
    bucket_rows = load_csv_dicts(bucket_csv) if bucket_csv.exists() else []
    gate_rows = load_csv_dicts(gate_csv) if gate_csv.exists() else []
    holdout_followup_rows = load_csv_dicts(holdout_followup_csv) if holdout_followup_csv.exists() else []

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_OPS_BUNDLE_v1_{stamp}"
    inputs_dir = out_dir / "INPUTS"
    control_room_dir = out_dir / "CONTROL_ROOM"
    manifests_dir = out_dir / "MANIFESTS"
    for d in [inputs_dir, control_room_dir, manifests_dir]:
        d.mkdir(parents=True, exist_ok=True)

    copied_inputs = []
    for src in [
        cohort_csv,
        holdout_csv,
        freeze_dir / "openpra_ws4_review_clean_bucket_summary_v1.csv",
        freeze_dir / "openpra_ws4_review_clean_validation_run_register_v1.csv",
        freeze_dir / "openpra_ws4_review_clean_memo_v1.md",
        control_dir / "openpra_ws4_execution_matrix_v1.csv",
        control_dir / "openpra_ws4_bucket_execution_plan_v1.csv",
        control_dir / "openpra_ws4_root_gate_summary_v1.csv",
        control_dir / "openpra_ws4_holdout_followup_v1.csv",
        control_dir / "openpra_ws4_validation_control_memo_v1.md",
        package_dir / "openpra_ws4_master_execution_sheet_v1.csv",
        package_dir / "openpra_ws4_preparation_batch_v1.csv",
        package_dir / "openpra_ws4_statevector_batch_v1.csv",
        package_dir / "openpra_ws4_recovery_batch_v1.csv",
        package_dir / "openpra_ws4_bucket_batch_plan_v1.csv",
        package_dir / "openpra_ws4_root_gate_batch_plan_v1.csv",
        package_dir / "openpra_ws4_holdout_followup_batch_v1.csv",
        package_dir / "openpra_ws4_execution_package_memo_v1.md",
    ]:
        if copy_if_exists(src, inputs_dir / src.name):
            copied_inputs.append(inputs_dir / src.name)

    ops_master_csv = control_room_dir / "openpra_ws4_ops_master_sheet_v1.csv"
    ops_rows = []
    for row in master_rows:
        ops_rows.append(
            [
                row.get("selection_rank", "").strip(),
                row.get("case_id", "").strip(),
                row.get("phase2b_row_id", "").strip(),
                row.get("root_gate_id", "").strip(),
                row.get("topology_class", "").strip(),
                row.get("n_basic", "").strip(),
                row.get("selection_bucket", "").strip(),
                row.get("source_relative_path", "").strip(),
                row.get("preparation_input_status", "").strip() or "artifact_present",
                row.get("preparation_validation_status", "").strip() or "pending",
                row.get("statevector_validation_status", "").strip() or "pending",
                row.get("recovery_validation_status", "").strip() or "pending",
                "pending",
                "",
            ]
        )

    write_csv(
        ops_master_csv,
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
        ops_rows,
    )

    ops_holdout_csv = control_room_dir / "openpra_ws4_ops_holdouts_v1.csv"
    write_csv(
        ops_holdout_csv,
        [
            "phase2b_row_id",
            "root_gate_id",
            "topology_class",
            "n_basic",
            "selection_bucket",
            "source_relative_path",
            "holdout_reason",
            "followup_status",
            "notes",
        ],
        [
            [
                row.get("phase2b_row_id", "").strip(),
                row.get("root_gate_id", "").strip(),
                row.get("topology_class", "").strip(),
                row.get("n_basic", "").strip(),
                row.get("selection_bucket", "").strip(),
                row.get("source_relative_path", "").strip(),
                row.get("holdout_reason", "").strip(),
                row.get("followup_status", "").strip() or "pending_followup",
                row.get("notes", "").strip(),
            ]
            for row in holdout_followup_rows
        ],
    )

    ops_summary_csv = control_room_dir / "openpra_ws4_ops_summary_v1.csv"
    write_csv(
        ops_summary_csv,
        ["category", "key", "count_or_status"],
        [
            ["execution_baseline", "review_clean_case_count", str(len(cohort_rows))],
            ["holdouts", "holdout_case_count", str(len(holdout_rows))],
            *[
                ["bucket", row.get("selection_bucket", ""), row.get("case_count", "")]
                for row in bucket_rows
            ],
            *[
                ["root_gate", row.get("root_gate_id", ""), row.get("case_count", "")]
                for row in gate_rows
            ],
        ],
    )

    memo_md = control_room_dir / "openpra_ws4_ops_bundle_memo_v1.md"
    memo_lines = [
        "# OpenPRA WS4 Ops Bundle Memo v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source freeze: {freeze_dir.relative_to(REPO_ROOT).as_posix()}",
        f"Source validation control: {control_dir.relative_to(REPO_ROOT).as_posix()}",
        f"Source execution package: {package_dir.relative_to(REPO_ROOT).as_posix()}",
        "",
        f"Execution baseline case count: {len(cohort_rows)}",
        f"Holdout count: {len(holdout_rows)}",
        "",
        "Decision:",
        "Use this as the single WS4 operations folder.",
        "",
        "Control room files:",
        "- openpra_ws4_ops_master_sheet_v1.csv",
        "- openpra_ws4_ops_holdouts_v1.csv",
        "- openpra_ws4_ops_summary_v1.csv",
        "",
        "Inputs copied here are read only reference copies from the latest freeze, control, and execution package.",
    ]
    memo_md.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    bundle_json = control_room_dir / "openpra_ws4_ops_bundle_v1.json"
    write_json(
        bundle_json,
        {
            "artifact_name": "OPENPRA_WS4_OPS_BUNDLE_v1",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_freeze_dir": freeze_dir.relative_to(REPO_ROOT).as_posix(),
            "source_control_dir": control_dir.relative_to(REPO_ROOT).as_posix(),
            "source_package_dir": package_dir.relative_to(REPO_ROOT).as_posix(),
            "review_clean_case_count": len(cohort_rows),
            "holdout_case_count": len(holdout_rows),
            "copied_input_count": len(copied_inputs),
            "outputs": {
                "ops_master_csv": ops_master_csv.relative_to(REPO_ROOT).as_posix(),
                "ops_holdout_csv": ops_holdout_csv.relative_to(REPO_ROOT).as_posix(),
                "ops_summary_csv": ops_summary_csv.relative_to(REPO_ROOT).as_posix(),
                "memo_md": memo_md.relative_to(REPO_ROOT).as_posix(),
            },
        },
    )

    manifest_json = manifests_dir / "openpra_ws4_ops_bundle_manifest_v1.json"
    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_OPS_BUNDLE_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }

    manifest_files = [ops_master_csv, ops_holdout_csv, ops_summary_csv, memo_md, bundle_json]
    manifest_files.extend(copied_inputs)

    for p in manifest_files:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
        )

    write_json(manifest_json, manifest_payload)
    manifest_sha = manifests_dir / "openpra_ws4_ops_bundle_manifest_v1.json.sha256"
    manifest_sha.write_text(
        f"{sha256_file(manifest_json)}  {manifest_json.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(ops_master_csv))
    print(str(ops_holdout_csv))
    print(str(ops_summary_csv))
    print(str(memo_md))
    print(str(bundle_json))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"review_clean_case_count={len(cohort_rows)}")
    print(f"holdout_case_count={len(holdout_rows)}")
    print(f"copied_input_count={len(copied_inputs)}")


if __name__ == "__main__":
    main()
