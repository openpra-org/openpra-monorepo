#!/usr/bin/env python3
from pathlib import Path

REPO_ROOT = Path.cwd()

TARGET_FILES = [
    REPO_ROOT / "packages/quantum-readiness/src/lib/openpra-quantum-frontend-recovery-results-payload.ts",
    REPO_ROOT / "tools/quantum_integration/apply_ws7_frontend_recovery_results_payload_chunk_s_v1.py",
]

OLD_BLOCK = '''  const providerBackendName = firstString(
    findValue(providerArtifact?.data, "backendName"),
    findValue(providerArtifact?.data, "backend"),
  );

  const providerStatus = firstString(
    findValue(providerArtifact?.data, "status"),
    findValue(providerArtifact?.data, "executionStatus"),
  );
'''

NEW_BLOCK = '''  const providerBackendName = firstArtifactString(
    activeArtifacts,
    "backendName",
    "backend",
  );

  const providerStatus = firstArtifactString(
    activeArtifacts,
    "status",
    "executionStatus",
  );
'''

def apply_patch(path: Path) -> bool:
    content = path.read_text(encoding="utf-8")
    original = content

    if OLD_BLOCK not in content:
        raise RuntimeError(f"Expected provider block not found in {path}")

    content = content.replace(OLD_BLOCK, NEW_BLOCK)

    if content != original:
        path.write_text(content, encoding="utf-8")
        return True

    return False

def main() -> None:
    changed = []

    for path in TARGET_FILES:
        if not path.exists():
            raise RuntimeError(f"Missing expected file: {path}")
        if apply_patch(path):
            changed.append(str(path))

    if not changed:
        print("No recovery results payload provider fixes were needed.")
        return

    print("Applied frontend recovery results payload chunk S fix v2 successfully.")
    for item in changed:
        print(item)

if __name__ == "__main__":
    main()
