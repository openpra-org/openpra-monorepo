import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.ws6CanonicalExecutionReport.http", () => {
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

  it("builds and loads the WS6 canonical execution report through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-report-http-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");
    const reportRoot = path.join(tempDir, "report");

    for (const entry of [
      {
        requestId: "provider-request-0698",
        subtreeId: "G:G348",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      {
        requestId: "provider-request-0905",
        subtreeId: "G:G939",
        caseLabel: "phase2b_row_0905__G_G939",
      },
    ]) {
      await request(app.getHttpServer())
        .post("/execution/provider-request")
        .send({
          rootDirectoryPath: providerRequestRoot,
          executionRequest: {
            requestId: entry.requestId,
            subtreeId: entry.subtreeId,
            caseLabel: entry.caseLabel,
            providerName: "ibm_runtime",
            backendName: "ibm_torino",
            shots: 8192,
            resilienceLevel: 0,
            createdAtUtc: "2026-04-17T17:03:17.743Z",
            notes: "WS6 canonical execution report request",
          },
          inputArtifactPaths: [],
          scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.http.spec",
        })
        .expect(200);

      await request(app.getHttpServer())
        .post("/execution/provider-bridge/submit")
        .send({
          providerRequestRootDirectoryPath: providerRequestRoot,
          executionArtifactsRootDirectoryPath: executionArtifactsRoot,
          caseLabel: entry.caseLabel,
          scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.http.spec",
        })
        .expect(200);

      await request(app.getHttpServer())
        .post("/execution/provider-bridge/complete")
        .send({
          executionArtifactsRootDirectoryPath: executionArtifactsRoot,
          caseLabel: entry.caseLabel,
          rawCountsArtifactPath: `/raw-counts/${entry.caseLabel}.json`,
          recoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
          completedAtUtc: "2026-04-17T17:05:00.000Z",
          failureReason: null,
          scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.http.spec",
        })
        .expect(200);
    }

    const built = await request(app.getHttpServer())
      .post("/execution/provider-bridge/canonical-report")
      .send({
        rootDirectoryPath: reportRoot,
        sourceExecutionArtifactsRootDirectoryPath: executionArtifactsRoot,
        scriptVersion: "quantumReadiness.ws6CanonicalExecutionReport.http.spec",
      })
      .expect(200);

    expect(built.body.summary.totalCases).toBe(2);
    expect(built.body.summary.completedCount).toBe(2);
    expect(fs.existsSync(built.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/execution/provider-bridge/canonical-report/load-latest")
      .send({
        rootDirectoryPath: reportRoot,
      })
      .expect(200);

    expect(loaded.body.summary.caseLabels).toEqual(["phase2b_row_0698__G_G348", "phase2b_row_0905__G_G939"]);
    expect(loaded.body.summary.allCompleted).toBe(true);
  });
});
