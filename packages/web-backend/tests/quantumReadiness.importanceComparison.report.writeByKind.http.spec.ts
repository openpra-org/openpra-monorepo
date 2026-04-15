import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonReportWriteByKindHttpResponse {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonReportPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP importance comparison report write by kind", () => {
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

  it("POST /api/quantum-readiness/importance/compare/report/write/by-kind writes into the latest matching workflow kind", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-importance-report-write-kind-root-"));

    const runPrep = path.join(rootDir, "openpra_quantum_preparation_old");
    const runFullOld = path.join(rootDir, "openpra_quantum_full_pipeline_old");
    const runFullNew = path.join(rootDir, "openpra_quantum_full_pipeline_new");

    fs.mkdirSync(runPrep, { recursive: true });
    fs.mkdirSync(runFullOld, { recursive: true });
    fs.mkdirSync(runFullNew, { recursive: true });

    writeJson(path.join(runPrep, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });

    writeJson(path.join(runFullOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-15T11:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });

    writeJson(path.join(runFullNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/report/write/by-kind")
      .send({
        rootDir,
        workflowKind: "full_pipeline",
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        measureName: "birnbaum",
        quantumValues: { A: 0.2, B: 0.1 },
        classicalValues: { A: 0.25, B: 0.05 },
      })
      .expect(200);

    const body = response.body as ImportanceComparisonReportWriteByKindHttpResponse;

    expect(body.workflowRunDir).toBe(runFullNew);
    expect(body.outputDir).toBe(path.join(runFullNew, "artifacts", "recovery"));
    expect(fs.existsSync(body.importanceComparisonReportPath)).toBe(true);
  });
});
