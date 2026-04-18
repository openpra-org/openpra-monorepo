import * as fs from "node:fs";
import * as path from "node:path";

export interface OpenPraQuantumFrontendImportanceComparisonPayloadRequest {
  rootDirectoryPath: string;
  subtreeId?: string | null;
  caseLabel?: string | null;
  rootGateId?: string | null;
  scriptVersion?: string | null;
}

export interface OpenPraQuantumFrontendImportanceComparisonPayloadResult {
  target: {
    subtreeId: string | null;
    caseLabel: string | null;
    rootGateId: string | null;
    phase2bRowId: string | null;
  };
  summary: {
    topologyClass: string | null;
    basicEventCount: number | null;
    providerBackendName: string | null;
    providerStatus: string | null;
    boundednessStatement: string | null;
    rawSpearman: number | null;
    birnbaumSpearman: number | null;
    fvSpearman: number | null;
    topEventAbsoluteError: number | null;
    requiresOperatorAttention: boolean;
  };
  comparison: {
    boundednessStatement: string | null;
    rawSpearman: number | null;
    birnbaumSpearman: number | null;
    fvSpearman: number | null;
    topEventAbsoluteError: number | null;
    disagreementCount: number | null;
    maxDeviation: number | null;
  } | null;
  interpretation: {
    strongestMeasure: string | null;
    weakestMeasure: string | null;
    recommendation: string;
    narrative: string | null;
  };
  guardrails: {
    boundednessStatementPresent: boolean;
    requiresOperatorAttention: boolean;
    recoveryObserved: boolean;
    providerExecutionObserved: boolean;
  };
  provenance: {
    rootDirectoryPath: string;
    scriptVersion: string;
    generatedAtUtc: string;
    matchedArtifactPaths: string[];
  };
}

type ArtifactKind = "importance" | "recovery" | "providerRequest" | "preparation" | "unknown";

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

export function buildOpenPraQuantumFrontendImportanceComparisonPayload(
  request: OpenPraQuantumFrontendImportanceComparisonPayloadRequest,
): OpenPraQuantumFrontendImportanceComparisonPayloadResult {
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

  const importanceArtifact = pickBestArtifact(activeArtifacts, "importance");
  const recoveryArtifact = pickBestArtifact(activeArtifacts, "recovery");
  const providerArtifact = pickBestArtifact(activeArtifacts, "providerRequest");

  const topologyClass = firstArtifactString(activeArtifacts, "topologyClass", "topology_class");

  const basicEventCount = firstArtifactNumber(
    activeArtifacts,
    "basicEventCount",
    "basic_event_count",
    "nBasic",
    "n_basic",
  );

  const providerBackendName = firstArtifactString(activeArtifacts, "backendName", "backend");

  const providerStatus = firstArtifactString(activeArtifacts, "status", "executionStatus");

  const boundednessStatement = firstArtifactString(activeArtifacts, "boundednessStatement", "boundedness_statement");

  const rawSpearman = firstArtifactNumber(
    activeArtifacts,
    "comparisonStatistics.rawSpearman",
    "comparison_statistics.raw_spearman",
    "rawSpearman",
  );

  const birnbaumSpearman = firstArtifactNumber(
    activeArtifacts,
    "comparisonStatistics.birnbaumSpearman",
    "comparison_statistics.birnbaum_spearman",
    "birnbaumSpearman",
  );

  const fvSpearman = firstArtifactNumber(
    activeArtifacts,
    "comparisonStatistics.fvSpearman",
    "comparison_statistics.fv_spearman",
    "fvSpearman",
  );

  const topEventAbsoluteError = firstArtifactNumber(
    activeArtifacts,
    "comparisonStatistics.topEventAbsoluteError",
    "comparison_statistics.top_event_absolute_error",
    "topEventAbsoluteError",
  );

  const disagreementCount = firstArtifactNumber(
    activeArtifacts,
    "comparisonStatistics.disagreementCount",
    "comparison_statistics.disagreement_count",
    "disagreementCount",
  );

  const maxDeviation = firstArtifactNumber(
    activeArtifacts,
    "comparisonStatistics.maxDeviation",
    "comparison_statistics.max_deviation",
    "maxDeviation",
  );

  const requiresOperatorAttention =
    firstArtifactBoolean(activeArtifacts, "requiresOperatorAttention", "requires_operator_attention") ?? false;

  const strongestMeasure = determineStrongestMeasure({
    rawSpearman,
    birnbaumSpearman,
    fvSpearman,
  });

  const weakestMeasure = determineWeakestMeasure({
    rawSpearman,
    birnbaumSpearman,
    fvSpearman,
  });

  const matchedArtifactPaths = buildMatchedArtifactPaths(activeArtifacts, 4);

  return {
    target: {
      subtreeId: firstString(
        selector.subtreeId,
        importanceArtifact?.subtreeId,
        recoveryArtifact?.subtreeId,
        providerArtifact?.subtreeId,
      ),
      caseLabel: firstString(
        selector.caseLabel,
        importanceArtifact?.caseLabel,
        recoveryArtifact?.caseLabel,
        providerArtifact?.caseLabel,
      ),
      rootGateId: firstString(
        selector.rootGateId,
        importanceArtifact?.rootGateId,
        recoveryArtifact?.rootGateId,
        providerArtifact?.rootGateId,
      ),
      phase2bRowId: firstString(
        importanceArtifact?.phase2bRowId,
        recoveryArtifact?.phase2bRowId,
        providerArtifact?.phase2bRowId,
      ),
    },
    summary: {
      topologyClass,
      basicEventCount,
      providerBackendName,
      providerStatus,
      boundednessStatement,
      rawSpearman,
      birnbaumSpearman,
      fvSpearman,
      topEventAbsoluteError,
      requiresOperatorAttention,
    },
    comparison:
      importanceArtifact === null ? null : (
        {
          boundednessStatement,
          rawSpearman,
          birnbaumSpearman,
          fvSpearman,
          topEventAbsoluteError,
          disagreementCount,
          maxDeviation,
        }
      ),
    interpretation: {
      strongestMeasure,
      weakestMeasure,
      recommendation: buildRecommendation({
        boundednessStatement,
        requiresOperatorAttention,
        rawSpearman,
        birnbaumSpearman,
        fvSpearman,
      }),
      narrative: buildNarrative({
        strongestMeasure,
        weakestMeasure,
        boundednessStatement,
        topEventAbsoluteError,
      }),
    },
    guardrails: {
      boundednessStatementPresent: boundednessStatement !== null,
      requiresOperatorAttention,
      recoveryObserved: recoveryArtifact !== null,
      providerExecutionObserved: providerArtifact !== null,
    },
    provenance: {
      rootDirectoryPath,
      scriptVersion:
        normalizeText(request.scriptVersion) ?? "openpra-quantum-frontend-importance-comparison-payload.v1",
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
    normalizedPath.includes("importance") ||
    hasAnyKey(data, [
      "boundednessStatement",
      "boundedness_statement",
      "comparisonStatistics",
      "comparison_statistics",
      "rawSpearman",
      "birnbaumSpearman",
      "fvSpearman",
    ])
  ) {
    return "importance";
  }

  if (
    normalizedPath.includes("recovery") ||
    hasAnyKey(data, ["primaryMode", "primary_mode", "unionRecoveredCount", "unionAllRecovered"])
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

function determineStrongestMeasure(input: {
  rawSpearman: number | null;
  birnbaumSpearman: number | null;
  fvSpearman: number | null;
}): string | null {
  const entries: Array<[string, number | null]> = [
    ["RAW", input.rawSpearman],
    ["Birnbaum", input.birnbaumSpearman],
    ["FV", input.fvSpearman],
  ];

  const validEntries = entries.filter((entry: [string, number | null]) => entry[1] !== null) as Array<[string, number]>;

  if (validEntries.length === 0) {
    return null;
  }

  validEntries.sort((left: [string, number], right: [string, number]) => right[1] - left[1]);
  return validEntries[0][0];
}

function determineWeakestMeasure(input: {
  rawSpearman: number | null;
  birnbaumSpearman: number | null;
  fvSpearman: number | null;
}): string | null {
  const entries: Array<[string, number | null]> = [
    ["RAW", input.rawSpearman],
    ["Birnbaum", input.birnbaumSpearman],
    ["FV", input.fvSpearman],
  ];

  const validEntries = entries.filter((entry: [string, number | null]) => entry[1] !== null) as Array<[string, number]>;

  if (validEntries.length === 0) {
    return null;
  }

  validEntries.sort((left: [string, number], right: [string, number]) => left[1] - right[1]);
  return validEntries[0][0];
}

function buildRecommendation(input: {
  boundednessStatement: string | null;
  requiresOperatorAttention: boolean;
  rawSpearman: number | null;
  birnbaumSpearman: number | null;
  fvSpearman: number | null;
}): string {
  if (input.requiresOperatorAttention) {
    return "review_required";
  }

  if (input.boundednessStatement === null) {
    return "boundedness_missing";
  }

  if ((input.rawSpearman ?? -1) >= 0.5) {
    return "screening_signal_present";
  }

  if ((input.rawSpearman ?? -1) >= 0 || (input.birnbaumSpearman ?? -1) >= 0 || (input.fvSpearman ?? -1) >= 0) {
    return "bounded_screening_only";
  }

  return "no_importance_signal";
}

function buildNarrative(input: {
  strongestMeasure: string | null;
  weakestMeasure: string | null;
  boundednessStatement: string | null;
  topEventAbsoluteError: number | null;
}): string | null {
  if (input.strongestMeasure === null && input.weakestMeasure === null) {
    return input.boundednessStatement;
  }

  const strongestText = input.strongestMeasure ?? "none";
  const weakestText = input.weakestMeasure ?? "none";
  const errorText = input.topEventAbsoluteError === null ? "unknown" : `${input.topEventAbsoluteError}`;

  return `Strongest agreement appears in ${strongestText}, weakest agreement appears in ${weakestText}, and top-event absolute error is ${errorText}.`;
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
