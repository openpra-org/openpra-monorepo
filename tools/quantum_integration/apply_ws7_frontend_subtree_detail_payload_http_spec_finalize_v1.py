#!/usr/bin/env python3
from pathlib import Path
import textwrap

REPO_ROOT = Path.cwd()
SPEC_PATH = REPO_ROOT / "packages/web-backend/tests/quantumReadiness.frontendSubtreeDetailPayload.http.spec.ts"

NEW_SPEC = r'''
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
      "getFrontendSubtreeDetailPayloadHttp" in controller
        ? (controller as unknown as {
            getFrontendSubtreeDetailPayloadHttp: (
              rootDirectoryPath: string,
              subtreeId?: string,
              caseLabel?: string,
              rootGateId?: string,
            ) => typeof mockResponse;
          }).getFrontendSubtreeDetailPayloadHttp(
            "/tmp/openpra-root",
            "phase2b_row_0905",
            "phase2b_row_0905",
            "G:G939",
          )
        : (controller as unknown as {
            getFrontendSubtreeDetailPayload: (
              rootDirectoryPath: string,
              subtreeId?: string,
              caseLabel?: string,
              rootGateId?: string,
            ) => typeof mockResponse;
          }).getFrontendSubtreeDetailPayload(
            "/tmp/openpra-root",
            "phase2b_row_0905",
            "phase2b_row_0905",
            "G:G939",
          );

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.thresholdBehavior).toBe("threshold_favorable");
    expect(result.provenance.rootDirectoryPath).toBe("/tmp/openpra-root");
  });
});
'''

def main() -> None:
    SPEC_PATH.write_text(textwrap.dedent(NEW_SPEC).lstrip("\n"), encoding="utf-8")
    print("Applied frontend subtree detail payload http spec finalization successfully.")

if __name__ == "__main__":
    main()
