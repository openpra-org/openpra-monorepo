import * as fs from "node:fs";
import * as path from "node:path";

export type OpenPraQuantumExecutionMode = "simulator" | "emulator" | "hardware" | "unavailable";

export interface OpenPraQuantumFrontendExecutionModeSelectionPayloadRequest {
  rootDirectoryPath: string;
  subtreeId?: string | null;
  caseLabel?: string | null;
  rootGateId?: string | null;
  scriptVersion?: string | null;
}

export const OPENPRA_QUANTUM_FRONTEND_EXECUTION_MODE_SELECTION_BOUNDEDNESS_STATEMENT =
  "Screening level bounded integration review only. This payload does not imply unrestricted production readiness, comparative benefit, or claims beyond the documented project scope.";

export interface OpenPraQuantumFrontendExecutionModeSelectionPayloadResult {
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
    recommendedMode: OpenPraQuantumExecutionMode;
    currentMode: OpenPraQuantumExecutionMode;
    providerName: string | null;
    providerBackendName: string | null;
    latestStatus: string | null;
    statevectorVerified: boolean | null;
    requiresOperatorAttention: boolean;
    boundednessStatement: string;
  };
  selection: {
    recommendedMode: OpenPraQuantumExecutionMode;
    currentMode: OpenPraQuantumExecutionMode;
    submissionEnabled: boolean;
    reasons: string[];
  };
  modes: {
    simulator: OpenPraQuantumFrontendExecutionModeSelectionPayloadOption;
    emulator: OpenPraQuantumFrontendExecutionModeSelectionPayloadOption;
    hardware: OpenPraQuantumFrontendExecutionModeSelectionPayloadOption;
  };
  execution: {
    providerName: string | null;
    backendName: string | null;
    jobId: string | null;
    status: string | null;
    shots: number | null;
    resilienceLevel: number | null;
    rawCountsAvailable: boolean;
  } | null;
  guardrails: {
    statevectorVerified: boolean | null;
    backendEligibilityKnown: boolean;
    eligibleBackendNames: string[];
    requiresOperatorAttention: boolean;
    unionSensitivityObserved: boolean;
  };
  provenance: {
    rootDirectoryPath: string;
    scriptVersion: string;
    generatedAtUtc: string;
    matchedArtifactPaths: string[];
  };
}

export interface OpenPraQuantumFrontendExecutionModeSelectionPayloadOption {
  mode: OpenPraQuantumExecutionMode;
  available: boolean;
  selectedByDefault: boolean;
  actionLabel: string;
  rationale: string | null;
  backendCandidates: string[];
  currentStatus: string | null;
}

type ArtifactKind = "preparation" | "providerRequest" | "recovery" | "unknown";

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

export function buildOpenPraQuantumFrontendExecutionModeSelectionPayload(
  request: OpenPraQuantumFrontendExecutionModeSelectionPayloadRequest,
): OpenPraQuantumFrontendExecutionModeSelectionPayloadResult {
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

  const topologyClass = firstString(
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

  const eligibleBackendNames = toStringArray(
    findValue(preparationArtifact?.data, "eligibleBackendNames"),
    findValue(preparationArtifact?.data, "backendEligibility.eligibleBackendNames"),
    findValue(preparationArtifact?.data, "backend_eligibility.eligible_backend_names"),
  );

  const statevectorVerified = firstBoolean(
    findValue(preparationArtifact?.data, "statevectorVerification.pass"),
    findValue(preparationArtifact?.data, "statevector_verification.pass"),
  );

  const requiresOperatorAttention =
    firstBoolean(
      findValue(recoveryArtifact?.data, "requiresOperatorAttention"),
      findValue(recoveryArtifact?.data, "requires_operator_attention"),
    ) ?? false;

  const unionSensitivityObserved = isUnionSensitivityRecovery(recoveryArtifact?.data);

  const providerName = firstString(
    findValue(providerArtifact?.data, "providerName"),
    findValue(providerArtifact?.data, "provider"),
  );

  const backendName = firstString(
    findValue(providerArtifact?.data, "backendName"),
    findValue(providerArtifact?.data, "backend"),
  );

  const latestStatus = firstString(
    findValue(providerArtifact?.data, "status"),
    findValue(providerArtifact?.data, "executionStatus"),
  );

  const simulatorAvailable = preparationArtifact !== null;
  const emulatorAvailable = preparationArtifact !== null && (requiredQubits === null || requiredQubits <= 32);
  const hardwareAvailable =
    preparationArtifact !== null && statevectorVerified === true && eligibleBackendNames.length > 0;

  const recommendedMode = determineRecommendedMode({
    simulatorAvailable,
    emulatorAvailable,
    hardwareAvailable,
    providerName,
    backendName,
  });

  const currentMode = determineCurrentMode({
    recommendedMode,
    providerName,
    backendName,
  });

  const submissionEnabled = recommendedMode !== "unavailable" && (recommendedMode !== "hardware" || hardwareAvailable);

  const reasons = buildReasons({
    simulatorAvailable,
    emulatorAvailable,
    hardwareAvailable,
    statevectorVerified,
    eligibleBackendNames,
    requiresOperatorAttention,
    latestStatus,
  });

  const matchedArtifactPaths = [
    preparationArtifact?.artifactPath,
    providerArtifact?.artifactPath,
    recoveryArtifact?.artifactPath,
  ].filter((value: string | undefined): value is string => Boolean(value));

  return {
    target: {
      subtreeId: firstString(
        selector.subtreeId,
        preparationArtifact?.subtreeId,
        providerArtifact?.subtreeId,
        recoveryArtifact?.subtreeId,
      ),
      caseLabel: firstString(
        selector.caseLabel,
        preparationArtifact?.caseLabel,
        providerArtifact?.caseLabel,
        recoveryArtifact?.caseLabel,
      ),
      rootGateId: firstString(
        selector.rootGateId,
        preparationArtifact?.rootGateId,
        providerArtifact?.rootGateId,
        recoveryArtifact?.rootGateId,
      ),
      phase2bRowId: firstString(
        preparationArtifact?.phase2bRowId,
        providerArtifact?.phase2bRowId,
        recoveryArtifact?.phase2bRowId,
      ),
    },
    summary: {
      topologyClass,
      basicEventCount,
      requiredQubits,
      recommendedMode,
      currentMode,
      providerName,
      providerBackendName: backendName,
      latestStatus,
      statevectorVerified,
      requiresOperatorAttention,
      boundednessStatement: OPENPRA_QUANTUM_FRONTEND_EXECUTION_MODE_SELECTION_BOUNDEDNESS_STATEMENT,
    },
    selection: {
      recommendedMode,
      currentMode,
      submissionEnabled,
      reasons,
    },
    modes: {
      simulator: {
        mode: "simulator",
        available: simulatorAvailable,
        selectedByDefault: recommendedMode === "simulator",
        actionLabel: "Run simulator execution",
        rationale:
          simulatorAvailable ?
            "Preparation artifacts exist, so simulator execution is available immediately."
          : "Simulator execution is unavailable until preparation artifacts exist.",
        backendCandidates: [],
        currentStatus: currentMode === "simulator" ? latestStatus : null,
      },
      emulator: {
        mode: "emulator",
        available: emulatorAvailable,
        selectedByDefault: recommendedMode === "emulator",
        actionLabel: "Run emulator execution",
        rationale:
          emulatorAvailable ?
            "The subtree is preparation-ready and fits the emulator-safe width gate."
          : "Emulator execution is unavailable because the subtree is not yet preparation-ready or exceeds the emulator-safe gate.",
        backendCandidates: eligibleBackendNames.filter((name: string) => looksLikeEmulator(name)),
        currentStatus: currentMode === "emulator" ? latestStatus : null,
      },
      hardware: {
        mode: "hardware",
        available: hardwareAvailable,
        selectedByDefault: recommendedMode === "hardware",
        actionLabel: "Submit to quantum hardware",
        rationale:
          hardwareAvailable ?
            "Statevector verification passed and at least one eligible backend is available."
          : "Hardware submission is gated until statevector verification passes and eligible backends are known.",
        backendCandidates: eligibleBackendNames,
        currentStatus: currentMode === "hardware" ? latestStatus : null,
      },
    },
    execution:
      providerArtifact === null ? null : (
        {
          providerName,
          backendName,
          jobId: firstString(findValue(providerArtifact.data, "jobId"), findValue(providerArtifact.data, "job_id")),
          status: latestStatus,
          shots: firstNumber(findValue(providerArtifact.data, "shots"), findValue(providerArtifact.data, "shotCount")),
          resilienceLevel: firstNumber(
            findValue(providerArtifact.data, "resilienceLevel"),
            findValue(providerArtifact.data, "resilience_level"),
          ),
          rawCountsAvailable: looksCompleted(latestStatus),
        }
      ),
    guardrails: {
      statevectorVerified,
      backendEligibilityKnown: eligibleBackendNames.length > 0,
      eligibleBackendNames,
      requiresOperatorAttention,
      unionSensitivityObserved,
    },
    provenance: {
      rootDirectoryPath,
      scriptVersion:
        normalizeText(request.scriptVersion) ?? "openpra-quantum-frontend-execution-mode-selection-payload.v1",
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
    hasAnyKey(data, ["primaryMode", "primary_mode", "requiresOperatorAttention", "unionRecoveredCount"])
  ) {
    return "recovery";
  }

  if (
    normalizedPath.includes("provider") ||
    normalizedPath.includes("execution_request") ||
    hasAnyKey(data, ["jobId", "job_id", "backendName", "providerName", "shots", "status"])
  ) {
    return "providerRequest";
  }

  if (
    normalizedPath.includes("preparation") ||
    normalizedPath.includes("canonical_case_pack") ||
    normalizedPath.includes("materialization") ||
    hasAnyKey(data, ["topologyClass", "requiredQubits", "backendEligibility", "statevectorVerification"])
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

function determineRecommendedMode(input: {
  simulatorAvailable: boolean;
  emulatorAvailable: boolean;
  hardwareAvailable: boolean;
  providerName: string | null;
  backendName: string | null;
}): OpenPraQuantumExecutionMode {
  const providerCurrentMode = inferModeFromProvider(input.providerName, input.backendName);

  if (providerCurrentMode !== "unavailable") {
    return providerCurrentMode;
  }

  if (input.hardwareAvailable) {
    return "hardware";
  }

  if (input.emulatorAvailable) {
    return "emulator";
  }

  if (input.simulatorAvailable) {
    return "simulator";
  }

  return "unavailable";
}

function determineCurrentMode(input: {
  recommendedMode: OpenPraQuantumExecutionMode;
  providerName: string | null;
  backendName: string | null;
}): OpenPraQuantumExecutionMode {
  const providerCurrentMode = inferModeFromProvider(input.providerName, input.backendName);

  return providerCurrentMode !== "unavailable" ? providerCurrentMode : input.recommendedMode;
}

function inferModeFromProvider(providerName: string | null, backendName: string | null): OpenPraQuantumExecutionMode {
  const providerText = (providerName ?? "").toLowerCase();
  const backendText = (backendName ?? "").toLowerCase();

  if (providerText.includes("simulator") || backendText.includes("simulator") || backendText.includes("statevector")) {
    return "simulator";
  }

  if (providerText.includes("emulator") || backendText.includes("emulator") || backendText.includes("fake")) {
    return "emulator";
  }

  if (providerText.length > 0 || backendText.length > 0) {
    return "hardware";
  }

  return "unavailable";
}

function buildReasons(input: {
  simulatorAvailable: boolean;
  emulatorAvailable: boolean;
  hardwareAvailable: boolean;
  statevectorVerified: boolean | null;
  eligibleBackendNames: string[];
  requiresOperatorAttention: boolean;
  latestStatus: string | null;
}): string[] {
  const reasons: string[] = [];

  if (input.hardwareAvailable) {
    reasons.push("Hardware is eligible because statevector verification passed and eligible backends are available.");
  } else if (input.statevectorVerified !== true) {
    reasons.push("Hardware is not yet the default because statevector verification has not passed.");
  } else if (input.eligibleBackendNames.length === 0) {
    reasons.push("Hardware is not yet the default because no eligible backend names were found.");
  }

  if (input.emulatorAvailable) {
    reasons.push("Emulator remains available as a lower-risk execution path.");
  }

  if (input.simulatorAvailable) {
    reasons.push("Simulator remains available as the safest fallback execution path.");
  }

  if (input.requiresOperatorAttention) {
    reasons.push(
      "Operator attention is required because recovery artifacts indicate a sensitivity or interpretation issue.",
    );
  }

  if (input.latestStatus !== null) {
    reasons.push(`Latest provider status is ${input.latestStatus}.`);
  }

  return reasons;
}

function isUnionSensitivityRecovery(data: Record<string, unknown> | undefined): boolean {
  const primaryMode = firstString(findValue(data, "primaryMode"), findValue(data, "primary_mode"));

  return primaryMode === "union_sensitivity_recovery";
}

function looksCompleted(status: string | null): boolean {
  if (status === null) {
    return false;
  }

  const normalized = status.toLowerCase();

  return normalized.includes("complete") || normalized === "done" || normalized === "success";
}

function looksLikeEmulator(name: string): boolean {
  const normalized = name.toLowerCase();

  return normalized.includes("fake") || normalized.includes("emulator");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
