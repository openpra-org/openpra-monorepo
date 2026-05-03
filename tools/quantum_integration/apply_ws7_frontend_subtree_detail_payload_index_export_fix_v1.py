#!/usr/bin/env python3
from pathlib import Path

REPO_ROOT = Path.cwd()
INDEX_PATH = REPO_ROOT / "packages/quantum-readiness/src/lib/index.ts"

BAD_LINE = 'export * from "./lib/openpra-quantum-frontend-subtree-detail-payload";'
GOOD_LINE = 'export * from "./openpra-quantum-frontend-subtree-detail-payload";'

def main() -> None:
    content = INDEX_PATH.read_text(encoding="utf-8")

    if GOOD_LINE in content and BAD_LINE not in content:
        print("Index export already fixed.")
        return

    updated = content.replace(BAD_LINE, GOOD_LINE)

    if updated == content and GOOD_LINE not in content:
        updated = content.rstrip() + "\n" + GOOD_LINE + "\n"

    INDEX_PATH.write_text(updated, encoding="utf-8")
    print("Applied frontend subtree detail payload index export fix successfully.")

if __name__ == "__main__":
    main()
