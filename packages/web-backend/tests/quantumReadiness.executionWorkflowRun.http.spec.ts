import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ExecutionWorkflowRunHttpResponse {
  workflowRun: {
    workflowRunDir: string;
    manifestPath: string;
    directories: {
      execution: string;
    };
  };
  executionWrite: {
    executionArtifactPath: string;
    provenanceManifestPath: string;
  };
}

describe("QuantumReadiness HTTP execution workflow run", () => {
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

  it("POST /api/quantum-readiness/workflow/execution-run creates scaffold and writes execution artifacts", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-execution-workflow-root-"));

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/execution-run")
      .send({
        rootDir,
        modelId: "phase2b_row_0001",
        subtreeId: "TOP",
        sourcePreparationArtifactId: "preparation:phase2b_row_0001:TOP:abc",
        providerType: "simulator",
        providerName: "qiskit-aer",
        backendName: "aer_simulator",
        executionMode: "counts_only",
        shots: 100,
        rawCounts: {
          "000": 10,
          "011": 30,
          "100": 60,
        },
      })
      .expect(200);

    const body = response.body as ExecutionWorkflowRunHttpResponse;

    expect(fs.existsSync(body.workflowRun.workflowRunDir)).toBe(true);
    expect(fs.existsSync(body.workflowRun.manifestPath)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.execution)).toBe(true);
    expect(fs.existsSync(body.executionWrite.executionArtifactPath)).toBe(true);
    expect(fs.existsSync(body.executionWrite.provenanceManifestPath)).toBe(true);
  });
});
