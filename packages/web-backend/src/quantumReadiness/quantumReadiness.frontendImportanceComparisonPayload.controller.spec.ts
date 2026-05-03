import { QuantumReadinessController } from "./quantumReadiness.controller";

describe("QuantumReadinessController frontend importance comparison payload", () => {
  it("routes the importance comparison payload request through the service", () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        rawSpearman: 0.488,
      },
    };

    const mockQuantumReadinessService = {
      getFrontendImportanceComparisonPayload: jest.fn().mockReturnValue(mockResponse),
    };

    const result = QuantumReadinessController.prototype.getFrontendImportanceComparisonPayloadHttp.call(
      {
        quantumReadinessService: mockQuantumReadinessService,
      } as unknown as QuantumReadinessController,
      "/tmp/openpra-root",
      "phase2b_row_0905",
      "phase2b_row_0905",
      "G:G939",
    );

    expect(mockQuantumReadinessService.getFrontendImportanceComparisonPayload).toHaveBeenCalledWith({
      rootDirectoryPath: "/tmp/openpra-root",
      subtreeId: "phase2b_row_0905",
      caseLabel: "phase2b_row_0905",
      rootGateId: "G:G939",
      scriptVersion: "quantumReadiness.controller.frontendImportanceComparisonPayload.http",
    });
    expect(result).toBe(mockResponse);
  });
});
