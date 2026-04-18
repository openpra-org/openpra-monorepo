#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
BUNDLE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_manual_review_bundle_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_best_effort_selection_v1"

# Best effort cap for overrepresented buckets.
# We keep all scarce buckets and cap the dominant bucket so the validation set is more defensible.
BUCKET_CAPS = {
    "A_n5": 8,
    "C_n8": 7,
    "D_n8": 4,
}


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


def main() -> None:
    latest_bundle = find_latest_bundle()
    review_dir = latest_bundle / "REVIEW"

    universe_csv = review_dir / "openpra_ws4_unique_case_universe_v1.csv"
    if not universe_csv.exists():
        raise RuntimeError(f"Missing universe CSV: {universe_csv}")

    rows = load_csv_dicts(universe_csv)

    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row.get("selection_bucket", "").strip()].append(row)

    # Stable ordering inside each bucket
    for bucket in grouped:
        grouped[bucket].sort(
            key=lambda row: (
                int(row.get("variant_rank", "0") or "0") * -1,
                row.get("phase2b_row_id", ""),
                row.get("source_relative_path", ""),
            )
        )

    selected_rows: list[dict[str, str]] = []
    selection_notes: list[str] = []

    # Keep all available rows for scarce buckets, cap only the dominant bucket(s)
    for bucket in sorted(grouped.keys()):
        bucket_rows = grouped[bucket]
        cap = BUCKET_CAPS.get(bucket, len(bucket_rows))
        chosen = bucket_rows[:cap]
        selected_rows.extend(chosen)

        selection_notes.append(
            f"{bucket}: available={len(bucket_rows)}, selected={len(chosen)}, cap={cap}"
        )

    # Global sort for final selection file
    selected_rows.sort(
        key=lambda row: (
            row.get("topology_class", ""),
            int(row.get("n_basic", "0") or "0"),
            row.get("phase2b_row_id", ""),
        )
    )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_BEST_EFFORT_SELECTION_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    selection_csv = out_dir / "openpra_ws4_best_effort_selection_v1.csv"
    bucket_summary_csv = out_dir / "openpra_ws4_best_effort_bucket_summary_v1.csv"
    memo_md = out_dir / "openpra_ws4_best_effort_selection_memo_v1.md"
    summary_json = out_dir / "openpra_ws4_best_effort_selection_summary_v1.json"

    selection_header = [
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
    selection_rows = []
    for idx, row in enumerate(selected_rows, start=1):
        selection_rows.append(
            [
                idx,
                row.get("case_id", ""),
                row.get("phase2b_row_id", ""),
                row.get("subtree_id", ""),
                row.get("root_gate_id", ""),
                row.get("topology_class", ""),
                row.get("n_basic", ""),
                row.get("selection_bucket", ""),
                row.get("source_relative_path", ""),
                row.get("source_variant", ""),
                row.get("variant_rank", ""),
                row.get("has_existing_execution_data", "unknown"),
                "selected_best_effort",
                row.get("notes", ""),
            ]
        )
    write_csv(selection_csv, selection_header, selection_rows)

    bucket_summary_rows = []
    all_buckets = [
        "A_n5", "A_n6", "A_n8",
        "B_n5", "B_n6", "B_n8",
        "C_n5", "C_n6", "C_n8",
        "D_n5", "D_n6", "D_n8",
    ]
    selected_counts = defaultdict(int)
    available_counts = defaultdict(int)

    for bucket, bucket_rows in grouped.items():
        available_counts[bucket] = len(bucket_rows)
    for row in selected_rows:
        selected_counts[row.get("selection_bucket", "")] += 1

    for bucket in all_buckets:
        bucket_summary_rows.append(
            [
                bucket,
                available_counts.get(bucket, 0),
                BUCKET_CAPS.get(bucket, available_counts.get(bucket, 0)),
                selected_counts.get(bucket, 0),
            ]
        )
    write_csv(
        bucket_summary_csv,
        ["selection_bucket", "available_count", "selection_cap", "selected_count"],
        bucket_summary_rows,
    )

    memo_lines = [
        "# OpenPRA WS4 Best Effort Selection Memo v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source bundle: {latest_bundle.relative_to(REPO_ROOT).as_posix()}",
        f"Universe size: {len(rows)}",
        f"Best effort selected size: {len(selected_rows)}",
        "",
        "Interpretation:",
        "This is not a fully stratified 30 to 50 case cohort.",
        "It is a best effort balanced selection from the actually available local case universe.",
        "",
        "Why this exists:",
        "The repaired universe shows only three occupied buckets in the local preparation-artifact corpus:",
        "- A_n5",
        "- C_n8",
        "- D_n8",
        "",
        "Bucket selection notes:",
    ]
    memo_lines.extend([f"- {note}" for note in selection_notes])
    memo_lines.extend(
        [
            "",
            "Recommendation:",
            "Use this best effort selection for WS4 validation only if you also carry the explicit limitation that broader topology/size coverage was not available in the current local source universe.",
        ]
    )
    memo_md.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    summary_payload = {
        "artifact_name": "OPENPRA_WS4_BEST_EFFORT_SELECTION_SUMMARY_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "latest_bundle": latest_bundle.relative_to(REPO_ROOT).as_posix(),
        "universe_case_count": len(rows),
        "selected_case_count": len(selected_rows),
        "available_counts": dict(available_counts),
        "selected_counts": dict(selected_counts),
        "outputs": {
            "selection_csv": selection_csv.relative_to(REPO_ROOT).as_posix(),
            "bucket_summary_csv": bucket_summary_csv.relative_to(REPO_ROOT).as_posix(),
            "memo_md": memo_md.relative_to(REPO_ROOT).as_posix(),
        },
    }
    summary_json.write_text(json.dumps(summary_payload, indent=2), encoding="utf-8")

    print(str(out_dir))
    print(str(selection_csv))
    print(str(bucket_summary_csv))
    print(str(memo_md))
    print(str(summary_json))
    print(f"universe_case_count={len(rows)}")
    print(f"selected_case_count={len(selected_rows)}")


if __name__ == "__main__":
    main()
