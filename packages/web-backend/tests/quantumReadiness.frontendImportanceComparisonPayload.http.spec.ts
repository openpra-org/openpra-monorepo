import { Test } from "@nestjs/testing";

import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendImportanceComparisonPayload.http", () => {
  it("loads the frontend importance comparison payload contract through the controller harness", async () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        rawSpearman: 0.488,
        birnbaumSpearman: 0.438,
        fvSpearman: 0.236,
      },
      interpretation: {
        recommendation: "review_required",
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        {
          provide: QuantumReadinessService,
          useValue: {
            getFrontendImportanceComparisonPayload: jest.fn().mockReturnValue(mockResponse),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuantumReadinessController);

    const result = (
      controller as unknown as {
        getFrontendImportanceComparisonPayloadHttp: (
          rootDirectoryPath: string,
          subtreeId?: string,
          caseLabel?: string,
          rootGateId?: string,
        ) => typeof mockResponse;
      }
    ).getFrontendImportanceComparisonPayloadHttp("/tmp/openpra-root", "phase2b_row_0905", "phase2b_row_0905", "G:G939");

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.rawSpearman).toBe(0.488);
    expect(result.interpretation.recommendation).toBe("review_required");
  });
});
