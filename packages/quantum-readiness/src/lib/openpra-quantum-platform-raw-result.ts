import {
  OpenPraQuantumBackendFamily,
  OpenPraQuantumBackendMode,
  isAllowedOpenPraQuantumBackendModePair,
  isOpenPraQuantumBackendFamily,
  isOpenPraQuantumBackendMode,
} from "./openpra-quantum-platform-backend-mode";

export const OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_NAME = "OPENPRA_QUANTUM_RAW_RESULT_SCHEMA";

export const OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_VERSION = "v1";

export const OPENPRA_QUANTUM_RAW_RESULT_EXECUTION_STATUSES = [
  "not_started",
  "submitted",
  "running",
  "completed",
  "completed_with_warning",
  "failed",
  "cancelled",
  "timed_out",
  "vendor_pending",
  "dry_run_completed",
  "fixture_completed",
] as const;

export type OpenPraQuantumRawResultExecutionStatus = (typeof OPENPRA_QUANTUM_RAW_RESULT_EXECUTION_STATUSES)[number];

export const OPENPRA_QUANTUM_RAW_RESULT_PARSER_STATUSES = [
  "not_started",
  "parsed",
  "parsed_with_warning",
  "parse_failed",
  "parser_not_applicable",
  "fixture_parsed",
] as const;

export type OpenPraQuantumRawResultParserStatus = (typeof OPENPRA_QUANTUM_RAW_RESULT_PARSER_STATUSES)[number];

export interface OpenPraQuantumRawResult {
  schemaName: typeof OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_NAME;
  schemaVersion: typeof OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_VERSION;
  rawResultId: string;
  preparedCaseId: string;
  backendSubmissionId: string;
  backendFamily: OpenPraQuantumBackendFamily;
  backendMode: OpenPraQuantumBackendMode;
  executionStatus: OpenPraQuantumRawResultExecutionStatus;
  parserStatus: OpenPraQuantumRawResultParserStatus;
  returnedArtifactRoot: string;
  returnedProvenanceBlock: Record<string, unknown>;
  canonicalRecoveryEntrypointTarget: string;
  boundednessStatement: string;
  backendRawPayload?: Record<string, unknown>;
}

export interface OpenPraQuantumRawResultValidationResult {
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

export function isOpenPraQuantumRawResultExecutionStatus(
  value: unknown,
): value is OpenPraQuantumRawResultExecutionStatus {
  return (
    typeof value === "string" && (OPENPRA_QUANTUM_RAW_RESULT_EXECUTION_STATUSES as readonly string[]).includes(value)
  );
}

export function isOpenPraQuantumRawResultParserStatus(value: unknown): value is OpenPraQuantumRawResultParserStatus {
  return typeof value === "string" && (OPENPRA_QUANTUM_RAW_RESULT_PARSER_STATUSES as readonly string[]).includes(value);
}

export function validateOpenPraQuantumRawResult(candidate: unknown): OpenPraQuantumRawResultValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(candidate)) {
    return {
      valid: false,
      errors: ["raw result must be an object"],
      warnings,
    };
  }

  if (candidate.schemaName !== OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_NAME) {
    errors.push(`schemaName must be ${OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_NAME}`);
  }

  if (candidate.schemaVersion !== OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${OPENPRA_QUANTUM_RAW_RESULT_SCHEMA_VERSION}`);
  }

  const requiredStringFields = [
    "rawResultId",
    "preparedCaseId",
    "backendSubmissionId",
    "returnedArtifactRoot",
    "canonicalRecoveryEntrypointTarget",
    "boundednessStatement",
  ];

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

  if (!isOpenPraQuantumRawResultExecutionStatus(candidate.executionStatus)) {
    errors.push(`executionStatus is not allowed: ${String(candidate.executionStatus)}`);
  }

  if (!isOpenPraQuantumRawResultParserStatus(candidate.parserStatus)) {
    errors.push(`parserStatus is not allowed: ${String(candidate.parserStatus)}`);
  }

  if (!isPlainObject(candidate.returnedProvenanceBlock)) {
    errors.push("returnedProvenanceBlock must be a nonempty object");
  } else if (!hasAtLeastOneOwnKey(candidate.returnedProvenanceBlock)) {
    errors.push("returnedProvenanceBlock must be a nonempty object");
  }

  if (candidate.backendRawPayload !== undefined) {
    if (!isPlainObject(candidate.backendRawPayload)) {
      errors.push("backendRawPayload must be an object when present");
    } else {
      warnings.push("backendRawPayload is backend specific and is not an authoritative recovery classification");
    }
  }

  if (candidate.executionStatus === "completed" && candidate.parserStatus === "not_started") {
    warnings.push("execution completed but parser has not started; canonical recovery cannot proceed yet");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function assertOpenPraQuantumRawResult(candidate: unknown): asserts candidate is OpenPraQuantumRawResult {
  const validation = validateOpenPraQuantumRawResult(candidate);

  if (!validation.valid) {
    throw new Error(`Invalid OpenPRA quantum raw result: ${validation.errors.join("; ")}`);
  }
}
