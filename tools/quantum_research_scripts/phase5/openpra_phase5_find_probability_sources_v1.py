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
from typing import Any, Dict, List, Optional, Set, Tuple


SCRIPT_VERSION = "openpra-phase5-find-probability-sources-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"
LEDGER_DIR_NAME = "99_phase5_probability_master_ledger_v1"
OUTPUT_DIR_NAME = "phase5_probability_source_search_v1"


DEFAULT_SEARCH_ROOTS = [
    "/mnt/storage_array/projects/OPENPRA_DEV_v1",
    "/mnt/storage_array/projects/QPRA_DISSERTATION_v1",
    "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1",
]

TEXT_FILE_SUFFIXES = {
    ".json",
    ".csv",
    ".tsv",
    ".txt",
    ".md",
    ".xml",
    ".yaml",
    ".yml",
    ".log",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def resolve_ledger_run(batch_run: Path, explicit_ledger_run: Optional[str], repo_root: Path) -> Path:
    if explicit_ledger_run:
        candidate = Path(explicit_ledger_run)
        ledger_run = candidate if candidate.is_absolute() else (repo_root / candidate)
        ledger_run = ledger_run.resolve()
        if not ledger_run.is_dir():
            raise SystemExit(f"Ledger run does not exist: {ledger_run}")
        return ledger_run

    ledger_run = (batch_run / LEDGER_DIR_NAME).resolve()
    if not ledger_run.is_dir():
        raise SystemExit(f"Default ledger directory does not exist: {ledger_run}")
    return ledger_run


def load_master_event_ids(ledger_run: Path) -> List[str]:
    master_values = ledger_run / "phase5_master_probability_values.json"
    if not master_values.exists():
        raise SystemExit(f"Missing master probability values JSON: {master_values}")

    payload = load_json(master_values)
    probabilities = payload.get("probabilities", {})
    if not isinstance(probabilities, dict) or not probabilities:
        raise SystemExit(f"Invalid or empty probabilities map in {master_values}")

    return sorted(str(key) for key in probabilities.keys())


def is_text_candidate(path: Path) -> bool:
    if path.suffix.lower() in TEXT_FILE_SUFFIXES:
        return True
    name = path.name.lower()
    return "prob" in name or "event" in name or "basic" in name or "fault" in name


def safe_read_text(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None


def extract_numeric_neighbors(line: str) -> List[str]:
    pattern = re.compile(r"[-+]?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?")
    return pattern.findall(line)


def search_one_file(path: Path, event_ids: List[str], max_lines_per_event: int) -> List[Dict[str, Any]]:
    text = safe_read_text(path)
    if text is None:
        return []

    hits: List[Dict[str, Any]] = []
    per_event_counts: Dict[str, int] = defaultdict(int)

    lines = text.splitlines()
    for line_number, line in enumerate(lines, start=1):
        lowered = line.lower()
        if "prob" not in lowered and "fail" not in lowered and "rate" not in lowered and "basic" not in lowered:
            # still allow exact event ID match
            pass

        for event_id in event_ids:
            if event_id not in line:
                continue
            if per_event_counts[event_id] >= max_lines_per_event:
                continue

            per_event_counts[event_id] += 1
            hits.append(
                {
                    "event_id": event_id,
                    "path": str(path),
                    "line_number": line_number,
                    "line_text": line.strip(),
                    "numeric_neighbors": extract_numeric_neighbors(line),
                }
            )

    return hits


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Search likely project roots for authoritative probability source lines for Phase 5 basic event IDs."
    )
    parser.add_argument("--batch-run", default=None)
    parser.add_argument("--ledger-run", default=None)
    parser.add_argument(
        "--search-roots",
        nargs="*",
        default=DEFAULT_SEARCH_ROOTS,
        help="Absolute roots to search.",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=50000,
        help="Maximum number of files to inspect before stopping.",
    )
    parser.add_argument(
        "--max-lines-per-event",
        type=int,
        default=25,
        help="Maximum hit lines recorded per event per file.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    batch_run = resolve_run(repo_root, args.batch_run, BATCH_ROOT)
    ledger_run = resolve_ledger_run(batch_run, args.ledger_run, repo_root)
    event_ids = load_master_event_ids(ledger_run)

    output_run = ledger_run / OUTPUT_DIR_NAME
    if output_run.exists():
        raise SystemExit(f"Output already exists: {output_run}")
    output_run.mkdir(parents=True, exist_ok=False)

    search_roots = [Path(root).resolve() for root in args.search_roots if Path(root).exists()]
    if not search_roots:
        raise SystemExit("No valid search roots exist.")

    all_hits: List[Dict[str, Any]] = []
    event_hit_count: Dict[str, int] = defaultdict(int)
    searched_files = 0
    skipped_files = 0

    for root in search_roots:
        for path in root.rglob("*"):
            if searched_files >= args.max_files:
                break
            if not path.is_file():
                continue
            if not is_text_candidate(path):
                skipped_files += 1
                continue

            searched_files += 1
            hits = search_one_file(path, event_ids, args.max_lines_per_event)
            if hits:
                all_hits.extend(hits)
                for hit in hits:
                    event_hit_count[hit["event_id"]] += 1
        if searched_files >= args.max_files:
            break

    summary_rows: List[Dict[str, Any]] = []
    for event_id in event_ids:
        matching_hits = [hit for hit in all_hits if hit["event_id"] == event_id]
        summary_rows.append(
            {
                "basic_event_id": event_id,
                "hit_count": len(matching_hits),
                "hit_file_count": len({hit["path"] for hit in matching_hits}),
                "example_paths": ";".join(sorted({hit["path"] for hit in matching_hits})[:10]),
            }
        )

    hits_csv = output_run / "phase5_probability_source_hits.csv"
    with hits_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "event_id",
                "path",
                "line_number",
                "line_text",
                "numeric_neighbors",
            ],
        )
        writer.writeheader()
        for hit in all_hits:
            writer.writerow(
                {
                    "event_id": hit["event_id"],
                    "path": hit["path"],
                    "line_number": hit["line_number"],
                    "line_text": hit["line_text"],
                    "numeric_neighbors": ";".join(hit["numeric_neighbors"]),
                }
            )

    summary_csv = output_run / "phase5_probability_source_event_summary.csv"
    with summary_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "basic_event_id",
                "hit_count",
                "hit_file_count",
                "example_paths",
            ],
        )
        writer.writeheader()
        for row in summary_rows:
            writer.writerow(row)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "ledger_run": str(ledger_run),
        "search_roots": [str(root) for root in search_roots],
        "counts": {
            "event_count": len(event_ids),
            "searched_files": searched_files,
            "skipped_files": skipped_files,
            "total_hits": len(all_hits),
            "events_with_hits": sum(1 for row in summary_rows if row["hit_count"] > 0),
        },
        "outputs": {
            "event_summary_csv": str(summary_csv),
            "hits_csv": str(hits_csv),
        },
    }

    write_json(output_run / "phase5_probability_source_search_summary.json", summary)
    write_text(
        output_run / "README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 probability source search v1",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"event_count: {summary['counts']['event_count']}",
                f"searched_files: {summary['counts']['searched_files']}",
                f"total_hits: {summary['counts']['total_hits']}",
                f"events_with_hits: {summary['counts']['events_with_hits']}",
                "",
                "Review the hit CSV for lines that appear to contain authoritative probability or failure-rate values for the 13 batch event IDs.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / 'phase5_probability_source_search_summary.json'}")
    print(f"EVENT_SUMMARY_CSV={summary_csv}")
    print(f"HITS_CSV={hits_csv}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
