import type {
  QuantumClQuboStatevectorVerificationPlan,
  QuantumPreparationClQuboCandidateExport,
  QuantumPreparationClQuboExport,
  QuantumReadinessRequirementsAssessment,
  QuantumReadinessTopologyClassification,
} from "./types";

const SCHEMA_VERSION = "1.0.0";
const MODULE_VERSION = "openpra-quantum-preparation-artifacts-v1";

type CandidateWithRecipe = QuantumPreparationClQuboCandidateExport & {
  qaoaCircuitRecipe?: unknown;
};

export interface OpenpraQuantumPreparationArtifactBuildOptions {
  artifactId?: string;
  createdBy?: string;
  inputReferences?: string[];
  sourceHashes?: Record<string, string>;
  notes?: string[];
}

export interface OpenpraQuantumPreparationBackendEligibilityRow {
  platformId: string;
  platformLabel: string;
  publishedQubitCount: number;
  qubitFit: boolean;
  caveat: string;
}

export interface OpenpraQuantumPreparationArtifact {
  schemaVersion: string;
  artifactType: "preparation";
  artifactId: string;
  createdAtUtc: string;
  createdBy: string;
  inputReferences: string[];
  sourceHashes: Record<string, string>;
  notes: string[];

  modelId: string;
  modelName: string;
  sourceFormat: string;
  subtreeId: string;
  rootGateId: string;
  topologyClass: string;

  orderedBasicEventIds: string[];
  variableMap: QuantumPreparationClQuboCandidateExport["variableMapping"];
  clQuboEncoding: {
    exportSliceVersion: string;
    costMatrix: QuantumPreparationClQuboCandidateExport["costMatrix"];
    frozenMcsReference: QuantumPreparationClQuboCandidateExport["frozenMcsReference"];
    fullClQuboModel?: QuantumPreparationClQuboCandidateExport["fullClQuboModel"];
  };
  qaoaRecipe?: unknown;
  backendEligibility: OpenpraQuantumPreparationBackendEligibilityRow[];
  statevectorVerificationResult: QuantumClQuboStatevectorVerificationPlan;

  topologyClassification?: QuantumReadinessTopologyClassification;
  requirementsAssessment?: QuantumReadinessRequirementsAssessment;

  moduleVersion: string;
}

export interface OpenpraQuantumPreparationArtifactBundle {
  schemaVersion: string;
  artifactType: "preparation_bundle";
  artifactId: string;
  createdAtUtc: string;
  createdBy: string;
  inputReferences: string[];
  sourceHashes: Record<string, string>;
  notes: string[];

  modelId: string;
  modelName: string;
  sourceFormat: string;
  totalCandidateSubtrees: number;
  totalQuantumTractableCandidates: number;

  preparationArtifacts: OpenpraQuantumPreparationArtifact[];
}

export function buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(
  clQuboExport: QuantumPreparationClQuboExport,
  options: OpenpraQuantumPreparationArtifactBuildOptions = {},
): OpenpraQuantumPreparationArtifactBundle {
  const createdAtUtc = new Date().toISOString();
  const createdBy = options.createdBy ?? MODULE_VERSION;
  const bundleArtifactId = options.artifactId ?? buildBundleArtifactId(clQuboExport.modelId, createdAtUtc);

  return {
    schemaVersion: SCHEMA_VERSION,
    artifactType: "preparation_bundle",
    artifactId: bundleArtifactId,
    createdAtUtc,
    createdBy,
    inputReferences: [...(options.inputReferences ?? [])],
    sourceHashes: { ...(options.sourceHashes ?? {}) },
    notes: [...(options.notes ?? [])],

    modelId: clQuboExport.modelId,
    modelName: clQuboExport.modelName,
    sourceFormat: clQuboExport.sourceFormat,
    totalCandidateSubtrees: clQuboExport.totalCandidateSubtrees,
    totalQuantumTractableCandidates: clQuboExport.totalQuantumTractableCandidates,

    preparationArtifacts: clQuboExport.clQuboCandidates
      .map((candidate) =>
        buildOpenpraQuantumPreparationArtifactFromCandidate(candidate, createdAtUtc, createdBy, options),
      )
      .sort((left, right) => left.rootGateId.localeCompare(right.rootGateId)),
  };
}

export function buildOpenpraQuantumPreparationArtifactFromCandidate(
  candidate: QuantumPreparationClQuboCandidateExport,
  createdAtUtc: string = new Date().toISOString(),
  createdBy: string = MODULE_VERSION,
  options: OpenpraQuantumPreparationArtifactBuildOptions = {},
): OpenpraQuantumPreparationArtifact {
  const typedCandidate = candidate as CandidateWithRecipe;

  return {
    schemaVersion: SCHEMA_VERSION,
    artifactType: "preparation",
    artifactId: buildCandidateArtifactId(candidate.modelId, candidate.candidateRootNodeId, createdAtUtc),
    createdAtUtc,
    createdBy,
    inputReferences: [...(options.inputReferences ?? [])],
    sourceHashes: { ...(options.sourceHashes ?? {}) },
    notes: [...(options.notes ?? [])],

    modelId: candidate.modelId,
    modelName: candidate.modelName,
    sourceFormat: candidate.sourceFormat,
    subtreeId: candidate.candidateRootNodeId,
    rootGateId: candidate.candidateRootNodeId,
    topologyClass: candidate.topologyClassification?.topologyClass ?? "unclassified",

    orderedBasicEventIds: [...candidate.orderedBasicEventIds],
    variableMap: candidate.variableMapping.map((row) => ({ ...row })),
    clQuboEncoding: {
      exportSliceVersion: candidate.exportSliceVersion,
      costMatrix: {
        format: candidate.costMatrix.format,
        dimension: candidate.costMatrix.dimension,
        diagonalWeights: [...candidate.costMatrix.diagonalWeights],
        objective: candidate.costMatrix.objective,
      },
      frozenMcsReference: {
        minimalCutSetCount: candidate.frozenMcsReference.minimalCutSetCount,
        basicEventIdSets: candidate.frozenMcsReference.basicEventIdSets.map((set) => [...set]),
        bitstrings: [...candidate.frozenMcsReference.bitstrings],
      },
      ...(candidate.fullClQuboModel ?
        {
          fullClQuboModel: {
            ...candidate.fullClQuboModel,
            vars: candidate.fullClQuboModel.vars.map((row) => ({ ...row })),
            qubo: {
              const: candidate.fullClQuboModel.qubo.const,
              lin: { ...candidate.fullClQuboModel.qubo.lin },
              quad: { ...candidate.fullClQuboModel.qubo.quad },
            },
            ising: {
              const: candidate.fullClQuboModel.ising.const,
              h: { ...candidate.fullClQuboModel.ising.h },
              J: { ...candidate.fullClQuboModel.ising.J },
            },
          },
        }
      : {}),
    },
    ...(typedCandidate.qaoaCircuitRecipe ?
      {
        qaoaRecipe: typedCandidate.qaoaCircuitRecipe,
      }
    : {}),
    backendEligibility:
      candidate.requirementsAssessment ?
        candidate.requirementsAssessment.hardwareCompatibility.map((row) => ({
          platformId: row.platformId,
          platformLabel: row.platformLabel,
          publishedQubitCount: row.publishedQubitCount,
          qubitFit: row.qubitFit,
          caveat: row.caveat,
        }))
      : [],
    statevectorVerificationResult: {
      eligible: candidate.statevectorVerificationPlan.eligible,
      mode: candidate.statevectorVerificationPlan.mode,
      note: candidate.statevectorVerificationPlan.note,
    },

    ...(candidate.topologyClassification ?
      {
        topologyClassification: {
          topologyClass: candidate.topologyClassification.topologyClass,
          classificationRuleVersion: candidate.topologyClassification.classificationRuleVersion,
          reasons: [...candidate.topologyClassification.reasons],
          rootChildNodeIds: [...candidate.topologyClassification.rootChildNodeIds],
          rootChildBasicEventCount: candidate.topologyClassification.rootChildBasicEventCount,
          rootChildAndGateCount: candidate.topologyClassification.rootChildAndGateCount,
          rootChildOrGateCount: candidate.topologyClassification.rootChildOrGateCount,
          rootChildOtherGateCount: candidate.topologyClassification.rootChildOtherGateCount,
        },
      }
    : {}),
    ...(candidate.requirementsAssessment ?
      {
        requirementsAssessment: {
          requiredQubits: candidate.requirementsAssessment.requiredQubits,
          matrixEntryMatched: candidate.requirementsAssessment.matrixEntryMatched,
          ...(candidate.requirementsAssessment.matrixEntry ?
            {
              matrixEntry: { ...candidate.requirementsAssessment.matrixEntry },
            }
          : {}),
          hardwareCompatibility: candidate.requirementsAssessment.hardwareCompatibility.map((row) => ({
            ...row,
          })),
          preferredDepthP: candidate.requirementsAssessment.preferredDepthP,
          avoidRL1: candidate.requirementsAssessment.avoidRL1,
          preferredAlgorithm: candidate.requirementsAssessment.preferredAlgorithm,
          executionPriority: candidate.requirementsAssessment.executionPriority,
          guidanceNotes: [...candidate.requirementsAssessment.guidanceNotes],
        },
      }
    : {}),
    moduleVersion: candidate.moduleVersion,
  };
}

function buildBundleArtifactId(modelId: string, createdAtUtc: string): string {
  return `preparation_bundle:${sanitizeToken(modelId)}:${sanitizeToken(createdAtUtc)}`;
}

function buildCandidateArtifactId(modelId: string, candidateRootNodeId: string, createdAtUtc: string): string {
  return `preparation:${sanitizeToken(modelId)}:${sanitizeToken(candidateRootNodeId)}:${sanitizeToken(createdAtUtc)}`;
}

function sanitizeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
