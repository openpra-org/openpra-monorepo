import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowReleaseSummaryWriteHttpResponse {
  outputDir: string;
  workflowReleaseSummaryPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow release summary write", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/quantum-readiness");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/quantum-readiness/release/workflow-summary/write writes a release summary artifact", async () => {
    const workflowRunDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-release-summary-write-run-"));
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-release-summary-write-out-"));

    writeJson(path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"), { ok: true });
    fs.mkdirSync(path.join(workflowRunDir, "artifacts", "recovery"), { recursive: true });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-summary/write")
      .send({
        workflowRunDir,
        outputDir,
      })
      .expect(200);

    const body = response.body as WorkflowReleaseSummaryWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(body.workflowReleaseSummaryPath).toBe(
      path.join(outputDir, "openpra_quantum_workflow_release_summary_v1.json"),
    );
    expect(fs.existsSync(body.workflowReleaseSummaryPath)).toBe(true);
  });
});
