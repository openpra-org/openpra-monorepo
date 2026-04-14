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

interface PreparationArtifactsWriteHttpResponse {
  outputDir: string;
  bundlePath: string;
  artifactPaths: string[];
}

describe("QuantumReadiness HTTP preparation artifacts write", () => {
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

  it("POST /api/quantum-readiness/fault-tree-graph/preparation-artifacts/write writes artifact files", async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-prep-artifacts-write-"));

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/preparation-artifacts/write")
      .send({
        graph: cloneOpenPraFixture(openPraNormalizedCase1),
        modelName: "Write Preparation Artifacts Graph",
        outputDir,
      })
      .expect(200);

    const body = response.body as PreparationArtifactsWriteHttpResponse;

    expect(fs.existsSync(body.bundlePath)).toBe(true);
    expect(body.artifactPaths.length).toBeGreaterThan(0);
    expect(body.artifactPaths.every((artifactPath) => fs.existsSync(artifactPath))).toBe(true);
  });
});
