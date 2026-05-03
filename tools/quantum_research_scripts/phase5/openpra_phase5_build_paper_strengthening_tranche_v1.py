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
DEFAULT_SELECTION_RUN = ROOT / "_work" / "openpra_phase5_select_unique_tuned_export_candidates_v1" / "20260414_024246Z"
DEFAULT_OUTPUT_ROOT = ROOT / "_work" / "openpra_phase5_paper_strengthening_tranche_v1"
SCRIPT_VERSION = "openpra-phase5-build-paper-strengthening-tranche-v1"


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
        description="Build the paper-strengthening tranche from the strongest nontrivial tuned-export candidates."
    )
    ap.add_argument("--selection-run", default=str(DEFAULT_SELECTION_RUN))
    ap.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    args = ap.parse_args()

    selection_run = Path(args.selection_run).resolve()
    output_root = Path(args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    source_csv = selection_run / "available_unique_tuned_export_candidates.csv"
    if not source_csv.exists():
        raise SystemExit(f"Missing source CSV: {source_csv}")

    with source_csv.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    strong = [r for r in rows if as_int(r["basic_event_count"]) >= 5]

    strong.sort(
        key=lambda r: (
            1 if r["topology_class"] != "unclassified" else 0,
            1 if r["matrix_entry_matched"] == "True" else 0,
            as_int(r["required_qubits"]),
            as_int(r["basic_event_count"]),
            as_int(r["minimal_cut_set_count"]),
            r["model_id"],
            r["candidate_root_node_id"],
        ),
        reverse=True,
    )

    stamp = utc_stamp()
    out_dir = output_root / stamp
    out_dir.mkdir(parents=True, exist_ok=False)

    tranche_dir = out_dir / "selected_tuned_exports"
    tranche_dir.mkdir(parents=True, exist_ok=True)

    selected_rows: List[Dict[str, Any]] = []
    for idx, row in enumerate(strong, start=1):
        src = Path(row["source_export_file"])
        target_subdir = tranche_dir / f"{idx:04d}_{row['export_run_case_id']}_{row['model_id']}_{row['candidate_root_node_id'].replace(':', '_')}"
        target_subdir.mkdir(parents=True, exist_ok=True)
        copy_file(src, target_subdir / src.name)

        record = dict(row)
        record["selected_rank"] = idx
        record["selected_dir"] = str(target_subdir)
        selected_rows.append(record)

    selected_csv = out_dir / "paper_strengthening_selected_cases.csv"
    with selected_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "selected_rank",
                "selected_dir",
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
            ],
        )
        writer.writeheader()
        for row in selected_rows:
            writer.writerow({k: row.get(k, "") for k in writer.fieldnames})

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "selection_run": str(selection_run),
        "source_csv": str(source_csv),
        "selected_count": len(selected_rows),
        "selection_rule": "all available unique tuned-export candidates with basic_event_count >= 5, ranked by classified topology, matrix match, qubit count, basic-event count, and MCS count",
        "selected_cases": selected_rows,
        "selected_dir": str(tranche_dir),
    }
    write_json(out_dir / "summary.json", summary)

    lines = [
        "OpenPRA Phase 5 paper-strengthening tranche",
        "",
        f"generated_at: {summary['generated_at']}",
        f"selected_count: {len(selected_rows)}",
        "",
        "Selected cases:",
    ]
    for row in selected_rows:
        lines.append(
            f"  rank={row['selected_rank']}  model={row['model_id']}  "
            f"root={row['candidate_root_node_id']}  topology={row['topology_class']}  "
            f"n={row['basic_event_count']}  q={row['required_qubits']}  "
            f"mcs={row['minimal_cut_set_count']}  matrix_match={row['matrix_entry_matched']}"
        )
    lines.append("")
    write_text(out_dir / "README.txt", "\n".join(lines))

    write_manifest(out_dir)

    print(f"OUTDIR={out_dir}")
    print(f"SUMMARY={out_dir / 'summary.json'}")
    print(f"README={out_dir / 'README.txt'}")
    print(f"SELECTED_DIR={tranche_dir}")
    print(f"SELECTED_CSV={selected_csv}")
    print(f"MANIFEST={out_dir / '00_manifest.json'}")
    print(f"SHA256={out_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
