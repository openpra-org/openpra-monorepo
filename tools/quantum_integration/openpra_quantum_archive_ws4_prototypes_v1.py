#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
TOOLS_DIR = REPO_ROOT / "tools" / "quantum_integration"
ARCHIVE_BASE = TOOLS_DIR / "_archive_ws4"

PROTOTYPE_FILES = [
    "openpra_quantum_build_ws4_best_effort_selection_v1.py",
    "openpra_quantum_expand_ws4_source_universe_v1.py",
    "openpra_quantum_finalize_ws4_universe_v2.py",
    "openpra_quantum_freeze_ws4_all_available_cohort_v1.py",
    "openpra_quantum_freeze_ws4_provisional_cohort_v1.py",
    "openpra_quantum_repair_ws4_case_universe_v1.py",
]

CANONICAL_FILES = [
    "openpra_quantum_build_ws4_review_clean_freeze_v1.py",
    "openpra_quantum_fix_ws4_review_clean_holdouts_v1.py",
    "openpra_quantum_refresh_ws4_review_clean_memo_v1.py",
    "openpra_quantum_build_ws4_validation_control_v1.py",
    "openpra_quantum_build_ws4_execution_package_v1.py",
    "openpra_quantum_build_ws4_ops_bundle_v1.py",
    "openpra_quantum_refresh_ws4_ops_views_v1.py",
    "openpra_quantum_run_ws4_ops_refresh_v1.sh",
]


def main() -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    archive_dir = ARCHIVE_BASE / f"WS4_PROTOTYPES_{stamp}"
    archive_dir.mkdir(parents=True, exist_ok=True)

    moved = []
    missing = []

    for name in PROTOTYPE_FILES:
        src = TOOLS_DIR / name
        if not src.exists():
            missing.append(name)
            continue
        dst = archive_dir / name
        shutil.move(str(src), str(dst))
        moved.append(name)

    manifest = {
        "artifact_name": "WS4_PROTOTYPE_ARCHIVE_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "archive_dir": archive_dir.relative_to(REPO_ROOT).as_posix(),
        "moved_files": moved,
        "missing_files": missing,
        "canonical_files_left_in_place": CANONICAL_FILES,
    }

    manifest_path = archive_dir / "ws4_prototype_archive_manifest_v1.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(str(archive_dir))
    print(str(manifest_path))
    print(f"moved_count={len(moved)}")
    print(f"missing_count={len(missing)}")


if __name__ == "__main__":
    main()
