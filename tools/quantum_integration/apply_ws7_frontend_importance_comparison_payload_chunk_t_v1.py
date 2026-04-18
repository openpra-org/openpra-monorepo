#!/usr/bin/env python3
from pathlib import Path
import re
import textwrap

REPO_ROOT = Path.cwd()

PATCH_SCRIPT_REL = "tools/quantum_integration/apply_ws7_frontend_importance_comparison_payload_chunk_t_v1.py"
CHECKPOINT_SCRIPT_REL = "tools/quantum_integration/openpra_quantum_build_frontend_importance_comparison_payload_checkpoint_v1.sh"

NEW_FILES = {
    "packages/quantum-readiness/src/lib/openpra-quantum-frontend-importance-comparison-payload.ts": r'''
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
    selector.subtreeId !== null || selector.caseLabel !== null || selector.rootGateId !== null
      ? normalizedArtifacts.filter((artifact: NormalizedArtifact) => artifact.score > 0)
      : normalizedArtifacts;

  const activeArtifacts = scopedArtifacts.length > 0 ? scopedArtifacts : normalizedArtifacts;

  const importanceArtifact = pickBestArtifact(activeArtifacts, "importance");
  const recoveryArtifact = pickBestArtifact(activeArtifacts, "recovery");
  const providerArtifact = pickBestArtifact(activeArtifacts, "providerRequest");

  const topologyClass = firstArtifactString(
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

  const providerBackendName = firstArtifactString(
    activeArtifacts,
    "backendName",
    "backend",
  );

  const providerStatus = firstArtifactString(
    activeArtifacts,
    "status",
    "executionStatus",
  );

  const boundednessStatement = firstArtifactString(
    activeArtifacts,
    "boundednessStatement",
    "boundedness_statement",
  );

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
    firstArtifactBoolean(
      activeArtifacts,
      "requiresOperatorAttention",
      "requires_operator_attention",
    ) ?? false;

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
      importanceArtifact === null
        ? null
        : {
            boundednessStatement,
            rawSpearman,
            birnbaumSpearman,
            fvSpearman,
            topEventAbsoluteError,
            disagreementCount,
            maxDeviation,
          },
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
        normalizeText(request.scriptVersion) ??
        "openpra-quantum-frontend-importance-comparison-payload.v1",
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

  const caseLabel = firstString(
    findValue(data, "caseLabel"),
    findValue(data, "case_label"),
  );

  const rootGateId = firstString(
    findValue(data, "rootGateId"),
    findValue(data, "root_gate_id"),
  );

  const phase2bRowId = firstString(
    findValue(data, "phase2bRowId"),
    findValue(data, "phase2b_row_id"),
    subtreeId,
  );

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
    hasAnyKey(data, [
      "primaryMode",
      "primary_mode",
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

function pickBestArtifact(
  artifacts: NormalizedArtifact[],
  artifactKind: ArtifactKind,
): NormalizedArtifact | null {
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

  if (
    (input.rawSpearman ?? -1) >= 0 ||
    (input.birnbaumSpearman ?? -1) >= 0 ||
    (input.fvSpearman ?? -1) >= 0
  ) {
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
  const errorText =
    input.topEventAbsoluteError === null ? "unknown" : `${input.topEventAbsoluteError}`;

  return `Strongest agreement appears in ${strongestText}, weakest agreement appears in ${weakestText}, and top-event absolute error is ${errorText}.`;
}

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

function firstArtifactString(
  artifacts: NormalizedArtifact[],
  ...paths: string[]
): string | null {
  for (const artifact of artifacts) {
    const value = firstString(
      ...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)),
    );
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
    const value = firstNumber(
      ...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)),
    );
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstArtifactBoolean(
  artifacts: NormalizedArtifact[],
  ...paths: string[]
): boolean | null {
  for (const artifact of artifacts) {
    const value = firstBoolean(
      ...paths.map((candidatePath: string) => findValue(artifact.data, candidatePath)),
    );
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
''',
    "packages/quantum-readiness/src/lib/openpra-quantum-frontend-importance-comparison-payload.spec.ts": r'''
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { buildOpenPraQuantumFrontendImportanceComparisonPayload } from "./openpra-quantum-frontend-importance-comparison-payload";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("buildOpenPraQuantumFrontendImportanceComparisonPayload", () => {
  it("builds a frontend importance comparison payload", () => {
    const rootDirectoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "openpra-frontend-importance-comparison-"),
    );

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      topologyClass: "C",
      basicEventCount: 8,
    });

    writeJson(rootDirectoryPath, "provider/provider_execution_request_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      backendName: "ibm_marrakesh",
      status: "completed",
    });

    writeJson(rootDirectoryPath, "importance/importance_comparison_report_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      boundednessStatement:
        "These importance measures are computed from quantum-recovered MCS and validated at screening-level significance.",
      comparisonStatistics: {
        rawSpearman: 0.488,
        birnbaumSpearman: 0.438,
        fvSpearman: 0.236,
        topEventAbsoluteError: 7.5e-7,
        disagreementCount: 2,
        maxDeviation: 0.12,
      },
      requiresOperatorAttention: true,
    });

    const result = buildOpenPraQuantumFrontendImportanceComparisonPayload({
      rootDirectoryPath,
      subtreeId: "phase2b_row_0905",
      scriptVersion: "quantum-readiness.frontendImportanceComparisonPayload.spec",
    });

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.providerBackendName).toBe("ibm_marrakesh");
    expect(result.summary.rawSpearman).toBe(0.488);
    expect(result.summary.birnbaumSpearman).toBe(0.438);
    expect(result.summary.fvSpearman).toBe(0.236);
    expect(result.summary.requiresOperatorAttention).toBe(true);
    expect(result.comparison?.topEventAbsoluteError).toBe(7.5e-7);
    expect(result.interpretation.strongestMeasure).toBe("RAW");
    expect(result.interpretation.weakestMeasure).toBe("FV");
    expect(result.interpretation.recommendation).toBe("review_required");
    expect(result.provenance.matchedArtifactPaths.length).toBe(3);
  });

  it("throws when the root directory path is missing", () => {
    expect(() =>
      buildOpenPraQuantumFrontendImportanceComparisonPayload({
        rootDirectoryPath: "",
      }),
    ).toThrow("rootDirectoryPath is required.");
  });
});
''',
    "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendImportanceComparisonPayload.service.spec.ts": r'''
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { QuantumReadinessService } from "./quantumReadiness.service";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("QuantumReadinessService frontend importance comparison payload", () => {
  it("returns the importance comparison payload through the service method", () => {
    const rootDirectoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "openpra-service-frontend-importance-comparison-"),
    );

    writeJson(rootDirectoryPath, "importance/importance_comparison_report_v1.json", {
      caseLabel: "phase2b_row_0698",
      subtreeId: "phase2b_row_0698",
      rootGateId: "G:G348",
      boundednessStatement: "screening only",
      comparisonStatistics: {
        rawSpearman: 0.5,
      },
    });

    const result =
      QuantumReadinessService.prototype.getFrontendImportanceComparisonPayload.call(
        {} as QuantumReadinessService,
        {
          rootDirectoryPath,
          subtreeId: "phase2b_row_0698",
          scriptVersion: "quantumReadiness.frontendImportanceComparisonPayload.service.spec",
        },
      );

    expect(result.target.subtreeId).toBe("phase2b_row_0698");
    expect(result.summary.rawSpearman).toBe(0.5);
    expect(result.interpretation.strongestMeasure).toBe("RAW");
  });
});
''',
    "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendImportanceComparisonPayload.controller.spec.ts": r'''
import { QuantumReadinessController } from "./quantumReadiness.controller";

describe("QuantumReadinessController frontend importance comparison payload", () => {
  it("routes the importance comparison payload request through the service", () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        rawSpearman: 0.488,
      },
    };

    const mockQuantumReadinessService = {
      getFrontendImportanceComparisonPayload: jest.fn().mockReturnValue(mockResponse),
    };

    const result =
      QuantumReadinessController.prototype.getFrontendImportanceComparisonPayloadHttp.call(
        {
          quantumReadinessService: mockQuantumReadinessService,
        } as unknown as QuantumReadinessController,
        "/tmp/openpra-root",
        "phase2b_row_0905",
        "phase2b_row_0905",
        "G:G939",
      );

    expect(
      mockQuantumReadinessService.getFrontendImportanceComparisonPayload,
    ).toHaveBeenCalledWith({
      rootDirectoryPath: "/tmp/openpra-root",
      subtreeId: "phase2b_row_0905",
      caseLabel: "phase2b_row_0905",
      rootGateId: "G:G939",
      scriptVersion: "quantumReadiness.controller.frontendImportanceComparisonPayload.http",
    });
    expect(result).toBe(mockResponse);
  });
});
''',
    "packages/web-backend/tests/quantumReadiness.frontendImportanceComparisonPayload.http.spec.ts": r'''
import { Test } from "@nestjs/testing";

import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendImportanceComparisonPayload.http", () => {
  it("loads the frontend importance comparison payload contract through the controller harness", async () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        rawSpearman: 0.488,
        birnbaumSpearman: 0.438,
        fvSpearman: 0.236,
      },
      interpretation: {
        recommendation: "review_required",
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        {
          provide: QuantumReadinessService,
          useValue: {
            getFrontendImportanceComparisonPayload: jest.fn().mockReturnValue(mockResponse),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuantumReadinessController);

    const result = (
      controller as unknown as {
        getFrontendImportanceComparisonPayloadHttp: (
          rootDirectoryPath: string,
          subtreeId?: string,
          caseLabel?: string,
          rootGateId?: string,
        ) => typeof mockResponse;
      }
    ).getFrontendImportanceComparisonPayloadHttp(
      "/tmp/openpra-root",
      "phase2b_row_0905",
      "phase2b_row_0905",
      "G:G939",
    );

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.rawSpearman).toBe(0.488);
    expect(result.interpretation.recommendation).toBe("review_required");
  });
});
''',
}

CHECKPOINT_SCRIPT = r'''#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BASE_DIR="$REPO_ROOT/_work/openpra_quantum_frontend_importance_comparison_payload_checkpoint_v1"
OUT_DIR="$BASE_DIR/OPENPRA_QUANTUM_FRONTEND_IMPORTANCE_COMPARISON_PAYLOAD_CHECKPOINT_v1_${STAMP}"

mkdir -p "$OUT_DIR"

copy_into_checkpoint() {
  local rel_path="$1"
  mkdir -p "$OUT_DIR/$(dirname "$rel_path")"
  cp "$REPO_ROOT/$rel_path" "$OUT_DIR/$rel_path"
}

copy_into_checkpoint "packages/quantum-readiness/src/lib/openpra-quantum-frontend-importance-comparison-payload.ts"
copy_into_checkpoint "packages/quantum-readiness/src/lib/openpra-quantum-frontend-importance-comparison-payload.spec.ts"
copy_into_checkpoint "packages/quantum-readiness/src/lib/index.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendImportanceComparisonPayload.service.spec.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendImportanceComparisonPayload.controller.spec.ts"
copy_into_checkpoint "packages/web-backend/tests/quantumReadiness.frontendImportanceComparisonPayload.http.spec.ts"
copy_into_checkpoint "tools/quantum_integration/apply_ws7_frontend_importance_comparison_payload_chunk_t_v1.py"
copy_into_checkpoint "tools/quantum_integration/openpra_quantum_build_frontend_importance_comparison_payload_checkpoint_v1.sh"

tar -czf "${OUT_DIR}.tar.gz" -C "$BASE_DIR" "$(basename "$OUT_DIR")"
sha256sum "${OUT_DIR}.tar.gz" > "${OUT_DIR}.tar.gz.sha256"

echo "$OUT_DIR"
echo "${OUT_DIR}.tar.gz"
echo "${OUT_DIR}.tar.gz.sha256"
'''

SERVICE_IMPORT_BLOCK = r'''
import {
  buildOpenPraQuantumFrontendImportanceComparisonPayload,
  OpenPraQuantumFrontendImportanceComparisonPayloadRequest,
  OpenPraQuantumFrontendImportanceComparisonPayloadResult,
} from "../../../quantum-readiness/src/index";
'''

SERVICE_METHOD_BLOCK = r'''
  getFrontendImportanceComparisonPayload(
    request: OpenPraQuantumFrontendImportanceComparisonPayloadRequest,
  ): OpenPraQuantumFrontendImportanceComparisonPayloadResult {
    return buildOpenPraQuantumFrontendImportanceComparisonPayload(request);
  }

'''

CONTROLLER_IMPORT_BLOCK = r'''
import { Get, Query } from "@nestjs/common";
'''

CONTROLLER_METHOD_BLOCK = r'''
  @Get("frontend/importance-comparison-payload")
  @Get("frontend/importanceComparisonPayload")
  @Get("frontendImportanceComparisonPayload")
  getFrontendImportanceComparisonPayloadHttp(
    @Query("rootDirectoryPath") rootDirectoryPath: string,
    @Query("subtreeId") subtreeId?: string,
    @Query("caseLabel") caseLabel?: string,
    @Query("rootGateId") rootGateId?: string,
  ) {
    return this.quantumReadinessService.getFrontendImportanceComparisonPayload({
      rootDirectoryPath,
      subtreeId: subtreeId ?? null,
      caseLabel: caseLabel ?? null,
      rootGateId: rootGateId ?? null,
      scriptVersion: "quantumReadiness.controller.frontendImportanceComparisonPayload.http",
    });
  }

'''

INDEX_EXPORT_LINE = 'export * from "./openpra-quantum-frontend-importance-comparison-payload";\n'


def normalize_block(content: str) -> str:
    return textwrap.dedent(content).lstrip("\n")


def write_text_file(relative_path: str, content: str) -> None:
    target_path = REPO_ROOT / relative_path
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(normalize_block(content), encoding="utf-8")


def read_text_file(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


def write_existing_file(relative_path: str, content: str) -> None:
    (REPO_ROOT / relative_path).write_text(content, encoding="utf-8")


def ensure_import_block(relative_path: str, import_block: str) -> None:
    content = read_text_file(relative_path)
    block = normalize_block(import_block).rstrip() + "\n"

    if block.strip() in content:
        return

    import_matches = list(re.finditer(r"^import .*?;\n", content, flags=re.MULTILINE))
    if not import_matches:
        raise RuntimeError(f"Could not find import section in {relative_path}")

    insert_index = import_matches[-1].end()
    updated = content[:insert_index] + block + content[insert_index:]
    write_existing_file(relative_path, updated)


def ensure_export_line(relative_path: str, export_line: str) -> None:
    content = read_text_file(relative_path)

    if export_line.strip() in content:
      return

    updated = content.rstrip() + "\n" + export_line
    write_existing_file(relative_path, updated)


def insert_before_last_marker(relative_path: str, block: str, markers: list[str]) -> None:
    content = read_text_file(relative_path)
    normalized_block = normalize_block(block).rstrip() + "\n"

    if normalized_block.strip() in content:
        return

    for marker in markers:
        position = content.rfind(marker)
        if position != -1:
            updated = content[:position] + normalized_block + content[position:]
            write_existing_file(relative_path, updated)
            return

    raise RuntimeError(
        f"Could not find insertion marker in {relative_path}. Tried: {markers}"
    )


def main() -> None:
    for relative_path, content in NEW_FILES.items():
        write_text_file(relative_path, content)

    write_text_file(CHECKPOINT_SCRIPT_REL, CHECKPOINT_SCRIPT)

    ensure_export_line(
        "packages/quantum-readiness/src/lib/index.ts",
        INDEX_EXPORT_LINE,
    )

    ensure_import_block(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts",
        SERVICE_IMPORT_BLOCK,
    )
    insert_before_last_marker(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts",
        SERVICE_METHOD_BLOCK,
        [
            "\n  private ",
            "\n}\n",
            "\n}\r\n",
        ],
    )

    ensure_import_block(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts",
        CONTROLLER_IMPORT_BLOCK,
    )
    insert_before_last_marker(
        "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts",
        CONTROLLER_METHOD_BLOCK,
        [
            "\n  private toHttpException(",
            "\n  private ",
            "\n}\n",
            "\n}\r\n",
        ],
    )

    print("Applied frontend importance comparison payload chunk T successfully.")


if __name__ == "__main__":
    main()
