#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


SCRIPT_VERSION = "openpra-phase5-build-executed-only-package-release-bundle-v1"
ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
DEFAULT_SOURCE_ROOT = ROOT / "_work" / "openpra_phase5_package_final_integration_tranche_v1"
DEFAULT_OUTPUT_ROOT = ROOT / "_work" / "openpra_phase5_executed_only_package_release_v1"


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
        raise SystemExit(f"Source root does not exist: {root}")
    dirs = sorted([p for p in root.iterdir() if p.is_dir()], reverse=True)
    if not dirs:
        raise SystemExit(f"No run directories found under: {root}")
    return dirs[0]


def safe_copy(src: Path, dst: Path) -> str | None:
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
        description="Build the authoritative executed-only package release bundle from the final integration tranche."
    )
    ap.add_argument("--source-root", default=str(DEFAULT_SOURCE_ROOT))
    ap.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    args = ap.parse_args()

    source_root = Path(args.source_root).resolve()
    output_root = Path(args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    latest_final = latest_run_dir(source_root)
    final_summary_json = latest_final / "final_integration_summary.json"
    final_summary_txt = latest_final / "final_integration_summary.txt"

    if not final_summary_json.exists():
        raise SystemExit(f"Missing final integration summary json: {final_summary_json}")

    final_summary = read_json(final_summary_json)

    selection_mode = final_summary.get("selectionMode")
    if selection_mode != "legacy_validated_only":
        raise SystemExit(
            f"Expected executed-only final integration summary with selectionMode=legacy_validated_only, got: {selection_mode}"
        )

    case_count = int(final_summary["caseCount"])
    exact_count = int(final_summary["exactHardwareRecoveryCaseCount"])
    union_count = int(final_summary["unionSensitivityRecoveryCaseCount"])
    attention_count = int(final_summary["operatorAttentionRequiredCaseCount"])
    semantic_parity = bool(final_summary["allCasesSemanticParityMatch"])

    stamp = utc_stamp()
    bundle_name = f"PHASE5_EXECUTED_ONLY_PACKAGE_RELEASE_BUNDLE_v1_{stamp}"
    bundle_dir = output_root / bundle_name
    bundle_dir.mkdir(parents=True, exist_ok=False)

    copied: Dict[str, Any] = {
        "top_level": {},
        "cases": {}
    }

    copied["top_level"]["final_integration_summary_json"] = safe_copy(
        final_summary_json,
        bundle_dir / "final_integration" / "final_integration_summary.json"
    )
    copied["top_level"]["final_integration_summary_txt"] = safe_copy(
        final_summary_txt,
        bundle_dir / "final_integration" / "final_integration_summary.txt"
    )

    batch_rollup_json = Path(final_summary["packageBatchRollupPath"])
    batch_rollup_txt = batch_rollup_json.with_suffix(".txt")
    copied["top_level"]["package_batch_rollup_json"] = safe_copy(
        batch_rollup_json,
        bundle_dir / "package_batch_rollup" / "openpra_package_recovery_batch_rollup_v1.json"
    )
    copied["top_level"]["package_batch_rollup_txt"] = safe_copy(
        batch_rollup_txt,
        bundle_dir / "package_batch_rollup" / "openpra_package_recovery_batch_rollup_v1.txt"
    )

    validation_json = Path(final_summary["semanticValidationPath"])
    validation_txt = validation_json.with_suffix(".txt")
    copied["top_level"]["semantic_validation_json"] = safe_copy(
        validation_json,
        bundle_dir / "semantic_validation" / "validation_rollup.json"
    )
    copied["top_level"]["semantic_validation_txt"] = safe_copy(
        validation_txt,
        bundle_dir / "semantic_validation" / "validation_rollup.txt"
    )

    release_cases: List[Dict[str, Any]] = []
    for case in final_summary["cases"]:
        label = str(case["label"])
        model_id = str(case["modelId"])
        candidate_dir = Path(case["candidateDir"])
        case_dir = bundle_dir / "cases" / label

        copied_case: Dict[str, Any] = {}
        copied_case["package_result_json"] = safe_copy(
            candidate_dir / "openpra_package_recovery_result_v1.json",
            case_dir / "openpra_package_recovery_result_v1.json"
        )
        copied_case["package_result_txt"] = safe_copy(
            candidate_dir / "openpra_package_recovery_result_v1.txt",
            case_dir / "openpra_package_recovery_result_v1.txt"
        )
        copied_case["legacy_result_json"] = safe_copy(
            candidate_dir / "openpra_recovery_ladder_result_v1.json",
            case_dir / "openpra_recovery_ladder_result_v1.json"
        )
        copied_case["package_metadata_json"] = safe_copy(
            candidate_dir / "package_metadata.json",
            case_dir / "package_metadata.json"
        )
        copied_case["raw_counts_json"] = safe_copy(
            candidate_dir / "raw_counts.json",
            case_dir / "raw_counts.json"
        )
        copied_case["classical_reference_mcs_json"] = safe_copy(
            candidate_dir / "classical_reference_mcs.json",
            case_dir / "classical_reference_mcs.json"
        )

        copied["cases"][label] = copied_case
        release_cases.append(
            {
                "label": label,
                "modelId": model_id,
                "candidateRootNodeId": case["candidateRootNodeId"],
                "topologyClass": case["topologyClass"],
                "basicEventCount": case["basicEventCount"],
                "requiredQubits": case["requiredQubits"],
                "primaryMode": case["primaryMode"],
                "requiresOperatorAttention": case["requiresOperatorAttention"],
                "referenceCutSetCount": case["referenceCutSetCount"],
                "tier1RecoveredExactCutSetCount": case["tier1RecoveredExactCutSetCount"],
                "unionRecoveredCount": case["unionRecoveredCount"],
                "unionAllRecovered": case["unionAllRecovered"],
                "sourceCandidateDir": str(candidate_dir),
            }
        )

    release_summary = {
        "generatedAt": utc_now_iso(),
        "scriptVersion": SCRIPT_VERSION,
        "sourceFinalIntegrationRun": str(latest_final),
        "selectionMode": selection_mode,
        "caseCount": case_count,
        "exactHardwareRecoveryCaseCount": exact_count,
        "unionSensitivityRecoveryCaseCount": union_count,
        "operatorAttentionRequiredCaseCount": attention_count,
        "allCasesSemanticParityMatch": semantic_parity,
        "cases": release_cases,
        "copiedFiles": copied,
    }
    write_json(bundle_dir / "release_summary.json", release_summary)

    readme_lines = [
        "OpenPRA Phase 5 executed-only package release bundle",
        "",
        f"generated_at: {release_summary['generatedAt']}",
        f"selection_mode: {selection_mode}",
        f"case_count: {case_count}",
        f"exact_hardware_recovery_case_count: {exact_count}",
        f"union_sensitivity_recovery_case_count: {union_count}",
        f"operator_attention_required_case_count: {attention_count}",
        f"all_cases_semantic_parity_match: {semantic_parity}",
        "",
    ]
    for row in release_cases:
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
    print(f"RELEASE_SUMMARY={bundle_dir / 'release_summary.json'}")
    print(f"README={bundle_dir / 'README.txt'}")
    print(f"TAR_GZ={tar_path}")
    print(f"TAR_GZ_SHA256={sha_path}")
    print(f"MANIFEST={bundle_dir / '00_manifest.json'}")
    print(f"SHA256={bundle_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
