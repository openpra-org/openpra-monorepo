#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[1]
EXPORT_RUNS_BASE = REPO_ROOT / "_work" / "openpra_quantum_preparation_exports_v1"
BUNDLE_BUILDS_BASE = REPO_ROOT / "_work" / "openpra_quantum_bundle_builds_v1"

PROFESSOR_BUNDLE_NAME = "PROFESSOR_BUNDLE_OPENPRA_QR_v2"
CONTRIBUTION_BUNDLE_NAME = "OPENPRA_QR_CONTRIBUTION_BUNDLE_v2"
REGISTRATION_BUNDLE_NAME = "OPENPRA_QR_REGISTRATION_EVIDENCE_BUNDLE_v2"

PROFESSOR_REVIEW_BASE_FILES = [
    "90_summary.json",
    "91_candidate_rollup.json",
    "95_phase3_summary.md",
    "README.txt",
]


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_sha_sidecar(path: Path) -> Path:
    sidecar = path.with_name(path.name + ".sha256.txt")
    sidecar.write_text(f"{sha256_file(path)}  {path}\n", encoding="utf-8")
    return sidecar


def safe_git_value(args: list[str]) -> str | None:
    try:
        result = subprocess.run(
            args,
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def safe_git_status_lines() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        return [line.rstrip() for line in result.stdout.splitlines() if line.strip()]
    except subprocess.CalledProcessError:
        return []


def latest_export_run() -> Path:
    runs = [p for p in EXPORT_RUNS_BASE.iterdir() if p.is_dir()]
    if not runs:
        raise RuntimeError(f"No export runs found under {EXPORT_RUNS_BASE}")
    return sorted(runs)[-1]


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def copy_file(src: Path, dst: Path) -> None:
    ensure_parent(dst)
    shutil.copy2(src, dst)


def copy_many(run_dir: Path, bundle_dir: Path, names: Iterable[str], prefix: str = "") -> None:
    for name in names:
        src = run_dir / name if prefix == "" else REPO_ROOT / prefix / name
        dst = bundle_dir / name
        copy_file(src, dst)


def copy_repo_file(bundle_dir: Path, repo_relative: str) -> None:
    src = REPO_ROOT / repo_relative
    dst = bundle_dir / "code" / repo_relative
    copy_file(src, dst)


def write_bundle_readme(path: Path, title: str, body_lines: list[str]) -> None:
    lines = [f"# {title}", ""] + body_lines + [""]
    write_text(path, "\n".join(lines))


def tar_and_hash(bundle_dir: Path) -> tuple[Path, Path]:
    tar_path = bundle_dir.with_suffix(".tar.gz")
    sha_path = bundle_dir.with_suffix(".tar.gz.sha256.txt")

    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(bundle_dir, arcname=bundle_dir.name)

    sha_path.write_text(f"{sha256_file(tar_path)}  {tar_path}\n", encoding="utf-8")
    return tar_path, sha_path


def list_top_level_run_files(run_dir: Path) -> list[str]:
    return sorted(
        path.name
        for path in run_dir.iterdir()
        if path.is_file()
    )


def build_professor_file_list(run_files: list[str]) -> tuple[list[str], dict[str, list[str]]]:
    run_file_set = set(run_files)

    readiness_base_files = sorted(
        name for name in run_files
        if "_readiness.json" in name and not name.endswith(".sha256.txt")
    )
    preparation_base_files = sorted(
        name for name in run_files
        if "_preparation.json" in name and not name.endswith(".sha256.txt")
    )
    review_base_files = [
        name for name in PROFESSOR_REVIEW_BASE_FILES
        if name in run_file_set
    ]

    expected_base_files = (
        readiness_base_files
        + preparation_base_files
        + review_base_files
    )

    missing_base_files = [
        name for name in PROFESSOR_REVIEW_BASE_FILES
        if name not in run_file_set
    ]
    if missing_base_files:
        raise RuntimeError(
            f"Professor review base files missing from export run: {', '.join(missing_base_files)}"
        )

    professor_files: list[str] = []
    missing_sidecars: list[str] = []

    for base_name in expected_base_files:
        professor_files.append(base_name)
        sidecar_name = f"{base_name}.sha256.txt"
        if sidecar_name in run_file_set:
            professor_files.append(sidecar_name)
        else:
            missing_sidecars.append(sidecar_name)

    if missing_sidecars:
        raise RuntimeError(
            f"Professor review sidecar files missing from export run: {', '.join(sorted(missing_sidecars))}"
        )

    manifest = {
        "readiness_base_files": readiness_base_files,
        "preparation_base_files": preparation_base_files,
        "review_base_files": review_base_files,
        "expected_base_files": expected_base_files,
        "copied_files": sorted(professor_files),
    }

    return sorted(professor_files), manifest


def main() -> int:
    run_dir = latest_export_run()
    build_root = BUNDLE_BUILDS_BASE / utc_stamp()
    build_root.mkdir(parents=True, exist_ok=False)

    professor_dir = build_root / PROFESSOR_BUNDLE_NAME
    contribution_dir = build_root / CONTRIBUTION_BUNDLE_NAME
    registration_dir = build_root / REGISTRATION_BUNDLE_NAME

    professor_dir.mkdir()
    contribution_dir.mkdir()
    registration_dir.mkdir()

    run_files = list_top_level_run_files(run_dir)
    concise_files, professor_manifest = build_professor_file_list(run_files)
    release_files = list(run_files)

    copy_many(run_dir, professor_dir, concise_files)
    copy_many(run_dir, contribution_dir, release_files)
    copy_many(run_dir, registration_dir, release_files)

    contribution_code_files = [
        "packages/quantum-readiness/src/lib/types.ts",
        "packages/quantum-readiness/src/lib/openpra-fault-tree-graph-adapter.ts",
        "packages/quantum-readiness/src/lib/openpra-fault-tree-readiness.ts",
        "packages/quantum-readiness/src/lib/quantum-readiness.ts",
        "packages/quantum-readiness/src/lib/quantum-preparation.ts",
        "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts",
        "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts",
        "scripts/export_openpra_quantum_preparation_v1.py",
        "scripts/build_openpra_quantum_bundles_v1.py",
    ]

    registration_extra_files = [
        "packages/quantum-readiness/src/lib/quantum-preparation.spec.ts",
        "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.spec.ts",
        "packages/web-backend/tests/quantumReadiness.preparation.http.spec.ts",
        "packages/web-backend/tests/openPraReleaseArtifacts.http.spec.ts",
        "packages/web-backend/src/quantumReadiness/openPraFaultTreeGraph.fixtures.ts",
    ]

    for repo_relative in contribution_code_files:
        copy_repo_file(contribution_dir, repo_relative)
        copy_repo_file(registration_dir, repo_relative)

    for repo_relative in registration_extra_files:
        copy_repo_file(registration_dir, repo_relative)

    metadata_dir = registration_dir / "metadata"
    metadata_dir.mkdir(parents=True, exist_ok=True)
    write_text(metadata_dir / "git_head.txt", (safe_git_value(["git", "rev-parse", "HEAD"]) or "") + "\n")
    write_text(metadata_dir / "git_branch.txt", (safe_git_value(["git", "branch", "--show-current"]) or "") + "\n")
    write_text(metadata_dir / "git_status_short.txt", "\n".join(safe_git_status_lines()) + "\n")

    professor_manifest_path = professor_dir / "00_professor_bundle_manifest.json"
    write_json(
        professor_manifest_path,
        {
            "generated_at": iso_utc_now(),
            "source_export_run": str(run_dir),
            **professor_manifest,
        },
    )
    write_sha_sidecar(professor_manifest_path)

    professor_case_outputs = professor_manifest["readiness_base_files"] + professor_manifest["preparation_base_files"]
    professor_review_artifacts = professor_manifest["review_base_files"] + [
        "00_professor_bundle_manifest.json"
    ]

    write_bundle_readme(
        professor_dir / "README.txt",
        "Professor Review Bundle",
        [
            "Purpose",
            "",
            "Provide the shortest review path for the current OpenPRA quantum readiness and preparation export results.",
            "",
            "Contents",
            "",
            "1. All current readiness outputs",
            "2. All current preparation outputs",
            "3. Run level summary files",
            "4. Professor bundle manifest",
            "5. Export run README",
            "",
            f"Included case output files: {', '.join(professor_case_outputs) if professor_case_outputs else 'none'}",
            f"Included review summary files: {', '.join(professor_review_artifacts) if professor_review_artifacts else 'none'}",
        ],
    )
    write_sha_sidecar(professor_dir / "README.txt")

    write_bundle_readme(
        contribution_dir / "README.txt",
        "Contribution Bundle",
        [
            "Purpose",
            "",
            "Capture the refreshed OpenPRA contribution state with export artifacts, source inputs, selected code, and integrity sidecars.",
            "",
            f"Source export run: {run_dir}",
            f"Run files copied: {len(release_files)}",
        ],
    )

    write_bundle_readme(
        registration_dir / "README.txt",
        "Registration Evidence Bundle",
        [
            "Purpose",
            "",
            "Capture the refreshed OpenPRA contribution state plus key source files, tests, and git metadata for authorship and provenance support.",
            "",
            f"Source export run: {run_dir}",
            f"Run files copied: {len(release_files)}",
        ],
    )

    professor_tar, professor_sha = tar_and_hash(professor_dir)
    contribution_tar, contribution_sha = tar_and_hash(contribution_dir)
    registration_tar, registration_sha = tar_and_hash(registration_dir)

    build_manifest = {
        "generated_at": iso_utc_now(),
        "build_root": str(build_root),
        "source_export_run": str(run_dir),
        "copied_run_files": release_files,
        "copied_professor_files": concise_files + [
            "00_professor_bundle_manifest.json",
            "00_professor_bundle_manifest.json.sha256.txt",
            "README.txt",
            "README.txt.sha256.txt",
        ],
        "bundles": {
            "professor": {
                "directory": str(professor_dir),
                "tar_gz": str(professor_tar),
                "sha256_file": str(professor_sha),
            },
            "contribution": {
                "directory": str(contribution_dir),
                "tar_gz": str(contribution_tar),
                "sha256_file": str(contribution_sha),
            },
            "registration": {
                "directory": str(registration_dir),
                "tar_gz": str(registration_tar),
                "sha256_file": str(registration_sha),
            },
        },
    }

    write_json(build_root / "00_bundle_build_manifest.json", build_manifest)
    write_sha_sidecar(build_root / "00_bundle_build_manifest.json")

    print(f"BUNDLE_BUILD_ROOT={build_root}")
    print(f"SOURCE_EXPORT_RUN={run_dir}")
    print(f"PROFESSOR_TAR={professor_tar}")
    print(f"CONTRIBUTION_TAR={contribution_tar}")
    print(f"REGISTRATION_TAR={registration_tar}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
