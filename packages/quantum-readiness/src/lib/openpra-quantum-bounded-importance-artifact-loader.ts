import * as fs from "node:fs";
import * as path from "node:path";

import {
  assertOpenPraQuantumBoundedImportanceResponse,
  type OpenPraQuantumBoundedImportanceResponse,
} from "./openpra-quantum-bounded-importance-contract";

export interface OpenPraQuantumBoundedImportanceArtifactLoadRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

export interface OpenPraQuantumBoundedImportanceArtifactLoadResult {
  response: OpenPraQuantumBoundedImportanceResponse;
  responsePath: string;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
}

export function loadLatestOpenPraQuantumBoundedImportanceArtifacts(
  request: OpenPraQuantumBoundedImportanceArtifactLoadRequest,
): OpenPraQuantumBoundedImportanceArtifactLoadResult {
  const candidates = findFilesRecursive(request.rootDirectoryPath, "bounded_importance_response_v1.json");

  const matches = candidates
    .map((responsePath) => buildBoundedImportanceLoadCandidate(responsePath))
    .filter((candidate) => (request.caseLabel ? candidate.response.caseLabel === request.caseLabel : true))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (matches.length === 0) {
    throw new Error("No bounded importance artifacts found.");
  }

  const selected = matches[0];
  return {
    response: selected.response,
    responsePath: selected.responsePath,
    provenanceManifest: selected.provenanceManifest,
    provenanceManifestPath: selected.provenanceManifestPath,
  };
}

interface BoundedImportanceLoadCandidate {
  response: OpenPraQuantumBoundedImportanceResponse;
  responsePath: string;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
  mtimeMs: number;
}

function buildBoundedImportanceLoadCandidate(responsePath: string): BoundedImportanceLoadCandidate {
  const response = readJson(responsePath) as OpenPraQuantumBoundedImportanceResponse;
  assertOpenPraQuantumBoundedImportanceResponse(response);

  const dirPath = path.dirname(responsePath);
  const provenanceManifestPath = path.join(dirPath, "provenance_manifest_v1.json");
  const provenanceManifest =
    fs.existsSync(provenanceManifestPath) ? (readJson(provenanceManifestPath) as Record<string, unknown>) : null;

  return {
    response,
    responsePath,
    provenanceManifest,
    provenanceManifestPath: fs.existsSync(provenanceManifestPath) ? provenanceManifestPath : null,
    mtimeMs: fs.statSync(responsePath).mtimeMs,
  };
}

function findFilesRecursive(rootDirectoryPath: string, fileName: string): string[] {
  if (!fs.existsSync(rootDirectoryPath)) {
    return [];
  }

  const results: string[] = [];
  walk(rootDirectoryPath, fileName, results);
  results.sort();
  return results;
}

function walk(currentPath: string, fileName: string, results: string[]): void {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, fileName, results);
      continue;
    }
    if (entry.isFile() && entry.name === fileName) {
      results.push(fullPath);
    }
  }
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
