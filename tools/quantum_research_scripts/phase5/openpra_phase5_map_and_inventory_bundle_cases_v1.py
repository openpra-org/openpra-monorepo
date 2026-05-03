#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


SCRIPT_VERSION = "openpra-phase5-map-and-inventory-bundle-cases-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"
OUTPUT_ROOT = "_work/openpra_phase5_map_and_inventory_bundle_cases_v1"

TEXT_SUFFIXES = {
    ".json",
    ".txt",
    ".log",
    ".md",
    ".csv",
    ".tsv",
    ".yaml",
    ".yml",
}

RESULT_TERMS = [
    "counts",
    "count",
    "quasi_dists",
    "quasi_distribution",
    "sampler",
    "shots",
    "measurement",
    "meas",
    "result",
    "results",
    "pub_result",
    "data_bin",
    "bitstring",
    "job_id",
]

SUMMARY_NAME = "90_qiskit_materialization_summary.json"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_manifest(root: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            relative = str(path.relative_to(root))
            manifest[relative] = sha256_file(path)

    sha_path = root / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as handle:
        for relative, digest in sorted(manifest.items()):
            handle.write(f"{digest}  {relative}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    return manifest


def latest_run(root: Path) -> Path:
    runs = sorted([path for path in root.glob("*") if path.is_dir()], reverse=True)
    if not runs:
        raise SystemExit(f"No runs found under {root}")
    return runs[0]


def resolve_run(repo_root: Path, explicit_path: Optional[str], default_root: str) -> Path:
    if explicit_path:
        candidate = Path(explicit_path)
        run_dir = candidate if candidate.is_absolute() else (repo_root / candidate)
        run_dir = run_dir.resolve()
        if not run_dir.is_dir():
            raise SystemExit(f"Run does not exist: {run_dir}")
        return run_dir
    return latest_run((repo_root / default_root).resolve())


def safe_read_text(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None


def preview_lines(text: str, max_lines: int = 12) -> List[str]:
    lines = text.splitlines()
    out: List[str] = []

    for idx, line in enumerate(lines, start=1):
        lowered = line.lower()
        if any(term in lowered for term in RESULT_TERMS):
            out.append(f"{idx}: {line}")
        if len(out) >= max_lines:
            break

    return out


def collect_model_ids_in_order(obj: Any, out: List[str]) -> None:
    if isinstance(obj, dict):
        model_id = obj.get("model_id")
        if isinstance(model_id, str) and model_id.startswith("phase2b_row_"):
            out.append(model_id)
        for value in obj.values():
            collect_model_ids_in_order(value, out)
        return

    if isinstance(obj, list):
        for item in obj:
            collect_model_ids_in_order(item, out)


def build_batch_model_index(batch_run: Path) -> Dict[str, Dict[str, Any]]:
    batch_case_dirs = sorted([path for path in batch_run.iterdir() if path.is_dir() and path.name[:4].isdigit()])
    if not batch_case_dirs:
        raise SystemExit(f"No batch case directories found in {batch_run}")

    index: Dict[str, Dict[str, Any]] = {}
    for batch_case_dir in batch_case_dirs:
        metadata = load_json(batch_case_dir / "package_metadata.json")
        model_id = str(metadata["model_id"])
        index[model_id] = {
            "batch_case_dir": str(batch_case_dir),
            "candidate_root_node_id": str(metadata["candidate_root_node_id"]),
            "topology_class": metadata.get("topology_class"),
            "basic_event_count": metadata.get("basic_event_count"),
            "required_qubits": metadata.get("required_qubits"),
        }
    return index


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Map batch model IDs onto numbered Phase 4 Qiskit bundle case directories and inventory those case folders for result-bearing files."
    )
    parser.add_argument("--batch-run", default=None)
    parser.add_argument("--bundle-run", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    batch_run = resolve_run(repo_root, args.batch_run, BATCH_ROOT)

    bundle_run = Path(args.bundle_run)
    bundle_run = bundle_run if bundle_run.is_absolute() else (repo_root / bundle_run)
    bundle_run = bundle_run.resolve()
    if not bundle_run.is_dir():
        raise SystemExit(f"Bundle run does not exist: {bundle_run}")

    batch_index = build_batch_model_index(batch_run)

    summary_path = bundle_run / SUMMARY_NAME
    if not summary_path.is_file():
        raise SystemExit(f"Missing bundle summary: {summary_path}")

    summary_payload = load_json(summary_path)
    model_ids_in_summary: List[str] = []
    collect_model_ids_in_order(summary_payload, model_ids_in_summary)

    numeric_case_dirs = sorted([path for path in bundle_run.iterdir() if path.is_dir() and path.name.isdigit()])

    mapping_mode = "sequence_from_materialization_summary"
    mapping_warning = ""
    if len(model_ids_in_summary) != len(numeric_case_dirs):
        mapping_warning = (
            f"model_id count {len(model_ids_in_summary)} does not match numeric case dir count {len(numeric_case_dirs)}"
        )

    pair_count = min(len(model_ids_in_summary), len(numeric_case_dirs))
    ordered_pairs: List[Tuple[str, Path]] = []
    for index in range(pair_count):
        ordered_pairs.append((model_ids_in_summary[index], numeric_case_dirs[index]))

    batch_pairs = [(model_id, case_dir) for model_id, case_dir in ordered_pairs if model_id in batch_index]

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    mapping_rows: List[Dict[str, Any]] = []
    candidate_file_rows: List[Dict[str, Any]] = []

    total_files_scanned = 0
    total_candidate_files = 0

    for model_id, case_dir in batch_pairs:
        batch_info = batch_index[model_id]

        mapping_rows.append(
            {
                "model_id": model_id,
                "bundle_case_dir": str(case_dir),
                "bundle_case_dir_name": case_dir.name,
                "batch_case_dir": batch_info["batch_case_dir"],
                "candidate_root_node_id": batch_info["candidate_root_node_id"],
                "topology_class": batch_info["topology_class"],
                "basic_event_count": batch_info["basic_event_count"],
                "required_qubits": batch_info["required_qubits"],
                "mapping_mode": mapping_mode,
                "mapping_warning": mapping_warning,
            }
        )

        for path in sorted(case_dir.rglob("*")):
            if not path.is_file():
                continue

            total_files_scanned += 1
            rel = str(path.relative_to(case_dir))
            suffix = path.suffix.lower()
            size_bytes = path.stat().st_size

            name_hits = [term for term in RESULT_TERMS if term in path.name.lower()]
            text_hits: List[str] = []
            previews: List[str] = []

            if suffix in TEXT_SUFFIXES:
                text = safe_read_text(path)
                if text is not None:
                    lowered = text.lower()
                    text_hits = [term for term in RESULT_TERMS if term in lowered]
                    if text_hits:
                        previews = preview_lines(text)

            if name_hits or text_hits:
                total_candidate_files += 1
                candidate_file_rows.append(
                    {
                        "model_id": model_id,
                        "bundle_case_dir": str(case_dir),
                        "relative_path": rel,
                        "suffix": suffix,
                        "size_bytes": size_bytes,
                        "name_hits": ";".join(sorted(set(name_hits))),
                        "text_hits": ";".join(sorted(set(text_hits))),
                        "preview_lines": " || ".join(previews),
                    }
                )

    mapping_csv = output_run / "phase5_bundle_case_mapping.csv"
    with mapping_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "model_id",
                "bundle_case_dir",
                "bundle_case_dir_name",
                "batch_case_dir",
                "candidate_root_node_id",
                "topology_class",
                "basic_event_count",
                "required_qubits",
                "mapping_mode",
                "mapping_warning",
            ],
        )
        writer.writeheader()
        for row in mapping_rows:
            writer.writerow(row)

    candidate_files_csv = output_run / "phase5_bundle_case_candidate_files.csv"
    with candidate_files_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "model_id",
                "bundle_case_dir",
                "relative_path",
                "suffix",
                "size_bytes",
                "name_hits",
                "text_hits",
                "preview_lines",
            ],
        )
        writer.writeheader()
        for row in candidate_file_rows:
            writer.writerow(row)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "bundle_run": str(bundle_run),
        "bundle_summary": str(summary_path),
        "counts": {
            "batch_model_count": len(batch_index),
            "summary_model_id_count": len(model_ids_in_summary),
            "bundle_numeric_case_dir_count": len(numeric_case_dirs),
            "mapped_batch_case_count": len(batch_pairs),
            "total_files_scanned_in_mapped_cases": total_files_scanned,
            "total_result_candidate_files": total_candidate_files,
        },
        "mapping": {
            "mode": mapping_mode,
            "warning": mapping_warning,
        },
        "outputs": {
            "mapping_csv": str(mapping_csv),
            "candidate_files_csv": str(candidate_files_csv),
        },
    }

    write_json(output_run / "phase5_bundle_case_inventory_summary.json", summary)
    write_text(
        output_run / "README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 mapped inventory of Phase 4 bundle case directories",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"mapped_batch_case_count: {summary['counts']['mapped_batch_case_count']}",
                f"total_files_scanned_in_mapped_cases: {summary['counts']['total_files_scanned_in_mapped_cases']}",
                f"total_result_candidate_files: {summary['counts']['total_result_candidate_files']}",
                "",
                "Review candidate files for any actual persisted counts or quasi-distribution payloads. If none appear, the bundle run likely preserved design artifacts but not measurement outputs.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / 'phase5_bundle_case_inventory_summary.json'}")
    print(f"MAPPING_CSV={mapping_csv}")
    print(f"CANDIDATE_FILES_CSV={candidate_files_csv}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
