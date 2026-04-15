import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ImportanceComparisonWriteByTargetHttpResponse {
  workflowRunDir: string;
  outputDir: string;
  importanceComparisonPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP importance comparison write by target", () => {
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

  it("POST /api/quantum-readiness/importance/compare/write/by-target writes into the latest matching workflow run", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-importance-write-target-root-"));

    const runOld = path.join(rootDir, "openpra_quantum_target_old");
    const runNew = path.join(rootDir, "openpra_quantum_target_new");
    const runOther = path.join(rootDir, "openpra_quantum_other");

    fs.mkdirSync(runOld, { recursive: true });
    fs.mkdirSync(runNew, { recursive: true });
    fs.mkdirSync(runOther, { recursive: true });

    writeJson(path.join(runOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });

    writeJson(path.join(runNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });

    writeJson(path.join(runOther, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-17T10:00:00.000Z",
      modelId: "other_model",
      subtreeId: "OTHER",
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/importance/compare/write/by-target")
      .send({
        rootDir,
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        measureName: "birnbaum",
        quantumValues: {
          A: 0.2,
          B: 0.1,
        },
        classicalValues: {
          A: 0.25,
          B: 0.05,
        },
      })
      .expect(200);

    const body = response.body as ImportanceComparisonWriteByTargetHttpResponse;

    expect(body.workflowRunDir).toBe(runNew);
    expect(body.outputDir).toBe(path.join(runNew, "artifacts", "recovery"));
    expect(body.importanceComparisonPath).toBe(
      path.join(runNew, "artifacts", "recovery", "openpra_quantum_importance_comparison_v1.json"),
    );
    expect(fs.existsSync(body.importanceComparisonPath)).toBe(true);
  });
});
