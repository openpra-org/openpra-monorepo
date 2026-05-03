#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path.cwd()
BUNDLE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_manual_review_bundle_v1"
SEARCH_BASE = REPO_ROOT / "_work"

TARGET_PER_BUCKET = 5
DESIRED_BUCKETS = [
    "A_n5", "A_n6", "A_n8",
    "B_n5", "B_n6", "B_n8",
    "C_n5", "C_n6", "C_n8",
    "D_n5", "D_n6", "D_n8",
]


def find_latest_bundle() -> Path:
    candidates = sorted(BUNDLE_BASE.glob("OPENPRA_WS4_MANUAL_REVIEW_BUNDLE_v1_*"))
    if not candidates:
        raise RuntimeError(f"No manual review bundle found under {BUNDLE_BASE}")
    return candidates[-1]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def recursive_find(obj: Any, target_keys: set[str]) -> list[Any]:
    found: list[Any] = []

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            for k, v in value.items():
                if k in target_keys:
                    found.append(v)
                walk(v)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(obj)
    return found


def first_nonempty(*values: Any) -> str:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str):
            text = value.strip()
            if text:
                return text
        elif isinstance(value, (int, float)):
            return str(value)
    return ""


def extract_phase2b_row_id(path_text: str, data: dict[str, Any]) -> str:
    values = recursive_find(data, {"phase2b_row_id", "phase2bRowId", "subtreeId", "subtree_id"})
    for value in values:
        text = first_nonempty(value)
        if text.startswith("phase2b_row_"):
            return text

    match = re.search(r"(phase2b_row_\d+)", path_text)
    return match.group(1) if match else ""


def extract_root_gate_id(path_text: str, data: dict[str, Any]) -> str:
    values = recursive_find(data, {"rootGateId", "root_gate_id"})
    for value in values:
        text = first_nonempty(value)
        if text:
            return text

    match = re.search(r"__G_G(\d+)", path_text)
    if match:
        return f"G:G{match.group(1)}"
    return ""


def extract_topology_class(data: dict[str, Any]) -> str:
    values = recursive_find(data, {"topologyClass", "topology_class"})
    for value in values:
        text = first_nonempty(value)
        if text:
            return text
    return ""


def extract_n_basic(data: dict[str, Any]) -> str:
    values = recursive_find(data, {"n_basic", "nBasic", "basicEventCount", "basic_event_count"})
    for value in values:
        text = first_nonempty(value)
        if text:
            return text
    return ""


def extract_variant_name(path_text: str) -> str:
    parts = Path(path_text).parts
    for part in parts:
        if part.startswith("openpra_quantum_simulator_validation_"):
            return part
    return ""


def variant_rank(variant_name: str) -> int:
    if "real_exhaust_ac" in variant_name:
        return 3
    if "real_clean" in variant_name:
        return 2
    if "real" in variant_name:
        return 1
    return 0


def scan_preparation_artifacts() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []

    for path in SEARCH_BASE.rglob("openpra_quantum_preparation_artifact_v1.json"):
        rel = path.relative_to(REPO_ROOT).as_posix()

        if "openpra_quantum_ws4_" in rel:
            continue
        if "/PACKED_SOURCES/" in rel:
            continue

        data = read_json(path)
        phase2b_row_id = extract_phase2b_row_id(rel, data)
        subtree_id = first_nonempty(
            *recursive_find(data, {"subtreeId", "subtree_id", "phase2bRowId", "phase2b_row_id"})
        )
        root_gate_id = extract_root_gate_id(rel, data)
        topology_class = extract_topology_class(data)
        n_basic = extract_n_basic(data)
        source_variant = extract_variant_name(rel)

        if not phase2b_row_id:
            continue
        if not topology_class or not n_basic:
            continue

        rows.append(
            {
                "phase2b_row_id": phase2b_row_id,
                "case_id": phase2b_row_id or subtree_id,
                "subtree_id": subtree_id,
                "root_gate_id": root_gate_id,
                "topology_class": topology_class,
                "n_basic": n_basic,
                "bucket": f"{topology_class}_n{n_basic}",
                "source_relative_path": rel,
                "source_variant": source_variant,
                "variant_rank": str(variant_rank(source_variant)),
            }
        )

    return rows


def read_prefill_rows(prefill_csv: Path) -> list[dict[str, str]]:
    with prefill_csv.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def main() -> None:
    latest_bundle = find_latest_bundle()
    review_dir = latest_bundle / "REVIEW"

    prefill_csv = review_dir / "openpra_ws4_cohort_selection_manifest_prefill_v1.csv"
    if not prefill_csv.exists():
        raise RuntimeError(f"Missing prefill CSV: {prefill_csv}")

    existing_rows = read_prefill_rows(prefill_csv)
    selected_phase2b = {
        row["phase2b_row_id"].strip()
        for row in existing_rows
        if row.get("phase2b_row_id", "").strip()
    }

    current_bucket_counts: dict[str, int] = defaultdict(int)
    for row in existing_rows:
        bucket = row.get("selection_bucket", "").strip()
        if bucket:
            current_bucket_counts[bucket] += 1

    all_candidates = scan_preparation_artifacts()

    best_by_phase2b: dict[str, dict[str, str]] = {}
    for row in all_candidates:
        phase2b = row["phase2b_row_id"]
        if phase2b in selected_phase2b:
            continue

        prior = best_by_phase2b.get(phase2b)
        if prior is None:
            best_by_phase2b[phase2b] = row
            continue

        new_rank = int(row["variant_rank"])
        old_rank = int(prior["variant_rank"])
        if new_rank > old_rank:
            best_by_phase2b[phase2b] = row
        elif new_rank == old_rank and row["source_relative_path"] < prior["source_relative_path"]:
            best_by_phase2b[phase2b] = row

    grouped_candidates: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in best_by_phase2b.values():
        grouped_candidates[row["bucket"]].append(row)

    for bucket in grouped_candidates:
        grouped_candidates[bucket].sort(
            key=lambda row: (-int(row["variant_rank"]), row["source_relative_path"])
        )

    bucket_summary_rows = []
    augmentation_rows = []

    for bucket in DESIRED_BUCKETS:
        current_count = current_bucket_counts.get(bucket, 0)
        needed = max(0, TARGET_PER_BUCKET - current_count)
        bucket_candidates = grouped_candidates.get(bucket, [])
        chosen = bucket_candidates[:needed] if needed > 0 else []

        bucket_summary_rows.append(
            {
                "bucket": bucket,
                "current_count": current_count,
                "target_count": TARGET_PER_BUCKET,
                "needed_count": needed,
                "available_candidate_count": len(bucket_candidates),
                "selected_candidate_count": len(chosen),
            }
        )

        for idx, row in enumerate(chosen, start=1):
            augmentation_rows.append(
                {
                    "bucket": bucket,
                    "bucket_rank": idx,
                    "case_id": row["case_id"],
                    "phase2b_row_id": row["phase2b_row_id"],
                    "subtree_id": row["subtree_id"],
                    "root_gate_id": row["root_gate_id"],
                    "topology_class": row["topology_class"],
                    "n_basic": row["n_basic"],
                    "source_relative_path": row["source_relative_path"],
                    "source_variant": row["source_variant"],
                    "variant_rank": row["variant_rank"],
                    "selection_rationale": f"gap_augmentation_for_{bucket}",
                    "preparation_status": "artifact_present",
                    "has_existing_execution_data": "unknown",
                }
            )

    bucket_summary_csv = review_dir / "openpra_ws4_gap_bucket_summary_v1.csv"
    with bucket_summary_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "bucket",
                "current_count",
                "target_count",
                "needed_count",
                "available_candidate_count",
                "selected_candidate_count",
            ]
        )
        for row in bucket_summary_rows:
            writer.writerow(
                [
                    row["bucket"],
                    row["current_count"],
                    row["target_count"],
                    row["needed_count"],
                    row["available_candidate_count"],
                    row["selected_candidate_count"],
                ]
            )

    augmentation_csv = review_dir / "openpra_ws4_gap_augmentation_candidates_v1.csv"
    with augmentation_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "bucket",
                "bucket_rank",
                "case_id",
                "phase2b_row_id",
                "subtree_id",
                "root_gate_id",
                "topology_class",
                "n_basic",
                "source_relative_path",
                "source_variant",
                "variant_rank",
                "selection_rationale",
                "preparation_status",
                "has_existing_execution_data",
            ]
        )
        for row in augmentation_rows:
            writer.writerow(
                [
                    row["bucket"],
                    row["bucket_rank"],
                    row["case_id"],
                    row["phase2b_row_id"],
                    row["subtree_id"],
                    row["root_gate_id"],
                    row["topology_class"],
                    row["n_basic"],
                    row["source_relative_path"],
                    row["source_variant"],
                    row["variant_rank"],
                    row["selection_rationale"],
                    row["preparation_status"],
                    row["has_existing_execution_data"],
                ]
            )

    augmented_manifest_csv = review_dir / "openpra_ws4_cohort_selection_manifest_augmented_v1.csv"
    with augmented_manifest_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
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
        )

        for row in existing_rows:
            writer.writerow(
                [
                    row.get("selection_rank", ""),
                    row.get("case_id", ""),
                    row.get("phase2b_row_id", ""),
                    row.get("subtree_id", ""),
                    row.get("root_gate_id", ""),
                    row.get("topology_class", ""),
                    row.get("n_basic", ""),
                    row.get("source_relative_path", ""),
                    row.get("has_existing_execution_data", ""),
                    row.get("selection_bucket", ""),
                    row.get("selection_rationale", ""),
                    row.get("preparation_status", ""),
                    row.get("statevector_status", ""),
                    row.get("recovery_mode", ""),
                    row.get("recovery_status", ""),
                    row.get("notes", ""),
                ]
            )

        for row in augmentation_rows:
            writer.writerow(
                [
                    "",
                    row["case_id"],
                    row["phase2b_row_id"],
                    row["subtree_id"],
                    row["root_gate_id"],
                    row["topology_class"],
                    row["n_basic"],
                    row["source_relative_path"],
                    row["has_existing_execution_data"],
                    row["bucket"],
                    row["selection_rationale"],
                    row["preparation_status"],
                    "",
                    "",
                    "",
                    f"source_variant={row['source_variant']}; suggested_by_gap_augmentation",
                ]
            )

    summary = {
        "artifact_name": "OPENPRA_WS4_GAP_AUGMENTATION_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "latest_bundle": latest_bundle.relative_to(REPO_ROOT).as_posix(),
        "existing_unique_case_count": len(existing_rows),
        "augmentation_candidate_count": len(augmentation_rows),
        "desired_buckets": DESIRED_BUCKETS,
        "target_per_bucket": TARGET_PER_BUCKET,
        "outputs": {
            "bucket_summary_csv": bucket_summary_csv.relative_to(REPO_ROOT).as_posix(),
            "augmentation_csv": augmentation_csv.relative_to(REPO_ROOT).as_posix(),
            "augmented_manifest_csv": augmented_manifest_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    summary_path = review_dir / "openpra_ws4_gap_augmentation_v1.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(str(latest_bundle))
    print(str(bucket_summary_csv))
    print(str(augmentation_csv))
    print(str(augmented_manifest_csv))
    print(str(summary_path))
    print(f"existing_unique_case_count={len(existing_rows)}")
    print(f"augmentation_candidate_count={len(augmentation_rows)}")


if __name__ == "__main__":
    main()
