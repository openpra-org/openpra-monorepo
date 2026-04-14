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


SCRIPT_VERSION = "openpra-phase5-inventory-phase4-qiskit-bundle-artifacts-v1"
BATCH_ROOT = "_work/openpra_phase5_real_candidate_batch_v1"
QISKIT_BUNDLE_ROOT = "_work/openpra_phase4_qiskit_bundles_v1"
OUTPUT_ROOT = "_work/openpra_phase5_inventory_phase4_qiskit_bundle_artifacts_v1"

RESULT_HINT_TERMS = {
    "count",
    "counts",
    "sampler",
    "result",
    "results",
    "runtime",
    "job",
    "jobs",
    "measurement",
    "shots",
    "sample",
    "quasi",
    "distribution",
    "pub",
    "data_bin",
    "meas",
}

ALLOWED_SUFFIXES = {
    ".json",
    ".txt",
    ".log",
    ".csv",
    ".md",
}


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


def build_batch_model_ids(batch_run: Path) -> Set[str]:
    batch_case_dirs = sorted([path for path in batch_run.iterdir() if path.is_dir() and path.name[:4].isdigit()])
    if not batch_case_dirs:
        raise SystemExit(f"No batch case directories found in {batch_run}")

    model_ids: Set[str] = set()
    for batch_case_dir in batch_case_dirs:
        metadata = load_json(batch_case_dir / "package_metadata.json")
        model_ids.add(str(metadata["model_id"]))
    return model_ids


def file_score(path: Path, text: str, model_ids: Set[str]) -> Dict[str, Any]:
    lowered_name = path.name.lower()
    lowered_text = text.lower()

    matched_model_ids = sorted({model_id for model_id in model_ids if model_id in text})
    matched_terms = sorted({term for term in RESULT_HINT_TERMS if term in lowered_name or term in lowered_text})

    score = 0
    score += 5 * min(len(matched_model_ids), 4)
    score += len(matched_terms)
    if '"counts"' in text or "'counts'" in text or "counts" in lowered_name:
        score += 3
    if "quasi_dists" in lowered_text or "quasi_distribution" in lowered_text:
        score += 2
    if "shots" in lowered_text:
        score += 1
    if "sampler" in lowered_text:
        score += 1

    return {
        "score": score,
        "matched_model_ids": matched_model_ids,
        "matched_terms": matched_terms,
    }


def preview_lines(text: str, model_ids: Set[str], max_lines: int = 12) -> List[str]:
    out: List[str] = []
    lines = text.splitlines()

    for idx, line in enumerate(lines, start=1):
        lowered = line.lower()
        if any(model_id in line for model_id in model_ids):
            out.append(f"{idx}: {line}")
        elif "counts" in lowered or "quasi" in lowered or "shots" in lowered or "sampler" in lowered:
            out.append(f"{idx}: {line}")

        if len(out) >= max_lines:
            break

    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Inventory Phase 4 Qiskit bundle runs for counts-bearing artifacts tied to the Phase 5 batch."
    )
    parser.add_argument("--batch-run", default=None)
    parser.add_argument("--bundle-root", default=None)
    parser.add_argument(
        "--limit-runs",
        type=int,
        default=10,
        help="Maximum number of most-recent Qiskit bundle runs to inspect.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    batch_run = resolve_run(repo_root, args.batch_run, BATCH_ROOT)
    bundle_root = resolve_run(repo_root, args.bundle_root, QISKIT_BUNDLE_ROOT) if args.bundle_root else (repo_root / QISKIT_BUNDLE_ROOT).resolve()

    if not bundle_root.is_dir():
        raise SystemExit(f"Bundle root does not exist: {bundle_root}")

    model_ids = build_batch_model_ids(batch_run)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    run_dirs = sorted([path for path in bundle_root.iterdir() if path.is_dir()], reverse=True)[: args.limit_runs]
    if not run_dirs:
        raise SystemExit(f"No run directories found under {bundle_root}")

    hit_rows: List[Dict[str, Any]] = []
    run_summary_rows: List[Dict[str, Any]] = []
    model_to_paths: Dict[str, List[str]] = defaultdict(list)

    for run_dir in run_dirs:
        candidate_files = []
        for path in run_dir.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in ALLOWED_SUFFIXES:
                continue
            candidate_files.append(path)

        run_hit_count = 0
        run_best_score = 0

        for path in sorted(candidate_files):
            name_lower = path.name.lower()
            if not any(term in name_lower for term in RESULT_HINT_TERMS) and path.name != "90_qiskit_materialization_summary.json":
                continue

            text = safe_read_text(path)
            if text is None:
                continue

            scored = file_score(path, text, model_ids)
            if scored["score"] <= 0:
                continue

            previews = preview_lines(text, model_ids)
            row = {
                "run_dir": str(run_dir),
                "path": str(path),
                "score": scored["score"],
                "matched_model_ids": scored["matched_model_ids"],
                "matched_terms": scored["matched_terms"],
                "preview_lines": previews,
            }
            hit_rows.append(row)
            run_hit_count += 1
            run_best_score = max(run_best_score, int(scored["score"]))

            for model_id in scored["matched_model_ids"]:
                model_to_paths[model_id].append(str(path))

        run_summary_rows.append(
            {
                "run_dir": str(run_dir),
                "hit_file_count": run_hit_count,
                "best_score": run_best_score,
            }
        )

    hit_rows.sort(
        key=lambda row: (
            -int(row["score"]),
            -len(row["matched_model_ids"]),
            row["path"],
        )
    )

    hits_csv = output_run / "phase5_phase4_qiskit_bundle_artifact_hits.csv"
    with hits_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "run_dir",
                "path",
                "score",
                "matched_model_ids",
                "matched_terms",
                "preview_lines",
            ],
        )
        writer.writeheader()
        for row in hit_rows:
            writer.writerow(
                {
                    "run_dir": row["run_dir"],
                    "path": row["path"],
                    "score": row["score"],
                    "matched_model_ids": ";".join(row["matched_model_ids"]),
                    "matched_terms": ";".join(row["matched_terms"]),
                    "preview_lines": " || ".join(row["preview_lines"]),
                }
            )

    run_summary_csv = output_run / "phase5_phase4_qiskit_bundle_run_summary.csv"
    with run_summary_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "run_dir",
                "hit_file_count",
                "best_score",
            ],
        )
        writer.writeheader()
        for row in run_summary_rows:
            writer.writerow(row)

    model_summary_rows: List[Dict[str, Any]] = []
    for model_id in sorted(model_ids):
        paths = model_to_paths.get(model_id, [])
        model_summary_rows.append(
            {
                "model_id": model_id,
                "hit_count": len(paths),
                "top_paths": ";".join(paths[:10]),
            }
        )

    model_summary_csv = output_run / "phase5_phase4_qiskit_bundle_model_summary.csv"
    with model_summary_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "model_id",
                "hit_count",
                "top_paths",
            ],
        )
        writer.writeheader()
        for row in model_summary_rows:
            writer.writerow(row)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "batch_run": str(batch_run),
        "bundle_root": str(bundle_root),
        "counts": {
            "inspected_run_count": len(run_dirs),
            "hit_file_count": len(hit_rows),
            "models_with_hits": sum(1 for row in model_summary_rows if int(row["hit_count"]) > 0),
        },
        "outputs": {
            "hits_csv": str(hits_csv),
            "run_summary_csv": str(run_summary_csv),
            "model_summary_csv": str(model_summary_csv),
        },
    }

    write_json(output_run / "phase5_phase4_qiskit_bundle_artifact_inventory_summary.json", summary)
    write_text(
        output_run / "README.txt",
        "\n".join(
            [
                "OpenPRA Phase 5 inventory of Phase 4 Qiskit bundle artifacts",
                "",
                f"Generated at: {summary['generated_at']}",
                f"Script version: {SCRIPT_VERSION}",
                "",
                f"inspected_run_count: {summary['counts']['inspected_run_count']}",
                f"hit_file_count: {summary['counts']['hit_file_count']}",
                f"models_with_hits: {summary['counts']['models_with_hits']}",
                "",
                "Review the hits CSV to find the first concrete counts-bearing file inside the Phase 4 Qiskit bundle runs.",
                "",
            ]
        ) + "\n",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / 'phase5_phase4_qiskit_bundle_artifact_inventory_summary.json'}")
    print(f"HITS_CSV={hits_csv}")
    print(f"RUN_SUMMARY_CSV={run_summary_csv}")
    print(f"MODEL_SUMMARY_CSV={model_summary_csv}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
