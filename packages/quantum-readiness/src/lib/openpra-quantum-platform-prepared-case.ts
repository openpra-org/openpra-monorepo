import {
  OpenPraQuantumBackendFamily,
  OpenPraQuantumBackendMode,
  isAllowedOpenPraQuantumBackendModePair,
  isOpenPraQuantumBackendFamily,
  isOpenPraQuantumBackendMode,
} from "./openpra-quantum-platform-backend-mode";

export const OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_NAME = "OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA";

export const OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_VERSION = "v1";

export interface OpenPraQuantumSupportedInputShape {
  basicEventCount: number;
  qubitCountIfGateBased?: number;
  binaryVariableCountIfQubo?: number;
  maxSupportedQubitsIfKnown?: number;
  maxSupportedVariablesIfKnown?: number;
  topologyClassIfAvailable?: string;
  eligibilityStatus: "eligible" | "ineligible" | "eligible_with_warning" | "not_evaluated";
  eligibilityReason?: string;
}

export interface OpenPraQuantumPreparedCaseBatchMetadata {
  batchId?: string;
  batchPosition?: number;
  batchPolicyId?: string;
}

export interface OpenPraQuantumPreparedCase {
  schemaName: typeof OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_NAME;
  schemaVersion: typeof OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_VERSION;
  preparedCaseId: string;
  sourceModelId: string;
  sourceModelPath: string;
  subtreeId: string;
  rootGateId: string;
  preparationTimestampUtc: string;
  preparationToolVersion: string;
  backendFamily: OpenPraQuantumBackendFamily;
  backendMode: OpenPraQuantumBackendMode;
  encodingFamily: string;
  supportedInputShape: OpenPraQuantumSupportedInputShape;
  boundednessStatement: string;
  artifactRoot: string;
  submissionManifestPath: string;
  expectedResultSchema: string;
  provenanceBlock: Record<string, unknown>;
  failureTaxonomyVersion: string;
  batchMetadata?: OpenPraQuantumPreparedCaseBatchMetadata;
}

export interface OpenPraQuantumPreparedCaseValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasAtLeastOneOwnKey(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function validateSupportedInputShape(
  value: unknown,
  errors: string[],
): asserts value is OpenPraQuantumSupportedInputShape {
  if (!isPlainObject(value)) {
    errors.push("supportedInputShape must be a nonempty object");
    return;
  }

  if (typeof value.basicEventCount !== "number" || value.basicEventCount < 0) {
    errors.push("supportedInputShape.basicEventCount must be a nonnegative number");
  }

  if (!isNonEmptyString(value.eligibilityStatus)) {
    errors.push("supportedInputShape.eligibilityStatus is required");
    return;
  }

  const allowedEligibilityStatuses = ["eligible", "ineligible", "eligible_with_warning", "not_evaluated"];

  if (!allowedEligibilityStatuses.includes(value.eligibilityStatus)) {
    errors.push(`supportedInputShape.eligibilityStatus is not allowed: ${value.eligibilityStatus}`);
  }
}

export function validateOpenPraQuantumPreparedCase(candidate: unknown): OpenPraQuantumPreparedCaseValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(candidate)) {
    return {
      valid: false,
      errors: ["prepared case must be an object"],
      warnings,
    };
  }

  const requiredStringFields = [
    "preparedCaseId",
    "sourceModelId",
    "sourceModelPath",
    "subtreeId",
    "rootGateId",
    "preparationTimestampUtc",
    "preparationToolVersion",
    "encodingFamily",
    "boundednessStatement",
    "artifactRoot",
    "submissionManifestPath",
    "expectedResultSchema",
    "failureTaxonomyVersion",
  ];

  if (candidate.schemaName !== OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_NAME) {
    errors.push(`schemaName must be ${OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_NAME}`);
  }

  if (candidate.schemaVersion !== OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_VERSION}`);
  }

  for (const field of requiredStringFields) {
    if (!isNonEmptyString(candidate[field])) {
      errors.push(`${field} is required and must be a nonempty string`);
    }
  }

  if (!isOpenPraQuantumBackendFamily(candidate.backendFamily)) {
    errors.push(`backendFamily is not allowed: ${String(candidate.backendFamily)}`);
  }

  if (!isOpenPraQuantumBackendMode(candidate.backendMode)) {
    errors.push(`backendMode is not allowed: ${String(candidate.backendMode)}`);
  }

  if (
    isOpenPraQuantumBackendFamily(candidate.backendFamily) &&
    isOpenPraQuantumBackendMode(candidate.backendMode) &&
    !isAllowedOpenPraQuantumBackendModePair({
      backendFamily: candidate.backendFamily,
      backendMode: candidate.backendMode,
    })
  ) {
    errors.push(`backendFamily/backendMode pair is not allowed: ${candidate.backendFamily}/${candidate.backendMode}`);
  }

  validateSupportedInputShape(candidate.supportedInputShape, errors);

  if (!isPlainObject(candidate.provenanceBlock)) {
    errors.push("provenanceBlock must be a nonempty object");
  } else if (!hasAtLeastOneOwnKey(candidate.provenanceBlock)) {
    errors.push("provenanceBlock must be a nonempty object");
  }

  if (candidate.batchMetadata !== undefined) {
    if (!isPlainObject(candidate.batchMetadata)) {
      errors.push("batchMetadata must be an object when present");
    } else {
      warnings.push(
        "batchMetadata is orchestration metadata only and does not change the canonical prepared case unit",
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function assertOpenPraQuantumPreparedCase(candidate: unknown): asserts candidate is OpenPraQuantumPreparedCase {
  const validation = validateOpenPraQuantumPreparedCase(candidate);

  if (!validation.valid) {
    throw new Error(`Invalid OpenPRA quantum prepared case: ${validation.errors.join("; ")}`);
  }
}
