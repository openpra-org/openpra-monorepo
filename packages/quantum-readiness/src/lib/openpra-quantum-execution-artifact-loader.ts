import * as fs from "node:fs";
import * as path from "node:path";

import {
  assertOpenPraQuantumExecutionRecord,
  assertOpenPraQuantumExecutionResult,
  type OpenPraQuantumExecutionRecord,
  type OpenPraQuantumExecutionResult,
} from "./openpra-quantum-execution-bridge-contract";

export interface OpenPraQuantumExecutionArtifactLoadRequest {
  rootDirectoryPath: string;
  caseLabel?: string;
}

export interface OpenPraQuantumExecutionArtifactLoadResult {
  executionRecord: OpenPraQuantumExecutionRecord;
  executionRecordPath: string;
  executionResult: OpenPraQuantumExecutionResult | null;
  executionResultPath: string | null;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
}

export function loadLatestOpenPraQuantumExecutionArtifacts(
  request: OpenPraQuantumExecutionArtifactLoadRequest,
): OpenPraQuantumExecutionArtifactLoadResult {
  const candidates = findFilesRecursive(request.rootDirectoryPath, "execution_record_v1.json");

  const matches = candidates
    .map((recordPath) => buildExecutionLoadCandidate(recordPath))
    .filter((candidate) => (request.caseLabel ? candidate.executionRecord.caseLabel === request.caseLabel : true))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (matches.length === 0) {
    throw new Error("No execution artifacts found.");
  }

  const selected = matches[0];
  return {
    executionRecord: selected.executionRecord,
    executionRecordPath: selected.executionRecordPath,
    executionResult: selected.executionResult,
    executionResultPath: selected.executionResultPath,
    provenanceManifest: selected.provenanceManifest,
    provenanceManifestPath: selected.provenanceManifestPath,
  };
}

interface ExecutionLoadCandidate {
  executionRecord: OpenPraQuantumExecutionRecord;
  executionRecordPath: string;
  executionResult: OpenPraQuantumExecutionResult | null;
  executionResultPath: string | null;
  provenanceManifest: Record<string, unknown> | null;
  provenanceManifestPath: string | null;
  mtimeMs: number;
}

function buildExecutionLoadCandidate(executionRecordPath: string): ExecutionLoadCandidate {
  const executionRecord = readJson(executionRecordPath) as OpenPraQuantumExecutionRecord;
  assertOpenPraQuantumExecutionRecord(executionRecord);

  const dirPath = path.dirname(executionRecordPath);

  const executionResultPath = path.join(dirPath, "execution_result_v1.json");
  const executionResult =
    fs.existsSync(executionResultPath) ? (readJson(executionResultPath) as OpenPraQuantumExecutionResult) : null;

  if (executionResult) {
    assertOpenPraQuantumExecutionResult(executionResult);
  }

  const provenanceManifestPath = path.join(dirPath, "provenance_manifest_v1.json");
  const provenanceManifest =
    fs.existsSync(provenanceManifestPath) ? (readJson(provenanceManifestPath) as Record<string, unknown>) : null;

  return {
    executionRecord,
    executionRecordPath,
    executionResult,
    executionResultPath: fs.existsSync(executionResultPath) ? executionResultPath : null,
    provenanceManifest,
    provenanceManifestPath: fs.existsSync(provenanceManifestPath) ? provenanceManifestPath : null,
    mtimeMs: fs.statSync(executionRecordPath).mtimeMs,
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
