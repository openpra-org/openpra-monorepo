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

type ArtifactKind = "preparation" | "providerRequest" | "recovery" | "importance" | "unknown";

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

interface Selector {
  subtreeId: string | null;
  caseLabel: string | null;
  rootGateId: string | null;
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

  const preparationArtifact = pickBestArtifact(activeArtifacts, "preparation");
  const providerArtifact = pickBestArtifact(activeArtifacts, "providerRequest");
  const recoveryArtifact = pickBestArtifact(activeArtifacts, "recovery");
  const importanceArtifact = pickBestArtifact(activeArtifacts, "importance");

  const seedArtifact = preparationArtifact ?? providerArtifact ?? recoveryArtifact ?? importanceArtifact ?? null;

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
    findValue(seedArtifact?.data, "requiredQubits"),
    findValue(seedArtifact?.data, "required_qubits"),
  );

  const thresholdBehavior = topologyClassToThresholdBehavior(topologyClass);

  const matchedArtifactPaths = [
    preparationArtifact?.artifactPath,
    providerArtifact?.artifactPath,
    recoveryArtifact?.artifactPath,
    importanceArtifact?.artifactPath,
  ].filter((value: string | undefined): value is string => Boolean(value));

  return {
    target: {
      subtreeId: firstString(
        selector.subtreeId,
        preparationArtifact?.subtreeId,
        providerArtifact?.subtreeId,
        recoveryArtifact?.subtreeId,
        importanceArtifact?.subtreeId,
      ),
      caseLabel: firstString(
        selector.caseLabel,
        preparationArtifact?.caseLabel,
        providerArtifact?.caseLabel,
        recoveryArtifact?.caseLabel,
        importanceArtifact?.caseLabel,
      ),
      rootGateId: firstString(
        selector.rootGateId,
        preparationArtifact?.rootGateId,
        providerArtifact?.rootGateId,
        recoveryArtifact?.rootGateId,
        importanceArtifact?.rootGateId,
      ),
      phase2bRowId: firstString(
        preparationArtifact?.phase2bRowId,
        providerArtifact?.phase2bRowId,
        recoveryArtifact?.phase2bRowId,
        importanceArtifact?.phase2bRowId,
      ),
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
      requiresOperatorAttention:
        firstBoolean(
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
      preparationArtifact === null ? null : (
        {
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
        }
      ),
    providerRequest:
      providerArtifact === null ? null : (
        {
          backendName: firstString(
            findValue(providerArtifact.data, "backendName"),
            findValue(providerArtifact.data, "backend"),
          ),
          providerName: firstString(
            findValue(providerArtifact.data, "providerName"),
            findValue(providerArtifact.data, "provider"),
          ),
          jobId: firstString(findValue(providerArtifact.data, "jobId"), findValue(providerArtifact.data, "job_id")),
          shots: firstNumber(findValue(providerArtifact.data, "shots"), findValue(providerArtifact.data, "shotCount")),
          resilienceLevel: firstNumber(
            findValue(providerArtifact.data, "resilienceLevel"),
            findValue(providerArtifact.data, "resilience_level"),
          ),
          status: firstString(
            findValue(providerArtifact.data, "status"),
            findValue(providerArtifact.data, "executionStatus"),
          ),
        }
      ),
    recovery:
      recoveryArtifact === null ? null : (
        {
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
        }
      ),
    importanceComparison:
      importanceArtifact === null ? null : (
        {
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
        }
      ),
    topologyAssessment: {
      topologyClass,
      thresholdBehavior,
      narrative: topologyClassToNarrative(topologyClass),
    },
    provenance: {
      rootDirectoryPath,
      scriptVersion: normalizeText(request.scriptVersion) ?? "openpra-quantum-frontend-subtree-detail-payload.v1",
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

function toStringArray(...values: unknown[]): string[] {
  for (const value of values) {
    if (!Array.isArray(value)) {
      continue;
    }

    const normalized = value
      .map((item: unknown) => normalizeText(item))
      .filter((item: string | null): item is string => item !== null);

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
