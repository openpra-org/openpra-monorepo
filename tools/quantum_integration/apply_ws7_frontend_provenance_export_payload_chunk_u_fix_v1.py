#!/usr/bin/env python3
from pathlib import Path

REPO_ROOT = Path.cwd()

TARGET_FILES = [
    REPO_ROOT / "packages/quantum-readiness/src/lib/openpra-quantum-frontend-provenance-export-payload.ts",
    REPO_ROOT / "tools/quantum_integration/apply_ws7_frontend_provenance_export_payload_chunk_u_v1.py",
]

OLD_BLOCK = '''function isManifestLike(filePath: string): boolean {
  const loweredPath = filePath.toLowerCase();

  return loweredPath.includes("manifest") || loweredPath.includes("provenance");
}
'''

NEW_BLOCK = '''function isManifestLike(filePath: string): boolean {
  const loweredName = path.basename(filePath).toLowerCase();

  return (
    loweredName.endsWith(".json") &&
    (loweredName.includes("manifest") || loweredName.includes("provenance"))
  );
}
'''

def apply_patch(path: Path) -> bool:
    content = path.read_text(encoding="utf-8")
    original = content

    if OLD_BLOCK not in content:
        raise RuntimeError(f"Expected isManifestLike block not found in {path}")

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
        print("No provenance export payload manifest fixes were needed.")
        return

    print("Applied frontend provenance export payload chunk U fix successfully.")
    for item in changed:
        print(item)

if __name__ == "__main__":
    main()
