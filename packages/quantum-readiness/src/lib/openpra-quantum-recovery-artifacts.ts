import { buildQuantumRecoveryLadderResult } from "./quantum-recovery";
import type {
  QuantumRecoveryClassicalReferenceInput,
  QuantumRecoveryLadderResult,
  QuantumRecoveryRawCountsInput,
} from "./quantum-recovery";

export interface OpenpraQuantumRecoveryPackageMetadataArtifact {
  modelId?: string;
  model_id?: string;
  candidateRootNodeId?: string;
  candidate_root_node_id?: string;
  topologyClass?: string;
  topology_class?: string;
  basicEventCount?: number;
  basic_event_count?: number;
  requiredQubits?: number;
  required_qubits?: number;
}

export interface OpenpraQuantumRecoveryRawCountsArtifact {
  modelId?: string;
  model_id?: string;
  candidateRootNodeId?: string;
  candidate_root_node_id?: string;
  topologyClass?: string;
  topology_class?: string;
  basicEventCount?: number;
  basic_event_count?: number;
  requiredQubits?: number;
  required_qubits?: number;
  orderedBasicEventIds?: string[];
  ordered_basic_event_ids?: string[];
  bitstringConvention?: string;
  bitstring_convention?: string;
  counts: Record<string, number>;
  shotsTotal?: number;
  shots_total?: number;
  measurementBasis?: string;
  measurement_basis?: string;
  bitstringIndexConvention?: string;
  bitstring_index_convention?: string;
}

export interface OpenpraQuantumRecoveryFrozenMcsReferenceArtifact {
  minimalCutSetCount?: number;
  basicEventIdSets?: string[][];
  bitstrings?: string[];
}

export interface OpenpraQuantumRecoveryClassicalReferenceArtifact {
  modelId?: string;
  model_id?: string;
  candidateRootNodeId?: string;
  candidate_root_node_id?: string;
  frozenMcsReference?: OpenpraQuantumRecoveryFrozenMcsReferenceArtifact;
  frozen_mcs_reference?: OpenpraQuantumRecoveryFrozenMcsReferenceArtifact;
}

export interface OpenpraQuantumRecoveryArtifactBundle {
  rawCounts: OpenpraQuantumRecoveryRawCountsArtifact;
  classicalReferenceMcs: OpenpraQuantumRecoveryClassicalReferenceArtifact;
  packageMetadata?: OpenpraQuantumRecoveryPackageMetadataArtifact;
}

export interface OpenpraQuantumRecoveryArtifactNormalization {
  rawCountsInput: QuantumRecoveryRawCountsInput;
  classicalReferenceInput: QuantumRecoveryClassicalReferenceInput;
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function requireStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must be a string array.`);
  }

  return [...value];
}

function requireStringMatrix(value: unknown, fieldName: string): string[][] {
  if (
    !Array.isArray(value) ||
    value.some((row) => !Array.isArray(row) || row.some((item) => typeof item !== "string"))
  ) {
    throw new Error(`${fieldName} must be a matrix of strings.`);
  }

  return value.map((row) => [...row]);
}

function requireCountsRecord(value: unknown, fieldName: string): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object record of counts.`);
  }

  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new Error(`${fieldName}.${key} must be a finite number.`);
    }
    out[key] = raw;
  }

  return out;
}

function getModelId(
  value:
    | OpenpraQuantumRecoveryPackageMetadataArtifact
    | OpenpraQuantumRecoveryRawCountsArtifact
    | OpenpraQuantumRecoveryClassicalReferenceArtifact,
  fieldPrefix: string,
): string {
  return requireNonEmptyString(firstDefined(value.modelId, value.model_id), `${fieldPrefix}.modelId`);
}

function getCandidateRootNodeId(
  value:
    | OpenpraQuantumRecoveryPackageMetadataArtifact
    | OpenpraQuantumRecoveryRawCountsArtifact
    | OpenpraQuantumRecoveryClassicalReferenceArtifact,
  fieldPrefix: string,
): string {
  return requireNonEmptyString(
    firstDefined(value.candidateRootNodeId, value.candidate_root_node_id),
    `${fieldPrefix}.candidateRootNodeId`,
  );
}

function getTopologyClass(
  rawCounts: OpenpraQuantumRecoveryRawCountsArtifact,
  packageMetadata?: OpenpraQuantumRecoveryPackageMetadataArtifact,
): string | undefined {
  return firstDefined(
    optionalString(rawCounts.topologyClass),
    optionalString(rawCounts.topology_class),
    packageMetadata ? optionalString(packageMetadata.topologyClass) : undefined,
    packageMetadata ? optionalString(packageMetadata.topology_class) : undefined,
  );
}

function getBasicEventCount(
  rawCounts: OpenpraQuantumRecoveryRawCountsArtifact,
  packageMetadata?: OpenpraQuantumRecoveryPackageMetadataArtifact,
): number | undefined {
  return firstDefined(
    optionalFiniteNumber(rawCounts.basicEventCount),
    optionalFiniteNumber(rawCounts.basic_event_count),
    packageMetadata ? optionalFiniteNumber(packageMetadata.basicEventCount) : undefined,
    packageMetadata ? optionalFiniteNumber(packageMetadata.basic_event_count) : undefined,
  );
}

function getRequiredQubits(
  rawCounts: OpenpraQuantumRecoveryRawCountsArtifact,
  packageMetadata?: OpenpraQuantumRecoveryPackageMetadataArtifact,
): number | undefined {
  return firstDefined(
    optionalFiniteNumber(rawCounts.requiredQubits),
    optionalFiniteNumber(rawCounts.required_qubits),
    packageMetadata ? optionalFiniteNumber(packageMetadata.requiredQubits) : undefined,
    packageMetadata ? optionalFiniteNumber(packageMetadata.required_qubits) : undefined,
  );
}

function getFrozenMcsReference(artifact: OpenpraQuantumRecoveryClassicalReferenceArtifact): {
  minimalCutSetCount: number;
  basicEventIdSets: string[][];
  bitstrings: string[];
} {
  const frozen = firstDefined(artifact.frozenMcsReference, artifact.frozen_mcs_reference);

  if (!frozen || typeof frozen !== "object" || Array.isArray(frozen)) {
    throw new Error("classicalReferenceMcs.frozenMcsReference must be present.");
  }

  const minimalCutSetCount = optionalFiniteNumber(frozen.minimalCutSetCount);
  if (minimalCutSetCount === undefined) {
    throw new Error("classicalReferenceMcs.frozenMcsReference.minimalCutSetCount must be a finite number.");
  }

  const basicEventIdSets = requireStringMatrix(
    frozen.basicEventIdSets,
    "classicalReferenceMcs.frozenMcsReference.basicEventIdSets",
  );

  const bitstrings = requireStringArray(frozen.bitstrings, "classicalReferenceMcs.frozenMcsReference.bitstrings");

  return {
    minimalCutSetCount,
    basicEventIdSets,
    bitstrings,
  };
}

function validateMatchingIdentity(
  rawCounts: OpenpraQuantumRecoveryRawCountsArtifact,
  classicalReferenceMcs: OpenpraQuantumRecoveryClassicalReferenceArtifact,
  packageMetadata?: OpenpraQuantumRecoveryPackageMetadataArtifact,
): void {
  const rawCountsModelId = getModelId(rawCounts, "rawCounts");
  const rawCountsCandidateRootNodeId = getCandidateRootNodeId(rawCounts, "rawCounts");
  const classicalModelId = getModelId(classicalReferenceMcs, "classicalReferenceMcs");
  const classicalCandidateRootNodeId = getCandidateRootNodeId(classicalReferenceMcs, "classicalReferenceMcs");

  if (rawCountsModelId !== classicalModelId) {
    throw new Error(
      `Artifact modelId mismatch: rawCounts=${rawCountsModelId}, classicalReferenceMcs=${classicalModelId}.`,
    );
  }

  if (rawCountsCandidateRootNodeId !== classicalCandidateRootNodeId) {
    throw new Error(
      `Artifact candidateRootNodeId mismatch: rawCounts=${rawCountsCandidateRootNodeId}, classicalReferenceMcs=${classicalCandidateRootNodeId}.`,
    );
  }

  if (!packageMetadata) {
    return;
  }

  const packageModelId = getModelId(packageMetadata, "packageMetadata");
  const packageCandidateRootNodeId = getCandidateRootNodeId(packageMetadata, "packageMetadata");

  if (packageModelId !== rawCountsModelId) {
    throw new Error(`Artifact modelId mismatch: packageMetadata=${packageModelId}, rawCounts=${rawCountsModelId}.`);
  }

  if (packageCandidateRootNodeId !== rawCountsCandidateRootNodeId) {
    throw new Error(
      `Artifact candidateRootNodeId mismatch: packageMetadata=${packageCandidateRootNodeId}, rawCounts=${rawCountsCandidateRootNodeId}.`,
    );
  }
}

export function normalizeOpenpraQuantumRecoveryArtifacts(
  bundle: OpenpraQuantumRecoveryArtifactBundle,
): OpenpraQuantumRecoveryArtifactNormalization {
  validateMatchingIdentity(bundle.rawCounts, bundle.classicalReferenceMcs, bundle.packageMetadata);

  const rawCountsInput: QuantumRecoveryRawCountsInput = {
    modelId: getModelId(bundle.rawCounts, "rawCounts"),
    candidateRootNodeId: getCandidateRootNodeId(bundle.rawCounts, "rawCounts"),
    topologyClass: getTopologyClass(bundle.rawCounts, bundle.packageMetadata),
    basicEventCount: getBasicEventCount(bundle.rawCounts, bundle.packageMetadata),
    requiredQubits: getRequiredQubits(bundle.rawCounts, bundle.packageMetadata),
    orderedBasicEventIds: requireStringArray(
      firstDefined(bundle.rawCounts.orderedBasicEventIds, bundle.rawCounts.ordered_basic_event_ids),
      "rawCounts.orderedBasicEventIds",
    ),
    bitstringConvention: requireNonEmptyString(
      firstDefined(bundle.rawCounts.bitstringConvention, bundle.rawCounts.bitstring_convention),
      "rawCounts.bitstringConvention",
    ),
    counts: requireCountsRecord(bundle.rawCounts.counts, "rawCounts.counts"),
    shotsTotal: firstDefined(
      optionalFiniteNumber(bundle.rawCounts.shotsTotal),
      optionalFiniteNumber(bundle.rawCounts.shots_total),
    ),
    measurementBasis: firstDefined(
      optionalString(bundle.rawCounts.measurementBasis),
      optionalString(bundle.rawCounts.measurement_basis),
    ),
    bitstringIndexConvention: firstDefined(
      optionalString(bundle.rawCounts.bitstringIndexConvention),
      optionalString(bundle.rawCounts.bitstring_index_convention),
    ),
  };

  const frozenMcsReference = getFrozenMcsReference(bundle.classicalReferenceMcs);

  const classicalReferenceInput: QuantumRecoveryClassicalReferenceInput = {
    modelId: getModelId(bundle.classicalReferenceMcs, "classicalReferenceMcs"),
    candidateRootNodeId: getCandidateRootNodeId(bundle.classicalReferenceMcs, "classicalReferenceMcs"),
    frozenMcsReference: {
      minimalCutSetCount: frozenMcsReference.minimalCutSetCount,
      basicEventIdSets: frozenMcsReference.basicEventIdSets.map((row) => [...row]),
      bitstrings: [...frozenMcsReference.bitstrings],
    },
  };

  return {
    rawCountsInput,
    classicalReferenceInput,
  };
}

export function buildOpenpraQuantumRecoveryFromArtifacts(
  bundle: OpenpraQuantumRecoveryArtifactBundle,
): QuantumRecoveryLadderResult {
  const normalized = normalizeOpenpraQuantumRecoveryArtifacts(bundle);

  return buildQuantumRecoveryLadderResult(normalized.rawCountsInput, normalized.classicalReferenceInput);
}
