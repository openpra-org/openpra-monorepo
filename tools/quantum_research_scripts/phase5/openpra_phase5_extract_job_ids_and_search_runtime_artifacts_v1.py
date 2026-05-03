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


SCRIPT_VERSION = "openpra-phase5-extract-job-ids-and-search-runtime-artifacts-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"
OUTPUT_ROOT = "_work/openpra_phase5_extract_job_ids_and_search_runtime_artifacts_v1"

DEFAULT_SEARCH_ROOTS = [
    "/mnt/storage_array/projects/OPENPRA_DEV_v1",
    "/mnt/storage_array/projects/QPRA_DISSERTATION_v1",
    "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1",
]

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

JOB_HINT_TERMS = [
    "job_id",
    "jobid",
    "runtime",
    "sampler",
    "ibm",
    "result",
    "results",
    "counts",
    "quasi",
    "pub_result",
    "data_bin",
]


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


def flatten_strings(obj: Any, out: List[str]) -> None:
    if isinstance(obj, dict):
        for key, value in obj.items():
            out.append(str(key))
            flatten_strings(value, out)
        return
    if isinstance(obj, list):
        for item in obj:
            flatten_strings(item, out)
        return
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        out.append(str(obj))


def maybe_job_id(token: str) -> bool:
    t = token.strip()
    if len(t) < 8:
        return False
    if " " in t:
        return False
    if any(ch in t for ch in "{}[](),"):
        return False
    alnum = sum(ch.isalnum() for ch in t)
    return alnum >= 8


def extract_jobish_strings_from_json(path: Path) -> List[str]:
    try:
        payload = load_json(path)
    except Exception:
        return []

    strings: List[str] = []
    flatten_strings(payload, strings)

    out: Set[str] = set()
    for s in strings:
        lowered = s.lower()
        if any(term in lowered for term in ["job", "runtime", "sampler", "ibm", "session"]):
            cleaned = s.strip()
            if maybe_job_id(cleaned):
                out.add(cleaned)

    return sorted(out)


def preview_lines(text: str, needles: List[str], max_lines: int = 12) -> List[str]:
    lines = text.splitlines()
    out: List[str] = []
    for idx, line in enumerate(lines, start=1):
        lowered = line.lower()
        if any(needle in line for needle in needles) or any(term in lowered for term in JOB_HINT_TERMS):
            out.append(f"{idx}: {line}")
        if len(out) >= max_lines:
            break
    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract likely runtime/job identifiers from mapped Phase 4 case files and search project roots for matching result artifacts."
    )
    parser.add_argument("--batch-run", default=None)
    parser.add_argument("--bundle-run", required=True)
    parser.add_argument(
        "--search-roots",
        nargs="*",
        default=DEFAULT_SEARCH_ROOTS,
        help="Absolute roots to search.",
    )
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

    batch_case_dirs = sorted([path for path in batch_run.iterdir() if path.is_dir() and path.name[:4].isdigit()])
    if not batch_case_dirs:
        raise SystemExit(f"No batch case directories found in {batch_run}")

    batch_model_ids = {str(load_json(path / "package_metadata.json")["model_id"]) for path in batch_case_dirs}

    mapped_case_dirs = sorted([path for path in bundle_run.iterdir() if path.is_dir() and path.name.isdigit()])

    extracted_rows: List[Dict[str, Any]] = []
    all_jobish_strings: Set[str] = set()

    for case_dir in mapped_case_dirs:
        for path in sorted(case_dir.rglob("*.json")):
            values = extract_jobish_strings_from_json(path)
            if not values:
                continue
            for value in values:
                all_jobish_strings.add(value)
                extracted_rows.append(
                    {
                        "bundle_case_dir": str(case_dir),
                        "json_path": str(path),
                        "extracted_value": value,
                    }
                )

    search_roots = [Path(root).resolve() for root in args.search_roots if Path(root).exists()]
    hit_rows: List[Dict[str, Any]] = []
    searched_file_count = 0

    for root in search_roots:
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in TEXT_SUFFIXES:
                continue

            text = safe_read_text(path)
            searched_file_count += 1
            if text is None:
                continue

            matched_values = sorted([value for value in all_jobish_strings if value in text])
            lowered = text.lower()
            term_hits = [term for term in JOB_HINT_TERMS if term in lowered]

            if not matched_values and not term_hits:
                continue

            score = 0
            score += 10 * min(len(matched_values), 3)
            score += len(term_hits)

            hit_rows.append(
                {
                    "path": str(path),
                    "score": score,
                    "matched_values": matched_values,
                    "term_hits": term_hits,
                    "preview_lines": preview_lines(text, matched_values),
                }
            )

    hit_rows.sort(key=lambda row: (-int(row["score"]), row["path"]))

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    extracted_csv = output_run / "phase5_extracted_jobish_values.csv"
    with extracted_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "bundle_case_dir",
                "json_path",
                "extracted_value",
            ],
        )
        writer.writeheader()
        for row in extracted_rows:
            writer.writerow(row)

    hits_csv = output_run / "phase5_runtime_artifact_hits.csv"
    with hits_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "path",
                "score",
                "matched_values",
                "term_hits",
                "preview_lines",
            ],
        )
        writer.writeheader()
        for row in hit_rows:
            writer.writerow(
                {
                    "path": row["path"],
                    "score": row["score"],
                    "matched_values": ";".join(row["matched_values"]),
                    "term_hits": ";".join(row["term_hits"]),
                    "preview_lines": " || ".join(row["preview_lines"]),
                }
            )

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "bundle_run": str(bundle_run),
        "counts": {
            "batch_model_count": len(batch_model_ids),
            "mapped_numeric_case_dir_count": len(mapped_case_dirs),
            "extracted_jobish_value_count": len(all_jobish_strings),
            "searched_file_count": searched_file_count,
            "runtime_hit_file_count": len(hit_rows),
        },
        "outputs": {
            "extracted_csv": str(extracted_csv),
            "hits_csv": str(hits_csv),
        },
    }

    write_json(output_run / "phase5_runtime_artifact_search_summary.json", summary)
    write_text(
        output_run / "README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 runtime artifact search from mapped Phase 4 cases",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"extracted_jobish_value_count: {summary['counts']['extracted_jobish_value_count']}",
                f"runtime_hit_file_count: {summary['counts']['runtime_hit_file_count']}",
                "",
                "If extracted_jobish_value_count is zero, the Phase 4 bundle cases likely never preserved runtime identifiers and we should pivot to submission or harvester scripts directly.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / 'phase5_runtime_artifact_search_summary.json'}")
    print(f"EXTRACTED_CSV={extracted_csv}")
    print(f"HITS_CSV={hits_csv}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
