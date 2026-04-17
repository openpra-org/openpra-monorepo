import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.providerBridge.http", () => {
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

  it("submits a stored provider request through the provider bridge route", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-http-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");

    await request(app.getHttpServer())
      .post("/execution/provider-request")
      .send({
        rootDirectoryPath: providerRequestRoot,
        executionRequest: {
          requestId: "provider-request-0698",
          subtreeId: "G:G348",
          caseLabel: "phase2b_row_0698__G_G348",
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          shots: 8192,
          resilienceLevel: 0,
          createdAtUtc: "2026-04-17T17:03:17.743Z",
          notes: "WS6 exact path request",
        },
        inputArtifactPaths: [],
        scriptVersion: "quantumReadiness.providerBridge.http.spec",
      })
      .expect(200);

    const submitted = await request(app.getHttpServer())
      .post("/execution/provider-bridge/submit")
      .send({
        providerRequestRootDirectoryPath: providerRequestRoot,
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: "phase2b_row_0698__G_G348",
        scriptVersion: "quantumReadiness.providerBridge.http.spec",
      })
      .expect(200);

    expect(submitted.body.loadedProviderRequest.request.requestId).toBe("provider-request-0698");
    expect(submitted.body.executionSubmission.executionRecord.status).toBe("submitted");
    expect(fs.existsSync(submitted.body.executionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = await request(app.getHttpServer())
      .post("/execution/record-stub/load-latest")
      .send({
        rootDirectoryPath: executionArtifactsRoot,
        caseLabel: "phase2b_row_0698__G_G348",
      })
      .expect(200);

    expect(loadedExecution.body.executionRecord.jobId).toBe("provider-request-0698");
    expect(loadedExecution.body.executionResult).toBeNull();
  });
});
