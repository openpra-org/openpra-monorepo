#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


SCRIPT_VERSION = "openpra-phase5-package-single-case-success-v1"
DEFAULT_OUTPUT_ROOT = "_work/openpra_phase5_single_case_success_bundle_v1"


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
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifest(root: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            rel = str(path.relative_to(root))
            manifest[rel] = sha256_file(path)

    sha_path = root / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as f:
        for rel, digest in sorted(manifest.items()):
            f.write(f"{digest}  {rel}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    return manifest


def copy_file(src: Path, dst: Path) -> str:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return str(dst)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Package the first successful OpenPRA single-case hardware recovery bundle."
    )
    ap.add_argument("--stage-dir", required=True)
    ap.add_argument("--candidate-dir", required=True)
    ap.add_argument("--output-root", default=DEFAULT_OUTPUT_ROOT)
    args = ap.parse_args()

    repo_root = Path.cwd().resolve()

    stage_dir = Path(args.stage_dir)
    if not stage_dir.is_absolute():
        stage_dir = (repo_root / stage_dir).resolve()
    if not stage_dir.is_dir():
        raise SystemExit(f"Stage dir does not exist: {stage_dir}")

    candidate_dir = Path(args.candidate_dir)
    if not candidate_dir.is_absolute():
        candidate_dir = (repo_root / candidate_dir).resolve()
    if not candidate_dir.is_dir():
        raise SystemExit(f"Candidate dir does not exist: {candidate_dir}")

    output_root = Path(args.output_root)
    if not output_root.is_absolute():
        output_root = (repo_root / output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    runtime_manifest = load_json(stage_dir / "openpra_single_case_runtime_manifest_v1.json")
    model_id = runtime_manifest["model_id"]

    bundle_dir = output_root / f"{utc_stamp()}_{model_id}"
    bundle_dir.mkdir(parents=True, exist_ok=False)

    stage_out = bundle_dir / "stage_artifacts"
    candidate_out = bundle_dir / "candidate_artifacts"
    job_out = bundle_dir / "job_artifacts"

    job_dirs = sorted((stage_dir / "_quantum_raw" / "p1").glob("*"))
    job_dirs = [p for p in job_dirs if p.is_dir()]
    if len(job_dirs) != 1:
        raise SystemExit(f"Expected exactly one job dir in {stage_dir / '_quantum_raw' / 'p1'}, found {len(job_dirs)}")
    job_dir = job_dirs[0]

    copied: Dict[str, str] = {}

    stage_files = [
        "README.txt",
        "openpra_single_case_runtime_manifest_v1.json",
        "quantum_submit_report_p1_v1.json",
        "quantum_collect_report_p1_v1.json",
        "raw_counts.json",
        "SHA256SUMS.txt",
        "00_manifest.json",
    ]
    for name in stage_files:
        src = stage_dir / name
        if src.exists():
            copied[f"stage::{name}"] = copy_file(src, stage_out / name)

    candidate_files = [
        "package_metadata.json",
        "probabilities.json",
        "classical_reference_mcs.json",
        "raw_counts.json",
        "quantum_recovered_mcs.json",
        "quantum_recovered_mcs_build_summary.json",
        "source_export.json",
    ]
    for name in candidate_files:
        src = candidate_dir / name
        if src.exists():
            copied[f"candidate::{name}"] = copy_file(src, candidate_out / name)

    job_files = [
        "job_meta.json",
        "submit_input_manifest.json",
        "job_inputs_from_service.json",
        "job_result_live_repr.txt",
        "submitted_isa_circuit.qpy",
        "submitted_isa_circuit.txt",
        "sha256.txt",
    ]
    for name in job_files:
        src = job_dir / name
        if src.exists():
            copied[f"job::{name}"] = copy_file(src, job_out / name)

    decoded_dir = job_dir / "decoded_counts"
    if decoded_dir.is_dir():
        for path in sorted(decoded_dir.iterdir()):
            if path.is_file():
                copied[f"decoded::{path.name}"] = copy_file(path, job_out / "decoded_counts" / path.name)

    build_summary = load_json(candidate_dir / "quantum_recovered_mcs_build_summary.json")
    recovered_mcs = load_json(candidate_dir / "quantum_recovered_mcs.json")
    collect_report = load_json(stage_dir / "quantum_collect_report_p1_v1.json")
    submit_report = load_json(stage_dir / "quantum_submit_report_p1_v1.json")
    raw_counts = load_json(candidate_dir / "raw_counts.json")

    summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "bundle_dir": str(bundle_dir),
        "model_id": runtime_manifest["model_id"],
        "candidate_root_node_id": runtime_manifest["candidate_root_node_id"],
        "backend": submit_report["backend"],
        "job_id": collect_report["job_id"],
        "hardware_success": True,
        "recovered_exact_cut_set_count": build_summary["recovered_exact_cut_set_count"],
        "selected_order": build_summary["selected_order"],
        "shots_total": raw_counts["shots_total"],
        "raw_counts_sha256": build_summary["raw_counts_json_sha256"],
        "quantum_recovered_mcs_sha256": build_summary["quantum_recovered_mcs_json_sha256"],
        "basicEventIdSets": recovered_mcs["basicEventIdSets"],
        "supporting_exact_rows": recovered_mcs["supporting_exact_rows"],
        "copied_files": copied,
    }
    write_json(bundle_dir / "bundle_summary.json", summary)

    readme = "\n".join(
        [
            "OpenPRA Phase 5 single-case hardware success bundle",
            "",
            f"model_id: {summary['model_id']}",
            f"candidate_root_node_id: {summary['candidate_root_node_id']}",
            f"backend: {summary['backend']}",
            f"job_id: {summary['job_id']}",
            f"shots_total: {summary['shots_total']}",
            f"recovered_exact_cut_set_count: {summary['recovered_exact_cut_set_count']}",
            f"selected_order: {summary['selected_order']}",
            "",
            "Contents:",
            "  stage_artifacts/",
            "  candidate_artifacts/",
            "  job_artifacts/",
            "  bundle_summary.json",
            "",
            "This bundle captures the first successful end-to-end OpenPRA hardware run, decoded counts, and recovered MCS artifact.",
            "",
        ]
    ) + "\n"
    write_text(bundle_dir / "README.txt", readme)

    manifest = write_manifest(bundle_dir)
    write_json(bundle_dir / "00_manifest.json", manifest)

    print(f"BUNDLE_DIR={bundle_dir}")
    print(f"SUMMARY={bundle_dir / 'bundle_summary.json'}")
    print(f"README={bundle_dir / 'README.txt'}")
    print(f"MANIFEST={bundle_dir / '00_manifest.json'}")
    print(f"SHA256={bundle_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
