import * as path from "node:path";

import {
  loadLatestOpenPraQuantumExecutionArtifacts,
  type OpenPraQuantumExecutionArtifactLoadResult,
} from "./openpra-quantum-execution-artifact-loader";
import {
  buildOpenPraQuantumExecutionRecordServiceStub,
  type OpenPraQuantumExecutionRecordServiceStubResult,
} from "./openpra-quantum-execution-record-service-stub";

export interface OpenPraQuantumProviderBridgeCompletionRequest {
  executionArtifactsRootDirectoryPath: string;
  caseLabel: string;
  rawCountsArtifactPath?: string | null;
  recoveryArtifactPath?: string | null;
  completedAtUtc?: string;
  failureReason?: string | null;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface OpenPraQuantumProviderBridgeCompletionResult {
  loadedExecutionArtifacts: OpenPraQuantumExecutionArtifactLoadResult;
  completedExecutionSubmission: OpenPraQuantumExecutionRecordServiceStubResult;
}

export function completeOpenPraQuantumProviderBridgeSubmission(
  request: OpenPraQuantumProviderBridgeCompletionRequest,
): OpenPraQuantumProviderBridgeCompletionResult {
  const loadedExecutionArtifacts = loadLatestOpenPraQuantumExecutionArtifacts({
    rootDirectoryPath: request.executionArtifactsRootDirectoryPath,
    caseLabel: request.caseLabel,
  });

  const executionRecord = loadedExecutionArtifacts.executionRecord;
  const isFailure = Boolean(request.failureReason);

  const completedExecutionSubmission = buildOpenPraQuantumExecutionRecordServiceStub({
    rootDirectoryPath: path.join(
      request.executionArtifactsRootDirectoryPath,
      executionRecord.caseLabel ?? request.caseLabel,
    ),
    executionRecord: {
      subtreeId: executionRecord.subtreeId,
      providerName: executionRecord.providerName,
      backendName: executionRecord.backendName,
      jobId: executionRecord.jobId,
      shots: executionRecord.shots,
      resilienceLevel: executionRecord.resilienceLevel,
      status: isFailure ? "failed" : "completed",
      provenanceManifestPath: loadedExecutionArtifacts.provenanceManifestPath ?? executionRecord.provenanceManifestPath,
      submittedAtUtc: executionRecord.submittedAtUtc,
      caseLabel: executionRecord.caseLabel,
    },
    executionResult: {
      jobId: executionRecord.jobId,
      status: isFailure ? "failed" : "completed",
      rawCountsArtifactPath:
        isFailure ? null : (
          (request.rawCountsArtifactPath ?? `/raw-counts/${executionRecord.caseLabel ?? request.caseLabel}.json`)
        ),
      recoveryArtifactPath:
        isFailure ? null : (
          (request.recoveryArtifactPath ?? `/recovery/${executionRecord.caseLabel ?? request.caseLabel}.json`)
        ),
      provenanceManifestPath: loadedExecutionArtifacts.provenanceManifestPath ?? executionRecord.provenanceManifestPath,
      completedAtUtc: request.completedAtUtc ?? new Date().toISOString(),
      failureReason: request.failureReason ?? null,
    },
    inputArtifactPaths: [
      loadedExecutionArtifacts.executionRecordPath,
      ...(loadedExecutionArtifacts.executionResultPath ? [loadedExecutionArtifacts.executionResultPath] : []),
      ...(loadedExecutionArtifacts.provenanceManifestPath ? [loadedExecutionArtifacts.provenanceManifestPath] : []),
      ...(request.inputArtifactPaths ?? []),
    ],
    scriptVersion: request.scriptVersion ?? "openpra-quantum-provider-bridge-completion-v1",
  });

  return {
    loadedExecutionArtifacts,
    completedExecutionSubmission,
  };
}
