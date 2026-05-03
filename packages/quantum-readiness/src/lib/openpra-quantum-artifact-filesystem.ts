import fs from "node:fs";
import path from "node:path";

import type { OpenpraQuantumExecutionArtifactBundle } from "./openpra-quantum-execution-artifacts";
import type { OpenpraQuantumPreparationArtifactBundle } from "./openpra-quantum-preparation-artifacts";

export interface OpenpraQuantumPreparationArtifactFilesystemWriteResult {
  outputDir: string;
  bundlePath: string;
  artifactPaths: string[];
}

export interface OpenpraQuantumExecutionArtifactFilesystemWriteResult {
  outputDir: string;
  executionArtifactPath: string;
  provenanceManifestPath: string;
}

export function writeOpenpraQuantumPreparationArtifactBundleToFilesystem(
  bundle: OpenpraQuantumPreparationArtifactBundle,
  outputDir: string,
): OpenpraQuantumPreparationArtifactFilesystemWriteResult {
  const resolvedOutputDir = path.resolve(outputDir);
  const artifactDir = path.join(resolvedOutputDir, "preparation_artifacts");
  const bundlePath = path.join(resolvedOutputDir, "openpra_quantum_preparation_bundle_v1.json");

  fs.mkdirSync(artifactDir, { recursive: true });
  writeJson(bundlePath, bundle);

  const artifactPaths = bundle.preparationArtifacts.map((artifact) => {
    const artifactPath = path.join(artifactDir, `${sanitizeFilename(artifact.artifactId)}.json`);
    writeJson(artifactPath, artifact);
    return artifactPath;
  });

  return {
    outputDir: resolvedOutputDir,
    bundlePath,
    artifactPaths,
  };
}

export function writeOpenpraQuantumExecutionArtifactBundleToFilesystem(
  bundle: OpenpraQuantumExecutionArtifactBundle,
  outputDir: string,
): OpenpraQuantumExecutionArtifactFilesystemWriteResult {
  const resolvedOutputDir = path.resolve(outputDir);
  fs.mkdirSync(resolvedOutputDir, { recursive: true });

  const executionArtifactPath = path.join(resolvedOutputDir, "openpra_quantum_execution_artifact_v1.json");
  const provenanceManifestPath = path.join(resolvedOutputDir, "openpra_quantum_provenance_manifest_v1.json");

  writeJson(executionArtifactPath, bundle.executionArtifact);
  writeJson(provenanceManifestPath, bundle.provenanceManifest);

  return {
    outputDir: resolvedOutputDir,
    executionArtifactPath,
    provenanceManifestPath,
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}
