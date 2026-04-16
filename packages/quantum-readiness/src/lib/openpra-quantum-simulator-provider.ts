import type { OpenpraQuantumExecutionRawCountsInput } from "./openpra-quantum-execution-artifacts";
import type { OpenpraQuantumPreparationArtifact } from "./openpra-quantum-preparation-artifacts";

export type OpenpraQuantumLocalSimulatorSamplingMode = "synthetic_exact_mcs" | "synthetic_feasible_uniform";

export type OpenpraQuantumLocalSimulatorParameterSource = "artifact_default" | "explicit" | "validated_checkpoint";

export interface OpenpraQuantumSimulatorProviderRequest {
  preparationArtifact: OpenpraQuantumPreparationArtifact;
  shots: number;
  samplingMode?: OpenpraQuantumLocalSimulatorSamplingMode;
  providerName?: string;
  backendName?: string;
  executionMode?: string;
  jobIdOrRunId?: string;
  status?: string;
  parameterSource?: OpenpraQuantumLocalSimulatorParameterSource;
  beta?: number;
  gamma?: number;
  seed?: number;
  metadata?: Record<string, unknown>;
  notes?: string[];
}

export interface OpenpraQuantumSimulatorProviderResult {
  executionInput: OpenpraQuantumExecutionRawCountsInput;
  simulatorMetadata: {
    samplingMode: OpenpraQuantumLocalSimulatorSamplingMode;
    bitstringSupport: string[];
    supportCount: number;
    parameterSource: OpenpraQuantumLocalSimulatorParameterSource;
    beta: number | null;
    gamma: number | null;
    deterministicAllocator: "largest_remainder";
    seed: number | null;
    notes: string[];
  };
}

const DEFAULT_PROVIDER_NAME = "openpra_local_bounded_simulator_v1";
const DEFAULT_BACKEND_NAME = "bounded_synthetic_sampler";
const DEFAULT_EXECUTION_MODE = "simulator_local_bounded";

export function buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator(
  request: OpenpraQuantumSimulatorProviderRequest,
): OpenpraQuantumSimulatorProviderResult {
  const preparationArtifact = request.preparationArtifact;
  const samplingMode = request.samplingMode ?? "synthetic_exact_mcs";
  const parameterSource = request.parameterSource ?? "artifact_default";

  assertPreparationArtifact(preparationArtifact);
  assertShots(request.shots);

  const artifactDefaults = extractArtifactParameterDefaults(preparationArtifact.qaoaRecipe);
  const resolvedParameters = resolveParameters(parameterSource, artifactDefaults, request.beta, request.gamma);
  const bitstringSupport = resolveBitstringSupport(preparationArtifact, samplingMode);
  const rawCounts = allocateUniformCounts(bitstringSupport, request.shots);

  const simulatorNotes = [
    ...(request.notes ?? []).map((value) => value.trim()).filter((value) => value.length > 0),
    samplingMode === "synthetic_exact_mcs" ?
      "Synthetic local simulator allocated shots only across frozen reference MCS bitstrings."
    : "Synthetic local simulator allocated shots uniformly across the bounded feasible basis state support.",
    parameterSource === "artifact_default" ?
      "Parameter provenance used artifact defaults when present."
    : `Parameter provenance labeled as ${parameterSource}.`,
  ];

  const simulatorMetadata = {
    samplingMode,
    bitstringSupport: [...bitstringSupport],
    supportCount: bitstringSupport.length,
    parameterSource,
    beta: resolvedParameters.beta,
    gamma: resolvedParameters.gamma,
    deterministicAllocator: "largest_remainder" as const,
    seed: request.seed ?? null,
    notes: simulatorNotes,
  };

  return {
    executionInput: {
      modelId: preparationArtifact.modelId,
      subtreeId: preparationArtifact.subtreeId,
      sourcePreparationArtifactId: preparationArtifact.artifactId,
      providerType: "simulator",
      providerName: request.providerName ?? DEFAULT_PROVIDER_NAME,
      backendName: request.backendName ?? DEFAULT_BACKEND_NAME,
      executionMode: request.executionMode ?? DEFAULT_EXECUTION_MODE,
      shots: request.shots,
      rawCounts,
      ...(request.jobIdOrRunId ? { jobIdOrRunId: request.jobIdOrRunId } : {}),
      ...(request.status ? { status: request.status } : { status: "completed" }),
      metadata: {
        ...(request.metadata ?? {}),
        simulatorMetadata,
      },
    },
    simulatorMetadata,
  };
}

function assertPreparationArtifact(preparationArtifact: OpenpraQuantumPreparationArtifact): void {
  if (!preparationArtifact || preparationArtifact.artifactType !== "preparation") {
    throw new Error("A preparation artifact is required.");
  }

  if (!preparationArtifact.artifactId || preparationArtifact.artifactId.trim().length === 0) {
    throw new Error("Preparation artifact must include a non empty artifactId.");
  }

  if (!preparationArtifact.subtreeId || preparationArtifact.subtreeId.trim().length === 0) {
    throw new Error("Preparation artifact must include a non empty subtreeId.");
  }
}

function assertShots(shots: number): void {
  if (!Number.isInteger(shots) || shots <= 0) {
    throw new Error("shots must be a positive integer.");
  }
}

function resolveParameters(
  parameterSource: OpenpraQuantumLocalSimulatorParameterSource,
  artifactDefaults: { beta: number | null; gamma: number | null },
  beta?: number,
  gamma?: number,
): { beta: number | null; gamma: number | null } {
  if (parameterSource === "artifact_default") {
    return artifactDefaults;
  }

  if (typeof beta !== "number" || Number.isNaN(beta) || typeof gamma !== "number" || Number.isNaN(gamma)) {
    throw new Error(`parameterSource ${parameterSource} requires explicit numeric beta and gamma values.`);
  }

  return { beta, gamma };
}

function resolveBitstringSupport(
  preparationArtifact: OpenpraQuantumPreparationArtifact,
  samplingMode: OpenpraQuantumLocalSimulatorSamplingMode,
): string[] {
  const frozenMcsBitstrings = uniqueSortedBitstrings(preparationArtifact.clQuboEncoding.frozenMcsReference.bitstrings);

  if (samplingMode === "synthetic_exact_mcs") {
    if (frozenMcsBitstrings.length === 0) {
      throw new Error("Preparation artifact does not contain frozen MCS reference bitstrings.");
    }

    return frozenMcsBitstrings;
  }

  const feasibleFromInitialState = extractStringArray(preparationArtifact.qaoaRecipe, [
    "initialState",
    "feasibleBasisStateBitstrings",
  ]);
  const feasibleFromMixer = extractStringArray(preparationArtifact.qaoaRecipe, [
    "mixer",
    "feasibleBasisStateBitstrings",
  ]);
  const feasibleSupport = uniqueSortedBitstrings([...feasibleFromInitialState, ...feasibleFromMixer]);

  if (feasibleSupport.length > 0) {
    return feasibleSupport;
  }

  if (frozenMcsBitstrings.length > 0) {
    return frozenMcsBitstrings;
  }

  throw new Error("Preparation artifact does not contain feasible basis state support or frozen MCS bitstrings.");
}

function allocateUniformCounts(bitstringSupport: string[], shots: number): Record<string, number> {
  const support = uniqueSortedBitstrings(bitstringSupport);

  if (support.length === 0) {
    throw new Error("Bitstring support cannot be empty.");
  }

  const baseCount = Math.floor(shots / support.length);
  const remainder = shots % support.length;

  return Object.fromEntries(
    support.map((bitstring, index) => [bitstring, index < remainder ? baseCount + 1 : baseCount]),
  );
}

function extractArtifactParameterDefaults(qaoaRecipe: unknown): { beta: number | null; gamma: number | null } {
  return {
    beta: extractNumber(qaoaRecipe, ["parameterDefaults", "beta"]),
    gamma: extractNumber(qaoaRecipe, ["parameterDefaults", "gamma"]),
  };
}

function extractNumber(value: unknown, path: string[]): number | null {
  let current: unknown = value;

  for (const key of path) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, key)) {
      return null;
    }

    current = current[key];
  }

  return typeof current === "number" && Number.isFinite(current) ? current : null;
}

function extractStringArray(value: unknown, path: string[]): string[] {
  let current: unknown = value;

  for (const key of path) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, key)) {
      return [];
    }

    current = current[key];
  }

  if (!Array.isArray(current)) {
    return [];
  }

  return current.filter((entry): entry is string => typeof entry === "string");
}

function uniqueSortedBitstrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
