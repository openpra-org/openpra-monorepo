#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import hashlib
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
CONTROL_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_validation_control_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_execution_package_v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_latest_control_dir() -> Path:
    candidates = sorted(CONTROL_BASE.glob("OPENPRA_WS4_VALIDATION_CONTROL_v1_*"))
    if not candidates:
        raise RuntimeError(f"No WS4 validation control directory found under {CONTROL_BASE}")
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
    control_dir = find_latest_control_dir()

    execution_csv = control_dir / "openpra_ws4_execution_matrix_v1.csv"
    bucket_csv = control_dir / "openpra_ws4_bucket_execution_plan_v1.csv"
    gate_csv = control_dir / "openpra_ws4_root_gate_summary_v1.csv"
    holdout_csv = control_dir / "openpra_ws4_holdout_followup_v1.csv"
    control_json = control_dir / "openpra_ws4_validation_control_v1.json"

    if not execution_csv.exists():
        raise RuntimeError(f"Missing execution matrix: {execution_csv}")

    execution_rows = load_csv_dicts(execution_csv)
    bucket_rows = load_csv_dicts(bucket_csv) if bucket_csv.exists() else []
    gate_rows = load_csv_dicts(gate_csv) if gate_csv.exists() else []
    holdout_rows = load_csv_dicts(holdout_csv) if holdout_csv.exists() else []
    control_payload = json.loads(control_json.read_text(encoding="utf-8")) if control_json.exists() else {}

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_EXECUTION_PACKAGE_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    package_json = out_dir / "openpra_ws4_execution_package_v1.json"
    master_csv = out_dir / "openpra_ws4_master_execution_sheet_v1.csv"
    prep_csv = out_dir / "openpra_ws4_preparation_batch_v1.csv"
    statevector_csv = out_dir / "openpra_ws4_statevector_batch_v1.csv"
    recovery_csv = out_dir / "openpra_ws4_recovery_batch_v1.csv"
    bucket_batch_csv = out_dir / "openpra_ws4_bucket_batch_plan_v1.csv"
    gate_batch_csv = out_dir / "openpra_ws4_root_gate_batch_plan_v1.csv"
    holdout_batch_csv = out_dir / "openpra_ws4_holdout_followup_batch_v1.csv"
    memo_md = out_dir / "openpra_ws4_execution_package_memo_v1.md"
    manifest_json = out_dir / "openpra_ws4_execution_package_manifest_v1.json"
    manifest_sha = out_dir / "openpra_ws4_execution_package_manifest_v1.json.sha256"

    master_rows = []
    prep_rows = []
    statevector_rows = []
    recovery_rows = []

    bucket_to_cases: dict[str, list[str]] = defaultdict(list)
    gate_to_cases: dict[str, list[str]] = defaultdict(list)

    for row in execution_rows:
        selection_rank = row.get("selection_rank", "").strip()
        case_id = row.get("case_id", "").strip()
        phase2b_row_id = row.get("phase2b_row_id", "").strip()
        root_gate_id = row.get("root_gate_id", "").strip()
        topology_class = row.get("topology_class", "").strip()
        n_basic = row.get("n_basic", "").strip()
        selection_bucket = row.get("selection_bucket", "").strip()
        source_relative_path = row.get("source_relative_path", "").strip()

        if selection_bucket:
            bucket_to_cases[selection_bucket].append(case_id)
        if root_gate_id:
            gate_to_cases[root_gate_id].append(case_id)

        master_rows.append(
            [
                selection_rank,
                case_id,
                phase2b_row_id,
                root_gate_id,
                topology_class,
                n_basic,
                selection_bucket,
                source_relative_path,
                "artifact_present",
                "pending",
                "pending",
                "pending",
                "",
            ]
        )

        prep_rows.append(
            [
                selection_rank,
                case_id,
                phase2b_row_id,
                source_relative_path,
                "run_preparation_validation",
                "pending",
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
                "pending",
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
                "pending",
                "",
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
            "notes",
        ],
        master_rows,
    )

    write_csv(
        prep_csv,
        [
            "selection_rank",
            "case_id",
            "phase2b_row_id",
            "source_relative_path",
            "task",
            "status",
            "notes",
        ],
        prep_rows,
    )

    write_csv(
        statevector_csv,
        [
            "selection_rank",
            "case_id",
            "phase2b_row_id",
            "source_relative_path",
            "task",
            "status",
            "notes",
        ],
        statevector_rows,
    )

    write_csv(
        recovery_csv,
        [
            "selection_rank",
            "case_id",
            "phase2b_row_id",
            "source_relative_path",
            "task",
            "status",
            "notes",
        ],
        recovery_rows,
    )

    bucket_batch_rows = []
    bucket_count_lookup = {row.get("selection_bucket", ""): row.get("case_count", "") for row in bucket_rows}
    for bucket in [
        "A_n5", "A_n6", "A_n8",
        "B_n5", "B_n6", "B_n8",
        "C_n5", "C_n6", "C_n8",
        "D_n5", "D_n6", "D_n8",
    ]:
        case_list = bucket_to_cases.get(bucket, [])
        bucket_batch_rows.append(
            [
                bucket,
                bucket_count_lookup.get(bucket, str(len(case_list))),
                ";".join(case_list),
                "execute_available_cases" if case_list else "gap_no_local_cases",
                "",
            ]
        )
    write_csv(
        bucket_batch_csv,
        ["selection_bucket", "case_count", "case_ids", "decision", "notes"],
        bucket_batch_rows,
    )

    gate_batch_rows = []
    for row in gate_rows:
        gate = row.get("root_gate_id", "").strip()
        count = row.get("case_count", "").strip()
        gate_batch_rows.append(
            [
                gate,
                count,
                ";".join(gate_to_cases.get(gate, [])),
                "execute_gate_group",
                "",
            ]
        )
    write_csv(
        gate_batch_csv,
        ["root_gate_id", "case_count", "case_ids", "decision", "notes"],
        gate_batch_rows,
    )

    holdout_batch_rows = []
    for row in holdout_rows:
        holdout_batch_rows.append(
            [
                row.get("phase2b_row_id", "").strip(),
                row.get("root_gate_id", "").strip(),
                row.get("topology_class", "").strip(),
                row.get("n_basic", "").strip(),
                row.get("selection_bucket", "").strip(),
                row.get("source_relative_path", "").strip(),
                row.get("holdout_reason", "").strip(),
                "pending_followup",
                "",
            ]
        )
    write_csv(
        holdout_batch_csv,
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
        holdout_batch_rows,
    )

    package_payload = {
        "artifact_name": "OPENPRA_WS4_EXECUTION_PACKAGE_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_control_dir": control_dir.relative_to(REPO_ROOT).as_posix(),
        "review_clean_case_count": len(execution_rows),
        "holdout_case_count": len(holdout_rows),
        "bucket_counts": control_payload.get("bucket_counts", {}),
        "root_gate_counts": control_payload.get("root_gate_counts", {}),
        "outputs": {
            "master_csv": master_csv.relative_to(REPO_ROOT).as_posix(),
            "prep_csv": prep_csv.relative_to(REPO_ROOT).as_posix(),
            "statevector_csv": statevector_csv.relative_to(REPO_ROOT).as_posix(),
            "recovery_csv": recovery_csv.relative_to(REPO_ROOT).as_posix(),
            "bucket_batch_csv": bucket_batch_csv.relative_to(REPO_ROOT).as_posix(),
            "gate_batch_csv": gate_batch_csv.relative_to(REPO_ROOT).as_posix(),
            "holdout_batch_csv": holdout_batch_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    write_json(package_json, package_payload)

    memo_lines = [
        "# OpenPRA WS4 Execution Package Memo v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source validation control: {control_dir.relative_to(REPO_ROOT).as_posix()}",
        f"Execution baseline case count: {len(execution_rows)}",
        f"Holdout count: {len(holdout_rows)}",
        "",
        "Decision:",
        "Use this package as the single execution workbook for WS4.",
        "",
        "Contained task sheets:",
        "- master execution sheet",
        "- preparation batch",
        "- statevector batch",
        "- recovery batch",
        "- bucket batch plan",
        "- root gate batch plan",
        "- holdout followup batch",
    ]
    memo_md.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_EXECUTION_PACKAGE_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [package_json, master_csv, prep_csv, statevector_csv, recovery_csv, bucket_batch_csv, gate_batch_csv, holdout_batch_csv, memo_md]:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
        )
    write_json(manifest_json, manifest_payload)
    manifest_sha.write_text(f"{sha256_file(manifest_json)}  {manifest_json.name}\n", encoding="utf-8")

    print(str(out_dir))
    print(str(package_json))
    print(str(master_csv))
    print(str(prep_csv))
    print(str(statevector_csv))
    print(str(recovery_csv))
    print(str(bucket_batch_csv))
    print(str(gate_batch_csv))
    print(str(holdout_batch_csv))
    print(str(memo_md))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"review_clean_case_count={len(execution_rows)}")
    print(f"holdout_case_count={len(holdout_rows)}")


if __name__ == "__main__":
    main()
