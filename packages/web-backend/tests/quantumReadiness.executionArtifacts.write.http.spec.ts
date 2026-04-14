import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ExecutionArtifactsWriteHttpResponse {
  outputDir: string;
  executionArtifactPath: string;
  provenanceManifestPath: string;
}

describe("QuantumReadiness HTTP execution artifacts write", () => {
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

  it("POST /api/quantum-readiness/execution/artifacts/raw-counts/write writes execution and provenance files", async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-exec-artifacts-write-"));

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/execution/artifacts/raw-counts/write")
      .send({
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
        outputDir,
      })
      .expect(200);

    const body = response.body as ExecutionArtifactsWriteHttpResponse;

    expect(fs.existsSync(body.executionArtifactPath)).toBe(true);
    expect(fs.existsSync(body.provenanceManifestPath)).toBe(true);
  });
});
