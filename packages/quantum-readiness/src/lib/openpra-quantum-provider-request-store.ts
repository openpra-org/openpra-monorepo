import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  assertOpenPraQuantumProviderExecutionRequest,
  type OpenPraQuantumProviderExecutionRequest,
} from "./openpra-quantum-provider-request-contract";

export interface PersistOpenPraQuantumProviderExecutionRequestParams {
  rootDirectoryPath: string;
  request: OpenPraQuantumProviderExecutionRequest;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface OpenPraQuantumProviderExecutionRequestStoreResult {
  requestDirectoryPath: string;
  requestPath: string;
  provenanceManifestPath: string;
}

export interface OpenPraQuantumProviderExecutionRequestLoadRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

export interface OpenPraQuantumProviderExecutionRequestLoadResult {
  request: OpenPraQuantumProviderExecutionRequest;
  requestPath: string;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
}

export function persistOpenPraQuantumProviderExecutionRequest(
  params: PersistOpenPraQuantumProviderExecutionRequestParams,
): OpenPraQuantumProviderExecutionRequestStoreResult {
  assertOpenPraQuantumProviderExecutionRequest(params.request);

  const requestDirectoryPath = buildRequestDirectoryPath(params.rootDirectoryPath, params.request);
  fs.mkdirSync(requestDirectoryPath, { recursive: true });

  const requestPath = path.join(requestDirectoryPath, "provider_execution_request_v1.json");
  const provenanceManifestPath = path.join(requestDirectoryPath, "provenance_manifest_v1.json");

  writeJson(requestPath, params.request);

  const manifest = {
    artifactType: "openpra_quantum_provider_execution_request_manifest",
    generatedAtUtc: new Date().toISOString(),
    scriptVersion: params.scriptVersion ?? "openpra-quantum-provider-request-store-v1",
    requestDirectoryPath,
    requestId: params.request.requestId,
    caseLabel: params.request.caseLabel,
    requestPath,
    inputArtifactPaths: params.inputArtifactPaths ?? [],
    sha256: {
      request: sha256File(requestPath),
    },
  };

  writeJson(provenanceManifestPath, manifest);

  return {
    requestDirectoryPath,
    requestPath,
    provenanceManifestPath,
  };
}

export function loadLatestOpenPraQuantumProviderExecutionRequest(
  request: OpenPraQuantumProviderExecutionRequestLoadRequest,
): OpenPraQuantumProviderExecutionRequestLoadResult {
  const candidates = findFilesRecursive(request.rootDirectoryPath, "provider_execution_request_v1.json");

  const matches = candidates
    .map((requestPath) => buildLoadCandidate(requestPath))
    .filter((candidate) => (request.caseLabel ? candidate.request.caseLabel === request.caseLabel : true))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (matches.length === 0) {
    throw new Error("No provider execution request artifacts found.");
  }

  const selected = matches[0];
  return {
    request: selected.request,
    requestPath: selected.requestPath,
    provenanceManifest: selected.provenanceManifest,
    provenanceManifestPath: selected.provenanceManifestPath,
  };
}

interface ProviderRequestLoadCandidate {
  request: OpenPraQuantumProviderExecutionRequest;
  requestPath: string;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
  mtimeMs: number;
}

function buildLoadCandidate(requestPath: string): ProviderRequestLoadCandidate {
  const request = readJson(requestPath) as OpenPraQuantumProviderExecutionRequest;
  assertOpenPraQuantumProviderExecutionRequest(request);

  const dirPath = path.dirname(requestPath);
  const provenanceManifestPath = path.join(dirPath, "provenance_manifest_v1.json");
  const provenanceManifest =
    fs.existsSync(provenanceManifestPath) ? (readJson(provenanceManifestPath) as Record<string, unknown>) : null;

  return {
    request,
    requestPath,
    provenanceManifest,
    provenanceManifestPath: fs.existsSync(provenanceManifestPath) ? provenanceManifestPath : null,
    mtimeMs: fs.statSync(requestPath).mtimeMs,
  };
}

function buildRequestDirectoryPath(rootDirectoryPath: string, request: OpenPraQuantumProviderExecutionRequest): string {
  const label = sanitize(request.caseLabel ?? request.requestId);
  return path.join(rootDirectoryPath, label);
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
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

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256File(filePath: string): string {
  const h = crypto.createHash("sha256");
  const text = fs.readFileSync(filePath, "utf8");
  h.update(text, "utf8");
  return h.digest("hex");
}
