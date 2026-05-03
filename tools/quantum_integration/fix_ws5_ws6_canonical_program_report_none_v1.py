#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")

TARGETS = [
    "packages/quantum-readiness/src/lib/openpra-quantum-canonical-program-report.spec.ts",
    "tools/quantum_integration/apply_ws5_ws6_canonical_program_report_chunk_k_v1.py",
]

REPLACEMENTS = [
    ("        None,\n        2,\n", "        null,\n        2,\n"),
    ("        None,\n        2,\r\n", "        null,\n        2,\n"),
]


def main() -> None:
    changed = []

    for rel in TARGETS:
        path = REPO_ROOT / rel
        text = path.read_text(encoding="utf-8")
        original = text

        for old, new in REPLACEMENTS:
            text = text.replace(old, new)

        if text == original:
            raise RuntimeError(f"No replacement applied in {rel}.")
        path.write_text(text, encoding="utf-8")
        changed.append(rel)

    print("Patched files:")
    for rel in changed:
        print(rel)


if __name__ == "__main__":
    main()
