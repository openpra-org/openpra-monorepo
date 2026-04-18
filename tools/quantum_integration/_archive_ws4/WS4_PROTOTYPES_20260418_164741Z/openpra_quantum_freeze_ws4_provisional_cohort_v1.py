#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import hashlib
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
BUNDLE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_manual_review_bundle_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_provisional_cohort_v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_latest_bundle() -> Path:
    candidates = sorted(BUNDLE_BASE.glob("OPENPRA_WS4_MANUAL_REVIEW_BUNDLE_v1_*"))
    if not candidates:
        raise RuntimeError(f"No manual review bundle found under {BUNDLE_BASE}")
    return candidates[-1]


def load_rows(path: Path) -> list[dict[str, str]]:
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
    latest_bundle = find_latest_bundle()
    review_dir = latest_bundle / "REVIEW"

    working_csv = review_dir / "openpra_ws4_cohort_selection_manifest_working_v1.csv"
    if not working_csv.exists():
        raise RuntimeError(f"Missing working cohort CSV: {working_csv}")

    missing_bucket_summary_csv = review_dir / "openpra_ws4_missing_bucket_summary_v2.csv"
    rows = load_rows(working_csv)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_PROVISIONAL_COHORT_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    cohort_csv = out_dir / "openpra_ws4_provisional_cohort_v1.csv"
    bucket_csv = out_dir / "openpra_ws4_provisional_bucket_summary_v1.csv"
    gap_md = out_dir / "openpra_ws4_provisional_gap_memo_v1.md"
    run_register_csv = out_dir / "openpra_ws4_provisional_validation_run_register_v1.csv"
    summary_json = out_dir / "openpra_ws4_provisional_cohort_summary_v1.json"
    manifest_json = out_dir / "openpra_ws4_provisional_cohort_manifest_v1.json"
    manifest_sha = out_dir / "openpra_ws4_provisional_cohort_manifest_v1.json.sha256"

    header = [
        "selection_rank",
        "case_id",
        "phase2b_row_id",
        "subtree_id",
        "root_gate_id",
        "topology_class",
        "n_basic",
        "source_relative_path",
        "has_existing_execution_data",
        "selection_bucket",
        "selection_rationale",
        "preparation_status",
        "statevector_status",
        "recovery_mode",
        "recovery_status",
        "notes",
    ]

    normalized_rows: list[list[str]] = []
    bucket_counts: dict[str, int] = defaultdict(int)

    for idx, row in enumerate(rows, start=1):
        selection_bucket = row.get("selection_bucket", "").strip()
        if selection_bucket:
            bucket_counts[selection_bucket] += 1

        normalized_rows.append(
            [
                str(idx),
                row.get("case_id", "").strip(),
                row.get("phase2b_row_id", "").strip(),
                row.get("subtree_id", "").strip(),
                row.get("root_gate_id", "").strip(),
                row.get("topology_class", "").strip(),
                row.get("n_basic", "").strip(),
                row.get("source_relative_path", "").strip(),
                row.get("has_existing_execution_data", "unknown").strip() or "unknown",
                selection_bucket,
                row.get("selection_rationale", "").strip(),
                row.get("preparation_status", "").strip() or "artifact_present",
                row.get("statevector_status", "").strip(),
                row.get("recovery_mode", "").strip(),
                row.get("recovery_status", "").strip(),
                row.get("notes", "").strip(),
            ]
        )

    write_csv(cohort_csv, header, normalized_rows)

    bucket_rows = []
    desired_buckets = [
        "A_n5", "A_n6", "A_n8",
        "B_n5", "B_n6", "B_n8",
        "C_n5", "C_n6", "C_n8",
        "D_n5", "D_n6", "D_n8",
    ]
    for bucket in desired_buckets:
        bucket_rows.append([bucket, str(bucket_counts.get(bucket, 0))])

    write_csv(
        bucket_csv,
        ["selection_bucket", "case_count"],
        bucket_rows,
    )

    missing_bucket_text = []
    if missing_bucket_summary_csv.exists():
        missing_rows = load_rows(missing_bucket_summary_csv)
        for row in missing_rows:
            needed = int(row.get("needed_count", "0") or "0")
            current = int(row.get("current_count", "0") or "0")
            if needed > 0:
                missing_bucket_text.append(
                    f"- {row['bucket']}: current={current}, target={row.get('target_count','')}, still missing={needed}"
                )

    gap_lines = [
        "# OpenPRA WS4 Provisional Gap Memo v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source bundle: {latest_bundle.relative_to(REPO_ROOT).as_posix()}",
        f"Provisional cohort size: {len(normalized_rows)}",
        "",
        "Reason for provisional freeze:",
        "The current automated search exhausted the local preparation-artifact universe without filling all desired topology/size buckets.",
        "",
        "Current covered buckets:",
    ]
    for bucket in desired_buckets:
        count = bucket_counts.get(bucket, 0)
        if count > 0:
            gap_lines.append(f"- {bucket}: {count}")
    gap_lines.extend(
        [
            "",
            "Remaining bucket gaps:",
        ]
    )
    gap_lines.extend(missing_bucket_text if missing_bucket_text else ["- None recorded."])
    gap_lines.extend(
        [
            "",
            "Recommended next action:",
            "Run preparation, statevector, and recovery validation on this provisional 19-case cohort while separately documenting missing bucket coverage.",
        ]
    )
    gap_md.write_text("\n".join(gap_lines) + "\n", encoding="utf-8")

    run_register_rows = []
    for row in normalized_rows:
        run_register_rows.append(
            [
                row[0],   # selection_rank
                row[1],   # case_id
                row[2],   # phase2b_row_id
                row[4],   # root_gate_id
                row[5],   # topology_class
                row[6],   # n_basic
                row[9],   # selection_bucket
                "pending",
                "pending",
                "pending",
                "",
            ]
        )

    write_csv(
        run_register_csv,
        [
            "selection_rank",
            "case_id",
            "phase2b_row_id",
            "root_gate_id",
            "topology_class",
            "n_basic",
            "selection_bucket",
            "preparation_run_status",
            "statevector_run_status",
            "recovery_run_status",
            "notes",
        ],
        run_register_rows,
    )

    summary_payload = {
        "artifact_name": "OPENPRA_WS4_PROVISIONAL_COHORT_SUMMARY_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_bundle": latest_bundle.relative_to(REPO_ROOT).as_posix(),
        "provisional_case_count": len(normalized_rows),
        "bucket_counts": dict(bucket_counts),
        "outputs": {
            "cohort_csv": cohort_csv.relative_to(REPO_ROOT).as_posix(),
            "bucket_csv": bucket_csv.relative_to(REPO_ROOT).as_posix(),
            "gap_memo": gap_md.relative_to(REPO_ROOT).as_posix(),
            "run_register_csv": run_register_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    write_json(summary_json, summary_payload)

    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_PROVISIONAL_COHORT_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [cohort_csv, bucket_csv, gap_md, run_register_csv, summary_json]:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
        )
    write_json(manifest_json, manifest_payload)
    manifest_sha.write_text(
        f"{sha256_file(manifest_json)}  {manifest_json.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(cohort_csv))
    print(str(bucket_csv))
    print(str(gap_md))
    print(str(run_register_csv))
    print(str(summary_json))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"provisional_case_count={len(normalized_rows)}")


if __name__ == "__main__":
    main()
