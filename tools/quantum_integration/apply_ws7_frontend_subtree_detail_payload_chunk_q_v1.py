#!/usr/bin/env python3
from pathlib import Path
import re
import textwrap

REPO_ROOT = Path.cwd()

PATCH_SCRIPT_REL = "tools/quantum_integration/apply_ws7_frontend_subtree_detail_payload_chunk_q_v1.py"
CHECKPOINT_SCRIPT_REL = "tools/quantum_integration/openpra_quantum_build_frontend_subtree_detail_payload_checkpoint_v1.sh"

NEW_FILES = {
    "packages/quantum-readiness/src/lib/openpra-quantum-frontend-subtree-detail-payload.ts": r'''
import * as fs from "node:fs";
import * as path from "node:path";

export interface OpenPraQuantumFrontendSubtreeDetailPayloadRequest {
  rootDirectoryPath: string;
  subtreeId?: string | null;
  caseLabel?: string | null;
  rootGateId?: string | null;
  scriptVersion?: string | null;
}

export interface OpenPraQuantumFrontendSubtreeDetailPayloadResult {
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
    thresholdBehavior: string | null;
    providerBackendName: string | null;
    providerShots: number | null;
    providerResilienceLevel: number | null;
    recoveryPrimaryMode: string | null;
    requiresOperatorAttention: boolean;
    importanceBoundednessStatement: string | null;
    hasPreparation: boolean;
    hasProviderRequest: boolean;
    hasRecovery: boolean;
    hasImportanceComparison: boolean;
  };
  preparation: {
    topologyClass: string | null;
    basicEventCount: number | null;
    requiredQubits: number | null;
    qaoaRecipe: {
      beta: number | null;
      gamma: number | null;
      depthP: number | null;
      mixerSpec: string | null;
    };
    clquboSummary: {
      objectiveKind: string | null;
      variableCount: number | null;
      auxiliaryVariableCount: number | null;
      feasibleSubspaceSize: number | null;
    };
    backendEligibility: {
      eligibleBackendNames: string[];
      ineligibleBackendNames: string[];
    };
    statevectorVerification: {
      pass: boolean | null;
      infeasibleMassUpperBound: number | null;
      notes: string | null;
    };
  } | null;
  providerRequest: {
    backendName: string | null;
    providerName: string | null;
    jobId: string | null;
    shots: number | null;
    resilienceLevel: number | null;
    status: string | null;
  } | null;
  recovery: {
    primaryMode: string | null;
    requiresOperatorAttention: boolean;
    tier1RecoveredExactCutSetCount: number | null;
    unionRecoveredCount: number | null;
    unionAllRecovered: boolean | null;
    exactReferenceCutSetCount: number | null;
    nearMissAdvisoryCount: number | null;
  } | null;
  importanceComparison: {
    boundednessStatement: string | null;
    rawSpearman: number | null;
    birnbaumSpearman: number | null;
    fvSpearman: number | null;
    topEventAbsoluteError: number | null;
  } | null;
  topologyAssessment: {
    topologyClass: string | null;
    thresholdBehavior: string | null;
    narrative: string | null;
  };
  provenance: {
    rootDirectoryPath: string;
    scriptVersion: string;
    generatedAtUtc: string;
    matchedArtifactPaths: string[];
  };
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

interface NormalizedArtifact {
  artifactPath: string;
  artifactKind: "preparation" | "providerRequest" | "recovery" | "importance" | "unknown";
  data: Record<string, unknown>;
  subtreeId: string | null;
  caseLabel: string | null;
  rootGateId: string | null;
  phase2bRowId: string | null;
  score: number;
}

export function buildOpenPraQuantumFrontendSubtreeDetailPayload(
  request: OpenPraQuantumFrontendSubtreeDetailPayloadRequest,
): OpenPraQuantumFrontendSubtreeDetailPayloadResult {
  if (!request.rootDirectoryPath || request.rootDirectoryPath.trim() === "") {
    throw new Error("rootDirectoryPath is required.");
  }

  const rootDirectoryPath = path.resolve(request.rootDirectoryPath);

  if (!fs.existsSync(rootDirectoryPath)) {
    throw new Error(`rootDirectoryPath does not exist: ${rootDirectoryPath}`);
  }

  const selector = {
    subtreeId: normalizeText(request.subtreeId),
    caseLabel: normalizeText(request.caseLabel),
    rootGateId: normalizeText(request.rootGateId),
  };

  const artifactPaths = findJsonFilesRecursive(rootDirectoryPath);
  const normalizedArtifacts = artifactPaths
    .map((artifactPath) => normalizeArtifact(artifactPath, selector))
    .filter((artifact): artifact is NormalizedArtifact => artifact !== null);

  const scopedArtifacts =
    selector.subtreeId || selector.caseLabel || selector.rootGateId
      ? normalizedArtifacts.filter((artifact) => artifact.score > 0)
      : normalizedArtifacts;

  const activeArtifacts = scopedArtifacts.length > 0 ? scopedArtifacts : normalizedArtifacts;

  const preparationArtifact = pickBestArtifact(activeArtifacts, "preparation");
  const providerArtifact = pickBestArtifact(activeArtifacts, "providerRequest");
  const recoveryArtifact = pickBestArtifact(activeArtifacts, "recovery");
  const importanceArtifact = pickBestArtifact(activeArtifacts, "importance");

  const seedArtifact =
    preparationArtifact ??
    providerArtifact ??
    recoveryArtifact ??
    importanceArtifact ??
    null;

  const topologyClass = firstString(
    findValue(preparationArtifact?.data, "topologyClass"),
    findValue(preparationArtifact?.data, "topology_class"),
    findValue(seedArtifact?.data, "topologyClass"),
    findValue(seedArtifact?.data, "topology_class"),
  );

  const basicEventCount = firstNumber(
    findValue(preparationArtifact?.data, "basicEventCount"),
    findValue(preparationArtifact?.data, "basic_event_count"),
    findValue(preparationArtifact?.data, "nBasic"),
    findValue(preparationArtifact?.data, "n_basic"),
    findValue(seedArtifact?.data, "basicEventCount"),
    findValue(seedArtifact?.data, "basic_event_count"),
    findValue(seedArtifact?.data, "nBasic"),
    findValue(seedArtifact?.data, "n_basic"),
  );

  const requiredQubits = firstNumber(
    findValue(preparationArtifact?.data, "requiredQubits"),
    findValue(preparationArtifact?.data, "required_qubits"),
    findValue(providerArtifact?.data, "requiredQubits"),
    findValue(seedArtifact?.data, "requiredQubits"),
  );

  const thresholdBehavior = topologyClassToThresholdBehavior(topologyClass);

  const matchedArtifactPaths = [
    preparationArtifact?.artifactPath,
    providerArtifact?.artifactPath,
    recoveryArtifact?.artifactPath,
    importanceArtifact?.artifactPath,
  ].filter((value): value is string => Boolean(value));

  return {
    target: {
      subtreeId:
        firstString(
          selector.subtreeId,
          preparationArtifact?.subtreeId,
          providerArtifact?.subtreeId,
          recoveryArtifact?.subtreeId,
          importanceArtifact?.subtreeId,
        ) ?? null,
      caseLabel:
        firstString(
          selector.caseLabel,
          preparationArtifact?.caseLabel,
          providerArtifact?.caseLabel,
          recoveryArtifact?.caseLabel,
          importanceArtifact?.caseLabel,
        ) ?? null,
      rootGateId:
        firstString(
          selector.rootGateId,
          preparationArtifact?.rootGateId,
          providerArtifact?.rootGateId,
          recoveryArtifact?.rootGateId,
          importanceArtifact?.rootGateId,
        ) ?? null,
      phase2bRowId:
        firstString(
          preparationArtifact?.phase2bRowId,
          providerArtifact?.phase2bRowId,
          recoveryArtifact?.phase2bRowId,
          importanceArtifact?.phase2bRowId,
        ) ?? null,
    },
    summary: {
      topologyClass,
      basicEventCount,
      requiredQubits,
      thresholdBehavior,
      providerBackendName: firstString(
        findValue(providerArtifact?.data, "backendName"),
        findValue(providerArtifact?.data, "backend"),
      ),
      providerShots: firstNumber(
        findValue(providerArtifact?.data, "shots"),
        findValue(providerArtifact?.data, "shotCount"),
      ),
      providerResilienceLevel: firstNumber(
        findValue(providerArtifact?.data, "resilienceLevel"),
        findValue(providerArtifact?.data, "resilience_level"),
      ),
      recoveryPrimaryMode: firstString(
        findValue(recoveryArtifact?.data, "primaryMode"),
        findValue(recoveryArtifact?.data, "primary_mode"),
      ),
      requiresOperatorAttention: firstBoolean(
        findValue(recoveryArtifact?.data, "requiresOperatorAttention"),
        findValue(recoveryArtifact?.data, "requires_operator_attention"),
      ) ?? false,
      importanceBoundednessStatement: firstString(
        findValue(importanceArtifact?.data, "boundednessStatement"),
        findValue(importanceArtifact?.data, "boundedness_statement"),
      ),
      hasPreparation: preparationArtifact !== null,
      hasProviderRequest: providerArtifact !== null,
      hasRecovery: recoveryArtifact !== null,
      hasImportanceComparison: importanceArtifact !== null,
    },
    preparation:
      preparationArtifact === null
        ? null
        : {
            topologyClass,
            basicEventCount,
            requiredQubits,
            qaoaRecipe: {
              beta: firstNumber(
                findValue(preparationArtifact.data, "beta"),
                findValue(preparationArtifact.data, "qaoaRecipe.beta"),
                findValue(preparationArtifact.data, "qaoa_recipe.beta"),
              ),
              gamma: firstNumber(
                findValue(preparationArtifact.data, "gamma"),
                findValue(preparationArtifact.data, "qaoaRecipe.gamma"),
                findValue(preparationArtifact.data, "qaoa_recipe.gamma"),
              ),
              depthP: firstNumber(
                findValue(preparationArtifact.data, "depthP"),
                findValue(preparationArtifact.data, "depth_p"),
                findValue(preparationArtifact.data, "qaoaRecipe.p"),
                findValue(preparationArtifact.data, "qaoa_recipe.p"),
              ),
              mixerSpec: firstString(
                findValue(preparationArtifact.data, "mixerSpec"),
                findValue(preparationArtifact.data, "mixer_spec"),
                findValue(preparationArtifact.data, "qaoaRecipe.mixerSpec"),
                findValue(preparationArtifact.data, "qaoa_recipe.mixer_spec"),
              ),
            },
            clquboSummary: {
              objectiveKind: firstString(
                findValue(preparationArtifact.data, "objectiveKind"),
                findValue(preparationArtifact.data, "objective_kind"),
                findValue(preparationArtifact.data, "clqubo.objectiveKind"),
              ),
              variableCount: firstNumber(
                findValue(preparationArtifact.data, "variableCount"),
                findValue(preparationArtifact.data, "variable_count"),
                findValue(preparationArtifact.data, "clqubo.variableCount"),
              ),
              auxiliaryVariableCount: firstNumber(
                findValue(preparationArtifact.data, "auxiliaryVariableCount"),
                findValue(preparationArtifact.data, "auxiliary_variable_count"),
                findValue(preparationArtifact.data, "clqubo.auxiliaryVariableCount"),
              ),
              feasibleSubspaceSize: firstNumber(
                findValue(preparationArtifact.data, "feasibleSubspaceSize"),
                findValue(preparationArtifact.data, "feasible_subspace_size"),
                findValue(preparationArtifact.data, "clqubo.feasibleSubspaceSize"),
              ),
            },
            backendEligibility: {
              eligibleBackendNames: toStringArray(
                findValue(preparationArtifact.data, "eligibleBackendNames"),
                findValue(preparationArtifact.data, "backendEligibility.eligibleBackendNames"),
                findValue(preparationArtifact.data, "backend_eligibility.eligible_backend_names"),
              ),
              ineligibleBackendNames: toStringArray(
                findValue(preparationArtifact.data, "ineligibleBackendNames"),
                findValue(preparationArtifact.data, "backendEligibility.ineligibleBackendNames"),
                findValue(preparationArtifact.data, "backend_eligibility.ineligible_backend_names"),
              ),
            },
            statevectorVerification: {
              pass:
                firstBoolean(
                  findValue(preparationArtifact.data, "statevectorVerification.pass"),
                  findValue(preparationArtifact.data, "statevector_verification.pass"),
                ) ?? null,
              infeasibleMassUpperBound: firstNumber(
                findValue(preparationArtifact.data, "statevectorVerification.infeasibleMassUpperBound"),
                findValue(preparationArtifact.data, "statevector_verification.infeasible_mass_upper_bound"),
              ),
              notes: firstString(
                findValue(preparationArtifact.data, "statevectorVerification.notes"),
                findValue(preparationArtifact.data, "statevector_verification.notes"),
              ),
            },
          },
    providerRequest:
      providerArtifact === null
        ? null
        : {
            backendName: firstString(
              findValue(providerArtifact.data, "backendName"),
              findValue(providerArtifact.data, "backend"),
            ),
            providerName: firstString(
              findValue(providerArtifact.data, "providerName"),
              findValue(providerArtifact.data, "provider"),
            ),
            jobId: firstString(
              findValue(providerArtifact.data, "jobId"),
              findValue(providerArtifact.data, "job_id"),
            ),
            shots: firstNumber(
              findValue(providerArtifact.data, "shots"),
              findValue(providerArtifact.data, "shotCount"),
            ),
            resilienceLevel: firstNumber(
              findValue(providerArtifact.data, "resilienceLevel"),
              findValue(providerArtifact.data, "resilience_level"),
            ),
            status: firstString(
              findValue(providerArtifact.data, "status"),
              findValue(providerArtifact.data, "executionStatus"),
            ),
          },
    recovery:
      recoveryArtifact === null
        ? null
        : {
            primaryMode: firstString(
              findValue(recoveryArtifact.data, "primaryMode"),
              findValue(recoveryArtifact.data, "primary_mode"),
            ),
            requiresOperatorAttention:
              firstBoolean(
                findValue(recoveryArtifact.data, "requiresOperatorAttention"),
                findValue(recoveryArtifact.data, "requires_operator_attention"),
              ) ?? false,
            tier1RecoveredExactCutSetCount: firstNumber(
              findValue(recoveryArtifact.data, "tier1RecoveredExactCutSetCount"),
              findValue(recoveryArtifact.data, "tier1_recovered_exact_cut_set_count"),
            ),
            unionRecoveredCount: firstNumber(
              findValue(recoveryArtifact.data, "unionRecoveredCount"),
              findValue(recoveryArtifact.data, "union_recovered_count"),
            ),
            unionAllRecovered:
              firstBoolean(
                findValue(recoveryArtifact.data, "unionAllRecovered"),
                findValue(recoveryArtifact.data, "union_all_recovered"),
              ) ?? null,
            exactReferenceCutSetCount: firstNumber(
              findValue(recoveryArtifact.data, "exactReferenceCutSetCount"),
              findValue(recoveryArtifact.data, "exact_reference_cut_set_count"),
              findValue(recoveryArtifact.data, "referenceCutSetCount"),
            ),
            nearMissAdvisoryCount: firstNumber(
              findValue(recoveryArtifact.data, "nearMissAdvisoryCount"),
              findValue(recoveryArtifact.data, "near_miss_advisory_count"),
            ),
          },
    importanceComparison:
      importanceArtifact === null
        ? null
        : {
            boundednessStatement: firstString(
              findValue(importanceArtifact.data, "boundednessStatement"),
              findValue(importanceArtifact.data, "boundedness_statement"),
            ),
            rawSpearman: firstNumber(
              findValue(importanceArtifact.data, "comparisonStatistics.rawSpearman"),
              findValue(importanceArtifact.data, "comparison_statistics.raw_spearman"),
              findValue(importanceArtifact.data, "rawSpearman"),
            ),
            birnbaumSpearman: firstNumber(
              findValue(importanceArtifact.data, "comparisonStatistics.birnbaumSpearman"),
              findValue(importanceArtifact.data, "comparison_statistics.birnbaum_spearman"),
              findValue(importanceArtifact.data, "birnbaumSpearman"),
            ),
            fvSpearman: firstNumber(
              findValue(importanceArtifact.data, "comparisonStatistics.fvSpearman"),
              findValue(importanceArtifact.data, "comparison_statistics.fv_spearman"),
              findValue(importanceArtifact.data, "fvSpearman"),
            ),
            topEventAbsoluteError: firstNumber(
              findValue(importanceArtifact.data, "comparisonStatistics.topEventAbsoluteError"),
              findValue(importanceArtifact.data, "comparison_statistics.top_event_absolute_error"),
              findValue(importanceArtifact.data, "topEventAbsoluteError"),
            ),
          },
    topologyAssessment: {
      topologyClass,
      thresholdBehavior,
      narrative: topologyClassToNarrative(topologyClass),
    },
    provenance: {
      rootDirectoryPath,
      scriptVersion:
        normalizeText(request.scriptVersion) ??
        "openpra-quantum-frontend-subtree-detail-payload.v1",
      generatedAtUtc: new Date().toISOString(),
      matchedArtifactPaths,
    },
  };
}

function normalizeArtifact(
  artifactPath: string,
  selector: {
    subtreeId: string | null;
    caseLabel: string | null;
    rootGateId: string | null;
  },
): NormalizedArtifact | null {
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

  const score = computeScore(
    {
      subtreeId,
      caseLabel,
      rootGateId,
      phase2bRowId,
    },
    selector,
  );

  return {
    artifactPath,
    artifactKind: classifyArtifact(data, artifactPath),
    data,
    subtreeId,
    caseLabel,
    rootGateId,
    phase2bRowId,
    score,
  };
}

function classifyArtifact(
  data: Record<string, unknown>,
  artifactPath: string,
): NormalizedArtifact["artifactKind"] {
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
    normalizedPath.includes("provider_execution_request") ||
    hasAnyKey(data, ["jobId", "job_id", "backendName", "resilienceLevel", "shots"])
  ) {
    return "providerRequest";
  }

  if (
    normalizedPath.includes("importance") ||
    hasAnyKey(data, ["boundednessStatement", "comparisonStatistics", "rawSpearman"])
  ) {
    return "importance";
  }

  if (
    normalizedPath.includes("preparation") ||
    normalizedPath.includes("canonical_case_pack") ||
    normalizedPath.includes("materialization") ||
    hasAnyKey(data, [
      "topologyClass",
      "requiredQubits",
      "qaoaRecipe",
      "statevectorVerification",
      "eligibleBackendNames",
    ])
  ) {
    return "preparation";
  }

  return "unknown";
}

function pickBestArtifact(
  artifacts: NormalizedArtifact[],
  artifactKind: NormalizedArtifact["artifactKind"],
): NormalizedArtifact | null {
  const matchingArtifacts = artifacts
    .filter((artifact) => artifact.artifactKind === artifactKind)
    .sort((left, right) => right.score - left.score || left.artifactPath.localeCompare(right.artifactPath));

  return matchingArtifacts[0] ?? null;
}

function computeScore(
  candidate: {
    subtreeId: string | null;
    caseLabel: string | null;
    rootGateId: string | null;
    phase2bRowId: string | null;
  },
  selector: {
    subtreeId: string | null;
    caseLabel: string | null;
    rootGateId: string | null;
  },
): number {
  let score = 0;

  if (selector.subtreeId) {
    if (selector.subtreeId === normalizeText(candidate.subtreeId)) {
      score += 50;
    }
    if (selector.subtreeId === normalizeText(candidate.phase2bRowId)) {
      score += 40;
    }
  }

  if (selector.caseLabel && selector.caseLabel === normalizeText(candidate.caseLabel)) {
    score += 35;
  }

  if (selector.rootGateId && selector.rootGateId === normalizeText(candidate.rootGateId)) {
    score += 25;
  }

  if (!selector.subtreeId and not selector.caseLabel and not selector.rootGateId):
    return 1

  return score

function findJsonFilesRecursive(rootDirectoryPath: string): string[] {
  const results: string[] = [];
  const stack = [rootDirectoryPath];

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

  return results.sort();
}

function readJsonObject(artifactPath: string): Record<string, unknown> | null {
  try {
    const rawText = fs.readFileSync(artifactPath, "utf8");
    const parsed = JSON.parse(rawText) as unknown;

    if (!isRecord(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function hasAnyKey(data: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => findValue(data, key) !== undefined);
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

function toStringArray(...values: unknown[]): string[] {
  for (const value of values) {
    if (!Array.isArray(value)) {
      continue;
    }

    const normalized = value
      .map((item) => normalizeText(item))
      .filter((item): item is string => item !== null);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function topologyClassToThresholdBehavior(topologyClass: string | null): string | null {
  if (topologyClass === null) {
    return null;
  }

  if (topologyClass === "A" || topologyClass === "C") {
    return "threshold_favorable";
  }

  if (topologyClass === "B" || topologyClass === "D") {
    return "threshold_unfavorable";
  }

  return "unknown";
}

function topologyClassToNarrative(topologyClass: string | null): string | null {
  if (topologyClass === "A") {
    return "Class A is threshold-favorable in the current roadmap and is a strong candidate for near-term frontend execution planning.";
  }

  if (topologyClass === "B") {
    return "Class B is threshold-unfavorable in the current roadmap and should be presented with explicit caution before execution selection.";
  }

  if (topologyClass === "C") {
    return "Class C is threshold-favorable in the current roadmap and supports a forward path from preparation through recovery and importance comparison.";
  }

  if (topologyClass === "D") {
    return "Class D is threshold-unfavorable in the current roadmap and should be treated as a cautious or deferred execution path unless stronger evidence is available.";
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
''',
    "packages/quantum-readiness/src/lib/openpra-quantum-frontend-subtree-detail-payload.spec.ts": r'''
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { buildOpenPraQuantumFrontendSubtreeDetailPayload } from "./openpra-quantum-frontend-subtree-detail-payload";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("buildOpenPraQuantumFrontendSubtreeDetailPayload", () => {
  it("builds a subtree detail payload with preparation, provider, recovery, and importance sections", () => {
    const rootDirectoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "openpra-frontend-subtree-detail-"),
    );

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      topologyClass: "C",
      basicEventCount: 8,
      requiredQubits: 8,
      qaoaRecipe: {
        beta: -0.785398163,
        gamma: 1.570796327,
        p: 1,
        mixerSpec: "qaoa_plus",
      },
      clqubo: {
        objectiveKind: "constraint_level",
        variableCount: 8,
        auxiliaryVariableCount: 0,
        feasibleSubspaceSize: 1025,
      },
      backendEligibility: {
        eligibleBackendNames: ["ibm_marrakesh", "ibm_torino"],
        ineligibleBackendNames: ["simulator_emulator_placeholder"],
      },
      statevectorVerification: {
        pass: True,
        infeasibleMassUpperBound: 0,
        notes: "zero infeasible leakage",
      },
    });

    writeJson(rootDirectoryPath, "provider/provider_execution_request_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      providerName: "ibm",
      backendName: "ibm_marrakesh",
      jobId: "job-0905",
      shots: 8192,
      resilienceLevel: 0,
      status: "completed",
    });

    writeJson(rootDirectoryPath, "recovery/openpra_recovery_ladder_result_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      primaryMode: "union_sensitivity_recovery",
      requiresOperatorAttention: True,
      tier1RecoveredExactCutSetCount: 3,
      unionRecoveredCount: 4,
      unionAllRecovered: True,
      exactReferenceCutSetCount: 4,
      nearMissAdvisoryCount: 1,
    });

    writeJson(rootDirectoryPath, "importance/importance_comparison_report_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      boundednessStatement:
        "These importance measures are screening-level only and not regulatory-grade.",
      comparisonStatistics: {
        rawSpearman: 0.488,
        birnbaumSpearman: 0.438,
        fvSpearman: 0.236,
        topEventAbsoluteError: 7.5e-7,
      },
    });

    const result = buildOpenPraQuantumFrontendSubtreeDetailPayload({
      rootDirectoryPath,
      subtreeId: "phase2b_row_0905",
      scriptVersion: "quantum-readiness.frontendSubtreeDetailPayload.spec",
    });

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.target.rootGateId).toBe("G:G939");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.basicEventCount).toBe(8);
    expect(result.summary.requiredQubits).toBe(8);
    expect(result.summary.thresholdBehavior).toBe("threshold_favorable");
    expect(result.summary.providerBackendName).toBe("ibm_marrakesh");
    expect(result.summary.recoveryPrimaryMode).toBe("union_sensitivity_recovery");
    expect(result.summary.requiresOperatorAttention).toBe(true);
    expect(result.preparation?.qaoaRecipe.depthP).toBe(1);
    expect(result.preparation?.backendEligibility.eligibleBackendNames).toEqual([
      "ibm_marrakesh",
      "ibm_torino",
    ]);
    expect(result.recovery?.unionRecoveredCount).toBe(4);
    expect(result.importanceComparison?.rawSpearman).toBe(0.488);
    expect(result.provenance.matchedArtifactPaths.length).toBe(4);
  });

  it("throws when the root directory path is missing", () => {
    expect(() =>
      buildOpenPraQuantumFrontendSubtreeDetailPayload({
        rootDirectoryPath: "",
      }),
    ).toThrow("rootDirectoryPath is required.");
  });
});
''',
    "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSubtreeDetailPayload.service.spec.ts": r'''
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { QuantumReadinessService } from "./quantumReadiness.service";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("QuantumReadinessService frontend subtree detail payload", () => {
  it("returns the subtree detail payload through the service method", () => {
    const rootDirectoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "openpra-service-frontend-subtree-detail-"),
    );

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0698",
      subtreeId: "phase2b_row_0698",
      rootGateId: "G:G348",
      topologyClass: "A",
      basicEventCount: 5,
      requiredQubits: 5,
      qaoaRecipe: {
        beta: -0.785398163,
        gamma: 1.570796327,
        p: 1,
        mixerSpec: "qaoa_plus",
      },
    });

    const result = QuantumReadinessService.prototype.getFrontendSubtreeDetailPayload.call(
      {} as QuantumReadinessService,
      {
        rootDirectoryPath,
        subtreeId: "phase2b_row_0698",
        scriptVersion: "quantumReadiness.frontendSubtreeDetailPayload.service.spec",
      },
    );

    expect(result.target.subtreeId).toBe("phase2b_row_0698");
    expect(result.summary.topologyClass).toBe("A");
    expect(result.summary.thresholdBehavior).toBe("threshold_favorable");
    expect(result.preparation?.qaoaRecipe.mixerSpec).toBe("qaoa_plus");
  });
});
''',
    "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSubtreeDetailPayload.controller.spec.ts": r'''
import { QuantumReadinessController } from "./quantumReadiness.controller";

describe("QuantumReadinessController frontend subtree detail payload", () => {
  it("routes the subtree detail payload request through the service", () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        topologyClass: "C",
      },
    };

    const mockQuantumReadinessService = {
      getFrontendSubtreeDetailPayload: jest.fn().mockReturnValue(mockResponse),
    };

    const result = QuantumReadinessController.prototype.getFrontendSubtreeDetailPayload.call(
      {
        quantumReadinessService: mockQuantumReadinessService,
      } as unknown as QuantumReadinessController,
      "/tmp/openpra-root",
      "phase2b_row_0905",
      "phase2b_row_0905",
      "G:G939",
    );

    expect(mockQuantumReadinessService.getFrontendSubtreeDetailPayload).toHaveBeenCalledWith({
      rootDirectoryPath: "/tmp/openpra-root",
      subtreeId: "phase2b_row_0905",
      caseLabel: "phase2b_row_0905",
      rootGateId: "G:G939",
      scriptVersion: "quantumReadiness.controller.frontendSubtreeDetailPayload",
    });
    expect(result).toBe(mockResponse);
  });
});
''',
    "packages/web-backend/tests/quantumReadiness.frontendSubtreeDetailPayload.http.spec.ts": r'''
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendSubtreeDetailPayload.http", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        {
          provide: QuantumReadinessService,
          useValue: {
            getFrontendSubtreeDetailPayload: jest.fn().mockReturnValue({
              target: {
                subtreeId: "phase2b_row_0905",
                caseLabel: "phase2b_row_0905",
                rootGateId: "G:G939",
                phase2bRowId: "phase2b_row_0905",
              },
              summary: {
                topologyClass: "C",
                thresholdBehavior: "threshold_favorable",
              },
              provenance: {
                rootDirectoryPath: "/tmp/openpra-root",
              },
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("loads the frontend subtree detail payload through HTTP", async () => {
    let response = await request(app.getHttpServer())
      .get("/quantumReadiness/frontend/subtree-detail-payload")
      .query({
        rootDirectoryPath: "/tmp/openpra-root",
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
      });

    if (response.status === 404) {
      response = await request(app.getHttpServer())
        .get("/quantum-readiness/frontend/subtree-detail-payload")
        .query({
          rootDirectoryPath: "/tmp/openpra-root",
          subtreeId: "phase2b_row_0905",
          caseLabel: "phase2b_row_0905",
          rootGateId: "G:G939",
        });
    }

    expect(response.status).toBe(200);
    expect(response.body.target.subtreeId).toBe("phase2b_row_0905");
    expect(response.body.summary.topologyClass).toBe("C");
    expect(response.body.summary.thresholdBehavior).toBe("threshold_favorable");
  });
});
''',
}

CHECKPOINT_SCRIPT = r'''#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BASE_DIR="$REPO_ROOT/_work/openpra_quantum_frontend_subtree_detail_payload_checkpoint_v1"
OUT_DIR="$BASE_DIR/OPENPRA_QUANTUM_FRONTEND_SUBTREE_DETAIL_PAYLOAD_CHECKPOINT_v1_${STAMP}"

mkdir -p "$OUT_DIR"

copy_into_checkpoint() {
  local rel_path="$1"
  mkdir -p "$OUT_DIR/$(dirname "$rel_path")"
  cp "$REPO_ROOT/$rel_path" "$OUT_DIR/$rel_path"
}

copy_into_checkpoint "packages/quantum-readiness/src/lib/openpra-quantum-frontend-subtree-detail-payload.ts"
copy_into_checkpoint "packages/quantum-readiness/src/lib/openpra-quantum-frontend-subtree-detail-payload.spec.ts"
copy_into_checkpoint "packages/quantum-readiness/src/lib/index.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSubtreeDetailPayload.service.spec.ts"
copy_into_checkpoint "packages/web-backend/src/quantumReadiness/quantumReadiness.frontendSubtreeDetailPayload.controller.spec.ts"
copy_into_checkpoint "packages/web-backend/tests/quantumReadiness.frontendSubtreeDetailPayload.http.spec.ts"
copy_into_checkpoint "tools/quantum_integration/apply_ws7_frontend_subtree_detail_payload_chunk_q_v1.py"
copy_into_checkpoint "tools/quantum_integration/openpra_quantum_build_frontend_subtree_detail_payload_checkpoint_v1.sh"

tar -czf "${OUT_DIR}.tar.gz" -C "$BASE_DIR" "$(basename "$OUT_DIR")"
sha256sum "${OUT_DIR}.tar.gz" > "${OUT_DIR}.tar.gz.sha256"

echo "$OUT_DIR"
echo "${OUT_DIR}.tar.gz"
echo "${OUT_DIR}.tar.gz.sha256"
'''

SERVICE_IMPORT_BLOCK = r'''
import {
  buildOpenPraQuantumFrontendSubtreeDetailPayload,
  OpenPraQuantumFrontendSubtreeDetailPayloadRequest,
  OpenPraQuantumFrontendSubtreeDetailPayloadResult,
} from "@openpra/quantum-readiness";
'''

SERVICE_METHOD_BLOCK = r'''
  getFrontendSubtreeDetailPayload(
    request: OpenPraQuantumFrontendSubtreeDetailPayloadRequest,
  ): OpenPraQuantumFrontendSubtreeDetailPayloadResult {
    return buildOpenPraQuantumFrontendSubtreeDetailPayload(request);
  }

'''

CONTROLLER_IMPORT_BLOCK = r'''
import { Get, Query } from "@nestjs/common";
'''

CONTROLLER_METHOD_BLOCK = r'''
  @Get("frontend/subtree-detail-payload")
  getFrontendSubtreeDetailPayload(
    @Query("rootDirectoryPath") rootDirectoryPath: string,
    @Query("subtreeId") subtreeId?: string,
    @Query("caseLabel") caseLabel?: string,
    @Query("rootGateId") rootGateId?: string,
  ) {
    return this.quantumReadinessService.getFrontendSubtreeDetailPayload({
      rootDirectoryPath,
      subtreeId: subtreeId ?? null,
      caseLabel: caseLabel ?? null,
      rootGateId: rootGateId ?? null,
      scriptVersion: "quantumReadiness.controller.frontendSubtreeDetailPayload",
    });
  }

'''

INDEX_EXPORT_LINE = 'export * from "./lib/openpra-quantum-frontend-subtree-detail-payload";\n'


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

    print("Applied frontend subtree detail payload chunk Q successfully.")


if __name__ == "__main__":
    main()
