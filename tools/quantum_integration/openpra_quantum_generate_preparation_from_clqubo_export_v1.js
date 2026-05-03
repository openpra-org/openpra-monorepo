#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const SCRIPT_VERSION = "openpra-quantum-generate-preparation-from-clqubo-export-v1";

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const qr = loadQuantumReadinessModule(repoRoot);

  const { buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport } = qr;

  requireFunction(
    buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport,
    "buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport",
  );

  const clQuboExportPath = path.resolve(args.clQuboExportPath);
  const outputRoot = path.resolve(args.outputRoot);
  const clQuboExport = readJson(clQuboExportPath);

  ensureDir(outputRoot);

  const bundle = buildOpenpraQuantumPreparationArtifactBundleFromClQuboExport(clQuboExport, {
    createdBy: SCRIPT_VERSION,
  });

  if (!bundle.preparationArtifacts || bundle.preparationArtifacts.length === 0) {
    throw new Error("No preparation artifacts were produced from the provided CLQUBO export.");
  }

  const selectedArtifact = selectPreparationArtifact(bundle.preparationArtifacts, args);

  if (!selectedArtifact) {
    throw new Error("Failed to select a preparation artifact.");
  }

  const artifactPath = path.join(outputRoot, "openpra_quantum_preparation_artifact_v1.json");
  const bundlePath = path.join(outputRoot, "openpra_quantum_preparation_artifact_bundle_v1.json");
  const summaryPath = path.join(outputRoot, "openpra_quantum_preparation_from_clqubo_summary_v1.json");

  writeJson(artifactPath, selectedArtifact);
  writeJson(bundlePath, bundle);
  writeJson(summaryPath, {
    generatedAtUtc: new Date().toISOString(),
    scriptVersion: SCRIPT_VERSION,
    sourceClQuboExportPath: clQuboExportPath,
    selectionMode: describeSelectionMode(args, selectedArtifact),
    selectedArtifactId: selectedArtifact.artifactId,
    modelId: selectedArtifact.modelId,
    subtreeId: selectedArtifact.subtreeId,
    rootGateId: selectedArtifact.rootGateId,
    topologyClass: selectedArtifact.topologyClass,
    orderedBasicEventCount:
      Array.isArray(selectedArtifact.orderedBasicEventIds) ? selectedArtifact.orderedBasicEventIds.length : null,
    frozenMinimalCutSetCount: selectedArtifact?.clQuboEncoding?.frozenMcsReference?.minimalCutSetCount ?? null,
    artifactPath,
    bundlePath,
  });

  process.stdout.write(`${artifactPath}\n`);
}

function selectPreparationArtifact(preparationArtifacts, args) {
  if (args.artifactIndex !== undefined) {
    const artifact = preparationArtifacts[args.artifactIndex];
    if (!artifact) {
      throw new Error(`No preparation artifact matched artifactIndex=${args.artifactIndex}`);
    }
    return artifact;
  }

  if (args.subtreeId) {
    const artifact = preparationArtifacts.find((row) => row.subtreeId === args.subtreeId);
    if (!artifact) {
      throw new Error(`No preparation artifact matched subtreeId=${args.subtreeId}`);
    }
    return artifact;
  }

  const explicitTop = preparationArtifacts.find((row) => row.subtreeId === "TOP" || row.rootGateId === "TOP");
  if (explicitTop) {
    return explicitTop;
  }

  const ranked = [...preparationArtifacts].sort((left, right) => {
    const leftBe = Array.isArray(left?.orderedBasicEventIds) ? left.orderedBasicEventIds.length : -1;
    const rightBe = Array.isArray(right?.orderedBasicEventIds) ? right.orderedBasicEventIds.length : -1;
    if (rightBe !== leftBe) {
      return rightBe - leftBe;
    }

    const leftMcs = left?.clQuboEncoding?.frozenMcsReference?.minimalCutSetCount ?? -1;
    const rightMcs = right?.clQuboEncoding?.frozenMcsReference?.minimalCutSetCount ?? -1;
    if (rightMcs !== leftMcs) {
      return rightMcs - leftMcs;
    }

    const leftId = left?.subtreeId ?? "";
    const rightId = right?.subtreeId ?? "";
    return leftId.localeCompare(rightId);
  });

  return ranked[0];
}

function describeSelectionMode(args, selectedArtifact) {
  if (args.artifactIndex !== undefined) {
    return {
      mode: "artifact_index",
      artifactIndex: args.artifactIndex,
      subtreeId: selectedArtifact.subtreeId,
    };
  }

  if (args.subtreeId) {
    return {
      mode: "subtree_id",
      subtreeId: args.subtreeId,
    };
  }

  if (selectedArtifact.subtreeId === "TOP" || selectedArtifact.rootGateId === "TOP") {
    return {
      mode: "default_prefer_top",
      subtreeId: selectedArtifact.subtreeId,
    };
  }

  return {
    mode: "default_ranked_largest_candidate",
    subtreeId: selectedArtifact.subtreeId,
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

    if (key === "clqubo-export") {
      out.clQuboExportPath = value;
      continue;
    }

    if (key === "output-root") {
      out.outputRoot = value;
      continue;
    }

    if (key === "subtree-id") {
      out.subtreeId = value;
      continue;
    }

    if (key === "artifact-index") {
      out.artifactIndex = parseNonNegativeInteger(value, "artifact-index");
      continue;
    }

    throw new Error(`Unknown argument: --${key}`);
  }

  if (!out.clQuboExportPath) {
    throw new Error("--clqubo-export is required");
  }

  if (!out.outputRoot) {
    throw new Error("--output-root is required");
  }

  return out;
}

function parseNonNegativeInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non negative integer`);
  }
  return parsed;
}

function loadQuantumReadinessModule(repoRoot) {
  const candidates = [
    path.join(repoRoot, "dist/packages/quantum-readiness/src/index.js"),
    path.join(repoRoot, "dist/packages/quantum-readiness/index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  throw new Error("Unable to load the built quantum-readiness package. Run `npx nx build quantum-readiness` first.");
}

function requireFunction(value, name) {
  if (typeof value !== "function") {
    throw new Error(`Required quantum-readiness export is unavailable: ${name}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

main();
