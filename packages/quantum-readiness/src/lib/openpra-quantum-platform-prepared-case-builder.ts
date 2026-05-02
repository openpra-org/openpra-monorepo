import {
  OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_NAME,
  OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_VERSION,
  OpenPraQuantumPreparedCase,
  OpenPraQuantumSupportedInputShape,
  assertOpenPraQuantumPreparedCase,
} from "./openpra-quantum-platform-prepared-case";
import {
  OPENPRA_QUANTUM_PROVENANCE_SCHEMA_VERSION,
  OpenPraQuantumEvidenceClass,
  OpenPraQuantumProvenanceBlock,
  assertOpenPraQuantumProvenanceBlock,
} from "./openpra-quantum-platform-provenance-failure";
import { OpenPraQuantumBackendFamily, OpenPraQuantumBackendMode } from "./openpra-quantum-platform-backend-mode";

export interface OpenPraQuantumPreparedCaseBuilderInput {
  sourceModelId: string;
  sourceModelPath: string;
  subtreeId: string;
  rootGateId: string;
  preparationToolVersion: string;
  backendFamily: OpenPraQuantumBackendFamily;
  backendMode: OpenPraQuantumBackendMode;
  encodingFamily: string;
  supportedInputShape: OpenPraQuantumSupportedInputShape;
  artifactRoot: string;
  submissionManifestPath: string;
  expectedResultSchema: string;
  failureTaxonomyVersion: string;
  generatedTimestampUtc: string;
  generatingTool: string;
  generatingToolVersion: string;
  inputArtifactPaths: string[];
  outputArtifactPaths: string[];
  evidenceClass: OpenPraQuantumEvidenceClass;
  repositoryRootIfAvailable?: string;
  gitBranchIfAvailable?: string;
  gitCommitIfAvailable?: string;
  hostNameIfAvailable?: string;
  userNameIfAvailable?: string;
  commandOrEntrypointIfAvailable?: string;
  sha256ManifestPathIfAvailable?: string;
  batchId?: string;
  batchPosition?: number;
  batchPolicyId?: string;
  boundednessStatement?: string;
}

export interface OpenPraQuantumPreparedCasePackage {
  preparedCase: OpenPraQuantumPreparedCase;
  provenanceBlock: OpenPraQuantumProvenanceBlock;
}

export const OPENPRA_QUANTUM_DEFAULT_PREPARED_CASE_BOUNDEDNESS_STATEMENT =
  "This prepared case is part of a bounded OpenPRA quantum workflow. It does not by itself establish comparative quantum performance, production readiness, or unrestricted downstream PRA validity.";

function sanitizeIdentifierPart(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildOpenPraQuantumPreparedCaseId(input: {
  subtreeId: string;
  rootGateId: string;
  backendFamily: OpenPraQuantumBackendFamily;
  backendMode: OpenPraQuantumBackendMode;
}): string {
  return [
    "prepared_case",
    sanitizeIdentifierPart(input.subtreeId),
    sanitizeIdentifierPart(input.rootGateId),
    sanitizeIdentifierPart(input.backendFamily),
    sanitizeIdentifierPart(input.backendMode),
    "v1",
  ].join("_");
}

export function buildOpenPraQuantumPreparedCasePackage(
  input: OpenPraQuantumPreparedCaseBuilderInput,
): OpenPraQuantumPreparedCasePackage {
  const boundednessStatement =
    input.boundednessStatement ?? OPENPRA_QUANTUM_DEFAULT_PREPARED_CASE_BOUNDEDNESS_STATEMENT;

  const provenanceBlock: OpenPraQuantumProvenanceBlock = {
    provenanceSchemaVersion: OPENPRA_QUANTUM_PROVENANCE_SCHEMA_VERSION,
    generatedTimestampUtc: input.generatedTimestampUtc,
    generatingTool: input.generatingTool,
    generatingToolVersion: input.generatingToolVersion,
    repositoryRootIfAvailable: input.repositoryRootIfAvailable,
    gitBranchIfAvailable: input.gitBranchIfAvailable,
    gitCommitIfAvailable: input.gitCommitIfAvailable,
    hostNameIfAvailable: input.hostNameIfAvailable,
    userNameIfAvailable: input.userNameIfAvailable,
    commandOrEntrypointIfAvailable: input.commandOrEntrypointIfAvailable,
    inputArtifactPaths: input.inputArtifactPaths,
    outputArtifactPaths: input.outputArtifactPaths,
    sha256ManifestPathIfAvailable: input.sha256ManifestPathIfAvailable,
    evidenceClass: input.evidenceClass,
    boundednessStatement,
  };

  assertOpenPraQuantumProvenanceBlock(provenanceBlock);

  const preparedCase: OpenPraQuantumPreparedCase = {
    schemaName: OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_NAME,
    schemaVersion: OPENPRA_QUANTUM_PREPARED_CASE_SCHEMA_VERSION,
    preparedCaseId: buildOpenPraQuantumPreparedCaseId({
      subtreeId: input.subtreeId,
      rootGateId: input.rootGateId,
      backendFamily: input.backendFamily,
      backendMode: input.backendMode,
    }),
    sourceModelId: input.sourceModelId,
    sourceModelPath: input.sourceModelPath,
    subtreeId: input.subtreeId,
    rootGateId: input.rootGateId,
    preparationTimestampUtc: input.generatedTimestampUtc,
    preparationToolVersion: input.preparationToolVersion,
    backendFamily: input.backendFamily,
    backendMode: input.backendMode,
    encodingFamily: input.encodingFamily,
    supportedInputShape: input.supportedInputShape,
    boundednessStatement,
    artifactRoot: input.artifactRoot,
    submissionManifestPath: input.submissionManifestPath,
    expectedResultSchema: input.expectedResultSchema,
    provenanceBlock: provenanceBlock as unknown as Record<string, unknown>,
    failureTaxonomyVersion: input.failureTaxonomyVersion,
    batchMetadata:
      input.batchId || input.batchPosition !== undefined || input.batchPolicyId ?
        {
          batchId: input.batchId,
          batchPosition: input.batchPosition,
          batchPolicyId: input.batchPolicyId,
        }
      : undefined,
  };

  assertOpenPraQuantumPreparedCase(preparedCase);

  return {
    preparedCase,
    provenanceBlock,
  };
}
