#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


SCRIPT_VERSION = "phase4-frozen-reference-locator-v2"
ROW_LOOKUP_ROOT = "_work/openpra_phase4_phase2b_row_lookup_v1"
OUTPUT_ROOT = "_work/openpra_phase4_frozen_reference_locator_v1"

DEFAULT_SEARCH_ROOTS = [
    "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper8",
    "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/Paper10",
    "/mnt/storage_array/projects/QPRA_DISSERTATION_v1/Paper8",
    "/mnt/storage_array/projects/QPRA_DISSERTATION_v1/Paper10",
    "/mnt/storage_array/projects/QPRA_POSTTHESIS_v1/Paper14",
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


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


def latest_run(root: Path) -> Path:
    runs = sorted([path for path in root.glob("*") if path.is_dir()], reverse=True)
    if not runs:
        raise SystemExit(f"No runs found under {root}")
    return runs[0]


def resolve_run(repo_root: Path, explicit_path: str | None, default_root: str) -> Path:
    if explicit_path:
        candidate = Path(explicit_path)
        run_dir = candidate if candidate.is_absolute() else (repo_root / candidate)
        run_dir = run_dir.resolve()
        if not run_dir.is_dir():
            raise SystemExit(f"Run does not exist: {run_dir}")
        return run_dir
    return latest_run((repo_root / default_root).resolve())


def grep_list(pattern: str, roots: List[Path]) -> List[Path]:
    existing_roots = [str(root) for root in roots if root.exists()]
    if not existing_roots:
        return []

    cmd = [
        "grep",
        "-RIl",
        "--binary-files=without-match",
        "--include=*.json",
        "--include=*.csv",
        "--include=*.md",
        "--include=*.txt",
        pattern,
        *existing_roots,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode not in (0, 1):
        raise SystemExit(f"grep failed for pattern {pattern!r}: {proc.stderr}")

    out: List[Path] = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if line:
            out.append(Path(line))
    return out


def file_contains_all(path: Path, required_tokens: List[str]) -> bool:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return False
    return all(token in text for token in required_tokens)


def write_hits_csv(path: Path, rows: List[Dict[str, Any]]) -> None:
    fieldnames = [
        "model_id",
        "phase2b_data_row_index_1based",
        "xml_path",
        "xml_basename",
        "gate_name",
        "subtree_basic_count",
        "matched_file",
        "matched_parent_dir",
        "search_root",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def build_readme(
    output_run: Path,
    row_lookup_run: Path,
    searched_models: int,
    models_with_hits: int,
    total_hits: int,
    search_roots: List[Path],
) -> str:
    lines: List[str] = []
    lines.append("# OpenPRA Phase 4 Frozen Reference Locator")
    lines.append("")
    lines.append(f"Run directory: {output_run}")
    lines.append(f"Generated at: {utc_now_iso()}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append(f"Row lookup source run: {row_lookup_run}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Locate candidate frozen-reference files under the Paper 8 and Paper 10 roots using the confirmed Phase2B row lookup seed."
    )
    lines.append("")
    lines.append("Counts")
    lines.append("")
    lines.append(f"- searched models: {searched_models}")
    lines.append(f"- models with at least one hit: {models_with_hits}")
    lines.append(f"- total file hits: {total_hits}")
    lines.append("")
    lines.append("Search roots")
    lines.append("")
    for root in search_roots:
        lines.append(f"- {root}")
    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "This locator does not claim identity by itself. It narrows the Paper 8 and Paper 10 artifact roots down to concrete candidate files and parent directories so the next step can emit a reference_mapping_csv for external validation."
    )
    lines.append("")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Locate candidate frozen-reference hits for packaged Phase 4 models under Paper 8 and Paper 10 roots."
    )
    parser.add_argument(
        "--row-lookup-run",
        dest="row_lookup_run",
        default=None,
        help="Optional repo-relative or absolute Phase2B row lookup run directory. Default: latest.",
    )
    parser.add_argument(
        "--limit",
        dest="limit",
        type=int,
        default=60,
        help="Maximum number of reference rows to search. Default: 60.",
    )
    parser.add_argument(
        "--max-hits-per-model",
        dest="max_hits_per_model",
        type=int,
        default=10,
        help="Maximum number of file hits to keep per model. Default: 10.",
    )
    parser.add_argument(
        "--search-root",
        dest="search_roots",
        action="append",
        default=[],
        help="Additional search roots. May be specified multiple times.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    row_lookup_run = resolve_run(repo_root, args.row_lookup_run, ROW_LOOKUP_ROOT)
    seed_path = row_lookup_run / "92_phase4_phase2b_reference_seed.json"
    if not seed_path.exists():
        raise SystemExit(f"Reference seed does not exist: {seed_path}")

    seed = load_json(seed_path)
    reference_rows = list(seed.get("reference_rows", []))
    if not reference_rows:
        raise SystemExit("Reference seed has no reference_rows")

    reference_rows = reference_rows[: args.limit]

    search_roots = [Path(p).resolve() for p in DEFAULT_SEARCH_ROOTS]
    search_roots.extend(Path(p).resolve() for p in args.search_roots)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    hit_rows: List[Dict[str, Any]] = []
    per_model_summary: List[Dict[str, Any]] = []

    for ref in reference_rows:
        model_id = ref["model_id"]
        xml_path = ref["xml_path"]
        xml_basename = Path(xml_path).name
        gate_name = ref["gate_name"]
        subtree_basic_count = int(ref["subtree_basic_count"])

        initial_hits = grep_list(xml_basename, search_roots)

        filtered_hits: List[Path] = []
        for path in initial_hits:
            if file_contains_all(path, [xml_basename, gate_name]):
                filtered_hits.append(path)
            if len(filtered_hits) >= args.max_hits_per_model:
                break

        per_model_summary.append(
            {
                "model_id": model_id,
                "phase2b_data_row_index_1based": ref["phase2b_data_row_index_1based"],
                "xml_basename": xml_basename,
                "gate_name": gate_name,
                "subtree_basic_count": subtree_basic_count,
                "hit_count": len(filtered_hits),
            }
        )

        for path in filtered_hits:
            matched_root = None
            for root in search_roots:
                try:
                    path.relative_to(root)
                    matched_root = str(root)
                    break
                except ValueError:
                    continue

            hit_rows.append(
                {
                    "model_id": model_id,
                    "phase2b_data_row_index_1based": ref["phase2b_data_row_index_1based"],
                    "xml_path": xml_path,
                    "xml_basename": xml_basename,
                    "gate_name": gate_name,
                    "subtree_basic_count": subtree_basic_count,
                    "matched_file": str(path),
                    "matched_parent_dir": str(path.parent),
                    "search_root": matched_root or "unknown",
                }
            )

    models_with_hits = sum(1 for row in per_model_summary if row["hit_count"] > 0)

    summary_payload = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "row_lookup_run": str(row_lookup_run),
        "searched_models": len(reference_rows),
        "models_with_hits": models_with_hits,
        "total_file_hits": len(hit_rows),
        "per_model_summary": per_model_summary,
        "search_roots": [str(root) for root in search_roots],
    }

    write_json(output_run / "90_phase4_frozen_reference_locator_summary.json", summary_payload)
    write_hits_csv(output_run / "91_phase4_frozen_reference_locator_hits.csv", hit_rows)
    write_json(output_run / "92_phase4_frozen_reference_locator_hits.json", {"hits": hit_rows})

    (output_run / "README.txt").write_text(
        build_readme(
            output_run=output_run,
            row_lookup_run=row_lookup_run,
            searched_models=len(reference_rows),
            models_with_hits=models_with_hits,
            total_hits=len(hit_rows),
            search_roots=search_roots,
        ),
        encoding="utf-8",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / '90_phase4_frozen_reference_locator_summary.json'}")
    print(f"HITS_CSV={output_run / '91_phase4_frozen_reference_locator_hits.csv'}")
    print(f"HITS_JSON={output_run / '92_phase4_frozen_reference_locator_hits.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
