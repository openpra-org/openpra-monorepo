import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  assertOpenPraQuantumBoundedImportanceResponse,
  type OpenPraQuantumBoundedImportanceResponse,
} from "./openpra-quantum-bounded-importance-contract";

export interface OpenPraQuantumBoundedImportanceArtifactStoreResult {
  importanceDirectoryPath: string;
  responsePath: string;
  provenanceManifestPath: string;
}

export interface PersistOpenPraQuantumBoundedImportanceArtifactsParams {
  rootDirectoryPath: string;
  response: OpenPraQuantumBoundedImportanceResponse;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export function persistOpenPraQuantumBoundedImportanceArtifacts(
  params: PersistOpenPraQuantumBoundedImportanceArtifactsParams,
): OpenPraQuantumBoundedImportanceArtifactStoreResult {
  assertOpenPraQuantumBoundedImportanceResponse(params.response);

  const importanceDirectoryPath = buildImportanceDirectoryPath(params.rootDirectoryPath, params.response);
  fs.mkdirSync(importanceDirectoryPath, { recursive: true });

  const responsePath = path.join(importanceDirectoryPath, "bounded_importance_response_v1.json");
  const provenanceManifestPath = path.join(importanceDirectoryPath, "provenance_manifest_v1.json");

  writeJson(responsePath, params.response);

  const manifest = {
    artifactType: "openpra_quantum_bounded_importance_provenance_manifest",
    generatedAtUtc: new Date().toISOString(),
    scriptVersion: params.scriptVersion ?? "openpra-quantum-bounded-importance-artifact-store-v1",
    importanceDirectoryPath,
    subtreeId: params.response.subtreeId,
    caseLabel: params.response.caseLabel ?? null,
    responsePath,
    inputArtifactPaths: params.inputArtifactPaths ?? [],
    sha256: {
      response: sha256File(responsePath),
    },
  };

  writeJson(provenanceManifestPath, manifest);

  return {
    importanceDirectoryPath,
    responsePath,
    provenanceManifestPath,
  };
}

function buildImportanceDirectoryPath(
  rootDirectoryPath: string,
  response: OpenPraQuantumBoundedImportanceResponse,
): string {
  const label = sanitize(response.caseLabel ?? `${response.subtreeId}__${response.topologyClass}`);
  return path.join(rootDirectoryPath, label);
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256File(filePath: string): string {
  const h = crypto.createHash("sha256");
  const text = fs.readFileSync(filePath, "utf8");
  h.update(text, "utf8");
  return h.digest("hex");
}
