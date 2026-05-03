#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


SCRIPT_VERSION = "openpra-phase5-find-probability-sources-v2"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"
LEDGER_DIR_NAME = "99_phase5_probability_master_ledger_v1"
OUTPUT_DIR_NAME = "phase5_probability_source_search_v2"

DEFAULT_SEARCH_ROOTS = [
    "/mnt/storage_array/projects/OPENPRA_DEV_v1",
    "/mnt/storage_array/projects/QPRA_DISSERTATION_v1",
    "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1",
]

ALLOWED_SUFFIXES = {
    ".xml",
    ".csv",
    ".tsv",
    ".json",
    ".txt",
    ".md",
    ".yaml",
    ".yml",
    ".log",
}

VALUE_HINT_TERMS = {
    "prob",
    "probability",
    "failure",
    "fail",
    "rate",
    "lambda",
    "unavail",
    "unavailability",
    "basic",
    "event",
    "scram",
    "openpra",
}

EXCLUDE_DIR_NAMES = {
    "_work",
    ".git",
    "node_modules",
    ".nx",
    ".venv",
    "dist",
    "build",
    "__pycache__",
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


def should_skip_path(path: Path) -> bool:
    return any(part in EXCLUDE_DIR_NAMES for part in path.parts)


def is_candidate_file(path: Path) -> bool:
    if path.suffix.lower() not in ALLOWED_SUFFIXES:
        return False
    lowered = path.name.lower()
    return any(term in lowered for term in VALUE_HINT_TERMS)


def safe_read_lines(path: Path) -> Optional[List[str]]:
    try:
        return path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return None


def context_block(lines: List[str], index: int, radius: int = 2) -> str:
    start = max(0, index - radius)
    end = min(len(lines), index + radius + 1)
    out: List[str] = []
    for i in range(start, end):
        out.append(f"{i+1}: {lines[i]}")
    return "\n".join(out)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Focused search for authoritative probability source lines excluding generated _work outputs."
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
        default=20000,
        help="Maximum number of candidate files to inspect.",
    )
    parser.add_argument(
        "--context-radius",
        type=int,
        default=2,
        help="Number of lines of context before and after a hit line.",
    )
    parser.add_argument(
        "--max-contexts-per-event",
        type=int,
        default=50,
        help="Maximum number of saved contexts per event.",
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

    hits: List[Dict[str, Any]] = []
    per_event_context_count: Dict[str, int] = defaultdict(int)
    searched_files = 0
    skipped_paths = 0

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

            lines = safe_read_lines(path)
            searched_files += 1
            if lines is None:
                continue

            for idx, line in enumerate(lines):
                for event_id in event_ids:
                    if event_id not in line:
                        continue
                    if per_event_context_count[event_id] >= args.max_contexts_per_event:
                        continue

                    block = context_block(lines, idx, radius=args.context_radius)
                    lowered_block = block.lower()

                    score = 0
                    for term in ["prob", "probability", "fail", "failure", "rate", "lambda", "unavail"]:
                        if term in lowered_block:
                            score += 1

                    hits.append(
                        {
                            "event_id": event_id,
                            "path": str(path),
                            "line_number": idx + 1,
                            "score": score,
                            "context": block,
                        }
                    )
                    per_event_context_count[event_id] += 1

        if searched_files >= args.max_files:
            break

    hits.sort(key=lambda row: (-row["score"], row["event_id"], row["path"], row["line_number"]))

    summary_rows: List[Dict[str, Any]] = []
    for event_id in event_ids:
        event_hits = [row for row in hits if row["event_id"] == event_id]
        summary_rows.append(
            {
                "basic_event_id": event_id,
                "context_count": len(event_hits),
                "high_signal_context_count": sum(1 for row in event_hits if row["score"] > 0),
                "example_paths": ";".join(sorted({row["path"] for row in event_hits})[:10]),
            }
        )

    summary_csv = output_run / "phase5_probability_source_summary_v2.csv"
    with summary_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "basic_event_id",
                "context_count",
                "high_signal_context_count",
                "example_paths",
            ],
        )
        writer.writeheader()
        for row in summary_rows:
            writer.writerow(row)

    hits_json = output_run / "phase5_probability_source_contexts_v2.json"
    write_json(
        hits_json,
        {
            "generated_at": utc_now_iso(),
            "script_version": SCRIPT_VERSION,
            "search_roots": [str(root) for root in search_roots],
            "hits": hits,
        },
    )

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "ledger_run": str(ledger_run),
        "search_roots": [str(root) for root in search_roots],
        "counts": {
            "event_count": len(event_ids),
            "searched_files": searched_files,
            "skipped_paths": skipped_paths,
            "total_contexts": len(hits),
            "events_with_contexts": sum(1 for row in summary_rows if row["context_count"] > 0),
            "events_with_high_signal_contexts": sum(1 for row in summary_rows if row["high_signal_context_count"] > 0),
        },
        "outputs": {
            "summary_csv": str(summary_csv),
            "hits_json": str(hits_json),
        },
    }

    write_json(output_run / "phase5_probability_source_search_summary_v2.json", summary)
    write_text(
        output_run / "README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 probability source search v2",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                "This pass excludes generated _work trees and focuses on value-bearing candidate files.",
                "Review the contexts JSON first for score > 0 hits.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / 'phase5_probability_source_search_summary_v2.json'}")
    print(f"SUMMARY_CSV={summary_csv}")
    print(f"HITS_JSON={hits_json}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
