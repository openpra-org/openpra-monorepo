import { QuantumReadinessController } from "./quantumReadiness.controller";

describe("QuantumReadinessController frontend execution mode selection payload", () => {
  it("routes the execution mode selection payload request through the service", () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        recommendedMode: "hardware",
      },
    };

    const mockQuantumReadinessService = {
      getFrontendExecutionModeSelectionPayload: jest.fn().mockReturnValue(mockResponse),
    };

    const result = QuantumReadinessController.prototype.getFrontendExecutionModeSelectionPayloadHttp.call(
      {
        quantumReadinessService: mockQuantumReadinessService,
      } as unknown as QuantumReadinessController,
      "/tmp/openpra-root",
      "phase2b_row_0905",
      "phase2b_row_0905",
      "G:G939",
    );

    expect(mockQuantumReadinessService.getFrontendExecutionModeSelectionPayload).toHaveBeenCalledWith({
      rootDirectoryPath: "/tmp/openpra-root",
      subtreeId: "phase2b_row_0905",
      caseLabel: "phase2b_row_0905",
      rootGateId: "G:G939",
      scriptVersion: "quantumReadiness.controller.frontendExecutionModeSelectionPayload.http",
    });
    expect(result).toBe(mockResponse);
  });
});
