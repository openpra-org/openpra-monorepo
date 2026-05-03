#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
FREEZE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_review_clean_freeze_v1"


def find_latest_freeze_dir() -> Path:
    candidates = sorted(FREEZE_BASE.glob("OPENPRA_WS4_REVIEW_CLEAN_FREEZE_v1_*"))
    if not candidates:
        raise RuntimeError(f"No review clean freeze directory found under {FREEZE_BASE}")
    return candidates[-1]


def main() -> None:
    freeze_dir = find_latest_freeze_dir()
    memo_md = freeze_dir / "openpra_ws4_review_clean_memo_v1.md"
    if not memo_md.exists():
        raise RuntimeError(f"Missing memo: {memo_md}")

    lines = memo_md.read_text(encoding="utf-8").splitlines()
    rebuilt = []
    replaced = False

    for line in lines:
        if line.startswith("Generated at UTC: "):
            rebuilt.append(f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}")
            replaced = True
        else:
            rebuilt.append(line)

    if not replaced:
        rebuilt.insert(2, f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}")

    memo_md.write_text("\n".join(rebuilt) + "\n", encoding="utf-8")

    print(str(freeze_dir))
    print(str(memo_md))
    print("memo_timestamp_refreshed=True")


if __name__ == "__main__":
    main()
