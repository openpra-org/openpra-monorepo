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
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_finalized_universe_v2"

ADJUDICATIONS = [
    {
        "phase2b_row_id": "phase2b_row_0274",
        "decision": "accept",
        "topology_class": "D",
        "n_basic": "8",
        "selection_bucket": "D_n8",
        "root_gate_id": "",
        "source_relative_path": "_work/openpra_phase5_select_unique_phase4_bundle_cases_v2/20260414_023339Z/selected_phase4_bundle_cases/0002_0004_phase2b_row_0274/0004_primary_candidate_export.json",
        "source_variant": "0004_primary_candidate_export.json",
        "variant_rank": "0",
        "adjudication_notes": "accepted from expansion evidence; D_n8 supported by primary candidate export",
    },
    {
        "phase2b_row_id": "phase2b_row_4228",
        "decision": "accept",
        "topology_class": "D",
        "n_basic": "8",
        "selection_bucket": "D_n8",
        "root_gate_id": "",
        "source_relative_path": "_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z/0002_phase2b_row_4228/runtime_source_primary_candidate_export.json",
        "source_variant": "runtime_source_primary_candidate_export.json",
        "variant_rank": "0",
        "adjudication_notes": "accepted from expansion evidence; D_n8 corroborated by package_metadata, probabilities, source_export, and runtime_source_primary_candidate_export",
    },
    {
        "phase2b_row_id": "phase2b_row_9683",
        "decision": "hold_out",
        "topology_class": "",
        "n_basic": "",
        "selection_bucket": "",
        "root_gate_id": "",
        "source_relative_path": "",
        "source_variant": "",
        "variant_rank": "",
        "adjudication_notes": "held out due to conflicting D_n8, unclassified_n8, and unclassified_n2 evidence",
    },
]


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
    by_phase2b = {
        row["phase2b_row_id"].strip(): row
        for row in base_rows
        if row.get("phase2b_row_id", "").strip()
    }

    adjudication_rows = []
    accepted_additions = []

    for decision in ADJUDICATIONS:
        phase2b = decision["phase2b_row_id"]
        adjudication_rows.append(
            [
                phase2b,
                decision["decision"],
                decision["topology_class"],
                decision["n_basic"],
                decision["selection_bucket"],
                decision["source_relative_path"],
                decision["adjudication_notes"],
            ]
        )

        if decision["decision"] != "accept":
            continue
        if phase2b in by_phase2b:
            continue

        accepted_additions.append(
            {
                "case_id": phase2b,
                "phase2b_row_id": phase2b,
                "subtree_id": "",
                "root_gate_id": decision["root_gate_id"],
                "topology_class": decision["topology_class"],
                "n_basic": decision["n_basic"],
                "selection_bucket": decision["selection_bucket"],
                "source_relative_path": decision["source_relative_path"],
                "source_variant": decision["source_variant"],
                "variant_rank": decision["variant_rank"],
                "has_existing_execution_data": "unknown",
                "selection_status": "selected_all_available_v2",
                "notes": decision["adjudication_notes"],
            }
        )

    final_rows = list(base_rows) + accepted_additions
    final_rows.sort(
        key=lambda row: (
            row.get("topology_class", ""),
            int(row.get("n_basic", "0") or "0"),
            row.get("phase2b_row_id", ""),
        )
    )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_FINALIZED_UNIVERSE_v2_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    cohort_csv = out_dir / "openpra_ws4_all_available_cohort_v2.csv"
    bucket_csv = out_dir / "openpra_ws4_all_available_bucket_summary_v2.csv"
    run_register_csv = out_dir / "openpra_ws4_all_available_validation_run_register_v2.csv"
    adjudication_csv = out_dir / "openpra_ws4_novel_case_adjudication_v1.csv"
    memo_md = out_dir / "openpra_ws4_all_available_cohort_memo_v2.md"
    summary_json = out_dir / "openpra_ws4_all_available_cohort_summary_v2.json"
    manifest_json = out_dir / "openpra_ws4_all_available_cohort_manifest_v2.json"
    manifest_sha = out_dir / "openpra_ws4_all_available_cohort_manifest_v2.json.sha256"

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
    cohort_out = []
    bucket_counts: dict[str, int] = defaultdict(int)

    for idx, row in enumerate(final_rows, start=1):
        bucket = row.get("selection_bucket", "").strip()
        if bucket:
            bucket_counts[bucket] += 1

        cohort_out.append(
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
                row.get("has_existing_execution_data", "unknown").strip() or "unknown",
                row.get("selection_status", "selected_all_available_v2").strip() or "selected_all_available_v2",
                row.get("notes", "").strip(),
            ]
        )

    write_csv(cohort_csv, cohort_header, cohort_out)

    desired_buckets = [
        "A_n5", "A_n6", "A_n8",
        "B_n5", "B_n6", "B_n8",
        "C_n5", "C_n6", "C_n8",
        "D_n5", "D_n6", "D_n8",
    ]
    bucket_rows = [[bucket, str(bucket_counts.get(bucket, 0))] for bucket in desired_buckets]
    write_csv(bucket_csv, ["selection_bucket", "case_count"], bucket_rows)

    run_register_rows = []
    for row in cohort_out:
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

    write_csv(
        adjudication_csv,
        [
            "phase2b_row_id",
            "decision",
            "topology_class",
            "n_basic",
            "selection_bucket",
            "source_relative_path",
            "adjudication_notes",
        ],
        adjudication_rows,
    )

    memo_lines = [
        "# OpenPRA WS4 All Available Cohort Memo v2",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source bundle: {latest_bundle.relative_to(REPO_ROOT).as_posix()}",
        f"All available cohort size v2: {len(final_rows)}",
        "",
        "Decision:",
        "Use the repaired 34 case universe plus accepted novel adjudications.",
        "",
        "Accepted novel cases:",
        "- phase2b_row_0274 -> D_n8",
        "- phase2b_row_4228 -> D_n8",
        "",
        "Held out:",
        "- phase2b_row_9683 due to conflicting D_n8, unclassified_n8, and unclassified_n2 evidence",
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
            "This remains an all available local-universe cohort, not a fully stratified broader cohort.",
        ]
    )
    memo_md.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    summary_payload = {
        "artifact_name": "OPENPRA_WS4_ALL_AVAILABLE_COHORT_SUMMARY_v2",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_bundle": latest_bundle.relative_to(REPO_ROOT).as_posix(),
        "base_case_count": len(base_rows),
        "accepted_novel_case_count": len(accepted_additions),
        "held_out_novel_case_count": 1,
        "all_available_case_count_v2": len(final_rows),
        "bucket_counts": dict(bucket_counts),
        "outputs": {
            "cohort_csv": cohort_csv.relative_to(REPO_ROOT).as_posix(),
            "bucket_csv": bucket_csv.relative_to(REPO_ROOT).as_posix(),
            "run_register_csv": run_register_csv.relative_to(REPO_ROOT).as_posix(),
            "adjudication_csv": adjudication_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    write_json(summary_json, summary_payload)

    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_ALL_AVAILABLE_COHORT_MANIFEST_v2",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [cohort_csv, bucket_csv, run_register_csv, adjudication_csv, memo_md, summary_json]:
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
    print(str(run_register_csv))
    print(str(adjudication_csv))
    print(str(memo_md))
    print(str(summary_json))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"all_available_case_count_v2={len(final_rows)}")


if __name__ == "__main__":
    main()
