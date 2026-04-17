import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.providerRequest.http", () => {
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

  it("writes and loads provider execution request artifacts through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-request-http-"));

    const persisted = await request(app.getHttpServer())
      .post("/execution/provider-request")
      .send({
        rootDirectoryPath: tempDir,
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
        scriptVersion: "quantumReadiness.providerRequest.http.spec",
      })
      .expect(200);

    expect(fs.existsSync(persisted.body.requestPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/execution/provider-request/load-latest")
      .send({
        rootDirectoryPath: tempDir,
        caseLabel: "phase2b_row_0698__G_G348",
      })
      .expect(200);

    expect(loaded.body.request.requestId).toBe("provider-request-0698");
    expect(loaded.body.request.backendName).toBe("ibm_torino");
  });
});
