#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

SCRIPT_VERSION = "openpra-phase5-deep-inventory-qiskit-run-v1"
OUTPUT_ROOT = "_work/openpra_phase5_deep_inventory_qiskit_run_v1"

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

CONTENT_TERMS = [
    "counts",
    "quasi_dists",
    "quasi_distribution",
    "sampler",
    "shots",
    "meas",
    "measurement",
    "pub_result",
    "data_bin",
    "result",
    "job_id",
]

NAME_TERMS = [
    "count",
    "counts",
    "result",
    "results",
    "runtime",
    "sampler",
    "job",
    "jobs",
    "shots",
    "measurement",
    "quasi",
    "sample",
    "pub",
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


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
        if any(term in lowered for term in CONTENT_TERMS):
            out.append(f"{idx}: {line}")
        if len(out) >= max_lines:
            break

    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Deep inventory selected Qiskit bundle run directories without filename filtering."
    )
    parser.add_argument(
        "--run-dirs",
        nargs="+",
        required=True,
        help="One or more repo-relative or absolute Qiskit bundle run directories to inspect.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    resolved_run_dirs: List[Path] = []
    for item in args.run_dirs:
        p = Path(item)
        p = p if p.is_absolute() else (repo_root / p)
        p = p.resolve()
        if not p.is_dir():
            raise SystemExit(f"Run directory does not exist: {p}")
        resolved_run_dirs.append(p)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    all_file_rows: List[Dict[str, Any]] = []
    candidate_rows: List[Dict[str, Any]] = []
    run_summary_rows: List[Dict[str, Any]] = []

    for run_dir in resolved_run_dirs:
        file_count = 0
        candidate_count = 0

        for path in sorted(run_dir.rglob("*")):
            if not path.is_file():
                continue

            rel = str(path.relative_to(run_dir))
            suffix = path.suffix.lower()
            size_bytes = path.stat().st_size
            file_count += 1

            name_lower = path.name.lower()
            name_hits = [term for term in NAME_TERMS if term in name_lower]

            text_hits: List[str] = []
            preview: List[str] = []
            text_read_ok = False

            if suffix in TEXT_SUFFIXES:
                text = safe_read_text(path)
                if text is not None:
                    text_read_ok = True
                    lowered = text.lower()
                    text_hits = [term for term in CONTENT_TERMS if term in lowered]
                    if text_hits:
                        preview = preview_lines(text)

            row = {
                "run_dir": str(run_dir),
                "relative_path": rel,
                "suffix": suffix,
                "size_bytes": size_bytes,
                "name_hits": ";".join(sorted(set(name_hits))),
                "text_read_ok": text_read_ok,
                "text_hits": ";".join(sorted(set(text_hits))),
            }
            all_file_rows.append(row)

            if name_hits or text_hits:
                candidate_count += 1
                candidate_rows.append(
                    {
                        "run_dir": str(run_dir),
                        "relative_path": rel,
                        "suffix": suffix,
                        "size_bytes": size_bytes,
                        "name_hits": ";".join(sorted(set(name_hits))),
                        "text_hits": ";".join(sorted(set(text_hits))),
                        "preview_lines": " || ".join(preview),
                    }
                )

        run_summary_rows.append(
            {
                "run_dir": str(run_dir),
                "file_count": file_count,
                "candidate_file_count": candidate_count,
            }
        )

    files_csv = output_run / "phase5_deep_inventory_all_files.csv"
    with files_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "run_dir",
                "relative_path",
                "suffix",
                "size_bytes",
                "name_hits",
                "text_read_ok",
                "text_hits",
            ],
        )
        writer.writeheader()
        for row in all_file_rows:
            writer.writerow(row)

    candidates_csv = output_run / "phase5_deep_inventory_candidate_files.csv"
    with candidates_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "run_dir",
                "relative_path",
                "suffix",
                "size_bytes",
                "name_hits",
                "text_hits",
                "preview_lines",
            ],
        )
        writer.writeheader()
        for row in candidate_rows:
            writer.writerow(row)

    run_summary_csv = output_run / "phase5_deep_inventory_run_summary.csv"
    with run_summary_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "run_dir",
                "file_count",
                "candidate_file_count",
            ],
        )
        writer.writeheader()
        for row in run_summary_rows:
            writer.writerow(row)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "run_dirs": [str(p) for p in resolved_run_dirs],
        "counts": {
            "run_count": len(resolved_run_dirs),
            "total_file_count": len(all_file_rows),
            "total_candidate_file_count": len(candidate_rows),
        },
        "outputs": {
            "all_files_csv": str(files_csv),
            "candidate_files_csv": str(candidates_csv),
            "run_summary_csv": str(run_summary_csv),
        },
    }

    write_json(output_run / "phase5_deep_inventory_summary.json", summary)
    write_text(
        output_run / "README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 deep inventory of selected Qiskit bundle runs",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"run_count: {summary['counts']['run_count']}",
                f"total_file_count: {summary['counts']['total_file_count']}",
                f"total_candidate_file_count: {summary['counts']['total_candidate_file_count']}",
                "",
                "If candidate_file_count is still tiny and only summaries show up, then the bundle runs likely do not contain persisted measurement result payloads.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / 'phase5_deep_inventory_summary.json'}")
    print(f"ALL_FILES_CSV={files_csv}")
    print(f"CANDIDATES_CSV={candidates_csv}")
    print(f"RUN_SUMMARY_CSV={run_summary_csv}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
