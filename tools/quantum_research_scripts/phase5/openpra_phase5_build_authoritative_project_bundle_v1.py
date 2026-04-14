#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


SCRIPT_VERSION = "openpra-phase5-build-authoritative-project-bundle-v1"
ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
WORK_ROOT = ROOT / "_work"
DEFAULT_OUTPUT_ROOT = WORK_ROOT / "openpra_phase5_authoritative_project_bundle_v1"
WINDOWS_DEST = r"C:\Users\devin\OneDrive\Documents\NC State\OpenPRA\tars"


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

    sha_path = Path(str(tar_path) + ".sha256")
    digest = sha256_file(tar_path)
    sha_path.write_text(f"{digest}  {tar_path.name}\n", encoding="utf-8")
    return tar_path, sha_path


def run_git(args: List[str]) -> Tuple[int, str, str]:
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except FileNotFoundError:
        return 127, "", "git not found"


def collect_git_state(stamp: str, bundle_dir: Path) -> Dict[str, Any]:
    git_info: Dict[str, Any] = {
        "gitAvailable": False,
        "isRepo": False,
        "head": None,
        "branch": None,
        "statusPorcelain": None,
        "repoClean": None,
        "tagAttempted": False,
        "tagCreated": False,
        "tagName": None,
        "tagMessage": None,
        "notes": [],
    }

    rc, out, err = run_git(["rev-parse", "--is-inside-work-tree"])
    if rc != 0 or out.strip() != "true":
        git_info["notes"].append("Git repository not available or not detected.")
        if err.strip():
            git_info["notes"].append(err.strip())
        return git_info

    git_info["gitAvailable"] = True
    git_info["isRepo"] = True

    rc, out, _ = run_git(["rev-parse", "HEAD"])
    if rc == 0:
        git_info["head"] = out.strip()

    rc, out, _ = run_git(["rev-parse", "--abbrev-ref", "HEAD"])
    if rc == 0:
        git_info["branch"] = out.strip()

    rc, out, err = run_git(["status", "--porcelain=v1"])
    if rc == 0:
        git_info["statusPorcelain"] = out
        git_info["repoClean"] = len(out.strip()) == 0
    else:
        git_info["notes"].append("Unable to read git status.")
        if err.strip():
            git_info["notes"].append(err.strip())

    rc, out, err = run_git(["status"])
    write_text(bundle_dir / "git" / "git_status.txt", out if out else (err + "\n"))

    rc, out, err = run_git(["diff", "--stat"])
    write_text(bundle_dir / "git" / "git_diff_stat.txt", out if out else (err + "\n"))

    tag_name = f"openpra_phase5_authoritative_final_v1_{stamp}"
    git_info["tagName"] = tag_name

    if git_info["repoClean"] is True:
        git_info["tagAttempted"] = True
        tag_message = (
            "OpenPRA Phase 5 authoritative final acceptance state. "
            "Executed only validated set frozen at 3 cases, with 2 exact hardware recovery "
            "and 1 union sensitivity recovery."
        )
        git_info["tagMessage"] = tag_message
        rc, out, err = run_git(["tag", "-a", tag_name, "-m", tag_message])
        if rc == 0:
            git_info["tagCreated"] = True
            git_info["notes"].append(f"Annotated tag created: {tag_name}")
        else:
            git_info["notes"].append("Annotated tag creation skipped or failed.")
            if err.strip():
                git_info["notes"].append(err.strip())
    else:
        git_info["notes"].append(
            "Annotated tag not created because repository was not clean."
        )

    write_json(bundle_dir / "git" / "git_state.json", git_info)
    return git_info


def mark_superseded_runs(
    authoritative_dirs: List[Path],
    authoritative_bundle_dir: Path,
) -> Dict[str, Any]:
    authoritative_resolved = {p.resolve() for p in authoritative_dirs}
    authoritative_resolved.add(authoritative_bundle_dir.resolve())

    summary: Dict[str, Any] = {
        "generatedAt": utc_now_iso(),
        "markerFilename": "SUPERSEDED_BY_PHASE5_AUTHORITATIVE_PROJECT_BUNDLE_v1.txt",
        "markedDirectories": [],
        "skippedAuthoritativeDirectories": [],
        "supersededFilesIndexed": [],
    }

    if not WORK_ROOT.is_dir():
        return summary

    for phase_root in sorted(WORK_ROOT.iterdir()):
        if not phase_root.is_dir():
            continue
        if not phase_root.name.startswith("openpra_phase5_"):
            continue
        if phase_root.resolve() == DEFAULT_OUTPUT_ROOT.resolve():
            continue

        for child in sorted(phase_root.iterdir()):
            if child.is_dir():
                if child.resolve() in authoritative_resolved:
                    summary["skippedAuthoritativeDirectories"].append(str(child))
                    continue

                marker = child / "SUPERSEDED_BY_PHASE5_AUTHORITATIVE_PROJECT_BUNDLE_v1.txt"
                marker_text = (
                    "This run directory is superseded by the authoritative final acceptance state.\n\n"
                    f"authoritative_bundle_dir: {authoritative_bundle_dir}\n"
                    "authoritative_state: final acceptance gate passed\n"
                    "validated_executed_only_set: 3 cases\n"
                    "exact_hardware_recovery_case_count: 2\n"
                    "union_sensitivity_recovery_case_count: 1\n"
                    "operator_attention_required_case_count: 1\n"
                )
                write_text(marker, marker_text)
                summary["markedDirectories"].append(str(child))
            elif child.is_file():
                if (
                    child.suffix in {".gz", ".sha256"}
                    or child.name.endswith(".tar.gz")
                    or child.name.endswith(".tar.gz.sha256")
                ):
                    summary["supersededFilesIndexed"].append(str(child))

    return summary


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Build the final authoritative Phase 5 project bundle and cleanup markers."
    )
    ap.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    args = ap.parse_args()

    output_root = Path(args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    canonical_root = WORK_ROOT / "openpra_phase5_canonical_openpra_entrypoint_v1"
    final_integration_root = WORK_ROOT / "openpra_phase5_package_final_integration_tranche_v1"
    executed_release_root = WORK_ROOT / "openpra_phase5_executed_only_package_release_v1"
    closeout_root = WORK_ROOT / "openpra_phase5_project_closeout_bundle_v1"
    acceptance_root = WORK_ROOT / "openpra_phase5_final_acceptance_bundle_v1"
    validation_root = WORK_ROOT / "openpra_phase5_validate_package_recovery_on_real_candidates_v1"
    batch_cli_root = WORK_ROOT / "openpra_phase5_package_batch_cli_v1"

    canonical_dir = latest_run_dir(canonical_root)
    final_integration_dir = latest_run_dir(final_integration_root)
    executed_release_dir = latest_run_dir(executed_release_root)
    closeout_dir = latest_run_dir(closeout_root)
    acceptance_dir = latest_run_dir(acceptance_root)
    validation_dir = latest_run_dir(validation_root)
    batch_cli_dir = latest_run_dir(batch_cli_root)

    acceptance_summary_json = acceptance_dir / "acceptance_summary.json"
    if not acceptance_summary_json.exists():
        raise SystemExit(f"Missing final acceptance summary: {acceptance_summary_json}")

    acceptance_summary = read_json(acceptance_summary_json)
    if not bool(acceptance_summary.get("projectDoneGate")):
        raise SystemExit("Final acceptance summary does not show projectDoneGate=true.")

    stamp = utc_stamp()
    bundle_name = f"PHASE5_AUTHORITATIVE_PROJECT_BUNDLE_v1_{stamp}"
    bundle_dir = output_root / bundle_name
    bundle_dir.mkdir(parents=True, exist_ok=False)

    copied: Dict[str, Any] = {
        "acceptance": {},
        "executed_release": {},
        "project_closeout": {},
        "canonical": {},
        "final_integration": {},
        "validation": {},
        "batch_cli": {},
        "package_source_tree": {},
        "dist_outputs": {},
        "scripts": {},
    }

    copied["acceptance"]["dir"] = safe_copy_tree(
        acceptance_dir,
        bundle_dir / "acceptance_bundle"
    )
    copied["acceptance"]["tar_gz"] = safe_copy_file(
        acceptance_dir.with_suffix(".tar.gz"),
        bundle_dir / "acceptance_bundle_tar" / acceptance_dir.with_suffix(".tar.gz").name
    )
    copied["acceptance"]["tar_gz_sha256"] = safe_copy_file(
        Path(str(acceptance_dir.with_suffix(".tar.gz")) + ".sha256"),
        bundle_dir / "acceptance_bundle_tar" / (acceptance_dir.with_suffix(".tar.gz").name + ".sha256")
    )

    copied["executed_release"]["dir"] = safe_copy_tree(
        executed_release_dir,
        bundle_dir / "executed_only_release_bundle"
    )
    copied["executed_release"]["tar_gz"] = safe_copy_file(
        executed_release_dir.with_suffix(".tar.gz"),
        bundle_dir / "executed_only_release_bundle_tar" / executed_release_dir.with_suffix(".tar.gz").name
    )
    copied["executed_release"]["tar_gz_sha256"] = safe_copy_file(
        Path(str(executed_release_dir.with_suffix(".tar.gz")) + ".sha256"),
        bundle_dir / "executed_only_release_bundle_tar" / (executed_release_dir.with_suffix(".tar.gz").name + ".sha256")
    )

    copied["project_closeout"]["dir"] = safe_copy_tree(
        closeout_dir,
        bundle_dir / "project_closeout_bundle"
    )
    copied["project_closeout"]["tar_gz"] = safe_copy_file(
        closeout_dir.with_suffix(".tar.gz"),
        bundle_dir / "project_closeout_bundle_tar" / closeout_dir.with_suffix(".tar.gz").name
    )
    copied["project_closeout"]["tar_gz_sha256"] = safe_copy_file(
        Path(str(closeout_dir.with_suffix(".tar.gz")) + ".sha256"),
        bundle_dir / "project_closeout_bundle_tar" / (closeout_dir.with_suffix(".tar.gz").name + ".sha256")
    )

    copied["canonical"]["dir"] = safe_copy_tree(
        canonical_dir,
        bundle_dir / "canonical_entrypoint_run"
    )
    copied["final_integration"]["dir"] = safe_copy_tree(
        final_integration_dir,
        bundle_dir / "final_integration_run"
    )
    copied["validation"]["dir"] = safe_copy_tree(
        validation_dir,
        bundle_dir / "validation_run"
    )
    copied["batch_cli"]["dir"] = safe_copy_tree(
        batch_cli_dir,
        bundle_dir / "package_batch_cli_run"
    )

    copied["package_source_tree"]["src"] = safe_copy_tree(
        ROOT / "packages" / "quantum-readiness" / "src",
        bundle_dir / "packages" / "quantum-readiness" / "src"
    )
    copied["package_source_tree"]["package_json"] = safe_copy_file(
        ROOT / "packages" / "quantum-readiness" / "package.json",
        bundle_dir / "packages" / "quantum-readiness" / "package.json"
    )
    copied["package_source_tree"]["project_json"] = safe_copy_file(
        ROOT / "packages" / "quantum-readiness" / "project.json",
        bundle_dir / "packages" / "quantum-readiness" / "project.json"
    )
    copied["package_source_tree"]["readme"] = safe_copy_file(
        ROOT / "packages" / "quantum-readiness" / "README.md",
        bundle_dir / "packages" / "quantum-readiness" / "README.md"
    )

    copied["dist_outputs"]["dist_packages_quantum_readiness"] = safe_copy_tree(
        ROOT / "dist" / "packages" / "quantum-readiness",
        bundle_dir / "dist" / "packages" / "quantum-readiness"
    )
    copied["dist_outputs"]["dist_types_quantum_readiness"] = safe_copy_tree(
        ROOT / "dist" / "types" / "quantum-readiness",
        bundle_dir / "dist" / "types" / "quantum-readiness"
    )

    phase5_scripts_dir = ROOT / "scripts"
    copied["scripts"]["phase5_scripts"] = []
    for script in sorted(phase5_scripts_dir.glob("openpra_phase5_*")):
        if script.is_file():
            dst = bundle_dir / "scripts" / script.name
            result = safe_copy_file(script, dst)
            if result:
                copied["scripts"]["phase5_scripts"].append(result)

    git_state = collect_git_state(stamp, bundle_dir)

    authoritative_note_lines = [
        "OpenPRA Phase 5 authoritative artifacts note",
        "",
        f"generated_at: {utc_now_iso()}",
        f"script_version: {SCRIPT_VERSION}",
        f"project_done_gate: {acceptance_summary.get('projectDoneGate')}",
        f"selection_mode: {acceptance_summary.get('requiredSelectionMode')}",
        f"required_case_count: {acceptance_summary.get('requiredCaseCount')}",
        f"required_exact_hardware_recovery_case_count: {acceptance_summary.get('requiredExactHardwareRecoveryCaseCount')}",
        f"required_union_sensitivity_recovery_case_count: {acceptance_summary.get('requiredUnionSensitivityRecoveryCaseCount')}",
        f"required_operator_attention_required_case_count: {acceptance_summary.get('requiredOperatorAttentionRequiredCaseCount')}",
        "",
        f"authoritative_acceptance_run: {acceptance_dir}",
        f"authoritative_executed_release_run: {executed_release_dir}",
        f"authoritative_project_closeout_run: {closeout_dir}",
        f"authoritative_final_integration_run: {final_integration_dir}",
        f"authoritative_canonical_entrypoint_run: {canonical_dir}",
        f"authoritative_validation_run: {validation_dir}",
        "",
        "validated_executed_only_cases:",
    ]
    for row in acceptance_summary.get("cases", []):
        authoritative_note_lines.append(
            f"  {row['label']}  model={row['modelId']}  primary_mode={row['primaryMode']}  "
            f"tier1={row['tier1RecoveredExactCutSetCount']}/{row['referenceCutSetCount']}  "
            f"union={row['unionRecoveredCount']}/{row['referenceCutSetCount']}  "
            f"attention={row['requiresOperatorAttention']}"
        )
    authoritative_note_lines.append("")
    authoritative_note_lines.append("Git handling:")
    authoritative_note_lines.append(f"  repo_clean: {git_state.get('repoClean')}")
    authoritative_note_lines.append(f"  tag_name: {git_state.get('tagName')}")
    authoritative_note_lines.append(f"  tag_created: {git_state.get('tagCreated')}")
    authoritative_note_lines.append("")
    write_text(bundle_dir / "AUTHORITATIVE_ARTIFACTS_NOTE.txt", "\n".join(authoritative_note_lines))

    authoritative_note_json = {
        "generatedAt": utc_now_iso(),
        "scriptVersion": SCRIPT_VERSION,
        "authoritativeAcceptanceRun": str(acceptance_dir),
        "authoritativeExecutedReleaseRun": str(executed_release_dir),
        "authoritativeProjectCloseoutRun": str(closeout_dir),
        "authoritativeFinalIntegrationRun": str(final_integration_dir),
        "authoritativeCanonicalRun": str(canonical_dir),
        "authoritativeValidationRun": str(validation_dir),
        "cases": acceptance_summary.get("cases", []),
        "gitState": git_state,
    }
    write_json(bundle_dir / "authoritative_artifacts_note.json", authoritative_note_json)

    superseded_summary = mark_superseded_runs(
        authoritative_dirs=[
            canonical_dir,
            final_integration_dir,
            executed_release_dir,
            closeout_dir,
            acceptance_dir,
            validation_dir,
            batch_cli_dir,
        ],
        authoritative_bundle_dir=bundle_dir,
    )
    write_json(bundle_dir / "superseded_runs_summary.json", superseded_summary)

    tar_preview_path = bundle_dir.with_suffix(".tar.gz")
    transfer_lines = [
        "Windows transfer instructions",
        "",
        f"Destination: {WINDOWS_DEST}",
        "",
        "Run these commands in Windows PowerShell:",
        "",
        f'$Dest = "{WINDOWS_DEST}"',
        "New-Item -ItemType Directory -Force -Path $Dest | Out-Null",
        f'scp clusteradmin@440work:{tar_preview_path} $Dest',
        f'scp clusteradmin@440work:{tar_preview_path}.sha256 $Dest',
        "",
    ]
    write_text(bundle_dir / "WINDOWS_TRANSFER_INSTRUCTIONS.txt", "\n".join(transfer_lines))

    project_summary = {
        "generatedAt": utc_now_iso(),
        "scriptVersion": SCRIPT_VERSION,
        "projectDoneGate": acceptance_summary.get("projectDoneGate"),
        "selectionMode": acceptance_summary.get("requiredSelectionMode"),
        "caseCount": acceptance_summary.get("requiredCaseCount"),
        "exactHardwareRecoveryCaseCount": acceptance_summary.get("requiredExactHardwareRecoveryCaseCount"),
        "unionSensitivityRecoveryCaseCount": acceptance_summary.get("requiredUnionSensitivityRecoveryCaseCount"),
        "operatorAttentionRequiredCaseCount": acceptance_summary.get("requiredOperatorAttentionRequiredCaseCount"),
        "acceptanceCases": acceptance_summary.get("cases", []),
        "authoritativeAcceptanceRun": str(acceptance_dir),
        "authoritativeExecutedReleaseRun": str(executed_release_dir),
        "authoritativeProjectCloseoutRun": str(closeout_dir),
        "authoritativeFinalIntegrationRun": str(final_integration_dir),
        "authoritativeCanonicalRun": str(canonical_dir),
        "authoritativeValidationRun": str(validation_dir),
        "gitState": git_state,
        "supersededSummaryPath": str(bundle_dir / "superseded_runs_summary.json"),
        "windowsDestination": WINDOWS_DEST,
        "copiedFiles": copied,
    }
    write_json(bundle_dir / "authoritative_project_summary.json", project_summary)

    readme_lines = [
        "OpenPRA Phase 5 authoritative project bundle",
        "",
        f"generated_at: {project_summary['generatedAt']}",
        f"project_done_gate: {project_summary['projectDoneGate']}",
        f"selection_mode: {project_summary['selectionMode']}",
        f"case_count: {project_summary['caseCount']}",
        f"exact_hardware_recovery_case_count: {project_summary['exactHardwareRecoveryCaseCount']}",
        f"union_sensitivity_recovery_case_count: {project_summary['unionSensitivityRecoveryCaseCount']}",
        f"operator_attention_required_case_count: {project_summary['operatorAttentionRequiredCaseCount']}",
        "",
    ]
    for row in project_summary["acceptanceCases"]:
        readme_lines.append(
            f"{row['label']}  model={row['modelId']}  primary_mode={row['primaryMode']}  "
            f"tier1={row['tier1RecoveredExactCutSetCount']}/{row['referenceCutSetCount']}  "
            f"union={row['unionRecoveredCount']}/{row['referenceCutSetCount']}  "
            f"attention={row['requiresOperatorAttention']}"
        )
    readme_lines.append("")
    readme_lines.append(f"windows_destination: {WINDOWS_DEST}")
    readme_lines.append(f"git_tag_created: {git_state.get('tagCreated')}")
    readme_lines.append(f"git_tag_name: {git_state.get('tagName')}")
    readme_lines.append("")
    write_text(bundle_dir / "README.txt", "\n".join(readme_lines))

    write_manifest(bundle_dir)
    tar_path, sha_path = build_tarball(bundle_dir)

    print(f"BUNDLE_DIR={bundle_dir}")
    print(f"AUTHORITATIVE_PROJECT_SUMMARY={bundle_dir / 'authoritative_project_summary.json'}")
    print(f"AUTHORITATIVE_NOTE={bundle_dir / 'AUTHORITATIVE_ARTIFACTS_NOTE.txt'}")
    print(f"WINDOWS_TRANSFER_INSTRUCTIONS={bundle_dir / 'WINDOWS_TRANSFER_INSTRUCTIONS.txt'}")
    print(f"TAR_GZ={tar_path}")
    print(f"TAR_GZ_SHA256={sha_path}")
    print(f"MANIFEST={bundle_dir / '00_manifest.json'}")
    print(f"SHA256={bundle_dir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
