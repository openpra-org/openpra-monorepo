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
SEARCH_ROOTS = [
    REPO_ROOT / "_work",
    REPO_ROOT / "tools" / "quantum-research-scripts",
]

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
        if part.startswith("openpra_quantum_"):
            return part
    return ""


def variant_rank(variant_name: str) -> int:
    if "real_exhaust_ac" in variant_name:
        return 4
    if "real_with_d" in variant_name:
        return 3
    if "real_clean" in variant_name:
        return 2
    if "real" in variant_name:
        return 1
    return 0


def load_existing_manifest_rows(bundle: Path) -> list[dict[str, str]]:
    path = bundle / "REVIEW" / "openpra_ws4_cohort_selection_manifest_augmented_v1.csv"
    if not path.exists():
        raise RuntimeError(f"Missing augmented manifest: {path}")

    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def scan_preparation_artifacts() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []

    for root in SEARCH_ROOTS:
        if not root.exists():
            continue

        for path in root.rglob("openpra_quantum_preparation_artifact_v1.json"):
            rel = path.relative_to(REPO_ROOT).as_posix()

            if "/PACKED_SOURCES/" in rel:
                continue
            if "openpra_quantum_ws4_" in rel:
                continue

            try:
                data = read_json(path)
            except Exception:
                continue

            phase2b_row_id = extract_phase2b_row_id(rel, data)
            subtree_id = first_nonempty(
                *recursive_find(data, {"subtreeId", "subtree_id", "phase2bRowId", "phase2b_row_id"})
            )
            root_gate_id = extract_root_gate_id(rel, data)
            topology_class = extract_topology_class(data)
            n_basic = extract_n_basic(data)

            if not phase2b_row_id or not topology_class or not n_basic:
                continue

            variant = extract_variant_name(rel)

            rows.append(
                {
                    "case_id": phase2b_row_id or subtree_id,
                    "phase2b_row_id": phase2b_row_id,
                    "subtree_id": subtree_id,
                    "root_gate_id": root_gate_id,
                    "topology_class": topology_class,
                    "n_basic": n_basic,
                    "bucket": f"{topology_class}_n{n_basic}",
                    "source_relative_path": rel,
                    "source_variant": variant,
                    "variant_rank": str(variant_rank(variant)),
                    "selection_rationale": f"missing_bucket_search_{topology_class}_n{n_basic}",
                    "preparation_status": "artifact_present",
                    "has_existing_execution_data": "unknown",
                }
            )

    return rows


def main() -> None:
    latest_bundle = find_latest_bundle()
    review_dir = latest_bundle / "REVIEW"

    existing_rows = load_existing_manifest_rows(latest_bundle)

    current_bucket_counts: dict[str, int] = defaultdict(int)
    existing_phase2b = set()

    for row in existing_rows:
        bucket = row.get("selection_bucket", "").strip()
        if bucket:
            current_bucket_counts[bucket] += 1

        phase2b = row.get("phase2b_row_id", "").strip()
        if phase2b:
            existing_phase2b.add(phase2b)

    all_candidates = scan_preparation_artifacts()

    best_new_by_phase2b: dict[str, dict[str, str]] = {}
    for row in all_candidates:
        phase2b = row["phase2b_row_id"]
        if phase2b in existing_phase2b:
            continue

        prior = best_new_by_phase2b.get(phase2b)
        if prior is None:
            best_new_by_phase2b[phase2b] = row
            continue

        new_rank = int(row["variant_rank"])
        old_rank = int(prior["variant_rank"])
        if new_rank > old_rank:
            best_new_by_phase2b[phase2b] = row
        elif new_rank == old_rank and row["source_relative_path"] < prior["source_relative_path"]:
            best_new_by_phase2b[phase2b] = row

    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in best_new_by_phase2b.values():
        grouped[row["bucket"]].append(row)

    for bucket in grouped:
        grouped[bucket].sort(
            key=lambda row: (-int(row["variant_rank"]), row["source_relative_path"])
        )

    bucket_summary_rows = []
    selected_rows = []

    for bucket in DESIRED_BUCKETS:
        current_count = current_bucket_counts.get(bucket, 0)
        needed = max(0, TARGET_PER_BUCKET - current_count)
        available = grouped.get(bucket, [])
        chosen = available[:needed]

        bucket_summary_rows.append(
            {
                "bucket": bucket,
                "current_count": current_count,
                "target_count": TARGET_PER_BUCKET,
                "needed_count": needed,
                "available_candidate_count": len(available),
                "selected_candidate_count": len(chosen),
            }
        )

        for idx, row in enumerate(chosen, start=1):
            row_copy = dict(row)
            row_copy["bucket_rank"] = str(idx)
            selected_rows.append(row_copy)

    summary_csv = review_dir / "openpra_ws4_missing_bucket_summary_v2.csv"
    with summary_csv.open("w", encoding="utf-8", newline="") as f:
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

    candidates_csv = review_dir / "openpra_ws4_missing_bucket_candidates_v2.csv"
    with candidates_csv.open("w", encoding="utf-8", newline="") as f:
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
        for row in selected_rows:
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

    working_csv = review_dir / "openpra_ws4_cohort_selection_manifest_working_v1.csv"
    with working_csv.open("w", encoding="utf-8", newline="") as f:
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

        rank = 1
        for row in existing_rows:
            writer.writerow(
                [
                    rank,
                    row.get("case_id", ""),
                    row.get("phase2b_row_id", ""),
                    row.get("subtree_id", ""),
                    row.get("root_gate_id", ""),
                    row.get("topology_class", ""),
                    row.get("n_basic", ""),
                    row.get("source_relative_path", ""),
                    row.get("has_existing_execution_data", "unknown"),
                    row.get("selection_bucket", ""),
                    row.get("selection_rationale", ""),
                    row.get("preparation_status", ""),
                    row.get("statevector_status", ""),
                    row.get("recovery_mode", ""),
                    row.get("recovery_status", ""),
                    row.get("notes", ""),
                ]
            )
            rank += 1

        for row in selected_rows:
            writer.writerow(
                [
                    rank,
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
                    f"source_variant={row['source_variant']}; bucket_rank={row['bucket_rank']}",
                ]
            )
            rank += 1

    summary_json = review_dir / "openpra_ws4_missing_bucket_search_v2.json"
    summary_payload = {
        "artifact_name": "OPENPRA_WS4_MISSING_BUCKET_SEARCH_v2",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "latest_bundle": latest_bundle.relative_to(REPO_ROOT).as_posix(),
        "existing_case_count": len(existing_rows),
        "selected_missing_bucket_candidate_count": len(selected_rows),
        "working_case_count": len(existing_rows) + len(selected_rows),
        "outputs": {
            "summary_csv": summary_csv.relative_to(REPO_ROOT).as_posix(),
            "candidates_csv": candidates_csv.relative_to(REPO_ROOT).as_posix(),
            "working_csv": working_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    summary_json.write_text(json.dumps(summary_payload, indent=2), encoding="utf-8")

    print(str(latest_bundle))
    print(str(summary_csv))
    print(str(candidates_csv))
    print(str(working_csv))
    print(str(summary_json))
    print(f"existing_case_count={len(existing_rows)}")
    print(f"selected_missing_bucket_candidate_count={len(selected_rows)}")
    print(f"working_case_count={len(existing_rows) + len(selected_rows)}")


if __name__ == "__main__":
    main()
