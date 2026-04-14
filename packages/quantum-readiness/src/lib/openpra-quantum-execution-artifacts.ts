export type OpenpraQuantumExecutionProviderType = "simulator" | "emulator" | "real_hardware";

export interface OpenpraQuantumExecutionArtifactBuildOptions {
  artifactId?: string;
  createdBy?: string;
  submittedAtUtc?: string;
  completedAtUtc?: string;
  inputReferences?: string[];
  sourceHashes?: Record<string, string>;
  notes?: string[];
}

export interface OpenpraQuantumExecutionRawCountsInput {
  modelId: string;
  subtreeId: string;
  sourcePreparationArtifactId: string;
  providerType: OpenpraQuantumExecutionProviderType;
  providerName: string;
  backendName: string;
  executionMode: string;
  shots: number;
  rawCounts: Record<string, number>;
  jobIdOrRunId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface OpenpraQuantumExecutionArtifact {
  schemaVersion: string;
  artifactType: "execution";
  artifactId: string;
  createdAtUtc: string;
  createdBy: string;
  inputReferences: string[];
  sourceHashes: Record<string, string>;
  notes: string[];

  modelId: string;
  subtreeId: string;
  sourcePreparationArtifactId: string;
  providerType: OpenpraQuantumExecutionProviderType;
  providerName: string;
  backendName: string;
  executionMode: string;
  jobIdOrRunId: string;
  status: string;
  shots: number;
  submittedAtUtc: string;
  completedAtUtc: string;
  rawCounts: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface OpenpraQuantumProvenanceManifest {
  schemaVersion: string;
  artifactType: "provenance_manifest";
  artifactId: string;
  createdAtUtc: string;
  createdBy: string;
  inputReferences: string[];
  sourceHashes: Record<string, string>;
  notes: string[];

  workflowInstanceId: string;
  relatedArtifactIds: string[];
  scriptOrPackageVersions: Record<string, string>;
  timestamps: {
    createdAtUtc: string;
    submittedAtUtc: string;
    completedAtUtc: string;
  };
  acceptanceGateResults: Record<string, boolean | string | number>;
}

export interface OpenpraQuantumExecutionArtifactBundle {
  executionArtifact: OpenpraQuantumExecutionArtifact;
  provenanceManifest: OpenpraQuantumProvenanceManifest;
}

const SCHEMA_VERSION = "1.0.0";
const MODULE_VERSION = "openpra-quantum-execution-artifacts-v1";

export function buildOpenpraQuantumExecutionArtifactBundleFromRawCounts(
  input: OpenpraQuantumExecutionRawCountsInput,
  options: OpenpraQuantumExecutionArtifactBuildOptions = {},
): OpenpraQuantumExecutionArtifactBundle {
  const createdAtUtc = new Date().toISOString();
  const submittedAtUtc = options.submittedAtUtc ?? createdAtUtc;
  const completedAtUtc = options.completedAtUtc ?? createdAtUtc;
  const createdBy = options.createdBy ?? MODULE_VERSION;

  const artifactId = options.artifactId ?? buildExecutionArtifactId(input.modelId, input.subtreeId, createdAtUtc);

  const executionArtifact: OpenpraQuantumExecutionArtifact = {
    schemaVersion: SCHEMA_VERSION,
    artifactType: "execution",
    artifactId,
    createdAtUtc,
    createdBy,
    inputReferences: [...(options.inputReferences ?? [])],
    sourceHashes: { ...(options.sourceHashes ?? {}) },
    notes: [...(options.notes ?? [])],

    modelId: input.modelId,
    subtreeId: input.subtreeId,
    sourcePreparationArtifactId: input.sourcePreparationArtifactId,
    providerType: input.providerType,
    providerName: input.providerName,
    backendName: input.backendName,
    executionMode: input.executionMode,
    jobIdOrRunId:
      input.jobIdOrRunId ??
      `run:${sanitizeToken(input.modelId)}:${sanitizeToken(input.subtreeId)}:${sanitizeToken(createdAtUtc)}`,
    status: input.status ?? "completed",
    shots: input.shots,
    submittedAtUtc,
    completedAtUtc,
    rawCounts: cloneRawCounts(input.rawCounts),
    ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
  };

  const provenanceManifest: OpenpraQuantumProvenanceManifest = {
    schemaVersion: SCHEMA_VERSION,
    artifactType: "provenance_manifest",
    artifactId: buildProvenanceArtifactId(input.modelId, input.subtreeId, createdAtUtc),
    createdAtUtc,
    createdBy,
    inputReferences: [...(options.inputReferences ?? [])],
    sourceHashes: { ...(options.sourceHashes ?? {}) },
    notes: [...(options.notes ?? [])],

    workflowInstanceId: buildWorkflowInstanceId(input.modelId, input.subtreeId, createdAtUtc),
    relatedArtifactIds: [executionArtifact.artifactId, input.sourcePreparationArtifactId],
    scriptOrPackageVersions: {
      quantumReadinessExecutionArtifacts: MODULE_VERSION,
    },
    timestamps: {
      createdAtUtc,
      submittedAtUtc,
      completedAtUtc,
    },
    acceptanceGateResults: {
      hasPreparationArtifactReference: input.sourcePreparationArtifactId.length > 0,
      hasRawCounts: Object.keys(input.rawCounts).length > 0,
      shotsMatchRawCountsTotal: sumCounts(input.rawCounts) === input.shots,
    },
  };

  return {
    executionArtifact,
    provenanceManifest,
  };
}

function cloneRawCounts(rawCounts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(rawCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bitstring, count]) => [bitstring, count]),
  );
}

function sumCounts(rawCounts: Record<string, number>): number {
  return Object.values(rawCounts).reduce((sum, value) => sum + value, 0);
}

function buildExecutionArtifactId(modelId: string, subtreeId: string, createdAtUtc: string): string {
  return `execution:${sanitizeToken(modelId)}:${sanitizeToken(subtreeId)}:${sanitizeToken(createdAtUtc)}`;
}

function buildProvenanceArtifactId(modelId: string, subtreeId: string, createdAtUtc: string): string {
  return `provenance:${sanitizeToken(modelId)}:${sanitizeToken(subtreeId)}:${sanitizeToken(createdAtUtc)}`;
}

function buildWorkflowInstanceId(modelId: string, subtreeId: string, createdAtUtc: string): string {
  return `workflow:${sanitizeToken(modelId)}:${sanitizeToken(subtreeId)}:${sanitizeToken(createdAtUtc)}`;
}

function sanitizeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
