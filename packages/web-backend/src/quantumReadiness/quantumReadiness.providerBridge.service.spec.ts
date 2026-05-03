import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService provider bridge submission", () => {
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(() => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    service = new QuantumReadinessService(graphModelServiceMock as unknown as GraphModelService);
  });

  it("submits a stored provider request into execution artifacts", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-service-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");

    service.buildProviderExecutionRequest({
      rootDirectoryPath: providerRequestRoot,
      executionRequest: {
        requestId: "provider-request-0698",
        subtreeId: "G:G348",
        caseLabel: "phase2b_row_0698__G_G348",
        providerName: "ibm_runtime",
        backendName: "ibm_torino",
        shots: 8192,
        resilienceLevel: 0,
        createdAtUtc: "2026-04-17T17:03:17.743Z",
        notes: "WS6 exact path request",
      },
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.providerBridge.service.spec",
    });

    const submitted = service.submitProviderBridgeRequest({
      providerRequestRootDirectoryPath: providerRequestRoot,
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      scriptVersion: "quantumReadiness.providerBridge.service.spec",
    });

    expect(submitted.loadedProviderRequest.request.requestId).toBe("provider-request-0698");
    expect(submitted.executionSubmission.executionRecord.status).toBe("submitted");
    expect(fs.existsSync(submitted.executionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = service.loadLatestExecutionArtifacts({
      rootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loadedExecution.executionRecord.jobId).toBe("provider-request-0698");
    expect(loadedExecution.executionResult).toBeNull();
  });
});
