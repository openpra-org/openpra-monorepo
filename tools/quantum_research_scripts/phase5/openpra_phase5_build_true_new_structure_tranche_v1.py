#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
DEFAULT_SOURCE_SELECTION_RUN = ROOT / "_work" / "openpra_phase5_select_unique_tuned_export_candidates_v1" / "20260414_024246Z"
DEFAULT_OUTPUT_ROOT = ROOT / "_work" / "openpra_phase5_true_new_structure_tranche_v1"
SCRIPT_VERSION = "openpra-phase5-build-true-new-structure-tranche-v1"


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
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifest(root: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            manifest[str(path.relative_to(root))] = sha256_file(path)

    sha_path = root / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as f:
        for rel, digest in sorted(manifest.items()):
            f.write(f"{digest}  {rel}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    write_json(root / "00_manifest.json", manifest)
    return manifest


def read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: List[Dict[str, Any]], fieldnames: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


def as_int(value: str) -> int:
    try:
        return int(value)
    except Exception:
        return -1


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Build the true-new-structure Phase 5 tranche by removing selected cases that duplicate already-accepted structure families."
    )
    ap.add_argument("--source-selection-run", default=str(DEFAULT_SOURCE_SELECTION_RUN))
    ap.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    args = ap.parse_args()

    source_selection_run = Path(args.source_selection_run).resolve()
    output_root = Path(args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    selected_csv = source_selection_run / "selected_next_unique_tuned_export_candidates.csv"
    accepted_csv = source_selection_run / "accepted_executed_structures.csv"

    if not selected_csv.exists():
        raise SystemExit(f"Missing selected CSV: {selected_csv}")
    if not accepted_csv.exists():
        raise SystemExit(f"Missing accepted structures CSV: {accepted_csv}")

    selected_rows = read_csv(selected_csv)
    accepted_rows = read_csv(accepted_csv)

    accepted_hashes = {
        row["structure_sha256"].strip()
        for row in accepted_rows
        if row.get("structure_sha256", "").strip()
    }

    kept_rows: List[Dict[str, Any]] = []
    dropped_rows: List[Dict[str, Any]] = []

    for row in selected_rows:
        structure_sha = row.get("structure_sha256", "").strip()
        is_duplicate = structure_sha in accepted_hashes

        # Quality gate for this tranche: nontrivial size and matched matrix entry.
        has_nontrivial_size = as_int(row.get("basic_event_count", "")) >= 5
        has_matrix_match = row.get("matrix_entry_matched", "").strip() == "True"

        normalized = dict(row)

        if is_duplicate:
            normalized["drop_reason"] = "duplicates_already_accepted_structure_family"
            dropped_rows.append(normalized)
            continue

        if not has_nontrivial_size:
            normalized["drop_reason"] = "too_small_for_paper_strengthening_tranche"
            dropped_rows.append(normalized)
            continue

        if not has_matrix_match:
            normalized["drop_reason"] = "matrix_entry_not_matched"
            dropped_rows.append(normalized)
            continue

        kept_rows.append(normalized)

    kept_rows.sort(key=lambda r: as_int(r.get("selected_rank", "999999")))
    for idx, row in enumerate(kept_rows, start=1):
        row["true_new_rank"] = idx

    stamp = utc_stamp()
    out_dir = output_root / stamp
    out_dir.mkdir(parents=True, exist_ok=False)

    tranche_dir = out_dir / "selected_tuned_exports"
    tranche_dir.mkdir(parents=True, exist_ok=True)

    materialized_rows: List[Dict[str, Any]] = []
    for row in kept_rows:
        src = Path(row["source_export_file"])
        target_subdir = tranche_dir / f"{int(row['true_new_rank']):04d}_{row['export_run_case_id']}_{row['model_id']}_{row['candidate_root_node_id'].replace(':', '_')}"
        target_subdir.mkdir(parents=True, exist_ok=True)
        copy_file(src, target_subdir / src.name)

        normalized = dict(row)
        normalized["selected_dir"] = str(target_subdir)
        materialized_rows.append(normalized)

    kept_fieldnames = [
        "true_new_rank",
        "selected_rank",
        "selected_dir",
        "source_export_file",
        "export_run_case_id",
        "model_id",
        "candidate_root_node_id",
        "candidate_root_gate_type",
        "topology_class",
        "basic_event_count",
        "required_qubits",
        "minimal_cut_set_count",
        "feasible_basis_state_count",
        "execution_priority",
        "matrix_entry_matched",
        "structure_sha256",
        "structure_signature",
        "basic_event_ids",
    ]

    dropped_fieldnames = [
        "selected_rank",
        "source_export_file",
        "export_run_case_id",
        "model_id",
        "candidate_root_node_id",
        "topology_class",
        "basic_event_count",
        "required_qubits",
        "minimal_cut_set_count",
        "feasible_basis_state_count",
        "execution_priority",
        "matrix_entry_matched",
        "structure_sha256",
        "structure_signature",
        "basic_event_ids",
        "drop_reason",
    ]

    write_csv(out_dir / "true_new_structure_selected_cases.csv", materialized_rows, kept_fieldnames)
    write_csv(out_dir / "dropped_selected_cases.csv", dropped_rows, dropped_fieldnames)

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "source_selection_run": str(source_selection_run),
        "source_selected_csv": str(selected_csv),
        "source_accepted_csv": str(accepted_csv),
        "kept_count": len(materialized_rows),
        "dropped_count": len(dropped_rows),
        "selection_rule": "keep only selected tuned-export candidates whose structure_sha256 is not present in the accepted executed set, with basic_event_count >= 5 and matrix_entry_matched == True",
        "kept_cases": materialized_rows,
        "selected_dir": str(tranche_dir),
    }
    write_json(out_dir / "summary.json", summary)

    lines = [
        "OpenPRA Phase 5 true-new-structure tranche",
        "",
        f"generated_at: {summary['generated_at']}",
        f"kept_count: {len(materialized_rows)}",
        f"dropped_count: {len(dropped_rows)}",
        "",
        "Kept cases:",
    ]
    for row in materialized_rows:
        lines.append(
            f"  rank={row['true_new_rank']}  model={row['model_id']}  "
            f"root={row['candidate_root_node_id']}  topology={row['topology_class']}  "
            f"n={row['basic_event_count']}  q={row['required_qubits']}  "
            f"mcs={row['minimal_cut_set_count']}  matrix_match={row['matrix_entry_matched']}"
        )

    lines.append("")
    lines.append("Dropped cases:")
    for row in dropped_rows:
        lines.append(
            f"  model={row['model_id']}  root={row['candidate_root_node_id']}  "
            f"topology={row['topology_class']}  drop_reason={row['drop_reason']}"
        )
    lines.append("")
    write_text(out_dir / "README.txt", "\n".join(lines))

    write_manifest(out_dir)

    print(f"OUTDIR={out_dir}")
    print(f"SUMMARY={out_dir / 'summary.json'}")
    print(f"README={out_dir / 'README.txt'}")
    print(f"SELECTED_DIR={tranche_dir}")
    print(f"KEPT_CSV={out_dir / 'true_new_structure_selected_cases.csv'}")
    print(f"DROPPED_CSV={out_dir / 'dropped_selected_cases.csv'}")
    print(f"MANIFEST={out_dir / '00_manifest.json'}")
    print(f"SHA256={out_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
