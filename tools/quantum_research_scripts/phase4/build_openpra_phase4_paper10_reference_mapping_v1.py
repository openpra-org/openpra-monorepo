#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


SCRIPT_VERSION = "phase4-paper10-reference-mapping-v1"
ROW_LOOKUP_ROOT = "_work/openpra_phase4_phase2b_row_lookup_v1"
OUTPUT_ROOT = "_work/openpra_phase4_reference_mapping_v1"
DEFAULT_PER_INSTANCE_ROOT = (
    "/mnt/cluster_production/projects/QPRA_DISSERTATION_v1/"
    "Paper10/Artifacts/PAPER10_PHASEA_CIRCUITS_v3_20260303_202241Z/"
    "derived/per_instance"
)


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


def resolve_run(repo_root: Path, explicit_path: Optional[str], default_root: str) -> Path:
    if explicit_path:
        candidate = Path(explicit_path)
        run_dir = candidate if candidate.is_absolute() else (repo_root / candidate)
        run_dir = run_dir.resolve()
        if not run_dir.is_dir():
            raise SystemExit(f"Run does not exist: {run_dir}")
        return run_dir
    return latest_run((repo_root / default_root).resolve())


def parse_row_id(model_id: str) -> str:
    prefix = "phase2b_row_"
    if not model_id.startswith(prefix):
        raise SystemExit(f"Unexpected model_id format: {model_id}")
    return model_id[len(prefix):]


def find_reference_case_dir(per_instance_root: Path, raw_row_id: str) -> Optional[Path]:
    candidates: List[str] = []
    if raw_row_id not in candidates:
        candidates.append(raw_row_id)

    zero_padded_4 = raw_row_id.zfill(4)
    if zero_padded_4 not in candidates:
        candidates.append(zero_padded_4)

    for candidate in candidates:
        case_dir = per_instance_root / candidate
        if (case_dir / "qubo_model_v1.json").exists():
            return case_dir.resolve()

    return None


def write_mapping_csv(path: Path, rows: List[Dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["model_id", "reference_case_dir"])
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def build_readme(
    output_run: Path,
    row_lookup_run: Path,
    per_instance_root: Path,
    matched_count: int,
    missing_count: int,
) -> str:
    lines: List[str] = []
    lines.append("# OpenPRA Phase 4 Paper10 Reference Mapping")
    lines.append("")
    lines.append(f"Run directory: {output_run}")
    lines.append(f"Generated at: {utc_now_iso()}")
    lines.append(f"Script version: {SCRIPT_VERSION}")
    lines.append(f"Row lookup run: {row_lookup_run}")
    lines.append(f"Paper10 per_instance root: {per_instance_root}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Build a strict reference_mapping_csv for direct comparison between the current OpenPRA packaged cohort and frozen Paper10 per_instance qubo_model_v1.json artifacts."
    )
    lines.append("")
    lines.append("Counts")
    lines.append("")
    lines.append(f"- matched_count: {matched_count}")
    lines.append(f"- missing_count: {missing_count}")
    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "Only rows with a direct per_instance directory containing qubo_model_v1.json are included in the mapping CSV. Missing rows are preserved in the summary for audit review."
    )
    lines.append("")
    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a strict reference mapping CSV from a Phase 4 row lookup run to frozen Paper10 per_instance qubo_model_v1.json artifacts."
    )
    parser.add_argument(
        "--row-lookup-run",
        dest="row_lookup_run",
        default=None,
        help="Optional repo-relative or absolute row lookup run directory. Default: latest.",
    )
    parser.add_argument(
        "--per-instance-root",
        dest="per_instance_root",
        default=DEFAULT_PER_INSTANCE_ROOT,
        help="Frozen Paper10 per_instance root containing qubo_model_v1.json case directories.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    row_lookup_run = resolve_run(repo_root, args.row_lookup_run, ROW_LOOKUP_ROOT)
    per_instance_root = Path(args.per_instance_root).resolve()
    if not per_instance_root.is_dir():
        raise SystemExit(f"Per-instance root does not exist: {per_instance_root}")

    summary_path = row_lookup_run / "90_phase4_phase2b_row_lookup_summary.json"
    if not summary_path.exists():
        raise SystemExit(f"Row lookup summary does not exist: {summary_path}")

    row_lookup_summary = load_json(summary_path)
    rows = row_lookup_summary.get("rows", [])
    if not isinstance(rows, list) or not rows:
        raise SystemExit(f"No rows found in row lookup summary: {summary_path}")

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    mapping_rows: List[Dict[str, str]] = []
    matched: List[Dict[str, Any]] = []
    missing: List[Dict[str, Any]] = []

    for row in rows:
        model_id = str(row["model_id"])
        raw_row_id = parse_row_id(model_id)
        reference_case_dir = find_reference_case_dir(per_instance_root, raw_row_id)

        if reference_case_dir is None:
            missing.append(
                {
                    "model_id": model_id,
                    "raw_row_id": raw_row_id,
                    "package_candidate_root_node_id": row.get("package_candidate_root_node_id"),
                    "package_gate_name_normalized": row.get("package_gate_name_normalized"),
                    "package_basic_event_count": row.get("package_basic_event_count"),
                    "reason": "no_direct_per_instance_qubo_model_v1_match",
                }
            )
            continue

        mapping_rows.append(
            {
                "model_id": model_id,
                "reference_case_dir": str(reference_case_dir),
            }
        )

        matched.append(
            {
                "model_id": model_id,
                "raw_row_id": raw_row_id,
                "reference_case_dir": str(reference_case_dir),
                "reference_qubo_model_v1": str(reference_case_dir / "qubo_model_v1.json"),
                "reference_logical_p1_qpy_exists": (reference_case_dir / "logical_p1_v1.qpy").exists(),
            }
        )

    mapping_csv_path = output_run / "paper10_reference_mapping.csv"
    mapping_summary_path = output_run / "paper10_reference_mapping_summary.json"

    write_mapping_csv(mapping_csv_path, mapping_rows)
    write_json(
        mapping_summary_path,
        {
            "generated_at": utc_now_iso(),
            "script_version": SCRIPT_VERSION,
            "row_lookup_run": str(row_lookup_run),
            "per_instance_root": str(per_instance_root),
            "mapping_csv": str(mapping_csv_path),
            "matched_count": len(matched),
            "missing_count": len(missing),
            "matched": matched,
            "missing": missing,
        },
    )
    (output_run / "README.txt").write_text(
        build_readme(
            output_run=output_run,
            row_lookup_run=row_lookup_run,
            per_instance_root=per_instance_root,
            matched_count=len(matched),
            missing_count=len(missing),
        ),
        encoding="utf-8",
    )

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    print(f"OUTPUT_RUN={output_run}")
    print(f"MAPPING_CSV={mapping_csv_path}")
    print(f"SUMMARY={mapping_summary_path}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")
    print(f"MATCHED_COUNT={len(matched)}")
    print(f"MISSING_COUNT={len(missing)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
