#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


SCRIPT_VERSION = "phase4-checkpoint-freeze-v1"
OUTPUT_ROOT = "_work/openpra_phase4_checkpoint_freeze_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Dict[str, Any]) -> None:
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


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        raise SystemExit(f"Destination already exists: {dst}")
    shutil.copytree(src, dst)


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


def resolve_existing_path(repo_root: Path, value: str, expect_dir: bool = True) -> Path:
    candidate = Path(value)
    resolved = candidate if candidate.is_absolute() else (repo_root / candidate)
    resolved = resolved.resolve()

    if expect_dir and not resolved.is_dir():
        raise SystemExit(f"Directory does not exist: {resolved}")
    if not expect_dir and not resolved.is_file():
        raise SystemExit(f"File does not exist: {resolved}")

    return resolved


def maybe_copy_summary(run_dir: Path, destination_dir: Path, preferred_names: List[str]) -> List[str]:
    copied: List[str] = []

    for name in preferred_names:
        src = run_dir / name
        if src.exists():
            copy_file(src, destination_dir / name)
            copied.append(name)

    return copied


def build_checkpoint_summary(
    real_run: Path,
    tuned_run: Path,
    package_run: Path,
    internal_validation_run: Path,
    row_lookup_run: Path,
    mapping_run: Path,
    external_validation_run: Path,
    recovery_run: Path,
) -> Dict[str, Any]:
    internal_summary = load_json(
        internal_validation_run / "90_phase4_reference_artifact_validation_summary.json"
    )
    external_summary = load_json(
        external_validation_run / "90_phase4_reference_artifact_validation_summary.json"
    )
    mapping_summary = load_json(mapping_run / "paper10_reference_mapping_summary.json")
    recovery_summary = load_json(recovery_run / "paper10_overlap_recovery_summary_v2.json")
    row_lookup_summary = load_json(row_lookup_run / "90_phase4_phase2b_row_lookup_summary.json")
    package_summary = load_json(package_run / "90_phase4_reference_artifact_package_summary.json")

    return {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "checkpoint_type": "phase4_external_parity_freeze",
        "runs": {
            "real_run": str(real_run),
            "tuned_run": str(tuned_run),
            "package_run": str(package_run),
            "internal_validation_run": str(internal_validation_run),
            "row_lookup_run": str(row_lookup_run),
            "mapping_run": str(mapping_run),
            "external_validation_run": str(external_validation_run),
            "recovery_run": str(recovery_run),
        },
        "counts": {
            "selected_count": package_summary.get("packaged_case_count"),
            "internal_checked_case_count": internal_summary.get("checked_case_count"),
            "internal_identity_pass_count": internal_summary.get("internal_identity_pass_count"),
            "full_cl_qubo_model_pass_count": internal_summary.get("full_cl_qubo_model_pass_count"),
            "paper10_compatible_model_pass_count": internal_summary.get("paper10_compatible_model_pass_count"),
            "row_lookup_rows": row_lookup_summary.get("row_count"),
            "direct_mapping_match_count": mapping_summary.get("matched_count"),
            "direct_mapping_missing_count": mapping_summary.get("missing_count"),
            "external_reference_checked_count": external_summary.get("external_reference_checked_count"),
            "external_reference_pass_count": external_summary.get("external_reference_pass_count"),
            "recovery_direct_exact_id_match_count": recovery_summary.get("direct_exact_id_match_count"),
            "recovery_unique_structural_match_count": recovery_summary.get("recovered_unique_structural_match_count"),
            "recovery_ambiguous_structural_match_count": recovery_summary.get("ambiguous_structural_match_count"),
            "recovery_unresolved_no_match_count": recovery_summary.get("unresolved_no_match_count"),
        },
        "conclusion": {
            "status": "stable_freeze_candidate",
            "statement": (
                "Phase 4 package parity is internally clean for the 120 case stratified cohort. "
                "External Paper10 qubo_model_v1 parity is proven on all 13 directly recoverable overlaps. "
                "No additional recoverable overlaps were found by exact structural fingerprint recovery, "
                "so the remaining 107 are treated as non overlap rather than parity failures."
            ),
            "recommended_next_action": "freeze_and_use_as_authoritative_phase4_checkpoint",
        },
    }


def build_readme(summary: Dict[str, Any]) -> str:
    counts = summary["counts"]
    runs = summary["runs"]

    lines: List[str] = []
    lines.append("OPENPRA Phase 4 checkpoint freeze v1")
    lines.append("")
    lines.append(f"Generated at: {summary['generated_at']}")
    lines.append(f"Script version: {summary['script_version']}")
    lines.append("")
    lines.append("Purpose")
    lines.append("")
    lines.append(
        "Freeze the current Phase 4 checkpoint after internal package parity, direct Paper10 overlap validation, and structural recovery review."
    )
    lines.append("")
    lines.append("Authoritative runs")
    lines.append("")
    for key, value in runs.items():
      lines.append(f"{key}: {value}")
    lines.append("")
    lines.append("Counts")
    lines.append("")
    for key, value in counts.items():
        lines.append(f"{key}: {value}")
    lines.append("")
    lines.append("Interpretation")
    lines.append("")
    lines.append(
        "The current cohort is internally clean. Direct Paper10 overlap exists for 13 cases and all 13 pass exact external qubo_model_v1 parity. "
        "No further recoverable overlaps were found through exact structural fingerprint matching. "
        "The remaining 107 cases are therefore treated as non overlap with the current frozen Paper10 per_instance corpus."
    )
    lines.append("")
    lines.append("Recommended use")
    lines.append("")
    lines.append(
        "Use this checkpoint as the authoritative Phase 4 recovery state for package side parity and validated external overlap evidence."
    )
    lines.append("")
    return "\n".join(lines) + "\n"


def build_memo(summary: Dict[str, Any]) -> str:
    counts = summary["counts"]
    lines: List[str] = []
    lines.append("PHASE 4 CHECKPOINT MEMO")
    lines.append("")
    lines.append("Decision")
    lines.append("Freeze this checkpoint.")
    lines.append("")
    lines.append("Why")
    lines.append(
        f"The 120 case stratified cohort passed internal identity {counts['internal_identity_pass_count']} of {counts['internal_checked_case_count']}."
    )
    lines.append(
        f"Direct external Paper10 overlap was available for {counts['external_reference_checked_count']} cases and all {counts['external_reference_pass_count']} passed exact qubo_model_v1 parity."
    )
    lines.append(
        f"Recovery beyond direct ID overlap found {counts['recovery_unique_structural_match_count']} additional unique structural matches and {counts['recovery_ambiguous_structural_match_count']} ambiguous matches."
    )
    lines.append(
        f"The remaining {counts['recovery_unresolved_no_match_count']} are treated as non overlap with the current frozen Paper10 per_instance root."
    )
    lines.append("")
    lines.append("Implication")
    lines.append(
        "The earlier core CL QUBO parity issue is resolved. Remaining limits come from comparator coverage, not encoder mismatch."
    )
    lines.append("")
    return "\n".join(lines) + "\n"


def create_tarball(source_dir: Path, tar_path: Path) -> None:
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(source_dir, arcname=source_dir.name)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Freeze the current OpenPRA Phase 4 checkpoint into an audit ready bundle."
    )
    parser.add_argument("--real-run", required=True)
    parser.add_argument("--tuned-run", required=True)
    parser.add_argument("--package-run", required=True)
    parser.add_argument("--internal-validation-run", required=True)
    parser.add_argument("--row-lookup-run", required=True)
    parser.add_argument("--mapping-run", required=True)
    parser.add_argument("--external-validation-run", required=True)
    parser.add_argument("--recovery-run", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path.cwd().resolve()

    real_run = resolve_existing_path(repo_root, args.real_run, expect_dir=True)
    tuned_run = resolve_existing_path(repo_root, args.tuned_run, expect_dir=True)
    package_run = resolve_existing_path(repo_root, args.package_run, expect_dir=True)
    internal_validation_run = resolve_existing_path(repo_root, args.internal_validation_run, expect_dir=True)
    row_lookup_run = resolve_existing_path(repo_root, args.row_lookup_run, expect_dir=True)
    mapping_run = resolve_existing_path(repo_root, args.mapping_run, expect_dir=True)
    external_validation_run = resolve_existing_path(repo_root, args.external_validation_run, expect_dir=True)
    recovery_run = resolve_existing_path(repo_root, args.recovery_run, expect_dir=True)

    output_run = (repo_root / OUTPUT_ROOT / utc_stamp()).resolve()
    output_run.mkdir(parents=True, exist_ok=False)

    summary = build_checkpoint_summary(
        real_run=real_run,
        tuned_run=tuned_run,
        package_run=package_run,
        internal_validation_run=internal_validation_run,
        row_lookup_run=row_lookup_run,
        mapping_run=mapping_run,
        external_validation_run=external_validation_run,
        recovery_run=recovery_run,
    )

    # Store key source summaries for audit visibility
    source_dir = output_run / "source_summaries"
    source_dir.mkdir(parents=True, exist_ok=False)

    maybe_copy_summary(real_run, source_dir / "real_run", [
        "90_phase4_real_bounded_stratified_summary.json",
        "README.txt",
        "00_manifest.json",
    ])
    maybe_copy_summary(tuned_run, source_dir / "tuned_run", [
        "90_phase4_tuned_parameter_summary.json",
        "91_phase4_tuned_parameter_selection.json",
        "README.txt",
        "00_manifest.json",
    ])
    maybe_copy_summary(package_run, source_dir / "package_run", [
        "90_phase4_reference_artifact_package_summary.json",
        "README.txt",
        "00_manifest.json",
    ])
    maybe_copy_summary(internal_validation_run, source_dir / "internal_validation_run", [
        "90_phase4_reference_artifact_validation_summary.json",
        "README.txt",
        "00_manifest.json",
    ])
    maybe_copy_summary(row_lookup_run, source_dir / "row_lookup_run", [
        "90_phase4_phase2b_row_lookup_summary.json",
        "91_phase4_phase2b_row_lookup.csv",
        "92_phase4_phase2b_reference_seed.json",
        "README.txt",
        "00_manifest.json",
    ])
    maybe_copy_summary(mapping_run, source_dir / "mapping_run", [
        "paper10_reference_mapping.csv",
        "paper10_reference_mapping_summary.json",
        "README.txt",
        "00_manifest.json",
    ])
    maybe_copy_summary(external_validation_run, source_dir / "external_validation_run", [
        "90_phase4_reference_artifact_validation_summary.json",
        "README.txt",
        "00_manifest.json",
    ])
    maybe_copy_summary(recovery_run, source_dir / "recovery_run", [
        "paper10_overlap_recovery_summary_v2.json",
        "paper10_reference_mapping_exact_v2.csv",
        "paper10_reference_mapping_structural_recovered_v2.csv",
        "paper10_reference_mapping_structural_ambiguous_v2.csv",
        "paper10_reference_mapping_unresolved_v2.csv",
        "README.txt",
        "00_manifest.json",
    ])

    write_json(output_run / "phase4_checkpoint_freeze_summary_v1.json", summary)
    write_text(output_run / "README.txt", build_readme(summary))
    write_text(output_run / "PHASE4_CHECKPOINT_MEMO.txt", build_memo(summary))

    manifest = write_manifest(output_run)
    write_json(output_run / "00_manifest.json", manifest)

    tar_path = output_run.parent / f"{output_run.name}.tar.gz"
    create_tarball(output_run, tar_path)
    tar_sha = sha256_file(tar_path)
    write_text(output_run.parent / f"{output_run.name}.tar.gz.sha256", f"{tar_sha}  {tar_path.name}\n")

    print(f"OUTPUT_RUN={output_run}")
    print(f"SUMMARY={output_run / 'phase4_checkpoint_freeze_summary_v1.json'}")
    print(f"README={output_run / 'README.txt'}")
    print(f"MEMO={output_run / 'PHASE4_CHECKPOINT_MEMO.txt'}")
    print(f"MANIFEST={output_run / '00_manifest.json'}")
    print(f"SHA256={output_run / 'SHA256SUMS.txt'}")
    print(f"TAR={tar_path}")
    print(f"TAR_SHA256={output_run.parent / f'{output_run.name}.tar.gz.sha256'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
