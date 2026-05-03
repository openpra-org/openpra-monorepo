#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
GITIGNORE_PATH = REPO_ROOT / ".gitignore"

IGNORE_MARKER = "# OpenPRA quantum integration generated work artifacts"
IGNORE_BLOCK = """# OpenPRA quantum integration generated work artifacts
/_work/openpra_quantum_ws1_acceptance_manifest_v1/
/_work/openpra_quantum_frontend_subtree_detail_payload_checkpoint_v1/
/_work/openpra_quantum_frontend_execution_mode_selection_payload_checkpoint_v1/
/_work/openpra_quantum_frontend_recovery_results_payload_checkpoint_v1/
/_work/openpra_quantum_frontend_importance_comparison_payload_checkpoint_v1/
/_work/openpra_quantum_frontend_provenance_export_payload_checkpoint_v1/
/_work/openpra_quantum_ws1_acceptance_closeout_v1/
"""

OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws1_acceptance_closeout_v1"


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


def ensure_gitignore_block() -> bool:
    existing = GITIGNORE_PATH.read_text(encoding="utf-8") if GITIGNORE_PATH.exists() else ""

    if IGNORE_MARKER in existing:
        return False

    updated = existing
    if updated and not updated.endswith("\n"):
        updated += "\n"
    updated += "\n" + IGNORE_BLOCK

    GITIGNORE_PATH.write_text(updated, encoding="utf-8")
    return True


def latest_manifest_dir() -> str | None:
    base = REPO_ROOT / "_work" / "openpra_quantum_ws1_acceptance_manifest_v1"
    if not base.exists():
        return None

    dirs = sorted([p for p in base.iterdir() if p.is_dir()])
    if not dirs:
        return None

    return dirs[-1].relative_to(REPO_ROOT).as_posix()


def quarantine_counts() -> dict[str, int]:
    root = REPO_ROOT / "tools" / "quantum-research-scripts"
    phase5 = root / "phase5_untracked_quarantine_v1"
    misc = root / "misc_untracked_quarantine_v1"

    return {
        "phase5_file_count": sum(1 for p in phase5.rglob("*") if p.is_file()) if phase5.exists() else 0,
        "misc_file_count": sum(1 for p in misc.rglob("*") if p.is_file()) if misc.exists() else 0,
    }


def main() -> None:
    gitignore_changed = ensure_gitignore_block()

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS1_ACCEPTANCE_CLOSEOUT_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    head_commit = run_git(["rev-parse", "HEAD"])
    branch_name = run_git(["branch", "--show-current"])
    short_status = run_git(["status", "--short"])
    tags_at_head = run_git(["tag", "--points-at", "HEAD"])

    payload_chain_tags = [
        tag
        for tag in (tags_at_head.splitlines() if tags_at_head else [])
        if tag.startswith("openpra_quantum_integration_payload_chain_v1_")
    ]

    report = {
        "run_metadata": {
            "artifact_name": "OPENPRA_WS1_ACCEPTANCE_CLOSEOUT_v1",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "repo_root": str(REPO_ROOT),
            "head_commit": head_commit,
            "branch_name": branch_name,
        },
        "ws1_progress_snapshot": {
            "gitignore_updated": gitignore_changed,
            "git_status_clean": short_status == "",
            "git_status_short": short_status.splitlines() if short_status else [],
            "payload_chain_tags_at_head": payload_chain_tags,
            "latest_ws1_manifest_dir": latest_manifest_dir(),
            "research_quarantine": quarantine_counts(),
        },
    }

    report_path = out_dir / "openpra_ws1_acceptance_closeout_v1.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    sha_path = out_dir / "openpra_ws1_acceptance_closeout_v1.json.sha256"
    sha_path.write_text(
        f"{sha256_file(report_path)}  {report_path.name}\n",
        encoding="utf-8",
    )

    readme_path = out_dir / "README.md"
    readme_path.write_text(
        "\n".join(
            [
                "# OpenPRA WS1 Acceptance Closeout v1",
                "",
                f"Generated at UTC: {report['run_metadata']['generated_at_utc']}",
                f"HEAD commit: {head_commit}",
                f"Branch: {branch_name}",
                f"Git status clean: {report['ws1_progress_snapshot']['git_status_clean']}",
                f"Payload-chain tag count at HEAD: {len(payload_chain_tags)}",
                "",
                "Files:",
                f"- {report_path.name}",
                f"- {sha_path.name}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(report_path))
    print(str(sha_path))
    print(f"gitignore_updated={gitignore_changed}")
    print(f"git_status_clean={report['ws1_progress_snapshot']['git_status_clean']}")
    print(f"payload_chain_tag_count={len(payload_chain_tags)}")


if __name__ == "__main__":
    main()
