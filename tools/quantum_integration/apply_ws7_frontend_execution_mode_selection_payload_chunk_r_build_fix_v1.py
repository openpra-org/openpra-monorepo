#!/usr/bin/env python3
from pathlib import Path

REPO_ROOT = Path.cwd()

TARGET_FILES = [
    REPO_ROOT / "packages/quantum-readiness/src/lib/openpra-quantum-frontend-execution-mode-selection-payload.ts",
    REPO_ROOT / "tools/quantum_integration/apply_ws7_frontend_execution_mode_selection_payload_chunk_r_v1.py",
]

OLD = "OpenPraQuantumFrontendExecutionModeOption"
NEW = "OpenPraQuantumFrontendExecutionModeSelectionPayloadOption"

def main() -> None:
    changed = []

    for path in TARGET_FILES:
        if not path.exists():
            raise RuntimeError(f"Missing expected file: {path}")

        content = path.read_text(encoding="utf-8")
        updated = content.replace(OLD, NEW)

        if updated != content:
            path.write_text(updated, encoding="utf-8")
            changed.append(str(path))

    if not changed:
        print("No execution mode selection payload build fixes were needed.")
        return

    print("Applied execution mode selection payload chunk R build fix successfully.")
    for item in changed:
        print(item)

if __name__ == "__main__":
    main()
