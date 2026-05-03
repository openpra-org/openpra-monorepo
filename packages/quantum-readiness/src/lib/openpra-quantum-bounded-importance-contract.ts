export const SCREENING_LEVEL_BOUNDEDNESS_STATEMENT =
  "These importance measures are computed from quantum recovered MCS and validated at screening level significance. They are not suitable for regulatory grade risk quantification without independent verification.";

export type OpenPraQuantumTopologyClass = "A" | "B" | "C" | "D" | "unclassified";

export type OpenPraQuantumRecoveryMode = "exact_hardware_recovery" | "union_sensitivity_recovery" | "partial" | string;

export interface OpenPraQuantumImportanceValue {
  basicEventId: string;
  fussellVesely: number | null;
  riskAchievementWorth: number | null;
  birnbaum: number | null;
}

export interface OpenPraQuantumImportanceComparisonStatistics {
  sharedBasicEventCount: number;
  fvCorrelation: number | null;
  rawCorrelation: number | null;
  birnbaumCorrelation: number | null;
  fvMaxAbsoluteDeviation: number | null;
  rawMaxAbsoluteDeviation: number | null;
  birnbaumMaxAbsoluteDeviation: number | null;
  disagreementCount: number | null;
}

export interface OpenPraQuantumBoundedImportanceResponse {
  subtreeId: string;
  topologyClass: OpenPraQuantumTopologyClass;
  recoveryMode: OpenPraQuantumRecoveryMode;
  operatorAttentionRequired: boolean;
  boundednessStatement: string;
  quantumImportance: OpenPraQuantumImportanceValue[];
  classicalBaseline: OpenPraQuantumImportanceValue[];
  comparisonStatistics: OpenPraQuantumImportanceComparisonStatistics;
  provenanceManifestPath: string;
  sourceRecoveryArtifactPath: string | null;
  generatedAtUtc: string;
  caseLabel?: string;
}

export interface BuildOpenPraQuantumBoundedImportanceResponseParams {
  subtreeId: string;
  topologyClass: OpenPraQuantumTopologyClass;
  recoveryMode: OpenPraQuantumRecoveryMode;
  operatorAttentionRequired: boolean;
  quantumImportance: OpenPraQuantumImportanceValue[];
  classicalBaseline: OpenPraQuantumImportanceValue[];
  comparisonStatistics: OpenPraQuantumImportanceComparisonStatistics;
  provenanceManifestPath: string;
  sourceRecoveryArtifactPath?: string | null;
  generatedAtUtc?: string;
  caseLabel?: string;
}

export function buildOpenPraQuantumBoundedImportanceResponse(
  params: BuildOpenPraQuantumBoundedImportanceResponseParams,
): OpenPraQuantumBoundedImportanceResponse {
  const response: OpenPraQuantumBoundedImportanceResponse = {
    subtreeId: requireNonEmpty(params.subtreeId, "subtreeId"),
    topologyClass: params.topologyClass,
    recoveryMode: params.recoveryMode,
    operatorAttentionRequired: Boolean(params.operatorAttentionRequired),
    boundednessStatement: SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
    quantumImportance: normalizeImportanceValues(params.quantumImportance),
    classicalBaseline: normalizeImportanceValues(params.classicalBaseline),
    comparisonStatistics: normalizeComparisonStatistics(params.comparisonStatistics),
    provenanceManifestPath: requireNonEmpty(params.provenanceManifestPath, "provenanceManifestPath"),
    sourceRecoveryArtifactPath: params.sourceRecoveryArtifactPath ?? null,
    generatedAtUtc: params.generatedAtUtc ?? new Date().toISOString(),
    caseLabel: params.caseLabel,
  };

  assertOpenPraQuantumBoundedImportanceResponse(response);
  return response;
}

export function assertOpenPraQuantumBoundedImportanceResponse(value: OpenPraQuantumBoundedImportanceResponse): void {
  requireNonEmpty(value.subtreeId, "subtreeId");
  requireNonEmpty(value.provenanceManifestPath, "provenanceManifestPath");

  if (value.boundednessStatement !== SCREENING_LEVEL_BOUNDEDNESS_STATEMENT) {
    throw new Error("boundednessStatement must match the screening level statement.");
  }

  assertImportanceArray(value.quantumImportance, "quantumImportance");
  assertImportanceArray(value.classicalBaseline, "classicalBaseline");

  if (typeof value.operatorAttentionRequired !== "boolean") {
    throw new Error("operatorAttentionRequired must be boolean.");
  }

  if (!value.generatedAtUtc) {
    throw new Error("generatedAtUtc is required.");
  }

  const stats = value.comparisonStatistics;
  assertNullableNumber(stats.fvCorrelation, "comparisonStatistics.fvCorrelation");
  assertNullableNumber(stats.rawCorrelation, "comparisonStatistics.rawCorrelation");
  assertNullableNumber(stats.birnbaumCorrelation, "comparisonStatistics.birnbaumCorrelation");
  assertNullableNumber(stats.fvMaxAbsoluteDeviation, "comparisonStatistics.fvMaxAbsoluteDeviation");
  assertNullableNumber(stats.rawMaxAbsoluteDeviation, "comparisonStatistics.rawMaxAbsoluteDeviation");
  assertNullableNumber(stats.birnbaumMaxAbsoluteDeviation, "comparisonStatistics.birnbaumMaxAbsoluteDeviation");
  assertNullableNumber(stats.disagreementCount, "comparisonStatistics.disagreementCount");

  if (!Number.isInteger(stats.sharedBasicEventCount) || stats.sharedBasicEventCount < 0) {
    throw new Error("comparisonStatistics.sharedBasicEventCount must be a non negative integer.");
  }
}

function normalizeImportanceValues(values: OpenPraQuantumImportanceValue[]): OpenPraQuantumImportanceValue[] {
  const normalized = [...values].map((value) => ({
    basicEventId: requireNonEmpty(value.basicEventId, "basicEventId"),
    fussellVesely: normalizeNullableNumber(value.fussellVesely, "fussellVesely"),
    riskAchievementWorth: normalizeNullableNumber(value.riskAchievementWorth, "riskAchievementWorth"),
    birnbaum: normalizeNullableNumber(value.birnbaum, "birnbaum"),
  }));

  normalized.sort((left, right) => left.basicEventId.localeCompare(right.basicEventId));
  return normalized;
}

function normalizeComparisonStatistics(
  value: OpenPraQuantumImportanceComparisonStatistics,
): OpenPraQuantumImportanceComparisonStatistics {
  return {
    sharedBasicEventCount: normalizeNonNegativeInteger(value.sharedBasicEventCount, "sharedBasicEventCount"),
    fvCorrelation: normalizeNullableNumber(value.fvCorrelation, "fvCorrelation"),
    rawCorrelation: normalizeNullableNumber(value.rawCorrelation, "rawCorrelation"),
    birnbaumCorrelation: normalizeNullableNumber(value.birnbaumCorrelation, "birnbaumCorrelation"),
    fvMaxAbsoluteDeviation: normalizeNullableNumber(value.fvMaxAbsoluteDeviation, "fvMaxAbsoluteDeviation"),
    rawMaxAbsoluteDeviation: normalizeNullableNumber(value.rawMaxAbsoluteDeviation, "rawMaxAbsoluteDeviation"),
    birnbaumMaxAbsoluteDeviation: normalizeNullableNumber(
      value.birnbaumMaxAbsoluteDeviation,
      "birnbaumMaxAbsoluteDeviation",
    ),
    disagreementCount: normalizeNullableNumber(value.disagreementCount, "disagreementCount"),
  };
}

function assertImportanceArray(values: OpenPraQuantumImportanceValue[], fieldName: string): void {
  if (!Array.isArray(values)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  const seen = new Set<string>();
  for (const value of values) {
    const basicEventId = requireNonEmpty(value.basicEventId, `${fieldName}.basicEventId`);
    if (seen.has(basicEventId)) {
      throw new Error(`${fieldName} contains duplicate basicEventId=${basicEventId}.`);
    }
    seen.add(basicEventId);

    assertNullableNumber(value.fussellVesely, `${fieldName}.fussellVesely`);
    assertNullableNumber(value.riskAchievementWorth, `${fieldName}.riskAchievementWorth`);
    assertNullableNumber(value.birnbaum, `${fieldName}.birnbaum`);
  }
}

function requireNonEmpty(value: string, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} must be a non empty string.`);
  }
  return value;
}

function normalizeNullableNumber(value: number | null, fieldName: string): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a number or null.`);
  }
  return value;
}

function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non negative integer.`);
  }
  return value;
}

function assertNullableNumber(value: number | null, fieldName: string): void {
  if (value !== null && (typeof value !== "number" || Number.isNaN(value))) {
    throw new Error(`${fieldName} must be a number or null.`);
  }
}
