export const DEFAULT_WS6_RESILIENCE_LEVEL = 0;

export type OpenPraQuantumExecutionStatus = "submitted" | "running" | "completed" | "failed";

export interface OpenPraQuantumExecutionRecord {
  subtreeId: string;
  providerName: string;
  backendName: string;
  jobId: string;
  shots: number;
  resilienceLevel: number;
  status: OpenPraQuantumExecutionStatus;
  provenanceManifestPath: string;
  submittedAtUtc: string;
  caseLabel?: string;
}

export interface OpenPraQuantumExecutionResult {
  jobId: string;
  status: OpenPraQuantumExecutionStatus;
  rawCountsArtifactPath: string | null;
  recoveryArtifactPath: string | null;
  provenanceManifestPath: string;
  completedAtUtc: string | null;
  failureReason: string | null;
}

export interface CreateOpenPraQuantumExecutionRecordParams {
  subtreeId: string;
  providerName: string;
  backendName: string;
  jobId: string;
  shots: number;
  resilienceLevel?: number;
  status?: OpenPraQuantumExecutionStatus;
  provenanceManifestPath: string;
  submittedAtUtc?: string;
  caseLabel?: string;
}

export interface CreateOpenPraQuantumExecutionResultParams {
  jobId: string;
  status: OpenPraQuantumExecutionStatus;
  rawCountsArtifactPath?: string | null;
  recoveryArtifactPath?: string | null;
  provenanceManifestPath: string;
  completedAtUtc?: string | null;
  failureReason?: string | null;
}

export function createOpenPraQuantumExecutionRecord(
  params: CreateOpenPraQuantumExecutionRecordParams,
): OpenPraQuantumExecutionRecord {
  const record: OpenPraQuantumExecutionRecord = {
    subtreeId: requireNonEmpty(params.subtreeId, "subtreeId"),
    providerName: requireNonEmpty(params.providerName, "providerName"),
    backendName: requireNonEmpty(params.backendName, "backendName"),
    jobId: requireNonEmpty(params.jobId, "jobId"),
    shots: normalizePositiveInteger(params.shots, "shots"),
    resilienceLevel:
      params.resilienceLevel === undefined ?
        DEFAULT_WS6_RESILIENCE_LEVEL
      : normalizeNonNegativeInteger(params.resilienceLevel, "resilienceLevel"),
    status: params.status ?? "submitted",
    provenanceManifestPath: requireNonEmpty(params.provenanceManifestPath, "provenanceManifestPath"),
    submittedAtUtc: params.submittedAtUtc ?? new Date().toISOString(),
    caseLabel: params.caseLabel,
  };

  assertOpenPraQuantumExecutionRecord(record);
  return record;
}

export function createOpenPraQuantumExecutionResult(
  params: CreateOpenPraQuantumExecutionResultParams,
): OpenPraQuantumExecutionResult {
  const result: OpenPraQuantumExecutionResult = {
    jobId: requireNonEmpty(params.jobId, "jobId"),
    status: params.status,
    rawCountsArtifactPath: params.rawCountsArtifactPath ?? null,
    recoveryArtifactPath: params.recoveryArtifactPath ?? null,
    provenanceManifestPath: requireNonEmpty(params.provenanceManifestPath, "provenanceManifestPath"),
    completedAtUtc: params.completedAtUtc ?? null,
    failureReason: params.failureReason ?? null,
  };

  assertOpenPraQuantumExecutionResult(result);
  return result;
}

export function assertOpenPraQuantumExecutionRecord(record: OpenPraQuantumExecutionRecord): void {
  requireNonEmpty(record.subtreeId, "subtreeId");
  requireNonEmpty(record.providerName, "providerName");
  requireNonEmpty(record.backendName, "backendName");
  requireNonEmpty(record.jobId, "jobId");
  requireNonEmpty(record.provenanceManifestPath, "provenanceManifestPath");

  if (!Number.isInteger(record.shots) || record.shots <= 0) {
    throw new Error("shots must be a positive integer.");
  }

  if (!Number.isInteger(record.resilienceLevel) || record.resilienceLevel < 0) {
    throw new Error("resilienceLevel must be a non negative integer.");
  }

  assertExecutionStatus(record.status, "status");
}

export function assertOpenPraQuantumExecutionResult(result: OpenPraQuantumExecutionResult): void {
  requireNonEmpty(result.jobId, "jobId");
  requireNonEmpty(result.provenanceManifestPath, "provenanceManifestPath");
  assertExecutionStatus(result.status, "status");

  if (result.status === "completed" && !result.rawCountsArtifactPath) {
    throw new Error("completed results must include rawCountsArtifactPath.");
  }

  if (result.status === "failed" && !result.failureReason) {
    throw new Error("failed results must include failureReason.");
  }
}

export function assertRecoveryCompatibleExecutionResult(result: OpenPraQuantumExecutionResult): void {
  assertOpenPraQuantumExecutionResult(result);

  if (result.status !== "completed") {
    throw new Error("Recovery-compatible execution result must be completed.");
  }

  if (!result.rawCountsArtifactPath) {
    throw new Error("Recovery-compatible execution result requires rawCountsArtifactPath.");
  }
}

function assertExecutionStatus(status: OpenPraQuantumExecutionStatus, fieldName: string): void {
  const allowed: OpenPraQuantumExecutionStatus[] = ["submitted", "running", "completed", "failed"];
  if (!allowed.includes(status)) {
    throw new Error(`${fieldName} must be one of ${allowed.join(", ")}.`);
  }
}

function requireNonEmpty(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} must be a non empty string.`);
  }
  return value;
}

function normalizePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return value;
}

function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non negative integer.`);
  }
  return value;
}
