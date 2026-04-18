import { QuantumReadinessController } from "./quantumReadiness.controller";

describe("QuantumReadinessController frontend provenance export payload", () => {
  it("routes the provenance export payload request through the service", () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        exportBundleCount: 1,
      },
    };

    const mockQuantumReadinessService = {
      getFrontendProvenanceExportPayload: jest.fn().mockReturnValue(mockResponse),
    };

    const result = QuantumReadinessController.prototype.getFrontendProvenanceExportPayloadHttp.call(
      {
        quantumReadinessService: mockQuantumReadinessService,
      } as unknown as QuantumReadinessController,
      "/tmp/openpra-root",
      "phase2b_row_0905",
      "phase2b_row_0905",
      "G:G939",
    );

    expect(mockQuantumReadinessService.getFrontendProvenanceExportPayload).toHaveBeenCalledWith({
      rootDirectoryPath: "/tmp/openpra-root",
      subtreeId: "phase2b_row_0905",
      caseLabel: "phase2b_row_0905",
      rootGateId: "G:G939",
      scriptVersion: "quantumReadiness.controller.frontendProvenanceExportPayload.http",
    });
    expect(result).toBe(mockResponse);
  });
});
