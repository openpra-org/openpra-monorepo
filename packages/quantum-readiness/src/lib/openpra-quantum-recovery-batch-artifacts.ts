import { buildOpenpraQuantumRecoveryBatchRollup } from "./openpra-quantum-recovery-rollup";
import type {
  OpenpraQuantumRecoveryBatchRollup,
  OpenpraQuantumRecoveryBatchRollupCaseInput,
} from "./openpra-quantum-recovery-rollup";
import type { QuantumRecoveryLadderResult } from "./quantum-recovery";

export interface OpenpraQuantumRecoveryBatchArtifactCase {
  label: string;
  candidateDir?: string;
  resultPath?: string;
  resultSha256?: string;
  result: QuantumRecoveryLadderResult;
}

export interface OpenpraQuantumRecoveryBatchArtifactBundle {
  batchRoot: string;
  cases: OpenpraQuantumRecoveryBatchArtifactCase[];
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value;
}

function requireRecoveryResult(value: unknown, fieldName: string): QuantumRecoveryLadderResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  const obj = value as Record<string, unknown>;

  requireNonEmptyString(obj.modelId, `${fieldName}.modelId`);
  requireNonEmptyString(obj.candidateRootNodeId, `${fieldName}.candidateRootNodeId`);

  if (
    !obj.integrationRecommendation ||
    typeof obj.integrationRecommendation !== "object" ||
    Array.isArray(obj.integrationRecommendation)
  ) {
    throw new Error(`${fieldName}.integrationRecommendation must be an object.`);
  }

  if (
    !obj.recoveryTier1ExactHardware ||
    typeof obj.recoveryTier1ExactHardware !== "object" ||
    Array.isArray(obj.recoveryTier1ExactHardware)
  ) {
    throw new Error(`${fieldName}.recoveryTier1ExactHardware must be an object.`);
  }

  if (
    !obj.recoveryTier3UnionSensitivity ||
    typeof obj.recoveryTier3UnionSensitivity !== "object" ||
    Array.isArray(obj.recoveryTier3UnionSensitivity)
  ) {
    throw new Error(`${fieldName}.recoveryTier3UnionSensitivity must be an object.`);
  }

  return value as QuantumRecoveryLadderResult;
}

export function normalizeOpenpraQuantumRecoveryBatchArtifacts(bundle: OpenpraQuantumRecoveryBatchArtifactBundle): {
  batchRoot: string;
  caseInputs: OpenpraQuantumRecoveryBatchRollupCaseInput[];
} {
  const batchRoot = requireNonEmptyString(bundle.batchRoot, "bundle.batchRoot");

  if (!Array.isArray(bundle.cases)) {
    throw new Error("bundle.cases must be an array.");
  }

  const caseInputs: OpenpraQuantumRecoveryBatchRollupCaseInput[] = bundle.cases.map((entry, index) => {
    const fieldPrefix = `bundle.cases[${index}]`;

    return {
      label: requireNonEmptyString(entry.label, `${fieldPrefix}.label`),
      ...(entry.candidateDir ?
        {
          candidateDir: requireNonEmptyString(entry.candidateDir, `${fieldPrefix}.candidateDir`),
        }
      : {}),
      ...(entry.resultPath ?
        {
          resultPath: requireNonEmptyString(entry.resultPath, `${fieldPrefix}.resultPath`),
        }
      : {}),
      ...(entry.resultSha256 ?
        {
          resultSha256: requireNonEmptyString(entry.resultSha256, `${fieldPrefix}.resultSha256`),
        }
      : {}),
      result: requireRecoveryResult(entry.result, `${fieldPrefix}.result`),
    };
  });

  return {
    batchRoot,
    caseInputs,
  };
}

export function buildOpenpraQuantumRecoveryBatchRollupFromArtifacts(
  bundle: OpenpraQuantumRecoveryBatchArtifactBundle,
): OpenpraQuantumRecoveryBatchRollup {
  const normalized = normalizeOpenpraQuantumRecoveryBatchArtifacts(bundle);

  return buildOpenpraQuantumRecoveryBatchRollup(normalized.batchRoot, normalized.caseInputs);
}
