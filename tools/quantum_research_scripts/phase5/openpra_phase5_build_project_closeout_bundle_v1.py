#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


SCRIPT_VERSION = "openpra-phase5-build-project-closeout-bundle-v1"
ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
DEFAULT_OUTPUT_ROOT = ROOT / "_work" / "openpra_phase5_project_closeout_bundle_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def read_json(path: Path) -> Any:
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


def latest_run_dir(root: Path) -> Path:
    if not root.is_dir():
        raise SystemExit(f"Missing directory: {root}")
    dirs = sorted([p for p in root.iterdir() if p.is_dir()], reverse=True)
    if not dirs:
        raise SystemExit(f"No run directories found under: {root}")
    return dirs[0]


def safe_copy_file(src: Path, dst: Path) -> Optional[str]:
    if not src.exists() or not src.is_file():
        return None
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return str(dst)


def safe_copy_tree(src: Path, dst: Path) -> List[str]:
    copied: List[str] = []
    if not src.exists():
        return copied

    if src.is_file():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        return [str(dst)]

    for path in sorted(src.rglob("*")):
        if path.is_file():
            rel = path.relative_to(src)
            target = dst / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            copied.append(str(target))
    return copied


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


def build_tarball(bundle_dir: Path) -> Tuple[Path, Path]:
    tar_path = bundle_dir.with_suffix(".tar.gz")
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(bundle_dir, arcname=bundle_dir.name)

    sha_path = tar_path.with_suffix(tar_path.suffix + ".sha256")
    digest = sha256_file(tar_path)
    sha_path.write_text(f"{digest}  {tar_path.name}\n", encoding="utf-8")
    return tar_path, sha_path


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Build one final Phase 5 project closeout bundle."
    )
    ap.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    args = ap.parse_args()

    output_root = Path(args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    executed_release_root = ROOT / "_work" / "openpra_phase5_executed_only_package_release_v1"
    final_integration_root = ROOT / "_work" / "openpra_phase5_package_final_integration_tranche_v1"
    batch_cli_root = ROOT / "_work" / "openpra_phase5_package_batch_cli_v1"
    validation_root = ROOT / "_work" / "openpra_phase5_validate_package_recovery_on_real_candidates_v1"

    latest_release_dir = latest_run_dir(executed_release_root)
    latest_final_dir = latest_run_dir(final_integration_root)
    latest_batch_dir = latest_run_dir(batch_cli_root)
    latest_validation_dir = latest_run_dir(validation_root)

    release_summary_json = latest_release_dir / "release_summary.json"
    final_summary_json = latest_final_dir / "final_integration_summary.json"
    batch_rollup_json = latest_batch_dir / "openpra_package_recovery_batch_rollup_v1.json"
    validation_rollup_json = latest_validation_dir / "validation_rollup.json"

    if not release_summary_json.exists():
      raise SystemExit(f"Missing release summary: {release_summary_json}")
    if not final_summary_json.exists():
      raise SystemExit(f"Missing final integration summary: {final_summary_json}")
    if not batch_rollup_json.exists():
      raise SystemExit(f"Missing batch rollup: {batch_rollup_json}")
    if not validation_rollup_json.exists():
      raise SystemExit(f"Missing validation rollup: {validation_rollup_json}")

    release_summary = read_json(release_summary_json)
    final_summary = read_json(final_summary_json)
    batch_rollup = read_json(batch_rollup_json)
    validation_rollup = read_json(validation_rollup_json)

    bundle_name = f"PHASE5_PROJECT_CLOSEOUT_BUNDLE_v1_{utc_stamp()}"
    bundle_dir = output_root / bundle_name
    bundle_dir.mkdir(parents=True, exist_ok=False)

    copied: Dict[str, Any] = {
        "release_bundle": {},
        "integration": {},
        "package_sources": {},
        "dist_package": {},
        "scripts": {},
    }

    # 1. Executed only release bundle and its tar artifacts
    copied["release_bundle"]["release_dir"] = safe_copy_tree(
        latest_release_dir,
        bundle_dir / "executed_only_release_bundle"
    )
    copied["release_bundle"]["release_tar_gz"] = safe_copy_file(
        latest_release_dir.with_suffix(".tar.gz"),
        bundle_dir / "executed_only_release_bundle_tar" / latest_release_dir.with_suffix(".tar.gz").name
    )
    copied["release_bundle"]["release_tar_gz_sha256"] = safe_copy_file(
        latest_release_dir.with_suffix(".tar.gz.sha256"),
        bundle_dir / "executed_only_release_bundle_tar" / latest_release_dir.with_suffix(".tar.gz.sha256").name
    )

    # 2. Final integration, batch rollup, validation
    copied["integration"]["final_integration_dir"] = safe_copy_tree(
        latest_final_dir,
        bundle_dir / "final_integration_tranche"
    )
    copied["integration"]["batch_cli_dir"] = safe_copy_tree(
        latest_batch_dir,
        bundle_dir / "package_batch_rollup_run"
    )
    copied["integration"]["validation_dir"] = safe_copy_tree(
        latest_validation_dir,
        bundle_dir / "semantic_validation_run"
    )

    # 3. Quantum readiness package sources
    package_src_root = ROOT / "packages" / "quantum-readiness" / "src" / "lib"
    source_files = [
        "quantum-recovery.ts",
        "openpra-quantum-recovery-artifacts.ts",
        "openpra-quantum-recovery-rollup.ts",
        "openpra-quantum-recovery-batch-artifacts.ts",
        "openpra-quantum-recovery-filesystem.ts",
        "index.ts",
    ]
    for name in source_files:
        src = package_src_root / name
        copied["package_sources"][name] = safe_copy_file(
            src,
            bundle_dir / "package_sources" / name
        )

    # 4. Dist package output
    dist_root = ROOT / "dist" / "packages" / "quantum-readiness"
    dist_types_root = ROOT / "dist" / "types" / "quantum-readiness"
    copied["dist_package"]["dist_packages_quantum_readiness"] = safe_copy_tree(
        dist_root,
        bundle_dir / "dist" / "packages" / "quantum-readiness"
    )
    copied["dist_package"]["dist_types_quantum_readiness"] = safe_copy_tree(
        dist_types_root,
        bundle_dir / "dist" / "types" / "quantum-readiness"
    )

    # 5. Current Phase 5 package-facing scripts
    script_names = [
        "openpra_phase5_package_single_candidate_cli_v1.cjs",
        "openpra_phase5_package_batch_cli_v1.cjs",
        "openpra_phase5_package_final_integration_tranche_v1.sh",
        "openpra_phase5_build_executed_only_package_release_bundle_v1.py",
        "openpra_phase5_validate_package_recovery_on_real_candidates_v1.cjs",
    ]
    for name in script_names:
        src = ROOT / "scripts" / name
        copied["scripts"][name] = safe_copy_file(
            src,
            bundle_dir / "scripts" / name
        )

    closeout_summary = {
        "generatedAt": utc_now_iso(),
        "scriptVersion": SCRIPT_VERSION,
        "authoritativeExecutedOnlyReleaseDir": str(latest_release_dir),
        "authoritativeFinalIntegrationDir": str(latest_final_dir),
        "authoritativeBatchCliDir": str(latest_batch_dir),
        "authoritativeValidationDir": str(latest_validation_dir),
        "selectionMode": release_summary.get("selectionMode"),
        "caseCount": release_summary.get("caseCount"),
        "exactHardwareRecoveryCaseCount": release_summary.get("exactHardwareRecoveryCaseCount"),
        "unionSensitivityRecoveryCaseCount": release_summary.get("unionSensitivityRecoveryCaseCount"),
        "operatorAttentionRequiredCaseCount": release_summary.get("operatorAttentionRequiredCaseCount"),
        "allCasesSemanticParityMatch": release_summary.get("allCasesSemanticParityMatch"),
        "finalIntegrationSemanticParityMatch": final_summary.get("allCasesSemanticParityMatch"),
        "finalIntegrationStructuralMatchIgnoringGeneratedAt": final_summary.get("allCasesStructuralMatchIgnoringGeneratedAt"),
        "cases": release_summary.get("cases", []),
        "copiedFiles": copied,
    }
    write_json(bundle_dir / "project_closeout_summary.json", closeout_summary)

    readme_lines = [
        "OpenPRA Phase 5 project closeout bundle",
        "",
        f"generated_at: {closeout_summary['generatedAt']}",
        f"selection_mode: {closeout_summary['selectionMode']}",
        f"case_count: {closeout_summary['caseCount']}",
        f"exact_hardware_recovery_case_count: {closeout_summary['exactHardwareRecoveryCaseCount']}",
        f"union_sensitivity_recovery_case_count: {closeout_summary['unionSensitivityRecoveryCaseCount']}",
        f"operator_attention_required_case_count: {closeout_summary['operatorAttentionRequiredCaseCount']}",
        f"all_cases_semantic_parity_match: {closeout_summary['allCasesSemanticParityMatch']}",
        f"final_integration_structural_match_ignoring_generated_at: {closeout_summary['finalIntegrationStructuralMatchIgnoringGeneratedAt']}",
        "",
    ]
    for row in closeout_summary["cases"]:
        readme_lines.append(
            f"{row['label']}  model={row['modelId']}  primary_mode={row['primaryMode']}  "
            f"tier1={row['tier1RecoveredExactCutSetCount']}/{row['referenceCutSetCount']}  "
            f"union={row['unionRecoveredCount']}/{row['referenceCutSetCount']}  "
            f"attention={row['requiresOperatorAttention']}"
        )
    readme_lines.append("")
    write_text(bundle_dir / "README.txt", "\n".join(readme_lines))

    write_manifest(bundle_dir)
    tar_path, sha_path = build_tarball(bundle_dir)

    print(f"BUNDLE_DIR={bundle_dir}")
    print(f"PROJECT_CLOSEOUT_SUMMARY={bundle_dir / 'project_closeout_summary.json'}")
    print(f"README={bundle_dir / 'README.txt'}")
    print(f"TAR_GZ={tar_path}")
    print(f"TAR_GZ_SHA256={sha_path}")
    print(f"MANIFEST={bundle_dir / '00_manifest.json'}")
    print(f"SHA256={bundle_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
