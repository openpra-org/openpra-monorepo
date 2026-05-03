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
    values = recursive_find(data, {"phase2b_row_id", "phase2bRowId"})
    for value in values:
        text = first_nonempty(value)
        if text.startswith("phase2b_row_"):
            return text

    values = recursive_find(data, {"subtreeId", "subtree_id"})
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


def extract_subtree_id(data: dict[str, Any], root_gate_id: str) -> str:
    values = recursive_find(data, {"subtreeId", "subtree_id"})
    for value in values:
        text = first_nonempty(value)
        if not text:
            continue
        if text == root_gate_id:
            continue
        if re.fullmatch(r"G:G\d+", text):
            continue
        return text
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
            root_gate_id = extract_root_gate_id(rel, data)
            subtree_id = extract_subtree_id(data, root_gate_id)
            topology_class = extract_topology_class(data)
            n_basic = extract_n_basic(data)

            if not phase2b_row_id or not topology_class or not n_basic:
                continue

            variant = extract_variant_name(rel)

            rows.append(
                {
                    "case_id": phase2b_row_id,
                    "phase2b_row_id": phase2b_row_id,
                    "subtree_id": subtree_id,
                    "root_gate_id": root_gate_id,
                    "topology_class": topology_class,
                    "n_basic": n_basic,
                    "selection_bucket": f"{topology_class}_n{n_basic}",
                    "source_relative_path": rel,
                    "source_variant": variant,
                    "variant_rank": str(variant_rank(variant)),
                    "has_existing_execution_data": "unknown",
                    "selection_status": "pending_review",
                    "notes": "",
                }
            )

    return rows


def main() -> None:
    latest_bundle = find_latest_bundle()
    review_dir = latest_bundle / "REVIEW"

    all_rows = scan_preparation_artifacts()

    best_by_phase2b: dict[str, dict[str, str]] = {}
    duplicates: dict[str, list[dict[str, str]]] = defaultdict(list)

    for row in all_rows:
        key = row["phase2b_row_id"]
        duplicates[key].append(row)

        prior = best_by_phase2b.get(key)
        if prior is None:
            best_by_phase2b[key] = row
            continue

        new_rank = int(row["variant_rank"])
        old_rank = int(prior["variant_rank"])
        if new_rank > old_rank:
            best_by_phase2b[key] = row
        elif new_rank == old_rank and row["source_relative_path"] < prior["source_relative_path"]:
            best_by_phase2b[key] = row

    unique_rows = sorted(
        best_by_phase2b.values(),
        key=lambda row: (
            row["topology_class"],
            int(row["n_basic"]),
            row["phase2b_row_id"],
            row["source_relative_path"],
        ),
    )

    universe_csv = review_dir / "openpra_ws4_unique_case_universe_v1.csv"
    with universe_csv.open("w", encoding="utf-8", newline="") as f:
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
                "selection_bucket",
                "source_relative_path",
                "source_variant",
                "variant_rank",
                "has_existing_execution_data",
                "selection_status",
                "notes",
            ]
        )
        for idx, row in enumerate(unique_rows, start=1):
            writer.writerow(
                [
                    idx,
                    row["case_id"],
                    row["phase2b_row_id"],
                    row["subtree_id"],
                    row["root_gate_id"],
                    row["topology_class"],
                    row["n_basic"],
                    row["selection_bucket"],
                    row["source_relative_path"],
                    row["source_variant"],
                    row["variant_rank"],
                    row["has_existing_execution_data"],
                    row["selection_status"],
                    row["notes"],
                ]
            )

    coverage_summary_csv = review_dir / "openpra_ws4_available_coverage_summary_v1.csv"
    coverage_counts: dict[str, int] = defaultdict(int)
    topology_counts: dict[str, int] = defaultdict(int)
    size_counts: dict[str, int] = defaultdict(int)

    for row in unique_rows:
        coverage_counts[row["selection_bucket"]] += 1
        topology_counts[row["topology_class"]] += 1
        size_counts[row["n_basic"]] += 1

    desired_buckets = [
        "A_n5", "A_n6", "A_n8",
        "B_n5", "B_n6", "B_n8",
        "C_n5", "C_n6", "C_n8",
        "D_n5", "D_n6", "D_n8",
    ]

    with coverage_summary_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["category", "key", "count"])
        for bucket in desired_buckets:
            writer.writerow(["bucket", bucket, coverage_counts.get(bucket, 0)])
        for topology in sorted(topology_counts):
            writer.writerow(["topology_class", topology, topology_counts[topology]])
        for n_basic in sorted(size_counts, key=lambda x: int(x)):
            writer.writerow(["n_basic", n_basic, size_counts[n_basic]])

    duplicate_csv = review_dir / "openpra_ws4_case_universe_duplicate_groups_v1.csv"
    with duplicate_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "phase2b_row_id",
                "source_relative_path",
                "source_variant",
                "variant_rank",
                "selected_for_universe",
            ]
        )
        for phase2b_row_id in sorted(duplicates):
            chosen_path = best_by_phase2b[phase2b_row_id]["source_relative_path"]
            ordered = sorted(
                duplicates[phase2b_row_id],
                key=lambda row: (-int(row["variant_rank"]), row["source_relative_path"]),
            )
            for row in ordered:
                writer.writerow(
                    [
                        phase2b_row_id,
                        row["source_relative_path"],
                        row["source_variant"],
                        row["variant_rank"],
                        "yes" if row["source_relative_path"] == chosen_path else "no",
                    ]
                )

    summary_json = review_dir / "openpra_ws4_case_universe_summary_v1.json"
    summary_payload = {
        "artifact_name": "OPENPRA_WS4_CASE_UNIVERSE_SUMMARY_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "latest_bundle": latest_bundle.relative_to(REPO_ROOT).as_posix(),
        "scanned_preparation_artifact_count": len(all_rows),
        "unique_case_count": len(unique_rows),
        "coverage_counts": dict(coverage_counts),
        "topology_counts": dict(topology_counts),
        "size_counts": dict(size_counts),
        "outputs": {
            "universe_csv": universe_csv.relative_to(REPO_ROOT).as_posix(),
            "coverage_summary_csv": coverage_summary_csv.relative_to(REPO_ROOT).as_posix(),
            "duplicate_csv": duplicate_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    summary_json.write_text(json.dumps(summary_payload, indent=2), encoding="utf-8")

    print(str(latest_bundle))
    print(str(universe_csv))
    print(str(coverage_summary_csv))
    print(str(duplicate_csv))
    print(str(summary_json))
    print(f"scanned_preparation_artifact_count={len(all_rows)}")
    print(f"unique_case_count={len(unique_rows)}")


if __name__ == "__main__":
    main()
