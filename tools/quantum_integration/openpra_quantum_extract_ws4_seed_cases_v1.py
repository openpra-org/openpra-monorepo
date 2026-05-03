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


def find_latest_bundle() -> Path:
    candidates = sorted(
        BUNDLE_BASE.glob("OPENPRA_WS4_MANUAL_REVIEW_BUNDLE_v1_*")
    )
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


def main() -> None:
    latest_bundle = find_latest_bundle()
    packed_root = latest_bundle / "PACKED_SOURCES"
    review_root = latest_bundle / "REVIEW"

    if not packed_root.exists():
        raise RuntimeError(f"Missing PACKED_SOURCES in {latest_bundle}")

    json_files = sorted(packed_root.rglob("openpra_quantum_preparation_artifact_v1.json"))
    if not json_files:
        raise RuntimeError(f"No preparation artifact JSON files found under {packed_root}")

    extracted_rows: list[dict[str, str]] = []

    for idx, path in enumerate(json_files, start=1):
        rel_path = path.relative_to(latest_bundle).as_posix()
        src_rel_match = rel_path.split("PACKED_SOURCES/", 1)
        source_relative_path = src_rel_match[1] if len(src_rel_match) == 2 else rel_path

        data = read_json(path)
        phase2b_row_id = extract_phase2b_row_id(source_relative_path, data)
        subtree_id = first_nonempty(
            *recursive_find(data, {"subtreeId", "subtree_id", "phase2bRowId", "phase2b_row_id"})
        )
        root_gate_id = extract_root_gate_id(source_relative_path, data)
        topology_class = extract_topology_class(data)
        n_basic = extract_n_basic(data)
        variant_name = extract_variant_name(source_relative_path)

        extracted_rows.append(
            {
                "source_rank": str(idx),
                "case_id": phase2b_row_id or subtree_id,
                "phase2b_row_id": phase2b_row_id,
                "subtree_id": subtree_id,
                "root_gate_id": root_gate_id,
                "topology_class": topology_class,
                "n_basic": n_basic,
                "source_relative_path": source_relative_path,
                "source_variant": variant_name,
                "variant_rank": str(variant_rank(variant_name)),
                "has_existing_execution_data": "unknown",
                "preparation_status": "artifact_present",
            }
        )

    extracted_rows.sort(
        key=lambda row: (
            row["phase2b_row_id"],
            -int(row["variant_rank"] or "0"),
            row["source_relative_path"],
        )
    )

    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in extracted_rows:
        key = row["phase2b_row_id"] or row["subtree_id"] or row["source_relative_path"]
        grouped[key].append(row)

    deduped_rows: list[dict[str, str]] = []
    duplicate_rows: list[dict[str, str]] = []

    for group_key, rows in grouped.items():
        rows_sorted = sorted(
            rows,
            key=lambda row: (
                -int(row["variant_rank"] or "0"),
                row["source_relative_path"],
            )
        )
        chosen = rows_sorted[0]
        group_size = len(rows_sorted)

        deduped_rows.append(
            {
                "selection_rank": "",
                "case_id": chosen["case_id"],
                "phase2b_row_id": chosen["phase2b_row_id"],
                "subtree_id": chosen["subtree_id"],
                "root_gate_id": chosen["root_gate_id"],
                "topology_class": chosen["topology_class"],
                "n_basic": chosen["n_basic"],
                "source_relative_path": chosen["source_relative_path"],
                "has_existing_execution_data": "unknown",
                "selection_bucket": (
                    f"{chosen['topology_class']}_n{chosen['n_basic']}"
                    if chosen["topology_class"] and chosen["n_basic"]
                    else ""
                ),
                "selection_rationale": f"prefilled from promoted preparation artifact; duplicate_group_size={group_size}",
                "preparation_status": "artifact_present",
                "statevector_status": "",
                "recovery_mode": "",
                "recovery_status": "",
                "notes": f"source_variant={chosen['source_variant']}; duplicate_group_key={group_key}",
            }
        )

        if group_size > 1:
            for row in rows_sorted:
                duplicate_rows.append(
                    {
                        "duplicate_group_key": group_key,
                        "phase2b_row_id": row["phase2b_row_id"],
                        "source_relative_path": row["source_relative_path"],
                        "source_variant": row["source_variant"],
                        "variant_rank": row["variant_rank"],
                        "selected_for_prefill": "yes" if row is chosen else "no",
                    }
                )

    extraction_csv = review_root / "openpra_ws4_seed_case_extraction_v1.csv"
    with extraction_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "source_rank",
                "case_id",
                "phase2b_row_id",
                "subtree_id",
                "root_gate_id",
                "topology_class",
                "n_basic",
                "source_relative_path",
                "source_variant",
                "variant_rank",
                "has_existing_execution_data",
                "preparation_status",
            ]
        )
        for row in extracted_rows:
            writer.writerow([row[k] for k in [
                "source_rank",
                "case_id",
                "phase2b_row_id",
                "subtree_id",
                "root_gate_id",
                "topology_class",
                "n_basic",
                "source_relative_path",
                "source_variant",
                "variant_rank",
                "has_existing_execution_data",
                "preparation_status",
            ]])

    duplicate_csv = review_root / "openpra_ws4_seed_case_duplicate_groups_v1.csv"
    with duplicate_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "duplicate_group_key",
                "phase2b_row_id",
                "source_relative_path",
                "source_variant",
                "variant_rank",
                "selected_for_prefill",
            ]
        )
        for row in duplicate_rows:
            writer.writerow([row[k] for k in [
                "duplicate_group_key",
                "phase2b_row_id",
                "source_relative_path",
                "source_variant",
                "variant_rank",
                "selected_for_prefill",
            ]])

    prefill_csv = review_root / "openpra_ws4_cohort_selection_manifest_prefill_v1.csv"
    with prefill_csv.open("w", encoding="utf-8", newline="") as f:
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
        for row in deduped_rows:
            writer.writerow([row[k] for k in [
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
            ]])

    summary = {
        "artifact_name": "OPENPRA_WS4_SEED_CASE_EXTRACTION_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "latest_bundle": latest_bundle.relative_to(REPO_ROOT).as_posix(),
        "packed_preparation_artifact_count": len(extracted_rows),
        "unique_case_count": len(deduped_rows),
        "duplicate_group_count": len({row['duplicate_group_key'] for row in duplicate_rows}) if duplicate_rows else 0,
        "outputs": {
            "extraction_csv": extraction_csv.relative_to(REPO_ROOT).as_posix(),
            "duplicate_csv": duplicate_csv.relative_to(REPO_ROOT).as_posix(),
            "prefill_csv": prefill_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    summary_path = review_root / "openpra_ws4_seed_case_extraction_v1.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(str(latest_bundle))
    print(str(extraction_csv))
    print(str(duplicate_csv))
    print(str(prefill_csv))
    print(str(summary_path))
    print(f"packed_preparation_artifact_count={len(extracted_rows)}")
    print(f"unique_case_count={len(deduped_rows)}")
    print(f"duplicate_group_count={len({row['duplicate_group_key'] for row in duplicate_rows}) if duplicate_rows else 0}")


if __name__ == "__main__":
    main()
