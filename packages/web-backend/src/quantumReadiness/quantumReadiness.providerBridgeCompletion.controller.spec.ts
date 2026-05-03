import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController provider bridge completion", () => {
  let controller: QuantumReadinessController;
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(() => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    service = new QuantumReadinessService(graphModelServiceMock as unknown as GraphModelService);

    controller = new QuantumReadinessController(service);
  });

  it("completes a submitted provider request into completed execution artifacts through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-completion-controller-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");

    controller.buildProviderExecutionRequest({
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
      scriptVersion: "quantumReadiness.providerBridgeCompletion.controller.spec",
    });

    controller.submitProviderBridgeRequest({
      providerRequestRootDirectoryPath: providerRequestRoot,
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      scriptVersion: "quantumReadiness.providerBridgeCompletion.controller.spec",
    });

    const completed = controller.completeProviderBridgeSubmission({
      executionArtifactsRootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
      rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
      recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      completedAtUtc: "2026-04-17T17:05:00.000Z",
      failureReason: null,
      scriptVersion: "quantumReadiness.providerBridgeCompletion.controller.spec",
    });

    expect(completed.completedExecutionSubmission.executionRecord.status).toBe("completed");
    expect(completed.completedExecutionSubmission.executionResult?.status).toBe("completed");
    expect(fs.existsSync(completed.completedExecutionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = controller.loadLatestExecutionArtifacts({
      rootDirectoryPath: executionArtifactsRoot,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loadedExecution.executionRecord.status).toBe("completed");
    expect(loadedExecution.executionResult?.rawCountsArtifactPath).toBe("/raw-counts/phase2b_row_0698__G_G348.json");
  });
});
