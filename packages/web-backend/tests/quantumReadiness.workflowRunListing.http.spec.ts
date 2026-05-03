import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowRunListingHttpResponse {
  rootDir: string;
  entries: Array<{
    workflowRunDir: string;
    workflowKind: string | null;
    createdAtUtc: string | null;
    manifestPath: string | null;
  }>;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow run listing", () => {
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

  it("POST /api/quantum-readiness/workflow/list-runs returns workflow runs sorted newest first", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-workflow-list-root-"));

    const runA = path.join(rootDir, "openpra_quantum_preparation_modela_top_2026_04_15");
    const runB = path.join(rootDir, "openpra_quantum_full_pipeline_modelb_top_2026_04_16");
    const otherDir = path.join(rootDir, "not_a_workflow_dir");

    fs.mkdirSync(runA, { recursive: true });
    fs.mkdirSync(runB, { recursive: true });
    fs.mkdirSync(otherDir, { recursive: true });

    writeJson(path.join(runA, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
    });

    writeJson(path.join(runB, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/list-runs")
      .send({
        rootDir,
      })
      .expect(200);

    const body = response.body as WorkflowRunListingHttpResponse;

    expect(body.entries.length).toBe(2);
    expect(body.entries[0].workflowKind).toBe("full_pipeline");
    expect(body.entries[1].workflowKind).toBe("preparation");
  });
});
