#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import hashlib
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
FREEZE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_review_clean_freeze_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_validation_control_v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_latest_freeze_dir() -> Path:
    candidates = sorted(FREEZE_BASE.glob("OPENPRA_WS4_REVIEW_CLEAN_FREEZE_v1_*"))
    if not candidates:
        raise RuntimeError(f"No review clean freeze directory found under {FREEZE_BASE}")
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
    freeze_dir = find_latest_freeze_dir()

    cohort_csv = freeze_dir / "openpra_ws4_review_clean_cohort_v1.csv"
    holdout_csv = freeze_dir / "openpra_ws4_review_clean_holdouts_v1.csv"
    bucket_csv = freeze_dir / "openpra_ws4_review_clean_bucket_summary_v1.csv"

    if not cohort_csv.exists():
        raise RuntimeError(f"Missing cohort CSV: {cohort_csv}")

    cohort_rows = load_csv_dicts(cohort_csv)
    holdout_rows = load_csv_dicts(holdout_csv) if holdout_csv.exists() else []
    bucket_rows = load_csv_dicts(bucket_csv) if bucket_csv.exists() else []

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_VALIDATION_CONTROL_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    control_json = out_dir / "openpra_ws4_validation_control_v1.json"
    execution_csv = out_dir / "openpra_ws4_execution_matrix_v1.csv"
    bucket_execution_csv = out_dir / "openpra_ws4_bucket_execution_plan_v1.csv"
    gate_summary_csv = out_dir / "openpra_ws4_root_gate_summary_v1.csv"
    holdout_review_csv = out_dir / "openpra_ws4_holdout_followup_v1.csv"
    memo_md = out_dir / "openpra_ws4_validation_control_memo_v1.md"
    manifest_json = out_dir / "openpra_ws4_validation_control_manifest_v1.json"
    manifest_sha = out_dir / "openpra_ws4_validation_control_manifest_v1.json.sha256"

    root_gate_counts: dict[str, int] = defaultdict(int)
    bucket_counts: dict[str, int] = defaultdict(int)

    execution_rows = []
    for row in cohort_rows:
        selection_rank = row.get("selection_rank", "").strip()
        case_id = row.get("case_id", "").strip()
        phase2b_row_id = row.get("phase2b_row_id", "").strip()
        root_gate_id = row.get("root_gate_id", "").strip()
        topology_class = row.get("topology_class", "").strip()
        n_basic = row.get("n_basic", "").strip()
        selection_bucket = row.get("selection_bucket", "").strip()
        source_relative_path = row.get("source_relative_path", "").strip()

        if root_gate_id:
            root_gate_counts[root_gate_id] += 1
        if selection_bucket:
            bucket_counts[selection_bucket] += 1

        execution_rows.append(
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

    write_csv(
        execution_csv,
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
        execution_rows,
    )

    bucket_plan_rows = []
    desired_buckets = [
        "A_n5", "A_n6", "A_n8",
        "B_n5", "B_n6", "B_n8",
        "C_n5", "C_n6", "C_n8",
        "D_n5", "D_n6", "D_n8",
    ]
    existing_bucket_map = {row.get("selection_bucket", ""): row.get("case_count", "") for row in bucket_rows}

    for bucket in desired_buckets:
        bucket_plan_rows.append(
            [
                bucket,
                existing_bucket_map.get(bucket, str(bucket_counts.get(bucket, 0))),
                "execute_available_cases" if bucket_counts.get(bucket, 0) > 0 else "gap_no_local_cases",
                "local_universe_constrained" if bucket_counts.get(bucket, 0) == 0 else "",
            ]
        )

    write_csv(
        bucket_execution_csv,
        ["selection_bucket", "case_count", "execution_decision", "notes"],
        bucket_plan_rows,
    )

    gate_rows = [
        [gate, count]
        for gate, count in sorted(root_gate_counts.items(), key=lambda item: (-item[1], item[0]))
    ]
    write_csv(
        gate_summary_csv,
        ["root_gate_id", "case_count"],
        gate_rows,
    )

    holdout_followup_rows = []
    for row in holdout_rows:
        holdout_followup_rows.append(
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
        holdout_review_csv,
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
        holdout_followup_rows,
    )

    control_payload = {
        "artifact_name": "OPENPRA_WS4_VALIDATION_CONTROL_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_freeze_dir": freeze_dir.relative_to(REPO_ROOT).as_posix(),
        "review_clean_case_count": len(cohort_rows),
        "holdout_case_count": len(holdout_rows),
        "bucket_counts": dict(bucket_counts),
        "root_gate_counts": dict(root_gate_counts),
        "outputs": {
            "execution_csv": execution_csv.relative_to(REPO_ROOT).as_posix(),
            "bucket_execution_csv": bucket_execution_csv.relative_to(REPO_ROOT).as_posix(),
            "gate_summary_csv": gate_summary_csv.relative_to(REPO_ROOT).as_posix(),
            "holdout_review_csv": holdout_review_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    write_json(control_json, control_payload)

    memo_lines = [
        "# OpenPRA WS4 Validation Control Memo v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source freeze: {freeze_dir.relative_to(REPO_ROOT).as_posix()}",
        f"Review clean cohort size: {len(cohort_rows)}",
        f"Holdout count: {len(holdout_rows)}",
        "",
        "Decision:",
        "Use the 34 case review clean freeze as the execution baseline for WS4 validation.",
        "",
        "Execution rule:",
        "Run preparation, statevector, and recovery validation for all available cohort rows.",
        "",
        "Bucket coverage:",
    ]
    for bucket in desired_buckets:
        count = bucket_counts.get(bucket, 0)
        if count > 0:
            memo_lines.append(f"- {bucket}: {count}")
    memo_lines.extend(
        [
            "",
            "Holdouts remain outside the execution baseline until separately resolved.",
        ]
    )
    memo_md.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_VALIDATION_CONTROL_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [control_json, execution_csv, bucket_execution_csv, gate_summary_csv, holdout_review_csv, memo_md]:
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
    print(str(control_json))
    print(str(execution_csv))
    print(str(bucket_execution_csv))
    print(str(gate_summary_csv))
    print(str(holdout_review_csv))
    print(str(memo_md))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"review_clean_case_count={len(cohort_rows)}")
    print(f"holdout_case_count={len(holdout_rows)}")


if __name__ == "__main__":
    main()
