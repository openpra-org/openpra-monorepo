import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService WS6 canonical execution report", () => {
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(() => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    service = new QuantumReadinessService(graphModelServiceMock as unknown as GraphModelService);
  });

  it("builds and loads the WS6 canonical execution report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-report-service-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");
    const reportRoot = path.join(tempDir, "report");

    for (const entry of [
      {
        requestId: "provider-request-0698",
        subtreeId: "G:G348",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      {
        requestId: "provider-request-0905",
        subtreeId: "G:G939",
        caseLabel: "phase2b_row_0905__G_G939",
      },
    ]) {
      service.buildProviderExecutionRequest({
        rootDirectoryPath: providerRequestRoot,
        executionRequest: {
          requestId: entry.requestId,
          subtreeId: entry.subtreeId,
          caseLabel: entry.caseLabel,
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          shots: 8192,
          resilienceLevel: 0,
          createdAtUtc: "2026-04-17T17:03:17.743Z",
          notes: "WS6 canonical execution report request",
        },
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.service.spec",
      });

      service.submitProviderBridgeRequest({
        providerRequestRootDirectoryPath: providerRequestRoot,
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: entry.caseLabel,
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.service.spec",
      });

      service.completeProviderBridgeSubmission({
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: entry.caseLabel,
        rawCountsArtifactPath: `/raw-counts/${entry.caseLabel}.json`,
        recoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.service.spec",
      });
    }

    const built = service.buildWs6CanonicalExecutionReport({
      rootDirectoryPath: reportRoot,
      sourceExecutionArtifactsRootDirectoryPath: executionArtifactsRoot,
      scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.service.spec",
    });

    expect(built.summary.totalCases).toBe(2);
    expect(built.summary.completedCount).toBe(2);
    expect(built.summary.allCompleted).toBe(true);
    expect(fs.existsSync(built.summaryPath)).toBe(true);

    const loaded = service.loadLatestWs6CanonicalExecutionReport({
      rootDirectoryPath: reportRoot,
    });

    expect(loaded.summary.caseLabels).toEqual(["phase2b_row_0698__G_G348", "phase2b_row_0905__G_G939"]);
  });
});
