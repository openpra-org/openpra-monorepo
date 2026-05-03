import type { QuantumRecoveryLadderResult } from "./quantum-recovery";

export interface OpenpraQuantumRecoveryBatchRollupCaseInput {
  label: string;
  result: QuantumRecoveryLadderResult;
  candidateDir?: string;
  resultPath?: string;
  resultSha256?: string;
}

export interface OpenpraQuantumRecoveryBatchRollupCase {
  label: string;
  modelId: string;
  candidateRootNodeId: string;
  topologyClass: string | null;
  basicEventCount: number | null;
  requiredQubits: number | null;
  primaryMode: string;
  requiresOperatorAttention: boolean;
  referenceCutSetCount: number;
  tier1RecoveredExactCutSetCount: number;
  unionRecoveredCount: number;
  unionAllRecovered: boolean;
  candidateDir?: string;
  resultPath?: string;
  resultSha256?: string;
}

export interface OpenpraQuantumRecoveryBatchRollup {
  generatedAt: string;
  scriptVersion: string;
  batchRoot: string;
  caseCount: number;
  exactHardwareRecoveryCaseCount: number;
  unionSensitivityRecoveryCaseCount: number;
  operatorAttentionRequiredCaseCount: number;
  cases: OpenpraQuantumRecoveryBatchRollupCase[];
}

const MODULE_VERSION = "openpra-quantum-recovery-rollup-v1";

function normalizeNullableNumber(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeNullableString(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function buildOpenpraQuantumRecoveryBatchRollup(
  batchRoot: string,
  caseInputs: OpenpraQuantumRecoveryBatchRollupCaseInput[],
): OpenpraQuantumRecoveryBatchRollup {
  const orderedCases = [...caseInputs]
    .sort((left, right) => left.label.localeCompare(right.label))
    .map<OpenpraQuantumRecoveryBatchRollupCase>((entry) => ({
      label: entry.label,
      modelId: entry.result.modelId,
      candidateRootNodeId: entry.result.candidateRootNodeId,
      topologyClass: normalizeNullableString(entry.result.topologyClass),
      basicEventCount: normalizeNullableNumber(entry.result.basicEventCount),
      requiredQubits: normalizeNullableNumber(entry.result.requiredQubits),
      primaryMode: entry.result.integrationRecommendation.primaryMode,
      requiresOperatorAttention: entry.result.integrationRecommendation.requiresOperatorAttention,
      referenceCutSetCount: entry.result.referenceCutSetCount,
      tier1RecoveredExactCutSetCount: entry.result.recoveryTier1ExactHardware.recoveredExactCutSetCount,
      unionRecoveredCount: entry.result.recoveryTier3UnionSensitivity.unionRecoveredCount,
      unionAllRecovered: entry.result.recoveryTier3UnionSensitivity.allRecoveredInUnion,
      ...(entry.candidateDir ? { candidateDir: entry.candidateDir } : {}),
      ...(entry.resultPath ? { resultPath: entry.resultPath } : {}),
      ...(entry.resultSha256 ? { resultSha256: entry.resultSha256 } : {}),
    }));

  return {
    generatedAt: new Date().toISOString(),
    scriptVersion: MODULE_VERSION,
    batchRoot,
    caseCount: orderedCases.length,
    exactHardwareRecoveryCaseCount: orderedCases.filter((row) => row.primaryMode === "exact_hardware_recovery").length,
    unionSensitivityRecoveryCaseCount: orderedCases.filter((row) => row.primaryMode === "union_sensitivity_recovery")
      .length,
    operatorAttentionRequiredCaseCount: orderedCases.filter((row) => row.requiresOperatorAttention).length,
    cases: orderedCases,
  };
}
