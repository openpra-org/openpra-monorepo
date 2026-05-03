import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.providerBridgeCompletion.http", () => {
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

  it("completes a provider bridge submission through the HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-bridge-completion-http-"));
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
        scriptVersion: "quantumReadiness.providerBridgeCompletion.http.spec",
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/execution/provider-bridge/submit")
      .send({
        providerRequestRootDirectoryPath: providerRequestRoot,
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: "phase2b_row_0698__G_G348",
        scriptVersion: "quantumReadiness.providerBridgeCompletion.http.spec",
      })
      .expect(200);

    const completed = await request(app.getHttpServer())
      .post("/execution/provider-bridge/complete")
      .send({
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: "phase2b_row_0698__G_G348",
        rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
        recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
        scriptVersion: "quantumReadiness.providerBridgeCompletion.http.spec",
      })
      .expect(200);

    expect(completed.body.completedExecutionSubmission.executionRecord.status).toBe("completed");
    expect(completed.body.completedExecutionSubmission.executionResult.status).toBe("completed");
    expect(fs.existsSync(completed.body.completedExecutionSubmission.persistedArtifacts.recordPath)).toBe(true);

    const loadedExecution = await request(app.getHttpServer())
      .post("/execution/record-stub/load-latest")
      .send({
        rootDirectoryPath: executionArtifactsRoot,
        caseLabel: "phase2b_row_0698__G_G348",
      })
      .expect(200);

    expect(loadedExecution.body.executionRecord.status).toBe("completed");
    expect(loadedExecution.body.executionResult.rawCountsArtifactPath).toBe(
      "/raw-counts/phase2b_row_0698__G_G348.json",
    );
  });
});
