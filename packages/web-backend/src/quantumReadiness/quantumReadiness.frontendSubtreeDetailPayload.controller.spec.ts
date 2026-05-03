import { QuantumReadinessController } from "./quantumReadiness.controller";

describe("QuantumReadinessController frontend subtree detail payload", () => {
  it("routes the subtree detail payload request through the service", () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        topologyClass: "C",
      },
    };

    const mockQuantumReadinessService = {
      getFrontendSubtreeDetailPayload: jest.fn().mockReturnValue(mockResponse),
    };

    const result = QuantumReadinessController.prototype.getFrontendSubtreeDetailPayload.call(
      {
        quantumReadinessService: mockQuantumReadinessService,
      } as unknown as QuantumReadinessController,
      "/tmp/openpra-root",
      "phase2b_row_0905",
      "phase2b_row_0905",
      "G:G939",
    );

    expect(mockQuantumReadinessService.getFrontendSubtreeDetailPayload).toHaveBeenCalledWith({
      rootDirectoryPath: "/tmp/openpra-root",
      subtreeId: "phase2b_row_0905",
      caseLabel: "phase2b_row_0905",
      rootGateId: "G:G939",
      scriptVersion: "quantumReadiness.controller.frontendSubtreeDetailPayload",
    });
    expect(result).toBe(mockResponse);
  });
});
