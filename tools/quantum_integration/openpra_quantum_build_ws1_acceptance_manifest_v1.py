#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path.cwd()
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws1_acceptance_manifest_v1"

INCLUDE_PATHS = [
    "packages/quantum-readiness/src/lib",
    "packages/web-backend/src/quantumReadiness",
    "packages/web-backend/tests",
    "tools/quantum_integration",
]

INCLUDE_FILE_SUFFIXES = {
    ".ts",
    ".js",
    ".py",
    ".sh",
    ".json",
    ".md",
}

EXCLUDE_PATH_PARTS = {
    ".git",
    "node_modules",
    "dist",
    "coverage",
    "_work",
}


@dataclass(frozen=True)
class ManifestEntry:
    relative_path: str
    size_bytes: int
    sha256: str


def run_git(args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def should_include(path: Path) -> bool:
    if path.suffix.lower() not in INCLUDE_FILE_SUFFIXES:
        return False

    parts = set(path.parts)
    if parts.intersection(EXCLUDE_PATH_PARTS):
        return False

    return True


def iter_target_files() -> Iterable[Path]:
    for rel in INCLUDE_PATHS:
        start = REPO_ROOT / rel
        if not start.exists():
            continue
        for path in start.rglob("*"):
            if path.is_file() and should_include(path):
                yield path


def build_entries() -> list[ManifestEntry]:
    entries: list[ManifestEntry] = []
    for path in sorted(iter_target_files()):
        rel = path.relative_to(REPO_ROOT).as_posix()
        entries.append(
            ManifestEntry(
                relative_path=rel,
                size_bytes=path.stat().st_size,
                sha256=sha256_file(path),
            )
        )
    return entries


def main() -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS1_ACCEPTANCE_MANIFEST_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    entries = build_entries()

    head_commit = run_git(["rev-parse", "HEAD"])
    branch_name = run_git(["branch", "--show-current"])
    short_status = run_git(["status", "--short"])
    tags_at_head = run_git(["tag", "--points-at", "HEAD"])

    manifest = {
        "run_metadata": {
            "artifact_name": "OPENPRA_WS1_ACCEPTANCE_MANIFEST_v1",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "repo_root": str(REPO_ROOT),
            "head_commit": head_commit,
            "branch_name": branch_name,
        },
        "acceptance_gate_snapshot": {
            "git_status_clean": short_status == "",
            "git_status_short": short_status.splitlines() if short_status else [],
            "annotated_tags_at_head": tags_at_head.splitlines() if tags_at_head else [],
            "tracked_file_count": len(entries),
        },
        "tracked_files": [
            {
                "relative_path": e.relative_path,
                "size_bytes": e.size_bytes,
                "sha256": e.sha256,
            }
            for e in entries
        ],
    }

    manifest_path = out_dir / "openpra_ws1_acceptance_manifest_v1.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    sha_path = out_dir / "openpra_ws1_acceptance_manifest_v1.json.sha256"
    sha_path.write_text(
        f"{sha256_file(manifest_path)}  {manifest_path.name}\n",
        encoding="utf-8",
    )

    readme_path = out_dir / "README.md"
    readme_path.write_text(
        "\n".join(
            [
                "# OpenPRA WS1 Acceptance Manifest v1",
                "",
                f"Generated at UTC: {manifest['run_metadata']['generated_at_utc']}",
                f"HEAD commit: {head_commit}",
                f"Branch: {branch_name}",
                f"Tracked file count: {len(entries)}",
                f"Git status clean: {manifest['acceptance_gate_snapshot']['git_status_clean']}",
                "",
                "Files:",
                f"- {manifest_path.name}",
                f"- {sha_path.name}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(manifest_path))
    print(str(sha_path))
    print(f"tracked_file_count={len(entries)}")
    print(f"git_status_clean={manifest['acceptance_gate_snapshot']['git_status_clean']}")


if __name__ == "__main__":
    main()
