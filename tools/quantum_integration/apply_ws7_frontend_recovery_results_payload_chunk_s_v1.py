#!/usr/bin/env python3
from pathlib import Path
import re
import textwrap

REPO_ROOT = Path.cwd()

PATCH_SCRIPT_REL = "tools/quantum_integration/apply_ws7_frontend_recovery_results_payload_chunk_s_v1.py"
CHECKPOINT_SCRIPT_REL = "tools/quantum_integration/openpra_quantum_build_frontend_recovery_results_payload_checkpoint_v1.sh"

NEW_FILES = {
    "packages/quantum-readiness/src/lib/openpra-quantum-frontend-recovery-results-payload.ts": r'''
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
    selector.subtreeId !== null || selector.caseLabel !== null || selector.rootGateId !== null
      ? normalizedArtifacts.filter((artifact: NormalizedArtifact) => artifact.score > 0)
      : normalizedArtifacts;

  const activeArtifacts = scopedArtifacts.length > 0 ? scopedArtifacts : normalizedArtifacts;

  const recoveryArtifact = pickBestArtifact(activeArtifacts, "recovery");
  const preparationArtifact = pickBestArtifact(activeArtifacts, "preparation");
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

  const requiredQubits = firstArtifactNumber(
    activeArtifacts,
    "requiredQubits",
    "required_qubits",
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

  const primaryMode = firstArtifactString(
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

  const recoveryCoverageFraction =
    exactReferenceCutSetCount !== null &&
    unionRecoveredCount !== null &&
    exactReferenceCutSetCount > 0
      ? unionRecoveredCount / exactReferenceCutSetCount
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
      recoveryArtifact === null
        ? null
        : {
            primaryMode,
            requiresOperatorAttention,
            exactReferenceCutSetCount,
            tier1RecoveredExactCutSetCount,
            unionRecoveredCount,
            unionAllRecovered,
            nearMissAdvisoryCount,
            recoveryCoverageFraction,
          },
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
      scriptVersion:
        normalizeText(request.scriptVersion) ??
        "openpra-quantum-frontend-recovery-results-payload.v1",
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
    "packages/quantum-readiness/src/lib/openpra-quantum-frontend-recovery-results-payload.spec.ts": r'''
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { buildOpenPraQuantumFrontendRecoveryResultsPayload } from "./openpra-quantum-frontend-recovery-results-payload";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("buildOpenPraQuantumFrontendRecoveryResultsPayload", () => {
  it("builds a frontend recovery results payload", () => {
    const rootDirectoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "openpra-frontend-recovery-results-"),
    );

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      topologyClass: "C",
      basicEventCount: 8,
      requiredQubits: 8,
    });

    writeJson(rootDirectoryPath, "provider/provider_execution_request_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      backendName: "ibm_marrakesh",
      status: "completed",
    });

    writeJson(rootDirectoryPath, "recovery/openpra_recovery_ladder_result_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      primaryMode: "union_sensitivity_recovery",
      requiresOperatorAttention: true,
      exactReferenceCutSetCount: 4,
      tier1RecoveredExactCutSetCount: 3,
      unionRecoveredCount: 4,
      unionAllRecovered: true,
      nearMissAdvisoryCount: 1,
    });

    const result = buildOpenPraQuantumFrontendRecoveryResultsPayload({
      rootDirectoryPath,
      subtreeId: "phase2b_row_0905",
      scriptVersion: "quantum-readiness.frontendRecoveryResultsPayload.spec",
    });

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.providerBackendName).toBe("ibm_marrakesh");
    expect(result.summary.primaryMode).toBe("union_sensitivity_recovery");
    expect(result.summary.unionAllRecovered).toBe(true);
    expect(result.summary.recoveryCoverageFraction).toBe(1);
    expect(result.recovery?.nearMissAdvisoryCount).toBe(1);
    expect(result.guardrails.unionSensitivityObserved).toBe(true);
    expect(result.ladder.recommendation).toBe("review_required");
    expect(result.provenance.matchedArtifactPaths.length).toBe(3);
  });

  it("throws when the root directory path is missing", () => {
    expect(() =>
      buildOpenPraQuantumFrontendRecoveryResultsPayload({
        rootDirectoryPath: "",
      }),
    ).toThrow("rootDirectoryPath is required.");
  });
});
''',
    "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendRecoveryResultsPayload.service.spec.ts": r'''
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { QuantumReadinessService } from "./quantumReadiness.service";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("QuantumReadinessService frontend recovery results payload", () => {
  it("returns the recovery results payload through the service method", () => {
    const rootDirectoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "openpra-service-frontend-recovery-results-"),
    );

    writeJson(rootDirectoryPath, "recovery/openpra_recovery_ladder_result_v1.json", {
      caseLabel: "phase2b_row_0698",
      subtreeId: "phase2b_row_0698",
      rootGateId: "G:G348",
      primaryMode: "union_sensitivity_recovery",
      requiresOperatorAttention: false,
      exactReferenceCutSetCount: 2,
      tier1RecoveredExactCutSetCount: 1,
      unionRecoveredCount: 2,
      unionAllRecovered: true,
    });

    const result =
      QuantumReadinessService.prototype.getFrontendRecoveryResultsPayload.call(
        {} as QuantumReadinessService,
        {
          rootDirectoryPath,
          subtreeId: "phase2b_row_0698",
          scriptVersion: "quantumReadiness.frontendRecoveryResultsPayload.service.spec",
        },
      );

    expect(result.target.subtreeId).toBe("phase2b_row_0698");
    expect(result.summary.primaryMode).toBe("union_sensitivity_recovery");
    expect(result.summary.unionAllRecovered).toBe(true);
  });
});
''',
    "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendRecoveryResultsPayload.controller.spec.ts": r'''
import { QuantumReadinessController } from "./quantumReadiness.controller";

describe("QuantumReadinessController frontend recovery results payload", () => {
  it("routes the recovery results payload request through the service", () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        primaryMode: "union_sensitivity_recovery",
      },
    };

    const mockQuantumReadinessService = {
      getFrontendRecoveryResultsPayload: jest.fn().mockReturnValue(mockResponse),
    };

    const result =
      QuantumReadinessController.prototype.getFrontendRecoveryResultsPayloadHttp.call(
        {
          quantumReadinessService: mockQuantumReadinessService,
        } as unknown as QuantumReadinessController,
        "/tmp/openpra-root",
        "phase2b_row_0905",
        "phase2b_row_0905",
        "G:G939",
      );

    expect(mockQuantumReadinessService.getFrontendRecoveryResultsPayload).toHaveBeenCalledWith({
      rootDirectoryPath: "/tmp/openpra-root",
      subtreeId: "phase2b_row_0905",
      caseLabel: "phase2b_row_0905",
      rootGateId: "G:G939",
      scriptVersion: "quantumReadiness.controller.frontendRecoveryResultsPayload.http",
    });
    expect(result).toBe(mockResponse);
  });
});
''',
    "packages/web-backend/tests/quantumReadiness.frontendRecoveryResultsPayload.http.spec.ts": r'''
import { Test } from "@nestjs/testing";

import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendRecoveryResultsPayload.http", () => {
  it("loads the frontend recovery results payload contract through the controller harness", async () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        primaryMode: "union_sensitivity_recovery",
        unionAllRecovered: true,
      },
      ladder: {
        recommendation: "review_required",
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        {
          provide: QuantumReadinessService,
          useValue: {
            getFrontendRecoveryResultsPayload: jest.fn().mockReturnValue(mockResponse),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuantumReadinessController);

    const result = (
      controller as unknown as {
        getFrontendRecoveryResultsPayloadHttp: (
          rootDirectoryPath: string,
          subtreeId?: string,
          caseLabel?: string,
          rootGateId?: string,
        ) => typeof mockResponse;
      }
    ).getFrontendRecoveryResultsPayloadHttp(
      "/tmp/openpra-root",
      "phase2b_row_0905",
      "phase2b_row_0905",
      "G:G939",
    );

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.primaryMode).toBe("union_sensitivity_recovery");
    expect(result.ladder.recommendation).toBe("review_required");
  });
});
''',
}

CHECKPOINT_SCRIPT = r'''#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BASE_DIR="$REPO_ROOT/_work/openpra_quantum_frontend_recovery_results_payload_checkpoint_v1"
OUT_DIR="$BASE_DIR/OPENPRA_QUANTUM_FRONTEND_RECOVERY_RESULTS_PAYLOAD_CHECKPOINT_v1_${STAMP}"

mkdir -p "$OUT_DIR"

copy_into_checkpoint() {
  local rel_path="$1"
  mkdir -p "$OUT_DIR/$(dirname "$rel_path")"
  cp "$REPO_ROOT/$rel_path" "$OUT_DIR/$rel_path"
}

copy_into_checkpoint "packages/quantum-readiness/src/lib/openpra-quantum-frontend-recovery-results-payload.ts"
copy_into_checkpoint "packages/quantum-readiness/src/lib/openpra-quantum-frontend-recovery-results-payload.spec.ts"
copy_into_checkpoint "packages/quantum-readiness/src/lib/index.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendRecoveryResultsPayload.service.spec.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendRecoveryResultsPayload.controller.spec.ts"
copy_into_checkpoint "packages/web-backend/tests/quantumReadiness.frontendRecoveryResultsPayload.http.spec.ts"
copy_into_checkpoint "tools/quantum_integration/apply_ws7_frontend_recovery_results_payload_chunk_s_v1.py"
copy_into_checkpoint "tools/quantum_integration/openpra_quantum_build_frontend_recovery_results_payload_checkpoint_v1.sh"

tar -czf "${OUT_DIR}.tar.gz" -C "$BASE_DIR" "$(basename "$OUT_DIR")"
sha256sum "${OUT_DIR}.tar.gz" > "${OUT_DIR}.tar.gz.sha256"

echo "$OUT_DIR"
echo "${OUT_DIR}.tar.gz"
echo "${OUT_DIR}.tar.gz.sha256"
'''

SERVICE_IMPORT_BLOCK = r'''
import {
  buildOpenPraQuantumFrontendRecoveryResultsPayload,
  OpenPraQuantumFrontendRecoveryResultsPayloadRequest,
  OpenPraQuantumFrontendRecoveryResultsPayloadResult,
} from "../../../quantum-readiness/src/index";
'''

SERVICE_METHOD_BLOCK = r'''
  getFrontendRecoveryResultsPayload(
    request: OpenPraQuantumFrontendRecoveryResultsPayloadRequest,
  ): OpenPraQuantumFrontendRecoveryResultsPayloadResult {
    return buildOpenPraQuantumFrontendRecoveryResultsPayload(request);
  }

'''

CONTROLLER_IMPORT_BLOCK = r'''
import { Get, Query } from "@nestjs/common";
'''

CONTROLLER_METHOD_BLOCK = r'''
  @Get("frontend/recovery-results-payload")
  @Get("frontend/recoveryResultsPayload")
  @Get("frontendRecoveryResultsPayload")
  getFrontendRecoveryResultsPayloadHttp(
    @Query("rootDirectoryPath") rootDirectoryPath: string,
    @Query("subtreeId") subtreeId?: string,
    @Query("caseLabel") caseLabel?: string,
    @Query("rootGateId") rootGateId?: string,
  ) {
    return this.quantumReadinessService.getFrontendRecoveryResultsPayload({
      rootDirectoryPath,
      subtreeId: subtreeId ?? null,
      caseLabel: caseLabel ?? null,
      rootGateId: rootGateId ?? null,
      scriptVersion: "quantumReadiness.controller.frontendRecoveryResultsPayload.http",
    });
  }

'''

INDEX_EXPORT_LINE = 'export * from "./openpra-quantum-frontend-recovery-results-payload";\n'


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

    print("Applied frontend recovery results payload chunk S successfully.")


if __name__ == "__main__":
    main()
