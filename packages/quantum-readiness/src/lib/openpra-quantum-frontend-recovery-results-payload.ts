import * as fs from "node:fs";
import * as path from "node:path";

export interface OpenPraQuantumFrontendRecoveryResultsPayloadRequest {
  rootDirectoryPath: string;
  subtreeId?: string | null;
  caseLabel?: string | null;
  rootGateId?: string | null;
  scriptVersion?: string | null;
}

export interface OpenPraQuantumFrontendRecoveryResultsPayloadResult {
  target: {
    subtreeId: string | null;
    caseLabel: string | null;
    rootGateId: string | null;
    phase2bRowId: string | null;
  };
  summary: {
    topologyClass: string | null;
    basicEventCount: number | null;
    requiredQubits: number | null;
    providerBackendName: string | null;
    providerStatus: string | null;
    primaryMode: string | null;
    requiresOperatorAttention: boolean;
    exactReferenceCutSetCount: number | null;
    tier1RecoveredExactCutSetCount: number | null;
    unionRecoveredCount: number | null;
    unionAllRecovered: boolean | null;
    recoveryCoverageFraction: number | null;
  };
  recovery: {
    primaryMode: string | null;
    requiresOperatorAttention: boolean;
    exactReferenceCutSetCount: number | null;
    tier1RecoveredExactCutSetCount: number | null;
    unionRecoveredCount: number | null;
    unionAllRecovered: boolean | null;
    nearMissAdvisoryCount: number | null;
    recoveryCoverageFraction: number | null;
  } | null;
  ladder: {
    tier1RecoveredExactCutSetCount: number | null;
    unionRecoveredCount: number | null;
    narrative: string | null;
    recommendation: string;
  };
  guardrails: {
    requiresOperatorAttention: boolean;
    unionSensitivityObserved: boolean;
    providerExecutionObserved: boolean;
    providerBackendName: string | null;
    providerStatus: string | null;
  };
  provenance: {
    rootDirectoryPath: string;
    scriptVersion: string;
    generatedAtUtc: string;
    matchedArtifactPaths: string[];
  };
}

type ArtifactKind = "recovery" | "providerRequest" | "preparation" | "unknown";

interface Selector {
  subtreeId: string | null;
  caseLabel: string | null;
  rootGateId: string | null;
}

interface NormalizedArtifact {
  artifactPath: string;
  artifactKind: ArtifactKind;
  data: Record<string, unknown>;
  subtreeId: string | null;
  caseLabel: string | null;
  rootGateId: string | null;
  phase2bRowId: string | null;
  score: number;
}

export function buildOpenPraQuantumFrontendRecoveryResultsPayload(
  request: OpenPraQuantumFrontendRecoveryResultsPayloadRequest,
): OpenPraQuantumFrontendRecoveryResultsPayloadResult {
  if (!request.rootDirectoryPath || request.rootDirectoryPath.trim() === "") {
    throw new Error("rootDirectoryPath is required.");
  }

  const rootDirectoryPath = path.resolve(request.rootDirectoryPath);

  if (!fs.existsSync(rootDirectoryPath)) {
    throw new Error(`rootDirectoryPath does not exist: ${rootDirectoryPath}`);
  }

  const selector: Selector = {
    subtreeId: normalizeText(request.subtreeId),
    caseLabel: normalizeText(request.caseLabel),
    rootGateId: normalizeText(request.rootGateId),
  };

  const normalizedArtifacts = findJsonFilesRecursive(rootDirectoryPath)
    .map((artifactPath: string) => normalizeArtifact(artifactPath, selector))
    .filter((artifact: NormalizedArtifact | null): artifact is NormalizedArtifact => artifact !== null);

  const scopedArtifacts =
    selector.subtreeId !== null || selector.caseLabel !== null || selector.rootGateId !== null ?
      normalizedArtifacts.filter((artifact: NormalizedArtifact) => artifact.score > 0)
    : normalizedArtifacts;

  const activeArtifacts = scopedArtifacts.length > 0 ? scopedArtifacts : normalizedArtifacts;

  const recoveryArtifact = pickBestArtifact(activeArtifacts, "recovery");
  const preparationArtifact = pickBestArtifact(activeArtifacts, "preparation");
  const providerArtifact = pickBestArtifact(activeArtifacts, "providerRequest");

  const topologyClass = firstArtifactString(activeArtifacts, "topologyClass", "topology_class");

  const basicEventCount = firstArtifactNumber(
    activeArtifacts,
    "basicEventCount",
    "basic_event_count",
    "nBasic",
    "n_basic",
  );

  const requiredQubits = firstArtifactNumber(activeArtifacts, "requiredQubits", "required_qubits");

  const providerBackendName = firstArtifactString(activeArtifacts, "backendName", "backend");

  const providerStatus = firstArtifactString(activeArtifacts, "status", "executionStatus");

  const primaryMode = firstArtifactString(activeArtifacts, "primaryMode", "primary_mode");

  const requiresOperatorAttention =
    firstArtifactBoolean(activeArtifacts, "requiresOperatorAttention", "requires_operator_attention") ?? false;

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

  const unionRecoveredCount = firstArtifactNumber(activeArtifacts, "unionRecoveredCount", "union_recovered_count");

  const unionAllRecovered = firstArtifactBoolean(activeArtifacts, "unionAllRecovered", "union_all_recovered");

  const nearMissAdvisoryCount = firstArtifactNumber(
    activeArtifacts,
    "nearMissAdvisoryCount",
    "near_miss_advisory_count",
  );

  const recoveryCoverageFraction =
    exactReferenceCutSetCount !== null && unionRecoveredCount !== null && exactReferenceCutSetCount > 0 ?
      unionRecoveredCount / exactReferenceCutSetCount
    : null;

  const unionSensitivityObserved = primaryMode === "union_sensitivity_recovery";
  const providerExecutionObserved = providerArtifact !== null;

  const matchedArtifactPaths = buildMatchedArtifactPaths(activeArtifacts, 3);

  return {
    target: {
      subtreeId: firstString(
        selector.subtreeId,
        recoveryArtifact?.subtreeId,
        preparationArtifact?.subtreeId,
        providerArtifact?.subtreeId,
      ),
      caseLabel: firstString(
        selector.caseLabel,
        recoveryArtifact?.caseLabel,
        preparationArtifact?.caseLabel,
        providerArtifact?.caseLabel,
      ),
      rootGateId: firstString(
        selector.rootGateId,
        recoveryArtifact?.rootGateId,
        preparationArtifact?.rootGateId,
        providerArtifact?.rootGateId,
      ),
      phase2bRowId: firstString(
        recoveryArtifact?.phase2bRowId,
        preparationArtifact?.phase2bRowId,
        providerArtifact?.phase2bRowId,
      ),
    },
    summary: {
      topologyClass,
      basicEventCount,
      requiredQubits,
      providerBackendName,
      providerStatus,
      primaryMode,
      requiresOperatorAttention,
      exactReferenceCutSetCount,
      tier1RecoveredExactCutSetCount,
      unionRecoveredCount,
      unionAllRecovered,
      recoveryCoverageFraction,
    },
    recovery:
      recoveryArtifact === null ? null : (
        {
          primaryMode,
          requiresOperatorAttention,
          exactReferenceCutSetCount,
          tier1RecoveredExactCutSetCount,
          unionRecoveredCount,
          unionAllRecovered,
          nearMissAdvisoryCount,
          recoveryCoverageFraction,
        }
      ),
    ladder: {
      tier1RecoveredExactCutSetCount,
      unionRecoveredCount,
      narrative: buildRecoveryNarrative({
        primaryMode,
        unionAllRecovered,
        exactReferenceCutSetCount,
        unionRecoveredCount,
        tier1RecoveredExactCutSetCount,
      }),
      recommendation: buildRecoveryRecommendation({
        requiresOperatorAttention,
        unionAllRecovered,
        unionRecoveredCount,
      }),
    },
    guardrails: {
      requiresOperatorAttention,
      unionSensitivityObserved,
      providerExecutionObserved,
      providerBackendName,
      providerStatus,
    },
    provenance: {
      rootDirectoryPath,
      scriptVersion: normalizeText(request.scriptVersion) ?? "openpra-quantum-frontend-recovery-results-payload.v1",
      generatedAtUtc: new Date().toISOString(),
      matchedArtifactPaths,
    },
  };
}

function normalizeArtifact(artifactPath: string, selector: Selector): NormalizedArtifact | null {
  const data = readJsonObject(artifactPath);

  if (data === null) {
    return null;
  }

  const subtreeId = firstString(
    findValue(data, "subtreeId"),
    findValue(data, "subtree_id"),
    findValue(data, "phase2bRowId"),
    findValue(data, "phase2b_row_id"),
  );

  const caseLabel = firstString(findValue(data, "caseLabel"), findValue(data, "case_label"));

  const rootGateId = firstString(findValue(data, "rootGateId"), findValue(data, "root_gate_id"));

  const phase2bRowId = firstString(findValue(data, "phase2bRowId"), findValue(data, "phase2b_row_id"), subtreeId);

  return {
    artifactPath,
    artifactKind: classifyArtifact(data, artifactPath),
    data,
    subtreeId,
    caseLabel,
    rootGateId,
    phase2bRowId,
    score: computeScore(
      {
        subtreeId,
        caseLabel,
        rootGateId,
        phase2bRowId,
      },
      selector,
    ),
  };
}

function classifyArtifact(data: Record<string, unknown>, artifactPath: string): ArtifactKind {
  const normalizedPath = artifactPath.toLowerCase();

  if (
    normalizedPath.includes("recovery") ||
    hasAnyKey(data, [
      "primaryMode",
      "primary_mode",
      "tier1RecoveredExactCutSetCount",
      "unionRecoveredCount",
      "unionAllRecovered",
    ])
  ) {
    return "recovery";
  }

  if (
    normalizedPath.includes("provider") ||
    normalizedPath.includes("execution_request") ||
    hasAnyKey(data, ["jobId", "backendName", "providerName", "shots", "status"])
  ) {
    return "providerRequest";
  }

  if (
    normalizedPath.includes("preparation") ||
    normalizedPath.includes("canonical_case_pack") ||
    normalizedPath.includes("materialization") ||
    hasAnyKey(data, ["topologyClass", "requiredQubits", "statevectorVerification"])
  ) {
    return "preparation";
  }

  return "unknown";
}

function pickBestArtifact(artifacts: NormalizedArtifact[], artifactKind: ArtifactKind): NormalizedArtifact | null {
  const matching = artifacts
    .filter((artifact: NormalizedArtifact) => artifact.artifactKind === artifactKind)
    .sort((left: NormalizedArtifact, right: NormalizedArtifact) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.artifactPath.localeCompare(right.artifactPath);
    });

  return matching[0] ?? null;
}

function computeScore(
  candidate: {
    subtreeId: string | null;
    caseLabel: string | null;
    rootGateId: string | null;
    phase2bRowId: string | null;
  },
  selector: Selector,
): number {
  let score = 0;

  if (selector.subtreeId !== null) {
    if (selector.subtreeId === normalizeText(candidate.subtreeId)) {
      score += 50;
    }
    if (selector.subtreeId === normalizeText(candidate.phase2bRowId)) {
      score += 40;
    }
  }

  if (selector.caseLabel !== null && selector.caseLabel === normalizeText(candidate.caseLabel)) {
    score += 35;
  }

  if (selector.rootGateId !== null && selector.rootGateId === normalizeText(candidate.rootGateId)) {
    score += 25;
  }

  if (selector.subtreeId === null && selector.caseLabel === null && selector.rootGateId === null) {
    return 1;
  }

  return score;
}

function buildRecoveryNarrative(input: {
  primaryMode: string | null;
  unionAllRecovered: boolean | null;
  exactReferenceCutSetCount: number | null;
  unionRecoveredCount: number | null;
  tier1RecoveredExactCutSetCount: number | null;
}): string | null {
  if (input.unionAllRecovered === true) {
    return "All exact reference cut sets were recovered under the current recovery ladder.";
  }

  if (
    input.exactReferenceCutSetCount !== null &&
    input.unionRecoveredCount !== null &&
    input.exactReferenceCutSetCount > 0
  ) {
    return `Recovered ${input.unionRecoveredCount} of ${input.exactReferenceCutSetCount} exact reference cut sets under ${input.primaryMode ?? "the current ladder"}.`;
  }

  if (input.tier1RecoveredExactCutSetCount !== null) {
    return `Tier 1 recovered ${input.tier1RecoveredExactCutSetCount} exact cut sets under ${input.primaryMode ?? "the current ladder"}.`;
  }

  return null;
}

function buildRecoveryRecommendation(input: {
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

function buildMatchedArtifactPaths(artifacts: NormalizedArtifact[], limit: number): string[] {
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

function findJsonFilesRecursive(rootDirectoryPath: string): string[] {
  const results: string[] = [];
  const stack: string[] = [rootDirectoryPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();

    if (!currentPath) {
      continue;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        results.push(entryPath);
      }
    }
  }

  return results.sort((left: string, right: string) => left.localeCompare(right));
}

function readJsonObject(artifactPath: string): Record<string, unknown> | null {
  try {
    const rawText = fs.readFileSync(artifactPath, "utf8");
    const parsed = JSON.parse(rawText) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasAnyKey(data: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key: string) => findValue(data, key) !== undefined);
}

function findValue(input: unknown, dottedPath: string): unknown {
  if (!dottedPath || input === null || input === undefined) {
    return undefined;
  }

  const parts = dottedPath.split(".");
  let current: unknown = input;

  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }

    if (!(part in current)) {
      return undefined;
    }

    current = current[part];
  }

  return current;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function firstBoolean(...values: unknown[]): boolean | null {
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

function firstArtifactString(artifacts: NormalizedArtifact[], ...paths: string[]): string | null {
  for (const artifact of artifacts) {
    const value = firstString(...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstArtifactNumber(artifacts: NormalizedArtifact[], ...paths: string[]): number | null {
  for (const artifact of artifacts) {
    const value = firstNumber(...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstArtifactBoolean(artifacts: NormalizedArtifact[], ...paths: string[]): boolean | null {
  for (const artifact of artifacts) {
    const value = firstBoolean(...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
