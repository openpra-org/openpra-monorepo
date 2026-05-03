#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const qr = loadQuantumReadinessModule(repoRoot);

  const {
    analyzeFaultTreeReadiness,
    buildQuantumPreparationClQuboExport,
    buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport,
  } = qr;

  requireFunction(analyzeFaultTreeReadiness, "analyzeFaultTreeReadiness");
  requireFunction(buildQuantumPreparationClQuboExport, "buildQuantumPreparationClQuboExport");
  requireFunction(
    buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport,
    "buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport",
  );

  const tree = buildProofTree();
  const report = analyzeFaultTreeReadiness(tree, {
    includeRequirementsMatrix: true,
  });

  const clQuboExport = buildQuantumPreparationClQuboExport(tree, report);
  const bundle = buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(clQuboExport, {
    createdBy: "openpra-quantum-generate-proof-preparation-artifact-v1",
  });

  const artifact = bundle.preparationArtifacts.find((row) => row.rootGateId === "TOP");
  if (!artifact) {
    throw new Error("Expected TOP preparation artifact to exist in generated bundle.");
  }

  const outRoot = path.resolve(args.outputRoot);
  fs.mkdirSync(outRoot, { recursive: true });

  const artifactPath = path.join(outRoot, "openpra_quantum_preparation_artifact_v1.json");
  const bundlePath = path.join(outRoot, "openpra_quantum_preparation_artifact_bundle_v1.json");
  const metadataPath = path.join(outRoot, "openpra_quantum_preparation_generation_summary_v1.json");

  writeJson(artifactPath, artifact);
  writeJson(bundlePath, bundle);
  writeJson(metadataPath, {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion: "openpra-quantum-generate-proof-preparation-artifact-v1",
    modelId: artifact.modelId,
    subtreeId: artifact.subtreeId,
    rootGateId: artifact.rootGateId,
    topologyClass: artifact.topologyClass,
    artifactPath,
    bundlePath,
  });

  process.stdout.write(`${artifactPath}\n`);
}

function buildProofTree() {
  return {
    id: "sim-provider-proof",
    name: "Simulator Provider Proof Tree",
    topNodeId: "TOP",
    sourceFormat: "normalized",
    nodes: {
      TOP: {
        id: "TOP",
        kind: "gate",
        gateType: "or",
        children: ["G1", "E"],
      },
      G1: {
        id: "G1",
        kind: "gate",
        gateType: "and",
        children: ["A", "B"],
      },
      A: { id: "A", kind: "basicEvent" },
      B: { id: "B", kind: "basicEvent" },
      E: { id: "E", kind: "basicEvent" },
    },
  };
}

function parseArgs(argv) {
  const out = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for argument --${key}`);
    }

    i += 1;

    if (key === "output-root") {
      out.outputRoot = value;
      continue;
    }

    throw new Error(`Unknown argument: --${key}`);
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

main();
