import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-contract";
import { persistOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-store";
import { submitOpenPraQuantumProviderBridgeRequest } from "./openpra-quantum-provider-bridge-scaffold";
import { completeOpenPraQuantumProviderBridgeSubmission } from "./openpra-quantum-provider-bridge-completion";
import { loadLatestOpenPraQuantumExecutionArtifacts } from "./openpra-quantum-execution-artifact-loader";

describe("openpra-quantum-provider-bridge-completion", () => {
  it("completes a submitted provider bridge execution into completed execution artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-complete-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");

    const providerRequest = createOpenPraQuantumProviderExecutionRequest({
      requestId: "provider-request-0698",
      subtreeId: "G:G348",
      caseLabel: "phase2b_row_0698__G_G348",
      providerName: "ibm_runtime",
      backendName: "ibm_torino",
      shots: 8192,
      resilienceLevel: 0,
      createdAtUtc: "2026-04-17T17:03:17.743Z",
      notes: "WS6 exact path request",
    });

    persistOpenPraQuantumProviderExecutionRequest({
      rootDirectoryPath: providerRequestRoot,
      request: providerRequest,
      inputArtifactPaths: [],
      scriptVersion: "openpra-quantum-provider-bridge-completion.spec",
    });

    submitOpenPraQuantumProviderBridgeRequest({
      providerRequestRootDirectoryPath: providerRequestRoot,
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      scriptVersion: "openpra-quantum-provider-bridge-completion.spec",
    });

    const completed = completeOpenPraQuantumProviderBridgeSubmission({
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
      recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      completedAtUtc: "2026-04-17T17:05:00.000Z",
      failureReason: null,
      scriptVersion: "openpra-quantum-provider-bridge-completion.spec",
    });

    expect(completed.completedExecutionSubmission.executionRecord.status).toBe("completed");
    expect(completed.completedExecutionSubmission.executionResult?.status).toBe("completed");
    expect(fs.existsSync(completed.completedExecutionSubmission.persistedArtifacts.recordPath)).toBe(true);
    expect(fs.existsSync(completed.completedExecutionSubmission.persistedArtifacts.resultPath ?? "")).toBe(true);

    const loadedExecution = loadLatestOpenPraQuantumExecutionArtifacts({
      rootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loadedExecution.executionRecord.status).toBe("completed");
    expect(loadedExecution.executionResult?.rawCountsArtifactPath).toBe("/raw-counts/phase2b_row_0698__G_G348.json");
  });
});
