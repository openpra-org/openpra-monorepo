import * as path from "node:path";

import {
  loadLatestOpenPraQuantumProviderExecutionRequest,
  type OpenPraQuantumProviderExecutionRequestLoadResult,
} from "./openpra-quantum-provider-request-store";
import {
  buildOpenPraQuantumExecutionRecordServiceStub,
  type OpenPraQuantumExecutionRecordServiceStubResult,
} from "./openpra-quantum-execution-record-service-stub";

export interface OpenPraQuantumProviderBridgeSubmissionRequest {
  providerRequestRootDirectoryPath: string;
  executionArtifactsRootDirectoryPath: string;
  caseLabel: string;
  jobId?: string;
  submittedAtUtc?: string;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface OpenPraQuantumProviderBridgeSubmissionResult {
  loadedProviderRequest: OpenPraQuantumProviderExecutionRequestLoadResult;
  executionSubmission: OpenPraQuantumExecutionRecordServiceStubResult;
}

export function submitOpenPraQuantumProviderBridgeRequest(
  request: OpenPraQuantumProviderBridgeSubmissionRequest,
): OpenPraQuantumProviderBridgeSubmissionResult {
  const loadedProviderRequest = loadLatestOpenPraQuantumProviderExecutionRequest({
    rootDirectoryPath: request.providerRequestRootDirectoryPath,
    caseLabel: request.caseLabel,
  });

  const providerRequest = loadedProviderRequest.request;

  const executionSubmission = buildOpenPraQuantumExecutionRecordServiceStub({
    rootDirectoryPath: path.join(request.executionArtifactsRootDirectoryPath, providerRequest.caseLabel),
    executionRecord: {
      subtreeId: providerRequest.subtreeId,
      providerName: providerRequest.providerName,
      backendName: providerRequest.backendName,
      jobId: request.jobId ?? providerRequest.requestId,
      shots: providerRequest.shots,
      resilienceLevel: providerRequest.resilienceLevel,
      status: "submitted",
      provenanceManifestPath: loadedProviderRequest.provenanceManifestPath ?? loadedProviderRequest.requestPath,
      submittedAtUtc: request.submittedAtUtc ?? providerRequest.createdAtUtc,
      caseLabel: providerRequest.caseLabel,
    },
    executionResult: null,
    inputArtifactPaths: [
      loadedProviderRequest.requestPath,
      ...(loadedProviderRequest.provenanceManifestPath ? [loadedProviderRequest.provenanceManifestPath] : []),
      ...(request.inputArtifactPaths ?? []),
    ],
    scriptVersion: request.scriptVersion ?? "openpra-quantum-provider-bridge-scaffold-v1",
  });

  return {
    loadedProviderRequest,
    executionSubmission,
  };
}
