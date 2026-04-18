#!/usr/bin/env python3
from pathlib import Path

REPO_ROOT = Path.cwd()

TARGET_FILES = [
    REPO_ROOT / "packages/quantum-readiness/src/lib/openpra-quantum-frontend-recovery-results-payload.ts",
    REPO_ROOT / "tools/quantum_integration/apply_ws7_frontend_recovery_results_payload_chunk_s_v1.py",
]

OLD_BLOCK = '''  const topologyClass = firstString(
    findValue(preparationArtifact?.data, "topologyClass"),
    findValue(preparationArtifact?.data, "topology_class"),
  );

  const basicEventCount = firstNumber(
    findValue(preparationArtifact?.data, "basicEventCount"),
    findValue(preparationArtifact?.data, "basic_event_count"),
    findValue(preparationArtifact?.data, "nBasic"),
    findValue(preparationArtifact?.data, "n_basic"),
  );

  const requiredQubits = firstNumber(
    findValue(preparationArtifact?.data, "requiredQubits"),
    findValue(preparationArtifact?.data, "required_qubits"),
  );
'''

NEW_BLOCK = '''  const topologyClass = firstArtifactString(
    activeArtifacts,
    "topologyClass",
    "topology_class",
  );

  const basicEventCount = firstArtifactNumber(
    activeArtifacts,
    "basicEventCount",
    "basic_event_count",
    "nBasic",
    "n_basic",
  );

  const requiredQubits = firstArtifactNumber(
    activeArtifacts,
    "requiredQubits",
    "required_qubits",
  );
'''

INSERT_AFTER = '''function firstBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
  }

  return null;
}
'''

HELPER_BLOCK = '''
function firstArtifactString(
  artifacts: NormalizedArtifact[],
  ...paths: string[]
): string | null {
  for (const artifact of artifacts) {
    const value = firstString(...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstArtifactNumber(
  artifacts: NormalizedArtifact[],
  ...paths: string[]
): number | null {
  for (const artifact of artifacts) {
    const value = firstNumber(...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)));
    if (value !== null) {
      return value;
    }
  }

  return null;
}
'''

def apply_patch(path: Path) -> bool:
    content = path.read_text(encoding="utf-8")
    original = content

    if OLD_BLOCK in content:
        content = content.replace(OLD_BLOCK, NEW_BLOCK)

    if "function firstArtifactString(" not in content:
        if INSERT_AFTER not in content:
            raise RuntimeError(f"Could not find helper insertion anchor in {path}")
        content = content.replace(INSERT_AFTER, INSERT_AFTER + HELPER_BLOCK)

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
        print("No recovery results payload fixes were needed.")
        return

    print("Applied frontend recovery results payload chunk S fix successfully.")
    for item in changed:
        print(item)

if __name__ == "__main__":
    main()
