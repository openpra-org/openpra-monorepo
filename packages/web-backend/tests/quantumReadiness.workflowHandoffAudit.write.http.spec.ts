import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowHandoffAuditWriteHttpResponse {
  outputDir: string;
  workflowHandoffAuditPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow handoff audit write", () => {
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

  it("POST /api/quantum-readiness/release/workflow-handoff-audit/write writes a handoff audit artifact", async () => {
    const workflowRunDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-handoff-audit-run-"));
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-handoff-audit-out-"));

    writeJson(path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"), { ok: true });
    fs.mkdirSync(path.join(workflowRunDir, "artifacts", "recovery"), { recursive: true });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-handoff-audit/write")
      .send({
        workflowRunDir,
        outputDir,
      })
      .expect(200);

    const body = response.body as WorkflowHandoffAuditWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(body.workflowHandoffAuditPath).toBe(path.join(outputDir, "openpra_quantum_workflow_handoff_audit_v1.json"));
    expect(fs.existsSync(body.workflowHandoffAuditPath)).toBe(true);
  });
});
