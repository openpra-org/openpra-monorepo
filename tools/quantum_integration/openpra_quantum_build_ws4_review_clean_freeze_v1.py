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
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_review_clean_freeze_v1"

HOLD_OUT_PHASE2B = {
    "phase2b_row_0274",
    "phase2b_row_4228",
    "phase2b_row_9683",
}


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
    latest_bundle = find_latest_bundle()
    review_dir = latest_bundle / "REVIEW"

    universe_csv = review_dir / "openpra_ws4_unique_case_universe_v1.csv"
    if not universe_csv.exists():
        raise RuntimeError(f"Missing universe CSV: {universe_csv}")

    base_rows = load_csv_dicts(universe_csv)

    cleaned_rows = []
    held_out_rows = []

    for row in base_rows:
        phase2b = row.get("phase2b_row_id", "").strip()
        if phase2b in HOLD_OUT_PHASE2B:
            held_out_rows.append(row)
            continue

        clean_row = dict(row)
        clean_row["selection_status"] = "selected_all_available_review_clean"
        clean_row["has_existing_execution_data"] = clean_row.get("has_existing_execution_data", "unknown").strip() or "unknown"
        cleaned_rows.append(clean_row)

    cleaned_rows.sort(
        key=lambda row: (
            row.get("topology_class", ""),
            int(row.get("n_basic", "0") or "0"),
            row.get("phase2b_row_id", ""),
        )
    )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_REVIEW_CLEAN_FREEZE_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    cohort_csv = out_dir / "openpra_ws4_review_clean_cohort_v1.csv"
    bucket_csv = out_dir / "openpra_ws4_review_clean_bucket_summary_v1.csv"
    holdout_csv = out_dir / "openpra_ws4_review_clean_holdouts_v1.csv"
    run_register_csv = out_dir / "openpra_ws4_review_clean_validation_run_register_v1.csv"
    memo_md = out_dir / "openpra_ws4_review_clean_memo_v1.md"
    summary_json = out_dir / "openpra_ws4_review_clean_summary_v1.json"
    manifest_json = out_dir / "openpra_ws4_review_clean_manifest_v1.json"
    manifest_sha = out_dir / "openpra_ws4_review_clean_manifest_v1.json.sha256"

    cohort_header = [
        "selection_rank",
        "case_id",
        "phase2b_row_id",
        "subtree_id",
        "root_gate_id",
        "topology_class",
        "n_basic",
        "selection_bucket",
        "source_relative_path",
        "source_variant",
        "variant_rank",
        "has_existing_execution_data",
        "selection_status",
        "notes",
    ]

    cohort_rows = []
    bucket_counts: dict[str, int] = defaultdict(int)

    for idx, row in enumerate(cleaned_rows, start=1):
        bucket = row.get("selection_bucket", "").strip()
        if bucket:
            bucket_counts[bucket] += 1

        cohort_rows.append(
            [
                idx,
                row.get("case_id", "").strip(),
                row.get("phase2b_row_id", "").strip(),
                row.get("subtree_id", "").strip(),
                row.get("root_gate_id", "").strip(),
                row.get("topology_class", "").strip(),
                row.get("n_basic", "").strip(),
                bucket,
                row.get("source_relative_path", "").strip(),
                row.get("source_variant", "").strip(),
                row.get("variant_rank", "").strip(),
                row.get("has_existing_execution_data", "unknown"),
                row.get("selection_status", "selected_all_available_review_clean"),
                row.get("notes", "").strip(),
            ]
        )

    write_csv(cohort_csv, cohort_header, cohort_rows)

    desired_buckets = [
        "A_n5", "A_n6", "A_n8",
        "B_n5", "B_n6", "B_n8",
        "C_n5", "C_n6", "C_n8",
        "D_n5", "D_n6", "D_n8",
    ]
    bucket_rows = [[bucket, str(bucket_counts.get(bucket, 0))] for bucket in desired_buckets]
    write_csv(bucket_csv, ["selection_bucket", "case_count"], bucket_rows)

    holdout_rows = sorted(
        held_out_rows,
        key=lambda row: row.get("phase2b_row_id", "")
    )
    write_csv(
        holdout_csv,
        [
            "phase2b_row_id",
            "root_gate_id",
            "topology_class",
            "n_basic",
            "selection_bucket",
            "source_relative_path",
            "holdout_reason",
        ],
        [
            [
                row.get("phase2b_row_id", "").strip(),
                row.get("root_gate_id", "").strip(),
                row.get("topology_class", "").strip(),
                row.get("n_basic", "").strip(),
                row.get("selection_bucket", "").strip(),
                row.get("source_relative_path", "").strip(),
                "root_gate_or_classification_not_clean_enough_for_freeze",
            ]
            for row in holdout_rows
        ],
    )

    run_register_rows = []
    for row in cohort_rows:
        run_register_rows.append(
            [
                row[0],
                row[1],
                row[2],
                row[4],
                row[5],
                row[6],
                row[7],
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

    memo_lines = [
        "# OpenPRA WS4 Review Clean Freeze v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source bundle: {latest_bundle.relative_to(REPO_ROOT).as_posix()}",
        f"Review clean cohort size: {len(cohort_rows)}",
        "",
        "Decision:",
        "Use the repaired 34 case universe as the review clean freeze baseline.",
        "",
        "Why 0274 and 4228 are not admitted here:",
        "- both still had blank root_gate_id in the attempted v2 freeze",
        "- 4228 also showed mixed gate path evidence in the expansion review",
        "",
        "Held out for later adjudication:",
        "- phase2b_row_0274",
        "- phase2b_row_4228",
        "- phase2b_row_9683",
        "",
        "Current occupied buckets:",
    ]
    for bucket in desired_buckets:
        count = bucket_counts.get(bucket, 0)
        if count > 0:
            memo_lines.append(f"- {bucket}: {count}")
    memo_lines.extend(
        [
            "",
            "Important limitation:",
            "This remains an all available local-universe cohort and not a fully stratified broader cohort.",
        ]
    )
    memo_md.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    summary_payload = {
        "artifact_name": "OPENPRA_WS4_REVIEW_CLEAN_SUMMARY_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_bundle": latest_bundle.relative_to(REPO_ROOT).as_posix(),
        "review_clean_case_count": len(cohort_rows),
        "held_out_case_count": len(holdout_rows),
        "bucket_counts": dict(bucket_counts),
        "outputs": {
            "cohort_csv": cohort_csv.relative_to(REPO_ROOT).as_posix(),
            "bucket_csv": bucket_csv.relative_to(REPO_ROOT).as_posix(),
            "holdout_csv": holdout_csv.relative_to(REPO_ROOT).as_posix(),
            "run_register_csv": run_register_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    write_json(summary_json, summary_payload)

    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_REVIEW_CLEAN_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [cohort_csv, bucket_csv, holdout_csv, run_register_csv, memo_md, summary_json]:
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
    print(str(cohort_csv))
    print(str(bucket_csv))
    print(str(holdout_csv))
    print(str(run_register_csv))
    print(str(memo_md))
    print(str(summary_json))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"review_clean_case_count={len(cohort_rows)}")
    print(f"held_out_case_count={len(holdout_rows)}")


if __name__ == "__main__":
    main()
