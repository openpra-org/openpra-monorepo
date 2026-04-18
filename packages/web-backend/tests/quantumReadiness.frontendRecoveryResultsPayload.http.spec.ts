import { Test } from "@nestjs/testing";

import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendRecoveryResultsPayload.http", () => {
  it("loads the frontend recovery results payload contract through the controller harness", async () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        primaryMode: "union_sensitivity_recovery",
        unionAllRecovered: true,
      },
      ladder: {
        recommendation: "review_required",
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        {
          provide: QuantumReadinessService,
          useValue: {
            getFrontendRecoveryResultsPayload: jest.fn().mockReturnValue(mockResponse),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuantumReadinessController);

    const result = (
      controller as unknown as {
        getFrontendRecoveryResultsPayloadHttp: (
          rootDirectoryPath: string,
          subtreeId?: string,
          caseLabel?: string,
          rootGateId?: string,
        ) => typeof mockResponse;
      }
    ).getFrontendRecoveryResultsPayloadHttp("/tmp/openpra-root", "phase2b_row_0905", "phase2b_row_0905", "G:G939");

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.primaryMode).toBe("union_sensitivity_recovery");
    expect(result.ladder.recommendation).toBe("review_required");
  });
});
