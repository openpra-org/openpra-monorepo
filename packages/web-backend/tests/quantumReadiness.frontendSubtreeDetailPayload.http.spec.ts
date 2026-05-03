import { Test } from "@nestjs/testing";

import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendSubtreeDetailPayload.http", () => {
  it("loads the frontend subtree detail payload contract through the controller harness", async () => {
    const mockResponse = {
      target: {
        subtreeId: "phase2b_row_0905",
        caseLabel: "phase2b_row_0905",
        rootGateId: "G:G939",
        phase2bRowId: "phase2b_row_0905",
      },
      summary: {
        topologyClass: "C",
        thresholdBehavior: "threshold_favorable",
      },
      provenance: {
        rootDirectoryPath: "/tmp/openpra-root",
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        {
          provide: QuantumReadinessService,
          useValue: {
            getFrontendSubtreeDetailPayload: jest.fn().mockReturnValue(mockResponse),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuantumReadinessController);

    const result =
      "getFrontendSubtreeDetailPayloadHttp" in controller ?
        (
          controller as unknown as {
            getFrontendSubtreeDetailPayloadHttp: (
              rootDirectoryPath: string,
              subtreeId?: string,
              caseLabel?: string,
              rootGateId?: string,
            ) => typeof mockResponse;
          }
        ).getFrontendSubtreeDetailPayloadHttp("/tmp/openpra-root", "phase2b_row_0905", "phase2b_row_0905", "G:G939")
      : (
          controller as unknown as {
            getFrontendSubtreeDetailPayload: (
              rootDirectoryPath: string,
              subtreeId?: string,
              caseLabel?: string,
              rootGateId?: string,
            ) => typeof mockResponse;
          }
        ).getFrontendSubtreeDetailPayload("/tmp/openpra-root", "phase2b_row_0905", "phase2b_row_0905", "G:G939");

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.thresholdBehavior).toBe("threshold_favorable");
    expect(result.provenance.rootDirectoryPath).toBe("/tmp/openpra-root");
  });
});
