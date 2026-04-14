#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


SCRIPT_VERSION = "openpra-phase5-package-tranche-rollup-v1"
DEFAULT_OUTPUT_ROOT = "_work/openpra_phase5_tranche_rollup_v1"


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
            manifest[str(path.relative_to(root))] = sha256_file(path)

    sha_path = root / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as f:
        for rel, digest in sorted(manifest.items()):
            f.write(f"{digest}  {rel}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    return manifest


def copy_if_exists(src: Path, dst: Path) -> str | None:
    if not src.exists():
        return None
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return str(dst)


def copy_tree_files(src_dir: Path, dst_dir: Path) -> List[str]:
    copied: List[str] = []
    if not src_dir.is_dir():
        return copied
    for path in sorted(src_dir.rglob("*")):
        if path.is_file():
            rel = path.relative_to(src_dir)
            target = dst_dir / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            copied.append(str(target))
    return copied


def stage_job_dir(stage_dir: Path) -> Path:
    p1 = stage_dir / "_quantum_raw" / "p1"
    job_dirs = sorted([p for p in p1.glob("*") if p.is_dir()])
    if len(job_dirs) != 1:
        raise RuntimeError(f"Expected exactly one job dir under {p1}, found {len(job_dirs)}")
    return job_dirs[0]


def build_case_summary(
    label: str,
    candidate_dir: Path,
    stage_dir: Path,
    union_audit_dir: Path | None = None,
) -> Dict[str, Any]:
    package_metadata = load_json(candidate_dir / "package_metadata.json")
    raw_counts = load_json(candidate_dir / "raw_counts.json")
    recovered = load_json(candidate_dir / "quantum_recovered_mcs.json")
    build_summary = load_json(candidate_dir / "quantum_recovered_mcs_build_summary.json")
    stage_manifest = load_json(stage_dir / "openpra_single_case_runtime_manifest_v1.json")
    submit_report = load_json(stage_dir / "quantum_submit_report_p1_v1.json")
    collect_report = load_json(stage_dir / "quantum_collect_report_p1_v1.json")
    classical_reference = load_json(candidate_dir / "classical_reference_mcs.json")

    out: Dict[str, Any] = {
        "label": label,
        "model_id": package_metadata["model_id"],
        "candidate_root_node_id": package_metadata["candidate_root_node_id"],
        "topology_class": package_metadata["topology_class"],
        "basic_event_count": package_metadata["basic_event_count"],
        "required_qubits": package_metadata["required_qubits"],
        "backend": submit_report["backend"],
        "job_id": collect_report["job_id"],
        "shots_total": raw_counts["shots_total"],
        "recovered_exact_cut_set_count": build_summary["recovered_exact_cut_set_count"],
        "reference_cut_set_count": classical_reference["frozen_mcs_reference"]["minimalCutSetCount"],
        "selected_order": build_summary["selected_order"],
        "recovered_basicEventIdSets": recovered["basicEventIdSets"],
        "supporting_exact_rows": recovered["supporting_exact_rows"],
        "raw_counts_sha256": build_summary["raw_counts_json_sha256"],
        "quantum_recovered_mcs_sha256": build_summary["quantum_recovered_mcs_json_sha256"],
        "candidate_dir": str(candidate_dir),
        "stage_dir": str(stage_dir),
    }

    if union_audit_dir is not None and (union_audit_dir / "union_audit_summary.json").exists():
        union_audit = load_json(union_audit_dir / "union_audit_summary.json")
        out["union_recovery"] = {
            "all_recovered_in_union": union_audit["union_recovery"]["all_recovered_in_union"],
            "union_recovered_count": union_audit["union_recovery"]["union_recovered_count"],
            "reference_count": union_audit["union_recovery"]["reference_count"],
            "interpretation": union_audit["interpretation"],
        }
    else:
        out["union_recovery"] = None

    return out


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Package the current Phase 5 tranche rollup with 1037, 0698, and 0905."
    )
    ap.add_argument("--output-root", default=DEFAULT_OUTPUT_ROOT)
    args = ap.parse_args()

    repo_root = Path.cwd().resolve()
    output_root = (repo_root / args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    # Canonical inputs
    success_1037_dir = (repo_root / "_work/openpra_phase5_single_case_success_bundle_v1/20260411_024209Z_phase2b_row_1037").resolve()

    candidate_0698 = (repo_root / "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/0002_phase2b_row_0698").resolve()
    stage_0698 = (repo_root / "_work/openpra_phase5_single_case_runtime_package_v1/20260411_025143Z_phase2b_row_0698").resolve()

    candidate_0905 = (repo_root / "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/0020_phase2b_row_0905").resolve()
    stage_0905 = (repo_root / "_work/openpra_phase5_single_case_runtime_package_v1/20260411_035435Z_phase2b_row_0905").resolve()
    union_0905 = (repo_root / "_work/openpra_phase5_dual_orientation_union_audit_v1/20260411_114126Z_phase2b_row_0905").resolve()

    for p in [success_1037_dir, candidate_0698, stage_0698, candidate_0905, stage_0905, union_0905]:
        if not p.exists():
            raise SystemExit(f"Required input does not exist: {p}")

    outdir = output_root / f"{utc_stamp()}_phase5_hardware_tranche_rollup"
    outdir.mkdir(parents=True, exist_ok=False)

    copied: Dict[str, Any] = {}

    # Copy canonical 1037 success bundle whole
    copied["1037_success_bundle_files"] = copy_tree_files(
        success_1037_dir,
        outdir / "case_1037_success_bundle",
    )

    # Copy 0698 working artifacts
    copied["0698_candidate_files"] = copy_tree_files(candidate_0698, outdir / "case_0698" / "candidate_artifacts")
    copied["0698_stage_files"] = copy_tree_files(stage_0698, outdir / "case_0698" / "stage_artifacts")
    copied["0698_job_files"] = copy_tree_files(stage_job_dir(stage_0698), outdir / "case_0698" / "job_artifacts")

    # Copy 0905 working artifacts
    copied["0905_candidate_files"] = copy_tree_files(candidate_0905, outdir / "case_0905" / "candidate_artifacts")
    copied["0905_stage_files"] = copy_tree_files(stage_0905, outdir / "case_0905" / "stage_artifacts")
    copied["0905_job_files"] = copy_tree_files(stage_job_dir(stage_0905), outdir / "case_0905" / "job_artifacts")
    copied["0905_union_audit_files"] = copy_tree_files(union_0905, outdir / "case_0905" / "union_audit")

    case_1037_summary = load_json(success_1037_dir / "bundle_summary.json")
    case_0698_summary = build_case_summary("0698", candidate_0698, stage_0698, None)
    case_0905_summary = build_case_summary("0905", candidate_0905, stage_0905, union_0905)

    tranche_summary = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "tranche_name": "Phase 5 current hardware recovery tranche",
        "cases": {
            "1037": case_1037_summary,
            "0698": case_0698_summary,
            "0905": case_0905_summary,
        },
        "rollup": {
            "exact_full_success_case_count": 2,
            "partial_exact_case_count": 1,
            "union_sensitivity_full_recovery_case_count": 1,
            "hardware_backend": "ibm_marrakesh",
            "recommended_openpra_recovery_ladder": [
                "Exact hardware recovery under declared order",
                "Alternate orientation audit",
                "Union sensitivity recovery",
                "Near miss advisory",
                "Targeted rerun if ambiguity remains material",
            ],
        },
        "interpretation": [
            "Two distinct structural cases achieved full exact recovery on real IBM hardware.",
            "A third distinct harder Class C case achieved partial exact recovery under declared order and full union recovery across declared and reversed orientations.",
            "The tranche supports a layered OpenPRA recovery design rather than a single post-quantum decode path.",
        ],
        "copied_files": copied,
    }
    write_json(outdir / "phase5_tranche_rollup_summary.json", tranche_summary)

    readme = "\n".join(
        [
            "OpenPRA Phase 5 hardware tranche rollup",
            "",
            "Cases included:",
            "  1037 : full exact hardware recovery",
            "  0698 : full exact hardware recovery",
            "  0905 : partial exact recovery plus full union sensitivity recovery",
            "",
            "Recommended recovery ladder for OpenPRA integration:",
            "  1. Exact hardware recovery under declared order",
            "  2. Alternate orientation audit",
            "  3. Union sensitivity recovery",
            "  4. Near miss advisory",
            "  5. Targeted rerun if needed",
            "",
            "This rollup freezes the current hardware proof tranche.",
            "",
        ]
    ) + "\n"
    write_text(outdir / "README.txt", readme)

    manifest = write_manifest(outdir)
    write_json(outdir / "00_manifest.json", manifest)

    print(f"OUTDIR={outdir}")
    print(f"SUMMARY={outdir / 'phase5_tranche_rollup_summary.json'}")
    print(f"README={outdir / 'README.txt'}")
    print(f"MANIFEST={outdir / '00_manifest.json'}")
    print(f"SHA256={outdir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
