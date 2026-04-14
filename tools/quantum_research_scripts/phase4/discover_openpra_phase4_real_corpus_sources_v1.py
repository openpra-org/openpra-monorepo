#!/usr/bin/env python3

from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


SCRIPT_VERSION = "phase4-real-corpus-discovery-v1"
MAX_DEPTH = 9
MAX_EXAMPLES_PER_BUCKET = 50
MAX_JSON_INSPECTIONS = 400
MAX_JSON_FILE_SIZE_BYTES = 2_000_000

PRUNE_DIR_NAMES = {
    ".git",
    ".github",
    ".nx",
    ".next",
    ".venv",
    ".venv_phase4_qiskit",
    "node_modules",
    "dist",
    "build",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
}

FILE_NAME_HINTS = [
    "openpra",
    "fault",
    "graph",
    "readiness",
    "working",
    "index",
    "join",
    "subtree",
    "extract",
    "generic",
    "pwr",
    "reactor",
]

DIR_NAME_HINTS = [
    "openpra",
    "phase2b",
    "reactor",
    "generic",
    "pwr",
    "readiness",
    "subtree",
    "extract",
    "working",
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_manifest(output_run: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}

    for path in sorted(output_run.rglob("*")):
        if path.is_file():
            relative_path = str(path.relative_to(output_run))
            manifest[relative_path] = sha256_file(path)

    sha_path = output_run / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as handle:
        for relative_path, digest in sorted(manifest.items()):
            handle.write(f"{digest}  {relative_path}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    return manifest


def should_prune_dir(name: str) -> bool:
    lower_name = name.lower()
    if name in PRUNE_DIR_NAMES:
        return True
    if lower_name.startswith(".venv"):
        return True
    if lower_name.endswith(".egg-info"):
        return True
    return False


def contains_any_hint(value: str, hints: List[str]) -> bool:
    lower_value = value.lower()
    return any(hint in lower_value for hint in hints)


def default_search_roots(repo_root: Path) -> List[Path]:
    candidates = [
        repo_root,
        Path("/mnt/storage_array/projects"),
        Path("/mnt/cluster_production/projects"),
    ]

    roots: List[Path] = []
    seen: set[str] = set()

    for candidate in candidates:
        if candidate.exists():
            resolved = candidate.resolve()
            key = str(resolved)
            if key not in seen:
                seen.add(key)
                roots.append(resolved)

    return roots


def classify_file_path(file_path: Path) -> List[str]:
    labels: List[str] = []

    name = file_path.name.lower()
    parent_path = str(file_path.parent).lower()

    if file_path.suffix.lower() in {".xml", ".mef"}:
        labels.append("xml_or_mef_model")

    if file_path.suffix.lower() == ".json":
        if "graph" in name or "graph" in parent_path:
            labels.append("graph_json_candidate")
        if "readiness" in name:
            labels.append("readiness_json_candidate")
        if "join" in name:
            labels.append("readiness_join_candidate")
        if "working" in name or "index" in name:
            labels.append("working_index_candidate")
        if "subtree" in name or "extract" in name:
            labels.append("subtree_or_extract_candidate")

    if file_path.suffix.lower() == ".csv":
        if "readiness" in name or "join" in name:
            labels.append("readiness_csv_candidate")
        if "working" in name or "index" in name:
            labels.append("working_index_candidate")
        if "subtree" in name or "extract" in name:
            labels.append("subtree_or_extract_candidate")

    return labels


def inspect_json_file(file_path: Path) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "path": str(file_path),
        "size_bytes": file_path.stat().st_size,
        "json_loaded": False,
        "graph_input_like": False,
        "likely_graph_collection": False,
        "keys": [],
        "notes": [],
    }

    if result["size_bytes"] > MAX_JSON_FILE_SIZE_BYTES:
        result["notes"].append("skipped_due_to_size")
        return result

    try:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
        result["json_loaded"] = True
    except Exception:
        result["notes"].append("json_parse_failed")
        return result

    if isinstance(payload, dict):
        result["keys"] = sorted(list(payload.keys()))[:40]

        has_nodes = isinstance(payload.get("nodes"), list)
        has_edges = isinstance(payload.get("edges"), list)
        has_fault_tree_id = isinstance(payload.get("faultTreeId"), str) or isinstance(payload.get("fault_tree_id"), str)

        if has_nodes and has_edges:
            result["graph_input_like"] = True
            if has_fault_tree_id:
                result["notes"].append("dict_with_faultTreeId_nodes_edges")
            else:
                result["notes"].append("dict_with_nodes_edges")

    elif isinstance(payload, list):
        if payload:
            first = payload[0]
            if isinstance(first, dict):
                first_keys = sorted(list(first.keys()))[:40]
                result["keys"] = first_keys
                has_nodes = isinstance(first.get("nodes"), list)
                has_edges = isinstance(first.get("edges"), list)
                has_fault_tree_id = isinstance(first.get("faultTreeId"), str) or isinstance(first.get("fault_tree_id"), str)

                if has_nodes and has_edges:
                    result["likely_graph_collection"] = True
                    if has_fault_tree_id:
                        result["notes"].append("list_of_graph_inputs")
                    else:
                        result["notes"].append("list_of_node_edge_dicts")
        else:
            result["notes"].append("empty_json_list")

    else:
        result["notes"].append("json_not_dict_or_list")

    return result


def walk_search_root(root: Path) -> Dict[str, Any]:
    stats = {
        "search_root": str(root),
        "dirs_visited": 0,
        "files_visited": 0,
        "phase2b_dirs": [],
        "hint_dirs": [],
        "graph_json_candidates": [],
        "graph_input_like_json": [],
        "graph_collection_json": [],
        "working_index_candidates": [],
        "readiness_candidates": [],
        "readiness_join_candidates": [],
        "subtree_extract_candidates": [],
        "xml_or_mef_models": [],
        "json_inspections": 0,
    }

    for current_root, dir_names, file_names in os.walk(root):
        current_path = Path(current_root)

        rel_depth = len(current_path.relative_to(root).parts) if current_path != root else 0
        if rel_depth > MAX_DEPTH:
            dir_names[:] = []
            continue

        dir_names[:] = [name for name in dir_names if not should_prune_dir(name)]
        stats["dirs_visited"] += 1

        current_root_str = str(current_path).lower()
        current_dir_name = current_path.name.lower()

        if "phase2b" in current_root_str:
            if len(stats["phase2b_dirs"]) < MAX_EXAMPLES_PER_BUCKET:
                stats["phase2b_dirs"].append(str(current_path))

        if contains_any_hint(current_dir_name, DIR_NAME_HINTS):
            if len(stats["hint_dirs"]) < MAX_EXAMPLES_PER_BUCKET:
                stats["hint_dirs"].append(str(current_path))

        for file_name in file_names:
            stats["files_visited"] += 1
            file_path = current_path / file_name
            file_name_lower = file_name.lower()

            if not contains_any_hint(file_name_lower, FILE_NAME_HINTS) and not contains_any_hint(str(file_path.parent).lower(), DIR_NAME_HINTS):
                continue

            labels = classify_file_path(file_path)

            if "xml_or_mef_model" in labels and len(stats["xml_or_mef_models"]) < MAX_EXAMPLES_PER_BUCKET:
                stats["xml_or_mef_models"].append(str(file_path))

            if "working_index_candidate" in labels and len(stats["working_index_candidates"]) < MAX_EXAMPLES_PER_BUCKET:
                stats["working_index_candidates"].append(str(file_path))

            if "readiness_json_candidate" in labels or "readiness_csv_candidate" in labels:
                if len(stats["readiness_candidates"]) < MAX_EXAMPLES_PER_BUCKET:
                    stats["readiness_candidates"].append(str(file_path))

            if "readiness_join_candidate" in labels and len(stats["readiness_join_candidates"]) < MAX_EXAMPLES_PER_BUCKET:
                stats["readiness_join_candidates"].append(str(file_path))

            if "subtree_or_extract_candidate" in labels and len(stats["subtree_extract_candidates"]) < MAX_EXAMPLES_PER_BUCKET:
                stats["subtree_extract_candidates"].append(str(file_path))

            if file_path.suffix.lower() == ".json":
                if len(stats["graph_json_candidates"]) < MAX_EXAMPLES_PER_BUCKET:
                    stats["graph_json_candidates"].append(str(file_path))

                if stats["json_inspections"] < MAX_JSON_INSPECTIONS:
                    inspection = inspect_json_file(file_path)
                    stats["json_inspections"] += 1

                    if inspection["graph_input_like"] and len(stats["graph_input_like_json"]) < MAX_EXAMPLES_PER_BUCKET:
                        stats["graph_input_like_json"].append(inspection)

                    if inspection["likely_graph_collection"] and len(stats["graph_collection_json"]) < MAX_EXAMPLES_PER_BUCKET:
                        stats["graph_collection_json"].append(inspection)

    return stats


def build_summary(search_results: List[Dict[str, Any]], output_run: Path) -> Dict[str, Any]:
    total_graph_inputs = sum(len(result["graph_input_like_json"]) for result in search_results)
    total_graph_collections = sum(len(result["graph_collection_json"]) for result in search_results)
    total_phase2b_dirs = sum(len(result["phase2b_dirs"]) for result in search_results)
    total_xml_models = sum(len(result["xml_or_mef_models"]) for result in search_results)
    total_working_indices = sum(len(result["working_index_candidates"]) for result in search_results)

    recommendation: Dict[str, Any] = {
        "recommended_next_seam": "undetermined",
        "reason": "No discovery signal available yet.",
    }

    all_graph_inputs: List[Dict[str, Any]] = []
    for result in search_results:
        all_graph_inputs.extend(result["graph_input_like_json"])

    if all_graph_inputs:
        recommendation = {
            "recommended_next_seam": "graph_input_export_widening",
            "reason": "At least one actual graph_input_like JSON source was found. The current package can consume graph style inputs directly.",
            "example_paths": [entry["path"] for entry in all_graph_inputs[:10]],
        }
    elif total_working_indices > 0 or total_phase2b_dirs > 0:
        recommendation = {
            "recommended_next_seam": "external_corpus_bridge_before_export_widening",
            "reason": (
                "Actual reactor scale corpus artifacts appear to exist, but no directly consumable graph_input_like JSON source "
                "was discovered. The next tranche should bridge from the external corpus artifact path into the current graph based package seam."
            ),
        }
    elif total_xml_models > 0:
        recommendation = {
            "recommended_next_seam": "xml_to_graph_or_xml_adapter_bridge",
            "reason": (
                "Potential model XML or MEF inputs were found, but the current package seam is graph based. "
                "The next tranche should build a controlled adapter path rather than widening the exporter blind."
            ),
        }

    return {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "output_run": str(output_run),
        "search_roots": [result["search_root"] for result in search_results],
        "totals": {
            "graph_input_like_json_count": total_graph_inputs,
            "graph_collection_json_count": total_graph_collections,
            "phase2b_dir_count": total_phase2b_dirs,
            "xml_or_mef_model_count": total_xml_models,
            "working_index_candidate_count": total_working_indices,
        },
        "recommendation": recommendation,
        "search_results": search_results,
    }


def write_graph_inputs_csv(path: Path, search_results: List[Dict[str, Any]]) -> None:
    rows: List[Dict[str, Any]] = []
    for result in search_results:
        for entry in result["graph_input_like_json"]:
            rows.append(
                {
                    "search_root": result["search_root"],
                    "path": entry["path"],
                    "size_bytes": entry["size_bytes"],
                    "json_loaded": entry["json_loaded"],
                    "graph_input_like": entry["graph_input_like"],
                    "likely_graph_collection": entry["likely_graph_collection"],
                    "keys": "|".join(entry["keys"]),
                    "notes": "|".join(entry["notes"]),
                }
            )

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "search_root",
                "path",
                "size_bytes",
                "json_loaded",
                "graph_input_like",
                "likely_graph_collection",
                "keys",
                "notes",
            ],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def build_readme(summary: Dict[str, Any]) -> str:
    lines: List[str] = []

    lines.append("# OpenPRA Phase 4 Real Corpus Discovery")
    lines.append("")
    lines.append(f"Generated at: {summary['generated_at']}")
    lines.append(f"Script version: {summary['script_version']}")
    lines.append(f"Run directory: {summary['output_run']}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Discover the actual reactor scale corpus facing source path for widening the bounded Phase 4 exporter."
    )
    lines.append("")
    lines.append("Totals")
    lines.append("")
    lines.append(
        f"- graph input like JSON count: {summary['totals']['graph_input_like_json_count']}"
    )
    lines.append(
        f"- graph collection JSON count: {summary['totals']['graph_collection_json_count']}"
    )
    lines.append(
        f"- Phase 2B directory count: {summary['totals']['phase2b_dir_count']}"
    )
    lines.append(
        f"- XML or MEF model count: {summary['totals']['xml_or_mef_model_count']}"
    )
    lines.append(
        f"- working index candidate count: {summary['totals']['working_index_candidate_count']}"
    )
    lines.append("")
    lines.append("Recommendation")
    lines.append("")
    lines.append(f"- next seam: {summary['recommendation']['recommended_next_seam']}")
    lines.append(f"- reason: {summary['recommendation']['reason']}")

    example_paths = summary["recommendation"].get("example_paths", [])
    if example_paths:
        lines.append("")
        lines.append("Example paths")
        lines.append("")
        for example_path in example_paths:
            lines.append(f"- {example_path}")

    lines.append("")
    lines.append("Search roots")
    lines.append("")
    for search_root in summary["search_roots"]:
        lines.append(f"- {search_root}")

    lines.append("")
    return "\n".join(lines) + "\n"


def main() -> int:
    repo_root = Path.cwd().resolve()
    output_root = repo_root / "_work" / "openpra_phase4_real_corpus_discovery_v1"
    output_run = output_root / utc_stamp()
    output_run.mkdir(parents=True, exist_ok=False)

    roots = default_search_roots(repo_root)
    search_results = [walk_search_root(root) for root in roots]

    summary = build_summary(search_results, output_run)
    summary_path = output_run / "90_real_corpus_discovery_summary.json"
    write_json(summary_path, summary)

    graph_inputs_csv_path = output_run / "91_graph_input_like_candidates.csv"
    write_graph_inputs_csv(graph_inputs_csv_path, search_results)

    readme_text = build_readme(summary)
    readme_path = output_run / "README.txt"
    write_text(readme_path, readme_text)

    manifest = write_manifest(output_run)
    manifest_path = output_run / "00_manifest.json"
    write_json(manifest_path, manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={summary_path}")
    print(f"GRAPH_INPUTS_CSV={graph_inputs_csv_path}")
    print(f"README={readme_path}")
    print(f"MANIFEST={manifest_path}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
