import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-contract";
import { loadLatestOpenPraQuantumExecutionArtifacts } from "./openpra-quantum-execution-artifact-loader";
import { submitOpenPraQuantumProviderBridgeRequest } from "./openpra-quantum-provider-bridge-scaffold";
import { persistOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-store";

describe("openpra-quantum-provider-bridge-scaffold", () => {
  it("submits a stored provider request into execution artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-"));
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
      scriptVersion: "openpra-quantum-provider-bridge-scaffold.spec",
    });

    const submitted = submitOpenPraQuantumProviderBridgeRequest({
      providerRequestRootDirectoryPath: providerRequestRoot,
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      scriptVersion: "openpra-quantum-provider-bridge-scaffold.spec",
    });

    expect(submitted.loadedProviderRequest.request.requestId).toBe("provider-request-0698");
    expect(submitted.executionSubmission.executionRecord.jobId).toBe("provider-request-0698");
    expect(submitted.executionSubmission.executionRecord.status).toBe("submitted");
    expect(fs.existsSync(submitted.executionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = loadLatestOpenPraQuantumExecutionArtifacts({
      rootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loadedExecution.executionRecord.jobId).toBe("provider-request-0698");
    expect(loadedExecution.executionResult).toBeNull();
  });
});
