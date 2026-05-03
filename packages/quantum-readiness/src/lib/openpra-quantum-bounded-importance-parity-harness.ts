import {
  SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
  type OpenPraQuantumBoundedImportanceResponse,
  type OpenPraQuantumImportanceValue,
} from "./openpra-quantum-bounded-importance-contract";

export interface OpenPraQuantumImportanceValueDifference {
  basicEventId: string;
  fieldName: "fussellVesely" | "riskAchievementWorth" | "birnbaum";
  expected: number | null;
  actual: number | null;
}

export interface OpenPraQuantumBoundedImportanceParityResult {
  subtreeId: string;
  caseLabel?: string;
  topologyClass: string;
  recoveryMode: string;
  operatorAttentionRequired: boolean;
  boundednessStatementMatches: boolean;
  quantumBasicEventIdsMatch: boolean;
  classicalBasicEventIdsMatch: boolean;
  comparisonStatisticsMatch: boolean;
  provenanceManifestPresent: boolean;
  sourceRecoveryArtifactPresent: boolean;
  quantumDifferences: OpenPraQuantumImportanceValueDifference[];
  classicalDifferences: OpenPraQuantumImportanceValueDifference[];
  mismatchCount: number;
  allChecksPass: boolean;
}

export function buildOpenPraQuantumBoundedImportanceParityResult(
  actual: OpenPraQuantumBoundedImportanceResponse,
  expected: OpenPraQuantumBoundedImportanceResponse,
): OpenPraQuantumBoundedImportanceParityResult {
  const quantumDifferences = diffImportanceArrays(actual.quantumImportance, expected.quantumImportance);
  const classicalDifferences = diffImportanceArrays(actual.classicalBaseline, expected.classicalBaseline);

  const comparisonStatisticsMatch = deepEqual(
    normalizeJsonValue(actual.comparisonStatistics),
    normalizeJsonValue(expected.comparisonStatistics),
  );

  const result: OpenPraQuantumBoundedImportanceParityResult = {
    subtreeId: actual.subtreeId,
    caseLabel: actual.caseLabel,
    topologyClass: actual.topologyClass,
    recoveryMode: actual.recoveryMode,
    operatorAttentionRequired: actual.operatorAttentionRequired,
    boundednessStatementMatches:
      actual.boundednessStatement === SCREENING_LEVEL_BOUNDEDNESS_STATEMENT &&
      expected.boundednessStatement === SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
    quantumBasicEventIdsMatch: quantumDifferences.length === 0,
    classicalBasicEventIdsMatch: classicalDifferences.length === 0,
    comparisonStatisticsMatch,
    provenanceManifestPresent: Boolean(actual.provenanceManifestPath),
    sourceRecoveryArtifactPresent: Boolean(actual.sourceRecoveryArtifactPath),
    quantumDifferences,
    classicalDifferences,
    mismatchCount: quantumDifferences.length + classicalDifferences.length + (comparisonStatisticsMatch ? 0 : 1),
    allChecksPass: false,
  };

  result.allChecksPass =
    result.boundednessStatementMatches &&
    result.quantumBasicEventIdsMatch &&
    result.classicalBasicEventIdsMatch &&
    result.comparisonStatisticsMatch &&
    result.provenanceManifestPresent;

  return result;
}

function diffImportanceArrays(
  actual: OpenPraQuantumImportanceValue[],
  expected: OpenPraQuantumImportanceValue[],
): OpenPraQuantumImportanceValueDifference[] {
  const actualMap = buildImportanceMap(actual);
  const expectedMap = buildImportanceMap(expected);

  const ids = Array.from(new Set<string>([...actualMap.keys(), ...expectedMap.keys()])).sort();

  const diffs: OpenPraQuantumImportanceValueDifference[] = [];

  for (const basicEventId of ids) {
    const actualRow = actualMap.get(basicEventId) ?? emptyImportanceRow(basicEventId);
    const expectedRow = expectedMap.get(basicEventId) ?? emptyImportanceRow(basicEventId);

    appendDiffIfNeeded(diffs, basicEventId, "fussellVesely", actualRow.fussellVesely, expectedRow.fussellVesely);
    appendDiffIfNeeded(
      diffs,
      basicEventId,
      "riskAchievementWorth",
      actualRow.riskAchievementWorth,
      expectedRow.riskAchievementWorth,
    );
    appendDiffIfNeeded(diffs, basicEventId, "birnbaum", actualRow.birnbaum, expectedRow.birnbaum);
  }

  return diffs;
}

function appendDiffIfNeeded(
  diffs: OpenPraQuantumImportanceValueDifference[],
  basicEventId: string,
  fieldName: "fussellVesely" | "riskAchievementWorth" | "birnbaum",
  actual: number | null,
  expected: number | null,
): void {
  if (!sameNullableNumber(actual, expected)) {
    diffs.push({
      basicEventId,
      fieldName,
      expected,
      actual,
    });
  }
}

function buildImportanceMap(values: OpenPraQuantumImportanceValue[]): Map<string, OpenPraQuantumImportanceValue> {
  const out = new Map<string, OpenPraQuantumImportanceValue>();
  for (const value of values) {
    out.set(value.basicEventId, value);
  }
  return out;
}

function emptyImportanceRow(basicEventId: string): OpenPraQuantumImportanceValue {
  return {
    basicEventId,
    fussellVesely: null,
    riskAchievementWorth: null,
    birnbaum: null,
  };
}

function sameNullableNumber(left: number | null, right: number | null): boolean {
  if (left === null && right === null) {
    return true;
  }
  return left === right;
}

function normalizeJsonValue(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}

function deepEqual(left: string, right: string): boolean {
  return left === right;
}
