#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const SCRIPT_VERSION = "openpra-quantum-simulator-validation-case-runner-v1";

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const quantumReadiness = loadQuantumReadinessModule(repoRoot);

  const {
    buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator,
    buildOpenpraQuantumExecutionArtifactBundleFromRawCounts,
    writeOpenpraQuantumExecutionArtifactBundleToFilesystem,
    buildOpenpraQuantumRecoveryFromCandidateDir,
  } = quantumReadiness;

  requireFunction(
    buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator,
    "buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator",
  );
  requireFunction(
    buildOpenpraQuantumExecutionArtifactBundleFromRawCounts,
    "buildOpenpraQuantumExecutionArtifactBundleFromRawCounts",
  );
  requireFunction(
    writeOpenpraQuantumExecutionArtifactBundleToFilesystem,
    "writeOpenpraQuantumExecutionArtifactBundleToFilesystem",
  );
  requireFunction(buildOpenpraQuantumRecoveryFromCandidateDir, "buildOpenpraQuantumRecoveryFromCandidateDir");

  const preparationArtifactPath = path.resolve(args.preparationArtifactPath);
  const outputRoot = path.resolve(args.outputRoot);
  const preparationArtifact = readJson(preparationArtifactPath);
  const caseLabel = args.caseLabel ?? buildDefaultCaseLabel(preparationArtifact.modelId, preparationArtifact.subtreeId);
  const caseRoot = path.join(outputRoot, caseLabel);
  const inputsDir = path.join(caseRoot, "00_inputs");
  const candidateDir = path.join(caseRoot, "10_candidate_dir");
  const executionDir = path.join(caseRoot, "20_execution");
  const recoveryDir = path.join(caseRoot, "30_recovery");
  const summaryDir = path.join(caseRoot, "40_summary");

  ensureDir(inputsDir);
  ensureDir(candidateDir);
  ensureDir(executionDir);
  ensureDir(recoveryDir);
  ensureDir(summaryDir);

  const copiedPreparationArtifactPath = path.join(inputsDir, "openpra_quantum_preparation_artifact_v1.json");
  writeJson(copiedPreparationArtifactPath, preparationArtifact);

  const simulatorResult = buildOpenpraQuantumExecutionInputFromPreparationArtifactWithLocalSimulator({
    preparationArtifact,
    shots: args.shots,
    samplingMode: args.samplingMode,
    parameterSource: args.parameterSource,
    ...(args.beta !== undefined ? { beta: args.beta } : {}),
    ...(args.gamma !== undefined ? { gamma: args.gamma } : {}),
    ...(args.seed !== undefined ? { seed: args.seed } : {}),
    providerName: "openpra_local_bounded_simulator_v1",
    backendName: "bounded_synthetic_sampler",
    executionMode: "simulator_local_bounded",
    status: "completed",
    metadata: {
      validationCaseLabel: caseLabel,
      validationScriptVersion: SCRIPT_VERSION,
    },
    notes: ["Validation runner generated local bounded simulator raw counts from a preparation artifact."],
  });

  const simulatorMetadataPath = path.join(inputsDir, "openpra_quantum_simulator_metadata_v1.json");
  writeJson(simulatorMetadataPath, simulatorResult.simulatorMetadata);

  const packageMetadata = buildPackageMetadata(preparationArtifact, simulatorResult, preparationArtifactPath);
  const classicalReference = buildClassicalReferenceArtifact(preparationArtifact);
  const rawCountsArtifact = buildRawCountsArtifact(
    preparationArtifact,
    simulatorResult.executionInput.rawCounts,
    args.shots,
  );

  const packageMetadataPath = path.join(candidateDir, "package_metadata.json");
  const classicalReferencePath = path.join(candidateDir, "classical_reference_mcs.json");
  const rawCountsPath = path.join(candidateDir, "raw_counts.json");

  writeJson(packageMetadataPath, packageMetadata);
  writeJson(classicalReferencePath, classicalReference);
  writeJson(rawCountsPath, rawCountsArtifact);

  const executionBundle = buildOpenpraQuantumExecutionArtifactBundleFromRawCounts(simulatorResult.executionInput, {
    createdBy: SCRIPT_VERSION,
    inputReferences: [preparationArtifactPath],
    notes: ["Execution artifact bundle created by validation runner from simulator_local_bounded raw counts."],
  });

  const executionWrite = writeOpenpraQuantumExecutionArtifactBundleToFilesystem(executionBundle, executionDir);
  const recoveryResult = buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
  const recoveryArtifactPath = path.join(recoveryDir, "openpra_quantum_recovery_artifact_v1.json");
  writeJson(recoveryArtifactPath, recoveryResult);

  const summary = buildValidationSummary({
    caseLabel,
    preparationArtifactPath,
    copiedPreparationArtifactPath,
    simulatorMetadataPath,
    candidateDir,
    packageMetadataPath,
    classicalReferencePath,
    rawCountsPath,
    executionWrite,
    recoveryArtifactPath,
    preparationArtifact,
    executionArtifact: executionBundle.executionArtifact,
    simulatorMetadata: simulatorResult.simulatorMetadata,
    recoveryResult,
    shots: args.shots,
  });

  const summaryPath = path.join(summaryDir, "openpra_quantum_validation_case_summary_v1.json");
  writeJson(summaryPath, summary);

  process.stdout.write(`${summaryPath}\n`);
}

function parseArgs(argv) {
  const out = {
    shots: 8192,
    samplingMode: "synthetic_exact_mcs",
    parameterSource: "artifact_default",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for argument --${key}`);
    }

    index += 1;

    if (key === "preparation-artifact") {
      out.preparationArtifactPath = value;
      continue;
    }

    if (key === "output-root") {
      out.outputRoot = value;
      continue;
    }

    if (key === "case-label") {
      out.caseLabel = value;
      continue;
    }

    if (key === "shots") {
      out.shots = parsePositiveInteger(value, "shots");
      continue;
    }

    if (key === "sampling-mode") {
      out.samplingMode = value;
      continue;
    }

    if (key === "parameter-source") {
      out.parameterSource = value;
      continue;
    }

    if (key === "beta") {
      out.beta = parseFiniteNumber(value, "beta");
      continue;
    }

    if (key === "gamma") {
      out.gamma = parseFiniteNumber(value, "gamma");
      continue;
    }

    if (key === "seed") {
      out.seed = parsePositiveInteger(value, "seed");
      continue;
    }

    throw new Error(`Unknown argument: --${key}`);
  }

  if (!out.preparationArtifactPath) {
    throw new Error("--preparation-artifact is required");
  }

  if (!out.outputRoot) {
    throw new Error("--output-root is required");
  }

  return out;
}

function loadQuantumReadinessModule(repoRoot) {
  const candidates = [
    path.join(repoRoot, "dist/packages/quantum-readiness"),
    path.join(repoRoot, "dist/packages/quantum-readiness/index.js"),
    path.join(repoRoot, "dist/packages/quantum-readiness/src/index.js"),
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (!isModuleResolutionError(error)) {
        throw error;
      }
    }
  }

  throw new Error("Unable to load the built quantum-readiness package. Run `npx nx build quantum-readiness` first.");
}

function isModuleResolutionError(error) {
  return Boolean(error) && typeof error === "object" && error.code === "MODULE_NOT_FOUND";
}

function requireFunction(value, name) {
  if (typeof value !== "function") {
    throw new Error(`Required quantum-readiness export is unavailable: ${name}`);
  }
}

function buildPackageMetadata(preparationArtifact, simulatorResult, preparationArtifactPath) {
  return {
    generated_at: new Date().toISOString(),
    script_version: SCRIPT_VERSION,
    model_id: preparationArtifact.modelId,
    model_name: preparationArtifact.modelName,
    candidate_root_node_id: preparationArtifact.subtreeId,
    topology_class: preparationArtifact.topologyClass,
    required_qubits: preparationArtifact.orderedBasicEventIds.length,
    basic_event_count: preparationArtifact.orderedBasicEventIds.length,
    minimal_cut_set_count: preparationArtifact.clQuboEncoding.frozenMcsReference.minimalCutSetCount,
    source_preparation_artifact_id: preparationArtifact.artifactId,
    source_preparation_artifact_path: path.resolve(preparationArtifactPath),
    simulator_sampling_mode: simulatorResult.simulatorMetadata.samplingMode,
    parameter_source: simulatorResult.simulatorMetadata.parameterSource,
    beta: simulatorResult.simulatorMetadata.beta,
    gamma: simulatorResult.simulatorMetadata.gamma,
    synthetic_package_bridge: true,
    synthetic_package_reason: "local_bounded_validation_runner",
  };
}

function buildClassicalReferenceArtifact(preparationArtifact) {
  return {
    generated_at: new Date().toISOString(),
    script_version: SCRIPT_VERSION,
    model_id: preparationArtifact.modelId,
    candidate_root_node_id: preparationArtifact.subtreeId,
    frozen_mcs_reference: {
      minimalCutSetCount: preparationArtifact.clQuboEncoding.frozenMcsReference.minimalCutSetCount,
      basicEventIdSets: cloneMatrix(preparationArtifact.clQuboEncoding.frozenMcsReference.basicEventIdSets),
      bitstrings: [...preparationArtifact.clQuboEncoding.frozenMcsReference.bitstrings],
    },
  };
}

function buildRawCountsArtifact(preparationArtifact, counts, shots) {
  return {
    generated_at: new Date().toISOString(),
    script_version: SCRIPT_VERSION,
    status: "populated_from_simulator_local_bounded",
    model_id: preparationArtifact.modelId,
    candidate_root_node_id: preparationArtifact.subtreeId,
    topology_class: preparationArtifact.topologyClass,
    basic_event_count: preparationArtifact.orderedBasicEventIds.length,
    required_qubits: preparationArtifact.orderedBasicEventIds.length,
    ordered_basic_event_ids: [...preparationArtifact.orderedBasicEventIds],
    bitstring_convention: "direct_binary_string_over_ordered_basic_event_ids",
    bitstring_index_convention: "direct_binary_string_to_state_index",
    measurement_basis: "computational",
    shots_total: shots,
    counts: sortNumericRecord(counts),
  };
}

function buildValidationSummary(input) {
  const {
    caseLabel,
    preparationArtifactPath,
    copiedPreparationArtifactPath,
    simulatorMetadataPath,
    candidateDir,
    packageMetadataPath,
    classicalReferencePath,
    rawCountsPath,
    executionWrite,
    recoveryArtifactPath,
    preparationArtifact,
    executionArtifact,
    simulatorMetadata,
    recoveryResult,
    shots,
  } = input;

  return {
    schemaVersion: "1.0.0",
    artifactType: "validation_case_summary",
    generatedAtUtc: new Date().toISOString(),
    scriptVersion: SCRIPT_VERSION,
    caseLabel,
    modelId: preparationArtifact.modelId,
    subtreeId: preparationArtifact.subtreeId,
    rootGateId: preparationArtifact.rootGateId,
    topologyClass: preparationArtifact.topologyClass,
    shots,
    simulator: {
      samplingMode: simulatorMetadata.samplingMode,
      parameterSource: simulatorMetadata.parameterSource,
      beta: simulatorMetadata.beta,
      gamma: simulatorMetadata.gamma,
      supportCount: simulatorMetadata.supportCount,
      supportBitstrings: [...simulatorMetadata.bitstringSupport],
    },
    references: {
      preparationArtifactPath: path.resolve(preparationArtifactPath),
      copiedPreparationArtifactPath,
      simulatorMetadataPath,
      candidateDir,
      packageMetadataPath,
      classicalReferencePath,
      rawCountsPath,
      executionArtifactPath: executionWrite.executionArtifactPath,
      executionProvenanceManifestPath: executionWrite.provenanceManifestPath,
      recoveryArtifactPath,
    },
    execution: {
      artifactId: executionArtifact.artifactId,
      providerType: executionArtifact.providerType,
      providerName: executionArtifact.providerName,
      backendName: executionArtifact.backendName,
      executionMode: executionArtifact.executionMode,
      sourcePreparationArtifactId: executionArtifact.sourcePreparationArtifactId,
      nonZeroBitstrings: Object.keys(executionArtifact.rawCounts).length,
      shotsTotal: sumValues(executionArtifact.rawCounts),
    },
    recovery: {
      primaryMode: recoveryResult.integrationRecommendation.primaryMode,
      requiresOperatorAttention: recoveryResult.integrationRecommendation.requiresOperatorAttention,
      summary: recoveryResult.integrationRecommendation.summary,
      tier1RecoveredExactCutSetCount: recoveryResult.recoveryTier1ExactHardware.recoveredExactCutSetCount,
      tier1ReferenceCount: recoveryResult.recoveryTier1ExactHardware.referenceCount,
      unionRecoveredCount: recoveryResult.recoveryTier3UnionSensitivity.unionRecoveredCount,
      unionReferenceCount: recoveryResult.recoveryTier3UnionSensitivity.referenceCount,
      unionAllRecovered: recoveryResult.recoveryTier3UnionSensitivity.allRecoveredInUnion,
      recommendedBasicEventIdSetCount: recoveryResult.integrationRecommendation.recommendedBasicEventIdSets.length,
    },
  };
}

function buildDefaultCaseLabel(modelId, subtreeId) {
  return `${sanitizeToken(modelId)}__${sanitizeToken(subtreeId)}`;
}

function sanitizeToken(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, "_");
}

function parsePositiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseFiniteNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number`);
  }
  return parsed;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function cloneMatrix(rows) {
  return rows.map((row) => [...row]);
}

function sortNumericRecord(values) {
  return Object.fromEntries(
    Object.entries(values)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, value]),
  );
}

function sumValues(values) {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

main();
