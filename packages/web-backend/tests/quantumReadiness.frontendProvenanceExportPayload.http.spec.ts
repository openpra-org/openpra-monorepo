import { Test } from "@nestjs/testing";

import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendProvenanceExportPayload.http", () => {
  it("loads the frontend provenance export payload contract through the controller harness", async () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        exportBundleCount: 1,
        manifestCount: 2,
      },
      readiness: {
        recommendation: "ready_for_handoff_bundle_review",
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        {
          provide: QuantumReadinessService,
          useValue: {
            getFrontendProvenanceExportPayload: jest.fn().mockReturnValue(mockResponse),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuantumReadinessController);

    const result = (
      controller as unknown as {
        getFrontendProvenanceExportPayloadHttp: (
          rootDirectoryPath: string,
          subtreeId?: string,
          caseLabel?: string,
          rootGateId?: string,
        ) => typeof mockResponse;
      }
    ).getFrontendProvenanceExportPayloadHttp("/tmp/openpra-root", "phase2b_row_0905", "phase2b_row_0905", "G:G939");

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.exportBundleCount).toBe(1);
    expect(result.readiness.recommendation).toBe("ready_for_handoff_bundle_review");
  });
});
