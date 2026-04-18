#!/usr/bin/env python3
from pathlib import Path

REPO_ROOT = Path.cwd()

TARGET_FILES = [
    REPO_ROOT / "packages/quantum-readiness/src/lib/openpra-quantum-frontend-recovery-results-payload.ts",
    REPO_ROOT / "tools/quantum_integration/apply_ws7_frontend_recovery_results_payload_chunk_s_v1.py",
]

OLD_BLOCK = '''  const matchedArtifactPaths = [
    recoveryArtifact?.artifactPath,
    preparationArtifact?.artifactPath,
    providerArtifact?.artifactPath,
  ].filter((value: string | undefined): value is string => Boolean(value));
'''

NEW_BLOCK = '''  const matchedArtifactPaths = buildMatchedArtifactPaths(activeArtifacts, 3);
'''

INSERT_AFTER = '''function buildRecoveryRecommendation(input: {
  requiresOperatorAttention: boolean;
  unionAllRecovered: boolean | null;
  unionRecoveredCount: number | null;
}): string {
  if (input.requiresOperatorAttention) {
    return "review_required";
  }

  if (input.unionAllRecovered === true) {
    return "recovery_complete";
  }

  if ((input.unionRecoveredCount ?? 0) > 0) {
    return "partial_recovery_review";
  }

  return "no_recovery_signal";
}
'''

HELPER_BLOCK = '''

function buildMatchedArtifactPaths(
  artifacts: NormalizedArtifact[],
  limit: number,
): string[] {
  const seen = new Set<string>();
  const collected: string[] = [];

  const ordered = [...artifacts].sort((left: NormalizedArtifact, right: NormalizedArtifact) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.artifactPath.localeCompare(right.artifactPath);
  });

  for (const artifact of ordered) {
    if (seen.has(artifact.artifactPath)) {
      continue;
    }

    seen.add(artifact.artifactPath);
    collected.push(artifact.artifactPath);

    if (collected.length >= limit) {
      break;
    }
  }

  return collected;
}
'''

def apply_patch(path: Path) -> bool:
    content = path.read_text(encoding="utf-8")
    original = content

    if OLD_BLOCK not in content:
        raise RuntimeError(f"Expected matchedArtifactPaths block not found in {path}")

    content = content.replace(OLD_BLOCK, NEW_BLOCK)

    if "function buildMatchedArtifactPaths(" not in content:
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
        print("No recovery results payload fix v4 changes were needed.")
        return

    print("Applied frontend recovery results payload chunk S fix v4 successfully.")
    for item in changed:
        print(item)

if __name__ == "__main__":
    main()
