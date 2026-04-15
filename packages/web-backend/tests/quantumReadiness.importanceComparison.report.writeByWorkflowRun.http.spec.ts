import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonReportWriteByWorkflowRunHttpResponse {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonReportPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP importance comparison report write by workflow run", () => {
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

  it("POST /api/quantum-readiness/importance/compare/report/write/by-workflow-run writes directly into the requested workflow run", async () => {
    const workflowRunDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-importance-report-write-run-"));

    writeJson(path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/report/write/by-workflow-run")
      .send({
        workflowRunDir,
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        measureName: "birnbaum",
        quantumValues: { A: 0.2, B: 0.1 },
        classicalValues: { A: 0.25, B: 0.05 },
      })
      .expect(200);

    const body = response.body as ImportanceComparisonReportWriteByWorkflowRunHttpResponse;

    expect(body.workflowRunDir).toBe(workflowRunDir);
    expect(body.outputDir).toBe(path.join(workflowRunDir, "artifacts", "recovery"));
    expect(fs.existsSync(body.importanceComparisonReportPath)).toBe(true);
  });
});
