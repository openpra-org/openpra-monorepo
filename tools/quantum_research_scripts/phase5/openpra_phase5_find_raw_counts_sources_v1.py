#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


SCRIPT_VERSION = "openpra-phase5-find-raw-counts-sources-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"
OUTPUT_ROOT = "_work/openpra_phase5_find_raw_counts_sources_v1"

DEFAULT_SEARCH_ROOTS = [
    "/mnt/storage_array/projects/OPENPRA_DEV_v1",
    "/mnt/storage_array/projects/QPRA_DISSERTATION_v1",
    "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1",
]

ALLOWED_SUFFIXES = {
    ".json",
    ".txt",
    ".log",
    ".md",
    ".csv",
    ".tsv",
}

EXCLUDE_DIR_NAMES = {
    ".git",
    "node_modules",
    ".nx",
    ".venv",
    "__pycache__",
}

FILENAME_HINT_TERMS = {
    "count",
    "counts",
    "sampler",
    "result",
    "results",
    "runtime",
    "job",
    "jobs",
    "qiskit",
    "measurement",
    "shots",
    "sample",
    "quasi",
    "distribution",
}

CONTENT_HINT_TERMS = {
    "\"counts\"",
    "counts",
    "quasi_dists",
    "quasi_distribution",
    "bitstring",
    "shots",
    "sampler",
    "pub_result",
    "data_bin",
    "meas",
    "register_counts",
}

BITSTRING_RE = re.compile(r'"?[01]{4,64}"?\s*[:=]\s*\d+')
MODEL_ID_RE = re.compile(r"phase2b_row_\d+")


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


def should_skip_path(path: Path) -> bool:
    return any(part in EXCLUDE_DIR_NAMES for part in path.parts)


def is_candidate_file(path: Path) -> bool:
    if path.suffix.lower() not in ALLOWED_SUFFIXES:
        return False
    name = path.name.lower()
    return any(term in name for term in FILENAME_HINT_TERMS)


def safe_read_text(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None


def build_batch_candidate_index(batch_run: Path) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    batch_case_dirs = sorted([path for path in batch_run.iterdir() if path.is_dir() and path.name[:4].isdigit()])
    if not batch_case_dirs:
        raise SystemExit(f"No batch case directories found in {batch_run}")

    for batch_case_dir in batch_case_dirs:
        metadata = load_json(batch_case_dir / "package_metadata.json")
        model_id = str(metadata["model_id"])
        out[model_id] = {
            "batch_case_dir": str(batch_case_dir),
            "model_id": model_id,
            "candidate_root_node_id": str(metadata["candidate_root_node_id"]),
            "topology_class": metadata.get("topology_class"),
            "basic_event_count": metadata.get("basic_event_count"),
            "required_qubits": metadata.get("required_qubits"),
        }

    return out


def score_text(text: str, model_ids: Set[str]) -> Dict[str, Any]:
    lowered = text.lower()

    matched_model_ids = sorted({model_id for model_id in model_ids if model_id in text})
    matched_content_terms = sorted({term for term in CONTENT_HINT_TERMS if term in lowered})
    bitstring_match_count = len(BITSTRING_RE.findall(text))
    phase2b_mentions = sorted(set(MODEL_ID_RE.findall(text)))

    score = 0
    score += 5 * min(len(matched_model_ids), 3)
    score += 2 * min(bitstring_match_count, 10)
    score += len(matched_content_terms)
    if "counts" in lowered:
        score += 2
    if "shots" in lowered:
        score += 1
    if "sampler" in lowered:
        score += 1
    if "quasi_dists" in lowered or "quasi_distribution" in lowered:
        score += 1

    return {
        "score": score,
        "matched_model_ids": matched_model_ids,
        "matched_content_terms": matched_content_terms,
        "bitstring_match_count": bitstring_match_count,
        "phase2b_mentions": phase2b_mentions,
    }


def first_lines_with_hits(text: str, model_ids: Set[str], max_lines: int = 12) -> List[str]:
    lines = text.splitlines()
    out: List[str] = []

    for idx, line in enumerate(lines, start=1):
        lowered = line.lower()
        hit = False

        if BITSTRING_RE.search(line):
            hit = True
        elif any(model_id in line for model_id in model_ids):
            hit = True
        elif any(term in lowered for term in CONTENT_HINT_TERMS):
            hit = True

        if hit:
            out.append(f"{idx}: {line}")
        if len(out) >= max_lines:
            break

    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Search likely project roots for raw counts source artifacts tied to the Phase 5 batch."
    )
    parser.add_argument("--batch-run", default=None)
    parser.add_argument(
        "--search-roots",
        nargs="*",
        default=DEFAULT_SEARCH_ROOTS,
        help="Absolute roots to search.",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=30000,
        help="Maximum number of candidate files to inspect.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()
    batch_run = resolve_run(repo_root, args.batch_run, BATCH_ROOT)

    candidate_index = build_batch_candidate_index(batch_run)
    model_ids = set(candidate_index.keys())

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    search_roots = [Path(root).resolve() for root in args.search_roots if Path(root).exists()]
    if not search_roots:
        raise SystemExit("No valid search roots exist.")

    searched_files = 0
    skipped_paths = 0
    hit_rows: List[Dict[str, Any]] = []
    per_model_hits: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for root in search_roots:
        for path in root.rglob("*"):
            if searched_files >= args.max_files:
                break
            if should_skip_path(path):
                skipped_paths += 1
                continue
            if not path.is_file():
                continue
            if not is_candidate_file(path):
                continue

            text = safe_read_text(path)
            searched_files += 1
            if text is None:
                continue

            scored = score_text(text, model_ids)
            if scored["score"] <= 0:
                continue

            preview_lines = first_lines_with_hits(text, model_ids)
            row = {
                "path": str(path),
                "score": scored["score"],
                "matched_model_ids": scored["matched_model_ids"],
                "matched_content_terms": scored["matched_content_terms"],
                "bitstring_match_count": scored["bitstring_match_count"],
                "phase2b_mentions": scored["phase2b_mentions"],
                "preview_lines": preview_lines,
            }
            hit_rows.append(row)

            for model_id in scored["matched_model_ids"]:
                per_model_hits[model_id].append(row)

        if searched_files >= args.max_files:
            break

    hit_rows.sort(
        key=lambda row: (
            -int(row["score"]),
            -len(row["matched_model_ids"]),
            -int(row["bitstring_match_count"]),
            row["path"],
        )
    )

    hits_csv = output_run / "phase5_raw_counts_source_hits.csv"
    with hits_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "path",
                "score",
                "matched_model_ids",
                "matched_content_terms",
                "bitstring_match_count",
                "phase2b_mentions",
                "preview_lines",
            ],
        )
        writer.writeheader()
        for row in hit_rows:
            writer.writerow(
                {
                    "path": row["path"],
                    "score": row["score"],
                    "matched_model_ids": ";".join(row["matched_model_ids"]),
                    "matched_content_terms": ";".join(row["matched_content_terms"]),
                    "bitstring_match_count": row["bitstring_match_count"],
                    "phase2b_mentions": ";".join(row["phase2b_mentions"]),
                    "preview_lines": " || ".join(row["preview_lines"]),
                }
            )

    model_summary_rows: List[Dict[str, Any]] = []
    for model_id, info in sorted(candidate_index.items()):
        rows = per_model_hits.get(model_id, [])
        model_summary_rows.append(
            {
                "model_id": model_id,
                "batch_case_dir": info["batch_case_dir"],
                "topology_class": info["topology_class"],
                "basic_event_count": info["basic_event_count"],
                "required_qubits": info["required_qubits"],
                "hit_count": len(rows),
                "top_hit_score": max((int(row["score"]) for row in rows), default=0),
                "top_hit_paths": ";".join(row["path"] for row in rows[:10]),
            }
        )

    model_summary_csv = output_run / "phase5_raw_counts_source_model_summary.csv"
    with model_summary_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "model_id",
                "batch_case_dir",
                "topology_class",
                "basic_event_count",
                "required_qubits",
                "hit_count",
                "top_hit_score",
                "top_hit_paths",
            ],
        )
        writer.writeheader()
        for row in model_summary_rows:
            writer.writerow(row)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "search_roots": [str(root) for root in search_roots],
        "counts": {
            "candidate_count": len(candidate_index),
            "searched_files": searched_files,
            "skipped_paths": skipped_paths,
            "hit_file_count": len(hit_rows),
            "models_with_hits": sum(1 for row in model_summary_rows if int(row["hit_count"]) > 0),
        },
        "outputs": {
            "hits_csv": str(hits_csv),
            "model_summary_csv": str(model_summary_csv),
        },
    }

    write_json(output_run / "phase5_raw_counts_source_search_summary.json", summary)
    write_text(
        output_run / "README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 raw counts source search v1",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"candidate_count: {summary['counts']['candidate_count']}",
                f"searched_files: {summary['counts']['searched_files']}",
                f"hit_file_count: {summary['counts']['hit_file_count']}",
                f"models_with_hits: {summary['counts']['models_with_hits']}",
                "",
                "Review the hit CSV first, sorted by score, to identify the first real counts-bearing artifact.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / 'phase5_raw_counts_source_search_summary.json'}")
    print(f"HITS_CSV={hits_csv}")
    print(f"MODEL_SUMMARY_CSV={model_summary_csv}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
