import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController canonical case pack and provider request", () => {
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

  it("returns the canonical case pack summary through the controller", () => {
    const summary = controller.getCanonicalCasePackSummary();

    expect(summary.ws5PriorityCases.map((entry) => entry.caseLabel)).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
  });

  it("builds and loads provider request artifacts through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-request-controller-"));

    const persisted = controller.buildProviderExecutionRequest({
      rootDirectoryPath: tempDir,
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
      scriptVersion: "quantumReadiness.casePackProvider.controller.spec",
    });

    const loaded = controller.loadLatestProviderExecutionRequest({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.request.requestId).toBe("provider-request-0698");
    expect(fs.existsSync(persisted.requestPath)).toBe(true);
  });
});
