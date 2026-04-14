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

interface PreparationWorkflowByIdHttpResponse {
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

describe("QuantumReadiness HTTP preparation workflow run by id", () => {
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

  beforeEach(() => {
    graphModelServiceMock.getFaultTreeGraph.mockReset();
  });

  it("POST /api/quantum-readiness/workflow/preparation-run/by-id creates scaffold and writes preparation artifacts from stored graph", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue(cloneOpenPraFixture(openPraNormalizedCase1));

    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-preparation-by-id-root-"));

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/preparation-run/by-id")
      .send({
        rootDir,
        faultTreeId: "openpra_graph_case_1",
        subtreeId: "TOP",
        modelName: "Preparation By Id Graph",
      })
      .expect(200);

    const body = response.body as PreparationWorkflowByIdHttpResponse;

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("openpra_graph_case_1");
    expect(fs.existsSync(body.workflowRun.workflowRunDir)).toBe(true);
    expect(fs.existsSync(body.workflowRun.manifestPath)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.preparation)).toBe(true);
    expect(fs.existsSync(body.preparationWrite.bundlePath)).toBe(true);
    expect(body.preparationWrite.artifactPaths.length).toBeGreaterThan(0);
    expect(body.preparationWrite.artifactPaths.every((artifactPath) => fs.existsSync(artifactPath))).toBe(true);
  });
});
