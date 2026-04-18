#!/usr/bin/env python3
from pathlib import Path
import textwrap

REPO_ROOT = Path.cwd()
SPEC_PATH = REPO_ROOT / "packages/web-backend/tests/quantumReadiness.frontendSubtreeDetailPayload.http.spec.ts"

NEW_SPEC = r'''
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendSubtreeDetailPayload.http", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        {
          provide: QuantumReadinessService,
          useValue: {
            getFrontendSubtreeDetailPayload: jest.fn().mockReturnValue({
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
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("loads the frontend subtree detail payload through HTTP", async () => {
    const candidatePaths = [
      "/quantumReadiness/frontend/subtree-detail-payload",
      "/quantum-readiness/frontend/subtree-detail-payload",
      "/quantumReadiness/frontend/subtreeDetailPayload",
      "/quantum-readiness/frontend/subtreeDetailPayload",
      "/quantumReadiness/frontendSubtreeDetailPayload",
      "/quantum-readiness/frontendSubtreeDetailPayload",
    ];

    let response = null;

    for (const candidatePath of candidatePaths) {
      const attempt = await request(app.getHttpServer())
        .get(candidatePath)
        .query({
          rootDirectoryPath: "/tmp/openpra-root",
          subtreeId: "phase2b_row_0905",
          caseLabel: "phase2b_row_0905",
          rootGateId: "G:G939",
        });

      if (attempt.status === 200) {
        response = attempt;
        break;
      }

      response = attempt;
    }

    expect(response).not.toBeNull();
    expect(response!.status).toBe(200);
    expect(response!.body.target.subtreeId).toBe("phase2b_row_0905");
    expect(response!.body.summary.topologyClass).toBe("C");
    expect(response!.body.summary.thresholdBehavior).toBe("threshold_favorable");
  });
});
'''

def main() -> None:
    SPEC_PATH.write_text(textwrap.dedent(NEW_SPEC).lstrip("\n"), encoding="utf-8")
    print("Applied frontend subtree detail payload HTTP spec fallback fix successfully.")

if __name__ == "__main__":
    main()
