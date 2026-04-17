export interface OpenPraQuantumProviderExecutionRequest {
  requestId: string;
  subtreeId: string;
  caseLabel: string;
  providerName: string;
  backendName: string;
  shots: number;
  resilienceLevel: number;
  createdAtUtc: string;
  notes: string | null;
}

export interface CreateOpenPraQuantumProviderExecutionRequestParams {
  requestId: string;
  subtreeId: string;
  caseLabel: string;
  providerName: string;
  backendName: string;
  shots: number;
  resilienceLevel?: number;
  createdAtUtc?: string;
  notes?: string | null;
}

export function createOpenPraQuantumProviderExecutionRequest(
  params: CreateOpenPraQuantumProviderExecutionRequestParams,
): OpenPraQuantumProviderExecutionRequest {
  const request: OpenPraQuantumProviderExecutionRequest = {
    requestId: requireNonEmpty(params.requestId, "requestId"),
    subtreeId: requireNonEmpty(params.subtreeId, "subtreeId"),
    caseLabel: requireNonEmpty(params.caseLabel, "caseLabel"),
    providerName: requireNonEmpty(params.providerName, "providerName"),
    backendName: requireNonEmpty(params.backendName, "backendName"),
    shots: normalizePositiveInteger(params.shots, "shots"),
    resilienceLevel:
      params.resilienceLevel === undefined ? 0 : normalizeNonNegativeInteger(params.resilienceLevel, "resilienceLevel"),
    createdAtUtc: params.createdAtUtc ?? new Date().toISOString(),
    notes: params.notes ?? null,
  };

  assertOpenPraQuantumProviderExecutionRequest(request);
  return request;
}

export function assertOpenPraQuantumProviderExecutionRequest(request: OpenPraQuantumProviderExecutionRequest): void {
  requireNonEmpty(request.requestId, "requestId");
  requireNonEmpty(request.subtreeId, "subtreeId");
  requireNonEmpty(request.caseLabel, "caseLabel");
  requireNonEmpty(request.providerName, "providerName");
  requireNonEmpty(request.backendName, "backendName");
  normalizePositiveInteger(request.shots, "shots");
  normalizeNonNegativeInteger(request.resilienceLevel, "resilienceLevel");
  requireNonEmpty(request.createdAtUtc, "createdAtUtc");
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
