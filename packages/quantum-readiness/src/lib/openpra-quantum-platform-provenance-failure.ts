export const OPENPRA_QUANTUM_PROVENANCE_SCHEMA_VERSION = "v1";
export const OPENPRA_QUANTUM_FAILURE_TAXONOMY_VERSION = "v1";

export const OPENPRA_QUANTUM_EVIDENCE_CLASSES = [
  "inherited_ibm_hardware_authoritative",
  "platform_ibm_hardware_new",
  "local_gate_validation",
  "local_exact_validation",
  "annealing_fixture",
  "annealing_hardware_future",
  "rest_service_evidence",
  "frontend_rendered_evidence",
  "diagnostic_evidence",
  "dry_run_evidence",
] as const;

export type OpenPraQuantumEvidenceClass = (typeof OPENPRA_QUANTUM_EVIDENCE_CLASSES)[number];

export const OPENPRA_QUANTUM_FAILURE_CATEGORIES = [
  "preparation_failure",
  "eligibility_failure",
  "encoding_failure",
  "submission_failure",
  "backend_execution_failure",
  "backend_timeout",
  "result_retrieval_failure",
  "parser_failure",
  "recovery_failure",
  "provenance_failure",
  "boundedness_failure",
  "downstream_consumption_failure",
  "validation_failure",
  "unknown_failure",
] as const;

export type OpenPraQuantumFailureCategory = (typeof OPENPRA_QUANTUM_FAILURE_CATEGORIES)[number];

export interface OpenPraQuantumProvenanceBlock {
  provenanceSchemaVersion: typeof OPENPRA_QUANTUM_PROVENANCE_SCHEMA_VERSION;
  generatedTimestampUtc: string;
  generatingTool: string;
  generatingToolVersion: string;
  repositoryRootIfAvailable?: string;
  gitBranchIfAvailable?: string;
  gitCommitIfAvailable?: string;
  hostNameIfAvailable?: string;
  userNameIfAvailable?: string;
  commandOrEntrypointIfAvailable?: string;
  inputArtifactPaths: string[];
  outputArtifactPaths: string[];
  sha256ManifestPathIfAvailable?: string;
  evidenceClass: OpenPraQuantumEvidenceClass;
  boundednessStatement: string;
}

export interface OpenPraQuantumFailureRecord {
  failureId: string;
  failureTaxonomyVersion: typeof OPENPRA_QUANTUM_FAILURE_TAXONOMY_VERSION;
  failureCategory: OpenPraQuantumFailureCategory;
  failureStage: string;
  preparedCaseIdIfAvailable?: string;
  rawResultIdIfAvailable?: string;
  backendFamilyIfAvailable?: string;
  backendModeIfAvailable?: string;
  timestampUtc: string;
  shortMessage: string;
  detailedMessageIfAvailable?: string;
  recoverable: boolean;
  retryRecommended: boolean;
  operatorAttentionRequired: boolean;
  artifactPathsIfAvailable?: string[];
}

export interface OpenPraQuantumValidationResult {
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isOpenPraQuantumEvidenceClass(value: unknown): value is OpenPraQuantumEvidenceClass {
  return typeof value === "string" && (OPENPRA_QUANTUM_EVIDENCE_CLASSES as readonly string[]).includes(value);
}

export function isOpenPraQuantumFailureCategory(value: unknown): value is OpenPraQuantumFailureCategory {
  return typeof value === "string" && (OPENPRA_QUANTUM_FAILURE_CATEGORIES as readonly string[]).includes(value);
}

export function validateOpenPraQuantumProvenanceBlock(candidate: unknown): OpenPraQuantumValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(candidate)) {
    return {
      valid: false,
      errors: ["provenance block must be an object"],
      warnings,
    };
  }

  if (candidate.provenanceSchemaVersion !== OPENPRA_QUANTUM_PROVENANCE_SCHEMA_VERSION) {
    errors.push(`provenanceSchemaVersion must be ${OPENPRA_QUANTUM_PROVENANCE_SCHEMA_VERSION}`);
  }

  const requiredStringFields = [
    "generatedTimestampUtc",
    "generatingTool",
    "generatingToolVersion",
    "boundednessStatement",
  ];

  for (const field of requiredStringFields) {
    if (!isNonEmptyString(candidate[field])) {
      errors.push(`${field} is required and must be a nonempty string`);
    }
  }

  if (!isStringArray(candidate.inputArtifactPaths)) {
    errors.push("inputArtifactPaths must be an array of strings");
  }

  if (!isStringArray(candidate.outputArtifactPaths)) {
    errors.push("outputArtifactPaths must be an array of strings");
  }

  if (!isOpenPraQuantumEvidenceClass(candidate.evidenceClass)) {
    errors.push(`evidenceClass is not allowed: ${String(candidate.evidenceClass)}`);
  }

  if (candidate.evidenceClass === "frontend_rendered_evidence") {
    warnings.push("frontend rendered evidence must not be treated as canonical recovery evidence");
  }

  if (candidate.evidenceClass === "local_exact_validation") {
    warnings.push("local exact validation evidence must not be described as hardware execution");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateOpenPraQuantumFailureRecord(candidate: unknown): OpenPraQuantumValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(candidate)) {
    return {
      valid: false,
      errors: ["failure record must be an object"],
      warnings,
    };
  }

  if (candidate.failureTaxonomyVersion !== OPENPRA_QUANTUM_FAILURE_TAXONOMY_VERSION) {
    errors.push(`failureTaxonomyVersion must be ${OPENPRA_QUANTUM_FAILURE_TAXONOMY_VERSION}`);
  }

  const requiredStringFields = ["failureId", "failureStage", "timestampUtc", "shortMessage"];

  for (const field of requiredStringFields) {
    if (!isNonEmptyString(candidate[field])) {
      errors.push(`${field} is required and must be a nonempty string`);
    }
  }

  if (!isOpenPraQuantumFailureCategory(candidate.failureCategory)) {
    errors.push(`failureCategory is not allowed: ${String(candidate.failureCategory)}`);
  }

  for (const field of ["recoverable", "retryRecommended", "operatorAttentionRequired"]) {
    if (typeof candidate[field] !== "boolean") {
      errors.push(`${field} must be boolean`);
    }
  }

  if (candidate.failureCategory === "boundedness_failure" && candidate.operatorAttentionRequired !== true) {
    errors.push("boundedness_failure must set operatorAttentionRequired to true");
  }

  if (candidate.failureCategory === "provenance_failure" && candidate.recoverable === true) {
    warnings.push("provenance_failure marked recoverable; verify that evidence chain remains defensible");
  }

  if (candidate.artifactPathsIfAvailable !== undefined && !isStringArray(candidate.artifactPathsIfAvailable)) {
    errors.push("artifactPathsIfAvailable must be an array of strings when present");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function assertOpenPraQuantumProvenanceBlock(
  candidate: unknown,
): asserts candidate is OpenPraQuantumProvenanceBlock {
  const validation = validateOpenPraQuantumProvenanceBlock(candidate);

  if (!validation.valid) {
    throw new Error(`Invalid OpenPRA quantum provenance block: ${validation.errors.join("; ")}`);
  }
}

export function assertOpenPraQuantumFailureRecord(
  candidate: unknown,
): asserts candidate is OpenPraQuantumFailureRecord {
  const validation = validateOpenPraQuantumFailureRecord(candidate);

  if (!validation.valid) {
    throw new Error(`Invalid OpenPRA quantum failure record: ${validation.errors.join("; ")}`);
  }
}
