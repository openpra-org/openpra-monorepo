import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowRunScaffoldHttpResponse {
  rootDir: string;
  workflowRunDir: string;
  manifestPath: string;
  directories: {
    artifacts: string;
    preparation: string;
    execution: string;
    recovery: string;
    batch: string;
    logs: string;
  };
}

describe("QuantumReadiness HTTP workflow run scaffold", () => {
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

  it("POST /api/quantum-readiness/workflow/run-scaffold creates a workflow run directory tree", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-workflow-run-root-"));

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/run-scaffold")
      .send({
        rootDir,
        modelId: "phase2b_row_0001",
        subtreeId: "TOP",
        workflowKind: "full_pipeline",
        requestedBy: "jest:http",
        notes: ["proof"],
      })
      .expect(200);

    const body = response.body as WorkflowRunScaffoldHttpResponse;

    expect(fs.existsSync(body.workflowRunDir)).toBe(true);
    expect(fs.existsSync(body.manifestPath)).toBe(true);
    expect(fs.existsSync(body.directories.artifacts)).toBe(true);
    expect(fs.existsSync(body.directories.preparation)).toBe(true);
    expect(fs.existsSync(body.directories.execution)).toBe(true);
    expect(fs.existsSync(body.directories.recovery)).toBe(true);
    expect(fs.existsSync(body.directories.batch)).toBe(true);
    expect(fs.existsSync(body.directories.logs)).toBe(true);
  });
});
