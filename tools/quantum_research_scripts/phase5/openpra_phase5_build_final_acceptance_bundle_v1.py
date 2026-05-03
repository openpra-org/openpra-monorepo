#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple


SCRIPT_VERSION = "openpra-phase5-build-final-acceptance-bundle-v1"
ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
DEFAULT_OUTPUT_ROOT = ROOT / "_work" / "openpra_phase5_final_acceptance_bundle_v1"


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
        description="Build the final Phase 5 acceptance bundle."
    )
    ap.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    args = ap.parse_args()

    output_root = Path(args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    canonical_root = ROOT / "_work" / "openpra_phase5_canonical_openpra_entrypoint_v1"
    final_integration_root = ROOT / "_work" / "openpra_phase5_package_final_integration_tranche_v1"
    executed_release_root = ROOT / "_work" / "openpra_phase5_executed_only_package_release_v1"
    closeout_root = ROOT / "_work" / "openpra_phase5_project_closeout_bundle_v1"
    validation_root = ROOT / "_work" / "openpra_phase5_validate_package_recovery_on_real_candidates_v1"

    canonical_dir = latest_run_dir(canonical_root)
    final_integration_dir = latest_run_dir(final_integration_root)
    executed_release_dir = latest_run_dir(executed_release_root)
    closeout_dir = latest_run_dir(closeout_root)
    validation_dir = latest_run_dir(validation_root)

    canonical_summary_json = canonical_dir / "canonical_entrypoint_summary.json"
    final_summary_json = final_integration_dir / "final_integration_summary.json"
    release_summary_json = executed_release_dir / "release_summary.json"
    closeout_summary_json = closeout_dir / "project_closeout_summary.json"
    validation_summary_json = validation_dir / "validation_rollup.json"

    for p in [
        canonical_summary_json,
        final_summary_json,
        release_summary_json,
        closeout_summary_json,
        validation_summary_json,
    ]:
        if not p.exists():
            raise SystemExit(f"Missing required summary: {p}")

    canonical = read_json(canonical_summary_json)
    final_integration = read_json(final_summary_json)
    release = read_json(release_summary_json)
    closeout = read_json(closeout_summary_json)
    validation = read_json(validation_summary_json)

    required_case_count = 3
    required_exact = 2
    required_union = 1
    required_attention = 1
    required_selection_mode = "legacy_validated_only"

    gates = {
        "canonical_selection_mode_ok": canonical.get("selectionMode") == required_selection_mode,
        "canonical_case_count_ok": canonical.get("caseCount") == required_case_count,
        "canonical_exact_ok": canonical.get("exactHardwareRecoveryCaseCount") == required_exact,
        "canonical_union_ok": canonical.get("unionSensitivityRecoveryCaseCount") == required_union,
        "canonical_attention_ok": canonical.get("operatorAttentionRequiredCaseCount") == required_attention,

        "final_selection_mode_ok": final_integration.get("selectionMode") == required_selection_mode,
        "final_case_count_ok": final_integration.get("caseCount") == required_case_count,
        "final_semantic_parity_ok": bool(final_integration.get("allCasesSemanticParityMatch")),

        "release_selection_mode_ok": release.get("selectionMode") == required_selection_mode,
        "release_case_count_ok": release.get("caseCount") == required_case_count,
        "release_semantic_parity_ok": bool(release.get("allCasesSemanticParityMatch")),

        "closeout_selection_mode_ok": closeout.get("selectionMode") == required_selection_mode,
        "closeout_case_count_ok": closeout.get("caseCount") == required_case_count,
        "closeout_semantic_parity_ok": bool(closeout.get("allCasesSemanticParityMatch")),

        "validation_semantic_parity_ok": bool(validation.get("allCasesSemanticParityMatch")),
    }

    project_done_gate = all(gates.values())
    if not project_done_gate:
        failed = [k for k, v in gates.items() if not v]
        raise SystemExit(f"Final acceptance gate failed: {failed}")

    bundle_name = f"PHASE5_FINAL_ACCEPTANCE_BUNDLE_v1_{utc_stamp()}"
    bundle_dir = output_root / bundle_name
    bundle_dir.mkdir(parents=True, exist_ok=False)

    copied: Dict[str, Any] = {
        "canonical": {},
        "final_integration": {},
        "executed_release": {},
        "closeout": {},
        "validation": {},
    }

    copied["canonical"]["summary_json"] = safe_copy_file(
        canonical_summary_json,
        bundle_dir / "canonical" / "canonical_entrypoint_summary.json"
    )
    copied["canonical"]["rollup_json"] = safe_copy_file(
        canonical_dir / "canonical_rollup.json",
        bundle_dir / "canonical" / "canonical_rollup.json"
    )
    copied["canonical"]["rollup_txt"] = safe_copy_file(
        canonical_dir / "canonical_rollup.txt",
        bundle_dir / "canonical" / "canonical_rollup.txt"
    )

    copied["final_integration"]["summary_json"] = safe_copy_file(
        final_summary_json,
        bundle_dir / "final_integration" / "final_integration_summary.json"
    )
    copied["final_integration"]["summary_txt"] = safe_copy_file(
        final_integration_dir / "final_integration_summary.txt",
        bundle_dir / "final_integration" / "final_integration_summary.txt"
    )

    copied["executed_release"]["readme"] = safe_copy_file(
        executed_release_dir / "README.txt",
        bundle_dir / "executed_release" / "README.txt"
    )
    copied["executed_release"]["summary_json"] = safe_copy_file(
        release_summary_json,
        bundle_dir / "executed_release" / "release_summary.json"
    )
    copied["executed_release"]["tar_gz"] = safe_copy_file(
        executed_release_dir.with_suffix(".tar.gz"),
        bundle_dir / "executed_release" / executed_release_dir.with_suffix(".tar.gz").name
    )
    copied["executed_release"]["tar_gz_sha256"] = safe_copy_file(
        executed_release_dir.with_suffix(".tar.gz.sha256"),
        bundle_dir / "executed_release" / executed_release_dir.with_suffix(".tar.gz.sha256").name
    )

    copied["closeout"]["readme"] = safe_copy_file(
        closeout_dir / "README.txt",
        bundle_dir / "closeout" / "README.txt"
    )
    copied["closeout"]["summary_json"] = safe_copy_file(
        closeout_summary_json,
        bundle_dir / "closeout" / "project_closeout_summary.json"
    )
    copied["closeout"]["tar_gz"] = safe_copy_file(
        closeout_dir.with_suffix(".tar.gz"),
        bundle_dir / "closeout" / closeout_dir.with_suffix(".tar.gz").name
    )
    copied["closeout"]["tar_gz_sha256"] = safe_copy_file(
        closeout_dir.with_suffix(".tar.gz.sha256"),
        bundle_dir / "closeout" / closeout_dir.with_suffix(".tar.gz.sha256").name
    )

    copied["validation"]["summary_json"] = safe_copy_file(
        validation_summary_json,
        bundle_dir / "validation" / "validation_rollup.json"
    )
    copied["validation"]["summary_txt"] = safe_copy_file(
        validation_dir / "validation_rollup.txt",
        bundle_dir / "validation" / "validation_rollup.txt"
    )

    acceptance_summary = {
        "generatedAt": utc_now_iso(),
        "scriptVersion": SCRIPT_VERSION,
        "projectDoneGate": project_done_gate,
        "requiredSelectionMode": required_selection_mode,
        "requiredCaseCount": required_case_count,
        "requiredExactHardwareRecoveryCaseCount": required_exact,
        "requiredUnionSensitivityRecoveryCaseCount": required_union,
        "requiredOperatorAttentionRequiredCaseCount": required_attention,
        "gates": gates,
        "authoritativeCanonicalRun": str(canonical_dir),
        "authoritativeFinalIntegrationRun": str(final_integration_dir),
        "authoritativeExecutedReleaseRun": str(executed_release_dir),
        "authoritativeCloseoutRun": str(closeout_dir),
        "authoritativeValidationRun": str(validation_dir),
        "cases": release.get("cases", []),
        "copiedFiles": copied,
    }
    write_json(bundle_dir / "acceptance_summary.json", acceptance_summary)

    readme_lines = [
        "OpenPRA Phase 5 final acceptance bundle",
        "",
        f"generated_at: {acceptance_summary['generatedAt']}",
        f"project_done_gate: {acceptance_summary['projectDoneGate']}",
        f"required_selection_mode: {required_selection_mode}",
        f"required_case_count: {required_case_count}",
        f"required_exact_hardware_recovery_case_count: {required_exact}",
        f"required_union_sensitivity_recovery_case_count: {required_union}",
        f"required_operator_attention_required_case_count: {required_attention}",
        "",
    ]
    for name, value in gates.items():
        readme_lines.append(f"{name}: {value}")
    readme_lines.append("")
    for row in acceptance_summary["cases"]:
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
    print(f"ACCEPTANCE_SUMMARY={bundle_dir / 'acceptance_summary.json'}")
    print(f"README={bundle_dir / 'README.txt'}")
    print(f"TAR_GZ={tar_path}")
    print(f"TAR_GZ_SHA256={sha_path}")
    print(f"MANIFEST={bundle_dir / '00_manifest.json'}")
    print(f"SHA256={bundle_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
