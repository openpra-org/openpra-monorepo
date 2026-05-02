import fs from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

export type ExtractedRecoveryMetrics = {
  primaryMode: string | null;
  tier1RecoveredExactCutSetCount: number | null;
  unionRecoveredCount: number | null;
  unionAllRecovered: boolean | null;
  nearMissAdvisoryCount: number | null;
  recoveryCoverageFraction: number | null;
  ladderNarrative: string | null;
  ladderRecommendation: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function collectValuesForKey(root: unknown, targetKey: string, out: unknown[]): void {
  if (Array.isArray(root)) {
    for (const item of root) {
      collectValuesForKey(item, targetKey, out);
    }
    return;
  }

  if (!isRecord(root)) {
    return;
  }

  for (const [key, value] of Object.entries(root)) {
    if (key === targetKey) {
      out.push(value);
    }
    collectValuesForKey(value, targetKey, out);
  }
}

function firstNumberByKeys(root: unknown, keys: string[]): number | null {
  for (const key of keys) {
    const matches: unknown[] = [];
    collectValuesForKey(root, key, matches);
    for (const match of matches) {
      const n = toNumberOrNull(match);
      if (n !== null) {
        return n;
      }
    }
  }
  return null;
}

function firstBooleanByKeys(root: unknown, keys: string[]): boolean | null {
  for (const key of keys) {
    const matches: unknown[] = [];
    collectValuesForKey(root, key, matches);
    for (const match of matches) {
      const b = toBooleanOrNull(match);
      if (b !== null) {
        return b;
      }
    }
  }
  return null;
}

function firstStringByKeys(root: unknown, keys: string[]): string | null {
  for (const key of keys) {
    const matches: unknown[] = [];
    collectValuesForKey(root, key, matches);
    for (const match of matches) {
      const s = toStringOrNull(match);
      if (s !== null) {
        return s;
      }
    }
  }
  return null;
}

function firstNumberFromPreferredContainers(root: unknown, containerKeys: string[], keys: string[]): number | null {
  if (!isRecord(root)) {
    return null;
  }

  for (const containerKey of containerKeys) {
    const container = root[containerKey];
    const value = firstNumberByKeys(container, keys);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstBooleanFromPreferredContainers(root: unknown, containerKeys: string[], keys: string[]): boolean | null {
  if (!isRecord(root)) {
    return null;
  }

  for (const containerKey of containerKeys) {
    const container = root[containerKey];
    const value = firstBooleanByKeys(container, keys);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstStringFromPreferredContainers(root: unknown, containerKeys: string[], keys: string[]): string | null {
  if (!isRecord(root)) {
    return null;
  }

  for (const containerKey of containerKeys) {
    const container = root[containerKey];
    const value = firstStringByKeys(container, keys);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function loadJsonIfPresent(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function normalizeRecommendation(
  tier1RecoveredExactCutSetCount: number | null,
  unionRecoveredCount: number | null,
  unionAllRecovered: boolean | null,
): string {
  if ((unionRecoveredCount ?? 0) > 0 && unionAllRecovered === true) {
    return "recovery_complete";
  }
  if ((unionRecoveredCount ?? 0) > 0) {
    return "recovery_signal_present";
  }
  if ((tier1RecoveredExactCutSetCount ?? 0) > 0) {
    return "tier1_signal_present";
  }
  return "no_recovery_signal";
}

function normalizeNarrative(
  primaryMode: string | null,
  tier1RecoveredExactCutSetCount: number | null,
  unionRecoveredCount: number | null,
  unionAllRecovered: boolean | null,
): string | null {
  if ((unionRecoveredCount ?? 0) > 0 && unionAllRecovered === true) {
    return `Recovered ${unionRecoveredCount} exact reference cut sets under ${primaryMode ?? "reported recovery mode"}.`;
  }
  if ((unionRecoveredCount ?? 0) > 0) {
    return "Recovery artifact indicates union level recovery signal.";
  }
  if ((tier1RecoveredExactCutSetCount ?? 0) > 0) {
    return "Recovery artifact indicates tier 1 recovery signal.";
  }
  return null;
}

export function extractRecoveryMetricsFromArtifact(recoveryArtifact: unknown): ExtractedRecoveryMetrics {
  const preferredTier1Containers = ["recoveryTier1ExactHardware", "recoveryTier1"];

  const preferredTier3Containers = ["recoveryTier3UnionSensitivity", "recoveryTier3"];

  const tier1RecoveredExactCutSetCount =
    firstNumberFromPreferredContainers(recoveryArtifact, preferredTier1Containers, [
      "tier1RecoveredExactCutSetCount",
      "tier1RecoveredCount",
      "tier1ExactRecoveredCount",
      "tier1ExactRecoveryCount",
      "tier1RecoveryCount",
      "recoveredExactCutSetCount",
    ]) ??
    firstNumberByKeys(recoveryArtifact, [
      "tier1RecoveredExactCutSetCount",
      "tier1RecoveredCount",
      "tier1ExactRecoveredCount",
      "tier1ExactRecoveryCount",
      "tier1RecoveryCount",
    ]);

  const unionRecoveredCount =
    firstNumberFromPreferredContainers(recoveryArtifact, preferredTier3Containers, [
      "unionRecoveredCount",
      "unionExactRecoveredCount",
      "unionRecoveryCount",
    ]) ??
    firstNumberByKeys(recoveryArtifact, ["unionRecoveredCount", "unionExactRecoveredCount", "unionRecoveryCount"]);

  const primaryMode =
    firstStringFromPreferredContainers(
      recoveryArtifact,
      ["integrationRecommendation"],
      ["primaryMode", "executionMode", "mode"],
    ) ?? firstStringByKeys(recoveryArtifact, ["primaryMode", "executionMode", "mode"]);

  const unionAllRecovered =
    firstBooleanFromPreferredContainers(recoveryArtifact, preferredTier3Containers, [
      "unionAllRecovered",
      "allRecoveredAtUnion",
      "unionRecoveredAll",
    ]) ?? firstBooleanByKeys(recoveryArtifact, ["unionAllRecovered", "allRecoveredAtUnion", "unionRecoveredAll"]);

  const nearMissAdvisoryCount = firstNumberByKeys(recoveryArtifact, ["nearMissAdvisoryCount", "nearMissCount"]);

  const recoveryCoverageFraction = firstNumberByKeys(recoveryArtifact, [
    "recoveryCoverageFraction",
    "coverageFraction",
    "exactRecoveryCoverageFraction",
    "exactFraction",
  ]);

  const resolvedUnionAllRecovered =
    unionAllRecovered ??
    ((
      (tier1RecoveredExactCutSetCount ?? 0) > 0 &&
      unionRecoveredCount !== null &&
      tier1RecoveredExactCutSetCount === unionRecoveredCount
    ) ?
      true
    : null);

  const ladderRecommendation = normalizeRecommendation(
    tier1RecoveredExactCutSetCount,
    unionRecoveredCount,
    resolvedUnionAllRecovered,
  );

  const ladderNarrative = normalizeNarrative(
    primaryMode,
    tier1RecoveredExactCutSetCount,
    unionRecoveredCount,
    resolvedUnionAllRecovered,
  );

  return {
    primaryMode,
    tier1RecoveredExactCutSetCount,
    unionRecoveredCount,
    unionAllRecovered: resolvedUnionAllRecovered,
    nearMissAdvisoryCount,
    recoveryCoverageFraction,
    ladderNarrative,
    ladderRecommendation,
  };
}

export function extractRecoveryMetricsFromMatchedArtifactPaths(
  matchedArtifactPaths: string[],
): ExtractedRecoveryMetrics {
  const recoveryArtifactPath =
    matchedArtifactPaths.find((p) => p.endsWith("/artifacts/recovery/openpra_quantum_recovery_artifact_v1.json")) ??
    matchedArtifactPaths.find((p) => path.basename(p) === "openpra_quantum_recovery_artifact_v1.json") ??
    null;

  const recoveryArtifact = recoveryArtifactPath ? loadJsonIfPresent(recoveryArtifactPath) : null;

  return extractRecoveryMetricsFromArtifact(recoveryArtifact);
}
