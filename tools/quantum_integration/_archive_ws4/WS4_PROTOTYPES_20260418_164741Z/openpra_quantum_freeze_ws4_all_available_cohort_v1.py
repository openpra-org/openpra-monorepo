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
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_all_available_cohort_v1"


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
    coverage_csv = review_dir / "openpra_ws4_available_coverage_summary_v1.csv"

    if not universe_csv.exists():
        raise RuntimeError(f"Missing universe CSV: {universe_csv}")
    if not coverage_csv.exists():
        raise RuntimeError(f"Missing coverage CSV: {coverage_csv}")

    universe_rows = load_csv_dicts(universe_csv)
    coverage_rows = load_csv_dicts(coverage_csv)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_ALL_AVAILABLE_COHORT_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    cohort_csv = out_dir / "openpra_ws4_all_available_cohort_v1.csv"
    bucket_csv = out_dir / "openpra_ws4_all_available_bucket_summary_v1.csv"
    memo_md = out_dir / "openpra_ws4_all_available_cohort_memo_v1.md"
    run_register_csv = out_dir / "openpra_ws4_all_available_validation_run_register_v1.csv"
    summary_json = out_dir / "openpra_ws4_all_available_cohort_summary_v1.json"
    manifest_json = out_dir / "openpra_ws4_all_available_cohort_manifest_v1.json"
    manifest_sha = out_dir / "openpra_ws4_all_available_cohort_manifest_v1.json.sha256"

    normalized_rows: list[list[str]] = []
    bucket_counts: dict[str, int] = defaultdict(int)

    for idx, row in enumerate(universe_rows, start=1):
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
                selection_bucket,
                row.get("source_relative_path", "").strip(),
                row.get("source_variant", "").strip(),
                row.get("variant_rank", "").strip(),
                row.get("has_existing_execution_data", "unknown").strip() or "unknown",
                "selected_all_available",
                row.get("notes", "").strip(),
            ]
        )

    write_csv(
        cohort_csv,
        [
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
        ],
        normalized_rows,
    )

    bucket_summary_rows = []
    desired_buckets = [
        "A_n5", "A_n6", "A_n8",
        "B_n5", "B_n6", "B_n8",
        "C_n5", "C_n6", "C_n8",
        "D_n5", "D_n6", "D_n8",
    ]
    for bucket in desired_buckets:
        bucket_summary_rows.append([bucket, str(bucket_counts.get(bucket, 0))])

    write_csv(
        bucket_csv,
        ["selection_bucket", "case_count"],
        bucket_summary_rows,
    )

    memo_lines = [
        "# OpenPRA WS4 All Available Cohort Memo v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source bundle: {latest_bundle.relative_to(REPO_ROOT).as_posix()}",
        f"All available cohort size: {len(normalized_rows)}",
        "",
        "Decision:",
        "Use all unique cases from the repaired WS4 available-universe inventory.",
        "",
        "Why this is the chosen approach:",
        "1. the available universe already falls inside the nominal 30 to 50 total-case target",
        "2. capping A_n5 introduced unnecessary selection arbitrariness",
        "3. keeping all available cases is more internally consistent with the discovered local source universe",
        "",
        "Important limitation:",
        "This is not a fully stratified broader cohort.",
        "It is an all available local-universe cohort constrained by the cases actually present in the local preparation-artifact corpus.",
        "",
        "Observed occupied buckets:",
    ]
    for bucket in desired_buckets:
        count = bucket_counts.get(bucket, 0)
        if count > 0:
            memo_lines.append(f"- {bucket}: {count}")
    memo_lines.extend(
        [
            "",
            "Unoccupied buckets remain absent in the current local universe:",
            "- A_n6, A_n8",
            "- B_n5, B_n6, B_n8",
            "- C_n5, C_n6",
            "- D_n5, D_n6",
            "",
            "Recommendation:",
            "Proceed with validation on this 34-case all available cohort while explicitly carrying the coverage limitation in all WS4 reporting.",
        ]
    )
    memo_md.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

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
                row[7],   # selection_bucket
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
        "artifact_name": "OPENPRA_WS4_ALL_AVAILABLE_COHORT_SUMMARY_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_bundle": latest_bundle.relative_to(REPO_ROOT).as_posix(),
        "all_available_case_count": len(normalized_rows),
        "bucket_counts": dict(bucket_counts),
        "source_files": {
            "universe_csv": universe_csv.relative_to(REPO_ROOT).as_posix(),
            "coverage_csv": coverage_csv.relative_to(REPO_ROOT).as_posix(),
        },
        "outputs": {
            "cohort_csv": cohort_csv.relative_to(REPO_ROOT).as_posix(),
            "bucket_csv": bucket_csv.relative_to(REPO_ROOT).as_posix(),
            "memo_md": memo_md.relative_to(REPO_ROOT).as_posix(),
            "run_register_csv": run_register_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    write_json(summary_json, summary_payload)

    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_ALL_AVAILABLE_COHORT_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [cohort_csv, bucket_csv, memo_md, run_register_csv, summary_json]:
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
    print(str(memo_md))
    print(str(run_register_csv))
    print(str(summary_json))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"all_available_case_count={len(normalized_rows)}")


if __name__ == "__main__":
    main()
