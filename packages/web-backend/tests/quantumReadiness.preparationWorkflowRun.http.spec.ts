import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { cloneOpenPraFixture, openPraNormalizedCase1 } from "../src/quantumReadiness/openPraFaultTreeGraph.fixtures";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface PreparationWorkflowRunHttpResponse {
  workflowRun: {
    workflowRunDir: string;
    manifestPath: string;
    directories: {
      preparation: string;
    };
  };
  preparationWrite: {
    bundlePath: string;
    artifactPaths: string[];
  };
}

describe("QuantumReadiness HTTP preparation workflow run", () => {
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

  it("POST /api/quantum-readiness/workflow/preparation-run creates scaffold and writes preparation artifacts", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-preparation-workflow-root-"));

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/preparation-run")
      .send({
        rootDir,
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
        modelName: "Preparation Workflow Graph",
        graph: cloneOpenPraFixture(openPraNormalizedCase1),
      })
      .expect(200);

    const body = response.body as PreparationWorkflowRunHttpResponse;

    expect(fs.existsSync(body.workflowRun.workflowRunDir)).toBe(true);
    expect(fs.existsSync(body.workflowRun.manifestPath)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.preparation)).toBe(true);
    expect(fs.existsSync(body.preparationWrite.bundlePath)).toBe(true);
    expect(body.preparationWrite.artifactPaths.length).toBeGreaterThan(0);
    expect(body.preparationWrite.artifactPaths.every((artifactPath) => fs.existsSync(artifactPath))).toBe(true);
  });
});
