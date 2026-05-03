import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.executionRecordStub.loadLatest.http", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("loads the latest execution artifact through the HTTP route", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-http-load-"));

    await request(app.getHttpServer())
      .post("/execution/record-stub")
      .send({
        rootDirectoryPath: tempDir,
        executionRecord: {
          subtreeId: "G:G348",
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          jobId: "job-0698",
          shots: 8192,
          resilienceLevel: 0,
          status: "submitted",
          provenanceManifestPath: "/provenance/ws6/job-0698.json",
          submittedAtUtc: "2026-04-17T17:03:17.743Z",
          caseLabel: "phase2b_row_0698__G_G348",
        },
        executionResult: {
          jobId: "job-0698",
          status: "completed",
          rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
          recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
          provenanceManifestPath: "/provenance/ws6/job-0698.json",
          completedAtUtc: "2026-04-17T17:05:00.000Z",
          failureReason: null,
        },
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.executionRecordStub.loadLatest.http.spec",
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post("/execution/record-stub/load-latest")
      .send({
        rootDirectoryPath: tempDir,
        caseLabel: "phase2b_row_0698__G_G348",
      })
      .expect(200);

    expect(response.body.executionRecord.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(response.body.executionResult.status).toBe("completed");
    expect(fs.existsSync(response.body.executionRecordPath)).toBe(true);
  });
});
