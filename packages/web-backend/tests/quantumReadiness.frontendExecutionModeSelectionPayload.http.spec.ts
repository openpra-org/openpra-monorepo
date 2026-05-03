import { Test } from "@nestjs/testing";

import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendExecutionModeSelectionPayload.http", () => {
  it("loads the frontend execution mode selection payload contract through the controller harness", async () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        recommendedMode: "hardware",
        currentMode: "hardware",
      },
      selection: {
        recommendedMode: "hardware",
        currentMode: "hardware",
        submissionEnabled: true,
        reasons: ["Hardware is eligible because statevector verification passed and eligible backends are available."],
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        {
          provide: QuantumReadinessService,
          useValue: {
            getFrontendExecutionModeSelectionPayload: jest.fn().mockReturnValue(mockResponse),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuantumReadinessController);

    const result = (
      controller as unknown as {
        getFrontendExecutionModeSelectionPayloadHttp: (
          rootDirectoryPath: string,
          subtreeId?: string,
          caseLabel?: string,
          rootGateId?: string,
        ) => typeof mockResponse;
      }
    ).getFrontendExecutionModeSelectionPayloadHttp(
      "/tmp/openpra-root",
      "phase2b_row_0905",
      "phase2b_row_0905",
      "G:G939",
    );

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.recommendedMode).toBe("hardware");
    expect(result.selection.submissionEnabled).toBe(true);
  });
});
