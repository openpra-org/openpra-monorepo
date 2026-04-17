import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  assertOpenPraQuantumExecutionRecord,
  assertOpenPraQuantumExecutionResult,
  type OpenPraQuantumExecutionRecord,
  type OpenPraQuantumExecutionResult,
} from "./openpra-quantum-execution-bridge-contract";

export interface OpenPraQuantumExecutionArtifactStoreResult {
  executionDirectoryPath: string;
  recordPath: string;
  resultPath: string | null;
  provenanceManifestPath: string;
}

export interface PersistOpenPraQuantumExecutionArtifactsParams {
  rootDirectoryPath: string;
  executionRecord: OpenPraQuantumExecutionRecord;
  executionResult?: OpenPraQuantumExecutionResult | null;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export function persistOpenPraQuantumExecutionArtifacts(
  params: PersistOpenPraQuantumExecutionArtifactsParams,
): OpenPraQuantumExecutionArtifactStoreResult {
  assertOpenPraQuantumExecutionRecord(params.executionRecord);

  if (params.executionResult) {
    assertOpenPraQuantumExecutionResult(params.executionResult);
    if (params.executionResult.jobId !== params.executionRecord.jobId) {
      throw new Error("executionResult.jobId must match executionRecord.jobId.");
    }
  }

  const executionDirectoryPath = buildExecutionDirectoryPath(params.rootDirectoryPath, params.executionRecord);
  fs.mkdirSync(executionDirectoryPath, { recursive: true });

  const recordPath = path.join(executionDirectoryPath, "execution_record_v1.json");
  const resultPath = params.executionResult ? path.join(executionDirectoryPath, "execution_result_v1.json") : null;
  const provenanceManifestPath = path.join(executionDirectoryPath, "provenance_manifest_v1.json");

  writeJson(recordPath, params.executionRecord);
  if (params.executionResult && resultPath) {
    writeJson(resultPath, params.executionResult);
  }

  const manifest = {
    artifactType: "openpra_quantum_execution_provenance_manifest",
    generatedAtUtc: new Date().toISOString(),
    scriptVersion: params.scriptVersion ?? "openpra-quantum-execution-artifact-store-v1",
    executionDirectoryPath,
    jobId: params.executionRecord.jobId,
    caseLabel: params.executionRecord.caseLabel ?? null,
    executionRecordPath: recordPath,
    executionResultPath: resultPath,
    inputArtifactPaths: params.inputArtifactPaths ?? [],
    sha256: {
      executionRecord: sha256File(recordPath),
      executionResult: resultPath ? sha256File(resultPath) : null,
    },
  };

  writeJson(provenanceManifestPath, manifest);

  return {
    executionDirectoryPath,
    recordPath,
    resultPath,
    provenanceManifestPath,
  };
}

function buildExecutionDirectoryPath(
  rootDirectoryPath: string,
  executionRecord: OpenPraQuantumExecutionRecord,
): string {
  const label = sanitize(executionRecord.caseLabel ?? `${executionRecord.subtreeId}__${executionRecord.jobId}`);
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
