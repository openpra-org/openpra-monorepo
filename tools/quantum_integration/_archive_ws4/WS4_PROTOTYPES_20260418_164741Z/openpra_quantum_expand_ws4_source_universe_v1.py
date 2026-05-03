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

ALLOWED_SUFFIXES = {".json", ".csv"}
EXCLUDE_PATH_PARTS = {
    ".git",
    "node_modules",
    "dist",
    "coverage",
}
MAX_EXAMPLES_PER_FAMILY = 5


def find_latest_bundle() -> Path:
    candidates = sorted(BUNDLE_BASE.glob("OPENPRA_WS4_MANUAL_REVIEW_BUNDLE_v1_*"))
    if not candidates:
        raise RuntimeError(f"No manual review bundle found under {BUNDLE_BASE}")
    return candidates[-1]


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


def extract_phase2b_row_id(path_text: str, payload: Any) -> str:
    if isinstance(payload, dict):
        values = recursive_find(payload, {"phase2b_row_id", "phase2bRowId"})
        for value in values:
            text = first_nonempty(value)
            if text.startswith("phase2b_row_"):
                return text

        values = recursive_find(payload, {"subtreeId", "subtree_id"})
        for value in values:
            text = first_nonempty(value)
            if text.startswith("phase2b_row_"):
                return text

    match = re.search(r"(phase2b_row_\d+)", path_text)
    return match.group(1) if match else ""


def extract_root_gate_id(path_text: str, payload: Any) -> str:
    if isinstance(payload, dict):
        values = recursive_find(payload, {"rootGateId", "root_gate_id"})
        for value in values:
            text = first_nonempty(value)
            if text:
                return text

    match = re.search(r"__G_G(\d+)", path_text)
    if match:
        return f"G:G{match.group(1)}"
    return ""


def extract_topology_class(payload: Any) -> str:
    if isinstance(payload, dict):
        values = recursive_find(payload, {"topologyClass", "topology_class"})
        for value in values:
            text = first_nonempty(value)
            if text:
                return text
    return ""


def extract_n_basic(payload: Any) -> str:
    if isinstance(payload, dict):
        values = recursive_find(payload, {"n_basic", "nBasic", "basicEventCount", "basic_event_count"})
        for value in values:
            text = first_nonempty(value)
            if text:
                return text
    return ""


def artifact_family_from_path(rel_path: str) -> str:
    parts = Path(rel_path).parts
    for part in parts:
        if part.startswith("openpra_quantum_"):
            return part
    return Path(rel_path).name


def infer_bucket(topology_class: str, n_basic: str) -> str:
    if topology_class and n_basic:
        return f"{topology_class}_n{n_basic}"
    return ""


def load_existing_universe_phase2b(latest_bundle: Path) -> set[str]:
    universe_csv = latest_bundle / "REVIEW" / "openpra_ws4_unique_case_universe_v1.csv"
    if not universe_csv.exists():
        raise RuntimeError(f"Missing universe CSV: {universe_csv}")

    with universe_csv.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    return {
        row["phase2b_row_id"].strip()
        for row in rows
        if row.get("phase2b_row_id", "").strip()
    }


def should_scan(path: Path) -> bool:
    if path.suffix.lower() not in ALLOWED_SUFFIXES:
        return False
    if any(part in EXCLUDE_PATH_PARTS for part in path.parts):
        return False
    rel = path.relative_to(REPO_ROOT).as_posix()
    if "openpra_quantum_ws4_" in rel:
        return False
    if "/PACKED_SOURCES/" in rel:
        return False
    return True


def scan_json_file(path: Path) -> list[dict[str, str]]:
    rel = path.relative_to(REPO_ROOT).as_posix()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []

    phase2b_row_id = extract_phase2b_row_id(rel, payload)
    if not phase2b_row_id:
        return []

    topology_class = extract_topology_class(payload)
    n_basic = extract_n_basic(payload)
    root_gate_id = extract_root_gate_id(rel, payload)

    return [
        {
            "phase2b_row_id": phase2b_row_id,
            "root_gate_id": root_gate_id,
            "topology_class": topology_class,
            "n_basic": n_basic,
            "selection_bucket": infer_bucket(topology_class, n_basic),
            "source_relative_path": rel,
            "artifact_family": artifact_family_from_path(rel),
            "artifact_file_name": path.name,
            "record_origin": "json",
        }
    ]


def scan_csv_file(path: Path) -> list[dict[str, str]]:
    rel = path.relative_to(REPO_ROOT).as_posix()
    rows_out: list[dict[str, str]] = []

    try:
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames or []
            lowered_map = {h.lower(): h for h in header if h}
            if not lowered_map:
                return []

            phase2b_key = lowered_map.get("phase2b_row_id") or lowered_map.get("phase2browid")
            subtree_key = lowered_map.get("subtree_id") or lowered_map.get("subtreeid")
            topology_key = lowered_map.get("topology_class") or lowered_map.get("topologyclass")
            n_basic_key = lowered_map.get("n_basic") or lowered_map.get("nbasic") or lowered_map.get("basiceventcount")
            root_gate_key = lowered_map.get("root_gate_id") or lowered_map.get("rootgateid")

            for row in reader:
                phase2b_row_id = first_nonempty(
                    row.get(phase2b_key, "") if phase2b_key else "",
                    row.get(subtree_key, "") if subtree_key else "",
                )
                if not phase2b_row_id.startswith("phase2b_row_"):
                    continue

                topology_class = first_nonempty(row.get(topology_key, "") if topology_key else "")
                n_basic = first_nonempty(row.get(n_basic_key, "") if n_basic_key else "")
                root_gate_id = first_nonempty(row.get(root_gate_key, "") if root_gate_key else "")

                rows_out.append(
                    {
                        "phase2b_row_id": phase2b_row_id,
                        "root_gate_id": root_gate_id,
                        "topology_class": topology_class,
                        "n_basic": n_basic,
                        "selection_bucket": infer_bucket(topology_class, n_basic),
                        "source_relative_path": rel,
                        "artifact_family": artifact_family_from_path(rel),
                        "artifact_file_name": path.name,
                        "record_origin": "csv",
                    }
                )
    except Exception:
        return []

    return rows_out


def scan_artifact_records() -> list[dict[str, str]]:
    records: list[dict[str, str]] = []

    for root in SEARCH_ROOTS:
        if not root.exists():
            continue

        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if not should_scan(path):
                continue

            suffix = path.suffix.lower()
            if suffix == ".json":
                records.extend(scan_json_file(path))
            elif suffix == ".csv":
                records.extend(scan_csv_file(path))

    return records


def main() -> None:
    latest_bundle = find_latest_bundle()
    review_dir = latest_bundle / "REVIEW"
    existing_universe_phase2b = load_existing_universe_phase2b(latest_bundle)

    records = scan_artifact_records()

    family_stats: dict[tuple[str, str], dict[str, Any]] = {}
    novel_rows: list[dict[str, str]] = []
    existing_rows: list[dict[str, str]] = []

    for record in records:
        family_key = (record["artifact_family"], record["artifact_file_name"])
        stats = family_stats.setdefault(
            family_key,
            {
                "artifact_family": record["artifact_family"],
                "artifact_file_name": record["artifact_file_name"],
                "record_origin": record["record_origin"],
                "unique_phase2b": set(),
                "novel_phase2b": set(),
                "buckets": set(),
                "example_paths": [],
            },
        )

        phase2b = record["phase2b_row_id"]
        stats["unique_phase2b"].add(phase2b)

        if record["selection_bucket"]:
            stats["buckets"].add(record["selection_bucket"])

        if len(stats["example_paths"]) < MAX_EXAMPLES_PER_FAMILY:
            stats["example_paths"].append(record["source_relative_path"])

        if phase2b in existing_universe_phase2b:
            existing_rows.append(record)
        else:
            novel_rows.append(record)
            stats["novel_phase2b"].add(phase2b)

    family_rows = []
    for (_, _), stats in family_stats.items():
        family_rows.append(
            {
                "artifact_family": stats["artifact_family"],
                "artifact_file_name": stats["artifact_file_name"],
                "record_origin": stats["record_origin"],
                "unique_case_count": len(stats["unique_phase2b"]),
                "novel_case_count": len(stats["novel_phase2b"]),
                "occupied_buckets": ",".join(sorted(stats["buckets"])),
                "example_paths": " | ".join(stats["example_paths"]),
            }
        )

    family_rows.sort(
        key=lambda row: (
            -int(row["novel_case_count"]),
            -int(row["unique_case_count"]),
            row["artifact_family"],
            row["artifact_file_name"],
        )
    )

    novel_rows.sort(
        key=lambda row: (
            row["selection_bucket"],
            row["phase2b_row_id"],
            row["artifact_family"],
            row["source_relative_path"],
        )
    )

    family_inventory_csv = review_dir / "openpra_ws4_source_family_inventory_v1.csv"
    with family_inventory_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "artifact_family",
                "artifact_file_name",
                "record_origin",
                "unique_case_count",
                "novel_case_count",
                "occupied_buckets",
                "example_paths",
            ]
        )
        for row in family_rows:
            writer.writerow(
                [
                    row["artifact_family"],
                    row["artifact_file_name"],
                    row["record_origin"],
                    row["unique_case_count"],
                    row["novel_case_count"],
                    row["occupied_buckets"],
                    row["example_paths"],
                ]
            )

    novel_cases_csv = review_dir / "openpra_ws4_novel_case_candidates_v1.csv"
    with novel_cases_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "phase2b_row_id",
                "root_gate_id",
                "topology_class",
                "n_basic",
                "selection_bucket",
                "artifact_family",
                "artifact_file_name",
                "record_origin",
                "source_relative_path",
            ]
        )
        for row in novel_rows:
            writer.writerow(
                [
                    row["phase2b_row_id"],
                    row["root_gate_id"],
                    row["topology_class"],
                    row["n_basic"],
                    row["selection_bucket"],
                    row["artifact_family"],
                    row["artifact_file_name"],
                    row["record_origin"],
                    row["source_relative_path"],
                ]
            )

    summary_json = review_dir / "openpra_ws4_source_universe_expansion_summary_v1.json"
    summary_payload = {
        "artifact_name": "OPENPRA_WS4_SOURCE_UNIVERSE_EXPANSION_SUMMARY_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "latest_bundle": latest_bundle.relative_to(REPO_ROOT).as_posix(),
        "existing_universe_case_count": len(existing_universe_phase2b),
        "scanned_record_count": len(records),
        "family_count": len(family_rows),
        "novel_record_count": len(novel_rows),
        "outputs": {
            "family_inventory_csv": family_inventory_csv.relative_to(REPO_ROOT).as_posix(),
            "novel_cases_csv": novel_cases_csv.relative_to(REPO_ROOT).as_posix(),
        },
    }
    summary_json.write_text(json.dumps(summary_payload, indent=2), encoding="utf-8")

    print(str(latest_bundle))
    print(str(family_inventory_csv))
    print(str(novel_cases_csv))
    print(str(summary_json))
    print(f"existing_universe_case_count={len(existing_universe_phase2b)}")
    print(f"family_count={len(family_rows)}")
    print(f"novel_record_count={len(novel_rows)}")


if __name__ == "__main__":
    main()
