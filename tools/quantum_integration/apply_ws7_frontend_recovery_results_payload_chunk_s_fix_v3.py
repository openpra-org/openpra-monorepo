#!/usr/bin/env python3
from pathlib import Path

REPO_ROOT = Path.cwd()

TARGET_FILES = [
    REPO_ROOT / "packages/quantum-readiness/src/lib/openpra-quantum-frontend-recovery-results-payload.ts",
    REPO_ROOT / "tools/quantum_integration/apply_ws7_frontend_recovery_results_payload_chunk_s_v1.py",
]

OLD_BLOCK = '''  const primaryMode = firstString(
    findValue(recoveryArtifact?.data, "primaryMode"),
    findValue(recoveryArtifact?.data, "primary_mode"),
  );

  const requiresOperatorAttention =
    firstBoolean(
      findValue(recoveryArtifact?.data, "requiresOperatorAttention"),
      findValue(recoveryArtifact?.data, "requires_operator_attention"),
    ) ?? false;

  const exactReferenceCutSetCount = firstNumber(
    findValue(recoveryArtifact?.data, "exactReferenceCutSetCount"),
    findValue(recoveryArtifact?.data, "exact_reference_cut_set_count"),
    findValue(recoveryArtifact?.data, "referenceCutSetCount"),
  );

  const tier1RecoveredExactCutSetCount = firstNumber(
    findValue(recoveryArtifact?.data, "tier1RecoveredExactCutSetCount"),
    findValue(recoveryArtifact?.data, "tier1_recovered_exact_cut_set_count"),
  );

  const unionRecoveredCount = firstNumber(
    findValue(recoveryArtifact?.data, "unionRecoveredCount"),
    findValue(recoveryArtifact?.data, "union_recovered_count"),
  );

  const unionAllRecovered = firstBoolean(
    findValue(recoveryArtifact?.data, "unionAllRecovered"),
    findValue(recoveryArtifact?.data, "union_all_recovered"),
  );

  const nearMissAdvisoryCount = firstNumber(
    findValue(recoveryArtifact?.data, "nearMissAdvisoryCount"),
    findValue(recoveryArtifact?.data, "near_miss_advisory_count"),
  );
'''

NEW_BLOCK = '''  const primaryMode = firstArtifactString(
    activeArtifacts,
    "primaryMode",
    "primary_mode",
  );

  const requiresOperatorAttention =
    firstArtifactBoolean(
      activeArtifacts,
      "requiresOperatorAttention",
      "requires_operator_attention",
    ) ?? false;

  const exactReferenceCutSetCount = firstArtifactNumber(
    activeArtifacts,
    "exactReferenceCutSetCount",
    "exact_reference_cut_set_count",
    "referenceCutSetCount",
  );

  const tier1RecoveredExactCutSetCount = firstArtifactNumber(
    activeArtifacts,
    "tier1RecoveredExactCutSetCount",
    "tier1_recovered_exact_cut_set_count",
  );

  const unionRecoveredCount = firstArtifactNumber(
    activeArtifacts,
    "unionRecoveredCount",
    "union_recovered_count",
  );

  const unionAllRecovered = firstArtifactBoolean(
    activeArtifacts,
    "unionAllRecovered",
    "union_all_recovered",
  );

  const nearMissAdvisoryCount = firstArtifactNumber(
    activeArtifacts,
    "nearMissAdvisoryCount",
    "near_miss_advisory_count",
  );
'''

INSERT_AFTER = '''function firstArtifactNumber(
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

HELPER_BLOCK = '''

function firstArtifactBoolean(
  artifacts: NormalizedArtifact[],
  ...paths: string[]
): boolean | null {
  for (const artifact of artifacts) {
    const value = firstBoolean(...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)));
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

    if OLD_BLOCK not in content:
        raise RuntimeError(f"Expected recovery summary block not found in {path}")

    content = content.replace(OLD_BLOCK, NEW_BLOCK)

    if "function firstArtifactBoolean(" not in content:
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
        print("No recovery results payload fix v3 changes were needed.")
        return

    print("Applied frontend recovery results payload chunk S fix v3 successfully.")
    for item in changed:
        print(item)

if __name__ == "__main__":
    main()
